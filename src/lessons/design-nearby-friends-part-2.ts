import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-4.5, -1.5), label: 'Ana', sub: 'sends every 10 s' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(4.5, -1.5), label: 'Ben', sub: 'friend, 600 m away' };
const crowd: SceneNode = { id: 'crowd', kind: 'phone', at: at(-4.5, 0), label: 'other phones', sub: '100K on server 7' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: at(0, -1.5), label: 'load balancer', sub: 'long-lived conns' };
const wsA: SceneNode = { id: 'wsA', kind: 'server', at: at(0, -3.5), label: 'WS server 7' };
const wsB: SceneNode = { id: 'wsB', kind: 'server', at: at(4.5, 0.5), label: 'WS server 8' };
const wsL: SceneNode = { id: 'wsL', kind: 'server', at: at(-4.5, 0), label: 'WS server 1', sub: 'publishes for Ana' };
const wsR: SceneNode = { id: 'wsR', kind: 'server', at: at(4.5, 0), label: 'WS server 2', sub: 'subscribed for Ben' };
const disc: SceneNode = { id: 'disc', kind: 'block', at: at(0, -4), label: 'service discovery', sub: 'hash ring: 100 nodes', icon: 'Route', tint: 'teal' };
const ps14: SceneNode = { id: 'ps14', kind: 'block', at: at(0, 4), label: 'pub/sub 14', icon: 'Share2', tint: 'violet' };
const ps15: SceneNode = { id: 'ps15', kind: 'block', at: at(4.5, 0), label: 'pub/sub 15', icon: 'Share2', tint: 'violet' };
const ps16: SceneNode = { id: 'ps16', kind: 'block', at: at(4.5, 4), label: 'pub/sub 16', icon: 'Share2', tint: 'violet' };
const ws1: SceneNode = { id: 'ws1', kind: 'server', at: at(0, -1.5), label: 'WS server 1', sub: 'holds Ana' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(4.5, -1.5), label: 'location cache', sub: 'TTL 10 min' };
const stream: SceneNode = { id: 'stream', kind: 'block', at: at(0, -1.5), label: 'location stream', sub: 'Kafka-style log', icon: 'Layers', tint: 'amber' };
const history: SceneNode = { id: 'history', kind: 'warehouse', at: at(4.5, -1.5), label: 'history store', sub: '~3.5 TB/day' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3.5), label: 'API servers', sub: 'friends, settings', icon: 'Network', tint: 'blue' };
const userDb: SceneNode = { id: 'userDb', kind: 'db', at: at(4.5, -3.5), label: 'user DB', sub: 'sharing flags' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designNearbyFriendsPart2: Lesson = {
  id: 'design-nearby-friends-part-2',
  title: 'Design nearby friends (part 2)',
  tagline: 'Keep the stateful tiers alive at scale, add strangers nearby, store history, and protect the most sensitive data you hold.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Surviving the loss of a WebSocket server with jittered reconnects and draining',
    'Sizing and sharding the pub/sub tier with a hash ring in service discovery',
    'Handling users with huge friend lists and finding nearby strangers with geohash channels',
    'Saving battery with smarter update rules and heartbeats',
    'Keeping location history asynchronous, and the privacy rules around it',
  ],
  metrics: [
    { key: 'online', label: 'Online users', icon: 'Users' },
    { key: 'ups', label: 'Location updates/s', icon: 'Zap' },
    { key: 'fan', label: 'Fan-out/s', icon: 'Share2' },
    { key: 'lag', label: 'Friend sees move', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Server crash',
      tag: 'problem',
      heading: 'Case: a WebSocket server with 100,000 users dies',
      eli5: 'One counselor in the radio room faints. All their kids lose the signal at once and run to other counselors in the same second.',
      body: [
        'WS server 7 crashes. Its 100,000 phones see the socket close and reconnect through the load balancer to other servers. Each new connection reads the friend list, fetches friend locations in one batch and subscribes to about 300 friend channels.',
        'A naive reconnect is a burst of 100,000 batched cache reads (about 30M entries) and **30M subscribes** in a second or two. The survivors and the pub/sub tier drown.',
      ],
      keyIdea: 'Stateful servers fail loudly: every client reconnects at once.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: 'stalled for 1%' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [{ ...crowd, status: 'hot', badge: '100K reconnecting' }, { ...wsA, status: 'down', badge: 'crashed' }, { ...wsB, status: 'hot', load: 98, badge: '+30K in 1 s' }],
        links: [link('crowd', 'wsA', { style: 'faint' }), link('crowd', 'wsB', { label: 'all at once', labelTone: 'warn' })],
        flows: [
          { path: ['crowd', 'wsA'], tone: 'error', label: 'socket closed', duration: 1.2 },
          { path: ['crowd', 'wsB'], tone: 'handshake', label: 'reconnect now', count: 5, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Reconnect storm',
          icon: 'Activity',
          rows: [
            { text: 'Phones to move', value: '100K' },
            { text: 'Batched cache reads', value: '100K (~30M entries)', tone: 'warn' },
            { text: 'Subscribes (x ~300)', value: '~30M', tone: 'bad' },
            { text: 'Time window', value: '1 to 2 s', tone: 'bad' },
          ],
        },
        caption: 'A crash turns into a stampede',
      },
    },
    {
      title: 'Jittered retries',
      tag: 'concept',
      heading: 'Spread the herd with backoff and jitter',
      eli5: 'Each kid whose radio went quiet waits a random few seconds before tuning in to a new counselor. Nobody pushes at the same moment, so the radio room stays calm.',
      body: [
        'Clients reconnect with **exponential backoff and jitter** (see the timeouts and retries lesson): wait a random time in a growing window, then try again.',
        'The herd spreads over about 30 seconds. Friends of the affected users miss at most a few updates, then the next 10-second update catches them up.',
      ],
      keyIdea: 'Random waits turn a spike into a gentle stream.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~10 s for 1%' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [{ ...crowd, status: 'active', chips: ['wait random 0-30 s'] }, { ...lb, at: at(0, -1.5) }, { ...wsB, at: at(4.5, -1.5), status: 'active', load: 55, badge: '+3K/s' }],
        links: [link('crowd', 'lb'), link('lb', 'wsB')],
        flows: [{ path: ['crowd', 'lb', 'wsB'], tone: 'handshake', label: 'reconnect + jitter', count: 2, duration: 2.4 }],
        panel: {
          title: 'Backoff with jitter',
          icon: 'Timer',
          code: 'wait = random(0, min(cap, base * 2**n))\n# base 1 s, cap 30 s\nn = 0: 0-1 s\nn = 1: 0-2 s\nn = 4: 0-16 s',
          footer: { text: '100K reconnects over ~30 s, about 3K/s', tone: 'good' },
        },
        caption: 'The crowd trickles in',
      },
    },
    {
      title: 'Draining',
      tag: 'concept',
      heading: 'Deploy and autoscale without causing a crash',
      eli5: 'When a counselor goes on a planned break, they tell kids to switch in small groups. They send no new kids to the radio, and the camp adds counselors when the line grows.',
      body: [
        'Planned work uses the same idea gently. To deploy, mark a server as **draining**: the load balancer sends it no new connections, and existing clients are told to reconnect in small batches.',
        'Autoscale on open connections and memory, since CPU stays low for idle sockets. Keep spare capacity so one failure never overloads the rest.',
      ],
      keyIdea: 'Drain in small batches and scale on sockets and memory, not CPU.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [{ ...lb, at: at(-4.5, 0), badge: 'no new conns' }, { ...wsA, status: 'dim', badge: 'draining', chips: ['reconnect in 1K batches'] }, { ...wsB, status: 'active', load: 58 }],
        links: [link('lb', 'wsA', { style: 'faint' }), link('lb', 'wsB')],
        flows: [{ path: ['lb', 'wsB'], tone: 'handshake', label: 'new sockets', count: 3, duration: 1.6 }],
        panel: {
          title: 'Rolling deploy',
          icon: 'Repeat',
          rows: [
            { text: 'Mark server draining', value: 'LB skips it' },
            { text: 'Tell clients to move', value: '1K per batch' },
            { text: 'Scale on', value: 'sockets, memory' },
            { text: 'Spare capacity', value: '1 server in N', tone: 'good' },
          ],
        },
        caption: 'Move users a batch at a time',
      },
    },
    {
      title: 'Pub/sub sizing',
      tag: 'concept',
      heading: 'About 100 pub/sub nodes for 20M messages per second',
      eli5: 'One radio tower cannot carry every channel in the camp. A hundred towers share them, and each tower stays far below its limit.',
      body: [
        'The pub/sub tier pushes 20M messages per second. The limit is CPU. A budget of about 200,000 pushes per second per node keeps headroom, so we need about **100 nodes**. Measure this on your own hardware before trusting the number.',
        'Memory is modest: about 3 billion subscriptions (10M online users times ~300 friends) at tens of bytes each is around 150 GB across 100 nodes.',
      ],
      keyIdea: 'Size pub/sub by pushes per second. Memory for idle subscriptions is small.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...wsL, status: 'active', chips: ['PUBLISH'] }, { ...ps15, at: at(0, -1.5), status: 'hot', load: 95, label: 'one pub/sub node', badge: '20M/s: too much' }, { ...wsR, at: at(4.5, -1.5), status: 'active' }],
        links: [link('wsL', 'ps15'), link('ps15', 'wsR')],
        flows: [{ path: ['wsL', 'ps15', 'wsR'], tone: 'event', label: 'PUBLISH', count: 4, duration: 2 }],
        panel: {
          title: 'Sizing the pub/sub tier',
          icon: 'Scale',
          rows: [
            { text: 'Deliveries', value: '20M/s' },
            { text: 'Per node, with headroom', value: '200K/s' },
            { text: 'Nodes', value: '~100', tone: 'good' },
            { text: 'Subscriptions', value: '~3 billion' },
          ],
          footer: { text: 'Benchmark before trusting these', tone: 'muted' },
        },
        caption: 'Spread the channels over 100 nodes',
      },
    },
    {
      title: 'Hash ring',
      tag: 'concept',
      heading: 'Each channel lives on one node, picked by a hash ring',
      eli5: 'A **chart** on the wall says which tower carries each kid\'s channel, and every counselor reads the same chart. So Ana\'s counselor and Ben\'s counselor always pick the same tower.',
      body: [
        'Each channel lives on one node, picked by **consistent hashing** on the user id (see the consistent hashing lesson). The ring is stored in **service discovery**, and every WebSocket server watches it.',
        'To publish Ana\'s point, server 1 hashes `loc:ana`, finds node 15, and publishes there. Ben\'s server used the same ring to subscribe on node 15.',
      ],
      keyIdea: 'A shared ring means publisher and subscribers meet on the same node with no lookup traffic.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...wsL, status: 'active' }, { ...disc, badge: 'loc:ana -> 15' }, { ...ps15, status: 'active', badge: 'loc:ana' }, { ...ps14, status: 'dim' }],
        links: [link('disc', 'wsL', { style: 'dashed', label: 'watch ring' }), link('wsL', 'ps15'), link('wsL', 'ps14', { style: 'faint' })],
        flows: [
          { path: ['disc', 'wsL'], tone: 'data', label: 'ring version 812', duration: 1.3 },
          { path: ['wsL', 'ps15'], tone: 'event', label: 'PUBLISH loc:ana', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Same ring everywhere',
          icon: 'Hash',
          rows: [
            { text: 'hash(loc:ana)', value: 'node 15' },
            { text: 'Ring stored in', value: 'service discovery' },
            { text: 'Every WS server', value: 'watches the ring' },
          ],
          footer: { text: 'Publishers and subscribers agree', tone: 'good' },
        },
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
      title: 'Node failure',
      tag: 'case',
      heading: 'Case: a pub/sub node dies',
      eli5: 'One radio tower goes dark. The chart is updated, and its channels move to the next tower. Everyone re-tunes. A few shouts are missed, and the next ones come through.',
      body: [
        'When node 15 dies, service discovery removes it from the ring. Only its channels move to the next node clockwise, about 1% of the total, and WebSocket servers resubscribe them there.',
        'Updates on those channels are lost for a few seconds. The next 10-second update repairs it, because pub/sub keeps no log and the cache still holds the latest point.',
      ],
      keyIdea: 'Consistent hashing moves only the dead node\'s channels. Frequent updates heal the gap.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: 'gap of a few s for 1%' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [{ ...wsL, status: 'active', chips: ['resubscribe loc:ana'] }, { ...disc, badge: 'ring v813' }, { ...ps15, status: 'down', badge: 'node 15 down' }, { ...ps16, at: at(0, 4), status: 'active', badge: '+1% channels' }],
        links: [link('disc', 'wsL', { style: 'dashed', label: 'ring changed' }), link('wsL', 'ps15', { style: 'faint' }), link('wsL', 'ps16')],
        flows: [
          { path: ['disc', 'wsL'], tone: 'data', label: 'node 15 removed', duration: 1.3 },
          { path: ['wsL', 'ps16'], tone: 'request', label: 'SUBSCRIBE loc:ana', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What a node loss costs',
          icon: 'Shield',
          rows: [
            { text: 'Channels that move', value: '~1%' },
            { text: 'Resubscribe', value: 'WS servers do it' },
            { text: 'Updates lost', value: 'a few seconds', tone: 'warn' },
            { text: 'Repaired by', value: 'next update', tone: 'good' },
          ],
        },
        caption: 'Only the dead node\'s channels move',
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
    {
      title: 'Resizing',
      tag: 'tradeoff',
      heading: 'Resizing the tier is risky, so do it quietly',
      eli5: 'Adding a new tower also changes the chart, and some channels have to move to it. Everyone re-tunes at once, so the camp does it at night when few kids are on the radio.',
      body: [
        'Adding or removing nodes also changes the ring and forces resubscribes. Unlike a crash, the move is planned, so schedule it at quiet hours and keep spare capacity.',
        'Move in small steps and watch resubscribe rate and delivery lag. Subscriptions are stateful, which is why this tier is operated with more care than a stateless one.',
      ],
      keyIdea: 'Pub/sub subscriptions are state, so change the ring at quiet hours and in small steps.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...wsL, status: 'active' }, { ...disc, badge: 'ring v814' }, { ...ps16, at: at(4.5, 0), status: 'active', badge: 'new node', chips: ['moving ~1% of channels'] }],
        links: [link('disc', 'wsL', { style: 'dashed', label: 'node added' }), link('wsL', 'ps16', { label: 'resubscribe' })],
        flows: [
          { path: ['disc', 'wsL'], tone: 'data', label: 'ring v814', duration: 1.3 },
          { path: ['wsL', 'ps16'], tone: 'request', label: 'SUBSCRIBE moved channels', count: 2, duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Resize checklist',
          icon: 'List',
          rows: [
            { text: 'When', value: 'quiet hours' },
            { text: 'Spare capacity', value: 'always kept' },
            { text: 'Step size', value: 'a few nodes' },
            { text: 'Watch', value: 'resubscribe rate, lag' },
          ],
        },
        caption: 'Planned change, still a resubscribe wave',
      },
    },
    {
      title: 'Big friend lists',
      tag: 'tradeoff',
      heading: 'A user with huge friend lists multiplies the work',
      eli5: 'A kid with ten thousand friends would make every update ring ten thousand bells. So the camp caps the friend list and only listens to the ones who are close.',
      body: [
        'The fan-out per update equals the online friends who subscribe. Average is about 20, but a user with 5,000 friends, about 500 of them online, produces 500 deliveries per update and one hot channel.',
        'Cap the friend list, as most social products do, and show only the closest few friends on screen. A cap bounds subscriptions per connection and deliveries per update, and keeps any one channel from growing without limit.',
      ],
      keyIdea: 'Cap friend counts so the average-case design survives the worst-case user.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...ana, label: 'Cy', sub: '5,000 friends', status: 'hot', badge: '500 online friends' }, { ...ps15, at: at(0, -1.5), status: 'hot', load: 88, label: 'hot channel', chips: ['loc:cy'] }, { ...wsR, at: at(4.5, -1.5), badge: 'x 500 servers' }],
        links: [link('ana', 'ps15'), link('ps15', 'wsR', { label: '500 deliveries', labelTone: 'warn' })],
        flows: [
          { path: ['ana', 'ps15'], tone: 'event', label: '1 update', duration: 1.2 },
          { path: ['ps15', 'wsR'], tone: 'event', label: '500 deliveries', count: 5, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Why a cap helps',
          icon: 'Users',
          rows: [
            { text: 'Average user', value: '~20 deliveries' },
            { text: 'Cy, no cap', value: '500+ deliveries', tone: 'bad' },
            { text: 'Friend cap', value: 'bounds both', tone: 'good' },
            { text: 'Displayed list', value: 'closest few' },
          ],
        },
        caption: 'The average user hides the heavy one',
      },
    },
    {
      title: 'Nearby strangers',
      tag: 'concept',
      heading: 'Extension: show nearby people who are not friends',
      eli5: 'The camp field is drawn as a grid of squares. Each square has its own radio channel. A kid listens to the square they stand in and the squares around it.',
      body: [
        'Add channels per map cell using a **geohash**, a string naming a rectangular cell (5 characters is about 5 km). A user publishes to their own cell and subscribes to it plus 8 neighbors. Crossing a border means a resubscribe.',
        'Crowded cells are hot channels. Longer geohashes split them but shrink the cell, so subscribe to a wider ring to keep 5 km, or cap the results.',
        'Stranger discovery is a separate opt-in, never the default, and shows a coarse position only, since it exposes location to people who are not friends.',
      ],
      keyIdea: 'Geohash channels turn nearby discovery into subscribing to a handful of cells.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...ana, chips: ['cell 9q8yy'] }, { ...ps15, at: at(0, -1.5), label: 'cell channel', status: 'active', badge: 'geo:9q8yy' }, { ...ben, status: 'active', label: 'Stranger', sub: 'also in 9q8yy', chips: ['geo:9q8yy + 8 neighbors'] }],
        links: [link('ana', 'ps15'), link('ps15', 'ben')],
        flows: [
          { path: ['ana', 'ps15'], tone: 'event', label: 'publish to my cell', duration: 1.4 },
          { path: ['ps15', 'ben'], tone: 'event', label: 'nearby person', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Geohash channels',
          icon: 'Globe',
          rows: [
            { text: 'Cell name', value: '9q8yy (~5 km)' },
            { text: 'Publish to', value: 'own cell' },
            { text: 'Subscribe to', value: 'own cell + 8' },
            { text: 'Border crossed', value: 'resubscribe' },
            { text: 'Crowded cell', value: 'longer geohash', tone: 'warn' },
          ],
        },
        caption: 'Channels per cell, not per user',
      },
    },
    {
      title: 'Battery',
      tag: 'tradeoff',
      heading: 'Send fewer updates, and keep the socket alive',
      eli5: 'A kid standing still does not need to shout every ten seconds. They whisper "still here" once a minute, and shout again when they walk.',
      body: [
        'Sending a point every 10 seconds drains the battery. Send only when the phone moved more than about 50 meters, and send a small keep-alive at least once a minute so the 10-minute TTL never expires an active user.',
        'Add a WebSocket ping every 30 seconds so dead connections are detected quickly. Trade freshness for battery: the product picks the numbers.',
      ],
      keyIdea: 'Update on movement, heartbeat on silence, and let the product pick the freshness.',
      metrics: { online: '10M', ups: '~300K/s', fan: '~6M/s', lag: '~1 s moving' },
      metricTones: { ups: 'good', fan: 'good' },
      scene: {
        nodes: [{ ...ana, status: 'active', chips: ['moved 80 m', 'still here, 60 s'] }, { ...ws1, status: 'active' }, { ...cache, status: 'active', badge: 'TTL stays fresh' }],
        links: [link('ana', 'ws1', { label: 'only on movement', arrow: 'both' }), link('ws1', 'cache')],
        flows: [
          { path: ['ana', 'ws1'], tone: 'request', label: 'moved > 50 m', duration: 1.4 },
          { path: ['ws1', 'cache'], tone: 'data', label: 'SET EX 600', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Update rules',
          icon: 'Signal',
          rows: [
            { text: 'Moved > 50 m', value: 'send now' },
            { text: 'Standing still', value: 'keep-alive per 60 s' },
            { text: 'Socket ping', value: 'every 30 s' },
            { text: 'Cache TTL', value: '10 min', tone: 'good' },
          ],
          footer: { text: 'Fewer updates, same product', tone: 'good' },
        },
        caption: 'Most phones stand still most of the time',
      },
    },
    {
      title: 'History',
      tag: 'concept',
      heading: 'Location history goes off the hot path',
      eli5: 'A helper copies every call into the camp **logbook** later, in big batches. The radio room never waits for the logbook, so the fast calls stay fast.',
      body: [
        'Product and safety teams want history: heat maps, how often friends meet, debugging reports. Each point is about 40 bytes, so 1M per second is about 40 MB/s, roughly **3.5 TB a day** before compression.',
        'WebSocket servers append each point to a **location stream** (see the message queues lesson) and move on. Consumers batch the stream into a write-heavy store keyed by `(user_id, ts)`, such as a wide-column database. If that store slows down, the stream absorbs the backlog and live updates do not notice.',
      ],
      keyIdea: 'Keep history asynchronous: publish to a stream and let batch consumers write it, so analytics can never slow down live updates.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [{ ...ws1, at: at(-4.5, -1.5), status: 'active' }, { ...stream, status: 'active', badge: '40 MB/s' }, { ...history, status: 'active', chips: ['batch of 10,000'] }],
        links: [link('ws1', 'stream', { style: 'dashed', label: 'async' }), link('stream', 'history')],
        flows: [
          { path: ['ws1', 'stream'], tone: 'event', label: 'append point', count: 3, duration: 1.4 },
          { path: ['stream', 'history'], tone: 'data', label: 'batch write', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'History volume',
          icon: 'HardDrive',
          rows: [
            { text: 'Point size', value: '~40 B' },
            { text: 'Rate (1M x 40 B)', value: '40 MB/s' },
            { text: 'Per day', value: '~3.5 TB', tone: 'warn' },
            { text: 'Key', value: '(user_id, ts)' },
          ],
          footer: { text: 'A slow store backs up the stream, not the app', tone: 'good' },
        },
        caption: 'History is written in batches, behind a stream',
      },
    },
    {
      title: 'Analytics',
      tag: 'concept',
      heading: 'Coarsen before the warehouse, and set retention',
      eli5: 'The logbook only needs to know which part of the field a kid was in, not the exact blade of grass. And old pages get thrown away after a set time.',
      body: [
        'The stream also feeds the warehouse for analytics (see the data warehouse lesson), through a rounding job.',
        'Most analytics does not need exact points. Round coordinates or aggregate them by area before they reach the warehouse, and set a retention limit on raw points.',
      ],
      keyIdea: 'Analytics needs areas, not exact points. Coarsen early and expire the raw data.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...stream, at: at(-4.5, -1.5), status: 'active', badge: 'raw: 30 days' }, { id: 'agg', kind: 'block', at: at(0, -1.5), label: 'rounding job', sub: 'area, not point', icon: 'Layers', tint: 'amber' }, { id: 'wh', kind: 'warehouse', at: at(4.5, -1.5), label: 'warehouse', sub: 'heat maps', status: 'ok' }],
        links: [link('stream', 'agg'), link('agg', 'wh', { label: 'coarse cells' })],
        flows: [
          { path: ['stream', 'agg'], tone: 'data', label: '41.88123, -87.62345', duration: 1.4 },
          { path: ['agg', 'wh'], tone: 'data', label: 'cell 9q8yy', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What goes where',
          icon: 'Table',
          rows: [
            { text: 'Raw points', value: 'short retention' },
            { text: 'Warehouse', value: 'rounded cells' },
            { text: 'Heat maps', value: 'per area, per hour' },
            { text: 'Deletion request', value: 'purge every store', tone: 'warn' },
          ],
        },
        caption: 'Exact points stay short-lived',
      },
    },
    {
      title: 'Pause sharing',
      tag: 'tradeoff',
      heading: 'Pausing sharing must act at once',
      eli5: 'A kid can switch their **walkie-talkie** to silent any time. When they do, their spot is wiped off the whiteboard right away and friends are told they left.',
      body: [
        'Sharing is **opt-in**, per friend where possible, and easy to pause. Pausing acts on the hot path at once: delete `loc:{user}` from the cache, publish a `friend_left` so friends\' lists clear, and stop publishing.',
        'Unfriending unsubscribes both sides in the same request. Waiting for the TTL is not acceptable here.',
      ],
      keyIdea: 'Make sharing opt-in and instantly revocable. Never wait for the TTL.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...ana, at: at(-4.5, 0), chips: ['PUT sharing=off'] }, { ...api, status: 'active' }, { ...userDb, status: 'active', badge: 'sharing = off' }, { ...ws1, at: at(0, 3.5), status: 'active', chips: ['friend_left'] }, { ...cache, at: at(4.5, 3.5), status: 'active', badge: 'DEL loc:ana' }],
        links: [link('ana', 'api'), link('api', 'userDb'), link('api', 'ws1'), link('ws1', 'cache')],
        flows: [
          { path: ['ana', 'api', 'userDb'], tone: 'request', label: 'PUT sharing=off', duration: 1.8 },
          { path: ['api', 'ws1', 'cache'], tone: 'event', label: 'DEL + friend_left', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Pause, in order',
          icon: 'Shield',
          rows: [
            { text: '1. Save the setting', value: 'user DB' },
            { text: '2. Delete the point', value: 'cache DEL' },
            { text: '3. Tell friends', value: 'friend_left' },
            { text: '4. Stop publishing', value: 'at once', tone: 'good' },
          ],
        },
        caption: 'Pausing clears the cache and tells friends at once',
      },
    },
    {
      title: 'Privacy',
      tag: 'tradeoff',
      heading: 'Location is the most sensitive data you hold',
      eli5: 'Each kid decides who can tune in to their channel. The counselors tell friends the least they can, and the logbook is shredded after a set time.',
      body: [
        'Send as little as possible. The distance check already keeps far friends\' coordinates off the phone. Encrypt every hop (TLS on the socket and inside the data center), keep raw history for a short, stated time, and honor deletion requests across the stream, the history store and the warehouse.',
        'The tradeoff is product value against risk. Finer points and longer history make features better and make a breach far worse. Location rules also differ by country, so check them with your legal team before choosing retention.',
      ],
      keyIdea: 'Send the minimum to each phone, encrypt everything and keep raw history short.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      scene: {
        nodes: [{ ...ana, at: at(-4.5, -1.5), chips: [{ text: 'TLS', tone: 'good' }] }, { ...ws1, status: 'active', badge: 'no far coordinates' }, { ...history, status: 'active', badge: 'short retention', chips: [{ text: 'delete on request', tone: 'good' }] }],
        links: [link('ana', 'ws1', { label: 'TLS' }), link('ws1', 'history', { label: 'TLS', style: 'dashed' })],
        flows: [
          { path: ['ana', 'ws1'], tone: 'request', label: 'encrypted', duration: 1.4 },
          { path: ['ws1', 'history'], tone: 'data', label: 'encrypted', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Privacy checklist',
          icon: 'KeyRound',
          rows: [
            { text: 'Sharing', value: 'opt-in, revocable' },
            { text: 'To each phone', value: 'friends in range only' },
            { text: 'In transit', value: 'TLS everywhere' },
            { text: 'Raw history', value: 'short, stated time' },
            { text: 'Deletion', value: 'every store' },
          ],
          footer: { text: 'Rules differ by country: ask legal', tone: 'warn' },
        },
        caption: 'Less data held means less data leaked',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Scale, strangers, history and privacy',
      eli5: 'Counselors wait a random moment before re-tuning after a crash, towers share channels by a wall chart, a field grid finds nearby strangers, and every kid controls who can listen.',
      body: [
        'Stateful WebSocket servers fail loudly, so clients reconnect with **jitter** and deploys use **draining**. Pub/sub is sharded by a **hash ring** in service discovery, so a node loss moves only its channels and costs a few seconds of updates.',
        'Friend caps bound the worst-case user, **geohash channels** add strangers, and update rules save battery. History flows through a stream to batch storage, and privacy controls act on the hot path at once.',
      ],
      keyIdea: 'Scale the stateful tiers carefully, bound the worst case, keep history off the hot path and make privacy instant.',
      metrics: { online: '10M', ups: '1M/s', fan: '20M/s', lag: '~1 s' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [{ ...ana, at: at(-4.5, 0) }, { ...ws1, at: at(-1.5, -3.5) }, { ...ps15, at: at(1.5, 0), label: 'pub/sub ring' }, { ...ben, at: at(4.5, -3.5) }],
        links: [link('ana', 'ws1'), link('ws1', 'ps15'), link('ps15', 'ben')],
        flows: [{ path: ['ana', 'ws1', 'ps15', 'ben'], tone: 'event', count: 3, duration: 3 }],
        panel: {
          title: 'The full design',
          icon: 'Workflow',
          rows: [
            { text: 'Socket tier', value: '~100, jittered' },
            { text: 'Pub/sub', value: '~100, hash ring' },
            { text: 'Strangers', value: 'geohash cells' },
            { text: 'History', value: 'async stream' },
            { text: 'Privacy', value: 'instant, minimal' },
          ],
        },
        caption: 'The complete nearby friends design',
      },
      quiz: {
        question: 'WS server 7 crashes and its 100,000 phones all reconnect. What limits the damage best?',
        options: [
          'Reconnecting with no delay so users see the shortest outage',
          'Exponential backoff with jitter on the clients, plus spare capacity on the other servers',
          'Moving every user to the pub/sub tier',
          'Storing each socket in the database so it survives',
        ],
        answer: 1,
        explain: 'Random waits spread the reconnects over about 30 seconds. Spare capacity absorbs the extra sockets, and the next 10-second update repairs any missed moves.',
      },
    },
  ],
};
