import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: at(-6.6, -2), label: 'API client', sub: 'API key' };
const gw: SceneNode = { id: 'gw', kind: 'block', at: at(0, -2), label: 'gateway', sub: 'limiter library', icon: 'Shield', tint: 'blue' };
const gwB: SceneNode = { id: 'gwB', kind: 'block', at: at(-3.4, -7), label: 'gateway B', sub: '1 of 50', icon: 'Shield', tint: 'blue' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(5.2, -2), label: 'API services', sub: 'orders, search, login', icon: 'Server', tint: 'green' };
const store: SceneNode = { id: 'store', kind: 'cache', at: at(0, 3), label: 'Redis cluster', sub: 'shared counters' };
const rules: SceneNode = { id: 'rules', kind: 'block', size: 0.72, at: at(-5.2, 3), label: 'rules service', sub: 'YAML from git', icon: 'FileCode', tint: 'violet' };
const monitor: SceneNode = { id: 'monitor', kind: 'block', size: 0.72, at: at(5.2, 3), label: 'dashboards', sub: 'per-rule metrics', icon: 'Activity', tint: 'teal' };

// Regions run left to right on one row.
const rUs: SceneNode = { id: 'rUs', kind: 'cache', at: at(-6, 0), label: 'US Redis', sub: 'local counts' };
const rEu: SceneNode = { id: 'rEu', kind: 'cache', at: at(0, 0), label: 'EU Redis', sub: 'local counts' };
const rAp: SceneNode = { id: 'rAp', kind: 'cache', at: at(6, 0), label: 'AP Redis', sub: 'local counts' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designRateLimiterPart2: Lesson = {
  id: 'design-rate-limiter-part-2',
  title: 'Design a distributed rate limiter (part 2)',
  tagline: 'Hot keys, three regions, client behavior, monitoring and a counter store that dies at peak.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Hot keys and local token leases',
    'One limit across regions, and synchronization lag',
    'Headers, hard and soft limits, and client behavior',
    'Monitoring, shadow mode, load shedding and a store that goes down',
  ],
  metrics: [
    { key: 'traffic', label: 'Traffic', icon: 'Activity' },
    { key: 'p99add', label: 'Added p99', icon: 'Timer' },
    { key: 'storeops', label: 'Store ops', icon: 'Database' },
    { key: 'overshoot', label: 'Overshoot', icon: 'Gauge' },
    { key: 'rejected', label: '429s', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Hot key',
      tag: 'case',
      heading: 'Case: one customer sends 40K requests a second',
      eli5: 'One school group rides nonstop, and every gate runs to the same corner of the scoreboard. That corner gets so busy that other visitors waiting at it slow down too.',
      body: [
        'An enterprise key on a custom plan of 3M requests a minute (50K/s) starts a backfill at **40K/s**. One key lives on one shard, so that shard jumps from 31K to about 70K script calls a second.',
        'Its single thread saturates and every other key on it waits: added p99 for those customers climbs to **9 ms**. The limiter meant to protect the API is slowing it down.',
      ],
      keyIdea: 'One hot key overloads one shard, and every other key on that shard pays for it.',
      metrics: { traffic: '500K/s', p99add: '9 ms', storeops: '70K/s on one shard', overshoot: '~0', rejected: '10K/s' },
      metricTones: { p99add: 'bad', storeops: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'one key: 40K/s' },
          { ...gw, chips: ['check x 40K/s'] },
          { ...store, status: 'hot', load: 98, badge: 'shard 7' },
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'store', { style: 'dashed', label: 'every request', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'gw'], tone: 'request', count: 4, duration: 1 },
          { path: ['gw', 'store', 'gw'], tone: 'data', count: 3, duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Shard 7',
          icon: 'Database',
          rows: [
            { text: 'Normal load', value: '31K calls/s', tone: 'good' },
            { text: 'Plus the hot key', value: '+40K calls/s', tone: 'bad' },
            { text: 'Other keys, added p99', value: '9 ms', tone: 'bad' },
          ],
          footer: { text: 'One thread, one key, everyone waits', tone: 'bad' },
        },
        caption: 'The hot key saturates its shard',
      },
    },
    {
      title: 'Token leases',
      tag: 'concept',
      heading: 'Lease tokens in batches',
      eli5: 'Instead of running to the scoreboard for every ride, each gate grabs a **stack of ride stamps** and hands them out itself. It walks back only when the stack runs out.',
      body: [
        'When a key passes a rate threshold, a gateway takes 200 tokens from the shared bucket in one call and spends them from memory. It goes back only when they run out.',
        '40K/s over 50 gateways is 800/s each, so each gateway calls Redis 4 times a second for that key: **200 calls/s in total instead of 40,000**. Quiet keys keep exact per-request checks.',
      ],
      keyIdea: 'Leasing tokens turns thousands of store calls into a few, for the keys that need it.',
      metrics: { traffic: '500K/s', p99add: '9 ms to 0.8 ms', storeops: '460K/s', overshoot: '~0', rejected: '10K/s' },
      metricTones: { p99add: 'good', storeops: 'good' },
      scene: {
        nodes: [
          { ...gwB, status: 'active', chips: [{ text: 'lease: 200 tokens', tone: 'good' }] },
          { ...gw, status: 'active', chips: [{ text: 'lease: 200 tokens', tone: 'good' }] },
          { ...store, status: 'ok', load: 35, badge: '4 calls/s per gateway' },
        ],
        links: [link('gwB', 'store', { style: 'dashed' }), link('gw', 'store', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'store', 'gw'], tone: 'data', label: 'take 200', duration: 1.6 },
          { path: ['gwB', 'store', 'gwB'], tone: 'data', duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Store calls for the hot key',
          icon: 'Table',
          rows: [
            { text: 'Per request', value: '40,000 / s', tone: 'bad' },
            { text: 'Per 200-token lease', value: '200 / s', tone: 'good' },
          ],
          footer: { text: '200x fewer calls', tone: 'good' },
        },
        caption: 'Leases turn 40,000 store calls a second into 200',
      },
    },
    {
      title: 'Lease cost',
      tag: 'tradeoff',
      heading: 'The price of a lease is accuracy',
      eli5: 'Stamps in a gate\'s pocket are stamps nobody else can use. If every gate holds 200 and the group leaves, some stamps go unused. A short expiry keeps that waste small.',
      body: [
        'Leased tokens are already deducted from the shared bucket. Up to 50 × 200 = 10,000 can sit unspent across gateways, a fifth of one second\'s budget for this key. That makes the limiter slightly stricter than the plan: the customer is under-allowed, by at most gateways times lease size.',
        'Leases expire after a second, which bounds both effects. Overshoot only happens if a lease is spent after its window rolls over, and the 1 s expiry caps that too. Smaller leases mean more accuracy and more store calls. Bigger leases mean the reverse.',
      ],
      keyIdea: 'Lease size trades accuracy for store load. Unspent leases under-allow by at most gateways times lease size, and the 1 s expiry bounds the slack.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: 'under-allows ≤10K', rejected: '10K/s' },
      metricTones: { overshoot: 'warn' },
      scene: {
        nodes: [
          { ...gwB, chips: [{ text: '200 unspent', tone: 'warn' }] },
          { ...gw, chips: [{ text: '200 unspent', tone: 'warn' }] },
          { ...store, badge: 'bucket drained by leases' },
        ],
        links: [link('gwB', 'store', { style: 'dashed' }), link('gw', 'store', { style: 'dashed' })],
        flows: [{ path: ['gw', 'store'], tone: 'event', label: 'lease expires in 1 s', duration: 1.6 }],
        panel: {
          title: 'Lease slack (under-allowed at most)',
          icon: 'Gauge',
          rows: [
            { text: 'Gateways', value: '50' },
            { text: 'Lease size', value: '200 tokens' },
            { text: 'Unspent at most', value: '10,000', tone: 'warn' },
            { text: 'Key budget per second', value: '50,000' },
          ],
          footer: { text: 'A fifth of one second', tone: 'muted' },
        },
        caption: 'Bounded slack in exchange for a calm store',
      },
    },
    {
      title: 'One store?',
      tag: 'tradeoff',
      heading: 'A global store is too far away',
      eli5: 'The park has three sites far apart. One scoreboard at the home site means a visitor at a faraway site waits for a long phone call before every ride.',
      body: [
        'A key can send traffic to the US, EU and AP at once. One global store in the US puts an **80 to 150 ms** round trip on every EU and AP request, far past the 2 ms budget.',
        'A cross-ocean outage would also break limiting everywhere. That option is out.',
      ],
      keyIdea: 'A shared store must be near the gateways, so a single global one cannot meet a 2 ms budget.',
      metrics: { traffic: '500K/s', p99add: '120 ms for EU', storeops: '-', overshoot: '~0', rejected: '-' },
      metricTones: { p99add: 'bad' },
      scene: {
        nodes: [
          { id: 'gwEu', kind: 'block', at: at(5, -2), label: 'EU gateways', sub: '150K req/s', icon: 'Shield', tint: 'blue', chips: [{ text: 'budget 2 ms', tone: 'good' }] },
          { id: 'gStore', kind: 'cache', at: at(-5, 2.5), label: 'US Redis', sub: 'one global store' },
          { id: 'euApi', kind: 'block', size: 0.72, at: at(0, -5.5), label: 'EU API', icon: 'Server', tint: 'green' },
        ],
        links: [
          link('gwEu', 'gStore', { style: 'dashed', label: '120 ms each way', labelTone: 'warn' }),
          link('gwEu', 'euApi'),
        ],
        flows: [{ path: ['gwEu', 'gStore', 'gwEu'], tone: 'data', label: 'check()', duration: 2.4 }],
        panel: {
          title: 'Round trip to a global store',
          icon: 'Globe',
          rows: [
            { text: 'Same zone', value: '0.5 ms', tone: 'good' },
            { text: 'US to EU', value: '80 ms', tone: 'bad' },
            { text: 'US to AP', value: '150 ms', tone: 'bad' },
          ],
          footer: { text: 'The budget is 2 ms', tone: 'bad' },
        },
        caption: 'Every EU request would wait for the Atlantic',
      },
    },
    {
      title: 'Split budget',
      tag: 'tradeoff',
      heading: 'Option one: give each region a fixed share',
      eli5: 'The office tells each site it may hand out a fixed number of rides, say 60 at the big site and 15 at the small one. Simple, but if a visitor moves sites, they run out early.',
      body: [
        '**Split the budget**: each region enforces a fixed share of the limit, say 60/25/15%. There is no cross-region traffic and the design is simple.',
        'It is wrong when a customer moves. A key with 1,000 a minute that shifts all its traffic to EU gets only EU\'s 25%, which is 250.',
      ],
      keyIdea: 'A static split is simple and local, but it limits customers by region instead of by plan.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: 'under-allows', rejected: '10K/s' },
      metricTones: { overshoot: 'warn' },
      scene: {
        nodes: [
          { ...rUs, badge: '60%', chips: [{ text: '600 / min', tone: 'default' }] },
          { ...rEu, status: 'hot', badge: '25%', chips: [{ text: '250 / min: 429s', tone: 'bad' }] },
          { ...rAp, badge: '15%', chips: [{ text: '150 / min', tone: 'default' }] },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Key limit 1,000 a minute, all traffic in EU',
          icon: 'Table',
          rows: [
            { text: 'US share', value: '600, unused', tone: 'muted' },
            { text: 'EU share', value: '250, exhausted', tone: 'bad' },
            { text: 'AP share', value: '150, unused', tone: 'muted' },
          ],
          footer: { text: 'The customer paid for 1,000 and gets 250', tone: 'bad' },
        },
        caption: 'Idle shares cannot be borrowed',
      },
    },
    {
      title: 'Async sync',
      tag: 'concept',
      heading: 'Option two: count locally, sync in the background',
      eli5: 'Each site keeps its own scoreboard and phones the others every half second with its latest total. Rides are decided on the spot, using the last news from the other sites.',
      body: [
        '**Count locally, sync asynchronously** (the multi-region lesson): each region decides on its own count plus the last-heard counts from the others, and broadcasts its usage every 500 ms.',
        'Decisions stay local and fast, and a customer who moves is followed by the totals. We choose this one.',
        'Each region runs its own sharded Redis sized for its share of traffic: about 8 primaries in the US (250K of 500K/s, so half of the 16 from part 1), fewer in EU and AP. Sizing follows the same operations-per-second method as part 1.',
      ],
      keyIdea: 'Decide on local data, and share counts in the background so budgets follow the customer.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: 'small', rejected: '10K/s' },
      metricTones: { p99add: 'good' },
      scene: {
        nodes: [
          { ...rUs, chips: [{ text: 'own: 40', tone: 'default' }] },
          { ...rEu, chips: [{ text: 'own: 35', tone: 'default' }] },
          { ...rAp, chips: [{ text: 'own: 25', tone: 'default' }] },
        ],
        links: [
          link('rUs', 'rEu', { style: 'dashed', label: 'every 500 ms', route: 'straight' }),
          link('rEu', 'rAp', { style: 'dashed', route: 'straight' }),
        ],
        flows: [
          { path: ['rUs', 'rEu'], tone: 'data', label: 'US used 40', duration: 1.4 },
          { path: ['rEu', 'rAp'], tone: 'data', label: 'US+EU used 75', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'AP decides with',
          icon: 'Table',
          rows: [
            { text: 'Own count', value: '25' },
            { text: 'Last heard: US + EU', value: '75' },
            { text: 'Limit', value: '100' },
          ],
          footer: { text: 'No cross-ocean call on the request path', tone: 'good' },
        },
        caption: 'Local decisions, counts shared in the background',
      },
    },
    {
      title: 'Sync lag',
      tag: 'tradeoff',
      heading: 'Synchronization lag sets the overshoot',
      eli5: 'For half a second a site does not know what the others just did. If a visitor rushes all three sites at once, each says yes, until the next phone call reveals the total.',
      body: [
        'For up to 500 ms a region does not know what the others allowed, so a key that bursts in all three regions at once can get up to about **3× its limit** for that moment, until the next sync.',
        'Geo routing sends most keys to one region, so real overshoot is small. Billing quotas get reconciled exactly from usage logs afterwards.',
      ],
      keyIdea: 'The sync interval sets the size of the overshoot. Shorter intervals cost more traffic and shrink the gap.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '3x for 500 ms', rejected: '10K/s' },
      metricTones: { overshoot: 'warn' },
      scene: {
        nodes: [
          { ...rUs, chips: [{ text: 'allows 100', tone: 'warn' }] },
          { ...rEu, chips: [{ text: 'allows 100', tone: 'warn' }] },
          { ...rAp, chips: [{ text: 'allows 100', tone: 'warn' }] },
        ],
        links: [
          link('rUs', 'rEu', { style: 'dashed', label: '500 ms stale', labelTone: 'warn', route: 'straight' }),
          link('rEu', 'rAp', { style: 'dashed', route: 'straight' }),
        ],
        flows: [{ path: ['rUs', 'rEu', 'rAp'], tone: 'data', label: 'too late', duration: 2.4 }],
        panel: {
          title: 'Limit 100, burst in all regions',
          icon: 'Gauge',
          rows: [
            { text: 'US allows', value: '100' },
            { text: 'EU allows', value: '100' },
            { text: 'AP allows', value: '100' },
            { text: 'Total in 500 ms', value: '300', tone: 'warn' },
          ],
          footer: { text: 'Next sync closes the gap', tone: 'muted' },
        },
        caption: 'Brief overshoot until the counts catch up',
      },
      quiz: {
        question: 'A customer\'s limit is 1,000 requests a minute, split statically by region: US 60%, EU 25%, AP 15%. They move all their traffic to EU servers. What happens?',
        options: [
          'Nothing changes: they still get 1,000 a minute',
          'They get 429s above about 250 a minute',
          'They get 429s above about 600 a minute',
          'The EU region borrows the unused US share automatically',
        ],
        answer: 1,
        explain: 'A static split only knows the EU share, 25% of 1,000. The customer pays for 1,000 and gets 250. Local counting with background sync follows the traffic instead.',
      },
    },
    {
      title: 'Headers',
      tag: 'concept',
      heading: 'Tell clients the budget on every response',
      eli5: 'Every gate shows a little sign with how many rides you have left and when the count resets. Polite visitors read the **sign** and wait their turn instead of pushing at the gate.',
      body: [
        'Every response carries the budget, not only rejections: `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`. A `429` adds `Retry-After`.',
        'An IETF draft defines standard `RateLimit` headers, and many APIs still send the `X-` names.',
      ],
      keyIdea: 'Publish the budget on every response, so clients can slow down before they hit the wall.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '3x for 500 ms', rejected: '10K/s' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: 'sees Remaining: 4', tone: 'warn' }] },
          { ...gw, status: 'active' },
          api,
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gw', 'api'], tone: 'request', duration: 1.6 },
          { path: ['api', 'gw', 'client'], tone: 'response', label: '200 + headers', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Response headers',
          icon: 'Code',
          code: 'X-RateLimit-Limit: 100\nX-RateLimit-Remaining: 4\nX-RateLimit-Reset: 41\n\n429 adds:\nRetry-After: 3',
          footer: { text: 'The budget travels with every reply', tone: 'good' },
        },
        caption: 'The client always knows what is left',
      },
    },
    {
      title: 'Hard or soft',
      tag: 'tradeoff',
      heading: 'Hard limits for free plans, soft for paid',
      eli5: 'A free visitor is stopped at the gate the moment the stamps run out. A season-pass family gets a polite warning and a few extra rides, because turning them away mid-ride costs the park more.',
      body: [
        'A **hard limit** rejects at the line. A **soft limit** lets paid plans run 10% over for a few minutes, with a warning header and an email.',
        'Cutting off a paying customer in the middle of a launch costs more than the extra load. Free plans stay hard.',
      ],
      keyIdea: 'Choose hard or soft per plan by what a rejection costs the business.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: 'soft: up to 10%', rejected: '10K/s' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: 'pro plan: 6,600/min', tone: 'warn' }] },
          { ...gw, status: 'active', chips: [{ text: 'soft: allow + warn', tone: 'warn' }] },
          api,
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gw', 'api'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['gw', 'client'], tone: 'event', label: 'warning header', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Over the limit',
          icon: 'Scale',
          rows: [
            { text: 'Free plan', value: 'hard: 429 now', tone: 'bad' },
            { text: 'Pro plan', value: 'soft: +10% for minutes', tone: 'warn' },
            { text: 'After the grace', value: '429', tone: 'bad' },
          ],
        },
        caption: 'Paying customers get a grace window',
      },
    },
    {
      title: 'Client behavior',
      tag: 'concept',
      heading: 'Make the polite retry the default',
      eli5: 'Good visitors read the sign. When it says wait 3 minutes, they wait 3 minutes plus a random bit, so the whole class does not rush back in the same second.',
      body: [
        'Good clients slow down when `Remaining` gets low, wait `Retry-After` plus random jitter on a 429 (the timeouts and retries lesson), and never retry in a tight loop.',
        'Shipping that behavior in the official SDKs removes most retry storms before they start.',
      ],
      keyIdea: 'Put backoff and jitter in the SDK, because the code clients actually run decides how much load a 429 creates.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '3x for 500 ms', rejected: '10K/s' },
      scene: {
        nodes: [
          { ...client, status: 'active', badge: 'SDK backs off' },
          { ...gw, chips: [{ text: 'Remaining: 0', tone: 'bad' }] },
          api,
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gw'], tone: 'request', duration: 1 },
          { path: ['gw', 'client'], tone: 'error', label: '429 Retry-After: 3', duration: 1.2, delay: 1.1 },
          { path: ['client', 'gw', 'api'], tone: 'request', label: 'after 3 s + jitter', duration: 1.8, delay: 3 },
        ],
        panel: {
          title: 'SDK rules',
          icon: 'Repeat',
          rows: [
            { text: 'Remaining under 5', value: 'ease off' },
            { text: 'On 429', value: 'wait Retry-After', tone: 'good' },
            { text: 'Plus', value: 'random jitter', tone: 'good' },
            { text: 'Max attempts', value: '4' },
          ],
        },
        caption: 'The client waits as told, then succeeds',
      },
      code: {
        language: 'typescript',
        title: 'What the official SDK does on every call',
        source: `async function call(req: Request, attempt = 0): Promise<Response> {
  const res = await fetch(req.clone());
  const left = Number(res.headers.get('X-RateLimit-Remaining') ?? 'Infinity');
  if (left < 5) await sleep(500);                  // ease off before the wall
  if (res.status !== 429 || attempt >= 4) return res;
  const waitMs = Number(res.headers.get('Retry-After') ?? '1') * 1000;
  await sleep(waitMs + Math.random() * 1000);       // jitter: no lockstep retries
  return call(req, attempt + 1);
}`,
        highlight: [4, 6, 7],
      },
    },
    {
      title: 'Monitoring',
      tag: 'concept',
      heading: 'Watch every rule',
      eli5: 'The park control room watches how many riders each gate turns away. If a gate suddenly turns away everyone, or nobody, the control room notices.',
      body: [
        'Each gateway emits per-rule counters: allowed, rejected, and would-reject for shadow rules, plus store latency and errors (the observability lesson).',
        'Dashboards answer three questions: which rules reject paying customers at normal traffic, which let the API overload anyway, and which keys are rejected most.',
      ],
      keyIdea: 'A limiter you cannot see is a limiter you cannot tune.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '3x for 500 ms', rejected: '10K/s' },
      scene: {
        nodes: [
          { ...gw, status: 'active', chips: ['allowed / rejected / would-reject'] },
          { ...monitor, status: 'active', badge: 'per-rule metrics' },
          { ...store, status: 'ok' },
        ],
        links: [link('gw', 'monitor', { style: 'faint' }), link('gw', 'store', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'monitor'], tone: 'event', label: 'counters', duration: 1.4 },
          { path: ['store', 'monitor'], tone: 'event', label: 'store p99', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Alerts',
          icon: 'Activity',
          rows: [
            { text: '429 rate jumps for a plan', value: 'bad rule change', tone: 'warn' },
            { text: 'Store p99 above 2 ms', value: 'page', tone: 'bad' },
            { text: 'Rejections fall to zero', value: 'failing open?', tone: 'bad' },
          ],
        },
        caption: 'Dashboards and alerts on every rule',
      },
    },
    {
      title: 'Shadow mode',
      tag: 'concept',
      heading: 'Try new rules in shadow first',
      eli5: 'A new ride rule first runs as a trial. Gates write down who they would have stopped, and stop nobody. The park fixes the surprises before anyone is turned away.',
      body: [
        '**Shadow mode** comes before every new or tighter rule. The gateway logs a would-reject and still serves the request.',
        'The `search-cost` rule ran in shadow for a week and showed 40 keys it would have cut off, 3 of them paying customers with a legitimate nightly job. They got overrides before the rule was enforced.',
      ],
      keyIdea: 'Dry-run every new rule against real traffic before it can reject anyone.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '3x for 500 ms', rejected: '10K/s, plus 40 keys in shadow' },
      scene: {
        nodes: [
          { ...gw, status: 'active', chips: [{ text: 'search-cost: shadow', tone: 'warn' }] },
          { ...monitor, status: 'active', badge: '40 would-reject' },
          { ...rules, status: 'active', badge: '3 overrides' },
        ],
        links: [link('gw', 'monitor', { style: 'faint' }), link('rules', 'gw', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'monitor'], tone: 'event', label: 'would reject', duration: 1.4 },
          { path: ['rules', 'gw'], tone: 'event', label: 'override for 3 keys', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'A week in shadow',
          icon: 'Table',
          rows: [
            { text: 'Keys that would be cut off', value: '40' },
            { text: 'Of those, paying customers', value: '3', tone: 'warn' },
            { text: 'Request served anyway', value: 'yes', tone: 'good' },
          ],
          footer: { text: 'Overrides first, then enforce', tone: 'good' },
        },
        caption: 'Shadow mode: log the 429, still serve the request',
      },
    },
    {
      title: 'Limit or shed',
      tag: 'tradeoff',
      heading: 'A limiter does not stop an overloaded API',
      eli5: 'Every visitor may be within their own ride limit, and still the park can be too full. Then the gates turn away the least important visitors first, whoever they are.',
      body: [
        'Per-key limits are fair shares, and 2M keys each inside their limit can still add up to more than the backend can serve. **Load shedding** looks at the whole service: when latency or CPU passes a threshold, drop the lowest priority work first.',
        'Rate limiting returns `429` to one caller. Shedding returns `503` to whoever is cheapest to refuse, and keeps login and checkout alive.',
      ],
      keyIdea: 'Rate limits protect fairness per caller. Load shedding protects the service as a whole.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '-', rejected: '10K/s plus 503s' },
      scene: {
        nodes: [
          { ...client, badge: 'inside its limit' },
          { ...gw, status: 'active', chips: [{ text: 'shed: priority 3', tone: 'warn' }] },
          { ...api, status: 'hot', load: 92 },
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gw'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['gw', 'client'], tone: 'error', label: '503 shed', duration: 1.2, delay: 1.3 },
          { path: ['gw', 'api'], tone: 'request', label: 'login, checkout', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Two different tools',
          icon: 'Scale',
          rows: [
            { text: 'Rate limit', value: 'per caller, 429' },
            { text: 'Load shedding', value: 'whole service, 503', tone: 'warn' },
            { text: 'Drops first', value: 'lowest priority' },
          ],
        },
        caption: 'Fair per caller, safe for the whole service',
      },
    },
    {
      title: 'Store down',
      tag: 'case',
      heading: 'Case: a Redis shard dies at peak',
      eli5: 'One corner of the scoreboard breaks. The gates that used it keep running while the park repairs it, and nobody waits long for an answer from a dead board.',
      body: [
        'One of the 16 primaries dies. Its replica is promoted in about 15 seconds (the failover lesson), and for that window one sixteenth of keys, about 31K requests/s, have no shared counter.',
        'Calls to that shard hit their **5 ms timeout**, and after a few failures a circuit breaker (the circuit breakers lesson) stops calling it, so latency comes back down.',
      ],
      keyIdea: 'Short timeouts and a circuit breaker keep a dead store from slowing every request.',
      metrics: { traffic: '500K/s', p99add: '5 ms, then 0.8 ms', storeops: '430K/s', overshoot: '-', rejected: '9K/s' },
      metricTones: { p99add: 'warn' },
      scene: {
        nodes: [
          { ...gw, status: 'active', chips: [{ text: 'timeout 5 ms', tone: 'warn' }, { text: 'breaker open', tone: 'bad' }] },
          { ...store, status: 'down', badge: 'shard 7 down' },
          { ...monitor, status: 'hot', badge: 'store errors' },
        ],
        links: [link('gw', 'store', { style: 'dashed', label: 'no answer', labelTone: 'warn' }), link('store', 'monitor', { style: 'faint' })],
        flows: [
          { path: ['gw', 'store'], tone: 'error', label: '5 ms timeout', duration: 1 },
          { path: ['store', 'monitor'], tone: 'event', duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'The 15 second window',
          icon: 'Timer',
          rows: [
            { text: 'Keys without a counter', value: '1 in 16', tone: 'bad' },
            { text: 'Requests affected', value: '31K / s' },
            { text: 'Call timeout', value: '5 ms' },
            { text: 'After a few failures', value: 'breaker opens', tone: 'good' },
          ],
        },
        caption: 'Fail fast, then decide per rule',
      },
    },
    {
      title: 'Fail open, closed',
      tag: 'tradeoff',
      heading: 'Each rule picks its failure behavior',
      eli5: 'While the board is broken, most rides run on a rough paper tally. The treasure room stays shut, because unlimited guesses at the lock are worse than a short wait.',
      body: [
        'Most rules **fail open to a local fallback**: each gateway enforces the limit divided by 50 in memory. That works for high-volume keys, where the load balancer spreads requests evenly. It is approximate: a key at 100 a minute gets about 2 per gateway with high random variance, so low-limit keys use a looser multiple (2× the share) or fail open without enforcement.',
        'Login and one-time-code rules **fail closed**, since unlimited password guesses are worse than a minute of errors. The choice is the `on_store_down` field in each rule.',
      ],
      keyIdea: 'Fail open with a local limit where an error costs more than extra traffic, and fail closed where abuse costs more than errors.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '430K/s', overshoot: 'local limit ÷ 50', rejected: '9K/s' },
      scene: {
        nodes: [
          { ...client, status: 'active' },
          { ...gwB, label: 'normal routes', sub: 'fail open', status: 'active', chips: [{ text: 'local: 100 ÷ 50', tone: 'good' }] },
          { ...gw, label: '/login', sub: 'fail closed', status: 'active', chips: [{ text: 'store down: 503', tone: 'bad' }] },
          { ...api, status: 'ok' },
        ],
        links: [link('client', 'gwB'), link('client', 'gw', { route: 'straight' }), link('gwB', 'api')],
        flows: [
          { path: ['client', 'gwB', 'api'], tone: 'request', count: 3, duration: 1.8, label: 'local count' },
          { path: ['client', 'gw'], tone: 'request', duration: 1, delay: 0.6 },
          { path: ['gw', 'client'], tone: 'error', label: '503', duration: 1, delay: 1.7 },
        ],
        panel: {
          title: 'on_store_down',
          icon: 'Shield',
          rows: [
            { text: 'free-tier (100/min)', value: '~2 per gateway, noisy: 2x share', tone: 'warn' },
            { text: 'daily-quota', value: 'local fallback', tone: 'good' },
            { text: 'login', value: 'fail closed', tone: 'bad' },
            { text: 'one-time codes', value: 'fail closed', tone: 'bad' },
          ],
        },
        caption: 'Normal routes stay up on local counts, login stays locked',
      },
    },
    {
      title: 'Failover gap',
      tag: 'concept',
      heading: 'After failover, expect a small free burst',
      eli5: 'When the spare scoreboard takes over, it is a fraction of a second behind. A few visitors get a ride they should not have. That small cost buys a park that stayed open.',
      body: [
        'The promoted replica was a fraction of a second behind (async replication), so some keys get a small free burst of tokens they had already spent.',
        'The API stayed up, added latency spiked for seconds, and a dashboard showed every step. We accept the burst, because losing counters is rare and the loss is small.',
      ],
      keyIdea: 'Async replication means failover forgets the last moments. Accept that burst, and let the dashboard show it.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: 'small burst', rejected: '10K/s' },
      scene: {
        nodes: [
          { ...store, status: 'ok', label: 'promoted replica', badge: 'back after 15 s' },
          { ...gw, chips: [{ text: 'breaker closed', tone: 'good' }] },
          { ...monitor, status: 'active', badge: 'timeline' },
        ],
        links: [link('gw', 'store', { style: 'dashed' }), link('store', 'monitor', { style: 'faint' })],
        flows: [
          { path: ['gw', 'store', 'gw'], tone: 'data', duration: 1.4 },
          { path: ['store', 'monitor'], tone: 'event', label: 'recovered', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'What the incident cost',
          icon: 'Table',
          rows: [
            { text: 'API availability', value: 'stayed up', tone: 'good' },
            { text: 'Added latency', value: 'spiked for seconds', tone: 'warn' },
            { text: 'Some keys', value: 'small free burst', tone: 'warn' },
          ],
        },
        caption: 'The replica is slightly behind, and that is acceptable',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A limiter that is shared, fast, and safe to lose',
      eli5: 'A **distributed rate limiter** is one rulebook, one shared scoreboard, gates that grab stamps in bulk for busy groups, parks that phone each other, and a paper backup for when the board breaks.',
      body: [
        'Hot keys lease tokens in batches. Regions decide locally and sync every 500 ms, accepting brief overshoot. Clients get budget headers and an SDK that backs off, and soft limits protect paying customers.',
        'New rules run in shadow. Load shedding guards the whole service. A dead shard means a local fallback, with login failing closed.',
      ],
      keyIdea: 'Count in one shared place, batch or sync where one place is too slow, and decide in advance what happens when that place is gone.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '3x for 500 ms', rejected: '10K/s' },
      metricTones: { p99add: 'good', storeops: 'good' },
      scene: {
        nodes: [{ ...client, status: 'ok' }, { ...gw, status: 'ok' }, { ...store, status: 'ok' }, { ...api, status: 'ok' }, { ...monitor, status: 'ok' }],
        links: [
          link('client', 'gw', { route: 'straight' }),
          link('gw', 'store', { style: 'dashed' }),
          link('gw', 'api', { route: 'straight' }),
          link('gw', 'monitor', { style: 'faint' }),
        ],
        flows: [
          { path: ['client', 'gw'], tone: 'request', count: 3, duration: 1 },
          { path: ['gw', 'store', 'gw'], tone: 'data', duration: 1.4, delay: 1 },
          { path: ['gw', 'api'], tone: 'request', count: 2, duration: 1.2, delay: 2.5 },
          { path: ['gw', 'client'], tone: 'error', label: '429', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Part 2 in one table',
          icon: 'List',
          rows: [
            { text: 'Hot key', value: 'token leases' },
            { text: 'Regions', value: 'local count, 500 ms sync' },
            { text: 'Clients', value: 'headers, backoff, jitter' },
            { text: 'Store down', value: 'timeout, breaker, fallback' },
          ],
        },
        caption: 'Real users flow through, the excess bounces off',
      },
      quiz: {
        question: 'One enterprise key sends 40K requests a second, and the Redis shard holding it hits its limit, slowing every other key on that shard. What is the best fix?',
        options: [
          'Give every gateway its own in-memory counters for all keys',
          'Let gateways lease batches of tokens for hot keys and spend them locally',
          'Move all counters into the main SQL database',
          'Fail closed for that key until traffic drops',
        ],
        answer: 1,
        explain: 'Leasing 200 tokens at a time cuts that key\'s store calls from 40,000 to about 200 a second, with a small bounded overshoot. Per-gateway counters bring back the 50x problem, SQL is slower than Redis, and failing closed punishes a paying customer for our bottleneck.',
      },
    },
  ],
};
