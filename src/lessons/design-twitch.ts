import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const streamer: SceneNode = { id: 'streamer', kind: 'client', at: at(-6, 0), label: 'streamer', sub: 'OBS, 6 Mbps' };
const ingest: SceneNode = { id: 'ingest', kind: 'server', at: at(-3, 0), label: 'ingest edge', sub: 'RTMP / SRT' };
const origin: SceneNode = { id: 'origin', kind: 'server', at: at(0, 0), label: 'origin', sub: 'source stream' };
const trans: SceneNode = { id: 'trans', kind: 'worker', at: at(3, 0), label: 'transcoders', sub: '1080p to 160p' };
const pack: SceneNode = { id: 'pack', kind: 'worker', at: at(6, 0), label: 'packager', sub: 'HLS segments' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(2, 3.4), label: 'CDN edge', sub: 'cached segments' };
const viewer: SceneNode = { id: 'viewer', kind: 'client', at: at(5.5, 3.4), label: 'viewers', sub: '3 Mbps each' };
const chat: SceneNode = { id: 'chat', kind: 'service', at: at(-2, 3.4), label: 'chat service', sub: 'sharded by channel' };
const box: SceneNode = { id: 'box', kind: 'server', at: at(0, 0), label: 'one server', sub: 'ingest + serve' };

