import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (u = x - y) and screen row (v = x + y). */
const p = (u: number, v: number): [number, number] => [(u + v) / 2, (v - u) / 2];

// Bottom row: the fetch side.
const seeds: SceneNode = { id: 'seeds', kind: 'storage', at: p(-9, 3.5), label: 'seed URLs', sub: 'curated + sitemaps' };
const frontier: SceneNode = { id: 'frontier', kind: 'queue', at: p(-6, 3.5), label: 'URL frontier', sub: 'priority + politeness' };
const fetchers: SceneNode = { id: 'fetchers', kind: 'worker', at: p(-3, 3.5), label: 'fetchers', sub: 'async HTTP' };
const web: SceneNode = { id: 'web', kind: 'internet', at: p(0, 3.5), label: 'the web', sub: '~15B pages' };
const robots: SceneNode = { id: 'robots', kind: 'cache', at: p(3, 3.5), label: 'robots cache', sub: 'per host, 24 h' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: p(6, 3.5), label: 'DNS cache', sub: 'local resolver' };

// Top row: the processing side, flowing back to the frontier.
const urlDb: SceneNode = { id: 'urlDb', kind: 'db', at: p(-9, -3.5), label: 'URL table', sub: 'sharded by host' };
const urlSeen: SceneNode = { id: 'urlSeen', kind: 'search', at: p(-6, -3.5), label: 'URL seen?', sub: 'bloom filter' };
const links: SceneNode = { id: 'links', kind: 'service', at: p(-3, -3.5), label: 'link extractor', sub: 'normalize + filter' };
const dedup: SceneNode = { id: 'dedup', kind: 'limiter', at: p(0, -3.5), label: 'content seen?', sub: 'fingerprints' };
const parser: SceneNode = { id: 'parser', kind: 'worker', at: p(3, -3.5), label: 'parser', sub: 'HTML to text + links' };
const store: SceneNode = { id: 'store', kind: 'storage', at: p(6, -3.5), label: 'page store', sub: 'compressed segments' };

// Version one and failure scenes.
const box: SceneNode = { id: 'box', kind: 'server', at: p(-4, 3.5), label: 'crawler box', sub: 'one loop, one queue' };
const blog: SceneNode = { id: 'blog', kind: 'server', at: p(3, 3.5), label: 'small blog', sub: '1 cheap server' };
const trap: SceneNode = { id: 'trap', kind: 'server', at: p(3, 3.5), label: 'calendar site', sub: '/cal?month=...' };

const loopLinks = [
  { from: 'seeds', to: 'frontier' },
  { from: 'frontier', to: 'fetchers' },
  { from: 'fetchers', to: 'web' },
  { from: 'fetchers', to: 'parser' },
  { from: 'parser', to: 'dedup' },
  { from: 'parser', to: 'store' },
  { from: 'dedup', to: 'links' },
  { from: 'links', to: 'urlSeen' },
  { from: 'urlSeen', to: 'frontier' },
];

