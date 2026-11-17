import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];

const users: SceneNode = { id: 'users', kind: 'client', at: p(-7.5, 0), label: 'customers' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: p(-4.5, 0), label: 'load balancer', sub: '99.99%' };
const app1: SceneNode = { id: 'app1', kind: 'server', at: p(-1.5, -3), label: 'app 1', sub: '99.9%' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: p(-1.5, 3.5), label: 'app 2', sub: '99.9%' };
const db1: SceneNode = { id: 'db1', kind: 'db', at: p(2, -3), label: 'primary DB', sub: '99.9%' };
const db2: SceneNode = { id: 'db2', kind: 'replica', at: p(2, 3.5), label: 'standby DB', sub: '99.9%' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: p(5.5, 0), label: 'SLO monitor' };

const n2: SceneNode = { id: 'n2', kind: 'monitor', at: p(-6, 0), label: '99%', sub: 'two nines' };
const n3: SceneNode = { id: 'n3', kind: 'monitor', at: p(-2.5, 0), label: '99.9%', sub: 'three nines' };
const n4: SceneNode = { id: 'n4', kind: 'monitor', at: p(1, 0), label: '99.99%', sub: 'four nines' };
const n5: SceneNode = { id: 'n5', kind: 'monitor', at: p(4.5, 0), label: '99.999%', sub: 'five nines' };

const chain: SceneLink[] = [
  { from: 'users', to: 'lb' },
  { from: 'lb', to: 'app1' },
  { from: 'app1', to: 'db1' },
];
const redundant: SceneLink[] = [
  ...chain,
  { from: 'lb', to: 'app2' },
  { from: 'app2', to: 'db1' },
  { from: 'db1', to: 'db2', style: 'dashed', label: 'replicate' },
];

