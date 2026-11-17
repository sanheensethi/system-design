import type { Lesson, SceneNode, SceneZone } from '../engine/types';

const cpu: SceneNode = { id: 'cpu', kind: 'server', at: [-5.5, 1], label: 'CPU core', sub: 'app server' };
const ram: SceneNode = { id: 'ram', kind: 'cache', at: [-2.5, -2], label: 'RAM', sub: '128 GB' };
const ssd: SceneNode = { id: 'ssd', kind: 'db', at: [-2, 2.5], label: 'NVMe SSD', sub: '2 TB' };
const hdd: SceneNode = { id: 'hdd', kind: 'storage', at: [1.25, 3.25], label: 'hard disk', sub: 'HDD' };
const peer: SceneNode = { id: 'peer', kind: 'server', at: [1, -3], label: 'nearby server', sub: 'same datacenter' };
const far: SceneNode = { id: 'far', kind: 'server', at: [5.5, -0.5], label: 'pricing service', sub: 'Netherlands' };

const ca: SceneZone = { id: 'ca', from: [-6.5, -4.2], to: [2.2, 5.2], label: 'California datacenter', tone: 'blue' };
const nl: SceneZone = { id: 'nl', from: [4.2, -2], to: [6.8, 1], label: 'Netherlands', tone: 'amber' };

