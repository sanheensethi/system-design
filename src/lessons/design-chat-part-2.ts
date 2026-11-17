import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Same layout as part 1: devices and chat servers on the top row, shared services below.
const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-5, -6), label: 'Ana', sub: 'phone' };
const chat1: SceneNode = { id: 'chat1', kind: 'block', at: at(-1.7, -6), label: 'chat server 1', sub: '100K sockets', icon: 'Server', tint: 'blue' };
const chat2: SceneNode = { id: 'chat2', kind: 'block', at: at(1.7, -6), label: 'chat server 2', sub: '100K sockets', icon: 'Server', tint: 'blue' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(5, -6), label: 'Ben', sub: 'phone' };
const discovery: SceneNode = { id: 'discovery', kind: 'block', at: at(-1.7, 3), label: 'discovery', sub: 'picks a server', icon: 'Route', tint: 'teal' };
const push: SceneNode = { id: 'push', kind: 'block', at: at(5, 3), label: 'push service', sub: 'APNs, FCM', icon: 'Mail', tint: 'amber' };
const benLaptop: SceneNode = { id: 'benLaptop', kind: 'client', at: at(5, 3), label: 'Ben', sub: 'laptop' };
const registry: SceneNode = { id: 'registry', kind: 'cache', at: at(-3.4, 7), label: 'session registry', sub: 'user to server' };
const bus: SceneNode = { id: 'bus', kind: 'queue', at: at(0, 7), label: 'server bus', sub: 'pub/sub' };
const store: SceneNode = { id: 'store', kind: 'db', at: at(3.4, 7), label: 'message store', sub: 'by conversation' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designChatPart2: Lesson = {
  id: 'design-chat-part-2',
  title: 'Design a chat system (part 2)',
  tagline: 'Chat for 100 million daily users, part 2: offline delivery, every device in sync, receipts, presence, groups, crashes and the extras.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Offline delivery with push notifications and catch-up sync',
    'Multi-device sync and read receipts as one number',
    'Presence with heartbeats, and why its fan-out must be capped',
    'Group delivery, and a pull mode for very large channels',
    'Surviving a dead chat server, deploys and in-flight sends',
    'Media, end-to-end encryption and typing indicators',
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
      title: 'Ben is offline',
      tag: 'problem',
      heading: 'Ben is offline: the message is safe, but who tells him?',
      eli5: 'Ben is out of the hotel. The note waits safely in the notebook, but nobody has told Ben it is there. A short text to Ben\'s own phone is a **push notification**.',
      body: [
        'The registry has no devices for Ben. The message is already safe in the store, so nothing is lost. Server 1 puts a small job on the push queue.',
        'The **push service** sends a notification through Apple\'s or Google\'s push gateway (APNs or FCM) with the sender name and a preview.',
      ],
      keyIdea: 'An offline receiver loses nothing, because the store already has the message. Push only tells the phone to come back.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms online', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [
          { ...chat1, status: 'active', badge: 'seq 814' },
          { ...registry, badge: 'ben: no devices' },
          { ...push, status: 'active' },
          { ...ben, status: 'dim', badge: 'app closed' },
        ],
        links: [link('chat1', 'registry', { style: 'dashed' }), link('chat1', 'push'), link('push', 'ben', { style: 'dashed', label: 'APNs / FCM' })],
        flows: [
          { path: ['chat1', 'registry'], tone: 'request', label: 'Ben online?', duration: 1.3 },
          { path: ['chat1', 'push'], tone: 'event', label: 'notify job', duration: 1.4, delay: 1.5 },
          { path: ['push', 'ben'], tone: 'event', label: 'Ana: on my way', duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Offline branch of route',
          icon: 'Mail',
          code: 'if not devices and member != sender:\n    await push_queue.enqueue({\n        "user": member, "conv": conv,\n        "seq": msg["seq"]})',
          footer: { text: 'No device online, so queue a push', tone: 'good' },
        },
        caption: 'Offline: the store keeps it, push points the way',
      },
    },
    {
      title: 'Push limits',
      tag: 'concept',
      heading: 'Push needs a queue, retries and limits',
      eli5: 'The desk sends a text to Ben, but 30 notes in one chat should not buzz his pocket 30 times. The desk waits a moment, sends one text, and skips muted chats.',
      body: [
        'Use a queue with retries, because the push gateways throttle and fail like any third party.',
        'Push volume needs limits of its own. Collapse a burst of 30 messages from one chat into one notification, and respect muted chats, so a busy group does not buzz a phone 30 times.',
      ],
      keyIdea: 'Treat push as a best-effort hint with its own queue, retries and throttles. The store is what guarantees delivery.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms online', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat1, status: 'active', chips: [{ text: '30 messages, 1 chat', tone: 'warn' }] }, { ...push, status: 'active', badge: 'collapse burst' }, { ...ben, status: 'dim', badge: '1 buzz' }],
        links: [link('chat1', 'push', { label: 'queue + retries' }), link('push', 'ben', { style: 'dashed' })],
        flows: [
          { path: ['chat1', 'push'], tone: 'event', label: '30 jobs', count: 4, duration: 1.4 },
          { path: ['push', 'ben'], tone: 'event', label: '1 notification', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Push rules',
          icon: 'Mail',
          rows: [
            { text: 'Burst of 30 in one chat', value: '1 notification', tone: 'good' },
            { text: 'Muted chat', value: 'no push', tone: 'good' },
            { text: 'Gateway throttles', value: 'retry with backoff' },
            { text: 'Gateway is best effort', value: 'store is the truth', tone: 'warn' },
          ],
        },
        caption: 'One buzz per burst',
      },
    },
    {
      title: 'Catch-up sync',
      tag: 'concept',
      heading: 'On return, the phone asks for everything newer',
      eli5: 'When Ben walks back in, he tells the operator "my last line was 814". The operator reads him every line after that from the notebook. Nothing is lost, even if no text ever reached him.',
      body: [
        'When Ben opens the app, his phone reconnects and sends, for each conversation, the last sequence number it holds. The server reads everything newer from the store and streams it down.',
        'The socket is the fast path. This **catch-up sync** is the path that guarantees delivery. The app also keeps recent history in a local database, so a chat opens instantly and then fills the gap.',
      ],
      keyIdea: 'The store is the delivery guarantee. Sync by sequence number fetches anything the live path missed.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms online', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ben, status: 'active', badge: 'last seq: 814' }, { ...chat2, status: 'active' }, { ...store, status: 'ok' }],
        links: [link('ben', 'chat2'), link('chat2', 'store')],
        flows: [
          { path: ['ben', 'chat2'], tone: 'handshake', label: 'reconnect, last=814', duration: 1.4 },
          { path: ['chat2', 'store'], tone: 'request', label: 'seq > 814', duration: 1.3, delay: 1.6 },
          { path: ['store', 'chat2', 'ben'], tone: 'response', label: '815, 816', count: 2, duration: 1.8, delay: 3.1 },
        ],
        panel: {
          title: 'Sync request',
          icon: 'Download',
          code: '{ "type": "sync",\n  "conversations": [\n    { "id": 42, "have_seq": 814 }\n  ] }',
          footer: { text: 'One range read per chat', tone: 'good' },
        },
        caption: 'Ask for everything after my last number',
      },
    },
    {
      title: 'Many devices',
      tag: 'concept',
      heading: 'Every device keeps its own place',
      eli5: 'Ben has a phone and a laptop, and each keeps its own bookmark in the notebook. A laptop that sleeps all day just reads from its own bookmark when it wakes.',
      body: [
        'Each device is its own session in the registry and its own socket, so a new message goes to every online device.',
        'Each device tracks, per conversation, the highest sequence number it has. A laptop that slept all day catches up from its own number without caring what the phone has seen.',
      ],
      keyIdea: 'Sync is one cursor per device per conversation, so adding a device adds no new mechanism.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [
          { ...chat2, status: 'active' },
          { ...ben, status: 'ok', badge: 'seq 816' },
          { ...benLaptop, status: 'dim', badge: 'asleep at 812' },
          { ...registry, badge: 'phone, laptop' },
        ],
        links: [link('chat2', 'ben'), link('chat2', 'benLaptop'), link('chat2', 'registry', { style: 'dashed' })],
        flows: [
          { path: ['chat2', 'ben'], tone: 'event', label: 'message 816', duration: 1.4 },
          { path: ['benLaptop', 'chat2'], tone: 'handshake', label: 'wake, last=812', duration: 1.4, delay: 1.8 },
          { path: ['chat2', 'benLaptop'], tone: 'response', label: '813 to 816', count: 3, duration: 1.6, delay: 3.4 },
        ],
        caption: 'Each device syncs from its own number',
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
      title: 'Read receipts',
      tag: 'concept',
      heading: 'A read receipt is one number per member',
      eli5: 'When Ben reads a note, he writes "read up to line 814" on one card. Ana sees the **read receipt**, and Ben\'s laptop sees it too and clears its little badge.',
      body: [
        'Storing "read" per message per member would multiply writes. Store one number per member per conversation instead: `last_read_seq`.',
        'When Ben reads on his phone, the phone sends `read up_to_seq 814`. The server updates that one value and sends a small receipt event to Ana and to Ben\'s laptop, which clears its badge. The **unread count** is the chat\'s latest seq minus `last_read_seq`.',
      ],
      keyIdea: 'One last_read_seq per member per conversation replaces a flag on every message.',
      metrics: { conns: '30M', msgs: '150K/s + receipts', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, badge: 'seen' }, { ...chat2, status: 'active', badge: 'last_read = 814' }, { ...ben, status: 'active', badge: 'read 814' }, { ...benLaptop, status: 'ok', badge: 'badge cleared' }],
        links: [link('ben', 'chat2'), link('chat2', 'benLaptop'), link('chat2', 'ana', { style: 'dashed' })],
        flows: [
          { path: ['ben', 'chat2'], tone: 'request', label: 'read up to 814', duration: 1.1 },
          { path: ['chat2', 'benLaptop'], tone: 'event', label: 'clear badge', duration: 1.2, delay: 1.4 },
          { path: ['chat2', 'ana'], tone: 'event', label: 'receipt', duration: 1.6, delay: 1.4 },
        ],
        caption: 'One number, sent to every device',
      },
    },
    {
      title: 'Delivered, hints',
      tag: 'tradeoff',
      heading: 'Receipts are hints, messages are not',
      eli5: 'The little ticks are nice to know but not worth stopping the hotel for. If the operator is busy, the tick can arrive late, and the note itself never waits.',
      body: [
        'Delivered receipts work the same way with `last_delivered_seq`. Each is a tiny event that can be batched into one update.',
        'Under load, receipts can be delayed or dropped. The message is precious and the receipt is a hint, so protect the message path first.',
      ],
      keyIdea: 'Shed receipt traffic before message traffic. Losing a tick costs a little. Losing a message costs trust.',
      metrics: { conns: '30M', msgs: '150K/s + receipts', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, badge: 'two ticks' }, { ...chat1, status: 'hot', load: 88, badge: 'busy' }, { ...ben, status: 'active' }],
        links: [link('ben', 'chat1'), link('chat1', 'ana', { style: 'dashed' })],
        flows: [
          { path: ['ben', 'chat1'], tone: 'request', label: 'delivered up to 814', duration: 1.3 },
          { path: ['chat1', 'ana'], tone: 'event', label: 'batched receipt', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Priority under load',
          icon: 'Gauge',
          rows: [
            { text: 'Messages', value: 'protect first', tone: 'good' },
            { text: 'Delivered, read receipts', value: 'batch or delay', tone: 'warn' },
            { text: 'Typing, presence', value: 'drop first', tone: 'muted' },
          ],
        },
        caption: 'Shed the hints first',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Presence from heartbeats, with a grace period',
      eli5: 'Each room has a light that stays on while the guest checks in every half minute. The light goes off only after two missed check-ins, so a quick walk through a tunnel does not flicker it.',
      body: [
        'Each device sends a heartbeat every 30 seconds to its chat server. The server marks the user offline only after about 60 seconds of silence, so a train tunnel does not flicker the green dot.',
        'The registry stores status and `last_seen`. The real-time lesson covers the heartbeat mechanics.',
      ],
      keyIdea: 'Presence is inferred from silence, so a grace period keeps short network gaps from looking like logouts.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ben, status: 'ok', badge: 'online' }, { ...chat2, status: 'active' }, { ...registry, status: 'ok', badge: 'ben: online' }],
        links: [link('ben', 'chat2', { label: 'ping every 30 s', arrow: 'both' }), link('chat2', 'registry', { style: 'dashed' })],
        flows: [
          { path: ['ben', 'chat2'], tone: 'handshake', label: 'heartbeat', duration: 1.2 },
          { path: ['chat2', 'registry'], tone: 'data', label: 'last_seen = now', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Presence clock',
          icon: 'Clock',
          rows: [
            { text: 'Heartbeat every 30 s', value: 'online', tone: 'good' },
            { text: 'One missed, 30 s', value: 'still online' },
            { text: 'Two missed, 60 s', value: 'offline', tone: 'warn' },
          ],
        },
        caption: 'Silence for 60 seconds means offline',
      },
    },
    {
      title: 'Presence fan-out',
      tag: 'tradeoff',
      heading: 'Send presence only to people who are looking',
      eli5: 'If every guest\'s light change was announced to all 200 of their friends, the hotel would shout all day. Only the friends looking at that door get told.',
      body: [
        'Pushing every change of every user to all their contacts turns 30M flickering devices into a storm.',
        'Send presence only to users who are looking: a client subscribes to the people in the chat it has open, and fetches the rest when it opens the contact list.',
      ],
      keyIdea: 'Subscribe to presence for what is on screen, and pull the rest on demand.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ben, status: 'active', badge: 'went offline' }, { ...chat2, status: 'active' }, { ...bus, status: 'active' }, { ...chat1, status: 'active' }, { ...ana, status: 'ok', badge: 'has Ben\'s chat open' }],
        links: [link('ben', 'chat2'), link('chat2', 'bus'), link('bus', 'chat1'), link('chat1', 'ana')],
        flows: [
          { path: ['ben', 'chat2', 'bus', 'chat1', 'ana'], tone: 'event', label: 'Ben: offline', duration: 3 },
        ],
        panel: {
          title: 'One status change',
          icon: 'Users',
          rows: [
            { text: 'Ben\'s contacts', value: '200' },
            { text: 'Push to everyone', value: '200 updates', tone: 'bad' },
            { text: 'Subscribed viewers', value: '1 update', tone: 'good' },
          ],
          footer: { text: 'Others fetch on opening the list', tone: 'muted' },
        },
        caption: 'Subscribers only',
      },
    },
    {
      title: 'Small groups',
      tag: 'concept',
      heading: 'A group message is stored once, routed once per server',
      eli5: 'A tour group\'s note is filed in one notebook. The desk gives it once to each operator, who reads it out to the group\'s guests on their lines. That is **fan-out**.',
      body: [
        'A group message is stored once, in the group\'s partition. Delivery goes to the online members\' devices, grouped by server, so a 500-member group spread over 80 servers costs 80 publishes, not 500.',
        'The member cap keeps that cost bounded. Offline members get push and sync like anyone else.',
      ],
      keyIdea: 'Store once, publish once per destination server, and cap the group size.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '150 ms (groups)', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: ['to: hikers'] }, { ...chat1, status: 'active' }, { ...store, badge: 'stored once' }, { ...bus, status: 'active', badge: '1 copy per server' }, { ...chat2, status: 'active', badge: '6 members here' }],
        links: [link('ana', 'chat1'), link('chat1', 'store'), link('chat1', 'bus'), link('bus', 'chat2')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', label: 'to hikers', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', label: 'append once', duration: 1.3, delay: 1.1 },
          { path: ['chat1', 'bus', 'chat2'], tone: 'event', label: 'server:chat-2', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: '500-member group',
          icon: 'Users',
          rows: [
            { text: 'Copies stored', value: '1', tone: 'good' },
            { text: 'Servers holding members', value: '80' },
            { text: 'Bus publishes', value: '80', tone: 'good' },
          ],
        },
        caption: 'Store once, deliver once per server',
      },
      quiz: {
        question: 'A group of 500 members has devices connected to 80 chat servers. How many publishes on the server bus does one message need?',
        options: ['500, one per member', '80, one per destination server', '1, and the bus copies it to everyone', '4,000, one per member device pair'],
        answer: 1,
        explain: 'The sender\'s server looks up the members\' devices, groups them by chat server and publishes once per server. Each server then writes to its own sockets. The group size cap keeps the lookup and the publish count bounded.',
      },
    },
    {
      title: 'Large channels',
      tag: 'tradeoff',
      heading: 'Very large channels switch to pull',
      eli5: 'A stadium announcement is not whispered to each seat. The note goes on a big board, and people read it when they look up. Only a name call buzzes someone\'s pocket.',
      body: [
        'Channels with 100K members need a different mode: no presence, no per-member receipts, and members pull new messages when they open the channel.',
        'Push goes only for mentions. Delivery to 100K sockets per message would swamp the servers, so the channel is stored once and read on demand.',
      ],
      keyIdea: 'Past a size cap, replace push to everyone with pull on open, and drop the extras that scale with membership.',
      metrics: { conns: '30M', msgs: '150K/s', latency: 'on open', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: ['to: #announcements'] }, { ...chat1, status: 'active' }, { ...store, status: 'ok', badge: '100K members' }, { ...chat2, status: 'active' }, { ...ben, status: 'active', badge: 'opens channel' }],
        links: [link('ana', 'chat1'), link('chat1', 'store'), link('ben', 'chat2'), link('chat2', 'store')],
        flows: [
          { path: ['ana', 'chat1', 'store'], tone: 'data', label: 'append once', duration: 2 },
          { path: ['ben', 'chat2', 'store'], tone: 'request', label: 'read new', duration: 2, delay: 2.4 },
        ],
        panel: {
          title: 'Channel mode',
          icon: 'Layers',
          rows: [
            { text: 'Delivery', value: 'pull on open', tone: 'good' },
            { text: 'Presence', value: 'off', tone: 'muted' },
            { text: 'Read receipts', value: 'off', tone: 'muted' },
            { text: 'Push', value: 'mentions only' },
          ],
        },
        caption: 'Members come to the channel',
      },
    },
    {
      title: 'Server dies',
      tag: 'case',
      heading: 'Case: chat server 2 crashes with 100K sockets',
      eli5: 'An operator\'s switchboard breaks and 100K guests lose their lines at once. If every guest runs to the concierge in the same second, the hall is jammed. Staggering their return fixes that.',
      body: [
        'Server 2 dies. Its devices notice within one heartbeat interval. If they all retry at once, 100K logins hit discovery in the same second.',
        'Clients reconnect with **exponential backoff and jitter** (the timeouts and retries lesson), spreading the herd over about 30 seconds, roughly 3K reconnects per second. Discovery drops server 2 after its missed health checks and spreads the devices across servers with room.',
      ],
      keyIdea: 'Sockets are disposable. Jittered reconnects turn a stampede into a trickle.',
      metrics: { conns: '29.9M (100K reconnecting)', msgs: '150K/s', latency: 'live path late for 0.3%', servers: '399', storage: '800 GB/day' },
      metricTones: { conns: 'warn', servers: 'warn' },
      scene: {
        nodes: [{ ...chat2, status: 'down', badge: 'crashed' }, { ...ben, status: 'active', badge: 'backoff + jitter' }, { ...discovery, status: 'active', badge: 'chat-2 removed' }, { ...chat1, status: 'active', badge: 'takes reconnects' }],
        links: [link('ben', 'chat2', { style: 'faint' }), link('ben', 'discovery', { style: 'dashed', label: '3K/s, not 100K/s', labelTone: 'warn' }), link('ben', 'chat1')],
        flows: [
          { path: ['chat2', 'ben'], tone: 'error', label: 'socket closed', duration: 1 },
          { path: ['ben', 'discovery'], tone: 'request', label: 'new server?', duration: 1.5, delay: 1.3 },
          { path: ['discovery', 'ben'], tone: 'response', label: 'chat-1', duration: 1.5, delay: 3 },
          { path: ['ben', 'chat1'], tone: 'handshake', label: 'reconnect', duration: 1.3, delay: 4.6 },
        ],
        panel: {
          title: 'The reconnect storm',
          icon: 'Activity',
          rows: [
            { text: 'No jitter', value: '100K logins in 1 s', tone: 'bad' },
            { text: 'Backoff + jitter', value: '~3K/s over 30 s', tone: 'good' },
            { text: 'Discovery', value: 'drops chat-2' },
          ],
        },
        caption: 'Spread the herd',
      },
    },
    {
      title: 'Stale registry',
      tag: 'case',
      heading: 'Stale registry entries expire, sync fills the gap',
      eli5: 'The board still says Ben is with the broken operator. For up to a minute notes for Ben go nowhere, but they are already in the notebook, so Ben reads them when he is back on a new line.',
      body: [
        'Old registry entries point at a dead server. Each has a TTL of up to about 60 seconds, and a reconnect overwrites it sooner. Bus publishes to a dead server are lost on the live path, and the sender sees no error.',
        'That is fine, because they are already in the store. Catch-up sync from each device\'s last sequence number recovers them.',
      ],
      keyIdea: 'Routing may miss for a moment. The store and the sequence cursor make the miss harmless.',
      metrics: { conns: '29.9M', msgs: '150K/s', latency: 'live path late for 0.3%', servers: '399', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat1, status: 'active' }, { ...registry, badge: 'ben: chat-2 (expired)' }, { ...store, status: 'ok', badge: 'seq 815, 816' }, { ...ben, status: 'active', badge: 'last: 814' }],
        links: [link('ben', 'chat1'), link('chat1', 'registry', { style: 'dashed' }), link('chat1', 'store')],
        flows: [
          { path: ['ben', 'chat1'], tone: 'handshake', label: 'reconnect, last=814', duration: 1.4 },
          { path: ['chat1', 'registry'], tone: 'data', label: 'ben: chat-1', duration: 1.3, delay: 1.5 },
          { path: ['chat1', 'store'], tone: 'request', label: 'seq > 814', duration: 1.2, delay: 3 },
          { path: ['chat1', 'ben'], tone: 'response', label: '815, 816', count: 2, duration: 1.4, delay: 4.4 },
        ],
        caption: 'Reconnect overwrites the entry, then sync',
      },
    },
    {
      title: 'In-flight sends',
      tag: 'case',
      heading: 'Sends in flight still arrive exactly once',
      eli5: 'Ana handed a note to the operator just as the switchboard broke. Either the note was already filed, or it was not. Either way, handing it over again with its number gives one note in the notebook.',
      body: [
        'Sends that were in flight on server 2 either reached the store or did not. If they did, the resend with the same `client_msg_id` gets the original ack.',
        'If they did not, the resend stores them now. Either way the message appears exactly once, in order.',
      ],
      keyIdea: 'Store-before-ack plus a client id makes a crash at any moment safe.',
      metrics: { conns: '29.9M', msgs: '150K/s', latency: 'live path late for 0.3%', servers: '399', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: [{ text: 'c-9f2e, no ack', tone: 'warn' }] }, { ...chat2, status: 'down', badge: 'crashed' }, { ...chat1, status: 'active' }, { ...store, status: 'ok' }],
        links: [link('ana', 'chat2', { style: 'faint' }), link('ana', 'chat1'), link('chat1', 'store')],
        flows: [
          { path: ['ana', 'chat2'], tone: 'error', label: 'send, no ack', duration: 1.3 },
          { path: ['ana', 'chat1'], tone: 'request', label: 'resend c-9f2e', duration: 1.3, delay: 1.6 },
          { path: ['chat1', 'store'], tone: 'data', label: 'stored once', duration: 1.2, delay: 3.1 },
        ],
        panel: {
          title: 'Two possible worlds',
          icon: 'Split',
          rows: [
            { text: 'Already stored', value: 'ack with old seq', tone: 'good' },
            { text: 'Not stored', value: 'store now, ack', tone: 'good' },
            { text: 'Result', value: 'one copy, in order', tone: 'good' },
          ],
        },
        caption: 'Exactly once, either way',
      },
    },
    {
      title: 'Deploys',
      tag: 'concept',
      heading: 'A deploy is a planned crash: drain a slice at a time',
      eli5: 'Replacing operators is the same as a breakdown, only planned. Send a few at a time on break, let their guests move to others calmly, and never pull everyone at once.',
      body: [
        'Restarting a chat server disconnects every socket on it, which is the same event as a crash. So drain servers a slice at a time.',
        'Discovery stops sending new connections to the draining server, its sockets close gradually with jitter, and only then does it restart.',
      ],
      keyIdea: 'Deploys cause the same reconnect wave as failures. Roll them out slowly so the wave stays small.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400 (a few draining)', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...chat2, status: 'dim', badge: 'draining' }, { ...discovery, status: 'active', badge: 'skip chat-2' }, { ...chat1, status: 'active', load: 55 }, { ...ben, status: 'active', badge: 'moves over' }],
        links: [link('chat2', 'ben', { style: 'dashed', label: 'close, jittered' }), link('discovery', 'ben'), link('ben', 'chat1')],
        flows: [
          { path: ['chat2', 'ben'], tone: 'event', label: 'please reconnect', duration: 1.4 },
          { path: ['discovery', 'ben'], tone: 'response', label: 'chat-1', duration: 1.5, delay: 1.6 },
          { path: ['ben', 'chat1'], tone: 'handshake', label: 'reconnect', duration: 1.3, delay: 3.3 },
        ],
        caption: 'Drain, move, restart',
      },
    },
    {
      title: 'Media',
      tag: 'concept',
      heading: 'Media goes to object storage, the chat carries a link',
      eli5: 'A heavy photo does not travel down the phone line. Ana drops it in the hotel\'s storeroom, and the note just says where to find it.',
      body: [
        'Chat servers should never carry large files. The app uploads the image or video straight to object storage with a short-lived signed URL, then sends a normal message holding the file link and a small thumbnail.',
        'The receiver fetches the file from storage, often through a CDN. The chat path keeps its small, fast messages.',
      ],
      keyIdea: 'Keep bytes off the real-time path: upload to storage, send a link.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: 'media is extra' },
      scene: {
        nodes: [{ ...ana, chips: ['photo 3 MB'] }, { id: 'blobs', kind: 'storage', at: at(0, 7), label: 'object storage', sub: 'photos, videos' }, { ...chat2, status: 'active' }, { ...ben, status: 'active' }],
        links: [link('ana', 'blobs', { style: 'dashed', label: 'signed URL' }), link('ana', 'chat2'), link('chat2', 'ben'), link('blobs', 'ben', { style: 'faint' })],
        flows: [
          { path: ['ana', 'blobs'], tone: 'data', label: '3 MB upload', duration: 1.8 },
          { path: ['ana', 'chat2', 'ben'], tone: 'request', label: 'link + thumbnail', duration: 2, delay: 2 },
          { path: ['blobs', 'ben'], tone: 'response', label: 'download', duration: 1.6, delay: 4.2 },
        ],
        caption: 'Bytes to storage, a link to chat',
      },
    },
    {
      title: 'Encryption',
      tag: 'tradeoff',
      heading: 'End-to-end encryption moves the keys to the phones',
      eli5: 'Ana locks the note in a box only Ben\'s key opens. The hotel files and delivers the box without being able to read it, which also means the hotel cannot read it to search it for you.',
      body: [
        'With **end-to-end encryption**, each device holds private keys and the server only stores and routes ciphertext. Even a breach of the message store reveals no text.',
        'The costs: the server cannot search, preview or moderate content, and every device needs its own key exchange for multi-device and group chats. Encryption in transit (TLS) still applies on every hop.',
      ],
      keyIdea: 'End-to-end encryption protects content from the server itself, at the price of server-side features.',
      metrics: { conns: '30M', msgs: '150K/s', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: [{ text: 'encrypts with Ben\'s key', tone: 'good' }] }, { ...chat2, status: 'active', badge: 'sees ciphertext' }, { ...store, badge: 'x9fQ2a...' }, { ...ben, status: 'ok', chips: [{ text: 'decrypts', tone: 'good' }] }],
        links: [link('ana', 'chat2'), link('chat2', 'store'), link('chat2', 'ben')],
        flows: [
          { path: ['ana', 'chat2'], tone: 'request', label: 'x9fQ2a...', duration: 1.3 },
          { path: ['chat2', 'store'], tone: 'data', label: 'x9fQ2a...', duration: 1.3, delay: 1.4 },
          { path: ['chat2', 'ben'], tone: 'event', label: 'x9fQ2a...', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'What the server can do',
          icon: 'Shield',
          rows: [
            { text: 'Store and route', value: 'yes', tone: 'good' },
            { text: 'Read the text', value: 'no', tone: 'good' },
            { text: 'Search or preview', value: 'no', tone: 'warn' },
            { text: 'Key exchange per device', value: 'required', tone: 'warn' },
          ],
        },
        caption: 'Ciphertext in the middle',
      },
    },
    {
      title: 'Typing',
      tag: 'concept',
      heading: 'Typing indicators are events that are never stored',
      eli5: 'When Ana starts writing, a little flag pops up in Ben\'s room. Nobody files the flag in a notebook, because it is only useful for a few seconds.',
      body: [
        'A "typing" indicator is a tiny event sent over the socket and relayed through the server bus. It is not given a sequence number and never touches the message store.',
        'Send it at most every few seconds and let it expire on the receiver after a short timeout. If it is lost, nobody notices.',
      ],
      keyIdea: 'Ephemeral signals skip the durable path completely: no sequence number, no storage, no retry.',
      metrics: { conns: '30M', msgs: '150K/s + events', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      scene: {
        nodes: [{ ...ana, chips: ['typing...'] }, { ...chat1, status: 'active' }, { ...chat2, status: 'active' }, { ...ben, status: 'ok', badge: 'Ana is typing' }],
        links: [link('ana', 'chat1'), link('chat1', 'chat2', { style: 'dashed' }), link('chat2', 'ben')],
        flows: [{ path: ['ana', 'chat1', 'chat2', 'ben'], tone: 'event', label: 'typing', duration: 2.6 }],
        panel: {
          title: 'Typing event',
          icon: 'Activity',
          rows: [
            { text: 'Sequence number', value: 'none' },
            { text: 'Stored', value: 'never', tone: 'good' },
            { text: 'Sent at most', value: 'every 3 s' },
            { text: 'Receiver timeout', value: '5 s' },
          ],
        },
        caption: 'Live signal, no record',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 2 recap: sockets are disposable, the log is not',
      eli5: 'Notes for absent guests wait in the **notebook** and a text points them back. Each guest keeps their own bookmark, lights show only to watchers, and a broken switchboard costs a short wait.',
      body: [
        'Offline users get a **push notification** and sync by sequence number when they return. Each device keeps its own cursor, receipts are one `last_read_seq` per member, presence goes only to people who are looking, and group fan-out is capped.',
        'A dead server costs a jittered reconnect and a sync, and every stored message survives it. Media goes to object storage and encryption moves keys to the phones.',
      ],
      keyIdea: 'Treat connections as cheap and replaceable, and the per-conversation log as the one thing that must be right.',
      metrics: { conns: '30M peak', msgs: '150K/s peak', latency: '120 ms', servers: '400', storage: '800 GB/day' },
      metricTones: { latency: 'good', servers: 'good' },
      scene: {
        nodes: [ana, chat1, chat2, ben, store],
        links: [link('ana', 'chat1'), link('chat1', 'store'), link('chat1', 'chat2', { style: 'dashed' }), link('chat2', 'ben')],
        flows: [
          { path: ['ana', 'chat1'], tone: 'request', duration: 1 },
          { path: ['chat1', 'store'], tone: 'data', duration: 1.3, delay: 1.1 },
          { path: ['chat1', 'chat2', 'ben'], tone: 'event', duration: 2, delay: 2.5 },
        ],
        panel: {
          title: 'Part 2 in one table',
          icon: 'Table',
          rows: [
            { text: 'Receiver offline', value: 'push + sync' },
            { text: 'Devices, receipts', value: 'one cursor each' },
            { text: 'Presence', value: 'heartbeat, subscribers' },
            { text: 'Groups', value: 'store once, per server' },
            { text: 'Crash', value: 'jitter + sync' },
          ],
        },
        caption: 'Many socket servers in front of one ordered log',
      },
      quiz: {
        question: 'Chat server 2 crashes and 100K clients lose their sockets. Which combination keeps this to a short delay with no lost messages?',
        options: [
          'Clients retry immediately, and servers keep messages in memory',
          'Jittered reconnects, TTL registry entries, and sync from the last sequence number against a durable store',
          'Every message is sent to all 400 servers just in case',
          'Clients stop sending until an operator restarts the server',
        ],
        answer: 1,
        explain: 'Jitter spreads the reconnect herd, TTLs clear stale routing, and the durable store plus per-device sequence cursor returns anything missed. In-memory messages would die with the server.',
      },
    },
  ],
};
