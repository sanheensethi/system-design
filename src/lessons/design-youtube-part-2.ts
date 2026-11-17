import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const rend: SceneNode = { id: 'rend', kind: 'storage', at: at(-4.5, 0), label: 'renditions', sub: '5 qualities' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(0, 0), label: 'CDN edge', sub: 'hot segments' };
const viewer: SceneNode = { id: 'viewer', kind: 'client', at: at(4.5, -3), label: 'viewer', sub: 'laptop, 8 Mbps' };
const rider: SceneNode = { id: 'rider', kind: 'phone', at: at(4.5, 3), label: 'phone viewer', sub: 'on a train' };
const origin: SceneNode = { id: 'origin', kind: 'server', at: at(0, 3.6), label: 'origin servers', sub: 'long-tail videos' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-4.5, 0), label: 'API servers', sub: 'stateless', icon: 'Network', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(0, -3.6), label: 'metadata DB', sub: 'SQL + replicas' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(0, 3.6), label: 'meta cache', sub: 'Redis' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(-1.7, 0), label: 'task queue', sub: 'transcode tasks' };
const workers: SceneNode = { id: 'workers', kind: 'worker', at: at(1.7, 0), label: 'encoders', sub: 'autoscaled pool' };

const metrics = [
  { key: 'plays', label: 'Peak plays', icon: 'Activity' },
  { key: 'uploads', label: 'Peak uploads', icon: 'Download' },
  { key: 'storage', label: 'New storage', icon: 'HardDrive' },
  { key: 'egress', label: 'Egress', icon: 'Signal' },
  { key: 'ready', label: 'Upload to ready', icon: 'Timer' },
];

