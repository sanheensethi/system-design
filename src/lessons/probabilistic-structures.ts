import type { Lesson, SceneNode } from '../engine/types';

const crawler: SceneNode = { id: 'crawler', kind: 'worker', at: [-4.5, 0], label: 'crawler', sub: '2,000 URLs/s' };
const filter: SceneNode = { id: 'filter', kind: 'cache', at: [-1, -1], label: 'bloom filter', sub: 'bits in RAM' };
const store: SceneNode = { id: 'store', kind: 'db', at: [2.5, -1.5], label: 'URL store', sub: 'on disk' };

const reader: SceneNode = { id: 'reader', kind: 'client', at: [-5.5, 0], label: 'reader', sub: 'GET user:881' };
const node: SceneNode = { id: 'node', kind: 'server', at: [-2.5, 0], label: 'storage node', sub: 'LSM tree' };
const filters: SceneNode = { id: 'filters', kind: 'cache', at: [0, -0.5], label: 'bloom filters', sub: 'one per file' };
const sst1: SceneNode = { id: 'sst1', kind: 'storage', at: [-1.25, -4.75], label: 'SSTable 1' };
const sst2: SceneNode = { id: 'sst2', kind: 'storage', at: [2, -1.5], label: 'SSTable 2' };
const sst3: SceneNode = { id: 'sst3', kind: 'storage', at: [5.25, 1.75], label: 'SSTable 3' };

const visitors: SceneNode = { id: 'visitors', kind: 'user', at: [-4.5, 0], label: 'visitors', sub: '40M a day' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-1.5, 0], label: 'app server' };
const hll: SceneNode = { id: 'hll', kind: 'cache', at: [1.75, -0.75], label: 'HyperLogLog', sub: '12 KB' };
const hllMon: SceneNode = { id: 'hllMon', kind: 'cache', at: [-2, -4.5], label: 'Monday', sub: '12 KB' };
const hllWeek: SceneNode = { id: 'hllWeek', kind: 'cache', at: [2.25, -4.25], label: 'week total', sub: '12 KB' };

const crawlLinks = [
  { from: 'crawler', to: 'filter' },
  { from: 'filter', to: 'store', style: 'dashed' as const },
];