export const availability: Lesson = {
  id: 'availability',
  title: 'Availability in numbers: nines, SLA, SLO',
  tagline: 'Turn "it should stay up" into a number, a budget and the redundancy math that gets you there.',
  minutes: 13,
  level: 'Beginner',
  learn: [
    'What each extra nine means in downtime per year',
    'The difference between an SLI, an SLO and an SLA',
    'How an error budget turns reliability into a decision tool',
    'Why components in series multiply their failures and components in parallel hide them',
    'How MTBF and MTTR combine into availability',
    'Where the redundancy math stops matching reality',
  ],
  metrics: [
    { key: 'avail', label: 'Availability' },
    { key: 'down', label: 'Downtime / year' },
    { key: 'budget', label: 'Budget / 30 days' },
    { key: 'copies', label: 'Copies per tier' },
  ],
  steps: [
    {
      title: 'How reliable?',
      tag: 'problem',
      heading: '"It is almost always up" is not a number',
      eli5: 'A toy shop says "we are almost always open". Last year it was shut for 18 hours when kids came to buy. Is that good? Nobody can say, because nobody wrote down a promise. The **app** is that shop.',
      body: [
        'A big customer asks: "What uptime do you guarantee?" The team answers "it is very reliable". Last year the checkout service was down for a total of **18 hours** across four incidents.',
        'Is 18 hours good? For a hobby project, yes. For a payment system, each of those hours lost real orders. Without a target, nobody can say whether to build features or fix reliability.',
        '**Availability** is the share of time, or of requests, in which the system works: `good / total`. 18 hours out of 8,760 in a year is 0.21% down, so 99.79% available. Now we have a number to argue about.',
      ],
      keyIdea: 'Availability is a measured fraction. Until you measure it and set a target, "reliable" means nothing.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '-', copies: '1' },
      scene: {
        nodes: [users, lb, { ...app1, status: 'down', badge: 'crashed' }, { ...db1, status: 'dim' }],
        links: chain,
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['app1', 'lb', 'users'], tone: 'error', label: '503', count: 4, duration: 1.4, delay: 1.5 },
        ],
        caption: 'Four incidents, 18 hours of failed checkouts',
      },
    },
    {
      title: 'The nines',
      tag: 'concept',
      heading: 'Each extra nine cuts downtime by ten',
      eli5: 'Count the minutes in a year the toy shop may be shut. Two nines means shut for almost four days. Five nines means shut for five minutes. Each **nine** in the picture is a much stricter promise.',
      body: [
        'Availability targets are quoted in **nines**. A year has 8,760 hours, or 525,600 minutes. Multiply by the allowed failure share to get the downtime.',
        '**99%** allows 3.65 days a year. **99.9%** allows 8.76 hours. **99.99%** allows 52.6 minutes. **99.999%** allows 5.26 minutes, which is less time than it takes a person to wake up and open a laptop.',
        'Our 99.79% sits between two and three nines. Each step up is ten times less downtime and, as a rule of thumb, a lot more money and engineering. Past four nines, no human can be in the repair loop.',
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
        links: [
          { from: 'n2', to: 'n3', label: '÷ 10' },
          { from: 'n3', to: 'n4', label: '÷ 10' },
          { from: 'n4', to: 'n5', label: '÷ 10' },
        ],
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
      title: 'SLI, SLO, SLA',
      tag: 'concept',
      heading: 'Measure it, target it, promise it',
      eli5: 'The shop counts how many kids found the door open: that is the measurement. The owner aims for 999 of every 1,000. The sign for parents promises a bit less, so the shop can keep its word. The **SLO monitor** does the counting.',
      body: [
        'An **SLI** (service level indicator) is the measurement: for checkout, the share of requests that return a non-error response within 300 ms. Measuring by requests is better than by minutes, because an outage at 3 am hurts fewer users than one at noon.',
        'An **SLO** (service level objective) is the internal target for that SLI: 99.9% over a rolling 30 days. It is what the team engineers toward and gets paged about.',
        'An **SLA** (service level agreement) is the contract with customers, with consequences such as service credits. Ours promises 99.5%. Keep the SLA looser than the SLO, so you find out you are in trouble before you owe anyone money.',
      ],
      keyIdea: 'SLI is what you measure, SLO is what you aim for, SLA is what you promise. Promise less than you aim for.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      scene: {
        nodes: [
          users,
          lb,
          { ...app1, status: 'active' },
          db1,
          { ...mon, status: 'active', sub: 'SLO 99.9% · SLA 99.5%', badge: 'SLI 99.79%' },
        ],
        links: [...chain, { from: 'lb', to: 'mon', style: 'dashed', label: 'good / total' }],
        flows: [
          { path: ['users', 'lb', 'app1', 'db1'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['db1', 'app1', 'lb', 'users'], tone: 'response', count: 4, duration: 1.8, delay: 1.9 },
          { path: ['lb', 'mon'], tone: 'data', label: 'count outcomes', duration: 1.4, delay: 3.8 },
        ],
        caption: 'The SLI is counted where requests enter',
      },
    },
    {
      title: 'Error budget',
      tag: 'concept',
      heading: 'The error budget: how much failure you may spend',
      eli5: 'The owner allows the shop to be shut 43 minutes a month. Fixing a shelf during opening hours uses some of those minutes. When the minutes are gone, no more risky changes until next month. The **SLO monitor** keeps the tally.',
      body: [
        'A 99.9% SLO means 0.1% is allowed to fail. That allowance is the **error budget**: 43.2 minutes of full outage per 30 days, or 10,000 failed requests out of 10 million.',
        'The budget turns an argument into arithmetic. Budget left: ship features, run risky migrations, test failover in production. Budget spent: freeze releases and work on reliability until the window recovers.',
        'It also says that 100% is the wrong target. Every deploy carries risk, so a team chasing 100% would never ship. Alert on **burn rate**: how fast the budget is being spent compared with a pace that would last the full 30 days.',
      ],
      keyIdea: 'Error budget = 100% minus the SLO. Spend it on change, and stop spending when it runs out.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      scene: {
        nodes: [
          users,
          lb,
          { ...app1, status: 'hot', badge: 'bad deploy' },
          db1,
          { ...mon, status: 'hot', sub: 'SLO 99.9%', badge: 'budget 60% spent' },
        ],
        links: [...chain, { from: 'lb', to: 'mon', style: 'dashed' }],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['app1', 'lb', 'users'], tone: 'error', label: '500', count: 2, duration: 1.4, delay: 1.5 },
          { path: ['lb', 'mon'], tone: 'event', label: 'burn rate 14x', duration: 1.4, delay: 3 },
        ],
        caption: 'A bad deploy burns the monthly budget in hours',
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
      quiz: {
        question: 'Your SLO is 99.9% over 30 days. An incident takes the service fully down for 30 minutes. How much error budget is left for the rest of the window?',
        options: ['None, the SLO is broken', 'About 13 minutes', 'About 43 minutes', 'About 8 hours'],
        answer: 1,
        explain: '0.1% of 30 days is 43.2 minutes. The incident spent 30 of them, leaving 13.2 minutes. The SLO is still met, but there is little room for another risky change.',
      },
    },
    {
      title: 'In series',
      tag: 'concept',
      heading: 'Components in series: multiply, and it gets worse',
      eli5: 'To buy a toy you need the door open, the shopkeeper awake and the till working. If any one of the three fails, you go home with nothing. The **load balancer**, **app** and **database** are those three.',
      body: [
        'A checkout needs the load balancer **and** the app server **and** the database. Components that must all work are **in series**, and their availabilities multiply.',
        '`0.9999 × 0.999 × 0.999 = 0.9979`. Three good components give **99.79%**, about 18.4 hours a year. That is exactly the downtime we measured in step one. The chain is worse than its weakest link.',
        'Every hard dependency you add to the request path is another factor below 1. Ten services at 99.9% each give `0.999^10 = 99.0%`. This is why long synchronous call chains are fragile.',
      ],
      keyIdea: 'In series, availabilities multiply, so a chain is always less available than its worst part.',
      metrics: { avail: '99.79%', down: '18.4 h', budget: '43.2 min', copies: '1' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active' },
          { ...app1, status: 'active' },
          { ...db1, status: 'active', badge: 'chain: 99.79%' },
        ],
        links: chain,
        flows: [
          { path: ['users', 'lb', 'app1', 'db1'], tone: 'request', label: 'needs all three', duration: 2.2 },
          { path: ['db1', 'app1', 'lb', 'users'], tone: 'response', duration: 2.2, delay: 2.3 },
        ],
        caption: '99.99% × 99.9% × 99.9% = 99.79%',
      },
    },
    {
      title: 'In parallel',
      tag: 'concept',
      heading: 'Components in parallel: both must fail',
      eli5: 'Now two shopkeepers work in the shop. If one is sick, the other still sells toys. The shop only closes when both are sick on the same day, which almost never happens. **App 1** and **app 2** are the two shopkeepers.',
      body: [
        'Add a second app server behind the load balancer. Either one can serve a request, so the tier fails only when **both** are down at once. These are components **in parallel**.',
        'Each server is down 0.1% of the time. If failures are independent, both are down `0.001 × 0.001 = 0.000001` of the time. The pair is `1 − (1 − 0.999)^2 = 99.9999%` available: six nines from two three-nines machines.',
        'The general form is `1 − (1 − a)^n` for n copies. This is the whole case for **redundancy**: cheap, unreliable parts combine into a reliable tier, as long as something routes traffic away from the dead one.',
      ],
      keyIdea: 'In parallel, failure probabilities multiply, so each extra independent copy adds nines.',
      metrics: { avail: '99.89%', down: '9.6 h', budget: '43.2 min', copies: '2 app, 1 DB' },
      scene: {
        nodes: [
          users,
          lb,
          { ...app1, status: 'down', badge: 'crashed' },
          { ...app2, status: 'ok', badge: 'takes over' },
          { ...db1, badge: 'still single' },
        ],
        links: [...chain, { from: 'lb', to: 'app2' }, { from: 'app2', to: 'db1' }],
        flows: [
          { path: ['users', 'lb', 'app2', 'db1'], tone: 'request', count: 4, duration: 2 },
          { path: ['db1', 'app2', 'lb', 'users'], tone: 'response', count: 4, duration: 2, delay: 2.1 },
        ],
        caption: 'One server down, zero failed requests',
      },
    },
    {
      title: 'Redundancy math',
      tag: 'concept',
      heading: 'Put it together: find the weakest tier',
      eli5: 'Two shopkeepers and two tills, but still one front door. If the door jams, nobody gets in. Now the door is the thing to fix next. The **load balancer** is that door.',
      body: [
        'With two app servers the chain is `0.9999 × 0.999999 × 0.999 = 99.89%`, about 9.6 hours a year. Half the downtime is gone and the rest will not move, because the single database at 99.9% now dominates. Redundancy only helps in the tier where you add it.',
        'Add a standby database with automatic failover. Treating the pair as parallel: `0.9999 × 0.999999 × 0.999999 = 99.99%`, about **54 minutes a year**, down from 18.4 hours.',
        'Now the load balancer at 99.99% is the weakest tier, and it accounts for nearly all the remaining downtime. The method repeats: compute each tier, find the lowest number, duplicate that one next.',
      ],
      keyIdea: 'Model each tier as parallel copies, multiply the tiers in series, and spend money on the lowest number.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: 'weakest: 99.99%' },
          { ...app1, status: 'ok', badge: 'pair: 99.9999%' },
          { ...app2, status: 'ok' },
          { ...db1, status: 'ok', badge: 'pair: 99.9999%' },
          { ...db2, status: 'ok' },
        ],
        links: redundant,
        flows: [
          { path: ['users', 'lb', 'app1', 'db1'], tone: 'request', count: 2, duration: 2 },
          { path: ['users', 'lb', 'app2', 'db1'], tone: 'request', count: 2, duration: 2, delay: 0.4 },
          { path: ['db1', 'db2'], tone: 'data', label: 'replication', duration: 1.4, delay: 2.2 },
        ],
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
      title: 'MTBF and MTTR',
      tag: 'concept',
      heading: 'Fail less often, or recover faster',
      eli5: 'A shopkeeper gets sick about once a month. If it takes 43 minutes to phone a helper, the shop is shut for 43 minutes. If the helper is already standing there, it is shut for one minute. The **standby** is that helper.',
      body: [
        '**MTBF** (mean time between failures) is how long a component runs before it breaks. **MTTR** (mean time to repair) is how long it takes to be serving again. Availability is `MTBF / (MTBF + MTTR)`.',
        'An app server crashes about once every 30 days (720 hours). Paging a human and restarting takes 43 minutes. `720 / (720 + 0.72) = 99.9%`. That is where the three nines came from.',
        'You cannot easily make hardware and software fail less. You can shrink repair time. With health checks and automatic failover, MTTR drops to about 1 minute and the same flaky server scores `720 / (720 + 0.017) = 99.998%`. Most availability work is MTTR work: detect fast, fail over automatically, roll back quickly.',
      ],
      keyIdea: 'Availability = MTBF / (MTBF + MTTR). Cutting recovery time is usually cheaper than preventing failures.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [
          users,
          lb,
          app1,
          app2,
          { ...db1, status: 'down', badge: 'failed' },
          { ...db2, status: 'active', label: 'new primary', badge: 'promoted in 60 s' },
          { ...mon, status: 'active', label: 'health checker', badge: 'MTTR 43 min → 1 min' },
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 'app1' },
          { from: 'lb', to: 'app2' },
          { from: 'app1', to: 'db2' },
          { from: 'app2', to: 'db2' },
          { from: 'mon', to: 'db1', style: 'dashed' },
          { from: 'mon', to: 'db2', style: 'dashed' },
        ],
        flows: [
          { path: ['mon', 'db1'], tone: 'error', label: 'no reply', duration: 1 },
          { path: ['mon', 'db2'], tone: 'event', label: 'promote', duration: 1, delay: 1.1 },
          { path: ['users', 'lb', 'app2', 'db2'], tone: 'request', count: 3, duration: 2, delay: 2.2 },
          { path: ['db2', 'app2', 'lb', 'users'], tone: 'response', count: 3, duration: 2, delay: 4.3 },
        ],
        caption: 'Automatic failover shrinks the repair time',
      },
    },
    {
      title: 'Where math lies',
      tag: 'tradeoff',
      heading: 'The math assumes independence. Reality does not.',
      eli5: 'Two shopkeepers do not help if they both catch the same cold, or if the whole street loses power. Copies only protect you from things that hit one copy at a time. **App 1** and **app 2** got the same bad update.',
      body: [
        '`1 − (1 − a)^n` assumes copies fail independently. Often they share a cause: the same rack or data center, the same bad deploy, the same expired certificate, the same poison request that crashes every server that touches it. A **correlated failure** takes out all copies at once and the six nines vanish. One bad config that takes 50 minutes to roll back spends the whole 43-minute monthly budget.',
        'Failover is also a component. It takes time, and it can fail or trigger when it should not. A standby that was never tested is a guess. Planned maintenance counts against availability too, unless the SLA excludes it.',
        'So spread copies across failure domains (zones, then regions), roll out changes to one copy before the rest, and practice failover. Treat the computed number as an upper bound. Each real extra nine tends to cost far more than the last, so pick the target the business needs and stop there.',
      ],
      keyIdea: 'Redundancy only protects against independent failures. Shared causes, such as a bad deploy, bypass it.',
      metrics: { avail: '99.99%', down: '54 min + 50', budget: '0 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [
          { ...users, status: 'hot' },
          lb,
          { ...app1, status: 'down', badge: 'bad config v42' },
          { ...app2, status: 'down', badge: 'bad config v42' },
          db1,
          db2,
        ],
        links: redundant,
        zones: [{ id: 'zone', from: [-3.2, -3.4], to: [3.7, 3.4], label: 'one zone, one deploy', tone: 'red' }],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['users', 'lb', 'app2'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['lb', 'users'], tone: 'error', label: '503', count: 4, duration: 1, delay: 1.5 },
        ],
        caption: 'Both copies took the same bad deploy',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Pick a target, then do the arithmetic',
      eli5: 'Write down how often the toy shop must be open, count how often it really is, keep a spare of everything that can break, and make swapping to the spare quick. Then the **customers** find the door open.',
      body: [
        'Availability is `good / total`. **Nines** translate to downtime: 99.9% is 8.76 hours a year and 99.99% is 52.6 minutes. The **SLI** is the measurement, the **SLO** is the internal target, the **SLA** is the contract, and the **error budget** (100% minus the SLO) says how much risk you can still take this month.',
        'Parts **in series** multiply: three good parts gave 99.79%. Parts **in parallel** fail only together: `1 − (1 − a)^n`. Duplicating the app and database tiers took the design from 18.4 hours to about 54 minutes a year.',
        '`MTBF / (MTBF + MTTR)` shows that fast recovery buys nines. The math holds only for independent failures, so spread copies across failure domains. Later lessons on load balancing, replication and multi-region are all ways of adding parallel copies.',
      ],
      keyIdea: 'Set an SLO, compute the chain, add redundancy to the weakest tier, and shorten recovery time.',
      metrics: { avail: '99.99%', down: '54 min', budget: '43.2 min', copies: '2 app, 2 DB' },
      scene: {
        nodes: [
          users,
          lb,
          { ...app1, status: 'ok' },
          { ...app2, status: 'ok' },
          { ...db1, status: 'ok' },
          { ...db2, status: 'ok' },
          { ...mon, status: 'ok', badge: 'SLO 99.9% met' },
        ],
        links: [...redundant, { from: 'db1', to: 'mon', style: 'faint' }],
        flows: [
          { path: ['users', 'lb', 'app1', 'db1'], tone: 'request', count: 2, duration: 2 },
          { path: ['users', 'lb', 'app2', 'db1'], tone: 'request', count: 2, duration: 2, delay: 0.4 },
          { path: ['db1', 'app1', 'lb', 'users'], tone: 'response', count: 3, duration: 2, delay: 2.4 },
          { path: ['db1', 'db2'], tone: 'data', duration: 1.4, delay: 2.4 },
        ],
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
