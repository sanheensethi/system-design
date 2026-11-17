import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Bottom row: the fetch side.
const seeds: SceneNode = { id: 'seeds', kind: 'block', at: at(-7.2, 3.6), label: 'seed URLs', sub: 'curated + sitemaps', icon: 'List', tint: 'teal' };
const frontier: SceneNode = { id: 'frontier', kind: 'block', at: at(-3.6, 3.6), label: 'URL frontier', sub: 'priority + politeness', icon: 'Layers', tint: 'violet' };
const fetchers: SceneNode = { id: 'fetchers', kind: 'block', at: at(0, 3.6), label: 'fetchers', sub: 'async HTTP', icon: 'Download', tint: 'blue' };
const web: SceneNode = { id: 'web', kind: 'internet', at: at(3.6, 3.6), label: 'the web', sub: '~15B pages' };

// Top row: the processing side.
const urlDb: SceneNode = { id: 'urlDb', kind: 'db', at: at(-7.2, -3.6), label: 'URL table', sub: 'sharded by host' };
const urlSeen: SceneNode = { id: 'urlSeen', kind: 'block', at: at(-7.2, -3.6), label: 'URL seen?', sub: 'bloom filter', icon: 'Search', tint: 'amber' };
const links: SceneNode = { id: 'links', kind: 'block', at: at(-3.6, -3.6), label: 'link extractor', sub: 'normalize + filter', icon: 'Route', tint: 'teal' };
const dedup: SceneNode = { id: 'dedup', kind: 'block', at: at(0, -3.6), label: 'content seen?', sub: 'fingerprints', icon: 'Copy', tint: 'amber' };
const parser: SceneNode = { id: 'parser', kind: 'block', at: at(3.6, -3.6), label: 'parser', sub: 'HTML to text + links', icon: 'FileText', tint: 'green' };
const store: SceneNode = { id: 'store', kind: 'storage', at: at(7.2, -3.6), label: 'page store', sub: 'compressed segments' };

// Supporting nodes.
const robots: SceneNode = { id: 'robots', kind: 'block', at: at(0, -3.6), label: 'robots cache', sub: 'per host, 24 h', icon: 'Shield', tint: 'amber' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: at(3.6, -3.6), label: 'DNS cache', sub: 'local resolver' };
const box: SceneNode = { id: 'box', kind: 'server', at: at(0, 3.6), label: 'crawler box', sub: 'one loop, one queue' };
const blog: SceneNode = { id: 'blog', kind: 'server', at: at(7.2, 3.6), label: 'small blog', sub: '1 cheap server' };
const trap: SceneNode = { id: 'trap', kind: 'server', at: at(7.2, 3.6), label: 'calendar site', sub: '/cal?month=...' };
const ring: SceneNode = { id: 'ring', kind: 'ring', at: at(-7.2, -3.6), label: 'host ring', sub: 'hash(host)' };
const ckpt: SceneNode = { id: 'ckpt', kind: 'storage', at: at(7.2, -3.6), label: 'checkpoints', sub: 'every 5 min' };

const loop = [
  link('seeds', 'frontier'),
  link('frontier', 'fetchers'),
  link('fetchers', 'web'),
];