export const probabilisticStructures: Lesson = {
  id: 'probabilistic-structures',
  title: 'Bloom filters and HyperLogLog',
  tagline: 'Trade a small, known error for a huge cut in memory when you ask "have I seen this?" or "how many unique?".',
  minutes: 13,
  level: 'Intermediate',
  learn: [
    'Why exact membership and exact unique counts get expensive at scale',
    'How a bloom filter sets and checks bits with several hash functions',
    'Why it can say "maybe" by mistake and can never miss a stored item',
    'How to size a filter: bits per item and number of hashes',
    'How HyperLogLog counts uniques in kilobytes, and what a count-min sketch adds',
  ],
  metrics: [
    { key: 'items', label: 'Items tracked' },
    { key: 'mem', label: 'Memory' },
    { key: 'err', label: 'Error' },
    { key: 'disk', label: 'Disk lookups' },
  ],
  steps: [
    {
      title: 'Seen it?',
      tag: 'problem',
      heading: 'One billion URLs and a simple question',
      eli5: 'The librarian wants to know if the library ever had a book. Walking down to the basement shelves for every question takes all day.',
      body: [
        'A web crawler has fetched **1 billion** pages. Every link it finds raises the same question: have I seen this URL before? It asks 2,000 times a second.',
        'The exact answer lives in a URL store on disk. A disk lookup per link is far too slow. Keeping every URL in RAM is fast, but at about 80 bytes each that is **80 GB**. Even storing only an 8-byte hash per URL in a hash set costs 16 GB or more once you count the table overhead.',
        'Most of those lookups end in "no, this one is new" or "yes, skip it". We are spending tens of gigabytes to produce one bit of answer.',
      ],
      keyIdea: 'Exact membership needs memory in proportion to the data itself. At a billion items that is a lot of RAM for a yes or no.',
      metrics: { items: '1 billion', mem: '80 GB', err: '0%', disk: '2,000/s' },
      scene: {
        nodes: [{ ...crawler, status: 'hot', badge: 'seen this URL?' }, { ...store, at: [-0.5, -1], status: 'hot', badge: '80 GB of URLs' }],
        links: [{ from: 'crawler', to: 'store' }],
        flows: [
          { path: ['crawler', 'store'], tone: 'request', label: 'seen /cats?', count: 5, duration: 1.2 },
          { path: ['store', 'crawler'], tone: 'response', label: 'yes / no', duration: 2.4, delay: 1.3 },
        ],
        caption: 'Every link costs an exact lookup',
      },
    },
    {
      title: 'Bits and hashes',
      tag: 'concept',
      heading: 'A bloom filter: an array of bits and a few hash functions',
      eli5: 'The **bloom filter** is a long row of lamps by the library door. When a book arrives, the librarian switches on three lamps picked by the book\'s name.',
      body: [
        'A **bloom filter** is an array of `m` bits, all starting at 0, plus `k` hash functions. It never stores the items themselves.',
        'To **add** a URL, hash it `k` times. Each hash picks one position in the array, and you set those `k` bits to 1. With `k = 3`, adding `/cats` might set bits 4, 91 and 733. Adding `/dogs` sets three more, and some may already be 1. That is fine.',
        'The filter is a fixed size no matter how long the URLs are. An 80-byte URL and a 2,000-byte URL both cost the same three bit flips.',
      ],
      keyIdea: 'Adding an item sets k bits chosen by k hashes. The item itself is thrown away.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '-', disk: '-' },
      scene: {
        nodes: [{ ...crawler, status: 'active' }, { ...filter, status: 'active', badge: 'set bits 4, 91, 733' }, { ...store, status: 'dim' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'data', label: 'add /cats', duration: 1.2 },
          { path: ['crawler', 'filter'], tone: 'data', label: 'h1, h2, h3', count: 3, duration: 1.2, delay: 1.4 },
        ],
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
        'To **check** a URL, hash it the same `k` ways and look at those bits. If any one of them is 0, the URL was never added. Adding it would have set that bit, and bits never go back to 0.',
        'So a "no" from the filter is always right. There are **no false negatives**. The crawler can treat the URL as new without touching the disk.',
        'For a crawler most links on a fresh site are new, so most checks end right here: three memory reads, well under a microsecond.',
      ],
      keyIdea: 'A zero bit is proof. When the filter says no, the answer is no.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '0% on "no"', disk: '0 for new URLs' },
      scene: {
        nodes: [{ ...crawler, status: 'ok', badge: 'new URL, fetch it' }, { ...filter, status: 'ok', badge: 'bit 58 is 0' }, { ...store, status: 'dim' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', label: 'seen /birds?', duration: 1.1 },
          { path: ['filter', 'crawler'], tone: 'response', label: 'definitely not', duration: 1.1, delay: 1.2 },
        ],
        caption: 'A "no" never needs the disk',
      },
    },
    {
      title: 'Probably yes',
      tag: 'case',
      heading: 'Case: three bits set by other URLs',
      eli5: 'Sometimes other books already switched on all three lamps for a book that never arrived. The lamps say "maybe", so the librarian has to check the basement shelves to be sure.',
      body: [
        'The crawler checks `/fish`, which it has never seen. Its three bits are 91, 404 and 733. Bit 91 and 733 were set by `/cats`. Bit 404 was set by `/dogs`. All three are 1.',
        'The filter answers "probably yes". This is a **false positive**: the bits are shared, so different items can cover for one that was never added. The filter cannot tell the difference.',
        'What a false positive costs depends on what you do next. If you confirm against the URL store, it costs one wasted disk read. If you trust the filter and skip the URL, the crawler never fetches that page. Decide which one your system can live with.',
      ],
      keyIdea: 'A "yes" means maybe. False positives happen, false negatives do not.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '~1% on "yes"', disk: 'only on "maybe"' },
      scene: {
        nodes: [{ ...crawler, status: 'active' }, { ...filter, status: 'hot', badge: '91, 404, 733 all 1' }, { ...store, status: 'active', badge: 'not found' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', label: 'seen /fish?', duration: 1.1 },
          { path: ['filter', 'store'], tone: 'request', label: 'maybe, confirm', duration: 1.2, delay: 1.2 },
          { path: ['store', 'filter', 'crawler'], tone: 'error', label: 'false positive', duration: 1.8, delay: 2.5 },
        ],
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
      title: 'Sizing',
      tag: 'concept',
      heading: 'Ten bits per item buys about 1% false positives',
      eli5: 'A short row of lamps fills up fast and every book looks like a "maybe". A longer row keeps more lamps dark, so the librarian makes fewer wasted trips.',
      body: [
        'The false positive rate depends on how full the array is. With `n` items, `m` bits and `k` hashes it is about `(1 - e^(-kn/m))^k`. The best `k` is `(m / n) × ln 2`.',
        'The rule of thumb: **10 bits per item with 7 hashes gives about 1%**. For 1 billion URLs that is 10 billion bits, or **1.25 GB**, against 80 GB for the raw strings. Each extra 4.8 bits per item cuts the error by another ten times, so 0.1% costs about 14.4 bits per item.',
        'More hashes is not always better. Each one sets more bits, and past the optimum the array fills up and the error rises again. Size the filter for the item count you expect, because it cannot grow in place.',
      ],
      keyIdea: 'Memory depends on the item count and the error you accept, never on the size of the items.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '~1% on "yes"', disk: '~1% wasted' },
      scene: {
        nodes: [crawler, { ...filter, status: 'ok', sub: '10 bits per URL', badge: '1.25 GB · k = 7' }, { ...store, badge: '80 GB on disk' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', count: 5, duration: 1 },
          { path: ['filter', 'crawler'], tone: 'response', label: 'answered in RAM', count: 4, duration: 1, delay: 1.1 },
          { path: ['filter', 'store'], tone: 'request', label: 'confirm', duration: 1.2, delay: 1.1 },
        ],
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
      title: 'Skip the disk',
      tag: 'case',
      heading: 'Case: an LSM store skips files that cannot hold the key',
      eli5: 'The basement has many shelves. Each shelf has its own row of lamps, so the librarian only walks to the one shelf whose lamps are all on.',
      body: [
        'A key-value store built on an LSM tree keeps data in many immutable files called **SSTables**. A read for `user:881` may have to look in several of them, newest first, and each look is a disk read.',
        'Each SSTable carries its own bloom filter, built once when the file is written and kept in memory. Before touching a file, the storage node asks its filter. Two filters say "definitely not", so those files are skipped. One says "maybe", and that file gets the single disk read.',
        'A false positive here costs one extra disk read and nothing else, because the file itself gives the exact answer. That makes it an ideal use. The same trick sits in front of caches and databases to turn away lookups for keys that do not exist.',
      ],
      keyIdea: 'Put a bloom filter in front of anything slow. A cheap "definitely not" saves the expensive lookup.',
      metrics: { items: '3 files', mem: '10 bits per key', err: '~1% extra reads', disk: '1 instead of 3' },
      scene: {
        nodes: [reader, { ...node, status: 'active' }, { ...filters, status: 'active', badge: 'no, yes, no' }, { ...sst1, status: 'dim', badge: 'skipped' }, { ...sst2, status: 'ok', badge: '1 disk read' }, { ...sst3, status: 'dim', badge: 'skipped' }],
        links: [
          { from: 'reader', to: 'node' },
          { from: 'node', to: 'filters' },
          { from: 'filters', to: 'sst1', style: 'faint' },
          { from: 'filters', to: 'sst2' },
          { from: 'filters', to: 'sst3', style: 'faint' },
        ],
        flows: [
          { path: ['reader', 'node', 'filters'], tone: 'request', label: 'user:881?', duration: 1.5 },
          { path: ['filters', 'sst2'], tone: 'request', label: 'maybe here', duration: 1, delay: 1.6 },
          { path: ['sst2', 'filters', 'node', 'reader'], tone: 'response', label: 'row', duration: 2, delay: 2.7 },
        ],
        caption: 'Only the file that might hold the key is read',
      },
    },
    {
      title: 'Limits',
      tag: 'tradeoff',
      heading: 'What a bloom filter cannot do',
      eli5: 'The lamps cannot tell you which books are in the library, and you cannot switch a lamp off when one book leaves, because another book may be using it too.',
      body: [
        '**No deletes.** Clearing an item\'s bits could clear a bit another item depends on, and that would create false negatives. A **counting bloom filter** replaces each bit with a small counter to allow removal, at several times the memory.',
        '**No listing and no values.** You cannot get the items back out or attach data to them. It answers one question only.',
        '**It fills up.** Add 2 billion items to a filter sized for 1 billion and the error climbs from 1% to roughly 16%. There is no resize: you build a bigger filter and add every item again, which needs the original data.',
        'Use one when a wrong "maybe" is cheap and a fast "no" is valuable. Skip it when the set is small enough for an exact hash set, or when a false positive causes real damage, such as telling a new user their username is taken with no second check.',
      ],
      keyIdea: 'A bloom filter is a fast first check in front of the truth. Keep the truth somewhere.',
      metrics: { items: '2 billion', mem: '1.25 GB', err: '~16% on "yes"', disk: 'rising' },
      scene: {
        nodes: [{ ...crawler, status: 'active' }, { ...filter, status: 'hot', badge: 'most bits are 1' }, { ...store, status: 'hot', badge: 'many wasted reads' }],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter'], tone: 'request', count: 5, duration: 1 },
          { path: ['filter', 'store'], tone: 'error', label: 'maybe, maybe, maybe', count: 4, duration: 1.2, delay: 1.1 },
        ],
        caption: 'An overfull filter says "maybe" to almost everything',
      },
    },
    {
      title: 'Count uniques',
      tag: 'concept',
      heading: 'HyperLogLog: how many different visitors?',
      eli5: 'To guess how many different children came today, the librarian asks each child to flip a coin until tails. She only remembers the longest run of heads. A very long run means lots of children came.',
      body: [
        'A different question: how many **unique** visitors did the site get today? The exact way keeps a set of every visitor ID. At 40 million visitors and 8 bytes each, that is 320 MB for one counter. Now keep one per page, per day.',
        '**HyperLogLog** (HLL) hashes each ID and looks at the bit pattern. A hash that starts with 20 zero bits shows up about once in a million distinct values, so seeing one suggests you have seen around a million different IDs. HLL splits the hashes into thousands of buckets, keeps the longest run of leading zeros seen in each, and averages them to smooth out luck.',
        'Duplicates change nothing, because the same ID always hashes to the same pattern. The Redis implementation uses 16,384 buckets, takes at most **12 KB**, and has a standard error of **0.81%**, whether it has counted a thousand items or a billion.',
      ],
      keyIdea: 'HyperLogLog estimates a unique count from hash patterns in a few kilobytes. It can count, but it cannot tell you who was counted.',
      metrics: { items: '40M uniques', mem: '12 KB', err: '±0.81%', disk: '-' },
      scene: {
        nodes: [visitors, { ...app, status: 'active' }, { ...hll, status: 'ok', badge: '≈ 40.2M uniques' }],
        links: [
          { from: 'visitors', to: 'app' },
          { from: 'app', to: 'hll' },
        ],
        flows: [
          { path: ['visitors', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'hll'], tone: 'data', label: 'PFADD user 77', count: 3, duration: 1, delay: 1.1 },
          { path: ['hll', 'app'], tone: 'response', label: 'PFCOUNT', duration: 1, delay: 2.4 },
        ],
        caption: '320 MB of IDs becomes 12 KB',
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
      title: 'Merge and sketch',
      tag: 'concept',
      heading: 'Merging counters, and counting how often',
      eli5: 'Two librarians at two doors can combine their notes at night by keeping the longer run for each page. A child who used both doors is still counted once.',
      body: [
        'Two HLLs **merge** by taking the larger value in each bucket. The result is the same as if one counter had seen both streams, so a user who visited on Monday and Tuesday is counted once. Daily counters roll up into weekly ones, and counters from 50 servers roll up into one, with no raw IDs shipped anywhere.',
        'A **count-min sketch** answers a third question: about how many times did this item appear? It is a small grid of counters. Each item is hashed once per row and increments one counter in each. To read, take the **minimum** across the rows. Collisions can only add, so the estimate can be too high and never too low.',
        'Count-min is how you find heavy hitters (the top search terms, the busiest IPs, the most clicked ads) in a stream too large to keep a counter per key.',
      ],
      keyIdea: 'Bloom answers "is it in the set?", HyperLogLog answers "how many distinct?", count-min answers "how often?".',
      metrics: { items: '7 daily counters', mem: '12 KB each', err: '±0.81%', disk: '-' },
      scene: {
        nodes: [app, { ...hllMon, badge: '40.2M' }, { ...hll, label: 'Tuesday', badge: '38.9M' }, { ...hllWeek, status: 'ok', badge: '≈ 61M uniques' }],
        links: [
          { from: 'app', to: 'hllMon' },
          { from: 'app', to: 'hll' },
          { from: 'hllMon', to: 'hllWeek', style: 'dashed' },
          { from: 'hll', to: 'hllWeek', style: 'dashed' },
        ],
        flows: [
          { path: ['hllMon', 'hllWeek'], tone: 'data', label: 'PFMERGE', duration: 1.3 },
          { path: ['hll', 'hllWeek'], tone: 'data', duration: 1.3 },
          { path: ['hllWeek', 'hll', 'app'], tone: 'response', label: '61M, not 79M', duration: 1.8, delay: 1.5 },
        ],
        caption: 'Merged counters do not double count',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Small, fast, and wrong by a known amount',
      eli5: 'The lamps by the door save the librarian most trips to the basement, and the coin-flip trick counts visitors without a name list. Both are quick guesses with a known, small mistake.',
      body: [
        'A **bloom filter** stores set membership in about 10 bits per item at 1% false positives. A "no" is certain, a "yes" means check the real store. It skips SSTable reads, guards caches against missing keys and dedups URLs for a crawler. It cannot delete, list or grow.',
        '**HyperLogLog** counts distinct items in about 12 KB with under 1% error, and counters merge without double counting. A **count-min sketch** estimates how often each item appears and only ever overestimates.',
        'All three give up exactness to save memory. Before using one, write down what a wrong answer costs in your system.',
      ],
      keyIdea: 'When exact answers cost too much memory, pick the structure whose error you can afford, and keep the exact data behind it.',
      metrics: { items: '1 billion', mem: '1.25 GB', err: '~1% on "yes"', disk: 'only on "maybe"' },
      scene: {
        nodes: [crawler, { ...filter, status: 'ok' }, store],
        links: crawlLinks,
        flows: [
          { path: ['crawler', 'filter', 'crawler'], tone: 'response', count: 4, duration: 1.8 },
          { path: ['filter', 'store'], tone: 'request', label: 'confirm', duration: 1.2, delay: 1 },
        ],
      },
      quiz: {
        question: 'A dashboard must show daily unique visitors per page for 2 million pages, and a 1% error is fine. Which structure fits?',
        options: [
          'A bloom filter per page',
          'A hash set of visitor IDs per page',
          'A HyperLogLog per page',
          'A count-min sketch shared by all pages',
        ],
        answer: 2,
        explain: 'The question is "how many distinct?", which is what HyperLogLog estimates, in at most 12 KB per page. A bloom filter answers membership, a count-min sketch answers frequency, and exact sets would need far more memory.',
      },
    },
  ],
};
