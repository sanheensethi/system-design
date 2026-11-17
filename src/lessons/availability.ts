import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];
const L = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'client', at: p(-7.5, 0), label: 'customers' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: p(-4.5, 0), label: 'load balancer', sub: '99.99%' };
const app1: SceneNode = { id: 'app1', kind: 'server', at: p(-1.5, -4.2), label: 'app 1', sub: '99.9%' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: p(-1.5, 4.7), label: 'app 2', sub: '99.9%' };
const db1: SceneNode = { id: 'db1', kind: 'db', at: p(2, -4.2), label: 'primary DB', sub: '99.9%' };
const db2: SceneNode = { id: 'db2', kind: 'replica', at: p(2, 4.7), label: 'standby DB', sub: '99.9%' };
const mon: SceneNode = { id: 'mon', kind: 'block', at: p(5.5, 0), label: 'SLO monitor', icon: 'Activity', tint: 'violet' };

const n2: SceneNode = { id: 'n2', kind: 'block', at: p(-6, 0), label: '99%', sub: 'two nines', icon: 'Gauge', tint: 'red' };
const n3: SceneNode = { id: 'n3', kind: 'block', at: p(-2.5, 0), label: '99.9%', sub: 'three nines', icon: 'Gauge', tint: 'amber' };
const n4: SceneNode = { id: 'n4', kind: 'block', at: p(1, 0), label: '99.99%', sub: 'four nines', icon: 'Gauge', tint: 'teal' };
const n5: SceneNode = { id: 'n5', kind: 'block', at: p(4.5, 0), label: '99.999%', sub: 'five nines', icon: 'Gauge', tint: 'green' };

const chain: SceneLink[] = [L('users', 'lb'), L('lb', 'app1'), L('app1', 'db1')];
const redundant: SceneLink[] = [...chain, L('lb', 'app2'), L('app2', 'db1'), L('db1', 'db2', { style: 'dashed', label: 'replicate' })];
const nines: SceneLink[] = [L('n2', 'n3', { label: '÷ 10' }), L('n3', 'n4', { label: '÷ 10' }), L('n4', 'n5', { label: '÷ 10' })];

