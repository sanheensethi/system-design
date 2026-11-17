import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const ana: SceneNode = { id: 'ana', kind: 'phone', at: p(-10, 0), label: 'Ana', sub: 'sends every 10 s' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: p(9, 0), label: 'Ben', sub: 'friend, 600 m away' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: p(-6.5, 0), label: 'load balancer', sub: 'long-lived conns' };
const ws1: SceneNode = { id: 'ws1', kind: 'server', at: p(-3, -2), label: 'WS server 1', sub: 'holds Ana' };
const ws2: SceneNode = { id: 'ws2', kind: 'server', at: p(5, -2), label: 'WS server 2', sub: 'holds Ben' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: p(1, -6), label: 'location cache', sub: 'TTL 10 min' };
const pubsub: SceneNode = { id: 'pubsub', kind: 'queue', at: p(1, 1), label: 'pub/sub', sub: 'channel per user' };
const api: SceneNode = { id: 'api', kind: 'service', at: p(-3, 5), label: 'API servers', sub: 'friends, settings' };
const userDb: SceneNode = { id: 'userDb', kind: 'db', at: p(1.5, 6.5), label: 'user DB', sub: 'friend lists' };
const stream: SceneNode = { id: 'stream', kind: 'queue', at: p(5, 4.5), label: 'location stream', sub: 'Kafka-style log' };
const history: SceneNode = { id: 'history', kind: 'warehouse', at: p(9.5, 5), label: 'history store', sub: '~3.5 TB/day' };

// Naive polling design.
const benLeft: SceneNode = { id: 'benLeft', kind: 'phone', at: p(-10, 5), label: 'Ben', sub: 'polls every 10 s' };
const app: SceneNode = { id: 'app', kind: 'server', at: p(-2.5, 2), label: 'app servers', sub: 'HTTP' };
const locDb: SceneNode = { id: 'locDb', kind: 'db', at: p(2.5, 2), label: 'location DB', sub: 'one row per user' };

// WebSocket tier at scale.
const crowd: SceneNode = { id: 'crowd', kind: 'phone', at: p(-10, 4.5), label: 'other phones', sub: '100K on server 7' };
const wsA: SceneNode = { id: 'wsA', kind: 'server', at: p(-3, 2), label: 'WS server 7' };
const wsB: SceneNode = { id: 'wsB', kind: 'server', at: p(0.5, 2), label: 'WS server 8' };
const wsC: SceneNode = { id: 'wsC', kind: 'server', at: p(4, 2), label: 'WS server 9' };
const cacheR: SceneNode = { id: 'cacheR', kind: 'cache', at: p(7.5, -2), label: 'location cache' };
const pubsubR: SceneNode = { id: 'pubsubR', kind: 'queue', at: p(7.5, 4.5), label: 'pub/sub' };

// Pub/sub tier at scale.
const wsL: SceneNode = { id: 'wsL', kind: 'server', at: p(-6, 0), label: 'WS server 1', sub: 'publishes for Ana' };
const disc: SceneNode = { id: 'disc', kind: 'service', at: p(-6, -6), label: 'service discovery', sub: 'hash ring: 100 nodes' };
const ps1: SceneNode = { id: 'ps1', kind: 'queue', at: p(-1.5, -2.5), label: 'pub/sub 14' };
const ps2: SceneNode = { id: 'ps2', kind: 'queue', at: p(1.5, 2), label: 'pub/sub 15' };
const ps3: SceneNode = { id: 'ps3', kind: 'queue', at: p(4.5, -2.5), label: 'pub/sub 16' };
const wsR: SceneNode = { id: 'wsR', kind: 'server', at: p(8, 0), label: 'WS server 2', sub: 'subscribed for Ben' };

const coreLinks = [
  { from: 'ana', to: 'lb' },
  { from: 'lb', to: 'ws1' },
  { from: 'ws1', to: 'cache' },
  { from: 'ws1', to: 'pubsub' },
  { from: 'pubsub', to: 'ws2' },
  { from: 'ws2', to: 'ben' },
];