export const designTwitch: Lesson = {
  id: 'design-twitch',
  title: 'Design Twitch',
  tagline: 'Take one live 1080p stream from a bedroom to 6 million screens in a couple of seconds, with a chat room that never stops.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Requirements and scale: 3M viewers, 9 Tbps out, 100K msg/s of chat',
    'Ingest over RTMP or SRT, the transcoding ladder and HLS packaging',
    'Why the CDN carries the video, and how low-latency HLS cuts delay to about 2 s',
    'Chat fan-out per channel, viral streams, slow mode and sub-only mode',
    'Emotes, subs, raids and mod tools built on the same paths',
    'VODs, clips, hardware transcoders, and what happens when a piece fails',
  ],
  metrics: [
    { key: 'viewers', label: 'Viewers', icon: 'Users' },
    { key: 'egress', label: 'Egress', icon: 'Download' },
    { key: 'delay', label: 'Glass to glass', icon: 'Timer' },
    { key: 'chat', label: 'Chat', icon: 'Activity' },
  ],
  steps: [
    {
      title: 'One stream',
      tag: 'problem',
      heading: 'One streamer, one server, a few friends watching',
      eli5: 'A storyteller sits in a big park and tells a story. Friends crowd around and listen. Then a million kids show up, and the storyteller cannot talk to all of them.',
      body: [
        'A streamer broadcasts a game. Ten friends watch from one **server** that receives the video and hands it back out. This works fine.',
        'Now 6 million people click the same stream at once. One machine cannot receive, convert and send that much video, and the chat box would drown too.',
      ],
      keyIdea: 'Live video is one small input and a huge output. Almost every design choice protects the output side.',
      metrics: { viewers: '10', egress: '60 Mbps', delay: '1 s', chat: '2/s' },
      metricTones: { viewers: 'good' },
      scene: {
        nodes: [streamer, box, { ...viewer, at: at(6, 0), label: 'friends', sub: '10 viewers' }],
        links: [link('streamer', 'box', { label: '6 Mbps up' }), link('box', 'viewer', { label: '6 Mbps each' })],
        flows: [
          { path: ['streamer', 'box'], tone: 'data', label: 'video', duration: 1.4 },
          { path: ['box', 'viewer'], tone: 'response', label: 'video', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Day one',
          icon: 'Gauge',
          rows: [
            { text: 'Viewers', value: '10', tone: 'good' },
            { text: 'Server out', value: '60 Mbps', tone: 'good' },
            { text: 'Delay', value: 'about 1 s', tone: 'good' },
          ],
          footer: { text: 'Fine for a small stream', tone: 'good' },
        },
        caption: 'The prototype that gets everyone excited',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What the system must do',
      eli5: 'The storyteller wants kids to hear the story almost right away and shout back. Afterward the story is written down so kids who missed it can read it, and a few favorite moments get saved.',
      body: [
        'A creator streams live at 1080p60 to thousands of viewers. Delay stays under 3 seconds so chat feels live. Chat has emotes, subs and bits. When the stream ends, a **VOD** (recording) appears. Clips, raids and mod tools come too.',
        'Quality adapts per viewer: a phone on 4G and a desktop on fiber watch the same stream.',
      ],
      keyIdea: 'Two hard requirements fight each other: huge fan-out, and a delay short enough for chat to matter.',
      metrics: { viewers: 'goal 3M', egress: '-', delay: 'under 3 s', chat: '100K/s' },
      scene: {
        nodes: [
          { ...streamer, at: at(-7, 3.4), status: 'active' },
          { id: 'plat', kind: 'block', at: at(-3.5, 3.4), label: 'platform', sub: 'one channel', icon: 'Boxes', tint: 'violet' },
          { id: 'video', kind: 'block', at: at(0, 0), label: 'live video', sub: '1080p60', icon: 'Signal', tint: 'violet' },
          { id: 'chatb', kind: 'block', at: at(4, 3.4), label: 'live chat', sub: 'emotes, subs', icon: 'Activity', tint: 'green' },
          { id: 'vod', kind: 'block', at: at(8, 6.8), label: 'VOD + clips', sub: 'after the show', icon: 'FileText', tint: 'amber' },
        ],
        links: [link('streamer', 'plat'), link('plat', 'video'), link('plat', 'chatb'), link('plat', 'vod', { style: 'dashed' })],
        flows: [{ path: ['streamer', 'plat'], tone: 'data', duration: 1.2 }],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Stream quality', value: '1080p60' },
            { text: 'Delay to viewer', value: 'under 3 s', tone: 'warn' },
            { text: 'Chat', value: 'emotes, subs, bits' },
            { text: 'After the stream', value: 'VOD, clips' },
            { text: 'Creator tools', value: 'raids, mods' },
          ],
        },
        caption: 'Video, chat, and the recording',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'Napkin math: egress is the monster',
      eli5: 'Each kid in the park wants their own copy of the story spoken right now. A hundred thousand storytellers, three million listeners. All that talking out loud costs the most breath.',
      body: [
        '100K concurrent streamers upload 6 Mbps each: **600 Gbps** in. 3M viewers each pull 3 Mbps: **9 Tbps** out, fifteen times more. The biggest single stream hits 6M viewers.',
        'Chat: 6M viewers at about 1 message a minute is **100K msg/s**, spiking to 1M msg/s. See the napkin math lesson for the method.',
      ],
      keyIdea: 'Output dwarfs input by 15 to 1, so the design is about delivering bytes, not receiving them.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: 'under 3 s', chat: '100K/s' },
      metricTones: { egress: 'bad' },
      scene: {
        nodes: [
          { ...streamer, label: '100K streamers', sub: '6 Mbps each' },
          { id: 'sys', kind: 'block', at: at(0, 0), label: 'Twitch', sub: 'the system', icon: 'Boxes', tint: 'violet' },
          { ...viewer, at: at(6, 0), label: '3M viewers', sub: '3 Mbps each' },
        ],
        links: [link('streamer', 'sys', { label: '600 Gbps in' }), link('sys', 'viewer', { label: '9 Tbps out', labelTone: 'bad' })],
        flows: [
          { path: ['streamer', 'sys'], tone: 'data', duration: 1.6 },
          { path: ['sys', 'viewer'], tone: 'response', count: 4, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Napkin math',
          icon: 'Table',
          rows: [
            { text: '100K x 6 Mbps', value: '600 Gbps in' },
            { text: '3M x 3 Mbps', value: '9 Tbps out', tone: 'bad' },
            { text: 'Chat, 6M x 1/min', value: '100K msg/s' },
            { text: 'Chat spike', value: '1M msg/s', tone: 'warn' },
            { text: 'Biggest stream', value: '6M viewers' },
          ],
        },
        caption: 'Fifteen times more out than in',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'A small API and a small data model',
      eli5: 'The park has a sign-up sheet. A storyteller says "I am starting" and gets a ticket. Listeners ask the sheet which story is on, and where to stand to hear it.',
      body: [
        'The control plane is tiny. A streamer gets an **ingest URL and stream key**. Viewers ask for a playlist URL. Chat uses a WebSocket. The heavy video never goes through these calls.',
        'Metadata is small and relational: users, channels, streams, VODs, clips. Chat history is append-only, keyed by channel and time.',
      ],
      keyIdea: 'The API is thin. The scale lives in the media and chat paths, which are separate from it.',
      metrics: { viewers: '-', egress: '-', delay: '-', chat: '-' },
      scene: {
        nodes: [
          { ...streamer, status: 'active' },
          { id: 'api', kind: 'block', at: at(-2, 0), label: 'API', sub: 'control plane', icon: 'Network', tint: 'violet' },
          { id: 'meta', kind: 'db', at: at(2, 0), label: 'metadata DB', sub: 'users, streams' },
          { ...viewer, at: at(6, 0), label: 'viewer' },
        ],
        links: [link('streamer', 'api'), link('api', 'meta'), link('viewer', 'api', { style: 'dashed' })],
        flows: [
          { path: ['streamer', 'api', 'meta'], tone: 'request', label: 'POST /streams', duration: 1.8 },
          { path: ['viewer', 'api'], tone: 'request', label: 'GET playlist', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'Control plane',
          icon: 'Braces',
          code: 'POST /streams        -> {ingest_url, key}\nGET  /channels/:id   -> {live, playlist}\nWS   /chat/:channel  -> messages\nGET  /vods/:id       -> playlist\nPOST /clips          -> {clip_id}',
        },
        caption: 'Control calls are tiny',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple design: one pipe from streamer to viewer',
      eli5: 'The storyteller talks to a helper, and the helper repeats it to every kid by walking up to each one. It works for a small crowd.',
      body: [
        'The streamer pushes video to an **ingest server**. That server relays the same stream directly to every viewer over a long connection.',
        'It is simple and the delay is low. Each viewer costs the server bandwidth, CPU and a socket.',
      ],
      keyIdea: 'Pushing every viewer a private copy from one server is the baseline that breaks first.',
      metrics: { viewers: '1K', egress: '3 Gbps', delay: '1 s', chat: '17/s' },
      scene: {
        nodes: [streamer, { ...box, label: 'ingest + relay', load: 62 }, { ...viewer, at: at(6, 0), label: '1K viewers', sub: '3 Mbps each' }],
        links: [link('streamer', 'box', { label: 'RTMP' }), link('box', 'viewer', { label: '1K private copies' })],
        flows: [
          { path: ['streamer', 'box'], tone: 'data', duration: 1.4 },
          { path: ['box', 'viewer'], tone: 'response', count: 5, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'One server, 1K viewers',
          icon: 'Server',
          rows: [
            { text: 'Out bandwidth', value: '3 Gbps', tone: 'warn' },
            { text: 'Sockets', value: '1,000' },
            { text: 'Delay', value: 'about 1 s', tone: 'good' },
          ],
        },
        caption: 'Works up to about a thousand viewers',
      },
    },
    {
      title: 'It breaks',
      tag: 'problem',
      heading: 'Where it breaks: one NIC, 6M viewers',
      eli5: 'A million kids all want the helper to walk to them. The helper only has two legs, so most kids hear nothing, and the helper forgets the storyteller.',
      body: [
        'One 6M-viewer stream needs **18 Tbps** from one origin: more than any machine or data center can send. The server also does the conversion work, so CPU melts first.',
        'Viewers on slow links need smaller video, but one stream has one quality. They stall.',
      ],
      keyIdea: 'Fan-out must move away from the origin, and quality must adapt per viewer.',
      metrics: { viewers: '6M', egress: '18 Tbps', delay: 'stalls', chat: '-' },
      metricTones: { egress: 'bad', delay: 'bad' },
      scene: {
        nodes: [streamer, { ...box, label: 'ingest + relay', status: 'hot', load: 100 }, { ...viewer, at: at(6, 0), label: '6M viewers', status: 'down', badge: 'buffering' }],
        links: [link('streamer', 'box'), link('box', 'viewer', { label: '18 Tbps wanted', labelTone: 'bad' })],
        flows: [
          { path: ['streamer', 'box'], tone: 'data', duration: 1.4 },
          { path: ['box', 'viewer'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Why it fails',
          icon: 'Bug',
          rows: [
            { text: 'Egress needed', value: '18 Tbps', tone: 'bad' },
            { text: 'One NIC', value: '100 Gbps', tone: 'warn' },
            { text: 'Encode load', value: '100%', tone: 'bad' },
            { text: 'Slow viewers', value: 'stall', tone: 'bad' },
          ],
        },
        caption: 'The origin cannot also be the broadcaster',
      },
    },
    {
      title: 'Ingest edge',
      tag: 'concept',
      heading: 'Ingest: take the stream at the nearest edge',
      eli5: 'The storyteller does not walk across town. A listener-collector stands at the park gate nearest to them, takes the story, and carries it inside on a fast private road.',
      body: [
        'OBS sends the stream over **RTMP** or **SRT** to an **ingest edge** in a nearby point of presence. SRT adds retransmission for lossy home networks. A short first hop cuts packet loss.',
        'The edge forwards the stream over the provider backbone to one **origin**, which owns that channel and is the single source of truth for it.',
      ],
      keyIdea: 'Ingest is short on the public internet and long on the private backbone.',
      metrics: { viewers: '-', egress: '-', delay: '+0.3 s', chat: '-' },
      scene: {
        nodes: [{ ...streamer, status: 'active' }, { ...ingest, status: 'active' }, origin],
        links: [link('streamer', 'ingest', { label: 'RTMP / SRT, 6 Mbps' }), link('ingest', 'origin', { label: 'backbone' })],
        flows: [
          { path: ['streamer', 'ingest'], tone: 'data', label: 'frames', count: 2, duration: 1.4 },
          { path: ['ingest', 'origin'], tone: 'data', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Ingest protocols',
          icon: 'Cable',
          rows: [
            { text: 'RTMP', value: 'TCP, universal' },
            { text: 'SRT', value: 'UDP + retries', tone: 'good' },
            { text: 'Stream key', value: 'auth per channel' },
          ],
        },
        caption: 'First hop short, backbone does the rest',
      },
    },
    {
      title: 'Transcode',
      tag: 'concept',
      heading: 'Transcoding: one source, five rungs',
      eli5: 'The story is told once in a loud voice. Helpers repeat it in a medium voice, a quiet voice and a whisper, so kids far away or with sleepy ears can still follow.',
      body: [
        'The origin sends the source to a **transcoder fleet**. It makes lower **renditions**: 720p, 480p, 360p and 160p, a **ladder** for different bandwidths.',
        'Each rung costs roughly 2 vCPU-seconds per second of video, about 8 for the stream. At 100K streams that is **800K vCPUs** sustained.',
      ],
      keyIdea: 'Transcoding creates the quality ladder, and it is the largest compute bill.',
      metrics: { viewers: '-', egress: '-', delay: '+1 s', chat: '-' },
      scene: {
        nodes: [origin, { ...trans, status: 'hot', load: 88 }, { id: 'ladder', kind: 'storage', at: at(6, 0), label: 'renditions', sub: '5 qualities' }],
        links: [link('origin', 'trans'), link('trans', 'ladder')],
        flows: [
          { path: ['origin', 'trans'], tone: 'data', label: '1080p60', duration: 1.4 },
          { path: ['trans', 'ladder'], tone: 'data', label: '720 480 360 160', count: 4, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Ladder for one stream',
          icon: 'Layers',
          rows: [
            { text: 'source 1080p60', value: '6 Mbps' },
            { text: '720p', value: '3 Mbps' },
            { text: '480p', value: '1.5 Mbps' },
            { text: '360p', value: '0.8 Mbps' },
            { text: '160p', value: '0.3 Mbps' },
          ],
          footer: { text: '8 vCPU-seconds per second of video', tone: 'warn' },
        },
        caption: 'Five qualities from one source',
      },
      quiz: {
        question: 'Why does the design transcode into several quality rungs?',
        options: ['To make chat faster', 'So each viewer can pick the rung that fits their bandwidth', 'To reduce the number of streamers', 'To avoid using a CDN'],
        answer: 1,
        explain: 'The ladder lets players on slow links drop to a lower rung without stalling, while fast links keep 1080p.',
      },
    },
    {
      title: 'Package',
      tag: 'concept',
      heading: 'Packaging: cut the stream into small files',
      eli5: 'Instead of reading the story out loud forever, the helper writes it on short cards. Anyone can pick up the next card whenever they are ready.',
      body: [
        'The **packager** cuts each rendition into short **segments** and writes a **playlist** listing the latest ones (HLS, or CMAF). This is classic HLS with **10 s segments**, so the packager adds about 10 s of delay. A segment is plain bytes in a file.',
        'Because segments are ordinary HTTP objects, any web cache can store and serve them. That makes the CDN usable.',
      ],
      keyIdea: 'Turning a live stream into small HTTP files makes it cacheable.',
      metrics: { viewers: '-', egress: '-', delay: '+10 s', chat: '-' },
      scene: {
        nodes: [trans, { ...pack, status: 'active' }, { id: 'files', kind: 'storage', at: at(0, 3.4), label: 'segments', sub: '10 s each' }],
        links: [link('trans', 'pack'), link('pack', 'files')],
        flows: [
          { path: ['trans', 'pack'], tone: 'data', duration: 1.2 },
          { path: ['pack', 'files'], tone: 'data', label: 'seg_104.m4s', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Playlist',
          icon: 'FileText',
          code: '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:102\n#EXTINF:10.0,\nseg_102.m4s\nseg_103.m4s\nseg_104.m4s',
        },
        caption: 'The stream becomes a rolling list of files',
      },
      code: {
        language: 'bash',
        title: 'What a player does',
        source: `# 1. fetch the playlist, pick the rung that fits
curl https://cdn.example/live/ninja/720p/index.m3u8

# 2. fetch the newest segment
curl https://cdn.example/live/ninja/720p/seg_104.m4s

# 3. repeat every 10 s, switch rung if bandwidth changes`,
        highlight: [2, 5],
      },
    },
    {
      title: 'CDN',
      tag: 'concept',
      heading: 'The CDN carries the 9 Tbps',
      eli5: 'Instead of one helper handing out cards to every kid, the helper puts copies in boxes spread around town. Kids grab a card from the nearest box.',
      body: [
        'Edge caches pull each segment once from the packager and serve it to thousands of nearby viewers. A cache hit costs the origin nothing. At a 99.9% hit rate, 3M viewers cause about 3K origin requests per segment instead of 3M. This is still classic HLS with 10 s segments, so delay is about 25 s.',
        'This is the fan-out idea from the CDN lesson, applied to a file that lives for a few seconds.',
      ],
      keyIdea: 'Cache segments at the edge and the origin sees about 3K requests per segment, not 3M.',
      metrics: { viewers: '3M', egress: '9 Tbps at edge', delay: '25 s', chat: '-' },
      metricTones: { egress: 'good' },
      scene: {
        nodes: [
          { ...pack, at: at(-4, 0) },
          { ...cdn, at: at(0, 0), status: 'ok', badge: '99.9% hit' },
          { ...viewer, at: at(4, 0), label: '3M viewers' },
        ],
        links: [link('pack', 'cdn', { label: 'about 3K per segment' }), link('cdn', 'viewer', { label: '9 Tbps' })],
        flows: [
          { path: ['pack', 'cdn'], tone: 'data', label: 'seg_104', duration: 1.2 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 5, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Origin load',
          icon: 'Server',
          rows: [
            { text: 'Viewer requests', value: '3M / segment' },
            { text: 'Cache hit', value: '99.9%', tone: 'good' },
            { text: 'Origin requests', value: 'about 3K / segment', tone: 'good' },
          ],
          footer: { text: 'The edge fans out, not the origin', tone: 'good' },
        },
        caption: 'Segments are cached like any web object',
      },
    },
    {
      title: 'Delay problem',
      tag: 'problem',
      heading: 'Plain HLS is 20 to 30 seconds behind',
      eli5: 'The helper waits until a card is completely full before sending it, and kids wait for three cards before reading. By then the storyteller is on a new part of the story.',
      body: [
        'Classic HLS uses 10 s segments, and players buffer 3 of them before playing. That is **20 to 30 seconds** from lens to screen.',
        'Chat runs in real time, so viewers see jokes about moments that already passed. The delay budget is under 3 s.',
      ],
      keyIdea: 'Segment length times buffered segments is the delay floor. Shrink both.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '25 s', chat: '100K/s' },
      metricTones: { delay: 'bad' },
      scene: {
        nodes: [
          { ...streamer, at: at(-4, 0), status: 'active', chips: ['now'] },
          { ...cdn, at: at(0, 0), status: 'dim' },
          { ...viewer, at: at(4, 0), chips: [{ text: '25 s ago', tone: 'bad' }], status: 'hot' },
        ],
        links: [link('streamer', 'cdn'), link('cdn', 'viewer', { label: '10 s segments x 3', labelTone: 'bad' })],
        flows: [
          { path: ['streamer', 'cdn'], tone: 'data', duration: 1.2 },
          { path: ['cdn', 'viewer'], tone: 'response', duration: 1.6, delay: 4 },
        ],
        panel: {
          title: 'Delay budget',
          icon: 'Timer',
          rows: [
            { text: 'Segment length', value: '10 s', tone: 'warn' },
            { text: 'Player buffer', value: '3 segments', tone: 'warn' },
            { text: 'Total', value: '20 to 30 s', tone: 'bad' },
            { text: 'Target', value: 'under 3 s', tone: 'good' },
          ],
        },
        caption: 'Chat is ahead of the video',
      },
    },
    {
      title: 'Low-latency HLS',
      tag: 'concept',
      heading: 'LL-HLS: serve the segment while it is still being cut',
      eli5: 'Instead of waiting for a whole card, the helper hands over each line as soon as it is written, and the reader waits right at the helper instead of coming back to ask again.',
      body: [
        '**Partial segments** of about 200 ms can be fetched before the full 2 s segment is done. A **blocking playlist reload** makes the server hold the request until the next part exists, so the player does not poll.',
        'With HTTP/2 or HTTP/3 delivery the delay falls to **2 to 4 s**.',
      ],
      keyIdea: 'LL-HLS shrinks the unit of delivery from a whole segment to a 200 ms part, and removes polling.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s', chat: '100K/s' },
      metricTones: { delay: 'good' },
      scene: {
        nodes: [
          { ...pack, at: at(-4, 0), status: 'active', chips: ['part 3 of 10'] },
          { ...cdn, at: at(0, 0), status: 'ok' },
          { ...viewer, at: at(4, 0), status: 'ok', chips: [{ text: '2 s behind', tone: 'good' }] },
        ],
        links: [link('pack', 'cdn', { label: '200 ms parts' }), link('cdn', 'viewer', { label: 'held request' })],
        flows: [
          { path: ['viewer', 'cdn'], tone: 'request', label: 'wait for part 4', duration: 1 },
          { path: ['pack', 'cdn'], tone: 'data', label: 'part 4', duration: 1, delay: 1.1 },
          { path: ['cdn', 'viewer'], tone: 'response', label: 'part 4', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'What changed',
          icon: 'Zap',
          rows: [
            { text: 'Segment', value: '2 s' },
            { text: 'Part', value: '200 ms', tone: 'good' },
            { text: 'Playlist reload', value: 'blocking', tone: 'good' },
            { text: 'Delay', value: '2 to 4 s', tone: 'good' },
          ],
        },
        caption: 'The CDN still does the fan-out',
      },
    },
    {
      title: 'LL-HLS or WebRTC',
      tag: 'tradeoff',
      heading: 'LL-HLS or WebRTC?',
      eli5: 'Cards (LL-HLS) can be copied into many boxes around town, so a huge crowd can read them. A live phone call for every kid (WebRTC) is faster, but you need one phone line per kid.',
      body: [
        '**WebRTC** gets under a second but needs per-viewer connections and does not cache. It fits video calls (see the video conferencing lesson), not 6M viewers.',
        'LL-HLS reuses the CDN, so it scales, but it will not go below about 2 s. Chat can live with 2 s, so it wins.',
      ],
      keyIdea: 'Reusing CDN caches beats saving the last second when the audience is in the millions.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s', chat: '100K/s' },
      scene: {
        nodes: [
          { id: 'll', kind: 'block', at: at(-3, 0), label: 'LL-HLS', sub: 'cacheable files', icon: 'Layers', tint: 'green' },
          { id: 'rtc', kind: 'block', at: at(3, 0), label: 'WebRTC', sub: 'per-viewer socket', icon: 'Plug', tint: 'amber' },
        ],
        panel: {
          title: 'Pick for 6M viewers',
          icon: 'Scale',
          rows: [
            { text: 'LL-HLS delay', value: '2 to 4 s', tone: 'good' },
            { text: 'LL-HLS scale', value: 'CDN, millions', tone: 'good' },
            { text: 'WebRTC delay', value: 'under 1 s', tone: 'good' },
            { text: 'WebRTC scale', value: 'one conn per viewer', tone: 'bad' },
          ],
        },
        caption: 'Scale wins over the last second',
      },
      quiz: {
        question: 'Why is LL-HLS preferred over WebRTC for a stream with millions of viewers?',
        options: ['It has lower delay', 'It reuses CDN caches so the origin sees few requests', 'It needs no packager', 'It supports more chat emotes'],
        answer: 1,
        explain: 'LL-HLS is just small HTTP files, so CDN caches fan them out. WebRTC needs a live connection per viewer that cannot be cached.',
      },
    },
    {
      title: 'Chat path',
      tag: 'concept',
      heading: 'Chat is its own system, not part of the video',
      eli5: 'The kids shout back to each other in the park. That shouting does not go through the storyteller or the card boxes. It has its own loudspeaker.',
      body: [
        'Chat is small text, many senders and many readers. It does not touch the video pipeline. A **WebSocket** per viewer connects to a **chat service**, sharded by channel.',
        'Every message must reach everyone watching that channel: **100K msg/s** overall, 10K msg/s inside one busy channel.',
      ],
      keyIdea: 'Chat and video scale separately. Chat is a fan-out of tiny messages, not of big files.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s', chat: '100K/s' },
      scene: {
        nodes: [
          { ...viewer, at: at(-5, 0), label: 'viewers' },
          { ...chat, at: at(0, 0), status: 'active' },
          { id: 'hist', kind: 'db', at: at(5, 0), label: 'chat log', sub: 'by channel + time' },
        ],
        links: [link('viewer', 'chat', { arrow: 'both', label: 'WebSocket' }), link('chat', 'hist')],
        flows: [
          { path: ['viewer', 'chat'], tone: 'event', label: 'PogChamp', duration: 1.2 },
          { path: ['chat', 'viewer'], tone: 'event', count: 3, duration: 1.2, delay: 1.3 },
          { path: ['chat', 'hist'], tone: 'data', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Chat load',
          icon: 'Activity',
          rows: [
            { text: 'Overall', value: '100K msg/s' },
            { text: 'Spike', value: '1M msg/s', tone: 'warn' },
            { text: 'One hot channel', value: '10K msg/s', tone: 'warn' },
          ],
        },
        caption: 'Shard by channel',
      },
    },
    {
      title: 'Chat fan-out',
      tag: 'concept',
      heading: 'Fan-out with pub/sub per channel',
      eli5: 'Each kid shouts to the nearest park helper. The helper writes it on a shared board for that story only, and every helper copies it out to the kids standing near them.',
      body: [
        'Edge WebSocket servers per region hold the connections. Each subscribes to a **pub/sub** topic for the channels its viewers watch. A message is published once and every subscribed server pushes it down its sockets.',
        'See the pub/sub lesson and the real-time delivery lesson for the mechanics.',
      ],
      keyIdea: 'Publish once per channel, let each edge server fan out to its own sockets.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s', chat: '100K/s' },
      scene: {
        nodes: [
          { id: 'ws1', kind: 'server', at: at(-5, 0), label: 'edge WS 1', sub: 'region A' },
          { id: 'bus', kind: 'queue', at: at(0, 0), label: 'pub/sub', sub: 'topic per channel' },
          { id: 'ws2', kind: 'server', at: at(5, 0), label: 'edge WS 2', sub: 'region B' },
        ],
        links: [link('ws1', 'bus'), link('bus', 'ws2')],
        flows: [
          { path: ['ws1', 'bus'], tone: 'event', label: 'msg', duration: 1.2 },
          { path: ['bus', 'ws2'], tone: 'event', label: 'msg', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One message',
          icon: 'Share2',
          rows: [
            { text: 'Viewer sends', value: 'to its edge' },
            { text: 'Edge publishes', value: '1 time', tone: 'good' },
            { text: 'Other edges', value: 'push to sockets', tone: 'good' },
          ],
        },
        caption: 'One publish, many pushes',
      },
    },
    {
      title: 'Viral chat',
      tag: 'case',
      heading: 'A 6M-viewer stream: use a tree, not a star',
      eli5: 'One board in the middle of the park cannot be read by a million kids at once. So the board is copied to regional boards, then neighborhood boards, and kids read the nearest.',
      body: [
        'One channel can burst to 10K msg/s with 6M readers. A single pub/sub node publishing to every edge becomes the hotspot.',
        'Use **hierarchical pub/sub**: region aggregators subscribe to the origin topic, and local servers subscribe to their region. Fan-out is a tree, not a star.',
      ],
      keyIdea: 'Hot channels need tree fan-out, so no single node writes to all the others.',
      metrics: { viewers: '6M', egress: '18 Tbps at edge', delay: '2 s', chat: '10K/s hot' },
      metricTones: { chat: 'warn' },
      scene: {
        nodes: [
          { id: 'topic', kind: 'queue', at: at(-5, 0), label: 'origin topic', sub: 'one channel', status: 'hot' },
          { id: 'reg', kind: 'queue', at: at(0, 0), label: 'regional', sub: '10 aggregators' },
          { id: 'loc', kind: 'server', at: at(5, 0), label: 'local WS', sub: '2K edges' },
        ],
        links: [link('topic', 'reg'), link('reg', 'loc')],
        flows: [
          { path: ['topic', 'reg'], tone: 'event', count: 2, duration: 1.2 },
          { path: ['reg', 'loc'], tone: 'event', count: 4, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Tree fan-out',
          icon: 'Split',
          rows: [
            { text: 'Origin to regions', value: '10 copies' },
            { text: 'Region to locals', value: '200 each' },
            { text: 'Origin writes', value: '10, not 2,000', tone: 'good' },
          ],
        },
        caption: 'No node feeds everyone',
      },
    },
    {
      title: 'Chat guards',
      tag: 'tradeoff',
      heading: 'Slow mode and sub-only mode',
      eli5: 'When the park gets too loud, the helper says "one shout per minute", or "only kids with a ticket may shout". Fewer shouts means everyone can still hear.',
      body: [
        'A raid sends thousands of viewers into one channel at once. **Slow mode** limits each user to one message every N seconds. **Sub-only mode** restricts chat to paying subscribers.',
        'Both cut message volume before it hits pub/sub. See the rate limiting lesson. The cost is that some people cannot speak.',
      ],
      keyIdea: 'Limit at the edge before fan-out, because every accepted message multiplies by the audience.',
      metrics: { viewers: '6M', egress: '18 Tbps at edge', delay: '2 s', chat: '10K to 1K/s' },
      metricTones: { chat: 'good' },
      scene: {
        nodes: [
          { ...viewer, at: at(-5, 0), label: 'viewers', chips: [{ text: '10K msg/s', tone: 'warn' }] },
          { id: 'guard', kind: 'limiter', at: at(0, 0), label: 'slow mode', sub: '1 per 10 s', status: 'active' },
          { ...chat, at: at(5, 0), chips: [{ text: '1K msg/s', tone: 'good' }] },
        ],
        links: [link('viewer', 'guard'), link('guard', 'chat')],
        flows: [
          { path: ['viewer', 'guard'], tone: 'event', count: 5, duration: 1.2 },
          { path: ['guard', 'chat'], tone: 'event', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Chat modes',
          icon: 'Shield',
          rows: [
            { text: 'Slow mode', value: '1 msg / N s' },
            { text: 'Sub-only', value: 'subscribers' },
            { text: 'Volume after', value: '10x lower', tone: 'good' },
          ],
        },
        caption: 'Shed load before the fan-out',
      },
    },
    {
      title: 'Emotes and mods',
      tag: 'concept',
      heading: 'Emotes, subs, bits, raids and mod tools',
      eli5: 'Stickers live in a sticker shop, and a message only says which sticker to show. A ticket booth marks who paid. A helper can send the whole crowd to another park, and a guard can tell everyone to forget a shout.',
      body: [
        '**Emotes** are small images served from the CDN. A chat message carries only an emote id, and the client fetches the image from cache. **Subs and bits** go through a payment service that flips a flag on the chat user, so the chat service can show badges and allow sub-only mode.',
        'A **raid** redirects the viewers of one channel to another and turns on slow mode there. **Mod tools** publish a delete or ban event on the same channel topic, so every connected client removes the message at once.',
      ],
      keyIdea: 'Each extra feature reuses an existing path: the CDN for images, a flag on the user, and the channel topic for events.',
      metrics: { viewers: '6M', egress: '18 Tbps at edge', delay: '2 s', chat: '10K/s hot' },
      scene: {
        nodes: [
          { id: 'pay', kind: 'service', at: at(-5, 0), label: 'payment service', sub: 'subs, bits' },
          { ...chat, at: at(0, 0), status: 'active', chips: ['sub flag'] },
          { ...cdn, at: at(5, 0), label: 'CDN edge', sub: 'emote images' },
        ],
        links: [link('pay', 'chat', { label: 'sets sub flag' }), link('chat', 'cdn', { label: 'emote id', style: 'dashed' })],
        flows: [
          { path: ['pay', 'chat'], tone: 'event', label: 'sub = true', duration: 1.2 },
          { path: ['chat', 'cdn'], tone: 'request', label: 'emote_42', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Feature to mechanism',
          icon: 'Table',
          rows: [
            { text: 'Emotes', value: 'CDN image, id in message' },
            { text: 'Subs and bits', value: 'payment sets user flag' },
            { text: 'Raid', value: 'redirect + slow mode' },
            { text: 'Mod delete or ban', value: 'event on channel topic' },
          ],
        },
        caption: 'No new pipeline, just reused paths',
      },
    },
    {
      title: 'VOD and clips',
      tag: 'concept',
      heading: 'VODs and clips come from the segments you already made',
      eli5: 'The helper keeps the story cards in a box. When the story ends the cards are bound into a book, and anyone can tear out a favorite page and make a mini book.',
      body: [
        'While live, the packager also writes segments to **object storage**. When the stream ends, the playlist is finalized and becomes the **VOD** with no re-encoding.',
        'A **clip** is a 30 s range of those segments, cut by reference and given its own small playlist. Chat is stored with timestamps to replay alongside.',
      ],
      keyIdea: 'Live and VOD share one set of segments, so recording is almost free.',
      metrics: { viewers: '-', egress: '-', delay: '-', chat: '-' },
      scene: {
        nodes: [
          { ...pack, at: at(-5, 0) },
          { id: 'store', kind: 'storage', at: at(0, 0), label: 'object storage', sub: 'all segments' },
          { id: 'vodb', kind: 'block', at: at(5, 0), label: 'VOD + clips', sub: 'by time range', icon: 'FileText', tint: 'amber' },
        ],
        links: [link('pack', 'store'), link('store', 'vodb')],
        flows: [
          { path: ['pack', 'store'], tone: 'data', label: 'seg_104', duration: 1.2 },
          { path: ['store', 'vodb'], tone: 'data', label: 'range 14:03 to 14:33', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'From live to VOD',
          icon: 'HardDrive',
          rows: [
            { text: 'Segments saved', value: 'as they are made' },
            { text: 'Stream ends', value: 'finalize playlist' },
            { text: 'Clip', value: 'range, no re-encode', tone: 'good' },
          ],
        },
        caption: 'One set of files, three uses',
      },
    },
    {
      title: 'Hardware',
      tag: 'tradeoff',
      heading: 'Hardware transcoders cut the compute bill',
      eli5: 'Hiring a thousand people to repeat the story in whispers is costly. A small speaking machine does it ten times cheaper, but it only knows a few voices.',
      body: [
        '800K vCPUs is a huge fleet. **GPU or ASIC encoders** (NVENC, custom video chips) do the same work at roughly one tenth of the cost.',
        'The price is flexibility: fixed codec profiles and settings, so new codecs or tuning need new hardware.',
      ],
      keyIdea: 'Specialized hardware wins on the biggest cost, at the price of locking in codecs.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s', chat: '100K/s' },
      scene: {
        nodes: [
          { ...trans, at: at(-3, 0), label: 'CPU encoders', sub: 'flexible', tint: 'amber' },
          { ...trans, id: 'hw', at: at(3, 0), label: 'HW encoders', sub: 'GPU / ASIC', tint: 'green', status: 'ok' },
        ],
        panel: {
          title: 'Cost per stream',
          icon: 'Cpu',
          rows: [
            { text: 'CPU fleet', value: '800K vCPUs', tone: 'bad' },
            { text: 'HW fleet', value: 'about 10x less', tone: 'good' },
            { text: 'Codec choice', value: 'fixed profiles', tone: 'warn' },
          ],
        },
        caption: 'Cheaper, but less flexible',
      },
    },
    {
      title: 'Ingest dies',
      tag: 'case',
      heading: 'Failure: the ingest edge dies mid-stream',
      eli5: 'The collector at the park gate trips and drops the story. The storyteller notices, walks to the next gate, and continues. Listeners hear a short pause.',
      body: [
        'OBS notices the dropped connection and **reconnects** with the same stream key, through DNS, to another healthy edge. The origin accepts the new feed and keeps the same playlist going.',
        'Players keep playing from the CDN buffer for a few seconds. A short gap beats a dead channel.',
      ],
      keyIdea: 'Reconnect to a healthy edge, keep the channel state at the origin, and let buffers hide the gap.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s, +3 s blip', chat: '100K/s' },
      metricTones: { delay: 'warn' },
      scene: {
        nodes: [
          streamer,
          { ...ingest, status: 'down' },
          { ...ingest, id: 'ingest2', at: at(-3, 7.2), label: 'ingest edge 2', status: 'ok' },
          origin,
        ],
        links: [link('streamer', 'ingest', { style: 'dashed' }), link('streamer', 'ingest2'), link('ingest2', 'origin')],
        flows: [
          { path: ['streamer', 'ingest2'], tone: 'handshake', label: 'reconnect', duration: 1.2 },
          { path: ['ingest2', 'origin'], tone: 'data', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Repeat',
          rows: [
            { text: 'Detect', value: 'socket closed' },
            { text: 'Reconnect', value: 'same key, new edge', tone: 'good' },
            { text: 'Viewers', value: 'buffer hides it', tone: 'good' },
          ],
        },
        caption: 'The stream key survives, the edge does not',
      },
    },
    {
      title: 'Transcoder dies',
      tag: 'case',
      heading: 'Failure: a transcoder crashes',
      eli5: 'One helper repeating the story in a whisper faints. Another helper stands up, reads the last card and keeps going. Kids might skip one card.',
      body: [
        'Each stream is assigned to a transcoder with a **lease** that must be renewed. When it expires, the origin hands the stream to another machine, which resumes at the next keyframe.',
        'The ladder lags for a couple of segments. Players drop to a rung that is still available or wait.',
      ],
      keyIdea: 'Short leases and keyframe resume make a transcoder failure a blip, not an outage.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s, +4 s blip', chat: '100K/s' },
      metricTones: { delay: 'warn' },
      scene: {
        nodes: [
          origin,
          { ...trans, status: 'down', badge: 'lease lost' },
          { ...trans, id: 'trans2', at: at(5.5, 3.4), label: 'transcoder 2', status: 'ok', badge: 'takes over' },
        ],
        links: [link('origin', 'trans', { style: 'dashed' }), link('origin', 'trans2')],
        flows: [{ path: ['origin', 'trans2'], tone: 'data', label: 'resume at keyframe', duration: 1.6 }],
        panel: {
          title: 'Lease',
          icon: 'Clock',
          rows: [
            { text: 'Renew every', value: '1 s' },
            { text: 'Expires after', value: '3 s', tone: 'warn' },
            { text: 'New owner resumes', value: 'next keyframe', tone: 'good' },
          ],
        },
        caption: 'The origin reassigns the stream',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Three paths, each sized for what it moves',
      eli5: 'The storyteller talks once at the park gate, helpers make quiet and loud copies on cards, boxes around town hold the cards, and the kids shout to each other on their own loudspeaker.',
      body: [
        'Video: RTMP or SRT into an ingest edge, an origin, a transcoder ladder, a packager making 200 ms parts of 2 s segments, then CDN caches that carry the 9 Tbps. Delay lands near 2 s with LL-HLS.',
        'Chat: WebSockets, pub/sub per channel, tree fan-out for hot channels, slow and sub-only modes. VODs and clips reuse the segments. Leases and reconnects survive failures.',
      ],
      keyIdea: 'Move fan-out to the edge, keep chat separate, and design for one stream with 6 million viewers.',
      metrics: { viewers: '3M', egress: '9 Tbps', delay: '2 s', chat: '100K/s' },
      metricTones: { delay: 'good' },
      scene: {
        nodes: [
          streamer,
          { ...ingest, at: at(-3, 0) },
          trans,
          { ...cdn, at: at(-0.5, 3.4), status: 'ok' },
          { ...viewer, at: at(6, 3.4) },
        ],
        links: [link('streamer', 'ingest'), link('ingest', 'trans', { label: 'via origin' }), link('trans', 'cdn', { label: 'packaged' }), link('cdn', 'viewer')],
        flows: [
          { path: ['streamer', 'ingest', 'trans'], tone: 'data', duration: 2.4 },
          { path: ['trans', 'cdn'], tone: 'data', duration: 1.2, delay: 2.5 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, duration: 1.2, delay: 1 },
        ],
      },
      quiz: {
        question: 'A raid sends 500K viewers into a small channel and chat jumps to 10K msg/s. What is the best first protection?',
        options: ['Add more video transcoders', 'Turn on slow or sub-only mode so volume is cut before fan-out', 'Switch the stream to WebRTC', 'Move chat history into the CDN'],
        answer: 1,
        explain: 'Every accepted message is multiplied by the number of viewers. Limiting at the edge cuts the volume before it hits pub/sub, and the video path is unaffected.',
      },
    },
  ],
};
