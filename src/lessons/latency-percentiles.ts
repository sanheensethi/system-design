import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];

const users: SceneNode = { id: 'users', kind: 'client', at: p(-7.5, 0), label: 'shoppers', sub: '150 req/s' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: p(-4.5, 0), label: 'wait queue' };
const app: SceneNode = { id: 'app', kind: 'server', at: p(-1, 0), label: 'checkout API', sub: '8 workers' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(2.5, 0), label: 'orders DB' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: p(6, 0), label: 'dashboard' };

const b40: SceneNode = { id: 'b40', kind: 'storage', at: p(-5.5, 6.5), label: '40 ms', sub: 'requests 1 to 90' };
const b200: SceneNode = { id: 'b200', kind: 'storage', at: p(-2.5, 6.5), label: '200 ms', sub: 'requests 91 to 95' };
const b600: SceneNode = { id: 'b600', kind: 'storage', at: p(0.5, 6.5), label: '600 ms', sub: 'requests 96 to 99' };
const b5000: SceneNode = { id: 'b5000', kind: 'storage', at: p(3.5, 6.5), label: '5,000 ms', sub: 'request 100' };

const page: SceneNode = { id: 'page', kind: 'gateway', at: p(-4.5, 0), label: 'page API', sub: 'waits for all 10' };
const s1: SceneNode = { id: 's1', kind: 'service', at: p(-1, -3), label: 'pricing' };
const s2: SceneNode = { id: 's2', kind: 'service', at: p(2, -1), label: 'stock' };
const s3: SceneNode = { id: 's3', kind: 'service', at: p(5, 1), label: 'reviews' };
const s4: SceneNode = { id: 's4', kind: 'service', at: p(8, 3), label: '7 more', sub: 'services' };

const baseLinks: SceneLink[] = [
  { from: 'users', to: 'app' },
  { from: 'app', to: 'db' },
];
const monLink: SceneLink = { from: 'db', to: 'mon', style: 'faint' };
const bucketLinks: SceneLink[] = [
  { from: 'app', to: 'b40', style: 'faint' },
  { from: 'app', to: 'b200', style: 'faint' },
  { from: 'app', to: 'b600', style: 'faint' },
  { from: 'app', to: 'b5000', style: 'faint' },
];
const fanLinks: SceneLink[] = [
  { from: 'users', to: 'page' },
  { from: 'page', to: 's1' },
  { from: 'page', to: 's2' },
  { from: 'page', to: 's3' },
  { from: 'page', to: 's4' },
];
const queueLinks: SceneLink[] = [
  { from: 'users', to: 'queue' },
  { from: 'queue', to: 'app' },
  { from: 'app', to: 'db' },
];

