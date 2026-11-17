import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const app: SceneNode = { id: 'app', kind: 'phone', at: at(-5, -3.2), label: 'Slack app', sub: 'desktop + mobile' };
const gw: SceneNode = { id: 'gw', kind: 'block', at: at(-1.6, -3.2), label: 'Gateway', sub: 'holds WebSockets', icon: 'Plug', tint: 'blue' };
const bus: SceneNode = { id: 'bus', kind: 'block', at: at(1.9, -3.2), label: 'Message bus', sub: 'topic per channel', icon: 'Rss', tint: 'violet' };
const api: SceneNode = { id: 'api', kind: 'block', size: 0.8, at: at(-3.6, 3.4), label: 'Message API', icon: 'Inbox', tint: 'green' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(0, 3.4), label: 'MySQL', sub: 'one shard per team' };
const search: SceneNode = { id: 'search', kind: 'search', at: at(3.8, 3.4), label: 'Search', sub: 'per-team index' };
const presence: SceneNode = { id: 'presence', kind: 'block', size: 0.8, at: at(3.4, 0.2), label: 'Presence', icon: 'Activity', tint: 'green' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(5.6, 3.4), label: 'Redis', sub: 'last_seen' };
const notif: SceneNode = { id: 'notif', kind: 'block', size: 0.8, at: at(-1.6, 0.4), label: 'Notifier', icon: 'Mail', tint: 'amber' };