export const designWebCrawler: Lesson = {
  id: 'design-web-crawler',
  title: 'Design a web crawler',
  tagline: 'Download billions of pages, keep them fresh, and stay polite to every site you visit.',
  minutes: 20,
  level: 'Advanced',
  learn: [
    'The crawl loop: seeds, frontier, fetchers, parser, dedup and back again',
    'A URL frontier with priority queues in front and one politeness queue per host',
    'robots.txt, DNS caching and fetcher limits that keep the loop moving',
    'Content fingerprints and a bloom filter to skip duplicate pages and URLs',
    'Recrawl scheduling, spider traps, and spreading the crawl over many machines',
  ],
  metrics: [
    { key: 'rate', label: 'Pages/s' },
    { key: 'bw', label: 'Bandwidth' },
    { key: 'store', label: 'New storage' },
    { key: 'dupes', label: 'Dup pages kept' },
    { key: 'fresh', label: 'Revisit cycle' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Fifteen billion pages, revisited every month',
      eli5: 'A team of surveyors must visit every house in a giant country and copy the notes on each door. Every note lists more houses to visit. Doing that again each month without bothering anyone is **crawling**.',
      body: [
        'The crawler feeds a search index. Scope: HTML pages only, about **15 billion** of them, each revisited on average once a month. It must respect site owners (robots.txt and a gentle request rate), skip duplicates, avoid traps, and keep running when machines die.',
        'The numbers: 15B pages / 30 days = **500M pages a day**, about **5,800 per second** on average and 10K at peak. An average page is about 100 KB raw, so the fetchers pull 580 MB/s, about **4.6 Gbps**. Compressed to ~20 KB, the store grows by about **300 TB a month**, and keeping a few versions puts the archive around a petabyte (the napkin math lesson).',
        'Latency does not matter here. Throughput, politeness and coverage do. No single page is urgent, but the whole job must never fall behind.',
      ],
      keyIdea: 'A crawler is a throughput machine with manners. 5,800 pages per second, and never too many on one site.',
      metrics: { rate: '5,800/s target', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '-', fresh: '30 d target' },
      scene: {
        nodes: [{ ...seeds, status: 'active' }, { ...fetchers, status: 'active', badge: '5,800 pages/s' }, { ...web, badge: '15B pages' }],
        links: [{ from: 'seeds', to: 'fetchers' }, { from: 'fetchers', to: 'web' }],
        flows: [
          { path: ['seeds', 'fetchers'], tone: 'request', label: 'start here', duration: 1 },
          { path: ['fetchers', 'web'], tone: 'request', label: 'GET', count: 4, duration: 1, delay: 1 },
          { path: ['web', 'fetchers'], tone: 'response', label: 'HTML + links', count: 4, duration: 1, delay: 2.1 },
        ],
        caption: 'Every page fetched hands back more URLs to fetch',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Interfaces, a URL table and a page store',
      eli5: 'The surveyors keep two things: a big **address book** with one line per house (when we visited, when to go back), and a photo archive of every note they copied.',
      body: [
        'There is no public API. The internal interfaces are small: `frontier.add(urls, priority)` and `frontier.next(worker)` for the queue, `fetch(url) → status, headers, body`, and `store.put(fingerprint, body)`. Each step is a separate service, so parsers and fetchers scale on their own.',
        'The **URL table** has one row per known URL: a hash of the normalized URL as key, the URL, its host, last fetch time, next due time, HTTP status, ETag, content fingerprint and a priority score. At 15B rows and about 200 bytes each it is ~3 TB, so it is sharded by host (the sharding lesson) in a wide-column store.',
        'Page bodies go to **object storage** (the object storage lesson). Writing billions of 20 KB objects one by one is slow and costly, so pages are appended to ~1 GB compressed segment files, and the URL table stores the segment id and offset for each page.',
      ],
      keyIdea: 'Metadata per URL lives in a sharded table. Page bodies are batched into big compressed files in object storage.',
      metrics: { rate: '5,800/s target', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '-', fresh: '30 d target' },
      scene: {
        nodes: [{ ...urlDb, status: 'active', badge: '15B rows · 3 TB' }, frontier, fetchers, { ...store, status: 'active', badge: '1 GB segments' }],
        links: [
          { from: 'urlDb', to: 'frontier' },
          { from: 'frontier', to: 'fetchers' },
          { from: 'fetchers', to: 'store' },
          { from: 'fetchers', to: 'urlDb', style: 'dashed' },
        ],
        flows: [
          { path: ['urlDb', 'frontier'], tone: 'data', label: 'due URLs', duration: 1.2 },
          { path: ['frontier', 'fetchers'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['fetchers', 'store'], tone: 'data', label: 'append body', duration: 1.4, delay: 2.4 },
          { path: ['fetchers', 'urlDb'], tone: 'event', label: 'last_fetch, etag, offset', duration: 1.4, delay: 2.4 },
        ],
        caption: 'Small rows in a table, big bodies in files',
      },
    },
    {
      title: 'Simple design',
      tag: 'case',
      heading: 'Version one: a loop on one machine',
      eli5: 'One surveyor with one list walks to a house, copies the note, and adds its addresses to the list. He is slow, and since notes mostly list the same street, he knocks on one family\'s door a hundred times in a row.',
      body: [
        'The textbook version is breadth-first search: a queue of URLs, a set of visited URLs, and a loop that pops a URL, downloads it, extracts links and pushes the new ones. It works for a few thousand pages.',
        'It breaks three ways at once. **Speed**: fetches take about half a second each, and one box doing a few dozen at a time manages ~40 pages/s, so one pass over 15B pages would take about **12 years**. **Memory**: the visited set of 15B URLs needs over a terabyte. **Manners**: most links on a page point to the same site, so BFS hits that host back to back. A small blog on one cheap server sees hundreds of requests per second, slows to a crawl, and its owner blocks us.',
        'The fixes come one at a time: split the loop into a pipeline, add a frontier that knows about hosts, then add dedup and scheduling.',
      ],
      keyIdea: 'A single BFS loop is too slow, runs out of memory, and hammers whichever site it is currently reading.',
      metrics: { rate: '40/s', bw: '0.03 Gbps', store: '-', dupes: '-', fresh: '~12 years' },
      scene: {
        nodes: [seeds, { ...box, status: 'hot', badge: '1 TB visited set' }, { ...web, status: 'active' }, { ...blog, status: 'down', badge: '300 req/s from us' }],
        links: [{ from: 'seeds', to: 'box' }, { from: 'box', to: 'web' }, { from: 'web', to: 'blog' }],
        flows: [
          { path: ['seeds', 'box'], tone: 'request', duration: 1 },
          { path: ['box', 'web', 'blog'], tone: 'request', label: 'same host again', count: 6, duration: 1.2, delay: 1 },
          { path: ['blog', 'web', 'box'], tone: 'error', label: '429 / blocked', duration: 1.2, delay: 2.6 },
        ],
        caption: 'Breadth-first on one box is slow and rude',
      },
    },
    {
      title: 'The pipeline',
      tag: 'concept',
      heading: 'Split the loop into a pipeline of stages',
      eli5: 'Now there is a team. Some surveyors only walk and copy, some only read notes, some check for repeats, and one keeps the **to-visit board**. Each job has as many people as it needs.',
      body: [
        '**Seeds** start the crawl: a curated list of popular sites across countries and topics, plus every sitemap we know. From there the loop runs as stages connected by queues (the message queues lesson). The **frontier** hands URLs to **fetchers**, which download pages and pass them to **parsers**. Parsers check validity, extract text and links, and send the page to a **content seen?** check and the page store. Extracted links are normalized, filtered and checked against **URL seen?** before entering the frontier.',
        'Each stage scales by itself. Fetchers are I/O bound: at ~0.5 s per fetch, 5,800 pages/s means about 2,900 open requests, which async I/O spreads over a handful of machines. Parsers are CPU bound and need a few dozen cores. The stages talk in batches of hundreds of URLs, not one at a time.',
        'This reaches the target rate. It also exposes the next problems: duplicate content, duplicate URLs, and a frontier that still has no idea about hosts or importance.',
      ],
      keyIdea: 'Break the crawl into stages joined by queues, so I/O-bound fetching and CPU-bound parsing scale separately.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [seeds, { ...frontier, status: 'active' }, { ...fetchers, status: 'active', badge: '~2,900 in flight' }, web, { ...parser, status: 'active' }, store, dedup, links, urlSeen],
        links: [...loopLinks, { from: 'fetchers', to: 'web' }],
        flows: [
          { path: ['seeds', 'frontier', 'fetchers'], tone: 'request', duration: 1.4 },
          { path: ['fetchers', 'web', 'fetchers'], tone: 'request', label: 'GET', duration: 1.2, delay: 1.4 },
          { path: ['fetchers', 'parser'], tone: 'data', label: 'HTML', duration: 1.2, delay: 2.7 },
          { path: ['parser', 'store'], tone: 'data', duration: 1, delay: 4 },
          { path: ['parser', 'dedup', 'links', 'urlSeen', 'frontier'], tone: 'event', label: 'new URLs', duration: 2.4, delay: 4 },
        ],
        caption: 'Fetch, parse, check, enqueue: a loop of stages',
      },
    },
    {
      title: 'Frontier',
      tag: 'concept',
      heading: 'The frontier: priority in front, one queue per host behind',
      eli5: 'The to-visit board has two parts. First, important houses go to the top of the **board**. Then each street gets its own line, and a surveyor may knock on a street only once every few minutes.',
      body: [
        'The frontier decides two things: what to fetch first, and when a host may be fetched again. **Front queues** handle priority. A prioritizer scores each URL from link-based importance, the site\'s quality, how often the page changes and its depth from a seed, then drops it into one of a few priority queues. A selector pulls from them with a bias toward the high ones.',
        '**Back queues** handle politeness. Each holds URLs for a single host, and a heap keyed on "next allowed time" says which host is free. After each fetch the host waits at least 2 seconds, or 10 times its last response time, or its robots.txt crawl delay, whichever is longest. At 5,800 pages/s with one fetch per host every few seconds, about 20K hosts are in rotation at any moment.',
        'Billions of URLs do not fit in RAM, so the frontier lives on disk, with in-memory buffers at the head (to dequeue fast) and the tail (to batch writes).',
      ],
      keyIdea: 'Priority decides what is worth fetching. Per-host queues with a next-allowed time decide when it is polite to fetch it.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [{ ...urlDb, badge: 'priority scores' }, { ...frontier, status: 'active', badge: '~20K hosts in rotation' }, { ...fetchers, status: 'ok' }, { ...web, status: 'ok', badge: '1 req / host / 2 s' }],
        links: [
          { from: 'urlDb', to: 'frontier' },
          { from: 'frontier', to: 'fetchers' },
          { from: 'fetchers', to: 'web' },
        ],
        flows: [
          { path: ['urlDb', 'frontier'], tone: 'data', label: 'high priority first', duration: 1.2 },
          { path: ['frontier', 'fetchers'], tone: 'request', label: 'host free now', count: 3, duration: 1, delay: 1.3 },
          { path: ['fetchers', 'web'], tone: 'request', label: 'one per host', count: 3, duration: 1.2, delay: 2.4 },
        ],
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
    },
    {
      title: 'Robots + DNS',
      tag: 'concept',
      heading: 'robots.txt, a DNS cache and fetchers with limits',
      eli5: 'Some doors carry a sign: "please skip the back garden". That sign is **robots.txt**. Surveyors read it once a day and remember it, and they keep their own phone book instead of calling the operator for every address.',
      body: [
        'Before fetching from a host, the fetcher reads its **robots.txt** and obeys its `Disallow` rules for our user agent. Some sites also set a non-standard `Crawl-delay`, which feeds the politeness wait. The file is cached per host for about a day. A missing file (404) means everything is allowed. A server error means we treat the whole site as off limits for now and retry later.',
        '**DNS** is a hidden bottleneck. A lookup can take tens to hundreds of milliseconds, and many resolver libraries block a thread while they wait. Each crawler node runs a local caching resolver (the DNS lesson), honors TTLs and resolves the hosts at the head of the frontier ahead of time.',
        'Fetchers use async I/O, a 10 s timeout, a 5 MB body cap, at most 5 redirects, and accept compressed responses. Fetchers in several regions crawl the hosts near them, which cuts round trips.',
      ],
      keyIdea: 'Cache robots.txt and DNS per host, and bound every fetch with timeouts and size caps so slow sites cannot stall the loop.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '300 TB/mo', dupes: '~30%', fresh: '30 d' },
      scene: {
        nodes: [frontier, { ...fetchers, status: 'active' }, web, { ...robots, status: 'ok', badge: 'Disallow: /cart' }, { ...dns, status: 'ok', badge: '99% cache hits' }],
        links: [
          { from: 'frontier', to: 'fetchers' },
          { from: 'fetchers', to: 'web' },
          { from: 'fetchers', to: 'robots', style: 'dashed' },
          { from: 'fetchers', to: 'dns', style: 'dashed' },
        ],
        flows: [
          { path: ['frontier', 'fetchers'], tone: 'request', label: 'shop.example/products/7', duration: 1 },
          { path: ['fetchers', 'robots', 'fetchers'], tone: 'handshake', label: 'allowed?', duration: 1.4, delay: 1.1 },
          { path: ['fetchers', 'dns', 'fetchers'], tone: 'handshake', label: 'IP from cache', duration: 1.6, delay: 2.6 },
          { path: ['fetchers', 'web'], tone: 'request', label: 'GET /products/7', duration: 1, delay: 4.3 },
        ],
        caption: 'Ask permission, look up the address, then fetch',
      },
    },
    {
      title: 'Content seen?',
      tag: 'concept',
      heading: 'Skip pages we already have, even under another URL',
      eli5: 'Many houses have the exact same note pinned up, copied from a neighbor. Before filing a photo, the surveyor checks its short **fingerprint** against the archive and skips repeats.',
      body: [
        'A large share of the web is duplicate: mirrors, `http` and `https` copies, print versions, the same article syndicated on many sites. Studies have found it near a third. Storing and indexing those copies wastes disk, CPU and index quality.',
        'For **exact duplicates**, hash the normalized text and look the fingerprint up in a table keyed by hash. For **near duplicates**, where only an ad slot or a date differs, use a **simhash**: a 64-bit fingerprint where similar documents differ in only a few bits. Two pages within 3 bits are treated as copies. To find candidates among billions, split the 64 bits into 4 blocks of 16 and index each block. Two fingerprints within 3 bits must match exactly on at least one block.',
        'A duplicate page is still fetched once, since we cannot know before downloading. We skip storing it again and skip its outlinks, which cuts a lot of downstream work. Its URL row points at the canonical copy.',
      ],
      keyIdea: 'Fingerprint every page: an exact hash for copies, a simhash for near copies. Store and expand each piece of content once.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '30 d' },
      scene: {
        nodes: [fetchers, { ...parser, status: 'active' }, { ...dedup, status: 'active', badge: 'simhash within 3 bits' }, { ...store, status: 'ok', badge: '-30% writes' }, { ...links, status: 'dim' }],
        links: [
          { from: 'fetchers', to: 'parser' },
          { from: 'parser', to: 'dedup' },
          { from: 'parser', to: 'store' },
          { from: 'dedup', to: 'links' },
        ],
        flows: [
          { path: ['fetchers', 'parser'], tone: 'data', label: 'mirror of a news story', duration: 1.2 },
          { path: ['parser', 'dedup'], tone: 'request', label: 'fingerprint?', duration: 1, delay: 1.3 },
          { path: ['dedup', 'parser'], tone: 'error', label: 'seen: skip', duration: 1, delay: 2.4 },
          { path: ['parser', 'store'], tone: 'data', label: 'only new content', duration: 1.2, delay: 3.6 },
        ],
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
      heading: 'A bloom filter for 30 billion URLs',
      eli5: 'Before writing an address on the board, the surveyor checks a wall of tiny lamps, the **bloom filter**. If any of its lamps is dark, the address is new. If all are lit, he skips it, and once in a while that skip is a mistake.',
      body: [
        'Every parsed page yields dozens of links, and most point to URLs we already know. First, **normalize**: lowercase the scheme and host, drop default ports and `#fragments`, sort query parameters and strip tracking and session ids. Otherwise one page shows up under a hundred spellings.',
        'Then ask "seen before?". An exact set of 30B URL hashes (room for growth over today\'s 15B) needs hundreds of gigabytes. A **bloom filter** (the bloom filters lesson) at a 1% false positive rate needs about 9.6 bits per URL: roughly **36 GB**, split across crawler nodes by host.',
        'The filter never says "new" for a URL it has seen, so we never enqueue a duplicate. About 1 in 100 truly new URLs is wrongly skipped. For a crawler that is acceptable: an important page is linked from many places, and sitemaps catch the rest on the next pass.',
      ],
      keyIdea: 'Normalize URLs, then use a bloom filter: no duplicates enter the frontier, and a small, known share of new URLs is missed.',
      metrics: { rate: '5,800/s', bw: '4.6 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '30 d' },
      scene: {
        nodes: [parser, dedup, { ...links, status: 'active', badge: '40 links/page' }, { ...urlSeen, status: 'active', badge: '36 GB · 1% FP' }, { ...frontier, status: 'ok' }],
        links: [
          { from: 'parser', to: 'dedup' },
          { from: 'dedup', to: 'links' },
          { from: 'links', to: 'urlSeen' },
          { from: 'urlSeen', to: 'frontier' },
        ],
        flows: [
          { path: ['parser', 'dedup', 'links'], tone: 'data', label: 'new content', duration: 1.4 },
          { path: ['links', 'urlSeen'], tone: 'request', label: '40 normalized URLs', count: 4, duration: 1, delay: 1.5 },
          { path: ['urlSeen', 'frontier'], tone: 'event', label: '3 are new', duration: 1.2, delay: 2.7 },
        ],
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
      title: 'Recrawl',
      tag: 'tradeoff',
      heading: 'Freshness: revisit each page as often as it changes',
      eli5: 'A bakery changes its door note every morning, and an old church never changes. Surveyors visit the bakery daily and the church a few times a year. Matching visits to change is the **revisit schedule**.',
      body: [
        'A flat 30-day cycle wastes effort both ways. A news homepage changes every few minutes and is stale for most of the month, while an archived manual is fetched 12 times a year for nothing. Bandwidth is the budget, so spend it where pages change and where pages matter.',
        'Each URL row keeps a **revisit interval**. If the page changed since the last fetch (new fingerprint), halve the interval. If it did not, grow it by half. Bound it between 1 hour and 90 days, and scale it by priority so important pages are checked sooner. Sitemaps with `lastmod` dates and RSS feeds give hints for free.',
        'Recrawls use **conditional GETs** with `If-None-Match` (the stored ETag) or `If-Modified-Since`. An unchanged page answers `304 Not Modified` with no body. When a large share of recrawls are unchanged, bandwidth drops from 4.6 to about 3 Gbps with the same page rate.',
      ],
      keyIdea: 'Adapt each page\'s revisit interval to how often it changes and how much it matters, and use conditional GETs to make unchanged checks cheap.',
      metrics: { rate: '5,800/s', bw: '~3 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [{ ...urlDb, status: 'active', badge: 'next_due per URL' }, { ...frontier, status: 'active' }, fetchers, { ...web, status: 'ok', badge: '304 Not Modified' }, store],
        links: [
          { from: 'urlDb', to: 'frontier' },
          { from: 'frontier', to: 'fetchers' },
          { from: 'fetchers', to: 'web' },
          { from: 'fetchers', to: 'store' },
        ],
        flows: [
          { path: ['urlDb', 'frontier'], tone: 'data', label: 'news page due (1 h)', duration: 1.2 },
          { path: ['frontier', 'fetchers', 'web'], tone: 'request', label: 'If-None-Match', duration: 1.6, delay: 1.3 },
          { path: ['web', 'fetchers'], tone: 'response', label: '304, no body', duration: 1, delay: 3 },
          { path: ['fetchers', 'urlDb'], tone: 'event', label: 'unchanged: interval x1.5', duration: 1.4, delay: 4.1 },
        ],
        caption: 'Check often where pages change, rarely where they do not',
      },
    },
    {
      title: 'Spider traps',
      tag: 'case',
      heading: 'Case: an endless calendar eats a fifth of the crawl',
      eli5: 'One street is a magic maze: every door\'s note points to a newer door, forever. Surveyors could walk it until the end of time. That maze is a **spider trap**, so each street gets a visit limit.',
      body: [
        'A monitoring alert fires: one host has 900 million URLs in the frontier and takes 20% of fetches. It is a calendar where every page links to "next month", from year 2026 to year 9999. Other traps look similar: session ids in every link, `/a/b/a/b/a/b` path loops from relative links, or faceted search with millions of filter combinations.',
        'Defenses stack. Cap URL length (around 2,000 characters) and path depth. Flag repeating path segments. Give each host a **crawl budget** scaled by its importance, so a small site cannot claim billions of slots. When the pages a host returns are mostly near duplicates, lower its priority on its own. Add a manual blocklist for the rest (the observability lesson pays off here: per-host dashboards are how this gets noticed).',
        'Bad content needs limits too: servers that dribble one byte per second (timeouts), 2 GB "pages" (size caps), soft 404s that return 200 with an error page (detected by fingerprint), and spam or malware farms (blocklists fed by the indexing side).',
      ],
      keyIdea: 'Assume some of the web is infinite or hostile. Cap URLs, budget each host, and watch per-host stats to catch what rules miss.',
      metrics: { rate: '5,800/s (20% on 1 host)', bw: '~3 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [{ ...frontier, status: 'hot', badge: '900M URLs, 1 host' }, { ...fetchers, status: 'hot' }, web, { ...trap, status: 'hot', badge: 'next month, forever' }, { ...links, status: 'active', badge: 'host budget hit' }, urlSeen],
        links: [
          { from: 'frontier', to: 'fetchers' },
          { from: 'fetchers', to: 'web' },
          { from: 'web', to: 'trap' },
          { from: 'links', to: 'urlSeen' },
          { from: 'urlSeen', to: 'frontier' },
          { from: 'fetchers', to: 'links', style: 'faint' },
        ],
        flows: [
          { path: ['frontier', 'fetchers', 'web', 'trap'], tone: 'request', label: '/cal?month=9998-04', count: 3, duration: 1.8 },
          { path: ['trap', 'web', 'fetchers', 'links'], tone: 'error', label: 'one more link', duration: 1.8, delay: 1.9 },
          { path: ['links', 'urlSeen'], tone: 'error', label: 'dropped: over budget', duration: 1, delay: 3.8 },
        ],
        caption: 'An infinite site meets a finite budget',
      },
    },
    {
      title: 'Scale out',
      tag: 'case',
      heading: 'Case: billions of pages on many nodes, and one dies',
      eli5: 'The country is split into regions, one surveyor team each, and a team owns every house on its streets. When a team gets sick, the neighbors take its streets, using the saved to-visit board. Splitting by street is **partitioning by host**.',
      body: [
        'One frontier and one bloom filter do not stretch to 10K pages/s at peak. We partition by **host**: hash each host onto a ring of crawler nodes (the consistent hashing lesson). A node owns its hosts\' back queues, robots cache, URL filter slice and politeness clock, so politeness needs no coordination. A link to a host owned by another node is forwarded there in batches.',
        'Node 2 loses its disk at 3 AM. Each node checkpoints its frontier and filter slice to object storage every few minutes. The failure detector (the failure detection lesson) removes node 2 from the ring, its hosts move to the next nodes, and they load its last checkpoint. URLs fetched since that checkpoint are fetched again: at-least-once, which the dedup stages already absorb.',
        'Consistent hashing means only node 2\'s hosts move, about a third of them with three nodes and much less with thirty. The URL table and page store are already sharded and replicated, so they do not notice.',
      ],
      keyIdea: 'Partition everything by host, checkpoint the frontier, and let consistent hashing move only the failed node\'s hosts.',
      metrics: { rate: '10K/s peak', bw: '~5 Gbps peak', store: '210 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [
          { id: 'ring', kind: 'ring', at: p(-4.5, -3.5), label: 'host ring', sub: 'hash(host)' },
          { id: 'n1', kind: 'worker', at: p(-6, 3.5), label: 'crawler 1', sub: 'hosts a', status: 'active', badge: '+ half of 2' },
          { id: 'n2', kind: 'worker', at: p(-3, 3.5), label: 'crawler 2', sub: 'hosts b', status: 'down', badge: 'disk failed' },
          { id: 'n3', kind: 'worker', at: p(0, 3.5), label: 'crawler 3', sub: 'hosts c', status: 'active', badge: '+ half of 2' },
          { id: 'ckpt', kind: 'storage', at: p(1.5, -3.5), label: 'checkpoints', sub: 'every 5 min' },
          { ...web, at: p(3, 3.5) },
        ],
        links: [
          { from: 'ring', to: 'n1', style: 'faint' },
          { from: 'ring', to: 'n2', style: 'faint' },
          { from: 'ring', to: 'n3', style: 'faint' },
          { from: 'ckpt', to: 'n1', style: 'dashed' },
          { from: 'ckpt', to: 'n3', style: 'dashed' },
          { from: 'n1', to: 'web' },
          { from: 'n3', to: 'web' },
        ],
        flows: [
          { path: ['ring', 'n2'], tone: 'error', label: 'removed', duration: 1 },
          { path: ['ckpt', 'n1'], tone: 'data', label: 'load node 2 frontier', duration: 1.4, delay: 1.1 },
          { path: ['ckpt', 'n3'], tone: 'data', duration: 1.4, delay: 1.1 },
          { path: ['n1', 'web'], tone: 'request', count: 3, duration: 1.4, delay: 2.7 },
          { path: ['n3', 'web'], tone: 'request', count: 3, duration: 1.2, delay: 2.7 },
        ],
        caption: 'Only the dead node\'s hosts move',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A polite, deduplicating loop that never stops',
      eli5: 'Teams of surveyors take addresses from the **to-visit board**, read door signs, copy new notes once, skip addresses already done, revisit busy houses often, and stay out of endless mazes.',
      body: [
        'Seeds start a pipeline of stages: a **frontier** with priority queues in front and per-host politeness queues behind, async fetchers with robots.txt and DNS caches, parsers, a content fingerprint check (exact hash plus simhash), URL normalization with a **bloom filter**, and back to the frontier. Metadata lives in a host-sharded URL table and bodies in big compressed segments in object storage.',
        'Adaptive recrawl intervals and conditional GETs keep 15B pages fresh within ~3 Gbps. Length caps, host budgets and per-host monitoring defuse spider traps. Partitioning by host on a consistent hash ring, with frontier checkpoints, lets the crawl grow past 10K pages/s and survive a dead node.',
      ],
      keyIdea: 'Everything in a crawler is keyed by host: politeness, partitioning, budgets and trap detection.',
      metrics: { rate: '5,800/s avg, 10K peak', bw: '~3 Gbps', store: '210 TB/mo', dupes: '< 1%', fresh: '1 h to 90 d' },
      scene: {
        nodes: [seeds, frontier, { ...fetchers, status: 'ok' }, web, parser, store, dedup, links, urlSeen],
        links: [...loopLinks, { from: 'fetchers', to: 'web' }],
        flows: [
          { path: ['seeds', 'frontier', 'fetchers', 'web'], tone: 'request', duration: 2 },
          { path: ['web', 'fetchers', 'parser', 'store'], tone: 'data', duration: 2, delay: 2.1 },
          { path: ['parser', 'dedup', 'links', 'urlSeen', 'frontier'], tone: 'event', duration: 2.4, delay: 3.4 },
        ],
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
