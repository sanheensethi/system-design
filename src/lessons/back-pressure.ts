import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'block', at: at(-5.4, 0), label: 'shoppers', sub: '3,000 req/s', icon: 'Users', tint: 'blue' };
const gateway: SceneNode = { id: 'gateway', kind: 'block', at: at(-1.8, 0), label: 'gateway', icon: 'Shield', tint: 'violet' };
const queue: SceneNode = { id: 'queue', kind: 'block', at: at(1.8, 0), label: 'request queue', sub: 'in memory', icon: 'Layers', tint: 'amber' };
const api: SceneNode = { id: 'api', kind: 'server', at: at(5.4, 0), label: 'shop API', sub: '200 threads' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(9, 4.5), label: 'Postgres' };
const recs: SceneNode = { id: 'recs', kind: 'block', size: 0.8, at: at(5.4, -7.5), label: 'recs', icon: 'Star', tint: 'green' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(9, -4.5), label: 'page cache', sub: 'Redis' };
const scraper: SceneNode = { id: 'scraper', kind: 'block', size: 0.8, at: at(-9, -4.5), label: 'scraper', sub: '2,000 req/s', icon: 'Bug', tint: 'red' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: at(9, -4.5), label: 'dashboards' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, route: 'straight', ...extra });

export const backPressure: Lesson = {
  id: 'back-pressure',
  title: 'Back pressure and load shedding',
  tagline: 'When more work arrives than you can finish, decide what to refuse before memory decides for you.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why an unbounded queue turns overload into timeouts, wasted work and a crash',
    'Sizing a bounded queue from the latency you can accept, and rejecting fast',
    'Signalling upstream: Retry-After, pull-based flow and the four things a full stage can do',
    'Shedding by priority, serving newest first, concurrency limits and request deadlines',
    'Graceful degradation, retry storms, rate limiting versus shedding, autoscaling and what to monitor',
  ],
  metrics: [
    { key: 'in', label: 'Arriving', icon: 'Users' },
    { key: 'good', label: 'Useful replies', icon: 'TrendingUp' },
    { key: 'queue', label: 'Queued', icon: 'Layers' },
    { key: 'p99', label: 'p99', icon: 'Timer' },
    { key: 'mem', label: 'Memory', icon: 'HardDrive' },
  ],
  steps: [
    {
      title: 'Flash sale',
      tag: 'problem',
      heading: 'More work arrives than the server can do',
      eli5: 'A restaurant kitchen can cook 20 meals an hour. The **host** keeps seating everyone who walks in, with no limit on the waiting list. Tonight 30 families an hour arrive.',
      body: [
        'The shop API has 200 threads and each request takes about 100 ms, so it serves **2,000 requests a second**. At noon a flash sale brings 3,000.',
        'The web framework parks every request it cannot start yet in an in-memory queue with no limit. The extra 1,000 a second have nowhere else to go.',
      ],
      keyIdea: 'When arrivals exceed capacity, something has to give. An unbounded queue just hides the problem for a while.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '0', p99: '210 ms', mem: '1 GB' },
      metricTones: { in: 'warn' },
      scene: {
        nodes: [{ ...users, status: 'hot' }, gateway, { ...queue, sub: 'no limit' }, { ...api, status: 'hot', load: 100 }],
        links: [link('users', 'gateway'), link('gateway', 'queue'), link('queue', 'api')],
        flows: [
          { path: ['users', 'gateway', 'queue'], tone: 'request', count: 6, duration: 1.6 },
          { path: ['queue', 'api'], tone: 'request', count: 4, duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Capacity versus demand',
          icon: 'Gauge',
          rows: [
            { text: 'API capacity', value: '2,000/s', tone: 'good' },
            { text: 'Arriving', value: '3,000/s', tone: 'bad' },
            { text: 'Surplus', value: '+1,000/s', tone: 'bad' },
          ],
          footer: { text: 'The surplus goes into the queue', tone: 'warn' },
        },
        caption: '3,000 in, 2,000 out',
      },
    },
    {
      title: 'Queue grows',
      tag: 'concept',
      heading: 'The queue never drains, and wait grows with it',
      eli5: 'Each minute 10 more families are added to the host\'s list than the kitchen can feed. The list gets longer every minute, so every new guest waits longer than the last.',
      body: [
        'Wait is queue depth divided by service rate. After one minute the queue holds 60,000 requests, and a new arrival waits 60,000 / 2,000 = **30 seconds** for a thread.',
        'A short burst drains once it ends. A sustained excess never does: the queue and the wait grow for as long as the sale runs.',
      ],
      keyIdea: 'Latency is queue depth over service rate, so a queue that only grows means latency that only grows.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '60,000', p99: '30 s', mem: '3 GB' },
      metricTones: { queue: 'bad', p99: 'bad' },
      scene: {
        nodes: [users, gateway, { ...queue, sub: 'no limit', status: 'hot', badge: '60,000 waiting' }, { ...api, status: 'hot', load: 100 }],
        links: [link('users', 'gateway'), link('gateway', 'queue'), link('queue', 'api')],
        flows: [
          { path: ['users', 'gateway', 'queue'], tone: 'request', count: 6, duration: 1.6 },
          { path: ['queue', 'api'], tone: 'request', label: 'waited 30 s', count: 2, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Wait after the sale starts',
          icon: 'Timer',
          rows: [
            { text: 'After 10 s: 10,000 queued', value: '5 s wait', tone: 'warn' },
            { text: 'After 30 s: 30,000 queued', value: '15 s wait', tone: 'bad' },
            { text: 'After 60 s: 60,000 queued', value: '30 s wait', tone: 'bad' },
          ],
          footer: { text: 'wait = depth / 2,000 per second', tone: 'muted' },
        },
        caption: 'The longer the sale runs, the longer the line',
      },
    },
    {
      title: 'Wasted work',
      tag: 'concept',
      heading: 'The server works hard on answers nobody reads',
      eli5: 'The guests at the back of the list leave after 10 minutes. The kitchen still cooks their meals, so every plate goes to an empty table while new guests starve.',
      body: [
        'The mobile app gives up after 10 seconds, but a request now waits 30. So by the time a thread picks one up, its caller has already left.',
        'The API still spends all of its 2,000 a second on these. CPU sits at 100% and **useful replies drop close to zero**. Throughput looks fine while goodput collapses.',
      ],
      keyIdea: 'Throughput counts work done. Goodput counts work someone still wanted. Overload destroys the second.',
      metrics: { in: '3,000/s', good: '~0/s', queue: '60,000', p99: '30 s', mem: '3 GB' },
      metricTones: { good: 'bad', p99: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot', badge: 'gave up at 10 s' },
          { ...queue, sub: 'no limit', status: 'hot' },
          { ...api, status: 'hot', load: 100, badge: 'busy for nobody' },
        ],
        links: [link('users', 'queue', { label: 'timeout 10 s', labelTone: 'warn' }), link('queue', 'api')],
        flows: [
          { path: ['queue', 'api'], tone: 'request', label: 'already abandoned', count: 3, duration: 1.6 },
          { path: ['queue', 'users'], tone: 'error', label: 'timeout', count: 3, duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Same server, two numbers',
          icon: 'Activity',
          rows: [
            { text: 'Throughput', value: '2,000/s' },
            { text: 'Wait before a thread', value: '30 s', tone: 'bad' },
            { text: 'Caller patience', value: '10 s', tone: 'warn' },
            { text: 'Goodput', value: '~0/s', tone: 'bad' },
          ],
        },
        caption: 'Busy, and useful to nobody',
      },
    },
    {
      title: 'Crash',
      tag: 'concept',
      heading: 'Memory runs out and the restart makes it worse',
      eli5: 'The waiting list is written on paper, and the paper pile finally fills the whole room. The host trips and the pile is gone, but every guest comes back at once.',
      body: [
        'Each queued request holds about 50 KB of buffers. Three minutes in, 180,000 of them need 9 GB, and the container limit is 8 GB. The process is killed and the queue vanishes.',
        'Every app retries, and the new instance starts straight into the same burst. It can fill up and die again before it is warm.',
      ],
      keyIdea: 'An unbounded queue adds no capacity. It turns overload into latency, then wasted work, then a crash.',
      metrics: { in: '3,000/s', good: '0/s', queue: '180,000', p99: '30 s+', mem: '8 GB, OOM' },
      metricTones: { good: 'bad', queue: 'bad', mem: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot' },
          { ...queue, sub: 'no limit', status: 'hot', badge: '180,000 waiting' },
          { ...api, status: 'down', badge: 'OOM killed' },
        ],
        links: [link('users', 'queue'), link('queue', 'api')],
        flows: [{ path: ['users', 'queue'], tone: 'request', label: 'retry', count: 5, duration: 1.4 }],
        panel: {
          title: 'Memory at 50 KB per request',
          icon: 'HardDrive',
          rows: [
            { text: '60,000 queued (1 min)', value: '3 GB', tone: 'good' },
            { text: '120,000 queued (2 min)', value: '6 GB', tone: 'warn' },
            { text: '180,000 queued (3 min)', value: '9 GB', tone: 'bad' },
            { text: 'Container limit', value: '8 GB', tone: 'muted' },
          ],
          footer: { text: 'Killed by the OOM killer, queue lost', tone: 'bad' },
        },
        caption: 'The queue ate the memory',
      },
    },
    {
      title: 'Bound it',
      tag: 'concept',
      heading: 'A bounded queue, sized from latency',
      eli5: 'The host keeps a short waiting list, at most ten names. A new guest can be told "we have a ten-minute wait" and knows what to expect.',
      body: [
        'Decide the most queueing you will accept, then multiply by the service rate. For at most 100 ms of waiting at 2,000 a second, cap the queue at **200**.',
        'Now a request waits at most 100 ms for a thread plus 100 ms of work. Memory is capped at 200 x 50 KB = 10 MB, so the queue cannot take the server down.',
        'Queue length is only a proxy. What the caller feels is **queueing time**, so some systems (CoDel style) watch how long the oldest request has waited and start refusing once that passes a target, whatever the length.',
      ],
      keyIdea: 'Bound every queue by the wait you can accept. The bound turns a latency target into a number you configure.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '200 (full)', p99: '210 ms', mem: '1.1 GB' },
      metricTones: { good: 'good', p99: 'good', mem: 'good' },
      scene: {
        nodes: [
          users,
          { ...queue, sub: 'max 200', status: 'active', badge: '200 / 200' },
          { ...api, status: 'ok', load: 82, badge: '2,000/s' },
        ],
        links: [link('users', 'queue'), link('queue', 'api')],
        flows: [{ path: ['users', 'queue', 'api'], tone: 'request', count: 4, duration: 2 }],
        panel: {
          title: 'Sizing the queue',
          icon: 'Gauge',
          code: 'wait    = depth / service rate\n100 ms  = depth / 2,000 per s\ndepth   = 200',
          footer: { text: 'Cap at 200, worst wait 100 ms', tone: 'good' },
        },
        caption: 'At most 200 requests wait, so at most 100 ms',
      },
      quiz: {
        question: 'The API serves 2,000 requests a second and its queue is capped at 200. About how long can a request wait in the queue at worst?',
        options: ['10 ms', '100 ms', '1 second', 'It depends on memory'],
        answer: 1,
        explain: 'Wait is depth divided by service rate: 200 / 2,000 per second = 0.1 s. The cap turns a latency target into a number you can configure.',
      },
    },
    {
      title: 'Fast no',
      tag: 'concept',
      heading: 'When the queue is full, refuse at once',
      eli5: 'When the list has ten names, the host says "sorry, full" the moment a family walks in. They can go elsewhere right away instead of waiting hours for nothing.',
      body: [
        'Reject the new request immediately with `503 Service Unavailable`. Rejecting costs microseconds and no memory. The other 1,000 a second get a fast answer the app can act on: retry later, or tell the user.',
        'A fast no beats a slow no. The slow version spends a thread, memory and the user\'s patience, and still ends in failure.',
      ],
      keyIdea: 'Refusing is cheap when done at the door. It is expensive when done after the work has started.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '200 (full)', p99: '210 ms', mem: '1.1 GB' },
      metricTones: { good: 'good', p99: 'good' },
      scene: {
        nodes: [
          users,
          { ...gateway, status: 'active', badge: 'queue full' },
          { ...queue, sub: 'max 200', status: 'active', badge: '200 / 200' },
          { ...api, status: 'ok', load: 82 },
        ],
        links: [link('users', 'gateway'), link('gateway', 'queue'), link('queue', 'api')],
        flows: [
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', count: 4, duration: 2 },
          { path: ['gateway', 'users'], tone: 'error', label: '503 in 1 ms', count: 2, duration: 1.2, delay: 1 },
          { path: ['api', 'queue', 'gateway', 'users'], tone: 'response', count: 3, duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Per second at the gateway',
          icon: 'Table',
          rows: [
            { text: 'Served in about 200 ms', value: '2,000', tone: 'good' },
            { text: 'Refused in 1 ms', value: '1,000', tone: 'warn' },
            { text: 'Memory for refused', value: '0 KB', tone: 'good' },
          ],
        },
        caption: 'Two of three requests are served fast. The third is refused fast.',
      },
      code: {
        language: 'go',
        title: 'A bounded queue that refuses instead of growing',
        source: `var work = make(chan *Job, 200) // capacity = accepted wait x service rate

func handler(w http.ResponseWriter, r *http.Request) {
    job := newJob(r)
    select {
    case work <- job: // room in the queue
        writeResult(w, <-job.done)
    default: // queue full: refuse now, cheaply
        w.Header().Set("Retry-After", "2")
        http.Error(w, "overloaded", http.StatusServiceUnavailable)
    }
}

func worker() { // run 200 of these
    for job := range work {
        job.done <- process(job)
    }
}`,
        highlight: [1, 6, 8, 9, 10],
      },
    },
    {
      title: 'Pull, not push',
      tag: 'concept',
      heading: 'Between your own services, let the consumer pull',
      eli5: 'Instead of the host pushing plates at the cook, the cook calls "send me three more orders" only when there is room on the counter. The cook can never be buried.',
      body: [
        'A consumer that asks for the next batch only when it has room cannot be flooded. Kafka consumers pull.',
        'HTTP/2 and gRPC streams have flow-control windows, and TCP has its receive window. In each, the receiver tells the sender how much more it may send.',
        'Pull does not remove the overload. It moves the wait into the log, where it shows up as **consumer lag**. That is fine when the work can be late, such as emails or reports, and wrong for interactive requests. The log itself must still be bounded or sized.',
      ],
      keyIdea: 'Pull and window-based flow control make the receiver set the pace, and the backlog waits in a log you must size.',
      metrics: { in: 'paced by consumer', good: '2,000/s', queue: 'lag 60,000', p99: 'minutes, fine for batch', mem: '1 GB' },
      metricTones: { good: 'good', queue: 'warn' },
      scene: {
        nodes: [{ id: 'broker', kind: 'block', at: at(-1.8, 0), label: 'broker log', sub: 'Kafka', icon: 'Layers', tint: 'amber', status: 'active', badge: 'lag 60,000' }, { ...api, status: 'ok', load: 70, badge: 'room for 20' }, db],
        links: [link('broker', 'api', { arrow: 'both' }), link('api', 'db')],
        flows: [
          { path: ['api', 'broker'], tone: 'request', label: 'send 20 more', duration: 1.4 },
          { path: ['broker', 'api'], tone: 'data', label: 'batch of 20', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The receiver sets the pace',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Kafka consumer', value: 'polls a batch' },
            { text: 'HTTP/2 and gRPC', value: 'flow-control window' },
            { text: 'TCP', value: 'receive window' },
          ],
          footer: { text: 'No credit, no sending', tone: 'muted' },
        },
        caption: 'The consumer asks, the queue answers',
      },
    },
    {
      title: 'Push back',
      tag: 'concept',
      heading: 'Tell the caller when to come back',
      eli5: 'If the pantry is slow, the cook falls behind, the counter fills, and the **host** stops seating. The host says "come back in two minutes", so families do not crowd the door.',
      body: [
        '**Back pressure** means a stage that cannot keep up signals the stage before it, so work slows at the source. A rejection is that signal: `503` or `429` with a `Retry-After` header tells a well-behaved client when to try again.',
        'With bounded buffers at every stage, a slow database fills the buffer in front of the API, then the one at the gateway, all the way to the edge, where you choose what to refuse.',
      ],
      keyIdea: 'A rejection is a signal. Bounded buffers carry it from the slowest stage back to the client, with a Retry-After.',
      metrics: { in: '3,000/s', good: '1,250/s', queue: '200 (full)', p99: '300 ms', mem: '1.1 GB' },
      metricTones: { good: 'warn', p99: 'warn' },
      scene: {
        nodes: [
          { ...users, badge: 'retry after 2 s' },
          { ...gateway, status: 'active', badge: 'buffer full' },
          { ...queue, sub: 'max 200', status: 'hot', badge: 'full' },
          { ...api, status: 'active', load: 75 },
          { ...db, status: 'hot', badge: 'slow writes' },
        ],
        links: [
          link('users', 'gateway'),
          link('gateway', 'queue'),
          link('queue', 'api'),
          link('api', 'db', { label: '160 ms per write', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['db', 'api'], tone: 'error', label: 'slow', duration: 1.2 },
          { path: ['queue', 'gateway'], tone: 'error', label: 'full', duration: 1.1, delay: 1.2 },
          { path: ['gateway', 'users'], tone: 'error', label: '503 Retry-After: 2', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'The refusal on the wire',
          icon: 'Code',
          code: 'HTTP/1.1 503 Service Unavailable\nRetry-After: 2\nContent-Type: application/json\n\n{"error": "overloaded"}',
          footer: { text: '200 threads / 160 ms = 1,250/s. Client waits 2 s, with jitter', tone: 'muted' },
        },
        caption: 'Pressure travels from the slowest stage back to the client',
      },
    },
    {
      title: 'Four choices',
      tag: 'tradeoff',
      heading: 'A full stage can block, drop, buffer or throttle',
      eli5: 'A full kitchen has four options: make guests stand at the door, send some away, add chairs, or ask the host to seat fewer per hour. Each has a price.',
      body: [
        '**Block** the sender: safe between your own components, but blocked threads at an edge pile up. **Drop** the work: cheap, and it loses data. **Buffer**: absorbs short bursts, never a long excess. **Throttle**: tell the source a rate, which needs a cooperating sender.',
        'Edges that face the public reject or shed. Inside, prefer pull and windows.',
      ],
      keyIdea: 'Pick the response by who the sender is: block or pull for your own code, reject or shed for the outside world.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '200 (full)', p99: '210 ms', mem: '1.1 GB' },
      scene: {
        nodes: [users, { ...gateway, status: 'active', badge: 'decides here' }, { ...queue, sub: 'max 200', status: 'hot' }],
        links: [link('users', 'gateway'), link('gateway', 'queue')],
        flows: [
          { path: ['users', 'gateway', 'queue'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['gateway', 'users'], tone: 'error', label: 'drop or 503', count: 2, duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'What a full stage can do',
          icon: 'Scale',
          rows: [
            { text: 'Block the sender', value: 'threads pile up', tone: 'warn' },
            { text: 'Drop the work', value: 'cheap, lossy', tone: 'default' },
            { text: 'Buffer more', value: 'bursts only', tone: 'warn' },
            { text: 'Throttle the source', value: 'needs cooperation', tone: 'default' },
          ],
        },
        caption: 'The gateway has to pick one',
      },
    },
    {
      title: 'Shed by priority',
      tag: 'concept',
      heading: 'Not all requests are worth the same',
      eli5: 'Some guests ordered a main dish, some only want free bread. When the kitchen is swamped, the bread requests should be the first ones turned away.',
      body: [
        'Random rejection turns away checkouts as often as analytics pings. But of the 3,000 requests a second, 300 are checkouts, 1,700 are product and cart pages, and 1,000 are recommendation calls and beacons.',
        'The gateway tags each request: **critical** (checkout, payment), **default** (pages, cart) or **sheddable** (recommendations, beacons, prefetch).',
      ],
      keyIdea: 'Label requests by how much they matter before overload, so you can choose what to drop.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '110', p99: '160 ms', mem: '1.0 GB' },
      scene: {
        nodes: [
          { ...users, chips: ['POST /checkout', 'GET /products', { text: 'POST /beacon', tone: 'warn' }] },
          { ...gateway, status: 'active', badge: 'tags priority' },
          { ...queue, sub: 'max 200' },
        ],
        links: [link('users', 'gateway'), link('gateway', 'queue')],
        flows: [{ path: ['users', 'gateway', 'queue'], tone: 'request', count: 5, duration: 1.8 }],
        panel: {
          title: 'The 3,000 a second by class',
          icon: 'List',
          rows: [
            { text: 'critical: checkout, payment', value: '300', tone: 'good' },
            { text: 'default: pages, cart', value: '1,700' },
            { text: 'sheddable: recs, beacons', value: '1,000', tone: 'warn' },
          ],
        },
        caption: 'Three classes of traffic',
      },
    },
    {
      title: 'Shed order',
      tag: 'concept',
      heading: 'Refuse the lowest class first as the queue fills',
      eli5: 'The host turns away bread-only guests once the list is half full, regular tables at nine tenths full, and paying main-dish guests only when there is no chair left.',
      body: [
        'The API reads how full its queue is and refuses the lowest class first: sheddable above 50% full, default above 90%, critical only when there is no room at all.',
        'Here, shedding the sheddable class would bring load to 2,000 a second, which fits. In practice the queue hovers near 50%, so the sheddable class is refused as the queue crosses that line, not wholesale, and **about 1,000 a second** is shed. Every checkout gets through.',
      ],
      keyIdea: 'Shed from the bottom up as the queue fills, so critical traffic is the last thing refused.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '110', p99: '160 ms', mem: '1.0 GB' },
      metricTones: { good: 'good', p99: 'good' },
      scene: {
        nodes: [
          { ...gateway, status: 'active', badge: 'beacon: 503' },
          { ...queue, sub: 'max 200', status: 'active', badge: '55% full' },
          { ...api, status: 'ok', load: 80, badge: 'checkout 100% served' },
          { ...recs, status: 'dim', badge: 'shed' },
        ],
        links: [link('gateway', 'queue'), link('queue', 'api'), link('api', 'recs', { style: 'faint' })],
        flows: [
          { path: ['gateway', 'queue', 'api'], tone: 'request', label: 'checkout', duration: 1.8 },
          { path: ['gateway', 'queue', 'api'], tone: 'request', label: 'product page', count: 2, duration: 1.8, delay: 0.5 },
          { path: ['queue', 'gateway'], tone: 'error', label: 'beacon: 503', count: 2, duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Refuse above this fill level',
          icon: 'Layers',
          rows: [
            { text: 'sheddable', value: '50%', tone: 'warn' },
            { text: 'default', value: '90%' },
            { text: 'critical', value: '100%', tone: 'good' },
          ],
          footer: { text: 'About 2,000/s kept, about 1,000/s shed', tone: 'good' },
        },
        caption: 'Sheddable traffic is refused first, critical traffic last',
      },
      code: {
        language: 'python',
        title: 'Admission by priority',
        source: `SHED_AT = {"sheddable": 0.5, "default": 0.9, "critical": 1.0}
QUEUE_MAX = 200

def admit(request):
    priority = request.headers.get("X-Priority", "default")
    fill = work_queue.qsize() / QUEUE_MAX
    if fill >= SHED_AT.get(priority, SHED_AT["default"]):
        return reject(503, retry_after=2)

    try:
        work_queue.put_nowait(request)
    except queue.Full:  # lost the race for the last slot
        return reject(503, retry_after=2)`,
        highlight: [1, 6, 7, 9, 11],
      },
    },
    {
      title: 'Newest first',
      tag: 'tradeoff',
      heading: 'Under overload, serve the newest request first',
      eli5: 'When the list is very long, the guests at the top have waited so long they left. The host serves the family who just walked in, because they are still there.',
      body: [
        'This matters when the queue is still deep, for example 20,000 entries in a Kafka-style or batch queue. There the oldest request is likely abandoned already, so serve **newest first** (LIFO) and let the stale ones time out.',
        'With the 200-entry bound, worst wait is 100 ms and LIFO matters much less. Dropping from the front is the alternative. Both cost fairness, so use them for time-sensitive work only.',
      ],
      keyIdea: 'When the queue is deep and callers give up after a deadline, the oldest queued request is the least valuable one.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '20,000 (deep)', p99: '10 s', mem: '1.1 GB' },
      metricTones: { good: 'good', queue: 'warn', p99: 'warn' },
      scene: {
        nodes: [
          { ...gateway, status: 'active' },
          { ...queue, sub: 'deep: 20,000', status: 'active', chips: [{ text: 'req 9: 0.1 s old', tone: 'good' }, { text: 'req 8: 0.3 s old', tone: 'good' }, { text: 'req 1: 9 s old', tone: 'bad' }] },
          { ...api, status: 'ok', load: 85, badge: 'takes the newest' },
        ],
        links: [link('gateway', 'queue'), link('queue', 'api')],
        flows: [
          { path: ['gateway', 'queue'], tone: 'request', label: 'new', count: 3, duration: 1.4 },
          { path: ['queue', 'api'], tone: 'request', label: 'newest first', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Deep queue, caller gives up after 10 s',
          icon: 'Clock',
          rows: [
            { text: 'First in, first out', value: 'serves a 9 s old request', tone: 'bad' },
            { text: 'Last in, first out', value: 'serves a 0.1 s old request', tone: 'good' },
          ],
          footer: { text: 'Old requests time out unserved', tone: 'muted' },
        },
        caption: 'Spend threads on callers who are still there',
      },
    },
    {
      title: 'Concurrency limit',
      tag: 'concept',
      heading: 'Admission control: cap what is in flight',
      eli5: 'The host knows the kitchen can cook for 20 tables at once. A 21st table is told to wait outside, no matter how the evening goes.',
      body: [
        '**Admission control** decides at the door whether a request can be finished in time. A **concurrency limit** caps requests in flight. Requests in flight equal rate x latency: 2,000 a second x 0.1 s = 200.',
        'The limit is not the thread pool. It sits at the gateway, counts across all instances, and protects Postgres. Here the two numbers match by coincidence.',
        'It adapts better than a fixed rate. If Postgres slows and requests take 200 ms, a limit of 200 admits only 1,000 a second, what the system can finish.',
      ],
      keyIdea: 'A cap on in-flight work follows the server\'s real speed. A fixed rate does not.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '200 (full)', p99: '210 ms', mem: '1.1 GB' },
      metricTones: { good: 'good' },
      scene: {
        nodes: [users, { ...gateway, status: 'active', badge: '200 in flight' }, { ...api, status: 'active', load: 80, badge: '200 threads' }, { ...db, chips: ['limit 200'] }],
        links: [link('users', 'gateway'), link('gateway', 'api'), link('api', 'db')],
        flows: [
          { path: ['gateway', 'api', 'db'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['gateway', 'users'], tone: 'error', label: '201st: 503', duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'In flight = rate x latency',
          icon: 'Gauge',
          rows: [
            { text: 'Normal: 100 ms per request', value: '2,000/s', tone: 'good' },
            { text: 'Slow: 200 ms per request', value: '1,000/s', tone: 'warn' },
            { text: 'Gateway limit stays at', value: '200 in flight' },
          ],
        },
        caption: 'The limit holds while latency moves',
      },
    },
    {
      title: 'Adaptive limit',
      tag: 'concept',
      heading: 'Let the server learn its own limit',
      eli5: 'The host starts by sending one more table to the kitchen each time things go well. When the cook slows down, the host cuts the number of tables sharply.',
      body: [
        'A fixed limit goes stale. Raise it by one while latency stays near normal, and cut it by a fraction when latency climbs, the way TCP finds the speed of a network.',
        'The server learns its own capacity during a sale, a slow database or a bad deploy. Postgres slows, requests take 160 ms, and the limit falls from 200 to 140 to protect it.',
        'Check: 140 / 0.16 s is about **875 a second**, below the 1,250 the 200 threads could push. The gap is load kept off the database.',
      ],
      keyIdea: 'Add a little when healthy, cut a lot when slow, and the limit finds the real capacity on its own.',
      metrics: { in: '3,000/s', good: '875/s', queue: '110', p99: '300 ms', mem: '1.0 GB' },
      metricTones: { good: 'warn' },
      scene: {
        nodes: [
          { ...gateway, status: 'active' },
          { ...api, status: 'active', load: 78, badge: 'limit 200 → 140' },
          { ...db, status: 'hot', badge: 'p50 160 ms' },
        ],
        links: [link('gateway', 'api'), link('api', 'db', { label: '160 ms', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'db'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['db', 'api'], tone: 'error', label: 'slow', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'The limit moves with latency',
          icon: 'TrendingUp',
          rows: [
            { text: 'Latency near normal', value: 'limit + 1', tone: 'good' },
            { text: 'Latency climbs', value: 'limit x 0.7', tone: 'warn' },
            { text: 'Postgres slows to 160 ms', value: '200 → 140', tone: 'bad' },
          ],
        },
        caption: 'The database slowed, so the API lowers its own limit',
      },
      quiz: {
        question: 'An adaptive concurrency limit sees latency climbing well above normal. What should it do?',
        options: [
          'Raise the limit so more requests are absorbed',
          'Cut the limit by a fraction',
          'Leave the limit fixed until an operator acts',
          'Remove the queue bound',
        ],
        answer: 1,
        explain: 'Rising latency means the server is past what it can finish. Cutting the limit sheds the excess and lets latency recover, then the limit creeps back up while things stay healthy.',
      },
    },
    {
      title: 'Deadlines',
      tag: 'concept',
      heading: 'Pass the remaining time downstream',
      eli5: 'The host writes on each order "this family leaves at 8:00". The cook checks the clock, and skips an order that cannot be ready by then.',
      body: [
        'A **deadline** is a budget. The gateway gives each request, say, 10 seconds and passes the time left to every downstream call.',
        'A server that sees too little time left refuses before starting, so it never spends a thread on an answer nobody will read. The check is a few lines at admission.',
      ],
      keyIdea: 'Carry the caller\'s deadline with the request, so every stage can refuse work that cannot finish in time.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '110', p99: '160 ms', mem: '1.0 GB' },
      scene: {
        nodes: [
          { ...gateway, status: 'active', badge: 'deadline 10 s' },
          { ...queue, sub: 'max 200', status: 'active' },
          { ...api, status: 'active' },
          { ...db, status: 'hot', badge: 'p50 160 ms' },
        ],
        links: [link('gateway', 'queue'), link('queue', 'api'), link('api', 'db')],
        flows: [
          { path: ['gateway', 'queue'], tone: 'request', label: '9.8 s left', duration: 1.4 },
          { path: ['queue', 'api', 'db'], tone: 'request', label: '9.6 s left', duration: 1.4, delay: 1.5 },
          { path: ['queue', 'gateway'], tone: 'error', label: '0.2 s left: refuse', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Time left per hop',
          icon: 'Timer',
          rows: [
            { text: 'Gateway sets budget', value: '10.0 s' },
            { text: 'After the queue', value: '9.8 s', tone: 'good' },
            { text: 'After the API', value: '9.6 s', tone: 'good' },
            { text: 'Under what the work needs', value: 'refuse', tone: 'bad' },
          ],
        },
        caption: 'Every hop checks the clock before it starts',
      },
      code: {
        language: 'python',
        title: 'Refuse work that cannot finish before its deadline',
        source: `def admit_by_deadline(request, fill):
    # The gateway sends the caller's deadline as unix seconds.
    raw = request.headers.get("X-Deadline")
    if raw is None:
        return True  # no deadline sent: admit
    expected = fill * QUEUE_MAX / SERVICE_RATE + P50_RUNTIME
    return time.time() + expected <= float(raw)`,
        highlight: [3, 6],
      },
    },
    {
      title: 'Degrade',
      tag: 'concept',
      heading: 'Do less per request instead of refusing',
      eli5: 'On a packed night the kitchen drops the fancy garnish and serves soup that was made ahead. Guests still get a good meal, and the kitchen feeds more of them.',
      body: [
        '**Graceful degradation** makes each request cheaper. Under load a page shows a fixed bestseller list, reads details from a cache up to 60 seconds old, and drops reviews. Put each mode behind a switch and test it on a quiet day.',
        'Each page costs about 60 ms instead of 100, so pages alone could reach **3,300 a second**. The mix: 1,700 pages x 60 ms is 102 threads, 300 checkouts x 100 ms is 30, and 1,000 cached bestseller calls at 60 ms is 60. That is 192 of 200 threads, so nobody is refused.',
      ],
      keyIdea: 'Lower the quality of the answer before lowering the availability of the service.',
      metrics: { in: '3,000/s', good: '3,000/s', queue: '~20', p99: '120 ms', mem: '0.9 GB' },
      metricTones: { good: 'good', p99: 'good', queue: 'good' },
      scene: {
        nodes: [
          { ...queue, sub: 'max 200', status: 'ok', badge: '20' },
          { ...api, status: 'ok', load: 55, badge: 'degraded mode' },
          { ...recs, status: 'dim', badge: 'switched off' },
          { ...cache, status: 'active', badge: 'up to 60 s old' },
        ],
        links: [link('queue', 'api'), link('api', 'recs', { style: 'faint' }), link('api', 'cache')],
        flows: [
          { path: ['queue', 'api'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['api', 'cache'], tone: 'request', label: 'product 42', duration: 1, delay: 1.5 },
          { path: ['cache', 'api'], tone: 'response', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Cost of a product page',
          icon: 'Table',
          rows: [
            { text: 'Full page', value: '100 ms, 2,000/s' },
            { text: 'Degraded page', value: '60 ms, 3,300/s if pages only', tone: 'good' },
            { text: 'Mixed load, 3,000/s', value: '192 of 200 threads', tone: 'good' },
            { text: 'Checkout', value: 'never degrades', tone: 'muted' },
          ],
        },
        caption: 'Cheaper pages: no recommendations, product details from cache',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Case: every layer retries',
      eli5: 'The kitchen closes for two minutes. Every guest shouts their order three times, and each waiter repeats every shout three times.',
      body: [
        'Postgres fails over and is unavailable for two minutes. The app retries each failed call up to 3 times with no wait, and the gateway also retries each attempt up to 3 times.',
        'One user action becomes **9 calls** to the API. Load jumps from 3,000 to over 20,000 a second.',
      ],
      keyIdea: 'Retries are load. Stacked across layers they multiply.',
      metrics: { in: '20,000+/s', good: '~0/s', queue: '200 (full)', p99: '10 s', mem: '1.1 GB' },
      metricTones: { in: 'bad', good: 'bad', p99: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot', badge: '3 tries each' },
          { ...gateway, status: 'hot', badge: '3 tries each' },
          { ...api, status: 'hot', load: 100, badge: '9 calls per action' },
        ],
        links: [link('users', 'gateway'), link('gateway', 'api')],
        flows: [
          { path: ['users', 'gateway'], tone: 'request', label: 'retry', count: 5, duration: 1 },
          { path: ['gateway', 'api'], tone: 'request', label: 'retry x3', count: 6, duration: 1, delay: 1 },
          { path: ['api', 'gateway', 'users'], tone: 'error', label: '503', count: 4, duration: 1.4, delay: 2.1 },
        ],
        panel: {
          title: 'One click, many calls',
          icon: 'Repeat',
          rows: [
            { text: 'App tries', value: 'x 3' },
            { text: 'Gateway tries per app try', value: 'x 3' },
            { text: 'Calls reaching the API', value: '9', tone: 'bad' },
          ],
          footer: { text: '3,000/s becomes 20,000+/s', tone: 'bad' },
        },
        caption: 'The outage multiplies its own load',
      },
    },
    {
      title: 'Metastable',
      tag: 'case',
      heading: 'The outage that outlived its cause',
      eli5: 'The kitchen reopens, but the pile of shouted orders is so big that every meal takes too long, guests shout again, and the pile never shrinks.',
      body: [
        'The database comes back and the API still does not recover. Queues are full of requests that will time out, and the extra load keeps latency above the timeout, which creates more retries.',
        'The trigger is gone and the overload sustains itself. This is a **metastable failure**, and it often ends only when someone blocks traffic by hand.',
        'Remedies: shed hard, open breakers, stop retries, scale before the queue clears.',
      ],
      keyIdea: 'A system in a retry loop stays down after the original fault is fixed, unless something breaks the loop.',
      metrics: { in: '20,000+/s', good: '~0/s', queue: '200 (full)', p99: '10 s', mem: '1.1 GB' },
      metricTones: { in: 'bad', good: 'bad', p99: 'bad' },
      scene: {
        nodes: [
          { ...gateway, status: 'hot', badge: 'retrying' },
          { ...queue, sub: 'max 200', status: 'hot', badge: 'full' },
          { ...api, status: 'hot', load: 100, badge: 'timeouts' },
          { ...db, status: 'ok', badge: 'back after 2 min' },
        ],
        links: [link('gateway', 'queue'), link('queue', 'api'), link('api', 'db')],
        flows: [
          { path: ['gateway', 'queue'], tone: 'request', label: 'retry', count: 5, duration: 1 },
          { path: ['queue', 'gateway'], tone: 'error', label: '503', count: 4, duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'Why it does not recover',
          icon: 'Activity',
          rows: [
            { text: 'Postgres', value: 'healthy again', tone: 'good' },
            { text: 'Latency with retries', value: 'above timeout', tone: 'bad' },
            { text: 'Timeouts', value: 'cause retries', tone: 'bad' },
          ],
          footer: { text: 'Load keeps itself high', tone: 'bad' },
        },
        caption: 'The database is healthy again, and retries keep the API down',
      },
    },
    {
      title: 'Break the loop',
      tag: 'concept',
      heading: 'A circuit breaker stops calls to a failing dependency',
      eli5: 'When the pantry door is jammed, the cook stops walking to it every few seconds. They put up a sign, wait a minute, then send one person to test the door.',
      body: [
        'A **circuit breaker** counts failures to one dependency. Past a threshold it **opens** and fails calls instantly, holding no thread. After a pause it goes **half-open** and lets a few trial calls through. If they succeed it **closes**.',
        'Add a timeout on every call and a **bulkhead** (a separate thread pool per dependency), so one slow service cannot hold all 200 threads. The open breaker is what breaks the metastable loop: the load on the recovering dependency drops to a trickle until it is healthy.',
      ],
      keyIdea: 'Fail fast on a dependency that is down, and probe it gently until it recovers.',
      metrics: { in: '3,000/s', good: '1,000/s', queue: '30', p99: '80 ms', mem: '1.0 GB' },
      metricTones: { good: 'warn', p99: 'good' },
      scene: {
        nodes: [{ ...gateway, status: 'active' }, { ...api, status: 'active', load: 40, badge: 'breaker open' }, { ...db, status: 'down', badge: 'recovering' }],
        links: [link('gateway', 'api'), link('api', 'db', { label: 'calls blocked', labelTone: 'warn' })],
        flows: [
          { path: ['gateway', 'api'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['api', 'gateway'], tone: 'error', label: 'fast fail', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Breaker states',
          icon: 'Shield',
          rows: [
            { text: 'Closed', value: 'calls flow, failures counted', tone: 'good' },
            { text: 'Open', value: 'fail at once for 30 s', tone: 'bad' },
            { text: 'Half-open', value: '3 trial calls', tone: 'warn' },
            { text: 'Bulkhead', value: 'own pool per dependency' },
          ],
          footer: { text: 'Trial calls pass: close. Fail: open again', tone: 'muted' },
        },
        caption: 'The breaker keeps load off the recovering database',
      },
    },
    {
      title: 'Retry budget',
      tag: 'concept',
      heading: 'Retry in one layer, with backoff and a budget',
      eli5: 'Only the family at the table may re-order, not the waiter too. They wait a random while before asking again, and only a few may ask at a time.',
      body: [
        'Retry in one layer only, usually the client nearest the user. Use exponential backoff with jitter and respect `Retry-After`.',
        'Retry only requests that are safe to repeat: reads, or writes that carry an **idempotency key**. A retried `POST /checkout` without one can be applied twice.',
        'Give each client a **retry budget**, for example retries at most 10% of its requests. During an outage retries add 10% load instead of 9 times the load.',
      ],
      keyIdea: 'Retries are load. Without a budget they multiply across layers and keep a system down.',
      metrics: { in: '3,300/s', good: '2,000/s', queue: '110', p99: '200 ms', mem: '1.0 GB' },
      metricTones: { in: 'good', good: 'good' },
      scene: {
        nodes: [
          { ...users, badge: 'budget 10%' },
          { ...gateway, badge: 'no retries' },
          { ...api, status: 'active', load: 85 },
        ],
        links: [link('users', 'gateway'), link('gateway', 'api')],
        flows: [
          { path: ['users', 'gateway', 'api'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['api', 'gateway', 'users'], tone: 'error', label: '503 Retry-After', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'During an outage',
          icon: 'Repeat',
          rows: [
            { text: 'Without a budget', value: '9 calls per action', tone: 'bad' },
            { text: 'One layer, 10% budget', value: '1.1 calls per action', tone: 'good' },
          ],
          footer: { text: 'Backoff 200, 400 ms with full jitter', tone: 'muted' },
        },
        caption: 'Retries add 10% load, not 900%',
      },
      code: {
        language: 'typescript',
        title: 'Client retries with backoff, jitter and a 10% budget',
        source: `const budget = { requests: 0, retries: 0 };
setInterval(() => { budget.requests = 0; budget.retries = 0; }, 60_000); // reset every minute

const safeToRetry = (req: Request) =>
  req.method === 'GET' || req.headers.has('Idempotency-Key');

async function call(req: Request, attempt = 1): Promise<Response> {
  budget.requests += attempt === 1 ? 1 : 0;
  const res = await fetch(req.clone());
  if (res.status < 500 && res.status !== 429) return res;
  if (!safeToRetry(req)) return res;                // never repeat an unkeyed write

  const overBudget = budget.retries >= 0.1 * budget.requests;
  if (attempt >= 3 || overBudget) return res;      // give up, show an error

  const hinted = Number(res.headers.get('Retry-After') ?? 0) * 1000;
  const backoff = 200 * 2 ** (attempt - 1);       // 200, 400 ms
  await sleep(hinted + Math.random() * backoff);  // hint plus jitter, so clients spread out
  budget.retries += 1;
  return call(req, attempt + 1);
}`,
        highlight: [4, 5, 13, 16, 20],
      },
    },
    {
      title: 'Not rate limiting',
      tag: 'tradeoff',
      heading: 'Load shedding and rate limiting answer different questions',
      eli5: 'A rule "each family may order 3 dishes" stops one greedy table. It does nothing when 500 polite families arrive at once. For that, the kitchen itself must say "we are full".',
      body: [
        'A **rate limiter** asks: is this client over its quota? The quota is a fixed number per key, busy server or not. **Load shedding** asks: can I take more work right now? It looks at the server\'s own state, not at who sent the request.',
        'With 10 a second per user, 30,000 shoppers sending one request each every 10 seconds are all within quota and still overload the API. A scraper at 2,000 a second is stopped by the limiter at once. Shedding would refuse shoppers too.',
      ],
      keyIdea: 'Rate limiting enforces fairness per client. Load shedding protects the server from the total.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '110', p99: '160 ms', mem: '1.0 GB' },
      metricTones: { good: 'good' },
      scene: {
        nodes: [
          { ...users, sub: '30,000 users, 3,000 req/s' },
          scraper,
          { ...gateway, status: 'active', badge: '10 req/s per user' },
          { ...api, status: 'ok', badge: 'sheds by its own load' },
        ],
        links: [link('users', 'gateway'), link('scraper', 'gateway', { route: 'elbow' }), link('gateway', 'api')],
        flows: [
          { path: ['scraper', 'gateway'], tone: 'request', count: 4, duration: 1 },
          { path: ['gateway', 'scraper'], tone: 'error', label: '429', count: 2, duration: 1, delay: 1.1 },
          { path: ['users', 'gateway', 'api'], tone: 'request', label: 'within quota', count: 3, duration: 2, delay: 0.4 },
        ],
        panel: {
          title: 'Who catches what',
          icon: 'Scale',
          rows: [
            { text: 'One scraper at 2,000/s', value: 'limiter', tone: 'good' },
            { text: '30,000 polite shoppers', value: 'shedding', tone: 'good' },
            { text: 'Limiter alone vs the crowd', value: 'misses', tone: 'bad' },
          ],
        },
        caption: 'The limiter stops one heavy client. Shedding guards against the crowd.',
      },
    },
    {
      title: 'Use all three',
      tag: 'tradeoff',
      heading: 'Rate limit, shed and autoscale together',
      eli5: 'A good restaurant limits orders per table, says "full" when the kitchen is busy, and calls in extra cooks. The extra cooks take 20 minutes to arrive, so the first two rules cover the gap.',
      body: [
        'Rate limit at the edge for fairness and abuse. Shed and degrade inside every service to protect itself.',
        'Autoscaling is the third lever. It adds capacity in minutes, and shedding is what keeps you up during those minutes. Scaling alone also costs money you may not need to spend on a 10-minute spike.',
      ],
      keyIdea: 'Rate limits give fairness, shedding gives safety in seconds, and autoscaling gives capacity in minutes.',
      metrics: { in: '3,000/s', good: '3,000/s (degraded)', queue: '~20', p99: '120 ms', mem: '0.9 GB' },
      metricTones: { good: 'good' },
      scene: {
        nodes: [
          { ...gateway, status: 'ok', badge: 'rate limit' },
          { ...api, status: 'ok', badge: 'sheds, degrades' },
          { id: 'api2', kind: 'server', at: at(9, 4.5), label: 'new replica', sub: 'in 3 minutes', status: 'dim' },
        ],
        links: [link('gateway', 'api'), link('gateway', 'api2', { style: 'faint', route: 'elbow' })],
        flows: [{ path: ['gateway', 'api'], tone: 'request', count: 3, duration: 1.6 }],
        panel: {
          title: 'Three levers, three time scales',
          icon: 'Clock',
          rows: [
            { text: 'Rate limit', value: 'per client, always' },
            { text: 'Shed and degrade', value: 'within seconds', tone: 'good' },
            { text: 'Autoscale', value: 'within minutes', tone: 'warn' },
          ],
        },
        caption: 'Shedding covers the minutes before new servers arrive',
      },
    },
    {
      title: 'Watch it',
      tag: 'concept',
      heading: 'Know when you are shedding',
      eli5: 'The host keeps a tally on a notepad: how long the list is, how many were turned away, and how long the kitchen takes. The manager reads it, not just the cook.',
      body: [
        'Watch queue depth, in-flight count, shed rate per class and p99 of the requests you admitted. A rising shed rate with a flat p99 means the system is doing its job.',
        'Alert on a sustained shed rate or a queue that stays above half full, not on a single spike. Load test past capacity before launch to see where it bends.',
      ],
      keyIdea: 'Shedding that nobody sees is a silent outage for the users it refuses.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '110', p99: '160 ms', mem: '1.0 GB' },
      metricTones: { good: 'good', p99: 'good' },
      scene: {
        nodes: [{ ...queue, sub: 'max 200', status: 'active', badge: '55% full' }, { ...api, status: 'ok', load: 80 }, monitor],
        links: [link('queue', 'api'), link('queue', 'monitor', { style: 'dashed', route: 'elbow' }), link('api', 'monitor', { style: 'dashed', route: 'elbow' })],
        flows: [{ path: ['queue', 'api'], tone: 'request', count: 3, duration: 1.6 }, { path: ['api', 'monitor'], tone: 'event', label: 'metrics', duration: 1.4, delay: 1 }],
        panel: {
          title: 'What to graph',
          icon: 'Activity',
          rows: [
            { text: 'Queue depth', value: '110 / 200' },
            { text: 'In flight', value: '160 / 200' },
            { text: 'Shed rate, sheddable', value: '1,000/s', tone: 'warn' },
            { text: 'p99 of admitted', value: '160 ms', tone: 'good' },
          ],
        },
        caption: 'Four signals tell you the story',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Refuse early, refuse the right things, refuse cheaply',
      eli5: 'A good restaurant keeps a short waiting list, says "full" early, drops extras before main dishes, cooks simpler food on busy nights, and stops guests from shouting the same order again and again.',
      body: [
        'Every queue needs a bound sized from the wait you can accept. When it fills, refuse fast and tell the caller when to come back. Shed the least important traffic first, and admit only work that can finish before its deadline.',
        'Before refusing, make requests cheaper with planned degraded modes. Keep retries in one layer with a budget. Rate limits handle unfair clients. Shedding handles too much total work.',
      ],
      keyIdea: 'Overload is a decision you make ahead of time: what to drop, what to degrade, and what to keep at any cost.',
      metrics: { in: '3,000/s', good: '3,000/s (degraded)', queue: '~20', p99: '120 ms', mem: '0.9 GB' },
      metricTones: { good: 'good', p99: 'good', mem: 'good' },
      scene: {
        nodes: [users, { ...gateway, status: 'ok' }, { ...queue, sub: 'max 200', status: 'ok' }, { ...api, status: 'ok', load: 55 }],
        links: [link('users', 'gateway'), link('gateway', 'queue'), link('queue', 'api')],
        flows: [
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['api', 'queue', 'gateway', 'users'], tone: 'response', count: 3, duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'The toolkit',
          icon: 'Shield',
          rows: [
            { text: 'Bounded queue, fast 503', value: 'refuse early' },
            { text: 'Priority, newest first', value: 'refuse the right work' },
            { text: 'Limits and deadlines', value: 'start only what finishes' },
            { text: 'Degrade, retry budget', value: 'do less, retry less' },
          ],
        },
      },
      quiz: {
        question: 'Your API serves 2,000 requests a second. A sale brings 3,000. Which change keeps checkout working without losing the server?',
        options: [
          'Remove the queue limit so no request is ever refused',
          'Raise every user\'s rate limit',
          'Bound the queue and shed sheddable traffic such as recommendations and beacons first',
          'Have the gateway retry every failed request three times',
        ],
        answer: 2,
        explain: 'An unbounded queue only delays the crash, and retries add load. A bounded queue with priority shedding keeps the server inside its capacity and spends that capacity on the requests that matter.',
      },
    },
  ],
};
