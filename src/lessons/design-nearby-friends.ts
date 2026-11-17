import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-4.5, -3), label: 'Ana', sub: 'sends every 10 s' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(4.5, 1.5), label: 'Ben', sub: 'friend, 600 m away' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: at(-4.5, 1.5), label: 'load balancer', sub: 'long-lived conns' };
const ws1: SceneNode = { id: 'ws1', kind: 'server', at: at(-1.5, -3), label: 'WS server 1', sub: 'holds Ana' };
const ws2: SceneNode = { id: 'ws2', kind: 'server', at: at(4.5, -3), label: 'WS server 2', sub: 'holds Ben' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(-1.5, 1.5), label: 'location cache', sub: 'TTL 10 min' };
const pubsub: SceneNode = { id: 'pubsub', kind: 'block', at: at(1.5, -3), label: 'pub/sub', sub: 'channel per user', icon: 'Share2', tint: 'violet' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(1.5, 1.5), label: 'API servers', sub: 'friends, settings', icon: 'Network', tint: 'blue' };
const userDb: SceneNode = { id: 'userDb', kind: 'db', at: at(4.5, 1.5), label: 'user DB', sub: 'friend lists' };
const history: SceneNode = { id: 'history', kind: 'warehouse', at: at(4.5, 1.5), label: 'history store', sub: '~3.5 TB/day' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designNearbyFriends: Lesson = {
  id: 'design-nearby-friends',
  title: 'Design nearby friends (part 1)',
  tagline: 'Show each user which friends are close by, updated every few seconds, for 10 million people online at once.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Why polling a database collapses when every user moves every few seconds',
    'Why phones cannot talk to each other directly, and the traffic math behind the design',
    'A WebSocket tier, a location cache with a TTL and a pub/sub channel per user',
    'Subscribing to friends, and filtering by distance on the receiving server so far friends never reach the phone',
    'Part 2: scaling the stateful tiers, nearby strangers, history and privacy',
  ],
  metrics: [
    { key: 'online', label: 'Online users', icon: 'Users' },
    { key: 'ups', label: 'Location updates/s', icon: 'Zap' },
    { key: 'fan', label: 'Fan-out/s', icon: 'Share2' },
    { key: 'lag', label: 'Friend sees move', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Where are my friends, right now?',
      eli5: 'At summer camp every kid carries a **walkie-talkie** and calls out where they are every few seconds. Each kid wants to hear about friends who are close, and nobody else.',
      body: [
        'A user who turns the feature on sees a list of friends within **5 km**, with distance and the time of their last update. Positions refresh every few seconds while the app is open.',
        'A friend who has sent nothing for 10 minutes drops off the list. Ana should see Ben move within about **2 seconds** of his phone sending the update.',
      ],
      keyIdea: 'The product is a live list: friends within 5 km, fresh within seconds, gone when quiet.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: 'goal < 2 s' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [{ ...ana, status: 'active', chips: ['I am here'] }, { ...ws1, at: at(0, -3) }, { ...ben, at: at(4.5, -3), status: 'active', badge: 'Ana is 600 m away' }],
        links: [link('ana', 'ws1'), link('ws1', 'ben', { label: 'within 2 s', labelTone: 'warn' })],
        flows: [
          { path: ['ana', 'ws1'], tone: 'request', label: 'I am here', duration: 1.4 },
          { path: ['ws1', 'ben'], tone: 'event', label: 'Ana is 600 m away', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'The product rules',
          icon: 'List',
          rows: [
            { text: 'Show friends within', value: '5 km' },
            { text: 'Update interval', value: '10 s' },
            { text: 'Drop after silence', value: '10 min' },
            { text: 'Friend sees a move', value: '< 2 s', tone: 'warn' },
          ],
        },
        caption: 'A live list of nearby friends',
      },
    },
    {
      title: 'The numbers',
      tag: 'concept',
      heading: 'Estimate the load before drawing anything',
      eli5: 'Count the camp first. Ten thousand kids each call out every ten seconds, and each call matters to about twenty friends. That is a very busy radio.',
      body: [
        '100M daily users, and about **10M online at once** at peak. Each phone sends a point every 10 seconds, so the system takes **1M location updates per second**.',
        'Users have a few hundred friends, but only about **20** are online with sharing on. Each update therefore needs about 20 deliveries, or **20M deliveries per second**.',
      ],
      keyIdea: 'Writes are huge at 1M per second, and each write matters to only about 20 people.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: 'goal < 2 s' },
      metricTones: { ups: 'bad', fan: 'bad' },
      scene: {
        nodes: [
          { ...ana, status: 'active', badge: '10M phones' },
          { ...ws1, at: at(0, -3), status: 'hot', badge: '1M updates/s' },
          { ...ben, at: at(4.5, -3), badge: '20 friends online' },
        ],
        links: [link('ana', 'ws1', { label: 'every 10 s' }), link('ws1', 'ben', { label: 'x 20 friends', labelTone: 'warn' })],
        flows: [
          { path: ['ana', 'ws1'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['ws1', 'ben'], tone: 'event', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Back of the envelope',
          icon: 'Gauge',
          rows: [
            { text: 'Online at peak', value: '10M' },
            { text: 'Updates (10M / 10 s)', value: '1M/s', tone: 'warn' },
            { text: 'Online friends each', value: '~20' },
            { text: 'Deliveries (1M x 20)', value: '20M/s', tone: 'bad' },
          ],
        },
        caption: '1M writes per second, 20M deliveries per second',
      },
    },
    {
      title: 'No P2P',
      tag: 'tradeoff',
      heading: 'Why phones cannot just talk to each other',
      eli5: 'Why not let kids shout straight to each other across the field? Walls, wind and tired legs get in the way. A **radio room** in the middle is steadier.',
      body: [
        'A tempting design: each phone sends its position directly to its 20 friends. Skip the servers. It breaks on real phones. Mobile networks sit behind NAT, so a phone cannot accept an incoming connection from a stranger.',
        'Phones also sleep, change networks and run out of battery. Keeping 20 peer connections alive drains the battery and loses messages. A server tier gives one stable endpoint per phone and a place to check who may see whom.',
      ],
      keyIdea: 'Phones are unreliable and unreachable, so put a server in the middle of every conversation.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...ana, at: at(-4.5, -1.5), status: 'active', chips: [{ text: '20 peer conns', tone: 'warn' }] },
          { ...ben, at: at(4.5, -1.5), chips: [{ text: 'behind NAT', tone: 'bad' }] },
          { ...ws1, at: at(0, 2.5), status: 'ok', badge: 'one stable endpoint' },
        ],
        links: [link('ana', 'ben', { style: 'faint', label: 'direct: blocked', labelTone: 'warn', route: 'straight' }), link('ana', 'ws1'), link('ws1', 'ben')],
        flows: [
          { path: ['ana', 'ben'], tone: 'error', label: 'cannot connect', duration: 1.6 },
          { path: ['ana', 'ws1', 'ben'], tone: 'request', label: 'via server', duration: 2, delay: 1.8 },
        ],
        panel: {
          title: 'Peer to peer on a phone',
          icon: 'Smartphone',
          rows: [
            { text: 'Incoming connections', value: 'blocked by NAT', tone: 'bad' },
            { text: 'Battery', value: '20 live links', tone: 'warn' },
            { text: 'Network change', value: 'links drop', tone: 'warn' },
            { text: 'Who may see whom', value: 'nobody checks', tone: 'bad' },
          ],
        },
        caption: 'The server is the meeting point',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'A socket for locations, HTTP for everything else',
      eli5: 'The **walkie-talkie** stays switched on for fast messages. Slow chores, like adding a new friend to your list, go on a paper form at the camp office.',
      body: [
        'Location traffic is constant and two-way, so it travels over a **WebSocket** (see the real-time lesson). The phone sends `location_update` every 10 seconds. The server sends `nearby_init` once on connect, `friend_nearby` when a friend in range moves, and `friend_left` when one leaves the radius or stops sharing.',
        'Rare actions stay on plain HTTP through ordinary API servers: add or remove a friend, pause sharing, change settings.',
      ],
      keyIdea: 'Split the hot, real-time path from the slow, transactional one.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: 'goal < 2 s' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, { ...ws1, status: 'active', chips: ['location_update'] }, { ...api, status: 'active', chips: ['POST /friends/ben'] }],
        links: [link('ana', 'ws1', { label: 'WebSocket', arrow: 'both' }), link('ana', 'api', { label: 'HTTP' })],
        flows: [
          { path: ['ana', 'ws1'], tone: 'request', label: 'location_update', count: 3, duration: 1.4 },
          { path: ['ana', 'api'], tone: 'request', label: 'POST /friends/ben', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Two paths',
          icon: 'Route',
          rows: [
            { text: 'Socket: every 10 s', value: 'location_update' },
            { text: 'Socket: on connect', value: 'nearby_init' },
            { text: 'Socket: friend moved', value: 'friend_nearby' },
            { text: 'Socket: left range', value: 'friend_left' },
            { text: 'HTTP: rare actions', value: 'friends, settings' },
          ],
        },
        caption: 'Socket for movement, HTTP for settings',
      },
      code: {
        language: 'typescript',
        title: 'Messages on the socket, and the HTTP calls beside it',
        source: `// Client -> server, every 10 seconds while the app is open
type LocationUpdate = { type: 'location_update'; lat: number; lng: number; ts: number };

// Server -> client
type FriendLocation = { id: string; lat: number; lng: number; distanceM: number; ts: number };
type NearbyInit = { type: 'nearby_init'; friends: FriendLocation[] };   // once, on connect
type FriendNearby = { type: 'friend_nearby' } & FriendLocation;         // a friend in range moved
type FriendLeft = { type: 'friend_left'; id: string };                  // out of range or paused

// Plain HTTP for rare actions
// POST   /v1/friends/{id}     add friend  -> servers subscribe to their channel
// DELETE /v1/friends/{id}     unfriend    -> unsubscribe at once
// PUT    /v1/me/sharing       { enabled: false } pauses sharing`,
        highlight: [2, 6, 7, 8],
      },
    },
    {
      title: 'Three stores',
      tag: 'concept',
      heading: 'Latest point, profiles and history live apart',
      eli5: 'The camp keeps three notebooks. A **whiteboard** shows each kid\'s latest spot, a **roster** lists friends and rules, and a **logbook** records everything for later.',
      body: [
        'The **location cache** keeps only the latest point per user: `loc:{user_id}` maps to lat, lng and timestamp. The **user DB** keeps profiles, friend lists and sharing settings.',
        'The **history store** appends every point for analytics, keyed by `(user_id, ts)`. Each store has a different write rate and lifetime, so one database would fit none of them.',
      ],
      keyIdea: 'Keep the latest location apart from profile data and full history.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [
          { ...cache, at: at(-4.5, 0), status: 'active', badge: 'latest point only' },
          { ...userDb, at: at(0, 0), status: 'active', badge: 'friends, settings' },
          { ...history, at: at(4.5, 0), status: 'active', badge: 'every point' },
        ],
        links: [],
        panel: {
          title: 'Three stores, three jobs',
          icon: 'Database',
          rows: [
            { text: 'Location cache', value: 'overwrite, TTL' },
            { text: 'User DB', value: 'rare writes' },
            { text: 'History store', value: 'append only' },
          ],
          footer: { text: 'loc:{user_id} -> lat, lng, ts', tone: 'muted' },
        },
        caption: 'Different data, different stores',
      },
    },
    {
      title: 'Polling design',
      tag: 'case',
      heading: 'The simple design: write a row, poll for friends',
      eli5: 'The first plan: every kid writes their spot on a big notebook in the office, and every kid runs to the office to read all their friends\' spots.',
      body: [
        'The obvious version: phones `POST` their location to app servers, which update one row per user in a location table. Every 10 seconds each phone also asks for its friends\' locations.',
        'The server reads the friend list, then each friend\'s row, and computes distances. It is easy to build and easy to reason about, which is why it is worth doing the math before rejecting it.',
      ],
      keyIdea: 'Write a row, poll for friends: simple, and worth measuring before dismissing.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [
          { ...ana, at: at(-4.5, -1.5), chips: ['POST location'] },
          { id: 'app', kind: 'server', at: at(0, -1.5), label: 'app servers', sub: 'HTTP' },
          { id: 'locDb', kind: 'db', at: at(4.5, -1.5), label: 'location DB', sub: 'one row per user' },
        ],
        links: [link('ana', 'app', { label: 'POST + poll' }), link('app', 'locDb')],
        flows: [
          { path: ['ana', 'app', 'locDb'], tone: 'request', label: 'UPDATE row', duration: 1.8 },
          { path: ['locDb', 'app', 'ana'], tone: 'response', label: 'friends\' rows', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Every 10 seconds, per phone',
          icon: 'Repeat',
          rows: [
            { text: 'POST my location', value: '1 write' },
            { text: 'GET friend list', value: '1 read' },
            { text: 'Read each friend row', value: '~300 reads' },
            { text: 'Compute distances', value: 'on the server' },
          ],
        },
        caption: 'Write a row, then poll all your friends',
      },
    },
    {
      title: 'Polling math',
      tag: 'case',
      heading: 'Polling reads 300M rows per second and arrives late',
      eli5: 'Ten thousand kids all run to the office door every ten seconds. Most of the notebook pages they read belong to kids who are asleep or far away. The door jams.',
      body: [
        'Writes alone are 1M row updates per second. Reads are worse: 1M polls per second, each reading about 300 friend rows, is **300M row reads per second**. Only about 20 of those 300 friends are online, so roughly 7% of the reads matter.',
        'Ana also sees Ben\'s move only after his next write plus her next poll, up to **20 seconds** late. Sharding the table spreads the load but keeps the waste: every user pulls everything when few changes matter.',
      ],
      keyIdea: 'Polling makes every reader pay for every friend on every cycle. When few updates matter to each reader, push them instead.',
      metrics: { online: '10M', ups: '1M/s', fan: '~300M reads/s', lag: 'up to 20 s' },
      metricTones: { fan: 'bad', lag: 'bad' },
      scene: {
        nodes: [
          { ...ana, at: at(-4.5, -1.5) },
          { id: 'app', kind: 'server', at: at(0, -1.5), label: 'app servers', status: 'hot', load: 97 },
          { id: 'locDb', kind: 'db', at: at(4.5, -1.5), label: 'location DB', status: 'hot', load: 99, badge: '1M writes + 300M reads/s' },
        ],
        links: [link('ana', 'app', { label: 'poll every 10 s', labelTone: 'warn' }), link('app', 'locDb')],
        flows: [
          { path: ['ana', 'app'], tone: 'request', label: 'GET friends', count: 3, duration: 1.4 },
          { path: ['app', 'locDb'], tone: 'request', label: '300 reads per poll', count: 5, duration: 1, delay: 1.5 },
          { path: ['locDb', 'app'], tone: 'error', label: 'slow', duration: 2, delay: 2.7 },
        ],
        panel: {
          title: 'The cost of asking',
          icon: 'Gauge',
          rows: [
            { text: 'Row writes', value: '1M/s', tone: 'warn' },
            { text: 'Row reads (1M x ~300)', value: '~300M/s', tone: 'bad' },
            { text: 'Reads that matter (20 of 300)', value: '~7%', tone: 'bad' },
            { text: 'Delay, write + poll', value: 'up to 20 s', tone: 'bad' },
          ],
          footer: { text: 'Push the few updates that matter', tone: 'good' },
        },
        caption: 'Every poll reads every friend, moving or not',
      },
    },
    {
      title: 'WebSocket tier',
      tag: 'concept',
      heading: 'Keep a socket open to every phone',
      eli5: 'Each kid\'s **walkie-talkie** stays tuned to one counselor in the radio room. The counselor can call the kid any time, so nobody has to keep running to the office.',
      body: [
        'Each phone opens one WebSocket to a **WebSocket server** through a load balancer that supports long-lived connections. The server keeps the connection, the user\'s own last location and the user\'s list of nearby friends in memory.',
        'This tier is stateful, unlike the stateless servers in most designs. After connecting, the server pushes changes as they happen, with no polling at all.',
      ],
      keyIdea: 'A WebSocket per user turns the server into a mailbox it can push to, which removes polling and its wasted reads.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [{ ...ana, at: at(-4.5, -1.5), status: 'active' }, { ...lb, at: at(0, -1.5) }, { ...ws1, at: at(4.5, -1.5), status: 'active', chips: ['Ana: 41.88, -87.62', 'friends: 20'] }],
        links: [link('ana', 'lb', { label: 'upgrade: websocket' }), link('lb', 'ws1', { arrow: 'both' })],
        flows: [
          { path: ['ana', 'lb', 'ws1'], tone: 'handshake', label: 'upgrade: websocket', duration: 1.8 },
          { path: ['ws1', 'lb', 'ana'], tone: 'event', label: 'pushed any time', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Kept in server memory',
          icon: 'Server',
          rows: [
            { text: 'The open connection', value: 'Ana' },
            { text: 'Ana\'s last location', value: 'lat, lng, ts' },
            { text: 'Nearby friends list', value: '~20 entries' },
            { text: 'Tier type', value: 'stateful', tone: 'warn' },
          ],
        },
        caption: 'One long-lived socket per phone',
      },
    },
    {
      title: 'Connect flow',
      tag: 'concept',
      heading: 'On connect, the server builds the first list',
      eli5: 'When a kid first tunes in, the counselor looks up the kid\'s friends on the roster, reads their spots off the whiteboard in one glance, and reads the list aloud.',
      body: [
        'On connect, the server loads Ana\'s friend list from the user DB, reads those friends\' latest locations from the location cache in one batch, and computes distances.',
        'It sends `nearby_init` with the friends inside 5 km, and keeps every friend\'s location in memory (`friend_loc`) as the starting state. From then on, only changes travel.',
      ],
      keyIdea: 'One batched cache read on connect builds the list. After that, only changes move.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [{ ...ana, at: at(-4.5, 0), status: 'active' }, { ...ws1, at: at(-0.5, 0), status: 'active', chips: ['MGET 300 friends'] }, { ...cache, at: at(3.5, -3.5), status: 'active' }, { ...userDb, at: at(3.5, 3.5) }],
        links: [link('ana', 'ws1'), link('ws1', 'userDb', { label: 'friend ids' }), link('ws1', 'cache', { label: 'one batch' })],
        flows: [
          { path: ['ws1', 'userDb', 'ws1'], tone: 'request', label: 'friend list', duration: 1.6 },
          { path: ['ws1', 'cache', 'ws1'], tone: 'request', label: 'MGET', duration: 1.6, delay: 1.7 },
          { path: ['ws1', 'ana'], tone: 'response', label: 'nearby_init', duration: 1.2, delay: 3.4 },
        ],
        panel: {
          title: 'nearby_init in three reads',
          icon: 'Download',
          rows: [
            { text: '1. Friend list', value: 'user DB' },
            { text: '2. Latest points', value: 'cache, 1 batch' },
            { text: '3. Keep within 5 km', value: '~3 friends' },
          ],
          footer: { text: 'Missing keys mean offline or expired', tone: 'muted' },
        },
        caption: 'One batch read, then updates only',
      },
    },
    {
      title: 'Connection budget',
      tag: 'concept',
      heading: 'About 100,000 sockets per server, so about 100 servers',
      eli5: 'One counselor can only keep a hundred thousand radios tuned at once. For ten million kids the camp needs about a hundred counselors, plus a few spare.',
      body: [
        'Budget about 100,000 open connections per server. 10M online users need about **100 servers**, plus headroom. Most of the work per connection is small: receive a point every 10 seconds, forward a few updates.',
        'Memory and open connections limit this tier, not CPU. Measure it on your own hardware before trusting 100,000, since buffers and TLS state differ by stack.',
      ],
      keyIdea: 'Size the socket tier by open connections and memory, not by requests per second.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [
          { ...lb, at: at(-4.5, 0) },
          { ...ws1, at: at(0, -3.5), status: 'active', load: 45, badge: '100K sockets' },
          { ...ws2, at: at(4.5, 0.5), status: 'active', load: 48, badge: '100K sockets' },
        ],
        links: [link('lb', 'ws1'), link('lb', 'ws2')],
        flows: [
          { path: ['lb', 'ws1'], tone: 'handshake', count: 3, duration: 1.6 },
          { path: ['lb', 'ws2'], tone: 'handshake', count: 3, duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Sizing the socket tier',
          icon: 'Scale',
          rows: [
            { text: 'Online users', value: '10M' },
            { text: 'Sockets per server', value: '100K' },
            { text: 'Servers', value: '~100 + spare', tone: 'good' },
            { text: 'Limit that bites', value: 'memory, sockets' },
          ],
        },
        caption: '10M sockets over about 100 servers',
      },
    },
    {
      title: 'Location cache',
      tag: 'concept',
      heading: 'Only the latest point, and let it expire',
      eli5: 'The radio room has a **whiteboard** with each kid\'s latest spot. Each new call wipes the old spot, and the chalk fades after ten quiet minutes, so kids who went to bed vanish by themselves.',
      body: [
        'When Ana\'s update arrives, her WebSocket server writes it to the **location cache**: `SET loc:ana {lat, lng, ts} EX 600`. Each write overwrites the last one, so the cache holds one small entry per active user.',
        'The **TTL** does the cleanup. A user who closes the app stops sending, the key expires after 10 minutes, and that user drops off everyone\'s list with no cleanup job. This also matches the product rule for inactive friends.',
      ],
      keyIdea: 'The location cache stores only the present. Overwrites keep it small and the TTL removes users who left.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [{ ...ana, at: at(-4.5, -1.5), status: 'active', chips: ['41.881, -87.623'] }, { ...ws1, at: at(0, -1.5), status: 'active' }, { ...cache, at: at(4.5, -1.5), status: 'active', chips: ['loc:ana = 41.881, -87.623'] }],
        links: [link('ana', 'ws1'), link('ws1', 'cache')],
        flows: [
          { path: ['ana', 'ws1'], tone: 'request', label: 'location_update', count: 3, duration: 1.4 },
          { path: ['ws1', 'cache'], tone: 'data', label: 'SET loc:ana EX 600', count: 3, duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'One entry per active user',
          icon: 'Clock',
          code: 'SET loc:ana\n  {lat, lng, ts}\n  EX 600\n# overwrite on update\n# gone after 10 quiet minutes',
          footer: { text: 'No cleanup job needed', tone: 'good' },
        },
        caption: 'Overwrite on every update, expire when quiet',
      },
    },
    {
      title: 'Cache sizing',
      tag: 'concept',
      heading: 'Memory is small, the write rate is the hard part',
      eli5: 'The whiteboard is tiny, but a million kids wipe and rewrite their line every second. So the camp hangs ten whiteboards and gives each one a spare.',
      body: [
        'About 10M entries of roughly 100 bytes is around **1 GB**. The write rate is the real load, at 1M writes per second. Shard the cache by user id across about 10 Redis nodes, with a replica each (see the caching and sharding lessons).',
        'Losing a cache shard is mild: entries refill within 10 seconds as phones send their next update. No durable database sits on this path.',
      ],
      keyIdea: 'Shard the location cache for write throughput, not for size. A lost shard refills itself in 10 seconds.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [
          { ...ws1, at: at(-4.5, 0), status: 'active', chips: ['1M writes/s'] },
          { ...cache, id: 'cache', at: at(0, -3), status: 'active', label: 'cache shard A', sub: '100K writes/s', load: 55 },
          { ...cache, id: 'cache2', at: at(0, 3), status: 'down', label: 'cache shard B', sub: 'lost', badge: 'refills in 10 s' },
        ],
        links: [link('ws1', 'cache', { label: 'hash(user)' }), link('ws1', 'cache2', { style: 'faint' })],
        flows: [{ path: ['ws1', 'cache'], tone: 'data', label: 'SET', count: 3, duration: 1.4 }],
        panel: {
          title: 'Sizing the cache',
          icon: 'Database',
          rows: [
            { text: 'Entries x ~100 B', value: '~1 GB' },
            { text: 'Writes', value: '1M/s', tone: 'warn' },
            { text: 'Redis nodes', value: '~10 + replicas' },
            { text: 'Shard lost', value: 'refills in 10 s', tone: 'good' },
          ],
        },
        caption: 'Shard for throughput, not for size',
      },
    },
    {
      title: 'Pub/sub',
      tag: 'concept',
      heading: 'A channel per user carries updates to friends',
      eli5: 'Every kid gets their own **radio channel**. Ben\'s counselor tunes in to the channels of Ben\'s friends, so when Ana calls out a new spot, Ben\'s counselor hears it right away.',
      body: [
        'Each online user has a **pub/sub channel** named after them, for example in Redis pub/sub (see the pub/sub lesson). Ben\'s server subscribes to the channels of Ben\'s friends, so it is subscribed to `loc:ana`.',
        'When Ana moves, her server writes the cache and publishes her point on `loc:ana`. Pub/sub delivers it to every server subscribed, about 20 on average.',
      ],
      keyIdea: 'A per-user channel turns one location update into exactly the deliveries that need to happen, about 20 instead of hundreds of reads.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      metricTones: { fan: 'warn', lag: 'good' },
      scene: {
        nodes: [{ ...ws1, status: 'active', chips: ['PUBLISH loc:ana'] }, { ...pubsub, status: 'active', badge: 'loc:ana, 20 subscribers' }, { ...ws2, status: 'active', chips: ['SUBSCRIBE loc:ana'] }, { ...ben, at: at(4.5, 1.5) }],
        links: [link('ws1', 'pubsub'), link('pubsub', 'ws2'), link('ws2', 'ben')],
        flows: [
          { path: ['ws1', 'pubsub'], tone: 'event', label: 'PUBLISH loc:ana', duration: 1.3 },
          { path: ['pubsub', 'ws2'], tone: 'event', label: 'to subscribers', count: 3, duration: 1.3, delay: 1.4 },
          { path: ['ws2', 'ben'], tone: 'event', label: 'friend_nearby', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Fire and forget',
          icon: 'Share2',
          rows: [
            { text: 'Channel name', value: 'loc:{user}' },
            { text: 'Subscribers per channel', value: '~20 online' },
            { text: 'Messages kept', value: 'none' },
            { text: 'Lost message', value: 'next one in 10 s', tone: 'good' },
          ],
          footer: { text: 'A log would add cost and no value here', tone: 'muted' },
        },
        caption: 'Publish once, deliver to each friend\'s server',
      },
    },
    {
      title: 'Subscriptions',
      tag: 'concept',
      heading: 'Subscribe to all friends, so a late arrival is heard',
      eli5: 'When Ben tunes in, his counselor tunes to every friend\'s channel, even ones who are asleep. Silent channels cost nothing, and a friend who wakes up is heard at once.',
      body: [
        'On connect, Ben\'s server subscribes to the channel of **every friend** with sharing on, online or not. An idle channel costs only a small entry, and a friend who comes online later is heard the moment they publish.',
        'Adding a friend subscribes both servers to the new channel. Unfriending unsubscribes them in the same request. About 10M online users times a few hundred friends makes billions of small subscriptions, which the sharded tier in part 2 carries.',
      ],
      keyIdea: 'Subscribe to every friend\'s channel. Silent channels are cheap, and friends who appear later need no extra lookup.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...ws2, status: 'active', chips: ['SUBSCRIBE loc:ana', 'SUBSCRIBE loc:cy', 'SUBSCRIBE loc:dee'] }, { ...pubsub, at: at(0, -3), status: 'active' }, { ...api, at: at(-4.5, 1.5), status: 'active', chips: ['POST /friends/cy'] }],
        links: [link('ws2', 'pubsub', { label: 'all friends', arrow: 'both' }), link('api', 'ws2', { label: 'new friend', style: 'dashed' })],
        flows: [
          { path: ['ws2', 'pubsub'], tone: 'request', label: 'SUBSCRIBE x300', count: 3, duration: 1.6 },
          { path: ['api', 'ws2', 'pubsub'], tone: 'event', label: 'subscribe loc:cy', duration: 2, delay: 1.8 },
        ],
        panel: {
          title: 'When subscriptions change',
          icon: 'Users',
          rows: [
            { text: 'Connect', value: 'subscribe all friends' },
            { text: 'Add friend', value: 'subscribe both ways' },
            { text: 'Unfriend', value: 'unsubscribe at once' },
            { text: 'Friend comes online', value: 'heard on publish', tone: 'good' },
          ],
        },
        caption: 'Subscriptions follow the friend graph',
      },
    },
    {
      title: 'Distance check',
      tag: 'concept',
      heading: 'Compute the distance where the update lands',
      eli5: 'Before calling Ben, his counselor checks the camp map. Ana is close, so the counselor tells Ben. If Ana were across the lake, the counselor would stay **quiet** and Ben would not even know where she is.',
      body: [
        'Ben\'s server keeps Ben\'s own location (`conn.me`) and each friend\'s last point (`friend_loc`) in memory. When Ana\'s point arrives, it computes the haversine distance. Within 5 km it pushes `friend_nearby`. Outside, it sends `friend_left` if she was listed, else nothing.',
        'The same check runs when **Ben** moves: his `location_update` sets `conn.me` and re-checks every tracked friend. About 200,000 checks per second per server cost microseconds each.',
      ],
      keyIdea: 'Filter by distance on the subscriber\'s server: cheap math there, fewer messages to phones, and no coordinates leaked for distant friends.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [{ ...pubsub, at: at(-4.5, -1.5), status: 'active' }, { ...ws2, at: at(0, -1.5), status: 'active', badge: 'Ana is 600 m away' }, { ...ben, at: at(4.5, -1.5), status: 'ok', chips: [{ text: 'friend_nearby 600 m', tone: 'good' }] }],
        links: [link('pubsub', 'ws2'), link('ws2', 'ben')],
        flows: [
          { path: ['pubsub', 'ws2'], tone: 'event', label: 'loc:ana', duration: 1.2 },
          { path: ['ws2', 'ben'], tone: 'response', label: 'friend_nearby 600 m', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Four friends on one update',
          icon: 'Route',
          rows: [
            { text: 'Ana, 600 m', value: 'push', tone: 'good' },
            { text: 'Cy, 3.2 km', value: 'push', tone: 'good' },
            { text: 'Dee, 40 km', value: 'drop', tone: 'muted' },
            { text: 'Eli, 900 km', value: 'drop', tone: 'muted' },
          ],
          footer: { text: 'Radius 5 km, checked on the receiver', tone: 'muted' },
        },
        caption: 'Distance is checked on Ben\'s server before anything reaches Ben',
      },
      code: {
        language: 'python',
        title: 'Handling a friend\'s update on the subscriber\'s server',
        source: `RADIUS_M = 5_000

async def on_friend_update(conn, raw):
    """Runs on Ben's WebSocket server for each message on a friend's channel."""
    f = json.loads(raw)                                 # {id, lat, lng, ts}
    if f["ts"] <= conn.last_ts.get(f["id"], 0):
        return                                          # stale
    conn.last_ts[f["id"]] = f["ts"]
    conn.friend_loc[f["id"]] = (f["lat"], f["lng"], f["ts"])
    await recheck(conn, f["id"])

async def on_own_update(conn, lat, lng):
    """Ben moved: update conn.me and re-check every friend we track."""
    conn.me = (lat, lng)
    for fid in list(conn.friend_loc):
        await recheck(conn, fid)

async def recheck(conn, fid):
    if conn.me is None:
        return                                          # no own fix yet
    lat, lng, ts = conn.friend_loc[fid]
    d = dist_m(conn.me[0], conn.me[1], lat, lng)        # haversine
    if d <= RADIUS_M:
        conn.visible.add(fid)
        await conn.send({"type": "friend_nearby", "id": fid, "lat": lat,
                         "lng": lng, "distanceM": round(d), "ts": ts})
    elif fid in conn.visible:
        conn.visible.discard(fid)
        await conn.send({"type": "friend_left", "id": fid})
    # far-away friends stop here: their coordinates never reach the phone`,
        highlight: [9, 14, 22, 27],
      },
      quiz: {
        question: 'Ana has 20 online friends. 3 are within 5 km. When Ana sends one update, how many pub/sub deliveries happen, and how many messages reach phones?',
        options: ['20 deliveries, 20 phone messages', '20 deliveries, about 3 phone messages', '3 deliveries, 3 phone messages', '1 delivery, 20 phone messages'],
        answer: 1,
        explain: 'Pub/sub delivers to every subscribed friend\'s server, so 20. Each of those servers checks the distance and only the 3 nearby friends get a push. A friend who just moved out of range also gets one friend_left message.',
      },
    },
    {
      title: 'Stale updates',
      tag: 'concept',
      heading: 'Ignore old points that arrive late',
      eli5: 'After a bad signal, an old shout from Ana can reach the counselor after her newer one. The counselor checks the time on each shout and ignores the older one.',
      body: [
        'Updates can arrive out of order after a reconnect or a slow hop. The server keeps the last timestamp per friend and ignores any point that is not newer.',
        'Friends who stop sending simply expire from the cache after 10 minutes, so a late old point can never revive someone who left.',
      ],
      keyIdea: 'Keep the last timestamp per friend, and drop anything older.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...pubsub, at: at(-4.5, -1.5), status: 'active' }, { ...ws2, at: at(0, -1.5), status: 'active', chips: ['last ts: 10:00:20'] }, { ...ben, at: at(4.5, -1.5), status: 'ok' }],
        links: [link('pubsub', 'ws2'), link('ws2', 'ben')],
        flows: [
          { path: ['pubsub', 'ws2'], tone: 'event', label: 'ts 10:00:10 (late)', duration: 1.4 },
          { path: ['ws2', 'ben'], tone: 'error', label: 'ignored', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Per friend, per connection',
          icon: 'Clock',
          rows: [
            { text: 'Arrives: ts 10:00:20', value: 'accept', tone: 'good' },
            { text: 'Arrives: ts 10:00:10', value: 'ignore', tone: 'warn' },
            { text: 'Arrives: ts 10:00:30', value: 'accept', tone: 'good' },
          ],
          footer: { text: 'ts <= last_ts means drop', tone: 'muted' },
        },
        caption: 'Newest timestamp wins',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1: push each update to the few who care',
      eli5: 'Kids carry **walkie-talkies**, a whiteboard shows the latest spot, every kid has a channel, and counselors check the map before passing news on. Part 2 keeps the camp running when counselors faint.',
      body: [
        'Polling a location table would cost about 300M reads per second and up to 20 seconds of delay. Instead each phone holds a **WebSocket** to a stateful server tier (about 100 servers for 10M users).',
        'Updates overwrite a sharded **location cache** with a 10-minute TTL and are published on a **per-user channel**, so 1M updates per second become 20M targeted deliveries. The receiving server checks the **distance** and pushes only friends within 5 km.',
      ],
      keyIdea: 'For fast-moving data that matters to few readers, push it through per-user channels and filter on the receiving server.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [ana, ws1, pubsub, ws2, { ...ben, at: at(4.5, 1.5) }],
        links: [link('ana', 'ws1'), link('ws1', 'pubsub'), link('pubsub', 'ws2'), link('ws2', 'ben')],
        flows: [{ path: ['ana', 'ws1', 'pubsub', 'ws2', 'ben'], tone: 'event', count: 3, duration: 3 }],
        panel: {
          title: 'The design so far',
          icon: 'Workflow',
          rows: [
            { text: 'Phone link', value: 'WebSocket' },
            { text: 'Latest point', value: 'cache, TTL 10 min' },
            { text: 'Routing', value: 'channel per user' },
            { text: 'Filtering', value: '5 km on receiver' },
          ],
          footer: { text: 'Part 2: scale, strangers, history, privacy', tone: 'muted' },
        },
        caption: 'Push through per-user channels',
      },
      quiz: {
        question: 'Why does the design push updates through per-user channels instead of having each phone poll a location table?',
        options: [
          'Polling cannot compute distances',
          'Polling reads about 300M rows per second, mostly for friends who did not move or are far away',
          'WebSockets are cheaper than HTTP in every case',
          'Pub/sub stores location history',
        ],
        answer: 1,
        explain: 'Each poll reads hundreds of friend rows, nearly all irrelevant. A per-user channel delivers only the changes, about 20 per update, and adds no stored state to maintain.',
      },
    },
  ],
};
