import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const crawler: SceneNode = { id: 'crawler', kind: 'block', at: at(-3.6, 0), label: 'crawler', sub: '2,000 URLs/s', icon: 'Search', tint: 'blue' };
const filter: SceneNode = { id: 'filter', kind: 'block', at: at(0, 0), label: 'bloom filter', sub: 'bits in RAM', icon: 'Layers', tint: 'violet' };
const store: SceneNode = { id: 'store', kind: 'db', at: at(3.6, 0), label: 'URL store', sub: 'on disk' };
const crawlLinks = [link('crawler', 'filter'), link('filter', 'store', { style: 'dashed' })];

const app: SceneNode = { id: 'app', kind: 'block', at: at(-3.6, 0), label: 'app server', sub: 'sees every visit', icon: 'Server', tint: 'blue' };
const hll: SceneNode = { id: 'hll', kind: 'block', at: at(3.6, 0), label: 'HyperLogLog', sub: '12 KB', icon: 'Hash', tint: 'green' };

export const probabilisticStructures: Lesson = {
  id: 'probabilistic-structures',
  title: 'Bloom filters and HyperLogLog',
  tagline: 'Trade a small, known error for a huge cut in memory when you ask "have I seen this?", "how many unique?" or "how often?".',
  minutes: 22,
  level: 'Intermediate',
  learn: [
    'Why exact membership and exact unique counts get expensive at scale',
    'How a bloom filter sets and checks bits with several hash functions',
    'Why it can say "maybe" by mistake and can never miss a stored item',
    'How to size a filter: bits per item and number of hashes',
    'Where filters sit: crawlers, caches, LSM stores and column stores',
    'Deletes: counting bloom filters and cuckoo filters',
    'How HyperLogLog counts uniques in kilobytes, and how counters merge',
    'What a count-min sketch adds: how often, and the heavy hitters',
  ],
  metrics: [
    { key: 'items', label: 'Items tracked', icon: 'Database' },
    { key: 'mem', label: 'Memory', icon: 'HardDrive' },
    { key: 'err', label: 'Error', icon: 'Gauge' },
    { key: 'disk', label: 'Disk lookups', icon: 'Search' },
  ],
  steps: [
    {
      title: 'Seen it?',
      tag: 'problem',
      heading: 'One billion URLs and a simple question',
      eli5: 'The librarian wants to know if the library ever had a book. Walking down to the basement shelves for every question takes all day.',
      body: [
        'A web crawler has fetched **1 billion** pages. Every link it finds raises the same question: have I seen this URL before? It asks 2,000 times a second.',
        'The exact answer lives in a URL store on disk. A disk lookup per link is far too slow.',
      ],
      keyIdea: 'Exact membership means asking the slow store every time.',
      metrics: { items: '1 billion', mem: '80 GB on disk', err: '0%', disk: '2,000/s' },
      metricTones: { disk: 'bad' },
      scene: {
        nodes: [
          { ...crawler, status: 'hot', badge: 'seen this URL?', chips: ['GET /cats', 'GET /dogs'] },
          { ...store, at: at(2.4, 0), status: 'hot', load: 95, badge: '80 GB of URLs' },
        ],
        links: [link('crawler', 'store', { label: '2,000 lookups/s', labelTone: 'warn' })],
        flows: [
          { path: ['crawler', 'store'], tone: 'request', label: 'seen /cats?', count: 5, duration: 1.2 },
          { path: ['store', 'crawler'], tone: 'response', label: 'yes / no', duration: 1.4, delay: 1.3 },
        ],
        panel: { title: 'Per link', icon: 'Timer', rows: [{ text: 'Disk lookup', value: '~10 ms', tone: 'bad' }, { text: 'Lookups per second', value: '2,000', tone: 'bad' }], footer: { text: 'One bit of answer, one disk read', tone: 'bad' } },
        caption: 'Every link costs an exact lookup',
      },
    },
    {
      title: 'RAM cost',
      tag: 'problem',
      heading: 'Keeping the answer in memory is also huge',
      eli5: 'The librarian could memorize every book title, but the titles are so many and so long that her head would burst.',
      body: [
        'Keeping every URL in RAM is fast, but at about 80 bytes each that is **80 GB**. Storing only an 8-byte hash per URL in a hash set costs 16 GB or more once you count the table overhead.',
        'Most lookups end in "no, this one is new" or "yes, skip it". We spend tens of gigabytes to produce one bit.',
      ],
      keyIdea: 'Exact membership needs memory in proportion to the data itself. At a billion items that is a lot of RAM for a yes or no.',
      metrics: { items: '1 billion', mem: '16 to 80 GB', err: '0%', disk: '0' },
      metricTones: { mem: 'bad' },
      scene: {
        nodes: [
          { ...crawler },
          { ...filter, label: 'hash set', sub: 'all URLs in RAM', icon: 'Database', tint: 'red', status: 'hot', load: 92, badge: '16 to 80 GB' },
        ],
        links: [link('crawler', 'filter')],
        flows: [{ path: ['crawler', 'filter'], tone: 'request', label: 'seen /cats?', count: 3, duration: 1.2 }],
        panel: {
          title: 'Exact set in RAM',
          icon: 'Table',
          rows: [
            { text: 'Raw URLs, 80 B each', value: '80 GB', tone: 'bad' },
            { text: '8 B hash each, plus overhead', value: '16 GB+', tone: 'warn' },
            { text: 'What we want', value: '1 bit of answer', tone: 'good' },
          ],
        },
        caption: 'Fast, but far too big',
      },
    },
    {
      title: 'Bits and hashes',
      tag: 'concept',
      heading: 'A bloom filter: an array of bits and a few hash functions',
      eli5: 'The **bloom filter** is a long row of lamps by the library door. When a book arrives, the librarian switches on three lamps picked by the book\'s name.',
      body: [
        'A **bloom filter** is an array of `m` bits, all starting at 0, plus `k` hash functions. It never stores the items themselves.',
        'To **add** a URL, hash it `k` times and set those `k` bits to 1. With `k = 3`, `/cats` might set bits 4, 91 and 733. Shared bits are fine. A long URL costs the same three flips as a short one.',
      ],
      keyIdea: 'Adding an item sets k bits chosen by k hashes. The item itself is thrown away.',
      metrics: { items: 'toy, m = 1,024', mem: '-', err: '-', disk: '-' },
      scene: {
        nodes: [{ ...crawler, status: 'active', chips: ['add /cats'] }, { ...filter, status: 'active', badge: 'set bits 4, 91, 733' }, { ...store, status: 'dim' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'data', label: 'add /cats', duration: 1.2 },
          { path: ['crawler', 'filter'], tone: 'data', label: 'h1, h2, h3', count: 3, duration: 1.2, delay: 1.4 },
        ],
        panel: { title: 'Bit array, m = 1,024', icon: 'Binary', code: 'bit   4   91  733\nvalue 0>1 0>1 0>1\n\nh1(/cats) = 4\nh2(/cats) = 91\nh3(/cats) = 733' },
        caption: 'Three hashes, three bits switched on',
      },
      code: {
        language: 'python',
        title: 'A bloom filter in 20 lines',
        source: `import hashlib

class BloomFilter:
    def __init__(self, m_bits, k_hashes):
        self.m, self.k = m_bits, k_hashes
        self.bits = bytearray(m_bits // 8 + 1)

    def _positions(self, item):
        # k positions from two base hashes: h1 + i * h2
        d = hashlib.sha256(item.encode()).digest()
        h1 = int.from_bytes(d[:8], "big")
        h2 = int.from_bytes(d[8:16], "big") | 1
        return [(h1 + i * h2) % self.m for i in range(self.k)]

    def add(self, item):
        for p in self._positions(item):
            self.bits[p // 8] |= 1 << (p % 8)

    def might_contain(self, item):
        return all(self.bits[p // 8] & (1 << (p % 8))
                   for p in self._positions(item))`,
        highlight: [13, 17, 20, 21],
      },
    },
    {
      title: 'Definitely not',
      tag: 'concept',
      heading: 'One zero bit proves the item was never added',
      eli5: 'To check a book, the librarian looks at its three lamps. If even one lamp is dark, the library has never had that book, and nobody walks to the basement.',
      body: [
        'To **check** a URL, hash it the same `k` ways and read those bits. If any one is 0, the URL was never added, because adding it would have set that bit and bits never go back to 0.',
        'So a "no" is always right: **no false negatives**. The crawler treats the URL as new without touching the disk. That is three memory reads, well under a microsecond.',
      ],
      keyIdea: 'A zero bit is proof. When the filter says no, the answer is no.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '0% on "no"', disk: '0 for new URLs' },
      metricTones: { err: 'good', disk: 'good' },
      scene: {
        nodes: [{ ...crawler, status: 'ok', chips: ['GET /birds'], badge: 'new URL, fetch it' }, { ...filter, status: 'ok', badge: 'bit 58 is 0' }, { ...store, status: 'dim' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', label: 'seen /birds?', duration: 1.1 },
          { path: ['filter', 'crawler'], tone: 'response', label: 'definitely not', duration: 1.1, delay: 1.2 },
        ],
        panel: { title: 'Check /birds', icon: 'Search', rows: [{ text: 'bit 12', value: '1' }, { text: 'bit 58', value: '0', tone: 'good' }, { text: 'bit 390', value: '1' }], footer: { text: 'One zero is proof: never added', tone: 'good' } },
        caption: 'A "no" never needs the disk',
      },
    },
    {
      title: 'Probably yes',
      tag: 'case',
      heading: 'Case: three bits set by other URLs',
      eli5: 'Sometimes other books already switched on all three lamps for a book that never arrived. The lamps say "maybe", so the librarian has to check the basement shelves to be sure.',
      body: [
        'The crawler checks `/fish`, never seen. Its bits are 91, 404 and 733. Bits 91 and 733 were set by `/cats`, bit 404 by `/dogs`. All three are 1.',
        'The filter answers "probably yes". This is a **false positive**: shared bits let other items cover for one that was never added, and the filter cannot tell.',
      ],
      keyIdea: 'A "yes" means maybe. False positives happen, false negatives do not.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '~1% on "yes"', disk: 'only on "maybe"' },
      metricTones: { err: 'warn' },
      scene: {
        nodes: [{ ...crawler, status: 'active', chips: ['GET /fish'] }, { ...filter, status: 'hot', badge: '91, 404, 733 all 1' }, { ...store, status: 'active', badge: 'not found' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', label: 'seen /fish?', duration: 1.1 },
          { path: ['filter', 'store'], tone: 'request', label: 'maybe, confirm', duration: 1.2, delay: 1.2 },
          { path: ['store', 'filter', 'crawler'], tone: 'error', label: 'false positive', duration: 1.8, delay: 2.5 },
        ],
        panel: { title: 'Who set the bits', icon: 'Share2', rows: [{ text: 'bit 91', value: 'set by /cats', tone: 'warn' }, { text: 'bit 404', value: 'set by /dogs', tone: 'warn' }, { text: 'bit 733', value: 'set by /cats', tone: 'warn' }], footer: { text: '/fish was never added', tone: 'bad' } },
        caption: 'All bits set, yet the URL was never added',
      },
      quiz: {
        question: 'A bloom filter says an item is NOT present. What do you know?',
        options: [
          'It is probably absent, with about 1% doubt',
          'It was never added: the answer is certain',
          'It may have been added and later evicted',
          'Nothing until you check the database',
        ],
        answer: 1,
        explain: 'Adding an item sets all of its bits and bits are never cleared. A zero bit means the item was never added. Only the "yes" answers carry doubt.',
      },
    },
    {
      title: 'False positive cost',
      tag: 'tradeoff',
      heading: 'What a wrong "maybe" costs depends on what you do next',
      eli5: 'If the librarian walks to the basement to double check, a wrong "maybe" costs one trip. If she believes the lamps and sends the family away, they never get a book that was there.',
      body: [
        'If you **confirm** against the URL store, a false positive costs one wasted disk read and the answer stays exact.',
        'If you **trust** the filter and skip the URL, the crawler never fetches that page. At 1%, about 1 page in 100 is lost. Decide which one your system can live with.',
      ],
      keyIdea: 'Confirm after a "maybe" when you need exact answers. Trust the filter only when a rare miss is acceptable.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '~1% on "yes"', disk: '~1% wasted' },
      metricTones: { disk: 'warn' },
      scene: {
        nodes: [{ ...crawler, status: 'active' }, { ...filter, status: 'active', chips: [{ text: 'maybe', tone: 'warn' }] }, { ...store, status: 'ok', badge: 'exact answer' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', label: 'maybe seen', duration: 1.1 },
          { path: ['filter', 'store'], tone: 'request', label: 'confirm', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'After a "maybe"',
          icon: 'Scale',
          rows: [
            { text: 'Confirm in the store', value: '1 extra read', tone: 'good' },
            { text: 'Trust the filter', value: '1 in 100 lost', tone: 'warn' },
          ],
          footer: { text: 'Pick by what a wrong answer costs', tone: 'muted' },
        },
        caption: 'Confirm or trust: your call',
      },
    },
    {
      title: 'Sizing formula',
      tag: 'concept',
      heading: 'The error depends on how full the array is',
      eli5: 'A short row of lamps fills up fast and every book looks like a "maybe". A longer row keeps more lamps dark, so the librarian makes fewer wasted trips.',
      body: [
        'With `n` items, `m` bits and `k` hashes the false positive rate is about `(1 - e^(-kn/m))^k`. The best `k` is `(m / n) × ln 2`.',
        'More space per item means fewer shared bits and a lower error. More hashes helps only up to that optimum. Past it, every add sets more bits, the array fills up and the error rises again.',
      ],
      keyIdea: 'Error falls with bits per item. There is one best number of hashes for each size.',
      metrics: { items: 'n', mem: 'm bits', err: '(1 - e^(-kn/m))^k', disk: '-' },
      scene: {
        nodes: [{ ...crawler, status: 'dim' }, { ...filter, status: 'active', sub: 'm bits, k hashes', badge: 'n items' }, { ...store, status: 'dim' }],
        links: crawlLinks,
        panel: { title: 'Three knobs', icon: 'Gauge', rows: [{ text: 'n  items added', value: '1 billion' }, { text: 'm  bits in the array', value: 'you choose' }, { text: 'k  hashes per item', value: '(m / n) × ln 2', tone: 'good' }], footer: { text: 'Bigger m gives a lower error', tone: 'good' } },
        caption: 'Pick m for the error, then k',
      },
    },
    {
      title: 'Rule of thumb',
      tag: 'concept',
      heading: 'Ten bits per item buys about 1% false positives',
      eli5: 'Give each book ten lamps of room and the librarian is wrong only about once in a hundred checks. Give it fourteen and she is wrong once in a thousand.',
      body: [
        '**10 bits per item with 7 hashes gives about 1%**. For 1 billion URLs that is 10 billion bits, or **1.25 GB**, against 80 GB for the raw strings.',
        'Each extra 4.8 bits per item cuts the error by ten times, so 0.1% costs about 14.4 bits per item. Memory depends on item count and error, never on item size.',
      ],
      keyIdea: 'Memory depends on the item count and the error you accept, never on the size of the items.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '~1% on "yes"', disk: '~1% wasted' },
      metricTones: { mem: 'good' },
      scene: {
        nodes: [crawler, { ...filter, status: 'ok', sub: '10 bits per URL', badge: '1.25 GB · k = 7' }, { ...store, badge: '80 GB on disk' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', count: 5, duration: 1 },
          { path: ['filter', 'crawler'], tone: 'response', label: 'answered in RAM', count: 4, duration: 1, delay: 1.1 },
          { path: ['filter', 'store'], tone: 'request', label: 'confirm', duration: 1.2, delay: 1.1 },
        ],
        panel: { title: 'Bits per item', icon: 'Table', rows: [{ text: '10 bits, k = 7', value: '~1%  (1.25 GB)', tone: 'good' }, { text: '14.4 bits, k = 10', value: '~0.1%  (1.8 GB)' }, { text: 'Raw URLs', value: '80 GB', tone: 'bad' }], footer: { text: '64 times smaller than the raw URLs', tone: 'good' } },
        caption: '64 times smaller than the raw URLs',
      },
      code: {
        language: 'python',
        title: 'Size a filter from item count and target error',
        source: `import math

def size_bloom(n_items, fp_rate):
    # bits needed: m = -n * ln(p) / (ln 2)^2
    m = -n_items * math.log(fp_rate) / (math.log(2) ** 2)
    k = (m / n_items) * math.log(2)        # best number of hashes
    return math.ceil(m), round(k)

m, k = size_bloom(1_000_000_000, 0.01)
print(m / 8 / 1e9, "GB", k, "hashes")      # ~1.2 GB, 7 hashes

m, k = size_bloom(1_000_000_000, 0.001)
print(m / 8 / 1e9, "GB", k, "hashes")      # ~1.8 GB, 10 hashes`,
        highlight: [5, 6, 10, 13],
      },
    },
    {
      title: 'Overfull',
      tag: 'tradeoff',
      heading: 'A filter cannot grow in place',
      eli5: 'If far more books arrive than the lamp row was built for, nearly every lamp ends up on and the lamps say "maybe" to everything.',
      body: [
        'Size the filter for the item count you expect. Add 2 billion items to a filter sized for 1 billion and the error climbs from 1% to roughly 14%.',
        'There is no resize. You build a bigger filter and add every item again, which needs the original data.',
      ],
      keyIdea: 'Plan for the final item count. An overfull filter says "maybe" to almost everything.',
      metrics: { items: '2 billion', mem: '1.25 GB', err: '~14% on "yes"', disk: 'rising' },
      metricTones: { err: 'bad', disk: 'bad' },
      scene: {
        nodes: [{ ...crawler, status: 'active' }, { ...filter, status: 'hot', load: 88, badge: 'most bits are 1' }, { ...store, status: 'hot', badge: 'many wasted reads' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', count: 5, duration: 1 },
          { path: ['filter', 'store'], tone: 'error', label: 'maybe, maybe, maybe', count: 4, duration: 1.2, delay: 1.1 },
        ],
        panel: { title: 'Same 10 billion bits', icon: 'TrendingUp', rows: [{ text: '1 billion items', value: '~1%', tone: 'good' }, { text: '2 billion items', value: '~14%', tone: 'bad' }], footer: { text: 'Rebuild from the source data to fix it', tone: 'warn' } },
        caption: 'An overfull filter says "maybe" to almost everything',
      },
    },
    {
      title: 'Cache guard',
      tag: 'case',
      heading: 'Case: stopping cache penetration',
      eli5: 'Someone keeps asking for books that do not exist. The shelf-checking helper finds nothing every time and still walks to the basement. A lamp row at the door turns them away first.',
      body: [
        '**Cache penetration**: a bug or an attacker asks for keys that do not exist. Every request misses the cache and hits the database.',
        'Caching the "not found" with a short TTL helps. A **bloom filter** of all real keys rejects the rest cheaply. A "no" is certain, so those requests never reach the cache or the database.',
        'Add each new key to the filter at insert time, or real users get blocked. Rebuild it periodically to drop deleted keys, which otherwise still pass and reach the database.',
      ],
      keyIdea: 'A bloom filter of real keys turns away lookups for keys that cannot exist.',
      metrics: { items: '50M real keys', mem: '60 MB', err: '~1% reach the DB', disk: '~0 for fake keys' },
      metricTones: { disk: 'good' },
      scene: {
        nodes: [
          { id: 'attacker', kind: 'client', at: at(-5.4, 0), label: 'bad client', status: 'hot', chips: [{ text: 'GET /user/-999', tone: 'bad' }] },
          { ...filter, at: at(-1.8, 0), label: 'key filter', sub: 'all real keys', status: 'ok', badge: 'definitely not' },
          { id: 'cache', kind: 'cache', at: at(1.8, 0), label: 'cache', status: 'dim' },
          { id: 'db', kind: 'db', at: at(5.4, 0), label: 'database', status: 'dim', badge: 'untouched' },
        ],
        links: [link('attacker', 'filter'), link('filter', 'cache', { style: 'faint' }), link('cache', 'db', { style: 'faint' })],
        flows: [
          { path: ['attacker', 'filter'], tone: 'request', label: 'fake keys', count: 4, duration: 1.1 },
          { path: ['filter', 'attacker'], tone: 'error', label: '404 from RAM', duration: 1.1, delay: 1.2 },
        ],
        panel: { title: 'Before and after', icon: 'Shield', rows: [{ text: 'Fake keys reaching the DB', value: '100% to ~1%', tone: 'good' }, { text: 'Real keys', value: 'always pass' }], footer: { text: 'No false negatives, so no real key is blocked', tone: 'good' } },
        caption: 'Fake keys stop at the door',
      },
    },
    {
      title: 'Skip the disk',
      tag: 'case',
      heading: 'Case: an LSM store skips files that cannot hold the key',
      eli5: 'The basement has many shelves. Each shelf has its own row of lamps, so the librarian only walks to the one shelf whose lamps are all on.',
      body: [
        'A key-value store on an LSM tree keeps data in many immutable files called **SSTables**. A read for `user:881` may look in several, newest first, and each look is a disk read.',
        'Each SSTable carries a bloom filter built when the file is written and kept in memory. Two filters say "definitely not" and those files are skipped. One says "maybe" and gets the single disk read.',
      ],
      keyIdea: 'Put a bloom filter in front of anything slow. A cheap "definitely not" saves the expensive lookup.',
      metrics: { items: '3 files', mem: '10 bits per key', err: '~1% extra reads', disk: '1 instead of 3' },
      metricTones: { disk: 'good' },
      scene: {
        nodes: [
          { id: 'node', kind: 'server', at: at(-4.4, -4.4), label: 'storage node', sub: 'LSM tree', status: 'active', chips: ['GET user:881'] },
          { ...filter, id: 'filters', at: at(0, -4.4), label: 'bloom filters', sub: 'one per file', status: 'active', badge: 'no, yes, no' },
          { id: 'sst1', kind: 'storage', at: at(-3.6, 3.2), label: 'SSTable 1', status: 'dim', badge: 'skipped' },
          { id: 'sst2', kind: 'storage', at: at(0, 3.2), label: 'SSTable 2', status: 'ok', badge: '1 disk read' },
          { id: 'sst3', kind: 'storage', at: at(3.6, 3.2), label: 'SSTable 3', status: 'dim', badge: 'skipped' },
        ],
        links: [link('node', 'filters'), link('filters', 'sst1', { style: 'faint' }), link('filters', 'sst2'), link('filters', 'sst3', { style: 'faint' })],
        flows: [
          { path: ['node', 'filters'], tone: 'request', label: 'user:881?', duration: 1.3 },
          { path: ['filters', 'sst2'], tone: 'request', label: 'maybe here', duration: 1, delay: 1.4 },
          { path: ['sst2', 'filters', 'node'], tone: 'response', label: 'row', duration: 1.6, delay: 2.5 },
        ],
        caption: 'Only the file that might hold the key is read',
      },
    },
    {
      title: 'Other uses',
      tag: 'case',
      heading: 'More places a bloom filter sits in front of the truth',
      eli5: 'The same lamp trick works at other doors too: the order desk, the mail room and the stockroom all use a quick lamp check before the slow walk.',
      body: [
        '**Column stores** keep a bloom filter per data block next to min and max values, so a query for one ID skips blocks that cannot hold it. A **URL shortener** checks whether a short code exists before it hits the table.',
        'In each case a false positive costs one extra look at the real data, and a "no" saves a read.',
      ],
      keyIdea: 'Wherever a slow check guards mostly empty answers, a bloom filter pays for itself.',
      metrics: { items: 'many blocks', mem: '~10 bits per key', err: '~1% extra reads', disk: 'mostly skipped' },
      metricTones: { disk: 'good' },
      scene: {
        nodes: [
          { id: 'cols', kind: 'warehouse', at: at(-3.6, 0), label: 'column store', sub: 'filter per block', status: 'ok' },
          { ...filter, label: 'bloom filter', sub: 'in front of data', status: 'active' },
          { id: 'short', kind: 'block', at: at(3.6, 0), label: 'URL shortener', sub: 'code exists?', icon: 'Route', tint: 'amber' },
        ],
        links: [link('cols', 'filter', { arrow: 'none' }), link('filter', 'short', { arrow: 'none' })],
        panel: { title: 'Where the filter sits', icon: 'List', rows: [{ text: 'LSM tree', value: 'skip SSTables' }, { text: 'Column store', value: 'skip blocks' }, { text: 'Cache', value: 'block fake keys' }, { text: 'Shortener', value: 'check short code' }, { text: 'Crawler', value: 'URL seen?' }] },
        caption: 'One trick, many doors',
      },
    },
    {
      title: 'Limits',
      tag: 'tradeoff',
      heading: 'What a bloom filter cannot do',
      eli5: 'The lamps cannot tell you which books are in the library, and you cannot switch a lamp off when one book leaves, because another book may be using it too.',
      body: [
        '**No deletes.** Clearing an item\'s bits could clear a bit another item depends on, and that would create false negatives.',
        '**No listing and no values.** You cannot get the items back out or attach data to them. It answers one question only.',
      ],
      keyIdea: 'A bloom filter only answers "maybe in the set?". Nothing comes back out.',
      metrics: { items: 'no list', mem: '1.25 GB', err: 'no delete', disk: '-' },
      metricTones: { err: 'warn' },
      scene: {
        nodes: [{ ...crawler, status: 'dim' }, { ...filter, status: 'active', chips: [{ text: 'delete /cats', tone: 'bad' }, { text: 'list all', tone: 'bad' }] }, { ...store, status: 'dim' }],
        links: crawlLinks,
        panel: { title: 'Operations', icon: 'List', rows: [{ text: 'add', value: 'yes', tone: 'good' }, { text: 'might contain', value: 'yes', tone: 'good' }, { text: 'delete', value: 'no', tone: 'bad' }, { text: 'list items', value: 'no', tone: 'bad' }, { text: 'store a value', value: 'no', tone: 'bad' }] },
        caption: 'Two questions only: add and check',
      },
    },
    {
      title: 'Deletes',
      tag: 'concept',
      heading: 'Counting bloom and cuckoo filters allow removal',
      eli5: 'Give each lamp a dial instead of a switch, so one book leaving only turns the dial down one notch. Or keep a tiny tag for each book instead of lamps.',
      body: [
        'A **counting bloom filter** replaces each bit with a small counter. Add increments, delete decrements, and a zero counter means off. It costs several times the memory, about 4 times with 4-bit counters.',
        'A **cuckoo filter** stores a small fingerprint of each item in a bucket table. It supports deletes at roughly the space of a bloom filter.',
      ],
      keyIdea: 'Need deletes? Pay with counters, or switch to a cuckoo filter that stores fingerprints.',
      metrics: { items: '1 billion', mem: '1.25 to 5 GB', err: '~1%', disk: '-' },
      scene: {
        nodes: [
          { ...filter, at: at(-3.6, 0), label: 'bloom filter', sub: 'bits, no delete', status: 'dim' },
          { id: 'counting', kind: 'block', at: at(0, 0), label: 'counting bloom', sub: 'counters, ~4x RAM', icon: 'Hash', tint: 'amber', status: 'active' },
          { id: 'cuckoo', kind: 'block', at: at(3.6, 0), label: 'cuckoo filter', sub: 'fingerprints', icon: 'Package', tint: 'green', status: 'ok' },
        ],
        links: [link('filter', 'counting', { style: 'dashed' }), link('counting', 'cuckoo', { style: 'dashed' })],
        panel: { title: 'Supports delete?', icon: 'Table', rows: [{ text: 'Bloom filter', value: 'no, 1x RAM', tone: 'bad' }, { text: 'Counting bloom', value: 'yes, ~4x RAM', tone: 'warn' }, { text: 'Cuckoo filter', value: 'yes, ~1x RAM', tone: 'good' }] },
        caption: 'Counters or fingerprints give you delete',
      },
    },
    {
      title: 'Skip it when',
      tag: 'tradeoff',
      heading: 'Use one when a wrong "maybe" is cheap and a fast "no" is valuable',
      eli5: 'Use the lamps when a wasted trip to the basement is cheap. Do not use them alone when a wrong "maybe" would hurt someone.',
      body: [
        'Skip it when the set is small enough for an exact hash set, or when a false positive causes real damage. Telling a new user their username is taken, with no second check, is that damage.',
        'A bloom filter is a fast first check in front of the truth. Keep the truth somewhere.',
      ],
      keyIdea: 'A bloom filter is a fast first check in front of the truth. Keep the truth somewhere.',
      metrics: { items: 'small set', mem: 'exact is fine', err: '1% too many', disk: '-' },
      metricTones: { err: 'bad' },
      scene: {
        nodes: [
          { id: 'signup', kind: 'client', at: at(-3.6, 0), label: 'sign-up form', chips: ['user: maria_88'] },
          { ...filter, label: 'username filter', status: 'hot', badge: 'maybe taken' },
          { ...store, label: 'users table', status: 'dim', badge: 'never asked' },
        ],
        links: [link('signup', 'filter'), link('filter', 'store', { style: 'faint' })],
        flows: [
          { path: ['signup', 'filter'], tone: 'request', label: 'free?', duration: 1.1 },
          { path: ['filter', 'signup'], tone: 'error', label: 'taken (wrong)', duration: 1.1, delay: 1.2 },
        ],
        panel: { title: 'Good and bad fit', icon: 'Scale', rows: [{ text: 'Skip disk reads', value: 'good fit', tone: 'good' }, { text: 'Reject fake keys', value: 'good fit', tone: 'good' }, { text: 'Small exact set', value: 'use a hash set', tone: 'warn' }, { text: 'Username taken?', value: 'confirm first', tone: 'bad' }] },
        caption: 'A wrong "taken" costs a real user',
      },
      quiz: {
        question: 'Which use of a bloom filter is risky if you never check the real data afterwards?',
        options: [
          'Skipping SSTable reads in an LSM store',
          'Telling a new user their username is already taken',
          'Rejecting lookups for keys that cannot exist',
          'Deciding whether a crawler may skip a URL it has seen',
        ],
        answer: 1,
        explain: 'A "yes" can be wrong, so a new user could be told a free name is taken. The LSM and key-rejection uses only act on "no", and the crawler can accept losing about 1 page in 100.',
      },
    },
    {
      title: 'Count uniques',
      tag: 'problem',
      heading: 'A different question: how many different visitors?',
      eli5: 'Now the librarian wants to know how many different children came today, not whether one particular child came. Writing every name on a long list takes a huge notebook.',
      body: [
        'How many **unique** visitors did the site get today? The exact way keeps a set of every visitor ID. At 40 million visitors and 8 bytes each, that is **320 MB** for one counter.',
        'Now keep one per page, per day. The memory adds up fast.',
      ],
      keyIdea: 'Exact unique counts need a set of every ID seen. Memory grows with the number of uniques.',
      metrics: { items: '40M uniques', mem: '320 MB per counter', err: '0%', disk: '-' },
      metricTones: { mem: 'bad' },
      scene: {
        nodes: [
          { id: 'visitors', kind: 'user', at: at(-3.6, 0), label: 'visitors', sub: '40M a day' },
          { ...app, at: at(0, 0), status: 'active' },
          { id: 'idset', kind: 'db', at: at(3.6, 0), label: 'ID set', sub: 'every visitor ID', status: 'hot', load: 90, badge: '320 MB' },
        ],
        links: [link('visitors', 'app'), link('app', 'idset')],
        flows: [
          { path: ['visitors', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'idset'], tone: 'data', label: 'add user:77', count: 3, duration: 1, delay: 1.1 },
        ],
        panel: { title: 'One counter, exact', icon: 'Table', rows: [{ text: '40M IDs × 8 B', value: '320 MB', tone: 'bad' }, { text: 'Per page, per day', value: 'multiply it', tone: 'bad' }] },
        caption: 'A list of every visitor, every day',
      },
    },
    {
      title: 'HyperLogLog idea',
      tag: 'concept',
      heading: 'HyperLogLog reads the pattern of a hash',
      eli5: 'To guess how many different children came today, the librarian asks each child to flip a coin until tails. She only remembers the longest run of heads. A very long run means lots of children came.',
      body: [
        '**HyperLogLog** (HLL) hashes each ID and counts the leading zero bits. A hash starting with 20 zeros shows up about once in a million distinct values, so seeing one suggests around a million different IDs.',
        'Duplicates change nothing, because the same ID always gives the same pattern.',
      ],
      keyIdea: 'A rare hash pattern is evidence of many distinct items. Repeats of one ID never add evidence.',
      metrics: { items: '40M uniques', mem: 'one number', err: 'high alone', disk: '-' },
      scene: {
        nodes: [{ ...app, status: 'active', chips: ['user:77', 'user:77'] }, { id: 'hash', kind: 'block', at: at(0, 0), label: 'hash', sub: 'random bits', icon: 'Hash', tint: 'violet', status: 'active' }, { ...hll, status: 'ok', badge: 'longest run: 20 zeros' }],
        links: [link('app', 'hash'), link('hash', 'hll')],
        flows: [
          { path: ['app', 'hash', 'hll'], tone: 'data', label: 'PFADD', count: 3, duration: 1.4 },
        ],
        panel: { title: 'Leading zeros in the hash', icon: 'Binary', rows: [{ text: '1 zero', value: '1 in 2 values' }, { text: '10 zeros', value: '1 in ~1,000' }, { text: '20 zeros', value: '1 in ~1 million', tone: 'good' }], footer: { text: 'Same ID, same hash: no change', tone: 'muted' } },
        caption: 'The longest run hints at the count',
      },
    },
    {
      title: 'Buckets',
      tag: 'concept',
      heading: 'Many buckets average out the luck, in 12 KB',
      eli5: 'One lucky coin run can fool her. So she keeps thousands of little notebooks, one longest run in each, and averages them to smooth out luck.',
      body: [
        'One lucky hash would skew the estimate. HLL splits hashes into thousands of buckets, keeps the longest run of zeros per bucket and averages them.',
        'The Redis implementation uses 16,384 buckets, takes at most **12 KB**, and has a standard error of **0.81%**, whether it counted a thousand items or a billion.',
      ],
      keyIdea: 'HyperLogLog estimates a unique count in a few kilobytes. It can count, but it cannot tell you who was counted.',
      metrics: { items: '40M uniques', mem: '12 KB', err: '±0.81%', disk: '-' },
      metricTones: { mem: 'good', err: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...hll, status: 'ok', badge: '≈ 40.2M uniques' }],
        links: [link('app', 'hll')],
        flows: [
          { path: ['app', 'hll'], tone: 'data', label: 'PFADD user 77', count: 3, duration: 1.2 },
          { path: ['hll', 'app'], tone: 'response', label: 'PFCOUNT', duration: 1.2, delay: 1.4 },
        ],
        panel: { title: 'Exact vs HyperLogLog', icon: 'Gauge', rows: [{ text: 'ID set', value: '320 MB, 0%', tone: 'bad' }, { text: 'HyperLogLog', value: '12 KB, ±0.81%', tone: 'good' }, { text: 'Buckets', value: '16,384' }], footer: { text: '320 MB of IDs becomes 12 KB', tone: 'good' } },
        caption: '320 MB of IDs becomes 12 KB',
      },
    },
    {
      title: 'Merge',
      tag: 'concept',
      heading: 'Merging counters without double counting',
      eli5: 'Two librarians at two doors can combine their notes at night by keeping the longer run for each page. A child who used both doors is still counted once.',
      body: [
        'Two HLLs **merge** by taking the larger value in each bucket. The result equals one counter that saw both streams, so a user who visited Monday and Tuesday is counted once.',
        'Daily counters roll up into weekly ones, and counters from 50 servers into one, with no raw IDs shipped anywhere.',
      ],
      keyIdea: 'HLL counters merge by taking the max per bucket, so unions never double count.',
      metrics: { items: '2 daily counters', mem: '12 KB each', err: '±0.81%', disk: '-' },
      metricTones: { mem: 'good' },
      scene: {
        nodes: [
          { id: 'mon', kind: 'block', at: at(-3.6, -3.6), label: 'Monday', sub: '12 KB', icon: 'Hash', tint: 'green', badge: '40.2M' },
          { id: 'tue', kind: 'block', at: at(-3.6, 3.6), label: 'Tuesday', sub: '12 KB', icon: 'Hash', tint: 'green', badge: '38.9M' },
          { id: 'week', kind: 'block', at: at(2.4, 0), label: 'two-day total', sub: '12 KB', icon: 'Hash', tint: 'teal', status: 'ok', badge: '≈ 61M uniques' },
        ],
        links: [link('mon', 'week', { style: 'dashed' }), link('tue', 'week', { style: 'dashed' })],
        flows: [
          { path: ['mon', 'week'], tone: 'data', label: 'PFMERGE', duration: 1.3 },
          { path: ['tue', 'week'], tone: 'data', duration: 1.3 },
        ],
        panel: { title: 'Why 61M, not 79M', icon: 'Share2', rows: [{ text: 'Monday + Tuesday', value: '79.1M', tone: 'bad' }, { text: 'Merged, no double count', value: '≈ 61M', tone: 'good' }], footer: { text: 'Repeat visitors are counted once', tone: 'good' } },
        caption: 'Merged counters do not double count',
      },
      code: {
        language: 'bash',
        title: 'Unique visitors in Redis',
        source: `# add visitors as they arrive; repeats do not change the count
redis-cli PFADD uv:2024-06-03 user:77 user:12 user:77
redis-cli PFADD uv:2024-06-04 user:12 user:90

# estimated uniques for one day
redis-cli PFCOUNT uv:2024-06-03            # 2

# uniques across both days, without double counting user:12
redis-cli PFMERGE uv:week uv:2024-06-03 uv:2024-06-04
redis-cli PFCOUNT uv:week                  # 3`,
        highlight: [2, 6, 9, 10],
      },
    },
    {
      title: 'Count-min',
      tag: 'concept',
      heading: 'Count-min sketch: about how often did this appear?',
      eli5: 'Now she wants to know how many times each book was borrowed. She keeps a few small tally sheets and each book makes one tick on every sheet, in a spot picked by its name.',
      body: [
        'A **count-min sketch** is a small grid of counters. Each item is hashed once per row and increments one counter in each row.',
        'To read, take the **minimum** across the rows. Collisions can only add to a counter, so the estimate can be too high and never too low.',
        '**Wider rows** shrink the error, which is about `e / w` times the total events. **More rows** raise the confidence. The error is a fraction of total volume, so heavy keys read accurately and rare keys can be badly overestimated.',
      ],
      keyIdea: 'Bloom answers "is it in the set?", HyperLogLog answers "how many distinct?", count-min answers "how often?".',
      metrics: { items: 'millions of keys', mem: 'fixed grid', err: 'only too high', disk: '-' },
      scene: {
        nodes: [
          { id: 'stream', kind: 'block', at: at(-3.6, 0), label: 'search stream', sub: 'every query', icon: 'Activity', tint: 'blue', chips: ['"pizza"'] },
          { id: 'cms', kind: 'block', at: at(0, 0), label: 'count-min sketch', sub: '4 rows × 2,000', icon: 'Table', tint: 'violet', status: 'active', badge: 'min of 4 counters' },
          { id: 'est', kind: 'block', at: at(3.6, 0), label: 'estimate', icon: 'Gauge', tint: 'amber', badge: '"pizza" ≈ 9,310' },
        ],
        links: [link('stream', 'cms'), link('cms', 'est')],
        flows: [
          { path: ['stream', 'cms'], tone: 'data', label: '+1 per row', count: 4, duration: 1.2 },
          { path: ['cms', 'est'], tone: 'response', label: 'min', duration: 1, delay: 1.4 },
        ],
        panel: { title: 'Counters hit by "pizza"', icon: 'Table', rows: [{ text: 'row 1', value: '9,310', tone: 'good' }, { text: 'row 2', value: '9,880' }, { text: 'row 3', value: '9,310', tone: 'good' }, { text: 'row 4', value: '12,004' }], footer: { text: 'Read the minimum: 9,310', tone: 'good' } },
        caption: 'The smallest counter is the least polluted',
      },
    },
    {
      title: 'Heavy hitters',
      tag: 'case',
      heading: 'Case: finding the top search terms in a stream',
      eli5: 'The librarian wants the most borrowed books without a tally sheet per book. The small sheets plus a short list of current leaders give her the top ten.',
      body: [
        'Count-min is how you find **heavy hitters**: the top search terms, the busiest IPs, the most clicked ads. You cannot keep a counter per key at that volume.',
        'Pair the sketch with a small min-heap of the current top `k`. For each event, update the sketch, read the estimate, and keep the key if it beats the smallest in the heap.',
      ],
      keyIdea: 'A sketch plus a small top-k list finds the heaviest keys in constant memory.',
      metrics: { items: 'billions of events', mem: '~100 KB', err: 'overestimates', disk: '-' },
      metricTones: { mem: 'good' },
      scene: {
        nodes: [
          { id: 'stream', kind: 'block', at: at(-3.6, 0), label: 'search stream', sub: '100K events/s', icon: 'Activity', tint: 'blue' },
          { id: 'cms', kind: 'block', at: at(0, 0), label: 'count-min sketch', sub: '~100 KB', icon: 'Table', tint: 'violet', status: 'ok' },
          { id: 'top', kind: 'block', at: at(3.6, 0), label: 'top 10 list', sub: 'min-heap', icon: 'TrendingUp', tint: 'amber', status: 'ok' },
        ],
        links: [link('stream', 'cms'), link('cms', 'top')],
        flows: [
          { path: ['stream', 'cms', 'top'], tone: 'data', label: 'term + count', count: 3, duration: 1.8 },
        ],
        panel: { title: 'Trending now', icon: 'TrendingUp', rows: [{ text: '1. pizza near me', value: '~9.3K' }, { text: '2. weather', value: '~8.1K' }, { text: '3. score', value: '~6.4K' }], footer: { text: 'Error scales with total events: fine for heavy keys, poor for rare ones', tone: 'muted' } },
        caption: 'Top terms without a counter per key',
      },
      quiz: {
        question: 'You must find the 10 most frequent search terms in a huge stream using fixed, small memory. What fits?',
        options: [
          'A bloom filter of terms seen',
          'A HyperLogLog of terms',
          'A count-min sketch with a small top-k heap',
          'A hash map from every term to its count',
        ],
        answer: 2,
        explain: 'Count-min estimates how often each term appears, and the heap keeps the leaders. A bloom filter only tests membership, HyperLogLog only counts distinct terms, and a full map needs memory per key.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Small, fast, and wrong by a known amount',
      eli5: 'The lamps by the door save the librarian most trips to the basement, the coin-flip trick counts visitors without a name list, and the tally sheets show the favorite books. Each is a quick guess with a small, known mistake.',
      body: [
        'A **bloom filter** stores membership in about 10 bits per item at 1% false positives. A "no" is certain, a "yes" means check the real store. It cannot grow, list, or delete (counting and cuckoo filters can).',
        '**HyperLogLog** counts distinct items in 12 KB with under 1% error and merges cleanly. A **count-min sketch** estimates frequency and only overestimates.',
      ],
      keyIdea: 'When exact answers cost too much memory, pick the structure whose error you can afford, and keep the exact data behind it.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '~1% on "yes"', disk: 'only on "maybe"' },
      metricTones: { mem: 'good', err: 'good' },
      scene: {
        nodes: [
          { id: 'q1', kind: 'block', at: at(-3.6, 0), label: 'bloom filter', sub: 'in the set?', icon: 'Layers', tint: 'violet', status: 'ok' },
          { id: 'q2', kind: 'block', at: at(0, 0), label: 'HyperLogLog', sub: 'how many distinct?', icon: 'Hash', tint: 'green', status: 'ok' },
          { id: 'q3', kind: 'block', at: at(3.6, 0), label: 'count-min', sub: 'how often?', icon: 'Table', tint: 'amber', status: 'ok' },
        ],
        panel: { title: 'Pick by the question', icon: 'Scale', rows: [{ text: 'Seen it? (maybe)', value: 'bloom, 10 bits/item', tone: 'good' }, { text: 'How many unique?', value: 'HLL, 12 KB', tone: 'good' }, { text: 'How often?', value: 'count-min, grid', tone: 'good' }], footer: { text: 'Know what a wrong answer costs first', tone: 'muted' } },
        caption: 'Three questions, three small structures',
      },
      quiz: {
        question: 'A dashboard must show daily unique visitors per page for 20,000 pages, and a 1% error is fine. Which structure fits?',
        options: [
          'A bloom filter per page',
          'A hash set of visitor IDs per page',
          'A HyperLogLog per page',
          'A count-min sketch shared by all pages',
        ],
        answer: 2,
        explain: 'The question is "how many distinct?", which is what HyperLogLog estimates, in at most 12 KB per page, about 240 MB for all 20,000, and small counters use far less. A bloom filter answers membership, a count-min sketch answers frequency, and exact sets would need far more memory.',
      },
    },
  ],
};
