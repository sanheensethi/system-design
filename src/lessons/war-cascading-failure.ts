import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const app: SceneNode = { id: 'app', kind: 'phone', at: at(-5.6, -3.8), label: 'rider app', sub: 'book a ride' };
const booking: SceneNode = { id: 'booking', kind: 'block', size: 0.8, at: at(-2.8, -1.9), label: 'booking', icon: 'Receipt', tint: 'blue' };
const pricing: SceneNode = { id: 'pricing', kind: 'block', size: 0.8, at: at(0, 0), label: 'pricing', icon: 'Scale', tint: 'amber' };
const matching: SceneNode = { id: 'matching', kind: 'block', size: 0.8, at: at(2.8, 1.9), label: 'matching', icon: 'Route', tint: 'violet' };
const driver: SceneNode = { id: 'driver', kind: 'block', size: 0.8, at: at(5.6, 3.8), label: 'driver-location', icon: 'Signal', tint: 'green' };
const dash: SceneNode = { id: 'dash', kind: 'monitor', at: at(-5.6, -3.8), label: 'dashboards', sub: 'service graph' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const chain = (extra: Partial<SceneLink> = {}) => [
  link('app', 'booking', extra),
  link('booking', 'pricing', extra),
  link('pricing', 'matching', extra),
  link('matching', 'driver', extra),
];
const ride = ['app', 'booking', 'pricing', 'matching', 'driver'];
const back = ['driver', 'matching', 'pricing', 'booking', 'app'];

export const warCascadingFailure: Lesson = {
  id: 'war-cascading-failure',
  title: 'Cascading microservice failure',
  tagline: 'One slow pod behind four services takes a ride-hailing app fully down on a Friday evening. An incident, start to finish.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'How one slow dependency turns into a total outage, and why slow is worse than dead',
    'Retry amplification across layers, and why scaling out feeds the storm',
    'Reading the service graph, pod metrics and a log query to find the loop',
    'Stopping the bleeding with a feature flag, then re-enabling retries safely',
    'Timeouts, circuit breakers, bulkheads, retry budgets and load shedding',
    'Follow-ups: library pinning, canaries and game days',
  ],
  metrics: [
    { key: 'err', label: 'Error rate', icon: 'Bug' },
    { key: 'p99', label: 'driver-location p99', icon: 'Timer' },
    { key: 'sat', label: 'driver-location load', icon: 'Gauge' },
    { key: 'calls', label: 'Calls per ride', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Normal state',
      tag: 'problem',
      heading: 'Friday 6:00 PM: a healthy chain of services',
      eli5: 'A restaurant kitchen runs as a chain. The **guest** tells the waiter, the waiter asks the price board, the price board asks the head cook, and the head cook asks the pantry keeper where the food is.',
      body: [
        'A ride-hailing app books a ride through four services in a row: **booking** calls **pricing**, pricing calls **matching**, and matching calls **driver-location** to find nearby drivers.',
        'Every call waits for the next one. Normal p99 on driver-location is **80 ms**, errors are near zero, and nobody is worried.',
      ],
      keyIdea: 'A chain of synchronous calls is only as healthy as its slowest link, and every link is waiting on the next.',
      metrics: { err: '0.1%', p99: '80 ms', sat: '35%', calls: '1 per ride' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          app,
          { ...booking, status: 'ok' },
          { ...pricing, status: 'ok' },
          { ...matching, status: 'ok' },
          { ...driver, status: 'ok', load: 35 },
        ],
        links: chain(),
        flows: [
          { path: ride, tone: 'request', label: 'book ride', duration: 3.2 },
          { path: back, tone: 'response', label: 'ok', duration: 3.2, delay: 3.4 },
        ],
        panel: {
          title: 'Friday 6:00 PM',
          icon: 'Activity',
          rows: [
            { text: 'Error rate', value: '0.1%', tone: 'good' },
            { text: 'driver-location p99', value: '80 ms', tone: 'good' },
            { text: 'driver-location CPU', value: '35%', tone: 'good' },
            { text: 'Deploys in last 48 h', value: '0', tone: 'muted' },
          ],
          footer: { text: 'All dashboards green', tone: 'good' },
        },
        caption: 'Four services, each waiting on the next',
      },
    },
    {
      title: 'The spark',
      tag: 'case',
      heading: 'A small spark: one pod gets slow',
      eli5: 'One pantry shelf has a sticky drawer. The pantry keeper still finds the food, but every trip takes a long time.',
      body: [
        'One **driver-location** pod falls into a slow garbage collection state. The cause is a memory leak that arrived with a library upgrade days earlier.',
        'The pod is not dead. It still answers, just very slowly. Health checks pass, so nothing removes it from rotation.',
        'The upgrade shipped to all pods, so every one carries the leak. The first pod to reach its heap limit is simply the first to slow down.',
      ],
      keyIdea: 'The trigger was tiny. A leak in one pod is routine. What matters is how the rest of the system responds.',
      metrics: { err: '0.2%', p99: '900 ms', sat: '48%', calls: '1 per ride' },
      metricTones: { err: 'good', p99: 'warn', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'ok' },
          { ...driver, status: 'active', load: 48, badge: 'leaking pod', chips: [{ text: 'GC pause 800 ms', tone: 'warn' }] },
        ],
        links: [link('matching', 'driver')],
        flows: [
          { path: ['matching', 'driver'], tone: 'request', label: 'nearby drivers?', duration: 1.2 },
          { path: ['driver', 'matching'], tone: 'response', label: 'slow reply', duration: 2.4, delay: 1.3 },
        ],
        panel: {
          title: 'driver-location pod 17',
          icon: 'Cpu',
          code: 'gc: pause 812 ms\ngc: pause 934 ms\ngc: pause 1.1 s\nheap: 91% after full GC\nhealth: /healthz 200 OK',
          footer: { text: 'Slow but still passing health checks', tone: 'warn' },
        },
        caption: 'The health check still says OK',
      },
    },
    {
      title: 'Slow beats dead',
      tag: 'concept',
      heading: 'A slow dependency is worse than a dead one',
      eli5: 'If the pantry is closed, the head cook knows right away and tells the guest. If the pantry keeper is just very slow, the head cook stands there waiting and cannot cook anything else.',
      body: [
        'A dead service fails fast: the connection is refused, the caller gets an error in milliseconds and moves on.',
        'A slow service holds the caller\'s **thread** and connection open. The caller does nothing useful while it waits, and it cannot serve anyone else with that thread.',
      ],
      keyIdea: 'Failure costs nothing to the caller. Slowness costs a thread for as long as the call hangs.',
      metrics: { err: '1%', p99: '3 s', sat: '70%', calls: '1 per ride' },
      metricTones: { err: 'warn', p99: 'bad', sat: 'warn', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'active', chips: [{ text: '8 threads waiting', tone: 'warn' }] },
          { ...driver, status: 'hot', load: 70 },
        ],
        links: [link('matching', 'driver', { label: 'reply in 3 s', labelTone: 'warn' })],
        flows: [
          { path: ['matching', 'driver'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['driver', 'matching'], tone: 'response', label: '3 s later', duration: 2.6, delay: 1.5 },
        ],
        panel: {
          title: 'Dead versus slow',
          icon: 'Timer',
          rows: [
            { text: 'Dead: refused in', value: '2 ms', tone: 'good' },
            { text: 'Dead: thread held for', value: '2 ms', tone: 'good' },
            { text: 'Slow: reply after', value: '3000 ms', tone: 'bad' },
            { text: 'Slow: thread held for', value: '3000 ms', tone: 'bad' },
          ],
          footer: { text: 'Same failure, 1500 times the cost', tone: 'bad' },
        },
        caption: 'The caller pays for every second of waiting',
      },
    },
    {
      title: 'Threads fill up',
      tag: 'concept',
      heading: 'The thread pool saturates and the queue grows',
      eli5: 'The pantry keeper has a small window and a line of cooks. When each trip takes forever, the line stretches out the door.',
      body: [
        'Each driver-location pod has a fixed **thread pool**. Requests arrive faster than slow replies free the threads, so the pool fills and the rest wait in a **queue**.',
        'Garbage collection runs constantly, which makes everything slower still. CPU sits at 100% and the queue reaches 50,000 requests.',
        'The load balancer keeps sending the slow pod traffic because its health check passes. Retried load then pushes the other pods past their own heap limits, so the slowness spreads across the service.',
      ],
      keyIdea: 'Once arrivals exceed completions, the queue grows without bound and latency climbs with it.',
      metrics: { err: '6%', p99: '12 s', sat: '100%', calls: '1 per ride' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'active' },
          { ...driver, status: 'hot', load: 100, chips: [{ text: 'queue 50,000', tone: 'bad' }, { text: 'threads 200/200', tone: 'bad' }] },
        ],
        links: [link('matching', 'driver')],
        flows: [
          { path: ['matching', 'driver'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['driver', 'matching'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'driver-location, saturated',
          icon: 'Gauge',
          rows: [
            { text: 'CPU', value: '100%', tone: 'bad' },
            { text: 'GC pauses', value: 'constant', tone: 'bad' },
            { text: 'Thread pool', value: 'saturated', tone: 'bad' },
            { text: 'Queue depth', value: '50,000', tone: 'bad' },
          ],
          footer: { text: 'Normal p99 is 80 ms. Now 12 s.', tone: 'bad' },
        },
        caption: 'Arrivals outrun completions',
      },
    },
    {
      title: 'Retries amplify',
      tag: 'concept',
      heading: 'Matching retries, and the load multiplies',
      eli5: 'The head cook asks the pantry keeper, waits, gets tired of waiting and shouts the same question five more times. Now the keeper has six questions to answer instead of one.',
      body: [
        '**Matching** has a timeout and a retry policy: up to **5 retries**, immediately, with no **jitter** (random delay) and no circuit breaker.',
        'Every failed call becomes up to six calls. A service that was slightly overloaded now receives about **5x** its normal traffic, so it fails more, so matching retries more.',
      ],
      keyIdea: 'Retries are load amplifiers. A sick service gets more traffic exactly when it can least afford it.',
      metrics: { err: '40%', p99: '30 s', sat: '100%', calls: '5x' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          { ...matching, status: 'hot', load: 95, chips: [{ text: 'retry x5, no jitter', tone: 'bad' }] },
          { ...driver, status: 'hot', load: 100 },
        ],
        links: [link('matching', 'driver', { arrow: 'both' })],
        flows: [
          { path: ['matching', 'driver'], tone: 'request', label: 'try 1', duration: 1, count: 2 },
          { path: ['matching', 'driver'], tone: 'request', label: 'retry 1-5', duration: 1, count: 5, delay: 0.8 },
          { path: ['driver', 'matching'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'One ride request on matching',
          icon: 'Repeat',
          rows: [
            { text: 'Normal: calls to driver-location', value: '1', tone: 'good' },
            { text: 'During the incident', value: 'up to 6', tone: 'bad' },
            { text: 'Delay between tries', value: '0 ms', tone: 'bad' },
            { text: 'Circuit breaker', value: 'none', tone: 'bad' },
          ],
          footer: { text: 'Load on driver-location is about 5x normal', tone: 'bad' },
        },
        caption: 'The feedback loop: failure causes retries, retries cause failure',
      },
    },
    {
      title: 'Layers multiply',
      tag: 'concept',
      heading: 'Every layer retries, so the multiplier compounds',
      eli5: 'The guest, the waiter and the price board all shout their order again when it takes too long. Each shout starts a fresh round of shouting further down the line.',
      body: [
        'All upstream services share one **global retry policy**. When matching starts timing out, **pricing** retries matching, and **booking** retries pricing.',
        'Retries at each layer multiply, because each layer retries only when the layer below times out, which is exactly the state during the incident. This illustration simplifies every layer to 3 attempts (1 try plus 2 retries): 3 layers give up to 27 attempts at the bottom. The real matching policy is higher, but the shape is the same.',
      ],
      keyIdea: 'Retries at every layer multiply instead of adding. Depth in the call graph makes it worse.',
      metrics: { err: '85%', p99: '45 s', sat: '100%', calls: '5x and rising' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          { ...booking, status: 'hot', chips: [{ text: '3 attempts', tone: 'warn' }] },
          { ...pricing, status: 'hot', chips: [{ text: '3 attempts', tone: 'warn' }] },
          { ...matching, status: 'hot', chips: [{ text: '3 attempts', tone: 'warn' }] },
          { ...driver, status: 'hot', load: 100 },
        ],
        links: [link('booking', 'pricing'), link('pricing', 'matching'), link('matching', 'driver')],
        flows: [
          { path: ['booking', 'pricing', 'matching', 'driver'], tone: 'request', count: 3, duration: 2.4 },
          { path: ['driver', 'matching', 'pricing', 'booking'], tone: 'error', label: 'timeouts', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'Attempts at the bottom (illustration)',
          icon: 'Layers',
          rows: [
            { text: 'Booking tries pricing', value: '3', tone: 'warn' },
            { text: 'Each pricing try calls matching', value: '3 x 3 = 9', tone: 'warn' },
            { text: 'Each matching try calls driver-location', value: '9 x 3 = 27', tone: 'bad' },
          ],
          footer: { text: 'One ride, up to 27 hits on the sick service', tone: 'bad' },
        },
        caption: 'Retry policy copied into every service',
      },
    },
    {
      title: 'Total outage',
      tag: 'case',
      heading: '6:17 PM: every ride request returns 503',
      eli5: 'The whole restaurant stops serving. Every guest waits at the door, the waiters are stuck waiting on the cooks, and nobody can order anything.',
      body: [
        'The spark became a fire. Every ride request fails with a **503**. Drivers cannot update their location. Riders cannot book. Support phones are ringing and the CEO joins the bridge within 8 minutes.',
        'There were no deploys in the last 48 hours, so the usual first suspect is off the table.',
      ],
      keyIdea: 'Users see one thing: the app is down. The first job is to find where the loop starts.',
      metrics: { err: '100%', p99: '45 s', sat: '100%', calls: '5x and rising' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'hot', badge: '503' },
          { ...booking, status: 'down' },
          { ...pricing, status: 'down' },
          { ...matching, status: 'down' },
          { ...driver, status: 'down' },
        ],
        links: chain(),
        flows: [
          { path: ['app', 'booking'], tone: 'request', label: 'book ride', duration: 1.4 },
          { path: ['booking', 'app'], tone: 'error', label: '503', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Bridge call, 6:17 PM',
          icon: 'Bug',
          rows: [
            { text: 'Ride requests', value: '503', tone: 'bad' },
            { text: 'Driver location updates', value: 'failing', tone: 'bad' },
            { text: 'Deploys in last 48 h', value: 'none', tone: 'muted' },
            { text: 'On bridge', value: 'SRE, staff eng, CEO', tone: 'default' },
          ],
          footer: { text: 'Every service is red', tone: 'bad' },
        },
        caption: 'Everything is red, so where do we look?',
      },
    },
    {
      title: 'Read the graph',
      tag: 'case',
      heading: 'Investigation: find the bottom of the chain',
      eli5: 'When every table complains, you follow the line of waiting people to the front. The one at the very end of the line is the one who is stuck.',
      body: [
        'When everything is red, look **downstream**. The service graph shows the chain: customer app, booking, pricing, matching, driver-location.',
        'The leaf has the strangest number. driver-location p99 is **45 seconds** against a normal 80 ms. Everything above it is only waiting.',
      ],
      keyIdea: 'In a call chain, the first suspect is the deepest service whose latency is far off its baseline.',
      metrics: { err: '100%', p99: '45 s', sat: '100%', calls: '5x and rising' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          dash,
          { ...booking, status: 'dim' },
          { ...pricing, status: 'dim' },
          { ...matching, status: 'dim' },
          { ...driver, status: 'hot', badge: '45 s', load: 100 },
        ],
        links: [link('dash', 'driver', { style: 'dashed', route: 'straight', label: 'p99 45 s', labelTone: 'bad' })],
        flows: [],
        panel: {
          title: 'p99 latency by service',
          icon: 'Timer',
          rows: [
            { text: 'booking', value: '47 s', tone: 'warn' },
            { text: 'pricing', value: '46 s', tone: 'warn' },
            { text: 'matching', value: '45 s', tone: 'warn' },
            { text: 'driver-location (normal 80 ms)', value: '45 s', tone: 'bad' },
          ],
          footer: { text: 'Upstream numbers are just waiting time', tone: 'muted' },
        },
        caption: 'Follow the dependency graph to the leaf',
      },
      quiz: {
        question: 'Every service in a call chain shows high latency. Where do you look first?',
        options: [
          'The service closest to the user, because that is where users complain',
          'The deepest service whose latency is far above its baseline',
          'The service with the most recent deploy, whatever its latency',
          'The load balancer in front of the whole chain',
        ],
        answer: 1,
        explain: 'Upstream services show high latency because they wait on the next hop. The deepest service that is still far off its own baseline is where the delay originates.',
      },
    },
    {
      title: 'Pod metrics',
      tag: 'case',
      heading: 'Investigation: the pods are saturated and in GC',
      eli5: 'Looking inside the pantry, we see the keeper is out of breath, the shelves are being rearranged nonstop and a huge line of cooks is waiting.',
      body: [
        'Opening the driver-location pod metrics at 6:22: CPU at **100%**, garbage collection pauses constant, the thread pool saturated, queue depth **50,000**.',
        'This looks like a capacity problem. It also looks like the most natural thing to fix with more pods. That reading is about to cost the team time.',
      ],
      keyIdea: 'Saturation tells you the service is overloaded. It does not tell you why.',
      metrics: { err: '100%', p99: '45 s', sat: '100%', calls: '5x and rising' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          dash,
          { ...driver, status: 'hot', load: 100, chips: [{ text: 'queue 50,000', tone: 'bad' }, { text: 'GC: constant', tone: 'bad' }] },
        ],
        links: [link('dash', 'driver', { style: 'dashed', route: 'straight' })],
        flows: [],
        panel: {
          title: 'driver-location pod metrics, 6:22',
          icon: 'Gauge',
          code: 'cpu_usage_percent     100\ngc_pause_seconds      constant\nthread_pool_active    200 / 200\nrequest_queue_depth   50000\nrequests_in_per_s     up 5x since 6:10',
          footer: { text: 'Overloaded, cause unknown', tone: 'warn' },
        },
        caption: 'Looks like capacity',
      },
    },
    {
      title: 'Scale out?',
      tag: 'tradeoff',
      heading: 'The tempting fix: scale out from 40 to 120 pods',
      eli5: 'The line at the pantry is huge, so the owner hires more pantry keepers. It sounds sensible, if the line were made of real customers.',
      body: [
        'Zane scales driver-location from **40 to 120 pods** at 6:23. For an ordinary traffic spike that is the right move.',
        'But the extra load is retries, not new riders. Each new pod will be hit by the same loop, and all of them start cold.',
      ],
      keyIdea: 'Scaling out answers a demand problem. It does nothing for a feedback loop that generates its own demand.',
      metrics: { err: '100%', p99: '45 s', sat: '100%', calls: '5x and rising' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          { ...matching, at: at(1.4, 1.9), status: 'hot', load: 95 },
          { ...driver, status: 'active', load: 100, size: 1, chips: [{ text: '40 pods', tone: 'warn' }, { text: '120 pods', tone: 'good' }] },
        ],
        links: [link('matching', 'driver')],
        flows: [{ path: ['matching', 'driver'], tone: 'request', count: 5, duration: 1.2, label: 'retries' }],
        panel: {
          title: '6:23 PM: kubectl scale',
          icon: 'Server',
          code: 'kubectl scale deploy/driver-location \\\n  --replicas=120\n\n# before: 40 replicas\n# after:  120 replicas requested',
          footer: { text: 'Hypothesis: it is a capacity problem', tone: 'warn' },
        },
        caption: 'Hypothesis: add capacity',
      },
    },
    {
      title: 'Crash loop',
      tag: 'case',
      heading: 'The new pods are consumed at once',
      eli5: 'Each new pantry keeper walks in and is handed a hundred questions before finding the light switch. They collapse and get sent home.',
      body: [
        'New pods start, join the pool and immediately receive their share of a huge retry flood. They spike to **100% CPU** while still warming up, fail health checks and are rolled out.',
        'Pod crash loops add churn and take capacity away. At 6:27 Tanvi calls it: **stop scaling, it is making things worse**.',
      ],
      keyIdea: 'New capacity cannot catch up while the retry flood keeps growing. The loop eats it before it warms up.',
      metrics: { err: '100%', p99: '45 s', sat: '100%', calls: '5x and rising' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          { ...matching, status: 'hot', load: 95 },
          { ...driver, status: 'down', load: 100, badge: 'CrashLoopBackOff', chips: [{ text: 'restarts: 7', tone: 'bad' }] },
        ],
        links: [link('matching', 'driver')],
        flows: [
          { path: ['matching', 'driver'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['driver', 'matching'], tone: 'error', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'kubectl get pods, 6:25',
          icon: 'Container',
          code: 'NAME             READY  STATUS\ndriver-loc-x7f   0/1    CrashLoopBackOff\ndriver-loc-k2p   0/1    CrashLoopBackOff\ndriver-loc-m9d   0/1    Running\ndriver-loc-q4c   0/1    CrashLoopBackOff',
          footer: { text: '6:27 PM: stop scaling', tone: 'bad' },
        },
        caption: 'Capacity added, capacity lost',
      },
    },
    {
      title: 'Who is calling',
      tag: 'case',
      heading: 'Investigation: where does the traffic come from?',
      eli5: 'Tanvi asks the pantry keeper who is actually shouting at them. Most of the noise comes from one person: the head cook, who is also stuck.',
      body: [
        'At 6:28 Tanvi pulls a **traffic origin breakdown** on driver-location. **60%** of requests come from the matching service.',
        'That is odd, because matching is also timing out. A service that fails most of its own calls should not be sending that much traffic.',
      ],
      keyIdea: 'Break incoming traffic down by caller. A sick caller that sends too much points at a loop.',
      metrics: { err: '100%', p99: '45 s', sat: '100%', calls: '5x and rising' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [
          { ...matching, status: 'hot', load: 95 },
          { ...driver, status: 'hot', load: 100 },
          dash,
        ],
        links: [link('matching', 'driver', { label: '60% of traffic', labelTone: 'warn' }), link('dash', 'driver', { style: 'dashed' })],
        flows: [{ path: ['matching', 'driver'], tone: 'request', count: 4, duration: 1.2 }],
        panel: {
          title: 'driver-location, requests by caller',
          icon: 'Table',
          rows: [
            { text: 'matching', value: '60%', tone: 'bad' },
            { text: 'all other callers', value: '40%', tone: 'default' },
            { text: 'Matching is also failing', value: 'why so many?', tone: 'warn' },
          ],
          footer: { text: 'A failing caller should send less, not more', tone: 'warn' },
        },
        caption: 'The loop shows up in the caller breakdown',
      },
    },
    {
      title: 'Count attempts',
      tag: 'case',
      heading: 'Investigation: how many tries per ride?',
      eli5: 'Tanvi counts how many times each question is asked. One order is being shouted about six times, over and over, with no pause.',
      body: [
        'Group the driver-location access log by caller and divide calls by distinct ride ids. The answer: matching sends several attempts per ride, **without delay**.',
        'At 6:30 the picture is clear: matching retries up to 5 times with no jitter, each ride fans out to about **5x** its normal rate, and the service falls further behind. This is a **thundering herd by retry amplification**.',
      ],
      keyIdea: 'Calls divided by distinct requests gives the amplification factor, and it names the culprit.',
      metrics: { err: '100%', p99: '45 s', sat: '100%', calls: '5x' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'bad' },
      scene: {
        nodes: [dash, { ...matching, at: at(1.4, 1.9), status: 'hot', load: 95, chips: [{ text: 'retries: 5, no jitter', tone: 'bad' }] }, { ...driver, status: 'hot', load: 100 }],
        links: [link('dash', 'driver', { style: 'dashed' }), link('matching', 'driver')],
        flows: [{ path: ['matching', 'driver'], tone: 'request', count: 5, duration: 1.2, label: 'attempts' }],
        panel: {
          title: 'Attempts per ride (last 5 min)',
          icon: 'Repeat',
          rows: [
            { text: 'matching', value: '~5x', tone: 'bad' },
            { text: 'Delay between attempts', value: 'none', tone: 'bad' },
            { text: 'Same ride id repeated', value: 'yes', tone: 'warn' },
          ],
          footer: { text: 'Retry amplification found', tone: 'bad' },
        },
        caption: 'Same ride id, many identical calls',
      },
      code: {
        language: 'sql',
        title: 'Amplification factor by caller',
        source: `SELECT caller,
       COUNT(*)                          AS calls,
       COUNT(DISTINCT request_id)        AS rides,
       ROUND(COUNT(*) * 1.0 /
             COUNT(DISTINCT request_id), 1) AS attempts_per_ride
FROM   driver_location_access_log
WHERE  ts > now() - interval '5 minutes'
GROUP  BY caller
ORDER  BY calls DESC;`,
        highlight: [2, 3, 4],
      },
    },
    {
      title: 'Flag off',
      tag: 'concept',
      heading: 'Mitigation: break the loop with a feature flag',
      eli5: 'Tanvi tells the head cook: stop repeating the question. One quiet question at a time is enough.',
      body: [
        'At 6:35 Tanvi orders: **kill retries on matching, now**. A flag disables them across the fleet within seconds, with no deploy and no pod restart.',
        'This step breaks the feedback loop. It does not fix the leak, and that is fine. Bleeding first, root cause later.',
      ],
      keyIdea: 'In an incident, stop the amplification first. A kill switch you can flip in seconds is worth having beforehand.',
      metrics: { err: '85%', p99: '45 s', sat: '100%', calls: '1x' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'active', chips: [{ text: 'retries: off', tone: 'good' }] },
          { ...driver, status: 'hot', load: 100 },
        ],
        links: [link('matching', 'driver')],
        flows: [{ path: ['matching', 'driver'], tone: 'request', label: 'single attempt', duration: 1.2 }],
        panel: {
          title: '6:35 PM: feature flag',
          icon: 'Zap',
          code: 'FEATURE_FLAG\n  matching_retry_enabled = false\n\n# retries: 5 -> 0 on matching',
          footer: { text: 'Loop broken in seconds, no deploy', tone: 'good' },
        },
        caption: 'The fastest lever wins',
      },
      code: {
        language: 'bash',
        title: 'Stopping the bleeding (illustrative commands, 6:35 to 6:44)',
        source: `# 1. disable retries on matching, fleet-wide (placeholder flag CLI)
my-flag-cli set matching_retry_enabled=false --scope fleet

# 2. watch the retry storm drain (Prometheus query API)
curl -s 'http://prometheus:9090/api/v1/query' --data-urlencode 'query=histogram_quantile(0.99, sum(rate(driver_location_latency_bucket[1m])) by (le))'

# 3. bounce the original leaking pods by hand
kubectl delete pod -l app=driver-location,leaky=true

# 4. later: re-enable with jitter, max 2 attempts, breaker`,
        highlight: [2, 10],
      },
    },
    {
      title: 'Drain and recover',
      tag: 'case',
      heading: 'Recovery: the queue drains and the app turns green',
      eli5: 'Once the shouting stops, the line at the pantry window shrinks fast. The keeper catches up and everyone gets served again.',
      body: [
        'With retries off, driver-location p99 falls from **45 s to 600 ms** within about 90 seconds as the queue drains. The team bounces the original leaky pods by hand.',
        'At **6:44 PM** the dashboards are green. The support queue drains over the next 20 minutes.',
      ],
      keyIdea: 'Once the feedback loop stops, a saturated service recovers on its own, because the real demand was small.',
      metrics: { err: '0.2%', p99: '600 ms', sat: '42%', calls: '1x' },
      metricTones: { err: 'good', p99: 'warn', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'ok', badge: '200' },
          { ...booking, status: 'ok' },
          { ...pricing, status: 'ok' },
          { ...matching, status: 'ok' },
          { ...driver, status: 'ok', load: 42 },
        ],
        links: chain(),
        flows: [
          { path: ride, tone: 'request', label: 'book ride', duration: 3.2 },
          { path: back, tone: 'response', label: 'ok', duration: 3.2, delay: 3.4 },
        ],
        panel: {
          title: 'Recovery timeline',
          icon: 'Clock',
          rows: [
            { text: '6:35 retries off', value: 'flag flipped', tone: 'default' },
            { text: '6:38 queue draining', value: 'p99 45 s to 600 ms', tone: 'warn' },
            { text: '6:44 all green', value: 'full recovery', tone: 'good' },
          ],
          footer: { text: '27 minutes from first alert to green', tone: 'muted' },
        },
        caption: 'The loop stops, the system heals',
      },
    },
    {
      title: 'Safe retries',
      tag: 'concept',
      heading: 'Re-enable retries the safe way: fewer, spaced, random',
      eli5: 'The head cook may ask again, but only once or twice, and after waiting a random bit so all the cooks do not shout at the same instant.',
      body: [
        'Retries are fine when they are bounded. The team re-enables them with **max 2 attempts**, **exponential backoff** (growing waits) and **jitter** (a random part of each wait).',
        'Jitter spreads retries in time so clients do not hit the service in sync. Backoff gives the service room to recover instead of adding load.',
      ],
      keyIdea: 'Retry with a small cap, growing delays and random jitter, and only for calls that are safe to repeat.',
      metrics: { err: '0.1%', p99: '90 ms', sat: '38%', calls: '1.02x' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'ok', chips: [{ text: 'max 2 attempts', tone: 'good' }, { text: 'backoff + jitter', tone: 'good' }] },
          { ...driver, status: 'ok', load: 38 },
        ],
        links: [link('matching', 'driver')],
        flows: [
          { path: ['matching', 'driver'], tone: 'request', label: 'try 1', duration: 1 },
          { path: ['matching', 'driver'], tone: 'request', label: 'try 2 after 120 ms', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Retry policy, before and after',
          icon: 'Repeat',
          rows: [
            { text: 'Attempts', value: '6 to 2', tone: 'good' },
            { text: 'Delay', value: '0 ms to backoff', tone: 'good' },
            { text: 'Jitter', value: 'none to full', tone: 'good' },
            { text: 'Circuit breaker', value: 'next step', tone: 'muted' },
          ],
          footer: { text: 'Bounded, spaced, desynchronized', tone: 'good' },
        },
        caption: 'Retries that cannot start a storm',
      },
      code: {
        language: 'typescript',
        title: 'Backoff with full jitter',
        source: `const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= maxAttempts) throw err;
      const cap = Math.min(2000, 100 * 2 ** attempt); // 200, 400, ...
      await sleep(Math.random() * cap); // full jitter
    }
  }
}`,
        highlight: [2, 9, 10, 11],
      },
      quiz: {
        question: 'Why does adding random jitter to retry delays help a struggling service?',
        options: [
          'It makes each retry cheaper for the server to process',
          'It spreads retries over time, so clients do not hit the service in synchronized waves',
          'It lets clients skip retries entirely',
          'It makes timeouts shorter',
        ],
        answer: 1,
        explain: 'Without jitter, clients that failed together retry together, and each wave arrives as a spike. Random delays smear those waves into a steady, lower load.',
      },
    },
    {
      title: 'Timeouts',
      tag: 'concept',
      heading: 'Timeouts and deadlines: stop waiting at some point',
      eli5: 'Each cook is told how long they may wait at the pantry window. When time is up, they walk away and say so, instead of standing there all night.',
      body: [
        'Every call needs a **timeout**, shorter than the caller\'s own. If booking gives up after 2 s but matching waits 30 s on a dependency, matching keeps working for nobody.',
        'Pass a **deadline** with the request so each hop knows how much time is left, and cancel work once it passes. This frees threads sooner.',
      ],
      keyIdea: 'Timeouts shrink as you go deeper. A downstream call should never outlive the request that started it.',
      metrics: { err: '0.1%', p99: '90 ms', sat: '38%', calls: '1.02x' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...booking, status: 'ok', chips: ['deadline 2000 ms'] },
          { ...pricing, status: 'ok', chips: ['left 1800 ms'] },
          { ...matching, status: 'ok', chips: ['left 1500 ms'] },
          { ...driver, status: 'ok', chips: ['left 1000 ms'] },
        ],
        links: [link('booking', 'pricing'), link('pricing', 'matching'), link('matching', 'driver')],
        flows: [{ path: ['booking', 'pricing', 'matching', 'driver'], tone: 'request', label: 'deadline travels', duration: 2.8 }],
        panel: {
          title: 'Timeout budget down the chain',
          icon: 'Timer',
          rows: [
            { text: 'booking to pricing', value: '2000 ms' },
            { text: 'pricing to matching', value: '1800 ms' },
            { text: 'matching to driver-location', value: '1000 ms' },
          ],
          footer: { text: 'Each hop gets less than the one above', tone: 'good' },
        },
        caption: 'The deadline shrinks down the chain',
      },
    },
    {
      title: 'Circuit breaker',
      tag: 'concept',
      heading: 'Circuit breakers: fail fast, shed the load',
      eli5: 'If the pantry keeper keeps failing, the head cook puts up a sign: no more questions for a minute. The cook answers the guest right away instead of waiting.',
      body: [
        'A **circuit breaker** watches calls to a dependency. After 10 failures in a row, it **opens**: calls fail immediately without touching the sick service.',
        'After a 30 s cooldown it goes **half-open** and lets one probe call through. If it succeeds, the breaker closes. Open breakers shed load and give the dependency time to recover.',
      ],
      keyIdea: 'A breaker turns slow, load-adding failures into fast, load-free ones.',
      metrics: { err: '5%', p99: '120 ms', sat: '45%', calls: '1x' },
      metricTones: { err: 'warn', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'active', badge: 'breaker open', chips: [{ text: 'fail fast: 2 ms', tone: 'good' }] },
          { ...driver, status: 'dim', load: 45 },
        ],
        links: [link('matching', 'driver', { style: 'dashed', label: 'calls blocked', labelTone: 'good' })],
        flows: [{ path: ['matching', 'driver'], tone: 'error', label: 'rejected locally', duration: 0.8, count: 3 }],
        panel: {
          title: 'Breaker states',
          icon: 'Shield',
          rows: [
            { text: 'Closed', value: 'calls pass through', tone: 'good' },
            { text: 'Open (10 failures in a row)', value: 'fail immediately', tone: 'bad' },
            { text: 'Half-open after 30 s', value: 'one probe call', tone: 'warn' },
          ],
          footer: { text: 'Fallback: use the last known driver positions', tone: 'muted' },
        },
        caption: 'The breaker protects the dependency and the caller',
      },
      code: {
        language: 'typescript',
        title: 'A minimal circuit breaker',
        source: `class Breaker {
  private fails = 0; private openedAt = 0;
  constructor(private max = 10, private coolMs = 30_000) {}

  async call<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    const open = this.fails >= this.max;
    if (open && Date.now() - this.openedAt < this.coolMs) return fallback();
    try { const r = await fn(); this.fails = 0; return r; }
    catch { if (++this.fails >= this.max) this.openedAt = Date.now(); return fallback(); }
  }
}`,
        highlight: [6, 7, 9],
      },
    },
    {
      title: 'Bulkheads',
      tag: 'concept',
      heading: 'Bulkheads: one slow dependency cannot drain every thread',
      eli5: 'A ship has sealed compartments so a leak in one room does not sink the whole boat. The kitchen gives each pantry its own helpers, so one slow pantry cannot use them all.',
      body: [
        'Without **bulkheads**, matching uses one shared thread pool for every dependency. A slow driver-location takes all the threads, and calls to healthy dependencies starve.',
        'Give each downstream its **own pool**, with its own limit. When driver-location is slow, only its pool fills. Calls to everything else still run.',
      ],
      keyIdea: 'Separate pools per dependency keep one slow neighbor from consuming the whole service.',
      metrics: { err: '2%', p99: '150 ms', sat: '50%', calls: '1x' },
      metricTones: { err: 'warn', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'active', chips: [{ text: 'pool A: 20/20', tone: 'warn' }, { text: 'pool B: 3/20', tone: 'good' }] },
          { ...driver, status: 'hot', load: 90 },
          { id: 'maps', kind: 'block', size: 0.8, at: at(5.6, -2.4), label: 'maps', icon: 'Globe', tint: 'teal', status: 'ok' },
        ],
        links: [link('matching', 'driver', { label: 'pool A' }), link('matching', 'maps', { label: 'pool B' })],
        flows: [
          { path: ['matching', 'driver'], tone: 'error', label: 'slow', duration: 1.6 },
          { path: ['matching', 'maps'], tone: 'request', duration: 1.2, delay: 0.4 },
          { path: ['maps', 'matching'], tone: 'response', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'Thread pools in matching',
          icon: 'Layers',
          rows: [
            { text: 'Pool A: driver-location', value: 'full, 20 of 20', tone: 'warn' },
            { text: 'Pool B: maps', value: '3 of 20', tone: 'good' },
            { text: 'Other work', value: 'unaffected', tone: 'good' },
          ],
          footer: { text: 'The damage stops at the bulkhead', tone: 'good' },
        },
        caption: 'One compartment floods, the rest stay dry',
      },
    },
    {
      title: 'Retry budgets',
      tag: 'concept',
      heading: 'Retry budgets: cap retries as a share of traffic',
      eli5: 'The head cook gets a small jar of repeat-question tokens, sized to about a tenth of the normal questions. When the jar is empty, no more repeats until it refills.',
      body: [
        'A **retry budget** caps retries at about **10%** of total request volume. When the budget is spent, extra retries fail immediately instead of adding load.',
        'This puts a ceiling on amplification, whatever the failure rate. A budget caps amplification at 1.1x per layer. Across three layers the worst case is about 1.33x, still tiny next to 27x or more.',
      ],
      keyIdea: 'A budget turns retry amplification from multiplicative into a fixed small overhead.',
      metrics: { err: '0.2%', p99: '90 ms', sat: '40%', calls: '<=1.33x' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'ok', chips: [{ text: 'budget 10%', tone: 'good' }, { text: 'used 8%', tone: 'good' }] },
          { ...driver, status: 'ok', load: 40 },
        ],
        links: [link('matching', 'driver')],
        flows: [
          { path: ['matching', 'driver'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['matching', 'driver'], tone: 'request', label: 'retry (budgeted)', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Retry budget on matching',
          icon: 'Scale',
          rows: [
            { text: 'Budget', value: '10% of requests', tone: 'good' },
            { text: 'Used this minute', value: '8%', tone: 'good' },
            { text: 'When spent', value: 'retry fails fast', tone: 'warn' },
            { text: 'Worst case: 1.1x per layer', value: '~1.33x over 3', tone: 'good' },
          ],
          footer: { text: 'The ceiling holds even when everything fails', tone: 'good' },
        },
        caption: 'Retries have a ceiling',
      },
      code: {
        language: 'typescript',
        title: 'Token-bucket retry budget',
        source: `class RetryBudget {
  private tokens = 0;
  constructor(private ratio = 0.1, private maxTokens = 100) {}

  onRequest() { this.tokens = Math.min(this.maxTokens, this.tokens + this.ratio); }

  tryAcquire(): boolean {
    if (this.tokens < 1) return false; // budget spent: fail now
    this.tokens -= 1;
    return true;
  }
}`,
        highlight: [5, 8],
      },
      quiz: {
        question: 'What does a 10% retry budget guarantee?',
        options: [
          'Each request is retried at most 10 times',
          'Retries add at most about 10% to normal traffic, however many requests fail',
          'Only 10% of requests are allowed to fail',
          'Retry delays never exceed 10 ms',
        ],
        answer: 1,
        explain: 'The budget limits retries as a share of overall volume. When it is spent, further retries fail at once, so load stays near 1.1x of normal per layer.',
      },
    },
    {
      title: 'Load shedding',
      tag: 'concept',
      heading: 'Load shedding: drop the optional work first',
      eli5: 'When the kitchen is swamped, the waiter stops taking dessert photos and napkin folding requests. The cooks keep working only on meals people are waiting for.',
      body: [
        'Each service publishes a **pressure signal** (queue depth, CPU, latency). When pressure is high, upstream services drop **lower-priority work**, such as precomputed price previews, to save capacity.',
        'Critical paths, such as active bookings, keep running. Dropping 20% of low-value work beats failing 100% of everything.',
      ],
      keyIdea: 'Under overload, choose what to drop. Protect the critical path on purpose rather than failing at random.',
      metrics: { err: '1%', p99: '110 ms', sat: '78%', calls: '1x' },
      metricTones: { err: 'warn', p99: 'good', sat: 'warn', calls: 'good' },
      scene: {
        nodes: [
          { ...pricing, status: 'active', chips: [{ text: 'booking: keep', tone: 'good' }, { text: 'preview: drop', tone: 'warn' }] },
          { ...matching, status: 'active', badge: 'pressure high' },
          { ...driver, status: 'hot', load: 82 },
        ],
        links: [link('pricing', 'matching'), link('matching', 'driver')],
        flows: [
          { path: ['pricing', 'matching', 'driver'], tone: 'request', label: 'active booking', duration: 2.2 },
          { path: ['matching', 'pricing'], tone: 'error', label: 'preview shed', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Priority under pressure',
          icon: 'Shield',
          rows: [
            { text: 'Active bookings', value: 'always served', tone: 'good' },
            { text: 'Driver location updates', value: 'served', tone: 'good' },
            { text: 'Price previews', value: 'dropped', tone: 'warn' },
            { text: 'Analytics events', value: 'dropped', tone: 'warn' },
          ],
          footer: { text: 'Shed the optional, protect the critical', tone: 'good' },
        },
        caption: 'Graceful degradation',
      },
    },
    {
      title: 'The leak',
      tag: 'case',
      heading: 'Root cause: the memory leak and the missing safety net',
      eli5: 'The sticky drawer came from a new drawer rail the shop installed days ago. Nobody tried a small batch of drawers first, so nobody found out until the whole shop was open.',
      body: [
        'The initial trigger was a **memory leak from a recent library upgrade**. Three failures compounded: the leak, retries with no jitter or breaker, and a **global retry policy** shared by every service.',
        'Fixes: **pin** library versions, canary each upgrade on a small slice of pods, and alert on heap growth after GC, not just CPU.',
      ],
      keyIdea: 'Fix the trigger, but spend the effort on the amplifiers. The leak is routine, the cascade is the design flaw.',
      metrics: { err: '0.1%', p99: '80 ms', sat: '35%', calls: '1.02x' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, status: 'ok' },
          { ...driver, status: 'ok', load: 35, chips: [{ text: 'lib pinned: 4.2.1', tone: 'good' }, { text: 'canary 5%', tone: 'good' }] },
          dash,
        ],
        links: [link('matching', 'driver'), link('dash', 'driver', { style: 'dashed' })],
        flows: [{ path: ['matching', 'driver'], tone: 'request', duration: 1.2 }, { path: ['driver', 'matching'], tone: 'response', duration: 1.2, delay: 1.3 }],
        panel: {
          title: 'Three failures, three fixes',
          icon: 'Bug',
          rows: [
            { text: 'Leak in library upgrade', value: 'pin + canary', tone: 'good' },
            { text: 'Retries: no jitter, no breaker', value: 'jitter, cap, breaker', tone: 'good' },
            { text: 'Global retry policy', value: 'per-call budgets', tone: 'good' },
            { text: 'Heap-after-GC alert', value: 'added', tone: 'good' },
          ],
          footer: { text: 'About 6 weeks of follow-up work', tone: 'muted' },
        },
        caption: 'Fix the trigger and the amplifiers',
      },
    },
    {
      title: 'Game days',
      tag: 'concept',
      heading: 'Chaos testing: prove the safety nets hold',
      eli5: 'Once a month the kitchen practices a fire drill on purpose: make the pantry slow and see whether the cooks stay calm and keep serving.',
      body: [
        'Monthly **game days** inject a slow response into a downstream service and check that breakers open, budgets cap retries and critical paths stay up.',
        'Run them in staging first, then in production with a small blast radius and a stop button. A safety net that was never tested is a guess.',
      ],
      keyIdea: 'Practice failure on your terms. Untested safeguards tend to fail on the worst evening.',
      metrics: { err: '0.3%', p99: '110 ms', sat: '55%', calls: '1.05x' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...matching, at: at(1.4, 1.9), status: 'ok', chips: [{ text: 'breaker closed', tone: 'good' }] },
          { ...driver, status: 'active', load: 55, chips: [{ text: '+2 s latency injected', tone: 'warn' }] },
          dash,
        ],
        links: [link('matching', 'driver', { label: 'game day', labelTone: 'warn' }), link('dash', 'matching', { style: 'dashed' })],
        flows: [{ path: ['matching', 'driver'], tone: 'request', duration: 1.2 }, { path: ['driver', 'matching'], tone: 'response', label: 'slow', duration: 2, delay: 1.3 }],
        panel: {
          title: 'Game day checklist',
          icon: 'List',
          rows: [
            { text: 'Breaker opens within 30 s', value: 'pass', tone: 'good' },
            { text: 'Retries stay under budget', value: 'pass', tone: 'good' },
            { text: 'Bookings keep succeeding', value: 'pass', tone: 'good' },
            { text: 'Stop button tested', value: 'pass', tone: 'good' },
          ],
          footer: { text: 'Monthly, with a small blast radius', tone: 'muted' },
        },
        caption: 'Break it on purpose',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: how one slow pod took the app down',
      eli5: 'One sticky drawer made the pantry slow, the cooks kept repeating their questions, and soon the whole kitchen stopped. Fewer repeats, a "closed for now" sign and separate helpers keep one problem from spreading.',
      body: [
        'Timeline: slow pod, saturated threads, retries at every layer, total outage, graph and metrics, a wrong scale-out, the caller breakdown, retries off at 6:35, green at 6:44.',
        'Defenses: timeouts and deadlines, jittered capped retries, circuit breakers, bulkheads, retry budgets, load shedding, version pinning, canaries and game days.',
      ],
      keyIdea: 'A slow dependency plus unbounded retries is how small faults become outages. Break loops first, then add capacity.',
      metrics: { err: '0.1%', p99: '80 ms', sat: '35%', calls: '1.02x' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', calls: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'ok' },
          { ...booking, status: 'ok' },
          { ...pricing, status: 'ok' },
          { ...matching, status: 'ok', chips: [{ text: 'breaker + budget', tone: 'good' }] },
          { ...driver, status: 'ok', load: 35 },
        ],
        links: chain(),
        flows: [
          { path: ride, tone: 'request', duration: 3.2 },
          { path: back, tone: 'response', duration: 3.2, delay: 3.4 },
        ],
        panel: {
          title: 'Defenses in depth',
          icon: 'Shield',
          rows: [
            { text: 'Timeouts + deadlines', value: 'wait less', tone: 'good' },
            { text: 'Jitter, 2 attempts', value: 'retry less', tone: 'good' },
            { text: 'Breaker + budget', value: 'amplify less', tone: 'good' },
            { text: 'Bulkheads + shedding', value: 'spread less', tone: 'good' },
          ],
          footer: { text: 'Graceful degradation over perfect uptime', tone: 'good' },
        },
        caption: 'A fabric that bends instead of breaking',
      },
      quiz: {
        question: 'During the incident, why did scaling driver-location from 40 to 120 pods make things worse?',
        options: [
          'Kubernetes cannot run more than 40 pods of one service',
          'The extra load came from retries, so new cold pods were swamped and crash-looped',
          'More pods increase the latency of every request',
          'The load balancer was limited to 40 backends',
        ],
        answer: 1,
        explain: 'Demand was self-generated by a retry loop. New pods started cold, took their share of the flood, failed health checks and were rolled out. The loop had to be broken first.',
      },
    },
  ],
};
