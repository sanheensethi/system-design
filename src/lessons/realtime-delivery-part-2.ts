import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-6.8, -3.8), label: 'Ana' };
const gw1: SceneNode = { id: 'gw1', kind: 'block', at: at(-3.4, -3.8), label: 'gateway 1', sub: 'Ana connected', icon: 'Server', tint: 'blue' };
const bus: SceneNode = { id: 'bus', kind: 'block', at: at(0, -3.8), label: 'pub/sub', sub: 'Redis or Kafka', icon: 'Share2', tint: 'amber' };
const gw2: SceneNode = { id: 'gw2', kind: 'block', at: at(3.4, -3.8), label: 'gateway 2', sub: 'Ben connected', icon: 'Server', tint: 'blue' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(6.8, -3.8), label: 'Ben' };
const msgDb: SceneNode = { id: 'msgDb', kind: 'db', at: at(-3.4, 3.8), label: 'message store' };
const presence: SceneNode = { id: 'presence', kind: 'cache', at: at(3.4, 3.8), label: 'presence', sub: 'TTL 60 s' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: at(0, 3.8), label: 'load balancer', sub: 'long-lived' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const realtimeDeliveryPart2: Lesson = {
  id: 'realtime-delivery-part-2',
  title: 'Real-time at scale (part 2)',
  tagline: 'A million open connections, many gateways, one backplane, and a client that keeps coming back.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'How many gateways a million sockets need, and what the load balancer must handle',
    'Why gateways stay thin, and the pub/sub backplane that links them',
    'Group fan-out and what to do when pub/sub drops a message',
    'Heartbeats, presence with a TTL, and keeping presence traffic small',
    'Sequence numbers, acks, reconnect storms, push notifications and connection auth',
  ],
  metrics: [
    { key: 'delay', label: 'Delivery delay', icon: 'Timer' },
    { key: 'conns', label: 'Open connections', icon: 'Plug' },
    { key: 'gws', label: 'Gateways', icon: 'Server' },
    { key: 'traffic', label: 'Traffic', icon: 'Activity' },
  ],
  steps: [
    {
      title: 'Many sockets',
      tag: 'problem',
      heading: 'A million open connections do not fit on one server',
      eli5: 'One cook cannot hold a million phone lines. The shop opens many counters, and each customer stays on the line with the counter that picked up their first call.',
      body: [
        'An open connection costs memory for buffers and state, a file descriptor, and a little CPU for heartbeats. A tuned gateway holds **hundreds of thousands** of mostly idle connections.',
        'Plan for less, say **100,000** each. That means **10 gateways** for 1 million users, plus spare room.',
      ],
      keyIdea: 'Open connections cost memory and descriptors, so a million users need roughly ten gateways.',
      metrics: { delay: '~50 ms', conns: '100K per gateway', gws: '10 + spare', traffic: 'idle mostly' },
      scene: {
        nodes: [{ ...ana, badge: 'on gateway 1' }, { ...gw1, status: 'active', load: 55, chips: ['100K sockets'] }, { ...gw2, status: 'active', load: 55, chips: ['100K sockets'] }, { ...ben, badge: 'on gateway 2' }],
        links: [link('ana', 'gw1', { arrow: 'both' }), link('ben', 'gw2', { arrow: 'both' })],
        flows: [
          { path: ['ana', 'gw1'], tone: 'handshake', label: 'stays here', duration: 1.4 },
          { path: ['ben', 'gw2'], tone: 'handshake', label: 'stays here', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Capacity plan',
          icon: 'Table',
          rows: [
            { text: 'Users online', value: '1,000,000' },
            { text: 'Per gateway (planned)', value: '100,000', tone: 'good' },
            { text: 'Gateways', value: '10 + spare', tone: 'good' },
          ],
        },
        caption: 'Each user lives on one gateway',
      },
    },
    {
      title: 'Load balancer',
      tag: 'concept',
      heading: 'The load balancer must handle long-lived connections',
      eli5: 'The host at the door sends each caller to a counter once. After that, the caller stays with that counter, so the host must not hang up on quiet callers.',
      body: [
        'Use a layer 7 balancer that understands the upgrade, or layer 4 passthrough. Its **idle timeout** must be longer than your heartbeat interval, or it will cut quiet connections.',
        'Once a socket is on a gateway it stays there, so routing is **sticky** by nature.',
      ],
      keyIdea: 'The balancer picks a gateway once. After the upgrade the connection stays there.',
      metrics: { delay: '~50 ms', conns: '100K per gateway', gws: '10 + spare', traffic: 'idle mostly' },
      scene: {
        nodes: [ana, { ...lb, status: 'active' }, { ...gw1, status: 'active' }, { ...gw2, status: 'active' }],
        links: [link('ana', 'lb'), link('lb', 'gw1'), link('lb', 'gw2')],
        flows: [
          { path: ['ana', 'lb', 'gw1'], tone: 'handshake', label: 'upgrade', duration: 2 },
          { path: ['gw1', 'ana'], tone: 'handshake', label: '101', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Balancer settings',
          icon: 'Scale',
          rows: [
            { text: 'Mode', value: 'L7 with upgrade, or L4' },
            { text: 'Idle timeout', value: '> heartbeat', tone: 'warn' },
            { text: 'After upgrade', value: 'sticky', tone: 'good' },
          ],
        },
        caption: 'Choose once, stay put',
      },
    },
    {
      title: 'Thin gateways',
      tag: 'tradeoff',
      heading: 'Keep gateways thin and stateless in logic',
      eli5: 'The counters only hold the phone lines and pass notes. The kitchen behind them does the real work, so repainting the kitchen never hangs up a million calls.',
      body: [
        'A gateway holds sockets and passes messages along. Business logic lives in normal services behind it.',
        'A deploy of chat logic then does not drop a million connections. Only a gateway deploy does, and gateways change rarely.',
      ],
      keyIdea: 'Sockets are expensive to lose. Put logic in services so most deploys never touch them.',
      metrics: { delay: '~50 ms', conns: '100K per gateway', gws: '10 + spare', traffic: 'idle mostly' },
      scene: {
        nodes: [
          { ...ben, badge: 'stays connected' },
          { ...gw2, status: 'ok', chips: ['holds sockets only'] },
          { id: 'svc', kind: 'block', at: at(0, 3.8), label: 'chat service', sub: 'logic, deployed often', icon: 'Boxes', tint: 'violet', status: 'active' },
        ],
        links: [link('ben', 'gw2', { arrow: 'both' }), link('gw2', 'svc', { arrow: 'both' })],
        flows: [
          { path: ['ben', 'gw2', 'svc'], tone: 'request', label: 'message', duration: 2 },
          { path: ['svc', 'gw2', 'ben'], tone: 'response', label: 'result', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'What a deploy drops',
          icon: 'Table',
          rows: [
            { text: 'Chat service deploy', value: '0 sockets', tone: 'good' },
            { text: 'Gateway deploy', value: '100K sockets', tone: 'warn' },
          ],
        },
        caption: 'Hold sockets here, think there',
      },
    },
    {
      title: 'Different gateways',
      tag: 'case',
      heading: 'Case: Ana is on gateway 1, Ben is on gateway 2',
      eli5: 'Ana is on the line with one counter. Ben is on the line with another. The two counters cannot hear each other, so Ana\'s note has nowhere to go.',
      body: [
        'Ana\'s message reaches gateway 1. Ben\'s socket is on gateway 2. Gateway 1 has no way to write to it.',
        'With 10 gateways, the sender and receiver are on different machines **90%** of the time.',
      ],
      keyIdea: 'A gateway can only write to sockets it holds. Most messages need to cross to another gateway.',
      metrics: { delay: 'stuck', conns: '100K per gateway', gws: '10', traffic: '-' },
      metricTones: { delay: 'bad' },
      scene: {
        nodes: [ana, { ...gw1, status: 'active', chips: [{ text: 'to: ben', tone: 'warn' }] }, { ...gw2, status: 'hot' }, { ...ben, badge: 'no news' }],
        links: [link('ana', 'gw1'), link('gw1', 'gw2', { style: 'dashed', label: 'no direct path', labelTone: 'warn' }), link('gw2', 'ben')],
        flows: [
          { path: ['ana', 'gw1'], tone: 'request', label: 'to: ben', duration: 1.2 },
          { path: ['gw1', 'gw2'], tone: 'error', label: 'cannot reach', duration: 1.5, delay: 1.4 },
        ],
        panel: {
          title: 'Chance sender and receiver differ',
          icon: 'Scale',
          rows: [
            { text: '10 gateways', value: '90%', tone: 'bad' },
            { text: '1 gateway', value: '0%', tone: 'good' },
          ],
        },
        caption: 'The message is on the wrong machine',
      },
    },
    {
      title: 'Backplane',
      tag: 'concept',
      heading: 'The pub/sub backplane connects gateways',
      eli5: 'Ana tells her counter. That counter shouts the news into the back room, and the counter that has Ben on the line hears it and tells him.',
      body: [
        'Each gateway subscribes to a channel for every user it holds, for example `user:ben`. Gateway 1 publishes it to `user:ben`.',
        'The backplane delivers it to every subscriber, which is gateway 2, and gateway 2 writes it down Ben\'s socket. Gateways never talk to each other directly.',
        'The alternative is a routing table in a cache (`ben` maps to gateway 2) that the sender looks up. Per-user channels mean 100K subscriptions per gateway and a million overall, so shard them across Redis nodes.',
      ],
      keyIdea: 'Gateways publish to and subscribe from a shared backplane instead of calling each other.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: '1 publish per message' },
      metricTones: { delay: 'good' },
      scene: {
        nodes: [ana, gw1, { ...bus, status: 'active', chips: ['user:ben', 'sharded channels'] }, { ...gw2, status: 'active', badge: 'subscribed' }, { ...ben, status: 'ok', badge: '"on my way"' }],
        links: [link('ana', 'gw1'), link('gw1', 'bus'), link('bus', 'gw2'), link('gw2', 'ben')],
        flows: [
          { path: ['ana', 'gw1'], tone: 'request', label: 'to: ben', duration: 1 },
          { path: ['gw1', 'bus'], tone: 'event', label: 'PUBLISH user:ben', duration: 1, delay: 1.1 },
          { path: ['bus', 'gw2'], tone: 'event', duration: 1, delay: 2.2 },
          { path: ['gw2', 'ben'], tone: 'event', label: 'frame', duration: 1, delay: 3.3 },
        ],
        caption: 'Publish once, deliver from the right gateway',
      },
    },
    {
      title: 'Group fan-out',
      tag: 'concept',
      heading: 'A group of 200 costs one publish',
      eli5: 'A class of 200 kids is spread over a few counters. The cook shouts once into the back room, and each counter with a kid in the class reads the note out loud once.',
      body: [
        'A gateway subscribes to `group:7` when its first member of that group connects, and unsubscribes when the last one leaves. For a group chat of 200 people the gateway publishes once to the group channel. Every gateway with a member gets **one copy** and writes it to its local sockets.',
        'So fan-out cost follows the number of gateways, at most 10 here, not the 200 members.',
      ],
      keyIdea: 'Publish once to a group channel. Copies are per gateway, then each gateway fans out locally.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: '<= 10 copies, not 200' },
      metricTones: { traffic: 'good' },
      scene: {
        nodes: [
          { ...gw1, status: 'active', chips: ['publish group:7'] },
          { ...bus, status: 'active', chips: ['group:7'] },
          { ...gw2, status: 'ok', chips: ['62 members'] },
          { id: 'gw3', kind: 'block', at: at(0, 3.8), label: 'gateway 3', sub: 'Ben connected', icon: 'Server', tint: 'blue', status: 'ok', chips: ['41 members'] },
        ],
        links: [link('gw1', 'bus'), link('bus', 'gw2'), link('bus', 'gw3')],
        flows: [
          { path: ['gw1', 'bus'], tone: 'event', label: 'PUBLISH', duration: 1.2 },
          { path: ['bus', 'gw2'], tone: 'event', label: '1 copy', duration: 1.2, delay: 1.4 },
          { path: ['bus', 'gw3'], tone: 'event', label: '1 copy', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Cost of one group message',
          icon: 'Table',
          rows: [
            { text: 'Members', value: '200' },
            { text: 'Publishes', value: '1', tone: 'good' },
            { text: 'Copies over the backplane', value: '<= 10', tone: 'good' },
          ],
        },
        caption: 'One shout, one copy per gateway',
      },
    },
    {
      title: 'Lossy backplane',
      tag: 'tradeoff',
      heading: 'Pub/sub can drop a message, if clients notice the gap',
      eli5: 'If a counter is out of the room when the shout happens, it misses it. That is okay because the order book still has the note, and the counter reads it later.',
      body: [
        'Redis pub/sub is fast but drops messages for a subscriber that is down. Kafka keeps them.',
        'That is fine only if something triggers the catch-up. The client sees a sequence gap (it gets 815 after 813) and asks for a resync from the store. A periodic sync and a sync on app wake are the safety net for a lost last message.',
        'Keep the **message store** as the source of truth. Save first, publish second, and a missed publish becomes a catch-up read.',
      ],
      keyIdea: 'Treat the backplane as a fast path. Gap detection plus a periodic sync turn a drop into a catch-up from the store.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: '1 publish per message' },
      scene: {
        nodes: [{ ...gw1, status: 'active' }, { ...bus, status: 'active', chips: ['fire and forget'] }, { ...gw2, status: 'down', badge: 'restarting' }, { ...msgDb, status: 'ok', chips: ['seq 813 saved'] }, { ...ben, status: 'active', badge: 'got 813, then 815', chips: [{ text: 'gap: resync', tone: 'good' }] }],
        links: [link('gw1', 'bus'), link('bus', 'gw2', { style: 'dashed', label: 'subscriber down', labelTone: 'warn' }), link('gw1', 'msgDb'), link('ben', 'msgDb', { label: 'resync', style: 'dashed' })],
        flows: [
          { path: ['gw1', 'msgDb'], tone: 'data', label: '1: save', duration: 1.2 },
          { path: ['gw1', 'bus'], tone: 'event', label: '2: publish', duration: 1.2, delay: 1.4 },
          { path: ['bus', 'gw2'], tone: 'error', label: 'dropped', duration: 1.2, delay: 2.8 },
          { path: ['ben', 'msgDb'], tone: 'request', label: 'gap seen: seq > 813', duration: 1.4, delay: 4.2 },
        ],
        panel: {
          title: 'Redis pub/sub vs Kafka',
          icon: 'Table',
          rows: [
            { text: 'Redis pub/sub', value: 'drops if down', tone: 'warn' },
            { text: 'Kafka', value: 'keeps messages', tone: 'good' },
            { text: 'Source of truth', value: 'message store', tone: 'good' },
            { text: 'Trigger', value: 'seq gap, timer, app wake', tone: 'good' },
          ],
        },
        caption: 'Save first, then publish',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Heartbeats keep a quiet connection alive',
      eli5: 'Ben says "still here" into the phone every half minute. That stops the phone company from hanging up on a silent line, and tells the counter Ben has not vanished.',
      body: [
        'Routers, NATs and load balancers close connections that stay silent too long. A small **ping** every 30 seconds keeps the path open.',
        'It also detects dead peers. A phone that lost signal in a lift can look connected for minutes, until a ping goes unanswered.',
      ],
      keyIdea: 'A small periodic ping keeps idle connections open and exposes dead ones.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: '33K pings/s' },
      scene: {
        nodes: [{ ...ben, status: 'active', badge: 'ping every 30 s' }, { ...gw2, status: 'active', chips: ['timeout if no pong'] }, { ...lb, status: 'dim' }],
        links: [link('ben', 'lb', { label: 'idle timer resets', labelTone: 'good' }), link('lb', 'gw2')],
        flows: [
          { path: ['ben', 'lb', 'gw2'], tone: 'handshake', label: 'ping', duration: 2 },
          { path: ['gw2', 'lb', 'ben'], tone: 'handshake', label: 'pong', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Why 30 seconds',
          icon: 'Clock',
          rows: [
            { text: 'Heartbeat', value: 'every 30 s', tone: 'good' },
            { text: 'Balancer idle timeout', value: '> 30 s', tone: 'warn' },
            { text: '1M users', value: '33K pings/s' },
          ],
        },
        caption: 'Small pings, big payoff',
      },
    },
    {
      title: 'Presence',
      tag: 'concept',
      heading: 'Presence: a heartbeat with an expiry',
      eli5: 'Each customer says "still here" every half minute and the board marks them present. If they go quiet for a minute, the board marks them away.',
      body: [
        'The green dot next to a name is **presence**. The gateway writes `presence:ben` into a cache with a **60-second TTL** on every heartbeat.',
        'If heartbeats stop, the key expires and Ben shows as away. A clean disconnect deletes the key at once.',
      ],
      keyIdea: 'Presence is a key that expires. Silence for longer than the TTL means away.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: '33K heartbeats/s' },
      scene: {
        nodes: [{ ...ben, status: 'active', badge: 'heartbeat 30 s' }, { ...gw2, status: 'active' }, { ...presence, status: 'ok', badge: 'ben: online' }],
        links: [link('ben', 'gw2', { arrow: 'both' }), link('gw2', 'presence')],
        flows: [
          { path: ['ben', 'gw2'], tone: 'handshake', label: 'ping', duration: 1.2 },
          { path: ['gw2', 'presence'], tone: 'data', label: 'SET presence:ben EX 60', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Key lifetime',
          icon: 'Timer',
          rows: [
            { text: 'Heartbeat', value: 'resets TTL to 60 s', tone: 'good' },
            { text: 'No heartbeat for 60 s', value: 'key gone, away', tone: 'warn' },
            { text: 'Clean disconnect', value: 'key deleted', tone: 'muted' },
          ],
        },
        caption: 'A key that expires when heartbeats stop',
      },
    },
    {
      title: 'Presence traffic',
      tag: 'tradeoff',
      heading: 'Do not broadcast every presence change',
      eli5: 'The board does not shout every time someone steps out for a second. Only friends who are looking at that table get told, and everyone else checks the board when they look.',
      body: [
        'Ben has 500 contacts. Pushing each of his flickers to all of them multiplies traffic.',
        'The gateway decides who gets a push: it publishes `presence:ben` on the backplane only for people with his chat open, and the gateway holding each of them writes it to their socket. A cache never pushes. Other screens fetch it when they need it.',
      ],
      keyIdea: 'Push presence to the few who are looking and let everyone else pull it on demand.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: '3 pushes, not 500' },
      metricTones: { traffic: 'good' },
      scene: {
        nodes: [{ ...gw2, status: 'active', chips: ['sets presence:ben', 'decides who gets a push'] }, { ...bus, at: at(0, 3.8), status: 'active', chips: ['presence:ben'] }, { ...gw1, at: at(-3.4, 3.8), status: 'ok', chips: ['holds Ana'] }, { ...ana, at: at(-6.8, 3.8), badge: 'chat with Ben open', status: 'ok' }, { ...ben, status: 'active' }],
        links: [link('ben', 'gw2'), link('gw2', 'bus', { label: 'viewers only' }), link('bus', 'gw1'), link('gw1', 'ana')],
        flows: [
          { path: ['ben', 'gw2'], tone: 'handshake', label: 'back online', duration: 1.2 },
          { path: ['gw2', 'bus'], tone: 'event', label: 'PUBLISH presence:ben', duration: 1.4, delay: 1.4 },
          { path: ['bus', 'gw1'], tone: 'event', duration: 1.2, delay: 2.9 },
          { path: ['gw1', 'ana'], tone: 'event', label: 'online', duration: 1.2, delay: 4.2 },
        ],
        panel: {
          title: 'Ben comes online',
          icon: 'Users',
          rows: [
            { text: 'Contacts', value: '500' },
            { text: 'Have his chat open', value: '3', tone: 'good' },
            { text: 'Pushes sent', value: '3', tone: 'good' },
          ],
          footer: { text: 'The other 497 fetch when they look', tone: 'muted' },
        },
        caption: 'Push to viewers, pull for the rest',
      },
      quiz: {
        question: 'Ben goes offline by walking into a tunnel, with no clean disconnect. How does his presence dot change?',
        options: [
          'It stays green until he reopens the app',
          'The key expires after the TTL because heartbeats stopped',
          'The load balancer deletes the key',
          'Ana\'s phone polls him and notices',
        ],
        answer: 1,
        explain: 'No heartbeat means nobody refreshes presence:ben, so the cache drops it when the 60 second TTL runs out. A closed socket is not needed to detect it.',
      },
    },
    {
      title: 'Drops',
      tag: 'tradeoff',
      heading: 'Connections drop. Messages must not.',
      eli5: 'If the line cuts out, Ben calls back and says "the last thing I heard was order 812". The counter reads him everything after 812 from the order book.',
      body: [
        'Mobile connections drop all the time: tunnels, Wi-Fi switching to cellular, apps put to sleep. Anything pushed while Ben was away is gone from the socket.',
        'Give every message a per-conversation **sequence number** and save it before pushing. The client keeps a cursor per conversation, a `since` map like `{ana-ben: 812, team: 40}`. On reconnect it sends the map, and the gateway reads everything newer from the store for each conversation.',
      ],
      keyIdea: 'The socket delivers fast, the store delivers for sure. Resume from the last sequence number.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: 'reconnect spike' },
      scene: {
        nodes: [{ ...ben, status: 'active', badge: 'back online' }, { ...gw2, status: 'active', badge: 'since: {ana-ben: 812}' }, { ...msgDb, at: at(3.4, 3.8), status: 'active', badge: 'seq 813, 814' }],
        links: [link('ben', 'gw2'), link('gw2', 'msgDb', { arrow: 'both' })],
        flows: [
          { path: ['ben', 'gw2'], tone: 'handshake', label: 'reconnect, last=812', duration: 1.1 },
          { path: ['gw2', 'msgDb'], tone: 'request', label: 'seq > 812', duration: 1.2, delay: 1.2 },
          { path: ['msgDb', 'gw2'], tone: 'response', duration: 1.2, delay: 2.5 },
          { path: ['gw2', 'ben'], tone: 'event', label: '813, 814', count: 2, duration: 1, delay: 3.8 },
        ],
        caption: 'Missed messages come from the store',
      },
    },
    {
      title: 'Acks and dupes',
      tag: 'concept',
      heading: 'Acks and duplicates: at least once is the practical goal',
      eli5: 'Ben says "got it" after each note. If the cook does not hear it, he sends the note again, so Ben may hear it twice and just ignores the repeat.',
      body: [
        'The client acknowledges each sequence number. If an ack is lost, the server resends, so a message can arrive **twice**. That is called at-least-once delivery.',
        'A duplicate must still be acked, or the server never hears back and resends forever. The client drops any sequence number it has already shown. Order is kept per conversation by the sequence number, not by arrival time.',
      ],
      keyIdea: 'Resend until acknowledged, and let the client drop repeats by sequence number.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: 'acks + resends' },
      scene: {
        nodes: [{ ...gw2, status: 'active' }, { ...ben, status: 'active', chips: ['seen: 813', { text: 'dupe 813 dropped', tone: 'good' }] }, { ...msgDb, at: at(3.4, 3.8), chips: ['seq 813'] }],
        links: [link('gw2', 'ben', { arrow: 'both' }), link('gw2', 'msgDb')],
        flows: [
          { path: ['gw2', 'ben'], tone: 'event', label: 'seq 813', duration: 1.2 },
          { path: ['ben', 'gw2'], tone: 'error', label: 'ack lost', duration: 1.2, delay: 1.4 },
          { path: ['gw2', 'ben'], tone: 'event', label: 'seq 813 again', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Client rule',
          icon: 'Code',
          code: 'send({ type: "ack", seq: msg.seq });  // always ack\nif (msg.seq <= lastSeen) return;       // then drop dupes\nshow(msg);\nlastSeen = msg.seq;',
        },
        caption: 'Resend is safe when repeats are ignored',
      },
    },
    {
      title: 'Reconnect storm',
      tag: 'tradeoff',
      heading: 'A gateway dies and 100,000 phones reconnect at once',
      eli5: 'If one counter closes, all its callers redial in the same second and jam the other lines. So everyone waits a random moment, a little longer each try.',
      body: [
        'Deploys and gateway crashes drop thousands of sockets at once, and they all reconnect together. The load balancer spreads them over the 9 surviving gateways, about 11K each. Clients must use **exponential backoff and jitter**.',
        'The herd also hits TLS and auth handshakes, the load balancer and the store (catch-up reads), not only the gateways.',
        'Gateways should also drain slowly during a deploy instead of closing everything in one go.',
      ],
      keyIdea: 'Random, growing delays stop a mass reconnect from becoming a second outage.',
      metrics: { delay: 'spiking', conns: '100K reconnecting', gws: '9 of 10', traffic: 'reconnect spike' },
      metricTones: { delay: 'bad', traffic: 'bad' },
      scene: {
        nodes: [{ ...gw1, status: 'down', badge: 'crashed' }, { ...gw2, status: 'hot', load: 80, chips: [{ text: '~11K reconnects each', tone: 'bad' }] }, { ...lb, status: 'active', chips: ['spreads over 9 gateways'] }, { ...ben, status: 'active', badge: 'try 1: wait 0 to 0.5 s' }, { ...ana, status: 'active', badge: 'try 2: wait 0 to 1 s' }],
        links: [link('ana', 'gw1', { style: 'dashed' }), link('ana', 'lb', { label: 'all at once', labelTone: 'warn' }), link('ben', 'lb'), link('lb', 'gw2')],
        flows: [
          { path: ['ana', 'lb', 'gw2'], tone: 'handshake', label: 'reconnect', count: 3, duration: 1.4 },
          { path: ['ben', 'lb', 'gw2'], tone: 'handshake', count: 3, duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Backoff with jitter',
          icon: 'Table',
          rows: [
            { text: 'Try 1', value: 'wait 0 to 0.5 s' },
            { text: 'Try 2', value: 'wait 0 to 1 s' },
            { text: 'Try 5', value: 'wait 0 to 8 s' },
            { text: 'Cap', value: '30 s', tone: 'muted' },
          ],
          footer: { text: 'Spread out, not in lockstep', tone: 'good' },
        },
        caption: 'Do not all come back at once',
      },
    },
    {
      title: 'Push notifications',
      tag: 'concept',
      heading: 'When the app is closed, no socket exists',
      eli5: 'If Ben has left the shop, the phone line is gone. The cook sends a note through the shop\'s own messenger to Ben\'s pocket, and Ben comes back when he reads it.',
      body: [
        'A closed or killed app holds no connection. For that case a native app uses the platform push service: **APNs** on iOS and **FCM** on Android.',
        'The server sends a small notification through it. Tapping it opens the app, which reconnects and syncs from its last sequence number.',
      ],
      keyIdea: 'Sockets cover the open app. Platform push covers the closed one, and sync closes the gap.',
      metrics: { delay: 'seconds', conns: '0 for Ben', gws: '10', traffic: '1 push per message' },
      scene: {
        nodes: [
          { ...gw2, status: 'active', chips: ['Ben has no socket'] },
          { id: 'push', kind: 'block', at: at(0, 3.8), label: 'APNs / FCM', sub: 'platform push', icon: 'Webhook', tint: 'amber', status: 'active' },
          { ...ben, status: 'dim', badge: 'app closed' },
        ],
        links: [link('gw2', 'push'), link('push', 'ben', { label: 'notification', style: 'dashed' })],
        flows: [
          { path: ['gw2', 'push'], tone: 'event', label: 'send push', duration: 1.4 },
          { path: ['push', 'ben'], tone: 'event', label: 'new message', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Which path',
          icon: 'Route',
          rows: [
            { text: 'App open', value: 'WebSocket', tone: 'good' },
            { text: 'App closed', value: 'APNs or FCM', tone: 'warn' },
            { text: 'After tap', value: 'reconnect, sync' },
          ],
        },
        caption: 'The socket is only for an open app',
      },
    },
    {
      title: 'Socket auth',
      tag: 'tradeoff',
      heading: 'Authenticate the connection, then limit it',
      eli5: 'Before Ben gets a phone line he shows his ticket at the door. The shop also limits how many notes each caller may send, so one caller cannot flood the line.',
      body: [
        'Browsers cannot set an `Authorization` header on a WebSocket. Send a cookie or a one-time ticket from a normal HTTPS call, never a long-lived token in the URL (logs keep URLs). Validate `Origin` too, or another site can hijack a cookie socket.',
        'The gateway (or an auth service) validates at the **upgrade**, not the load balancer. Check again on every reconnect.',
        'Cap the message size and the send rate per connection. One noisy client should not exhaust a gateway.',
      ],
      keyIdea: 'Authenticate at the upgrade, re-check on reconnect, and rate-limit each socket.',
      metrics: { delay: '~80 ms', conns: '100K per gateway', gws: '10', traffic: 'rate-limited' },
      metricTones: { traffic: 'good' },
      scene: {
        nodes: [{ ...ben, status: 'active', chips: ['token 5 min'] }, { ...lb, at: at(0, 3.8), status: 'dim' }, { ...gw2, status: 'ok', chips: ['checks ticket + Origin', 'max 10 msg/s'] }],
        links: [link('ben', 'lb', { label: 'Upgrade + ticket' }), link('lb', 'gw2', { label: 'forwards' })],
        flows: [
          { path: ['ben', 'lb'], tone: 'handshake', label: 'Upgrade + ticket', duration: 1.4 },
          { path: ['lb', 'gw2', 'ben'], tone: 'handshake', label: '101', duration: 2, delay: 1.6 },
        ],
        panel: {
          title: 'Per connection',
          icon: 'Shield',
          rows: [
            { text: 'Credential', value: 'cookie or one-time ticket, not in URL', tone: 'good' },
            { text: 'Identity and Origin', value: 'gateway checks at upgrade', tone: 'good' },
            { text: 'Reconnect', value: 'checked again', tone: 'good' },
            { text: 'Message size', value: 'capped', tone: 'good' },
            { text: 'Send rate', value: 'capped', tone: 'good' },
          ],
        },
        caption: 'Check once at the door, then watch the rate',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A fast path on top of a durable store',
      eli5: 'Many thin counters hold the phone lines, a back room passes notes between them, and the order book keeps every note. A lost line just means Ben calls back and catches up.',
      body: [
        'Open connections live on many thin gateways behind a load balancer. A **pub/sub backplane** routes each message to the gateway that holds the receiver. Heartbeats with a TTL give presence.',
        'Every message is saved with a sequence number first, so a reconnecting client resumes from the store. Push notifications reach closed apps.',
      ],
      keyIdea: 'Push is a fast path on top of a durable store. Pick the transport by direction and rate, then plan for drops.',
      metrics: { delay: '~80 ms', conns: '1M across 10 gateways', gws: '10', traffic: '1 publish per message' },
      metricTones: { delay: 'good', conns: 'good' },
      scene: {
        nodes: [ana, gw1, bus, gw2, { ...ben, status: 'ok' }],
        links: [link('ana', 'gw1'), link('gw1', 'bus'), link('bus', 'gw2'), link('gw2', 'ben')],
        flows: [
          { path: ['ana', 'gw1'], tone: 'request', duration: 1 },
          { path: ['gw1', 'bus', 'gw2', 'ben'], tone: 'event', duration: 2.4, delay: 1.1 },
        ],
        caption: 'Save, publish, deliver',
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
