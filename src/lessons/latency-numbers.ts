import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const cpu: SceneNode = { id: 'cpu', kind: 'block', at: at(-5, 0), label: 'CPU core', sub: 'app server', icon: 'Cpu', tint: 'blue' };
const ram: SceneNode = { id: 'ram', kind: 'cache', at: at(-1.5, -3.8), label: 'RAM', sub: '128 GB' };
const ssd: SceneNode = { id: 'ssd', kind: 'db', at: at(-1.5, 3.8), label: 'NVMe SSD', sub: '2 TB' };
const hdd: SceneNode = { id: 'hdd', kind: 'storage', at: at(2, 3.8), label: 'hard disk', sub: 'HDD' };
const peer: SceneNode = { id: 'peer', kind: 'server', at: at(2, -3.8), label: 'nearby server', sub: 'same datacenter' };
const far: SceneNode = { id: 'far', kind: 'server', at: at(5.5, 0), label: 'pricing service', sub: 'Netherlands' };

export const latencyNumbers: Lesson = {
  id: 'latency-numbers',
  title: 'Latency numbers every engineer should know (part 1)',
  tagline: 'From a CPU cache to the other side of the planet, and why the gaps shape every design.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'A human-scale trick that makes nanoseconds feel real',
    'The latency ladder from L1 cache to a cross-continent round trip',
    'Random versus sequential reads, and why sequential wins',
    'Why a chain of small network calls adds up',
    'Why memory, disk and far network sit hundreds to thousands of times apart',
  ],
  metrics: [
    { key: 'op', label: 'Operation', icon: 'Activity' },
    { key: 'latency', label: 'Latency', icon: 'Clock' },
    { key: 'human', label: 'If 1 ns = 1 s', icon: 'Timer' },
    { key: 'gap', label: 'Gap', icon: 'Scale' },
  ],
  steps: [
    {
      title: 'Gut feeling',
      tag: 'problem',
      heading: 'Fast code, slow page',
      eli5: 'The **CPU core** is a kid who does homework very fast. For each of 20 questions she mails a letter to the pricing service, a pen pal at a school across the ocean, and waits. All that waiting is called **latency**.',
      body: [
        'The checkout page loads in 3 seconds. The profiler says the code spends under 5 ms on the CPU, and the team is right that the code is fast.',
        'The handler loops over 20 cart items and calls the **pricing service** once per item. In development it ran on your laptop. In production it runs in the Netherlands and the app runs in California.',
        'A reviewer sees a harmless loop. The numbers say 20 transatlantic round trips.',
      ],
      keyIdea: 'Design reviews go wrong when nobody knows the cost of an operation. A few memorized numbers fix that.',
      metrics: { op: '20 price calls', latency: '3 s', human: '95 years', gap: '600x the CPU work' },
      metricTones: { latency: 'bad', human: 'bad' },
      scene: {
        nodes: [
          { ...cpu, label: 'checkout app', sub: 'California', status: 'hot', load: 5, badge: '3 s per page', chips: ['get_price(1)', 'get_price(2)', 'get_price(…20)'] },
          { ...far, icon: 'Receipt', status: 'active' },
        ],
        links: [link('cpu', 'far', { style: 'dashed', label: 'Atlantic · 150 ms per round trip', labelTone: 'warn' })],
        flows: [
          { path: ['cpu', 'far'], tone: 'request', label: 'get_price(id)', count: 3, duration: 2.4 },
          { path: ['far', 'cpu'], tone: 'response', count: 3, duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'Where the 3 seconds go',
          icon: 'Timer',
          rows: [
            { text: 'CPU work', value: '5 ms', tone: 'good' },
            { text: 'Price calls', value: '20 × 150 ms', tone: 'bad' },
            { text: 'Page load', value: '3 s', tone: 'bad' },
          ],
          footer: { text: 'The CPU is idle while it waits', tone: 'bad' },
        },
        caption: 'One page, twenty trips across the Atlantic',
      },
    },
    {
      title: 'Human scale',
      tag: 'concept',
      heading: 'Pretend 1 nanosecond lasts 1 second',
      eli5: 'A nanosecond is too tiny to picture, so we pretend it lasts as long as one **second** on a wall clock. Then a blink of the CPU becomes a heartbeat the kid can feel.',
      body: [
        'Nanoseconds mean nothing to a human brain. So we use one trick for the whole lesson: **1 ns lasts 1 second**.',
        'At that scale 1 µs is 17 minutes, 1 ms is 12 days and 1 full second is 32 years. Every number later in the lesson comes with its human-scale twin.',
      ],
      keyIdea: 'Scale everything so 1 ns is 1 second. The gaps between the numbers become something you can feel.',
      metrics: { op: 'The scale', latency: '1 ns', human: '1 s' },
      scene: {
        nodes: [
          { ...cpu, status: 'active' },
          { id: 'clock', kind: 'block', at: at(0, 0), label: '1 ns = 1 s', sub: 'human scale', icon: 'Timer', tint: 'violet', status: 'active' },
        ],
        links: [link('cpu', 'clock', { route: 'straight', label: 'slow motion', arrow: 'none' })],
        panel: {
          title: 'Real time to human time',
          icon: 'Clock',
          rows: [
            { text: '1 ns', value: '1 second' },
            { text: '1 µs', value: '17 minutes' },
            { text: '1 ms', value: '12 days' },
            { text: '1 s', value: '32 years', tone: 'warn' },
          ],
        },
        caption: 'Slow the whole machine down a billion times',
      },
    },
    {
      title: 'CPU caches',
      tag: 'concept',
      heading: 'Start at the core: the L1 and L2 caches',
      eli5: 'The **L1 cache** is what the kid already knows by heart. The answer pops out in one heartbeat, with no looking anything up.',
      body: [
        'A modern core reads from its **L1 cache** in about `0.5 ns`. On our human scale that is half a second, about one heartbeat.',
        'The **L2 cache** is bigger and a little further away. It takes `7 ns`, which is 7 seconds.',
      ],
      keyIdea: 'Everything inside the chip is a heartbeat away. This is the fast end of the ladder.',
      metrics: { op: 'L1 cache read', latency: '0.5 ns', human: '0.5 s', gap: 'baseline' },
      metricTones: { latency: 'good', human: 'good' },
      scene: {
        nodes: [{ ...cpu, status: 'active', chips: [{ text: 'L1 · 0.5 ns', tone: 'good' }, { text: 'L2 · 7 ns', tone: 'good' }] }],
        panel: {
          title: 'Inside the chip',
          icon: 'Cpu',
          rows: [
            { text: 'L1 cache reference', value: '0.5 ns · 0.5 s', tone: 'good' },
            { text: 'L2 cache reference', value: '7 ns · 7 s', tone: 'good' },
          ],
          footer: { text: 'L2 is 14x slower than L1, still tiny', tone: 'muted' },
        },
        caption: 'Caches on the chip answer in seconds on our scale',
      },
    },
    {
      title: 'Branch mispredict',
      tag: 'concept',
      heading: 'A wrong guess costs ten cache reads',
      eli5: 'Sometimes the kid guesses which page the teacher will ask about, guesses wrong, and has to start over.',
      body: [
        'A **branch mispredict** costs `5 ns`. The CPU guessed which way an `if` would go, guessed wrong, and threw away work. That is 5 seconds on our scale, 10 L1 reads.',
        'It is small, but loops run billions of times, so a badly predictable branch in a hot loop shows up in profiles.',
      ],
      keyIdea: 'Even inside one core, a wrong guess costs about ten cache reads.',
      metrics: { op: 'Branch mispredict', latency: '5 ns', human: '5 s', gap: '10x L1' },
      metricTones: { gap: 'warn' },
      scene: {
        nodes: [{ ...cpu, status: 'active', chips: [{ text: 'branch miss · 5 ns', tone: 'warn' }] }],
        panel: {
          title: 'CPU costs, human scale',
          icon: 'Cpu',
          rows: [
            { text: 'L1 cache reference', value: '0.5 s', tone: 'good' },
            { text: 'Branch mispredict', value: '5 s', tone: 'warn' },
            { text: 'L2 cache reference', value: '7 s' },
          ],
        },
        caption: 'A wrong guess throws work away',
      },
    },
    {
      title: 'Locks',
      tag: 'concept',
      heading: 'A lock costs fifty cache reads',
      eli5: 'Taking turns with one pencil, a **lock**, makes the kid wait even when she knows the answer.',
      body: [
        'Locking and unlocking a **mutex** costs `25 ns`, or 25 seconds on our scale. That is 50 L1 reads for one lock, which is why hot locks hurt.',
        'Many threads fighting over one lock also queue up behind each other, so the real cost under contention is higher.',
      ],
      keyIdea: 'A shared lock costs many times a cache read, so keep hot locks rare.',
      metrics: { op: 'Mutex lock/unlock', latency: '25 ns', human: '25 s', gap: '50x L1' },
      metricTones: { gap: 'warn' },
      scene: {
        nodes: [{ ...cpu, status: 'active', chips: [{ text: 'mutex · 25 ns', tone: 'warn' }] }],
        panel: {
          title: 'CPU costs, human scale',
          icon: 'Cpu',
          rows: [
            { text: 'L1 cache reference', value: '0.5 s', tone: 'good' },
            { text: 'L2 cache reference', value: '7 s' },
            { text: 'Mutex lock/unlock', value: '25 s', tone: 'warn' },
          ],
        },
        caption: 'One pencil, many kids',
      },
    },
    {
      title: 'Main memory',
      tag: 'concept',
      heading: 'RAM is 200 times further than L1',
      eli5: '**RAM** is the notebook lying open on the school desk. Looking there takes longer than remembering, yet it is still quick enough to do all day long.',
      body: [
        'When data is not in the CPU caches, the core goes out to **main memory**. A RAM reference takes about `100 ns`. On our human scale that is 100 seconds: you could stand up and refill your coffee.',
        'That is still the last stop that feels instant. In-memory stores like Redis and Memcached serve 100K or more operations per second from one node because of it.',
      ],
      keyIdea: 'RAM is the last stop that still feels instant. Anything that keeps hot data in memory buys enormous headroom.',
      metrics: { op: 'RAM reference', latency: '100 ns', human: '1.7 min', gap: '200x L1' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [cpu, { ...ram, status: 'active', badge: '100 ns' }],
        links: [link('cpu', 'ram', { label: '100 ns' })],
        flows: [
          { path: ['cpu', 'ram'], tone: 'request', label: 'load', duration: 1 },
          { path: ['ram', 'cpu'], tone: 'response', duration: 1, delay: 1.05 },
        ],
        panel: {
          title: 'L1 versus RAM',
          icon: 'Gauge',
          rows: [
            { text: 'L1 cache', value: '0.5 ns · 0.5 s', tone: 'good' },
            { text: 'RAM reference', value: '100 ns · 1.7 min', tone: 'good' },
          ],
          footer: { text: 'Redis reads here: 100K+ ops/s per node', tone: 'muted' },
        },
        caption: 'A coffee break away, still instant to a human',
      },
    },
    {
      title: 'Wire vs CPU',
      tag: 'concept',
      heading: 'Compressing is cheaper than sending',
      eli5: 'Before mailing a thick letter the kid folds her words into a short note. This **compression** takes a moment, and the thin note travels faster than the fat letter.',
      body: [
        'Compressing 1 KB with Snappy costs `3 µs` of CPU. Sending 1 KB over a 1 Gbps link costs `10 µs`.',
        'When the data shrinks well, 3 µs of CPU saves more than that on the wire. The saving repeats for every KB, so compression usually pays for itself on a network hop.',
      ],
      keyIdea: 'CPU time is cheap next to network time. Spending a little CPU to send fewer bytes is usually a win.',
      metrics: { op: 'Compress 1 KB', latency: '3 µs', human: '50 min', gap: '3x cheaper than sending' },
      metricTones: { gap: 'good' },
      scene: {
        nodes: [cpu, { ...peer, status: 'active', at: at(0, 0) }],
        links: [link('cpu', 'peer', { route: 'straight', label: '1 Gbps link' })],
        flows: [
          { path: ['cpu', 'peer'], tone: 'data', label: '1 KB', duration: 1.6 },
        ],
        panel: {
          title: 'Per 1 KB',
          icon: 'Cable',
          rows: [
            { text: 'Compress with Snappy', value: '3 µs · 50 min', tone: 'good' },
            { text: 'Send over 1 Gbps', value: '10 µs · 2.8 hr', tone: 'warn' },
          ],
          footer: { text: 'Smaller payload, shorter wire time', tone: 'good' },
        },
        caption: 'Fewer bytes on the wire, more work on the CPU',
      },
    },
    {
      title: 'SSD reads',
      tag: 'concept',
      heading: 'The first big cliff: a random SSD read',
      eli5: 'The **SSD** is the bookshelf down the hall, so the kid has to get up and walk. A random read means fetching one book from a spot she picked.',
      body: [
        'A random read from an **NVMe SSD** takes about `150 µs`. That is 1,500 times slower than RAM. On our human scale it is 1.7 days: you asked for the data on Monday and it arrives Wednesday morning.',
        'Going from memory to disk costs about three orders of magnitude. Storage engines spend most of their effort avoiding that trip.',
      ],
      keyIdea: 'Going from memory to disk costs about 1,500x. Databases spend most of their engineering avoiding that trip.',
      metrics: { op: 'SSD random read', latency: '150 µs', human: '1.7 days', gap: '1,500x RAM' },
      metricTones: { latency: 'warn', human: 'bad', gap: 'bad' },
      scene: {
        nodes: [cpu, { ...ram, status: 'dim' }, { ...ssd, status: 'active', badge: '150 µs' }],
        links: [link('cpu', 'ram', { style: 'faint' }), link('cpu', 'ssd', { label: 'random read' })],
        flows: [
          { path: ['cpu', 'ssd'], tone: 'request', label: 'read page', duration: 1.6 },
          { path: ['ssd', 'cpu'], tone: 'response', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'RAM versus SSD',
          icon: 'HardDrive',
          rows: [
            { text: 'RAM reference', value: '100 ns · 1.7 min', tone: 'good' },
            { text: 'SSD random read', value: '150 µs · 1.7 days', tone: 'bad' },
          ],
          footer: { text: '1,500x apart', tone: 'bad' },
        },
        caption: 'The bookshelf is a day-trip away',
      },
    },
    {
      title: 'Sequential reads',
      tag: 'concept',
      heading: 'Sequential reads shrink the gap',
      eli5: 'Fetching one book at a time means a trip to the shelf for each. Grabbing a whole row of books in one walk is a **sequential read**, and it costs far less per book.',
      body: [
        'Reading 1 MB in one long run takes `250 µs` from RAM, `1 ms` from SSD and `20 ms` from a hard disk. SSD is only 4x slower than RAM here, because the expensive lookup happens once.',
        'Now read the same 1 MB as 256 random 4 KB reads. On SSD that is 256 × 150 µs, about 38 ms, against 1 ms in a row. On a hard disk it is 256 × 10 ms, about 2.5 s, against 20 ms in a row.',
        'That is why logs like Kafka write and read in long sequential runs, and why databases love to scan a page at a time.',
      ],
      keyIdea: 'Random access pays the lookup cost every time. Sequential access pays it once, so lay data out to be read in a row.',
      metrics: { op: 'Read 1 MB in a row', latency: '0.25 to 20 ms', human: '2.9 to 231 days', gap: 'SSD: 38x faster than random' },
      metricTones: { gap: 'good' },
      scene: {
        nodes: [{ ...ram, status: 'active', badge: '250 µs' }, { ...ssd, status: 'active', badge: '1 ms' }, { ...hdd, status: 'active', badge: '20 ms' }],
        links: [link('ram', 'ssd', { style: 'faint', label: 'RAM to SSD' }), link('ssd', 'hdd', { style: 'faint', label: 'SSD to HDD' })],
        panel: {
          title: 'Read 1 MB sequentially',
          icon: 'Table',
          rows: [
            { text: 'From RAM', value: '250 µs · 2.9 days', tone: 'good' },
            { text: 'From SSD', value: '1 ms · 12 days', tone: 'good' },
            { text: 'From HDD', value: '20 ms · 7.7 months', tone: 'warn' },
            { text: 'SSD, 256 random 4 KB reads', value: '38 ms vs 1 ms', tone: 'bad' },
            { text: 'HDD, 256 random 4 KB reads', value: '2.5 s vs 20 ms', tone: 'bad' },
          ],
          footer: { text: 'Same 1 MB: random costs 38x to 125x more', tone: 'muted' },
        },
        caption: 'One long read beats many small ones',
      },
    },
    {
      title: 'Hard disk',
      tag: 'concept',
      heading: 'A spinning disk pays a seek every time',
      eli5: 'The hard disk is the dusty school basement. Finding the right box means walking the whole aisle first, which takes ages, but carrying a full box out is quick.',
      body: [
        'A spinning **hard disk** must move its head to the right track before reading. That **seek** costs `10 ms`, which is four months on our scale.',
        'HDDs survive for cold storage and big sequential reads, where they seek once and then stream. For random reads they are 67x slower than an SSD.',
      ],
      keyIdea: 'A seek is the price of a spinning disk. Use HDDs for data you read in large runs.',
      metrics: { op: 'HDD seek', latency: '10 ms', human: '116 days', gap: '67x SSD' },
      metricTones: { latency: 'bad', human: 'bad', gap: 'bad' },
      scene: {
        nodes: [cpu, { ...ssd, status: 'dim' }, { ...hdd, status: 'hot', badge: '10 ms seek' }],
        links: [link('cpu', 'ssd', { style: 'faint' }), link('ssd', 'hdd', { style: 'faint' })],
        flows: [{ path: ['cpu', 'ssd', 'hdd'], tone: 'request', label: 'seek…', duration: 3.2 }],
        panel: {
          title: 'Random read cost',
          icon: 'HardDrive',
          rows: [
            { text: 'SSD random read', value: '150 µs · 1.7 days', tone: 'warn' },
            { text: 'HDD seek', value: '10 ms · 116 days', tone: 'bad' },
          ],
          footer: { text: '10 ms ÷ 150 µs is about 67x', tone: 'muted' },
        },
        caption: 'The basement takes months on our scale',
      },
    },
    {
      title: 'Buffer pool',
      tag: 'case',
      heading: 'Case: why a database keeps pages in RAM',
      eli5: 'The librarian keeps the books everyone asks for on the desk. A **buffer pool** is that desk, so most requests never walk down the hall.',
      body: [
        'A SQL database keeps its hot pages in a RAM **buffer pool**. A page found there costs about `100 ns`. A page that has to come from the SSD costs `150 µs`.',
        'A single SQL box serves about 10K reads per second in practice, limited by parsing, index lookups and locking. Misses are the expensive part, and the hit rate sets the average: at 99% hits the average page costs about 1.6 µs, and a bigger pool means fewer misses.',
      ],
      keyIdea: 'A database is a RAM cache in front of a disk. Its speed is mostly its hit rate.',
      metrics: { op: 'Buffer pool hit', latency: '100 ns', human: '1.7 min', gap: 'miss is 1,500x' },
      metricTones: { latency: 'good', gap: 'warn' },
      scene: {
        nodes: [
          { ...cpu, label: 'app server', sub: 'SQL queries' },
          { ...ram, label: 'buffer pool', sub: 'hot pages', status: 'ok', badge: 'hit · 100 ns', chips: ['SELECT … id=42'] },
          { ...ssd, label: 'Postgres', sub: 'on SSD', status: 'active', chips: [{ text: 'miss · 150 µs', tone: 'warn' }] },
        ],
        links: [link('cpu', 'ram'), link('ram', 'ssd', { label: 'on a miss' })],
        flows: [
          { path: ['cpu', 'ram', 'cpu'], tone: 'request', duration: 1.2 },
          { path: ['ram', 'ssd', 'ram'], tone: 'request', duration: 2.4, delay: 1.4 },
        ],
        panel: {
          title: 'One page read',
          icon: 'Database',
          rows: [
            { text: 'Hit in the pool', value: '100 ns', tone: 'good' },
            { text: 'Miss, read from SSD', value: '150 µs', tone: 'warn' },
          ],
          footer: { text: '99% hits: about 1.6 µs average per page', tone: 'muted' },
        },
        caption: 'Most reads should never touch the disk',
      },
    },
    {
      title: 'Same datacenter',
      tag: 'concept',
      heading: 'A round trip inside the datacenter',
      eli5: 'The nearby server is a friend in the classroom next door. Walking over to ask and walking back is one **round trip**. One is quick, but ten in a row use up all of recess.',
      body: [
        'Calling another server in the same datacenter costs about `500 µs` round trip. That is 5.8 days on our scale, or 5,000 RAM reads.',
        'It is cheap once. The next step shows what happens when you chain them.',
      ],
      keyIdea: 'A same-datacenter call is about 5,000 RAM reads. Cheap once, so count how often you do it.',
      metrics: { op: 'Same-DC round trip', latency: '500 µs', human: '5.8 days', gap: '5,000 RAM reads' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [cpu, { ...ram, status: 'dim' }, { ...peer, status: 'active', badge: '500 µs RTT' }],
        links: [link('cpu', 'ram', { style: 'faint' }), link('cpu', 'peer', { label: 'same datacenter' })],
        flows: [
          { path: ['cpu', 'peer'], tone: 'request', label: 'RPC', duration: 1.6 },
          { path: ['peer', 'cpu'], tone: 'response', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One hop next door',
          icon: 'Network',
          rows: [
            { text: 'RAM reference', value: '100 ns', tone: 'good' },
            { text: 'Same-DC round trip', value: '500 µs · 5.8 days', tone: 'warn' },
          ],
          footer: { text: '5,000 RAM reads fit in one hop', tone: 'muted' },
        },
        caption: 'The classroom next door',
      },
    },
    {
      title: 'Hop chains',
      tag: 'case',
      heading: 'Ten calls in a row cost 5 ms before any work',
      eli5: 'The kid asks the friend next door a question, waits for the answer, then asks the next one. Every question is another walk, and ten walks add up.',
      body: [
        'Half a millisecond sounds tiny until you chain calls. A handler that calls auth, cart and stock services one after another, each waiting for the last, pays a round trip per call.',
        'Ten sequential calls to other services spend 5 ms in network alone, before any of them does real work. That is your latency budget spent on walking.',
      ],
      keyIdea: 'Count the sequential calls in a request path. Each one is 0.5 ms you cannot get back.',
      metrics: { op: '10 chained calls', latency: '5 ms', human: '58 days', gap: '10 x 0.5 ms' },
      metricTones: { latency: 'warn', human: 'warn' },
      scene: {
        nodes: [
          { id: 'app', kind: 'block', at: at(-4, 0), label: 'app', sub: 'request handler', icon: 'Cpu', tint: 'blue', status: 'active' },
          { id: 'svc', kind: 'block', at: at(4, 0), label: 'service A', sub: 'same datacenter', icon: 'Server', tint: 'violet', status: 'active', chips: [{ text: '10 sequential calls × 0.5 ms', tone: 'warn' }] },
        ],
        links: [link('app', 'svc', { route: 'straight', label: '0.5 ms per round trip', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'svc', 'app'], tone: 'request', count: 3, duration: 1.4 },
        ],
        panel: {
          title: 'Network time only',
          icon: 'Repeat',
          rows: [
            { text: '1 call', value: '0.5 ms' },
            { text: '4 calls', value: '2 ms' },
            { text: '10 calls', value: '5 ms', tone: 'warn' },
          ],
          footer: { text: 'Before any real work happens', tone: 'warn' },
        },
        caption: 'The app waits for each answer before asking again',
      },
    },
    {
      title: 'Across ocean',
      tag: 'case',
      heading: 'Case: California to the Netherlands',
      eli5: 'A letter to the pricing service, the pen pal school across the ocean, and back again is a **cross-ocean round trip**. It takes years of our slow-motion time.',
      body: [
        'A packet from California to the Netherlands and back takes about `150 ms`. On our human scale that is **4.8 years**. New York to Singapore is about 230 ms, or 7.3 years.',
        'This is about 300 times the datacenter number, and it is the one every global product has to live with.',
      ],
      keyIdea: 'A cross-ocean round trip is the slowest number on the ladder. Every one in a request path is a design decision.',
      metrics: { op: 'CA to NL round trip', latency: '150 ms', human: '4.8 years', gap: '300x same-DC' },
      metricTones: { latency: 'bad', human: 'bad', gap: 'bad' },
      scene: {
        nodes: [{ ...cpu, label: 'app', sub: 'California' }, { ...far, status: 'active', badge: '150 ms RTT' }],
        links: [link('cpu', 'far', { style: 'dashed', label: '~9,000 km · 150 ms', labelTone: 'warn' })],
        flows: [
          { path: ['cpu', 'far'], tone: 'request', duration: 3 },
          { path: ['far', 'cpu'], tone: 'response', duration: 3, delay: 3.1 },
        ],
        panel: {
          title: 'Long round trips',
          icon: 'Earth',
          rows: [
            { text: 'Same datacenter', value: '500 µs', tone: 'good' },
            { text: 'California to Netherlands', value: '150 ms · 4.8 years', tone: 'bad' },
            { text: 'New York to Singapore', value: '230 ms · 7.3 years', tone: 'bad' },
          ],
        },
        caption: 'The pen pal lives across an ocean',
      },
    },
    {
      title: 'Speed of light',
      tag: 'concept',
      heading: 'Distance sets a floor no code can lower',
      eli5: 'No kid can write faster than the mail boat sails. Hurrying her pencil changes nothing, so the only fix is to send fewer letters or find a pen pal who lives nearby.',
      body: [
        'Light in fiber covers about 200,000 km per second. Nine thousand km one way takes 45 ms, so the round trip can never beat about 90 ms.',
        'Real cables bend and routers add hops, which is how you land at 150 ms. Only two fixes remain: make fewer trips, or move the data closer to the code that needs it.',
      ],
      keyIdea: 'Physics sets the minimum. Fewer trips or closer data are the only fixes.',
      metrics: { op: 'Floor for 9,000 km', latency: '90 ms', human: '2.9 years', gap: 'real is 150 ms' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [{ ...cpu, label: 'app', sub: 'California' }, { ...far, status: 'active' }],
        links: [link('cpu', 'far', { style: 'dashed', label: '200,000 km/s in fiber', labelTone: 'warn' })],
        flows: [
          { path: ['cpu', 'far'], tone: 'request', duration: 2.2 },
          { path: ['far', 'cpu'], tone: 'response', duration: 2.2, delay: 2.3 },
        ],
        panel: {
          title: 'Best case, 9,000 km',
          icon: 'Zap',
          rows: [
            { text: 'One way at light speed in fiber', value: '45 ms' },
            { text: 'Round trip floor', value: '90 ms', tone: 'warn' },
            { text: 'Measured round trip', value: '~150 ms', tone: 'bad' },
          ],
          footer: { text: 'No optimization beats the floor', tone: 'bad' },
        },
        caption: 'The boat cannot sail faster',
      },
    },
    {
      title: 'Tier gaps',
      tag: 'tradeoff',
      heading: 'Memory, disk and ocean sit far apart',
      eli5: 'The desk notebook, the hallway bookshelf and the faraway pen pal are three **tiers**. Each one takes hundreds to thousands of times longer than the one before, so where an answer lives matters more than how fast the kid writes.',
      body: [
        'RAM is `100 ns`. An SSD read is `150 µs`, 1,500x further. A datacenter round trip is `500 µs`, close to disk. An ocean round trip is `150 ms`, about 1,000x past disk and 300x past the datacenter.',
        'Caches exist because RAM beats disk. CDNs and multi-region setups exist because the ocean is slow. Batching exists because a round trip costs the same for 1 item or 100.',
      ],
      keyIdea: 'When two options differ by hundreds or thousands of times, the details of your code stop mattering. Pick the right tier first.',
      metrics: { op: 'Tier gaps', latency: '300x to 1,500x', human: 'min → days → years', gap: 'RAM to disk 1,500x, disk to ocean 1,000x' },
      metricTones: { gap: 'bad' },
      scene: {
        nodes: [
          cpu,
          { ...ram, badge: '100 ns' },
          { ...ssd, badge: '150 µs' },
          { ...peer, badge: '500 µs' },
          { ...far, badge: '150 ms' },
        ],
        links: [
          link('cpu', 'ram'),
          link('cpu', 'ssd'),
          link('cpu', 'peer'),
          link('cpu', 'far', { style: 'dashed' }),
        ],
        flows: [
          { path: ['cpu', 'ram', 'cpu'], tone: 'request', duration: 0.6 },
          { path: ['cpu', 'ssd', 'cpu'], tone: 'request', duration: 1.4 },
          { path: ['cpu', 'peer', 'cpu'], tone: 'request', duration: 2 },
          { path: ['cpu', 'far', 'cpu'], tone: 'request', duration: 5 },
        ],
        panel: {
          title: 'Tier by tier',
          icon: 'Layers',
          rows: [
            { text: 'Memory', value: '100 ns', tone: 'good' },
            { text: 'Disk, or next door', value: '150 to 500 µs', tone: 'warn' },
            { text: 'Far network', value: '150 ms', tone: 'bad' },
          ],
        },
        caption: 'Same request, four distances',
      },
      quiz: {
        question: 'Roughly how many RAM reads fit in the time of one round trip to another server in the same datacenter?',
        options: ['About 5', 'About 50', 'About 5,000', 'About 5 million'],
        answer: 2,
        explain: 'A same-datacenter round trip is about 500 µs and a RAM reference is about 100 ns. 500,000 ns divided by 100 ns is 5,000.',
      },
    },
    {
      title: 'Ladder in code',
      tag: 'concept',
      heading: 'Print the ladder on a human scale',
      eli5: 'A tiny script is the kid\'s stopwatch. It takes each real time and says how long it would feel if one nanosecond were one **second**.',
      body: [
        'Keep the ladder in a small table in your head, or in a script. The function below turns nanoseconds into the most readable human unit.',
        'Run it once and the output reads like a calendar: seconds, minutes, days, then years.',
      ],
      keyIdea: 'A ten-line script makes the gaps visible. Keep one around for design reviews.',
      metrics: { op: 'The ladder', latency: '0.5 ns → 150 ms', human: '0.5 s → 4.8 years' },
      scene: {
        nodes: [{ id: 'script', kind: 'block', at: at(0, 0), label: 'ladder.py', sub: 'human scale', icon: 'Code', tint: 'violet', status: 'active' }, { ...cpu, at: at(-5, 0), status: 'dim' }],
        links: [link('cpu', 'script', { route: 'straight', style: 'faint' })],
        panel: {
          title: 'Script output',
          icon: 'List',
          code: 'L1 cache reference     0.5 s\nRAM reference          1.7 min\nSSD random read        1.7 days\nRound trip, same DC    5.8 days\nHDD seek               115.7 days\nRound trip, CA to NL   4.8 years',
        },
        caption: 'Nanoseconds in, calendar units out',
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
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Four numbers that make you dangerous',
      eli5: 'Know where each answer lives: in your head, in the notebook, down the hall, next door, or across the ocean. Count the walks and letters, the **round trips**, and keep the answers you use most close.',
      body: [
        'If you remember nothing else: RAM is `100 ns`, an SSD read is `150 µs`, a same-datacenter round trip is `500 µs`, and a cross-continent round trip is `150 ms`.',
        'Use them in every review. Count the round trips in a request path and notice which tier each one hits. Part 2 fixes the slow checkout page and turns these latencies into server counts.',
      ],
      keyIdea: 'Know the ladder, count the hops, and ask whether the data could live one rung closer.',
      metrics: { op: 'The ladder', latency: '100 ns → 150 ms', human: 'min → years', gap: 'RAM to disk 1,500x, disk to ocean 1,000x' },
      scene: {
        nodes: [{ ...cpu, status: 'ok' }, ram, ssd, peer, far],
        links: [link('cpu', 'ram'), link('cpu', 'ssd'), link('cpu', 'peer'), link('cpu', 'far', { style: 'dashed' })],
        flows: [
          { path: ['cpu', 'ram', 'cpu'], tone: 'response', duration: 0.6 },
          { path: ['cpu', 'ssd', 'cpu'], tone: 'response', duration: 1.4 },
          { path: ['cpu', 'peer', 'cpu'], tone: 'response', duration: 2 },
          { path: ['cpu', 'far', 'cpu'], tone: 'response', duration: 5 },
        ],
        panel: {
          title: 'The four to remember',
          icon: 'Star',
          rows: [
            { text: 'RAM reference', value: '100 ns' },
            { text: 'SSD random read', value: '150 µs' },
            { text: 'Same-DC round trip', value: '500 µs' },
            { text: 'Cross-continent round trip', value: '150 ms' },
          ],
        },
      },
      quiz: {
        question: 'A request makes 10 sequential calls to other services in the same datacenter. How much network time does it spend before any of them does real work?',
        options: ['About 5 µs', 'About 50 µs', 'About 5 ms', 'About 150 ms'],
        answer: 2,
        explain: 'Each same-datacenter round trip costs about 0.5 ms, and ten of them in a row add up to 5 ms.',
      },
    },
  ],
};
