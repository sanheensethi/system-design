import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'block', at: at(-5.4, 0), label: 'shoppers', sub: '150 req/s', icon: 'Users', tint: 'blue' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(-1.8, 0), label: 'wait queue' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(1.8, 0), label: 'checkout API', sub: '24 workers' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5.4, 0), label: 'orders DB' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: at(-1.8, 4.2), label: 'dashboard' };

const b40: SceneNode = { id: 'b40', kind: 'block', size: 0.72, at: at(-5.4, 4), label: '40 ms', sub: 'requests 1 to 90', icon: 'Timer', tint: 'green' };
const b200: SceneNode = { id: 'b200', kind: 'block', size: 0.72, at: at(-1.8, 4), label: '200 ms', sub: 'requests 91 to 95', icon: 'Timer', tint: 'blue' };
const b600: SceneNode = { id: 'b600', kind: 'block', size: 0.72, at: at(1.8, 4), label: '600 ms', sub: 'requests 96 to 99', icon: 'Timer', tint: 'amber' };
const b5000: SceneNode = { id: 'b5000', kind: 'block', size: 0.72, at: at(5.4, 4), label: '5,000 ms', sub: 'request 100', icon: 'Timer', tint: 'red' };

const page: SceneNode = { id: 'page', kind: 'block', at: at(-3.6, 0), label: 'page API', sub: 'waits for all 10', icon: 'Network', tint: 'violet' };
const s1: SceneNode = { id: 's1', kind: 'block', size: 0.72, at: at(1.8, -6.6), label: 'pricing', icon: 'Receipt', tint: 'green' };
const s2: SceneNode = { id: 's2', kind: 'block', size: 0.72, at: at(5.4, -2.2), label: 'stock', icon: 'Package', tint: 'teal' };
const s3: SceneNode = { id: 's3', kind: 'block', size: 0.72, at: at(1.8, 2.2), label: 'reviews', icon: 'Star', tint: 'amber' };
const s4: SceneNode = { id: 's4', kind: 'block', size: 0.72, at: at(5.4, 6.6), label: '7 more', sub: 'services', icon: 'Boxes', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const baseLinks: SceneLink[] = [link('users', 'app'), link('app', 'db')];
const queueLinks: SceneLink[] = [link('users', 'queue'), link('queue', 'app'), link('app', 'db')];
const bucketLinks: SceneLink[] = [link('app', 'b40', { style: 'faint' }), link('app', 'b200', { style: 'faint' }), link('app', 'b600', { style: 'faint' }), link('app', 'b5000', { style: 'faint' })];
const fanLinks: SceneLink[] = [link('page', 's1'), link('page', 's2'), link('page', 's3'), link('page', 's4')];

export const latencyPercentiles: Lesson = {
  id: 'latency-percentiles',
  title: 'Latency, throughput and percentiles',
  tagline: 'Why the average hides your slowest users, and how p50, p95 and p99 show what people feel.',
  minutes: 15,
  level: 'Beginner',
  learn: [
    'Why a mean latency can describe no real request',
    'How to read p50, p95 and p99, compute them, and set targets on them',
    'Why the slow tail reaches far more users than 1%, and how fan-out makes it worse',
    'What makes a few requests slow, and where a request spends its time',
    'The difference between latency and throughput, and how Little\'s Law ties them together',
    'Why waiting time explodes as a server gets close to full',
    'How to measure latency without fooling yourself, and how to cut the tail',
  ],
  metrics: [
    { key: 'mean', label: 'Mean', icon: 'Activity' },
    { key: 'p50', label: 'p50', icon: 'Timer' },
    { key: 'p99', label: 'p99', icon: 'Clock' },
    { key: 'util', label: 'Utilization', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Average lies',
      tag: 'problem',
      heading: 'The dashboard says 120 ms. Users say 5 seconds.',
      eli5: 'At the supermarket, most people pay in one minute. One person waits twenty. The sign says "average wait: two minutes", and that person does not believe the sign. The **dashboard** is that sign.',
      body: [
        'The checkout API has one number on its dashboard: **average latency 120 ms**. It has been green for months. Support keeps getting tickets that say "checkout hung for five seconds".',
        'Both are true. **Latency** is the time from sending a request to getting the full response. Most checkouts take 40 ms. A few hit a slow query or a lock and take seconds. The average blends them into a number that matches neither.',
      ],
      keyIdea: 'A mean latency can look healthy while a real group of users has a terrible time.',
      metrics: { mean: '120 ms', p50: '-', p99: '-', util: '75%' },
      metricTones: { mean: 'good' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, db, { ...mon, status: 'ok', badge: 'avg 120 ms' }],
        links: [...baseLinks, link('app', 'mon', { style: 'faint' })],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 4, label: '40 ms', duration: 1.2, delay: 1.3 },
          { path: ['db', 'app', 'users'], tone: 'error', label: '5,000 ms', duration: 4, delay: 2.8 },
        ],
        panel: {
          title: 'Same dashboard, two stories',
          icon: 'Activity',
          rows: [
            { text: 'Dashboard says', value: '120 ms', tone: 'good' },
            { text: 'Most checkouts', value: '40 ms', tone: 'good' },
            { text: 'Support tickets say', value: '5,000 ms', tone: 'bad' },
          ],
          footer: { text: 'One green number, two experiences', tone: 'warn' },
        },
        caption: 'One green number, two very different experiences',
      },
    },
    {
      title: 'Sort them',
      tag: 'concept',
      heading: 'Line up 100 requests from fastest to slowest',
      eli5: 'Line up 100 shoppers by how long they waited. Ninety waited one minute. Five waited longer, four waited much longer, and one waited ages. The **buckets** are those groups standing in line.',
      body: [
        'Take 100 real checkout requests and sort them by time. **90** took 40 ms, **5** took 200 ms, **4** took 600 ms and **1** took 5,000 ms.',
        'Each group is a **bucket**. Sorting turns a pile of numbers into a shape you can read.',
      ],
      keyIdea: 'Sort the requests first. The shape of the sorted list says more than any single summary number.',
      metrics: { mean: '120 ms', p50: '-', p99: '-', util: '75%' },
      scene: {
        nodes: [
          { ...app, at: at(0, -4.8), status: 'active', badge: '100 requests' },
          { ...b40, status: 'ok', badge: '90 requests' },
          { ...b200, badge: '5 requests' },
          { ...b600, status: 'active', badge: '4 requests' },
          { ...b5000, status: 'hot', badge: '1 request' },
        ],
        links: bucketLinks,
        flows: [
          { path: ['app', 'b40'], tone: 'response', count: 6, duration: 1.2 },
          { path: ['app', 'b200'], tone: 'response', count: 2, duration: 1.4, delay: 0.6 },
          { path: ['app', 'b600'], tone: 'response', duration: 1.6, delay: 1.2 },
          { path: ['app', 'b5000'], tone: 'error', duration: 2.4, delay: 1.8 },
        ],
        panel: {
          title: '100 requests, sorted',
          icon: 'List',
          rows: [
            { text: '90 requests', value: '40 ms', tone: 'good' },
            { text: '5 requests', value: '200 ms' },
            { text: '4 requests', value: '600 ms', tone: 'warn' },
            { text: '1 request', value: '5,000 ms', tone: 'bad' },
          ],
        },
        caption: '100 requests sorted from fastest to slowest',
      },
    },
    {
      title: 'Long tail',
      tag: 'concept',
      heading: 'The mean matches no request. The tail pulls it away.',
      eli5: 'Most shoppers pay in one minute and one waits twenty. Average them and you get a wait that nobody had. The **dashboard** shows that made-up wait.',
      body: [
        'The mean is `(90 × 40 + 5 × 200 + 4 × 600 + 5,000) / 100 = 120 ms`. Yet 90 requests were three times faster than that, and 10 were slower. No request took anything close to 120.',
        'Latency has a hard floor (the work itself) and no ceiling, so the distribution has a long **tail** to the right. A few slow requests drag the mean up and say nothing about which ones.',
      ],
      keyIdea: 'Latency is a skewed distribution with a long slow tail. A mean cannot describe it.',
      metrics: { mean: '120 ms', p50: '-', p99: '-', util: '75%' },
      metricTones: { mean: 'warn' },
      scene: {
        nodes: [
          { ...b40, status: 'ok', badge: '90 requests' },
          { ...b200 },
          { ...b600, status: 'active' },
          { ...b5000, status: 'hot' },
          { ...mon, at: at(0, -4.8), status: 'active', badge: 'mean 120 ms' },
        ],
        links: [link('mon', 'b40', { style: 'faint' })],
        flows: [{ path: ['b5000', 'mon'], tone: 'error', label: 'drags the mean up', duration: 2.4 }],
        panel: {
          title: 'The mean, worked out',
          icon: 'Table',
          rows: [
            { text: '90 × 40 ms', value: '3,600' },
            { text: '5 × 200 ms', value: '1,000' },
            { text: '4 × 600 ms', value: '2,400' },
            { text: '1 × 5,000 ms', value: '5,000', tone: 'bad' },
            { text: 'Total / 100', value: '120 ms', tone: 'warn' },
          ],
          footer: { text: 'Nobody got 120 ms', tone: 'warn' },
        },
        caption: 'A handful of slow requests drag the mean up',
      },
    },
    {
      title: 'Percentiles',
      tag: 'concept',
      heading: 'p50, p95, p99: pick a position in the line',
      eli5: 'Walk down the line of 100 shoppers. Shopper 50 shows a normal wait. Shopper 99 shows a bad wait that still happens every day. Each **bucket** in the picture holds one of them.',
      body: [
        'A **percentile** is a position in the sorted list. **p50** (the median) is request 50: half were at or below it, here 40 ms. **p95** is request 95: 200 ms. **p99** is request 99: 600 ms.',
        'Read p99 as "1 request in 100 is slower than this". The single worst request, 5,000 ms, is the **max**. The code below computes each one by nearest rank.',
      ],
      keyIdea: 'p50 is the typical request. p99 is the experience of the unlucky 1 in 100.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      metricTones: { p50: 'good', p99: 'warn' },
      scene: {
        nodes: [
          { ...app, at: at(0, -4.8), badge: 'mean 120 ms' },
          { ...b40, status: 'ok', badge: 'p50 = 40 ms' },
          { ...b200, status: 'active', badge: 'p95 = 200 ms' },
          { ...b600, status: 'active', badge: 'p99 = 600 ms' },
          { ...b5000, status: 'hot', badge: 'max = 5 s' },
        ],
        links: bucketLinks,
        flows: [
          { path: ['app', 'b40'], tone: 'response', label: 'request 50', duration: 1.2 },
          { path: ['app', 'b200'], tone: 'response', label: 'request 95', duration: 1.4, delay: 1.3 },
          { path: ['app', 'b600'], tone: 'response', label: 'request 99', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Position in the sorted list',
          icon: 'Gauge',
          rows: [
            { text: 'p50, request 50', value: '40 ms', tone: 'good' },
            { text: 'p95, request 95', value: '200 ms' },
            { text: 'p99, request 99', value: '600 ms', tone: 'warn' },
            { text: 'max, request 100', value: '5,000 ms', tone: 'bad' },
          ],
        },
        caption: 'A percentile is a position in the sorted list',
      },
      code: {
        language: 'python',
        title: 'Mean versus percentiles on the same 100 requests',
        source: `import math

def percentile(samples, p):
    """Nearest rank: the value that p% of samples are at or below."""
    ordered = sorted(samples)
    rank = math.ceil(p * len(ordered) / 100)    # 1-based position
    return ordered[rank - 1]

latencies_ms = [40] * 90 + [200] * 5 + [600] * 4 + [5000]

print(sum(latencies_ms) / len(latencies_ms))    # mean: 120.0
print(percentile(latencies_ms, 50))             # p50:  40
print(percentile(latencies_ms, 95))             # p95:  200
print(percentile(latencies_ms, 99))             # p99:  600
print(max(latencies_ms))                        # max:  5000`,
        highlight: [5, 6, 7, 11, 12, 14],
      },
    },
    {
      title: 'Targets',
      tag: 'concept',
      heading: 'Turn percentiles into targets, not averages',
      eli5: 'The supermarket promises "nine in ten shoppers pay within a minute". That promise is a target. The **dashboard** checks it every day.',
      body: [
        'An **SLO** (service level objective) is an internal target such as "p99 under 500 ms over 30 days". An **SLA** is the promise to customers, usually looser, with a penalty if missed.',
        'Match the percentile to the pain. p50 tracks the common case, p99 tracks complaints, and p99.9 matters when sessions make hundreds of calls. Targets also follow a latency budget: about 50 ms p99 for one in-region call, and about 300 ms once a request makes one cross-region hop. More hops, more budget used.',
      ],
      keyIdea: 'Set latency targets on percentiles such as p99, and derive them from a latency budget by hop count.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...mon, at: at(-1.8, 0), status: 'hot', badge: 'p99 600 ms' },
          { ...users, at: at(5.4, 0), label: 'customers', sub: 'SLA' },
        ],
        links: [link('app', 'mon', { style: 'faint' }), link('app', 'users', { style: 'faint' })],
        flows: [{ path: ['app', 'mon'], tone: 'data', label: 'p99 = 600 ms', duration: 1.4 }],
        panel: {
          title: 'Targets for checkout',
          icon: 'Scale',
          rows: [
            { text: 'SLO p50', value: '< 100 ms', tone: 'good' },
            { text: 'SLO p99', value: '< 500 ms', tone: 'bad' },
            { text: 'Measured p99', value: '600 ms', tone: 'bad' },
            { text: 'Budget, one in-region call (p99)', value: '~50 ms', tone: 'muted' },
            { text: 'Budget with one cross-region hop (p99)', value: '~300 ms', tone: 'muted' },
          ],
          footer: { text: 'The p99 target is missed even though the mean looks fine', tone: 'warn' },
        },
        caption: 'The p99 target catches what the mean hides',
      },
    },
    {
      title: 'Tails matter',
      tag: 'concept',
      heading: '"Only 1%" reaches far more than 1% of users',
      eli5: 'If you visit the supermarket 20 times, you will get stuck behind the slow shopper on about one visit in five. The **shoppers** who visit often get stuck most.',
      body: [
        'A user does not make one request. A checkout session makes about 20: cart, address, shipping, payment, confirmation. The chance that all 20 beat p99 is `0.99^20 = 82%`, so **18% of sessions** hit at least one request slower than 600 ms. This assumes slow calls are independent.',
        'At 150 requests per second, the slowest 1% is 1.5 requests every second, about 130,000 a day.',
      ],
      keyIdea: 'Users make many requests, so a 1% slow tail touches a large share of sessions.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...users, status: 'hot', badge: '18% of sessions hit' },
          { ...app, status: 'active', chips: ['20 requests each'] },
          { ...db, status: 'hot', badge: 'slow one: 600 ms' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 4, duration: 1.2, delay: 1.3 },
          { path: ['db', 'app', 'users'], tone: 'error', label: 'slow one', duration: 3, delay: 2.6 },
        ],
        panel: {
          title: 'How big is 1%?',
          icon: 'Users',
          rows: [
            { text: 'Requests per session', value: '20' },
            { text: 'All 20 beat p99 (if independent)', value: '0.99^20 = 82%', tone: 'good' },
            { text: 'Sessions hit by the tail', value: '18%', tone: 'bad' },
            { text: 'Slow requests per day', value: '~130,000', tone: 'warn' },
          ],
        },
        caption: '20 requests per session, 1 in 100 slow',
      },
    },
    {
      title: 'Heavy users',
      tag: 'concept',
      heading: 'The tail picks your best customers',
      eli5: 'The shopper with the biggest trolley takes longest at the till. That shopper also spends the most. The slow **checkout** lane is the one your best customers end up in.',
      body: [
        'Slow requests tend to belong to the users with the biggest carts and the longest order histories, because their queries touch more rows. Your best customers get your worst latency.',
        'Those users also make the most requests per session, so they meet the tail again and again. A tail that is 1% of requests can cost far more than 1% of revenue.',
      ],
      keyIdea: 'Slow requests are not spread evenly. They land on heavy users, who are often the most valuable.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...users, label: 'big cart', sub: '60 items', status: 'hot' },
          { ...app, status: 'active' },
          { ...db, status: 'hot', chips: [{ text: 'scans 6,000 rows', tone: 'warn' }] },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'error', label: '600 ms', duration: 3, delay: 1.3 },
        ],
        panel: {
          title: 'Same query, different users',
          icon: 'Table',
          rows: [
            { text: 'New user, 2 items', value: '40 ms', tone: 'good' },
            { text: 'Regular, 15 items', value: '90 ms' },
            { text: 'Big cart, 60 items', value: '600 ms', tone: 'bad' },
          ],
          footer: { text: 'More rows touched, more time spent', tone: 'warn' },
        },
        caption: 'Heavy users get the slow requests',
      },
    },
    {
      title: 'Fan-out',
      tag: 'concept',
      heading: 'Fan-out turns a rare slow call into a common slow page',
      eli5: 'A shopper sends ten friends to ten checkout lanes and can only leave when the last friend is done. One slow lane holds up the whole group. The **page API** is that shopper waiting for everyone.',
      body: [
        'The product page calls **10 backend services** in parallel: pricing, stock, reviews and seven more. The page is ready only when the slowest one answers.',
        'Say each service has a p99 of 600 ms. The chance that all ten are faster is `0.99^10 = 90.4%`. So **9.6% of page loads** wait on at least one slow call, if slow calls are independent. Services behind the same database or host often slow down together, so treat this as a floor. A 1-in-100 event became a 1-in-10 event. At 100 calls it is 63%.',
      ],
      keyIdea: 'A request that fans out to N services is as slow as the slowest one.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...page, status: 'hot', badge: '9.6% of pages slow' },
          { ...s1, status: 'ok', chips: ['40 ms'] },
          { ...s2, status: 'ok', chips: ['40 ms'] },
          { ...s3, status: 'hot', chips: [{ text: '600 ms', tone: 'bad' }] },
          { ...s4, status: 'ok', chips: ['40 ms each'] },
        ],
        links: fanLinks,
        flows: [
          { path: ['page', 's1', 'page'], tone: 'response', duration: 1.2 },
          { path: ['page', 's2', 'page'], tone: 'response', duration: 1.2 },
          { path: ['page', 's4', 'page'], tone: 'response', duration: 1.2 },
          { path: ['page', 's3', 'page'], tone: 'error', label: 'still waiting', duration: 3.6 },
        ],
        panel: {
          title: 'Chance the page is fast',
          icon: 'Split',
          rows: [
            { text: 'All 10 beat p99 (if independent)', value: '0.99^10 = 90.4%', tone: 'good' },
            { text: 'At least one is slow', value: '9.6%', tone: 'bad' },
            { text: 'With 100 calls', value: '1 − 0.99^100 = 63%', tone: 'bad' },
          ],
          footer: { text: 'The page waits for the slowest call', tone: 'warn' },
        },
        caption: 'The page waits for the slowest of 10 calls',
      },
      quiz: {
        question: 'A page calls 10 services in parallel. Each has a p99 of 600 ms. Roughly what share of page loads wait longer than 600 ms on at least one call (assuming independent calls)?',
        options: ['1%', 'About 10%', 'About 50%', '0.1%'],
        answer: 1,
        explain: 'All ten must be fast: 0.99^10 is about 90%. The other 10% of page loads hit at least one slow call. Fan-out multiplies the tail.',
      },
    },
    {
      title: 'Why slow',
      tag: 'concept',
      heading: 'A few requests are slow for ordinary reasons',
      eli5: 'Most trips through the **checkout** are quick. A few get slow because the cashier stops to tidy, two shoppers want the same till, or an item has to be fetched from the back.',
      body: [
        'Common causes of a slow request: a **garbage collection** pause, a lock held by another request, a cache miss that falls through to the database, a noisy neighbor on a shared machine, a retry after a lost packet, or a cold start after a deploy.',
        'Most are rare and unrelated to each other. That is why the tail never fully goes away and has to be managed.',
      ],
      keyIdea: 'The tail comes from many small, rare delays. You manage it, because you cannot delete it.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...app, status: 'hot', chips: [{ text: 'GC pause 300 ms', tone: 'warn' }] },
          { ...db, status: 'hot', chips: [{ text: 'lock wait', tone: 'warn' }, { text: 'cache miss', tone: 'warn' }] },
          { ...users, label: 'shopper' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'error', label: 'slow', duration: 3, delay: 1.3 },
        ],
        panel: {
          title: 'Where slow requests come from',
          icon: 'Bug',
          rows: [
            { text: 'Garbage collection pause', value: '100s of ms' },
            { text: 'Lock held by another request', value: 'waits' },
            { text: 'Cache miss to database', value: '+20 ms or more' },
            { text: 'Noisy neighbor', value: 'shared CPU' },
            { text: 'Retry after packet loss', value: '+200 ms or more' },
            { text: 'Cold start after deploy', value: 'first calls' },
          ],
        },
        caption: 'Rare delays that add up to a tail',
      },
    },
    {
      title: 'Where time goes',
      tag: 'concept',
      heading: 'A request is a sum of waits',
      eli5: 'A shopper waits in the line, then at the till, then while the cashier fetches an item from the back. The **wait queue**, the **checkout API** and the **orders DB** each add some minutes.',
      body: [
        'A request\'s latency is a sum: **queue time** waiting for a free worker, time in the app code, and time waiting on the database. Network time to and from the user adds to this.',
        'Split the number before fixing it. Queue time grows with load, app time is the code, and network time is distance. A slow p99 can come from any one part.',
      ],
      keyIdea: 'Break latency into queue, compute, downstream and network time, then fix the biggest part.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...users, chips: ['network: extra'] },
          { ...queue, chips: ['queue: 2 ms'] },
          { ...app, chips: ['app code: 14 ms'] },
          { ...db, chips: ['database: 24 ms'] },
        ],
        links: queueLinks,
        flows: [
          { path: ['users', 'queue', 'app', 'db'], tone: 'request', count: 2, duration: 2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 2, duration: 1.4, delay: 2.1 },
        ],
        panel: {
          title: 'One typical request, p50',
          icon: 'Clock',
          rows: [
            { text: 'Waiting in the queue', value: '2 ms' },
            { text: 'App code', value: '14 ms' },
            { text: 'Database call', value: '24 ms' },
            { text: 'Total at the server', value: '40 ms', tone: 'good' },
          ],
          footer: { text: 'The user also pays for the network trip', tone: 'muted' },
        },
        caption: 'Queue, code and database add up to 40 ms',
      },
    },
    {
      title: 'Throughput',
      tag: 'concept',
      heading: 'Throughput is a different number from latency',
      eli5: 'How long one shopper takes to pay is one number. How many shoppers the whole **checkout** gets through in an hour is another. More lanes get more people through, yet each person still takes the same time.',
      body: [
        '**Throughput** is how much work finishes per second. Latency is how long one request takes. They are related, and they answer different questions.',
        'The checkout API has 24 workers. Capacity uses the mean time a request holds a worker, the same 120 ms mean as before, because the tail comes from slow service work. One worker finishes about 8.3 per second, so the server tops out at `24 × 8.33 = 200 requests per second`. More workers raise throughput. They do nothing for the latency of one request.',
      ],
      keyIdea: 'Latency is time per request. Throughput is requests per second. More workers raise throughput and leave latency alone. Capacity uses the mean.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...users, chips: ['150 req/s arriving'] },
          { ...queue, chips: ['empty'] },
          { ...app, status: 'ok', load: 75, chips: [{ text: 'max 200 req/s', tone: 'good' }] },
        ],
        links: [link('users', 'queue'), link('queue', 'app')],
        flows: [
          { path: ['users', 'queue', 'app'], tone: 'request', count: 6, duration: 1.4 },
          { path: ['app', 'users'], tone: 'response', count: 6, duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Capacity of one server',
          icon: 'Gauge',
          rows: [
            { text: 'Mean time holding a worker', value: '120 ms' },
            { text: 'One worker finishes', value: '8.3 / s' },
            { text: '24 workers finish', value: '200 / s', tone: 'good' },
            { text: 'Latency of one request', value: 'unchanged' },
          ],
        },
        caption: '150 arrive, 200 can be served: 75% utilized',
      },
    },
    {
      title: 'Little\'s Law',
      tag: 'concept',
      heading: 'Requests in flight = throughput × latency',
      eli5: 'If 150 shoppers an hour each stay 24 minutes, about 60 are inside the store at any moment. The **checkout** counts people inside by multiplying the two numbers.',
      body: [
        '**Little\'s Law** ties the two together: requests in flight = throughput × latency. It uses the mean latency, not p50. At 150 requests per second and a 120 ms mean, `150 × 0.12 = 18` requests are in the system at any moment. With 24 workers, that is 75% busy.',
        'It works in reverse. If mean latency doubles to 240 ms at the same traffic, 36 requests are in flight. That is more than 24 workers, so the rest wait.',
      ],
      keyIdea: 'In flight = rate × mean time. When latency rises at fixed traffic, concurrency rises with it until workers run out.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...users, chips: ['150 req/s'] },
          { ...app, status: 'ok', load: 75, chips: ['18 in flight'] },
          { ...db, chips: ['120 ms mean'] },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'In flight, by latency',
          icon: 'Scale',
          rows: [
            { text: '150 / s × 0.12 s (mean)', value: '18 in flight', tone: 'good' },
            { text: '150 / s × 0.24 s (mean)', value: '36 in flight', tone: 'bad' },
            { text: 'Workers available', value: '24', tone: 'muted' },
          ],
          footer: { text: '36 in flight with 24 workers means a queue', tone: 'warn' },
        },
        caption: '150 per second × 120 ms mean = 18 requests inside',
      },
      quiz: {
        question: 'A service handles 100 requests per second and each takes 200 ms. About how many requests are in flight at any moment?',
        options: ['2', '20', '200', '0.5'],
        answer: 1,
        explain: 'Little\'s Law: 100 requests per second × 0.2 seconds = 20 requests in flight.',
      },
    },
    {
      title: 'Queueing',
      tag: 'concept',
      heading: 'Even below 100% busy, requests wait',
      eli5: 'When the lanes are half empty, you walk straight up. When they are almost always busy, one slow shopper makes a line, and the **wait queue** never gets a quiet moment to clear.',
      body: [
        '**Utilization** is the share of time the workers are busy. Picture one worker with 40 ms of work per request: 19 of 25 requests per second is 75%. Requests arrive in random clumps, so some arrive while the worker is busy and must wait in a queue.',
        'A quiet system clears each clump fast. A busy one has no gaps to drain it.',
      ],
      keyIdea: 'Random arrivals mean a queue forms before utilization reaches 100%.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      metricTones: { util: 'warn' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: '2 arrive at once', tone: 'warn' }] },
          { ...queue, status: 'active', chips: ['1 waiting'] },
          { ...app, status: 'active', sub: '1 worker', load: 75 },
        ],
        links: [link('users', 'queue'), link('queue', 'app')],
        flows: [
          { path: ['users', 'queue'], tone: 'request', count: 2, duration: 0.9 },
          { path: ['queue', 'app'], tone: 'request', count: 1, duration: 2, delay: 0.9 },
        ],
        panel: {
          title: 'Utilization',
          icon: 'Gauge',
          rows: [
            { text: 'Arriving', value: '19 req/s' },
            { text: 'Capacity, 1 worker', value: '25 req/s' },
            { text: 'Utilization', value: '75%', tone: 'warn' },
          ],
          footer: { text: 'Clumps still force some requests to wait', tone: 'muted' },
        },
        caption: 'A clump of arrivals finds the worker busy',
      },
    },
    {
      title: 'Wait formula',
      tag: 'concept',
      heading: 'Delay grows like 1 / (1 − utilization)',
      eli5: 'The fuller the store gets, the longer each shopper waits, and the wait grows faster and faster. The **wait queue** gets long near the end.',
      body: [
        'With one worker and random arrivals, mean time in the system is about `service time / (1 − utilization)`. With 40 ms of work: 80 ms at 50% busy, 200 ms at 80%, 400 ms at 90%, **800 ms at 95%**. With many workers the curve is milder, but it keeps the same shape.',
        'Here p99 is about 4.6 times the mean: at 95% busy, p50 near 550 ms and p99 near 3,700 ms.',
      ],
      keyIdea: 'The last 10% of capacity costs most of your latency.',
      metrics: { mean: '800 ms', p50: '550 ms', p99: '3,700 ms', util: '95%' },
      metricTones: { mean: 'bad', p50: 'bad', p99: 'bad', util: 'bad' },
      scene: {
        nodes: [
          { ...queue, status: 'hot', chips: ['growing'] },
          { ...app, status: 'hot', sub: '1 worker', load: 95 },
          { ...mon, at: at(-5.4, 0), label: 'delay', sub: '40 ms / (1 − u)', status: 'active' },
        ],
        links: [link('queue', 'app')],
        flows: [{ path: ['queue', 'app'], tone: 'request', count: 4, duration: 2.2 }],
        panel: {
          title: 'One worker, 40 ms of work',
          icon: 'TrendingUp',
          rows: [
            { text: '50% busy', value: '80 ms', tone: 'good' },
            { text: '80% busy', value: '200 ms' },
            { text: '90% busy', value: '400 ms', tone: 'warn' },
            { text: '95% busy', value: '800 ms', tone: 'bad' },
            { text: '99% busy', value: '4,000 ms', tone: 'bad' },
          ],
        },
        caption: 'Waiting time bends upward near full',
      },
      code: {
        language: 'python',
        title: 'Time in system for one worker with random arrivals',
        source: `SERVICE_MS = 40    # time to serve one request with no waiting

def time_in_system(utilization):
    # Single worker, random arrivals: delay grows as 1 / (1 - utilization)
    return SERVICE_MS / (1 - utilization)

for u in (0.50, 0.80, 0.90, 0.95, 0.99):
    print(f"{u:.0%} busy -> {time_in_system(u):5.0f} ms")

# 50% busy ->    80 ms
# 80% busy ->   200 ms
# 90% busy ->   400 ms
# 95% busy ->   800 ms
# 99% busy ->  4000 ms`,
        highlight: [5, 12, 13, 14],
      },
    },
    {
      title: 'The cliff',
      tag: 'case',
      heading: 'A sale email pushes one lane from 75% to 95% busy',
      eli5: 'A flyer brings in more shoppers. The lanes can still serve everyone on paper, yet the line outside the door grows. The **wait queue** and the **checkout API** are both full.',
      body: [
        'Take one worker with 40 ms of work, so 25 requests per second is full. More workers flatten the curve, and the wall near 100% stays. A sale email lifts traffic from 19 to 24.',
        'Throughput looks fine, since 24 is under 25. Latency falls off a cliff: the mean goes from 160 ms to 800 ms.',
      ],
      keyIdea: 'A small traffic increase near full capacity causes a large latency increase.',
      metrics: { mean: '800 ms', p50: '550 ms', p99: '3,700 ms', util: '95%' },
      metricTones: { mean: 'bad', p50: 'bad', p99: 'bad', util: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '24 req/s', chips: [{ text: 'sale email', tone: 'warn' }] },
          { ...queue, status: 'hot', chips: [{ text: 'growing', tone: 'bad' }] },
          { ...app, status: 'hot', sub: '1 worker', load: 95, chips: [{ text: '800 ms', tone: 'bad' }] },
        ],
        links: [link('users', 'queue', { label: '19 to 24 req/s', labelTone: 'warn' }), link('queue', 'app')],
        flows: [
          { path: ['users', 'queue'], tone: 'request', count: 8, duration: 0.9 },
          { path: ['queue', 'app'], tone: 'request', count: 3, duration: 2.2, delay: 0.9 },
          { path: ['app', 'users'], tone: 'error', label: '800 ms', count: 2, duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Before and after the email',
          icon: 'Mail',
          rows: [
            { text: 'Traffic', value: '19 to 24 req/s', tone: 'warn' },
            { text: 'Utilization', value: '75% to 95%', tone: 'bad' },
            { text: 'Mean latency', value: '160 to 800 ms', tone: 'bad' },
            { text: 'Throughput check', value: 'looks fine', tone: 'good' },
          ],
        },
        caption: 'Requests wait for a free worker',
      },
    },
    {
      title: 'Shed load',
      tag: 'tradeoff',
      heading: 'Reject some requests so the accepted ones stay fast',
      eli5: 'When the line outside the door gets long, a doorman turns people away politely. Those who get in are served quickly. The **wait queue** stops growing.',
      body: [
        '**Load shedding.** Cap the queue. When it is full, reject new requests at once, or time out any that waited too long. With one worker and 40 ms of work, a limit of 10 waiting means an accepted request waits at most `10 × 40 = 400 ms`, plus its own 40 ms.',
        'Rejected clients get a fast answer. **Backpressure** pushes the same signal upstream so callers slow down. Some users are turned away, so set the limit from your p99 target.',
      ],
      keyIdea: 'A bounded queue trades some rejected requests for a latency ceiling on the rest.',
      metrics: { mean: '-', p50: '-', p99: '< 450 ms', util: '95%' },
      metricTones: { p99: 'good', util: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '24 req/s' },
          { ...queue, status: 'active', chips: [{ text: 'limit: 10 waiting', tone: 'good' }] },
          { ...app, status: 'hot', sub: '1 worker', load: 95 },
        ],
        links: [link('users', 'queue'), link('queue', 'app')],
        flows: [
          { path: ['users', 'queue'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['queue', 'app'], tone: 'request', count: 2, duration: 1.8, delay: 0.9 },
          { path: ['queue', 'users'], tone: 'error', label: 'rejected, try later', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'Queue limit versus latency',
          icon: 'Scale',
          rows: [
            { text: 'No limit, 95% busy', value: 'mean 800 ms, growing', tone: 'bad' },
            { text: 'Limit 10 waiting', value: 'wait at most 400 ms', tone: 'warn' },
            { text: 'Limit 5 waiting', value: 'wait at most 200 ms', tone: 'good' },
            { text: 'Over the limit', value: 'rejected fast', tone: 'warn' },
          ],
          footer: { text: 'A lower limit means faster answers and more rejections', tone: 'muted' },
        },
        caption: 'A full queue turns requests away instead of making them wait',
      },
    },
    {
      title: 'Histograms',
      tag: 'concept',
      heading: 'Servers keep histograms, not every request',
      eli5: 'The **dashboard** does not write down every shopper. It keeps tally marks: how many waited up to a minute, up to two, up to five. From the tally you can read the wait times.',
      body: [
        'Servers keep a **histogram**: counters for buckets such as "up to 50 ms" and "up to 100 ms", not every request time.',
        'To read one, add the counts up: 9,000 / 9,600 / 9,850 / 9,970. With 10,000 requests, p50 is request 5,000, inside the first bucket. p99 is request 9,900, which falls in the up to 1,000 ms bucket.',
        'Narrow buckets near your target (around 500 ms for a 500 ms SLO) give a sharper estimate than wide ones.',
      ],
      keyIdea: 'A histogram of bucket counts is small and still lets you estimate any percentile.',
      metrics: { mean: '-', p50: '< 50 ms', p99: '< 1,000 ms', util: '-' },
      scene: {
        nodes: [
          { ...app, status: 'active', sub: 'handler timer' },
          { ...mon, at: at(-1.8, 0), status: 'active', label: 'histogram', sub: 'bucket counters' },
          { ...b40, at: at(5.4, 0), label: '<= 50 ms', sub: 'count: 9,000', tint: 'green' },
        ],
        links: [link('app', 'mon', { label: 'bucket +1', style: 'dashed' }), link('mon', 'b40', { style: 'faint' })],
        flows: [{ path: ['app', 'mon'], tone: 'data', label: 'bucket +1', count: 3, duration: 1.4 }],
        panel: {
          title: 'Latency buckets',
          icon: 'Table',
          rows: [
            { text: 'up to 50 ms', value: '9,000 (total 9,000)' },
            { text: 'up to 100 ms', value: '600 (total 9,600)' },
            { text: 'up to 250 ms', value: '250 (total 9,850)' },
            { text: 'up to 1,000 ms', value: '120 (total 9,970)', tone: 'warn' },
            { text: 'over 1,000 ms', value: '30 (total 10,000)', tone: 'bad' },
          ],
          footer: { text: 'p99 is request 9,900, in the up to 1,000 ms bucket', tone: 'muted' },
        },
        caption: 'Counters per bucket, not one row per request',
      },
    },
    {
      title: 'Add buckets',
      tag: 'concept',
      heading: 'Add buckets across servers, never percentiles',
      eli5: 'Two shops each report their slowest-shopper wait. You cannot average those to get the chain\'s wait. You need to pool all the shoppers first. The **dashboard** pools the tally marks.',
      body: [
        'Buckets from many servers can be added together. Percentiles cannot. If server A reports p99 = 100 ms and server B reports p99 = 2 s, their average means nothing.',
        'Sum the buckets across servers first, then compute p99 once. Also check the sample count: with 100 samples, p99 is about the second-slowest value and swings a lot. 100 is the minimum for p99 to differ from the max, and thousands give a stable estimate.',
      ],
      keyIdea: 'Aggregate buckets before taking a percentile. An average of percentiles is wrong.',
      metrics: { mean: '-', p50: '-', p99: '-', util: '-' },
      scene: {
        nodes: [
          { ...app, at: at(-5.4, -3.6), label: 'server A', sub: 'p99 100 ms', id: 'app' },
          { ...app, id: 'appb', at: at(-5.4, 3.6), label: 'server B', sub: 'p99 2 s' },
          { ...mon, at: at(1.8, 0), status: 'active', label: 'dashboard', sub: 'sum buckets' },
        ],
        links: [link('app', 'mon', { label: 'buckets' }), link('appb', 'mon', { label: 'buckets' })],
        flows: [
          { path: ['app', 'mon'], tone: 'data', label: 'bucket counts', duration: 1.6 },
          { path: ['appb', 'mon'], tone: 'data', label: 'bucket counts', duration: 1.6 },
        ],
        panel: {
          title: 'Right and wrong',
          icon: 'Scale',
          rows: [
            { text: 'Average the two p99s', value: '1,050 ms', tone: 'bad' },
            { text: 'Sum buckets, then p99', value: 'true p99', tone: 'good' },
            { text: 'Samples for a stable p99', value: 'thousands (100 minimum)', tone: 'muted' },
          ],
        },
        caption: 'Pool the counts, then read the percentile',
      },
      code: {
        language: 'yaml',
        title: 'Prometheus rule: p99 from histogram buckets across all servers',
        source: `groups:
  - name: checkout-latency
    rules:
      - record: checkout:latency_seconds:p99
        expr: |
          histogram_quantile(
            0.99,
            sum by (le) (
              rate(http_request_duration_seconds_bucket{service="checkout"}[5m])
            )
          )`,
        highlight: [6, 7, 8, 9],
      },
    },
    {
      title: 'User side',
      tag: 'concept',
      heading: 'Time requests from where the user stands',
      eli5: 'To know how long people wait, start the clock when they join the line. Starting it at the cashier misses the wait. The **dashboard** should count from the door.',
      body: [
        'A timer inside the handler starts after the request has already sat in the queue, so it reports 40 ms while the user waited 800. Time it at the load balancer or the client too.',
      ],
      keyIdea: 'Measure from outside the server, because the handler timer cannot see queue time.',
      metrics: { mean: '800 ms', p50: '550 ms', p99: '3,700 ms', util: '95%' },
      metricTones: { mean: 'bad' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: 'felt: 800 ms', tone: 'bad' }] },
          { ...queue, status: 'hot', chips: [{ text: '760 ms waiting', tone: 'bad' }] },
          { ...app, status: 'active', sub: '1 worker', chips: [{ text: 'handler: 40 ms', tone: 'good' }] },
          { ...mon, at: at(-1.8, 6.6), status: 'active', badge: 'time it here too' },
        ],
        links: [...queueLinks.slice(0, 2), link('queue', 'mon', { style: 'dashed', label: 'time it here' })],
        flows: [
          { path: ['users', 'queue', 'app'], tone: 'request', count: 3, duration: 2 },
          { path: ['queue', 'mon'], tone: 'data', label: 'bucket +1', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Two clocks, one request',
          icon: 'Timer',
          rows: [
            { text: 'Handler timer', value: '40 ms', tone: 'good' },
            { text: 'Queue wait it misses', value: '760 ms', tone: 'bad' },
            { text: 'What the user felt', value: '800 ms', tone: 'bad' },
          ],
        },
        caption: 'The handler timer misses the time spent in the queue',
      },
    },
    {
      title: 'Load testing',
      tag: 'concept',
      heading: 'A load test that waits for replies hides the slow moments',
      eli5: 'A pollster who waits for each person to finish talking before asking the next skips everyone who would have queued during a long answer. The **load tool** must keep asking on schedule.',
      body: [
        'A closed-loop tool sends a request, waits for the reply, then sends the next. When the server stalls, the tool stops sending, so the stall is recorded as one slow sample. This is called **coordinated omission**.',
        'A fixed-rate tool sends on a schedule and measures from the planned send time. Plan 10 requests per second for 100 seconds, with a 5 second stall. Closed loop sees 1 slow sample in 951. Fixed rate sees 50 of 1,000 delayed, and p99 near 4.8 s.',
      ],
      keyIdea: 'Load test at a fixed rate and time from the planned send, or the tail disappears from your results.',
      metrics: { mean: '-', p50: '-', p99: '4.8 s', util: '-' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...users, label: 'load tool', sub: '10 req/s planned', status: 'active' },
          { ...app, status: 'hot', sub: '5 s stall', chips: [{ text: 'stalls', tone: 'bad' }] },
          { ...mon, at: at(-1.8, 4.2), status: 'active', label: 'results' },
        ],
        links: [link('users', 'app'), link('app', 'mon', { style: 'faint' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 4, label: 'on schedule', duration: 1.4 },
          { path: ['app', 'mon'], tone: 'data', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Same stall, two tools',
          icon: 'Table',
          rows: [
            { text: 'Closed loop: slow samples', value: '1 of 951', tone: 'good' },
            { text: 'Closed loop: p99', value: '~100 ms', tone: 'good' },
            { text: 'Fixed rate: delayed samples', value: '50 of 1,000', tone: 'bad' },
            { text: 'Fixed rate: p99', value: '~4.8 s', tone: 'bad' },
          ],
          footer: { text: 'Coordinated omission hides the stall', tone: 'warn' },
        },
        caption: 'Waiting for replies skips the requests that would have queued',
      },
    },
    {
      title: 'Headroom',
      tag: 'tradeoff',
      heading: 'Pay for idle servers to keep p99 low',
      eli5: 'Open more lanes than you need so nobody waits. Some lanes sit empty and that costs money. Empty lanes are what keep the line short. The **checkout API** gets six extra workers.',
      body: [
        '**Headroom.** Run at 60% to 70% utilization instead of 95%, so random clumps find a free worker. You pay for servers that look idle. That idle capacity is what keeps p99 low.',
        'Here 30 workers at 150 requests per second is `150 × 0.12 / 30 = 60%` busy. With short queues, p99 drops to about 400 ms (illustrative figure).',
      ],
      keyIdea: 'Spare capacity is the price of a short queue.',
      metrics: { mean: '105 ms', p50: '40 ms', p99: '400 ms', util: '60%' },
      metricTones: { mean: 'good', p99: 'good', util: 'good' },
      scene: {
        nodes: [
          { ...users, status: 'ok', chips: ['150 req/s'] },
          { ...queue, status: 'ok', chips: ['empty'] },
          { ...app, status: 'ok', sub: '30 workers', load: 60 },
        ],
        links: [link('users', 'queue'), link('queue', 'app')],
        flows: [
          { path: ['users', 'queue', 'app'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['app', 'users'], tone: 'response', count: 4, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: '24 workers versus 30 workers',
          icon: 'Server',
          rows: [
            { text: '24 workers at 190 req/s', value: '95% busy', tone: 'bad' },
            { text: '30 workers at 150 req/s', value: '60% busy', tone: 'good' },
            { text: 'Cost', value: '+6 workers', tone: 'warn' },
          ],
        },
        caption: 'Spare workers keep the queue empty',
      },
    },
    {
      title: 'Hedging',
      tag: 'tradeoff',
      heading: 'Send a backup request when the first is slow',
      eli5: 'If a shopper has stood too long in one lane, let them also try a second lane and pay at whichever is free first. The **checkout API** does the same.',
      body: [
        '**Hedged requests.** If a call has not answered by the p95 time (200 ms here), send a second copy to another server and take whichever returns first. Only 5% of calls trigger a backup, so load rises about 5% and p99 drops from 400 ms to about 240 ms (p95 plus a 40 ms reply).',
        'It works for random delays (GC, packet loss, a busy node), not for slow work caused by the request itself, like a big cart. The backup is slow too.',
        'Use it only for safe-to-repeat calls, with a **timeout**.',
      ],
      keyIdea: 'A backup request after the p95 time trims the tail for about 5% extra load. Use it for safe-to-repeat calls only.',
      metrics: { mean: '95 ms', p50: '40 ms', p99: '240 ms', util: '60%' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...db, status: 'active', chips: [{ text: 'hedge after 200 ms', tone: 'good' }] },
          { ...db, id: 'db2', at: at(5.4, 5.6), label: 'replica', kind: 'replica', status: 'ok' },
        ],
        links: [link('app', 'db', { label: 'first try' }), link('app', 'db2', { label: 'backup copy' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'first try', duration: 2.4 },
          { path: ['app', 'db2', 'app'], tone: 'handshake', label: 'backup copy', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'Hedge after the p95',
          icon: 'Copy',
          rows: [
            { text: 'Calls that need a backup', value: '5%' },
            { text: 'Extra load', value: '+5%', tone: 'warn' },
            { text: 'p99 before', value: '400 ms', tone: 'warn' },
            { text: 'p99 after', value: '~240 ms', tone: 'good' },
          ],
        },
        caption: 'The backup answers while the first is still stuck',
      },
    },
    {
      title: 'Less fan-out',
      tag: 'tradeoff',
      heading: 'Remove calls to remove chances of a slow one',
      eli5: 'Fewer friends sent to fewer lanes means fewer chances that one lane is slow. If the review lane is slow, leave without the reviews. The **page API** can do that.',
      body: [
        'Every parallel call you remove, cache or make optional is one fewer chance to hit the tail. Show the page without reviews if reviews are slow.',
        'A deadline for the whole page helps too: answer with what has arrived at 250 ms and fill in the rest later.',
      ],
      keyIdea: 'Fewer dependencies on the critical path means fewer chances to meet the tail.',
      metrics: { mean: '95 ms', p50: '40 ms', p99: '240 ms', util: '60%' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...page, sub: '3 required', status: 'ok' },
          { ...s1, status: 'ok', chips: ['40 ms'] },
          { ...s2, status: 'ok', chips: ['40 ms'] },
          { ...s3, status: 'dim', chips: [{ text: 'optional', tone: 'warn' }] },
        ],
        links: [link('page', 's1'), link('page', 's2'), link('page', 's3', { style: 'dashed' })],
        flows: [
          { path: ['page', 's1', 'page'], tone: 'response', duration: 1.2 },
          { path: ['page', 's2', 'page'], tone: 'response', duration: 1.2 },
          { path: ['page', 's3'], tone: 'request', label: 'skip if slow', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Page that never waits on reviews',
          icon: 'Split',
          rows: [
            { text: 'Required calls', value: '3 of 10', tone: 'good' },
            { text: 'Optional calls', value: 'cut at 250 ms', tone: 'warn' },
            { text: 'Slow reviews', value: 'page still ships', tone: 'good' },
          ],
        },
        caption: 'The page ships without the slow optional call',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Report percentiles, watch utilization',
      eli5: 'Do not ask "how long is the average wait?". Ask "how long did the unluckiest shoppers wait, and are the lanes too full?". The **dashboard** now shows both.',
      body: [
        'The mean said 120 ms while 90% of requests took 40 ms and one took 5 seconds. **p50** shows the typical request, **p99** shows the tail, and the tail reaches many users: 18% of 20-request sessions and about 10% of pages that fan out to 10 services.',
        '**Throughput** is requests per second and **latency** is time per request. Near 100% utilization, queueing delay grows like `1 / (1 − utilization)`, so plan headroom. Add histogram buckets before computing percentiles, and time requests from the user side.',
      ],
      keyIdea: 'Describe latency with p50 and p99, never the mean alone, and keep utilization low enough that queues stay short.',
      metrics: { mean: '95 ms', p50: '40 ms', p99: '240 ms', util: '60%' },
      metricTones: { mean: 'good', p50: 'good', p99: 'good', util: 'good' },
      scene: {
        nodes: [users, { ...app, status: 'ok', sub: '30 workers', load: 60 }, db, { ...mon, status: 'ok', badge: 'p50 40 · p99 240' }],
        links: [...baseLinks, link('app', 'mon', { style: 'faint' })],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 4, duration: 1.2, delay: 1.3 },
          { path: ['app', 'mon'], tone: 'data', duration: 1, delay: 1.3 },
        ],
        panel: {
          title: 'On the dashboard now',
          icon: 'Activity',
          rows: [
            { text: 'p50', value: '40 ms', tone: 'good' },
            { text: 'p99', value: '240 ms', tone: 'good' },
            { text: 'Utilization', value: '60 to 65%', tone: 'good' },
          ],
          footer: { text: 'Two percentiles and a utilization number', tone: 'good' },
        },
        caption: 'Two numbers on the dashboard instead of one',
      },
      quiz: {
        question: 'A service runs at 90% utilization with a 400 ms mean. Traffic grows 5%. Using the single-worker rule of thumb (40 ms of work per request), what happens to the mean?',
        options: [
          'It rises about 5%, to 420 ms',
          'It stays at 400 ms until utilization reaches 100%',
          'It roughly doubles, because delay grows like 1 / (1 − utilization)',
          'It drops, because busier servers have warmer caches',
        ],
        answer: 2,
        explain: 'Utilization goes from 90% to about 95%. 40 / (1 − 0.90) = 400 ms and 40 / (1 − 0.95) = 800 ms. Near full, a small traffic increase causes a large latency increase.',
      },
    },
  ],
};