export const designNearbyFriends: Lesson = {
  id: 'design-nearby-friends',
  title: 'Design nearby friends',
  tagline: 'Show each user which friends are close by, updated every few seconds, for 10 million people online at once.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Why polling a database collapses when every user moves every few seconds',
    'A WebSocket tier, a location cache with a TTL and a pub/sub channel per user',
    'Filtering by distance on the receiving server so far friends never reach the phone',
    'Scaling stateful WebSocket servers and a sharded pub/sub tier, and surviving node loss',
    'Keeping location history for analytics, and the privacy rules around it',
  ],
  metrics: [
    { key: 'online', label: 'Online users' },
    { key: 'ups', label: 'Location updates/s' },
    { key: 'fan', label: 'Fan-out/s' },
    { key: 'lag', label: 'Friend sees move' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Where are my friends, right now?',
      eli5: 'At summer camp every kid carries a **walkie-talkie** and calls out where they are every few seconds. Each kid wants to hear about friends who are close, and nobody else.',
      body: [
        'A user who turns the feature on sees a list of friends within **5 km**, with distance and the time of their last update. Positions refresh every few seconds while the app is open. A friend who has sent nothing for 10 minutes drops off the list. Ana should see Ben move within about **2 seconds** of his phone sending the update.',
        'Scale: 100M daily users, and at peak about **10M online at once**. Each phone sends its location every 10 seconds, so the system takes **1M location updates per second**. Users have a few hundred friends, but on average only about **20** of them are online with sharing turned on.',
        'This is the opposite of a proximity service for restaurants. There, the points barely move and reads dominate. Here every point moves all the time, the write rate is enormous, and each write matters to only about 20 people.',
      ],
      keyIdea: 'Positions change constantly and each change interests only a handful of friends. Design for routing each update to the few people who care.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: 'goal < 2 s' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, lb, ws1, ws2, { ...ben, status: 'active' }],
        links: [{ from: 'ana', to: 'lb' }, { from: 'lb', to: 'ws1' }, { from: 'ws1', to: 'ws2', style: 'faint' }, { from: 'ws2', to: 'ben' }],
        flows: [
          { path: ['ana', 'lb', 'ws1'], tone: 'request', label: 'I am here', duration: 1.4 },
          { path: ['ws1', 'ws2', 'ben'], tone: 'event', label: 'Ana is 600 m away', duration: 1.6, delay: 1.5 },
        ],
        caption: '1M location updates per second, each for about 20 friends',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'A socket for locations, HTTP for everything else',
      eli5: 'The **walkie-talkie** stays switched on for fast messages. Slow chores, like adding a new friend to your list, go on a paper form at the camp office.',
      body: [
        'Location traffic is constant and two-way, so it travels over a **WebSocket** (see the real-time lesson). The phone sends `location_update` every 10 seconds. The server sends `nearby_init` once on connect, `friend_nearby` when a friend in range moves, and `friend_left` when one leaves the radius or stops sharing.',
        'Rare actions stay on plain HTTP through ordinary API servers: add or remove a friend, pause sharing, change settings.',
        'Three stores hold the data. The **location cache** keeps only the latest point per user: `loc:{user_id}` maps to lat, lng and timestamp. The **user DB** keeps profiles, friend lists and sharing settings. The **history store** appends every point for analytics, keyed by `(user_id, ts)`.',
      ],
      keyIdea: 'Split the hot, real-time path from the slow, transactional one, and keep the latest location apart from the full history.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: 'goal < 2 s' },
      scene: {
        nodes: [ana, lb, { ...ws1, status: 'active' }, cache, { ...api, status: 'active' }, userDb],
        links: [{ from: 'ana', to: 'lb' }, { from: 'lb', to: 'ws1' }, { from: 'lb', to: 'api' }, { from: 'ws1', to: 'cache' }, { from: 'api', to: 'userDb' }],
        flows: [
          { path: ['ana', 'lb', 'ws1'], tone: 'request', label: 'location_update', count: 3, duration: 1.4 },
          { path: ['ws1', 'cache'], tone: 'data', label: 'latest point', duration: 1, delay: 1.5 },
          { path: ['ana', 'lb', 'api'], tone: 'request', label: 'POST /friends/ben', duration: 1.6, delay: 2.2 },
          { path: ['api', 'userDb'], tone: 'data', duration: 1, delay: 3.8 },
        ],
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
      title: 'Polling breaks',
      tag: 'case',
      heading: 'The simple design: write a row, poll for friends',
      eli5: 'The first plan: every kid writes their spot on a big notebook in the office, and every kid runs to the office to read all their friends\' spots. The office door jams within a minute.',
      body: [
        'The obvious version: phones `POST` their location to app servers, which update one row per user in a location table. Every 10 seconds each phone also asks for the locations of its friends, and the server reads the friend list, then each friend\'s row, and computes distances.',
        'Do the math. Writes alone are 1M row updates per second. Reads are worse: 1M polls per second, each reading a few hundred friend rows, is on the order of **100M row reads per second**, almost all for friends who are offline or far away. And Ana sees Ben\'s move only after his next write plus her next poll, up to 20 seconds late.',
        'Sharding the table spreads the load but keeps the waste. The design asks every user to pull everything, when only a few changes matter to each of them.',
      ],
      keyIdea: 'Polling makes every reader pay for every friend on every cycle. When few updates matter to each reader, push them instead.',
      metrics: { online: '10M', ups: '1M/s', fan: '~100M reads/s', lag: 'up to 20 s' },
      scene: {
        nodes: [ana, benLeft, { ...lb, at: p(-6.5, 2.5) }, { ...app, status: 'hot' }, { ...locDb, status: 'hot', badge: '1M writes + 100M reads/s' }],
        links: [{ from: 'ana', to: 'lb' }, { from: 'benLeft', to: 'lb' }, { from: 'lb', to: 'app' }, { from: 'app', to: 'locDb' }],
        flows: [
          { path: ['ana', 'lb', 'app'], tone: 'request', label: 'POST location', count: 3, duration: 1.4 },
          { path: ['benLeft', 'lb', 'app'], tone: 'request', label: 'GET friends', count: 3, duration: 1.4, delay: 0.4 },
          { path: ['app', 'locDb'], tone: 'request', label: '300 reads per poll', count: 5, duration: 1, delay: 1.6 },
          { path: ['locDb', 'app'], tone: 'error', label: 'slow', duration: 2, delay: 2.8 },
        ],
        caption: 'Every poll reads every friend, moving or not',
      },
    },
    {
      title: 'WebSocket tier',
      tag: 'concept',
      heading: 'Keep a socket open to every phone',
      eli5: 'Each kid\'s **walkie-talkie** stays tuned to one counselor in the radio room. The counselor can call the kid any time, so nobody has to keep running to the office.',
      body: [
        'Each phone opens one WebSocket to a **WebSocket server** through a load balancer that supports long-lived connections. The server keeps the connection, the user\'s own last location and the user\'s list of nearby friends in memory. This tier is stateful, unlike the stateless servers in most designs.',
        'On connect, the server loads Ana\'s friend list from the user DB, reads those friends\' latest locations from the location cache in one batch, computes distances, and sends `nearby_init`. After that, the server pushes changes as they happen, with no polling at all.',
        'Budget about 100,000 open connections per server, so 10M online users need about **100 servers**, plus headroom. Most of the work per connection is small: receive a point every 10 seconds, forward a few updates.',
      ],
      keyIdea: 'A WebSocket per user turns the server into a mailbox it can push to, which removes polling and its wasted reads.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, lb, { ...ws1, status: 'active', badge: '100K sockets' }, cache, { ...ws2, badge: '100K sockets' }, ben],
        links: [{ from: 'ana', to: 'lb' }, { from: 'lb', to: 'ws1' }, { from: 'ws1', to: 'cache' }, { from: 'ws2', to: 'ben' }, { from: 'ws2', to: 'cache', style: 'faint' }],
        flows: [
          { path: ['ana', 'lb', 'ws1'], tone: 'handshake', label: 'upgrade: websocket', duration: 1.4 },
          { path: ['ws1', 'cache'], tone: 'request', label: 'MGET 20 friends', duration: 1, delay: 1.5 },
          { path: ['cache', 'ws1'], tone: 'response', duration: 1, delay: 2.6 },
          { path: ['ws1', 'lb', 'ana'], tone: 'response', label: 'nearby_init', duration: 1.4, delay: 3.7 },
        ],
        caption: 'One long-lived socket per phone',
      },
    },
    {
      title: 'Location cache',
      tag: 'concept',
      heading: 'Only the latest point, and let it expire',
      eli5: 'The radio room has a **whiteboard** with each kid\'s latest spot. Each new call wipes the old spot, and the chalk fades after ten quiet minutes, so kids who went to bed vanish by themselves.',
      body: [
        'When Ana\'s update arrives, her WebSocket server writes it to the **location cache**: `SET loc:ana {lat, lng, ts} EX 600`. Each write overwrites the last one, so the cache holds one small entry per active user: about 10M entries of roughly 100 bytes, around **1 GB**.',
        'The **TTL** does the cleanup. A user who closes the app stops sending, the key expires after 10 minutes, and that user drops off everyone\'s list with no cleanup job. This also matches the product rule for inactive friends.',
        'Memory is small. The write rate is the hard part, at 1M writes per second. Shard the cache by user id across about 10 Redis nodes, with a replica each (see the caching and sharding lessons). Losing a cache shard is mild: entries refill within 10 seconds as phones send their next update. No durable database sits on this path.',
      ],
      keyIdea: 'The location cache stores only the present. Overwrites keep it small and the TTL removes users who left.',
      metrics: { online: '10M', ups: '1M/s', fan: '-', lag: '-' },
      scene: {
        nodes: [ana, lb, { ...ws1, status: 'active' }, { ...cache, status: 'active', badge: '1M writes/s, ~1 GB' }],
        links: [{ from: 'ana', to: 'lb' }, { from: 'lb', to: 'ws1' }, { from: 'ws1', to: 'cache' }],
        flows: [
          { path: ['ana', 'lb', 'ws1'], tone: 'request', label: '41.881, -87.623', count: 3, duration: 1.4 },
          { path: ['ws1', 'cache'], tone: 'data', label: 'SET loc:ana EX 600', count: 3, duration: 1, delay: 1.5 },
        ],
        caption: 'Overwrite on every update, expire when quiet',
      },
    },
    {
      title: 'Pub/sub',
      tag: 'concept',
      heading: 'A channel per user carries updates to friends',
      eli5: 'Every kid gets their own **radio channel**. Ben\'s counselor tunes in to the channels of all of Ben\'s friends, so when Ana calls out a new spot, Ben\'s counselor hears it right away.',
      body: [
        'Now the routing. Each online user has a **pub/sub channel** named after them, for example in Redis pub/sub (see the pub/sub lesson). When Ana connects, her WebSocket server subscribes to the channels of her online friends. Ben\'s server does the same for Ben, so it is subscribed to `loc:ana`.',
        'When Ana moves, WS server 1 writes the cache and publishes her point on `loc:ana`. Pub/sub delivers it to every server subscribed to that channel, about 20 on average. Ben\'s server receives it and decides whether Ben needs to hear about it.',
        'Pub/sub here keeps nothing. If a message is lost, the next update replaces it 10 seconds later, which is acceptable for this product. That is why a fire-and-forget bus fits better than a durable log on this path.',
      ],
      keyIdea: 'A per-user channel turns one location update into exactly the deliveries that need to happen, about 20 instead of hundreds of reads.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [ana, lb, { ...ws1, status: 'active' }, cache, { ...pubsub, status: 'active', badge: 'loc:ana, 20 subscribers' }, { ...ws2, status: 'active' }, ben],
        links: coreLinks,
        flows: [
          { path: ['ana', 'lb', 'ws1'], tone: 'request', label: 'location_update', duration: 1.3 },
          { path: ['ws1', 'cache'], tone: 'data', label: 'SET', duration: 0.9, delay: 1.4 },
          { path: ['ws1', 'pubsub'], tone: 'event', label: 'PUBLISH loc:ana', duration: 1, delay: 1.4 },
          { path: ['pubsub', 'ws2'], tone: 'event', label: 'to subscribers', count: 3, duration: 1, delay: 2.5 },
          { path: ['ws2', 'ben'], tone: 'event', label: 'friend_nearby', duration: 1, delay: 3.6 },
        ],
        caption: 'Publish once, deliver to each friend\'s server',
      },
    },
    {
      title: 'Distance check',
      tag: 'concept',
      heading: 'Compute the distance where the update lands',
      eli5: 'Before calling Ben, his counselor checks the camp map. Ana is close, so the counselor tells Ben. If Ana were across the lake, the counselor would stay **quiet** and Ben would not even know where she is.',
      body: [
        'Ben\'s WebSocket server already holds Ben\'s own latest location in memory. When Ana\'s point arrives on `loc:ana`, it computes the great-circle distance with the haversine formula. Within 5 km, it pushes `friend_nearby` to Ben. Outside, it drops the message, and if Ana was on Ben\'s list it sends `friend_left`.',
        'Doing this on the receiving side spreads the work. Each of the ~100 servers checks about 200,000 incoming updates per second, a few microseconds of math each. It also means far-away friends\' coordinates never reach the phone, which helps privacy and saves battery and data.',
        'Updates can arrive out of order after a reconnect, so the server keeps the last timestamp per friend and ignores older points.',
      ],
      keyIdea: 'Filter by distance on the subscriber\'s server: cheap math there, fewer messages to phones, and no coordinates leaked for distant friends.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [ana, lb, ws1, cache, pubsub, { ...ws2, status: 'active', badge: 'Ana is 600 m away' }, { ...ben, status: 'ok' }],
        links: coreLinks,
        flows: [
          { path: ['ws1', 'pubsub'], tone: 'event', label: 'loc:ana', duration: 1 },
          { path: ['pubsub', 'ws2'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['ws2', 'ben'], tone: 'response', label: 'friend_nearby 600 m', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Distance is checked on Ben\'s server before anything reaches Ben',
      },
      code: {
        language: 'python',
        title: 'Handling a friend\'s update on the subscriber\'s server',
        source: `RADIUS_M = 5_000

async def on_friend_update(conn, raw):
    """Runs on Ben's WebSocket server for each message on a friend's channel."""
    f = json.loads(raw)                                 # {id, lat, lng, ts}
    if conn.me is None or f["ts"] <= conn.last_ts.get(f["id"], 0):
        return                                          # no own fix yet, or stale
    conn.last_ts[f["id"]] = f["ts"]

    d = dist_m(conn.me.lat, conn.me.lng, f["lat"], f["lng"])   # haversine
    if d <= RADIUS_M:
        conn.visible.add(f["id"])
        await conn.send({"type": "friend_nearby", "id": f["id"],
                         "lat": f["lat"], "lng": f["lng"],
                         "distanceM": round(d), "ts": f["ts"]})
    elif f["id"] in conn.visible:
        conn.visible.discard(f["id"])
        await conn.send({"type": "friend_left", "id": f["id"]})
    # far-away friends stop here: their coordinates never reach the phone`,
        highlight: [6, 10, 11, 16, 19],
      },
      quiz: {
        question: 'Ana has 20 online friends. 3 are within 5 km. When Ana sends one update, how many pub/sub deliveries happen, and how many messages reach phones?',
        options: ['20 deliveries, 20 phone messages', '20 deliveries, about 3 phone messages', '3 deliveries, 3 phone messages', '1 delivery, 20 phone messages'],
        answer: 1,
        explain: 'Pub/sub delivers to every subscribed friend\'s server, so 20. Each of those servers checks the distance and only the 3 nearby friends get a push. A friend who just moved out of range also gets one friend_left message.',
      },
    },
    {
      title: 'WS servers',
      tag: 'case',
      heading: 'Case: a WebSocket server with 100,000 users dies',
      eli5: 'One counselor in the radio room faints. All their kids lose the signal at once and switch to other counselors. If they all switch in the same second, the **radio room** jams, so each kid waits a random moment first.',
      body: [
        'WS server 7 crashes. Its 100,000 phones see the socket close and reconnect through the load balancer to other servers. Each new connection loads about 20 friend locations from the cache and subscribes to about 20 channels, so a naive reconnect is a burst of **2M cache reads and 2M subscribes** in a second or two.',
        'Clients reconnect with **exponential backoff and jitter** (see the timeouts and retries lesson), spreading the herd over about 30 seconds. Friends of the affected users miss at most a few updates, then the next 10-second update catches them up.',
        'Planned work uses the same idea gently. To deploy, mark a server as **draining**: the load balancer sends it no new connections, and existing clients are told to reconnect in small batches. Autoscale on open connections and memory, since CPU stays low for idle sockets.',
      ],
      keyIdea: 'Stateful servers fail loudly: every client reconnects at once. Jitter, draining and headroom keep a crash from turning into a stampede.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~10 s for 1%' },
      scene: {
        nodes: [
          ana,
          { ...crowd, status: 'hot' },
          { ...lb, at: p(-6.5, 2.5) },
          { ...wsA, status: 'down', badge: 'crashed' },
          { ...wsB, status: 'active', badge: '+50K' },
          { ...wsC, status: 'active', badge: '+50K' },
          cacheR,
          pubsubR,
        ],
        links: [
          { from: 'ana', to: 'lb' },
          { from: 'crowd', to: 'lb' },
          { from: 'lb', to: 'wsA', style: 'faint' },
          { from: 'lb', to: 'wsB' },
          { from: 'lb', to: 'wsC' },
          { from: 'wsC', to: 'cacheR' },
          { from: 'wsC', to: 'pubsubR' },
        ],
        flows: [
          { path: ['lb', 'wsA'], tone: 'error', label: 'socket closed', duration: 1 },
          { path: ['crowd', 'lb', 'wsB'], tone: 'handshake', label: 'reconnect + jitter', count: 3, duration: 1.6, delay: 1.1 },
          { path: ['ana', 'lb', 'wsC'], tone: 'handshake', duration: 1.6, delay: 1.5 },
          { path: ['wsC', 'cacheR'], tone: 'request', label: 'MGET friends', duration: 1, delay: 3.2 },
          { path: ['wsC', 'pubsubR'], tone: 'request', label: 'SUBSCRIBE x20', duration: 1, delay: 3.2 },
        ],
        caption: 'The crashed server\'s users spread over the others, slowly',
      },
    },
    {
      title: 'Pub/sub scale',
      tag: 'concept',
      heading: 'Shard the channels with a hash ring',
      eli5: 'There are too many channels for one radio tower, so the camp builds a hundred towers. A **chart** on the wall says which tower carries each kid\'s channel, and every counselor reads the same chart.',
      body: [
        'The pub/sub tier pushes 20M messages per second. The limit is CPU, since a channel and its subscriber list take little memory. If we budget about 200,000 pushes per second per node to keep headroom, we need about **100 pub/sub nodes**. Measure this on your own hardware before trusting the number.',
        'Each channel lives on one node, picked by **consistent hashing** on the user id (see the consistent hashing lesson). The ring itself is stored in **service discovery**, and every WebSocket server watches it. To publish Ana\'s point, server 1 hashes `loc:ana`, finds node 15, and publishes there. Ben\'s server used the same ring to subscribe on node 15.',
        'When node 15 dies, discovery removes it from the ring. Only its channels move to the next node clockwise, and servers resubscribe them there. Updates on those channels are lost for a few seconds, which the next 10-second update repairs. Adding nodes also forces resubscribes, so resize at quiet hours and keep spare capacity.',
      ],
      keyIdea: 'Shard channels by user with a shared hash ring. A node loss moves only its channels and costs a few seconds of updates.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [
          ana,
          { ...wsL, status: 'active' },
          { ...disc, badge: 'loc:ana -> 15' },
          { ...ps1, status: 'dim' },
          { ...ps2, status: 'active', badge: 'loc:ana' },
          { ...ps3, status: 'dim' },
          { ...wsR, status: 'active' },
        ],
        links: [
          { from: 'ana', to: 'wsL' },
          { from: 'wsL', to: 'disc', style: 'dashed', label: 'watch ring' },
          { from: 'wsL', to: 'ps1', style: 'faint' },
          { from: 'wsL', to: 'ps2' },
          { from: 'wsL', to: 'ps3', style: 'faint' },
          { from: 'ps2', to: 'wsR' },
        ],
        flows: [
          { path: ['disc', 'wsL'], tone: 'data', label: 'ring version 812', duration: 1.2 },
          { path: ['ana', 'wsL'], tone: 'request', label: 'update', duration: 1, delay: 0.6 },
          { path: ['wsL', 'ps2'], tone: 'event', label: 'PUBLISH loc:ana', duration: 1.2, delay: 1.7 },
          { path: ['ps2', 'wsR'], tone: 'event', duration: 1.2, delay: 3 },
        ],
        caption: 'Every server uses the same ring to find a channel\'s node',
      },
      code: {
        language: 'python',
        title: 'Channel to node, and resubscribing when the ring changes',
        source: `import bisect, hashlib

def h(key):
    return int.from_bytes(hashlib.md5(key.encode()).digest()[:8], "big")

class ChannelRing:
    def __init__(self, nodes, vnodes=100):
        self.ring = sorted((h(f"{n}#{i}"), n) for n in nodes for i in range(vnodes))
        self.points = [pt for pt, _ in self.ring]

    def node_for(self, user_id):
        i = bisect.bisect(self.points, h(f"loc:{user_id}")) % len(self.ring)
        return self.ring[i][1]

def publish(ring, user_id, point):
    pubsub_client(ring.node_for(user_id)).publish(f"loc:{user_id}", point)

def on_ring_change(old, new, subscribed_ids):
    for uid in subscribed_ids:
        a, b = old.node_for(uid), new.node_for(uid)
        if a != b:                                  # only moved channels
            pubsub_client(a).unsubscribe(f"loc:{uid}")
            pubsub_client(b).subscribe(f"loc:{uid}")`,
        highlight: [12, 16, 21, 22, 23],
      },
    },
    {
      title: 'History',
      tag: 'concept',
      heading: 'Location history goes off the hot path',
      eli5: 'A helper copies every call into the camp **logbook** later, in big batches. The radio room never waits for the logbook, so the fast calls stay fast.',
      body: [
        'Product and safety teams want history: heat maps, how often friends meet, debugging reports. Each point is about 40 bytes, so 1M per second is about 40 MB/s, roughly **3.5 TB a day** before compression.',
        'WebSocket servers append each point to a **location stream** (see the message queues lesson) and move on. Consumers batch the stream into a write-heavy store keyed by `(user_id, ts)`, such as a wide-column database, and into the warehouse for analytics (see the data warehouse lesson). If the history path slows down, the stream absorbs the backlog and live updates do not notice.',
        'Most analytics does not need exact points. Round coordinates or aggregate them by area before they reach the warehouse, and set a retention limit on raw points.',
      ],
      keyIdea: 'Keep history asynchronous: publish to a stream and let batch consumers write it, so analytics can never slow down live updates.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [ana, lb, { ...ws1, status: 'active' }, { ...cache, status: 'dim' }, { ...pubsub, status: 'dim' }, { ...stream, status: 'active', badge: '40 MB/s' }, { ...history, status: 'active' }],
        links: [
          { from: 'ana', to: 'lb' },
          { from: 'lb', to: 'ws1' },
          { from: 'ws1', to: 'cache' },
          { from: 'ws1', to: 'pubsub' },
          { from: 'ws1', to: 'stream', style: 'dashed', label: 'async' },
          { from: 'stream', to: 'history' },
        ],
        flows: [
          { path: ['ana', 'lb', 'ws1'], tone: 'request', count: 3, duration: 1.3 },
          { path: ['ws1', 'stream'], tone: 'event', label: 'append point', count: 3, duration: 1.4, delay: 1.4 },
          { path: ['stream', 'history'], tone: 'data', label: 'batch of 10,000', duration: 1.4, delay: 3 },
        ],
        caption: 'History is written in batches, behind a stream',
      },
    },
    {
      title: 'Privacy',
      tag: 'tradeoff',
      heading: 'Location is the most sensitive data you hold',
      eli5: 'Each kid decides who can tune in to their channel, and can switch their **walkie-talkie** to silent any time. When they do, their spot is wiped off the whiteboard at once.',
      body: [
        'Sharing is **opt-in**, per friend where possible, and easy to pause. Pausing must act on the hot path at once: delete `loc:{user}` from the cache, publish a `friend_left` so friends\' lists clear, and stop publishing. Unfriending unsubscribes both sides in the same request. Waiting for the TTL is not acceptable here.',
        'Send as little as possible. The distance check already keeps far friends\' coordinates off the phone. Encrypt every hop (TLS on the socket and inside the data center), keep raw history for a short, stated time, honor deletion requests across the stream, the history store and the warehouse, and coarsen points used for analytics.',
        'The tradeoff is product value against risk. Finer points and longer history make features better and make a breach far worse. Location rules also differ by country, so check them with your legal team before choosing retention.',
      ],
      keyIdea: 'Make sharing opt-in and instantly revocable, send the minimum to each phone, and keep raw history short.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...ana, badge: 'pause sharing' }, lb, { ...ws1, status: 'active' }, { ...cache, status: 'active', badge: 'DEL loc:ana' }, pubsub, ws2, { ...ben, badge: 'Ana hidden' }, api, userDb],
        links: [...coreLinks, { from: 'lb', to: 'api' }, { from: 'api', to: 'userDb' }],
        flows: [
          { path: ['ana', 'lb', 'api'], tone: 'request', label: 'PUT sharing=off', duration: 1.4 },
          { path: ['api', 'userDb'], tone: 'data', duration: 0.9, delay: 1.5 },
          { path: ['ws1', 'cache'], tone: 'event', label: 'DEL', duration: 0.9, delay: 1.5 },
          { path: ['ws1', 'pubsub', 'ws2', 'ben'], tone: 'event', label: 'friend_left', duration: 1.8, delay: 2.5 },
        ],
        caption: 'Pausing clears the cache and tells friends at once',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Route each update to the few people who care',
      eli5: 'Kids carry **walkie-talkies**, the whiteboard shows only the latest spot, each kid has a channel, counselors check the map before passing news on, and every kid controls who can listen.',
      body: [
        'Polling a location table would cost about 100M reads per second and 20 seconds of delay. Instead each phone holds a **WebSocket** to a stateful server tier (about 100 servers for 10M users). Updates overwrite a sharded **location cache** with a 10-minute TTL and are published on a **per-user channel**, so 1M updates per second become 20M targeted deliveries.',
        'The receiving server checks the **distance** and pushes only friends within 5 km. Channels are sharded by a hash ring kept in service discovery, so a node loss moves only its channels. Clients reconnect with jitter after a server crash. History flows through a stream to batch storage, and privacy controls act on the hot path at once.',
      ],
      keyIdea: 'For fast-moving data that matters to few readers, push it through per-user channels and filter on the receiving server.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [ana, lb, ws1, cache, pubsub, ws2, ben, stream, history],
        links: [...coreLinks, { from: 'ws1', to: 'stream', style: 'dashed' }, { from: 'stream', to: 'history' }],
        flows: [
          { path: ['ana', 'lb', 'ws1', 'pubsub', 'ws2', 'ben'], tone: 'event', count: 3, duration: 2.6 },
          { path: ['ws1', 'cache'], tone: 'data', duration: 1, delay: 1 },
          { path: ['ws1', 'stream', 'history'], tone: 'data', duration: 1.8, delay: 1.2 },
        ],
      },
      quiz: {
        question: 'A pub/sub node that carries 1% of channels crashes. What is the right expectation?',
        options: [
          'All 10M users must reconnect their WebSockets',
          'Location cache entries for those users are lost for 10 minutes',
          'Those channels move to the next node on the ring, servers resubscribe, and a few seconds of updates are lost',
          'Updates on those channels are replayed from the pub/sub log once the node returns',
        ],
        answer: 2,
        explain: 'Consistent hashing moves only the dead node\'s channels. WebSocket servers watch the ring and resubscribe. Redis-style pub/sub keeps no log, so the missed updates are gone, and the next update 10 seconds later replaces them.',
      },
    },
  ],
};
