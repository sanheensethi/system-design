import type { Lesson, SceneNode } from '../engine/types';

const alice: SceneNode = { id: 'alice', kind: 'phone', at: [-5.5, 1], label: 'Ana', sub: 'sends' };
const bob: SceneNode = { id: 'bob', kind: 'phone', at: [-3, -6], label: 'Ben', sub: 'waits for messages' };
const chat: SceneNode = { id: 'chat', kind: 'server', at: [-1, -1], label: 'chat server' };
const store: SceneNode = { id: 'store', kind: 'db', at: [2.5, 1.5], label: 'message store' };

const gw1: SceneNode = { id: 'gw1', kind: 'server', at: [-2.5, 0.5], label: 'gateway 1', sub: 'Ana connected' };
const gw2: SceneNode = { id: 'gw2', kind: 'server', at: [2.5, -3.5], label: 'gateway 2', sub: 'Ben connected' };
const bus: SceneNode = { id: 'bus', kind: 'queue', at: [0.5, -1.5], label: 'pub/sub', sub: 'Redis or Kafka' };
const bobFar: SceneNode = { id: 'bobFar', kind: 'phone', at: [5.5, -4.5], label: 'Ben' };
const aliceFar: SceneNode = { id: 'aliceFar', kind: 'phone', at: [-5.5, 2.5], label: 'Ana' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: [-3, 4], label: 'load balancer', sub: 'L7, long-lived' };
const presence: SceneNode = { id: 'presence', kind: 'cache', at: [4.5, 1], label: 'presence', sub: 'TTL 60 s' };
const msgDb: SceneNode = { id: 'msgDb', kind: 'db', at: [1.5, 3], label: 'message store' };

const pollLinks = [
  { from: 'alice', to: 'chat' },
  { from: 'bob', to: 'chat' },
  { from: 'chat', to: 'store' },
];

const fanLinks = [
  { from: 'aliceFar', to: 'gw1' },
  { from: 'gw1', to: 'bus' },
  { from: 'bus', to: 'gw2' },
  { from: 'gw2', to: 'bobFar' },
];

