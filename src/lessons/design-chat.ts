import type { Lesson, SceneNode } from '../engine/types';

// Layout: chat servers on the top row, shared services on the bottom row, people at the ends.
const ana: SceneNode = { id: 'ana', kind: 'phone', at: [-4, 4], label: 'Ana', sub: 'phone' };
const chat1: SceneNode = { id: 'chat1', kind: 'server', at: [-3.75, 0.25], label: 'chat server 1', sub: '100K sockets' };
const bus: SceneNode = { id: 'bus', kind: 'queue', at: [-2, -1.5], label: 'server bus', sub: 'pub/sub' };
const chat2: SceneNode = { id: 'chat2', kind: 'server', at: [-0.25, -3.25], label: 'chat server 2', sub: '100K sockets' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: [1.5, -5], label: 'Ben', sub: 'phone' };
const benLaptop: SceneNode = { id: 'benLaptop', kind: 'client', at: [4.25, -5.25], label: 'Ben', sub: 'laptop' };
const api: SceneNode = { id: 'api', kind: 'service', at: [-0.75, 4.25], label: 'API servers', sub: 'login, history' };
const discovery: SceneNode = { id: 'discovery', kind: 'service', at: [0.75, 2.75], label: 'discovery', sub: 'picks a server' };
const registry: SceneNode = { id: 'registry', kind: 'cache', at: [2.25, 1.25], label: 'session registry', sub: 'user to servers' };
const store: SceneNode = { id: 'store', kind: 'db', at: [3.75, -0.25], label: 'message store', sub: 'by conversation' };
const push: SceneNode = { id: 'push', kind: 'service', at: [5.25, -1.75], label: 'push service', sub: 'APNs, FCM' };

const serverLinks = [
  { from: 'ana', to: 'chat1' },
  { from: 'chat1', to: 'bus' },
  { from: 'bus', to: 'chat2' },
  { from: 'chat2', to: 'ben' },
];

