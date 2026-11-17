import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const tv: SceneNode = { id: 'tv', kind: 'client', at: at(-5, 0), label: 'TV app', sub: 'living room' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-5, 3.6), label: 'phone', sub: 'on the train' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-1.8, -3.2), label: 'Edge API', sub: 'control plane', icon: 'Network', tint: 'violet' };
const meta: SceneNode = { id: 'meta', kind: 'db', at: at(-1.8, 3.2), label: 'metadata', sub: 'Cassandra' };
const oca: SceneNode = { id: 'oca', kind: 'cdn', at: at(2.2, 0), label: 'edge server', sub: 'inside the ISP' };
const origin: SceneNode = { id: 'origin', kind: 'storage', at: at(5.6, 3.4), label: 'origin', sub: 'S3 masters' };
const fill: SceneNode = { id: 'fill', kind: 'server', at: at(5.6, -3.2), label: 'regional fill', sub: 'multi-PB' };

export const designNetflix: Lesson = {
  id: 'design-netflix',
  title: 'Design Netflix streaming',
  tagline: 'Put 200 million screens on 1 Pbps of video, start every play in under 2 seconds, and keep the bytes close to the viewer.',
  minutes: 26,
  level: 'Advanced',
  learn: [
    'Requirements and the numbers: 200M streams, 1 Pbps, start in under 2 seconds',
    'The API and data model, and why the cloud only handles the control plane',
    'Transcoding, bitrate ladders, segments and manifests (HLS and DASH)',
    'Adaptive bitrate: how the player picks the next rung every few seconds',
    'The Open Connect style CDN: tiers, nightly pre-positioning and steering',
    'Resume across devices, recommendations and A/B testing',
    'Failure cases: a dead edge server, a premiere surge and a cloud region outage',
  ],
  metrics: [
    { key: 'streams', label: 'Peak streams', icon: 'Users' },
    { key: 'bw', label: 'Peak bandwidth', icon: 'Gauge' },
    { key: 'start', label: 'Start of play', icon: 'Timer' },
    { key: 'rebuf', label: 'Rebuffer ratio', icon: 'Activity' },
    { key: 'edge', label: 'Bytes from edge', icon: 'Globe' },
  ],
  steps: [
    {
      title: 'Friday night',
      tag: 'problem',
      heading: 'The website is easy. The bytes are not',
      eli5: 'Imagine one library where every child in town comes to borrow the same thick book at the same time. The **library** has one door and one shelf, so everyone queues and nobody gets to read.',
      body: [
        'On a Friday evening about **200 million** streams run at once. At 5 Mbps each, that is **1 Pbps** leaving the building, and every viewer expects the picture to start in under 2 seconds.',
        'Serving this like a normal web app melts it. Video is huge, steady and impatient: one hour is 2.25 GB, and a stall of a few seconds feels broken.',
      ],
      keyIdea: 'Video is a bandwidth problem first. The catalog and the login page are the easy parts.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '?', rebuf: '?', edge: '0%' },
      metricTones: { bw: 'bad' },
      scene: {
        nodes: [
          { ...tv, chips: [{ text: '1080p · 5 Mbps', tone: 'warn' }] },
          { id: 'cloud', kind: 'server', at: at(0, 0), label: 'one region', sub: 'app + video', status: 'hot', load: 99 },
          { id: 'store', kind: 'storage', at: at(5, 0), label: 'video files', sub: 'all titles' },
        ],
        links: [link('tv', 'cloud', { label: '200M streams', labelTone: 'warn' }), link('cloud', 'store')],
        flows: [
          { path: ['tv', 'cloud', 'store'], tone: 'request', label: 'play', duration: 1.4 },
          { path: ['store', 'cloud', 'tv'], tone: 'error', count: 3, label: 'video bytes', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'One Friday evening',
          icon: 'Gauge',
          rows: [
            { text: 'Concurrent streams', value: '200M' },
            { text: 'Per stream', value: '5 Mbps' },
            { text: 'Total out', value: '1 Pbps', tone: 'bad' },
            { text: 'One hour of video', value: '2.25 GB', tone: 'warn' },
          ],
          footer: { text: 'No single region can push this', tone: 'bad' },
        },
        caption: 'Everything comes from one place',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What we are building, and how good it must be',
      eli5: 'The **library** must let a child find a book, read it on any chair, and pick up on the same page tomorrow. And the first page has to open before the child gets bored.',
      body: [
        'Functional: browse the catalog, play any title on any device at the best quality the network allows, resume across devices, and get personalized recommendations.',
        'Non-functional: start of play under **2 s**, rebuffer ratio under **0.5%**, **200M+** concurrent streams at peak and **99.99%** availability. We leave out billing and content licensing.',
      ],
      keyIdea: 'Two numbers drive the design: seconds to first frame, and share of time spent stalled.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '?' },
      scene: {
        nodes: [
          { ...tv, chips: ['browse', 'play', 'resume'] },
          { ...api, status: 'active', chips: ['99.99%'] },
          { ...oca, status: 'active', chips: [{ text: 'start < 2 s', tone: 'good' }, { text: 'rebuffer < 0.5%', tone: 'good' }] },
        ],
        links: [link('tv', 'api'), link('tv', 'oca', { route: 'straight' })],
        flows: [
          { path: ['tv', 'api'], tone: 'request', label: 'play', duration: 1.2 },
          { path: ['api', 'tv'], tone: 'response', label: 'where to fetch', duration: 1.2, delay: 1.3 },
          { path: ['oca', 'tv'], tone: 'data', count: 3, label: 'video', duration: 1.6, delay: 2.7 },
        ],
        panel: {
          title: 'Targets',
          icon: 'List',
          rows: [
            { text: 'Start of play', value: '< 2 s' },
            { text: 'Rebuffer ratio', value: '< 0.5%' },
            { text: 'Concurrent streams', value: '200M+' },
            { text: 'Availability', value: '99.99%' },
          ],
          footer: { text: '99.99% is about 52 minutes down per year', tone: 'muted' },
        },
        caption: 'Fast start, no stalls, huge scale',
      },
    },
    {
      title: 'The numbers',
      tag: 'concept',
      heading: 'Napkin math: bytes dwarf requests',
      eli5: 'Counting library cards is quick. Carrying the books is the hard part. The **library** gets far more weight from books leaving than from cards being stamped.',
      body: [
        'Bandwidth: 200M streams × 5 Mbps = **1 Pbps**. Catalog: 20k titles kept in many versions (rungs, codecs, devices, audio, subtitles), a rough **100 PB** and about **100M segment objects**.',
        'Metadata: 500M users × 4 sessions a day is 2B sessions, about **60k QPS** of starts and reads. Position heartbeats add a separate **670k writes/s** (see the resume step). All-pairs scoring is 500M × 20k = 10^13, so recommendations are approximated.',
      ],
      keyIdea: 'Session reads are a normal web workload. Video delivery is what forces a special architecture.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '?' },
      scene: {
        nodes: [
          { ...tv },
          { ...meta, status: 'active', chips: [{ text: '60k QPS', tone: 'good' }] },
          { ...oca, status: 'hot', chips: [{ text: '1 Pbps', tone: 'bad' }] },
        ],
        links: [link('tv', 'meta'), link('tv', 'oca', { route: 'straight' })],
        flows: [
          { path: ['tv', 'meta'], tone: 'request', label: 'a few KB', duration: 1.2 },
          { path: ['oca', 'tv'], tone: 'data', count: 4, label: 'GBs', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Capacity',
          icon: 'Table',
          rows: [
            { text: 'Peak bandwidth', value: '1 Pbps', tone: 'bad' },
            { text: 'Catalog, rough order', value: '~100 PB', tone: 'warn' },
            { text: 'Segment objects', value: '~100M' },
            { text: 'Session QPS, peak', value: '~60k', tone: 'good' },
            { text: 'Position writes', value: '~670k/s, separate', tone: 'warn' },
            { text: 'Recs, all pairs', value: '10^13', tone: 'warn' },
          ],
          footer: { text: 'Same request count, a million times the bytes', tone: 'muted' },
        },
        caption: 'Metadata is small. Video is the load',
      },
    },
    {
      title: 'The API',
      tag: 'concept',
      heading: 'A small API that hands out directions, not bytes',
      eli5: 'The **librarian** at the desk does not hand over the book. She tells the child which shelf holds it and what page they stopped at.',
      body: [
        'Four calls cover the product: the home screen, a title page, **start playback** and a progress update. Start playback returns a manifest URL, a DRM license URL and an ordered list of edge servers.',
        'The API never carries video. The player reads the directions, then fetches segments straight from the edge. This is the API styles lesson at work: plain REST fits here.',
      ],
      keyIdea: 'The API returns where to fetch and how to unlock it. The player fetches the video itself.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '?' },
      scene: {
        nodes: [
          { ...tv, chips: ['POST /playback/start'] },
          { ...api, status: 'active' },
          { id: 'play', kind: 'block', size: 0.72, at: at(2.4, -3.2), label: 'playback', icon: 'Workflow', tint: 'blue' },
        ],
        links: [link('tv', 'api'), link('api', 'play')],
        flows: [
          { path: ['tv', 'api', 'play'], tone: 'request', label: 'start title 81', duration: 1.6 },
          { path: ['play', 'api', 'tv'], tone: 'response', label: 'manifest + edges', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'Code',
          code: 'GET  /v1/home\nGET  /v1/titles/{id}\nPOST /v1/playback/start\nPUT  /v1/titles/{id}/progress',
          footer: { text: 'No video bytes cross the API', tone: 'good' },
        },
        caption: 'Four calls, no video',
      },
      code: {
        language: 'json',
        title: 'POST /v1/playback/start, response',
        source: `{
  "titleId": 81,
  "manifestUrl": "https://edge-a1.isp.example/v/81/master.m3u8",
  "licenseUrl": "https://api.example.com/v1/drm/license",
  "edges": [
    "edge-a1.isp.example",
    "edge-a2.isp.example",
    "edge-regional.example"
  ],
  "resumeAtSec": 1260
}`,
        highlight: [3, 5, 6, 7, 8, 10],
      },
      quiz: {
        question: 'What should the playback start call return to the player?',
        options: [
          'The first few seconds of video in the response body',
          'A manifest URL, a license URL and an ordered list of edge servers',
          'A permanent link to the origin storage bucket',
          'The list of all 20k titles in the catalog',
        ],
        answer: 1,
        explain: 'The API hands out directions. The player then fetches segments from the edge, so video bytes never cross the control plane.',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Small catalog, enormous history',
      eli5: 'The **library** keeps a thin catalog of what books exist. But it also keeps a huge notebook of where every child stopped reading, and that notebook grows every minute.',
      body: [
        'The catalog is small and read-heavy: titles, and per-title **assets** that name each rendition and its path. It is cached hard and rarely changes.',
        'Viewing history and playback position are the big, write-heavy part. Partition them by `user_id` in a wide-column store (the SQL versus NoSQL lesson), newest first, so one user is one partition.',
      ],
      keyIdea: 'Split by shape: a small cached catalog, and a huge user-keyed store for history and position.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '?' },
      scene: {
        nodes: [
          { ...api },
          { id: 'catalog', kind: 'db', at: at(-3.6, 3.2), label: 'catalog', sub: '20k titles', status: 'ok' },
          { ...meta, at: at(1.2, 3.2), label: 'history', sub: 'Cassandra, by user', status: 'active', chips: ['500M users'] },
        ],
        links: [link('api', 'catalog'), link('api', 'meta')],
        flows: [
          { path: ['api', 'catalog'], tone: 'request', label: 'read, cached', duration: 1.3 },
          { path: ['api', 'meta'], tone: 'request', label: 'write position', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Tables',
          icon: 'Table',
          rows: [
            { text: 'title', value: 'id, name, type, year' },
            { text: 'asset', value: 'title, rung, lang, path' },
            { text: 'history', value: 'user_id, watched_at' },
            { text: 'position', value: 'user_id + title to sec' },
          ],
          footer: { text: 'history and position are keyed by user_id', tone: 'muted' },
        },
        caption: 'Catalog by title, history by user',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple design: one app, one pile of video',
      eli5: 'At first, the **library** keeps every book on one shelf behind one desk. The librarian looks up the title and walks the book over to the child.',
      body: [
        'Version one is what most teams would draw. An API server in one region looks up the title, reads the file from storage and streams it back to the player.',
        'For a thousand viewers this is fine. It is easy to reason about, easy to secure and cheap. The problems appear only when the numbers from earlier arrive.',
      ],
      keyIdea: 'One region serving files directly is the right place to start, and the wrong place to stay.',
      metrics: { streams: '1k', bw: '5 Gbps', start: '1.2 s', rebuf: '0.1%', edge: '0%' },
      metricTones: { start: 'good', rebuf: 'good' },
      scene: {
        nodes: [
          { ...tv },
          { id: 'app', kind: 'server', at: at(0, 0), label: 'API server', sub: 'one region', status: 'ok', load: 30 },
          { id: 'store', kind: 'storage', at: at(5, 0), label: 'video files', sub: 'object storage' },
        ],
        links: [link('tv', 'app', { label: '5 Mbps' }), link('app', 'store')],
        flows: [
          { path: ['tv', 'app', 'store'], tone: 'request', label: 'GET segment', duration: 1.4 },
          { path: ['store', 'app', 'tv'], tone: 'response', count: 2, label: 'segment', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'At 1,000 viewers',
          icon: 'Gauge',
          rows: [
            { text: 'Bandwidth out', value: '5 Gbps', tone: 'good' },
            { text: 'Server load', value: '30%', tone: 'good' },
            { text: 'Start of play', value: '1.2 s', tone: 'good' },
          ],
          footer: { text: 'Fine until the audience grows', tone: 'muted' },
        },
        caption: 'Everything flows through one region',
      },
    },
    {
      title: 'It breaks',
      tag: 'case',
      heading: 'Where the simple design breaks',
      eli5: 'Now every child in town queues at one desk. The **library** is too far for most homes, the door is jammed, and the delivery bill for carrying books grows every day.',
      body: [
        'Three things fail together. **Bandwidth**: no region can push 1 Pbps. **Distance**: a viewer across the ocean sees a round trip of 150 ms or more on every segment request, which caps throughput and delays the first frame.',
        '**Cost**: cloud egress is priced per GB, and 1 Pbps is billions of dollars a year at list price. Adding more app servers does not help, since the network is the limit.',
      ],
      keyIdea: 'More servers in one place cannot fix distance, bandwidth or egress cost. The video has to move closer to the viewer.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '8 s', rebuf: '12%', edge: '0%' },
      metricTones: { bw: 'bad', start: 'bad', rebuf: 'bad' },
      scene: {
        nodes: [
          { ...tv, status: 'hot', badge: 'buffering...' },
          { id: 'app', kind: 'server', at: at(0, 0), label: 'API server', sub: 'one region', status: 'hot', load: 100 },
          { id: 'store', kind: 'storage', at: at(5, 0), label: 'video files', sub: 'object storage', status: 'hot' },
        ],
        links: [link('tv', 'app', { label: '150 ms round trip', labelTone: 'warn' }), link('app', 'store')],
        flows: [
          { path: ['tv', 'app'], tone: 'request', label: 'GET segment', duration: 1.4 },
          { path: ['app', 'tv'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Why it fails',
          icon: 'Gauge',
          rows: [
            { text: 'Bandwidth needed', value: '1 Pbps', tone: 'bad' },
            { text: 'Round trip, far viewer', value: '150 ms+', tone: 'warn' },
            { text: 'Egress bill', value: 'billions / yr', tone: 'bad' },
            { text: 'Start of play', value: '8 s', tone: 'bad' },
          ],
          footer: { text: 'Network and distance, not CPU', tone: 'bad' },
        },
        caption: 'The region cannot carry the load',
      },
    },
    {
      title: 'Two planes',
      tag: 'tradeoff',
      heading: 'Split the control plane from the data plane',
      eli5: 'The **librarian** stays at the main desk and answers questions. The books themselves wait in small branch libraries on every street, so children walk a block instead of crossing town.',
      body: [
        'The **control plane** is small: login, catalog, playback start, DRM and history. It runs in the cloud, in a few regions. The **data plane** is the video itself, served by edge servers placed near viewers.',
        'The player asks the control plane where to go, then talks to the edge. The two scale on different curves, so they get different machines and different teams.',
      ],
      keyIdea: 'Keep decisions in the cloud and bytes at the edge. Each side scales on its own curve.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      metricTones: { edge: 'good' },
      scene: {
        nodes: [
          { ...tv },
          { ...api, chips: ['control plane'] },
          { ...meta, at: at(-1.8, 3.6) },
          { ...oca, chips: [{ text: 'data plane', tone: 'good' }] },
        ],
        links: [link('tv', 'api'), link('api', 'meta'), link('tv', 'oca', { route: 'straight' })],
        flows: [
          { path: ['tv', 'api', 'meta'], tone: 'request', label: 'play title 81', duration: 1.6 },
          { path: ['api', 'tv'], tone: 'response', label: 'edge list', duration: 1.2, delay: 1.7 },
          { path: ['oca', 'tv'], tone: 'data', count: 4, label: 'segments', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'Split',
          rows: [
            { text: 'Control plane', value: 'cloud, 60k QPS + 670k writes/s' },
            { text: 'Data plane', value: 'edge, 1 Pbps', tone: 'good' },
            { text: 'Bytes through the cloud', value: 'near zero', tone: 'good' },
          ],
          footer: { text: 'The API returns directions only', tone: 'muted' },
        },
        caption: 'Directions from the cloud, bytes from the edge',
      },
      quiz: {
        question: 'Which statement about the two planes is correct?',
        options: [
          'Both scale with the number of bytes streamed',
          'The control plane scales with requests and users, the data plane scales with bandwidth',
          'The data plane scales with the number of titles only',
          'The control plane must sit inside every ISP',
        ],
        answer: 1,
        explain: 'Directions are small and scale with sessions. Video is huge and scales with bits per second, so each side gets its own machines.',
      },
    },
    {
      title: 'Transcoding',
      tag: 'concept',
      heading: 'Prepare every title ahead of time, in parallel',
      eli5: 'Before opening day, a crew copies each book into large print, normal print and pocket size. They split the book into chapters so many helpers can copy at once.',
      body: [
        'A source master arrives at about 50 Mbps. A workflow engine splits it into **one minute** chunks, then runs a job per chunk, codec and rung: 120 × 4 codecs (H.264, HEVC, AV1) × 6 rungs is **~2,900 jobs**, plus audio and subtitles. A VMAF quality check gates each chunk.',
        'Wall time is about 30 minutes for a 2 hour film, even though the CPU time is about 500 core-hours. This is the job queue idea from the message queues and background jobs lessons.',
      ],
      keyIdea: 'Split the film into chunks and encode them all at once. Wall time shrinks to minutes.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { id: 'master', kind: 'storage', at: at(-5, 0), label: 'source master', sub: '~50 Mbps', status: 'active' },
          { id: 'wf', kind: 'queue', at: at(-1.8, -3.2), label: 'workflow', sub: '~2,900 jobs' },
          { id: 'enc', kind: 'worker', at: at(0.6, 3.2), label: 'encoders', sub: 'spot instances', status: 'hot', load: 92 },
          { id: 'rend', kind: 'storage', at: at(4.4, -0.4), label: 'renditions', sub: 'S3' },
        ],
        links: [link('master', 'wf'), link('wf', 'enc'), link('enc', 'rend')],
        flows: [
          { path: ['master', 'wf'], tone: 'data', label: '1 min chunks', duration: 1.2 },
          { path: ['wf', 'enc'], tone: 'event', count: 4, label: 'jobs', duration: 1.4, delay: 1.2 },
          { path: ['enc', 'rend'], tone: 'data', count: 3, label: 'encoded', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'One 2 hour film',
          icon: 'Cpu',
          rows: [
            { text: 'Chunks', value: '~120 x 1 min' },
            { text: 'Jobs', value: '120 × 4 × 6 ≈ 2,900' },
            { text: 'Extra tracks', value: 'audio, subtitles' },
            { text: 'CPU time', value: '~500 core-hours', tone: 'warn' },
            { text: 'Wall time', value: '~30 min', tone: 'good' },
          ],
          footer: { text: 'Parallel jobs turn hours into minutes', tone: 'good' },
        },
        caption: 'Split, fan out, collect',
      },
    },
    {
      title: 'Bitrate ladder',
      tag: 'concept',
      heading: 'A ladder of qualities, cut into short segments',
      eli5: 'Each book comes in three sizes: large print, normal and pocket. Each size is cut into short chapters, so a child can switch sizes at any chapter break.',
      body: [
        'Each title is encoded into a **ladder** of (resolution, bitrate) pairs, then cut into **segments** of 2 to 6 seconds. Every segment starts with an I-frame, so it can be decoded alone.',
        'The segments are stored in object storage (the object storage lesson). A title has about 6 rungs, and the scene shows 3 of them.',
      ],
      keyIdea: 'Independent short segments make switching quality cheap. That is the whole trick behind adaptive streaming.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { id: 'enc', kind: 'worker', at: at(-5, 0), label: 'encoders', sub: 'per chunk', status: 'active' },
          { id: 'rend', kind: 'storage', at: at(2.8, 0), label: 'renditions', sub: 'segments, 2 to 6 s', status: 'ok', chips: ['1080p', '720p', '360p'] },
        ],
        links: [link('enc', 'rend')],
        flows: [
          { path: ['enc', 'rend'], tone: 'data', count: 3, label: 'segments', duration: 1.5 },
        ],
        panel: {
          title: 'The ladder',
          icon: 'Layers',
          rows: [
            { text: '1080p', value: '5.8 Mbps' },
            { text: '720p', value: '2.1 Mbps' },
            { text: '360p', value: '0.56 Mbps' },
            { text: 'Segment length', value: '2 to 6 s' },
          ],
          footer: { text: '3 of about 6 rungs shown. Segments start with an I-frame', tone: 'muted' },
        },
        caption: 'Same movie, several sizes, many pieces',
      },
    },
    {
      title: 'The manifest',
      tag: 'concept',
      heading: 'The manifest is the player\'s map',
      eli5: 'Each book has a contents page that lists every size and where each chapter sits on the shelf. The child reads the page, then fetches chapters one by one.',
      body: [
        'A **manifest** lists every rung and where to find its segments. HLS uses an `.m3u8` text file and DASH uses an `.mpd` file. The player downloads it first, then requests segments by URL.',
        'The master playlist names the rungs. Each rung has its own playlist listing the segment files in order. Because segment URLs are plain files, any HTTP cache can serve them.',
      ],
      keyIdea: 'A manifest turns a movie into a list of plain files. That is why ordinary caches can serve it.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { ...tv, chips: ['master.m3u8'] },
          { ...api, status: 'active' },
          { ...oca, chips: ['hd_1080p/seg_0001.m4s'] },
        ],
        links: [link('tv', 'api'), link('tv', 'oca', { route: 'straight' })],
        flows: [
          { path: ['tv', 'oca'], tone: 'request', label: 'GET master.m3u8', duration: 1.4 },
          { path: ['oca', 'tv'], tone: 'response', label: 'rungs list', duration: 1.4, delay: 1.5 },
          { path: ['tv', 'oca', 'tv'], tone: 'request', label: 'GET seg_0001', duration: 1.6, delay: 3.1 },
        ],
        panel: {
          title: 'Two formats',
          icon: 'FileText',
          rows: [
            { text: 'HLS', value: '.m3u8 playlists' },
            { text: 'DASH', value: '.mpd manifest' },
            { text: 'Segments', value: 'plain HTTP files', tone: 'good' },
          ],
          footer: { text: 'Plain files mean plain caching', tone: 'good' },
        },
        caption: 'Read the map, then fetch the pieces',
      },
      code: {
        language: 'bash',
        title: 'master.m3u8 (a plain text playlist)',
        source: `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5800000,RESOLUTION=1920x1080
hd_1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2100000,RESOLUTION=1280x720
hd_720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=560000,RESOLUTION=640x360
sd_360p/index.m3u8`,
        highlight: [2, 4, 6],
      },
    },
    {
      title: 'Adaptive bitrate',
      tag: 'concept',
      heading: 'The player picks the next rung, every segment',
      eli5: 'The child checks how fast they are reading and how many chapters are in the bag. If the bag runs low, they pick pocket size for the next chapter and keep reading.',
      body: [
        'After every segment, the player measures throughput and how many seconds of video are buffered, then picks the rung for the next segment. This is **adaptive bitrate** (ABR) and it runs on the client.',
        'If Wi-Fi drops, the player falls from 1080p to 360p within about 6 seconds. The viewer sees a softer picture, not a spinner. Stalling is the failure ABR exists to avoid.',
      ],
      keyIdea: 'ABR trades picture quality for continuity. A blurry minute is better than a frozen one.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      metricTones: { rebuf: 'good' },
      scene: {
        nodes: [
          { ...tv, status: 'active', chips: [{ text: '360p', tone: 'warn' }, 'buffer 18 s'] },
          { id: 'wifi', kind: 'internet', at: at(-0.6, -3.2), label: 'home Wi-Fi', sub: 'weak signal', status: 'dim' },
          { ...oca, at: at(3.4, 0) },
        ],
        links: [link('tv', 'wifi', { label: '1.2 Mbps', labelTone: 'warn' }), link('wifi', 'oca')],
        flows: [
          { path: ['tv', 'wifi', 'oca'], tone: 'request', label: 'GET 360p seg', duration: 1.5 },
          { path: ['oca', 'wifi', 'tv'], tone: 'data', label: 'small segment', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Player state',
          icon: 'Activity',
          rows: [
            { text: 'Throughput', value: '1.2 Mbps', tone: 'warn' },
            { text: 'Buffer', value: '18 s' },
            { text: 'Last rung', value: '1080p' },
            { text: 'Next rung', value: '360p', tone: 'good' },
          ],
          footer: { text: 'Quality dips, playback continues', tone: 'good' },
        },
        caption: 'Down a rung instead of a stall',
      },
      code: {
        language: 'typescript',
        title: 'Choosing the next rung',
        source: `const rungs = [
  { name: '360p', mbps: 0.56 },
  { name: '720p', mbps: 2.1 },
  { name: '1080p', mbps: 5.8 },
];

function pickRung(throughputMbps: number, bufferSec: number) {
  const safe = bufferSec < 10 ? 0.6 : 0.85; // be careful when the buffer is low
  const fits = rungs.filter((r) => r.mbps <= throughputMbps * safe);
  return fits.length ? fits[fits.length - 1] : rungs[0];
}`,
        highlight: [8, 9, 10],
      },
    },
    {
      title: 'Own the edge',
      tag: 'tradeoff',
      heading: 'Put the servers inside the ISP',
      eli5: 'Instead of one big library across town, the **library** opens a small branch inside each neighborhood. The popular books are already on the shelf, a block from home.',
      body: [
        'A public CDN (the CDN lessons) could carry this, but at 1 Pbps the bill and the shared links become the problem. A large service can place its own appliances, full of SSDs, **inside the ISP\'s data centers**.',
        'Then most bytes never cross a peering link or the open internet. They travel from a box in the viewer\'s own ISP to the viewer. That is how the edge serves **95%+** of bytes.',
      ],
      keyIdea: 'The closest cache is one inside the viewer\'s own network. At this scale, owning it pays for itself.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      metricTones: { edge: 'good' },
      scene: {
        nodes: [
          { ...tv },
          { id: 'isp', kind: 'internet', at: at(-1.4, -3.2), label: 'ISP network', sub: 'last mile' },
          { ...oca, at: at(2.2, 0), status: 'ok', chips: [{ text: 'SSD, 100 to 280 TB', tone: 'good' }] },
          { id: 'cloud', kind: 'server', at: at(5.6, 3.4), label: 'cloud', sub: 'far away', status: 'dim' },
        ],
        links: [link('tv', 'isp'), link('isp', 'oca'), link('oca', 'cloud', { style: 'faint', label: 'rare fills' })],
        flows: [
          { path: ['tv', 'isp', 'oca'], tone: 'request', label: 'GET segment', duration: 1.4 },
          { path: ['oca', 'isp', 'tv'], tone: 'data', count: 4, label: 'video', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Path of a segment',
          icon: 'Route',
          rows: [
            { text: 'Hops outside the ISP', value: '0', tone: 'good' },
            { text: 'Share of bytes from edge', value: '95%+', tone: 'good' },
            { text: 'Cloud egress for video', value: 'near zero', tone: 'good' },
          ],
          footer: { text: 'Bytes stay inside the viewer\'s network', tone: 'good' },
        },
        caption: 'A branch library in every neighborhood',
      },
    },
    {
      title: 'Three tiers',
      tag: 'concept',
      heading: 'Edge, regional fill, origin',
      eli5: 'The neighborhood branch holds the popular books. If a child asks for a rare one, the branch phones the city depot, and the depot can order it from the main library.',
      body: [
        'Three tiers share the work. **Edge** appliances in ISPs hold recent, popular content. **Regional fill** clusters hold far more, including the long tail. **Origin** in S3 holds the full catalog.',
        'On an edge miss the appliance pulls from regional fill, which pulls from origin only if it must. Each tier is a cache for the one above it, as in the caching lessons.',
      ],
      keyIdea: 'A cache hierarchy keeps misses cheap: each miss climbs one tier, and only rare ones reach the origin.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { ...oca, at: at(-4.6, 0), status: 'active' },
          { ...fill, at: at(0, -3.2) },
          { ...origin, at: at(0, 3.4) },
        ],
        links: [link('oca', 'fill', { label: 'miss' }), link('fill', 'origin', { label: 'rare' })],
        flows: [
          { path: ['oca', 'fill'], tone: 'request', label: 'miss', duration: 1.3 },
          { path: ['fill', 'origin'], tone: 'request', label: 'rare miss', duration: 1.3, delay: 1.4 },
          { path: ['origin', 'fill', 'oca'], tone: 'data', label: 'copy', duration: 1.8, delay: 2.9 },
        ],
        panel: {
          title: 'The pyramid',
          icon: 'Layers',
          rows: [
            { text: 'Edge: in the ISP', value: 'SSD 100 to 280 TB', tone: 'good' },
            { text: 'Regional fill', value: 'multi-PB' },
            { text: 'Origin: S3', value: 'full catalog' },
          ],
          footer: { text: 'Edge serves 95%+ of bytes', tone: 'good' },
        },
        caption: 'A miss climbs one tier at a time',
      },
    },
    {
      title: 'Pre-positioning',
      tag: 'concept',
      heading: 'Fill the edge at night, before anyone asks',
      eli5: 'Each night, after closing, the city depot guesses which books tomorrow\'s children will want and delivers copies to every branch. By morning the shelves are ready.',
      body: [
        'A nightly job predicts what each region will watch tomorrow, using popularity per region and viewer affinity. It copies those titles to the edge during the ISP\'s quiet window, about **02:00 to 06:00** local.',
        'An appliance holds only about 0.2% of the roughly 100 PB catalog (200 TB), so the choice matters. Filling at night keeps fill traffic away from viewers, and a title is on the shelf before it is requested.',
      ],
      keyIdea: 'Do the expensive copying when the network is idle, so peak hours only read from local disks.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { id: 'forecast', kind: 'block', size: 0.72, at: at(-4.8, 0), label: 'forecast', sub: 'popularity by region', icon: 'TrendingUp', tint: 'amber' },
          { ...fill, at: at(-0.8, -3.2), status: 'active' },
          { ...oca, at: at(3.2, 0), status: 'active', chips: [{ text: '02:00 to 06:00', tone: 'good' }] },
        ],
        links: [link('forecast', 'fill'), link('fill', 'oca', { label: 'off-peak fill' })],
        flows: [
          { path: ['forecast', 'fill'], tone: 'event', label: 'what to place', duration: 1.3 },
          { path: ['fill', 'oca'], tone: 'data', count: 4, label: 'tomorrow\'s titles', duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Fill plan, one appliance',
          icon: 'Clock',
          rows: [
            { text: 'Catalog (rough)', value: '~100 PB' },
            { text: 'Appliance disk', value: '~200 TB' },
            { text: 'Share that fits', value: '~0.2%', tone: 'warn' },
            { text: 'Fill window', value: '02:00 to 06:00', tone: 'good' },
          ],
          footer: { text: 'Pick by regional popularity', tone: 'muted' },
        },
        caption: 'Stock the shelves overnight',
      },
      quiz: {
        question: 'Why fill edge servers between 02:00 and 06:00 local time?',
        options: [
          'Video files are cheaper to encode at night',
          'The ISP is quiet, so fill traffic does not compete with viewers',
          'Edge disks can only be written at night',
          'It is the only time the origin is online',
        ],
        answer: 1,
        explain: 'Filling is heavy traffic. Doing it in the ISP\'s low-traffic window protects viewers during the evening peak, and the title is already local when requested.',
      },
    },
    {
      title: 'Steering',
      tag: 'concept',
      heading: 'Which edge server answers this player?',
      eli5: 'When a child asks for a book, the **librarian** points to the nearest branch that has it, is not too crowded and is open. She also writes down a second branch in case the first closes.',
      body: [
        'Playback start picks the edge list. A steering service ranks servers by health, load, network distance and whether the title is on disk. It returns an ordered list, best first.',
        'Edge servers report their state often, so the ranking stays fresh. If the best choice is full or sick, the player has the next one in hand and never has to ask the cloud again.',
      ],
      keyIdea: 'Steering turns many edge servers into one service: best choice first, fallbacks already in hand.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '< 2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { ...tv },
          { ...api, at: at(-1.4, -3.2), label: 'steering', sub: 'ranks edges', status: 'active' },
          { ...oca, id: 'ocaA', at: at(2.4, -3.2), label: 'edge A', sub: 'has title, 40% load', status: 'ok', load: 40 },
          { ...oca, id: 'ocaB', at: at(5, 3.2), label: 'edge B', sub: 'no title, 85% load', status: 'dim', load: 85 },
        ],
        links: [link('tv', 'api'), link('api', 'ocaA'), link('api', 'ocaB', { style: 'faint' }), link('tv', 'ocaA', { route: 'straight' })],
        flows: [
          { path: ['tv', 'api'], tone: 'request', label: 'play title 81', duration: 1.2 },
          { path: ['api', 'tv'], tone: 'response', label: '[A, B]', duration: 1.2, delay: 1.3 },
          { path: ['tv', 'ocaA'], tone: 'request', label: 'segment from A', duration: 1.4, delay: 2.7 },
          { path: ['ocaA', 'tv'], tone: 'data', count: 3, label: 'video', duration: 1.4, delay: 4.2 },
        ],
        panel: {
          title: 'Ranking inputs',
          icon: 'Scale',
          rows: [
            { text: 'Health', value: 'up or down' },
            { text: 'Load', value: 'CPU, NIC' },
            { text: 'Network distance', value: 'same ISP first' },
            { text: 'Title on disk', value: 'yes or no', tone: 'good' },
          ],
          footer: { text: 'Returned as an ordered list', tone: 'muted' },
        },
        caption: 'Best server first, spares behind it',
      },
      quiz: {
        question: 'Why does steering return an ordered list instead of one server?',
        options: [
          'Players need several servers to stitch one video together',
          'If the first server is full or fails, the player already has the next one and does not ask the cloud again',
          'The list lets the API serve video from any entry',
          'One server cannot hold a whole title',
        ],
        answer: 1,
        explain: 'Fallbacks in hand turn a server failure into a quick retry, with no extra cloud round trip.',
      },
    },
    {
      title: 'Fast start',
      tag: 'case',
      heading: 'Spending the 2 second budget',
      eli5: 'The child must get a first page in two seconds. Asking the **librarian**, getting the key and fetching the first chapter each take a bit of that time, so none can be slow.',
      body: [
        'A start does five things in order: authenticate and call playback start, fetch a DRM license, read the manifest, download the first segments, then decode. About **1.2 s** is typical, which leaves headroom.',
        'To stay under budget, the player starts on a middle rung and climbs once the buffer builds. A cold start is cheaper at 720p than at 1080p, and the viewer rarely notices.',
      ],
      keyIdea: 'Start low, climb fast. Time to first frame matters more than the first seconds of sharpness.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.2 s', rebuf: '< 0.5%', edge: '95%+' },
      metricTones: { start: 'good' },
      scene: {
        nodes: [
          { ...tv, status: 'active', chips: [{ text: 'start 720p', tone: 'good' }] },
          { ...api, status: 'active' },
          { id: 'drm', kind: 'vault', at: at(0.2, 3.2), label: 'DRM license', sub: 'keys', status: 'active' },
          { ...oca, at: at(4, 0) },
        ],
        links: [link('tv', 'api'), link('tv', 'drm', { style: 'dashed' }), link('tv', 'oca', { route: 'straight' })],
        flows: [
          { path: ['tv', 'api', 'tv'], tone: 'request', label: 'start', duration: 1.2 },
          { path: ['tv', 'drm', 'tv'], tone: 'handshake', label: 'license', duration: 1.2, delay: 1.3 },
          { path: ['oca', 'tv'], tone: 'data', count: 3, label: 'first segments', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Start-of-play budget (illustrative)',
          icon: 'Timer',
          rows: [
            { text: 'Auth + playback start', value: '250 ms' },
            { text: 'DRM license', value: '150 ms' },
            { text: 'Manifest', value: '100 ms' },
            { text: 'First segments, edge', value: '400 ms', tone: 'good' },
            { text: 'Decode + render', value: '300 ms' },
          ],
          footer: { text: 'Total about 1.2 s of the 2 s budget', tone: 'good' },
        },
        caption: 'Five short steps, one budget',
      },
    },
    {
      title: 'Resume anywhere',
      tag: 'case',
      heading: 'Resume on the phone where the TV stopped',
      eli5: 'The child puts a bookmark in the book. The **librarian** writes the page number in the big notebook, so tomorrow any branch can open the book at the same page.',
      body: [
        'The player reports its position on pause, on stop and every few minutes. The API writes `(user_id, title_id) → seconds` to the wide-column store. At 200M streams and one write per 5 minutes, that is about **670k writes per second**.',
        'The store is partitioned by user and replicated across regions (the replication and consistency lessons). Last write wins is acceptable: a bookmark that is a few seconds old harms no one.',
      ],
      keyIdea: 'Position is a high-volume, low-stakes write. Choose a write-friendly store and accept last write wins.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { ...tv, chips: ['pause at 21:00'] },
          { ...phone, at: at(-2.6, 3.8), chips: [{ text: 'resume 21:00', tone: 'good' }] },
          { ...api, at: at(-1.4, -3.2), label: 'progress API', sub: 'stateless' },
          { ...meta, at: at(2.6, 0), label: 'position', sub: 'by user_id', status: 'active', load: 55 },
        ],
        links: [link('tv', 'api'), link('phone', 'api'), link('api', 'meta')],
        flows: [
          { path: ['tv', 'api', 'meta'], tone: 'request', label: 'PUT position', duration: 1.6 },
          { path: ['phone', 'api', 'meta'], tone: 'request', label: 'GET position', duration: 1.8, delay: 1.8 },
          { path: ['meta', 'api', 'phone'], tone: 'response', label: '1260 s', duration: 1.8, delay: 3.8 },
        ],
        panel: {
          title: 'Write load',
          icon: 'Database',
          rows: [
            { text: 'Streams playing', value: '200M' },
            { text: 'One write per', value: '5 min' },
            { text: 'Writes per second', value: '~670k', tone: 'warn' },
            { text: 'Conflict rule', value: 'last write wins', tone: 'good' },
          ],
          footer: { text: 'Partitioned by user_id', tone: 'muted' },
        },
        caption: 'One bookmark per user and title',
      },
    },
    {
      title: 'Recommendations',
      tag: 'concept',
      heading: 'Precompute at night, re-rank at request time',
      eli5: 'The **librarian** cannot compare every child with every book each morning. So overnight she notes each child\'s taste, and at the desk she only picks from a short pile.',
      body: [
        'Scoring 500M users against 20k titles is 10^13 pairs. So an **offline** nightly job over watch history learns user and item embeddings, stored in a key-value store.',
        'When the home screen loads, an **online** service reads the user\'s embedding plus context (device, time, last watched) and re-ranks about 1,000 candidates in under 100 ms.',
      ],
      keyIdea: 'Do the heavy learning offline and the cheap, context-aware ranking online.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { id: 'hist', kind: 'warehouse', at: at(-5, 0), label: 'watch history', sub: 'nightly input' },
          { id: 'train', kind: 'worker', at: at(-1.8, -3.2), label: 'embedding job', sub: 'Spark, nightly', status: 'active' },
          { id: 'kv', kind: 'cache', at: at(-1.8, 3.2), label: 'embeddings', sub: 'key-value store' },
          { id: 'rank', kind: 'block', size: 0.72, at: at(2.6, 0), label: 're-rank', sub: '1,000 in < 100 ms', icon: 'Star', tint: 'green' },
        ],
        links: [link('hist', 'train'), link('train', 'kv'), link('kv', 'rank')],
        flows: [
          { path: ['hist', 'train'], tone: 'data', label: 'history', duration: 1.3 },
          { path: ['train', 'kv'], tone: 'data', label: 'embeddings', duration: 1.3, delay: 1.4 },
          { path: ['kv', 'rank'], tone: 'response', label: 'user vector', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'Two systems',
          icon: 'Star',
          rows: [
            { text: 'Offline', value: 'nightly, hours', tone: 'muted' },
            { text: 'Output', value: 'user + item vectors' },
            { text: 'Online', value: 're-rank ~1,000', tone: 'good' },
            { text: 'Latency target', value: '< 100 ms', tone: 'good' },
          ],
          footer: { text: 'Home screen waits on the online part only', tone: 'muted' },
        },
        caption: 'Slow learning, fast ranking',
      },
    },
    {
      title: 'A/B tests',
      tag: 'concept',
      heading: 'Every change is an experiment',
      eli5: 'The **librarian** tries two cover pictures for the same book. Half the children see one picture, and she counts which half borrows it more.',
      body: [
        'Even poster art per user is tested. An allocation service hashes `user_id` with `test_id` into a bucket, so the same user always lands in the same group without any lookup.',
        'Allocations go to a stream, and a pipeline joins them with outcomes such as stream starts and hours viewed in an analytics cube. Product teams query that cube directly.',
      ],
      keyIdea: 'A deterministic hash assigns groups with no shared state. The stream joins assignment to outcome.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.2 s', rebuf: '< 0.5%', edge: '95%+' },
      scene: {
        nodes: [
          { ...tv, at: at(-5, 0), chips: ['poster B'] },
          { id: 'alloc', kind: 'block', size: 0.72, at: at(-1.8, -3.2), label: 'allocation', sub: 'hash to bucket', icon: 'Hash', tint: 'violet' },
          { id: 'events', kind: 'queue', at: at(-1.8, 3.2), label: 'event stream', sub: 'Kafka' },
          { id: 'cube', kind: 'warehouse', at: at(2.8, 0), label: 'results cube', sub: 'starts, hours' },
        ],
        links: [link('tv', 'alloc'), link('tv', 'events'), link('alloc', 'events', { style: 'dashed' }), link('events', 'cube')],
        flows: [
          { path: ['tv', 'alloc'], tone: 'request', label: 'user + test', duration: 1.2 },
          { path: ['alloc', 'tv'], tone: 'response', label: 'bucket B', duration: 1.2, delay: 1.3 },
          { path: ['tv', 'events', 'cube'], tone: 'event', label: 'plays, hours', duration: 1.8, delay: 2.7 },
        ],
        panel: {
          title: 'Deterministic assignment',
          icon: 'Hash',
          code: 'bucket = hash(user_id + test_id) % 100\n# 0..49 control, 50..99 variant',
          footer: { text: 'Same user, same bucket, no lookup', tone: 'good' },
        },
        caption: 'Assign by hash, measure by stream',
      },
      code: {
        language: 'python',
        title: 'Allocation without a database',
        source: `import hashlib

def bucket(user_id: str, test_id: str) -> int:
    digest = hashlib.sha256(f"{user_id}:{test_id}".encode()).digest()
    return int.from_bytes(digest[:4], "big") % 100

def variant(user_id: str, test_id: str) -> str:
    return "B" if bucket(user_id, test_id) >= 50 else "A"`,
        highlight: [4, 5, 8],
      },
    },
    {
      title: 'Dead edge',
      tag: 'case',
      heading: 'Failure: an edge server dies mid-movie',
      eli5: 'A branch library suddenly closes while a child is mid-chapter. The child already has a few chapters in the bag, and a second branch is written on the card, so reading continues.',
      body: [
        'A segment request to edge A fails. The player already holds seconds of buffer and the next entry in its server list, so it retries edge B and keeps playing. ABR may drop one rung while it recovers.',
        'The steering layer marks A unhealthy from its health reports and stops listing it. Spare capacity in the same ISP absorbs the viewers. The timeouts and retries lesson applies: short timeout, then next server.',
      ],
      keyIdea: 'A client with a buffer and a fallback list turns a server failure into a quality blip.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.2 s', rebuf: '< 0.5%', edge: '95%+' },
      metricTones: { rebuf: 'good' },
      scene: {
        nodes: [
          { ...tv, status: 'active', chips: ['buffer 24 s'] },
          { ...oca, id: 'ocaA', at: at(2.6, -3.2), label: 'edge A', sub: 'failed', status: 'down' },
          { ...oca, id: 'ocaB', at: at(5.2, 3.2), label: 'edge B', sub: 'next in list', status: 'ok', load: 55 },
        ],
        links: [link('tv', 'ocaA'), link('tv', 'ocaB')],
        flows: [
          { path: ['tv', 'ocaA'], tone: 'error', label: 'timeout', duration: 1.3 },
          { path: ['tv', 'ocaB'], tone: 'request', label: 'retry segment', duration: 1.3, delay: 1.5 },
          { path: ['ocaB', 'tv'], tone: 'data', count: 2, label: 'segment', duration: 1.4, delay: 2.9 },
        ],
        panel: {
          title: 'What the viewer sees',
          icon: 'Activity',
          rows: [
            { text: 'Buffer when A died', value: '24 s' },
            { text: 'Failover time', value: '< 2 s', tone: 'good' },
            { text: 'Stall', value: 'none', tone: 'good' },
            { text: 'Rung', value: 'one dip, then back', tone: 'warn' },
          ],
          footer: { text: 'Next server was already in the list', tone: 'good' },
        },
        caption: 'Fail over to the next server',
      },
    },
    {
      title: 'Premiere surge',
      tag: 'case',
      heading: 'Failure: everyone presses play on the new episode',
      eli5: 'A new book comes out and every child in town asks for it at once. If each branch phones the depot separately, the depot is flooded, so branches ask one at a time and share the copy.',
      body: [
        'A premiere is the hardest case, and the plan is to avoid a miss at all: the title is **pre-positioned** on every edge before launch. A fresh release is the one title the forecast is sure about.',
        'If an edge still misses, thousands of appliances would ask regional fill for the same file. **Request coalescing** sends one fill per object and makes the rest wait, and fill traffic is rate limited. This is the cache stampede fix from the caching lessons.',
      ],
      keyIdea: 'Pre-position the sure hits, then coalesce and rate limit what still misses.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.4 s', rebuf: '< 0.5%', edge: '97%' },
      metricTones: { edge: 'good' },
      scene: {
        nodes: [
          { ...oca, id: 'ocaA', at: at(-4.8, 0), label: 'edge servers', sub: 'new episode', status: 'hot', load: 90 },
          { ...fill, at: at(-0.8, -3.2), status: 'active', chips: [{ text: '1 fill per file', tone: 'good' }] },
          { ...origin, at: at(-0.8, 3.4) },
          { id: 'limit', kind: 'limiter', at: at(3.4, 0), label: 'fill limiter', sub: 'rate cap' },
        ],
        links: [link('ocaA', 'fill'), link('fill', 'origin'), link('fill', 'limit', { style: 'dashed' })],
        flows: [
          { path: ['ocaA', 'fill'], tone: 'request', count: 3, label: 'same file', duration: 1.3 },
          { path: ['fill', 'origin'], tone: 'request', label: '1 request', duration: 1.3, delay: 1.5 },
          { path: ['origin', 'fill', 'ocaA'], tone: 'data', label: 'one copy', duration: 1.8, delay: 3 },
        ],
        panel: {
          title: 'Release day',
          icon: 'TrendingUp',
          rows: [
            { text: 'Pre-positioned before launch', value: 'yes', tone: 'good' },
            { text: 'Misses per file', value: '1 fill each', tone: 'good' },
            { text: 'Fill rate', value: 'capped', tone: 'good' },
            { text: 'Edge byte share', value: '97%', tone: 'good' },
          ],
          footer: { text: 'The origin sees a trickle, not a flood', tone: 'good' },
        },
        caption: 'Many askers, one fetch',
      },
    },
    {
      title: 'Region outage',
      tag: 'case',
      heading: 'Failure: a whole cloud region goes down',
      eli5: 'The main library\'s front desk closes for the day. Children already reading in branches keep reading. New children are sent to a second front desk in another town.',
      body: [
        'Control and data planes fail separately. Streams already playing hold a manifest and fetch segments from edges, so they continue with no cloud call at all.',
        'New plays are the ones at risk. Traffic shifts to a second region (the multi-region lesson), whose metadata is already replicated. Position writes may lag slightly, which the last write wins rule tolerates.',
      ],
      keyIdea: 'Because bytes do not flow through the cloud, a cloud outage hurts new starts and leaves current viewers alone.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.8 s', rebuf: '< 0.5%', edge: '95%+' },
      metricTones: { start: 'warn', rebuf: 'good' },
      scene: {
        nodes: [
          { ...tv, chips: [{ text: 'playing, buffer 40 s', tone: 'good' }] },
          { ...api, id: 'apiA', at: at(-1.8, -3.2), label: 'region A', sub: 'outage', status: 'down' },
          { ...api, id: 'apiB', at: at(-1.8, 3.4), label: 'region B', sub: 'takes over', status: 'ok' },
          { ...oca, at: at(2.6, 0), status: 'ok' },
        ],
        links: [link('tv', 'apiA', { style: 'faint' }), link('tv', 'apiB'), link('tv', 'oca', { route: 'straight' })],
        flows: [
          { path: ['oca', 'tv'], tone: 'data', count: 3, label: 'segments continue', duration: 1.6 },
          { path: ['tv', 'apiB'], tone: 'request', label: 'new play', duration: 1.3, delay: 1.7 },
          { path: ['apiB', 'tv'], tone: 'response', label: 'manifest', duration: 1.3, delay: 3.1 },
        ],
        panel: {
          title: 'Blast radius',
          icon: 'Shield',
          rows: [
            { text: 'Playing streams', value: 'unaffected', tone: 'good' },
            { text: 'New plays', value: 'shift to region B', tone: 'warn' },
            { text: 'Start of play', value: '+0.6 s', tone: 'warn' },
            { text: 'Position writes', value: 'may lag', tone: 'muted' },
          ],
          footer: { text: 'The edge keeps serving', tone: 'good' },
        },
        caption: 'Only new starts feel the outage',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole design on one page',
      eli5: 'A **library** with a small front desk for questions, branches on every street for the books, a crew that copies every book into sizes, and a nightly truck that stocks the shelves.',
      body: [
        'A thin control plane in the cloud holds the API, catalog, DRM, history, recommendations and experiments. Titles are encoded once into a ladder of short segments, described by a manifest.',
        'Edge servers inside ISPs serve 95%+ of bytes, filled overnight from regional fill and origin. The player picks rungs, fails over and keeps playing. Start under 2 s, rebuffer under 0.5%.',
      ],
      keyIdea: 'Separate directions from bytes, move the bytes next to the viewer, and let the player adapt.',
      metrics: { streams: '200M', bw: '1 Pbps', start: '~1.2 s', rebuf: '< 0.5%', edge: '95%+' },
      metricTones: { start: 'good', rebuf: 'good', edge: 'good' },
      scene: {
        nodes: [
          { ...tv, status: 'ok' },
          { ...api, status: 'ok' },
          { ...oca, status: 'ok', chips: [{ text: '95%+ of bytes', tone: 'good' }] },
          { ...fill, at: at(5.6, -3.2) },
          { ...origin, at: at(5.6, 3.4) },
        ],
        links: [link('tv', 'api'), link('tv', 'oca', { route: 'straight' }), link('oca', 'fill', { style: 'dashed' }), link('fill', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['tv', 'api'], tone: 'request', label: 'play', duration: 1.2 },
          { path: ['api', 'tv'], tone: 'response', label: 'edge list', duration: 1.2, delay: 1.3 },
          { path: ['oca', 'tv'], tone: 'data', count: 4, label: 'segments', duration: 1.6, delay: 2.7 },
          { path: ['origin', 'fill', 'oca'], tone: 'event', label: 'overnight fill', duration: 2, delay: 0.5 },
        ],
        panel: {
          title: 'Design summary',
          icon: 'List',
          rows: [
            { text: 'Control plane', value: 'cloud, small' },
            { text: 'Data plane', value: 'ISP edge, 1 Pbps', tone: 'good' },
            { text: 'Encoding', value: 'ladder + segments' },
            { text: 'Player', value: 'ABR + failover', tone: 'good' },
            { text: 'Fill', value: 'nightly, tiered' },
          ],
          footer: { text: 'Start < 2 s, rebuffer < 0.5%', tone: 'good' },
        },
        caption: 'Directions from the cloud, bytes from the edge',
      },
      quiz: {
        question: 'A cloud region fails while millions are watching. What happens to streams already playing?',
        options: [
          'They all stop, because the API serves the video',
          'They continue, because segments come from edge servers and the player already has a manifest',
          'They switch to the origin bucket automatically',
          'They continue only if the viewer restarts the app',
        ],
        answer: 1,
        explain: 'Video bytes never flow through the control plane. Playing sessions keep fetching from the edge, and only new starts need a healthy region.',
      },
    },
  ],
};