export const designYoutubePart2: Lesson = {
  id: 'design-youtube-part-2',
  title: 'Design YouTube (part 2)',
  tagline: 'Stream 11 PB a day without going broke, keep metadata fast, survive failures and keep every video safe.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Streaming protocols, renditions and adaptive bitrate streaming',
    'What the CDN costs, and how to treat the long tail of cold videos',
    'Fast playback start and durability of uploads',
    'Metadata reads, when to shard and how to count views',
    'Pipeline failures, upload surges and component failure playbooks',
    'Keeping uploads and videos safe: sandboxing, encryption, DRM and a working takedown',
  ],
  metrics,
  steps: [
    {
      title: 'Playback problem',
      tag: 'problem',
      heading: 'The renditions are ready, now ship the bytes',
      eli5: 'The bakery now has slices in many sizes. Next problem: getting them to a whole city of hungry customers on every kind of road.',
      body: [
        'Part one ended with five renditions per video in object storage. Playback is the expensive half: 3,000 plays a second at peak, and every play is a stream of bytes.',
        'Viewers sit on 8 Mbps laptops and on 1 Mbps trains, near and far. One file from one place cannot serve them all.',
      ],
      keyIdea: 'Playback is the bandwidth problem, and it needs the right format, the right quality per viewer and a place near each viewer.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      metricTones: { egress: 'bad' },
      scene: {
        nodes: [{ ...rend, status: 'active' }, { ...viewer, chips: ['8 Mbps'] }, { ...rider, chips: [{ text: '1 Mbps', tone: 'warn' }] }],
        links: [link('rend', 'viewer'), link('rend', 'rider', { label: 'train', labelTone: 'warn' })],
        flows: [
          { path: ['rend', 'viewer'], tone: 'response', count: 3, duration: 1.6 },
          { path: ['rend', 'rider'], tone: 'error', label: 'stalls', duration: 2, delay: 0.6 },
        ],
        panel: {
          title: 'Viewers differ',
          icon: 'Users',
          rows: [
            { text: 'Laptop on wifi', value: '8 Mbps' },
            { text: 'Phone on a train', value: '1 Mbps', tone: 'bad' },
            { text: 'Old TV', value: 'few codecs', tone: 'warn' },
          ],
        },
        caption: 'Same video, very different roads',
      },
    },
    {
      title: 'Streaming protocols',
      tag: 'concept',
      heading: 'Stream small files over plain HTTP',
      eli5: 'Instead of handing over the whole cake, the delivery kid brings one slice at a time from a menu list. The list is the **manifest**.',
      body: [
        'Downloading one giant MP4 starts slowly and wastes bytes when the viewer quits. Streaming cuts each quality into 4-second segment files, and a **manifest** lists them. The two common protocols are **HLS** (`.m3u8`) and **DASH**.',
        'A **master playlist** lists the qualities, and each quality has its own playlist of segment URLs. All of it is plain HTTP files, so any web server or CDN can serve them.',
      ],
      keyIdea: 'Streaming is just small files plus a manifest, served over ordinary HTTP.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...rend, status: 'active', badge: '4 s segments' }, { id: 'manifest', kind: 'block', at: at(0, 0), label: 'manifest', sub: 'master.m3u8', icon: 'FileText', tint: 'blue', status: 'active' }, { ...viewer, chips: ['GET master.m3u8'] }],
        links: [link('rend', 'manifest'), link('manifest', 'viewer', { label: 'plain HTTP' })],
        flows: [
          { path: ['viewer', 'manifest'], tone: 'request', label: 'master.m3u8', duration: 1.2 },
          { path: ['manifest', 'viewer'], tone: 'response', label: 'quality list', duration: 1.2, delay: 1.3 },
          { path: ['rend', 'viewer'], tone: 'data', label: 'seg 1', count: 2, duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'master.m3u8',
          icon: 'FileText',
          code: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n1080p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720\n720p/index.m3u8\n# ...480p, 360p, 240p',
        },
        caption: 'A list of files, fetched like web pages',
      },
    },
    {
      title: 'Bitrate ladder',
      tag: 'concept',
      heading: 'The ladder of five qualities',
      eli5: 'Every slice comes in five sizes, from a huge one for a fast road to a tiny one for a muddy path. All five sizes are cut at the same marks.',
      body: [
        'The encoders produce a **bitrate ladder**: 1080p at 5 Mbps, 720p at 2.8, 480p at 1.4, 360p at 0.8 and 240p at 0.4.',
        'Each quality is cut into the same 4-second segments, on the same timestamps. Aligned segments are what let a player hop between qualities without a glitch.',
      ],
      keyIdea: 'Encode a ladder of qualities cut into aligned segments, so any segment can be swapped for another quality.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...rend, at: at(-4.5, 0), status: 'active', badge: '5 qualities' }, { id: 'hd', kind: 'block', size: 0.8, at: at(0, -3.6), label: '1080p, 720p', sub: '5.0 and 2.8 Mbps', icon: 'Binary', tint: 'green' }, { id: 'sd', kind: 'block', size: 0.8, at: at(0, 3.6), label: '480p, 360p, 240p', sub: '1.4, 0.8, 0.4 Mbps', icon: 'Binary', tint: 'amber' }],
        links: [link('rend', 'hd'), link('rend', 'sd')],
        flows: [
          { path: ['rend', 'hd'], tone: 'data', count: 2, duration: 1.2 },
          { path: ['rend', 'sd'], tone: 'data', count: 3, duration: 1.2, delay: 0.3 },
        ],
        panel: {
          title: 'Bitrate ladder',
          icon: 'Table',
          rows: [
            { text: '1080p', value: '5.0 Mbps' },
            { text: '720p', value: '2.8 Mbps' },
            { text: '480p', value: '1.4 Mbps' },
            { text: '360p', value: '0.8 Mbps' },
            { text: '240p', value: '0.4 Mbps' },
          ],
        },
        caption: 'Same segment numbers at every quality',
      },
    },
    {
      title: 'Adaptive bitrate',
      tag: 'concept',
      heading: 'The player picks a quality every 4 seconds',
      eli5: 'When the road is clear the delivery kid brings big slices. In a traffic jam he brings small ones, so the customer never waits. That switching is **adaptive bitrate**.',
      body: [
        'The player measures how fast the last segments arrived and how much video it has buffered, then picks the quality for the **next** segment. The laptop on 8 Mbps climbs to 1080p.',
        'The train rider drops to 360p in the tunnel and climbs back after it, with no stall and no restart, because segments of every quality line up on the same timestamps.',
      ],
      keyIdea: 'The player picks a quality per segment from measured bandwidth and buffer.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...rend, status: 'active' }, { ...cdn, status: 'active' }, { ...viewer, status: 'ok', chips: [{ text: 'seg 12 @ 1080p', tone: 'good' }] }, { ...rider, status: 'ok', chips: [{ text: 'seg 12 @ 360p', tone: 'warn' }] }],
        links: [link('rend', 'cdn'), link('cdn', 'viewer', { label: '8 Mbps' }), link('cdn', 'rider', { label: 'tunnel · 1 Mbps', labelTone: 'warn' })],
        flows: [
          { path: ['viewer', 'cdn'], tone: 'request', label: 'seg 12 @ 1080p', duration: 1 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, duration: 1, delay: 1.1 },
          { path: ['rider', 'cdn'], tone: 'request', label: 'seg 12 @ 360p', duration: 1, delay: 0.5 },
          { path: ['cdn', 'rider'], tone: 'response', count: 2, duration: 1, delay: 1.6 },
        ],
        panel: {
          title: 'Player decision',
          icon: 'Gauge',
          rows: [
            { text: 'Measured speed', value: 'last 3 segments' },
            { text: 'Buffer', value: 'seconds ahead' },
            { text: 'Next quality', value: 'highest that fits', tone: 'good' },
          ],
        },
        caption: 'Same segment numbers, different qualities per viewer',
      },
      quiz: {
        question: 'Halfway through a video, a viewer’s bandwidth drops from 8 Mbps to 1 Mbps. What does an adaptive bitrate player do?',
        options: [
          'Restarts the video at a lower quality',
          'Keeps fetching 1080p and waits for the buffer to refill',
          'Requests the next segments from a lower rendition listed in the manifest',
          'Asks the server to re-encode the video at 1 Mbps',
        ],
        answer: 2,
        explain: 'Every rendition is cut into segments on the same timestamps, so the player switches to a smaller rendition at the next segment boundary. Nothing is re-encoded and playback does not restart.',
      },
    },
    {
      title: 'Fast start',
      tag: 'concept',
      heading: 'Playback starts in under 2 seconds',
      eli5: 'The delivery kid hands over a small first slice right away, then brings bigger ones. The customer starts eating at once.',
      body: [
        'The player fetches the small master playlist from the edge, then starts at a **low rung** such as 360p. Its first 4-second segment is only about 400 KB, so it arrives in well under a second.',
        'The player climbs the ladder once its buffer fills. Startup stays cheap because the manifest and first segments are cached at the edge, and the watch API call is a cache hit.',
      ],
      keyIdea: 'Start small and cached, then climb: a low first rung and edge-cached manifests keep playback start under 2 seconds.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...cdn, status: 'ok', badge: 'manifest cached' }, { ...viewer, chips: [{ text: 'start at 360p', tone: 'good' }] }, { id: 'manifest', kind: 'block', at: at(-4.5, 0), label: 'master.m3u8', sub: 'edge copy', icon: 'FileText', tint: 'blue' }],
        links: [link('manifest', 'cdn'), link('cdn', 'viewer', { label: '~0.8 s to first frame', labelTone: 'good' })],
        flows: [
          { path: ['viewer', 'cdn'], tone: 'request', label: 'master.m3u8', duration: 1 },
          { path: ['cdn', 'viewer'], tone: 'response', label: '360p seg 1', count: 2, duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Startup budget',
          icon: 'Timer',
          rows: [
            { text: 'Watch API (cache hit)', value: '~50 ms' },
            { text: 'Master playlist from edge', value: '~50 ms' },
            { text: 'First 360p segment, 400 KB', value: '~0.4 s' },
            { text: 'Total to first frame', value: '< 1 s', tone: 'good' },
          ],
        },
        caption: 'Start low, climb once the buffer fills',
      },
    },
    {
      title: 'Egress saving',
      tag: 'concept',
      heading: 'Streaming halves the bytes out',
      eli5: 'A customer who leaves after one bite got one slice, not the whole cake. Customers with small plates get small slices.',
      body: [
        'A viewer who quits early fetches only part of the video, and phones fetch small renditions. Say the average play watches 60% of a 5-minute video (180 s) at an average 4 Mbps: 720 Mb, about **90 MB**, against 190 MB for the whole file.',
        'That cuts egress to 120 million x 90 MB, about **11 PB a day**. It is still the biggest bill in the system.',
      ],
      keyIdea: 'Segment-by-segment streaming sends only the bytes a viewer actually watches, at a size that fits their device.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '11 PB/day', ready: '2 min' },
      metricTones: { egress: 'warn' },
      scene: {
        nodes: [{ ...cdn, at: at(-4.5, 0) }, { ...viewer, at: at(0, -3), badge: 'quits at 1 min' }, { ...rider, at: at(0, 3), badge: '360p' }],
        links: [link('cdn', 'viewer'), link('cdn', 'rider')],
        flows: [
          { path: ['cdn', 'viewer'], tone: 'response', label: '1 min only', count: 2, duration: 1.4 },
          { path: ['cdn', 'rider'], tone: 'response', label: 'small files', count: 2, duration: 1.4, delay: 0.5 },
        ],
        panel: {
          title: 'Bytes per play',
          icon: 'Download',
          rows: [
            { text: 'One MP4 file', value: '190 MB', tone: 'bad' },
            { text: 'Watched: 180 s x 4 Mbps', value: '90 MB', tone: 'good' },
            { text: 'Egress per day', value: '23 PB to 11 PB' },
          ],
        },
        caption: 'Half the bytes, same videos',
      },
    },
    {
      title: 'CDN',
      tag: 'concept',
      heading: 'Fix 4: serve segments from a CDN',
      eli5: 'Corner shops near every street keep the popular slices on the shelf. Customers walk two minutes instead of crossing the city. The corner shops are the **CDN**.',
      body: [
        'Playback goes through a **CDN**. Segments never change, so they cache perfectly: a long TTL and versioned URLs, with no purges in normal traffic. Takedowns are the one exception, covered later.',
        'A popular video is fetched from storage once per edge, then served from a few kilometers away to millions of viewers.',
      ],
      keyIdea: 'Immutable segments cache perfectly, so the CDN serves most bytes from near the viewer.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...rend, status: 'active' }, { ...cdn, status: 'ok', badge: 'hit 97%' }, { ...viewer, status: 'ok', badge: 'nearby edge' }],
        links: [link('rend', 'cdn', { label: 'once per edge' }), link('cdn', 'viewer', { label: 'few km', labelTone: 'good' })],
        flows: [
          { path: ['rend', 'cdn'], tone: 'data', label: 'first miss', duration: 1.4 },
          { path: ['cdn', 'viewer'], tone: 'response', label: 'edge hit', count: 4, duration: 1, delay: 1.6 },
        ],
        panel: {
          title: 'Cache rules',
          icon: 'Globe',
          rows: [
            { text: 'Segment URLs', value: 'versioned' },
            { text: 'TTL', value: 'very long' },
            { text: 'Purges', value: 'none normally, one for takedowns', tone: 'good' },
          ],
        },
        caption: 'One fetch from storage, millions of plays from the edge',
      },
    },
    {
      title: 'CDN cost',
      tag: 'tradeoff',
      heading: 'The CDN bill gets attention',
      eli5: 'Corner shops are rented by the shelf. A shelf stocked with slices nobody buys still costs rent.',
      body: [
        'At an assumed 1 cent per GB, 11 PB a day is about **$110,000 a day**. Cutting even 10% of bytes saves real money.',
        'Edge space is also limited. A cold video that is a miss at every edge takes room from hot ones.',
      ],
      keyIdea: 'CDN egress is the largest cost, so every saved byte and every wasted edge slot matters.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '11 PB/day', ready: '2 min' },
      metricTones: { egress: 'bad' },
      scene: {
        nodes: [{ ...cdn, at: at(-4.5, 0), status: 'hot', load: 88 }, { id: 'bill', kind: 'block', at: at(0, 0), label: 'monthly bill', sub: '$110K per day', icon: 'Receipt', tint: 'red', status: 'hot' }, { ...viewer, at: at(4.5, 0), badge: '120M plays/day' }],
        links: [link('viewer', 'cdn', { arrow: 'none', style: 'dashed' }), link('cdn', 'bill')],
        flows: [{ path: ['cdn', 'viewer'], tone: 'response', count: 4, duration: 1.4 }, { path: ['cdn', 'bill'], tone: 'error', label: '1 cent per GB', duration: 1.4, delay: 1.4 }],
        panel: {
          title: 'Egress cost',
          icon: 'Receipt',
          rows: [
            { text: '11 PB = 11,000,000 GB', value: '' },
            { text: 'At 1 cent per GB', value: '$110,000/day', tone: 'bad' },
          ],
          footer: { text: 'Assumed price, real contracts vary', tone: 'muted' },
        },
        caption: 'Bytes out set the bill',
      },
    },
    {
      title: 'Long tail',
      tag: 'concept',
      heading: 'A few videos get most of the plays',
      eli5: 'A few cakes sell all day and most cakes sell once a month. Stocking every shelf with every cake wastes shelf space.',
      body: [
        'Views are heavily skewed, a long-tail pattern. A small share of videos gets most of the plays, and most videos are watched a handful of times.',
        'A cold video is a cache miss at every edge, takes edge space from hot ones, and still pays for five renditions forever. Treat the tail differently from the head.',
      ],
      keyIdea: 'Popularity decides where a video lives, so measure it before optimizing.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ id: 'hot', kind: 'block', at: at(-4.5, 0), label: 'hot videos', sub: 'few, most plays', icon: 'TrendingUp', tint: 'red', status: 'hot' }, { id: 'cold', kind: 'block', at: at(0, 0), label: 'cold videos', sub: 'most, few plays', icon: 'Clock', tint: 'gray' }, { ...cdn, at: at(4.5, 0), label: 'CDN edge', sub: 'limited space' }],
        links: [link('hot', 'cdn', { label: 'worth caching', labelTone: 'good' }), link('cold', 'cdn', { label: 'wasted slot', labelTone: 'warn', style: 'dashed' })],
        flows: [{ path: ['hot', 'cdn'], tone: 'response', count: 5, duration: 1.2 }, { path: ['cold', 'cdn'], tone: 'response', duration: 1.6, delay: 1 }],
        panel: {
          title: 'Skewed views',
          icon: 'Scale',
          rows: [
            { text: 'Small share of videos', value: 'most plays' },
            { text: 'Most videos', value: 'few plays', tone: 'warn' },
            { text: 'Cold video at the edge', value: 'miss + waste', tone: 'bad' },
          ],
        },
        caption: 'The head earns the edge, the tail does not',
      },
    },
    {
      title: 'Tail tactics',
      tag: 'tradeoff',
      heading: 'Cheaper paths for the long tail',
      eli5: 'Rare cakes stay in the central kitchen in one or two sizes, baked fresh when someone asks. Only the popular ones get all five sizes at every corner shop.',
      body: [
        'Encode new uploads to two or three qualities and add the full ladder once views pass a threshold. Serve long-tail segments from your own **origin servers**, push regional hits only to that region, and archive originals nobody has watched in a year.',
        'Short, rarely watched videos can be encoded **on demand**. A cold video that goes viral needs its missing qualities fast, so that path must be quick and the pool ready.',
      ],
      keyIdea: 'Hot videos live at the edge in every quality, and cold ones live in fewer qualities on cheaper storage and servers.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      metricTones: { storage: 'good' },
      scene: {
        nodes: [{ ...rend, status: 'active' }, { ...origin, at: at(0, 4.8), status: 'active', badge: 'tail: 2 qualities', chips: ['encodes on demand'] }, { ...cdn, at: at(0, -4.8), status: 'ok', badge: 'hit 97%' }, { ...rider, at: at(4.5, 3.6), badge: 'cold video' }, { ...viewer, at: at(4.5, -3.6), badge: 'viral video' }],
        links: [link('rend', 'cdn'), link('rend', 'origin'), link('origin', 'rider', { style: 'dashed' }), link('cdn', 'viewer')],
        flows: [
          { path: ['cdn', 'viewer'], tone: 'response', label: 'edge hit', count: 4, duration: 1 },
          { path: ['rend', 'origin'], tone: 'data', label: 'missing 1080p', duration: 1.2, delay: 1 },
          { path: ['origin', 'rider'], tone: 'response', label: 'from origin', duration: 1.6, delay: 2.3 },
        ],
        panel: {
          title: 'Tail rules',
          icon: 'List',
          rows: [
            { text: 'New upload', value: '2 to 3 qualities' },
            { text: 'Views past threshold', value: 'add full ladder' },
            { text: 'Long-tail segments', value: 'origin servers' },
            { text: 'Regional hits', value: 'that region only' },
            { text: 'Unwatched for a year', value: 'archive class' },
            { text: 'Short cold video', value: 'encode on demand' },
          ],
          footer: { text: 'Storage: 77 to 55 TB a day', tone: 'good' },
        },
        caption: 'Hot segments at the edge, the long tail from origin',
      },
    },
    {
      title: 'Own CDN',
      tag: 'tradeoff',
      heading: 'Partnering with ISPs',
      eli5: 'A huge bakery chain can put its own shelves inside the neighborhood grocery stores. That is costly to build, but the slices travel almost no distance.',
      body: [
        'The biggest streaming companies build their own CDN and place servers inside internet provider networks. Bandwidth charges fall and viewers get shorter paths. It is a giant project, so it only pays off at huge scale.',
        'Inside the provider, a cache serves each viewer one hop from home, and it fills from your storage once for the whole neighborhood.',
      ],
      keyIdea: 'At very large scale, servers inside ISP networks cut cost and distance.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...rend, status: 'active' }, { id: 'isp', kind: 'cdn', at: at(0, 0), label: 'ISP cache', sub: 'inside the provider', status: 'ok' }, { ...viewer, status: 'ok', badge: 'one hop away' }],
        links: [link('rend', 'isp'), link('isp', 'viewer')],
        flows: [
          { path: ['rend', 'isp'], tone: 'data', duration: 1.6 },
          { path: ['isp', 'viewer'], tone: 'response', count: 4, duration: 1, delay: 1.7 },
        ],
        panel: {
          title: 'Build your own CDN?',
          icon: 'Scale',
          rows: [
            { text: 'Bandwidth charges', value: 'lower', tone: 'good' },
            { text: 'Viewer path', value: 'shorter', tone: 'good' },
            { text: 'Effort', value: 'giant project', tone: 'bad' },
          ],
        },
        caption: 'Only worth it at huge scale',
      },
    },
    {
      title: 'Metadata reads',
      tag: 'concept',
      heading: 'Fix 5: replicas and a cache for metadata',
      eli5: 'The order book is copied for the clerks who only read it, and the most asked-about pages are pinned to the wall. The wall is the **cache**.',
      body: [
        'Each watch page, feed tile and search result reads metadata, so 3,000 plays a second becomes about **30,000 metadata reads** a second. Writes are rare: new videos, status changes, edits.',
        'Put **read replicas** behind the primary and a **cache** in front, keyed by `video_id`. At a 98% hit rate the database sees about 600 reads a second.',
      ],
      keyIdea: 'Metadata is small and read-heavy, so replicas and a cache absorb the reads.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...viewer, at: at(-4.5, 0), chips: ['GET /videos/42'] }, { ...api, at: at(-1.5, 0), status: 'active' }, { ...cache, at: at(1.5, 3.6), status: 'ok', badge: 'hit 98%' }, { ...db, at: at(4.5, -3.6), badge: '600 reads/s' }, { id: 'replica', kind: 'replica', at: at(4.5, 3.6), label: 'read replicas', sub: 'x 3' }],
        links: [link('viewer', 'api'), link('api', 'cache'), link('api', 'db', { style: 'dashed' }), link('db', 'replica', { style: 'dashed' })],
        flows: [
          { path: ['viewer', 'api'], tone: 'request', label: 'GET /videos/42', duration: 1.2 },
          { path: ['api', 'cache'], tone: 'request', duration: 0.8, delay: 1.3 },
          { path: ['cache', 'api'], tone: 'response', label: 'hit', duration: 0.8, delay: 2.2 },
          { path: ['db', 'replica'], tone: 'data', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Read load',
          icon: 'Gauge',
          rows: [
            { text: '3,000 plays/s', value: '30,000 reads/s' },
            { text: 'Cache hit rate', value: '98%', tone: 'good' },
            { text: 'Reaches the database', value: '~600/s', tone: 'good' },
          ],
        },
        caption: 'The cache answers almost every read',
      },
    },
    {
      title: 'Sharding',
      tag: 'tradeoff',
      heading: 'Sharding is the next move, not the first',
      eli5: 'One order book holds many years of orders. Only when it is too heavy to carry does the shop split it into several books, and then newest orders are spread across books.',
      body: [
        '100,000 uploads a day is about **36 million `videos` rows a year**, and about 180 million `renditions` rows. That is tens of GB, and one primary plus replicas holds it for years. Shard when write or storage limits arrive, or when the scale assumption rises.',
        'The catch: hashing `video_id` scatters rows that time-ordered ids kept together, so a "newest videos" scan hits every shard. Shard the by-owner table by `owner_id` so a channel page stays on one shard.',
      ],
      keyIdea: 'Do the row arithmetic first: one primary plus replicas covers this scale, and sharding is the next move with a real cost in locality.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...api, at: at(-4.5, 0) }, { ...db, at: at(0, -3.6), status: 'active', badge: '36M rows/year' }, { id: 'replica', kind: 'replica', at: at(0, 3.6), label: 'read replicas', sub: 'x 3' }, { id: 's1', kind: 'shard', at: at(4.5, -3.6), label: 'shard 1', sub: 'later', status: 'dim' }, { id: 's2', kind: 'shard', at: at(4.5, 3.6), label: 'shard 2', sub: 'later', status: 'dim' }],
        links: [link('api', 'db'), link('db', 'replica', { style: 'dashed' }), link('db', 's1', { style: 'dashed', label: 'when limits hit' }), link('db', 's2', { style: 'dashed' })],
        flows: [
          { path: ['api', 'db'], tone: 'request', duration: 1.2 },
          { path: ['db', 'replica'], tone: 'data', duration: 1, delay: 1.3 },
        ],
        panel: {
          title: 'Do the arithmetic',
          icon: 'Calculator',
          rows: [
            { text: 'videos rows per year', value: '~36M' },
            { text: 'renditions rows per year', value: '~180M' },
            { text: 'Table size', value: 'tens of GB', tone: 'good' },
            { text: 'Enough for years', value: 'primary + replicas', tone: 'good' },
            { text: 'Hashing video_id', value: 'loses time locality', tone: 'warn' },
          ],
        },
        caption: 'One primary first, shards when limits arrive',
      },
    },
    {
      title: 'View counts',
      tag: 'concept',
      heading: 'Count views in a stream, write totals in batches',
      eli5: 'Instead of crossing out a number on the order book every time someone looks at a cake, the shop collects tally marks and writes the total every few seconds.',
      body: [
        'Updating a counter row on every play means 3,000 writes a second, and a viral video makes one row take most of them. So the player sends a small **beacon** to a stream when playback starts and every 30 seconds.',
        'An aggregator sums views per video and writes the totals to the database every 5 seconds. The database sees one write per active video per interval.',
      ],
      keyIdea: 'Hot counters go through a stream and a batching aggregator, so the database never sees one write per view.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...viewer, at: at(-5, 0), chips: ['beacon every 30 s'] }, { id: 'stream', kind: 'queue', at: at(-1.7, 0), label: 'view stream', sub: 'beacons', status: 'active' }, { id: 'agg', kind: 'block', at: at(1.7, 0), label: 'aggregator', sub: 'sums per video', icon: 'Hash', tint: 'amber' }, { ...db, at: at(5, 0), badge: 'total every 5 s' }],
        links: [link('viewer', 'stream'), link('stream', 'agg'), link('agg', 'db')],
        flows: [
          { path: ['viewer', 'stream'], tone: 'event', label: 'view', count: 4, duration: 1.2 },
          { path: ['stream', 'agg'], tone: 'event', count: 3, duration: 1, delay: 1.3 },
          { path: ['agg', 'db'], tone: 'data', label: 'total', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'View counting',
          icon: 'Hash',
          rows: [
            { text: 'Player beacon', value: 'start + every 30 s' },
            { text: 'Stream', value: 'absorbs 3,000/s' },
            { text: 'Aggregator', value: 'sum per video' },
            { text: 'Database write', value: 'every 5 s', tone: 'good' },
          ],
        },
        caption: 'Many views in, few writes out',
      },
    },
    {
      title: 'Completion event',
      tag: 'concept',
      heading: 'The pipeline reports back by event',
      eli5: 'When the kitchen finishes a cake, a bell rings on the front desk. The clerk changes the sticker to ready and crosses the old shelf label off the wall.',
      body: [
        'When `publish` finishes, a **completion event** goes onto a queue. A **completion handler** updates the row to `ready`, writes the rendition list and deletes the cache key.',
        'The watch page then shows the video, and a notification tells the creator.',
      ],
      keyIdea: 'Status changes arrive as events from the pipeline, and the handler invalidates the cache.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...workers, at: at(-4.5, 0), status: 'ok' }, { ...queue, at: at(-1.5, 0), label: 'completion queue', sub: 'done events' }, { id: 'handler', kind: 'block', at: at(1.5, -3.6), label: 'completion handler', sub: 'sets ready', icon: 'Zap', tint: 'green', status: 'active' }, { ...db, at: at(4.5, 0), badge: 'status=ready' }, { ...cache, at: at(1.5, 3.6), badge: 'key deleted' }],
        links: [link('workers', 'queue'), link('queue', 'handler', { style: 'dashed' }), link('handler', 'db'), link('handler', 'cache', { style: 'dashed' })],
        flows: [
          { path: ['workers', 'queue', 'handler'], tone: 'event', label: 'video ready', duration: 2 },
          { path: ['handler', 'db'], tone: 'request', label: 'status=ready', duration: 1, delay: 2.1 },
          { path: ['handler', 'cache'], tone: 'request', label: 'delete key', duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'Handler does three things',
          icon: 'List',
          rows: [
            { text: 'Set status', value: 'ready' },
            { text: 'Write renditions', value: 'rows' },
            { text: 'Delete cache key', value: 'fresh reads' },
          ],
        },
        caption: 'The queue decouples the pipeline from the database',
      },
    },
    {
      title: 'Durability',
      tag: 'concept',
      heading: 'Nothing a creator uploads is ever lost',
      eli5: 'The original cake is stored in a vault with copies in other buildings. It is only moved to the cellar once every size of slice is safely on the shelves.',
      body: [
        'The raw bucket is **replicated** across zones or regions, so one lost disk or data center loses nothing. The raw file is kept until the pipeline succeeds and `status=ready` is set.',
        'After that the original moves to an archive storage class instead of being deleted. A failed or retried pipeline can always start again from the raw file.',
      ],
      keyIdea: 'Replicate the raw bucket and keep the original until the video is ready, then archive it.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [{ ...rend, id: 'raw', at: at(-4.5, 0), label: 'raw bucket', sub: 'replicated', status: 'ok', badge: '3 copies' }, { ...db, at: at(0, -3.6), badge: 'status=ready' }, { id: 'archive', kind: 'storage', at: at(4.5, 0), label: 'archive', sub: 'cold class' }],
        links: [link('raw', 'db', { style: 'dashed', label: 'kept until ready' }), link('raw', 'archive', { label: 'then archived' })],
        flows: [
          { path: ['db', 'raw'], tone: 'event', label: 'ready', duration: 1.2 },
          { path: ['raw', 'archive'], tone: 'data', label: 'original', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Lifecycle of the original',
          icon: 'Shield',
          rows: [
            { text: 'Upload lands', value: 'replicated copies' },
            { text: 'Pipeline running', value: 'raw kept', tone: 'good' },
            { text: 'status=ready', value: 'move to archive' },
            { text: 'Pipeline failed', value: 'retry from raw', tone: 'warn' },
          ],
        },
        caption: 'The original outlives the pipeline',
      },
    },
    {
      title: 'Task failures',
      tag: 'case',
      heading: 'Case: a worker dies mid-task',
      eli5: 'Each cook signs out one slice for ten minutes. That sign-out is a **lease**: if the cook faints, the slice goes back on the pile for another cook.',
      body: [
        '**Recoverable** errors: a worker dies or a segment encode times out. Each task is taken with a **lease**. If the worker stops heartbeating, the lease expires and the task returns to the queue for another worker.',
        'Outputs are written to fixed keys like `720p/seg_0042.ts`, so a rerun overwrites instead of duplicating. After three failed tries the task goes to a **dead-letter queue**, the video is set to `status=failed` and an alert pages a human.',
      ],
      keyIdea: 'Retry recoverable failures per task with leases and idempotent outputs, and park poison tasks.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '3 min' },
      scene: {
        nodes: [{ ...queue, at: at(-4.5, 0), status: 'active' }, { ...workers, at: at(0, -1), status: 'down', badge: '1 node down' }, { id: 'dlq', kind: 'queue', at: at(0, 4.8), label: 'dead letters', sub: 'after 3 tries' }, { id: 'out', kind: 'storage', at: at(4.5, 0), label: 'segments', sub: '720p/seg_0042.ts' }],
        links: [link('queue', 'workers'), link('workers', 'out'), link('queue', 'dlq', { style: 'dashed' })],
        flows: [
          { path: ['queue', 'workers'], tone: 'request', label: 'task 42', duration: 1 },
          { path: ['workers', 'queue'], tone: 'error', label: 'lease expired, requeue', duration: 1.4, delay: 1.2 },
          { path: ['queue', 'workers'], tone: 'request', label: 'retry', duration: 1, delay: 2.8 },
          { path: ['queue', 'dlq'], tone: 'error', label: 'poison task', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Recoverable failure',
          icon: 'Repeat',
          rows: [
            { text: 'Heartbeat stops', value: 'lease expires' },
            { text: 'Task back on queue', value: 'other worker', tone: 'good' },
            { text: 'Output key', value: 'fixed, overwrite' },
            { text: 'After 3 failures', value: 'dead letters', tone: 'warn' },
          ],
        },
        caption: 'Only the one task reruns',
      },
    },
    {
      title: 'Bad files',
      tag: 'case',
      heading: 'Case: a corrupt file',
      eli5: 'A rotten cake goes straight back to its baker with a note. The bell on the front desk rings, and the clerk puts a failed sticker on the box.',
      body: [
        '**Non-recoverable**: the file is corrupt or not a video. Inspect catches it in seconds and stops the graph. Retrying a broken file only burns CPU.',
        'It reports through the same path as success: a failed event goes onto the **completion queue**. The handler sets `status=failed`, stores the reason and tells the creator why.',
      ],
      keyIdea: 'Fail fast on bad input, and report the failure through the same event path as success.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '3 min' },
      scene: {
        nodes: [{ id: 'insp', kind: 'block', at: at(-5.5, 0), label: 'inspect', sub: 'is it a video?', icon: 'Search', tint: 'blue', status: 'active' }, { ...queue, at: at(-1.5, 0), label: 'completion queue', sub: 'done events' }, { id: 'handler', kind: 'block', at: at(1.5, -3.6), label: 'completion handler', sub: 'sets status', icon: 'Zap', tint: 'green' }, { ...db, at: at(4.5, 0), status: 'down', badge: 'status=failed' }, { id: 'note', kind: 'block', size: 0.8, at: at(1.5, 3.6), label: 'notify creator', sub: 'reason shown', icon: 'Mail', tint: 'amber' }],
        links: [link('insp', 'queue'), link('queue', 'handler', { style: 'dashed' }), link('handler', 'db'), link('handler', 'note', { style: 'dashed' })],
        flows: [
          { path: ['insp', 'queue', 'handler'], tone: 'error', label: 'corrupt file', duration: 2 },
          { path: ['handler', 'db'], tone: 'request', label: 'failed', duration: 1, delay: 2.1 },
          { path: ['handler', 'note'], tone: 'event', label: 'why', duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'Corrupt file',
          icon: 'List',
          rows: [
            { text: 'Inspect', value: 'fails in seconds', tone: 'bad' },
            { text: 'Event', value: 'completion queue' },
            { text: 'Handler', value: 'status=failed' },
            { text: 'Creator', value: 'told why', tone: 'good' },
          ],
        },
        caption: 'Bad input stops early and reports by event',
      },
    },
    {
      title: 'Failure playbook',
      tag: 'case',
      heading: 'Case: the cache dies, and other playbooks',
      eli5: 'If the wall of pinned pages falls down, a hundred clerks all run to the one order book at once. The shop sends one runner per page, limits the crowd and keeps a spare wall ready.',
      body: [
        'If the cache dies, 30,000 reads a second land on 3 replicas, with a **thundering herd** on hot keys. Defend with **request coalescing** (one database read per key, others wait), rate limiting, and a warm standby cache that takes over.',
        'Other parts have plans too: an upload error retries the part, and a lost scheduler restarts from stored state. A dead-lettered task ends as `status=failed` with an alert.',
      ],
      keyIdea: 'Every component gets a written plan, and a cache failure must not become a database outage.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '3 min' },
      scene: {
        nodes: [{ ...api, at: at(-4.5, 0) }, { ...cache, at: at(0, -3.6), status: 'down', badge: 'cache down' }, { id: 'standby', kind: 'cache', at: at(0, 3.6), label: 'warm standby', sub: 'takes over', status: 'ok' }, { id: 'replica', kind: 'replica', at: at(4.5, 0), label: 'read replicas', sub: 'x 3', status: 'hot', load: 80, chips: [{ text: 'one read per key', tone: 'good' }] }],
        links: [link('api', 'cache', { style: 'dashed' }), link('api', 'standby'), link('api', 'replica', { label: 'coalesced', labelTone: 'good' })],
        flows: [
          { path: ['api', 'cache'], tone: 'error', label: 'no answer', duration: 1.2 },
          { path: ['api', 'standby'], tone: 'request', label: 'fail over', duration: 1.2, delay: 1.3 },
          { path: ['api', 'replica'], tone: 'request', label: '1 read per key', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Playbook',
          icon: 'List',
          rows: [
            { text: 'Cache down', value: '30,000 reads/s at replicas', tone: 'bad' },
            { text: 'Request coalescing', value: 'one read per key', tone: 'good' },
            { text: 'Rate limit + warm standby', value: 'shed load, fail over' },
            { text: 'Upload error', value: 'retry the part' },
            { text: 'Scheduler lost', value: 'restart from state' },
            { text: 'Dead-lettered task', value: 'failed + alert', tone: 'warn' },
          ],
        },
        caption: 'Protect the database when the cache fails',
      },
    },
    {
      title: 'Upload surge',
      tag: 'case',
      heading: 'Case: a 10x upload surge',
      eli5: 'After a big parade everyone brings cakes at once. The line at the back door grows, but nobody is turned away. More cooks arrive when the line gets long, and short orders go first.',
      body: [
        'A big live event ends and uploads jump from 3 to **30 a second**. That needs about 340,000 cores, far above the 13,000-core floor, so the queue climbs and time to ready reaches 35 minutes. Nothing is lost, since the queue absorbs the burst.',
        'The pool autoscales on queue depth up from that floor, and a priority queue runs short videos and big channels first. Within half an hour ready time is back to 3 minutes.',
      ],
      keyIdea: 'Let the queue absorb the surge, and scale workers on its depth.',
      metrics: { plays: '3,000/s', uploads: '30/s', storage: '55 TB/day', egress: '11 PB/day', ready: '35 min' },
      metricTones: { uploads: 'warn', ready: 'bad' },
      scene: {
        nodes: [{ id: 'creators', kind: 'phone', at: at(-4.5, 0), label: 'creators', sub: 'event ended', badge: '10x uploads' }, { ...queue, at: at(-1.5, 0), status: 'hot', badge: 'depth: millions' }, { ...workers, at: at(1.5, 0), status: 'hot', load: 95, badge: 'floor 13,000 cores' }, { ...rend, at: at(4.5, 0), label: 'renditions', sub: 'ready in 35 min' }],
        links: [link('creators', 'queue'), link('queue', 'workers'), link('workers', 'rend')],
        flows: [
          { path: ['creators', 'queue'], tone: 'event', count: 6, duration: 1 },
          { path: ['queue', 'workers'], tone: 'request', count: 3, duration: 1, delay: 1.1 },
          { path: ['workers', 'rend'], tone: 'data', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Surge response',
          icon: 'TrendingUp',
          rows: [
            { text: 'Uploads', value: '3/s to 30/s', tone: 'warn' },
            { text: 'Needed at 30/s', value: '~340,000 cores', tone: 'bad' },
            { text: 'Autoscale on depth', value: 'from 13,000 up' },
            { text: 'Priority queue', value: 'short + big channels first' },
            { text: 'Ready time', value: '35 min to 3 min', tone: 'good' },
          ],
        },
        caption: 'The queue absorbs the burst, workers catch up',
      },
    },
    {
      title: 'Safe uploads',
      tag: 'tradeoff',
      heading: 'Uploads are hostile input',
      eli5: 'The bakery checks every cake before selling it, and does the checking in a locked side room so a booby-trapped cake cannot hurt the shop.',
      body: [
        'Pre-signed URLs are scoped to one key and expire fast, but they cannot cap total size. The API limits the part count and part size when it issues URLs, and checks the object size at complete, deleting oversized uploads. Inspect and encode run in sandboxed workers with no network access beyond storage.',
        'The same pass checks known banned content by hash and runs classifiers. A video can go to `blocked` before it is ever `ready`, and user flags trigger the same path later.',
      ],
      keyIdea: 'Treat every upload as untrusted, bound its size at the API, and sandbox the code that parses it.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '3 min' },
      scene: {
        nodes: [{ id: 'creator', kind: 'phone', at: at(-4.5, 0), label: 'creator', sub: 'untrusted' }, { id: 'raw', kind: 'storage', at: at(-1.5, 0), label: 'raw bucket', sub: 'signed PUT only' }, { ...workers, at: at(1.5, 0), label: 'sandboxed workers', sub: 'no network', status: 'active', badge: 'scan + mark' }, { ...db, at: at(4.5, 0), badge: 'blocked' }],
        links: [link('creator', 'raw', { label: 'URL expires 1 h' }), link('raw', 'workers'), link('workers', 'db')],
        flows: [
          { path: ['creator', 'raw'], tone: 'data', label: 'signed PUT', duration: 1.2 },
          { path: ['raw', 'workers'], tone: 'request', label: 'scan', duration: 1, delay: 1.3 },
          { path: ['workers', 'db'], tone: 'error', label: 'banned hash', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Checks on the way in',
          icon: 'Shield',
          rows: [
            { text: 'Signed URL', value: 'one key, 1 h' },
            { text: 'Size cap', value: 'parts at issue, total at complete' },
            { text: 'Parser', value: 'sandboxed' },
            { text: 'Banned content, classifiers', value: 'hash + flag' },
            { text: 'Match found', value: 'status=blocked', tone: 'warn' },
          ],
        },
        caption: 'Scan on the way in, block before ready',
      },
    },
    {
      title: 'Takedown',
      tag: 'case',
      heading: 'Case: taking a video down for real',
      eli5: 'Crossing a cake off the menu is not enough while corner shops still hold slices. The shop also asks each corner shop to throw out its copies, and its tickets stop working soon.',
      body: [
        'Setting `status=blocked` only stops new lookups. The **watch API** must stop returning the manifest URL, and manifest URLs are signed with a short life (minutes) and checked at the edge, so a copied link dies fast.',
        'Edges still hold cached segments for the long TTL, so a blocked video also triggers a **CDN purge by prefix** for its folder. That is the one purge the CDN sees.',
      ],
      keyIdea: 'A takedown needs three moves: stop the manifest URL, expire signed links fast and purge the CDN prefix.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '3 min' },
      scene: {
        nodes: [{ ...db, at: at(-4.5, 0), status: 'down', badge: 'status=blocked' }, { ...api, at: at(-1.5, -3.6), status: 'active', badge: 'no manifest URL' }, { ...cdn, at: at(1.5, 3.6), status: 'active', badge: 'purge /v/42/*' }, { ...viewer, at: at(4.5, 0), status: 'down', badge: '403 after expiry' }],
        links: [link('db', 'api'), link('db', 'cdn', { style: 'dashed', label: 'purge prefix' }), link('cdn', 'viewer', { style: 'dashed' })],
        flows: [
          { path: ['db', 'api'], tone: 'event', label: 'blocked', duration: 1.2 },
          { path: ['db', 'cdn'], tone: 'request', label: 'purge by prefix', duration: 1.4, delay: 1.3 },
          { path: ['cdn', 'viewer'], tone: 'error', label: 'signed URL refused', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'Three moves',
          icon: 'Shield',
          rows: [
            { text: 'Watch API', value: 'no manifest URL', tone: 'good' },
            { text: 'Manifest URLs', value: 'signed, minutes' },
            { text: 'CDN', value: 'purge by prefix', tone: 'warn' },
          ],
          footer: { text: 'Blocking the row alone leaves cached segments live', tone: 'warn' },
        },
        caption: 'A takedown reaches the database, the API and the edge',
      },
    },
    {
      title: 'Protect videos',
      tag: 'tradeoff',
      heading: 'Keep paid and premium videos locked',
      eli5: 'Special cakes are locked in a box, and only paying customers get the key. That key comes from the **key server**.',
      body: [
        'Encrypt segments with AES and hand keys only to signed-in, entitled players through a license or **key server**, or use a full **DRM** system (FairPlay, Widevine, PlayReady) for studio content. Playback URLs can be signed with short expiry so the CDN refuses hot-linked requests.',
        'A visible watermark helps prove ownership after a copy leaks. Each layer costs something: DRM adds a license round trip before playback starts, so most platforms apply it per channel or per video.',
      ],
      keyIdea: 'Protect valuable videos with encryption, signed URLs and keys that only entitled viewers receive.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '3 min' },
      scene: {
        nodes: [{ ...cdn, at: at(-4.5, 0), badge: 'encrypted segs' }, { id: 'keys', kind: 'vault', at: at(0, 3.6), label: 'key server', sub: 'licenses' }, { ...viewer, at: at(4.5, 0), status: 'ok', badge: 'entitled' }, { ...rider, at: at(0, -3.6), status: 'down', badge: 'hot-linked' }],
        links: [link('cdn', 'viewer'), link('viewer', 'keys', { style: 'dashed', label: 'license round trip' }), link('cdn', 'rider', { style: 'dashed' })],
        flows: [
          { path: ['viewer', 'keys'], tone: 'handshake', label: 'license?', duration: 1.2 },
          { path: ['keys', 'viewer'], tone: 'handshake', label: 'key', duration: 1.2, delay: 1.3 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, duration: 1, delay: 2.6 },
          { path: ['cdn', 'rider'], tone: 'error', label: 'URL expired', duration: 1.2, delay: 0.5 },
        ],
        panel: {
          title: 'Protection layers',
          icon: 'KeyRound',
          rows: [
            { text: 'AES on segments', value: 'key server' },
            { text: 'DRM', value: 'studio content' },
            { text: 'Signed short URLs', value: 'no hot-linking' },
            { text: 'Watermark', value: 'proves ownership' },
          ],
          footer: { text: 'Each layer adds latency or cost', tone: 'warn' },
        },
        caption: 'Keys only go to entitled players',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Two pipelines, sized for their own bottleneck',
      eli5: 'Cakes come in the back door with a ticket, get cut and baked into many sizes, and corner shops hand out slices sized to each customer’s road. The whole thing is a **video platform**.',
      body: [
        'Playback: a five-step bitrate ladder in 4-second segments, served by the CDN and chosen per segment by the player. Around it: sharded metadata with replicas and a cache, status driven by pipeline events, and popularity-based treatment of the long tail to keep storage near 55 TB a day.',
        'Leases, idempotent outputs and a dead-letter queue handle failures, and sandboxing, encryption and signed URLs keep it safe. Egress at 11 PB a day stays the biggest bill.',
      ],
      keyIdea: 'Separate the paths by what they move: JSON through the API, uploads to object storage, CPU work to a queue of small tasks, and video bytes through the CDN.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      metricTones: { ready: 'good', storage: 'good' },
      scene: {
        nodes: [{ ...rend, at: at(-4.5, 0), status: 'ok' }, { ...cdn, at: at(0, 0), status: 'ok' }, { ...viewer, at: at(4.5, 0), status: 'ok' }, { ...api, at: at(0, -5), status: 'ok' }],
        links: [link('rend', 'cdn'), link('cdn', 'viewer'), link('viewer', 'api', { style: 'dashed' })],
        flows: [
          { path: ['rend', 'cdn'], tone: 'data', duration: 1 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, duration: 1, delay: 1.1 },
          { path: ['viewer', 'api'], tone: 'request', duration: 1.6, delay: 0.3 },
        ],
        panel: {
          title: 'Part 2 in numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Egress', value: '23 to 11 PB/day' },
            { text: 'Storage', value: '77 to 55 TB/day' },
            { text: 'Metadata reads reaching DB', value: '~600/s' },
          ],
        },
      },
      quiz: {
        question: 'An encoder crashes while encoding segment 42 of a video at 720p. What should the pipeline do?',
        options: [
          'Restart the whole video from the inspect step',
          'Let the task lease expire and rerun only that segment task on another worker',
          'Mark the video as failed and ask the creator to upload again',
          'Skip segment 42 and package the rest',
        ],
        answer: 1,
        explain: 'Tasks are small and independent. The lease returns the one task to the queue, another worker reruns it from the saved segment, and because output keys are fixed the rerun overwrites any partial result.',
      },
    },
  ],
};
