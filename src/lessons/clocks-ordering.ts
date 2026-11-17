import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ann: SceneNode = { id: 'ann', kind: 'phone', at: at(-5.2, -2), label: 'Ann', sub: 'phone' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(-5.2, 2.6), label: 'Ben', sub: 'phone' };
const x: SceneNode = { id: 'x', kind: 'block', at: at(-1.8, -2), label: 'node X', sub: 'replica', icon: 'Server', tint: 'blue' };
const y: SceneNode = { id: 'y', kind: 'block', at: at(1.8, 2.6), label: 'node Y', sub: 'replica', icon: 'Server', tint: 'violet' };
const z: SceneNode = { id: 'z', kind: 'block', at: at(6, 0.6), label: 'node Z', sub: 'replica', icon: 'Server', tint: 'teal' };
const ntp: SceneNode = { id: 'ntp', kind: 'block', at: at(2.4, -5.2), label: 'time server', sub: 'NTP', icon: 'Clock', tint: 'amber' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const sync = (extra: Partial<SceneLink> = {}): SceneLink[] => [
  link('x', 'y', { style: 'dashed', ...extra }),
  link('y', 'z', { style: 'dashed', ...extra }),
];

export const clocksOrdering: Lesson = {
  id: 'clocks-ordering',
  title: 'Clocks, ordering and version vectors (part 1)',
  tagline: 'Why timestamps lie in a distributed system, why last-write-wins loses data, and how Lamport clocks order events by cause and effect.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'How wall clocks drift and skew between machines, and what NTP can and cannot fix',
    'Clock steps, slewing, leap seconds and process pauses, and why durations need a monotonic clock',
    'Why last-write-wins by timestamp silently drops writes, and when it is still fine',
    'Happens-before and concurrent events',
    'Lamport clocks and total order, and what they cannot tell you',
  ],
  metrics: [
    { key: 'skew', label: 'Clock skew', icon: 'Clock' },
    { key: 'lost', label: 'Writes lost', icon: 'Bug' },
    { key: 'siblings', label: 'Versions kept', icon: 'Copy' },
    { key: 'meta', label: 'Metadata per write', icon: 'Hash' },
  ],
  steps: [
    {
      title: 'Two edits',
      tag: 'problem',
      heading: 'Two nodes stamp the same story with different clocks',
      eli5: 'A family keeps copies of one shopping list in different rooms, and each room has its own clock. **Node X** is the kitchen, and its clock runs fast.',
      body: [
        'Ann sets her display name to "Ann". The write lands on node X at real time 12:00:00.000, but X runs half a second fast and stamps it **12:00:00.500**.',
        'Ann fixes a typo 200 ms later: "Anna". Node Y has a correct clock and stamps it **12:00:00.200**.',
      ],
      keyIdea: 'Each replica stamps a write with its own clock, and the clocks do not agree.',
      metrics: { skew: '500 ms', lost: '0 so far', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'bad' },
      scene: {
        nodes: [ann, { ...x, status: 'hot', chips: ['name = Ann'], badge: 'stamp .500' }, { ...y, chips: ['name = Anna'], badge: 'stamp .200' }],
        links: [link('ann', 'x', { label: 'real 12:00:00.000' }), link('ann', 'y', { label: '+200 ms' })],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'name = Ann', duration: 1.1 },
          { path: ['ann', 'y'], tone: 'request', label: 'name = Anna', duration: 1.1, delay: 1.2 },
        ],
        panel: {
          title: 'The stamps',
          icon: 'Clock',
          rows: [
            { text: '"Ann" on X, real .000', value: 'stamp .500', tone: 'warn' },
            { text: '"Anna" on Y, real .200', value: 'stamp .200' },
          ],
          footer: { text: 'The newer edit carries the smaller stamp', tone: 'warn' },
        },
        caption: 'Two writes, two clocks',
      },
    },
    {
      title: 'Lost edit',
      tag: 'problem',
      heading: 'The later edit lost to the earlier one',
      eli5: 'When the rooms compare lists, they keep the note with the later clock time. The kitchen clock is fast, so its old note looks newer and the hall\'s fix is thrown away.',
      body: [
        'The nodes sync and keep the higher stamp, so "Ann" wins everywhere. The correction is gone and nothing logs an error.',
        'No code had a bug. The store trusted two clocks to agree.',
      ],
      keyIdea: 'Comparing timestamps from different machines compares their clocks as much as their events.',
      metrics: { skew: '500 ms', lost: '1 (silent)', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'bad', lost: 'bad' },
      scene: {
        nodes: [{ ...x, status: 'hot', chips: [{ text: 'name = Ann', tone: 'warn' }], badge: 'stamp .500' }, { ...y, chips: [{ text: 'name = Ann', tone: 'bad' }], badge: 'Anna overwritten' }],
        links: [link('x', 'y', { style: 'dashed', label: 'sync', labelTone: 'warn' })],
        flows: [{ path: ['x', 'y'], tone: 'data', label: 'Ann wins: .500 > .200', duration: 1.4 }],
        panel: {
          title: 'Who wins?',
          icon: 'Clock',
          rows: [
            { text: '"Ann" on X, real .000', value: 'stamp .500', tone: 'warn' },
            { text: '"Anna" on Y, real .200', value: 'stamp .200' },
            { text: 'Kept after sync', value: '"Ann"', tone: 'bad' },
          ],
          footer: { text: 'The newer edit carries the older timestamp', tone: 'bad' },
        },
        caption: 'The later edit lost, and nothing logged an error',
      },
    },
    {
      title: 'Clock drift',
      tag: 'concept',
      heading: 'Every machine keeps its own, slightly wrong, time',
      eli5: 'Every room clock ticks a bit too fast or too slow, so over time the clocks wander apart. The **drift** is how far each room has wandered from the true time.',
      body: [
        'A server clock is a quartz crystal, and no two run at exactly the same rate. Heat and age change the rate further. Left alone, a clock **drifts** from true time, often by seconds over days.',
        'The difference between two machines\' clocks at one moment is their **skew**.',
      ],
      keyIdea: 'Wall clocks drift and never agree exactly. Skew is a fact of life, not a bug.',
      metrics: { skew: '~1 to 500 ms', lost: '-', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'warn' },
      scene: {
        nodes: [{ ...x, status: 'hot', badge: '+500 ms' }, { ...y, badge: '+2 ms' }, { ...z, badge: '-40 ms' }],
        links: [link('x', 'y', { style: 'faint', label: 'skew 498 ms', labelTone: 'warn' }), link('y', 'z', { style: 'faint', label: 'skew 42 ms' })],
        panel: {
          title: 'Same instant, three clocks',
          icon: 'Clock',
          rows: [
            { text: 'True time', value: '12:00:00.000' },
            { text: 'Node X', value: '12:00:00.500', tone: 'bad' },
            { text: 'Node Y', value: '12:00:00.002' },
            { text: 'Node Z', value: '11:59:59.960', tone: 'warn' },
          ],
        },
        caption: 'Three nodes, three different times',
      },
    },
    {
      title: 'NTP limits',
      tag: 'concept',
      heading: 'NTP corrects clocks, within the limits of the network',
      eli5: 'Once in a while someone checks the radio and sets the room clocks. But the radio message takes time to arrive, so the fix is only as good as that trip. The **time server** is the radio.',
      body: [
        'NTP asks time servers for the time, and it can only be as accurate as the network delay it measures. Inside one datacenter that is often a millisecond or better.',
        'Across the internet it can be tens or hundreds of milliseconds. If the NTP daemon is misconfigured or blocked, a machine can be off by far more.',
      ],
      keyIdea: 'NTP shrinks skew. It never removes it, and its error depends on the path to the time server.',
      metrics: { skew: '1 ms to 100+ ms', lost: '-', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'warn' },
      scene: {
        nodes: [ntp, { ...y, status: 'ok' }, { ...z, status: 'hot' }],
        links: [link('ntp', 'y', { label: 'same datacenter · ~1 ms', style: 'dashed' }), link('ntp', 'z', { label: 'across the internet · 50 to 100 ms', labelTone: 'warn', style: 'dashed' })],
        flows: [
          { path: ['ntp', 'y'], tone: 'handshake', label: 'what time is it?', duration: 1.2 },
          { path: ['ntp', 'z'], tone: 'handshake', label: 'what time is it?', duration: 2.4, delay: 1.3 },
        ],
        panel: {
          title: 'Typical error after a sync',
          icon: 'Signal',
          rows: [
            { text: 'Same datacenter', value: '~1 ms', tone: 'good' },
            { text: 'Across the internet', value: '10s of ms', tone: 'warn' },
            { text: 'NTP blocked or broken', value: 'unbounded', tone: 'bad' },
          ],
        },
        caption: 'The fix is only as accurate as the trip',
      },
    },
    {
      title: 'Slew or step',
      tag: 'concept',
      heading: 'NTP nudges small errors and jumps over big ones',
      eli5: 'If the kitchen clock is a little fast, the radio tells you to let it tick slightly slower until it catches up. If it is far off, someone just grabs it and moves the hands.',
      body: [
        'For a small error, NTP **slews**: it runs the clock a little slow or fast until it catches up, so time never jumps. The `ntpd` daemon steps instead once the error passes a threshold (128 ms by default).',
        'A **step** sets the clock straight to the right time in one move.',
      ],
      keyIdea: 'Slewing keeps time smooth. Stepping fixes big errors fast and can move the clock backwards.',
      metrics: { skew: 'slewed or stepped', lost: '-', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'warn' },
      scene: {
        nodes: [ntp, { ...y, status: 'ok', badge: '30 ms fast' }, { ...x, status: 'hot', badge: '2 s fast' }],
        links: [link('ntp', 'y', { label: 'slew: tick slower', style: 'dashed' }), link('ntp', 'x', { label: 'step: jump now', labelTone: 'warn', style: 'dashed' })],
        panel: {
          title: 'How NTP corrects',
          icon: 'Timer',
          rows: [
            { text: 'Error under 128 ms', value: 'slew', tone: 'good' },
            { text: 'Error over 128 ms', value: 'step', tone: 'warn' },
            { text: 'Time moves backwards', value: 'only on a step', tone: 'bad' },
          ],
        },
        caption: 'Small errors slew, big errors step',
      },
    },
    {
      title: 'Clock steps',
      tag: 'concept',
      heading: 'A step can jump the clock backwards',
      eli5: 'When someone turns the kitchen clock hands back, anything timed with it sees time go backwards. A timer that started before the turn now ends before it began.',
      body: [
        'When NTP steps the clock back, a timeout measured as `end - start` from wall-clock readings can come out negative.',
        'Never order events from different machines by wall clock alone, and never time a duration with one.',
      ],
      keyIdea: 'Wall clocks can run backwards, so a duration taken from two wall-clock readings can be wrong.',
      metrics: { skew: 'steps back 2 s', lost: '-', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'bad' },
      scene: {
        nodes: [{ ...x, status: 'hot', badge: 'clock stepped back' }, ntp, { ...y, status: 'dim' }],
        links: [link('ntp', 'x', { label: 'you are 2 s fast', labelTone: 'warn', style: 'dashed' })],
        flows: [{ path: ['ntp', 'x'], tone: 'handshake', label: 'step back 2 s', duration: 1.6 }],
        panel: {
          title: 'One request, two clocks',
          icon: 'Timer',
          rows: [
            { text: 'Wall clock at start', value: '12:00:05.0' },
            { text: 'Wall clock at end', value: '12:00:03.9', tone: 'bad' },
            { text: 'Elapsed by wall clock', value: '-1.1 s', tone: 'bad' },
            { text: 'Elapsed by monotonic clock', value: '+0.9 s', tone: 'good' },
          ],
        },
        caption: 'Wall clocks can run backwards',
      },
    },
    {
      title: 'Monotonic clock',
      tag: 'concept',
      heading: 'Use a monotonic clock for durations',
      eli5: 'A **monotonic clock** is a stopwatch that only counts up. It cannot tell you the time of day, but it never goes backwards, so it is the right tool for timing a chore.',
      body: [
        'A **monotonic clock** counts from an arbitrary start, usually boot, and never goes back. Use it for timeouts and elapsed time.',
        'Its value means nothing on another machine, so it cannot order events across nodes. Wall clocks are for humans and logs.',
      ],
      keyIdea: 'Use a monotonic clock for durations and timeouts. Use wall clocks only for human-facing times.',
      metrics: { skew: 'irrelevant for durations', lost: '-', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'good' },
      scene: {
        nodes: [{ ...x, status: 'ok', badge: 'elapsed +0.9 s' }, { ...y, status: 'dim' }, { ...ntp, status: 'dim' }],
        links: [link('ntp', 'x', { style: 'faint', label: 'step ignored', labelTone: 'good' })],
        panel: {
          title: 'Which clock for what',
          icon: 'Timer',
          rows: [
            { text: 'Timeouts, retries, latency', value: 'monotonic', tone: 'good' },
            { text: 'Log lines, shown dates', value: 'wall clock' },
            { text: 'Order across machines', value: 'neither', tone: 'warn' },
          ],
        },
        caption: 'Stopwatch for durations, calendar for people',
      },
      code: {
        language: 'python',
        title: 'Two clocks in one machine',
        source: `import time

start = time.monotonic()        # never steps back
do_work()
elapsed = time.monotonic() - start

stamp = time.time()             # wall clock: logs and display only`,
        highlight: [3, 5, 7],
      },
      quiz: {
        question: 'A service times each request with `time.time()` at start and end, and alerts on slow ones. NTP steps the clock back 2 s mid-request. What can happen?',
        options: [
          'The request looks 2 s faster, or even negative, so slow requests hide',
          'Nothing, wall clocks never move backwards',
          'The alert fires twice as often',
          'The request itself is retried',
        ],
        answer: 0,
        explain: 'A wall clock can step back, so end minus start can shrink or go negative. A monotonic clock never steps back, which is why durations should use it.',
      },
    },
    {
      title: 'Leap seconds',
      tag: 'concept',
      heading: 'A leap second adds a 61st second to a minute',
      eli5: 'Now and then the radio announces one extra second in a day, and the room clocks argue about how to fit it in. Some repeat a second. Some stretch every second a little.',
      body: [
        'A **leap second** adds a 61st second (`23:59:60`) to a day. Some systems repeat a second, and some **smear** it over hours.',
        'Either way, timestamps near the event can repeat or bend, and two machines using different policies disagree for hours.',
      ],
      keyIdea: 'Time does not always move forward by 1 s per second, even when every clock is healthy.',
      metrics: { skew: 'repeats or bends', lost: '-', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'warn' },
      scene: {
        nodes: [{ ...x, badge: 'repeats 23:59:59', status: 'hot' }, { ...y, badge: 'smears over hours' }, { ...z, status: 'dim' }],
        links: [link('x', 'y', { style: 'faint', label: 'same event, different policy', labelTone: 'warn' })],
        panel: {
          title: 'Leap second policies',
          icon: 'Calendar',
          rows: [
            { text: 'Repeat a second', value: 'duplicate stamps', tone: 'bad' },
            { text: 'Smear over hours', value: 'every second slightly long', tone: 'warn' },
            { text: 'Mixed fleet', value: 'skew for hours', tone: 'bad' },
          ],
        },
        caption: 'The day has 86,401 seconds',
      },
    },
    {
      title: 'Process pauses',
      tag: 'concept',
      heading: 'A paused process wakes up believing it is still earlier',
      eli5: 'Someone falls asleep halfway through a chore and wakes up thinking it is still the old time. They then do something that was only allowed a while ago.',
      body: [
        'A VM migration, a long GC pause or a suspended laptop freezes a process. It wakes up believing it is still 12:00:00 while the world has moved on.',
        'A check such as "my lease is still valid" can be stale by the time the next line runs.',
      ],
      keyIdea: 'A process cannot assume its last clock reading is still current.',
      metrics: { skew: 'jumps of seconds', lost: '-', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'bad' },
      scene: {
        nodes: [{ ...x, status: 'hot', badge: 'paused 8 s', chips: [{ text: 'GC pause', tone: 'warn' }] }, { ...y, badge: 'writes continue' }],
        links: [link('x', 'y', { style: 'dashed', label: 'writes while X sleeps', labelTone: 'warn' })],
        panel: {
          title: 'Ways a process loses time',
          icon: 'Timer',
          rows: [
            { text: 'VM live migration', value: 'seconds lost', tone: 'warn' },
            { text: 'GC or stop-the-world pause', value: 'stale clock', tone: 'bad' },
            { text: 'Suspended laptop', value: 'hours lost', tone: 'warn' },
          ],
          footer: { text: 'Never trust "now" a few seconds later. Fencing tokens fix this (see Avoid conflicts)', tone: 'warn' },
        },
        caption: 'Time can freeze for one process only',
      },
    },
    {
      title: 'Last write wins',
      tag: 'concept',
      heading: 'Last-write-wins keeps the highest timestamp',
      eli5: 'If two notes clash, the family keeps only the one with the later clock time and bins the other. It is quick and everyone ends up with the same list.',
      body: [
        '**Last-write-wins** (LWW) resolves any conflict by keeping the value with the highest timestamp. It is simple and needs no extra metadata.',
        'The replicas always converge to the same answer, so many stores use it by default.',
      ],
      keyIdea: 'LWW guarantees replicas agree. It does not guarantee they agree on the right value.',
      metrics: { skew: '500 ms', lost: '?', siblings: '1', meta: '1 timestamp' },
      metricTones: { meta: 'good' },
      scene: {
        nodes: [{ ...x, chips: ['v = A @ .500'] }, { ...y, chips: ['v = B @ .200'] }, { ...z, status: 'ok', badge: 'keeps A' }],
        links: sync({ label: 'higher stamp wins' }),
        flows: [
          { path: ['x', 'y'], tone: 'data', label: 'A @ .500', duration: 1.3 },
          { path: ['y', 'z'], tone: 'data', label: 'A @ .500', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'LWW at a glance',
          icon: 'Table',
          rows: [
            { text: 'Metadata per write', value: '1 timestamp', tone: 'good' },
            { text: 'Replicas converge', value: 'yes', tone: 'good' },
            { text: 'Correct value kept', value: 'not guaranteed', tone: 'warn' },
          ],
        },
        caption: 'Highest timestamp takes the key',
      },
    },
    {
      title: 'LWW in use',
      tag: 'case',
      heading: 'Where last-write-wins is fine, and where it is used',
      eli5: 'Keeping only the newest note is fine for a list nobody argues over, like which room the cat is in. It is a bad rule for a list where every note matters.',
      body: [
        'It suits keys written once and never changed, caches that can be rebuilt, and data where losing a racing update does not matter. Cassandra keeps a timestamp per cell and keeps the highest.',
        'It is a poor fit for carts, counters and edits that all matter.',
      ],
      keyIdea: 'LWW is a fine policy when losing a racing write is acceptable, and a bug when it is not.',
      metrics: { skew: 'any', lost: 'by policy', siblings: '1', meta: '1 timestamp' },
      metricTones: { meta: 'good' },
      scene: {
        nodes: [{ ...x, status: 'ok', chips: ['cat: kitchen'] }, { ...y, status: 'ok', chips: ['cache: user:7'] }, { ...z, status: 'hot', chips: [{ text: 'cart: shoes', tone: 'warn' }] }],
        links: sync({ style: 'faint' }),
        panel: {
          title: 'Is LWW safe here?',
          icon: 'Scale',
          rows: [
            { text: 'Rebuildable cache', value: 'yes', tone: 'good' },
            { text: 'Write-once key', value: 'yes', tone: 'good' },
            { text: 'Latest location ping', value: 'yes', tone: 'good' },
            { text: 'Shopping cart', value: 'no', tone: 'bad' },
            { text: 'Counter', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'Safe when a lost write is acceptable',
      },
    },
    {
      title: 'LWW and skew',
      tag: 'tradeoff',
      heading: 'With skew, last-write-wins drops the wrong write',
      eli5: 'The kitchen clock runs fast, so any note written there looks newer than it is. A later note from the hall keeps losing, however carefully it was written.',
      body: [
        'With skew, a write that came later can carry a smaller timestamp, as Ann found. The store keeps the earlier write and drops the later one.',
        'Better NTP shrinks the window. It never closes it.',
      ],
      keyIdea: 'Skew turns last-write-wins into a policy that sometimes keeps the older write.',
      metrics: { skew: '500 ms', lost: '1 per race', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'bad', lost: 'bad' },
      scene: {
        nodes: [{ ...x, status: 'hot', badge: 'fast by 500 ms' }, { ...y, badge: 'correct clock' }, { ...z, status: 'hot', badge: 'keeps the old write' }],
        links: sync({ label: 'higher stamp wins', labelTone: 'warn' }),
        panel: {
          title: 'The skew window',
          icon: 'Bug',
          rows: [
            { text: 'Gap between the writes', value: '200 ms' },
            { text: 'Skew between the nodes', value: '500 ms', tone: 'bad' },
            { text: 'Skew larger than gap', value: 'older write wins', tone: 'bad' },
          ],
        },
        caption: 'Skew bigger than the gap flips the order',
      },
    },
    {
      title: 'LWW and races',
      tag: 'tradeoff',
      heading: 'Even with perfect clocks, last-write-wins drops one of two',
      eli5: 'If two people write on the list at nearly the same moment, the family keeps one note and bins the other. Sometimes the binned note was the important one.',
      body: [
        'When two writes are truly **concurrent**, say Ann adds shoes to a shared cart while Ben adds socks, LWW keeps one cart and drops the other edit, even though both were valid.',
        'The store needs to know which writes came after which, without asking a clock.',
      ],
      keyIdea: 'For data where every edit counts, the store must know what each writer had seen.',
      metrics: { skew: '0 ms', lost: '1 of 2 concurrent', siblings: '1', meta: '1 timestamp' },
      metricTones: { lost: 'bad' },
      scene: {
        nodes: [ann, ben, { ...x, chips: ['cart: shoes'] }, { ...y, chips: ['cart: socks'] }, { ...z, status: 'hot', badge: 'keeps one cart' }],
        links: [link('ann', 'x'), link('ben', 'y'), ...sync()],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'add shoes', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', label: 'add socks', duration: 1 },
          { path: ['x', 'y', 'z'], tone: 'data', duration: 1.6, delay: 1.2 },
          { path: ['y', 'z'], tone: 'error', label: 'socks dropped', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Two good edits in, one out',
          icon: 'Bug',
          rows: [
            { text: 'Ann adds shoes', value: 'on X' },
            { text: 'Ben adds socks', value: 'on Y' },
            { text: 'Final cart', value: '[shoes]', tone: 'bad' },
          ],
        },
        caption: 'Two good edits in, one out',
      },
    },
    {
      title: 'Happens-before',
      tag: 'concept',
      heading: 'The order that matters is cause and effect',
      eli5: 'If Ben reads Ann\'s note and then writes his own, his note came after hers, whatever the clocks say.',
      body: [
        'We rarely need true time. We need to know whether one event could have influenced another. Event a **happens before** b if they ran on the same node and a came first, or a sent a message that b received, or a chain of such steps links them.',
      ],
      keyIdea: 'Order writes by what each writer had seen, not by when the clock says they happened.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '-' },
      scene: {
        nodes: [ann, { ...x, status: 'active', chips: ['a: write v1'] }, { ...y, status: 'active', chips: ['b: read v1, write v2'] }, ben],
        links: [link('ann', 'x'), link('x', 'y', { style: 'dashed', label: 'v1 replicated' }), link('ben', 'y')],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'write v1', duration: 1 },
          { path: ['x', 'y'], tone: 'data', label: 'v1 replicated', duration: 1.2, delay: 1.1 },
          { path: ['ben', 'y'], tone: 'request', label: 'edit after seeing v1', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'a happens before b when',
          icon: 'Route',
          rows: [
            { text: 'Same node, a ran first', value: 'a → b' },
            { text: 'a sent, b received', value: 'a → b' },
            { text: 'A chain of the above', value: 'a → b' },
          ],
          footer: { text: 'Here b saw v1, so a → b', tone: 'good' },
        },
        caption: 'a happens before b because b saw a',
      },
    },
    {
      title: 'Concurrent',
      tag: 'concept',
      heading: 'Concurrent means neither one knew about the other',
      eli5: 'If neither person had seen the other\'s note, there is no "before". They just both wrote. The family should keep both, not bin one.',
      body: [
        'If neither event happens before the other, they are **concurrent**. That does not mean "at the same instant". Ann\'s shoes and Ben\'s socks are concurrent even if a whole second apart.',
        'If one write happens before another, the later may replace it. If they are concurrent, neither should silently win.',
      ],
      keyIdea: 'Concurrent means unrelated by cause, not simultaneous in time.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '2 (to detect)', meta: '-' },
      scene: {
        nodes: [ann, { ...x, status: 'active', chips: ['shoes'] }, { ...y, status: 'active', chips: ['socks'] }, ben],
        links: [link('ann', 'x'), link('ben', 'y'), link('x', 'y', { style: 'faint', label: 'not yet synced', labelTone: 'warn' })],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'add shoes', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', label: 'add socks', duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'The rule for conflicts',
          icon: 'Split',
          rows: [
            { text: 'One write came after the other', value: 'replace', tone: 'good' },
            { text: 'Writes were concurrent', value: 'keep both', tone: 'warn' },
          ],
          footer: { text: 'Clocks cannot tell these apart. Causality can.', tone: 'muted' },
        },
        caption: 'Neither writer saw the other',
      },
    },
    {
      title: 'Lamport rules',
      tag: 'concept',
      heading: 'Lamport clocks: a counter that respects causality',
      eli5: 'Every note gets a number one higher than any number its writer has seen. Read a note marked 7, and your next note is at least 8. So a reply always has a bigger number than what it replied to.',
      body: [
        'A **Lamport clock** is one integer per node. Each local event adds 1. Every message carries the sender\'s value, and the receiver sets its clock to `max(own, received) + 1`.',
        'If a happens before b, then `L(a) < L(b)`, whatever the wall clocks say.',
      ],
      keyIdea: 'A Lamport clock only counts events and merges what it hears, so it never needs the wall clock.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '1 integer' },
      metricTones: { meta: 'good' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: 'L = 3' }, { ...y, status: 'active', badge: 'L = 7' }, { ...z, badge: 'L = 6' }],
        links: sync(),
        panel: {
          title: 'Two rules',
          icon: 'Hash',
          rows: [
            { text: 'Local event', value: 'L = L + 1' },
            { text: 'Send a message', value: 'attach L' },
            { text: 'Receive a message', value: 'L = max(L, got) + 1' },
          ],
          footer: { text: 'No wall clock anywhere', tone: 'good' },
        },
        caption: 'One integer per node',
      },
    },
    {
      title: 'Lamport example',
      tag: 'case',
      heading: 'Receivers jump past every number they have seen',
      eli5: 'The hall holds a note numbered 7 and hears about a kitchen note numbered 3. It keeps going from 7, so its next note is 8. The bedroom, at 6, hears 8 and jumps to 9.',
      body: [
        'Y holds 7 and hears 3, so it moves to `max(7, 3) + 1 = 8`. Z holds 6, hears 8 and moves to 9.',
        'Each receiver ends up ahead of everything it has seen.',
      ],
      keyIdea: 'A receiver always lands past the sender\'s number, so effects get bigger numbers than causes.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '1 integer' },
      metricTones: { meta: 'good' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: 'L = 3' }, { ...y, status: 'active', badge: 'L = 7 → 8' }, { ...z, badge: 'L = 6 → 9' }],
        links: sync(),
        flows: [
          { path: ['x', 'y'], tone: 'event', label: 'msg, L = 3', duration: 1.2 },
          { path: ['y', 'z'], tone: 'event', label: 'msg, L = 8', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'On receive',
          icon: 'Hash',
          rows: [
            { text: 'Y holds 7, hears 3', value: 'max(7, 3) + 1 = 8' },
            { text: 'Z holds 6, hears 8', value: 'max(6, 8) + 1 = 9' },
          ],
          footer: { text: 'Receivers jump past every number they have seen', tone: 'muted' },
        },
        caption: 'Receivers jump past every number they have seen',
      },
      code: {
        language: 'python',
        title: 'A Lamport clock',
        source: `class LamportClock:
    def __init__(self, node_id):
        self.node_id, self.t = node_id, 0

    def local_event(self):              # e.g. apply a write
        self.t += 1
        return (self.t, self.node_id)

    def send(self):                     # stamp an outgoing message
        return self.local_event()

    def receive(self, remote_t):        # merge, then count this event
        self.t = max(self.t, remote_t) + 1
        return (self.t, self.node_id)

# Sorting by (t, node_id) gives one total order on every node.`,
        highlight: [6, 13, 16],
      },
    },
    {
      title: 'Total order',
      tag: 'concept',
      heading: 'Break ties by node id for one order everyone agrees on',
      eli5: 'If two notes get the same number, the family settles it by room name, kitchen before hall. Everyone sorts the notes the same way, so everyone reads the list in the same order.',
      body: [
        'Break ties by node id and you get a **total order**: sort by `(t, node_id)`. Every node computes the same order, and it never contradicts causality.',
        'That is enough for ordering requests for a lock or replaying a log in a consistent order.',
      ],
      keyIdea: 'Lamport timestamps plus a tie-break give every node the same sequence of events.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '(int, node id)' },
      scene: {
        nodes: [{ ...x, chips: ['(5, X)'] }, { ...y, chips: ['(5, Y)'] }, { ...z, status: 'ok', badge: 'same order on every node' }],
        links: sync({ label: 'merge logs' }),
        flows: [
          { path: ['x', 'z'], tone: 'event', label: '(5, X)', duration: 1.6 },
          { path: ['y', 'z'], tone: 'event', label: '(5, Y)', duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Sorted by (t, node id)',
          icon: 'List',
          rows: [
            { text: '1st', value: '(4, Z)' },
            { text: '2nd', value: '(5, X)' },
            { text: '3rd', value: '(5, Y)' },
            { text: '4th', value: '(9, Z)' },
          ],
          footer: { text: 'Ties go to the lower node id', tone: 'muted' },
        },
        caption: 'Same counter, so the node id decides',
      },
    },
    {
      title: 'Lamport limits',
      tag: 'tradeoff',
      heading: 'Lamport order works one way only',
      eli5: 'A bigger number on a note does not mean it was written after. The hall just wrote more notes, so its numbers grew faster. Numbers can order notes, but they cannot say if two writers ever saw each other\'s.',
      body: [
        'The rule only works in one direction. `L(a) < L(b)` does not tell you that a happened before b. They may be concurrent, and the smaller number is an accident of which node was busier.',
        'Lamport clocks order events. They cannot detect a conflict.',
      ],
      keyIdea: 'Lamport clocks give an order consistent with cause and effect, but cannot tell you when two events were concurrent.',
      metrics: { skew: 'irrelevant', lost: 'still 1 of 2', siblings: '1', meta: '1 integer' },
      metricTones: { lost: 'bad' },
      scene: {
        nodes: [{ ...x, chips: ['shoes, L = 2'] }, { ...y, status: 'hot', chips: ['socks, L = 9'] }, { ...z, badge: 'keeps socks' }],
        links: sync(),
        flows: [
          { path: ['x', 'z'], tone: 'event', label: 'L = 2', duration: 1.6 },
          { path: ['y', 'z'], tone: 'event', label: 'L = 9', duration: 1.6, delay: 0.6 },
        ],
        panel: {
          title: 'What the numbers say',
          icon: 'Hash',
          rows: [
            { text: 'L = 2 vs L = 9', value: 'order: shoes first' },
            { text: 'Did socks see shoes?', value: 'unknown', tone: 'bad' },
            { text: 'Concurrent?', value: 'cannot tell', tone: 'bad' },
          ],
        },
        caption: 'A smaller number is not proof of "before"',
      },
      quiz: {
        question: 'Two writes carry Lamport timestamps L(a) = 4 and L(b) = 9. What can you conclude?',
        options: [
          'a happened before b',
          'b happened before a',
          'Either a happened before b, or they were concurrent. b did not happen before a',
          'Nothing at all',
        ],
        answer: 2,
        explain: 'If b had happened before a, then L(b) would be smaller than L(a). So b did not come first. But a smaller number can still come from a concurrent event on a quieter node.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Clocks give roughly when. Causality gives what came after what',
      eli5: 'Room clocks wander, so do not trust them to decide which note is newer. Number your notes so replies always get bigger numbers. That orders the list, but it cannot say if two people clashed.',
      body: [
        'Wall clocks **drift** and **skew**, NTP only shrinks the error, and steps, leap seconds and pauses bend time further. **Last-write-wins** can drop a later write and always drops one of two concurrent writes.',
        'What matters is **happens-before**. **Lamport clocks** order consistently with it, but they cannot spot concurrency. Part 2 adds vector clocks, version vectors, CRDTs, hybrid clocks and TrueTime.',
      ],
      keyIdea: 'Physical time can tell you roughly when. Logical time tells you what came after what.',
      metrics: { skew: 'irrelevant', lost: 'still 1 of 2', siblings: '1', meta: '1 integer' },
      metricTones: { lost: 'bad' },
      scene: {
        nodes: [{ ...x, status: 'ok' }, { ...y, status: 'ok' }, { ...z, status: 'ok' }, ntp],
        links: [...sync(), link('ntp', 'z', { style: 'faint' })],
        panel: {
          title: 'Part 1 in one table',
          icon: 'Scale',
          rows: [
            { text: 'Wall clock', value: 'rough, can step back', tone: 'warn' },
            { text: 'Monotonic clock', value: 'durations only', tone: 'good' },
            { text: 'LWW', value: 'loses concurrent writes', tone: 'bad' },
            { text: 'Lamport clock', value: 'orders, cannot detect', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'Node A\'s clock is 300 ms ahead of node B. Ann writes on A, then Ben writes on B 100 ms later. A store uses last-write-wins by wall-clock timestamp. What does it keep?',
        options: [
          'Ben\'s write, because it was later in real time',
          'Ann\'s write, because A\'s clock stamped it higher',
          'Both writes',
          'Neither, it reports a conflict',
        ],
        answer: 1,
        explain: 'A stamps Ann\'s write 300 ms ahead, so it carries a higher stamp than Ben\'s write, which happened 100 ms later. LWW keeps the highest stamp and drops Ben\'s write without any error.',
      },
    },
  ],
};