export const availability: Lesson = {
  id: 'availability',
  title: 'Availability in numbers: nines, SLA, SLO (part 1)',
  tagline: 'Turn "it should stay up" into a number, a budget and the redundancy math that gets you there.',
  minutes: 15,
  level: 'Beginner',
  learn: [
    'What each extra nine means in downtime per year, and what it costs',
    'The difference between an SLI, an SLO and an SLA',
    'How an error budget and burn-rate alerts turn reliability into a decision tool',
    'What a single point of failure is, and how to find one',
    'Why components in series multiply their failures and components in parallel hide them',
    'How active-passive and active-active redundancy differ',
  ],
  metrics: [
    { key: 'avail', label: 'Availability', icon: 'Activity' },
    { key: 'down', label: 'Downtime / year', icon: 'Timer' },
    { key: 'budget', label: 'Budget / 30 days', icon: 'Gauge' },
    { key: 'copies', label: 'Copies per tier', icon: 'Copy' },
  ],
  steps: [
    {
      title: 'How reliable?',
      tag: 'problem',
      heading: '"It is almost always up" is not a number',
      eli5: 'A toy shop says "we are almost always open". Last year it was shut for 18 hours when kids came to buy. Is that good? Nobody can say, because nobody wrote down a promise. The **app** is that shop.',
      body: [
        'A big customer asks: "What uptime do you guarantee?" The team answers "it is very reliable". Last year checkout was down for a total of **18 hours** across four incidents.',
        'Is that good? For a hobby project, yes. For a payment system, each hour lost real orders, and nobody can say whether to build features or fix reliability.',
      ],
      keyIdea: 'Without a number and a target, "reliable" means nothing.',
      metrics: { avail: '?', down: '18.4 h', budget: '-', copies: '1' },
      metricTones: { down: 'bad' },
      scene: {
        nodes: [users, lb, { ...app1, status: 'down', badge: 'crashed' }, { ...db1, status: 'dim' }],
        links: chain,
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['app1', 'lb', 'users'], tone: 'error', label: '503', count: 4, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Last year',
          icon: 'Timer',
          rows: [
            { text: 'Incident 1', value: '6.0 h', tone: 'warn' },
            { text: 'Incident 2', value: '5.2 h', tone: 'warn' },
            { text: 'Incident 3', value: '4.0 h', tone: 'warn' },
            { text: 'Incident 4', value: '3.2 h', tone: 'warn' },
          ],
          footer: { text: '18.4 hours of failed checkouts', tone: 'bad' },
        },
        caption: 'Four incidents, 18 hours of failed checkouts',
      },
    },
    {
      title: 'Availability',
      tag: 'concept',
      heading: 'Availability is a fraction: good over total',
      eli5: 'Count the hours the toy shop was open when kids came, divide by all the hours it promised to be open. That fraction is how often the **app** worked.',
      body: [
        '**Availability** is the share of time, or of requests, in which the system works: `good / total`.',
        '18.4 hours out of 8,760 in a year is 0.21% down, so **99.79%** available. Now there is a number to argue about. Availability is also not the same as reliability: a system can be up and still return wrong answers.',
      ],
      keyIdea: 'Availability is a measured fraction. Measure it before you set a target.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '-', copies: '1' },
      metricTones: { avail: 'warn' },
      scene: {
        nodes: [users, { ...lb, status: 'active' }, { ...app1, status: 'active' }, { ...mon, label: 'counter', sub: 'good / total', badge: '99.79%' }],
        links: [...chain.slice(0, 2), L('lb', 'mon', { style: 'dashed', label: 'good / total' })],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['lb', 'mon'], tone: 'data', label: 'count', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'The arithmetic',
          icon: 'Table',
          rows: [
            { text: 'Hours in a year', value: '8,760' },
            { text: 'Hours down', value: '18.4', tone: 'bad' },
            { text: 'Share down', value: '0.21%', tone: 'warn' },
            { text: 'Availability', value: '99.79%', tone: 'good' },
          ],
        },
        caption: '(8,760 - 18.4) / 8,760 = 99.79%',
      },
    },
    {
      title: 'The nines',
      tag: 'concept',
      heading: 'Each extra nine cuts downtime by ten',
      eli5: 'Count the minutes in a year the toy shop may be shut. Two nines means shut for almost four days. Five nines means shut for five minutes. Each **nine** is a much stricter promise.',
      body: [
        'Targets are quoted in **nines**. A year has 525,600 minutes. Multiply by the allowed failure share to get the downtime.',
        '**99%** allows 3.65 days a year. **99.9%** allows 8.76 hours. **99.99%** allows 52.6 minutes. **99.999%** allows 5.26 minutes, less than it takes a person to wake up and open a laptop.',
      ],
      keyIdea: 'Three nines is about 9 hours a year, four nines is under an hour, five nines is about 5 minutes.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '-', copies: '1' },
      scene: {
        nodes: [
          { ...n2, status: 'hot', badge: '3.65 days' },
          { ...n3, status: 'active', badge: '8.76 hours' },
          { ...n4, status: 'ok', badge: '52.6 min' },
          { ...n5, status: 'ok', badge: '5.26 min' },
        ],
        links: nines,
        flows: [{ path: ['n2', 'n3', 'n4', 'n5'], tone: 'data', duration: 3.6 }],
        caption: 'Allowed downtime per year',
      },
      code: {
        language: 'python',
        title: 'From nines to downtime',
        source: `MINUTES_PER_YEAR = 365 * 24 * 60        # 525,600

def downtime_minutes(availability_pct, period_minutes=MINUTES_PER_YEAR):
    return period_minutes * (1 - availability_pct / 100)

for target in (99, 99.9, 99.99, 99.999):
    print(target, round(downtime_minutes(target), 2))

# 99      5256.0   min  = 3.65 days
# 99.9     525.6   min  = 8.76 hours
# 99.99     52.56  min
# 99.999     5.26  min

print(downtime_minutes(99.9, 30 * 24 * 60))   # 43.2 min in a 30-day month`,
        highlight: [4, 10, 11, 14],
      },
    },
    {
      title: 'Cost of nines',
      tag: 'tradeoff',
      heading: 'Each nine costs more than the last',
      eli5: 'Staying open a bit more often is cheap. Never being shut at all means a spare shop, spare staff and a second front door. Every **nine** needs more spares than the one before.',
      body: [
        'Our 99.79% sits between two and three nines. A rough ladder: 99% is a single region with basic recovery. 99.9% needs several zones and automatic failover.',
        '99.99% needs multi-region with failover you have tested. 99.999% needs active-active across regions with no single control plane. Past four nines no human can be in the repair loop.',
      ],
      keyIdea: 'Pick the target the business needs. Each extra nine costs far more than the last.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '-', copies: '1' },
      scene: {
        nodes: [
          { ...n2, label: '99%', sub: '1 region', badge: 'cheap' },
          { ...n3, label: '99.9%', sub: 'multi-zone', badge: 'auto failover' },
          { ...n4, label: '99.99%', sub: 'multi-region', badge: 'tested failover' },
          { ...n5, label: '99.999%', sub: 'active-active', badge: 'no human in loop' },
        ],
        links: nines.map((l) => ({ ...l, label: 'costs more', labelTone: 'warn' as const })),
        panel: {
          title: 'What each target needs',
          icon: 'Layers',
          rows: [
            { text: '99%', value: 'basic HA' },
            { text: '99.9%', value: 'zones + failover' },
            { text: '99.99%', value: 'regions + drills' },
            { text: '99.999%', value: 'active-active', tone: 'warn' },
          ],
        },
        caption: 'Targets are a price tag',
      },
    },
    {
      title: 'SLI',
      tag: 'concept',
      heading: 'SLI: the thing you actually measure',
      eli5: 'The shop counts how many kids found the door open and the till working. That count is the measurement. The **SLO monitor** does the counting.',
      body: [
        'An **SLI** (service level indicator) is the measurement. For checkout: the share of requests that return a non-error response within 300 ms.',
        'Measure by requests, not by minutes. An outage at 3 am hurts fewer users than one at noon, and a request count says so. Count where requests enter, at the load balancer.',
      ],
      keyIdea: 'An SLI is good requests divided by total requests, counted where users arrive.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '-', copies: '1' },
      scene: {
        nodes: [users, lb, { ...app1, status: 'active' }, { ...mon, status: 'active', label: 'SLO monitor', badge: 'SLI 99.79%' }],
        links: [...chain.slice(0, 2), L('lb', 'mon', { style: 'dashed', label: 'good / total' })],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', count: 4, duration: 1.6 },
          { path: ['lb', 'mon'], tone: 'data', label: 'count outcomes', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'A good request',
          icon: 'Gauge',
          rows: [
            { text: 'Status is not 5xx', value: 'yes', tone: 'good' },
            { text: 'Answered within', value: '300 ms', tone: 'good' },
            { text: 'Counted at', value: 'load balancer' },
          ],
        },
        caption: 'The SLI is counted where requests enter',
      },
    },
    {
      title: 'SLO',
      tag: 'concept',
      heading: 'SLO: the target you engineer toward',
      eli5: 'The shop owner aims for 999 of every 1,000 kids finding the door open. That aim is for the staff, not for the sign outside. The **SLO monitor** compares the count to the aim.',
      body: [
        'An **SLO** (service level objective) is the internal target for the SLI: 99.9% over a rolling 30 days.',
        'It is what the team engineers toward and gets paged about. Our measured 99.79% misses it, which tells the team to work on reliability before anything else.',
      ],
      keyIdea: 'An SLO is a target for an SLI over a window. It drives engineering and paging.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      metricTones: { avail: 'bad' },
      scene: {
        nodes: [{ ...lb, status: 'active' }, { ...mon, status: 'hot', sub: 'SLO 99.9%', badge: 'SLI 99.79%' }, { ...app1, status: 'active' }],
        links: [L('lb', 'mon', { style: 'dashed' }), L('lb', 'app1')],
        panel: {
          title: 'SLO vs reality',
          icon: 'Gauge',
          rows: [
            { text: 'Target (SLO)', value: '99.9%' },
            { text: 'Window', value: '30 days rolling' },
            { text: 'Measured (SLI)', value: '99.79%', tone: 'bad' },
          ],
          footer: { text: 'SLO missed: fix reliability first', tone: 'bad' },
        },
        flows: [{ path: ['lb', 'mon'], tone: 'event', label: 'SLI 99.79%', duration: 1.4 }],
        caption: 'The team aims at 99.9%',
      },
    },
    {
      title: 'SLA',
      tag: 'concept',
      heading: 'SLA: the promise with consequences',
      eli5: 'The sign on the shop door promises a bit less than the owner aims for, so the shop can keep its word. If it breaks the promise, it gives parents a coupon. The **customers** read the sign.',
      body: [
        'An **SLA** (service level agreement) is the contract with customers, with consequences such as service credits. Ours promises 99.5%. Cloud providers typically quote 99.9% or above.',
        'Keep the SLA looser than the SLO, so you find out you are in trouble before you owe anyone money. Read the exclusions: planned maintenance often does not count.',
      ],
      keyIdea: 'SLI is what you measure, SLO is what you aim for, SLA is what you promise. Promise less than you aim for.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      scene: {
        nodes: [users, { ...mon, status: 'active', sub: 'SLO 99.9%', badge: 'SLA 99.5%' }, { ...lb, status: 'active' }],
        links: [L('lb', 'mon', { style: 'dashed' }), L('users', 'lb')],
        panel: {
          title: 'Three levels',
          icon: 'Scale',
          rows: [
            { text: 'SLI (measured)', value: '99.79%' },
            { text: 'SLO (aim, internal)', value: '99.9%', tone: 'good' },
            { text: 'SLA (promise, contract)', value: '99.5%', tone: 'warn' },
          ],
          footer: { text: 'Below 99.5%: service credits owed', tone: 'bad' },
        },
        flows: [{ path: ['users', 'lb', 'mon'], tone: 'data', duration: 2 }],
        caption: 'Promise less than you aim for',
      },
    },
    {
      title: 'Error budget',
      tag: 'concept',
      heading: 'The error budget: how much failure you may spend',
      eli5: 'The owner allows the shop to be shut 43 minutes a month. Fixing a shelf during opening hours uses some of those minutes. The **SLO monitor** keeps the tally.',
      body: [
        'A 99.9% SLO means 0.1% may fail. That allowance is the **error budget**: 43.2 minutes of full outage per 30 days, or 10,000 failed requests out of 10 million.',
        'Budget left: ship features, run risky migrations, test failover in production. Budget spent: freeze releases and work on reliability. 100% is the wrong target, because every deploy carries risk.',
      ],
      keyIdea: 'Error budget = 100% minus the SLO. Spend it on change, and stop spending when it runs out.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '17.3 min left', copies: '1' },
      metricTones: { budget: 'warn' },
      scene: {
        nodes: [{ ...lb, status: 'active' }, { ...app1, status: 'hot', load: 72, badge: 'bad deploy' }, { ...mon, status: 'hot', sub: 'SLO 99.9%', badge: 'budget 60% spent' }],
        links: [L('lb', 'app1'), L('lb', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['lb', 'app1'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['app1', 'lb'], tone: 'error', label: '500', count: 2, duration: 1.4, delay: 1.5 },
          { path: ['lb', 'mon'], tone: 'event', label: 'errors counted', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Budget for 30 days',
          icon: 'Gauge',
          rows: [
            { text: 'Allowed failure', value: '0.1%' },
            { text: 'As downtime', value: '43.2 min' },
            { text: 'As requests', value: '10,000 of 10M' },
          ],
          footer: { text: 'Spent: ship less. Left: ship more.', tone: 'muted' },
        },
        caption: 'A bad deploy spends the budget',
      },
      quiz: {
        question: 'Your SLO is 99.9% over 30 days. An incident takes the service fully down for 30 minutes. How much error budget is left for the rest of the window?',
        options: ['None, the SLO is broken', 'About 13 minutes', 'About 43 minutes', 'About 8 hours'],
        answer: 1,
        explain: '0.1% of 30 days is 43.2 minutes. The incident spent 30 of them, leaving 13.2 minutes. The SLO is still met, but there is little room for another risky change.',
      },
    },
    {
      title: 'Burn rate',
      tag: 'concept',
      heading: 'Burn rate: alert on how fast the budget goes',
      eli5: 'Do not wait until the 43 minutes are gone. If the shop uses ten minutes in the first hour, the owner is told right away. The **SLO monitor** rings the bell.',
      body: [
        '**Burn rate** is how fast the budget is being spent compared with a pace that would last the full 30 days. A burn rate of 1 uses it up exactly at the end.',
        'Page on a fast burn, such as 14.4 for an hour (2% of the month gone). Open a ticket on a slow burn, such as 1 over three days.',
      ],
      keyIdea: 'Alert on burn rate, not on raw errors. Fast burn pages a human, slow burn opens a ticket.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      metricTones: { budget: 'warn' },
      scene: {
        nodes: [{ ...lb, status: 'active' }, { ...mon, status: 'hot', badge: 'burn rate 14x' }, { id: 'oncall', kind: 'user', at: p(1, 4.7), label: 'on-call', status: 'active', badge: 'paged' }],
        links: [L('lb', 'mon', { style: 'dashed' }), L('mon', 'oncall', { label: 'page', labelTone: 'warn' })],
        flows: [
          { path: ['lb', 'mon'], tone: 'event', label: 'errors', duration: 1.2 },
          { path: ['mon', 'oncall'], tone: 'error', label: 'fast burn', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Two alerts',
          icon: 'Timer',
          rows: [
            { text: 'Fast burn > 14.4 over 1 h', value: 'page', tone: 'bad' },
            { text: 'Slow burn > 1 over 3 d', value: 'ticket', tone: 'warn' },
          ],
        },
        caption: 'Burn rate decides who gets woken up',
      },
      code: {
        language: 'yaml',
        title: 'An SLO written down (illustrative format)',
        source: `slo:
  service: checkout
  sli: good_requests / total_requests     # good = no 5xx and under 300 ms
  objective: 99.9                         # percent, rolling 30 days
  error_budget: 0.1                       # percent: 43.2 min, or 10,000 of 10M requests

alerts:
  - name: fast-burn
    when: burn_rate > 14.4 over 1h        # 2% of the monthly budget gone in one hour
    action: page
  - name: slow-burn
    when: burn_rate > 1 over 3d           # on pace to run out before the window ends
    action: ticket`,
        highlight: [3, 4, 5, 9],
      },
    },
    {
      title: 'Single point',
      tag: 'problem',
      heading: 'A single point of failure ends the day',
      eli5: 'One shopkeeper, one till, one front door. If any one of them stops, the whole shop stops. The **app** has exactly one of everything.',
      body: [
        'A **single point of failure** (SPOF) is a part that has no spare. When it fails, the whole request path fails. Look at every box on the path and ask: if this vanished, what happens?',
        'Every box with no spare turns each of its failures into an outage for the whole path. One node can reach 99.9% only if it rarely fails and is repaired fast, but it can never hide a failure.',
      ],
      keyIdea: 'Any component with no copy is a single point of failure. Find them before they find you.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      metricTones: { copies: 'bad' },
      scene: {
        nodes: [{ ...lb, badge: 'SPOF' }, { ...app1, badge: 'SPOF' }, { ...db1, badge: 'SPOF' }, users],
        links: chain,
        flows: [{ path: ['users', 'lb', 'app1', 'db1'], tone: 'request', count: 2, duration: 2.2 }],
        panel: {
          title: 'Spare count',
          icon: 'Copy',
          rows: [
            { text: 'Load balancer', value: '1 copy', tone: 'bad' },
            { text: 'App server', value: '1 copy', tone: 'bad' },
            { text: 'Database', value: '1 copy', tone: 'bad' },
          ],
          footer: { text: 'Lose any one and checkout is down', tone: 'bad' },
        },
        caption: 'One of everything',
      },
    },
    {
      title: 'In series',
      tag: 'concept',
      heading: 'Components in series: multiply, and it gets worse',
      eli5: 'To buy a toy you need the door open, the shopkeeper awake and the till working. If any one fails, you go home with nothing. The **load balancer**, **app** and **database** are those three.',
      body: [
        'A checkout needs the load balancer **and** the app **and** the database. Components that must all work are **in series**, and their availabilities multiply.',
        '`0.9999 × 0.999 × 0.999 = 0.9979`. That is **99.79%**, about 18.4 hours a year, exactly the downtime we measured. The chain is worse than its weakest link.',
      ],
      keyIdea: 'In series, availabilities multiply, so a chain is always less available than its worst part.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      metricTones: { avail: 'warn' },
      scene: {
        nodes: [users, { ...lb, status: 'active' }, { ...app1, status: 'active' }, { ...db1, status: 'active', badge: 'chain: 99.79%' }],
        links: chain,
        flows: [
          { path: ['users', 'lb', 'app1', 'db1'], tone: 'request', label: 'needs all three', duration: 2.2 },
          { path: ['db1', 'app1', 'lb', 'users'], tone: 'response', duration: 2.2, delay: 2.3 },
        ],
        panel: { title: 'Multiply', icon: 'Scale', code: '0.9999 × 0.999 × 0.999\n= 0.9979', footer: { text: '99.79%, 18.4 h a year', tone: 'warn' } },
        caption: '99.99% × 99.9% × 99.9% = 99.79%',
      },
    },
    {
      title: 'Long chains',
      tag: 'tradeoff',
      heading: 'Every hard dependency is another factor below 1',
      eli5: 'If getting a toy needs ten helpers and each is there 999 days out of 1,000, some days someone is missing. More helpers in a line means more missing days.',
      body: [
        'Ten services at 99.9% each in a synchronous chain give `0.999^10 = 99.0%`. That is 3.65 days a year, from ten parts that each look excellent.',
        'This is why long call chains are fragile. Keep the hard path short, and move everything else off it: to a queue, a cache or a cached fallback.',
      ],
      keyIdea: 'Each added hard dependency lowers the total. Keep the request path short.',
      metrics: { avail: '99.0%', down: '3.65 days', budget: '43.2 min', copies: '1' },
      metricTones: { avail: 'bad', down: 'bad' },
      scene: {
        nodes: [users, { ...lb, sub: '99.9%' }, { ...app1, label: 'service A', status: 'active' }, { ...db1, kind: 'server', label: 'service J', sub: '99.9%', badge: '10 hops' }],
        links: chain,
        panel: {
          title: 'Services at 99.9% each',
          icon: 'Table',
          rows: [
            { text: '1 service', value: '99.9%', tone: 'good' },
            { text: '3 services', value: '99.7%' },
            { text: '5 services', value: '99.5%', tone: 'warn' },
            { text: '10 services', value: '99.0%', tone: 'bad' },
          ],
        },
        flows: [{ path: ['users', 'lb', 'app1', 'db1'], tone: 'request', label: '10 calls deep', duration: 2.4 }],
        caption: '0.999^10 = 99.0%',
      },
    },
    {
      title: 'In parallel',
      tag: 'concept',
      heading: 'Components in parallel: both must fail',
      eli5: 'Now two shopkeepers work in the shop. If one is sick, the other still sells toys. The shop only closes when both are sick on the same day. **App 1** and **app 2** are the two shopkeepers.',
      body: [
        'Add a second app server behind the load balancer. Either one can serve a request, so the tier fails only when **both** are down at once. These are components **in parallel**.',
        'If failures are independent: `1 − (1 − 0.999)^2 = 99.9999%`. Six nines from two three-nines machines. The general form is `1 − (1 − a)^n` for n copies.',
      ],
      keyIdea: 'In parallel, failure probabilities multiply, so each extra independent copy adds nines.',
      metrics: { avail: '99.89%', down: '9.6 h', budget: '43.2 min', copies: '2 app, 1 DB' },
      metricTones: { avail: 'good' },
      scene: {
        nodes: [lb, { ...app1, status: 'down', badge: 'crashed' }, { ...app2, status: 'ok', badge: 'takes over' }, { ...db1, badge: 'still single' }],
        links: [L('lb', 'app1'), L('lb', 'app2'), L('app1', 'db1'), L('app2', 'db1')],
        flows: [
          { path: ['lb', 'app2', 'db1'], tone: 'request', count: 4, duration: 2 },
          { path: ['db1', 'app2', 'lb'], tone: 'response', count: 4, duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Two copies at 99.9%',
          icon: 'Copy',
          rows: [
            { text: 'One down', value: '0.1%' },
            { text: 'Both down', value: '0.0001%', tone: 'good' },
            { text: 'Pair available', value: '99.9999%', tone: 'good' },
          ],
        },
        caption: 'One server down, zero failed requests',
      },
    },
    {
      title: 'Redundancy math',
      tag: 'concept',
      heading: 'Put it together: find the weakest tier',
      eli5: 'Two shopkeepers and two tills, but still one front door. If the door jams, nobody gets in. Now the door is the thing to fix next. The **load balancer** is that door.',
      body: [
        'With two app servers: `0.9999 × 0.999999 × 0.999 = 99.89%`, about 9.6 hours. The single database now dominates. Redundancy only helps in the tier where you add it.',
        'A standby database gives `99.99%`, about **54 minutes a year**, an upper bound that assumes independent failures. Compute each tier and duplicate the lowest next.',
      ],
      keyIdea: 'Model each tier as parallel copies, multiply the tiers in series, and spend money on the lowest number.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      metricTones: { avail: 'good', down: 'good' },
      scene: {
        nodes: [{ ...lb, status: 'active', badge: 'weakest: 99.99%' }, { ...app1, status: 'ok', badge: 'pair: 99.9999%' }, { ...app2, status: 'ok' }, { ...db1, status: 'ok', badge: 'pair: 99.9999%' }, { ...db2, status: 'ok' }],
        links: redundant.slice(1),
        flows: [
          { path: ['lb', 'app1', 'db1'], tone: 'request', count: 2, duration: 2 },
          { path: ['lb', 'app2', 'db1'], tone: 'request', count: 2, duration: 2, delay: 0.4 },
          { path: ['db1', 'db2'], tone: 'data', label: 'replication', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Still to fix',
          icon: 'Shield',
          rows: [
            { text: 'Load balancer', value: 'still a SPOF', tone: 'bad' },
            { text: 'Duplicate it', value: 'pair + floating IP' },
            { text: 'Or', value: 'DNS or anycast' },
            { text: 'Real 99.99%', value: 'multi-region', tone: 'warn' },
          ],
        },
        caption: '99.99% × 99.9999% × 99.9999% = 99.99%',
      },
      code: {
        language: 'python',
        title: 'Series and parallel availability',
        source: `def series(*parts):          # every part must work
    total = 1.0
    for a in parts:
        total *= a
    return total

def parallel(a, n):          # at least one of n copies must work
    return 1 - (1 - a) ** n

lb, app, db = 0.9999, 0.999, 0.999

print(series(lb, app, db))                             # 0.99790 -> 18.4 h / year
print(series(lb, parallel(app, 2), db))                # 0.99890 -> 9.6 h / year
print(series(lb, parallel(app, 2), parallel(db, 2)))   # 0.99990 -> 54 min / year`,
        highlight: [4, 8, 13, 14],
      },
    },
    {
      title: 'Active modes',
      tag: 'concept',
      heading: 'Active-active or active-passive',
      eli5: 'Two shopkeepers can both serve kids all day, or one serves while the other waits in the back room. Waiting is cheaper, but the helper needs a moment to walk out. **App 1** and **app 2** can do either.',
      body: [
        '**Active-active**: every copy serves traffic. Capacity is used, and a failure just removes one share. Keep enough headroom that the survivors can take the load.',
        '**Active-passive**: one copy serves and a standby waits, kept in sync. A failure needs a switch (failover), which takes seconds to minutes, and the standby sits idle until then.',
      ],
      keyIdea: 'Active-active has no switch moment but needs headroom. Active-passive is simpler but pays for an idle copy and a failover delay.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [lb, { ...app1, status: 'active', load: 45, badge: 'active' }, { ...app2, status: 'active', load: 45, badge: 'active' }, { ...db1, status: 'active', badge: 'active' }, { ...db2, status: 'idle', badge: 'passive' }],
        links: redundant.slice(1),
        flows: [
          { path: ['lb', 'app1', 'db1'], tone: 'request', count: 2, duration: 2 },
          { path: ['lb', 'app2', 'db1'], tone: 'request', count: 2, duration: 2, delay: 0.4 },
          { path: ['db1', 'db2'], tone: 'data', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'App tier vs DB tier',
          icon: 'Layers',
          rows: [
            { text: 'App tier', value: 'active-active', tone: 'good' },
            { text: 'DB tier', value: 'active-passive', tone: 'warn' },
            { text: 'Each app at', value: '45% load' },
          ],
          footer: { text: 'One app dies: the other runs at 90%', tone: 'warn' },
        },
        caption: 'Active copies share load, passive copies wait',
      },
    },
    {
      title: 'Failover',
      tag: 'concept',
      heading: 'Failover is a component too',
      eli5: 'The helper in the back room has to know the shopkeeper is sick. Someone must check, and someone must wave the helper out. That checker can break too. The **SLO monitor** is that checker.',
      body: [
        'Switching to the spare needs **health checks** to notice, then an automatic switch. A standby can be hot, warm or cold.',
        'Require several missed checks before promoting, or a blip makes it flap. If the old primary is only unreachable, two nodes both act as primary (split brain), so fence it off (see the consensus lesson). Rehearse with a game day.',
      ],
      keyIdea: 'Failover needs health checks and rehearsal. An untested standby is a guess, not a spare.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [{ ...db1, status: 'down', badge: 'failed' }, { ...db2, status: 'active', label: 'new primary', badge: 'promoted in 60 s' }, { ...mon, status: 'active', label: 'health checker' }, { ...app2, status: 'active' }],
        links: [L('mon', 'db1', { style: 'dashed' }), L('mon', 'db2', { style: 'dashed' }), L('app2', 'db2')],
        flows: [
          { path: ['mon', 'db1'], tone: 'error', label: 'no reply', duration: 1 },
          { path: ['mon', 'db2'], tone: 'event', label: 'promote', duration: 1, delay: 1.1 },
          { path: ['app2', 'db2'], tone: 'request', count: 3, duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Standby types',
          icon: 'Server',
          rows: [
            { text: 'Hot', value: 'seconds', tone: 'good' },
            { text: 'Warm', value: 'minutes', tone: 'warn' },
            { text: 'Cold', value: 'hours', tone: 'bad' },
            { text: 'Risk: two primaries', value: 'fence old', tone: 'warn' },
          ],
        },
        caption: 'The checker notices, then promotes the spare',
      },
    },
    {
      title: 'MTBF and MTTR',
      tag: 'concept',
      heading: 'Fail less often, or recover faster',
      eli5: 'A shopkeeper gets sick about once a month. If it takes 43 minutes to phone a helper, the shop is shut for 43 minutes. If the helper is already standing there, it is shut for one minute. The **standby** is that helper.',
      body: [
        '**MTBF** (mean time between failures) is how long a part runs before it breaks. **MTTR** (mean time to repair) is how long until it serves again. Availability is `MTBF / (MTBF + MTTR)`.',
        'A server crashing every 720 hours with 43 minutes of repair scores `720 / (720 + 0.72) = 99.9%`. With automatic failover, MTTR drops to 1 minute and it scores 99.998%. Most availability work is MTTR work.',
      ],
      keyIdea: 'Availability = MTBF / (MTBF + MTTR). Cutting recovery time is usually cheaper than preventing failures.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      metricTones: { avail: 'good' },
      scene: {
        nodes: [{ ...app1, status: 'down', badge: 'crashed' }, { ...app2, status: 'ok', badge: 'serving' }, { ...mon, status: 'active', label: 'health checker', badge: 'MTTR 43 min → 1 min' }, lb],
        links: [L('lb', 'app1'), L('lb', 'app2'), L('mon', 'app1', { style: 'dashed' })],
        flows: [
          { path: ['mon', 'app1'], tone: 'error', label: 'no reply', duration: 1 },
          { path: ['lb', 'app2'], tone: 'request', count: 3, duration: 1.6, delay: 1.2 },
        ],
        panel: {
          title: 'Same flaky server',
          icon: 'Timer',
          rows: [
            { text: 'MTBF', value: '720 h' },
            { text: 'MTTR by hand', value: '43 min', tone: 'bad' },
            { text: 'Availability', value: '99.9%', tone: 'warn' },
            { text: 'MTTR automatic', value: '1 min', tone: 'good' },
            { text: 'Availability', value: '99.998%', tone: 'good' },
          ],
        },
        caption: 'Shrink repair time, gain nines',
      },
    },
    {
      title: 'RTO and RPO',
      tag: 'concept',
      heading: 'RTO and RPO: how long, and how much loss',
      eli5: 'When the shop reopens, how long were kids waiting at the door, and how many sales notes were lost? The first is how slow, the second is how much paper burned. The **standby** keeps a copy of the notes.',
      body: [
        '**RTO** is the longest you accept being down. **RPO** is the most data you accept losing, in time.',
        'Async replication lags, so failover can lose the last seconds (RPO above 0). Sync gives RPO 0 but each write waits for the standby.',
        'Replication copies mistakes too, so a bad delete reaches the standby. Backups with point-in-time restore set the RPO for logical errors.',      ],
      keyIdea: 'RTO is how long you may be down. RPO is how much recent data you may lose. Replication mode sets RPO.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [{ ...db1, status: 'down', badge: 'failed' }, { ...db2, status: 'active', badge: 'RPO 5 s' }, { ...mon, status: 'active', badge: 'RTO 60 s' }],
        links: [L('db1', 'db2', { style: 'dashed', label: 'async, 5 s lag', labelTone: 'warn' }), L('mon', 'db2', { style: 'dashed' })],
        flows: [
          { path: ['db1', 'db2'], tone: 'data', label: 'writes', duration: 1.4 },
          { path: ['mon', 'db2'], tone: 'event', label: 'promote', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Replication mode',
          icon: 'Copy',
          rows: [
            { text: 'Async', value: 'RPO seconds', tone: 'warn' },
            { text: 'Sync', value: 'RPO 0', tone: 'good' },
            { text: 'Sync write cost', value: '+1 round trip', tone: 'warn' },
            { text: 'Bad delete', value: 'copied too', tone: 'bad' },
            { text: 'Backup + PITR', value: 'restores it', tone: 'good' },
          ],
        },
        caption: 'Failover may lose the last few writes',
      },
      quiz: {
        question: 'A database fails over to an async standby that was 5 seconds behind. What do you lose, and which target measures it?',
        options: ['About 5 seconds of recent writes, measured by RPO', 'About 5 seconds of downtime, measured by RPO', 'Nothing, async replication is lossless', 'About 5 seconds of writes, measured by MTTR'],
        answer: 0,
        explain: 'RPO measures data loss in time. An async standby 5 seconds behind loses up to 5 seconds of writes. The time spent switching over is RTO, and MTTR is the average repair time.',
      },
    },
    {
      title: 'Correlated failure',
      tag: 'tradeoff',
      heading: 'The math assumes independence. Reality does not.',
      eli5: 'Two shopkeepers do not help if they both catch the same cold. Copies only protect you from things that hit one copy at a time. **App 1** and **app 2** got the same bad update.',
      body: [
        '`1 − (1 − a)^n` assumes copies fail independently. Often they share a cause: one rack, one bad deploy, one expired certificate, one poison request. A **correlated failure** takes out all copies and the six nines vanish.',
        'One bad config that takes 50 minutes to roll back spends the whole 43-minute monthly budget. Treat the computed number as an upper bound.',
      ],
      keyIdea: 'Redundancy only protects against independent failures. Shared causes, such as a bad deploy, bypass it.',
      metrics: { avail: '99.99%', down: '54 min + 50', budget: '0 min', copies: '2 app, 2 DB' },
      metricTones: { budget: 'bad', down: 'bad' },
      scene: {
        nodes: [{ ...lb, status: 'active', at: p(-5.5, 2) }, { ...app1, status: 'down', badge: 'bad config v42', at: p(-2.5, -1) }, { ...app2, status: 'down', badge: 'bad config v42', at: p(1, -1) }, { ...users, at: p(-8.5, 2) }],
        links: [L('users', 'lb'), L('lb', 'app1'), L('lb', 'app2')],
        zones: [{ id: 'zone', from: [-2.6, -1.7], to: [0.7, 1.5], label: 'one deploy', tone: 'red' }],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['users', 'lb', 'app2'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['lb', 'users'], tone: 'error', label: '503', count: 4, duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'Shared causes',
          icon: 'Bug',
          rows: [
            { text: 'Same bad deploy', value: 'all copies', tone: 'bad' },
            { text: 'Same expired cert', value: 'all copies', tone: 'bad' },
            { text: 'Same rack or zone', value: 'all copies', tone: 'bad' },
          ],
          footer: { text: 'Rollback took 50 min: budget gone', tone: 'bad' },
        },
        caption: 'Both copies took the same bad deploy',
      },
    },
    {
      title: 'Failure domains',
      tag: 'concept',
      heading: 'Spread copies across failure domains',
      eli5: 'If both shopkeepers live in the same flat, one power cut stops both. Put them in different streets, then different towns. Then a single bad day cannot catch both. The **app** copies need different homes.',
      body: [
        'A **failure domain** is the set of things that fail together: a rack, a zone, a region. Put copies in different ones. Zones protect against a data center fault, regions against a whole area.',
        'Also change one copy first and watch it (canary), then the rest. That makes deploys a failure domain you control.',
      ],
      keyIdea: 'Copies in one failure domain fail together. Spread across zones and regions, and roll changes out one copy at a time.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 zones' },
      metricTones: { avail: 'good' },
      scene: {
        nodes: [{ ...lb, label: 'LB pair', sub: 'floating IP' }, { ...app1, status: 'ok', badge: 'zone A' }, { ...app2, status: 'ok', badge: 'zone B' }, { ...db1, status: 'ok' }, { ...db2, status: 'ok' }],
        links: redundant.slice(1),
        zones: [
          { id: 'za', from: [-4.0, -4.2], to: [0.2, -0.4], label: 'zone A', tone: 'blue' },
          { id: 'zb', from: [0.6, 0.5], to: [4.5, 4.2], label: 'zone B', tone: 'green' },
        ],
        flows: [
          { path: ['lb', 'app1', 'db1'], tone: 'request', count: 2, duration: 2 },
          { path: ['lb', 'app2', 'db1'], tone: 'request', count: 2, duration: 2, delay: 0.4 },
          { path: ['db1', 'db2'], tone: 'data', label: 'cross-zone', duration: 1.4, delay: 2.2 },
        ],
        caption: 'A zone outage takes one copy, not both',
      },
    },
    {
      title: 'Degrade',
      tag: 'concept',
      heading: 'Degrade gracefully instead of failing whole',
      eli5: 'If the till is stuck, the shop can still hand out toys and write the price on paper. Not everything must work for kids to leave happy. The **app** can skip the optional parts.',
      body: [
        'Split dependencies into hard (checkout cannot work without them) and soft (recommendations can be skipped). Soft failures should show a default, not an error. That keeps them out of the series chain.',
        'Protect the rest: set timeouts, retry with backoff and a cap, and shed excess load. Unlimited retries turn a small fault into an overload that fails everyone.',
      ],
      keyIdea: 'Only hard dependencies count in the series math. Make the rest optional with timeouts, capped retries and fallbacks.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [{ ...app1, status: 'active', chips: [{ text: 'timeout 300 ms', tone: 'good' }] }, { id: 'recs', kind: 'block', at: p(2, -4.2), label: 'recs', sub: 'soft', icon: 'Star', tint: 'gray', status: 'down', badge: 'unreachable' }, { ...db1, label: 'orders DB', sub: 'hard', status: 'ok', at: p(2, 4.7) }, lb],
        links: [L('lb', 'app1'), L('app1', 'recs', { label: 'soft', labelTone: 'warn' }), L('app1', 'db1', { label: 'hard' })],
        flows: [
          { path: ['lb', 'app1'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['app1', 'recs'], tone: 'error', label: 'timeout', duration: 1.2, delay: 1.5 },
          { path: ['app1', 'db1'], tone: 'request', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'When recs is down',
          icon: 'Shield',
          rows: [
            { text: 'Checkout', value: 'works', tone: 'good' },
            { text: 'Recommendations', value: 'default list', tone: 'warn' },
            { text: 'Retries', value: '3, with backoff' },
          ],
        },
        caption: 'A soft dependency fails, the page still loads',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Pick a target, then do the arithmetic',
      eli5: 'Write down how often the toy shop must be open, count how often it really is, keep a spare of everything that can break, and make swapping to the spare quick. Then the **customers** find the door open.',
      body: [
        'Availability is `good / total`. **Nines** translate to downtime: 99.9% is 8.76 hours a year. The **SLI** is measured, the **SLO** is the target, the **SLA** is the contract, and the **error budget** says how much risk is left.',
        'Parts **in series** multiply. Parts **in parallel** fail only together. Duplicating the app and database tiers took the design from 18.4 hours to 54 minutes. Fast recovery buys nines, and shared causes bypass copies.',
      ],
      keyIdea: 'Set an SLO, compute the chain, add redundancy to the weakest tier, and shorten recovery time.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      metricTones: { avail: 'good', down: 'good', budget: 'good' },
      scene: {
        nodes: [users, lb, { ...app1, status: 'ok' }, { ...db1, status: 'ok' }, { ...mon, status: 'ok', badge: 'SLO 99.9% met' }],
        links: [...chain, L('db1', 'mon', { style: 'faint' })],
        flows: [
          { path: ['users', 'lb', 'app1', 'db1'], tone: 'request', count: 2, duration: 2 },
          { path: ['db1', 'app1', 'lb', 'users'], tone: 'response', count: 3, duration: 2, delay: 2.4 },
        ],
        panel: {
          title: 'The checklist',
          icon: 'List',
          rows: [
            { text: 'Set SLI, SLO, SLA', value: 'measure' },
            { text: 'Multiply the chain', value: 'weakest tier' },
            { text: 'Duplicate it', value: 'parallel' },
            { text: 'Fail over fast', value: 'low MTTR' },
            { text: 'Spread domains', value: 'zones' },
          ],
        },
        caption: 'Redundant tiers, measured against a target',
      },
      quiz: {
        question: 'A request must pass through an API gateway (99.9%) and then a service that runs as two independent copies (each 99%). What is the availability of the whole path, roughly?',
        options: ['99.9%', '99.89%', '98.9%', '99.99%'],
        answer: 1,
        explain: 'The pair in parallel is 1 − 0.01 × 0.01 = 99.99%. In series with the gateway: 0.999 × 0.9999 = 99.89%. The single gateway now dominates, so it is the next thing to duplicate.',
      },
    },
  ],
};