export const designSlack: Lesson = {
  id: 'design-slack',
  title: 'Design Slack',
  tagline: 'Real-time team messaging for millions of connections: the fan-out problem, presence, search and shared channels.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Requirements and scale numbers for a workplace chat product',
    'The fan-out problem and the hot path versus cold path split',
    'Presence at 12M connections without a heartbeat flood',
    'Per-team sharding, search through change data capture, and the cost to Enterprise Grid and Slack Connect',
    'Surviving a gateway failure and a reconnect storm',
  ],
  metrics: [
    { key: 'conns', label: 'Connections', icon: 'Plug' },
    { key: 'rate', label: 'Messages', icon: 'Activity' },
    { key: 'push', label: 'Pushes per post', icon: 'Zap' },
    { key: 'lat', label: 'Delivery', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A workplace chat that every employee keeps open all day',
      eli5: 'A giant school where every class has its own room, and kids pass notes all day. The **Slack app** is the kid with a note, and every note must reach the right room fast.',
      body: [
        'Users post in **channels**, **DMs** and **threads**, add reactions, share files and join huddles. They see who is online, scroll back through history that goes back years, and search it. Notifications reach desktop, phone and email.',
        'Two enterprise needs add pressure: **Enterprise Grid** (one customer, many workspaces) and **Slack Connect** (a channel shared by two companies).',
      ],
      keyIdea: 'Slack is a chat product with search, presence and notifications, and two enterprise features that cut across its data.',
      metrics: { conns: '?', rate: '?', push: '?', lat: '?' },
      scene: {
        nodes: [app, { ...gw, label: 'Slack', sub: 'channels, DMs, threads' }, { ...search, label: 'Search', sub: 'all history' }],
        links: [link('app', 'gw'), link('gw', 'search')],
        flows: [
          { path: ['app', 'gw'], tone: 'request', label: 'post in #general', duration: 1.4 },
          { path: ['gw', 'app'], tone: 'response', label: 'new message', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Non-functional targets',
          icon: 'List',
          rows: [
            { text: 'Delivery latency', value: 'under ~200 ms', tone: 'good' },
            { text: 'Message loss', value: 'none, stored before push', tone: 'good' },
            { text: 'Ordering', value: 'per channel, by ts' },
            { text: 'History', value: 'kept for years, searchable' },
            { text: 'Availability', value: 'survives a gateway loss' },
          ],
        },
        caption: 'A chat product with enterprise rules on top',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: 'The numbers: 12M open connections, 50K messages a second at peak',
      eli5: 'The school has 18 million kids, and 12 million are in the building right now, each holding one string to the front office. The office has to keep all those strings straight.',
      body: [
        '**18M** daily users, **200K** paid orgs, **12M** concurrent WebSocket connections. **500M** messages a day is about **5,800 per second** steady and **50K per second** at peak.',
        'The largest org has 800K people and the largest channel about 1M members. Search holds **100B+** messages. The connections and the big channels are the hard part, not the write rate.',
      ],
      keyIdea: 'Writes are modest. Open connections, huge channels and the search index are what shape the design.',
      metrics: { conns: '12M', rate: '5.8K/s (50K peak)', push: '?', lat: '?' },
      metricTones: { conns: 'warn' },
      scene: {
        nodes: [{ ...app, chips: ['18M DAU'] }, { ...gw, load: 55, chips: [{ text: '12M open sockets', tone: 'warn' }] }, { ...api, at: at(-1.6, 3.2) }, { ...db, at: at(2.4, 3.2) }],
        links: [link('app', 'gw'), link('gw', 'api'), link('api', 'db')],
        flows: [{ path: ['app', 'gw', 'api', 'db'], tone: 'request', label: '5.8K msg/s', count: 3, duration: 2 }],
        panel: {
          title: 'Napkin math',
          icon: 'Table',
          rows: [
            { text: 'Messages per day', value: '500M' },
            { text: 'Steady rate', value: '500M / 86,400 = 5.8K/s' },
            { text: 'Peak rate', value: '50K/s', tone: 'warn' },
            { text: 'Largest channel', value: '~1M members', tone: 'bad' },
            { text: 'Indexed for search', value: '100B+ messages' },
          ],
        },
        caption: 'Few writes, many listeners',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'WebSocket for live events, REST for everything you can wait for',
      eli5: 'Each kid keeps one string to the front office for fast notes. For slow errands, like asking for last year\'s notes, they walk to the **API** desk and ask.',
      body: [
        'One long-lived **WebSocket** carries live events down (new message, reaction, typing) and small commands up. Plain **REST** handles history, posting from integrations, uploads and settings.',
        'Posting uses a client-generated id so a retry after a dropped connection never creates a second message. See the real-time delivery lesson for the transport trade-offs.',
      ],
      keyIdea: 'Live events ride one socket. History and writes that can wait go over REST, and every post is idempotent.',
      metrics: { conns: '12M', rate: '5.8K/s', push: '?', lat: '?' },
      scene: {
        nodes: [{ ...app, chips: ['ws://'] }, { ...gw, chips: ['events down'] }, { ...api, at: at(-1.6, 3.2), chips: ['GET history'] }],
        links: [link('app', 'gw', { label: 'WebSocket' }), link('app', 'api', { label: 'HTTPS', route: 'straight' })],
        flows: [
          { path: ['app', 'gw'], tone: 'request', label: 'post {client_id}', duration: 1.3 },
          { path: ['gw', 'app'], tone: 'event', label: 'message', duration: 1.3, delay: 1.4 },
          { path: ['app', 'api'], tone: 'request', label: 'GET history', duration: 1.5, delay: 2.8 },
        ],
        panel: {
          title: 'Surface',
          icon: 'Code',
          code: 'WS  up   post, typing, ping\nWS  down message, reaction, typing\nGET /channels/{id}/history?before=\nPOST /files   (upload)\nPOST /messages (integrations)',
          footer: { text: 'client_id makes a retry safe', tone: 'good' },
        },
        caption: 'One socket for live, REST for the rest',
      },
      code: {
        language: 'json',
        title: 'Frames on the socket',
        source: `// client -> server
{ "type": "message", "client_id": "c-7f3a", "channel": "C123", "text": "ship it", "thread_ts": null }

// server -> client (to everyone with C123 open)
{ "type": "message", "channel": "C123", "ts": "1731850000.000200", "user": "U9", "text": "ship it" }

// ack to the sender, matches client_id
{ "ok": true, "client_id": "c-7f3a", "ts": "1731850000.000200" }`,
        highlight: [2, 8],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Everything hangs off a team id',
      eli5: 'Every class has a notebook per room. Each page is stamped with the room name and a timestamp, so every note has an exact spot in line.',
      body: [
        'Tables: `teams`, `users`, `channels`, `memberships` and `messages`. A message is keyed by `(team_id, channel_id, ts)`, where `ts` is a unique time-ordered id. A thread reply carries the `thread_ts` of its parent.',
        'Every row carries a `team_id`. The `team_id` prefix of the key is what routes a row to its shard, so it is worth getting right on day one.',
      ],
      keyIdea: 'Messages are keyed by (team_id, channel_id, ts). The ts orders them and the team_id prefix routes to the shard.',
      metrics: { conns: '12M', rate: '5.8K/s', push: '?', lat: '?' },
      scene: {
        nodes: [{ ...api, at: at(-3.6, -2.4) }, { ...db, at: at(0, 2.4), status: 'active', badge: 'team_id on every row' }, { ...search, at: at(3.6, -2.4), status: 'dim' }],
        links: [link('api', 'db')],
        flows: [{ path: ['api', 'db'], tone: 'request', label: 'INSERT message', duration: 1.5 }],
        panel: {
          title: 'Core tables',
          icon: 'Table',
          rows: [
            { text: 'channels', value: 'team_id, id, name, is_shared' },
            { text: 'memberships', value: 'team_id, channel_id, user_id' },
            { text: 'messages', value: 'PK (team_id, channel_id, ts)', tone: 'good' },
            { text: 'thread reply', value: 'thread_ts = parent ts' },
            { text: 'reactions', value: 'message, user, emoji' },
          ],
        },
        caption: 'Team, channel and ts are the message address',
      },
      code: {
        language: 'sql',
        title: 'The message table',
        source: `CREATE TABLE messages (
  team_id    BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  ts         DECIMAL(16,6) NOT NULL,   -- unique, time ordered
  user_id    BIGINT NOT NULL,
  thread_ts  DECIMAL(16,6) NULL,       -- parent ts for replies
  body       TEXT,
  PRIMARY KEY (team_id, channel_id, ts)
);
-- history: last 50 messages of a channel
SELECT * FROM messages WHERE team_id=? AND channel_id=? AND ts < ? ORDER BY ts DESC LIMIT 50;`,
        highlight: [4, 8, 11],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The first version: a gateway, an API and one database',
      eli5: 'A small school with one front office. A kid hands in a note, the office writes it in the notebook, then walks it to every kid in that room.',
      body: [
        'The client posts through the **gateway**. The **message API** writes the row, then the gateway pushes the message down the open socket of every member of that channel.',
        'For a 50-person channel this is excellent: one write, 50 pushes, a few milliseconds. The assumption inside it, "push to every member", is the part that will not last.',
      ],
      keyIdea: 'Write the message, then push it to every member. Correct and simple, until channels get large.',
      metrics: { conns: '10K', rate: '20/s', push: '50', lat: '30 ms' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [app, gw, { ...api, at: at(-1.6, 3.2) }, { ...db, at: at(2.4, 3.2) }],
        links: [link('app', 'gw'), link('gw', 'api'), link('api', 'db')],
        flows: [
          { path: ['app', 'gw', 'api', 'db'], tone: 'request', label: 'post', duration: 2.2 },
          { path: ['api', 'gw', 'app'], tone: 'event', label: 'push x 50', count: 3, duration: 1.8, delay: 2.4 },
        ],
        panel: {
          title: 'Small channel, 50 members',
          icon: 'Users',
          rows: [
            { text: 'DB writes', value: '1' },
            { text: 'Socket pushes', value: '50', tone: 'good' },
            { text: 'Time to deliver', value: '~30 ms', tone: 'good' },
          ],
        },
        caption: 'Post, store, push to all members',
      },
    },
    {
      title: 'Fan-out breaks',
      tag: 'problem',
      heading: 'One post in a 100K-member channel is 100K pushes',
      eli5: 'A teacher announces "pizza day" and the office must run to 100,000 rooms. While the runners are busy, every other note waits in line.',
      body: [
        'In an all-hands channel with **100K** members, one post means **100K** socket pushes. At peak, several of those posts a second saturate the gateways and delay unrelated messages.',
        'Most of those pushes are wasted. Of the 100K members, only a few thousand have the channel on screen right now. The rest do not need the text yet.',
      ],
      keyIdea: 'Pushing every message to every member does not scale, and most of the work is wasted on people not looking.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '100K', lat: '4 s' },
      metricTones: { push: 'bad', lat: 'bad' },
      scene: {
        nodes: [{ ...app, chips: ['#all-hands'] }, { ...gw, status: 'hot', load: 97, chips: [{ text: '100K pushes', tone: 'bad' }] }, { ...api, at: at(-1.6, 3.2) }],
        links: [link('app', 'gw'), link('gw', 'api')],
        flows: [
          { path: ['app', 'gw', 'api'], tone: 'request', label: 'post', duration: 1.6 },
          { path: ['gw', 'app'], tone: 'error', label: 'queue grows', count: 5, duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'One announcement post',
          icon: 'Gauge',
          rows: [
            { text: 'Channel members', value: '100,000' },
            { text: 'Viewing it right now', value: '~3,000', tone: 'good' },
            { text: 'Wasted pushes', value: '~97,000', tone: 'bad' },
          ],
          footer: { text: 'Everyone else waits behind the burst', tone: 'bad' },
        },
        caption: 'The gateway drowns in one popular post',
      },
    },
    {
      title: 'Hot path',
      tag: 'concept',
      heading: 'Subscribe only to the channels that are open',
      eli5: 'Kids only hold a string to the rooms they are standing in right now. A note for a room nobody is in does not need runners.',
      body: [
        'The client **subscribes** to a channel only while it is on screen, and unsubscribes when it leaves. The **hot path** pushes text only to those active subscribers.',
        'The fan-out drops from 100K to the few thousand viewers. The cost is bookkeeping: each gateway tracks which of its sockets are subscribed to which channel, and a reconnect must rebuild that.',
      ],
      keyIdea: 'Realtime text goes only to clients that have the channel open. Fan-out follows attention, not membership.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K', lat: '60 ms' },
      metricTones: { push: 'good', lat: 'good' },
      scene: {
        nodes: [{ ...app, chips: [{ text: 'sub #all-hands', tone: 'good' }] }, { ...gw, load: 48, chips: ['3K subscribers'] }, { ...bus, chips: ['topic: C123'] }],
        links: [link('app', 'gw'), link('gw', 'bus', { arrow: 'both' })],
        flows: [
          { path: ['app', 'gw', 'bus'], tone: 'request', label: 'subscribe C123', duration: 1.8 },
          { path: ['bus', 'gw', 'app'], tone: 'event', label: 'message', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Gateway subscription map',
          icon: 'Table',
          rows: [
            { text: 'C123 (#all-hands)', value: '3,000 sockets', tone: 'good' },
            { text: 'C124 (#random)', value: '210 sockets' },
            { text: 'C130 (#oncall)', value: '12 sockets' },
          ],
          footer: { text: 'Rebuilt by the client on reconnect', tone: 'muted' },
        },
        caption: 'Only open channels get the text',
      },
    },
    {
      title: 'Cold path',
      tag: 'concept',
      heading: 'Unread badges take a cheaper, batched route',
      eli5: 'Kids who are not in the room still want to know "something new in Room 5". A tiny tally on their door is enough. They read the note when they walk in.',
      body: [
        'Members without the channel open still need an **unread +1**. That is the **cold path**: a small counter update, batched, over a lower-priority pub/sub.',
        'The expensive part of fan-out is not delivering text, it is updating badges for everyone. Splitting hot text from cold counters is the central trick of the design.',
      ],
      keyIdea: 'Split fan-out in two: realtime text to active viewers, and batched counter updates to everyone else.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K text + batched counters', lat: '60 ms' },
      metricTones: { push: 'good' },
      scene: {
        nodes: [{ ...gw, at: at(-3.6, -3) }, { ...bus, at: at(0, -3), chips: ['hot: text', { text: 'cold: unread +1', tone: 'warn' }] }, { ...app, at: at(3.6, -3), chips: ['badge: 4'] }],
        links: [link('gw', 'bus', { arrow: 'both' }), link('bus', 'app')],
        flows: [
          { path: ['gw', 'bus'], tone: 'request', label: 'post', duration: 1.2 },
          { path: ['bus', 'app'], tone: 'event', label: 'text (open)', duration: 1.4, delay: 1.3 },
          { path: ['bus', 'app'], tone: 'data', label: 'unread +1 (batched)', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'Two paths for one post',
          icon: 'Split',
          rows: [
            { text: 'Hot: full text', value: 'active viewers only', tone: 'good' },
            { text: 'Cold: counter +1', value: 'everyone else, batched', tone: 'warn' },
            { text: 'Cold delivery delay', value: 'a second or two' },
            { text: 'Unread store', value: 'last_read_ts per user and channel', tone: 'good' },
            { text: 'Unread count', value: 'messages after last_read_ts, cleared on open' },
          ],
        },
        caption: 'Text for viewers, counters for the rest',
      },
      code: {
        language: 'typescript',
        title: 'Routing one post (sketch)',
        source: `async function onPost(msg: Message) {
  await store(msg);                          // durable first
  bus.publish(channelTopic(msg.channel), msg);   // hot path: subscribed gateways push it

  // cold path: batched, no text, low priority
  unreadBatcher.add(msg.channel, msg.ts);    // flushed every ~1s
}`,
        highlight: [2, 3, 6],
      },
      quiz: {
        question: 'A post lands in a 100K-member channel and 3K members have it open. What does the hot and cold split send?',
        options: [
          'The text to all 100K members over WebSockets',
          'The text to the 3K viewers, and a batched unread counter update to the rest',
          'Nothing until each member opens the channel',
          'The text to the 3K viewers, and an email to the rest',
        ],
        answer: 1,
        explain: 'Viewers get the message immediately on the hot path. Everyone else only needs a count, which can be batched and delayed slightly. That removes about 97K full pushes.',
      },
    },
    {
      title: 'Open a channel',
      tag: 'concept',
      heading: 'Opening a channel fetches history, then subscribes',
      eli5: 'Walking into a room, you first read the notebook to catch up, then stand quietly so you hear new notes. You make sure you did not miss one in between.',
      body: [
        'On open, the client calls REST for the latest history and gets a `ts`. Then it subscribes on the socket and asks for anything after that `ts`.',
        'Fetching first and subscribing second can leave a gap, so the client replays from its last seen `ts`. Messages are keyed by `ts`, so duplicates are dropped by the client.',
      ],
      keyIdea: 'History over REST, live updates over the socket, and a replay from the last ts closes the gap between them.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ ...app, at: at(-4.4, -2.4) }, { ...api, at: at(-1.2, -2.4), chips: ['1: history'] }, { ...gw, at: at(2.2, -2.4), chips: ['2: subscribe', '3: replay'] }, { ...db, at: at(0.6, 3.2) }],
        links: [link('app', 'api'), link('api', 'db'), link('app', 'gw', { route: 'straight' })],
        flows: [
          { path: ['app', 'api', 'db', 'api', 'app'], tone: 'request', label: 'last 50, ts=..200', duration: 2.4 },
          { path: ['app', 'gw'], tone: 'request', label: 'sub, since ts', duration: 1.4, delay: 2.6 },
          { path: ['gw', 'app'], tone: 'event', label: 'live', duration: 1.4, delay: 4 },
        ],
        panel: {
          title: 'Open #design-review',
          icon: 'List',
          rows: [
            { text: '1. GET history', value: 'ts up to ...200' },
            { text: '2. Subscribe on socket', value: 'channel C123' },
            { text: '3. Replay since ts', value: 'fills the gap', tone: 'good' },
          ],
        },
        caption: 'Catch up, subscribe, then close the gap',
      },
    },
    {
      title: 'Message bus',
      tag: 'concept',
      heading: 'A per-channel topic routes posts to the right gateways',
      eli5: 'Each room has a loudspeaker line. A runner reports a note to that line, and only the offices with kids standing in that room listen to it.',
      body: [
        'The API publishes each stored message to a **topic per channel** on the message bus (see the pub/sub lesson). A gateway subscribes to the topic when its first local socket opens that channel.',
        'It unsubscribes when its last socket leaves. Gateways then receive only the channels they actually serve, and adding gateways never changes the API.',
      ],
      keyIdea: 'Gateways subscribe to channel topics on demand, so the API never needs to know which gateway holds which user.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ ...api, at: at(-4.4, -3), chips: ['publish'] }, { ...bus, at: at(-1.2, -3), chips: ['topic C123'] }, { ...gw, id: 'gw1', at: at(2.2, -3), label: 'Gateway 1', sub: '1.2K viewers' }, { ...gw, id: 'gw2', at: at(0.6, 3), label: 'Gateway 2', sub: '1.8K viewers', size: 0.8 }],
        links: [link('api', 'bus'), link('bus', 'gw1'), link('bus', 'gw2')],
        flows: [
          { path: ['api', 'bus'], tone: 'event', label: 'msg C123', duration: 1.2 },
          { path: ['bus', 'gw1'], tone: 'event', label: 'C123', duration: 1.4, delay: 1.3 },
          { path: ['bus', 'gw2'], tone: 'event', label: 'C123', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Subscriptions by gateway',
          icon: 'Rss',
          rows: [
            { text: 'Gateway 1', value: 'C123, C124' },
            { text: 'Gateway 2', value: 'C123, C130' },
            { text: 'Gateway 3', value: 'C124 only', tone: 'muted' },
          ],
        },
        caption: 'Topics follow the sockets',
      },
    },
    {
      title: 'Team shards',
      tag: 'concept',
      heading: 'Split the database by team',
      eli5: 'Each class gets its own filing cabinet. One class filling its cabinet never makes another class wait.',
      body: [
        'Data volume outgrows one database, so storage is **sharded by `team_id`** (a MySQL fleet with a sharding layer such as Vitess). Everything a workspace does lives on one shard.',
        'Benefits: tenant isolation, queries that never cross shards, and linear scaling by adding shards. A huge team still hits one shard, so very large customers need their own. See the sharding lesson.',
      ],
      keyIdea: 'Sharding by team keeps each workspace on one shard. It is fast and isolated until something has to span teams.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ ...api, at: at(-3.6, -3) }, { ...db, id: 'sh1', at: at(0, 0.6), label: 'Shard A', sub: 'teams 1-5K' }, { ...db, id: 'sh2', at: at(3.6, 0.6), label: 'Shard B', sub: 'teams 5K-10K' }, { ...db, id: 'sh3', at: at(-3.6, 4.2), label: 'Shard C', sub: 'big customer' }],
        links: [link('api', 'sh1', { label: 'team 42' }), link('api', 'sh2'), link('api', 'sh3')],
        flows: [{ path: ['api', 'sh1'], tone: 'request', label: 'team_id 42', duration: 1.8 }],
        panel: {
          title: 'Routing key',
          icon: 'Hash',
          rows: [
            { text: 'shard = lookup(team_id)', value: 'directory table' },
            { text: 'Cross-shard joins', value: 'none needed', tone: 'good' },
            { text: 'One big team', value: 'can fill a shard', tone: 'warn' },
          ],
        },
        caption: 'A workspace never spans shards',
      },
    },
    {
      title: 'Search',
      tag: 'concept',
      heading: 'Keep search fresh by streaming changes from the database',
      eli5: 'A librarian copies each new note into the big card catalog as soon as it is written, so anyone can look up a word without opening every notebook.',
      body: [
        'The database streams every committed change (**CDC**, change data capture) to **Elasticsearch**, with an index per team. The API never writes to the index itself.',
        'Recent messages sit on a fast **hot tier**. Old messages move to a cheaper **cold tier**. Search is slightly behind the database, usually seconds, which users accept. See the search index lesson.',
      ],
      keyIdea: 'Search is a derived copy fed by change data capture, tiered by age, and always a little behind the source of truth.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ ...db, at: at(-3.6, -3), label: 'MySQL', sub: 'source of truth' }, { id: 'cdc', kind: 'block', size: 0.8, at: at(0, 0), label: 'CDC', sub: 'change stream', icon: 'Workflow', tint: 'teal' }, { ...search, at: at(3.6, 3.4), label: 'Elasticsearch', sub: 'hot + cold tier' }],
        links: [link('db', 'cdc'), link('cdc', 'search')],
        flows: [
          { path: ['db', 'cdc', 'search'], tone: 'data', label: 'new message', duration: 2.4 },
        ],
        panel: {
          title: 'Search index',
          icon: 'Search',
          rows: [
            { text: 'Indexed', value: '100B+ messages' },
            { text: 'Index layout', value: 'one per team' },
            { text: 'Hot tier', value: 'recent, fast disks', tone: 'good' },
            { text: 'Cold tier', value: 'old, cheap', tone: 'muted' },
            { text: 'Freshness', value: 'seconds behind', tone: 'warn' },
          ],
        },
        caption: 'Search reads a copy, never the primary',
      },
    },
    {
      title: 'Naive presence',
      tag: 'problem',
      heading: 'Heartbeats alone would be 400K requests a second',
      eli5: 'Every kid yells "I am here!" to the office every half minute. With 12 million kids, the office hears nothing else.',
      body: [
        'Presence shows online, away and typing. If every client sends "I am online" every 30 seconds, that is **12M / 30 = 400K requests per second**, just to keep green dots.',
        'It gets worse if each change then broadcasts to everyone. Most of those people never look at that dot.',
      ],
      keyIdea: 'Presence is a write-heavy firehose of tiny updates. The naive design costs more than the actual messaging.',
      metrics: { conns: '12M', rate: '5.8K/s msgs', push: '400K/s pings', lat: '120 ms' },
      metricTones: { push: 'bad', lat: 'warn' },
      scene: {
        nodes: [{ ...app, chips: [{ text: 'ping every 30 s', tone: 'warn' }] }, { ...gw, status: 'hot', load: 92, chips: [{ text: '400K pings/s', tone: 'bad' }] }, { ...presence, at: at(2.4, 3), status: 'hot' }],
        links: [link('app', 'gw'), link('gw', 'presence')],
        flows: [{ path: ['app', 'gw', 'presence'], tone: 'error', label: 'ping', count: 5, duration: 1.4 }],
        panel: {
          title: 'Heartbeat cost',
          icon: 'Activity',
          rows: [
            { text: 'Connected users', value: '12,000,000' },
            { text: 'Interval', value: '30 s' },
            { text: 'Ping rate', value: '400,000 / s', tone: 'bad' },
            { text: 'Real messages', value: '5,800 / s', tone: 'good' },
          ],
        },
        caption: 'The dots cost 70 times the messages',
      },
    },
    {
      title: 'Batched presence',
      tag: 'concept',
      heading: 'Track locally, publish diffs, subscribe only to people you share a channel with',
      eli5: 'Each office keeps its own list of which kids are here, and only tells the central board who arrived or left every few seconds. You only watch the dots of kids in your own classes.',
      body: [
        'A **gateway** keeps its connected users in local memory and sends the **diff** (who came, who left) to the presence service every few seconds. The pings stay inside the gateway.',
        '"Is Alice online?" reads a **Redis** key, `user_id -> last_seen`. A client only subscribes to people it shares a channel with, so there is no global broadcast.',
        'The key has a **TTL** (about 10 seconds) that every gateway flush refreshes for its users. If a gateway dies and never sends a left diff, its users expire on their own.',
      ],
      keyIdea: 'Aggregate presence at the gateway, ship diffs on a timer, and notify only people who care.',
      metrics: { conns: '12M', rate: '5.8K/s msgs', push: '~10K changes/s (est.)', lat: '60 ms' },
      metricTones: { push: 'good', lat: 'good' },
      scene: {
        nodes: [{ ...gw, at: at(-4.4, -3), load: 45, chips: ['local user set'] }, { ...presence, at: at(-0.4, -3), chips: ['diff every 3 s'] }, { ...cache, at: at(3.4, -3), chips: ['alice: 12:04:11'] }, { ...app, at: at(-0.4, 3), chips: ['sees #design only'] }],
        links: [link('gw', 'presence'), link('presence', 'cache'), link('presence', 'app')],
        flows: [
          { path: ['gw', 'presence'], tone: 'data', label: '+bob -dan', duration: 1.4 },
          { path: ['presence', 'cache'], tone: 'request', label: 'SET last_seen', duration: 1.2, delay: 1.5 },
          { path: ['presence', 'app'], tone: 'event', label: 'bob online', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Request math',
          icon: 'Gauge',
          rows: [
            { text: 'Before: heartbeats to a service', value: '400K/s', tone: 'bad' },
            { text: 'After: user changes in diffs', value: '~10K/s (estimate)', tone: 'good' },
            { text: 'Batched messages sent', value: '~60 gateways / 3 s = 20/s' },
            { text: 'last_seen TTL', value: 'refreshed on each flush' },
            { text: 'Who gets notified', value: 'shared-channel peers' },
          ],
        },
        caption: 'Count at the edge, tell the center only changes',
      },
      code: {
        language: 'typescript',
        title: 'Gateway presence flush',
        source: `const online = new Set<string>();          // users on THIS gateway
let joined: string[] = [], left: string[] = [];

socket.onOpen(u  => { online.add(u);    joined.push(u); });
socket.onClose(u => { online.delete(u); left.push(u);   });

setInterval(() => {
  if (!joined.length && !left.length) return;
  presence.publish({ gateway: GW_ID, joined, left });   // a diff, not a roster
  joined = []; left = [];
}, 3000);`,
        highlight: [4, 5, 7, 9],
      },
      quiz: {
        question: 'What stops presence from becoming 400K writes per second?',
        options: [
          'Raising the heartbeat interval to 24 hours',
          'Gateways track their own sockets and send only periodic diffs, and clients watch only people they share a channel with',
          'Storing presence in the main message table',
          'Sending presence over email',
        ],
        answer: 1,
        explain: 'The per-socket pings stay inside each gateway. Only changes cross the network, batched on a timer, and only interested peers get notified.',
      },
    },
    {
      title: 'Threads and reactions',
      tag: 'concept',
      heading: 'Replies and reactions ride the same message path',
      eli5: 'A reply to a note is stapled to it. A heart sticker is a tiny note about a note. Both go through the same office as any other note.',
      body: [
        'A **thread reply** is a message with a `thread_ts`, so it is stored and delivered like any other. A **reaction** is a small event on one message: one small row, then an event pushed to viewers on the hot path.',
        'Neither needs a new pipeline. The API writes, the bus publishes on the channel topic, and gateways push to whoever has the channel open.',
      ],
      keyIdea: 'Replies and reactions are ordinary events on the existing message path.',
      metrics: { conns: '12M', rate: '5.8K/s msgs', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ ...app, at: at(-4.4, -3), chips: ['reply, thumbs-up'] }, { ...api, at: at(-0.8, -3) }, { ...bus, at: at(3.2, -3), chips: ['topic C123'] }, { ...db, at: at(-0.8, 3.2) }],
        links: [link('app', 'api'), link('api', 'db'), link('api', 'bus')],
        flows: [
          { path: ['app', 'api', 'db'], tone: 'request', label: 'reply, thread_ts', duration: 1.8 },
          { path: ['api', 'bus'], tone: 'event', label: 'reply + reaction event', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'What gets stored where',
          icon: 'Table',
          rows: [
            { text: 'Reply', value: 'messages row, thread_ts' },
            { text: 'Reaction', value: 'one small row + event' },
            { text: 'Delivery', value: 'hot path, channel topic', tone: 'good' },
          ],
        },
        caption: 'Same path, new event types',
      },
    },
    {
      title: 'File uploads',
      tag: 'concept',
      heading: 'Files go to object storage and the message holds an id',
      eli5: 'A big drawing does not fit in the notebook, so it goes in a drawer and the notebook holds a ticket for it.',
      body: [
        '**Files** never go through the gateway. The client uploads to object storage (see that lesson), and the message holds a file id.',
        'Clients fetch the bytes from storage by that id, so large binary data never loads the message path.',
      ],
      keyIdea: 'Big binary data goes to object storage, and messages only point to it.',
      metrics: { conns: '12M', rate: '5.8K/s msgs', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ ...app, at: at(-4.4, -3), chips: ['upload'] }, { ...api, at: at(-0.8, -3) }, { id: 'files', kind: 'storage', at: at(3.2, -3), label: 'Object storage', sub: 'files, images' }, { ...db, at: at(-0.8, 3.2) }],
        links: [link('app', 'api'), link('api', 'db'), link('app', 'files', { route: 'straight', label: 'upload' })],
        flows: [
          { path: ['app', 'files'], tone: 'data', label: 'file bytes', duration: 2 },
          { path: ['app', 'api', 'db'], tone: 'request', label: 'message + file id', duration: 1.8, delay: 2.2 },
        ],
        panel: {
          title: 'What gets stored where',
          icon: 'Table',
          rows: [
            { text: 'File bytes', value: 'object storage', tone: 'good' },
            { text: 'File reference', value: 'file id in message' },
          ],
        },
        caption: 'Bytes on the side, id in the message',
      },
    },
    {
      title: 'Notifications',
      tag: 'concept',
      heading: 'Offline users get push, then email',
      eli5: 'If a kid has gone home, the office sends a text to their parents about the new note. If it still goes unread for a while, a letter arrives later.',
      body: [
        'If a user has no open socket, the **notification service** sends a mobile push or desktop alert. It checks user settings first (mentions only, do not disturb) and skips anything the user already saw on another device.',
        'Unread messages after a delay fall into an **email digest**. See the notification system lesson for retries and delivery providers.',
      ],
      keyIdea: 'Notifications are a separate consumer of the same events, with per-user rules and a delay before email.',
      metrics: { conns: '12M', rate: '5.8K/s msgs', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ ...bus, at: at(-3.8, -3) }, { ...notif, at: at(0, -3), chips: ['rules: @mention only'] }, { ...app, at: at(3.8, -3), label: 'Phone', sub: 'offline', status: 'dim', chips: [{ text: 'push: @you in #ops', tone: 'good' }] }],
        links: [link('bus', 'notif'), link('notif', 'app')],
        flows: [
          { path: ['bus', 'notif'], tone: 'event', label: '@you', duration: 1.3 },
          { path: ['notif', 'app'], tone: 'event', label: 'push', duration: 1.5, delay: 1.4 },
        ],
        panel: {
          title: 'Decision order',
          icon: 'List',
          rows: [
            { text: '1. Socket open?', value: 'no push' },
            { text: '2. User settings allow?', value: 'else drop' },
            { text: '3. Seen elsewhere?', value: 'else skip' },
            { text: '4. Push now', value: 'mobile, desktop' },
            { text: '5. Still unread later', value: 'email digest', tone: 'muted' },
          ],
        },
        caption: 'Rules first, then the right channel',
      },
    },
    {
      title: 'Grid',
      tag: 'concept',
      heading: 'Enterprise Grid adds an org above the team',
      eli5: 'A district owns many schools. A teacher can work in two schools and sees one set of rooms from each, but the district office keeps one list of all teachers.',
      body: [
        'An **Enterprise Grid** org holds many **workspaces**. The model adds `enterprise_id` above `team_id`, and a user can belong to several workspaces. Admin policy, identity and search can span the org.',
        'Workspaces are still the shard unit, so most traffic stays on one shard. Org-level features read across shards through a directory.',
      ],
      keyIdea: 'Grid adds an org layer above team_id. Workspaces still own their data and their shard.',
      metrics: { conns: '12M', rate: '5.8K/s msgs', push: '3K', lat: '60 ms' },
      scene: {
        nodes: [{ id: 'org', kind: 'block', at: at(0, -3.4), label: 'Org', sub: 'enterprise_id', icon: 'Layers', tint: 'violet' }, { ...db, id: 'wa', at: at(-3.6, 0.4), label: 'Workspace A', sub: 'team 1' }, { ...db, id: 'wb', at: at(0, 3.4), label: 'Workspace B', sub: 'team 2' }, { ...db, id: 'wc', at: at(3.6, 0.4), label: 'Workspace C', sub: 'team 3' }],
        links: [link('org', 'wa'), link('org', 'wb'), link('org', 'wc')],
        flows: [{ path: ['org', 'wb'], tone: 'request', label: 'policy, directory', duration: 1.8 }],
        panel: {
          title: 'Hierarchy',
          icon: 'Layers',
          rows: [
            { text: 'enterprise (org)', value: '800K people at the largest' },
            { text: 'workspace (team)', value: 'shard unit', tone: 'good' },
            { text: 'user', value: 'member of N workspaces' },
          ],
        },
        caption: 'Org above team, shard below',
      },
    },
    {
      title: 'Slack Connect',
      tag: 'tradeoff',
      heading: 'A shared channel breaks per-team sharding',
      eli5: 'Two classes in different schools share one chat room. Both schools want their own copy of the notebook, but they must never disagree on what was written.',
      body: [
        'A **Slack Connect** channel belongs to two companies on two different shards. Writes to both shards would risk the copies disagreeing.',
        'The fix: pick a **primary team** for the channel and send **all writes** there. The other team reads from a replica on its own shard. Reads stay local, writes take one extra hop.',
      ],
      keyIdea: 'A shared channel has one primary shard for writes and read copies elsewhere, trading a little write latency for consistency.',
      metrics: { conns: '12M', rate: '5.8K/s msgs', push: '3K', lat: '70 ms' },
      metricTones: { lat: 'warn' },
      scene: {
        nodes: [{ ...app, id: 'appb', at: at(-5, -3), label: 'Team B user', chips: ['post'] }, { ...api, at: at(-1.6, -3) }, { ...db, id: 'prim', at: at(2.2, -3.4), label: 'Primary', sub: 'team A shard', status: 'active' }, { ...db, id: 'repb', kind: 'replica', at: at(-1, 3), label: 'Replica', sub: 'team B shard' }],
        links: [link('appb', 'api'), link('api', 'prim', { label: 'all writes', labelTone: 'warn' }), link('prim', 'repb', { style: 'dashed' })],
        flows: [
          { path: ['appb', 'api', 'prim'], tone: 'request', label: 'write', duration: 2 },
          { path: ['prim', 'repb'], tone: 'data', label: 'replicate', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Shared channel C900',
          icon: 'Share2',
          rows: [
            { text: 'Primary team', value: 'A (writes)', tone: 'good' },
            { text: 'Team B reads', value: 'local replica' },
            { text: 'Team B writes', value: '+1 hop to A', tone: 'warn' },
          ],
          footer: { text: 'See the replication lesson', tone: 'muted' },
        },
        caption: 'One writer, many readers',
      },
    },
    {
      title: 'Gateway dies',
      tag: 'case',
      heading: 'A gateway fails and 200K sockets reconnect at once',
      eli5: 'One office burns down and 200,000 kids rush to the other offices. If they all arrive in one second, the new offices fall over too.',
      body: [
        'Each gateway holds roughly 200K sockets. When one dies, clients reconnect to other gateways through the load balancer. Reconnect with **jittered backoff** so the herd arrives over about 30 seconds.',
        'The presence service also expires every user of the dead `gateway_id`, because a crashed gateway never sends left diffs. Each client re-subscribes to its open channels and replays from its last `ts`. No message is lost, because the database holds them and clients dedupe by `ts`.',
      ],
      keyIdea: 'Messages are durable before they are pushed, so a dead gateway costs reconnect work, not data. Jitter spreads that work out.',
      metrics: { conns: '11.8M', rate: '5.8K/s msgs', push: '3K', lat: '2 s then 60 ms' },
      metricTones: { conns: 'warn', lat: 'warn' },
      scene: {
        nodes: [{ ...app, at: at(-5, -3), chips: ['backoff + jitter'] }, { ...gw, id: 'gwx', at: at(-1.6, -3.4), status: 'down', label: 'Gateway 1', sub: 'dead' }, { ...gw, id: 'gwy', at: at(2, -3.4), label: 'Gateway 2', load: 78, status: 'active' }, { ...db, at: at(0, 3.4) }],
        links: [link('app', 'gwx', { style: 'faint' }), link('app', 'gwy', { route: 'straight' }), link('gwy', 'db')],
        flows: [
          { path: ['app', 'gwy'], tone: 'handshake', label: 'reconnect (jittered)', duration: 1.6 },
          { path: ['gwy', 'db', 'gwy', 'app'], tone: 'response', label: 'replay since ts', duration: 2.2, delay: 1.7 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Repeat',
          rows: [
            { text: 'Sockets on the dead gateway', value: '~200K' },
            { text: 'Reconnect window', value: '~30 s (jitter)', tone: 'good' },
            { text: 'Messages lost', value: '0', tone: 'good' },
            { text: 'Presence of dead gateway_id', value: 'expired by presence service', tone: 'good' },
            { text: 'No jitter', value: 'second outage', tone: 'bad' },
          ],
        },
        caption: 'Durable store plus jitter equals no data loss',
      },
    },
    {
      title: 'Trade-offs',
      tag: 'tradeoff',
      heading: 'What each decision gave and what it cost',
      eli5: 'Each rule at the school makes one thing easy and another thing a bit harder. Good rules are the ones whose price you can live with.',
      body: [
        'Every step above bought something and cost something. Active-subscription fan-out is cheap for huge channels but needs careful reconnect logic. Per-team shards isolate tenants but make Connect and Grid harder.',
        'Search through CDC scales on its own but is seconds behind. Batched presence cuts 400K requests per second to about 10K user changes per second (an estimate, shipped as roughly 20 batches a second) but delays a dot by a few seconds.',
      ],
      keyIdea: 'Every scaling move here trades a little freshness or simplicity for a large drop in cost.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K', lat: '60 ms' },
      metricTones: { conns: 'good', lat: 'good' },
      scene: {
        nodes: [{ ...gw, at: at(-3.6, -3), status: 'ok' }, { ...db, at: at(0, 0.6), status: 'ok' }, { ...search, at: at(3.6, -3), status: 'ok' }],
        links: [link('gw', 'db'), link('db', 'search')],
        panel: {
          title: 'The ledger',
          icon: 'Scale',
          rows: [
            { text: 'Active-sub fan-out', value: 'cheap / reconnect logic' },
            { text: 'Per-team shards', value: 'isolated / Grid, Connect hard' },
            { text: 'CDC search', value: 'scales / seconds stale' },
            { text: 'Batched presence', value: '~10K changes/s (est.) / delayed dots' },
          ],
        },
        caption: 'Small prices for large savings',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Slack in one picture',
      eli5: 'Kids hold a string only to the room they are in, a tally tells the others, each class has its own cabinet, and a librarian keeps the catalog. Lose an office and nothing is lost.',
      body: [
        'Gateways hold the sockets. Posts are stored first, then published on a per-channel topic. **Hot path** text goes to open channels. **Cold path** counters batch for the rest.',
        'Storage is sharded by team. Search follows through CDC. Presence is aggregated at the gateway. Connect uses a primary team. Reconnects use jitter.',
      ],
      keyIdea: 'Fan-out follows attention, state is sharded by team, and everything derived is fed by events.',
      metrics: { conns: '12M', rate: '50K/s peak', push: '3K', lat: '60 ms' },
      metricTones: { conns: 'good', push: 'good', lat: 'good' },
      scene: {
        nodes: [{ ...app, at: at(-5, -3), status: 'ok' }, { ...gw, at: at(-1.6, -3), status: 'ok' }, { ...bus, at: at(1.9, -3), status: 'ok' }, { ...api, at: at(-1.6, 3.2), status: 'ok' }, { ...db, at: at(2.4, 3.2), status: 'ok' }],
        links: [link('app', 'gw'), link('gw', 'bus', { arrow: 'both' }), link('gw', 'api'), link('api', 'db')],
        flows: [
          { path: ['app', 'gw', 'api', 'db'], tone: 'request', label: 'post', duration: 1.8 },
          { path: ['bus', 'gw', 'app'], tone: 'event', label: 'hot path', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Design at a glance',
          icon: 'Boxes',
          rows: [
            { text: 'Realtime', value: 'WebSocket, topic per channel' },
            { text: 'Fan-out', value: 'open channels only' },
            { text: 'Storage', value: 'MySQL, shard by team' },
            { text: 'Search', value: 'CDC to Elasticsearch' },
            { text: 'Presence', value: 'gateway diffs, Redis' },
          ],
        },
        caption: 'Hot text, cold counters, sharded teams',
      },
      quiz: {
        question: 'Why does Slack Connect need a primary team for each shared channel?',
        options: [
          'Because WebSockets only work for one company',
          'Because sharding by team_id would otherwise put the same channel on two shards, and one shard must own the writes to keep the copies consistent',
          'Because search cannot index two teams',
          'Because Redis cannot store two team ids',
        ],
        answer: 1,
        explain: 'Per-team sharding assumes a channel lives on one shard. A shared channel breaks that, so one team is the primary for writes and the other team reads a replica.',
      },
    },
  ],
};