export const latencyNumbers: Lesson = {
  id: 'latency-numbers',
  title: 'Latency numbers every engineer should know',
  tagline: 'From a CPU cache to the other side of the planet, and why the gaps shape every design.',
  minutes: 11,
  level: 'Beginner',
  learn: [
    'The latency ladder from L1 cache to a cross-continent round trip',
    'A human-scale trick that makes nanoseconds feel real',
    'Why memory, disk and network sit about 1,000x apart',
    'How to spot a chatty design before it ships',
    'How many operations per second one node can handle',
  ],
  metrics: [
    { key: 'op', label: 'Operation' },
    { key: 'latency', label: 'Latency' },
    { key: 'human', label: 'If 1 ns = 1 s' },
    { key: 'node', label: 'Per node' },
  ],
  steps: [
    {
      title: 'Gut feeling',
      tag: 'problem',
      heading: 'Fast code, slow page',
      eli5: 'The CPU core is a kid who does homework very fast. For each of 20 questions she mails a letter to the pricing service, a pen pal at a school across the ocean, and waits. All that waiting is called **latency**.',
      body: [
        'The checkout page loads in 3 seconds. The profiler says your code spends under 5 ms on the CPU. Everyone on the team swears the code is fast, and they are right.',
        'The handler loops over 20 cart items and calls the **pricing service** once per item. In development the service ran on your laptop. In production it runs in the Netherlands, and the app runs in California.',
        'Without a feel for how long things take, this design looks harmless in review. With the right numbers in your head, it looks like 20 transatlantic round trips, which is exactly what it is.',
      ],
      keyIdea: 'Design reviews go wrong when nobody knows the cost of an operation. A few memorized numbers fix that.',
      metrics: { op: '20 price calls', latency: '3 s', human: '95 years' },
      scene: {
        zones: [ca, nl],
        nodes: [{ ...cpu, status: 'hot', badge: '3 s per page' }, far],
        links: [{ from: 'cpu', to: 'far', style: 'dashed' }],
        flows: [
          { path: ['cpu', 'far'], tone: 'request', label: 'get_price(id)', count: 4, duration: 2.4 },
          { path: ['far', 'cpu'], tone: 'response', count: 4, duration: 2.4, delay: 2.5 },
        ],
        caption: 'One page, twenty trips across the Atlantic',
      },
    },
    {
      title: 'Inside the CPU',
      tag: 'concept',
      heading: 'Start at the core: the L1 cache',
      eli5: 'The **L1 cache** is what the kid already knows by heart. The answer pops out in one heartbeat, with no looking anything up.',
      body: [
        'A modern core reads from its **L1 cache** in about `0.5 ns`. The L2 cache takes `7 ns`, a branch mispredict costs `5 ns`, and locking a mutex costs `25 ns`.',
        'Nanoseconds mean nothing to a human brain, so we will use one trick for the whole lesson: pretend **1 ns lasts 1 second**. Then an L1 read takes half a second, about one heartbeat. An L2 read takes 7 seconds.',
      ],
      keyIdea: 'Scale everything so 1 ns is 1 second. The gaps between the numbers become something you can feel.',
      metrics: { op: 'L1 cache read', latency: '0.5 ns', human: '0.5 s' },
      scene: {
        zones: [ca],
        nodes: [{ ...cpu, status: 'active', badge: 'L1 0.5 ns · L2 7 ns' }],
        caption: 'Everything inside the chip is a heartbeat away',
      },
    },
    {
      title: 'Main memory',
      tag: 'concept',
      heading: 'RAM is 200 times further than L1',
      eli5: '**RAM** is the notebook lying open on the school desk. Looking there takes longer than remembering, yet it is still quick enough to do all day long.',
      body: [
        'When the data is not in the CPU caches, the core goes out to **main memory**. A RAM reference takes about `100 ns`. On our human scale that is 100 seconds: you could stand up and refill your coffee.',
        'Reading 1 MB sequentially from RAM takes `250 µs`. That is why in-memory stores like Redis and Memcached feel instant, and why one Redis node can serve 100K or more operations per second.',
      ],
      keyIdea: 'RAM is the last stop that still feels instant. Anything that keeps hot data in memory buys enormous headroom.',
      metrics: { op: 'RAM read', latency: '100 ns', human: '1.7 min', node: '100K+ ops/s' },
      scene: {
        zones: [ca],
        nodes: [cpu, { ...ram, status: 'active', badge: '100 ns' }],
        links: [{ from: 'cpu', to: 'ram' }],
        flows: [
          { path: ['cpu', 'ram'], tone: 'request', label: 'load', duration: 0.8 },
          { path: ['ram', 'cpu'], tone: 'response', duration: 0.8, delay: 0.85 },
        ],
      },
    },
    {
      title: 'Disk',
      tag: 'concept',
      heading: 'Disk is the first big cliff',
      eli5: 'The **SSD** is the bookshelf down the hall, so the kid has to get up and walk. The hard disk is the dusty school basement, where finding the right box takes ages.',
      body: [
        'A random read from an **NVMe SSD** takes about `150 µs`. That is 1,500 times slower than RAM. On our human scale it is 1.7 days: you asked for the data on Monday and it arrives Wednesday morning.',
        'A spinning **hard disk** is far worse. Moving the head to the right track (a seek) costs `10 ms`, which is four months on our scale. HDDs survive for cold storage and big sequential reads, where they never have to seek.',
        'This gap is why a SQL database keeps hot pages in a RAM buffer pool, and why one database node tops out around 10K reads per second.',
      ],
      keyIdea: 'Going from memory to disk costs about three orders of magnitude. Databases spend most of their engineering avoiding that trip.',
      metrics: { op: 'SSD random read', latency: '150 µs', human: '1.7 days', node: '~10K reads/s' },
      scene: {
        zones: [ca],
        nodes: [cpu, { ...ram, status: 'dim' }, { ...ssd, status: 'active', badge: '150 µs' }, { ...hdd, status: 'hot', badge: '10 ms seek' }],
        links: [
          { from: 'cpu', to: 'ram' },
          { from: 'cpu', to: 'ssd' },
          { from: 'ssd', to: 'hdd', style: 'faint' },
        ],
        flows: [
          { path: ['cpu', 'ssd'], tone: 'request', label: 'read page', duration: 1.2 },
          { path: ['ssd', 'cpu'], tone: 'response', duration: 1.2, delay: 1.25 },
          { path: ['ssd', 'hdd'], tone: 'request', label: 'seek…', duration: 3, delay: 0.4 },
        ],
      },
    },
    {
      title: 'Same datacenter',
      tag: 'concept',
      heading: 'A round trip inside the datacenter',
      eli5: 'The nearby server is a friend in the classroom next door. Walking over to ask and walking back is one **round trip**. One is quick, but ten in a row use up all of recess.',
      body: [
        'Calling another server in the same datacenter costs about `500 µs` round trip. That is 5.8 days on our scale, or 5,000 RAM reads.',
        'Sending 1 KB over a 1 Gbps link takes `10 µs`, and compressing that 1 KB with Snappy takes `3 µs`. So compression usually pays for itself on the wire.',
        'Half a millisecond sounds tiny until you chain calls. Ten synchronous calls to other services spend 5 ms in network alone, before any of them does real work.',
      ],
      keyIdea: 'A same-datacenter call is cheap once and expensive in a chain. Count the sequential hops in your request path.',
      metrics: { op: 'Same-DC round trip', latency: '500 µs', human: '5.8 days' },
      scene: {
        zones: [ca],
        nodes: [cpu, { ...ram, status: 'dim' }, { ...ssd, status: 'dim' }, { ...hdd, status: 'dim' }, { ...peer, status: 'active', badge: '500 µs RTT' }],
        links: [
          { from: 'cpu', to: 'ram', style: 'faint' },
          { from: 'cpu', to: 'ssd', style: 'faint' },
          { from: 'cpu', to: 'peer' },
        ],
        flows: [
          { path: ['cpu', 'peer'], tone: 'request', label: 'RPC', duration: 1.4 },
          { path: ['peer', 'cpu'], tone: 'response', duration: 1.4, delay: 1.45 },
        ],
      },
    },
    {
      title: 'Across ocean',
      tag: 'case',
      heading: 'Case: California to the Netherlands',
      eli5: 'A letter to the pricing service, the pen pal school across the ocean, and back again is a **cross-ocean round trip**. No kid can write fast enough to hurry the mail boat, so the fix is to send fewer letters.',
      body: [
        'A packet from California to the Netherlands and back takes about `150 ms`. On our human scale that is **4.8 years**. New York to Singapore is about 230 ms.',
        'No code change makes this faster. Light in fiber covers about 200,000 km per second, and the cable route is long. The only fix is to make fewer trips or to move the data closer to the code that needs it.',
        'Now look at our checkout page again. Twenty sequential price lookups at 150 ms each add up to 3 seconds. The CPU was idle the whole time, waiting.',
      ],
      keyIdea: 'Distance sets a floor that no optimization can lower. Every cross-ocean round trip in a request path is a design decision.',
      metrics: { op: 'CA to NL round trip', latency: '150 ms', human: '4.8 years' },
      scene: {
        zones: [ca, nl],
        nodes: [cpu, { ...ram, status: 'dim' }, { ...ssd, status: 'dim' }, { ...hdd, status: 'dim' }, { ...peer, status: 'dim' }, { ...far, status: 'active', badge: '150 ms RTT' }],
        links: [{ from: 'cpu', to: 'far', style: 'dashed', label: '~9,000 km' }],
        flows: [
          { path: ['cpu', 'far'], tone: 'request', duration: 3 },
          { path: ['far', 'cpu'], tone: 'response', duration: 3, delay: 3.1 },
        ],
      },
    },
    {
      title: '1,000x gaps',
      tag: 'tradeoff',
      heading: 'Three tiers, each a thousand times slower',
      eli5: 'The desk notebook, the hallway bookshelf and the faraway pen pal are three **tiers**. Each one takes about a thousand times longer than the one before, so where an answer lives matters more than how fast the kid writes.',
      body: [
        'Line the four numbers up: RAM at `100 ns`, SSD at `150 µs`, a datacenter round trip at `500 µs`, and an ocean round trip at `150 ms`. Each jump from memory to disk to far network is roughly **1,000x**.',
        'Those gaps explain most of the tools in this course. Caches exist because RAM is 1,000x faster than disk. CDNs and multi-region setups exist because the ocean is 1,000x slower than the datacenter. Batching exists because one round trip costs the same whether it carries 1 item or 100.',
        'Sequential access narrows the gap. Reading 1 MB from SSD takes `1 ms`, only 4x slower than RAM. That is why logs like Kafka write and read in long sequential runs.',
      ],
      keyIdea: 'When two options differ by 1,000x, the details of your code stop mattering. Pick the right tier first.',
      metrics: { op: 'Each tier down', latency: '~1,000x slower', human: 'min → days → years' },
      scene: {
        zones: [ca, nl],
        nodes: [cpu, { ...ram, badge: '100 ns' }, { ...ssd, badge: '150 µs' }, { ...hdd, status: 'dim' }, { ...peer, badge: '500 µs' }, { ...far, badge: '150 ms' }],
        links: [
          { from: 'cpu', to: 'ram' },
          { from: 'cpu', to: 'ssd' },
          { from: 'cpu', to: 'peer' },
          { from: 'cpu', to: 'far', style: 'dashed' },
        ],
        flows: [
          { path: ['cpu', 'ram', 'cpu'], tone: 'request', duration: 0.6 },
          { path: ['cpu', 'ssd', 'cpu'], tone: 'request', duration: 1.4 },
          { path: ['cpu', 'peer', 'cpu'], tone: 'request', duration: 2 },
          { path: ['cpu', 'far', 'cpu'], tone: 'request', duration: 5 },
        ],
        caption: 'Same request, four distances',
      },
      code: {
        language: 'python',
        title: 'Print the ladder on a human scale',
        source: `LADDER_NS = {
    "L1 cache reference":  0.5,
    "RAM reference":       100,
    "SSD random read":     150_000,
    "Round trip, same DC": 500_000,
    "HDD seek":            10_000_000,
    "Round trip, CA to NL": 150_000_000,
}

def human(seconds):
    for unit, size in [("years", 31_536_000), ("days", 86_400),
                       ("hours", 3_600), ("min", 60)]:
        if seconds >= size:
            return f"{seconds / size:.1f} {unit}"
    return f"{seconds:.1f} s"

for op, ns in LADDER_NS.items():
    print(f"{op:<22} {human(ns)}")   # pretend 1 ns is 1 second`,
        highlight: [3, 4, 7, 18],
      },
      quiz: {
        question: 'Roughly how many RAM reads fit in the time of one round trip to another server in the same datacenter?',
        options: ['About 5', 'About 50', 'About 5,000', 'About 5 million'],
        answer: 2,
        explain: 'A same-datacenter round trip is about 500 µs and a RAM reference is about 100 ns. 500,000 ns divided by 100 ns is 5,000.',
      },
    },
    {
      title: 'Chatty calls',
      tag: 'case',
      heading: 'Case: fixing the checkout page',
      eli5: 'The kid puts all 20 questions into one letter, which is called **batching**. Even better, a copy of the answers can live next door in the pricing replica, or in the desk notebook, the price cache.',
      body: [
        'Back to the slow checkout. The code was fine. The design made 20 sequential cross-ocean trips. There are three fixes, each one rung further down the ladder.',
        '**Batch** the lookups into one call: one round trip, 150 ms. **Replicate** the pricing data into the California datacenter: one same-DC trip, 0.5 ms. **Cache** prices in local memory and refresh them every minute: a few hundred nanoseconds.',
        'Each fix trades something. Batching needs a new endpoint. A replica or cache can serve a price that is a minute old. For a checkout page, a stale price for 60 seconds is usually fine as long as payment re-checks it.',
      ],
      keyIdea: 'Count round trips, then remove them: batch, move the data closer, or keep it in memory.',
      metrics: { op: '1 batched call', latency: '150 ms', human: '4.8 years' },
      scene: {
        zones: [ca, nl],
        nodes: [
          { ...cpu, status: 'ok', badge: '150 ms per page' },
          { ...ram, status: 'active', label: 'price cache', badge: 'hit · 100 ns' },
          { ...ssd, status: 'dim' },
          { ...hdd, status: 'dim' },
          { ...peer, label: 'pricing replica', badge: '0.5 ms' },
          far,
        ],
        links: [
          { from: 'cpu', to: 'ram' },
          { from: 'cpu', to: 'peer' },
          { from: 'cpu', to: 'far', style: 'dashed' },
          { from: 'far', to: 'peer', style: 'faint', label: 'sync' },
        ],
        flows: [
          { path: ['cpu', 'far'], tone: 'request', label: 'get_prices([20 ids])', duration: 2.4 },
          { path: ['far', 'cpu'], tone: 'response', label: '20 prices', duration: 2.4, delay: 2.5 },
          { path: ['far', 'peer'], tone: 'data', duration: 2.4, delay: 1 },
          { path: ['cpu', 'ram', 'cpu'], tone: 'request', duration: 0.8, delay: 0.2 },
        ],
      },
      code: {
        language: 'python',
        title: 'Three ways down the ladder',
        source: `# Before: 20 round trips x 150 ms = 3 s
prices = {}
for item in cart.items:
    prices[item.id] = pricing.get_price(item.id)

# Batch: 1 round trip, about 150 ms
prices = pricing.get_prices([item.id for item in cart.items])

# Local replica: 1 same-DC round trip, about 0.5 ms
prices = pricing_replica.get_prices([i.id for i in cart.items])

# In-memory cache, refreshed every 60 s: well under 1 µs
prices = {i.id: price_cache[i.id] for i in cart.items}`,
        highlight: [3, 4, 7, 13],
      },
    },
    {
      title: 'Throughput',
      tag: 'concept',
      heading: 'How much one node can do per second',
      eli5: '**Throughput** is how many questions a helper can answer in one minute. Redis reads from its notebook and answers heaps. Postgres walks to the bookshelf, so it answers fewer.',
      body: [
        'Latency says how long one operation takes. **Throughput** says how many a node finishes per second, and it is the number that turns traffic into a server count.',
        'Working numbers per node: a REST app server handles `1K to 10K` requests per second. A SQL database gives about `10K` reads and `5K` writes per second, limited by index lookups and flushing its write-ahead log. Redis does `100K to 200K` operations per second because every operation stays in RAM. A Kafka broker takes about `1M` small messages per second because it writes sequentially.',
        'Read the SQL number twice. One Postgres box gives you about 10K reads per second, so a design that needs 500K reads per second needs caches, replicas or a different store. The next lesson turns this into arithmetic.',
      ],
      keyIdea: 'Latency tells you how slow one call is. Throughput per node tells you how many boxes you need.',
      metrics: { op: 'Postgres read', latency: '~1 ms', human: '11.6 days', node: '~10K/s' },
      scene: {
        nodes: [
          { ...cpu, label: 'app server', sub: 'REST', status: 'active', badge: '1K-10K QPS' },
          { ...ram, label: 'Redis', sub: 'in memory', badge: '100K-200K ops/s' },
          { ...ssd, label: 'Postgres', sub: 'on SSD', status: 'hot', badge: '10K reads · 5K writes' },
          { id: 'kafka', kind: 'queue', at: [1.25, 3.25], label: 'Kafka broker', sub: 'sequential log', badge: '~1M msgs/s' },
        ],
        links: [
          { from: 'cpu', to: 'ram' },
          { from: 'cpu', to: 'ssd' },
          { from: 'cpu', to: 'kafka' },
        ],
        flows: [
          { path: ['cpu', 'ram'], tone: 'request', count: 6, duration: 0.8 },
          { path: ['cpu', 'ssd'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['cpu', 'kafka'], tone: 'event', count: 8, duration: 1.2 },
        ],
        caption: 'Same app, three very different ceilings',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Four numbers that make you dangerous',
      eli5: 'Know where each answer lives: in your head, in the notebook, down the hall, next door, or across the ocean. Count the walks and letters, the **round trips**, and move the answers you use most one step closer.',
      body: [
        'If you remember nothing else: RAM is `100 ns`, an SSD read is `150 µs`, a same-datacenter round trip is `500 µs`, and a cross-continent round trip is `150 ms`. Memory, disk and far network sit about 1,000x apart.',
        'Use them in every review. Count the round trips in a request path, notice which tier each one hits, and ask whether the data could live one rung closer. Then use throughput per node to size the fleet.',
      ],
      keyIdea: 'Know the ladder, count the hops, and move hot data one rung closer whenever the gap is 1,000x.',
      metrics: { op: 'The ladder', latency: '100 ns → 150 ms', human: 'min → years', node: '~10K SQL reads/s' },
      scene: {
        zones: [ca, nl],
        nodes: [{ ...cpu, status: 'ok' }, ram, ssd, { ...hdd, status: 'dim' }, peer, far],
        links: [
          { from: 'cpu', to: 'ram' },
          { from: 'cpu', to: 'ssd' },
          { from: 'ssd', to: 'hdd', style: 'faint' },
          { from: 'cpu', to: 'peer' },
          { from: 'cpu', to: 'far', style: 'dashed' },
        ],
        flows: [
          { path: ['cpu', 'ram', 'cpu'], tone: 'response', duration: 0.6 },
          { path: ['cpu', 'ssd', 'cpu'], tone: 'response', duration: 1.4 },
          { path: ['cpu', 'peer', 'cpu'], tone: 'response', duration: 2 },
          { path: ['cpu', 'far', 'cpu'], tone: 'response', duration: 5 },
        ],
      },
      quiz: {
        question: 'A request handler makes 5 sequential calls to a service on another continent (150 ms each) and does 2 ms of CPU work. Which change helps most?',
        options: [
          'Move the app to a server with a faster CPU',
          'Replace the hard disks with SSDs',
          'Batch the 5 calls into one, or serve the data from the same region',
          'Add more RAM to the app server',
        ],
        answer: 2,
        explain: 'The request spends 750 ms on round trips and 2 ms computing. Only removing round trips or shortening them changes the total in a meaningful way.',
      },
    },
  ],
};
