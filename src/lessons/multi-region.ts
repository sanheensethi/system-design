import type { Lesson, SceneLink, SceneNode, SceneZone } from '../engine/types';

/** Place a node by screen column (right is positive) and screen row (down is positive). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const userUs: SceneNode = { id: 'userUs', kind: 'phone', at: p(-8, -3), label: 'user', sub: 'New York' };
const userEu: SceneNode = { id: 'userEu', kind: 'phone', at: p(8, -3), label: 'user', sub: 'Frankfurt' };
const dns: SceneNode = { id: 'dns', kind: 'block', at: p(0, -6), label: 'GeoDNS', sub: 'shop.example.com', icon: 'Globe', tint: 'violet' };
const anycast: SceneNode = { id: 'anycast', kind: 'block', at: p(0, -6), label: 'anycast IP', sub: '203.0.113.10', icon: 'Route', tint: 'violet' };
const appUs: SceneNode = { id: 'appUs', kind: 'server', at: p(-5.5, 2), label: 'app US', sub: 'us-east' };
const dbUs: SceneNode = { id: 'dbUs', kind: 'db', at: p(-2.5, 5), label: 'db US' };
const appEu: SceneNode = { id: 'appEu', kind: 'server', at: p(5.5, 2), label: 'app EU', sub: 'eu-central' };
const dbEu: SceneNode = { id: 'dbEu', kind: 'db', at: p(2.5, 5), label: 'db EU' };
const monitor: SceneNode = { id: 'monitor', kind: 'block', at: p(0, 1), label: 'monitor', sub: '3 locations', icon: 'Activity', tint: 'amber' };

const zoneUs: SceneZone = { id: 'us', from: [-3, 2.2], to: [2.5, 6.5], label: 'us-east', tone: 'blue' };
const zoneEu: SceneZone = { id: 'eu', from: [2.8, -3], to: [7, 2], label: 'eu-central', tone: 'violet' };

const regionLinks = [link('appUs', 'dbUs'), link('appEu', 'dbEu')];
const cross = (label = '~90 ms', extra: Partial<SceneLink> = {}) =>
  link('dbUs', 'dbEu', { style: 'dashed', label, route: 'straight', ...extra });

export const multiRegion: Lesson = {
  id: 'multi-region',
  title: 'Multi-region and geo routing',
  tagline: 'Run the system in more than one region, send each user to the nearest one, and survive losing a whole region.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Why one region limits latency and availability, and how zones differ from regions',
    'Why regions: latency, availability and data residency, and what a second region costs',
    'Routing users with GeoDNS and with anycast, and the limits of each',
    'Active-passive versus active-active regions, and home regions for writes',
    'Global data, regional data and data residency',
    'Cross-region replication lag, read-your-writes, and sync versus async',
    'Handling write conflicts between regions',
    'Evacuating a region, deciding when to fail over, capacity, failback, staged deploys and drills',
  ],
  metrics: [
    { key: 'eu', label: 'Frankfurt page load', icon: 'Timer' },
    { key: 'regions', label: 'Regions serving', icon: 'Globe' },
    { key: 'lag', label: 'Cross-region lag', icon: 'Clock' },
    { key: 'outage', label: 'If a region dies', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Far away',
      tag: 'problem',
      heading: 'Every user talks to Virginia',
      eli5: 'A pizza chain has one kitchen, in New York. A customer in Frankfurt orders, and every pizza crosses the ocean. One **region** is one kitchen.',
      body: [
        'The shop runs in one cloud region on the US east coast. A user in New York gets each round trip in about 10 ms. A user in Frankfurt pays about **90 ms**, set by distance and the speed of light in fiber. No server upgrade changes it.',
        'A page load needs about six round trips: TCP and TLS setup, the HTML, then API calls. That is 60 ms in New York and about **550 ms** in Frankfurt.',
      ],
      keyIdea: 'Distance is a tax that servers cannot remove. Far users pay it on every round trip.',
      metrics: { eu: '550 ms', regions: '1', lag: '-', outage: 'total outage' },
      metricTones: { eu: 'bad', regions: 'warn' },
      scene: {
        zones: [zoneUs],
        nodes: [userUs, { ...userEu, status: 'hot', badge: '90 ms per trip' }, { ...appUs, status: 'active' }, dbUs],
        links: [
          link('userUs', 'appUs', { label: '10 ms' }),
          link('userEu', 'appUs', { style: 'dashed', label: 'across the Atlantic', labelTone: 'warn' }),
          link('appUs', 'dbUs'),
        ],
        flows: [
          { path: ['userUs', 'appUs'], tone: 'request', duration: 0.8 },
          { path: ['appUs', 'userUs'], tone: 'response', duration: 0.8, delay: 0.9 },
          { path: ['userEu', 'appUs'], tone: 'request', label: 'GET /cart', duration: 2.4 },
          { path: ['appUs', 'userEu'], tone: 'response', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'Page load, 6 round trips',
          icon: 'Timer',
          rows: [
            { text: 'New York, 10 ms each', value: '60 ms', tone: 'good' },
            { text: 'Frankfurt, 90 ms each', value: '~550 ms', tone: 'bad' },
          ],
          footer: { text: 'Half the users get the slow product', tone: 'bad' },
        },
        caption: 'Same app, very different speed',
      },
    },
    {
      title: 'Failure domain',
      tag: 'concept',
      heading: 'One region is one failure domain',
      eli5: 'The one kitchen has several stoves in separate rooms. A fire in one room is fine. A flood of the whole building closes the kitchen for every customer.',
      body: [
        'A region holds several **availability zones**: separate buildings with their own power and network. Spreading across zones survives a building fault. It does not survive a regional network failure or a bad config pushed to the whole region.',
        'The availability tiers show the line. About 99.9% needs multiple zones and automatic failover. 99.99% (about 52 minutes of downtime a year) needs multiple regions and a failover that has been tested.',
      ],
      keyIdea: 'Zones protect against a building failing. Only a second region protects against the region failing.',
      metrics: { eu: '550 ms', regions: '1', lag: '-', outage: 'total outage' },
      metricTones: { outage: 'bad' },
      scene: {
        zones: [{ ...zoneUs, tone: 'red' }],
        nodes: [userUs, userEu, { ...appUs, status: 'down', badge: 'region failed' }, { ...dbUs, status: 'down' }],
        links: [link('userUs', 'appUs'), link('userEu', 'appUs', { style: 'dashed' }), link('appUs', 'dbUs')],
        flows: [
          { path: ['userUs', 'appUs'], tone: 'error', label: 'timeout', duration: 1.4 },
          { path: ['userEu', 'appUs'], tone: 'error', label: 'timeout', duration: 2.4, delay: 0.4 },
        ],
        panel: {
          title: 'Availability by design',
          icon: 'Shield',
          rows: [
            { text: '99%: one region, basic HA', value: '3.6 days/yr', tone: 'bad' },
            { text: '99.9%: multi-zone, auto failover', value: '8.8 h/yr', tone: 'warn' },
            { text: '99.99%: multi-region, tested', value: '52 min/yr', tone: 'good' },
            { text: '99.999%: active-active, no single control plane', value: '5 min/yr', tone: 'good' },
          ],
        },
        caption: 'Replicas inside the region do not help',
      },
    },
    {
      title: 'Why regions',
      tag: 'concept',
      heading: 'Three reasons to run in more than one region',
      eli5: 'The chain opens a second kitchen in Frankfurt. European pizzas arrive hot, and if one kitchen closes, the other still cooks. A third reason: some towns insist their orders stay in town.',
      body: [
        '**Latency**: serve users from a region near them, so the 90 ms trip becomes a 10 ms one. **Availability**: if a region fails, another takes its traffic.',
        '**Data residency**: laws or contracts that require certain users\' data to stay in a country or bloc. Many products need only one of the three reasons to justify a second region.',
        'For static content, try a **CDN** first. It caches images and scripts near users and is the cheap first latency step, before a second region is needed.',
      ],
      keyIdea: 'Regions buy latency, availability and data residency.',
      metrics: { eu: '550 ms', regions: '1 (+1 being built)', lag: '-', outage: 'total outage' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userEu, { ...appUs, status: 'active' }, dbUs, { ...appEu, status: 'dim', badge: 'new region' }, { ...dbEu, status: 'dim' }],
        links: [link('userEu', 'appUs', { style: 'faint' }), ...regionLinks],
        flows: [{ path: ['userEu', 'appUs'], tone: 'request', duration: 2.4 }],
        panel: {
          title: 'What a second region buys',
          icon: 'Globe',
          rows: [
            { text: 'Latency', value: '90 ms to 10 ms', tone: 'good' },
            { text: 'Availability', value: 'survive a region', tone: 'good' },
            { text: 'Data residency', value: 'EU data stays in EU', tone: 'good' },
          ],
        },
        caption: 'A second region, not serving yet',
      },
    },
    {
      title: 'The price',
      tag: 'tradeoff',
      heading: 'A second region costs more than a second server bill',
      eli5: 'Two kitchens means two sets of cooks and two grocery bills. The hard part is keeping both order books the same while the mail between them is slow.',
      body: [
        'Data must be copied between regions, and cross-region traffic is billed per GB. Every deploy, migration and alert now happens twice. And the hard part is the data: two regions that both hold state must agree on it, across a link that is slow and sometimes broken.',
      ],
      keyIdea: 'The cost of regions is mostly state: copying it, agreeing on it, and running everything twice.',
      metrics: { eu: '550 ms', regions: '2 (one idle)', lag: '~90 ms', outage: 'total outage' },
      metricTones: { regions: 'warn' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [{ ...appUs, status: 'active' }, dbUs, { ...appEu, status: 'dim' }, dbEu],
        links: [...regionLinks, cross('~90 ms, billed per GB', { labelTone: 'warn' })],
        flows: [{ path: ['dbUs', 'dbEu'], tone: 'data', label: 'copies', count: 2, duration: 1.8 }],
        panel: {
          title: 'What doubles',
          icon: 'Layers',
          rows: [
            { text: 'Servers and databases', value: 'x2', tone: 'warn' },
            { text: 'Cross-region traffic', value: 'billed', tone: 'warn' },
            { text: 'Deploys, migrations, alerts', value: 'x2', tone: 'warn' },
            { text: 'Agreeing on shared data', value: 'the hard part', tone: 'bad' },
          ],
        },
        caption: 'Stateless parts copy easily. Data does not',
      },
    },
    {
      title: 'GeoDNS',
      tag: 'concept',
      heading: 'GeoDNS: a different answer for each place',
      eli5: 'The chain has one phone number. A clever operator hears where you are calling from and gives you the address of the nearest kitchen. That operator is **GeoDNS**.',
      body: [
        'With **GeoDNS** the authoritative DNS server looks at where a query comes from and answers with the address of the closest healthy region. New York gets the US address, Frankfurt the EU one. The app does not change.',
        'Policies vary: by location, by measured latency, or by weight (send 5% to a new region). Health checks drop an answer whose region is failing.',
      ],
      keyIdea: 'GeoDNS sends each user to a nearby region by answering DNS differently by location.',
      metrics: { eu: '60 ms', regions: '2', lag: '-', outage: 'half the users' },
      metricTones: { eu: 'good' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, { ...dns, status: 'active', badge: 'answer by location' }, appUs, appEu],
        links: [
          link('userUs', 'dns', { style: 'faint' }),
          link('userEu', 'dns', { style: 'faint' }),
          link('userUs', 'appUs'),
          link('userEu', 'appEu'),
        ],
        flows: [
          { path: ['userEu', 'dns'], tone: 'handshake', label: 'where is shop?', duration: 1 },
          { path: ['dns', 'userEu'], tone: 'response', label: 'EU address', duration: 1, delay: 1.1 },
          { path: ['userEu', 'appEu'], tone: 'request', label: 'GET /cart', duration: 0.9, delay: 2.3 },
          { path: ['userUs', 'dns'], tone: 'handshake', duration: 1, delay: 0.4 },
          { path: ['dns', 'userUs'], tone: 'response', label: 'US address', duration: 1, delay: 1.5 },
          { path: ['userUs', 'appUs'], tone: 'request', duration: 0.9, delay: 2.7 },
        ],
        panel: {
          title: 'One name, two answers',
          icon: 'Table',
          rows: [
            { text: 'Resolver in New York', value: 'us-east LB' },
            { text: 'Resolver in Frankfurt', value: 'eu-central LB' },
            { text: 'Unknown location', value: 'default: us-east', tone: 'muted' },
          ],
        },
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
      title: 'Resolver limit',
      tag: 'tradeoff',
      heading: 'GeoDNS sees the resolver, not the user',
      eli5: 'The operator only sees which phone booth you call from, not where you live. A far-away booth gets you the wrong kitchen.',
      body: [
        'DNS sees the resolver, not the user. A user on a far-away public resolver can be sent to the wrong region. Many resolvers forward part of the client\'s address (EDNS Client Subnet) to improve this, and not all do.',
      ],
      keyIdea: 'GeoDNS guesses location from the resolver, which can be far from the user.',
      metrics: { eu: '550 ms (wrong region)', regions: '2', lag: '-', outage: 'half the users' },
      metricTones: { eu: 'bad' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          userEu,
          { ...dns, label: 'public resolver', sub: 'located in US', status: 'hot', badge: 'looks like a US user' },
          appUs,
          { ...appEu, status: 'dim' },
        ],
        links: [
          link('userEu', 'dns', { label: 'asks resolver', labelTone: 'warn' }),
          link('dns', 'appUs', { style: 'faint' }),
          link('userEu', 'appUs', { style: 'dashed', label: 'sent to US', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['userEu', 'dns'], tone: 'handshake', label: 'where is shop?', duration: 1.2 },
          { path: ['dns', 'userEu'], tone: 'response', label: 'US address', duration: 1.2, delay: 1.3 },
          { path: ['userEu', 'appUs'], tone: 'request', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'Resolver location',
          icon: 'Globe',
          rows: [
            { text: 'Resolver sends client subnet (ECS)', value: 'better guess', tone: 'good' },
            { text: 'Resolver does not send it', value: 'wrong region possible', tone: 'bad' },
          ],
        },
        caption: 'The resolver, not the user, is what DNS sees',
      },
    },
    {
      title: 'TTL limit',
      tag: 'tradeoff',
      heading: 'Cached answers outlive the region',
      eli5: 'Once you write the address on your hand, you keep using it even if that kitchen closes. The time you keep it is the **TTL**.',
      body: [
        'Answers are cached for their **TTL**. If you change the answer in an outage, some clients keep the old one until it expires, and a few keep it longer.',
        'Short TTLs (30 to 60 s) speed up failover at the cost of more DNS queries. Long TTLs are cheap and slow to change.',
      ],
      keyIdea: 'TTL caching limits how fast DNS can change its mind.',
      metrics: { eu: '60 ms', regions: '2', lag: '-', outage: 'cached users fail until TTL ends' },
      metricTones: { outage: 'warn' },
      scene: {
        zones: [zoneUs, { ...zoneEu, tone: 'red' }],
        nodes: [
          { ...userEu, chips: [{ text: 'cached EU answer', tone: 'warn' }] },
          { ...dns, status: 'active', badge: 'EU removed, TTL 60 s' },
          appUs,
          { ...appEu, status: 'down', badge: 'region failed' },
        ],
        links: [
          link('userEu', 'appEu', { style: 'dashed', label: 'stale answer', labelTone: 'warn' }),
          link('dns', 'appUs', { style: 'faint' }),
        ],
        flows: [{ path: ['userEu', 'appEu'], tone: 'error', label: 'timeout', duration: 1.6 }],
        panel: {
          title: 'TTL trade',
          icon: 'Clock',
          rows: [
            { text: 'TTL 60 s', value: 'fast failover, more queries', tone: 'good' },
            { text: 'TTL 1 day', value: 'cheap, failover takes a day', tone: 'bad' },
          ],
        },
        caption: 'The cached answer still points at the dead region',
      },
    },
    {
      title: 'Anycast',
      tag: 'concept',
      heading: 'Anycast: one address, announced from many places',
      eli5: 'Now the chain has one phone number that rings at whichever kitchen is closest. Nobody has to look anything up. One number, many kitchens, is **anycast**.',
      body: [
        'With **anycast**, every region announces the same IP address to the internet through BGP, the protocol routers use to share routes. Each router sends packets along the shortest path it knows, so Frankfurt reaches the EU site and New York the US one.',
        'Failover is a routing change: an unhealthy site withdraws its announcement, and traffic flows to the next nearest site, usually within seconds to a minute. No client cache to wait out.',
      ],
      keyIdea: 'Anycast lets the network route each user to a nearby site under one IP, and fails over by withdrawing a route.',
      metrics: { eu: '60 ms', regions: '2', lag: '-', outage: 'half the users' },
      metricTones: { eu: 'good' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, { ...appUs, status: 'active', chips: ['203.0.113.10'] }, { ...appEu, status: 'active', chips: ['203.0.113.10'] }],
        links: [
          link('userUs', 'appUs', { label: 'same IP' }),
          link('userEu', 'appEu', { label: 'same IP' }),
        ],
        flows: [
          { path: ['userUs', 'appUs'], tone: 'request', label: '203.0.113.10', duration: 1.2 },
          { path: ['userEu', 'appEu'], tone: 'request', label: '203.0.113.10', duration: 1.2, delay: 0.3 },
          { path: ['appEu', 'userEu'], tone: 'response', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'BGP announcements',
          icon: 'Route',
          rows: [
            { text: 'us-east announces', value: '203.0.113.10', tone: 'good' },
            { text: 'eu-central announces', value: '203.0.113.10', tone: 'good' },
            { text: 'Unhealthy site', value: 'withdraws route', tone: 'warn' },
          ],
        },
        caption: 'The network picks the nearest site',
      },
    },
    {
      title: 'Anycast limits',
      tag: 'tradeoff',
      heading: 'Anycast fronts edge proxies, not databases',
      eli5: 'The shared phone number reaches the nearest door, but "nearest" by phone lines is not always quickest. So the number rings a front desk that takes your order and walks it to the kitchen.',
      body: [
        '"Nearest" means fewest network hops by the routers\' measure, which is not always lowest latency. A route can also shift mid-connection and break a long TCP session.',
        'So anycast usually fronts **edge proxies** (CDNs, global load balancers, DNS servers) that end the connection close to the user and forward the request over a private backbone.',
      ],
      keyIdea: 'Anycast is a good front door. End the connection at the nearest edge, then forward it to a region.',
      metrics: { eu: '60 ms', regions: '2', lag: '-', outage: 'half the users' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          userEu,
          { ...anycast, label: 'edge proxy', sub: 'anycast, Frankfurt', icon: 'Shield', tint: 'teal', status: 'active', badge: 'ends TLS here' },
          appEu,
          appUs,
        ],
        links: [
          link('userEu', 'anycast', { label: '8 ms' }),
          link('anycast', 'appEu', { label: 'private backbone' }),
          link('anycast', 'appUs', { style: 'faint' }),
        ],
        flows: [
          { path: ['userEu', 'anycast'], tone: 'request', label: 'TLS ends', duration: 1 },
          { path: ['anycast', 'appEu'], tone: 'request', label: 'GET /cart', duration: 1.4, delay: 1.1 },
          { path: ['appEu', 'userEu'], tone: 'response', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'DNS or anycast',
          icon: 'Table',
          rows: [
            { text: 'Failover', value: 'DNS waits out TTL, anycast withdraws route' },
            { text: 'Mid-connection', value: 'DNS: stable, anycast: may shift' },
            { text: 'Usually used for', value: 'DNS: origins, anycast: edges' },
          ],
          footer: { text: 'Many setups use both', tone: 'muted' },
        },
        caption: 'Short hop to the edge, then the backbone',
      },
    },
    {
      title: 'Active-passive',
      tag: 'tradeoff',
      heading: 'Active-passive regions: one serves, one waits',
      eli5: 'The Frankfurt kitchen is stocked and has a copy of every order book, but takes no orders. If New York closes, Frankfurt opens its doors. That is an **active-passive** setup.',
      body: [
        'All traffic stays in one region. The second region runs a smaller copy of the stack and an **async replica** of the database, about 90 ms behind. No write conflicts, because one region owns all writes.',
        'Failover means promoting the EU database, scaling up the EU app tier and pointing DNS at it: **minutes**, and you lose the writes that had not crossed yet. Latency does not improve, and the idle region\'s config drifts and its capacity goes untested.',
      ],
      keyIdea: 'Active-passive regions are simple and conflict-free, but they help only with disasters, not latency.',
      metrics: { eu: '550 ms', regions: '1 active, 1 standby', lag: '~90 ms', outage: 'minutes of downtime' },
      metricTones: { eu: 'bad', outage: 'warn' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          userEu,
          { ...appUs, status: 'active', badge: 'all traffic' },
          { ...dbUs, status: 'active', badge: 'primary' },
          { ...appEu, status: 'dim', badge: 'scaled down' },
          { ...dbEu, badge: 'async replica' },
        ],
        links: [link('userEu', 'appUs'), ...regionLinks, cross()],
        flows: [
          { path: ['userEu', 'appUs', 'dbUs'], tone: 'request', duration: 2.4 },
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'replication', count: 2, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Standby costs',
          icon: 'Layers',
          rows: [
            { text: 'Write conflicts', value: 'none', tone: 'good' },
            { text: 'Failover time', value: 'minutes', tone: 'warn' },
            { text: 'Frankfurt latency', value: 'still 550 ms', tone: 'bad' },
            { text: 'Standby drift', value: 'untested', tone: 'warn' },
          ],
        },
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
        'Frankfurt latency drops to about 60 ms, and losing a region costs half the users briefly instead of all of them.',
      ],
      keyIdea: 'Active-active serves users locally. The price is deciding who may write what.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'half the users, briefly' },
      metricTones: { eu: 'good', outage: 'warn' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userEu, { ...appUs, status: 'active', chips: ['local reads'] }, { ...dbUs, status: 'active' }, { ...appEu, status: 'active' }, { ...dbEu, status: 'active' }],
        links: [link('userEu', 'appEu'), ...regionLinks],
        flows: [
          { path: ['appUs', 'dbUs'], tone: 'request', label: 'local read', duration: 0.9 },
          { path: ['userEu', 'appEu', 'dbEu'], tone: 'request', label: 'GET /cart', duration: 1.4, delay: 0.2 },
        ],
        panel: {
          title: 'Reads and writes',
          icon: 'Split',
          rows: [
            { text: 'Reads', value: 'local copy, easy', tone: 'good' },
            { text: 'Writes', value: 'who owns the record?', tone: 'warn' },
          ],
        },
        caption: 'Both regions serve at once',
      },
    },
    {
      title: 'Home region',
      tag: 'concept',
      heading: 'Give every user a home region for writes',
      eli5: 'Every customer\'s order book lives in one home kitchen. Even on holiday in another city, their orders are walked back to the home kitchen to be written.',
      body: [
        'The cleanest answer to conflicts is a **home region** per user. Their account, cart and orders live in one region, chosen at signup or by country. Their writes go there, even when they travel. Other regions hold read copies, but only of data that is allowed to cross.',
        'Each record has one writer, so most cross-region conflicts cannot happen.',
      ],
      keyIdea: 'One home region per record for writes avoids most cross-region conflicts.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'half the users, briefly' },
      metricTones: { eu: 'good' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          userUs,
          userEu,
          { ...dbUs, status: 'active', sub: 'home of US users' },
          { ...appEu, status: 'active' },
          { ...dbEu, status: 'active', sub: 'home of EU users' },
        ],
        links: [link('userUs', 'dbUs', { style: 'faint' }), link('userEu', 'appEu'), link('appEu', 'dbEu'), cross('read copies, allowed data only')],
        flows: [
          { path: ['userEu', 'appEu', 'dbEu'], tone: 'request', label: 'write', duration: 1.4 },
          { path: ['dbEu', 'dbUs'], tone: 'data', label: 'read copy', duration: 1.6, delay: 1.6 },
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'read copy', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Who writes what',
          icon: 'Users',
          rows: [
            { text: 'EU users\' carts', value: 'written in eu-central', tone: 'good' },
            { text: 'US users\' carts', value: 'written in us-east', tone: 'good' },
            { text: 'A US user in Berlin', value: 'writes cross the ocean', tone: 'warn' },
          ],
        },
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
      title: 'Global data',
      tag: 'concept',
      heading: 'Stateless tiers, local caches and global data',
      eli5: 'The recipe book is the same in both kitchens, and only the head office edits it. Each kitchen keeps a small tray of ready ingredients of its own, filled from the local pantry.',
      body: [
        'Stateless app servers are easy: run the same image in every region. Caches fill per region from the local database, and are not shared across the ocean.',
        'Data that is global, like a product catalog edited by a few staff, keeps **one writer region** and replicates everywhere. Reads stay local. Only data that must be written from anywhere at once needs multi-leader replication.',
        'Keep hot paths such as login and sessions regional, so a request never needs a call across the ocean to a US-only service.',
      ],
      keyIdea: 'Copy the stateless parts, fill caches locally, and give global data one writer region.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'half the users, briefly' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...dbUs, status: 'active', badge: 'catalog writer' },
          { ...dbEu, badge: 'catalog copy' },
          { ...appEu, status: 'active' },
          { id: 'cacheEu', kind: 'cache', at: p(8.5, 5), label: 'cache EU', sub: 'filled locally', status: 'ok' },
        ],
        links: [link('appEu', 'dbEu'), link('appEu', 'cacheEu', { style: 'faint' }), cross('catalog edits')],
        flows: [
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'new price', duration: 1.8 },
          { path: ['appEu', 'cacheEu', 'appEu'], tone: 'request', label: 'GET /products/7', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Where each thing lives',
          icon: 'Layers',
          rows: [
            { text: 'App servers', value: 'same image in every region' },
            { text: 'Caches', value: 'one per region' },
            { text: 'Product catalog', value: 'one writer, copies everywhere' },
            { text: 'User carts', value: 'home region' },
          ],
        },
        caption: 'Catalog edits in one place, reads in both',
      },
    },
    {
      title: 'Residency',
      tag: 'concept',
      heading: 'Data residency: some data may not leave',
      eli5: 'Frankfurt insists its families\' order books stay in Frankfurt. So the home kitchen rule does double duty: those books are written there and never mailed to New York.',
      body: [
        'Rules such as GDPR restrict moving personal data out of a region, and some contracts demand a country or bloc. A home region chosen by country makes the rule the default: EU users\' rows are written and stored in eu-central.',
        'Only non-personal data such as the catalog, plus US data if allowed, replicates. EU-resident data fails over only to another EU region, so residency means a second EU region or accepting an outage.',
        'Also check logs, exports and backups for leaks.',
      ],
      keyIdea: 'A home region by country gives residency by default. Then audit every copy: logs, backups and exports.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'half the users, briefly' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userEu, { ...dbEu, status: 'active', badge: 'EU personal data' }, { ...dbUs, status: 'dim' }, { ...appEu, status: 'active' }],
        links: [link('userEu', 'appEu'), link('appEu', 'dbEu'), cross('EU rows never copied, catalog only', { labelTone: 'good' })],
        flows: [
          { path: ['userEu', 'appEu', 'dbEu'], tone: 'request', label: 'save profile', duration: 1.4 },
          { path: ['dbEu', 'dbUs'], tone: 'error', label: 'blocked', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Where EU data may sit',
          icon: 'Shield',
          rows: [
            { text: 'Orders, profiles', value: 'eu-central only', tone: 'good' },
            { text: 'Backups', value: 'EU bucket', tone: 'good' },
            { text: 'Logs with emails', value: 'check', tone: 'warn' },
            { text: 'Analytics exports', value: 'check', tone: 'warn' },
          ],
        },
        caption: 'The home region keeps EU data in the EU',
      },
    },
    {
      title: 'Replication lag',
      tag: 'tradeoff',
      heading: 'The copy across the ocean is always behind',
      eli5: 'Each kitchen mails copies of its order book to the other. The mail takes time. For a little while, Frankfurt\'s copy of a New York order is out of date. That delay is **replication lag**.',
      body: [
        'Cross-region replication is almost always **asynchronous**. Each region\'s copy of the other\'s data trails it: around 100 ms on a good day, and seconds or minutes during a backlog or a network problem.',
        'If a region dies, its unshipped writes are gone: the lag is your **RPO** for that region. Measure lag per region pair and alert on it.',
      ],
      keyIdea: 'Cross-region copies are async, so they are stale by at least the network delay, and that lag is the data you lose if a region dies.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '3 s (backlog)', outage: 'lose last 3 s of writes' },
      metricTones: { lag: 'bad', outage: 'bad' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...appUs, status: 'active' },
          { ...dbUs, status: 'active', badge: 'order #881 saved' },
          appEu,
          { ...dbEu, status: 'hot', badge: 'lag 3 s, no #881 yet' },
        ],
        links: [...regionLinks, cross('backlog', { labelTone: 'warn' })],
        flows: [
          { path: ['appUs', 'dbUs'], tone: 'request', label: 'place order', duration: 1.2 },
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'backlog', count: 5, duration: 3.2, delay: 1.3 },
          { path: ['appEu', 'dbEu'], tone: 'request', label: 'list orders', duration: 1, delay: 1.8 },
          { path: ['dbEu', 'appEu'], tone: 'error', label: 'missing #881', duration: 1, delay: 2.9 },
        ],
        panel: {
          title: 'Where lag shows up',
          icon: 'Clock',
          rows: [
            { text: 'Good day', value: '~100 ms', tone: 'good' },
            { text: 'Backlog or network trouble', value: 'seconds to minutes', tone: 'bad' },
            { text: 'Region dies', value: 'lag = data lost (RPO)', tone: 'bad' },
          ],
        },
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
      title: 'Read your writes',
      tag: 'case',
      heading: 'Case: I just ordered, where is my order?',
      eli5: 'A New York customer on holiday in Frankfurt orders a pizza, then asks to see the order. Frankfurt\'s copy has not arrived yet, so it says there is no such order.',
      body: [
        'A user writes in their home region, then reads in another (traveling, or routed elsewhere). The copy has not arrived, so their own change seems to vanish.',
        'Fix it by sending that user\'s reads of their own data to their home region, or by returning a version token with each write and waiting until the local copy has reached it.',
      ],
      keyIdea: 'Read your own writes from the home region, or wait until the local copy has caught up to your last write.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '3 s', outage: 'half the users, briefly' },
      metricTones: { lag: 'warn' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...userEu, label: 'traveler', sub: 'home: US', chips: [{ text: 'GET /orders/881', tone: 'warn' }] },
          { ...appEu, status: 'active' },
          { ...dbEu, status: 'hot', badge: 'copy at v5090' },
          { ...dbUs, status: 'active', badge: 'home at v5120' },
        ],
        links: [link('userEu', 'appEu'), link('appEu', 'dbEu'), cross('catching up', { labelTone: 'warn' })],
        flows: [
          { path: ['userEu', 'appEu', 'dbEu'], tone: 'request', label: 'read #881', duration: 1.4 },
          { path: ['dbEu', 'appEu'], tone: 'error', label: 'v5090 < v5120', duration: 1, delay: 1.5 },
          { path: ['appEu', 'dbUs'], tone: 'request', label: 'read at home', duration: 2, delay: 2.6 },
        ],
        panel: {
          title: 'Version token',
          icon: 'Code',
          code: 'POST /orders  ->  200, token v5120\nGET  /orders/881  (token v5120)\n  local copy at v5090: behind\n  so: wait, or read from home',
          footer: { text: 'The token comes back with every write', tone: 'muted' },
        },
        caption: 'A fresh write can be missing from a far copy',
      },
    },
    {
      title: 'Sync or async',
      tag: 'tradeoff',
      heading: 'Synchronous copies trade latency for no lost writes',
      eli5: 'The head cook could wait for the other kitchen to confirm each order before telling the customer it is done. Nothing gets lost, but every order now takes as long as the ocean crossing.',
      body: [
        'Synchronous replication across regions adds a full round trip, about 90 ms, to every commit. If the other region is unreachable, writes stall or the system must decide to carry on without it.',
        'Quorum databases, which commit once a majority of three regions confirm, lose no data when one region dies. They pay the latency of the second-nearest region on every write.',
      ],
      keyIdea: 'Async is fast and can lose the last seconds. Sync or quorum loses nothing and adds a cross-region round trip to every write.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '0 s (sync)', outage: 'no data lost, slower writes' },
      metricTones: { lag: 'good', outage: 'warn' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...appUs, status: 'active', chips: [{ text: 'commit: 95 ms', tone: 'warn' }] },
          { ...dbUs, status: 'active' },
          { ...dbEu, status: 'active', badge: 'must confirm' },
        ],
        links: [link('appUs', 'dbUs'), cross('wait for ack', { labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['appUs', 'dbUs'], tone: 'request', label: 'commit', duration: 1 },
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'copy', duration: 1.4, delay: 1.1 },
          { path: ['dbEu', 'dbUs'], tone: 'response', label: 'ack', duration: 1.4, delay: 2.6 },
          { path: ['dbUs', 'appUs'], tone: 'response', label: 'done', duration: 1, delay: 4.1 },
        ],
        panel: {
          title: 'Write path compared',
          icon: 'Scale',
          rows: [
            { text: 'Async', value: '5 ms, lose last seconds', tone: 'warn' },
            { text: 'Sync to one region', value: '95 ms, no loss', tone: 'warn' },
            { text: 'Quorum of 3', value: '~95 ms, survives 1', tone: 'good' },
          ],
        },
        caption: 'Safer writes cost an ocean crossing',
      },
    },
    {
      title: 'Conflicts',
      tag: 'concept',
      heading: 'When two regions write the same record',
      eli5: 'A shared family order book gets edits in both kitchens at once: New York adds a pizza, Frankfurt removes the salad. When the copies meet, someone must decide what the book really says. That is **conflict** handling.',
      body: [
        'Some data has no single home, like a shared document or one family\'s cart edited from two continents within the same second. With **multi-leader** replication both regions accept the write, and the conflict appears when the changes cross.',
        '**Last write wins** keeps the latest timestamp and silently drops the other. It loses data, and clocks in two regions never align perfectly. A **merge rule** combines both: for a cart, union the added items and apply removals. CRDTs generalize this for counters, sets and text.',
      ],
      keyIdea: 'Multi-leader writes create conflicts. Resolve them with merge rules instead of last write wins.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'half the users, briefly' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...appUs, status: 'active' },
          { ...dbUs, status: 'hot', badge: 'cart: +pizza' },
          { ...appEu, status: 'active' },
          { ...dbEu, status: 'hot', badge: 'cart: -salad' },
        ],
        links: [...regionLinks, cross('both edits committed', { labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['appUs', 'dbUs'], tone: 'request', label: 'add pizza', duration: 1.2 },
          { path: ['appEu', 'dbEu'], tone: 'request', label: 'remove salad', duration: 1.2, delay: 0.2 },
          { path: ['dbUs', 'dbEu'], tone: 'error', label: 'conflict', duration: 1.6, delay: 1.5 },
          { path: ['dbEu', 'dbUs'], tone: 'error', label: 'conflict', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Resolving the cart',
          icon: 'Split',
          rows: [
            { text: 'Last write wins', value: 'one edit lost', tone: 'bad' },
            { text: 'Merge: union adds, apply removes', value: 'pizza, no salad', tone: 'good' },
            { text: 'Design it out: one owner', value: 'no conflict', tone: 'good' },
          ],
          footer: { text: 'Stock for the last few items: single writer', tone: 'muted' },
        },
        caption: 'Both edits committed. Which cart is real?',
      },
    },
    {
      title: 'Region down',
      tag: 'case',
      heading: 'Case: us-east goes dark',
      eli5: 'The New York kitchen loses power. The phone operator stops giving out its address, and every caller is sent to Frankfurt, which now cooks for two cities. That is a **region failover**.',
      body: [
        'Health checks fail for us-east. GeoDNS stops returning the US address (or the site withdraws its anycast route), and new lookups go to eu-central. Cached answers fail until their TTL ends. Promotion runs in parallel with DNS, so recovery takes 90 s to 2 min.',
        'eu-central promotes its copy of US users\' data to writable. In-flight writes are missing until us-east returns. EU-resident data fails over only to another EU region. US users pay the ocean crossing, slow but better than down.',
      ],
      keyIdea: 'A region failover moves traffic and write ownership to the survivor, and leaves some in-flight writes behind.',
      metrics: { eu: '60 ms (US users: 550 ms)', regions: '1 of 2', lag: 'last 2 s lost', outage: '90 s to 2 min for US users' },
      metricTones: { regions: 'bad', lag: 'bad', outage: 'warn' },
      scene: {
        zones: [{ ...zoneUs, tone: 'red' }, zoneEu],
        nodes: [
          userUs,
          { ...dns, status: 'active', label: 'GeoDNS', badge: 'US removed' },
          { ...appUs, status: 'down' },
          { ...monitor, status: 'active', badge: 'us-east failing' },
          { ...appEu, status: 'hot', badge: 'promoted for US users' },
        ],
        links: [
          link('monitor', 'appUs', { style: 'dashed' }),
          link('monitor', 'dns', { style: 'dashed' }),
          link('userUs', 'appEu', { style: 'dashed', label: 'rerouted', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['monitor', 'appUs'], tone: 'error', label: 'check failed', duration: 1 },
          { path: ['monitor', 'dns'], tone: 'event', label: 'drop us-east', duration: 1, delay: 1.1 },
          { path: ['userUs', 'appEu'], tone: 'request', label: 'rerouted', count: 3, duration: 2, delay: 2.3 },
        ],
        panel: {
          title: 'Failover timeline',
          icon: 'Timer',
          rows: [
            { text: 'Checks fail from 3 places', value: '30 s' },
            { text: 'DNS answer dropped', value: '+ TTL 60 s' },
            { text: 'Database promoted, in parallel', value: '~1 min' },
            { text: 'Recovery: max(90 s, promotion)', value: '90 s to 2 min' },
            { text: 'Writes in last 2 s', value: 'lost', tone: 'bad' },
          ],
        },
        caption: 'Everyone now lands in eu-central',
      },
    },
    {
      title: 'Who decides',
      tag: 'tradeoff',
      heading: 'Failing over is a risky decision',
      eli5: 'Before closing a kitchen, you want three people to confirm the smoke is real. And you must be sure the old head cook stopped cooking, or two cooks write two different order books.',
      body: [
        'A false alarm moves everyone and promotes a copy that is behind. Check from several locations, require the failure to last, and consider a human approval for the data promotion if you can afford the minutes.',
        '**Split brain** is worse. If us-east is cut off but alive, and both regions accept writes for US users, the data diverges. **Fence** the old primary (cut its network or storage) before promoting the new one.',
        'Keep health checks, DNS and promotion tooling outside the region they watch (static stability).',
      ],
      keyIdea: 'Detect from several places, then fence the old primary before promoting the new one, or both will accept writes.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'risk of split brain' },
      metricTones: { outage: 'bad' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...monitor, at: p(0, -1.5), status: 'active', badge: '3 of 3 agree' },
          { ...dbUs, status: 'hot', badge: 'cut off, still writing' },
          { ...dbEu, status: 'active', badge: 'about to be promoted' },
        ],
        links: [link('monitor', 'dbUs', { style: 'dashed' }), link('monitor', 'dbEu', { style: 'dashed' }), cross('link cut', { labelTone: 'warn' })],
        flows: [
          { path: ['monitor', 'dbUs'], tone: 'event', label: 'fence', duration: 1.4 },
          { path: ['monitor', 'dbEu'], tone: 'event', label: 'promote', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Safe order of steps',
          icon: 'List',
          rows: [
            { text: '1. Confirm from 3 locations', value: 'no false alarm' },
            { text: '2. Fence the old primary', value: 'no split brain', tone: 'good' },
            { text: '3. Promote the new primary', value: 'one writer' },
            { text: '4. Move traffic', value: 'DNS or route' },
          ],
        },
        caption: 'Two primaries would write two histories',
      },
      quiz: {
        question: 'us-east is unreachable from eu-central, but its servers are still running and some users still reach them. What should happen before eu-central promotes its database?',
        options: [
          'Nothing, promote immediately to save time',
          'Fence us-east so it cannot accept writes, then promote eu-central',
          'Copy the data back to us-east first',
          'Raise the DNS TTL to a day',
        ],
        answer: 1,
        explain: 'If both regions accept writes for the same users, their data diverges (split brain). Fencing the old primary first leaves exactly one writer.',
      },
    },
    {
      title: 'Capacity',
      tag: 'case',
      heading: 'The survivor must carry both loads',
      eli5: 'If both kitchens are already busy and one closes, the other gets twice the orders. Cooks burn out, and soon that kitchen closes too.',
      body: [
        'eu-central suddenly receives double its usual traffic. If each region runs above half its capacity at peak, the survivor overloads and the outage spreads.',
        'Plan each region to absorb the other\'s peak, or have autoscaling, quotas and load shedding ready. Shed low-priority work first.',
      ],
      keyIdea: 'Each region needs headroom for the load of the one that died.',
      metrics: { eu: '60 ms (slow under load)', regions: '1 of 2', lag: 'last 2 s lost', outage: 'cascade if no headroom' },
      metricTones: { eu: 'warn', outage: 'bad' },
      scene: {
        zones: [{ ...zoneUs, tone: 'red' }, zoneEu],
        nodes: [
          userUs,
          userEu,
          { ...appUs, status: 'down' },
          { ...appEu, status: 'hot', load: 100, chips: [{ text: '140% of capacity', tone: 'warn' }] },
        ],
        links: [link('userUs', 'appEu', { style: 'dashed' }), link('userEu', 'appEu')],
        flows: [
          { path: ['userUs', 'appEu'], tone: 'request', count: 3, duration: 2 },
          { path: ['userEu', 'appEu'], tone: 'request', count: 3, duration: 1, delay: 0.3 },
        ],
        panel: {
          title: 'Headroom math',
          icon: 'Gauge',
          rows: [
            { text: 'Two regions at 70%', value: 'survivor at 140%', tone: 'bad' },
            { text: 'Two regions at 50%', value: 'survivor at 100%', tone: 'warn' },
            { text: 'Three regions at 60%', value: 'survivors at 90%', tone: 'good' },
          ],
          footer: { text: 'Autoscaling helps only if quota allows it', tone: 'muted' },
        },
        caption: 'The survivor takes everyone',
      },
    },
    {
      title: 'Failback',
      tag: 'concept',
      heading: 'Moving back is its own operation',
      eli5: 'When the New York kitchen reopens, you do not send everyone back at once. It needs to catch up on the order book and stock its shelves first. Then it takes a few customers, then more.',
      body: [
        'When us-east returns, first resync its data from eu-central and reconcile the writes that were stuck. Its caches are cold, so a full traffic return would hit the database hard.',
        'Shift traffic back in steps, for example 5%, 25%, then 100%, watching errors and latency. Failback has all the risks of failover, so run it on a calm day.',
      ],
      keyIdea: 'Resync and reconcile first, then move traffic back in small steps.',
      metrics: { eu: '60 ms', regions: '2 (recovering)', lag: 'catching up', outage: 'none, if gradual' },
      metricTones: { lag: 'warn', outage: 'good' },
      scene: {
        zones: [{ ...zoneUs, tone: 'amber' }, zoneEu],
        nodes: [
          { ...dns, status: 'active', badge: '5% back to US' },
          { ...appUs, status: 'active', chips: [{ text: 'cache cold', tone: 'warn' }] },
          { ...dbUs, status: 'active', badge: 'resyncing' },
          { ...dbEu, status: 'active' },
        ],
        links: [link('dns', 'appUs'), link('appUs', 'dbUs'), cross('catching up', { labelTone: 'warn' })],
        flows: [
          { path: ['dbEu', 'dbUs'], tone: 'data', label: 'catch up', count: 3, duration: 1.8 },
          { path: ['dns', 'appUs'], tone: 'request', label: '5% of US', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Failback steps',
          icon: 'List',
          rows: [
            { text: '1. Resync data', value: 'from eu-central' },
            { text: '2. Reconcile stuck writes', value: 'merge or replay' },
            { text: '3. Warm caches', value: 'small traffic' },
            { text: '4. Shift traffic', value: '5%, 25%, 100%', tone: 'good' },
          ],
        },
        caption: 'Back to normal, a slice at a time',
      },
    },
    {
      title: 'Drills',
      tag: 'concept',
      heading: 'Failover drills: practice on a calm day',
      eli5: 'Kitchens hold fire drills. On a quiet afternoon they close New York on purpose and check that Frankfurt copes. A practice run like that is a **failover drill**.',
      body: [
        'A failover path that never runs breaks quietly. A **failover drill** (or game day) evacuates a region on purpose, at a planned time with people watching: drain its traffic, promote the other side, run for a while, then move back.',
        'Deploy region by region too, with the same build everywhere, so one bad change stays in one region. Drills find what diagrams miss: a login service only in us-east, a DNS TTL of a day, a runbook that needs the dead region. Measure detection, traffic move and data lost.',
      ],
      keyIdea: 'Only a practiced failover is a real one. Evacuate a region on purpose, measure RTO and RPO, and fix what breaks.',
      metrics: { eu: '60 ms', regions: '2 (1 drained)', lag: '~90 ms', outage: 'measured: 90 s' },
      metricTones: { outage: 'good' },
      scene: {
        zones: [{ ...zoneUs, tone: 'amber' }, zoneEu],
        nodes: [
          { ...dns, status: 'active', badge: 'drain us-east' },
          { ...appUs, status: 'dim', badge: 'drained on purpose' },
          { ...appEu, status: 'active' },
          { ...monitor, status: 'ok', badge: 'timing the drill' },
        ],
        links: [link('monitor', 'dns', { style: 'dashed' }), link('dns', 'appEu'), link('dns', 'appUs', { style: 'faint' })],
        flows: [
          { path: ['monitor', 'dns'], tone: 'event', label: 'start drill', duration: 1 },
          { path: ['dns', 'appEu'], tone: 'request', count: 3, duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'What the drill measured',
          icon: 'Timer',
          rows: [
            { text: 'Time to detect', value: '20 s', tone: 'good' },
            { text: 'Time to move traffic (rehearsed path)', value: '90 s', tone: 'good' },
            { text: 'Data lost', value: '2 s of writes', tone: 'warn' },
            { text: 'Found: login only in us-east', value: 'fix it', tone: 'bad' },
          ],
          footer: { text: 'Start with a small slice, grow to a region', tone: 'muted' },
        },
        caption: 'A planned evacuation, with a stopwatch',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Bring the system closer, and plan to lose a region',
      eli5: 'A chain with kitchens in many cities sends each caller to the nearest one, keeps each customer\'s order book in one home kitchen, mails copies around, and practices closing a kitchen.',
      body: [
        'One region taxes far users and is one failure domain. **GeoDNS** routes by location and is limited by TTL caching. **Anycast** announces one IP from many sites. **Active-active** with a **home region** per record keeps writes conflict-free. Replication is async, so lag is your RPO.',
        'On failure, fence the old primary, promote, and make sure the survivor has capacity. Fail back slowly, deploy region by region, and practice with **failover drills**.',
      ],
      keyIdea: 'Route users to the nearest healthy region, give every record one home for writes, and rehearse losing a region.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'minutes, tested' },
      metricTones: { eu: 'good', regions: 'good', outage: 'good' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, dns, { ...appUs, status: 'ok' }, { ...appEu, status: 'ok' }],
        links: [link('userUs', 'dns', { style: 'faint' }), link('userEu', 'dns', { style: 'faint' }), link('userUs', 'appUs'), link('userEu', 'appEu')],
        flows: [
          { path: ['userUs', 'appUs'], tone: 'request', duration: 1 },
          { path: ['userEu', 'appEu'], tone: 'request', duration: 1, delay: 0.2 },
        ],
        panel: {
          title: 'The checklist',
          icon: 'List',
          rows: [
            { text: 'Nearest healthy region', value: 'GeoDNS or anycast' },
            { text: 'One writer per record', value: 'home region' },
            { text: 'Lag is the data at risk', value: 'RPO' },
            { text: 'Headroom for a dead region', value: 'capacity' },
            { text: 'Rehearsed', value: 'drills', tone: 'good' },
          ],
        },
        caption: 'Nearest region, home for writes, tested failover',
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