export const realtimeDelivery: Lesson = {
  id: 'realtime-delivery',
  title: 'Real-time: polling, SSE, WebSocket',
  tagline: 'HTTP lets clients ask and servers answer. Here is how servers push news the moment it happens.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why short polling wastes most of its requests',
    'How long polling, server-sent events and WebSocket each push data',
    'The WebSocket upgrade and two-way frames',
    'Why millions of open connections need many gateways and a pub/sub backplane',
    'Presence, reconnects, and how to pick one approach',
  ],
  metrics: [
    { key: 'delay', label: 'Delivery delay' },
    { key: 'reqs', label: 'Requests/s' },
    { key: 'wasted', label: 'Empty replies' },
    { key: 'conns', label: 'Open connections' },
  ],
  steps: [
    {
      title: 'Server cannot call',
      tag: 'problem',
      heading: 'Ana sends a message. How does Ben find out?',
      eli5: 'At a takeout counter, the cook can only answer when a customer asks. Ben\'s food is ready, but he is sitting at a table and the cook has no way to call him.',
      body: [
        'A chat app has **1 million** users online. Ana sends Ben "on my way". Her phone posts it to the chat server, which saves it. That part is ordinary HTTP.',
        'Delivering it is the hard part. HTTP is **request and response**: the client asks, the server answers. The server cannot start a conversation with Ben\'s phone, which sits behind a mobile carrier and a home router that do not accept incoming connections.',
        'Users expect a chat message in **under a second**. Four techniques get data from server to client: short polling, long polling, server-sent events and WebSocket. They differ in delay, waste and how much machinery they need.',
      ],
      keyIdea: 'In plain HTTP only the client can start a request. Real-time delivery is about getting around that.',
      metrics: { delay: 'never', reqs: '-', wasted: '-', conns: '-' },
      scene: {
        nodes: [alice, { ...bob, status: 'hot', badge: 'no news?' }, { ...chat, status: 'active', badge: 'has a message for Ben' }, store],
        links: pollLinks,
        flows: [
          { path: ['alice', 'chat'], tone: 'request', label: '"on my way"', duration: 1.2 },
          { path: ['chat', 'store'], tone: 'data', duration: 1, delay: 1.3 },
          { path: ['chat', 'bob'], tone: 'error', label: 'cannot push', duration: 1.2, delay: 2.5 },
        ],
        caption: 'The server has news and no way to send it',
      },
    },
    {
      title: 'Short polling',
      tag: 'concept',
      heading: 'Short polling: ask again every few seconds',
      eli5: 'Ben walks up to the counter every 3 seconds and asks "is it ready?". Almost every time the cook says "not yet", and the line fills with people asking the same thing.',
      body: [
        'The simplest fix: the client asks `GET /messages?since=812` every **3 seconds**. If something is new, it comes back. Otherwise the server answers with an empty list.',
        'It works with any server, any proxy and any client. The cost is in the numbers. 1 million users polling every 3 seconds is about **333,000 requests per second**. A typical user receives a message every minute or so, so roughly **95%** of those replies are empty. Each still pays for TLS, headers, authentication and a database check.',
        'Delay averages half the interval, here 1.5 seconds. Poll faster for lower delay and the waste grows. Poll slower and messages feel late. Short polling suits slow-changing data like a build status or an order tracker.',
      ],
      keyIdea: 'Short polling trades waste for simplicity. Most requests come back empty, and delay is half the interval.',
      metrics: { delay: '~1.5 s', reqs: '333K/s', wasted: '~95%', conns: 'short-lived' },
      scene: {
        nodes: [alice, { ...bob, status: 'active', badge: 'every 3 s' }, { ...chat, status: 'hot', badge: '333K req/s' }, { ...store, status: 'hot' }],
        links: pollLinks,
        flows: [
          { path: ['bob', 'chat'], tone: 'request', label: 'anything new?', count: 4, duration: 1 },
          { path: ['chat', 'bob'], tone: 'response', label: '[]', count: 4, duration: 1, delay: 1.1 },
          { path: ['chat', 'store'], tone: 'request', count: 4, duration: 1, delay: 0.5 },
        ],
        caption: 'Ask, nothing, ask, nothing',
      },
    },
    {
      title: 'Long polling',
      tag: 'concept',
      heading: 'Long polling: the server holds the request open',
      eli5: 'Now Ben asks once and the cook says "wait here, I will tell you the moment it is ready". Ben stands at the counter until his food comes out, then asks again.',
      body: [
        'With **long polling** the client sends the same request, but the server does not answer right away. It holds the request open until a message arrives or about **30 seconds** pass. Then it replies, and the client immediately sends the next request.',
        'Delivery is now close to instant, because the reply leaves the moment Ana\'s message lands. Empty replies only happen on timeout, so requests drop from 333,000 to roughly **33,000 per second**.',
        'The price: the server holds a waiting request for every online user, so it must be built to park many idle requests cheaply (event loops, not one thread each). Each message still needs a fresh request with full headers, and messages that arrive between one reply and the next request must be buffered.',
      ],
      keyIdea: 'Long polling turns many empty replies into one waiting request. It runs on plain HTTP, at the cost of holding a request per user.',
      metrics: { delay: '~100 ms', reqs: '33K/s', wasted: 'timeouts only', conns: '1M held' },
      scene: {
        nodes: [alice, { ...bob, status: 'active', badge: 'waiting up to 30 s' }, { ...chat, status: 'active', badge: '1M parked requests' }, store],
        links: pollLinks,
        flows: [
          { path: ['bob', 'chat'], tone: 'request', label: 'wait for news', duration: 1 },
          { path: ['alice', 'chat'], tone: 'request', label: '"on my way"', duration: 1, delay: 2 },
          { path: ['chat', 'bob'], tone: 'response', label: 'here it is', duration: 1, delay: 3.1 },
          { path: ['bob', 'chat'], tone: 'request', label: 'wait again', duration: 1, delay: 4.2 },
        ],
        caption: 'One request waits until there is news',
      },
    },
    {
      title: 'SSE',
      tag: 'concept',
      heading: 'Server-sent events: one response that never ends',
      eli5: 'The counter gets a speaker. Ben tunes in once, and every time something is ready the cook announces it. Ben can listen, but to order more he still walks up to the counter.',
      body: [
        '**Server-sent events** (SSE) keep one HTTP response open and stream text events down it. The response has type `text/event-stream`, and each event is a few `field: value` lines ending in a blank line. Browsers have it built in as `EventSource`.',
        'It is **one-way**, server to client. Sending a message is still a normal `POST`. That fits many products: live scores, notifications, stock tickers, and tokens streaming from an AI model.',
        'Reconnects are automatic. Each event can carry an `id`, and after a dropped connection the browser reconnects with a `Last-Event-ID` header so the server can resend what was missed. Over HTTP/1.1 a browser allows about 6 connections per domain, so serve SSE over HTTP/2 when users open many tabs.',
      ],
      keyIdea: 'SSE is a server-to-client stream over plain HTTP, with reconnect and resume built in.',
      metrics: { delay: '~50 ms', reqs: 'sends only', wasted: '0', conns: '1M open' },
      scene: {
        nodes: [alice, { ...bob, status: 'ok', badge: 'EventSource' }, { ...chat, status: 'active', badge: 'text/event-stream' }, store],
        links: [{ from: 'alice', to: 'chat' }, { from: 'chat', to: 'bob', label: 'one open response' }, { from: 'chat', to: 'store' }],
        flows: [
          { path: ['alice', 'chat'], tone: 'request', label: 'POST message', duration: 1 },
          { path: ['chat', 'bob'], tone: 'event', label: 'event: message', count: 3, duration: 1.2, delay: 1.1 },
        ],
        caption: 'Events flow down one long response',
      },
      code: {
        language: 'javascript',
        title: 'SSE: the wire format and the browser side',
        source: `// Server writes this to an open response, Content-Type: text/event-stream
//   id: 813
//   event: message
//   data: {"from":"ana","text":"on my way"}
//   (blank line ends the event)

// Browser
const es = new EventSource("/stream?room=ana-ben");

es.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  showMessage(msg);              // e.lastEventId is "813"
});

// On a drop, the browser reconnects by itself and sends
// Last-Event-ID: 813, so the server resends anything newer.
es.onerror = () => console.log("reconnecting...");`,
        highlight: [2, 4, 8, 15, 16],
      },
    },
    {
      title: 'WebSocket',
      tag: 'concept',
      heading: 'WebSocket: upgrade once, then talk both ways',
      eli5: 'Ben and the cook pick up a **WebSocket** phone line and keep it open. Either one can speak at any moment, and nobody has to walk to the counter again.',
      body: [
        'A **WebSocket** starts as an HTTP request with `Upgrade: websocket`. The server replies `101 Switching Protocols`, and from then on the same TCP connection carries small **frames** in both directions with no HTTP headers per message.',
        'Ben\'s phone can send messages, typing indicators and read receipts on the same connection it receives on. A frame header is only 2 to 14 bytes, so a "Ben is typing" signal costs almost nothing.',
        'What you give up: it is a separate protocol, so you build your own message types, acknowledgements and reconnect logic. Some corporate proxies break it, and there is no built-in resume. You use `wss://` (WebSocket over TLS) everywhere.',
      ],
      keyIdea: 'WebSocket turns one HTTP request into a long-lived, two-way channel with tiny per-message overhead.',
      metrics: { delay: '~50 ms', reqs: '0 per message', wasted: '0', conns: '1M open' },
      scene: {
        nodes: [alice, { ...bob, status: 'ok', badge: 'wss:// open' }, { ...chat, status: 'active', badge: '101 Switching' }, store],
        links: [{ from: 'alice', to: 'chat' }, { from: 'bob', to: 'chat', label: 'full duplex' }, { from: 'chat', to: 'store' }],
        flows: [
          { path: ['bob', 'chat'], tone: 'handshake', label: 'Upgrade: websocket', duration: 1 },
          { path: ['chat', 'bob'], tone: 'handshake', label: '101', duration: 1, delay: 1.1 },
          { path: ['chat', 'bob'], tone: 'event', label: 'msg frame', duration: 1, delay: 2.3 },
          { path: ['bob', 'chat'], tone: 'event', label: 'typing...', duration: 1, delay: 3 },
        ],
        caption: 'One handshake, then frames both ways',
      },
      code: {
        language: 'javascript',
        title: 'A WebSocket client with reconnect and backoff',
        source: `let attempt = 0;
let lastSeen = 0;

function connect() {
  const ws = new WebSocket(\`wss://chat.example/ws?since=\${lastSeen}\`);

  ws.onopen = () => { attempt = 0; };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    lastSeen = msg.seq;                          // resume point
    showMessage(msg);
    ws.send(JSON.stringify({ type: "ack", seq: msg.seq }));
  };
  ws.onclose = () => {
    // back off, with jitter so a million phones do not return at once
    const wait = Math.min(30000, 500 * 2 ** attempt++) * Math.random();
    setTimeout(connect, wait);
  };
}
connect();`,
        highlight: [5, 10, 12, 16, 17],
      },
      quiz: {
        question: 'A sports site pushes live scores to browsers. Users never send anything back on that channel. Which option is the simplest good fit?',
        options: ['Short polling every 100 ms', 'Server-sent events', 'WebSocket', 'gRPC streaming from the browser'],
        answer: 1,
        explain: 'The data flows one way, server to client, which is what SSE does over plain HTTP, with reconnect and resume built in. WebSocket would work but adds a protocol you do not need. 100 ms polling is mostly empty requests.',
      },
    },
    {
      title: 'Many sockets',
      tag: 'tradeoff',
      heading: 'A million open connections need many gateways',
      eli5: 'One cook cannot hold a million phone lines. The shop opens many counters, and each customer stays on the line with the counter that picked up their first call.',
      body: [
        'An open connection costs memory for buffers and state, a file descriptor, and a little CPU for heartbeats. A tuned gateway server holds **hundreds of thousands** of mostly idle connections. Plan for less, say 100,000 each, which means **10 gateways** for 1 million users plus spare room.',
        'The load balancer must handle long-lived connections (a layer 7 balancer that understands the upgrade, or layer 4 passthrough) and its idle timeouts must be longer than your heartbeat interval. A connection stays on the gateway that accepted it, so the routing is **sticky** by nature.',
        'Keep these gateways thin: they hold sockets and pass messages along. Business logic lives in normal services behind them, so a deploy of chat logic does not drop a million connections.',
      ],
      keyIdea: 'Persistent connections make servers stateful. Each user is tied to one gateway, and you scale by adding gateways.',
      metrics: { delay: '~50 ms', reqs: '0 per message', wasted: '0', conns: '100K per gateway' },
      scene: {
        nodes: [
          { ...aliceFar, badge: 'on gateway 1' },
          { ...lb, status: 'active' },
          { ...gw1, status: 'active', sub: '100K sockets' },
          { ...gw2, status: 'active', sub: '100K sockets' },
          { ...bobFar, badge: 'on gateway 2' },
        ],
        links: [
          { from: 'aliceFar', to: 'lb' },
          { from: 'lb', to: 'gw1' },
          { from: 'lb', to: 'gw2' },
          { from: 'bobFar', to: 'gw2' },
        ],
        flows: [
          { path: ['aliceFar', 'lb', 'gw1'], tone: 'handshake', label: 'upgrade', duration: 1.4 },
          { path: ['bobFar', 'gw2'], tone: 'handshake', label: 'stays here', duration: 1.2, delay: 0.4 },
        ],
        caption: 'Each user lives on one gateway',
      },
    },
    {
      title: 'Backplane',
      tag: 'case',
      heading: 'Case: Ana is on gateway 1, Ben is on gateway 2',
      eli5: 'Ana tells the counter she is on. That counter does not have Ben on the line, so it shouts the news into the back room, and the counter that does have Ben tells him.',
      body: [
        'Ana\'s message reaches gateway 1. Ben\'s socket is on gateway 2. Gateway 1 has no way to write to it. With 10 gateways, the sender and receiver are on different machines 90% of the time.',
        'The fix is a **pub/sub backplane**. Each gateway subscribes to channels for the users it holds, for example `user:ben`. Gateway 1 saves the message, then publishes it to `user:ben`. The backplane delivers it to every subscriber, which is gateway 2, and gateway 2 writes it down Ben\'s socket.',
        'For a group chat of 200 people the gateway publishes once to the group channel and every gateway with a member gets one copy, so fan-out cost follows gateways, not members. Redis pub/sub is fast but drops messages for a subscriber that is down. That is fine as long as the message store is the source of truth.',
      ],
      keyIdea: 'Gateways do not talk to each other directly. They publish to and subscribe from a shared backplane.',
      metrics: { delay: '~80 ms', reqs: '0 per message', wasted: '0', conns: '100K per gateway' },
      scene: {
        nodes: [aliceFar, { ...gw1, status: 'active' }, { ...bus, status: 'active', badge: 'channel user:ben' }, { ...gw2, status: 'active', badge: 'subscribed' }, { ...bobFar, status: 'ok', badge: '"on my way"' }, msgDb],
        links: [...fanLinks, { from: 'gw1', to: 'msgDb' }],
        flows: [
          { path: ['aliceFar', 'gw1'], tone: 'request', label: 'to: ben', duration: 1 },
          { path: ['gw1', 'msgDb'], tone: 'data', label: 'save seq 813', duration: 1, delay: 1.1 },
          { path: ['gw1', 'bus'], tone: 'event', label: 'PUBLISH user:ben', duration: 1, delay: 1.1 },
          { path: ['bus', 'gw2'], tone: 'event', duration: 1, delay: 2.2 },
          { path: ['gw2', 'bobFar'], tone: 'event', label: 'frame', duration: 1, delay: 3.3 },
        ],
        caption: 'Save, publish, deliver from the right gateway',
      },
    },
    {
      title: 'Presence',
      tag: 'concept',
      heading: 'Presence: who is online right now?',
      eli5: 'Each customer on the line says "still here" every half minute. The board in the back marks them present, and if they go quiet for a minute, the board marks them away.',
      body: [
        'The green dot next to a name is **presence**. A closed socket is not a reliable signal: a phone that loses signal in a lift just goes silent, and its TCP connection can look open for minutes.',
        'So clients send a **heartbeat** every 30 seconds. The gateway writes `presence:ben` into a cache with a **60-second TTL**. If heartbeats stop, the key expires and Ben shows as away. A clean disconnect deletes the key at once.',
        'Do not broadcast every change to everyone. Ben has 500 contacts, and pushing each of his flickers to all of them multiplies traffic. Push presence only to people with his chat open, and let other screens fetch it when they need it.',
      ],
      keyIdea: 'Presence is a heartbeat with an expiry. Silence for longer than the TTL means away.',
      metrics: { delay: '~80 ms', reqs: '33K heartbeats/s', wasted: '0', conns: '100K per gateway' },
      scene: {
        nodes: [aliceFar, gw1, { ...bus, status: 'dim' }, { ...gw2, status: 'active' }, { ...bobFar, status: 'active', badge: 'heartbeat 30 s' }, { ...presence, status: 'ok', badge: 'ben: online' }],
        links: [...fanLinks, { from: 'gw2', to: 'presence' }],
        flows: [
          { path: ['bobFar', 'gw2'], tone: 'handshake', label: 'ping', duration: 1 },
          { path: ['gw2', 'presence'], tone: 'data', label: 'SET ex=60', duration: 1, delay: 1.1 },
        ],
        caption: 'A key that expires when heartbeats stop',
      },
    },
    {
      title: 'Drops',
      tag: 'tradeoff',
      heading: 'Connections drop. Messages must not.',
      eli5: 'If the line cuts out, Ben calls back and says "the last thing I heard was order 812". The counter reads him everything after 812 from the order book.',
      body: [
        'Mobile connections drop all the time: tunnels, Wi-Fi switching to cellular, apps put to sleep. Anything pushed while Ben was away is gone from the socket. Treat the socket as a fast path only.',
        'Give every message a per-conversation **sequence number** and save it before pushing. On reconnect the client sends the last number it saw, and the gateway reads everything newer from the message store. Duplicates are dropped by sequence number on the client.',
        'Deploys and gateway crashes drop thousands of sockets at once, and they all reconnect at once. Clients must reconnect with **exponential backoff and jitter**, and gateways should drain slowly during a deploy instead of closing everything in one go.',
      ],
      keyIdea: 'The socket delivers fast, the store delivers for sure. Resume from the last sequence number after every reconnect.',
      metrics: { delay: '~80 ms', reqs: 'reconnect spikes', wasted: '0', conns: '100K per gateway' },
      scene: {
        nodes: [aliceFar, gw1, bus, { ...gw2, status: 'active', badge: 'since=812' }, { ...bobFar, status: 'active', badge: 'back online' }, { ...msgDb, status: 'active', badge: 'seq 813, 814' }],
        links: [...fanLinks, { from: 'gw2', to: 'msgDb' }],
        flows: [
          { path: ['bobFar', 'gw2'], tone: 'handshake', label: 'reconnect, last=812', duration: 1.1 },
          { path: ['gw2', 'msgDb'], tone: 'request', label: 'seq > 812', duration: 1.2, delay: 1.2 },
          { path: ['msgDb', 'gw2'], tone: 'response', duration: 1.2, delay: 2.5 },
          { path: ['gw2', 'bobFar'], tone: 'event', label: '813, 814', count: 2, duration: 1, delay: 3.8 },
        ],
        caption: 'Missed messages come from the store',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Pick the simplest one that meets the need',
      eli5: 'If food takes an hour, checking now and then is fine. If you only need to hear announcements, use the speaker. If you and the cook keep talking back and forth, keep the phone line open.',
      body: [
        '**Short polling** for data that changes every few minutes or where a few seconds of delay is fine: job status, dashboards. Zero new infrastructure.',
        '**Long polling** as a fallback where nothing else gets through, or where you must stay on plain request and response. **SSE** when data flows one way: notifications, feeds, live scores, streamed AI responses. It is plain HTTP with resume built in.',
        '**WebSocket** when both sides talk often and fast: chat, multiplayer games, collaborative editing. Accept that you now run stateful gateways, a backplane, heartbeats and resume logic. Native mobile apps also have push notification services for when the app is closed, which none of these cover.',
      ],
      keyIdea: 'Match the tool to direction and frequency: polling for slow data, SSE for one-way streams, WebSocket for two-way chatter.',
      metrics: { delay: '~80 ms', reqs: '0 per message', wasted: '0', conns: '1M across 10 gateways' },
      scene: {
        nodes: [aliceFar, { ...gw1, status: 'ok' }, { ...bus, status: 'ok' }, { ...gw2, status: 'ok' }, { ...bobFar, status: 'ok' }],
        links: fanLinks,
        flows: [
          { path: ['aliceFar', 'gw1', 'bus', 'gw2', 'bobFar'], tone: 'event', duration: 2.4 },
          { path: ['bobFar', 'gw2', 'bus', 'gw1', 'aliceFar'], tone: 'event', label: 'read', duration: 2.4, delay: 2.6 },
        ],
        caption: 'Two-way chat earns the WebSocket machinery',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'From asking constantly to a line that stays open',
      eli5: 'Asking every few seconds, waiting at the counter, listening to the speaker and keeping a phone line open all get Ben his food. They differ in how much effort is wasted and who can speak.',
      body: [
        '**Short polling** is simple and mostly empty replies. **Long polling** parks a request until there is news. **SSE** streams events one way over HTTP with automatic resume. **WebSocket** upgrades once and carries small frames both ways.',
        'At scale, open connections live on many thin gateways. A **pub/sub backplane** routes each message to the gateway that holds the receiver. Heartbeats with a TTL give presence. Every message is saved with a sequence number first, so a reconnecting client resumes from the store.',
      ],
      keyIdea: 'Push is a fast path on top of a durable store. Pick the transport by direction and rate, then plan for drops.',
      metrics: { delay: '~80 ms', reqs: '0 per message', wasted: '0', conns: '1M across 10 gateways' },
      scene: {
        nodes: [aliceFar, gw1, bus, gw2, { ...bobFar, status: 'ok' }, msgDb, presence],
        links: [...fanLinks, { from: 'gw1', to: 'msgDb' }, { from: 'gw2', to: 'presence' }],
        flows: [
          { path: ['aliceFar', 'gw1'], tone: 'request', duration: 1 },
          { path: ['gw1', 'msgDb'], tone: 'data', duration: 1, delay: 1.1 },
          { path: ['gw1', 'bus', 'gw2', 'bobFar'], tone: 'event', duration: 2, delay: 1.1 },
        ],
      },
      quiz: {
        question: 'Ana is connected to gateway 3 and Ben to gateway 7. What gets Ana\'s message to Ben?',
        options: [
          'The load balancer moves Ben\'s socket to gateway 3',
          'Gateway 3 publishes to a pub/sub channel that gateway 7 subscribes to for Ben',
          'Ben\'s phone polls gateway 3 every second',
          'Gateway 3 opens a WebSocket directly to Ben\'s phone',
        ],
        answer: 1,
        explain: 'Sockets cannot move between servers, and servers cannot open connections to phones. Gateway 3 publishes the message to a channel, and gateway 7, which subscribed on Ben\'s behalf, writes it down his socket.',
      },
    },
  ],
};
