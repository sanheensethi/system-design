import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-3.8, -3.8), label: 'Ana', sub: 'sends' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(3.8, -3.8), label: 'Ben', sub: 'waits for messages' };
const chat: SceneNode = { id: 'chat', kind: 'block', at: at(0, -3.8), label: 'chat server', sub: 'saves messages', icon: 'Server', tint: 'violet' };
const store: SceneNode = { id: 'store', kind: 'db', at: at(0, 3.8), label: 'message store' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const realtimeDelivery: Lesson = {
  id: 'realtime-delivery',
  title: 'Real-time: polling, SSE, WebSocket (part 1)',
  tagline: 'HTTP lets clients ask and servers answer. Here are the four ways a server gets news to a client the moment it happens.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why a server cannot call a client, and why the client must start every channel',
    'Short polling: the waste in the numbers and the delay it adds',
    'Long polling: one parked request, and what it still costs',
    'Server-sent events: a one-way stream over plain HTTP with resume',
    'WebSocket: the upgrade, two-way frames and the price of a new protocol',
    'How to pick one by direction and frequency (part 2 covers scale, presence and reconnects)',
  ],
  metrics: [
    { key: 'delay', label: 'Delivery delay', icon: 'Timer' },
    { key: 'reqs', label: 'Requests/s', icon: 'Repeat' },
    { key: 'wasted', label: 'Empty replies', icon: 'Inbox' },
    { key: 'conns', label: 'Open connections', icon: 'Plug' },
  ],
  steps: [
    {
      title: 'Server cannot call',
      tag: 'problem',
      heading: 'Ana sends a message. How does Ben find out?',
      eli5: 'At a takeout counter, the cook can only answer when a customer asks. Ben\'s food is ready, but he is sitting at a table and the cook has no way to call him.',
      body: [
        'A chat app has **1 million** users online. Ana sends Ben "on my way". Her phone posts it to the chat server, which saves it. That part is ordinary HTTP.',
        'Delivering it is the hard part. Users expect a chat message in **under a second**, and the server has no way to tell Ben\'s phone it has news.',
      ],
      keyIdea: 'Saving the message is easy. Getting it to Ben without him asking is the real problem.',
      metrics: { delay: 'never', reqs: '-', wasted: '-', conns: '-' },
      metricTones: { delay: 'bad' },
      scene: {
        nodes: [ana, { ...chat, status: 'active', chips: [{ text: 'msg for Ben', tone: 'good' }] }, { ...ben, status: 'hot', badge: 'no news?' }, store],
        links: [link('ana', 'chat'), link('chat', 'store'), link('chat', 'ben', { label: 'no way to push', labelTone: 'warn', style: 'dashed' })],
        flows: [
          { path: ['ana', 'chat'], tone: 'request', label: '"on my way"', duration: 1.2 },
          { path: ['chat', 'store'], tone: 'data', label: 'saved', duration: 1.2, delay: 1.3 },
          { path: ['chat', 'ben'], tone: 'error', label: 'cannot push', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Where the message is',
          icon: 'List',
          rows: [
            { text: 'Ana to server', value: 'POST, done', tone: 'good' },
            { text: 'Server to store', value: 'saved', tone: 'good' },
            { text: 'Server to Ben', value: 'no way in', tone: 'bad' },
          ],
          footer: { text: 'Target: under 1 second', tone: 'muted' },
        },
        caption: 'The server has news and no way to send it',
      },
    },
    {
      title: 'Client starts',
      tag: 'concept',
      heading: 'In HTTP, only the client can start',
      eli5: 'The cook can only talk to people standing at the counter. Ben is at a table behind a closed door, so the cook cannot walk over and tap him.',
      body: [
        'HTTP is **request and response**: the client asks, the server answers. The server cannot open a conversation of its own.',
        'Ben\'s phone sits behind a mobile carrier and a home router (**NAT**) that drop unsolicited incoming connections, and its address changes as he moves. So the client must start every channel.',
      ],
      keyIdea: 'Real-time delivery is about getting around one rule: the client starts every connection.',
      metrics: { delay: 'never', reqs: '-', wasted: '-', conns: '-' },
      scene: {
        nodes: [{ ...chat, status: 'active' }, { ...ben, status: 'hot', chips: [{ text: 'behind NAT', tone: 'warn' }] }, { ...ana, status: 'dim' }],
        links: [link('chat', 'ben', { label: 'inbound blocked', labelTone: 'warn', style: 'dashed' }), link('ben', 'chat', { label: 'outbound allowed' })],
        flows: [
          { path: ['chat', 'ben'], tone: 'error', label: 'SYN dropped', duration: 1.4 },
          { path: ['ben', 'chat'], tone: 'request', label: 'GET /messages', duration: 1.4, delay: 1.6 },
          { path: ['chat', 'ben'], tone: 'response', label: '200', duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Who can open a connection',
          icon: 'Network',
          rows: [
            { text: 'Ben to server', value: 'allowed', tone: 'good' },
            { text: 'Server to Ben', value: 'dropped', tone: 'bad' },
            { text: 'Ben\'s address', value: 'changes', tone: 'warn' },
          ],
          footer: { text: 'Four techniques work around this', tone: 'muted' },
        },
        caption: 'The phone has to make the first move',
      },
    },
    {
      title: 'Short polling',
      tag: 'concept',
      heading: 'Short polling: ask again every few seconds',
      eli5: 'Ben walks up to the counter every 3 seconds and asks "is it ready?". Almost every time the cook says "not yet".',
      body: [
        'The simplest fix: the client asks `GET /messages?since=812` every **3 seconds**. If something is new, it comes back. Otherwise the server answers with an empty list.',
        'It works with any server, proxy and client. Delay averages half the interval, here **1.5 seconds**.',
      ],
      keyIdea: 'Short polling is the simplest push workaround: ask on a timer, and delay averages half the timer.',
      metrics: { delay: '~1.5 s', reqs: '333K/s', wasted: '~95%', conns: 'short-lived' },
      metricTones: { delay: 'warn', reqs: 'bad', wasted: 'bad' },
      scene: {
        nodes: [{ ...ben, status: 'active', badge: 'every 3 s', chips: ['GET /messages?since=812'] }, { ...chat, status: 'hot', load: 88 }, store],
        links: [link('ben', 'chat', { label: 'request, then reply' }), link('chat', 'store')],
        flows: [
          { path: ['ben', 'chat'], tone: 'request', label: 'anything new?', count: 3, duration: 1 },
          { path: ['chat', 'store'], tone: 'request', count: 3, duration: 1, delay: 0.5 },
          { path: ['chat', 'ben'], tone: 'response', label: '[]', count: 3, duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'One reply, three seconds later',
          icon: 'Code',
          code: 'GET /messages?since=812\n\n200 OK\n{"messages": []}',
          footer: { text: 'Empty again', tone: 'warn' },
        },
        caption: 'Ask, nothing, ask, nothing',
      },
    },
    {
      title: 'Polling cost',
      tag: 'tradeoff',
      heading: 'Short polling pays for answers nobody needed',
      eli5: 'A hundred customers each ask "is it ready?" every 3 seconds. The cook spends the whole shift saying "not yet" and barely cooks.',
      body: [
        '1 million users polling every 3 seconds is about **333,000 requests per second**. A typical user gets a message about once a minute, so roughly **95%** of replies are empty. Each still pays for TLS, headers, authentication and a database check.',
        'Poll faster for lower delay and the waste grows. Poll slower and messages feel late. It suits slow data like a build status or an order tracker.',
      ],
      keyIdea: 'Short polling trades waste for simplicity. Faster polling cuts delay and multiplies the load.',
      metrics: { delay: '~1.5 s', reqs: '333K/s', wasted: '~95%', conns: 'short-lived' },
      metricTones: { delay: 'warn', reqs: 'bad', wasted: 'bad' },
      scene: {
        nodes: [{ ...ben, status: 'active', badge: 'every 3 s' }, { ...chat, status: 'hot', load: 92, chips: [{ text: '333K req/s', tone: 'bad' }] }, { ...store, status: 'hot' }],
        links: [link('ben', 'chat'), link('chat', 'store')],
        flows: [
          { path: ['ben', 'chat'], tone: 'request', count: 5, duration: 0.9 },
          { path: ['chat', 'store'], tone: 'request', count: 5, duration: 0.9, delay: 0.5 },
        ],
        panel: {
          title: 'Poll interval for 1M users',
          icon: 'Table',
          rows: [
            { text: 'Every 1 s', value: '1M req/s, 0.5 s delay', tone: 'bad' },
            { text: 'Every 3 s', value: '333K req/s, 1.5 s delay', tone: 'warn' },
            { text: 'Every 30 s', value: '33K req/s, 15 s delay', tone: 'warn' },
          ],
          footer: { text: '~95% of replies are empty', tone: 'bad' },
        },
        caption: 'The cost scales with users, not with messages',
      },
    },
    {
      title: 'Long polling',
      tag: 'concept',
      heading: 'Long polling: the server holds the request open',
      eli5: 'Now Ben asks once and the cook says "wait here, I will tell you the moment it is ready". Ben stands at the counter until his food comes out, then asks again.',
      body: [
        'With **long polling** the client sends the same request, but the server does not answer right away. It holds the request open until a message arrives or about **30 seconds** pass. Then it replies, and the client immediately sends the next request.',
        'Delivery is close to instant, because the reply leaves the moment Ana\'s message lands. Empty replies only happen on timeout.',
      ],
      keyIdea: 'Long polling turns many empty replies into one waiting request, on plain HTTP.',
      metrics: { delay: '~100 ms', reqs: '~50K/s', wasted: 'timeouts only', conns: '1M held' },
      metricTones: { delay: 'good', reqs: 'warn', wasted: 'good' },
      scene: {
        nodes: [ana, { ...chat, status: 'active', badge: 'parks the request' }, { ...ben, status: 'active', badge: 'waits up to 30 s' }],
        links: [link('ana', 'chat'), link('ben', 'chat', { label: 'one waiting request', arrow: 'both' })],
        flows: [
          { path: ['ben', 'chat'], tone: 'request', label: 'wait for news', duration: 1.2 },
          { path: ['ana', 'chat'], tone: 'request', label: '"on my way"', duration: 1.2, delay: 2.2 },
          { path: ['chat', 'ben'], tone: 'response', label: 'here it is', duration: 1.2, delay: 3.6 },
          { path: ['ben', 'chat'], tone: 'request', label: 'wait again', duration: 1.2, delay: 4.9 },
        ],
        panel: {
          title: 'The server\'s choice',
          icon: 'Clock',
          rows: [
            { text: 'Message arrives', value: 'reply now', tone: 'good' },
            { text: '30 s pass, nothing', value: 'reply empty', tone: 'muted' },
            { text: 'Client after reply', value: 'ask again', tone: 'default' },
          ],
        },
        caption: 'One request waits until there is news',
      },
    },
    {
      title: 'Long poll limits',
      tag: 'tradeoff',
      heading: 'Long polling still has a price',
      eli5: 'The cook now has a crowd of people standing at the counter, each waiting. Every time one gets their food, they get back in line and ask again from scratch.',
      body: [
        'Requests drop from 333,000 to about **50,000 per second**: 33,000 from timeouts (1M users, one per 30 seconds) plus about 17,000 from re-polls after messages (one message per user per minute). The server holds a waiting request per user, so it needs an event loop, not one thread each.',
        'Each message still costs a fresh request with full headers. Messages arriving between one reply and the next request must be buffered, and proxy idle timeouts must be longer than 30 seconds.',
      ],
      keyIdea: 'Long polling cuts waste and delay, and costs a held request per user plus a full request per message.',
      metrics: { delay: '~100 ms', reqs: '~50K/s', wasted: 'timeouts only', conns: '1M held' },
      metricTones: { delay: 'good', reqs: 'warn', conns: 'warn' },
      scene: {
        nodes: [{ ...ben, status: 'active', chips: [{ text: 'request again', tone: 'warn' }] }, { ...chat, status: 'hot', load: 70, badge: '1M parked requests' }, { ...store, status: 'active', chips: ['buffer for the gap'] }],
        links: [link('ben', 'chat', { label: 'full headers each time', labelTone: 'warn' }), link('chat', 'store')],
        flows: [
          { path: ['chat', 'ben'], tone: 'response', label: 'msg 813', duration: 1.2 },
          { path: ['ben', 'chat'], tone: 'request', label: 'new request', duration: 1.2, delay: 1.4 },
          { path: ['chat', 'store'], tone: 'request', label: 'since=813', duration: 1, delay: 2.8 },
        ],
        panel: {
          title: 'Costs that remain',
          icon: 'Table',
          rows: [
            { text: 'Waiting requests', value: '1M held', tone: 'warn' },
            { text: 'Request rate', value: '33K timeouts + 17K re-polls', tone: 'warn' },
            { text: 'Per message', value: 'new request', tone: 'warn' },
            { text: 'Gap between calls', value: 'must buffer', tone: 'warn' },
            { text: 'Proxy idle timeout', value: '> 30 s', tone: 'muted' },
          ],
        },
        caption: 'Fewer empty replies, same request overhead',
      },
    },
    {
      title: 'SSE',
      tag: 'concept',
      heading: 'Server-sent events: one response that never ends',
      eli5: 'The counter gets a speaker. Ben tunes in once, and every time something is ready the cook announces it. Ben can listen, but to order more he still walks up to the counter.',
      body: [
        '**Server-sent events** (SSE) keep one HTTP response open and stream text events down it. The response has type `text/event-stream`, and each event is a few `field: value` lines ending in a blank line. Browsers have it built in as `EventSource`.',
        'Sending a message is still a normal `POST`. It fits live scores, notifications and tokens streaming from an AI model.',
      ],
      keyIdea: 'SSE is one long HTTP response that the server keeps writing events into.',
      metrics: { delay: '~50 ms', reqs: 'sends only', wasted: '0', conns: '1M open' },
      metricTones: { delay: 'good', wasted: 'good' },
      scene: {
        nodes: [ana, { ...chat, status: 'active', badge: 'text/event-stream' }, { ...ben, status: 'ok', badge: 'EventSource' }],
        links: [link('ana', 'chat', { label: 'POST' }), link('chat', 'ben', { label: 'one open response' })],
        flows: [
          { path: ['ana', 'chat'], tone: 'request', label: 'POST message', duration: 1.2 },
          { path: ['chat', 'ben'], tone: 'event', label: 'event: message', count: 3, duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Two channels',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Server to Ben', value: 'SSE stream', tone: 'good' },
            { text: 'Ana to server', value: 'normal POST', tone: 'default' },
          ],
          footer: { text: 'Events go one way only', tone: 'muted' },
        },
        caption: 'Events flow down one long response',
      },
    },
    {
      title: 'SSE code',
      tag: 'concept',
      heading: 'SSE on the wire and in the browser',
      eli5: 'The speaker numbers every announcement. If Ben\'s radio cuts out, it comes back and says "last I heard was number 813", and the cook repeats anything newer.',
      body: [
        'Each event can carry an `id`. After a dropped connection the browser reconnects by itself and sends a `Last-Event-ID` header, so the server can resend what was missed.',
        'Reconnect and resume are built in. That is the biggest thing SSE has over a hand-rolled WebSocket.',
      ],
      keyIdea: 'SSE gives you automatic reconnect and a resume point for free.',
      metrics: { delay: '~50 ms', reqs: 'sends only', wasted: '0', conns: '1M open' },
      metricTones: { delay: 'good' },
      scene: {
        nodes: [{ ...chat, status: 'active', chips: ['id: 813', 'id: 814'] }, { ...ben, status: 'ok', badge: 'Last-Event-ID: 813' }, store],
        links: [link('chat', 'ben', { label: 'reconnect + resume' }), link('chat', 'store')],
        flows: [
          { path: ['ben', 'chat'], tone: 'handshake', label: 'Last-Event-ID: 813', duration: 1.3 },
          { path: ['chat', 'store'], tone: 'request', label: 'id > 813', duration: 1, delay: 1.5 },
          { path: ['chat', 'ben'], tone: 'event', label: 'id: 814', duration: 1.3, delay: 2.7 },
        ],
        caption: 'The browser reports where it stopped',
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
      title: 'SSE limits',
      tag: 'tradeoff',
      heading: 'Where SSE runs out',
      eli5: 'The speaker only talks to Ben. If Ben wants to answer, he still has to walk to the counter, and the shop only gives him a few listening seats if he is on the old line.',
      body: [
        'SSE is **one-way** and text only. Anything the client sends goes on a separate request. Over HTTP/1.1 a browser allows **6 connections per domain**, so many tabs run out. HTTP/2 lifts that.',
        'Proxies close idle streams, so send a `: keepalive` comment every 15 to 30 seconds, with `Cache-Control: no-cache` and `X-Accel-Buffering: no` to stop buffering. `EventSource` cannot set an `Authorization` header, so use a cookie.',
      ],
      keyIdea: 'SSE fits one-way streams. Two-way chatter, binary data and many tabs on HTTP/1.1 are where it strains.',
      metrics: { delay: '~50 ms', reqs: 'sends only', wasted: '0', conns: '1M open' },
      metricTones: { conns: 'warn' },
      scene: {
        nodes: [{ ...ben, status: 'active', chips: ['tab 1', 'tab 2', { text: 'tab 7: blocked', tone: 'bad' }] }, { ...chat, status: 'active', chips: [{ text: 'HTTP/1.1', tone: 'warn' }] }, { ...ana, status: 'dim' }],
        links: [link('chat', 'ben', { label: '6 per domain', labelTone: 'warn' }), link('ana', 'chat')],
        flows: [
          { path: ['chat', 'ben'], tone: 'event', label: 'event', count: 2, duration: 1.2 },
          { path: ['ben', 'chat'], tone: 'request', label: 'POST (separate)', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'SSE limits',
          icon: 'Table',
          rows: [
            { text: 'Direction', value: 'server to client', tone: 'warn' },
            { text: 'Payload', value: 'text only', tone: 'warn' },
            { text: 'HTTP/1.1 tabs', value: '6 per domain', tone: 'bad' },
            { text: 'HTTP/2 tabs', value: 'shared stream', tone: 'good' },
            { text: 'Idle stream', value: ': keepalive every 15-30 s', tone: 'warn' },
            { text: 'Auth', value: 'cookie, no custom headers', tone: 'warn' },
          ],
        },
        caption: 'Great for feeds, thin for conversation',
      },
    },
    {
      title: 'WS upgrade',
      tag: 'concept',
      heading: 'WebSocket: upgrade once, then keep the line',
      eli5: 'Ben and the cook pick up a **WebSocket** phone line and keep it open. Either one can speak at any moment, and nobody has to walk to the counter again.',
      body: [
        'A **WebSocket** starts as an HTTP request with `Upgrade: websocket`. The server replies `101 Switching Protocols`.',
        'From then on the same TCP connection carries small messages in both directions, with no HTTP headers per message.',
      ],
      keyIdea: 'A WebSocket is one HTTP handshake that turns the connection into a long-lived two-way channel.',
      metrics: { delay: '~50 ms', reqs: '0 per message', wasted: '0', conns: '1M open' },
      metricTones: { delay: 'good', reqs: 'good', wasted: 'good' },
      scene: {
        nodes: [{ ...chat, status: 'active', badge: '101 Switching' }, { ...ben, status: 'ok', badge: 'wss:// open' }, { ...ana, status: 'dim' }],
        links: [link('ben', 'chat', { label: 'upgrade, then full duplex', arrow: 'both' })],
        flows: [
          { path: ['ben', 'chat'], tone: 'handshake', label: 'Upgrade: websocket', duration: 1.2 },
          { path: ['chat', 'ben'], tone: 'handshake', label: '101', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'The handshake',
          icon: 'Code',
          code: 'GET /ws HTTP/1.1\nUpgrade: websocket\nConnection: Upgrade\n\nHTTP/1.1 101 Switching Protocols',
          footer: { text: 'Same connection, new protocol', tone: 'good' },
        },
        caption: 'One handshake, then the line stays open',
      },
    },
    {
      title: 'WS frames',
      tag: 'concept',
      heading: 'Frames in both directions, almost no overhead',
      eli5: 'On the phone line Ben can say "I am typing" and the cook can say "order up" without either hanging up. A short word costs almost nothing to say.',
      body: [
        'After the upgrade, each message is a **frame** with a header of only **2 to 14 bytes**. Ben\'s phone sends messages, typing indicators and read receipts on the same connection it receives on.',
        'A "Ben is typing" signal costs a few bytes, not a full HTTP request.',
      ],
      keyIdea: 'WebSocket frames are tiny and flow both ways, so chatty features cost almost nothing.',
      metrics: { delay: '~50 ms', reqs: '0 per message', wasted: '0', conns: '1M open' },
      metricTones: { delay: 'good', reqs: 'good', wasted: 'good' },
      scene: {
        nodes: [ana, { ...chat, status: 'active' }, { ...ben, status: 'ok', chips: ['typing...'] }],
        links: [link('ana', 'chat', { arrow: 'both' }), link('ben', 'chat', { label: 'frames, both ways', arrow: 'both' })],
        flows: [
          { path: ['ana', 'chat', 'ben'], tone: 'event', label: 'msg frame', duration: 1.8 },
          { path: ['ben', 'chat'], tone: 'event', label: 'typing...', duration: 1.2, delay: 2.2 },
          { path: ['ben', 'chat'], tone: 'event', label: 'read receipt', duration: 1.2, delay: 3.6 },
        ],
        panel: {
          title: 'Cost of one signal',
          icon: 'Binary',
          rows: [
            { text: 'Frame header', value: '2 to 14 bytes', tone: 'good' },
            { text: 'HTTP request headers', value: '~500+ bytes', tone: 'warn' },
          ],
          footer: { text: 'Typing indicators become cheap', tone: 'good' },
        },
        caption: 'Small frames, both ways, on one connection',
      },
    },
    {
      title: 'WS client',
      tag: 'concept',
      heading: 'A WebSocket client you can ship',
      eli5: 'Ben picks up the phone line and listens. If the line drops, he waits a random moment before calling back, so a crowd of callers does not jam the line.',
      body: [
        'This client connects, shows each message it receives, and reconnects after a drop with **backoff and jitter** so a million phones do not return at once.',
        'Resume and acks are left out on purpose. Part 2 adds per-conversation sequence numbers, acks and resume. Reconnect is yours to write, since WebSocket has none built in.',
      ],
      keyIdea: 'With WebSocket you write the reconnect yourself. Part 2 adds resume and acks.',
      metrics: { delay: '~50 ms', reqs: '0 per message', wasted: '0', conns: '1M open' },
      scene: {
        nodes: [{ ...ben, status: 'active', chips: ['retry with jitter'] }, { ...chat, status: 'active' }, store],
        links: [link('ben', 'chat', { arrow: 'both' }), link('chat', 'store')],
        flows: [
          { path: ['chat', 'ben'], tone: 'event', label: 'message', duration: 1.2 },
          { path: ['ben', 'chat'], tone: 'handshake', label: 'reconnect after wait', duration: 1.2, delay: 1.6 },
        ],
        caption: 'Connect, receive, reconnect with jitter',
      },
      code: {
        language: 'javascript',
        title: 'A WebSocket client with reconnect and backoff',
        source: `let attempt = 0;

function connect() {
  const ws = new WebSocket("wss://chat.example/ws");

  ws.onopen = () => { attempt = 0; };
  ws.onmessage = (e) => showMessage(JSON.parse(e.data));
  ws.onclose = () => {
    // back off, with jitter so a million phones do not return at once
    const wait = Math.min(30000, 500 * 2 ** attempt++) * Math.random();
    setTimeout(connect, wait);
  };
}
connect();`,
        highlight: [4, 7, 10, 11],
      },
      quiz: {
        question: 'A sports site pushes live scores to browsers. Users never send anything back on that channel. Which option is the simplest good fit?',
        options: ['Short polling every 100 ms', 'Server-sent events', 'WebSocket', 'gRPC streaming from the browser'],
        answer: 1,
        explain: 'The data flows one way, server to client, which is what SSE does over plain HTTP, with reconnect and resume built in. WebSocket would work but adds a protocol you do not need. 100 ms polling is mostly empty requests.',
      },
    },
    {
      title: 'WS costs',
      tag: 'tradeoff',
      heading: 'What WebSocket makes you build',
      eli5: 'A private phone line is quick, but now you must write your own rules: how to say "got it", how to redial, and what to do when the shop phone system blocks the call.',
      body: [
        'It is a separate protocol, so you design your own message types, acknowledgements and reconnect logic. There is no built-in resume. Some corporate proxies break it.',
        'Always use `wss://` (WebSocket over TLS). It passes more firewalls and keeps messages private.',
      ],
      keyIdea: 'WebSocket gives speed and two-way flow, and hands you a protocol to design and operate.',
      metrics: { delay: '~50 ms', reqs: '0 per message', wasted: '0', conns: '1M open' },
      metricTones: { conns: 'warn' },
      scene: {
        nodes: [{ ...ben, status: 'active' }, { ...chat, status: 'active', chips: [{ text: 'your own protocol', tone: 'warn' }] }, { ...store, status: 'dim' }],
        links: [link('ben', 'chat', { label: 'wss://', arrow: 'both' }), link('chat', 'store')],
        flows: [{ path: ['ben', 'chat'], tone: 'event', label: '{"type":"ack"}', duration: 1.4 }],
        panel: {
          title: 'You now own',
          icon: 'Table',
          rows: [
            { text: 'Message types', value: 'design them', tone: 'warn' },
            { text: 'Acks and resume', value: 'build them', tone: 'warn' },
            { text: 'Reconnect logic', value: 'build it', tone: 'warn' },
            { text: 'Proxy support', value: 'test it', tone: 'warn' },
          ],
        },
        caption: 'Power comes with homework',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Pick the simplest one that meets the need',
      eli5: 'If food takes an hour, checking now and then is fine. If you only need to hear announcements, use the speaker. If you and the cook keep talking back and forth, keep the phone line open.',
      body: [
        '**Short polling** for data that changes every few minutes: job status, dashboards. **Long polling** as a fallback where nothing else gets through. **SSE** when data flows one way: notifications, feeds, live scores, streamed AI answers.',
        '**WebSocket** when both sides talk often and fast: chat, multiplayer games, collaborative editing. It brings stateful servers, which part 2 covers.',
      ],
      keyIdea: 'Match the tool to direction and frequency: polling for slow data, SSE for one-way streams, WebSocket for two-way chatter.',
      metrics: { delay: '50 ms to 15 s', reqs: 'varies', wasted: 'varies', conns: 'varies' },
      scene: {
        nodes: [
          { id: 'poll', kind: 'block', at: at(-3.8, -3.8), label: 'polling', sub: 'slow data', icon: 'Repeat', tint: 'gray' },
          { id: 'sse', kind: 'block', at: at(0, -3.8), label: 'SSE', sub: 'one-way stream', icon: 'Rss', tint: 'blue' },
          { id: 'ws', kind: 'block', at: at(3.8, -3.8), label: 'WebSocket', sub: 'two-way chatter', icon: 'ArrowLeftRight', tint: 'green' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Rule of thumb',
          icon: 'Route',
          rows: [
            { text: 'Build status, dashboards', value: 'short polling' },
            { text: 'Behind strict proxies', value: 'long polling' },
            { text: 'Scores, feeds, AI tokens', value: 'SSE', tone: 'good' },
            { text: 'Chat, games, co-editing', value: 'WebSocket', tone: 'good' },
          ],
        },
        caption: 'Direction and frequency decide',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Four ways around "the client starts"',
      eli5: 'Asking every few seconds, waiting at the counter, listening to the speaker and keeping a phone line open all get Ben his food. They differ in how much effort is wasted and who can speak.',
      body: [
        '**Short polling** is simple and mostly empty replies. **Long polling** parks a request until there is news. **SSE** streams events one way over HTTP with automatic resume. **WebSocket** upgrades once and carries small frames both ways.',
        'Part 2 scales the winner: many gateways, a pub/sub backplane, presence, and reconnects.',
      ],
      keyIdea: 'Pick the transport by direction and rate. The more it pushes, the more machinery you run.',
      metrics: { delay: '~50 ms', reqs: '0 per message', wasted: '0', conns: '1M open' },
      metricTones: { delay: 'good', reqs: 'good', wasted: 'good' },
      scene: {
        nodes: [ana, { ...chat, status: 'ok' }, { ...ben, status: 'ok' }, store],
        links: [link('ana', 'chat'), link('chat', 'ben', { arrow: 'both' }), link('chat', 'store')],
        flows: [
          { path: ['ana', 'chat'], tone: 'request', label: '"on my way"', duration: 1.2 },
          { path: ['chat', 'store'], tone: 'data', duration: 1, delay: 1.3 },
          { path: ['chat', 'ben'], tone: 'event', label: 'frame', duration: 1.2, delay: 1.3 },
        ],
        caption: 'Under a second, with no asking',
      },
      quiz: {
        question: 'Which technique still sends a brand new HTTP request, with full headers, for every message it delivers?',
        options: ['Long polling', 'Server-sent events', 'WebSocket', 'All three'],
        answer: 0,
        explain: 'After each reply a long poll client must send a new request. SSE keeps one response open and WebSocket keeps one connection open, so neither pays HTTP headers per message.',
      },
    },
  ],
};
