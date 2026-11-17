import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const blk = (id: string, label: string, sub: string, icon: string, tint: SceneNode['tint'], d: number, s: number, extra: Partial<SceneNode> = {}): SceneNode => ({
  id, kind: 'block', at: at(d, s), label, sub, icon, tint, ...extra,
});

const tv = blk('tv', 'members', 'TVs and phones', 'Smartphone', 'blue', -5, 0);
const oc = blk('oc', 'Open Connect', 'boxes in ISPs', 'Globe', 'green', -1.7, 0);
const zuul = blk('zuul', 'Zuul 2', 'edge gateway', 'Network', 'violet', 1.7, 0);
const play = blk('play', 'playback', 'service', 'Zap', 'amber', 5, 0);

export const realArchitectures: Lesson = {
  id: 'real-architectures',
  title: 'Real architecture case studies (part 1)',
  tagline: 'Netflix, Uber, Meta and Stripe: the patterns you learned, how each company bent them around its hot path, and the outage that taught them the most.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Why every large system repeats the same patterns but differs in its hot path',
    'Netflix: its own CDN, Cassandra plus EVCache, the Christmas Eve 2012 outage and circuit breakers',
    'Uber: H3 hex cells, Schemaless, Cadence workflows and the Node.js to Go rewrite',
    'Meta: the TAO graph cache, pull-based feed, Haystack photos and the 2021 DNS and BGP outage',
    'Stripe: idempotency keys, and DocDB built on MongoDB as a scaling-limits pattern',
    'How to read a war story as an incident: normal state, trigger, cascade, mitigation, follow-up',
  ],
  metrics: [
    { key: 'err', label: 'Error rate', icon: 'Bug' },
    { key: 'p99', label: 'p99 latency', icon: 'Timer' },
    { key: 'load', label: 'Saturation', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Same patterns',
      tag: 'problem',
      heading: 'Eight famous systems, one small set of ideas',
      eli5: 'Picture a food court with eight busy stalls. Each stall sells something different, yet all of them use the same few tricks: a line for orders, a fridge for popular items, a spare cook.',
      body: [
        'Every pattern in this course shows up in the public architectures of Netflix, Uber, Meta, Stripe, Discord, Shopify, Slack and Airbnb. Caches, queues, sharded databases and gateways repeat.',
        'What differs is the **hot path**: the one thing the business cannot get wrong or slow. We read each company as a normal state, a design choice, and one incident that cost them something.',
      ],
      keyIdea: 'Patterns repeat across companies. The hot path decides which pattern gets bent into something custom.',
      metrics: { err: '0.1%', p99: '120 ms', load: '45%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('pat', 'patterns', 'cache, queue, shards', 'Layers', 'violet', -3.4, 0),
          blk('hot', 'hot path', 'the business edge', 'Zap', 'amber', 0, 0, { status: 'active' }),
          blk('arch', 'architecture', 'one per company', 'Boxes', 'blue', 3.4, 0),
        ],
        links: [link('pat', 'hot'), link('hot', 'arch')],
        flows: [{ path: ['pat', 'hot', 'arch'], tone: 'data', label: 'shape it', duration: 2 }],
        panel: {
          title: 'Public sources only',
          icon: 'FileText',
          rows: [
            { text: 'Engineering blogs' },
            { text: 'Conference talks' },
            { text: 'Papers and OSS READMEs' },
            { text: 'Numbers are approximate', tone: 'warn' },
          ],
          footer: { text: 'Do not copy a design, learn why it fits', tone: 'muted' },
        },
        caption: 'Patterns in, a custom hot path out',
      },
    },
    {
      title: 'Netflix scale',
      tag: 'concept',
      heading: 'Netflix: video bytes are the hot path',
      eli5: 'The stall owner hands a free fridge to each neighborhood. Families grab their food from the fridge on their own street instead of walking to the stall.',
      body: [
        'About 270M subscribers in 190+ countries, over 200 Tbps at peak, 700+ microservices on AWS. The control plane (login, browse, play) runs in AWS. The video bytes do not.',
        'Netflix built **Open Connect**: 10,000+ boxes placed inside ISPs, often free for the ISP. The ISP saves transit cost, Netflix saves delivery cost, and the member gets the file from nearby.',
      ],
      keyIdea: 'When one cost dominates, own it. Netflix built a CDN because paying per GB at its scale made no sense.',
      metrics: { err: '0.1%', p99: '80 ms', load: '50%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [tv, { ...oc, status: 'ok' }, zuul, play],
        links: [link('tv', 'oc', { label: 'video bytes' }), link('tv', 'zuul', { route: 'straight', style: 'dashed', label: 'API calls' }), link('zuul', 'play')],
        flows: [
          { path: ['tv', 'zuul', 'play'], tone: 'request', label: 'play', duration: 1.8 },
          { path: ['oc', 'tv'], tone: 'data', label: '4K chunks', count: 3, duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Who pays what',
          icon: 'Scale',
          rows: [
            { text: 'ISP', value: 'less transit', tone: 'good' },
            { text: 'Netflix', value: 'less delivery cost', tone: 'good' },
            { text: 'Member', value: '4K at 80 ms', tone: 'good' },
          ],
          footer: { text: 'See the CDN lesson for the mechanics', tone: 'muted' },
        },
        caption: 'Control plane in AWS, bytes from the edge',
      },
    },
    {
      title: 'Netflix data',
      tag: 'concept',
      heading: 'Netflix: Cassandra behind a cache tier',
      eli5: 'The stall keeps a notebook that every cook can write in, and a small whiteboard of the most asked items. Nobody minds if the whiteboard is two seconds behind.',
      body: [
        'Viewing history is append-mostly, and a "continue watching" row that is 2 seconds stale hurts nobody. So Netflix uses **Cassandra**, a multi-master store that survives zone and region failures.',
        'In front sits **EVCache**, a Memcached tier with hit rates above 99% on hot paths. Each region has its own, and writes fan out to other regions asynchronously.',
      ],
      keyIdea: 'Pick the consistency the product can live with. Eventual consistency bought Netflix multi-region writes.',
      metrics: { err: '0.1%', p99: '12 ms', load: '40%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('hist', 'history', 'service', 'Clock', 'amber', -5, 0),
          { id: 'evc', kind: 'cache', at: at(-1.7, 0), label: 'EVCache', sub: '99% hit', status: 'ok' },
          { id: 'cass', kind: 'db', at: at(1.7, 0), label: 'Cassandra', sub: 'multi-master' },
          { id: 'cass2', kind: 'replica', at: at(5, 0), label: 'other region', sub: 'async copy' },
        ],
        links: [link('hist', 'evc'), link('evc', 'cass', { label: '1% miss' }), link('cass', 'cass2', { style: 'dashed', label: 'replicate' })],
        flows: [
          { path: ['hist', 'evc', 'hist'], tone: 'request', label: 'hit', duration: 1.4 },
          { path: ['evc', 'cass', 'evc'], tone: 'request', label: 'miss', duration: 1.6, delay: 1.5 },
          { path: ['cass', 'cass2'], tone: 'data', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Why eventual is fine',
          icon: 'Table',
          rows: [
            { text: 'Writes', value: 'append mostly' },
            { text: 'Staleness', value: '2 s is fine', tone: 'good' },
            { text: 'Failure', value: 'zone or region', tone: 'good' },
          ],
        },
        caption: 'Cache absorbs reads, Cassandra survives failure',
      },
    },
    {
      title: 'Christmas 2012',
      tag: 'case',
      heading: 'Incident: the ELB failure on Christmas Eve 2012',
      eli5: 'All the stall owner\'s deliveries came through one street. On the busiest night that street flooded, and families outside could not get in, even though the kitchen was fine.',
      body: [
        '**Normal:** most traffic served from `us-east-1`. **Trigger:** its ELB service failed on Christmas Eve. **Cascade:** requests could not reach healthy servers, so streaming broke for many members for hours.',
        '**Root cause:** the ELB service in the one region carrying most traffic failed. **Fix and follow-up:** multi-region active-active. **Chaos Gorilla** now kills a whole availability zone on purpose, and **Chaos Kong** kills a whole region.',
      ],
      keyIdea: 'A dependency on one region is a single point of failure. Rehearse losing it before it happens.',
      metrics: { err: '38%', p99: 'timeout', load: '92%' },
      metricTones: { err: 'bad', p99: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...tv, status: 'hot', chips: [{ text: 'cannot play', tone: 'bad' }] },
          { id: 'elb', kind: 'lb', at: at(-1.7, 0), label: 'ELB', sub: 'us-east-1', status: 'down' },
          { ...play, at: at(1.7, 0), status: 'hot', load: 92 },
          { id: 'west', kind: 'server', at: at(5, 0), label: 'us-west-2', sub: 'idle spare', status: 'dim' },
        ],
        links: [link('tv', 'elb'), link('elb', 'play'), link('play', 'west', { style: 'faint', label: 'no failover' })],
        flows: [{ path: ['tv', 'elb'], tone: 'error', label: '503', count: 3, duration: 1.4 }],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: 'Normal', value: 'one hot region', tone: 'muted' },
            { text: 'Trigger', value: 'ELB fails', tone: 'bad' },
            { text: 'Cascade', value: 'streams drop', tone: 'bad' },
            { text: 'Fix', value: 'multi-region', tone: 'good' },
          ],
          footer: { text: 'Chaos Gorilla kills a zone, Chaos Kong a region', tone: 'good' },
        },
        caption: 'The kitchen was fine. The door was not.',
      },
      quiz: {
        question: 'What did the 2012 Christmas Eve outage teach Netflix?',
        options: [
          'Move everything to a bigger single region',
          'Depend on no single region, and rehearse losing one',
          'Replace microservices with a monolith',
          'Cache all video in the browser',
        ],
        answer: 1,
        explain: 'The ELB service in the one busy region failed and took streaming with it. Multi-region active-active plus chaos drills (zone and region) removed that single point of failure.',
      },
    },
    {
      title: 'Circuit breakers',
      tag: 'concept',
      heading: 'Netflix: circuit breakers and fallbacks',
      eli5: 'If the juice machine breaks, the cashier stops sending kids to it and hands out water instead. The line keeps moving while the juice machine is fixed.',
      body: [
        'With 700+ services, one slow dependency can stall every caller waiting on it. Netflix\'s **Hystrix** library wrapped each call in a **circuit breaker**: after enough failures the breaker opens and calls fail fast.',
        'A **fallback** then returns something cheaper, such as a generic row instead of a personalized one. Retry herds are a related risk, covered in the retry storm war room (`war-retry-storm`).',
      ],
      keyIdea: 'Fail fast and degrade gracefully. A partial answer beats a stuck request.',
      metrics: { err: '0.5%', p99: '90 ms', load: '55%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('home', 'home page', 'calls a service', 'Smartphone', 'blue', -3.4, 0),
          blk('cb', 'circuit breaker', 'open after failures', 'Shield', 'amber', 0, 0, { status: 'active' }),
          blk('rec', 'recommendations', 'slow or down', 'Star', 'red', 3.4, 0, { status: 'down' }),
        ],
        links: [link('home', 'cb'), link('cb', 'rec', { style: 'dashed', label: 'fail fast' })],
        flows: [{ path: ['home', 'cb', 'home'], tone: 'response', label: 'fallback row', duration: 1.8 }],
        panel: {
          title: 'Breaker states',
          icon: 'Gauge',
          rows: [
            { text: 'Closed', value: 'calls pass', tone: 'good' },
            { text: 'Open', value: 'fail fast, use fallback', tone: 'warn' },
            { text: 'Half open', value: 'probe, then close', tone: 'muted' },
          ],
          footer: { text: 'Illustrative metrics for the story', tone: 'muted' },
        },
        caption: 'Stop calling the broken part, serve a fallback',
      },
    },
    {
      title: 'Uber hot path',
      tag: 'concept',
      heading: 'Uber: matching riders to drivers in hex cells',
      eli5: 'The map is covered in honeycomb cells. To find a free tricycle for a child, the helper checks the child\'s cell and the cells next door, not the whole town.',
      body: [
        'About 25M trips a day over 4,000+ services. The hot path is **matching**: given a rider, pick a nearby driver now. **H3** cuts the world into hexagons, so "cars within 2 km" becomes a set of cell ids.',
        'Every hexagon neighbor is the same distance from the center, and cells nest at several sizes: coarse for demand forecasts, fine for matching. The **DISCO** matcher runs in memory on cells.',
      ],
      keyIdea: 'Index the hot query directly. H3 turns a geometry problem into a set lookup.',
      metrics: { err: '0.2%', p99: '90 ms', load: '55%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('rider', 'rider app', 'asks for a ride', 'Smartphone', 'blue', -5, 0),
          blk('disco', 'DISCO', 'in-memory matcher', 'Route', 'violet', -1.7, 0, { status: 'active' }),
          blk('h3', 'H3 cells', 'hex index', 'Hash', 'teal', 1.7, 0),
          blk('driver', 'drivers', 'location stream', 'Signal', 'green', 5, 0),
        ],
        links: [link('rider', 'disco'), link('disco', 'h3'), link('driver', 'h3', { label: 'GPS pings' })],
        flows: [
          { path: ['rider', 'disco', 'h3', 'disco'], tone: 'request', label: 'cells near me', duration: 2 },
          { path: ['driver', 'h3'], tone: 'event', label: 'location', count: 3, duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'One query',
          icon: 'Code',
          code: 'cell = h3(rider.lat, rider.lng, res=8)\ncells = ring(cell, k=2)\ndrivers = in_cells(cells)\nbest = rank(drivers, rider)',
          footer: { text: 'Set lookups, no distance math per driver', tone: 'good' },
        },
        caption: 'Cells in, nearby drivers out',
      },
    },
    {
      title: 'Uber state',
      tag: 'concept',
      heading: 'Uber: Schemaless and Cadence',
      eli5: 'A ride is not one order, it is a story with chapters that lasts an hour. The helper keeps a diary so the story survives even if a helper goes home mid-ride.',
      body: [
        '**Schemaless** is a sharded MySQL layer with key-value semantics: versioned JSON cells on an append-only log, secondary indexes as separate tables. MySQL operations, NoSQL scale.',
        'A ride is not an RPC. It is a long workflow: request, match, pickup, trip, drop-off, pay. **Cadence** keeps that state durable with timers and retries. Temporal is its descendant.',
      ],
      keyIdea: 'Model long-lived processes as durable workflows, not as one request that must finish.',
      metrics: { err: '0.2%', p99: '60 ms', load: '50%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('trip', 'trip', 'workflow', 'Workflow', 'violet', -3.4, 0),
          blk('cad', 'Cadence', 'timers, retries', 'Repeat', 'amber', 0, 0, { status: 'active' }),
          { id: 'sl', kind: 'shard', at: at(3.4, 0), label: 'Schemaless', sub: 'sharded MySQL' },
        ],
        links: [link('trip', 'cad'), link('cad', 'sl', { label: 'append cells' })],
        flows: [{ path: ['trip', 'cad', 'sl'], tone: 'data', label: 'state', duration: 1.8 }],
        panel: {
          title: 'A ride as a workflow',
          icon: 'List',
          rows: [
            { text: 'request, match', value: 'seconds' },
            { text: 'pickup, in progress', value: 'minutes' },
            { text: 'drop-off, rate, pay', value: 'can retry', tone: 'good' },
          ],
          footer: { text: 'See the durable execution lesson', tone: 'muted' },
        },
        caption: 'State lives in storage, not in a request',
      },
    },
    {
      title: 'Node to Go',
      tag: 'case',
      heading: 'Case: the geofence rewrite from Node.js to Go',
      eli5: 'The helper who reads the map kept getting tired and pausing mid-sentence under a crowd, so prices and matches came out wrong. They swapped in a helper who never pauses.',
      body: [
        '**Normal:** the geofence service, written in Node.js, answers pricing and matching lookups. **Trigger:** heavy load. **Cascade:** memory leaks and GC pauses stretched latency, causing mis-pricing and mis-matching.',
        '**Fix:** rewrite in Go. p99 dropped about 10×. **Cost:** a full rewrite while the company kept growing. The cause was this service under this load, so measure before blaming a runtime.',
      ],
      keyIdea: 'Tail latency, not average latency, breaks a hot path. Pauses and leaks under load can be the root cause.',
      metrics: { p99: 'about 10× lower' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          blk('app', 'trips', 'pricing, matching', 'Route', 'blue', -3.4, 0),
          blk('geo', 'geofence', 'Node.js', 'Globe', 'red', 0, 0, { status: 'hot', chips: [{ text: 'leaks, GC pauses', tone: 'bad' }] }),
          blk('geo2', 'geofence', 'Go rewrite', 'Zap', 'green', 3.4, 0, { status: 'ok' }),
        ],
        links: [link('app', 'geo'), link('app', 'geo2', { style: 'dashed', route: 'straight' })],
        flows: [{ path: ['app', 'geo', 'app'], tone: 'error', label: 'slow, wrong', duration: 2 }],
        panel: {
          title: 'Before and after',
          icon: 'TrendingUp',
          rows: [
            { text: 'Node.js', value: 'leaks, GC pauses', tone: 'bad' },
            { text: 'Symptom', value: 'mis-pricing, mis-matching', tone: 'bad' },
            { text: 'Go p99', value: 'about 10× lower', tone: 'good' },
            { text: 'Cost', value: 'a rewrite', tone: 'warn' },
          ],
        },
        caption: 'Pauses on the hot path become wrong prices',
      },
    },
    {
      title: 'Meta TAO',
      tag: 'concept',
      heading: 'Meta: TAO caches the social graph',
      eli5: 'The town keeps a giant address book of who knows whom. Asking the big book each time is slow, so a helper copies the pages people ask about onto a board.',
      body: [
        'More than 3B daily users. MySQL is the source of truth, but News Feed needs huge fan-out reads. **TAO** caches every object (user, post) and edge (friend, like, comment) in front of it.',
        'Reads hit TAO and fall back to MySQL on a miss. **TAO** is a write-through cache: writes go through a TAO leader, which updates MySQL and the cache, and followers are invalidated or updated.',
      ],
      keyIdea: 'A cache shaped like your data model (objects and edges) beats a generic key-value cache for graphs.',
      metrics: { err: '0.05%', p99: '5 ms', load: '60%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('web', 'web tier', 'Hack on HHVM', 'Laptop', 'blue', -3.4, 0),
          { id: 'tao', kind: 'cache', at: at(0, 0), label: 'TAO', sub: 'graph cache', status: 'ok' },
          { id: 'my', kind: 'db', at: at(3.4, 0), label: 'MySQL', sub: 'source of truth' },
        ],
        links: [link('web', 'tao'), link('tao', 'my', { label: 'miss, write' })],
        flows: [
          { path: ['web', 'tao', 'web'], tone: 'request', label: 'read edge', duration: 1.4 },
          { path: ['web', 'tao', 'my', 'tao', 'web'], tone: 'data', label: 'write through', duration: 2.2, delay: 1.6 },
        ],
        panel: {
          title: 'Read and write path',
          icon: 'Table',
          rows: [
            { text: 'Read', value: 'TAO, then MySQL', tone: 'good' },
            { text: 'Write', value: 'via TAO to MySQL' },
            { text: 'Scale', value: '1B+ reads per s', tone: 'good' },
          ],
        },
        caption: 'A graph cache in front of the truth',
      },
    },
    {
      title: 'Feed on read',
      tag: 'tradeoff',
      heading: 'Meta: the feed is built when you open it',
      eli5: 'When you open the board, the helper gathers your friends\' latest drawings right then and puts your favorites on top. Each child gets a different pile.',
      body: [
        'The feed is built on read: fetch friends and their recent posts from TAO, score them with an ML model, return the top N. Ranking is per viewer, so the work cannot be shared, and caching keeps the pieces fast.',
        'Push (precompute each feed on write) wins for some accounts, and hybrids that mix both exist. Pages and public figures have huge audiences, so the choice depends on the audience shape.',
      ],
      keyIdea: 'Choose read-time or write-time work by how personal the result is and how large the audience is. Hybrids are common.',
      metrics: { err: '0.05%', p99: '120 ms', load: '60%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('me', 'you', 'open the feed', 'User', 'blue', -3.4, 0),
          blk('feed', 'feed builder', 'pull on read', 'Rss', 'violet', 0, 0, { status: 'active' }),
          { id: 'tao', kind: 'cache', at: at(3.4, 0), label: 'TAO', sub: 'friends and posts', status: 'ok' },
        ],
        links: [link('me', 'feed'), link('feed', 'tao')],
        flows: [
          { path: ['me', 'feed', 'tao', 'feed', 'me'], tone: 'request', label: 'friends, posts, rank', duration: 2.4 },
        ],
        panel: {
          title: 'Feed on read',
          icon: 'Code',
          code: 'friends = tao.friends(me)\nposts = tao.recent(friends)\nranked = model.score(posts, me)\nreturn ranked[:N]',
          footer: { text: 'Hybrids push for some accounts, pull for others', tone: 'muted' },
        },
        caption: 'Assemble and rank per viewer, on read',
      },
    },
    {
      title: 'Haystack',
      tag: 'concept',
      heading: 'Meta: Haystack packs photos into big files',
      eli5: 'Drawings are stacked in a few big albums with a table of contents in the helper\'s head, so finding one is a single page flip. Older drawings that few ask for go to a cheaper cupboard.',
      body: [
        '**Haystack** packs many photos into one big file with an in-memory index, so a fetch is one disk read instead of per-file metadata lookups across billions of files.',
        'Photos that are read less often are warm, and they move to **f4**, a warm blob store that spends fewer bytes per photo by using erasure coding.',
      ],
      keyIdea: 'Remove per-file overhead when files number in billions, then use cheaper storage for warm data.',
      metrics: { err: '0.05%', p99: '30 ms', load: '55%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('app', 'photo request', 'from the web tier', 'Image', 'blue', -3.4, 0),
          { id: 'hay', kind: 'storage', at: at(0, 0), label: 'Haystack', sub: 'one read per photo', status: 'ok' },
          { id: 'f4', kind: 'storage', at: at(3.4, 0), label: 'f4', sub: 'warm photos' },
        ],
        links: [link('app', 'hay'), link('hay', 'f4', { style: 'dashed', label: 'cools down' })],
        flows: [
          { path: ['app', 'hay', 'app'], tone: 'request', label: 'photo', duration: 1.6 },
          { path: ['hay', 'f4'], tone: 'data', label: 'warm photos', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Why it is fast',
          icon: 'Table',
          rows: [
            { text: 'Many photos per file', value: 'few files' },
            { text: 'Index in memory', value: 'no metadata reads', tone: 'good' },
            { text: 'Disk work', value: 'one read', tone: 'good' },
            { text: 'Warm blobs', value: 'f4', tone: 'muted' },
          ],
        },
        caption: 'Big files, small index, one read',
      },
    },
    {
      title: 'Meta 2021',
      tag: 'case',
      heading: 'Incident: the 2021 six-hour BGP outage',
      eli5: 'A sign on the road to the whole town got erased by mistake. The keys to the back door were also locked inside, so helpers had to walk over and open it by hand.',
      body: [
        '**Normal:** traffic reaches the data centers over the backbone. **Trigger:** a command run during backbone maintenance cut the links, and a bug in an audit tool let it through. **Cascade:** the DNS servers could not reach the data centers, so they withdrew their own BGP routes. DNS and everything behind it vanished, tools and badge readers included.',
        '**Mitigation:** people physically entered secured data centers. **Follow-up:** repair channels must be out-of-band.',
      ],
      keyIdea: 'Your repair tools must not depend on the thing that broke. Out-of-band means out of band.',
      metrics: { err: '100%', p99: 'n/a', load: '5%' },
      metricTones: { err: 'bad', p99: 'bad', load: 'warn' },
      scene: {
        nodes: [
          blk('users', 'users', '3B+ daily', 'Users', 'blue', -5, 0, { status: 'hot', chips: [{ text: 'site unreachable', tone: 'bad' }] }),
          { id: 'net', kind: 'internet', at: at(-1.7, 0), label: 'DNS and BGP', sub: 'routes withdrawn', status: 'down' },
          blk('dc', 'data centers', 'healthy but dark', 'Server', 'gray', 1.7, 0, { status: 'dim' }),
          blk('ops', 'ops tools', 'also offline', 'Cable', 'red', 5, 0, { status: 'down' }),
        ],
        links: [link('users', 'net'), link('net', 'dc'), link('dc', 'ops', { style: 'dashed' })],
        flows: [{ path: ['users', 'net'], tone: 'error', label: 'no route', count: 3, duration: 1.4 }],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: 'Normal', value: 'steady traffic', tone: 'muted' },
            { text: 'Trigger', value: 'maintenance command', tone: 'bad' },
            { text: 'Cascade', value: 'DNS withdraws routes', tone: 'bad' },
            { text: 'Mitigation', value: 'walk in, fix by hand', tone: 'warn' },
            { text: 'Follow-up', value: 'real out-of-band', tone: 'good' },
          ],
          footer: { text: 'Compare the DNS TTL outage war room (war-dns-ttl-outage)', tone: 'muted' },
        },
        caption: 'Servers fine, routes gone, tools gone',
      },
    },
    {
      title: 'Stripe keys',
      tag: 'concept',
      heading: 'Stripe: idempotency keys on every write',
      eli5: 'Every order slip gets a stamp number. If the same slip arrives twice, the cashier sees the stamp and hands back the first receipt instead of charging again.',
      body: [
        'Stripe moves hundreds of billions of dollars a year and targets 99.999%+ API availability. Retries are certain, so double charges must be impossible.',
        'Every mutating `POST` accepts an `Idempotency-Key` header. The server remembers the key and its result for 24 hours and replays the first response. The API is also versioned per merchant, with additive changes only.',
      ],
      keyIdea: 'At-least-once delivery plus an idempotency key behaves like exactly-once for the customer.',
      metrics: { err: '0.01%', p99: '200 ms', load: '55%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('merch', 'merchant', 'retries on timeout', 'ShoppingBag', 'blue', -3.4, 0),
          blk('api', 'Stripe API', 'edge and routing', 'Network', 'violet', 0, 0, { status: 'active' }),
          { id: 'store', kind: 'db', at: at(3.4, 0), label: 'key store', sub: 'result for 24 h' },
        ],
        links: [link('merch', 'api'), link('api', 'store')],
        flows: [
          { path: ['merch', 'api', 'store'], tone: 'request', label: 'POST key=k1', duration: 1.6 },
          { path: ['merch', 'api', 'store', 'api', 'merch'], tone: 'response', label: 'retry k1: same result', duration: 2.2, delay: 1.8 },
        ],
        panel: {
          title: 'Retry, one charge',
          icon: 'Receipt',
          code: 'POST /v1/charges\nIdempotency-Key: k1\n\n1st call: charge, store result\n2nd call: replay stored result',
          footer: { text: 'See the idempotency lesson', tone: 'muted' },
        },
        caption: 'Same key, same answer, one charge',
      },
      code: {
        language: 'bash',
        title: 'A safe retry',
        source: `curl https://api.stripe.example/v1/charges \\
  -H "Idempotency-Key: order-9001-attempt" \\
  -d amount=2000 -d currency=usd

# network timeout, so retry with the SAME key
curl https://api.stripe.example/v1/charges \\
  -H "Idempotency-Key: order-9001-attempt" \\
  -d amount=2000 -d currency=usd`,
        highlight: [2, 7],
      },
    },
    {
      title: 'Mongo at scale',
      tag: 'tradeoff',
      heading: 'Scaling limits: Stripe built DocDB on MongoDB',
      eli5: 'The stall bought the most popular fridge. As the stall grew far past the usual size, the owners added their own shelves and movers around the fridge so it kept up.',
      body: [
        'This is a scaling-limits pattern, not a documented outage. Flexible documents fit payments data well. At very large scale a default database setup needs custom work around it.',
        'Stripe built **DocDB** on top of MongoDB, with its own data movement platform for shifting data between shards. Stripe describes this publicly only at a high level, so treat the details as unknown.',
      ],
      keyIdea: 'Defaults stop being enough at the top of the scale curve. Keep a proven engine and build the missing parts around it.',
      scene: {
        nodes: [
          blk('svc', 'services', 'payments', 'Receipt', 'violet', -3.4, 0),
          { id: 'mongo', kind: 'shard', at: at(0, 0), label: 'MongoDB', sub: 'the engine', status: 'active' },
          { id: 'custom', kind: 'shard', at: at(3.4, 0), label: 'DocDB', sub: 'built on MongoDB', status: 'ok', chips: [{ text: 'own data movement', tone: 'good' }] },
        ],
        links: [link('svc', 'mongo'), link('mongo', 'custom', { style: 'dashed', route: 'straight', label: 'wrapped by' })],
        flows: [{ path: ['svc', 'mongo', 'custom'], tone: 'request', label: 'query', duration: 2.2 }],
        panel: {
          title: 'What is public',
          icon: 'FileText',
          rows: [
            { text: 'DocDB built on MongoDB', tone: 'good' },
            { text: 'Own data movement platform', tone: 'good' },
            { text: 'Internals', value: 'high level only', tone: 'muted' },
            { text: 'No public postmortem', tone: 'warn' },
          ],
          footer: { text: 'A pattern, not an incident', tone: 'muted' },
        },
        caption: 'Keep the engine, own the layer around it',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Four companies, four hot paths',
      eli5: 'Four stalls, four different jobs: one gives out fridges, one finds tricycles, one keeps the big address book, one never double charges. All four use the same few tricks.',
      body: [
        '**Netflix** owns video delivery and survives a region loss. **Uber** indexes matching with H3 and keeps rides as workflows. **Meta** caches the graph and keeps repair tools out-of-band. **Stripe** makes retries safe with idempotency keys.',
        'Each war story reads the same way: normal state, trigger, cascade, mitigation, root cause, follow-up. Part 2 covers Discord, Shopify, Slack and Airbnb, then the pattern map.',
      ],
      keyIdea: 'Find the hot path first. The patterns you already know do the rest.',
      metrics: { err: '0.1%', p99: '120 ms', load: '45%' },
      metricTones: { err: 'good', p99: 'good', load: 'good' },
      scene: {
        nodes: [
          blk('nf', 'Netflix', 'video bytes', 'Globe', 'red', -5, 0),
          blk('ub', 'Uber', 'matching', 'Route', 'gray', -1.7, 0),
          blk('fb', 'Meta', 'the graph', 'Share2', 'blue', 1.7, 0),
          blk('st', 'Stripe', 'safe retries', 'Receipt', 'violet', 5, 0),
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Hot path to design',
          icon: 'Table',
          rows: [
            { text: 'Netflix', value: 'Open Connect' },
            { text: 'Uber', value: 'H3, Cadence' },
            { text: 'Meta', value: 'TAO, Haystack' },
            { text: 'Stripe', value: 'idempotency' },
          ],
        },
        caption: 'Same patterns, different hot paths',
      },
      quiz: {
        question: 'What made Stripe\'s idempotency key design so important?',
        options: [
          'It makes the API faster',
          'It lets retries replay one result instead of charging twice',
          'It removes the need for a database',
          'It encrypts card numbers',
        ],
        answer: 1,
        explain: 'Retries are certain in distributed systems. The key lets the server recognize a repeat and return the stored result, so one intent causes one charge.',
      },
    },
  ],
};
