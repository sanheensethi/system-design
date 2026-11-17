import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'client', at: at(-7.6, -3.8), label: 'shoppers', sub: '300 pages/s' };
const web: SceneNode = { id: 'web', kind: 'block', size: 0.72, at: at(-3.8, -3.8), label: 'storefront', sub: 'pages + checkout', icon: 'Globe', tint: 'blue' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3.8), label: 'product API', sub: '200 threads', icon: 'Server', tint: 'violet' };
const breaker: SceneNode = { id: 'breaker', kind: 'block', size: 0.72, at: at(3.8, -3.8), label: 'breaker', sub: 'recs calls', icon: 'Zap', tint: 'gray' };
const catalog: SceneNode = { id: 'catalog', kind: 'block', size: 0.72, at: at(-3.8, 3.8), label: 'catalog', sub: '20 ms', icon: 'Package', tint: 'teal' };
const reviews: SceneNode = { id: 'reviews', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'reviews', sub: '30 ms', icon: 'Star', tint: 'amber' };
const recs: SceneNode = { id: 'recs', kind: 'block', size: 0.72, at: at(3.8, 3.8), label: 'recs', sub: '40 ms', icon: 'TrendingUp', tint: 'green' };
const cart: SceneNode = { id: 'cart', kind: 'block', size: 0.72, at: at(-3.8, 3.8), label: 'cart + checkout', sub: 'never calls recs', icon: 'ShoppingBag', tint: 'amber' };
const reports: SceneNode = { id: 'reports', kind: 'block', size: 0.72, at: at(3.8, -3.8), label: 'report job', sub: '30 s queries', icon: 'FileText', tint: 'gray' };
const pg: SceneNode = { id: 'pg', kind: 'db', at: at(1.9, 3.8), label: 'Postgres', sub: '50 connections' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const circuitBreakers: Lesson = {
  id: 'circuit-breakers',
  title: 'Circuit breakers and bulkheads',
  tagline: 'Stop calling a dependency that is failing, and wall each one off so it cannot drown the rest.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why a slow dependency is worse than a dead one, and how it cascades up the call chain',
    'How retries and timeouts interact with a failing service',
    'The closed, open and half-open states of a circuit breaker',
    'What counts as a failure, and how to set trip thresholds without flapping',
    'Fallbacks: what to return when the breaker is open',
    'Bulkheads: separate thread pools and connection pools per dependency',
    'How timeouts, retries, breakers and bulkheads stack, and how to watch them',
  ],
  metrics: [
    { key: 'threads', label: 'API threads busy', icon: 'Cpu' },
    { key: 'p99', label: 'Page p99', icon: 'Timer' },
    { key: 'ok', label: 'Pages served', icon: 'Activity' },
    { key: 'recs', label: 'Calls to recs', icon: 'Signal' },
  ],
  steps: [
    {
      title: 'Slow extra',
      tag: 'problem',
      heading: 'An optional feature takes the product page down',
      eli5: 'A restaurant has one slow cook at the dessert counter. Every waiter ends up standing there waiting for dessert. Nobody is left to bring soup. The **product API** is the team of waiters.',
      body: [
        'The product API serves **300 pages per second**. Each page calls catalog (20 ms), reviews (30 ms) and recommendations (40 ms), and about 27 of its 200 threads are busy.',
        'Then recommendations ships a bad deploy and stops answering. It is only a "you may also like" row. Catalog and reviews are healthy, yet the page cannot get a thread.',
      ],
      keyIdea: 'The least important service in the page can be the one that breaks the whole page.',
      metrics: { threads: '200 / 200', p99: '> 5 s', ok: '15%', recs: '300/s, all time out' },
      metricTones: { threads: 'bad', p99: 'bad', ok: 'bad', recs: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot', load: 100, chips: [{ text: 'GET /product/9', tone: 'warn' }], badge: '200 / 200 waiting' },
          { ...catalog, status: 'dim' },
          { ...reviews, status: 'dim' },
          { ...recs, status: 'down', sub: 'not answering' },
        ],
        links: [link('api', 'catalog'), link('api', 'reviews'), link('api', 'recs', { label: 'no reply', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'recs'], tone: 'request', label: 'GET /recs', count: 4, duration: 1.2 },
          { path: ['recs', 'api'], tone: 'error', label: 'timeout 1 s', duration: 2.4, delay: 1.4 },
        ],
        panel: {
          title: 'Product API thread pool',
          icon: 'Cpu',
          rows: [
            { text: 'Before the deploy', value: '27 / 200 busy', tone: 'good' },
            { text: 'Waiting on recs', value: '200 busy', tone: 'bad' },
            { text: 'Waiting on catalog, reviews', value: '0 (no thread)', tone: 'warn' },
          ],
          footer: { text: 'Healthy services sit idle', tone: 'bad' },
        },
        caption: 'Healthy services sit idle while threads wait on a dead one',
      },
    },
    {
      title: 'Slow beats dead',
      tag: 'concept',
      heading: 'A hung service holds a thread for the full timeout',
      eli5: 'If the dessert counter has a locked door, a waiter knows at once and moves on. If the cook says "one more minute" forever, the waiter stands there. Slow is worse than closed.',
      body: [
        'Busy threads equal calls per second times seconds per call. Normally 300 × 0.09 s is **27 threads**. A dead service that refuses connections fails in milliseconds, so the cost is tiny.',
        'A hung service never answers. With a 1 second timeout, 300 calls per second hold 300 × 1 s = **300 threads**. The pool has 200.',
      ],
      keyIdea: 'Busy threads = request rate × time held. A slow dependency multiplies the time, and that is what drains the pool.',
      metrics: { threads: '200 / 200', p99: '> 5 s', ok: '15%', recs: '300/s, all time out' },
      metricTones: { threads: 'bad', p99: 'bad', ok: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot', load: 100 },
          { ...recs, status: 'down', sub: 'hangs, no error' },
          { ...reviews, status: 'ok' },
        ],
        links: [link('api', 'reviews', { label: '30 ms' }), link('api', 'recs', { label: 'held 1 s', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'reviews', 'api'], tone: 'response', duration: 1.2 },
          { path: ['api', 'recs'], tone: 'request', count: 3, duration: 1.2, delay: 1.3 },
          { path: ['recs', 'api'], tone: 'error', label: 'timeout 1 s', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'Threads = rate × time held',
          icon: 'Gauge',
          rows: [
            { text: 'Healthy: 300/s × 0.09 s', value: '27', tone: 'good' },
            { text: 'Refused: 300/s × 0.005 s', value: '2', tone: 'good' },
            { text: 'Hung: 300/s × 1 s', value: '300', tone: 'bad' },
            { text: 'Pool size', value: '200', tone: 'muted' },
          ],
          footer: { text: '300 needed, 200 exist', tone: 'bad' },
        },
        caption: 'Time held is the multiplier',
      },
      quiz: {
        question: 'A dependency starts hanging until a 2 s timeout. Your service sends it 500 calls per second. How many threads do those calls hold at once?',
        options: ['250', '500', '1,000', '2,000'],
        answer: 2,
        explain: 'Busy threads equal calls per second times seconds held: 500 × 2 s = 1,000. A pool smaller than that runs dry, and every other feature that shares it starves.',
      },
    },
    {
      title: 'Timeouts',
      tag: 'tradeoff',
      heading: 'A tighter timeout helps, but it is not enough',
      eli5: 'Telling waiters "wait at most five seconds" for dessert helps. But they still walk to the counter all day, and every trip costs a few seconds of soup service.',
      body: [
        'Cut the timeout from 1 s to 100 ms. A page now holds a thread for 20 + 30 + 100 = 150 ms, so 300 × 0.15 s = **45 threads**, 30 of them waiting on recs. The pool survives. Set it near the dependency\'s p99, not a round number.',
        'A timeout limits how long one call waits. It does not stop you from sending 300 more calls into the same hole every second, and it kills healthy calls that were only a little slow.',
      ],
      keyIdea: 'A timeout limits how long one call waits. It does not stop you from sending 300 more calls into the same hole every second.',
      metrics: { threads: '45 / 200', p99: '250 ms', ok: '100% (slow)', recs: '300/s, all time out' },
      metricTones: { threads: 'warn', p99: 'warn', recs: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'active', load: 23, chips: [{ text: 'timeout 100 ms', tone: 'good' }] },
          { ...recs, status: 'down', sub: 'still hung' },
          { ...web, status: 'ok' },
        ],
        links: [link('web', 'api'), link('api', 'recs', { label: '300 calls/s, all wasted', labelTone: 'warn' })],
        flows: [
          { path: ['web', 'api'], tone: 'request', duration: 1.0 },
          { path: ['api', 'recs'], tone: 'request', count: 4, duration: 1.0, delay: 1.1 },
          { path: ['recs', 'api'], tone: 'error', label: 'timeout 100 ms', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Timeout 1 s versus 100 ms',
          icon: 'Timer',
          rows: [
            { text: '1 s: whole page 300/s x 1.05 s', value: '315', tone: 'bad' },
            { text: '100 ms: whole page 300/s x 0.15 s', value: '45', tone: 'good' },
            { text: 'Calls into the dead service', value: '300/s both', tone: 'warn' },
          ],
          footer: { text: 'Each page still pays 100 ms', tone: 'warn' },
        },
        caption: 'The pool survives, the useless calls continue',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Case: retries triple the load on a dying service',
      eli5: 'A waiter who hears "no dessert" tries again twice more. Three waiters doing that to one sick cook means three times the shouting, and the cook never gets a minute to recover.',
      body: [
        'The client retries each failed call twice, as the retries lesson suggests for blips. A real outage turns that into 3 attempts per page: **900 calls per second** hitting a service that could not handle 300.',
        'Recommendations was struggling, and now it gets three times the work. It cannot recover while it is being hammered. This is a **retry storm**, and retries make an outage longer, not shorter.',
      ],
      keyIdea: 'Retries help with a blip and hurt in an outage. Something has to tell the caller that this dependency is down and to stop.',
      metrics: { threads: '200 / 200', p99: '> 5 s', ok: '10%', recs: '900/s, all time out' },
      metricTones: { threads: 'bad', p99: 'bad', ok: 'bad', recs: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot', load: 100, chips: [{ text: 'retry x2', tone: 'warn' }] },
          { ...recs, status: 'down', load: 100, sub: 'overloaded' },
        ],
        links: [link('api', 'recs', { label: '3 attempts per page', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'recs'], tone: 'request', label: 'attempt 1', duration: 1.2 },
          { path: ['api', 'recs'], tone: 'request', label: 'retry 1', duration: 1.2, delay: 0.6 },
          { path: ['api', 'recs'], tone: 'request', label: 'retry 2', duration: 1.2, delay: 1.2 },
          { path: ['recs', 'api'], tone: 'error', label: 'timeout', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Load on recommendations',
          icon: 'Repeat',
          rows: [
            { text: 'Normal traffic', value: '300/s', tone: 'good' },
            { text: 'With 2 retries each', value: '900/s', tone: 'bad' },
            { text: 'Capacity before the bad deploy', value: '400/s', tone: 'muted' },
            { text: 'Retry budget: retries capped at 10% of requests', value: '330/s max', tone: 'good' },
          ],
          footer: { text: 'The dependency cannot recover', tone: 'bad' },
        },
        caption: 'Retries multiply the load on the thing that is failing',
      },
    },
    {
      title: 'Cascade up',
      tag: 'case',
      heading: 'Case: the failure climbs the call chain',
      eli5: 'The waiters are stuck at the dessert counter, so the host at the door has nobody to hand guests to. Soon the host is stuck too, and guests wait outside. The **storefront** is the host.',
      body: [
        'The storefront calls the product API and waits for it. The API is slow, so the storefront\'s own threads pile up the same way. Within a minute its pool is full too.',
        'This is a **cascading failure**. A fault in one leaf service spreads upward through every caller that waits on it. The first failure was in the least important service.',
      ],
      keyIdea: 'Slowness spreads to every caller that waits. To stop a cascade, some layer has to refuse to wait.',
      metrics: { threads: '200 / 200', p99: '> 5 s', ok: '5%', recs: '300/s, all time out' },
      metricTones: { threads: 'bad', p99: 'bad', ok: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot' },
          { ...web, status: 'hot', load: 100, badge: 'pool full' },
          { ...api, status: 'hot', load: 100, badge: 'pool full' },
          { ...recs, status: 'down', sub: 'not answering' },
        ],
        links: [link('users', 'web'), link('web', 'api'), link('api', 'recs')],
        flows: [
          { path: ['recs', 'api'], tone: 'error', label: 'slow', duration: 1.4 },
          { path: ['api', 'web'], tone: 'error', label: 'slow', duration: 1.4, delay: 1.2 },
          { path: ['web', 'users'], tone: 'error', label: '504', duration: 1.4, delay: 2.4 },
        ],
        caption: 'The fault travels toward the user, one waiting caller at a time',
      },
    },
    {
      title: 'Sideways',
      tag: 'case',
      heading: 'Case: checkout goes down with it',
      eli5: 'The host also seats people who only want to pay the bill. With the host stuck waiting on dessert, those guests cannot leave either. Dessert broke, and the payment desk looks closed.',
      body: [
        'The storefront also serves cart and checkout. Those never touch recommendations, but they share the storefront\'s threads. Shoppers can no longer pay.',
        'Failures spread **sideways** into any feature that shares a pool with the broken caller. One optional row on a product page cost the shop its checkout.',
      ],
      keyIdea: 'A shared pool is a shared fate. Features that share threads fail together, however unrelated they look.',
      metrics: { threads: '200 / 200', p99: '> 5 s', ok: '0% checkout', recs: '300/s, all time out' },
      metricTones: { threads: 'bad', p99: 'bad', ok: 'bad' },
      scene: {
        nodes: [
          { ...web, status: 'hot', load: 100, badge: 'one shared pool' },
          { ...api, status: 'hot', load: 100 },
          { ...cart, status: 'dim', badge: 'unreachable' },
          { ...recs, status: 'down', sub: 'not answering' },
        ],
        links: [link('web', 'api'), link('api', 'recs'), link('web', 'cart', { style: 'faint' })],
        flows: [
          { path: ['web', 'api', 'recs'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['web', 'cart'], tone: 'error', label: 'no free thread', duration: 1.4, delay: 2.0 },
        ],
        panel: {
          title: 'Storefront threads',
          icon: 'Cpu',
          rows: [
            { text: 'Product pages (wait on recs)', value: '200', tone: 'bad' },
            { text: 'Cart and checkout', value: '0', tone: 'bad' },
          ],
          footer: { text: 'Shoppers cannot pay', tone: 'bad' },
        },
        caption: 'Recommendations broke. Checkout is what went down.',
      },
    },
    {
      title: 'Closed',
      tag: 'concept',
      heading: 'A circuit breaker watches every call',
      eli5: 'Put a helper beside the dessert counter who counts how many orders come back late. While most come back fine, waiters go through as normal. That helper is the **breaker**.',
      body: [
        'A **circuit breaker** is a small object that wraps calls to one dependency. Every call goes through it, and it records whether the call succeeded, failed or was too slow.',
        'In the **closed** state it passes calls straight through and only counts. The name comes from electrics: a closed circuit lets current flow. On a normal day it costs a few counter updates.',
      ],
      keyIdea: 'A breaker sits in front of one dependency and keeps a running score of how its calls are going.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      metricTones: { threads: 'good', p99: 'good', ok: 'good', recs: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...breaker, status: 'ok', badge: 'closed · 0.5% errors' },
          { ...recs, status: 'ok' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs')],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', count: 3, duration: 1.3 },
          { path: ['recs', 'breaker', 'api'], tone: 'response', label: 'ok, counted', count: 3, duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'The breaker keeps score',
          icon: 'Zap',
          rows: [
            { text: 'State', value: 'closed', tone: 'good' },
            { text: 'Calls last 10 s', value: '3,000' },
            { text: 'Failed or slow', value: '15 (0.5%)', tone: 'good' },
          ],
        },
        caption: 'Closed: calls flow, results are counted',
      },
    },
    {
      title: 'Where it lives',
      tag: 'concept',
      heading: 'One breaker per dependency, per instance',
      eli5: 'Each waiter has their own helper and their own tally for the dessert counter. A tally for the soup counter would be a separate sheet, so a bad dessert day never shuts the soup.',
      body: [
        'The breaker lives in the caller, in memory. Each API instance keeps its own, one per dependency. Recommendations gets a breaker, and catalog gets a different one.',
        'No instance shares state, so there is no extra network call and no new single point of failure. Instances open at slightly different moments, which is fine. A service mesh sidecar can do the same job outside the application.',
      ],
      keyIdea: 'Scope a breaker to one dependency so one bad service never blocks the healthy ones. Local state keeps it cheap.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [
          { ...api, status: 'active', badge: '1 breaker per dependency' },
          { ...breaker, status: 'ok', sub: 'recs only' },
          { ...recs, status: 'ok' },
          { ...reviews, status: 'ok', badge: 'own breaker' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs'), link('api', 'reviews')],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', duration: 1.6 },
          { path: ['api', 'reviews'], tone: 'request', duration: 1.6, delay: 0.3 },
        ],
        panel: {
          title: 'Breakers inside 3 API instances',
          icon: 'Layers',
          rows: [
            { text: 'Instance A, recs', value: 'closed', tone: 'good' },
            { text: 'Instance B, recs', value: 'closed', tone: 'good' },
            { text: 'Instance C, recs', value: 'closed', tone: 'good' },
          ],
          footer: { text: 'State is local, nothing shared', tone: 'muted' },
        },
        caption: 'In memory, in the caller, one per dependency',
      },
    },
    {
      title: 'What fails',
      tag: 'concept',
      heading: 'What counts as a failure',
      eli5: 'The helper marks a dessert order as bad when it comes back late, burnt or never. If a guest simply asked for a dish that is not on the menu, that is the guest\'s mistake, not the cook\'s.',
      body: [
        'Count what says the **dependency** is unhealthy: timeouts, connection errors, `5xx` responses, and calls that are too slow.',
        'Do not count `4xx` answers such as `404` or `400`. They mean the caller asked for something wrong, and the dependency answered correctly. Counting them would open the breaker on a healthy service.',
      ],
      keyIdea: 'Count dependency trouble, not caller mistakes. A 404 is a healthy answer.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [
          { ...breaker, status: 'active', badge: 'scoring each reply' },
          { ...recs, status: 'ok' },
          { ...api, status: 'ok' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs')],
        flows: [
          { path: ['recs', 'breaker'], tone: 'error', label: '503', duration: 1.2 },
          { path: ['recs', 'breaker'], tone: 'response', label: '404', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What the breaker records',
          icon: 'List',
          rows: [
            { text: 'Timeout, connection refused', value: 'failure', tone: 'bad' },
            { text: '5xx response', value: 'failure', tone: 'bad' },
            { text: 'Slower than 500 ms', value: 'failure', tone: 'warn' },
            { text: '4xx response', value: 'success', tone: 'good' },
            { text: '2xx response', value: 'success', tone: 'good' },
          ],
        },
        caption: 'Failure means the dependency is unwell',
      },
    },
    {
      title: 'Open',
      tag: 'concept',
      heading: 'Too many failures: the breaker opens',
      eli5: 'Half the dessert orders are coming back late, so the helper puts up a "counter closed" sign. Waiters see the sign and turn around at once. Now they have time for soup again.',
      body: [
        'When the failure score crosses a threshold, the breaker **opens**. It rejects every call at once, without touching the network. The caller gets an error in microseconds where it used to wait a full second.',
        'The API\'s threads come back, so pages built from catalog and reviews are served again in about 50 ms. And recommendations stops receiving 300 calls per second while it restarts.',
      ],
      keyIdea: 'An open breaker fails instantly. That frees the caller and gives the broken service room to recover.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (no recs)', recs: '0/s' },
      metricTones: { threads: 'good', p99: 'good', ok: 'good', recs: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'ok', load: 8 },
          { ...breaker, status: 'hot', badge: 'OPEN · fail fast' },
          { ...recs, status: 'down', sub: 'restarting' },
          { ...catalog, status: 'ok' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs', { style: 'faint' }), link('api', 'catalog')],
        flows: [
          { path: ['api', 'breaker'], tone: 'request', count: 3, duration: 0.7 },
          { path: ['breaker', 'api'], tone: 'error', label: 'rejected in < 1 ms', count: 3, duration: 0.7, delay: 0.8 },
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.6, delay: 0.4 },
        ],
        caption: 'Open: nothing reaches the broken service',
      },
    },
    {
      title: 'Not a retry',
      tag: 'tradeoff',
      heading: 'Retries for blips, breakers for outages',
      eli5: 'A retry says "maybe the cook dropped the plate, ask again". A breaker says "the oven is broken, stop asking for now". You need both: one for bad luck, one for a bad day.',
      body: [
        'A retry says "that may have been bad luck, try again". A breaker says "this is broken for now, stop asking". They answer different questions.',
        'Use both. Retry a failed call once or twice, with the retry outside the breaker so every attempt is counted. When the breaker is open, the retry is rejected instantly, so the storm from earlier never starts.',
      ],
      keyIdea: 'Every retry attempt goes through the breaker. When the breaker is open, no retry leaves the building.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (no recs)', recs: '0/s' },
      metricTones: { threads: 'good', p99: 'good', ok: 'good', recs: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'ok', chips: [{ text: 'retry x2', tone: 'default' }] },
          { ...breaker, status: 'hot', badge: 'OPEN' },
          { ...recs, status: 'down', sub: 'restarting' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs', { style: 'faint' })],
        flows: [
          { path: ['api', 'breaker'], tone: 'request', label: 'attempt 1', duration: 0.7 },
          { path: ['breaker', 'api'], tone: 'error', label: 'rejected', duration: 0.7, delay: 0.8 },
          { path: ['api', 'breaker'], tone: 'request', label: 'retry', duration: 0.7, delay: 1.6 },
          { path: ['breaker', 'api'], tone: 'error', label: 'rejected', duration: 0.7, delay: 2.4 },
        ],
        panel: {
          title: 'Load on recommendations',
          icon: 'Repeat',
          rows: [
            { text: 'Retries, no breaker', value: '900/s', tone: 'bad' },
            { text: 'Retries behind an open breaker', value: '0/s', tone: 'good' },
          ],
          footer: { text: 'The dependency gets quiet to recover', tone: 'good' },
        },
        caption: 'Every attempt passes the breaker, so none escape',
      },
    },
    {
      title: 'Half-open',
      tag: 'concept',
      heading: 'Half-open: test with a few calls',
      eli5: 'After a while the helper lets one waiter try the dessert counter. If the dessert comes quickly, the sign comes down. If not, the sign stays up a bit longer.',
      body: [
        'An open breaker cannot tell when the dependency is healthy again, because it sends it nothing. So after a cool-down, say **30 seconds**, it moves to **half-open** and lets a few probe calls through, for example 5.',
        'If the probes succeed, the breaker closes and traffic resumes. If they fail, it opens again and the cool-down restarts. Everyone else keeps getting fast rejections. A restarted service has cold caches, so 5 calls is safe and 300 per second is not.',
      ],
      keyIdea: 'Closed, open, half-open: count, stop, then test with a trickle before trusting the dependency again.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (no recs)', recs: '5 probes' },
      metricTones: { threads: 'good', p99: 'good', ok: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...breaker, status: 'active', badge: 'half-open · 5 probes' },
          { ...recs, status: 'active', sub: 'just restarted' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs', { label: '5 probes', arrow: 'both' })],
        flows: [
          { path: ['api', 'breaker'], tone: 'request', count: 4, duration: 0.7 },
          { path: ['breaker', 'api'], tone: 'error', label: 'most rejected', count: 3, duration: 0.7, delay: 0.8 },
          { path: ['breaker', 'recs'], tone: 'handshake', label: 'probe', duration: 0.9, delay: 0.8 },
          { path: ['recs', 'breaker'], tone: 'response', label: '200 in 40 ms', duration: 0.9, delay: 1.8 },
          { path: ['breaker', 'api'], tone: 'response', label: 'close', duration: 0.7, delay: 2.8 },
        ],
        panel: {
          title: 'The three states',
          icon: 'Zap',
          rows: [
            { text: 'closed', value: 'count, pass through', tone: 'good' },
            { text: 'open', value: 'reject, wait 30 s', tone: 'bad' },
            { text: 'half-open', value: '5 probes decide', tone: 'warn' },
            { text: 'after close', value: 'ramp 10%, 50%, 100%', tone: 'muted' },
          ],
        },
        caption: 'A few probes decide: close again, or stay open',
      },
      code: {
        language: 'python',
        title: 'A minimal circuit breaker',
        source: `import time

# Toy breaker: counts consecutive failures and is not thread-safe.
# Production uses a rolling failure-rate window (see Thresholds) and a library
# such as Resilience4j, pybreaker or Polly.
class CircuitBreaker:
    def __init__(self, max_failures=5, cooldown=30, max_probes=5):
        self.max_failures, self.cooldown, self.max_probes = max_failures, cooldown, max_probes
        self.failures, self.state, self.opened_at, self.probes = 0, "closed", 0.0, 0

    def call(self, fn, fallback):
        if self.state == "open":
            if time.monotonic() - self.opened_at < self.cooldown:
                return fallback()                  # fail fast, no network call
            self.state, self.probes = "half_open", 0   # cool-down over: allow probes
        if self.state == "half_open":
            if self.probes >= self.max_probes:
                return fallback()                  # probe budget used: reject the rest
            self.probes += 1
        try:
            result = fn()
        except Exception:
            self.failures += 1
            if self.state == "half_open" or self.failures >= self.max_failures:
                self.state, self.opened_at = "open", time.monotonic()
            raise                                  # the caller decides: retry or fall back
        self.failures, self.state = 0, "closed"    # success closes the breaker
        return result`,
        highlight: [14, 16, 17, 18, 24, 26],
      },
    },
    {
      title: 'Backoff',
      tag: 'tradeoff',
      heading: 'When the probes fail, wait longer',
      eli5: 'If the dessert test fails, the helper does not try again a minute later. The next wait is longer, so a sick cook gets a real rest. Each helper picks a slightly different time, so they do not all walk over together.',
      body: [
        'A failed probe reopens the breaker. Many implementations then double the cool-down: 30 s, 60 s, 120 s, up to a cap. A service that stays down is tested less and less often.',
        'Add **jitter**, a small random offset, so a hundred API instances do not all probe on the same second. Because each instance has its own breaker, they would otherwise do exactly that.',
      ],
      keyIdea: 'Probe less often after each failed probe, and spread the probes in time.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (no recs)', recs: '5 probes' },
      scene: {
        nodes: [
          { ...breaker, status: 'hot', badge: 'open again · wait 60 s' },
          { ...recs, status: 'down', sub: 'still sick' },
          { ...api, status: 'ok' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs', { label: 'probe failed', labelTone: 'warn' })],
        flows: [
          { path: ['breaker', 'recs'], tone: 'handshake', label: 'probe', duration: 0.9 },
          { path: ['recs', 'breaker'], tone: 'error', label: '503', duration: 0.9, delay: 1.0 },
          { path: ['api', 'breaker'], tone: 'request', duration: 0.7, delay: 2.0 },
          { path: ['breaker', 'api'], tone: 'error', label: 'rejected', duration: 0.7, delay: 2.8 },
        ],
        panel: {
          title: 'Cool-down after each failed probe',
          icon: 'Clock',
          rows: [
            { text: 'First open', value: '30 s' },
            { text: 'Probe fails', value: '60 s' },
            { text: 'Probe fails again', value: '120 s', tone: 'warn' },
            { text: 'Cap', value: '5 min', tone: 'muted' },
          ],
          footer: { text: '+/- 20% jitter on each wait', tone: 'muted' },
        },
        caption: 'A sick service is tested less and less often',
      },
    },
    {
      title: 'Thresholds',
      tag: 'tradeoff',
      heading: 'When should it trip?',
      eli5: 'If the helper puts up the sign after one late dessert, the counter is closed all day for nothing. If the helper waits for a hundred, the waiters are already stuck. The rule has to sit in between.',
      body: [
        'Counting consecutive failures is easy but crude. Production breakers usually use a **failure rate over a rolling window**: open when 50% or more of the calls in the last 10 seconds failed.',
        'A **minimum call count** (say 20) stops it from tripping on 2 failures out of 3 calls at 4 AM. A small sample is not a verdict.',
      ],
      keyIdea: 'Trip on failure rate over a window, with a minimum volume.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...breaker, status: 'active', badge: 'rate over 10 s, min 20 calls' },
          { ...recs, status: 'active' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs')],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['recs', 'breaker', 'api'], tone: 'response', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Trip rule',
          icon: 'Gauge',
          rows: [
            { text: 'Window', value: 'last 10 s' },
            { text: 'Minimum calls', value: '20' },
            { text: 'Failure rate to open', value: '50%', tone: 'warn' },
            { text: '6 calls, 5 failed', value: 'no verdict', tone: 'muted' },
          ],
        },
        caption: 'A rate and a floor, not a single failure',
      },
      quiz: {
        question: 'A breaker opens at 50% failures over 10 s with a minimum of 20 calls. In the last 10 s there were 6 calls and 5 failed. What does it do?',
        options: [
          'Opens, because 83% is above 50%',
          'Stays closed, because 6 calls is below the minimum of 20',
          'Moves to half-open',
          'Opens for half the usual cool-down',
        ],
        answer: 1,
        explain: 'The minimum call count exists for this case. Six calls is too small a sample to judge the dependency, so the breaker keeps counting and stays closed.',
      },
    },
    {
      title: 'Slow calls',
      tag: 'concept',
      heading: 'Treat slow calls as failures too',
      eli5: 'A dessert that arrives after twenty minutes is as bad as no dessert, because the waiter was stuck the whole time. The helper marks anything later than a few minutes as a miss.',
      body: [
        'A dependency that answers every call in 900 ms never raises an error, yet it eats threads just the same. At 300 pages per second each page holds a thread for about 0.95 s (20 + 30 + 900 ms), which needs roughly 285 threads. The pool has 200.',
        'Treating calls over 500 ms as failed lets the breaker catch the hang before the timeout does.',
        'Most libraries have a slow-call threshold and a slow-call rate. Set both from the dependency\'s normal p99.',
      ],
      keyIdea: 'Slow is a failure. A breaker that only counts errors misses the hang that causes the most damage.',
      metrics: { threads: '200 / 200', p99: '> 1 s', ok: '70% (slow)', recs: '300/s, 900 ms each' },
      metricTones: { threads: 'bad', p99: 'bad', ok: 'warn', recs: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'hot', load: 100 },
          { ...breaker, status: 'active', badge: 'slow = failed' },
          { ...recs, status: 'hot', sub: '900 ms, no errors' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs', { label: '900 ms per call', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['recs', 'breaker'], tone: 'error', label: '200 OK, slow', count: 2, duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Slow but never an error',
          icon: 'Gauge',
          rows: [
            { text: 'One page: 20 + 30 + 900 ms', value: '0.95 s' },
            { text: 'Threads needed: 300 x 0.95 s', value: '285', tone: 'bad' },
            { text: 'Pool size', value: '200', tone: 'muted' },
          ],
          footer: { text: '285 needed, 200 exist', tone: 'bad' },
        },
        caption: 'The breaker scores slow calls as failures',
      },
      code: {
        language: 'yaml',
        title: 'Resilience4j breaker settings for one dependency',
        source: `resilience4j.circuitbreaker:
  instances:
    recommendations:
      slidingWindowType: TIME_BASED
      slidingWindowSize: 10                 # seconds
      minimumNumberOfCalls: 20              # no verdict on tiny samples
      failureRateThreshold: 50              # percent
      slowCallDurationThreshold: 500ms      # slower than this counts as slow
      slowCallRateThreshold: 50             # percent of slow calls that trips it
      waitDurationInOpenState: 30s          # cool-down before half-open
      permittedNumberOfCallsInHalfOpenState: 5`,
        highlight: [6, 7, 8, 10, 11],
      },
    },
    {
      title: 'Flapping',
      tag: 'tradeoff',
      heading: 'Too sensitive, too relaxed',
      eli5: 'A helper who puts up the sign at every small hiccup closes a perfectly good counter. A helper who waits too long lets the waiters get stuck first. You tune the helper with real dessert nights.',
      body: [
        'Too sensitive, and a brief blip opens the breaker. Now you cause an outage the dependency never had, and the breaker **flaps** between open and closed.',
        'Too relaxed, and the pool is gone before it reacts. A longer cool-down protects the dependency more and delays recovery. Start with a known library\'s defaults and adjust from real traffic.',
      ],
      keyIdea: 'A bad setting either causes an outage or misses one. Tune from measured traffic, not guesses.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [
          { ...breaker, status: 'active', badge: 'sensitive · 5% in 2 s' },
          { ...breaker, id: 'breaker2', at: at(0, -3.8), status: 'hot', badge: 'relaxed · 90% in 60 s', label: 'breaker B' },
          { ...recs, status: 'ok', sub: 'one 3 s blip' },
        ],
        links: [link('breaker', 'recs'), link('breaker2', 'recs')],
        flows: [
          { path: ['recs', 'breaker'], tone: 'error', label: 'one blip', duration: 1.2 },
          { path: ['recs', 'breaker2'], tone: 'response', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Two ways to be wrong',
          icon: 'Scale',
          rows: [
            { text: 'Sensitive: opens on a blip', value: 'self-made outage', tone: 'bad' },
            { text: 'Relaxed: reacts after 60 s', value: 'pool already gone', tone: 'bad' },
            { text: 'Window 10 s, 50%, min 20', value: 'a start', tone: 'good' },
          ],
        },
        caption: 'Both ends of the dial cost you',
      },
    },
    {
      title: 'Fallbacks',
      tag: 'concept',
      heading: 'What do you return when the breaker is open?',
      eli5: 'When the dessert counter is closed, the waiter does not send the family home. The waiter says "no cake today, here is some fruit". That swap is a **fallback**.',
      body: [
        'Failing fast is half of the design. The caller still has to answer its own caller. A **fallback** is the answer it gives when the real one is not available.',
        'For recommendations there are good options: the last result cached for this shopper, a static list of bestsellers, or leaving that section out. The page is slightly worse and fully usable. This is **graceful degradation**.',
      ],
      keyIdea: 'For each dependency, decide ahead of time what the page does without it: a cached copy, a default, or nothing.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (bestsellers)', recs: '0/s' },
      metricTones: { threads: 'good', p99: 'good', ok: 'good' },
      scene: {
        nodes: [
          { ...web, status: 'ok' },
          { ...api, status: 'ok', badge: 'page + bestsellers' },
          { ...breaker, status: 'hot', badge: 'OPEN · use fallback' },
          { ...recs, status: 'down', sub: 'restarting' },
        ],
        links: [link('web', 'api'), link('api', 'breaker'), link('breaker', 'recs', { style: 'faint' })],
        flows: [
          { path: ['web', 'api'], tone: 'request', duration: 1.0 },
          { path: ['api', 'breaker'], tone: 'request', duration: 0.7, delay: 1.0 },
          { path: ['breaker', 'api'], tone: 'data', label: 'bestsellers list', duration: 0.7, delay: 1.8 },
          { path: ['api', 'web'], tone: 'response', label: '200 OK', duration: 1.0, delay: 2.6 },
        ],
        panel: {
          title: 'Fallback options for recs',
          icon: 'List',
          rows: [
            { text: 'Cached list for this shopper', value: 'best', tone: 'good' },
            { text: 'Static bestsellers', value: 'good', tone: 'good' },
            { text: 'Hide the row', value: 'fine', tone: 'warn' },
          ],
        },
        caption: 'The shopper gets a full page with a plainer last row',
      },
    },
    {
      title: 'No fallback',
      tag: 'tradeoff',
      heading: 'Some calls have no honest fallback',
      eli5: 'You cannot tell a guest "your bill is paid" when it is not. If the payment desk is closed, the waiter says so plainly, or writes the bill down to settle after.',
      body: [
        'You cannot guess that a payment went through. There the right move is a clear, fast error ("payments are unavailable, try again in a minute"), or putting the work on a queue to finish later.',
        'Decide the fallback per dependency while designing, before the outage. A made-up answer that looks real is worse than an honest error.',
      ],
      keyIdea: 'A fallback must be true. When there is no true stand-in, fail clearly and fast, or queue the work.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% pages', recs: '0/s' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { id: 'pay', kind: 'block', size: 0.72, at: at(3.8, -3.8), label: 'payments', icon: 'Receipt', tint: 'red', status: 'down', sub: 'breaker open' },
          { id: 'queue', kind: 'block', size: 0.72, at: at(3.8, 3.8), label: 'retry queue', icon: 'Inbox', tint: 'violet', status: 'ok', sub: 'finish later' },
        ],
        links: [link('api', 'pay', { style: 'faint' }), link('api', 'queue')],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'charge', duration: 0.8 },
          { path: ['pay', 'api'], tone: 'error', label: 'rejected', duration: 0.8, delay: 0.9 },
          { path: ['api', 'queue'], tone: 'event', label: 'order saved, charge later', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Per dependency',
          icon: 'Table',
          rows: [
            { text: 'Recommendations', value: 'cache or default', tone: 'good' },
            { text: 'Reviews', value: 'hide section', tone: 'good' },
            { text: 'Payments', value: 'clear error or queue', tone: 'warn' },
          ],
          footer: { text: 'Never fake a payment', tone: 'bad' },
        },
        caption: 'Honest errors beat invented answers',
      },
    },
    {
      title: 'Bulkheads',
      tag: 'concept',
      heading: 'Bulkheads: a fixed share for each dependency',
      eli5: 'New rule: only three waiters may ever stand at the dessert counter. A fourth one turns back straight away. However slow dessert gets, the other waiters keep serving. That rule is a **bulkhead**.',
      body: [
        'A breaker reacts after it has seen failures. With a 10 second window, the first seconds of an outage still hit the shared pool. A **bulkhead** is a limit that holds all the time. The name comes from the walls that split a ship\'s hull into sealed compartments.',
        'Give each dependency its own budget of concurrent calls. Recommendations normally uses about 12 threads, so cap it at **20**. Call 21 is rejected at once and takes the fallback.',
      ],
      keyIdea: 'A bulkhead caps how much of your capacity one dependency can ever hold, so its worst day costs a fixed, small slice.',
      metrics: { threads: '35 / 200', p99: '~1 s', ok: '100% (7% slow)', recs: '20 in flight max' },
      metricTones: { threads: 'good', p99: 'warn', ok: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok', load: 18, badge: 'recs 20/20 · others 15/180' },
          { ...breaker, label: 'bulkhead', sub: 'max 20 in flight', status: 'active', badge: '20 / 20 used' },
          { ...recs, status: 'hot', sub: 'hanging' },
          { ...catalog, status: 'ok' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs'), link('api', 'catalog')],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', label: '20 allowed', count: 2, duration: 1.4 },
          { path: ['api', 'breaker'], tone: 'request', count: 3, duration: 0.7, delay: 0.5 },
          { path: ['breaker', 'api'], tone: 'error', label: 'full: fallback', count: 3, duration: 0.7, delay: 1.3 },
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.6, delay: 0.3 },
        ],
        panel: {
          title: 'What the cap costs',
          icon: 'Gauge',
          rows: [
            { text: '20 slots / 1 s hang', value: '20 calls/s admitted', tone: 'warn' },
            { text: 'The other 280/s', value: 'take the fallback', tone: 'good' },
            { text: 'Pages that wait on recs', value: '7%', tone: 'warn' },
          ],
          footer: { text: 'p99 is about 1 s, a short timeout would lower it', tone: 'muted' },
        },
        caption: 'The hang is sealed inside a 20-thread compartment',
      },
    },
    {
      title: 'Sizing',
      tag: 'tradeoff',
      heading: 'Sizing a bulkhead: semaphore or thread pool',
      eli5: 'The three-waiter rule can be a number on a chalkboard, or a separate small team with its own uniforms. The chalkboard is cheap. The team costs more but can also stop a waiter who has been waiting too long.',
      body: [
        'Size it from measured concurrency: 300 calls per second × 40 ms is **12 busy threads**, so 20 leaves headroom. Too small, and a legitimate burst gets rejected. Too large, and it protects nothing.',
        'A **semaphore** counts calls on the caller\'s own thread: cheap, no handoff. A **dedicated thread pool** adds a queue, context switches and a hard timeout on the call. Use the pool when the client library blocks and cannot time out.',
      ],
      keyIdea: 'Cap near measured need plus headroom. Semaphore for cheap limits, thread pool when you must abandon a stuck call.',
      metrics: { threads: '35 / 200', p99: '190 ms', ok: '100%', recs: '20 in flight max' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...breaker, label: 'bulkhead', sub: 'cap 20', status: 'active' },
          { ...recs, status: 'ok' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs')],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', count: 3, duration: 1.3 },
          { path: ['recs', 'breaker', 'api'], tone: 'response', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Semaphore versus thread pool',
          icon: 'Scale',
          rows: [
            { text: 'Semaphore', value: 'cheap, same thread', tone: 'good' },
            { text: 'Thread pool', value: 'queue + timeout', tone: 'warn' },
            { text: 'Normal use of recs', value: '12 threads' },
            { text: 'Cap', value: '20' },
          ],
        },
        caption: 'Cap at about twice the normal need',
      },
      code: {
        language: 'python',
        title: 'Retry, breaker, bulkhead, timeout: outside in',
        source: `import random, threading, time

recs_slots = threading.BoundedSemaphore(20)       # bulkhead: 20 calls in flight
recs_breaker = CircuitBreaker(max_failures=5, cooldown=30)

class Rejected(Exception): pass

def reject():
    raise Rejected()

def guarded_call(user_id):
    if not recs_slots.acquire(blocking=False):    # compartment full: do not queue
        raise Rejected()
    try:
        return recs_client.get(user_id, timeout=0.1)   # innermost: 100 ms per attempt
    finally:
        recs_slots.release()

def get_recs(user_id):
    for attempt in range(3):                      # outermost: 1 try + 2 retries
        try:
            return recs_breaker.call(lambda: guarded_call(user_id), fallback=reject)
        except Rejected:
            break                                 # breaker open or bulkhead full: stop
        except Exception:
            time.sleep(random.uniform(0, 0.05))   # jitter between attempts
    return BESTSELLERS`,
        highlight: [3, 4, 15, 20, 22],
      },
    },
    {
      title: 'Pool isolation',
      tag: 'case',
      heading: 'Case: the report that used every database connection',
      eli5: 'The kitchen has one sink. A helper washing a giant pot blocks it for ages, and no one can rinse a plate. Give the big pots their own small sink, and the plates never have to wait.',
      body: [
        'Bulkheads apply to any shared pool. The product API and a nightly report job share one Postgres connection pool of 50. One night the report starts 50 wide queries of 30 seconds each.',
        'Every connection is busy for 30 seconds. Page queries that take 5 ms wait in line and time out. Database CPU is fine. The pool is what ran out.',
        'The fix is two pools: **40 connections** for pages and **10** for reports. The same idea covers worker pools per queue, per-tenant limits, and separate clusters for critical and batch traffic.',
      ],
      keyIdea: 'Anything shared is a way for one workload to starve another. Split the pool along the line you want failures to stop at.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      metricTones: { threads: 'good', p99: 'good', ok: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok', badge: 'pool A: 12 / 40' },
          { ...reports, status: 'hot', load: 100, badge: 'pool B: 10 / 10' },
          { ...pg, status: 'ok' },
        ],
        links: [link('api', 'pg', { label: '40 conns' }), link('reports', 'pg', { label: '10 conns' })],
        flows: [
          { path: ['api', 'pg', 'api'], tone: 'response', label: '5 ms', count: 3, duration: 1.4 },
          { path: ['reports', 'pg'], tone: 'request', label: 'wide scan', count: 2, duration: 3 },
        ],
        caption: 'The slow workload can only fill its own pool',
      },
    },
    {
      title: 'The stack',
      tag: 'concept',
      heading: 'How the four defenses stack',
      eli5: 'Four rules for the dessert counter: only three waiters may queue, a helper watches for late orders, a waiter waits only a few minutes, and a failed order is tried once more. Together, they keep the restaurant open.',
      body: [
        'Wrap a call from the outside in: **retry**, then **breaker**, then **bulkhead**, then the **timeout** on each attempt. Every attempt is counted by the breaker, and a rejected attempt costs nothing. Retries stop as soon as the breaker is open.',
        'Each layer covers a gap in the one before it. Timeouts bound one call, retries absorb blips, the breaker stops a stream of bad calls, and the bulkhead bounds the blast radius.',
      ],
      keyIdea: 'Timeouts bound one call, retries absorb blips, breakers stop bad streams, and bulkheads bound the blast radius.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...breaker, label: 'guards', sub: 'bulkhead + breaker', status: 'active' },
          { ...recs, status: 'ok', chips: [{ text: 'timeout 100 ms', tone: 'good' }, 'retry x2'] },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs')],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['recs', 'breaker', 'api'], tone: 'response', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Outside in',
          icon: 'Layers',
          code: '1. retry     2 retries, jitter, 10% budget\n2. breaker   counts each attempt, fails fast\n3. bulkhead  cap 20 in flight\n4. timeout   100 ms per attempt\n5. fallback  bestsellers',
          footer: { text: 'Order matters', tone: 'muted' },
        },
        caption: 'Four small guards in a fixed order',
      },
    },
    {
      title: 'Watch it',
      tag: 'concept',
      heading: 'Watch the breakers and test the failure',
      eli5: 'The restaurant manager checks a board that shows which counters have a sign up. And now and then the manager closes the dessert counter on purpose, to see if the waiters cope.',
      body: [
        'Export each breaker\'s state, failure rate and rejected-call count as metrics. Alert on an open breaker, since it means a dependency is down and users see fallbacks.',
        'Test the failure on purpose. Inject latency or errors into recommendations in staging, or a game day in production, and confirm the breaker opens and the fallback looks right. An untested breaker is a guess.',
        'Operators also need a **force-open** switch to cut off a dependency by hand, and a force-closed one for when the breaker is wrong.',
      ],
      keyIdea: 'A breaker you cannot see or have never tripped will surprise you at the worst time.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (no recs)', recs: '0/s' },
      scene: {
        nodes: [
          { ...breaker, status: 'hot', badge: 'OPEN' },
          { id: 'mon', kind: 'monitor', at: at(0, -3.8), label: 'dashboard', sub: 'alert: breaker open' },
          { ...recs, status: 'down', sub: 'latency injected' },
        ],
        links: [link('breaker', 'recs', { style: 'faint' }), link('breaker', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['breaker', 'mon'], tone: 'event', label: 'state=open', duration: 1.2 },
        ],
        panel: {
          title: 'Metrics to export',
          icon: 'Activity',
          rows: [
            { text: 'breaker_state', value: 'open', tone: 'bad' },
            { text: 'failure_rate', value: '82%', tone: 'bad' },
            { text: 'calls_rejected/s', value: '300', tone: 'warn' },
            { text: 'fallback_served/s', value: '300', tone: 'warn' },
            { text: 'force_open switch', value: 'operators only', tone: 'muted' },
          ],
        },
        caption: 'Open breakers page a human, and a drill proves they work',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Refuse to wait, and wall things off',
      eli5: 'A sign on the broken counter, a spare treat to offer, and a rule about how many waiters may queue in one place. With those three, one slow cook cannot stop the whole restaurant.',
      body: [
        'A slow dependency ties up its callers, and they tie up theirs. A **circuit breaker** counts failures and slow calls while **closed**, rejects instantly while **open**, and tests with a few probes while **half-open**.',
        'A **fallback** decides what the user sees meanwhile. A **bulkhead** gives each dependency a fixed share of threads or connections, even in the seconds before the breaker reacts.',
      ],
      keyIdea: 'Timeouts bound one call, breakers stop a stream of bad calls, and bulkheads bound the blast radius.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      metricTones: { threads: 'good', p99: 'good', ok: 'good', recs: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...breaker, status: 'ok', badge: 'closed' },
          { ...recs, status: 'ok' },
          { ...catalog, status: 'ok' },
        ],
        links: [link('api', 'breaker'), link('breaker', 'recs'), link('api', 'catalog')],
        flows: [
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.6 },
          { path: ['api', 'breaker', 'recs', 'breaker', 'api'], tone: 'response', duration: 2.2, delay: 0.3 },
        ],
        panel: {
          title: 'Defenses',
          icon: 'Shield',
          rows: [
            { text: 'Breaker', value: 'stop bad streams', tone: 'good' },
            { text: 'Fallback', value: 'degrade, do not fail', tone: 'good' },
            { text: 'Bulkhead', value: 'cap the blast', tone: 'good' },
            { text: 'Load shedding, rate limits', value: 'protect the server', tone: 'muted' },
            { text: 'Fallback rule', value: 'cheap, independent', tone: 'muted' },
          ],
        },
      },
      quiz: {
        question: 'A service has a 1 s timeout and a breaker on a dependency. During the first few seconds of a hang, before the breaker has enough data to open, its shared thread pool fills up. What was missing?',
        options: [
          'A longer cool-down in the open state',
          'More retries on the failing call',
          'A bulkhead capping concurrent calls to that dependency',
          'A larger rolling window on the breaker',
        ],
        answer: 2,
        explain: 'A breaker needs a window of failures before it trips. A bulkhead is a limit that always applies, so the hang can only hold its own small slice of threads while the breaker makes up its mind.',
      },
    },
  ],
};
