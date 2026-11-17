import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const alice: SceneNode = { id: 'alice', kind: 'client', at: at(-5, -3.4), label: 'Alice', sub: 'laptop, fiber' };
const bob: SceneNode = { id: 'bob', kind: 'phone', at: at(-5, 3.4), label: 'Bob', sub: 'phone, LTE' };
const carol: SceneNode = { id: 'carol', kind: 'client', at: at(5, 3.4), label: 'Carol', sub: 'laptop, wifi' };
const sfu: SceneNode = { id: 'sfu', kind: 'block', at: at(0, 0), label: 'SFU', sub: 'forwards packets', icon: 'Share2', tint: 'violet' };
const sig: SceneNode = { id: 'sig', kind: 'block', at: at(0, -3.6), label: 'Signaling', sub: 'WebSocket', icon: 'Plug', tint: 'blue' };

export const designVideoConferencing: Lesson = {
  id: 'design-video-conferencing',
  title: 'Design Meet or Zoom',
  tagline: 'Live video for millions of people at once: why the server forwards packets, how clients get through NATs, and how quality adapts on bad wifi.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Requirements and the bandwidth math that rules out one big datacenter',
    'Mesh, MCU and SFU, and why the forwarder wins',
    'Simulcast, SVC and bandwidth estimation for mixed networks',
    'STUN, TURN and ICE for getting media through NATs',
    'Signaling, recording, live captions, dial-in and encryption',
    'What happens when an SFU dies mid-meeting',
  ],
  metrics: [
    { key: 'users', label: 'Participants', icon: 'Users' },
    { key: 'meets', label: 'Meetings', icon: 'Layers' },
    { key: 'lat', label: 'Mouth to ear', icon: 'Timer' },
    { key: 'egress', label: 'Egress', icon: 'Activity' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A call that feels like sitting in the same room',
      eli5: 'A big classroom where kids hold up drawings and talk at the same time. Everybody must see and hear everybody else right away, or the game falls apart.',
      body: [
        'Users join calls from 2 up to about **1000 people** with audio, video, screen share, chat and reactions. Clients are Chrome, mobile apps and even a phone line. Extras: cloud recording, live captions, background blur and noise suppression.',
        'The hard target is **under 200 ms** from one mouth to another ear. Past that, people talk over each other.',
      ],
      keyIdea: 'The defining constraint is real-time: media must move in well under 200 ms, for every viewer, all the time.',
      metrics: { users: '?', meets: '?', lat: '< 200 ms', egress: '?' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [alice, { ...sfu, label: 'Meeting', sub: 'up to 1000 people' }, bob],
        links: [link('alice', 'sfu'), link('sfu', 'bob')],
        flows: [
          { path: ['alice', 'sfu', 'bob'], tone: 'data', label: 'video + audio', duration: 1.8 },
          { path: ['bob', 'sfu', 'alice'], tone: 'data', label: 'video + audio', duration: 1.8, delay: 0.9 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Group size', value: '2 to ~1000' },
            { text: 'Media', value: 'audio, video, screen' },
            { text: 'Latency', value: '< 200 ms', tone: 'good' },
            { text: 'Extras', value: 'record, captions' },
            { text: 'Clients', value: 'web, mobile, phone line' },
          ],
          footer: { text: 'Conversation needs low delay', tone: 'muted' },
        },
        caption: 'Many people, live media, tight delay',
      },
    },
    {
      title: 'Scale math',
      tag: 'concept',
      heading: 'The numbers say: no single datacenter',
      eli5: 'Each kid draws one picture, but the **meeting server** must show it to every other kid. Nine friends means nine copies handed out for every picture, and that is a lot of walking.',
      body: [
        'Scale target: **10M concurrent participants**, **100K concurrent meetings**, about 10 people each. A 720p stream is about 1.5 Mbps and audio about 50 kbps each way.',
        'In a 10-person call each client uploads 1.5 Mbps and downloads 9 x 1.5 = **13.5 Mbps**. Fleet-wide that is **15 Tbps up** and about **135 Tbps down**, so the system needs hundreds of points of presence.',
      ],
      keyIdea: 'Upload is one stream but download is N-1 streams, so egress dominates and has to be spread across the world.',
      metrics: { users: '10M', meets: '100K', lat: '< 200 ms', egress: '~135 Tbps' },
      metricTones: { egress: 'warn' },
      scene: {
        nodes: [{ ...alice, chips: [{ text: 'up 1.5 Mbps', tone: 'good' }] }, { ...sfu, label: 'Server', sub: 'meeting server', status: 'active' }, { ...carol, chips: [{ text: 'down 13.5 Mbps', tone: 'warn' }] }],
        links: [link('alice', 'sfu', { label: '1 stream' }), link('sfu', 'carol', { label: '9 streams', labelTone: 'warn' })],
        flows: [
          { path: ['alice', 'sfu'], tone: 'data', label: '1.5 Mbps', duration: 1.4 },
          { path: ['sfu', 'carol'], tone: 'data', count: 3, label: '9 x 1.5 Mbps', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Capacity math',
          icon: 'Table',
          rows: [
            { text: '10M users x 1.5 Mbps', value: '15 Tbps up' },
            { text: 'Downstream, about 9x', value: '~135 Tbps', tone: 'warn' },
            { text: 'Per client, 10 people', value: '13.5 Mbps down' },
          ],
          footer: { text: 'Needs hundreds of PoPs worldwide', tone: 'warn' },
        },
        caption: 'One stream in, many streams out',
      },
    },
    {
      title: 'UDP not TCP',
      tag: 'concept',
      heading: 'Media rides on UDP, because late is worse than lost',
      eli5: 'If a kid drops a sentence of a story, you skip it and keep listening. You do not stop the whole class to wait for the missing sentence.',
      body: [
        'TCP resends lost packets and holds everything behind them. A frozen call that catches up 2 seconds later is useless. **UDP** just delivers what arrives, and the app hides small gaps with forward error correction or concealment.',
        'Media is sent as **SRTP** over UDP (see the networking basics lesson). The cost: some firewalls block UDP, so a TCP or TLS fallback must exist.',
      ],
      keyIdea: 'For live media, a late packet is as bad as a lost one, so UDP with loss concealment beats TCP.',
      metrics: { users: '10M', meets: '100K', lat: '< 200 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [alice, { id: 'net', kind: 'internet', at: at(0, 0), label: 'Internet', sub: '2% packet loss' }, bob],
        links: [link('alice', 'net', { label: 'UDP + SRTP' }), link('net', 'bob', { label: 'UDP + SRTP' })],
        flows: [
          { path: ['alice', 'net', 'bob'], tone: 'data', count: 3, label: 'media packets', duration: 2 },
          { path: ['net', 'bob'], tone: 'error', label: 'lost, skipped', duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'TCP versus UDP for media',
          icon: 'Scale',
          rows: [
            { text: 'TCP: resend lost data', value: 'stalls video', tone: 'bad' },
            { text: 'UDP: skip and conceal', value: 'keeps moving', tone: 'good' },
            { text: 'UDP downside', value: 'firewalls block', tone: 'warn' },
          ],
          footer: { text: 'TURN over TCP is the fallback', tone: 'muted' },
        },
        caption: 'Late is worse than lost',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'A small control API, and a separate channel for media',
      eli5: 'The front office tells you which room your class is in and who else is there. Once you walk in, the front office stays out of it. The drawings never go through the office.',
      body: [
        'A REST API manages meetings: create, look up, end. A **WebSocket signaling** channel handles join, leave, mute and chat, and carries the setup messages that let two sides agree on media settings.',
        'Signaling is tiny and reliable. Media is huge and lossy. Keep them on different paths and servers.',
      ],
      keyIdea: 'Signaling sets up the call and stays small. Media flows on a separate path.',
      metrics: { users: '10M', meets: '100K', lat: '< 200 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [alice, { ...sig, status: 'active' }, { id: 'api', kind: 'block', at: at(5, -3.6), size: 0.8, label: 'Meeting API', sub: 'REST', icon: 'Network', tint: 'green' }],
        links: [link('alice', 'sig', { label: 'WebSocket', arrow: 'both' }), link('alice', 'api', { label: 'HTTPS', route: 'straight' })],
        flows: [
          { path: ['alice', 'api'], tone: 'request', label: 'POST /meetings', duration: 1.4 },
          { path: ['alice', 'sig'], tone: 'handshake', label: 'join + offer', duration: 1.4, delay: 1.5 },
          { path: ['sig', 'alice'], tone: 'handshake', label: 'answer', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'Code',
          code: 'POST /meetings\nGET  /meetings/{id}\nPOST /meetings/{id}/end\n\nWS: join, leave, mute,\n    chat, offer, answer, ice',
          footer: { text: 'No media on these paths', tone: 'muted' },
        },
        caption: 'Control path, not media path',
      },
      code: {
        language: 'typescript',
        title: 'Signaling messages (sketch)',
        source: `type Signal =
  | { t: 'join';   room: string; token: string }
  | { t: 'offer';  sdp: string }       // what I can send and receive
  | { t: 'answer'; sdp: string }       // what the SFU agrees to
  | { t: 'ice';    candidate: string } // a network path to try
  | { t: 'mute';   track: 'audio' | 'video'; on: boolean }
  | { t: 'chat';   text: string };

ws.send(JSON.stringify({ t: 'join', room: 'abc-defg-hij', token }));`,
        highlight: [3, 4, 5],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Durable records in SQL, live room state in memory',
      eli5: 'The school keeps a notebook of which classes ran and who came. Who is standing in the room this second is written on a whiteboard that gets wiped when class ends.',
      body: [
        '**Meetings**, participants and recordings are small durable rows in a relational store, at most 100K new meetings in flight. Who is in a room right now, and who is muted, is **ephemeral state** held in memory and rebuilt on reconnect.',
        'Media itself is never stored in the database. Recordings land in object storage with a row pointing at them.',
      ],
      keyIdea: 'Meeting records are small and durable. Live room state is hot and disposable. Keep them in different stores.',
      metrics: { users: '10M', meets: '100K', lat: '< 200 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [
          { id: 'api', kind: 'block', at: at(-4, -3), size: 0.8, label: 'Meeting API', icon: 'Network', tint: 'green' },
          { id: 'db', kind: 'db', at: at(0, 0.4), label: 'SQL', sub: 'meetings, participants' },
          { id: 'cache', kind: 'cache', at: at(4, -3), label: 'Redis', sub: 'live room state' },
        ],
        links: [link('api', 'db'), link('api', 'cache')],
        flows: [
          { path: ['api', 'db'], tone: 'data', label: 'insert meeting', duration: 1.4 },
          { path: ['api', 'cache'], tone: 'data', label: 'room members', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Tables',
          icon: 'Table',
          code: 'meetings(id, host_id, start_at,\n  settings, recording_on)\nparticipants(meeting_id, user_id,\n  joined_at, left_at, role)\nrecordings(meeting_id, uri,\n  bytes, status)',
          footer: { text: 'Live state is not in SQL', tone: 'muted' },
        },
        caption: 'Durable rows versus live state',
      },
      code: {
        language: 'sql',
        title: 'Core schema',
        source: `CREATE TABLE meetings (
  id            TEXT PRIMARY KEY,   -- abc-defg-hij
  host_id       BIGINT NOT NULL,
  start_at      TIMESTAMPTZ,
  recording_on  BOOLEAN DEFAULT false
);
CREATE TABLE participants (
  meeting_id TEXT REFERENCES meetings(id),
  user_id    BIGINT,
  joined_at  TIMESTAMPTZ,
  left_at    TIMESTAMPTZ,
  PRIMARY KEY (meeting_id, user_id, joined_at)
);`,
        highlight: [1, 7, 12],
      },
    },
    {
      title: 'Mesh',
      tag: 'case',
      heading: 'Simple design: every client sends to every other client',
      eli5: 'Four kids each walk around the room showing their drawing to every other kid one by one. With four kids it works. With forty, nobody ever finishes a lap.',
      body: [
        'In a **mesh** (peer to peer) call, each client uploads its video once per peer. With N people that is N-1 uploads and N-1 downloads per client, and N x (N-1) streams in total.',
        'At 4 people each client uploads 3 x 1.5 = **4.5 Mbps**. A phone on weak LTE struggles with that. Mesh costs the server nothing, so it only suits 1-on-1 and up to about 4 people.',
      ],
      keyIdea: 'Mesh scales as N squared on the clients. It is free for the server and unusable for groups.',
      metrics: { users: '4', meets: '1', lat: '~80 ms', egress: '4.5 Mbps up each' },
      metricTones: { egress: 'bad' },
      scene: {
        nodes: [
          { ...alice, at: at(-4, 0), status: 'hot', badge: 'uploads 3 streams' },
          { ...bob, at: at(0, -3.4) },
          { ...carol, at: at(0, 3.4) },
          { id: 'dave', kind: 'phone', at: at(4, 0), label: 'Dave', sub: 'phone' },
        ],
        links: [
          link('alice', 'bob', { route: 'straight', arrow: 'both' }),
          link('alice', 'carol', { route: 'straight', arrow: 'both' }),
          link('alice', 'dave', { route: 'straight', arrow: 'both' }),
          link('bob', 'dave', { route: 'straight', arrow: 'both' }),
          link('carol', 'dave', { route: 'straight', arrow: 'both' }),
          link('bob', 'carol', { route: 'straight', arrow: 'both' }),
        ],
        flows: [
          { path: ['alice', 'bob'], tone: 'data', duration: 1.4 },
          { path: ['alice', 'carol'], tone: 'data', duration: 1.4, delay: 0.2 },
          { path: ['alice', 'dave'], tone: 'data', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Streams in a mesh',
          icon: 'Table',
          rows: [
            { text: '2 people', value: '2 streams' },
            { text: '4 people', value: '12 streams', tone: 'warn' },
            { text: '10 people', value: '90 streams', tone: 'bad' },
          ],
          footer: { text: 'N x (N-1), all on client uplinks', tone: 'bad' },
        },
        caption: 'Fine for four, hopeless for forty',
      },
    },
    {
      title: 'MCU',
      tag: 'tradeoff',
      heading: 'MCU: the server mixes everyone into one picture',
      eli5: 'A teacher collects all the drawings, tapes them into one big poster, and hands every kid a copy. Kids only look at one thing, but the teacher is exhausted.',
      body: [
        'An **MCU** decodes every incoming stream, composes one tiled video, re-encodes it and sends it back. Each client downloads just one stream, so clients are cheap.',
        'The server pays for it. Transcoding 1080p costs roughly 2 vCPU-seconds per second of video, and an N-person meeting needs N transcodes. At 100K meetings that is far too expensive.',
      ],
      keyIdea: 'An MCU saves client bandwidth by spending enormous server CPU, which does not scale.',
      metrics: { users: '10M', meets: '100K', lat: '~250 ms', egress: 'low, CPU huge' },
      metricTones: { lat: 'warn' },
      scene: {
        nodes: [
          alice,
          bob,
          { id: 'mcu', kind: 'block', at: at(0, 0), label: 'MCU', sub: 'decode, mix, encode', icon: 'Cpu', tint: 'red', status: 'hot', load: 97 },
          carol,
        ],
        links: [link('alice', 'mcu'), link('bob', 'mcu'), link('mcu', 'carol')],
        flows: [
          { path: ['alice', 'mcu'], tone: 'data', label: 'N streams in', duration: 1.4 },
          { path: ['bob', 'mcu'], tone: 'data', duration: 1.4, delay: 0.2 },
          { path: ['mcu', 'carol'], tone: 'data', label: '1 mixed stream', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'MCU trade',
          icon: 'Scale',
          rows: [
            { text: 'Client download', value: '1 stream', tone: 'good' },
            { text: 'Server CPU', value: 'N transcodes', tone: 'bad' },
            { text: 'Added delay', value: 'decode + encode', tone: 'warn' },
          ],
          footer: { text: 'Too costly at 100K meetings', tone: 'bad' },
        },
        caption: 'Cheap clients, ruinous servers',
      },
    },
    {
      title: 'SFU',
      tag: 'concept',
      heading: 'SFU: receive each stream once, forward it as-is',
      eli5: 'The helper at the front of the room takes each kid\'s drawing and walks copies to the others without changing anything. No taping, no redrawing, just fast copying.',
      body: [
        'A **Selective Forwarding Unit** receives each sender\'s stream once and forwards the packets to the other participants. It never decodes the video, so CPU stays low and one commodity box handles thousands of streams.',
        'The trade: clients decode N-1 streams, which modern devices handle. This is the industry standard for Meet, Zoom, Teams and Discord.',
      ],
      keyIdea: 'An SFU is a packet router for media. It trades some client CPU for a 10x cheaper server.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: '~135 Tbps' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [alice, { ...bob, at: at(-5, 3.4) }, { ...sfu, status: 'active', load: 35 }, carol],
        links: [link('alice', 'sfu'), link('bob', 'sfu'), link('sfu', 'carol')],
        flows: [
          { path: ['alice', 'sfu', 'carol'], tone: 'data', label: 'Alice video', duration: 1.8 },
          { path: ['bob', 'sfu', 'carol'], tone: 'data', label: 'Bob video', duration: 1.8, delay: 0.6 },
        ],
        panel: {
          title: 'Three topologies',
          icon: 'Table',
          rows: [
            { text: 'Mesh', value: 'clients pay N squared', tone: 'bad' },
            { text: 'MCU', value: 'server CPU huge', tone: 'bad' },
            { text: 'SFU', value: 'forward only', tone: 'good' },
          ],
          footer: { text: 'SFU is the standard choice', tone: 'good' },
        },
        caption: 'Routing, not transcoding',
      },
    },
    {
      title: 'SFU capacity',
      tag: 'tradeoff',
      heading: 'One SFU box is limited by its network card',
      eli5: 'The helper can carry only so many copies per minute. Past that, the line at the door grows, no matter how fast the helper walks.',
      body: [
        'Forwarding is cheap, so the limit is egress bandwidth. A box that handles about **2000 outgoing streams** at 1.5 Mbps pushes 2000 x 1.5 = **3 Gbps**.',
        'At 10M users the fleet pushes 135 Tbps, so 135 Tbps / 3 Gbps = about **45,000 SFU boxes**, grouped into clusters inside each point of presence. A meeting lives on one box where possible, so its packets never cross the network twice.',
      ],
      keyIdea: 'Size the fleet by egress Gbps per box, not by CPU.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: '3 Gbps / box' },
      metricTones: { egress: 'warn' },
      scene: {
        nodes: [alice, { ...sfu, status: 'hot', load: 78, chips: [{ text: '2000 streams out', tone: 'warn' }] }, carol],
        links: [link('alice', 'sfu'), link('sfu', 'carol', { label: '3 Gbps', labelTone: 'warn' })],
        flows: [
          { path: ['alice', 'sfu'], tone: 'data', duration: 1.4 },
          { path: ['sfu', 'carol'], tone: 'data', count: 4, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Per-box budget',
          icon: 'Gauge',
          rows: [
            { text: 'Outgoing streams', value: '2000' },
            { text: 'Each stream', value: '1.5 Mbps' },
            { text: 'Egress per box', value: '3 Gbps', tone: 'warn' },
            { text: '135 Tbps / 3 Gbps', value: '~45,000 boxes', tone: 'warn' },
          ],
          footer: { text: 'Network card is the limit', tone: 'warn' },
        },
        caption: 'Size by bandwidth',
      },
      quiz: {
        question: 'Why is an SFU far cheaper to run than an MCU for the same meeting?',
        options: [
          'It forwards packets without decoding or re-encoding the video',
          'It uses TCP, so it needs fewer retries',
          'It stores the video on disk instead of memory',
          'It only works for meetings of two people',
        ],
        answer: 0,
        explain: 'Transcoding is the expensive part. The SFU only routes packets, so its cost is network egress rather than CPU. The price is that each client decodes N-1 streams.',
      },
    },
    {
      title: 'Simulcast',
      tag: 'concept',
      heading: 'Simulcast: send three sizes, let the server pick',
      eli5: 'Alice draws the same picture three times, small, medium and big. The helper hands the small one to the kid with a tiny desk and the big one to the kid with a huge desk.',
      body: [
        'A sender does not know what each viewer can handle. A phone on LTE wants about 180p. A desktop on fiber wants 720p or more. With **simulcast** the sender encodes the same video at three bitrates (say 180p, 360p, 720p) and uploads all three.',
        'The SFU picks a layer per receiver from its network conditions. Upload grows to roughly 2x one stream.',
      ],
      keyIdea: 'Simulcast lets one sender serve very different receivers, for about twice the upload.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: 'adapts per viewer' },
      scene: {
        nodes: [{ ...alice, chips: ['180p', '360p', '720p'] }, sfu, { ...bob, at: at(-3, 3.4), chips: [{ text: 'gets 180p', tone: 'warn' }] }, { ...carol, at: at(4, 3.4), chips: [{ text: 'gets 720p', tone: 'good' }] }],
        links: [link('alice', 'sfu', { label: '3 layers' }), link('sfu', 'bob', { label: 'LTE' }), link('sfu', 'carol', { label: 'fiber' })],
        flows: [
          { path: ['alice', 'sfu'], tone: 'data', count: 3, duration: 1.4 },
          { path: ['sfu', 'bob'], tone: 'data', label: '180p', duration: 1.4, delay: 1.5 },
          { path: ['sfu', 'carol'], tone: 'data', label: '720p', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Layers sent up',
          icon: 'Layers',
          rows: [
            { text: '180p', value: '~0.15 Mbps' },
            { text: '360p', value: '~0.5 Mbps' },
            { text: '720p', value: '1.5 Mbps' },
          ],
          footer: { text: 'Roughly 2x upload for one sender', tone: 'muted' },
        },
        caption: 'One sender, many viewers',
      },
    },
    {
      title: 'SVC',
      tag: 'tradeoff',
      heading: 'SVC: one stream with layers inside it',
      eli5: 'Instead of three separate drawings, Alice draws one picture in stacked sheets. The helper peels off the top sheets for kids with small desks.',
      body: [
        '**Scalable Video Coding** packs several quality layers into one bitstream (H.264/SVC, VP9, AV1). To downscale, the SFU simply drops the packets of the upper layers. Upload is more efficient than simulcast.',
        'The catch is encoder complexity and codec support. Simulcast is used by Zoom and Meet, Teams uses SVC, and Meet is moving toward it.',
      ],
      keyIdea: 'SVC saves upload bandwidth with a smarter encoder. Simulcast is simpler and more widely supported.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: 'adapts per viewer' },
      scene: {
        nodes: [{ ...alice, chips: ['one stream, 3 layers'] }, sfu, { ...bob, at: at(-3, 3.4), chips: [{ text: 'base layer', tone: 'warn' }] }],
        links: [link('alice', 'sfu', { label: '1 stream' }), link('sfu', 'bob', { label: 'drops top layers' })],
        flows: [
          { path: ['alice', 'sfu'], tone: 'data', duration: 1.4 },
          { path: ['sfu', 'bob'], tone: 'data', label: 'base layer only', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Simulcast versus SVC',
          icon: 'Table',
          rows: [
            { text: 'Upload', value: 'SVC lower', tone: 'good' },
            { text: 'Encoder work', value: 'SVC higher', tone: 'warn' },
            { text: 'Support', value: 'simulcast wider', tone: 'good' },
          ],
          footer: { text: 'Both end up as per-receiver layers', tone: 'muted' },
        },
        caption: 'Layers in one bitstream',
      },
    },
    {
      title: 'STUN',
      tag: 'concept',
      heading: 'Clients sit behind NATs and need to learn their public address',
      eli5: 'Every kid lives in an apartment with one street address for the whole building. A kid has to ask a friend outside, "what address do you see me at?" before anyone can write back.',
      body: [
        'Most clients are behind a **NAT** and only know a private address. A **STUN** server answers one question: "what public IP and port do you see me coming from?" That lets the client advertise a reachable address.',
        'It works for about **75%** of NAT types (full cone, restricted cone, port-restricted). It is a light request and almost free to run.',
      ],
      keyIdea: 'STUN tells a client its public address, which is enough for about three quarters of NATs.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [
          { ...alice, at: at(-5, -3.4), chips: ['10.0.0.7'] },
          { id: 'nat', kind: 'gateway', at: at(-1.6, -3.4), label: 'Home NAT', sub: 'router' },
          { id: 'stun', kind: 'block', at: at(2, -3.4), size: 0.8, label: 'STUN', sub: 'public IP echo', icon: 'Globe', tint: 'teal' },
          { ...sfu, at: at(3.5, 2.6), size: 0.8 },
        ],
        links: [link('alice', 'nat'), link('nat', 'stun'), link('nat', 'sfu')],
        flows: [
          { path: ['alice', 'nat', 'stun'], tone: 'request', label: 'what is my address?', duration: 1.8 },
          { path: ['stun', 'nat', 'alice'], tone: 'response', label: '203.0.113.9:5004', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'STUN exchange',
          icon: 'Code',
          code: 'client -> STUN: binding request\nSTUN -> client: you are\n  203.0.113.9:5004\n\nclient shares it via signaling',
          footer: { text: 'Works for ~75% of NATs', tone: 'good' },
        },
        caption: 'Ask outside, learn your address',
      },
    },
    {
      title: 'TURN and ICE',
      tag: 'tradeoff',
      heading: 'TURN relays media when a direct path is impossible',
      eli5: 'Some buildings have a strict door guard who turns away strangers. A friendly hall monitor then carries the drawings from outside to the kid inside. It works, but it is slow and takes a lot of effort.',
      body: [
        'About **25%** of users are behind symmetric NATs where a direct path fails. A **TURN** server relays their encrypted media, so it burns bandwidth on both sides. TURN boxes are the most expensive part of the fleet.',
        '**ICE** tries candidates in order: host address, then STUN-learned address, then TURN relay. The first one that works wins.',
      ],
      keyIdea: 'ICE prefers the cheap direct path and falls back to TURN, which always works and costs the most.',
      metrics: { users: '10M', meets: '100K', lat: '~140 ms', egress: '+25% relay' },
      metricTones: { egress: 'warn' },
      scene: {
        nodes: [{ ...alice, chips: [{ text: 'symmetric NAT', tone: 'warn' }] }, { id: 'turn', kind: 'block', at: at(0, 0), label: 'TURN', sub: 'relays media', icon: 'Repeat', tint: 'amber', load: 70 }, { ...sfu, at: at(5, -3.4), size: 0.8 }],
        links: [link('alice', 'turn', { label: 'direct failed', labelTone: 'warn' }), link('turn', 'sfu')],
        flows: [
          { path: ['alice', 'turn', 'sfu'], tone: 'data', label: 'relayed SRTP', duration: 2 },
        ],
        panel: {
          title: 'ICE candidate order',
          icon: 'List',
          rows: [
            { text: '1. Host address', value: 'same network', tone: 'good' },
            { text: '2. STUN address', value: '~75% of NATs', tone: 'good' },
            { text: '3. TURN relay', value: 'always works', tone: 'warn' },
          ],
          footer: { text: 'First candidate to connect wins', tone: 'muted' },
        },
        caption: 'Try cheap first, relay last',
      },
    },
    {
      title: 'Bandwidth',
      tag: 'concept',
      heading: 'Bandwidth estimation keeps quality up as networks change',
      eli5: 'The helper watches how fast each kid is catching papers. If a kid starts dropping them, the helper switches to the smaller drawing before the kid gets frustrated.',
      body: [
        'Networks change second by second. The SFU runs **Google Congestion Control** (or the newer **SCReAM**) per receiver: it watches how packet arrival times drift, estimates the downlink of that receiver and switches the simulcast layer it forwards (720p to 360p) when congestion rises.',
        'A separate estimate on the sender only limits which layers it uploads. Per-receiver switching is why a call stays usable on hotel wifi.',
      ],
      keyIdea: 'Bandwidth estimation steps quality down early so calls stay smooth instead of freezing.',
      metrics: { users: '10M', meets: '100K', lat: '~130 ms', egress: 'adapts live' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [alice, { ...sfu, chips: ['est. 0.6 Mbps'] }, { ...bob, at: at(-4.5, 3.6), badge: '720p to 360p', status: 'active' }],
        links: [link('alice', 'sfu'), link('sfu', 'bob', { label: 'hotel wifi', labelTone: 'warn' })],
        flows: [
          { path: ['sfu', 'bob'], tone: 'data', label: '720p', duration: 1.4 },
          { path: ['bob', 'sfu'], tone: 'event', label: 'jitter rising', duration: 1.4, delay: 1.5 },
          { path: ['sfu', 'bob'], tone: 'data', label: '360p', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Control loop',
          icon: 'Gauge',
          rows: [
            { text: 'Measure arrival jitter', value: 'every packet' },
            { text: 'Estimate bandwidth', value: '~0.6 Mbps', tone: 'warn' },
            { text: 'Pick simulcast layer', value: '360p', tone: 'good' },
          ],
          footer: { text: 'Downswitch before it freezes', tone: 'good' },
        },
        caption: 'Measure, estimate, adapt',
      },
      quiz: {
        question: 'What does the SFU do when a receiver\'s bandwidth estimate drops?',
        options: [
          'Re-encodes the video at a lower resolution',
          'Forwards a lower simulcast layer to that receiver',
          'Switches the whole meeting to TCP',
          'Asks the sender to stop sending video',
        ],
        answer: 1,
        explain: 'The sender already uploaded several layers. The SFU only changes which layer it forwards to that receiver, so there is no transcoding and other viewers are unaffected.',
      },
    },
    {
      title: 'Latency budget',
      tag: 'concept',
      heading: 'Where the 200 ms goes: jitter buffer and forward error correction',
      eli5: 'A drawing is made, carried, handed over and unrolled. Each stage takes a little time, and the kid waits a moment so the pictures arrive in the right order.',
      body: [
        'Mouth to ear adds up: capture and encode, network up, SFU, network down, **jitter buffer**, decode and render. A good call lands near **130 ms**. At 250 ms people start talking over each other.',
        'The jitter buffer holds packets for tens of ms so uneven arrivals play smoothly. **Forward error correction** sends extra repair packets so small losses are fixed without a resend.',
      ],
      keyIdea: 'Every stage spends part of the 200 ms. The jitter buffer trades a little delay for smooth playback.',
      metrics: { users: '10M', meets: '100K', lat: '~130 ms', egress: 'adapts live' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [{ ...alice, chips: ['capture + encode 25 ms'] }, { ...sfu, chips: ['forward 5 ms'] }, { ...bob, at: at(-4.5, 3.6), chips: ['jitter buffer 30 ms', 'decode + render 20 ms'] }],
        links: [link('alice', 'sfu', { label: 'network 25 ms' }), link('sfu', 'bob', { label: 'network 25 ms' })],
        flows: [{ path: ['alice', 'sfu', 'bob'], tone: 'data', label: 'one packet', duration: 2.4 }],
        panel: {
          title: 'Mouth to ear',
          icon: 'Clock',
          rows: [
            { text: 'Capture + encode', value: '25 ms' },
            { text: 'Network up + down', value: '50 ms' },
            { text: 'SFU forward', value: '5 ms' },
            { text: 'Jitter buffer', value: '30 ms' },
            { text: 'Decode + render', value: '20 ms' },
            { text: 'Total', value: '130 ms', tone: 'good' },
          ],
          footer: { text: '250 ms and people interrupt each other', tone: 'warn' },
        },
        caption: 'Add up every stage',
      },
    },
    {
      title: 'Global PoPs',
      tag: 'concept',
      heading: 'Put the SFU near people, and link the SFUs together',
      eli5: 'A school with branches in many towns. Kids go to the nearest branch, and the branches pass drawings to each other so friends in different towns can still play together.',
      body: [
        'Distance adds delay, so clients connect to the **nearest point of presence** (see the multi-region and CDN lessons). A meeting spread over two continents is **cascaded**: each side uses its local SFU and the SFUs forward to each other once.',
        'Placing a meeting needs service discovery. A room picks an SFU cluster at join time from health and load, and signaling tells clients where to send.',
      ],
      keyIdea: 'Connect each user to a nearby SFU and cascade SFUs for meetings that span regions.',
      metrics: { users: '10M', meets: '100K', lat: '~110 ms', egress: 'spread over PoPs' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [
          { ...alice, label: 'Alice', sub: 'Frankfurt', at: at(-5, -3.4) },
          { id: 'sfuEU', kind: 'block', at: at(-1.6, -3.4), size: 0.8, label: 'SFU EU', icon: 'Share2', tint: 'violet' },
          { id: 'sfuUS', kind: 'block', at: at(2.2, 1), size: 0.8, label: 'SFU US', icon: 'Share2', tint: 'violet' },
          { ...carol, label: 'Carol', sub: 'Dallas', at: at(5, 3.6) },
        ],
        links: [link('alice', 'sfuEU'), link('sfuEU', 'sfuUS', { label: 'one copy across', arrow: 'both' }), link('sfuUS', 'carol')],
        flows: [
          { path: ['alice', 'sfuEU', 'sfuUS', 'carol'], tone: 'data', label: 'media', duration: 2.4 },
          { path: ['carol', 'sfuUS', 'sfuEU', 'alice'], tone: 'data', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Placement',
          icon: 'Globe',
          rows: [
            { text: 'Join: pick PoP', value: 'nearest healthy' },
            { text: 'Cross-region', value: '1 stream per layer', tone: 'good' },
            { text: 'Discovery', value: 'load + health' },
          ],
          footer: { text: 'Local hop keeps delay low', tone: 'good' },
        },
        caption: 'Near the user, cascaded between regions',
      },
    },
    {
      title: 'Big meetings',
      tag: 'concept',
      heading: 'At 1000 people, nobody watches 999 videos',
      eli5: 'In a huge assembly you only look at whoever is talking and a few friends. The helper shows those kids and hands out only their drawings.',
      body: [
        'Forwarding every stream to every viewer would need 1000 x 999 streams. Instead the SFU forwards only the **active speakers** and a page of visible tiles, often 9 or 25, usually at lower layers. Audio is picked by loudness.',
        'Everyone else is a muted tile. A 1000-person call is mostly a webinar shape: a few senders, many receivers, split over several cascaded SFUs.',
      ],
      keyIdea: 'Large meetings forward only what each viewer can see: the speakers and one page of tiles.',
      metrics: { users: '10M', meets: '100K', lat: '~140 ms', egress: 'bounded per viewer' },
      scene: {
        nodes: [{ ...alice, chips: [{ text: 'speaking', tone: 'good' }] }, { ...sfu, chips: ['top 3 speakers', '9 visible tiles'] }, { ...bob, chips: ['sees 9 tiles'] }, { ...carol, chips: ['sees 9 tiles'] }],
        links: [link('alice', 'sfu'), link('sfu', 'bob'), link('sfu', 'carol')],
        flows: [
          { path: ['alice', 'sfu', 'bob'], tone: 'data', label: 'speaker', duration: 2 },
          { path: ['sfu', 'carol'], tone: 'data', label: 'speaker', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'Streams per viewer',
          icon: 'Users',
          rows: [
            { text: 'All-to-all, 1000 people', value: '999 streams', tone: 'bad' },
            { text: 'Last-N forwarding', value: '9 to 25 streams', tone: 'good' },
          ],
          footer: { text: 'Cost no longer grows with N', tone: 'good' },
        },
        caption: 'Forward what is on screen',
      },
    },
    {
      title: 'Screen share',
      tag: 'concept',
      heading: 'Screen share is one more video track',
      eli5: 'Showing your desk is just one more drawing, but a very detailed one that changes slowly. The helper copies it like any other drawing.',
      body: [
        '**Screen share** is an extra video track sent through the same SFU as the camera. Text must stay sharp, so it wants high resolution and a low frame rate (5 to 15 fps is fine).',
        'It is tuned differently from a camera: the encoder favors detail over smooth motion, and the SFU forwards it like any other layer.',
      ],
      keyIdea: 'Screen share reuses the media path with different tuning: sharp and slow instead of smooth.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [{ ...alice, chips: ['camera', { text: 'screen 1080p 5 fps', tone: 'good' }] }, sfu, carol],
        links: [link('alice', 'sfu', { label: 'media' }), link('sfu', 'carol')],
        flows: [
          { path: ['alice', 'sfu'], tone: 'data', label: 'screen track', duration: 1.6 },
          { path: ['sfu', 'carol'], tone: 'data', label: 'screen track', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Tuning per track',
          icon: 'Table',
          rows: [
            { text: 'Camera', value: '720p, 30 fps' },
            { text: 'Screen share', value: '1080p, 5 fps', tone: 'good' },
          ],
          footer: { text: 'Prefer sharp text over smooth motion', tone: 'muted' },
        },
        caption: 'Same pipes, different tuning',
      },
    },
    {
      title: 'Chat',
      tag: 'concept',
      heading: 'Chat and reactions ride signaling',
      eli5: 'Passing a written note is a different job from showing a drawing, so the note goes through the front office, which hands a copy to everyone.',
      body: [
        '**Chat** and **reactions** are tiny messages. They use the signaling WebSocket and fan out to everyone in the room, with no media path at all.',
        'A message is a few hundred bytes, so a signaling server can fan it out to a whole room without touching the SFU.',
      ],
      keyIdea: 'Chat and reactions are small control messages, so they reuse signaling and never touch media.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [alice, { ...sig, at: at(0, 0), status: 'active' }, bob, carol],
        links: [link('alice', 'sig', { label: 'chat', arrow: 'both' }), link('sig', 'bob'), link('sig', 'carol')],
        flows: [
          { path: ['alice', 'sig'], tone: 'event', label: 'chat: hi all', duration: 1.4 },
          { path: ['sig', 'bob'], tone: 'event', duration: 1.4, delay: 1.5 },
          { path: ['sig', 'carol'], tone: 'event', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Signaling fan-out',
          icon: 'Network',
          rows: [
            { text: 'Chat, reactions', value: 'signaling only' },
            { text: 'Message size', value: 'a few hundred bytes' },
            { text: 'Media path', value: 'not used', tone: 'good' },
          ],
          footer: { text: 'One in, many out', tone: 'muted' },
        },
        caption: 'Notes go through the office',
      },
    },
    {
      title: 'Phone dial-in',
      tag: 'concept',
      heading: 'A gateway lets a plain phone call join the room',
      eli5: 'A kid without a drawing set can still call in by phone. A translator at the door turns phone talk into class talk and back.',
      body: [
        'Dial-in users arrive over the phone network (PSTN) using **SIP**. A **PSTN gateway** converts SIP and phone audio into SRTP and joins the SFU like any other participant, audio only.',
        'Gateways live at PoPs near phone carriers, so the audio hop stays short. They are a separate fleet because the protocol and codecs differ.',
      ],
      keyIdea: 'A gateway turns a phone call into a normal participant, so the SFU never needs to know about SIP.',
      metrics: { users: '10M', meets: '100K', lat: '~150 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [{ id: 'dial', kind: 'user', at: at(-5, 2.8), label: 'Carol', sub: 'dial-in phone' }, { id: 'pstn', kind: 'block', at: at(-1, 2.8), size: 0.8, label: 'PSTN gateway', sub: 'SIP to SRTP', icon: 'ArrowLeftRight', tint: 'amber' }, { ...sfu, at: at(2.5, 0.4) }, { ...alice, at: at(6, -3.4) }],
        links: [link('dial', 'pstn', { label: 'SIP' }), link('pstn', 'sfu', { label: 'SRTP' }), link('alice', 'sfu')],
        flows: [
          { path: ['dial', 'pstn', 'sfu', 'alice'], tone: 'data', label: 'audio', duration: 2.2 },
          { path: ['alice', 'sfu', 'pstn', 'dial'], tone: 'data', duration: 2.2, delay: 1.2 },
        ],
        panel: {
          title: 'Gateway job',
          icon: 'Network',
          rows: [
            { text: 'In from phone', value: 'SIP + audio' },
            { text: 'Out to SFU', value: 'SRTP, Opus' },
            { text: 'Video', value: 'none', tone: 'muted' },
          ],
          footer: { text: 'Audio only participant', tone: 'muted' },
        },
        caption: 'Translate at the edge',
      },
    },
    {
      title: 'Recording',
      tag: 'concept',
      heading: 'Recording forks a copy of the room to storage',
      eli5: 'A camera on the wall films the whole class. Later, someone watches the tape and cleans it up, while the class carries on playing.',
      body: [
        'The SFU forks the room\'s streams to a **recording mixer** that composes one video and encodes H.264. The result goes to object storage (see the object storage lesson) and a row in the recordings table points to it.',
        'Size: a 30 min meeting at about 1 GB/hour is **500 MB**. If 100K meetings are recorded per day (an assumption, since 100K was the concurrent count) that is **50 TB a day**, around 18 PB a year. Recording runs off the live path so it never delays the call.',
      ],
      keyIdea: 'Recording is an asynchronous fork. It costs storage and CPU but must never slow the live path.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: '+50 TB/day stored' },
      scene: {
        nodes: [{ ...sfu, at: at(-4, -2.4) }, { id: 'rec', kind: 'block', at: at(0, 1.2), size: 0.8, label: 'Recording mixer', sub: 'compose + H.264', icon: 'Layers', tint: 'red' }, { id: 'store', kind: 'storage', at: at(4, -2.4), label: 'Object storage', sub: '~500 MB / meeting' }],
        links: [link('sfu', 'rec', { label: 'fork', style: 'dashed' }), link('rec', 'store')],
        flows: [
          { path: ['sfu', 'rec'], tone: 'data', label: 'room streams', duration: 1.6 },
          { path: ['rec', 'store'], tone: 'data', label: 'mp4 chunks', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Storage math',
          icon: 'HardDrive',
          rows: [
            { text: '30 min x 1 GB/hour', value: '500 MB' },
            { text: '100K recorded/day (assumed)', value: '50 TB/day', tone: 'warn' },
            { text: 'Per year', value: '~18 PB', tone: 'warn' },
          ],
          footer: { text: 'Off the live path', tone: 'good' },
        },
        caption: 'Fork the room, store the file',
      },
      quiz: {
        question: 'Why is recording run as a separate fork instead of inside the SFU forwarding path?',
        options: [
          'Recorded files cannot be stored in object storage',
          'Mixing and encoding is heavy and must not add delay to live participants',
          'The SFU cannot read packets',
          'Recording needs a TURN relay',
        ],
        answer: 1,
        explain: 'Composing and encoding uses real CPU. Keeping it off the forwarding path means a slow or busy recorder never delays live audio and video.',
      },
    },
    {
      title: 'Live captions',
      tag: 'concept',
      heading: 'Captions: audio in, text out, inside 800 ms',
      eli5: 'A helper kid listens to the speaker, writes down the words and slips the note back to everyone. The note arrives a moment after the talking, which is good enough to read along.',
      body: [
        'Audio is Opus in 20 ms frames. **Voice activity detection** drops silence, a **streaming speech recognizer** transcribes about 300 to 500 ms chunks, then punctuation and **speaker labels** are added. Text returns to everyone over the signaling channel.',
        'Latency budget: 500 ms chunk + 200 ms recognition + 100 ms fan-out = **800 ms**.',
      ],
      keyIdea: 'Captions run as a side pipeline that taps audio and returns text over signaling, with a budget of under a second.',
      metrics: { users: '10M', meets: '100K', lat: '~120 ms', egress: '+ small text' },
      scene: {
        nodes: [{ ...sfu, at: at(-4, -2.4) }, { id: 'asr', kind: 'block', at: at(0, 1.2), size: 0.8, label: 'Speech to text', sub: 'streaming ASR', icon: 'FileText', tint: 'teal' }, { ...sig, at: at(4, -2.4) }, { ...carol, at: at(5.5, 3.4), chips: [{ text: 'captions on', tone: 'good' }] }],
        links: [link('sfu', 'asr', { label: 'audio' }), link('asr', 'sig', { label: 'text' }), link('sig', 'carol')],
        flows: [
          { path: ['sfu', 'asr'], tone: 'data', label: '20 ms Opus', duration: 1.4 },
          { path: ['asr', 'sig', 'carol'], tone: 'event', label: 'caption text', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'Latency budget',
          icon: 'Clock',
          rows: [
            { text: 'Audio chunk', value: '500 ms' },
            { text: 'Recognition', value: '200 ms' },
            { text: 'Fan-out', value: '100 ms' },
            { text: 'Total', value: '800 ms', tone: 'good' },
          ],
          footer: { text: 'Late, but readable', tone: 'muted' },
        },
        caption: 'A side pipeline for text',
      },
      code: {
        language: 'python',
        title: 'Caption worker loop (sketch)',
        source: `for frame in audio_stream(room_id):       # 20 ms Opus frames
    if not vad.is_speech(frame):
        continue                          # skip silence, save compute
    chunk.append(frame)
    if chunk.duration_ms >= 500:
        text = asr.transcribe(chunk)
        speaker = diarizer.label(chunk)
        signaling.publish(room_id, {"speaker": speaker, "text": text})
        chunk.clear()`,
        highlight: [2, 3, 5, 8],
      },
    },
    {
      title: 'Effects',
      tag: 'tradeoff',
      heading: 'Blur and noise suppression: client first, cloud for recordings',
      eli5: 'A kid can tidy their own desk before showing it, which costs the helper nothing. The helper only tidies tapes of the class afterward.',
      body: [
        'Real-time **background blur** and **noise suppression** usually run on the sender\'s device, before encoding. Doing them server-side would mean decoding every stream, which is what the SFU avoids.',
        'Recorded meetings can get the same cleanup in a post-processing step, where there is no deadline. The cost: low-end devices burn battery and CPU on effects.',
      ],
      keyIdea: 'Run live effects at the edge to keep the SFU a forwarder. Run heavy cleanup offline on recordings.',
      metrics: { users: '10M', meets: '100K', lat: '~125 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [{ ...alice, chips: [{ text: 'blur on', tone: 'good' }, { text: 'noise off', tone: 'good' }], badge: 'effects on device' }, { id: 'enc', kind: 'block', at: at(0, 0), size: 0.8, label: 'Encoder', sub: 'after effects', icon: 'Binary', tint: 'blue' }, { ...sfu, at: at(4.5, 2.8) }],
        links: [link('alice', 'enc'), link('enc', 'sfu')],
        flows: [{ path: ['alice', 'enc', 'sfu'], tone: 'data', label: 'clean frames', duration: 2 }],
        panel: {
          title: 'Where it runs',
          icon: 'Cpu',
          rows: [
            { text: 'Live blur, noise', value: 'client device', tone: 'good' },
            { text: 'Server-side live', value: 'needs decode, avoid', tone: 'bad' },
            { text: 'Recording cleanup', value: 'offline job' },
          ],
          footer: { text: 'SFU stays a pure forwarder', tone: 'good' },
        },
        caption: 'Process before the encoder',
      },
    },
    {
      title: 'Hop encryption',
      tag: 'concept',
      heading: 'DTLS-SRTP encrypts every hop, and the SFU can decrypt it',
      eli5: 'Drawings travel in a sealed envelope between each kid and the helper. The helper opens it to check the label, then seals a fresh one for the next kid.',
      body: [
        'Each client agrees keys with the SFU using **DTLS**, and media is protected with **SRTP** on that hop. No key service is involved: the keys come from the handshake between that client and the SFU.',
        'The SFU terminates SRTP, so it can decrypt payloads, read headers and pick layers. Recording, captions and dial-in rely on this. It is always on.',
      ],
      keyIdea: 'Hop encryption is always on. The SFU sits inside it, so it can read the media it forwards.',
      metrics: { users: '10M', meets: '100K', lat: '~125 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [alice, { ...sfu, at: at(0, 1), chips: ['decrypts each hop'] }, carol],
        links: [link('alice', 'sfu', { label: 'DTLS-SRTP' }), link('sfu', 'carol', { label: 'DTLS-SRTP' })],
        flows: [
          { path: ['alice', 'sfu'], tone: 'handshake', label: 'DTLS handshake', duration: 1.4 },
          { path: ['alice', 'sfu', 'carol'], tone: 'data', label: 'SRTP media', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'Hop encryption',
          icon: 'Shield',
          rows: [
            { text: 'Keys from', value: 'client to SFU handshake' },
            { text: 'Hop: server reads media', value: 'yes', tone: 'warn' },
            { text: 'Record, captions, dial-in', value: 'work', tone: 'good' },
          ],
          footer: { text: 'Default for every meeting', tone: 'muted' },
        },
        caption: 'Encrypted per hop',
      },
    },
    {
      title: 'E2EE',
      tag: 'tradeoff',
      heading: 'End-to-end encryption hides the media from the SFU',
      eli5: 'In a secret class the kids lock each drawing with their own key before it goes in the envelope. The helper can still carry it, but cannot peek inside.',
      body: [
        '**End-to-end encryption** adds a key held only by participants, handed out by a key service (see the encryption lesson). It usually works with **insertable streams**: the client encrypts frames before SRTP, so the SFU can still read headers and forward.',
        'The server is blind to content, which breaks server-side recording, captions and dial-in. It is an option, not the default.',
      ],
      keyIdea: 'E2EE is stronger but turns off every feature that needs to read the media.',
      metrics: { users: '10M', meets: '100K', lat: '~125 ms', egress: '~135 Tbps' },
      scene: {
        nodes: [alice, { ...sfu, at: at(0, 1), chips: ['reads headers only'] }, { id: 'kms', kind: 'vault', at: at(4, -4), label: 'Key service', sub: 'meeting keys' }, carol],
        links: [link('alice', 'sfu', { label: 'frames encrypted' }), link('sfu', 'carol', { label: 'frames encrypted' }), link('kms', 'alice', { style: 'dashed' }), link('kms', 'carol', { style: 'dashed' })],
        flows: [
          { path: ['kms', 'alice'], tone: 'handshake', label: 'key', duration: 1.4 },
          { path: ['kms', 'carol'], tone: 'handshake', duration: 1.4 },
          { path: ['alice', 'sfu', 'carol'], tone: 'data', label: 'E2EE media', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'Hop versus end-to-end',
          icon: 'Shield',
          rows: [
            { text: 'Hop (default)', value: 'server reads media', tone: 'warn' },
            { text: 'End-to-end', value: 'server blind', tone: 'good' },
            { text: 'E2EE breaks', value: 'record, captions, dial-in', tone: 'bad' },
          ],
          footer: { text: 'Pick per meeting', tone: 'muted' },
        },
        caption: 'Who holds the key',
      },
    },
    {
      title: 'SFU failure',
      tag: 'case',
      heading: 'An SFU dies mid-meeting and the call must recover in seconds',
      eli5: 'The helper faints in the middle of class. The front office quickly points everyone to a new helper, and the kids keep drawing. Nobody has to leave the room.',
      body: [
        'Clients notice the media stopped (no packets for about 2 seconds) and tell signaling. Signaling picks a healthy SFU, sends a new address, and clients run an **ICE restart** to reconnect. Room state is rebuilt from the signaling session and the room store.',
        'Expect a short freeze, not a dropped call. A load spike of many rooms rejoining is spread across the cluster and can use a retry with jitter (see the timeouts and retries lesson).',
      ],
      keyIdea: 'Media nodes are disposable. Signaling owns the session and re-homes a room to a new SFU.',
      metrics: { users: '10M', meets: '100K', lat: '~2 s freeze', egress: 'shifts to new SFU' },
      metricTones: { lat: 'warn' },
      scene: {
        nodes: [alice, { ...sfu, id: 'sfu1', status: 'down', label: 'SFU 1', sub: 'crashed', at: at(-1.5, 2.6) }, { ...sfu, id: 'sfu2', status: 'ok', label: 'SFU 2', sub: 'healthy', at: at(3.5, 2.2) }, sig],
        links: [link('alice', 'sfu1', { style: 'faint' }), link('alice', 'sig', { label: 'WebSocket' }), link('sig', 'sfu2'), link('alice', 'sfu2', { label: 'ICE restart' })],
        flows: [
          { path: ['alice', 'sig'], tone: 'error', label: 'no media 2 s', duration: 1.4 },
          { path: ['sig', 'alice'], tone: 'handshake', label: 'use SFU 2', duration: 1.4, delay: 1.5 },
          { path: ['alice', 'sfu2'], tone: 'data', label: 'media resumes', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Recovery steps',
          icon: 'Repeat',
          rows: [
            { text: 'Detect: no packets', value: '~2 s', tone: 'warn' },
            { text: 'Signaling picks SFU 2', value: '< 1 s' },
            { text: 'ICE restart, rejoin', value: '1 to 2 s' },
          ],
          footer: { text: 'Short freeze, no dropped call', tone: 'good' },
        },
        caption: 'Re-home the room, keep the call',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One idea: route media cheaply, close to people',
      eli5: 'A big classroom where a helper hands each kid the right-sized copy of every drawing, a front office points kids to the right room, and a hall monitor helps kids behind strict doors.',
      body: [
        'Control goes over signaling and REST. Media goes over UDP through **SFUs** near users, with **simulcast** layers chosen by bandwidth estimation. **STUN, TURN and ICE** get through NATs. Recording, captions and dial-in are side pipelines off the live path.',
        'Scale needs hundreds of PoPs for ~135 Tbps. A failed SFU is replaced by signaling in seconds.',
      ],
      keyIdea: 'The SFU forwards, simulcast adapts, ICE connects, and signaling keeps the session when media nodes fail.',
      metrics: { users: '10M', meets: '100K', lat: '< 200 ms', egress: '~135 Tbps' },
      metricTones: { lat: 'good', users: 'good', meets: 'good' },
      scene: {
        nodes: [alice, { ...sfu, status: 'ok', at: at(-0.5, 1.2) }, { ...sig, at: at(3.5, -3.6) }, { id: 'turn', kind: 'block', at: at(6.8, -3.4), size: 0.8, label: 'TURN', icon: 'Repeat', tint: 'amber' }, carol],
        links: [link('alice', 'sfu'), link('sfu', 'carol'), link('alice', 'sig', { route: 'straight' }), link('carol', 'turn', { style: 'dashed' })],
        flows: [
          { path: ['alice', 'sfu', 'carol'], tone: 'data', label: 'media', duration: 1.8 },
          { path: ['alice', 'sig'], tone: 'handshake', label: 'signaling', duration: 1.4, delay: 0.8 },
        ],
        panel: {
          title: 'The whole design',
          icon: 'List',
          rows: [
            { text: 'Signaling + REST', value: 'control path' },
            { text: 'UDP + SRTP via SFU', value: 'media path', tone: 'good' },
            { text: 'Simulcast + BWE', value: 'adapt quality' },
            { text: 'STUN, TURN, ICE', value: 'NAT traversal' },
            { text: 'Record, captions, PSTN', value: 'side pipelines' },
          ],
          footer: { text: 'Under 200 ms, worldwide', tone: 'good' },
        },
        caption: 'Forward, adapt, connect, recover',
      },
      quiz: {
        question: 'Which choice best explains why Meet and Zoom can serve large groups on a mix of phones and fast laptops?',
        options: [
          'An MCU mixes everything into a single stream for every viewer',
          'Every client sends video directly to every other client',
          'An SFU forwards simulcast layers, picking one per receiver from its bandwidth estimate',
          'Media is sent over TCP so nothing is lost',
        ],
        answer: 2,
        explain: 'The SFU avoids transcoding and clients avoid N squared uploads. Simulcast gives it layers to choose from, and bandwidth estimation tells it which one each receiver can handle.',
      },
    },
  ],
};