export const designWebCrawler: Lesson = {
  id: 'design-web-crawler',
  title: 'Design a web crawler',
  tagline: 'Download billions of pages, keep them fresh, and stay polite to every site you visit.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'What crawlers are used for, and the scale numbers behind a 15 billion page crawl',
    'The crawl loop: seeds, frontier, fetchers, parser, dedup and back again',
    'A URL frontier with priority queues in front and one politeness queue per host',
    'robots.txt, DNS caching, fetcher limits, regional fetchers and JavaScript rendering',
    'Content fingerprints and a bloom filter to skip duplicate pages and URLs',
    'Recrawl scheduling, spider traps, spam and noise, and spreading the crawl over many machines',
    'Extending the crawler with new content types',
  ],
  metrics: [
    { key: 'rate', label: 'Pages/s', icon: 'Gauge' },
    { key: 'bw', label: 'Bandwidth', icon: 'Download' },
    { key: 'store', label: 'New storage', icon: 'HardDrive' },
    { key: 'dupes', label: 'Dup pages kept', icon: 'Copy' },
    { key: 'fresh', label: 'Revisit cycle', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Purpose',
      tag: 'problem',
      heading: 'A crawler turns links into a copy of the web',
      eli5: 'A team of surveyors must visit every house in a giant country and copy the note on each door. Every note lists more houses to visit. That is **crawling**.',
      body: [
        'A **web crawler** (also called a robot or spider) downloads a page, pulls out its links and follows them. Search engines use it to build an index. Archives, data mining and copyright monitoring use the same machinery.',
        'Latency does not matter here. Throughput, politeness and coverage do. No single page is urgent, but the job must never fall behind.',
      ],
      keyIdea: 'A crawler is a throughput machine with manners: every page fetched hands back more URLs to fetch.',
      metrics: { rate: '?', bw: '?', store: '?', dupes: '-', fresh: '?' },
      scene: {
        nodes: [
          { ...seeds, status: 'active' },
          { ...fetchers, status: 'active', chips: ['GET /'] },
          { ...web, badge: '15B pages' },
        ],
        links: [link('seeds', 'fetchers', { route: 'straight' }), link('fetchers', 'web', { route: 'straight' })],
        flows: [
          { path: ['seeds', 'fetchers'], tone: 'request', label: 'start here', duration: 1 },
          { path: ['fetchers', 'web'], tone: 'request', label: 'GET', count: 4, duration: 1, delay: 1 },
          { path: ['web', 'fetchers'], tone: 'response', label: 'HTML + links', count: 4, duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'Who runs crawlers',
          icon: 'Globe',
          rows: [
            { text: 'Search engine indexing', value: 'most common' },
            { text: 'Web archiving', value: 'libraries' },
            { text: 'Data mining', value: 'filings, prices' },
            { text: 'Web monitoring', value: 'copyright' },
          ],
          footer: { text: 'Same loop, different downstream use', tone: 'muted' },
        },
        caption: 'Every page fetched hands back more URLs to fetch',
      },
    },
    {
      title: 'Scope',
      tag: 'concept',
      heading: 'Fifteen billion pages, revisited every month',
      eli5: 'The country has fifteen billion houses and every one must be visited again each month. Doing it fast enough without bothering anyone is the hard part.',
      body: [
        'Scope: HTML pages only, about **15 billion**, each revisited about once a month. 15B / 30 days = **500M pages a day**, about **5,800 per second** on average and 10K at peak.',
        'At about 100 KB raw per page the fetchers pull 580 MB/s, about **4.6 Gbps**. Compressed to ~20 KB, the store grows about **300 TB a month**, and a few versions put the archive near a petabyte (the napkin math lesson).',
      ],
      keyIdea: '5,800 pages per second, 4.6 Gbps in, 300 TB a month stored, and never too many requests on one site.',
      metrics: { rate: '5,800/s target', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '-', fresh: '30 d target' },
      metricTones: { rate: 'warn', bw: 'warn', store: 'warn' },
      scene: {
        nodes: [
          { ...fetchers, status: 'active', badge: '5,800 pages/s' },
          { ...web, badge: '15B pages' },
          { ...store, badge: '300 TB / month' },
        ],
        links: [link('fetchers', 'web', { label: '4.6 Gbps in' }), link('fetchers', 'store', { label: '20 KB compressed' })],
        flows: [
          { path: ['fetchers', 'web'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['web', 'fetchers'], tone: 'response', label: '100 KB pages', count: 3, duration: 1.2, delay: 1.3 },
          { path: ['fetchers', 'store'], tone: 'data', label: '20 KB each', count: 2, duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'The napkin math',
          icon: 'Receipt',
          rows: [
            { text: '15B pages / 30 days', value: '500M / day' },
            { text: 'Average rate', value: '5,800 / s' },
            { text: 'Peak rate', value: '10K / s', tone: 'warn' },
            { text: '100 KB raw per page', value: '4.6 Gbps' },
            { text: '20 KB compressed', value: '300 TB / mo', tone: 'warn' },
          ],
        },
        caption: 'The numbers that size every later choice',
      },
    },
    {
      title: 'URL table',
      tag: 'concept',
      heading: 'One row per URL in a sharded table',
      eli5: 'The surveyors keep a big **address book** with one line per house: when we visited, when to go back, and where its photo is filed.',
      body: [
        'There is no public API. Internal interfaces are small: `frontier.add(urls, priority)`, `frontier.next(worker)`, `fetch(url) → status, headers, body` and `store.put(fingerprint, body)`. Each stage is its own service, so fetchers and parsers scale on their own.',
        'The **URL table** holds a hash of the normalized URL as key, plus host, last fetch, next due time, status, ETag, content fingerprint and priority. At 15B rows of ~200 bytes that is ~3 TB, sharded by host in a wide-column store (the sharding lesson).',
      ],
      keyIdea: 'Metadata per URL lives in a table sharded by host, so one host stays on one shard.',
      metrics: { rate: '5,800/s target', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '-', fresh: '30 d target' },
      scene: {
        nodes: [
          { ...urlDb, status: 'active', badge: '15B rows · 3 TB' },
          frontier,
          { ...fetchers, chips: ['fetch(url)'] },
        ],
        links: [link('urlDb', 'frontier'), link('frontier', 'fetchers'), link('fetchers', 'urlDb', { style: 'dashed' })],
        flows: [
          { path: ['urlDb', 'frontier'], tone: 'data', label: 'due URLs', duration: 1.2 },
          { path: ['frontier', 'fetchers'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['fetchers', 'urlDb'], tone: 'event', label: 'last_fetch, etag, offset', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'One URL row, ~200 bytes',
          icon: 'Table',
          code: 'url_hash      key\nurl, host     shard key\nlast_fetch    time\nnext_due      time\nstatus, etag  http\nfingerprint   content\nsegment, off  where the body is\npriority      score',
        },
        caption: 'Small rows in a table, keyed by host',
      },
    },
    {
      title: 'Page store',
      tag: 'concept',
      heading: 'Bodies go into big compressed segments',
      eli5: 'The photos do not go in one tiny frame each. They go into thick albums, and the address book says which album and page.',
      body: [
        'Page bodies go to **object storage** (the object storage lesson). Writing billions of 20 KB objects one by one is slow and costly, so pages are appended to ~1 GB compressed **segment files**.',
        'The URL table stores the segment id and offset for each page, so a read is one ranged GET into the right file.',
      ],
      keyIdea: 'Batch small page bodies into big compressed files and keep only a pointer in the URL table.',
      metrics: { rate: '5,800/s target', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '-', fresh: '30 d target' },
      scene: {
        nodes: [
          { ...fetchers, status: 'active' },
          { ...store, status: 'active', badge: '1 GB segments' },
          { ...urlDb, badge: 'segment + offset' },
        ],
        links: [link('fetchers', 'store', { route: 'straight' }), link('fetchers', 'urlDb', { style: 'dashed' })],
        flows: [
          { path: ['fetchers', 'store'], tone: 'data', label: 'append body', count: 3, duration: 1.4 },
          { path: ['store', 'fetchers', 'urlDb'], tone: 'event', label: 'seg 812, offset 40 MB', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'Segment file',
          icon: 'HardDrive',
          rows: [
            { text: 'Page bodies per file', value: '~50,000' },
            { text: 'Size, compressed', value: '~1 GB' },
            { text: 'Written', value: 'append only', tone: 'good' },
            { text: 'Read', value: 'ranged GET' },
          ],
          footer: { text: 'One object write per 50,000 pages', tone: 'good' },
        },
        caption: 'Big sequential writes, tiny pointers',
      },
    },
    {
      title: 'One box',
      tag: 'case',
      heading: 'Version one: a loop on one machine',
      eli5: 'One surveyor with one list is slow, forgets which houses he saw, and knocks on one family\'s door a hundred times in a row because the notes mostly list the same street.',
      body: [
        'The textbook crawler is breadth-first search: a queue, a visited set, and a loop. At ~0.5 s per fetch it manages ~40 pages/s, so 15B pages take about **12 years**. The visited set needs over **1 TB**.',
        'Most links point to the same site, so BFS hits one host back to back. A small blog sees dozens of requests a second, far more than it can take, and its owner blocks us.',
      ],
      keyIdea: 'A single BFS loop is too slow, runs out of memory, and hammers whichever site it is currently reading.',
      metrics: { rate: '40/s', bw: '0.03 Gbps', store: '-', dupes: '-', fresh: '~12 years' },
      metricTones: { rate: 'bad', bw: 'bad', fresh: 'bad' },
      scene: {
        nodes: [
          seeds,
          { ...box, status: 'hot', load: 95, badge: '1 TB visited set' },
          { ...web, status: 'active' },
          { ...blog, status: 'down', chips: [{ text: '30 req/s from us', tone: 'bad' }] },
        ],
        links: [link('seeds', 'box'), link('box', 'web'), link('web', 'blog', { label: 'same host again', labelTone: 'warn' })],
        flows: [
          { path: ['seeds', 'box'], tone: 'request', duration: 1 },
          { path: ['box', 'web', 'blog'], tone: 'request', label: 'same host again', count: 6, duration: 1.2, delay: 1 },
          { path: ['blog', 'web', 'box'], tone: 'error', label: '429 / blocked', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Why one loop fails',
          icon: 'Timer',
          rows: [
            { text: 'Speed', value: '40/s = 12 years', tone: 'bad' },
            { text: 'Memory', value: '> 1 TB visited set', tone: 'bad' },
            { text: 'Manners', value: 'hammers one host', tone: 'bad' },
          ],
        },
        caption: 'Breadth-first on one box is slow and rude',
      },
    },
    {
      title: 'Fetch stages',
      tag: 'concept',
      heading: 'Split the loop: seeds, frontier, fetchers, parsers',
      eli5: 'Now there is a team. Some surveyors only walk and copy, some only read notes, and one keeps the **to-visit board** that tells them where to go next.',
      body: [
        '**Seeds** start the crawl: a curated list of popular sites across countries and topics, plus every sitemap we know. The **frontier** hands URLs to **fetchers**, which download pages and pass them to **parsers**. Stages talk through queues (the message queues lesson), in batches of hundreds of URLs.',
        'Fetchers are I/O bound. At ~0.5 s per fetch, 5,800 pages/s means about **2,900 open requests**, which async I/O spreads over a handful of machines.',
      ],
      keyIdea: 'Break the crawl into stages joined by queues, so I/O-bound fetching and CPU-bound parsing scale separately.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      metricTones: { rate: 'good', dupes: 'bad' },
      scene: {
        nodes: [
          seeds,
          { ...frontier, status: 'active' },
          { ...fetchers, status: 'active', badge: '~2,900 in flight', load: 55 },
          web,
          { ...parser, status: 'active' },
        ],
        links: [...loop, link('fetchers', 'parser')],
        flows: [
          { path: ['seeds', 'frontier', 'fetchers'], tone: 'request', duration: 1.4 },
          { path: ['fetchers', 'web', 'fetchers'], tone: 'request', label: 'GET', duration: 1.2, delay: 1.4 },
          { path: ['fetchers', 'parser'], tone: 'data', label: 'HTML', duration: 1.4, delay: 2.7 },
        ],
        panel: {
          title: 'Sizing the fetchers',
          icon: 'Cpu',
          rows: [
            { text: 'Page rate', value: '5,800 / s' },
            { text: 'Time per fetch', value: '~0.5 s' },
            { text: 'Open requests', value: '~2,900', tone: 'warn' },
            { text: 'Batch size', value: 'hundreds of URLs' },
          ],
          footer: { text: 'I/O bound: async, few machines', tone: 'muted' },
        },
        caption: 'Fetch and parse as separate stages',
      },
    },
    {
      title: 'Process stages',
      tag: 'concept',
      heading: 'Parsers feed checks, then new URLs go back to the frontier',
      eli5: 'Each copied note goes to a checker. If it is new, its addresses are normalized, checked against the wall of lamps, and any new ones are pinned to the **to-visit board**.',
      body: [
        'Parsers (CPU bound, a few dozen cores) validate the page, extract text and links, and run a **content seen?** check before the page reaches the store. Links are normalized, filtered and checked against **URL seen?** before entering the frontier.',
        'This reaches the target rate. It exposes the next problems: duplicate content, duplicate URLs, and a frontier that knows nothing about hosts or importance.',
      ],
      keyIdea: 'The crawl is a closed loop: parse, check content, check URLs, enqueue, fetch again.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      metricTones: { dupes: 'bad' },
      scene: {
        nodes: [
          { ...frontier, status: 'ok' },
          { ...urlSeen },
          { ...links },
          { ...dedup },
          { ...parser, status: 'active' },
        ],
        links: [
          link('parser', 'dedup'),
          link('dedup', 'links'),
          link('links', 'urlSeen'),
          link('urlSeen', 'frontier'),
        ],
        flows: [
          { path: ['parser', 'dedup'], tone: 'data', label: 'text + links', duration: 1.2 },
          { path: ['dedup', 'links'], tone: 'data', duration: 1, delay: 1.3 },
          { path: ['links', 'urlSeen'], tone: 'request', label: 'normalized', duration: 1, delay: 2.4 },
          { path: ['urlSeen', 'frontier'], tone: 'event', label: 'new URLs', duration: 1.6, delay: 3.5 },
        ],
        panel: {
          title: 'Open problems',
          icon: 'Bug',
          rows: [
            { text: 'Duplicate content', value: '~30% of pages', tone: 'bad' },
            { text: 'Duplicate URLs', value: 'dozens per page', tone: 'bad' },
            { text: 'Frontier order', value: 'no priority yet', tone: 'warn' },
            { text: 'Host politeness', value: 'none yet', tone: 'warn' },
          ],
          footer: { text: 'Parsers also append (from_url, to_url) edges to a link store', tone: 'muted' },
        },
        caption: 'Parse, check, enqueue, repeat',
      },
    },
    {
      title: 'Priority',
      tag: 'concept',
      heading: 'Front queues decide what is worth fetching first',
      eli5: 'Important houses go to the top of the **to-visit board**. A surveyor picks from the high shelf more often than the low one, but the low shelf still gets visited.',
      body: [
        'A prioritizer scores each URL from link-based importance, the site\'s quality, how often the page changes and its depth from a seed, then drops it into one of a few **front queues**.',
        'A selector pulls from those queues with a bias toward the high ones, so a news front page is fetched sooner than a page nine clicks deep.',
      ],
      keyIdea: 'Priority queues in front decide what is worth fetching first.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [
          { ...urlDb, badge: 'priority scores' },
          { ...frontier, status: 'active', chips: [{ text: 'P1 news', tone: 'good' }, 'P2 shop', { text: 'P3 deep page', tone: 'warn' }] },
          { ...fetchers, status: 'ok' },
        ],
        links: [link('urlDb', 'frontier'), link('frontier', 'fetchers')],
        flows: [
          { path: ['urlDb', 'frontier'], tone: 'data', label: 'scored URLs', duration: 1.2 },
          { path: ['frontier', 'fetchers'], tone: 'request', label: 'mostly high priority', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Priority score inputs',
          icon: 'Star',
          rows: [
            { text: 'Link-based importance', value: 'from the link store' },
            { text: 'Site quality', value: 'trusted hosts' },
            { text: 'Change frequency', value: 'news = high' },
            { text: 'Depth from a seed', value: 'shallow = high' },
          ],
          footer: { text: 'Parsers append (from, to) edges to a link store. A batch job scores them into the priority field.', tone: 'muted' },
        },
        caption: 'Important URLs go first',
      },
    },
    {
      title: 'Politeness',
      tag: 'concept',
      heading: 'Back queues: one per host, ordered by next allowed time',
      eli5: 'Each street gets its own line, and a surveyor may knock on a street only once every few minutes. A clock on the board says which street may be visited now.',
      body: [
        '**Back queues** each hold URLs for one host, and a heap keyed on "next allowed time" says which host is free. After each fetch the host waits the longest of 2 seconds, 10 times its last response time, or its robots.txt crawl delay.',
        'At 5,800 pages/s with one fetch per host every few seconds, about **20K hosts** are in rotation at any moment.',
      ],
      keyIdea: 'Per-host queues with a next-allowed time decide when it is polite to fetch.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      metricTones: { rate: 'good' },
      scene: {
        nodes: [
          { ...frontier, status: 'active', badge: '~20K hosts in rotation' },
          { ...fetchers, status: 'ok', chips: ['host free now'] },
          { ...web, status: 'ok', badge: '1 req / host / 2 s' },
        ],
        links: [link('frontier', 'fetchers'), link('fetchers', 'web', { label: 'one per host', labelTone: 'good' })],
        flows: [
          { path: ['frontier', 'fetchers'], tone: 'request', label: 'host free now', count: 3, duration: 1, delay: 0 },
          { path: ['fetchers', 'web'], tone: 'request', label: 'one per host', count: 3, duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Wait after each fetch',
          icon: 'Clock',
          rows: [
            { text: 'Minimum delay', value: '2 s' },
            { text: '10 x last response time', value: '10 x t' },
            { text: 'robots.txt Crawl-delay', value: 'if set' },
          ],
          footer: { text: 'Wait = the longest of the three', tone: 'good' },
        },
        caption: 'Many hosts in parallel, each one slowly',
      },
      code: {
        language: 'python',
        title: 'Back queues: one per host, ordered by next allowed time',
        source: `import heapq, time
from collections import deque

class PoliteQueues:
    def __init__(self, min_delay=2.0):
        self.queues = {}          # host -> deque of URLs
        self.ready = []           # heap of (next_allowed_time, host)
        self.min_delay = min_delay

    def add(self, host, url):
        if host not in self.queues:
            self.queues[host] = deque()
            heapq.heappush(self.ready, (time.time(), host))
        self.queues[host].append(url)

    def next(self):
        due, host = heapq.heappop(self.ready)       # host whose turn is earliest
        time.sleep(max(0.0, due - time.time()))     # never early
        return host, self.queues[host].popleft()

    def done(self, host, fetch_secs, crawl_delay=0.0):
        wait = max(self.min_delay, 10 * fetch_secs, crawl_delay)
        if self.queues[host]:
            heapq.heappush(self.ready, (time.time() + wait, host))
        else:
            del self.queues[host]                   # host drained`,
        highlight: [7, 17, 18, 22, 24],
      },
      quiz: {
        question: 'A host answered in 300 ms and sets no crawl delay. With the 2 s minimum and the 10 x response time rule, when may it be fetched again?',
        options: ['After 0.3 s', 'After 2 s', 'After 3 s', 'After 30 s'],
        answer: 2,
        explain: '10 x 0.3 s = 3 s, which is longer than the 2 s minimum. The wait is the longest of the three values, so a slow host is fetched less often.',
      },
    },
    {
      title: 'On disk',
      tag: 'concept',
      heading: 'The frontier lives on disk with memory buffers',
      eli5: 'The board is far too big for the wall, so most of it is kept in filing cabinets. Only the next few names sit on the wall, and new names are collected in a tray and filed in batches.',
      body: [
        'Billions of URLs do not fit in RAM, and an all-disk frontier would be slow. The frontier uses a hybrid: most URLs sit on disk, with an in-memory buffer at the head (to dequeue fast) and at the tail (to batch writes).',
        'Buffers are flushed to disk on a timer, and the frontier is checkpointed so a restart does not lose the queue.',
      ],
      keyIdea: 'Keep the bulk of the frontier on disk and buffer both ends in memory.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [
          { ...urlSeen, badge: 'new URLs in' },
          { ...frontier, status: 'active', chips: ['tail buffer (RAM)', 'disk: billions', 'head buffer (RAM)'] },
          { ...fetchers, status: 'ok' },
        ],
        links: [link('urlSeen', 'frontier'), link('frontier', 'fetchers')],
        flows: [
          { path: ['urlSeen', 'frontier'], tone: 'event', label: 'batched writes', duration: 1.4 },
          { path: ['frontier', 'fetchers'], tone: 'request', label: 'fast dequeue', count: 3, duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Frontier storage',
          icon: 'HardDrive',
          rows: [
            { text: 'Head buffer', value: 'RAM, fast pop', tone: 'good' },
            { text: 'Bulk of queues', value: 'disk' },
            { text: 'Tail buffer', value: 'RAM, batched write', tone: 'good' },
          ],
          footer: { text: 'Hundreds of millions of URLs, cheap storage', tone: 'muted' },
        },
        caption: 'RAM at both ends, disk in the middle',
      },
    },
    {
      title: 'robots.txt',
      tag: 'concept',
      heading: 'Read robots.txt before every host, and cache it',
      eli5: 'Some doors carry a sign: "please skip the back garden". That sign is **robots.txt**. Surveyors read it once a day and remember it.',
      body: [
        'Before fetching from a host, the fetcher reads its **robots.txt** and obeys its `Disallow` rules for our user agent. A non-standard `Crawl-delay` feeds the politeness wait. The file is cached per host for about a day.',
        'A missing file (404) means everything is allowed. A server error means we treat the whole site as off limits for now and retry later.',
      ],
      keyIdea: 'Obey and cache robots.txt per host. When it cannot be read, assume no.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [
          frontier,
          { ...fetchers, status: 'active', chips: ['shop.example/cart'] },
          { ...robots, status: 'ok', badge: 'Disallow: /cart' },
          web,
        ],
        links: [link('frontier', 'fetchers'), link('fetchers', 'robots', { style: 'dashed' }), link('fetchers', 'web')],
        flows: [
          { path: ['frontier', 'fetchers'], tone: 'request', label: 'shop.example/cart', duration: 1 },
          { path: ['fetchers', 'robots', 'fetchers'], tone: 'handshake', label: 'allowed?', duration: 1.4, delay: 1.1 },
          { path: ['robots', 'fetchers'], tone: 'error', label: 'no: skip', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'robots.txt outcomes',
          icon: 'Shield',
          rows: [
            { text: 'Disallow matches', value: 'skip URL', tone: 'bad' },
            { text: '404 Not Found', value: 'all allowed', tone: 'good' },
            { text: '5xx server error', value: 'off limits, retry', tone: 'warn' },
            { text: 'Cache lifetime', value: '~24 h' },
          ],
        },
        caption: 'Ask permission before every host',
      },
    },
    {
      title: 'DNS cache',
      tag: 'concept',
      heading: 'DNS is a hidden bottleneck',
      eli5: 'Surveyors keep their own phone book of street addresses instead of calling the operator for every house, because each call makes the whole team wait.',
      body: [
        'A DNS lookup can take tens to hundreds of milliseconds, and many resolver libraries block a thread while they wait. At thousands of fetches a second that stalls the loop.',
        'Each crawler node runs a local caching resolver (the DNS lesson), honors TTLs and resolves the hosts at the head of the frontier ahead of time.',
      ],
      keyIdea: 'Resolve in a local cache, ahead of time, so fetchers never block on DNS.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      metricTones: { rate: 'good' },
      scene: {
        nodes: [
          { ...frontier, chips: ['next: shop.example'] },
          { ...fetchers, status: 'active' },
          { ...dns, status: 'ok', badge: '99% cache hits' },
          web,
        ],
        links: [
          link('frontier', 'fetchers'),
          link('fetchers', 'dns', { style: 'dashed', label: '10 to 200 ms if uncached', labelTone: 'warn' }),
          link('fetchers', 'web'),
        ],
        flows: [
          { path: ['frontier', 'dns'], tone: 'handshake', label: 'pre-resolve', duration: 1.6 },
          { path: ['fetchers', 'dns', 'fetchers'], tone: 'handshake', label: 'IP from cache', duration: 1.6, delay: 1.7 },
          { path: ['fetchers', 'web'], tone: 'request', label: 'GET /products/7', duration: 1, delay: 3.4 },
        ],
        panel: {
          title: 'Cost of a lookup',
          icon: 'Timer',
          rows: [
            { text: 'Uncached lookup', value: '10 to 200 ms', tone: 'bad' },
            { text: 'Cache hit', value: 'under 1 ms', tone: 'good' },
            { text: 'Thread while waiting', value: 'blocked', tone: 'warn' },
            { text: 'Refresh', value: 'by TTL' },
          ],
        },
        caption: 'Look up the address from the local phone book',
      },
    },
    {
      title: 'Fetch limits',
      tag: 'concept',
      heading: 'Bound every fetch, retry politely, crawl from nearby',
      eli5: 'A surveyor waits at one door at most ten seconds and copies at most one page of notes. Teams in each region cover the houses near them, so they walk less.',
      body: [
        'Fetchers use async I/O, a **10 s timeout**, a **5 MB body cap** and at most 5 redirects, so a server that dribbles a byte a second cannot stall the loop. Regional fetchers crawl nearby hosts for **locality**.',
        'Failures are feedback. Retry timeouts and 5xx with **exponential backoff**, mark a URL dead after 5 failures, and treat `429` or `503` as a signal to double that host\'s delay. Send a `User-Agent` with a contact page.',
      ],
      keyIdea: 'Timeouts, caps, backoff and regional fetchers keep slow or unhappy sites from stalling the crawl.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [
          { ...frontier },
          { ...fetchers, status: 'active', chips: ['timeout 10 s', 'body cap 5 MB', 'User-Agent + contact'] },
          { ...web, chips: [{ text: '1 byte / s', tone: 'bad' }] },
        ],
        links: [link('frontier', 'fetchers'), link('fetchers', 'web', { label: 'nearest region', labelTone: 'good' })],
        flows: [
          { path: ['frontier', 'fetchers', 'web'], tone: 'request', label: 'GET', duration: 1.6 },
          { path: ['web', 'fetchers'], tone: 'error', label: 'too slow: abort', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Limits and status codes',
          icon: 'Gauge',
          rows: [
            { text: 'Timeout 10 s, body 5 MB', value: 'abort' },
            { text: '429 or 503', value: 'host delay x2', tone: 'warn' },
            { text: 'Timeout or 5xx', value: 'retry, backoff', tone: 'warn' },
            { text: '5 failures in a row', value: 'mark URL dead', tone: 'bad' },
            { text: '404 or 410', value: 'drop URL' },
            { text: 'User-Agent', value: 'name + contact URL', tone: 'good' },
          ],
          footer: { text: 'Backoff: 1, 2, 4, 8 min', tone: 'muted' },
        },
        caption: 'Give up on slow servers and fetch from nearby',
      },
    },
    {
      title: 'JavaScript',
      tag: 'concept',
      heading: 'Pages that build their links with JavaScript',
      eli5: 'Some doors show a blank card until you press a button, and the real address appears only then. A special surveyor presses the button first, so nothing is missed.',
      body: [
        'Many sites generate links and text with JavaScript. A plain download and parse sees an empty shell and finds no links.',
        'The fix is **server-side rendering** (dynamic rendering): load the page in a headless browser first, then parse the final HTML. It costs far more CPU, so it runs only for pages that need it.',
      ],
      keyIdea: 'Render JavaScript pages in a headless browser before parsing, and only where needed.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [
          { ...fetchers, status: 'active', chips: ['<div id="app">'] },
          web,
          { id: 'render', kind: 'block', at: at(0, -3.6), label: 'renderer', sub: 'headless browser', icon: 'Code', tint: 'violet', status: 'hot', load: 88 },
          { ...parser, status: 'active', badge: 'links found' },
        ],
        links: [link('fetchers', 'web'), link('fetchers', 'render'), link('render', 'parser')],
        flows: [
          { path: ['fetchers', 'web', 'fetchers'], tone: 'request', label: 'empty shell', duration: 1.4 },
          { path: ['fetchers', 'render'], tone: 'data', label: 'needs JS', duration: 1, delay: 1.5 },
          { path: ['render', 'parser'], tone: 'data', label: 'final HTML', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Plain fetch or render',
          icon: 'Code',
          rows: [
            { text: 'Static HTML page', value: 'parse directly', tone: 'good' },
            { text: 'Script builds links', value: 'render first', tone: 'warn' },
            { text: 'CPU cost of render', value: 'many x parse', tone: 'bad' },
          ],
          footer: { text: 'Render only the pages that need it', tone: 'muted' },
        },
        caption: 'Run the page before reading it',
      },
    },
    {
      title: 'Content seen?',
      tag: 'concept',
      heading: 'Skip pages we already have, even under another URL',
      eli5: 'Many houses have the exact same note pinned up, copied from a neighbor. Before filing a photo, the surveyor checks its short **fingerprint** against the archive and skips repeats.',
      body: [
        'Near a third of the web is duplicate: mirrors, `http` and `https` copies, print versions, syndicated articles. For **exact duplicates**, hash the normalized text and look the fingerprint up. For **near duplicates**, use a 64-bit **simhash**: pages within 3 bits are copies.',
        'To find candidates among billions, split the 64 bits into 4 blocks of 16 and index each. Two fingerprints within 3 bits must match exactly on at least one block.',
      ],
      keyIdea: 'Fingerprint every page: an exact hash for copies, a simhash for near copies. Store and expand each piece of content once.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '30 d' },
      metricTones: { store: 'good', dupes: 'good' },
      scene: {
        nodes: [
          fetchers,
          { ...parser, status: 'active', chips: ['mirror of a news story'] },
          { ...dedup, status: 'active', badge: 'simhash within 3 bits' },
          { ...store, status: 'ok', badge: '-30% writes' },
        ],
        links: [link('fetchers', 'parser'), link('parser', 'dedup'), link('parser', 'store', { route: 'straight' })],
        flows: [
          { path: ['fetchers', 'parser'], tone: 'data', label: 'mirror of a news story', duration: 1.2 },
          { path: ['parser', 'dedup'], tone: 'request', label: 'fingerprint?', duration: 1, delay: 1.3 },
          { path: ['dedup', 'parser'], tone: 'error', label: 'seen: skip', duration: 1, delay: 2.4 },
          { path: ['parser', 'store'], tone: 'data', label: 'only new content', duration: 1.2, delay: 3.6 },
        ],
        panel: {
          title: 'Two fingerprints',
          icon: 'Hash',
          rows: [
            { text: 'Exact copy', value: 'hash of text' },
            { text: 'Near copy', value: 'simhash, 64 bit' },
            { text: 'Match rule', value: '<= 3 bits differ' },
            { text: 'Lookup', value: '4 blocks of 16 bits' },
          ],
          footer: { text: 'Storage 300 to 210 TB a month', tone: 'good' },
        },
        caption: 'Same story, different URL: stored once',
      },
      code: {
        language: 'python',
        title: 'Exact fingerprint and simhash for near duplicates',
        source: `import hashlib, re

def exact_fp(text):
    norm = re.sub(r"\\s+", " ", text).strip().lower()
    return hashlib.sha256(norm.encode()).digest()[:16]

def simhash(text, bits=64):
    words = re.findall(r"\\w+", text.lower())
    shingles = [" ".join(words[i:i + 3]) for i in range(len(words) - 2)]
    votes = [0] * bits
    for s in shingles:
        h = int.from_bytes(hashlib.blake2b(s.encode(), digest_size=8).digest(), "big")
        for b in range(bits):
            votes[b] += 1 if (h >> b) & 1 else -1
    return sum(1 << b for b in range(bits) if votes[b] > 0)

def near_duplicate(a, b, max_bits=3):
    return bin(a ^ b).count("1") <= max_bits`,
        highlight: [5, 9, 14, 15, 18],
      },
      quiz: {
        question: 'Two pages carry the same article but different ad blocks. Which check flags them as duplicates?',
        options: [
          'Comparing their URLs after normalization',
          'A SHA-256 hash of the full HTML',
          'A simhash fingerprint compared within a few bits',
          'The bloom filter of seen URLs',
        ],
        answer: 2,
        explain: 'Their URLs differ and any change in the HTML changes a cryptographic hash completely. A simhash moves only a few bits for a small edit, so near copies land within the threshold.',
      },
    },
    {
      title: 'URL seen?',
      tag: 'concept',
      heading: 'Normalize URLs, then a bloom filter for 30 billion',
      eli5: 'Before writing an address on the board, the surveyor checks a wall of tiny lamps, the **bloom filter**. If any lamp is dark, the address is new. If all are lit, he skips it, and once in a while that skip is a mistake.',
      body: [
        'Every page yields dozens of links, most already known. First **normalize**: lowercase the scheme and host, drop default ports and `#fragments`, sort query parameters and strip tracking and session ids.',
        'An exact set of 30B URL hashes (room over today\'s 15B) needs hundreds of GB. A **bloom filter** (the bloom filters lesson) at 1% false positives needs ~9.6 bits per URL: about **36 GB**, split across nodes by host. About 1 in 100 new URLs is wrongly skipped. Sitemaps and other links catch them later.',
      ],
      keyIdea: 'Normalize URLs, then use a bloom filter: no duplicates enter the frontier, and a small, known share of new URLs is missed.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '30 d' },
      scene: {
        nodes: [
          { ...dedup },
          { ...links, status: 'active', chips: ['40 links per page'] },
          { ...urlSeen, status: 'active', badge: '36 GB · 1% FP' },
          { ...frontier, status: 'ok' },
        ],
        links: [link('dedup', 'links'), link('links', 'urlSeen'), link('urlSeen', 'frontier')],
        flows: [
          { path: ['dedup', 'links'], tone: 'data', label: 'new content', duration: 1.2 },
          { path: ['links', 'urlSeen'], tone: 'request', label: '40 normalized URLs', count: 4, duration: 1, delay: 1.3 },
          { path: ['urlSeen', 'frontier'], tone: 'event', label: '3 are new', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: '30B URLs at 1% false positives',
          icon: 'Search',
          rows: [
            { text: 'Exact set of hashes', value: 'hundreds of GB', tone: 'bad' },
            { text: 'Bloom filter', value: '~9.6 bits / URL', tone: 'good' },
            { text: 'Total size', value: '~36 GB', tone: 'good' },
            { text: 'Missed new URLs', value: '~1 in 100', tone: 'warn' },
          ],
        },
        caption: 'Most links point to URLs we already know',
      },
      code: {
        language: 'python',
        title: 'Normalize, then check the bloom filter',
        source: `from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

DEFAULT_PORT = {"http": 80, "https": 443}
DROP = {"utm_source", "utm_medium", "utm_campaign", "sessionid", "sid"}

def normalize(url):
    s = urlsplit(url)
    scheme, host = s.scheme.lower(), (s.hostname or "").lower()
    port = "" if s.port in (None, DEFAULT_PORT.get(scheme)) else f":{s.port}"
    query = sorted((k, v) for k, v in parse_qsl(s.query) if k.lower() not in DROP)
    return urlunsplit((scheme, host + port, s.path or "/", urlencode(query), ""))

seen = BloomFilter(capacity=30_000_000_000, error_rate=0.01)   # ~36 GB total

def maybe_enqueue(raw_url, frontier):
    url = normalize(raw_url)
    if url in seen:            # "probably seen": skip it
        return False
    seen.add(url)
    frontier.add(url)
    return True`,
        highlight: [10, 11, 13, 17],
      },
    },
    {
      title: 'Revisit rate',
      tag: 'tradeoff',
      heading: 'Revisit each page as often as it changes',
      eli5: 'A bakery changes its door note every morning, and an old church never changes. Surveyors visit the bakery daily and the church a few times a year. That is the **revisit schedule**.',
      body: [
        'A flat 30-day cycle wastes effort both ways: a news homepage is stale most of the month, and an archived manual is fetched 12 times a year for nothing.',
        'Each URL row keeps a **revisit interval**. If the fingerprint changed, halve it. If not, grow it by half. Bound it between 1 hour and 90 days and scale by priority. Sitemap `lastmod` dates and RSS feeds give free hints.',
      ],
      keyIdea: 'Adapt each page\'s revisit interval to how often it changes and how much it matters.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [
          { ...urlDb, status: 'active', badge: 'next_due per URL' },
          { ...frontier, status: 'active' },
          { ...fetchers, chips: ['news page, due in 1 h'] },
        ],
        links: [link('urlDb', 'frontier'), link('frontier', 'fetchers'), link('fetchers', 'urlDb', { style: 'dashed' })],
        flows: [
          { path: ['urlDb', 'frontier'], tone: 'data', label: 'news page due (1 h)', duration: 1.2 },
          { path: ['frontier', 'fetchers'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['fetchers', 'urlDb'], tone: 'event', label: 'changed: interval / 2', duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'Interval rule',
          icon: 'Clock',
          rows: [
            { text: 'Page changed', value: 'interval / 2', tone: 'good' },
            { text: 'Page unchanged', value: 'interval x 1.5' },
            { text: 'Lower bound', value: '1 hour' },
            { text: 'Upper bound', value: '90 days' },
          ],
          footer: { text: 'High priority pages are checked sooner', tone: 'muted' },
        },
        caption: 'Check often where pages change, rarely where they do not',
      },
    },
    {
      title: 'Cheap recrawl',
      tag: 'tradeoff',
      heading: 'Conditional GETs make an unchanged check cheap',
      eli5: 'The surveyor shows the old photo and asks "has the note changed?" If not, the family just says no and nothing is copied again.',
      body: [
        'Recrawls send `If-None-Match` (the stored ETag) or `If-Modified-Since`. An unchanged page answers `304 Not Modified` with no body.',
        'If about 35% of recrawls are 304, bandwidth falls to **~3 Gbps** and new storage to **~140 TB a month**, since unchanged pages are not stored again.',
      ],
      keyIdea: 'A 304 costs a header, not a page, so unchanged recrawls are nearly free.',
      metrics: { rate: '5,800/s', bw: '~3 Gbps', store: '140 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      metricTones: { bw: 'good' },
      scene: {
        nodes: [
          { ...frontier },
          { ...fetchers, status: 'active', chips: ['If-None-Match: "a1b2"'] },
          { ...web, status: 'ok', badge: '304 Not Modified' },
        ],
        links: [link('frontier', 'fetchers'), link('fetchers', 'web', { arrow: 'both' })],
        flows: [
          { path: ['frontier', 'fetchers', 'web'], tone: 'request', label: 'If-None-Match', duration: 1.6 },
          { path: ['web', 'fetchers'], tone: 'response', label: '304, no body', duration: 1, delay: 1.8 },
        ],
        panel: {
          title: 'Conditional GET',
          icon: 'Repeat',
          code: 'GET /news HTTP/1.1\nIf-None-Match: "a1b2"\n\nHTTP/1.1 304 Not Modified\n(no body)',
          footer: { text: 'Bandwidth 4.6 to ~3 Gbps, storage 210 to ~140 TB', tone: 'good' },
        },
        caption: 'Ask if it changed before downloading it',
      },
    },
    {
      title: 'Spider traps',
      tag: 'case',
      heading: 'Case: an endless calendar fills a fifth of the frontier',
      eli5: 'One street is a magic maze: every door\'s note points to a newer door, forever. That maze is a **spider trap**, so each street gets a visit limit.',
      body: [
        'One host holds 900M URLs, 20% of the frontier: a calendar where every page links to "next month", up to year 9999. Politeness caps its fetch rate, but its back queue never drains. Other traps: session ids in links, `/a/b/a/b` loops, faceted search.',
        'Defenses stack: cap URL length (~2,000 characters) and path depth, flag repeating segments, and give each host a **crawl budget** by importance. Near-duplicate hosts lose priority. A manual blocklist covers the rest.',
      ],
      keyIdea: 'Assume some of the web is infinite. Cap URLs, budget each host, and watch per-host stats to catch what rules miss.',
      metrics: { rate: '5,800/s, 20% of frontier is 1 trap', bw: '~3 Gbps', store: '140 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      metricTones: { rate: 'bad' },
      scene: {
        nodes: [
          { ...frontier, status: 'hot', badge: '900M URLs, 20% of frontier' },
          { ...fetchers, status: 'hot', load: 92 },
          { ...web },
          { ...trap, status: 'hot', chips: [{ text: '/cal?month=9998-04', tone: 'bad' }] },
        ],
        links: [link('frontier', 'fetchers'), link('fetchers', 'web'), link('web', 'trap')],
        flows: [
          { path: ['frontier', 'fetchers', 'web', 'trap'], tone: 'request', label: '/cal?month=9998-04', count: 3, duration: 1.8 },
          { path: ['trap', 'web', 'fetchers', 'frontier'], tone: 'error', label: 'one more link', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Trap defenses',
          icon: 'Bug',
          rows: [
            { text: 'URL length cap', value: '~2,000 chars' },
            { text: 'Path depth + repeats', value: 'flagged' },
            { text: 'Per-host crawl budget', value: 'by importance', tone: 'good' },
            { text: 'Mostly near duplicates', value: 'lower priority' },
            { text: 'Manual blocklist', value: 'last resort' },
          ],
          footer: { text: 'Found by per-host dashboards', tone: 'muted' },
        },
        caption: 'An infinite site meets a finite budget',
      },
    },
    {
      title: 'Bad content',
      tag: 'case',
      heading: 'Spam, soft 404s and other noise',
      eli5: 'Some doors have junk: ads, copied lists, a blank page that says "found it!", or a note a mile long. The surveyors skip those and write the street down as a bad one.',
      body: [
        'Bad content needs limits too: servers that dribble one byte per second (timeouts), 2 GB "pages" (size caps), and **soft 404s** that return 200 with an error page (caught by fingerprint).',
        'Ads, code snippets and spam or malware farms add noise. An anti-spam filter drops low-quality pages, with blocklists fed from the indexing side, because storage and fetches are finite.',
      ],
      keyIdea: 'Validate and filter what comes back: caps for the hostile, fingerprints for soft 404s, and an anti-spam filter for noise.',
      metrics: { rate: '5,800/s', bw: '~3 Gbps', store: '140 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [
          { ...fetchers, status: 'active' },
          { ...web, chips: [{ text: '200 "page not found"', tone: 'warn' }, { text: '2 GB body', tone: 'bad' }] },
          { ...parser, status: 'active' },
          { id: 'filter', kind: 'block', at: at(0, -3.6), label: 'quality filter', sub: 'anti-spam', icon: 'Shield', tint: 'red', status: 'active' },
          { id: 'index', kind: 'search', at: at(-3.6, -3.6), label: 'search index', sub: 'spam feedback' },
        ],
        links: [link('fetchers', 'web'), link('fetchers', 'parser'), link('parser', 'filter'), link('index', 'filter', { style: 'dashed' })],
        flows: [
          { path: ['web', 'fetchers'], tone: 'error', label: 'soft 404 / 2 GB', duration: 1.2 },
          { path: ['fetchers', 'parser'], tone: 'data', duration: 1, delay: 1.3 },
          { path: ['parser', 'filter'], tone: 'request', label: 'spam score?', duration: 1.2, delay: 2.4 },
          { path: ['index', 'filter'], tone: 'event', label: 'blocklist', duration: 1.2, delay: 3.7 },
        ],
        panel: {
          title: 'Bad content and its guard',
          icon: 'Shield',
          rows: [
            { text: 'Slow server, 1 byte/s', value: 'timeout' },
            { text: '2 GB page', value: 'size cap' },
            { text: 'Soft 404 (200 + error)', value: 'fingerprint' },
            { text: 'Spam and malware farms', value: 'blocklist' },
          ],
        },
        caption: 'Not every 200 deserves a place in the store',
      },
    },
    {
      title: 'Partition by host',
      tag: 'concept',
      heading: 'Spread the crawl over many nodes, keyed by host',
      eli5: 'The country is split into regions, one surveyor team each, and a team owns every house on its streets. Splitting by street is **partitioning by host**.',
      body: [
        'One frontier and one bloom filter do not stretch to 10K pages/s at peak. We hash each **host** onto a ring of crawler nodes (the consistent hashing lesson).',
        'A node owns its hosts\' back queues, robots cache, URL filter slice and politeness clock, so politeness needs no coordination. A link to a host owned by another node is forwarded there in batches. Keep the fetchers stateless.',
      ],
      keyIdea: 'Hash hosts, not URLs, onto nodes: each node owns its hosts\' queue and fetch clock.',
      metrics: { rate: '10K/s peak', bw: '~5 Gbps peak', store: '140 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [
          { ...ring, status: 'active' },
          { id: 'n1', kind: 'block', at: at(-3.6, 3.6), label: 'crawler 1', sub: 'hosts a', icon: 'Download', tint: 'blue', status: 'active', load: 55 },
          { id: 'n2', kind: 'block', at: at(0, 3.6), label: 'crawler 2', sub: 'hosts b', icon: 'Download', tint: 'blue', status: 'active', load: 55 },
          { id: 'n3', kind: 'block', at: at(3.6, 3.6), label: 'crawler 3', sub: 'hosts c', icon: 'Download', tint: 'blue', status: 'active', load: 55 },
        ],
        links: [link('ring', 'n1', { style: 'faint' }), link('ring', 'n2', { style: 'faint' }), link('ring', 'n3', { style: 'faint' }), link('n1', 'n2', { style: 'dashed', arrow: 'both', label: 'forward links' })],
        flows: [
          { path: ['ring', 'n1'], tone: 'request', label: 'a.example', duration: 1 },
          { path: ['ring', 'n2'], tone: 'request', label: 'b.example', duration: 1, delay: 0.3 },
          { path: ['ring', 'n3'], tone: 'request', label: 'c.example', duration: 1, delay: 0.6 },
          { path: ['n1', 'n2'], tone: 'event', label: 'link to b.example', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'A node owns, per host',
          icon: 'Split',
          rows: [
            { text: 'Back queue', value: 'owned' },
            { text: 'robots cache', value: 'owned' },
            { text: 'URL filter slice', value: 'owned' },
            { text: 'Politeness clock', value: 'owned', tone: 'good' },
          ],
          footer: { text: 'No cross-node coordination for politeness', tone: 'good' },
        },
        caption: 'One owner per host',
      },
    },
    {
      title: 'Node failure',
      tag: 'case',
      heading: 'Case: a crawler dies at 3 AM',
      eli5: 'When a team gets sick, the neighbors take its streets, using the team\'s saved to-visit board. A few houses get visited twice, which does no harm.',
      body: [
        'Crawler 2 loses its disk. Each node checkpoints its frontier and filter slice to object storage every few minutes. The failure detector (the failure detection lesson) removes node 2 from the ring and its hosts move to the next nodes, which load its last checkpoint.',
        'URLs fetched since the checkpoint are fetched again: at-least-once, which the dedup stages absorb. Only node 2\'s hosts move, about a third with three nodes and much less with thirty.',
      ],
      keyIdea: 'Checkpoint the frontier, and let consistent hashing move only the failed node\'s hosts.',
      metrics: { rate: '10K/s peak', bw: '~5 Gbps peak', store: '140 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      metricTones: { rate: 'warn' },
      scene: {
        nodes: [
          { ...ring },
          { id: 'n1', kind: 'block', at: at(-3.6, 3.6), label: 'crawler 1', sub: 'hosts a', icon: 'Download', tint: 'blue', status: 'active', load: 75, badge: '+ half of 2' },
          { id: 'n2', kind: 'block', at: at(0, 3.6), label: 'crawler 2', sub: 'hosts b', icon: 'Download', tint: 'gray', status: 'down', badge: 'disk failed' },
          { id: 'n3', kind: 'block', at: at(3.6, 3.6), label: 'crawler 3', sub: 'hosts c', icon: 'Download', tint: 'blue', status: 'active', load: 75, badge: '+ half of 2' },
          { ...ckpt, status: 'active' },
        ],
        links: [
          link('ring', 'n2', { style: 'faint' }),
          link('ckpt', 'n1', { style: 'dashed' }),
          link('ckpt', 'n3', { style: 'dashed' }),
        ],
        flows: [
          { path: ['ring', 'n2'], tone: 'error', label: 'removed', duration: 1 },
          { path: ['ckpt', 'n1'], tone: 'data', label: 'load node 2 frontier', duration: 1.4, delay: 1.1 },
          { path: ['ckpt', 'n3'], tone: 'data', duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Activity',
          rows: [
            { text: 'Checkpoint interval', value: '5 min' },
            { text: 'Hosts that move', value: "node 2's only", tone: 'good' },
            { text: 'Re-fetched URLs', value: 'since checkpoint', tone: 'warn' },
            { text: 'Delivery', value: 'at-least-once' },
          ],
          footer: { text: 'Dedup absorbs the repeats', tone: 'good' },
        },
        caption: 'Only the dead node\'s hosts move',
      },
    },
    {
      title: 'Extensibility',
      tag: 'concept',
      heading: 'Plug in new content types as new modules',
      eli5: 'The same team can learn a new job. A different surveyor takes photos of paintings, and another watches for copies of a famous painting. The board and the albums stay the same.',
      body: [
        'Systems evolve, so the crawler is built from pluggable stages. A **PNG downloader** reuses the frontier, politeness and store, and swaps only the fetch and parse logic.',
        'A **web monitor** module reads the same parsed pages to find copyright and trademark infringements. New modules read from and write to the same queues.',
      ],
      keyIdea: 'Keep the stages behind queues and interfaces, so a new content type is a new module, not a new crawler.',
      metrics: { rate: '5,800/s', bw: '~3 Gbps', store: '140 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [
          frontier,
          { ...fetchers, label: 'HTML fetcher', status: 'ok' },
          { id: 'png', kind: 'block', at: at(0, -3.6), label: 'PNG fetcher', sub: 'new module', icon: 'Package', tint: 'amber', status: 'active' },
          parser,
          { id: 'monitor', kind: 'block', at: at(7.2, -3.6), label: 'web monitor', sub: 'new module', icon: 'Activity', tint: 'green', status: 'active' },
        ],
        links: [link('frontier', 'fetchers'), link('frontier', 'png'), link('fetchers', 'parser'), link('png', 'parser'), link('parser', 'monitor')],
        flows: [
          { path: ['frontier', 'fetchers', 'parser'], tone: 'request', label: 'HTML', duration: 1.6 },
          { path: ['frontier', 'png', 'parser'], tone: 'data', label: '.png', duration: 1.6, delay: 1.7 },
          { path: ['parser', 'monitor'], tone: 'event', label: 'copyright check', duration: 1.2, delay: 3.4 },
        ],
        panel: {
          title: 'Modules plugged in',
          icon: 'Plug',
          rows: [
            { text: 'HTML fetcher', value: 'built in' },
            { text: 'PNG fetcher', value: 'new, same queues', tone: 'good' },
            { text: 'Web monitor', value: 'new, reads parsed pages', tone: 'good' },
          ],
        },
        caption: 'New stages join the existing pipeline',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A polite, deduplicating loop that never stops',
      eli5: 'Teams of surveyors take addresses from the **to-visit board**, read door signs, copy new notes once, skip addresses already done, revisit busy houses often, and stay out of endless mazes.',
      body: [
        'Seeds start a pipeline: a **frontier** with priority queues in front and per-host politeness queues behind, async fetchers with robots.txt and DNS caches, parsers, a content fingerprint check, URL normalization with a **bloom filter**, and back to the frontier.',
        'Adaptive recrawl and conditional GETs keep 15B pages fresh within ~3 Gbps. Host budgets defuse traps. Partitioning by host with checkpoints lets the crawl pass 10K pages/s and survive a dead node.',
      ],
      keyIdea: 'Everything in a crawler is keyed by host: politeness, partitioning, budgets and trap detection.',
      metrics: { rate: '5,800/s avg, 10K peak', bw: '~3 Gbps', store: '140 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      metricTones: { rate: 'good', bw: 'good', store: 'good', dupes: 'good' },
      scene: {
        nodes: [
          { ...seeds },
          { ...frontier, status: 'ok' },
          { ...fetchers, status: 'ok' },
          { ...web },
          { ...parser, status: 'ok' },
        ],
        links: [...loop, link('fetchers', 'parser')],
        flows: [
          { path: ['seeds', 'frontier', 'fetchers', 'web'], tone: 'request', duration: 2 },
          { path: ['web', 'fetchers', 'parser'], tone: 'data', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'The crawler in numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Pages', value: '15B, monthly' },
            { text: 'Rate', value: '5,800/s, 10K peak', tone: 'good' },
            { text: 'Bandwidth', value: '~3 Gbps', tone: 'good' },
            { text: 'Bloom filter', value: '36 GB' },
            { text: 'Duplicates kept', value: '< 1%', tone: 'good' },
          ],
        },
        caption: 'Seed, fetch, parse, check, enqueue',
      },
      quiz: {
        question: 'Why does the crawler hash hosts, rather than individual URLs, onto crawler nodes?',
        options: [
          'Hosts are shorter strings, so hashing is faster',
          'One node then owns each host\'s queue and fetch clock, so politeness needs no cross-node coordination',
          'It makes the bloom filter false positive rate lower',
          'URLs cannot be hashed consistently',
        ],
        answer: 1,
        explain: 'If URLs from one host were spread over many nodes, every node would need to agree on when that host was last hit. Owning a host on one node keeps its rate limit, robots cache and budget local.',
      },
    },
  ],
};
