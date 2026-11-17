import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Layout: devices and chat servers on the top row, shared services on the bottom row.
const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-5, -6), label: 'Ana', sub: 'phone' };
const chat1: SceneNode = { id: 'chat1', kind: 'block', at: at(-1.7, -6), label: 'chat server 1', sub: '100K sockets', icon: 'Server', tint: 'blue' };
const chat2: SceneNode = { id: 'chat2', kind: 'block', at: at(1.7, -6), label: 'chat server 2', sub: '100K sockets', icon: 'Server', tint: 'blue' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(5, -6), label: 'Ben', sub: 'phone' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-5, 3), label: 'API servers', sub: 'login, history', icon: 'Network', tint: 'violet' };
const discovery: SceneNode = { id: 'discovery', kind: 'block', at: at(-1.7, 3), label: 'discovery', sub: 'picks a server', icon: 'Route', tint: 'teal' };
const registry: SceneNode = { id: 'registry', kind: 'cache', at: at(-3.4, 7), label: 'session registry', sub: 'user to server' };
const bus: SceneNode = { id: 'bus', kind: 'queue', at: at(0, 7), label: 'server bus', sub: 'pub/sub' };
const store: SceneNode = { id: 'store', kind: 'db', at: at(3.4, 7), label: 'message store', sub: 'by conversation' };
const benLaptop: SceneNode = { id: 'benLaptop', kind: 'client', at: at(5, 3), label: 'Ben', sub: 'laptop' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designChat: Lesson = {
  id: 'design-chat',
  title: 'Design a chat system (part 1)',
  tagline: 'Chat for 100 million daily users, part 1: the numbers, WebSocket servers, finding the right one, ordered history and a safe send.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Scale numbers for connections, messages and storage',
    'Polling versus WebSockets, and stateful chat servers beside stateless HTTP',
    'Why one server breaks, and how discovery and a session registry fix it',
    'Why chat history goes in a wide-column store keyed by conversation',
    'Per-conversation sequence numbers, store-before-ack and retry deduplication',
    'Rate limits on send and multi-region placement',
  ],
  metrics: [
    { key: 'conns', label: 'Open sockets', icon: 'Plug' },
    { key: 'msgs', label: 'Messages', icon: 'Zap' },
    { key: 'latency', label: 'Delivery p99', icon: 'Timer' },
    { key: 'servers', label: 'Chat servers', icon: 'Server' },
    { key: 'storage', label: 'New history', icon: 'HardDrive' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Chat for 100 million people a day',
      eli5: 'A huge hotel where guests send notes to each other all day. The **chat system** is the hotel\'s note service: every note must reach the right room fast, in order, and be kept in the log forever.',
      body: [
        'Scope: one-to-one chats and groups of up to 500 members, text messages, an online indicator, several devices per account, push notifications when the app is closed, delivered and read receipts, and history kept forever. Media and end-to-end encryption are out of scope for the core design (part 2 looks at them).',
        'Targets: a message between two online users arrives in under **300 ms at p99**. No acknowledged message is ever lost, and everyone in a conversation sees the same order.',
      ],
      keyIdea: 'Chat is two hard problems at once: millions of open connections, and an ordered log that is never allowed to lose a line.',
      metrics: { conns: '?', msgs: '?', latency: 'target < 300 ms', servers: '?', storage: 'forever' },
      scene: {
        nodes: [
          { ...ana, chips: ['"on my way"'] },
          { ...chat1, label: 'chat service', sub: '?', tint: 'gray' },
          { ...store, badge: 'kept forever' },
          ben,
        ],
        links: [link('ana', 'chat1'), link('chat1', 'ben'), link('chat1', 'store')],
        flows: [
          { path: ['ana', 'chat1', 'ben'], tone: 'request', label: '"on my way"', duration: 2 },
          { path: ['chat1', 'store'], tone: 'data', duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'Scope and targets',
          icon: 'List',
          rows: [
            { text: 'Chats', value: '1:1, groups to 500' },
            { text: 'Features', value: 'receipts, presence, push' },
            { text: 'History', value: 'forever' },
            { text: 'Delivery p99', value: '< 300 ms', tone: 'good' },
            { text: 'Acked message lost', value: 'never', tone: 'good' },
            { text: 'Media, encryption', value: 'later', tone: 'muted' },
          ],
        },
        caption: 'Deliver fast, store forever, keep the order',
      },
    },
    {
      title: 'Napkin math',
      tag: 'concept',
      heading: 'About 150K messages a second and 30M open sockets',
      eli5: 'Count the notes first. A hotel with 100 million guests and 40 notes each a day needs a lot of runners, a lot of open phone lines, and a very big filing cabinet.',
      body: [
        '**100M daily users** send about 40 messages a day: 4 billion a day, about 46K per second on average and **150K/s at peak**. At peak about **30M devices** hold an open connection.',
        'A stored message with its metadata is about 200 bytes, so history grows by **800 GB a day**, around 300 TB a year before replication.',
      ],
      keyIdea: 'The two numbers that shape everything: 30M long-lived connections and 800 GB of new history every day.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: 'target < 300 ms', servers: '?', storage: '800 GB/day' },
      metricTones: { conns: 'warn', msgs: 'warn', storage: 'warn' },
      scene: {
        nodes: [
          { ...ana, chips: [{ text: '40 msgs/day', tone: 'warn' }] },
          { ...chat1, label: 'chat service', sub: '30M sockets', status: 'hot', load: 95 },
          { ...store, status: 'active', badge: '800 GB/day' },
        ],
        links: [link('ana', 'chat1', { label: '100M users', labelTone: 'warn' }), link('chat1', 'store')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['chat1', 'store'], tone: 'data', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Napkin math',
          icon: 'Gauge',
          rows: [
            { text: 'Messages per day', value: '4 billion' },
            { text: 'Average rate', value: '46K/s' },
            { text: 'Peak rate', value: '150K/s', tone: 'warn' },
            { text: 'Open sockets at peak', value: '30M', tone: 'warn' },
            { text: 'One stored message', value: '~200 B' },
            { text: 'History per year', value: '~300 TB', tone: 'warn' },
          ],
        },
        caption: 'Sizing before designing',
      },
    },
    {
      title: 'Why a socket',
      tag: 'concept',
      heading: 'Polling wastes requests, a WebSocket pushes',
      eli5: 'Asking the front desk "any notes for me?" every few seconds wears out everyone. A **WebSocket** is a phone line left open, so the operator can speak up the moment a note arrives.',
      body: [
        '**Polling** asks "anything new?" on a timer. At one request every 3 seconds, 30M devices make 10M requests a second, nearly all empty. **Long polling** holds each request open, but it reconnects after every message and ties up a server thread per user.',
        'A **WebSocket** is one persistent two-way connection. The server pushes the instant a message exists, and the phone sends on the same line. The real-time lesson compares all three in depth.',
      ],
      keyIdea: 'Chat needs the server to speak first, so each device keeps one open socket instead of asking over and over.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: 'target < 300 ms', servers: '?', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, { ...chat1, status: 'active', badge: 'WebSocket' }, ben],
        links: [link('ana', 'chat1', { label: 'one open socket', arrow: 'both' }), link('chat1', 'ben', { label: 'pushes instantly', arrow: 'both' })],
        flows: [
          { path: ['ana', 'chat1'], tone: 'handshake', label: 'upgrade', duration: 1 },
          { path: ['ana', 'chat1', 'ben'], tone: 'request', label: 'on my way', duration: 2, delay: 1.2 },
        ],
        panel: {
          title: 'Three ways to get messages',
          icon: 'Signal',
          rows: [
            { text: 'Polling every 3 s', value: '10M req/s, empty', tone: 'bad' },
            { text: 'Long polling', value: 'reconnect per message', tone: 'warn' },
            { text: 'WebSocket', value: 'one socket, push', tone: 'good' },
          ],
        },
        caption: 'One open line per device',
      },
    },
    {
      title: 'Two traffic types',
      tag: 'concept',
      heading: 'A WebSocket for messages, plain HTTP for the rest',
      eli5: 'Each guest keeps a house phone line open to an operator for notes going both ways. Checking in, changing your name card or reading old notes is done at the front desk, the **API**.',
      body: [
        'Each device holds one socket to a **stateful** chat server. Frames are small JSON or binary messages: `send`, `ack`, `message`, `read` and `ping`.',
        'Everything else is ordinary HTTP on **stateless** API servers behind a load balancer: `POST /v1/login` returns a token and a chat server address, `GET /v1/conversations/{id}/messages?before_seq=800` pages history, and profiles and groups are plain REST. They scale like any web tier.',
      ],
      keyIdea: 'Use the socket only for what must be pushed in real time, and keep the rest on stateless HTTP.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: 'target < 300 ms', servers: '?', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, { ...chat1, status: 'active', badge: 'WebSocket' }, { ...api, status: 'active', badge: 'HTTP' }],
        links: [link('ana', 'chat1', { label: 'wss' }), link('ana', 'api', { style: 'dashed', label: 'https' })],
        flows: [
          { path: ['ana', 'api'], tone: 'request', label: 'POST /v1/login', duration: 1.1 },
          { path: ['api', 'ana'], tone: 'response', label: 'token + server', duration: 1.1, delay: 1.2 },
          { path: ['ana', 'chat1'], tone: 'request', label: 'send', duration: 1, delay: 2.5 },
          { path: ['chat1', 'ana'], tone: 'response', label: 'ack seq 813', duration: 1, delay: 3.6 },
        ],
        panel: {
          title: 'Who carries what',
          icon: 'Split',
          rows: [
            { text: 'Socket', value: 'send, ack, message, read' },
            { text: 'HTTP', value: 'login, history, groups' },
            { text: 'Chat servers', value: 'stateful', tone: 'warn' },
            { text: 'API servers', value: 'stateless', tone: 'good' },
          ],
        },
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
      title: 'Simple design',
      tag: 'concept',
      heading: 'First version: one chat server holds every socket',
      eli5: 'A small hotel has one operator. Every guest\'s line plugs into the same switchboard, so passing a note from Ana\'s room to Ben\'s is just moving it across the desk.',
      body: [
        'Start with one chat server. Ana and Ben both hold sockets to it. A message arrives on Ana\'s socket, the server appends it to the message store, acks Ana, and writes it down Ben\'s socket. Finding Ben is a lookup in a local map.',
        'With 50K people online this works well: one process, no cross-server routing, delivery in tens of milliseconds. It is a fine place to start an interview answer, as long as you say it is a starting point.',
      ],
      keyIdea: 'On one server, routing is a local map lookup. Everything hard about chat starts when there are two servers.',
      metrics: { conns: '50K', msgs: '300/s', latency: '40 ms', servers: '1', storage: '5 GB/day' },
      metricTones: { latency: 'good', servers: 'good' },
      scene: {
        nodes: [ana, { ...chat1, label: 'chat server', sub: 'one box', status: 'active' }, store, ben],
        links: [link('ana', 'chat1'), link('chat1', 'ben'), link('chat1', 'store')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'send', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append', duration: 1, delay: 1.1 },
          { path: ['chat1', 'ana'], tone: 'response', label: 'ack', duration: 1, delay: 2.2 },
          { path: ['chat1', 'ben'], tone: 'event', label: 'message', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Routing on one box',
          icon: 'Code',
          code: 'sockets = {\n  "ana": socket_1,\n  "ben": socket_2,\n}\nsockets["ben"].write(msg)',
          footer: { text: 'A dictionary lookup', tone: 'good' },
        },
        caption: 'Both sockets on one box',
      },
    },
    {
      title: 'Too many sockets',
      tag: 'case',
      heading: 'Case: 30 million sockets will not fit on one box',
      eli5: 'The hotel grows to millions of rooms. One operator cannot hold that many phone lines at once, and when the lines pile up, nobody gets through.',
      body: [
        'Each idle socket costs memory, a file descriptor and heartbeat work. A tuned server holds around **100K** comfortably, so 30M devices need about 300 chat servers, and closer to **400** with room for failures and deploys.',
        'One box would also be a single point of failure for every conversation. Spreading sockets across many servers is not optional.',
      ],
      keyIdea: 'Connections force many stateful servers, because one machine cannot hold them all and cannot be allowed to fail alone.',
      metrics: { conns: '30M', msgs: '150K/s', latency: 'timeouts', servers: '1 (need ~400)', storage: '800 GB/day' },
      metricTones: { latency: 'bad', servers: 'bad' },
      scene: {
        nodes: [
          { ...ana, status: 'hot', badge: 'cannot connect' },
          { ...chat1, label: 'chat server', sub: '100K max', status: 'hot', load: 100, chips: [{ text: '30,000,000 sockets', tone: 'bad' }] },
          { ...ben, status: 'hot', badge: 'timeout' },
        ],
        links: [link('ana', 'chat1', { label: 'connection refused', labelTone: 'warn' }), link('chat1', 'ben')],
        flows: [{ path: ['ana', 'chat1'], tone: 'error', label: 'no free socket', duration: 1.4 }],
        panel: {
          title: 'Sockets versus servers',
          icon: 'Gauge',
          rows: [
            { text: 'Sockets per server', value: '~100K' },
            { text: 'Open sockets at peak', value: '30M' },
            { text: 'Servers needed', value: '~300', tone: 'warn' },
            { text: 'With headroom', value: '~400', tone: 'good' },
          ],
        },
        caption: 'One box tops out at about 100K',
      },
    },
    {
      title: 'Wrong server',
      tag: 'case',
      heading: 'Case: Ana and Ben are on different servers',
      eli5: 'With many operators, Ana\'s operator does not have Ben\'s line at all. The note has nowhere to go until someone works out which operator holds Ben.',
      body: [
        'Spreading sockets creates two new questions. Which server should a device connect to? And when Ana\'s socket is on server 1 and Ben\'s is on server 2, how does server 1 get the message to Ben?',
        'With hundreds of servers, sender and receiver almost never share one, so every message needs routing to wherever the receiver happens to be.',
      ],
      keyIdea: 'Once sockets are spread out, every message first has to find which server holds the receiver.',
      metrics: { conns: '30M', msgs: '150K/s', latency: 'message stuck', servers: '400', storage: '800 GB/day' },
      metricTones: { latency: 'bad' },
      scene: {
        nodes: [ana, { ...chat1, status: 'active', chips: ['to: Ben'] }, { ...chat2, status: 'active', badge: 'Ben is here' }, { ...ben, status: 'hot', badge: 'no message' }],
        links: [link('ana', 'chat1'), link('chat1', 'chat2', { style: 'dashed', label: 'where is Ben?', labelTone: 'warn' }), link('chat2', 'ben')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'to Ben', duration: 1 },
          { path: ['chat1', 'chat2'], tone: 'error', label: '?', duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'Two open questions',
          icon: 'List',
          rows: [
            { text: '1. Where should a device connect?', tone: 'warn' },
            { text: '2. Where is the receiver now?', tone: 'warn' },
            { text: 'Same server as the sender', value: 'rare', tone: 'muted' },
          ],
        },
        caption: 'Ana\'s server does not know Ben\'s',
      },
    },
    {
      title: 'Discovery',
      tag: 'concept',
      heading: 'Discovery picks a chat server for each device',
      eli5: 'At check-in, the concierge looks at which operators have free lines and assigns you one nearby. The **concierge** is discovery, and guests always plug into the one it names.',
      body: [
        'After login, the API asks **discovery** for a chat server. Chat servers register and report their socket count in a coordination store such as ZooKeeper, etcd or Consul (the service discovery lesson).',
        'Discovery picks a healthy server in the user\'s region with spare room and returns its address. The phone opens a WebSocket straight to it. Steering new connections to the emptiest servers also fills new servers added during a busy evening.',
      ],
      keyIdea: 'Discovery decides where a device connects, using live load and health from the servers themselves.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, status: 'active' }, { ...api, status: 'active' }, { ...discovery, status: 'active', badge: 'least loaded' }, { ...chat1, status: 'ok', badge: '38K / 100K' }, chat2],
        links: [
          link('ana', 'api'),
          link('api', 'discovery'),
          link('ana', 'chat1'),
          link('chat1', 'discovery', { style: 'faint' }),
          link('chat2', 'discovery', { style: 'faint' }),
        ],
        flows: [
          { path: ['ana', 'api', 'discovery'], tone: 'request', label: 'login', duration: 1.5 },
          { path: ['discovery', 'api', 'ana'], tone: 'response', label: 'wss://chat-1', duration: 1.5, delay: 1.6 },
          { path: ['ana', 'chat1'], tone: 'handshake', label: 'WebSocket', duration: 1.1, delay: 3.2 },
        ],
        panel: {
          title: 'Servers report in',
          icon: 'Server',
          rows: [
            { text: 'chat-1', value: '38K / 100K', tone: 'good' },
            { text: 'chat-2', value: '61K / 100K' },
            { text: 'chat-3', value: '97K / 100K', tone: 'warn' },
          ],
          footer: { text: 'Pick chat-1: the most room', tone: 'good' },
        },
        caption: 'Login, get a server, connect',
      },
    },
    {
      title: 'Session registry',
      tag: 'concept',
      heading: 'A session registry records who is connected where',
      eli5: 'A board in the back lists which operator holds every guest\'s line. Anyone with a note for Ben looks at the **session registry** board to see his operator.',
      body: [
        'When the socket opens, the chat server writes the device into the **session registry**: `ben -> {phone: chat-2, laptop: chat-2}`. It is a fast key-value store such as Redis. The server keeps refreshing a **TTL** on the entry.',
        'That one lookup tells any server where Ben\'s devices are right now. If a server dies, its entries expire by themselves instead of pointing at a dead machine forever.',
      ],
      keyIdea: 'Discovery decides where a device connects. The session registry records where it connected, so messages can find it.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat2, status: 'active' }, { ...registry, status: 'ok', badge: 'ben: chat-2' }, { ...ben, status: 'active' }, { ...benLaptop, status: 'active' }],
        links: [link('ben', 'chat2'), link('benLaptop', 'chat2'), link('chat2', 'registry', { style: 'dashed' })],
        flows: [
          { path: ['ben', 'chat2'], tone: 'handshake', label: 'WebSocket', duration: 1.2 },
          { path: ['benLaptop', 'chat2'], tone: 'handshake', label: 'WebSocket', duration: 1.2, delay: 0.3 },
          { path: ['chat2', 'registry'], tone: 'data', label: 'ben: phone, laptop', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Registry entry',
          icon: 'Key',
          code: 'ben -> {\n  phone:  chat-2,\n  laptop: chat-2\n}\nTTL 60 s, refreshed',
        },
        caption: 'Connect, then register',
      },
      quiz: {
        question: 'Why does every session registry entry carry a TTL that the chat server keeps refreshing?',
        options: [
          'It saves memory in the registry, nothing else',
          'If a chat server dies, its entries expire instead of pointing at a dead machine forever',
          'It makes messages expire after 60 seconds',
          'It limits how often a user can send',
        ],
        answer: 1,
        explain: 'A crashed server cannot clean up after itself. A live server keeps refreshing its entries, so only entries of dead servers run out, and the next reconnect overwrites them.',
      },
    },
    {
      title: 'Access pattern',
      tag: 'concept',
      heading: 'Look at how history is read and written first',
      eli5: 'Before buying notebooks, watch how the hotel uses them. Staff only ever add a line at the end, and guests almost always open the last page of one conversation.',
      body: [
        'Writes are 150K/s at peak and never updated. Reads are almost always "the newest 50 messages of conversation 42" or "everything after seq 812". Read and write volumes are about equal.',
        'Data grows forever and old messages are rarely read. So the store must append fast, read one conversation\'s tail fast, and grow by adding machines.',
      ],
      keyIdea: 'Design the store from the two reads that matter: the newest page of a conversation, and everything after a sequence number.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat1, status: 'active' }, { ...store, status: 'active', badge: '150K writes/s' }, { ...api, status: 'active' }],
        links: [link('chat1', 'store'), link('api', 'store')],
        flows: [
          { path: ['chat1', 'store'], tone: 'data', label: 'append seq 813', count: 3, duration: 1.4 },
          { path: ['api', 'store'], tone: 'request', label: 'newest 50', duration: 1.3, delay: 1.6 },
          { path: ['store', 'api'], tone: 'response', duration: 1.3, delay: 3 },
        ],
        panel: {
          title: 'The workload',
          icon: 'Table',
          rows: [
            { text: 'Writes', value: 'append only' },
            { text: 'Updates', value: 'almost none' },
            { text: 'Common read', value: 'newest 50' },
            { text: 'Catch-up read', value: 'seq > 812' },
            { text: 'Old messages', value: 'rarely read', tone: 'muted' },
          ],
        },
        caption: 'Append at the end, read the tail',
      },
    },
    {
      title: 'Wide-column store',
      tag: 'tradeoff',
      heading: 'A wide-column store, partitioned by conversation',
      eli5: 'The hotel keeps one notebook per conversation and only ever adds lines at the end. Opening a chat means reading the last page of that one **notebook**.',
      body: [
        'A single SQL database handles none of that at 300 TB a year. A **wide-column store** (the SQL and NoSQL lesson) fits: partition by conversation, sort by sequence inside the partition, and every common query is one sequential read from one partition.',
        'Its LSM-tree engine (the storage engines lesson) is built for heavy append writes, and adding nodes adds capacity.',
      ],
      keyIdea: 'Put one conversation in one partition, sorted by sequence, so every common read touches a single place.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat1, status: 'active' }, { ...store, status: 'active', badge: 'partition: chat 42' }, { ...api, status: 'active' }],
        links: [link('chat1', 'store'), link('api', 'store')],
        flows: [
          { path: ['chat1', 'store'], tone: 'data', label: 'append', duration: 1.3 },
          { path: ['api', 'store'], tone: 'request', label: 'one partition', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'One partition, sorted',
          icon: 'Database',
          code: 'partition: conversation 42\n  seq 811  "see you"\n  seq 812  "where?"\n  seq 813  "on my way"',
          footer: { text: 'Reads are one sequential scan', tone: 'good' },
        },
        caption: 'One conversation, one partition',
      },
    },
    {
      title: 'Buckets',
      tag: 'tradeoff',
      heading: 'Cap the partition with a time bucket',
      eli5: 'A notebook that never ends gets too heavy to carry. So the hotel starts a fresh notebook for each month of a chat. To read the latest lines, you check this month first, then last month.',
      body: [
        'A group that has chatted for years would grow one enormous partition. Add a time **bucket** to the key, such as the month, so no partition grows without limit.',
        'To open a chat, read the current bucket, then the previous one, until you have 50 rows. A catch-up loops over every bucket since the bucket of the cursor.',
      ],
      keyIdea: 'Bucket the big append-only table by time, and walk back bucket by bucket until the page is full.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [
          { ...chat1, status: 'active' },
          { ...store, status: 'active', badge: '(chat 42, 202611)' },
          { ...api, status: 'active' },
        ],
        links: [link('chat1', 'store'), link('api', 'store')],
        flows: [
          { path: ['chat1', 'store'], tone: 'data', label: 'bucket 202611', duration: 1.4 },
          { path: ['api', 'store'], tone: 'request', label: 'newest 50', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Reading across buckets',
          icon: 'Layers',
          rows: [
            { text: 'Open a chat', value: 'current bucket, then previous' },
            { text: 'Stop when', value: '50 rows found' },
            { text: 'Catch-up', value: 'every bucket since the cursor' },
            { text: 'Partition key', value: 'conversation + month' },
          ],
        },
        caption: 'Bounded partitions, read newest bucket first',
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

-- open a chat: newest page from the current bucket.
-- Fewer than 50 rows? Repeat with bucket = 202610, then 202609, until full.
SELECT * FROM messages
 WHERE conversation_id = 42 AND bucket = 202611 LIMIT 50;

-- a device comes back: loop over each bucket from the cursor's bucket
-- (the one holding seq 812) up to the current one.
SELECT * FROM messages
 WHERE conversation_id = 42 AND bucket = 202611 AND seq > 812;`,
        highlight: [3, 8, 12, 17],
      },
    },
    {
      title: 'Small data',
      tag: 'concept',
      heading: 'Keep users and groups in SQL',
      eli5: 'The hotel keeps guest names and room lists in a small ledger of its own. It is tiny, and the clerk often needs to look things up across pages, so a normal ledger works fine.',
      body: [
        'Users, profiles and group membership stay in a relational database, where joins and transactions help and the data is small.',
        'Only the huge, append-only message log needs the wide-column store.',
      ],
      keyIdea: 'Match the store to the data: relational for small, linked records, wide-column for the giant log.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { id: 'usersDb', kind: 'db', at: at(-1.7, 7), label: 'user database', sub: 'SQL, small', tint: 'violet', status: 'active' },
          { ...store, badge: '(chat 42, 202611)' },
        ],
        links: [link('api', 'usersDb'), link('api', 'store')],
        flows: [
          { path: ['api', 'usersDb'], tone: 'request', label: 'profile, groups', duration: 1.4 },
          { path: ['api', 'store'], tone: 'request', label: 'history', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Where data lives',
          icon: 'Layers',
          rows: [
            { text: 'Messages', value: 'wide-column', tone: 'good' },
            { text: 'Users, profiles', value: 'SQL' },
            { text: 'Group membership', value: 'SQL' },
            { text: 'Edit, delete', value: 'new events, see part 2' },
          ],
        },
        caption: 'SQL for the small stuff, wide-column for the log',
      },
    },
    {
      title: 'Replicas',
      tag: 'tradeoff',
      heading: 'Availability first: three copies, acked on two',
      eli5: 'The hotel photocopies every notebook page into three filing rooms. A note counts as filed once two rooms have it, so one flooded room never loses anything.',
      body: [
        'Chat prefers staying available over perfectly fresh reads (the CAP lesson): people send from flaky networks, and a brief gap between copies is fine because the log is append-only and ordered by sequence.',
        'Each partition has 3 replicas. A write is acked once 2 of 3 have it, so a single node failure loses nothing and blocks nobody.',
      ],
      keyIdea: 'Replicate every partition and ack on a quorum, so an acknowledged message survives any single machine.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '2.4 TB/day (3 copies)' },
      scene: {
        nodes: [
          chat1,
          { ...store, label: 'replica A', sub: 'ack', status: 'ok' },
          { id: 'repB', kind: 'db', at: at(0, 7), label: 'replica B', sub: 'ack', status: 'ok' },
          { id: 'repC', kind: 'db', at: at(-3.4, 7), label: 'replica C', sub: 'slow', status: 'dim' },
        ],
        links: [link('chat1', 'store'), link('chat1', 'repB'), link('chat1', 'repC', { style: 'dashed' })],
        flows: [
          { path: ['chat1', 'store'], tone: 'data', label: 'write', duration: 1.4 },
          { path: ['chat1', 'repB'], tone: 'data', label: 'write', duration: 1.4 },
          { path: ['chat1', 'repC'], tone: 'data', duration: 2.2 },
        ],
        panel: {
          title: 'Quorum write',
          icon: 'Copy',
          rows: [
            { text: 'Replicas per partition', value: '3' },
            { text: 'Acks needed', value: '2', tone: 'good' },
            { text: 'One node down', value: 'no data lost', tone: 'good' },
            { text: 'Disk cost', value: '3x', tone: 'warn' },
          ],
        },
        caption: 'Two of three is enough to ack',
      },
    },
    {
      title: 'Sequence numbers',
      tag: 'concept',
      heading: 'Order with a counter per conversation',
      eli5: 'Every line in a notebook gets the next line number. Two guests talking only need their own notebook to agree on the order, so nobody needs one huge hotel-wide counter.',
      body: [
        'Order only has to be agreed inside one conversation, so the counter is per conversation: small, independent and easy to shard. One **sequencer** owns each conversation, so two sends never race for the same number.',
        'Timestamps cannot order messages, because phone clocks disagree and two messages can share a millisecond.',
      ],
      keyIdea: 'Agree on order only where it matters: a counter per conversation, never a clock.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '-', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: ['"on my way"'] }, { ...chat1, status: 'active', badge: 'seq 813' }, ben],
        links: [link('ana', 'chat1'), link('chat1', 'ben')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'send', duration: 1.2 },
          { path: ['chat1', 'ben'], tone: 'event', label: 'seq 813', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Ways to order',
          icon: 'Hash',
          rows: [
            { text: 'Phone timestamp', value: 'clocks disagree', tone: 'bad' },
            { text: 'Server timestamp', value: 'ties in a ms', tone: 'warn' },
            { text: 'One global counter', value: 'bottleneck', tone: 'warn' },
            { text: 'Counter per conversation', value: 'small, shardable', tone: 'good' },
            { text: 'Counter owner', value: 'one per conversation', tone: 'good' },
          ],
        },
        caption: 'The next number in this chat',
      },
    },
    {
      title: 'Store, then ack',
      tag: 'concept',
      heading: 'Number it, store it, ack it',
      eli5: 'The operator writes the note in the conversation notebook with the next line number, and only then tells Ana "got it". If the operator says "got it" first and the pen runs dry, the note is lost.',
      body: [
        'Route by conversation id so one sequencer assigns each number and writes the message as one ordered step, **before** the ack. Gaps are allowed. Out-of-order visibility is not, or a device could skip a message.',
        'Ana\'s phone shows a single tick on the ack. If the server crashed before the write, no ack was sent, and the phone tries again.',
      ],
      keyIdea: 'Durable first, then ack. An ack is a promise the message is stored.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '40 ms to ack', servers: '400', storage: '800 GB/day' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [{ ...ana, chips: ['"on my way"'] }, { ...chat1, status: 'active', badge: 'seq 813' }, { ...store, status: 'active' }],
        links: [link('ana', 'chat1'), link('chat1', 'store')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'send c-9f2e', duration: 1.1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append 813', duration: 1.3, delay: 1.2 },
          { path: ['store', 'chat1'], tone: 'response', label: 'stored', duration: 1.1, delay: 2.6 },
          { path: ['chat1', 'ana'], tone: 'response', label: 'ack 813', duration: 1.1, delay: 3.8 },
        ],
        panel: {
          title: 'Order of events',
          icon: 'List',
          rows: [
            { text: '1. owner takes next seq', value: '813' },
            { text: '2. write to store', value: 'durable', tone: 'good' },
            { text: '3. ack the sender', value: 'seq 813', tone: 'good' },
            { text: '4. route to receivers', value: 'next step' },
          ],
        },
        caption: 'Write before ack',
      },
    },
    {
      title: 'Route it',
      tag: 'concept',
      heading: 'Look up the receiver, route through the bus',
      eli5: 'Once the note is filed, the operator checks the board for Ben\'s operator and sends the note through the back room. Ben\'s operator reads it down his line.',
      body: [
        'Server 1 looks up each member\'s devices in the session registry and publishes once per destination server on the **server bus** (the pub/sub lesson). Server 2 writes it down Ben\'s socket.',
        'Delivery takes about **120 ms** at p99. Sender and receiver can sit on any two of the 400 servers, and the path is the same.',
      ],
      keyIdea: 'Look up where the receiver is, then publish once per destination server on a bus.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...chat1, status: 'active', badge: 'seq 813' },
          { ...registry, badge: 'ben: chat-2' },
          { ...bus, status: 'active' },
          { ...chat2, status: 'active' },
          { ...ben, status: 'ok', chips: ['"on my way"'] },
        ],
        links: [link('chat1', 'registry', { style: 'dashed' }), link('chat1', 'bus'), link('bus', 'chat2'), link('chat2', 'ben')],
        flows: [
          { path: ['chat1', 'registry'], tone: 'request', label: 'where is Ben?', duration: 1.3 },
          { path: ['registry', 'chat1'], tone: 'response', label: 'chat-2', duration: 1.3, delay: 1.4 },
          { path: ['chat1', 'bus', 'chat2', 'ben'], tone: 'event', label: 'message 813', duration: 2.2, delay: 2.9 },
        ],
        caption: 'Registry lookup, bus hop, socket write',
      },
      code: {
        language: 'python',
        title: 'Chat server: route a stored message',
        source: `async def route(conv, msg):
    for member in await members_of(conv):
        devices = await sessions.devices(member)        # {device_id: chat_server}
        for server in set(devices.values()):
            await bus.publish(f"server:{server}", msg)  # one hop per server`,
        highlight: [3, 4, 5],
      },
    },
    {
      title: 'Safe retries',
      tag: 'concept',
      heading: 'A client id makes retries safe',
      eli5: 'Ana writes a number on each note before handing it over. If she is unsure it arrived and hands it over again, the operator sees the same number and says "already filed" instead of writing it twice.',
      body: [
        'Every `send` carries a `client_msg_id` the phone generates. The store inserts a message only if (conversation, sender, client id) is new, in one atomic step, so a crash or two racing retries cannot store it twice.',
        'A resend finds the original row and gets the original sequence number back. The spare number it took becomes a harmless gap.',
      ],
      keyIdea: 'An atomic insert keyed by the client id makes the send idempotent, so at-least-once retries give one stored message.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: [{ text: 'tunnel', tone: 'warn' }] }, { ...chat1, status: 'active', badge: 'seen c-9f2e' }, { ...store, status: 'ok', badge: 'one copy' }],
        links: [link('ana', 'chat1', { label: 'ack lost', labelTone: 'warn' }), link('chat1', 'store')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'send c-9f2e', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append 813', duration: 1.1, delay: 1.1 },
          { path: ['chat1', 'ana'], tone: 'error', label: 'ack lost', duration: 1.1, delay: 2.4 },
          { path: ['ana', 'chat1'], tone: 'request', label: 'resend c-9f2e', duration: 1, delay: 3.8 },
          { path: ['chat1', 'ana'], tone: 'response', label: 'ack 813 (same)', duration: 1, delay: 5 },
        ],
        panel: {
          title: 'Dedupe check',
          icon: 'Copy',
          code: 'key = (conv, sender, "c-9f2e")\napplied = insert_if_new(key, msg)\n# atomic and durable\nif not applied: ack(existing.seq)',
          footer: { text: 'Same triple, same sequence number', tone: 'good' },
        },
        caption: 'The resend returns the original seq',
      },
      code: {
        language: 'python',
        title: 'Chat server: handle one send frame',
        source: `async def on_send(conn, frame):
    conv, cid = frame["conversation_id"], frame["client_msg_id"]
    seq = await sequencer.next(conv)             # one owner per conversation
    msg = {"conversation_id": conv, "seq": seq, "sender_id": conn.user_id,
           "message_id": stable_id(conv, conn.user_id, cid),   # same triple, same id
           "body": frame["body"]}

    # atomic and durable: inserts only if (conv, sender, cid) is new
    applied, row = await messages.insert_if_new(msg, key=(conv, conn.user_id, cid))
    if not applied:                              # a retry: use the stored seq
        seq = row["seq"]                         # our spare number is a gap
    await conn.send({"type": "ack", "client_msg_id": cid, "seq": seq})
    if applied:
        await route(conv, msg)`,
        highlight: [3, 8, 9, 10],
      },
    },
    {
      title: 'Rate limits',
      tag: 'concept',
      heading: 'Limit sends per user at the chat server',
      eli5: 'The operator only files so many notes per minute from one guest. A guest who shouts a thousand notes a second gets told to slow down, so the lines stay free for everyone else.',
      body: [
        'A bot or a bug can flood a chat. The chat server counts sends per user in a short window (a token bucket in a shared counter) and rejects the excess with a `slow_down` frame before it takes a sequence number.',
        'Cheap checks go first: a per-user send rate, a per-conversation rate and a cap on body size. Spam scoring runs later, off the hot path.',
      ],
      keyIdea: 'Reject excess sends before they cost a sequence number, a write or a fan-out.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: [{ text: '50 sends in 1 s', tone: 'warn' }] }, { ...chat1, status: 'active', badge: 'limit: 5/s' }, { ...store, status: 'ok' }],
        links: [link('ana', 'chat1', { label: 'over the limit', labelTone: 'warn' }), link('chat1', 'store')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'burst', count: 3, duration: 1.2 },
          { path: ['chat1', 'ana'], tone: 'error', label: 'slow_down', duration: 1.2, delay: 1.5 },
          { path: ['chat1', 'store'], tone: 'data', label: 'allowed sends only', duration: 1.3, delay: 3 },
        ],
        panel: {
          title: 'Send limits',
          icon: 'Gauge',
          rows: [
            { text: 'Per user', value: '5 sends/s, burst 20' },
            { text: 'Per conversation', value: 'capped' },
            { text: 'Body size', value: 'max 64 KB' },
            { text: 'Spam scoring', value: 'async, off the hot path' },
          ],
        },
        caption: 'Excess sends stop at the door',
      },
    },
    {
      title: 'Regions',
      tag: 'concept',
      heading: 'Connect to the nearest region, bridge regions on the bus',
      eli5: 'Hotels in two cities each have their own operators and board. A guest uses the nearby hotel. A note to someone in the other city goes through a special phone line between the hotels.',
      body: [
        'Discovery sends each device to a chat server in the nearest region, so the socket stays short. Each region has its own servers and registry.',
        'When a member sits in another region, the message crosses on a **cross-region bus** and the far region delivers it. History is replicated across regions. Search is its own system (the search lesson).',
      ],
      keyIdea: 'Keep sockets local, and let only the message hop between regions.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms same region', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, badge: 'region A' }, { ...chat1, status: 'active', badge: 'region A' }, { ...bus, status: 'active', badge: 'cross-region' }, { ...chat2, status: 'active', badge: 'region B' }, { ...ben, badge: 'region B' }],
        links: [link('ana', 'chat1'), link('chat1', 'bus'), link('bus', 'chat2', { label: 'other region' }), link('chat2', 'ben')],
        flows: [{ path: ['ana', 'chat1', 'bus', 'chat2', 'ben'], tone: 'event', label: 'message', duration: 3 }],
        panel: {
          title: 'Per region',
          icon: 'Globe',
          rows: [
            { text: 'Sockets', value: 'nearest region', tone: 'good' },
            { text: 'Registry', value: 'one per region' },
            { text: 'Cross-region hop', value: 'extra latency', tone: 'warn' },
            { text: 'History', value: 'replicated' },
          ],
        },
        caption: 'Sockets local, messages travel',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: many socket servers, one ordered log',
      eli5: 'Operators hold the lines, the concierge assigns them, the board says who is where, and the **notebook** per conversation keeps every note in order. Part 2 covers guests who are away.',
      body: [
        'Devices hold WebSockets to about 400 chat servers chosen by **discovery**, and a **session registry** maps users to servers. A send gets a per-conversation sequence number, is stored in a wide-column table keyed by conversation, is acked, then routed through a server bus.',
        'Part 2 adds offline delivery with push, multi-device sync, receipts, presence, groups, failures and the extras.',
      ],
      keyIdea: 'Treat connections as cheap and replaceable, and the per-conversation log as the one thing that must be right.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      metricTones: { latency: 'good', servers: 'good' },
      scene: {
        nodes: [ana, chat1, bus, chat2, ben],
        links: [link('ana', 'chat1'), link('chat1', 'bus'), link('bus', 'chat2'), link('chat2', 'ben')],
        flows: [{ path: ['ana', 'chat1', 'bus', 'chat2', 'ben'], tone: 'event', duration: 3 }],
        panel: {
          title: 'Part 1 in one table',
          icon: 'Table',
          rows: [
            { text: 'Connections', value: 'WebSocket, ~400 servers' },
            { text: 'Finding a server', value: 'discovery' },
            { text: 'Finding a receiver', value: 'session registry' },
            { text: 'History', value: 'wide-column, by chat' },
            { text: 'Order and retries', value: 'seq + client id' },
          ],
        },
        caption: 'Sockets in front, ordered log behind',
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