export const designChat: Lesson = {
  id: 'design-chat',
  title: 'Design a chat system',
  tagline: 'One-to-one and group chat for 100 million daily users: sockets on hundreds of servers, ordered history kept forever, and every device in sync.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Scale numbers for connections, messages and storage',
    'WebSocket chat servers, and how discovery picks one for each device',
    'Per-conversation message ids, ordering, acks and deduplication',
    'Why chat history goes in a wide-column store keyed by conversation',
    'Offline delivery with push notifications, multi-device sync and read receipts',
    'Presence with heartbeats, group fan-out limits, and surviving a dead chat server',
  ],
  metrics: [
    { key: 'conns', label: 'Open sockets' },
    { key: 'msgs', label: 'Messages' },
    { key: 'latency', label: 'Delivery p99' },
    { key: 'servers', label: 'Chat servers' },
    { key: 'storage', label: 'New history' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Chat for 100 million people a day',
      eli5: 'A huge hotel where guests send notes to each other all day. The **chat system** is the hotel\'s note service: every note must reach the right room fast, in order, and be kept in the log forever.',
      body: [
        'Scope: one-to-one chats and groups of up to 500 members, text messages, an online indicator, several devices per account, push notifications when the app is closed, delivered and read receipts, and history kept forever. Media and end-to-end encryption are out of scope for this version.',
        'Napkin math: **100M daily users** send about 40 messages a day, which is 4 billion messages a day, about 46K per second on average and **150K/s at peak**. At peak about **30M devices** hold an open connection. A stored message with its metadata is about 200 bytes, so history grows by **800 GB a day**, around 300 TB a year before replication.',
        'Targets: a message between two online users arrives in under **300 ms at p99**. No acknowledged message is ever lost, and everyone in a conversation sees the same order.',
      ],
      keyIdea: 'Chat is two hard problems at once: millions of open connections, and an ordered log that is never allowed to lose a line.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: 'target < 300 ms', servers: '-', storage: '800 GB/day' },
      scene: {
        nodes: [ana, { ...chat1, label: 'chat service', sub: '?' }, { ...store, badge: 'kept forever' }, ben],
        links: [{ from: 'ana', to: 'chat1' }, { from: 'chat1', to: 'ben' }, { from: 'chat1', to: 'store' }],
        flows: [
          { path: ['ana', 'chat1', 'ben'], tone: 'request', label: '"on my way"', duration: 2 },
          { path: ['chat1', 'store'], tone: 'data', duration: 1.2, delay: 1 },
        ],
        caption: 'Deliver fast, store forever, keep the order',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'A WebSocket for messages, plain HTTP for the rest',
      eli5: 'Each guest keeps a house phone line open to an operator for notes going both ways. Checking in, changing your name card or reading old notes is done at the front desk, the **API**.',
      body: [
        'Messages flow both ways at any moment, so each device holds one **WebSocket** to a chat server (the real-time lesson compares it with polling and SSE). Frames are small JSON or binary messages: `send`, `ack`, `message`, `read` and `ping`.',
        'Everything else is ordinary HTTP behind a load balancer: `POST /v1/login` returns a token and a chat server address, `GET /v1/conversations/{id}/messages?before_seq=800` pages through history, and group membership and profiles are normal REST calls. These stateless API servers scale like any web tier.',
        'Every `send` carries a `client_msg_id` the phone generates. If the ack is lost and the phone resends, the server recognizes the id and does not create a second message.',
      ],
      keyIdea: 'Use the socket only for what must be pushed in real time, and keep the rest on stateless HTTP.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: 'target < 300 ms', servers: '-', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, { ...chat1, status: 'active', badge: 'WebSocket' }, { ...api, status: 'active', badge: 'HTTP' }],
        links: [{ from: 'ana', to: 'chat1', label: 'wss' }, { from: 'ana', to: 'api', style: 'dashed', label: 'https' }],
        flows: [
          { path: ['ana', 'api'], tone: 'request', label: 'POST /v1/login', duration: 1.1 },
          { path: ['api', 'ana'], tone: 'response', label: 'token + server', duration: 1.1, delay: 1.2 },
          { path: ['ana', 'chat1'], tone: 'request', label: 'send', duration: 1, delay: 2.5 },
          { path: ['chat1', 'ana'], tone: 'response', label: 'ack seq 813', duration: 1, delay: 3.6 },
        ],
        caption: 'Real-time frames on the socket, the rest over HTTP',
      },
      code: {
        language: 'json',
        title: 'WebSocket frames',
        source: `// device -> server
{ "type": "send", "client_msg_id": "c-9f2e", "conversation_id": 42, "body": "on my way" }

// server -> sending device, once the message is stored
{ "type": "ack", "client_msg_id": "c-9f2e", "seq": 813, "message_id": "7301961120384" }

// server -> every online device of every member
{ "type": "message", "conversation_id": 42, "seq": 813, "sender_id": 7, "body": "on my way" }

// device -> server, when the user has seen it
{ "type": "read", "conversation_id": 42, "up_to_seq": 813 }`,
        highlight: [2, 5, 11],
      },
    },
    {
      title: 'Storage',
      tag: 'tradeoff',
      heading: 'History in a wide-column store, keyed by conversation',
      eli5: 'The hotel keeps one notebook per conversation and only ever adds lines at the end. Opening a chat means reading the last page of that one **notebook**.',
      body: [
        'Look at the access pattern. Writes are 150K/s at peak and never updated. Reads are almost always "the newest 50 messages of conversation 42" or "everything after seq 812". Read and write volumes are about equal. Data grows forever, and old messages are rarely read.',
        'A single SQL database handles none of that at 300 TB a year. A **wide-column store** (the SQL and NoSQL lesson) fits: partition by conversation, sort by sequence inside the partition, and every common query is one sequential read from one partition. Its LSM-tree engine (the storage engines lesson) is built for heavy append writes, and adding nodes adds capacity.',
        'A group that has chatted for years would grow one enormous partition, so add a time **bucket** to the key, such as the month. Users, profiles and group membership stay in a relational database, where joins and transactions help and the data is small.',
      ],
      keyIdea: 'Shape the message table around the two reads that matter: the newest page of a conversation, and everything after a sequence number.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: 'target < 300 ms', servers: '-', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat1, status: 'active' }, { ...store, status: 'active', badge: 'partition: chat 42' }, { ...api, status: 'active' }],
        links: [{ from: 'chat1', to: 'store' }, { from: 'api', to: 'store' }],
        flows: [
          { path: ['chat1', 'store'], tone: 'data', label: 'append seq 813', count: 3, duration: 1.4 },
          { path: ['api', 'store'], tone: 'request', label: 'newest 50', duration: 1.3, delay: 1.6 },
          { path: ['store', 'api'], tone: 'response', duration: 1.3, delay: 3 },
        ],
        caption: 'Append to one partition, read its tail',
      },
      code: {
        language: 'sql',
        title: 'Message table (Cassandra-style CQL)',
        source: `CREATE TABLE messages (
  conversation_id  bigint,
  bucket           int,      -- yyyymm, caps partition size for old busy chats
  seq              bigint,   -- order inside this conversation
  message_id       bigint,   -- globally unique, time-sortable
  sender_id        bigint,
  body             text,
  PRIMARY KEY ((conversation_id, bucket), seq)
) WITH CLUSTERING ORDER BY (seq DESC);

-- open a chat: the newest page
SELECT * FROM messages
 WHERE conversation_id = 42 AND bucket = 202611 LIMIT 50;

-- a device comes back: everything it missed
SELECT * FROM messages
 WHERE conversation_id = 42 AND bucket = 202611 AND seq > 812;`,
        highlight: [3, 4, 8, 17],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'First version: one chat server holds every socket',
      eli5: 'A small hotel has one operator. Every guest\'s line plugs into the same switchboard, so passing a note from Ana\'s room to Ben\'s is just moving it across the desk.',
      body: [
        'Start with one chat server. Ana and Ben both hold sockets to it. A message arrives on Ana\'s socket, the server appends it to the message store, acks Ana, and writes it down Ben\'s socket. Finding Ben is a lookup in a local map from user id to socket.',
        'With 50K people online this works well. One process, no cross-server routing, delivery in a few tens of milliseconds. It is a fine place to start an interview answer, as long as you say out loud that it is a starting point.',
      ],
      keyIdea: 'On one server, routing is a local map lookup. Everything hard about chat starts when there are two servers.',
      metrics: { conns: '50K', msgs: '300/s', latency: '40 ms', servers: '1', storage: '5 GB/day' },
      scene: {
        nodes: [ana, { ...chat1, label: 'chat server', sub: 'map: user to socket', status: 'active' }, store, ben],
        links: [{ from: 'ana', to: 'chat1' }, { from: 'chat1', to: 'ben' }, { from: 'chat1', to: 'store' }],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'send', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append', duration: 1, delay: 1.1 },
          { path: ['chat1', 'ana'], tone: 'response', label: 'ack', duration: 1, delay: 2.2 },
          { path: ['chat1', 'ben'], tone: 'event', label: 'message', duration: 1.2, delay: 2.2 },
        ],
        caption: 'Both sockets on one box',
      },
    },
    {
      title: 'It breaks',
      tag: 'case',
      heading: 'Case: 30 million sockets will not fit on one box',
      eli5: 'The hotel grows to millions of rooms. One operator cannot hold that many lines, and with many operators, Ana\'s operator does not have Ben\'s line at all.',
      body: [
        'Each idle socket costs memory, a file descriptor and heartbeat work. A tuned server holds around **100K** comfortably, so 30M devices need about 300 chat servers, and closer to 400 with room for failures and deploys. One box would also be a single point of failure for every conversation.',
        'Spreading sockets creates two new questions. Which server should a device connect to? And when Ana\'s socket is on server 1 and Ben\'s is on server 2, how does server 1 get the message to Ben? With hundreds of servers, sender and receiver almost never share one.',
      ],
      keyIdea: 'Connections force many stateful servers, and then every message needs routing to wherever the receiver happens to be.',
      metrics: { conns: '30M', msgs: '150K/s', latency: 'timeouts', servers: '1 (need ~300)', storage: '800 GB/day' },
      scene: {
        nodes: [ana, { ...chat1, status: 'hot', badge: 'sockets: full' }, { ...chat2, status: 'active', badge: 'Ben is here' }, { ...ben, status: 'hot', badge: 'no message' }],
        links: [{ from: 'ana', to: 'chat1' }, { from: 'chat2', to: 'ben' }, { from: 'chat1', to: 'chat2', style: 'dashed', label: '?' }],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'to Ben', duration: 1 },
          { path: ['chat1', 'chat2'], tone: 'error', label: 'where is Ben?', duration: 1.4, delay: 1.1 },
        ],
        caption: 'Ana and Ben live on different servers',
      },
    },
    {
      title: 'Discovery',
      tag: 'concept',
      heading: 'Discovery picks a chat server for each device',
      eli5: 'At check-in, the concierge looks at which operators have free lines and assigns you one nearby. A board in the back lists which operator holds every guest. That board is the **session registry**.',
      body: [
        'After login, the API asks **discovery** for a chat server. Chat servers register themselves and report their socket count in a coordination store such as ZooKeeper, etcd or Consul (the service discovery lesson). Discovery picks a healthy server in the user\'s region with spare room, and returns its address. The phone opens a WebSocket straight to it.',
        'When the socket opens, the chat server writes the device into the **session registry**: `ben -> {phone: chat-2, laptop: chat-2}`, with a TTL the server keeps refreshing. That one lookup tells anyone where Ben\'s devices are right now.',
        'Plan for about 300 servers at 100K sockets each, plus headroom, so roughly **400**. Discovery steers new connections toward the emptiest servers, which also fills in new servers added during a busy evening.',
      ],
      keyIdea: 'Discovery decides where a device connects. The session registry records where it connected, so messages can find it.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, { ...chat1, status: 'ok', badge: '61K / 100K' }, chat2, { ...api, status: 'active' }, { ...discovery, status: 'active', badge: 'least loaded' }, { ...registry, status: 'ok', badge: 'ana: chat-1' }],
        links: [
          { from: 'ana', to: 'api' },
          { from: 'api', to: 'discovery' },
          { from: 'ana', to: 'chat1' },
          { from: 'chat1', to: 'registry', style: 'dashed' },
          { from: 'chat1', to: 'discovery', style: 'faint' },
          { from: 'chat2', to: 'discovery', style: 'faint' },
        ],
        flows: [
          { path: ['ana', 'api', 'discovery'], tone: 'request', label: 'login', duration: 1.5 },
          { path: ['discovery', 'api', 'ana'], tone: 'response', label: 'wss://chat-1', duration: 1.5, delay: 1.6 },
          { path: ['ana', 'chat1'], tone: 'handshake', label: 'WebSocket', duration: 1.1, delay: 3.2 },
          { path: ['chat1', 'registry'], tone: 'data', label: 'ana: chat-1', duration: 1.3, delay: 4.4 },
        ],
        caption: 'Login, get a server, connect, register',
      },
    },
    {
      title: 'Send flow',
      tag: 'concept',
      heading: 'Number it, store it, ack it, route it',
      eli5: 'The operator writes the note in the conversation notebook with the next line number, tells Ana "got it", checks the board, and passes the note to Ben\'s operator through the back room.',
      body: [
        'Server 1 gives the message the next **sequence number** for conversation 42 and a globally unique `message_id` (the unique ID lesson). Order only has to be agreed inside one conversation, so the counter is per conversation: small, independent and easy to shard. Timestamps cannot order messages, because phone clocks disagree and two messages can share a millisecond.',
        'The message is written to the store **before** the ack. Then server 1 looks up each member\'s devices in the session registry and publishes once per destination server on the **server bus** (the pub/sub lesson). Server 2 writes it down Ben\'s socket. Delivery takes about **120 ms** at p99.',
        'If Ana\'s phone never sees the ack, it resends with the same `client_msg_id`. Server 1 finds that id already stored and acks again with the original sequence number, so a retry never duplicates a message.',
      ],
      keyIdea: 'Durable first, then ack, then deliver. The sequence number gives one agreed order, and the client id makes retries safe.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [ana, { ...chat1, status: 'active', badge: 'seq 813' }, { ...bus, status: 'active' }, { ...chat2, status: 'active' }, { ...ben, status: 'ok', badge: '"on my way"' }, { ...registry, badge: 'ben: chat-2' }, { ...store, status: 'active' }],
        links: [...serverLinks, { from: 'chat1', to: 'registry', style: 'dashed' }, { from: 'chat1', to: 'store' }],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'send c-9f2e', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append 813', duration: 1.3, delay: 1.1 },
          { path: ['chat1', 'ana'], tone: 'response', label: 'ack 813', duration: 1, delay: 2.5 },
          { path: ['chat1', 'registry'], tone: 'request', label: 'where is Ben?', duration: 1.1, delay: 2.5 },
          { path: ['chat1', 'bus', 'chat2', 'ben'], tone: 'event', label: 'message 813', duration: 2, delay: 3.7 },
        ],
        caption: 'Store before ack, then route through the bus',
      },
      code: {
        language: 'python',
        title: 'Chat server: handle one send frame',
        source: `async def on_send(conn, frame):
    conv, cid = frame["conversation_id"], frame["client_msg_id"]
    dedupe_key = f"sent:{conn.user_id}:{cid}"
    if (seq := await kv.get(dedupe_key)) is not None:   # a retry: ack, store nothing
        return await conn.send({"type": "ack", "client_msg_id": cid, "seq": int(seq)})

    seq = await kv.incr(f"seq:{conv}")                  # order inside this chat only
    msg = {"conversation_id": conv, "seq": seq, "message_id": snowflake.next(),
           "sender_id": conn.user_id, "body": frame["body"]}
    await messages.insert(msg)                          # durable before the ack
    await kv.set(dedupe_key, seq, ex=86_400)
    await conn.send({"type": "ack", "client_msg_id": cid, "seq": seq})

    for member in await members_of(conv):
        devices = await sessions.devices(member)        # {device_id: chat_server}
        for server in set(devices.values()):
            await bus.publish(f"server:{server}", msg)  # one hop per server
        if not devices and member != conn.user_id:
            await push_queue.enqueue({"user": member, "conv": conv, "seq": seq})`,
        highlight: [4, 7, 10, 12, 17, 19],
      },
    },
    {
      title: 'Offline, push',
      tag: 'concept',
      heading: 'Ben is offline: store, notify, sync on return',
      eli5: 'Ben is out of the hotel. The note waits in the notebook, and the desk sends a short text to Ben\'s own phone. When he comes back, the operator reads him every line after the last one he heard. That text is a **push notification**.',
      body: [
        'The registry has no devices for Ben. The message is already safe in the store, so nothing is lost. Server 1 puts a small job on the push queue, and the **push service** sends a notification through Apple\'s or Google\'s push gateway with the sender name and a preview. Use a queue with retries, because those gateways throttle and fail like any third party.',
        'When Ben opens the app, his phone reconnects and sends, for each conversation, the last sequence number it holds. The server reads everything newer from the store and streams it down. The socket is the fast path, and this **catch-up sync** is the path that guarantees delivery.',
        'Push volume needs limits of its own. Collapse a burst of 30 messages from one chat into one notification, and respect muted chats, so a busy group does not buzz a phone 30 times.',
      ],
      keyIdea: 'The store is the delivery guarantee. Push only tells the phone to come and fetch, and sync by sequence number does the rest.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms online', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [ana, { ...chat1, status: 'active' }, { ...registry, badge: 'ben: no devices' }, { ...store, status: 'ok', badge: 'seq 814 saved' }, { ...push, status: 'active', badge: '1 alert per burst' }, { ...ben, status: 'dim', badge: 'app closed' }],
        links: [{ from: 'ana', to: 'chat1' }, { from: 'chat1', to: 'registry', style: 'dashed' }, { from: 'chat1', to: 'store' }, { from: 'chat1', to: 'push' }, { from: 'push', to: 'ben', style: 'dashed' }],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'send', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append 814', duration: 1.3, delay: 1.1 },
          { path: ['chat1', 'registry'], tone: 'request', label: 'Ben online?', duration: 1.1, delay: 1.1 },
          { path: ['chat1', 'push'], tone: 'event', label: 'notify job', duration: 1.4, delay: 2.5 },
          { path: ['push', 'ben'], tone: 'event', label: 'Ana: on my way', duration: 1.4, delay: 4 },
        ],
        caption: 'Offline: the store keeps it, push points the way',
      },
    },
    {
      title: 'Devices, receipts',
      tag: 'concept',
      heading: 'Every device keeps its own place, receipts are one number',
      eli5: 'Ben has a phone and a laptop, and each keeps its own bookmark in the notebook. When Ben reads a note, he writes "read up to line 814", and Ana sees the **read receipt**.',
      body: [
        '**Multi-device sync.** Each device is its own session in the registry and its own socket, so a new message goes to every online device. Each device tracks, per conversation, the highest sequence number it has. A laptop that slept all day catches up from its own number without caring what the phone has seen.',
        '**Read receipts.** Storing "read" per message per member would multiply writes. Store one number per member per conversation instead: `last_read_seq`. When Ben reads on his phone, the phone sends `read up_to_seq 814`. The server updates that one value and sends a small receipt event to Ana and to Ben\'s laptop, which clears its unread badge. Delivered receipts work the same way with `last_delivered_seq`.',
        'Receipts are cheap events and can be batched or dropped under load. The message is precious, the receipt is a hint.',
      ],
      keyIdea: 'Sync and receipts both reduce to one sequence number per device or per member, so they stay cheap at any volume.',
      metrics: { conns: '30M', msgs: '150K/s + receipts', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, badge: 'seen' }, chat1, bus, { ...chat2, status: 'active' }, { ...ben, status: 'active', badge: 'read 814' }, { ...benLaptop, status: 'ok', badge: 'badge cleared' }, { ...store, badge: 'last_read = 814' }],
        links: [...serverLinks, { from: 'chat2', to: 'benLaptop' }, { from: 'chat2', to: 'store', style: 'dashed' }],
        flows: [
          { path: ['ben', 'chat2'], tone: 'request', label: 'read up to 814', duration: 1 },
          { path: ['chat2', 'store'], tone: 'data', label: 'last_read_seq', duration: 1.3, delay: 1.1 },
          { path: ['chat2', 'benLaptop'], tone: 'event', label: 'clear badge', duration: 1.2, delay: 2.5 },
          { path: ['chat2', 'bus', 'chat1', 'ana'], tone: 'event', label: 'receipt', duration: 2, delay: 2.5 },
        ],
        caption: 'One number per member, sent to every device',
      },
      quiz: {
        question: 'Ben\'s laptop was asleep for 6 hours while his phone stayed online. How does the laptop catch up when it wakes?',
        options: [
          'The phone forwards everything it received to the laptop',
          'It sends its own last sequence number per conversation and the server streams everything newer from the store',
          'The server replays every push notification sent in those 6 hours',
          'It downloads the full history of every conversation again',
        ],
        answer: 1,
        explain: 'Each device keeps its own cursor. On reconnect it asks for messages with a higher sequence number, and the store answers with one range read per conversation. Push notifications carry no guarantee and the phone is not a relay.',
      },
    },
    {
      title: 'Presence, groups',
      tag: 'tradeoff',
      heading: 'Presence and groups: cap the fan-out',
      eli5: 'Each room has a light that stays on while the guest checks in every half minute. Only guests looking at your door see the light change. A tour group\'s note goes once to each operator, who hands it to the group\'s guests on their lines. That is **fan-out**.',
      body: [
        '**Presence.** Each device sends a heartbeat every 30 seconds to its chat server. The server marks the user offline only after about 60 seconds of silence, so a train tunnel does not flicker the green dot. The registry stores status and `last_seen`. The real-time lesson covers the heartbeat mechanics.',
        'Presence fan-out is the trap. Pushing every change of every user to all their contacts turns 30M flickering devices into a storm. Send presence only to users who are looking: a client subscribes to the people in the chat it has open, and fetches the rest when it opens the contact list.',
        '**Groups.** A group message is stored once, in the group\'s partition. Delivery goes to the online members\' devices, grouped by server, so a 500-member group spread over 80 servers costs 80 publishes. The member cap keeps that bounded. Very large channels (100K members) need a different mode: no presence, no per-member receipts, members pull when they open the channel, and push only for mentions.',
      ],
      keyIdea: 'Anything that fans out to every member or contact needs a cap or a pull mode, or it grows faster than the user base.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '150 ms (groups)', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, label: 'Ana', sub: 'group: hikers' }, { ...chat1, status: 'active' }, { ...bus, status: 'active', badge: '1 copy per server' }, { ...chat2, status: 'active', badge: '3 members here' }, ben, benLaptop, { ...registry, status: 'ok', badge: 'ben: online, 60 s' }, { ...store, badge: 'stored once' }],
        links: [...serverLinks, { from: 'chat2', to: 'benLaptop' }, { from: 'chat1', to: 'store' }, { from: 'chat1', to: 'registry', style: 'dashed' }],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'to hikers', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append once', duration: 1.3, delay: 1.1 },
          { path: ['chat1', 'bus', 'chat2'], tone: 'event', label: 'server:chat-2', duration: 1.6, delay: 2.5 },
          { path: ['chat2', 'ben'], tone: 'event', duration: 1, delay: 4.2 },
          { path: ['chat2', 'benLaptop'], tone: 'event', duration: 1, delay: 4.2 },
          { path: ['ben', 'chat2'], tone: 'handshake', label: 'heartbeat 30 s', duration: 1, delay: 5.4 },
        ],
        caption: 'Store once, deliver once per server',
      },
    },
    {
      title: 'Server dies',
      tag: 'case',
      heading: 'Case: chat server 2 crashes with 100K sockets',
      eli5: 'An operator\'s switchboard breaks and 100K guests lose their lines at once. The concierge sends them to other operators, a few at a time, and each guest says "my last line was 814" to catch up.',
      body: [
        'Server 2 dies. Its devices notice within one heartbeat interval and reconnect. If they all retry at once, 100K logins hit discovery in the same second. Clients reconnect with **exponential backoff and jitter** (the timeouts and retries lesson), spreading the herd over about 30 seconds, roughly 3K reconnects per second. Discovery has already dropped server 2 after its missed health checks and spreads the devices across servers with room.',
        'Their old registry entries point at a dead server. Each entry has a TTL, and a reconnect overwrites it, so messages sent meanwhile are routed nowhere for a few seconds. That is fine, because they are already in the store. Each device syncs from its last sequence number and gets them.',
        'Sends that were in flight on server 2 either reached the store (and get acked on resend thanks to `client_msg_id`) or did not (and the resend stores them now). Either way the message appears exactly once. A planned deploy is the same event, so drain servers a slice at a time.',
      ],
      keyIdea: 'Sockets are disposable and messages are not. Jittered reconnects, TTL registry entries and sync by sequence number make a crash a short delay.',
      metrics: { conns: '29.9M (100K reconnecting)', msgs: '150K/s', latency: 'seconds for 0.3%', servers: '399', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat1, status: 'active', badge: 'takes reconnects' }, bus, { ...chat2, status: 'down', badge: 'crashed' }, { ...ben, status: 'active', badge: 'backoff + jitter' }, { ...benLaptop, status: 'active' }, { ...discovery, status: 'active', badge: 'chat-2 removed' }, { ...registry, badge: 'TTL expired' }, { ...store, status: 'ok', badge: 'seq > 814' }],
        links: [
          { from: 'chat1', to: 'bus' },
          { from: 'bus', to: 'chat2', style: 'faint' },
          { from: 'ben', to: 'discovery', style: 'dashed' },
          { from: 'ben', to: 'chat1' },
          { from: 'benLaptop', to: 'chat1' },
          { from: 'chat1', to: 'store' },
          { from: 'chat1', to: 'registry', style: 'dashed' },
        ],
        flows: [
          { path: ['chat2', 'ben'], tone: 'error', label: 'socket closed', duration: 1 },
          { path: ['ben', 'discovery'], tone: 'request', label: 'new server?', duration: 1.4, delay: 1.2 },
          { path: ['ben', 'chat1'], tone: 'handshake', label: 'reconnect, last=814', duration: 1.4, delay: 2.8 },
          { path: ['chat1', 'store'], tone: 'request', label: 'seq > 814', duration: 1.2, delay: 4.3 },
          { path: ['chat1', 'ben'], tone: 'response', label: '815, 816', count: 2, duration: 1.4, delay: 5.6 },
        ],
        caption: 'Reconnect elsewhere, then sync from the store',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Many socket servers in front of one ordered log',
      eli5: 'Operators hold the lines, the concierge assigns them, the board says who is where, and the **notebook** per conversation keeps every note in order. Lose a line and you lose nothing.',
      body: [
        'Devices hold WebSockets to about 400 chat servers chosen by **discovery**, and a **session registry** maps users to servers. A send gets a per-conversation sequence number, is stored in a wide-column table keyed by conversation, is acked, then routed through a server bus to every online device.',
        'Offline users get a **push notification** and sync by sequence number when they return. Each device keeps its own cursor, receipts are one `last_read_seq` per member, presence goes only to people who are looking, and group fan-out is capped. A dead server costs a jittered reconnect and a sync, and every stored message survives it.',
      ],
      keyIdea: 'Treat connections as cheap and replaceable, and the per-conversation log as the one thing that must be right.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [ana, chat1, bus, chat2, ben, discovery, { ...registry, status: 'ok' }, { ...store, status: 'ok' }, push],
        links: [...serverLinks, { from: 'chat1', to: 'store' }, { from: 'chat1', to: 'registry', style: 'dashed' }, { from: 'chat1', to: 'push', style: 'faint' }, { from: 'ana', to: 'discovery', style: 'faint' }],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', duration: 1.3, delay: 1.1 },
          { path: ['chat1', 'bus', 'chat2', 'ben'], tone: 'event', duration: 2, delay: 2.5 },
        ],
      },
      quiz: {
        question: 'A user\'s phone sends a message, the server stores it, and the ack is lost when the phone enters a tunnel. The phone resends. What keeps the chat from showing the message twice?',
        options: [
          'The server compares message bodies and drops identical text',
          'The resend carries the same client_msg_id, so the server returns the original sequence number instead of storing a new message',
          'The message store rejects writes with the same timestamp',
          'The receiver hides messages that arrive within one second of each other',
        ],
        answer: 1,
        explain: 'The client-generated id makes the send idempotent. Comparing text would drop real repeats like "ok", and timestamps are neither unique nor trustworthy across devices.',
      },
    },
  ],
};