export const latencyPercentiles: Lesson = {
  id: 'latency-percentiles',
  title: 'Latency, throughput and percentiles',
  tagline: 'Why the average hides your slowest users, and how p50, p95 and p99 show what people feel.',
  minutes: 13,
  level: 'Beginner',
  learn: [
    'Why a mean latency can describe no real request',
    'How to read p50, p95 and p99, and compute them',
    'Why the slow tail reaches far more users than 1%, and how fan-out makes it worse',
    'The difference between latency and throughput',
    'Why waiting time explodes as a server gets close to full',
    'How to measure latency without fooling yourself',
  ],
  metrics: [
    { key: 'mean', label: 'Mean' },
    { key: 'p50', label: 'p50' },
    { key: 'p99', label: 'p99' },
    { key: 'util', label: 'Utilization' },
  ],
  steps: [
    {
      title: 'Average lies',
      tag: 'problem',
      heading: 'The dashboard says 120 ms. Users say 5 seconds.',
      eli5: 'At the supermarket, most people pay in one minute. One person waits twenty. The sign says "average wait: two minutes", and that person does not believe the sign. The **dashboard** is that sign.',
      body: [
        'The checkout API has one number on its dashboard: **average latency 120 ms**. It has been green for months. Support keeps getting tickets that say "checkout hung for five seconds".',
        'Both are true. **Latency** is the time from sending a request to getting the full response. Most checkouts finish in 40 ms. A few hit a slow query, a lock or a garbage collection pause and take seconds.',
        'An average squashes those two groups into one number that matches neither. To see what users feel, we need to look at the whole spread of response times.',
      ],
      keyIdea: 'A mean latency can look healthy while a real group of users has a terrible time.',
      metrics: { mean: '120 ms', p50: '-', p99: '-', util: '75%' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, db, { ...mon, status: 'ok', badge: 'avg 120 ms' }],
        links: [...baseLinks, monLink],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 4, label: '40 ms', duration: 1.2, delay: 1.3 },
          { path: ['db', 'app', 'users'], tone: 'error', label: '5,000 ms', duration: 4, delay: 2.8 },
        ],
        caption: 'One green number, two very different experiences',
      },
    },
    {
      title: 'Sort them',
      tag: 'concept',
      heading: 'Line up 100 requests from fastest to slowest',
      eli5: 'Line up 100 shoppers by how long they waited. Ninety waited one minute. Five waited longer, four waited much longer, and one waited ages. The **buckets** are those groups standing in line.',
      body: [
        'Take 100 real checkout requests and sort them by time. **90** took 40 ms. **5** took 200 ms. **4** took 600 ms. **1** took 5,000 ms.',
        'The mean is `(90 × 40 + 5 × 200 + 4 × 600 + 5,000) / 100 = 120 ms`. Yet 90 requests were three times faster than 120 ms and 10 were slower. No request took anything close to the mean.',
        'This shape is normal. Latency has a hard floor (the work itself) and no ceiling, so the distribution has a long **tail** to the right. A handful of slow requests drag the mean up and tell you nothing about where they are.',
      ],
      keyIdea: 'Latency is a skewed distribution with a long slow tail. Look at the sorted list, never just the mean.',
      metrics: { mean: '120 ms', p50: '-', p99: '-', util: '75%' },
      scene: {
        nodes: [
          users,
          { ...app, status: 'active', badge: 'mean 120 ms' },
          { ...b40, status: 'ok', badge: '90 requests' },
          { ...b200, badge: '5 requests' },
          { ...b600, status: 'active', badge: '4 requests' },
          { ...b5000, status: 'hot', badge: '1 request' },
        ],
        links: [{ from: 'users', to: 'app' }, ...bucketLinks],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'b40'], tone: 'response', count: 6, duration: 1.2, delay: 1 },
          { path: ['app', 'b200'], tone: 'response', count: 2, duration: 1.4, delay: 1.6 },
          { path: ['app', 'b600'], tone: 'response', duration: 1.6, delay: 2.2 },
          { path: ['app', 'b5000'], tone: 'error', duration: 2.4, delay: 2.8 },
        ],
        caption: '100 requests sorted from fastest to slowest',
      },
    },
    {
      title: 'Percentiles',
      tag: 'concept',
      heading: 'p50, p95, p99: pick a position in the line',
      eli5: 'Walk down the line of 100 shoppers. Shopper 50 shows a normal wait. Shopper 99 shows a bad wait that still happens every day. Each **bucket** in the picture holds one of them.',
      body: [
        'A **percentile** is a position in the sorted list. **p50** (the median) is request 50: half were at or below it. Here p50 is 40 ms. That is the typical experience.',
        '**p95** is request 95: 200 ms. **p99** is request 99: 600 ms. Read p99 as "1 request in 100 is slower than this". The single worst request, 5,000 ms, is the **max**.',
        'Now the dashboard can tell the truth with three numbers. p50 says what most people get. p99 says how bad it gets for the unlucky. Teams set targets on p99, because fixing the tail is where the complaints go away.',
      ],
      keyIdea: 'p50 is the typical request. p99 is the experience of the unlucky 1 in 100, and it is the number to set targets on.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...app, badge: 'mean 120 ms' },
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
      title: 'Tails matter',
      tag: 'concept',
      heading: '"Only 1%" reaches far more than 1% of users',
      eli5: 'If you visit the supermarket 20 times, you will probably get stuck behind the slow shopper at least once. The **shoppers** who come most often get stuck most often.',
      body: [
        'A user does not make one request. A checkout session makes about 20: cart, address, shipping options, payment, confirmation. The chance that all 20 beat p99 is `0.99^20 = 82%`. So **18% of sessions** hit at least one 600 ms or slower request.',
        'At 150 requests per second, the slowest 1% is 1.5 requests every second, about 130,000 a day. That is a lot of people.',
        'The tail also picks its victims badly. Slow requests tend to belong to the users with the biggest carts and the longest order histories, because their queries touch more rows. Your best customers get your worst latency.',
      ],
      keyIdea: 'Users make many requests, so a 1% slow tail touches a large share of sessions, often your heaviest users.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...users, status: 'hot', badge: '18% of sessions hit' },
          { ...app, status: 'active', badge: '20 requests each' },
          { ...db, status: 'hot', badge: 'big cart: 600 ms' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 4, duration: 1.2, delay: 1.3 },
          { path: ['db', 'app', 'users'], tone: 'error', label: 'slow one', duration: 3, delay: 2.6 },
        ],
        caption: '20 requests per session, 1 in 100 slow',
      },
    },
    {
      title: 'Fan-out',
      tag: 'concept',
      heading: 'Fan-out turns a rare slow call into a common slow page',
      eli5: 'A shopper sends ten friends to ten checkout lanes and can only leave when the last friend is done. One slow lane holds up the whole group. The **page API** is that shopper waiting for everyone.',
      body: [
        'The product page calls **10 backend services** in parallel: pricing, stock, reviews and seven more. The page is ready only when the slowest one answers.',
        'Say each service has the same p99 of 600 ms. The chance that all ten are faster is `0.99^10 = 90.4%`. So **9.6% of page loads** wait on at least one p99-slow call. A 1-in-100 event became a 1-in-10 event.',
        'With 100 backend calls it is `1 − 0.99^100 = 63%`. At that point the p99 of a single service is the normal page experience. This is why large systems care about p99 and even p99.9 of every internal service.',
      ],
      keyIdea: 'A request that fans out to N services is as slow as the slowest one, so backend tail latency becomes front-end typical latency.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...users, sub: 'load product page' },
          { ...page, status: 'hot', badge: '9.6% of pages slow' },
          { ...s1, status: 'ok', badge: '40 ms' },
          { ...s2, status: 'ok', badge: '40 ms' },
          { ...s3, status: 'hot', badge: '600 ms' },
          { ...s4, status: 'ok', badge: '40 ms each' },
        ],
        links: fanLinks,
        flows: [
          { path: ['users', 'page'], tone: 'request', duration: 0.8 },
          { path: ['page', 's1', 'page'], tone: 'response', duration: 1.2, delay: 0.9 },
          { path: ['page', 's2', 'page'], tone: 'response', duration: 1.2, delay: 0.9 },
          { path: ['page', 's4', 'page'], tone: 'response', duration: 1.2, delay: 0.9 },
          { path: ['page', 's3', 'page'], tone: 'error', label: 'still waiting', duration: 3.6, delay: 0.9 },
          { path: ['page', 'users'], tone: 'response', duration: 0.8, delay: 4.6 },
        ],
        caption: 'The page waits for the slowest of 10 calls',
      },
      quiz: {
        question: 'A page calls 10 services in parallel. Each has a p99 of 600 ms. Roughly what share of page loads wait 600 ms or more on at least one call?',
        options: ['1%', 'About 10%', 'About 50%', '0.1%'],
        answer: 1,
        explain: 'All ten must be fast: 0.99^10 is about 90%. The other 10% of page loads hit at least one slow call. Fan-out multiplies the tail.',
      },
    },
    {
      title: 'Throughput',
      tag: 'concept',
      heading: 'Throughput is a different number from latency',
      eli5: 'How long one shopper takes to pay is one number. How many shoppers the whole **checkout** gets through in an hour is another. Eight lanes get more people through, yet each person still takes a minute.',
      body: [
        '**Throughput** is how much work finishes per second, in requests per second. Latency is how long one request takes. They are related, and they are different questions.',
        'The checkout API has 8 workers. Each request needs 40 ms of a worker, so one worker finishes 25 per second and the server tops out at `8 × 25 = 200 requests per second`. Adding workers raises throughput. It does nothing for the 40 ms.',
        'Some changes trade one for the other. Batching 50 database writes into one round trip raises throughput, and each write now waits for its batch to fill, so latency goes up. Always say which of the two you are optimizing.',
      ],
      keyIdea: 'Latency is time per request. Throughput is requests per second. More parallel workers raise throughput without making any single request faster.',
      metrics: { mean: '120 ms', p50: '40 ms', p99: '600 ms', util: '75%' },
      scene: {
        nodes: [
          { ...users, badge: '150 req/s arriving' },
          { ...queue, badge: 'empty' },
          { ...app, status: 'ok', badge: 'max 200 req/s' },
          db,
        ],
        links: queueLinks,
        flows: [
          { path: ['users', 'queue', 'app'], tone: 'request', count: 6, duration: 1.4 },
          { path: ['app', 'db', 'app'], tone: 'request', count: 6, duration: 1, delay: 1.4 },
          { path: ['app', 'users'], tone: 'response', count: 6, duration: 1.2, delay: 2.4 },
        ],
        caption: '150 arrive, 200 can be served: 75% utilized',
      },
    },
    {
      title: 'Queueing',
      tag: 'concept',
      heading: 'Near full, waiting time explodes',
      eli5: 'When the lanes are half empty, you walk straight up. When they are almost always busy, one slow shopper makes a line, and the **wait queue** never gets a quiet moment to clear.',
      body: [
        '**Utilization** is the share of time the workers are busy: 150 of 200 requests per second is 75%. Requests arrive in random clumps, so even below 100% some arrive while every worker is busy and must wait in a queue.',
        'For a single worker with random arrivals, the average time in the system is about `service time / (1 − utilization)`. With 40 ms of work: 80 ms at 50% busy, 200 ms at 80%, 400 ms at 90%, **800 ms at 95%**. In that model p99 is about 4.6 times the mean.',
        'More workers flatten the early part of the curve, and the wall near 100% stays. A sale email pushes traffic from 150 to 190 requests per second. Throughput looks fine. Latency falls off a cliff.',
      ],
      keyIdea: 'Queueing delay grows like 1 / (1 − utilization). The last 10% of capacity costs most of your latency.',
      metrics: { mean: '800 ms', p50: '550 ms', p99: '3,700 ms', util: '95%' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '190 req/s', badge: 'sale email' },
          { ...queue, status: 'hot', badge: 'growing' },
          { ...app, status: 'hot', badge: '95% busy' },
          db,
        ],
        links: queueLinks,
        flows: [
          { path: ['users', 'queue'], tone: 'request', count: 8, duration: 0.9 },
          { path: ['queue', 'app'], tone: 'request', count: 3, duration: 2.2, delay: 0.9 },
          { path: ['app', 'db', 'app'], tone: 'request', count: 3, duration: 1, delay: 3.1 },
          { path: ['app', 'users'], tone: 'error', label: '800 ms', count: 2, duration: 1.4, delay: 4.1 },
        ],
        caption: 'Requests wait for a free worker',
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
      title: 'Measure it',
      tag: 'concept',
      heading: 'Measure with histograms, from where the user stands',
      eli5: 'To know how long people wait, start the clock when they join the line. Starting it at the cashier misses the wait. The **dashboard** should count how many shoppers fell in each waiting-time group.',
      body: [
        'Servers cannot keep every request time, so they keep a **histogram**: counters for buckets such as "up to 50 ms", "up to 100 ms", "up to 250 ms". Any percentile can be estimated from the bucket counts.',
        'Buckets from many servers can be added together. Percentiles cannot. If server A reports p99 = 100 ms and server B reports p99 = 2 s, their average means nothing. Sum the buckets first, then compute p99 once.',
        'Measure as close to the user as you can. A timer inside the handler starts after the request has already sat in the queue, so it reports 40 ms while the user waited 800. Time it at the load balancer or the client too. Load tests have the same trap: a tool that waits for each reply before sending the next request quietly skips the slow moments.',
      ],
      keyIdea: 'Record latency in histograms, aggregate buckets before taking percentiles, and time requests from outside the server.',
      metrics: { mean: '800 ms', p50: '550 ms', p99: '3,700 ms', util: '95%' },
      scene: {
        nodes: [
          { ...users, badge: 'felt: 800 ms' },
          { ...queue, status: 'hot', badge: '760 ms waiting' },
          { ...app, status: 'active', badge: 'handler: 40 ms' },
          db,
          { ...mon, status: 'active', badge: 'histogram buckets' },
        ],
        links: [...queueLinks, monLink, { from: 'queue', to: 'mon', style: 'dashed', label: 'time it here too' }],
        flows: [
          { path: ['users', 'queue', 'app'], tone: 'request', count: 3, duration: 2 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1, delay: 2 },
          { path: ['app', 'db', 'mon'], tone: 'data', label: 'bucket +1', duration: 1.4, delay: 3 },
          { path: ['queue', 'mon'], tone: 'data', label: 'bucket +1', duration: 1.4, delay: 3 },
        ],
        caption: 'The handler timer misses the time spent in the queue',
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
      title: 'Tame the tail',
      tag: 'tradeoff',
      heading: 'Three ways to cut the tail, each with a price',
      eli5: 'Open more lanes than you need so nobody waits. If a shopper has stood too long in one lane, let them try a second lane too and pay at whichever is free first. The **checkout API** does the same.',
      body: [
        '**Headroom.** Run at 60% to 70% utilization instead of 95%, so random clumps find a free worker. You pay for servers that look idle. That idle capacity is what keeps p99 low.',
        '**Timeouts and hedged requests.** If a call has not answered by the p95 time (200 ms here), send a second copy to another server and take whichever returns first. Only 5% of calls trigger a backup, so load rises about 5%, and p99 drops from 600 ms to about 240 ms. This is safe only for calls that can be repeated without side effects.',
        '**Less fan-out.** Every parallel call you remove, cache or make optional is one fewer chance to hit the tail. Show the page without reviews if reviews are slow.',
      ],
      keyIdea: 'Low tail latency is bought with spare capacity, duplicate work or fewer dependencies. Decide which price you are paying.',
      metrics: { mean: '58 ms', p50: '40 ms', p99: '240 ms', util: '65%' },
      scene: {
        nodes: [
          { ...users, badge: 'p99 240 ms' },
          { ...queue, status: 'ok', badge: 'empty' },
          { ...app, status: 'ok', sub: '10 workers', badge: '65% busy' },
          { ...db, status: 'active', badge: 'hedge after 200 ms' },
        ],
        links: queueLinks,
        flows: [
          { path: ['users', 'queue', 'app'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['app', 'db'], tone: 'request', label: 'first try', duration: 2.4, delay: 1.2 },
          { path: ['app', 'db', 'app'], tone: 'handshake', label: 'backup copy', duration: 1, delay: 2.4 },
          { path: ['app', 'users'], tone: 'response', count: 4, duration: 1.2, delay: 3.5 },
        ],
        caption: 'Spare workers and a backup request cut the tail',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Report percentiles, watch utilization',
      eli5: 'Do not ask "how long is the average wait?". Ask "how long did the unluckiest shoppers wait, and are the lanes too full?". The **dashboard** now shows both.',
      body: [
        'The mean said 120 ms while 90% of requests took 40 ms and one took 5 seconds. **p50** shows the typical request, **p99** shows the tail, and the tail reaches many users: 18% of 20-request sessions and about 10% of pages that fan out to 10 services.',
        '**Throughput** is requests per second and **latency** is time per request. As utilization nears 100%, queueing delay grows like `1 / (1 − utilization)`, so plan for headroom.',
        'Measure with histograms, add buckets before computing percentiles, and time requests from the user side. From here on, when a lesson shows a p99 chip, you know what it is counting.',
      ],
      keyIdea: 'Describe latency with p50 and p99, never the mean alone, and keep utilization low enough that queues stay short.',
      metrics: { mean: '58 ms', p50: '40 ms', p99: '240 ms', util: '65%' },
      scene: {
        nodes: [users, { ...app, status: 'ok', sub: '10 workers' }, db, { ...mon, status: 'ok', badge: 'p50 40 · p99 240' }],
        links: [...baseLinks, monLink],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['db', 'app', 'users'], tone: 'response', count: 4, duration: 1.2, delay: 1.3 },
          { path: ['db', 'mon'], tone: 'data', duration: 1, delay: 1.3 },
        ],
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
