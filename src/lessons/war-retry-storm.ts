import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const shop: SceneNode = { id: 'shop', kind: 'block', at: at(-5, 0), label: 'checkout', sub: 'web + app', icon: 'ShoppingBag', tint: 'blue' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: at(-1.7, 0), label: 'payment', sub: 'service', icon: 'Receipt', tint: 'violet' };
const fraud: SceneNode = { id: 'fraud', kind: 'block', at: at(1.7, 0), label: 'fraud-check', sub: 'scores orders', icon: 'Shield', tint: 'amber' };
const model: SceneNode = { id: 'model', kind: 'block', at: at(5, 0), label: 'ML model', sub: 'v41', icon: 'Cpu', tint: 'teal' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const chain = (extra: Partial<SceneLink> = {}) => [link('shop', 'pay'), link('pay', 'fraud', extra)];

export const warRetryStorm: Lesson = {
  id: 'war-retry-storm',
  title: 'Retry storm',
  tagline: 'A slow dependency, a naive retry loop, and a 02:14 page: how retries turned a latency blip into an outage.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'How a retry loop multiplies load on a service that is already struggling',
    'How to read the signs of a retry storm: traffic 6x downstream, 1.3x upstream',
    'Why scaling out makes a thundering herd worse, and what to do instead',
    'Backoff with full jitter, circuit breakers, retry budgets and idempotency keys',
    'Bulkheads, load shedding and the latency injection test that proves it',
  ],
  metrics: [
    { key: 'err', label: 'Error rate', icon: 'Bug' },
    { key: 'p99', label: 'Payment p99', icon: 'Timer' },
    { key: 'cpu', label: 'Fraud CPU', icon: 'Cpu' },
    { key: 'load', label: 'Fraud load', icon: 'TrendingUp' },
  ],
  steps: [
    {
      title: 'The page',
      tag: 'problem',
      heading: '02:14 UTC: checkout conversion drops 60% in 4 minutes',
      eli5: 'In a busy restaurant the **waiter** suddenly stops getting food out. The dining room fills with angry guests, and nobody knows why the kitchen went quiet.',
      body: [
        'The page says `payment-service p99 8s`, SLO 400 ms. Error rate is 42%. The service behind it, **fraud-check**, sits at 100% CPU.',
        'Black Friday promo started two hours ago, so everyone assumes a traffic spike. Nobody has checked yet. This is the incident the rest of the lesson takes apart.',
      ],
      keyIdea: 'An incident starts as symptoms. The first job is to separate the symptom from the cause.',
      metrics: { err: '42%', p99: '8 s', cpu: '100%', load: '6x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...shop, status: 'hot', chips: [{ text: 'conversion -60%', tone: 'bad' }] },
          { ...pay, status: 'hot', load: 88, chips: [{ text: 'p99 8 s', tone: 'bad' }] },
          { ...fraud, status: 'hot', load: 100 },
        ],
        links: chain(),
        flows: [
          { path: ['shop', 'pay', 'fraud'], tone: 'request', label: 'POST /pay', duration: 1.6 },
          { path: ['fraud', 'pay', 'shop'], tone: 'error', label: '504', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Pager, 02:14 UTC',
          icon: 'Activity',
          rows: [
            { text: 'payment p99', value: '8 s (SLO 400 ms)', tone: 'bad' },
            { text: 'payment error rate', value: '42%', tone: 'bad' },
            { text: 'fraud-check CPU', value: '100%', tone: 'bad' },
            { text: 'checkout conversion', value: '-60%', tone: 'bad' },
          ],
          footer: { text: 'Cause unknown', tone: 'muted' },
        },
        caption: 'Everything downstream of checkout is red',
      },
    },
    {
      title: 'Normal night',
      tag: 'concept',
      heading: 'Before: a quiet request path at 02:09',
      eli5: 'Earlier that night the **waiter** takes an order slip to the chef, the chef stamps it in a blink, and the waiter is back at the table.',
      body: [
        'A shopper pays. **Checkout** calls **payment**, and payment asks **fraud-check** to score the order before charging the card. Fraud-check answers in about **80 ms**.',
        'At this load fraud-check runs near 35% CPU. Payment sends it one call per payment, and p99 for the whole path is about 120 ms. There is plenty of room.',
      ],
      keyIdea: 'Know the normal numbers. Every later graph only makes sense against them.',
      metrics: { err: '0.1%', p99: '120 ms', cpu: '35%', load: '1.0x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          shop,
          { ...pay, load: 30 },
          { ...fraud, status: 'ok', load: 35, badge: '80 ms' },
        ],
        links: chain({ label: '1 call per payment' }),
        flows: [
          { path: ['shop', 'pay', 'fraud'], tone: 'request', label: 'score order', duration: 1.4 },
          { path: ['fraud', 'pay', 'shop'], tone: 'response', label: 'approve', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Baseline',
          icon: 'Gauge',
          rows: [
            { text: 'fraud-check latency', value: '80 ms', tone: 'good' },
            { text: 'fraud-check CPU', value: '35%', tone: 'good' },
            { text: 'calls per payment', value: '1', tone: 'good' },
            { text: 'client timeout', value: '2 s' },
          ],
        },
        caption: '02:09 UTC, everything healthy',
      },
    },
    {
      title: 'The trigger',
      tag: 'case',
      heading: '02:10: a model deploy makes fraud-check 11x slower',
      eli5: 'A new chef starts and checks every slip three times as carefully. Each slip now takes a long while, and the line of waiters grows.',
      body: [
        'At 02:10 a new fraud **ML model** ships. Inference p99 jumps from **80 ms to 900 ms**. Nothing crashes and no error is logged. The service is only slow.',
        'A slow service is hard to spot. Health checks still pass and the process is alive. The damage comes from what its callers do next.',
      ],
      keyIdea: 'The trigger is small and quiet: a slower dependency, not a dead one.',
      metrics: { err: '1%', p99: '1.1 s', cpu: '60%', load: '1.0x' },
      metricTones: { err: 'warn', p99: 'warn', cpu: 'warn' },
      scene: {
        nodes: [
          { ...pay, load: 40 },
          { ...fraud, status: 'active', load: 60, badge: '900 ms' },
          { ...model, status: 'active', chips: [{ text: 'deploy 02:10', tone: 'warn' }] },
        ],
        links: [link('pay', 'fraud'), link('fraud', 'model', { label: 'inference' })],
        flows: [
          { path: ['pay', 'fraud', 'model'], tone: 'request', label: 'score', duration: 1.6 },
          { path: ['model', 'fraud', 'pay'], tone: 'response', label: '900 ms', duration: 2.4, delay: 1.7 },
        ],
        panel: {
          title: 'Fraud-check latency',
          icon: 'Timer',
          rows: [
            { text: 'p99 before deploy', value: '80 ms', tone: 'good' },
            { text: 'p99 after deploy', value: '900 ms', tone: 'bad' },
            { text: 'errors', value: 'none logged', tone: 'muted' },
          ],
          footer: { text: 'Slow, not down', tone: 'warn' },
        },
        caption: '02:10 UTC, new model in production',
      },
    },
    {
      title: 'Timeout fires',
      tag: 'concept',
      heading: 'Calls now cross the 2 second client timeout',
      eli5: 'The **waiter** only waits 2 seconds for the chef. As the line of slips grows, some slips take longer than that, and the waiter gives up on them.',
      body: [
        'Payment gives every fraud call a **2 s timeout**. At 900 ms most calls fit. But slower calls queue up on busy fraud-check threads, and the slowest ones now wait longer than 2 s.',
        'When the timeout fires, payment sees an error. The work is still queued on fraud-check, which will finish it for nobody. That wasted work still costs CPU.',
      ],
      keyIdea: 'A timeout frees the caller. It does not cancel the work, so the downstream still pays for it.',
      metrics: { err: '4%', p99: '2.0 s', cpu: '78%', load: '1.0x' },
      metricTones: { err: 'warn', p99: 'warn', cpu: 'warn' },
      scene: {
        nodes: [
          { ...pay, load: 45, chips: [{ text: 'timeout 2 s', tone: 'warn' }] },
          { ...fraud, status: 'active', load: 78, chips: [{ text: 'queue: 400', tone: 'warn' }] },
          { ...model, status: 'active' },
        ],
        links: [link('pay', 'fraud', { label: 'timeout 2 s', labelTone: 'warn' }), link('fraud', 'model')],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'POST /fraud', duration: 1.2 },
          { path: ['fraud', 'pay'], tone: 'error', label: 'timed out', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'One payment, one call',
          icon: 'Clock',
          rows: [
            { text: 'call latency', value: '2.4 s', tone: 'bad' },
            { text: 'client timeout', value: '2.0 s', tone: 'warn' },
            { text: 'caller result', value: 'error', tone: 'bad' },
            { text: 'work on fraud-check', value: 'still running', tone: 'warn' },
          ],
        },
        caption: 'The caller gives up, the callee keeps working',
      },
    },
    {
      title: 'Naive retry',
      tag: 'case',
      heading: 'The SDK retries 3 times, immediately',
      eli5: 'When the chef does not answer, the **waiter** shouts the same order again right away. And again. Each shout adds another slip to the chef\'s pile.',
      body: [
        'The payment SDK has a retry loop: 3 retries (4 calls in total), no pause, no backoff, no jitter, no circuit breaker. It retries on any error, including a timeout. Checkout uses the same SDK defaults.',
        'The line `catch (e) { /* retry immediately */ }` is the whole policy. It looks harmless in review. Under load it is a load generator pointed at the slowest service you have.',
      ],
      keyIdea: 'A retry loop with no pause, no cap and no breaker is code that attacks your own dependency.',
      metrics: { err: '4%', p99: '2.0 s', cpu: '78%', load: '1.0x' },
      metricTones: { err: 'warn', p99: 'warn', cpu: 'warn' },
      scene: {
        nodes: [
          { ...shop, chips: [{ text: 'same SDK defaults', tone: 'warn' }] },
          { ...pay, load: 50, chips: [{ text: 'retries: 3', tone: 'bad' }, { text: 'backoff: none', tone: 'bad' }] },
          { ...fraud, status: 'active', load: 78 },
        ],
        links: [link('shop', 'pay'), link('pay', 'fraud', { label: 'immediate retry', labelTone: 'bad' })],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'try 1', duration: 1.0 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'retry 1', duration: 1.0, delay: 1.1 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'retry 2', duration: 1.0, delay: 2.2 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'retry 3', duration: 1.0, delay: 3.3 },
        ],
        panel: {
          title: 'SDK retry policy',
          icon: 'Repeat',
          rows: [
            { text: 'max attempts', value: '3 retries' },
            { text: 'wait between tries', value: '0 ms', tone: 'bad' },
            { text: 'jitter', value: 'none', tone: 'bad' },
            { text: 'circuit breaker', value: 'none', tone: 'bad' },
          ],
        },
        caption: 'What was in production',
      },
      code: {
        language: 'typescript',
        title: 'Before: the retry loop that shipped',
        source: `async function callFraudCheck(req) {
  for (let i = 0; i < 4; i++) { // 1 call + 3 retries
    try {
      return await http.post('/fraud', req, { timeout: 2000 });
    } catch (e) {
      /* retry immediately */
    }
  }
  throw new Error('fraud-check failed');
}`,
        highlight: [2, 4, 5, 6],
      },
    },
    {
      title: 'Amplification',
      tag: 'concept',
      heading: 'Each upstream call becomes 3 to 4 downstream calls',
      eli5: 'Every time the **waiter** shouts again, the chef gets a new slip. One hungry table now makes four slips, so the pile grows four times faster than the guests.',
      body: [
        'With 3 retries a failing payment sends up to **4 calls** (1 original plus 3 retries) to fraud-check. If every call times out, load on fraud-check is 4x the payment rate.',
        'Retries multiply load only when calls fail, and calls fail because load is high. That makes retries cost the most exactly when the system can least afford them.',
      ],
      keyIdea: 'Retry amplification factor = attempts per request. Under failure it applies to every call at once.',
      metrics: { err: '12%', p99: '3.5 s', cpu: '92%', load: '3x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          shop,
          { ...pay, load: 55, chips: [{ text: '1.3x traffic', tone: 'good' }] },
          { ...fraud, status: 'hot', load: 92, chips: [{ text: '3x traffic', tone: 'bad' }] },
        ],
        links: chain({ label: '1 in, up to 4 out', labelTone: 'bad' }),
        flows: [
          { path: ['shop', 'pay'], tone: 'request', label: '1 request', duration: 1.2 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'try 1', duration: 1.2, delay: 1.2 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'try 2', duration: 1.2, delay: 1.5 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'try 3', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Calls into fraud-check',
          icon: 'Table',
          rows: [
            { text: 'healthy: 1 attempt', value: '1x', tone: 'good' },
            { text: 'all time out: 1 + 3', value: '4x', tone: 'bad' },
            { text: 'checkout traffic', value: '1.3x', tone: 'good' },
          ],
          footer: { text: 'Load grows faster than traffic', tone: 'bad' },
        },
        caption: 'One payment, many calls',
      },
    },
    {
      title: 'The spiral',
      tag: 'concept',
      heading: 'A feedback loop: slower, more retries, slower still',
      eli5: 'More shouted slips make the chef slower. A slower chef means more waiters give up and shout again. The pile feeds itself.',
      body: [
        'More retries raise fraud-check load. Higher load makes it slower. Slower responses cross the timeout more often, and every timeout causes more retries.',
        'At 02:13 amplification reaches about **4x** and keeps climbing. Even if latency eased a little, the loop keeps load and queues high. Recovery needs the trigger removed and the backlog drained.',
      ],
      keyIdea: 'Retry storms are a positive feedback loop. They can outlive the fault that started them.',
      metrics: { err: '30%', p99: '6 s', cpu: '100%', load: '4x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...pay, status: 'hot', load: 70 },
          { ...fraud, status: 'hot', load: 100, chips: [{ text: 'queue: 50,000', tone: 'bad' }] },
        ],
        links: [link('pay', 'fraud', { arrow: 'both', label: 'timeout, retry, repeat', labelTone: 'bad' })],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'retries', count: 3, duration: 1.2 },
          { path: ['fraud', 'pay'], tone: 'error', label: 'timeouts', count: 2, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'The loop',
          icon: 'Repeat',
          rows: [
            { text: '1. fraud-check slows', value: 'load up', tone: 'warn' },
            { text: '2. calls pass 2 s', value: 'timeouts', tone: 'warn' },
            { text: '3. SDK retries at once', value: '+3 calls', tone: 'bad' },
            { text: '4. back to step 1', value: '4x load', tone: 'bad' },
          ],
        },
        caption: '02:13 UTC, the system is feeding itself',
      },
    },
    {
      title: 'Layered retries',
      tag: 'case',
      heading: 'Every layer retries, so the factors multiply',
      eli5: 'The guests also ask the **waiter** again when the waiter is slow. Guest shouts at waiter, waiter shouts at chef, and the shouts multiply.',
      body: [
        'Checkout retries payment 3 times. Payment retries fraud-check 3 times. One shopper tap can become 4 x 4 = **16 calls** into fraud-check in the worst case. Layers multiply, they do not add.',
        'A shared global retry policy meant every service in the chain retried. Each layer fanned out the load again. The observed figure was about 6x, because not every call fails.',
      ],
      keyIdea: 'Retry factors multiply across layers. Retry at one layer, not at every layer.',
      metrics: { err: '42%', p99: '8 s', cpu: '100%', load: '6x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...shop, status: 'hot', chips: [{ text: 'retries: 3', tone: 'warn' }] },
          { ...pay, status: 'hot', load: 85, chips: [{ text: 'retries: 3', tone: 'warn' }] },
          { ...fraud, status: 'hot', load: 100, chips: [{ text: '6x traffic', tone: 'bad' }] },
        ],
        links: chain({ label: 'x3', labelTone: 'bad' }),
        flows: [
          { path: ['shop', 'pay'], tone: 'request', label: 'x3', count: 2, duration: 1.2 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'x3 each', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Worst case per shopper tap',
          icon: 'Workflow',
          rows: [
            { text: 'checkout to payment', value: 'up to 4 calls' },
            { text: 'payment to fraud-check', value: 'up to 4 calls each' },
            { text: 'fraud-check receives', value: 'up to 16', tone: 'bad' },
          ],
          footer: { text: 'Observed: about 6x baseline', tone: 'bad' },
        },
        caption: 'The cascade climbs the call chain',
      },
    },
    {
      title: 'Wrong guess',
      tag: 'tradeoff',
      heading: 'The first hypothesis: Black Friday, scale it out',
      eli5: 'Seeing a huge pile of slips, the manager hires more chefs. But the shouting waiters keep adding slips, so the pile stays just as big.',
      body: [
        'The team assumed a traffic spike, since the promo began two hours earlier. The obvious response was to add **fraud-check pods**.',
        'That guess was reasonable, and it cost time. It treated the 6x load as demand without comparing it to the traffic one hop up.',
      ],
      keyIdea: 'Test the hypothesis against the numbers before acting. Capacity fixes only fit a capacity problem.',
      metrics: { err: '42%', p99: '8 s', cpu: '100%', load: '6x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...pay, load: 85 },
          { ...fraud, status: 'hot', load: 100 },
          { id: 'pods', kind: 'container', at: at(-0.2, 3.4), label: 'new pods', sub: '+3', status: 'active' },
        ],
        links: [link('pay', 'fraud'), link('pods', 'fraud', { style: 'dashed' })],
        flows: [{ path: ['pay', 'fraud'], tone: 'request', label: 'retries', count: 3, duration: 1.3 }],
        panel: {
          title: 'Incident channel, 02:16',
          icon: 'List',
          rows: [
            { text: 'hypothesis', value: 'traffic spike' },
            { text: 'action', value: 'scale fraud-check out' },
            { text: 'upstream growth', value: 'not compared yet', tone: 'warn' },
          ],
          footer: { text: 'Assumption not yet checked', tone: 'warn' },
        },
        caption: 'Reaching for capacity first',
      },
    },
    {
      title: 'Scaling fails',
      tag: 'case',
      heading: 'New pods are crushed the moment they start',
      eli5: 'Each new chef walks in and instantly gets buried in the same pile of repeated slips. More chefs do not help while the waiters keep shouting.',
      body: [
        'New pods come up cold and receive their share of 6x traffic at once. Their caches and JIT are not warm, so they are slower than the old pods. They hit 100% CPU, fail health checks and restart.',
        'The retry traffic consumes the new capacity as fast as it arrives. Every pod that comes up is buried again before it can warm up.',
      ],
      keyIdea: 'You cannot out-scale a feedback loop. Break the loop first, then add capacity if you still need it.',
      metrics: { err: '45%', p99: '9 s', cpu: '100%', load: '6x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...pay, load: 88 },
          { ...fraud, status: 'hot', load: 100 },
          { id: 'pods', kind: 'container', at: at(-0.2, 3.4), label: 'new pods', sub: 'restarting', status: 'down' },
          { id: 'pods2', kind: 'container', at: at(3.6, 3.4), label: 'new pods', sub: 'restarting', status: 'down' },
        ],
        links: [link('pay', 'fraud'), link('pods', 'fraud', { style: 'dashed' }), link('pods2', 'fraud', { style: 'dashed' })],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'retries', count: 3, duration: 1.3 },
          { path: ['fraud', 'pods'], tone: 'error', label: 'crash loop', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'fraud-check pods after scale-out',
          icon: 'Container',
          rows: [
            { text: 'old pods', value: '100% CPU', tone: 'bad' },
            { text: 'new pods', value: 'crash loop', tone: 'bad' },
            { text: 'p99', value: '9 s (was 8 s)', tone: 'bad' },
          ],
          footer: { text: 'Scaling out made it worse', tone: 'bad' },
        },
        caption: 'Capacity added into a storm is consumed instantly',
      },
    },
    {
      title: 'Read the graphs',
      tag: 'case',
      heading: 'Investigation: the gap between two graphs gave it away',
      eli5: 'More chefs did not help, so the head chef counts the slips and the guests. Many more slips than guests means someone is writing the same order over and over.',
      body: [
        'Scaling did not help, so the team compared the hops. @marco spotted the first clue: fraud-check RPS is **6x** baseline. @priya compared it to traffic one hop up: payment sees only **1.3x**. That ratio is not organic growth.',
        'Plotting calls per upstream request showed 4 to 5 attempts per payment. @dan guessed the cause at once: check the retry config on the payment SDK.',
      ],
      keyIdea: 'Compare traffic at adjacent hops. A ratio that should be about 1 and is 4 or more points at retries.',
      metrics: { err: '42%', p99: '8 s', cpu: '100%', load: '6x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: '1.3x baseline', tone: 'good' }] },
          { ...fraud, status: 'hot', load: 100, chips: [{ text: '6x baseline', tone: 'bad' }] },
          { id: 'mon', kind: 'monitor', at: at(1.7, 4.6), label: 'dashboard', sub: 'RPS per hop', status: 'active' },
        ],
        links: [link('pay', 'fraud'), link('fraud', 'mon', { style: 'dashed' })],
        flows: [{ path: ['fraud', 'mon'], tone: 'event', label: 'RPS', duration: 1.4 }],
        panel: {
          title: 'RPS vs baseline, 02:14',
          icon: 'Table',
          rows: [
            { text: 'checkout into payment', value: '1.3x', tone: 'good' },
            { text: 'payment into fraud-check', value: '6.0x', tone: 'bad' },
            { text: 'attempts per payment', value: '4.6', tone: 'bad' },
          ],
          footer: { text: 'Gap = retries', tone: 'bad' },
        },
        caption: 'Traffic does not match across the hop',
      },
    },
    {
      title: 'Quiz: spiral',
      tag: 'tradeoff',
      heading: 'Check: where does the load come from?',
      eli5: 'If the chef gets six times more slips but only a few more guests came in, the extra slips are the **waiter** shouting again.',
      body: [
        'Fraud-check receives 6x its baseline calls. Checkout traffic into payment is only 1.3x baseline.',
        'Use the amplification and layering steps to decide what produced the difference.',
      ],
      keyIdea: 'When downstream traffic grows much faster than upstream traffic, suspect retries.',
      metrics: { err: '42%', p99: '8 s', cpu: '100%', load: '6x' },
      metricTones: { err: 'bad', p99: 'bad', cpu: 'bad', load: 'bad' },
      scene: {
        nodes: [
          { ...shop, chips: [{ text: '1.3x', tone: 'good' }] },
          { ...pay, load: 85 },
          { ...fraud, status: 'hot', load: 100, chips: [{ text: '6x', tone: 'bad' }] },
        ],
        links: chain(),
        flows: [{ path: ['shop', 'pay', 'fraud'], tone: 'request', duration: 1.6 }],
        caption: '1.3x in, 6x out',
      },
      quiz: {
        question: 'Upstream traffic is 1.3x baseline but fraud-check sees 6x. What is the most likely cause?',
        options: [
          'A DDoS attack that bypasses checkout',
          'Retries from callers that are timing out',
          'The load balancer sending duplicate traffic by mistake',
          'The ML model needing more calls per payment',
        ],
        answer: 1,
        explain: 'Callers that time out and retry multiply load on the slow service. Traffic that grows downstream with no matching growth upstream is the signature of retry amplification.',
      },
    },
    {
      title: 'Mitigation',
      tag: 'case',
      heading: '02:22: roll back the model, the herd goes away',
      eli5: 'The manager sends the new chef home. The old chef is quick again, slips clear out, and the waiters stop shouting because they get answers.',
      body: [
        'On-call rolls back the **fraud-check model** to the previous version. Latency drops from 900 ms back to 80 ms. Calls finish before the 2 s timeout, so no new retries are issued.',
        'No code change on the callers was needed. The rollback lets the backlog clear because calls finish inside the timeout again. An alternative stop is a flag that turns retries off.',
      ],
      keyIdea: 'Stop the bleeding by removing the trigger or the amplifier. Treat the permanent fix as a separate task.',
      metrics: { err: '9%', p99: '1.2 s', cpu: '70%', load: '2x' },
      metricTones: { err: 'warn', p99: 'warn', cpu: 'warn', load: 'warn' },
      scene: {
        nodes: [
          { ...pay, load: 50 },
          { ...fraud, status: 'active', load: 70, badge: '80 ms' },
          { ...model, tint: 'green', sub: 'v40 (rollback)', status: 'ok', chips: [{ text: 'rolled back', tone: 'good' }] },
        ],
        links: [link('pay', 'fraud'), link('fraud', 'model')],
        flows: [
          { path: ['pay', 'fraud', 'model'], tone: 'request', duration: 1.4 },
          { path: ['model', 'fraud', 'pay'], tone: 'response', label: '80 ms', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Rollback, 02:22',
          icon: 'Zap',
          code: 'deploy rollback fraud-model\n  v41 -> v40\n\n# inference p99\n# 900 ms -> 80 ms\n# retries stop on their own',
        },
        caption: 'Removing the trigger lets the loop drain',
      },
    },
    {
      title: 'Recovery',
      tag: 'case',
      heading: 'Load normalizes within 90 seconds',
      eli5: 'Once answers come back quickly the pile of slips shrinks. In about a minute and a half the kitchen is calm again.',
      body: [
        'Queued work drains because new calls complete in time and nobody is adding retries. Load goes from 6x back to about 1x in **90 seconds**. Error rate follows.',
        'The service is up, but the same SDK is still deployed. The next latency blip would start the same loop. The incident is mitigated, not fixed.',
      ],
      keyIdea: 'Recovery shows the loop was the cause. It also means the next slowdown will do it again until the retry policy changes.',
      metrics: { err: '0.3%', p99: '130 ms', cpu: '38%', load: '1.0x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...shop, status: 'ok' },
          { ...pay, load: 32 },
          { ...fraud, status: 'ok', load: 38 },
        ],
        links: chain(),
        flows: [
          { path: ['shop', 'pay', 'fraud'], tone: 'request', duration: 1.4 },
          { path: ['fraud', 'pay', 'shop'], tone: 'response', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Fraud-check load after rollback',
          icon: 'TrendingUp',
          rows: [
            { text: '02:22:00 rollback', value: '6.0x', tone: 'bad' },
            { text: '02:22:30', value: '3.1x', tone: 'warn' },
            { text: '02:23:00', value: '1.4x', tone: 'warn' },
            { text: '02:23:30', value: '1.0x', tone: 'good' },
          ],
          footer: { text: 'The retry policy is still naive', tone: 'warn' },
        },
        caption: 'Healthy again, same weakness',
      },
    },
    {
      title: 'Root cause',
      tag: 'tradeoff',
      heading: 'Root cause: the missing guardrails, not the model',
      eli5: 'The new chef was only the spark. The real problem was that waiters had no rule about how often to shout, so any slowdown became a riot.',
      body: [
        'The model made fraud-check slow, but slow dependencies happen all the time. The outage came from a client with **no backoff, no jitter, no circuit breaker and no retry budget**.',
        'A 11x slowdown stayed an outage, instead of a blip, because nothing limited how many extra calls the callers could send. The model also went to every instance at once. A canary or staged rollout would have shown the slowdown on a small slice first.',
      ],
      keyIdea: 'Judge a design by how it behaves when a dependency is slow, not only when it is dead.',
      metrics: { err: '0.3%', p99: '130 ms', cpu: '38%', load: '1.0x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: 'no backoff', tone: 'bad' }, { text: 'no jitter', tone: 'bad' }, { text: 'no breaker', tone: 'bad' }, { text: 'no budget', tone: 'bad' }] },
          { ...fraud, status: 'ok' },
        ],
        links: [link('pay', 'fraud')],
        flows: [{ path: ['pay', 'fraud'], tone: 'request', duration: 1.4 }],
        panel: {
          title: 'Contributing factors',
          icon: 'Bug',
          rows: [
            { text: 'trigger: model p99 11x slower', value: 'spark', tone: 'warn' },
            { text: 'amplifier: immediate retries', value: 'cause', tone: 'bad' },
            { text: 'amplifier: layered retries', value: 'cause', tone: 'bad' },
            { text: 'detection: no retry metric', value: 'gap', tone: 'warn' },
            { text: 'prevention: staged model rollout', value: 'canary first', tone: 'good' },
          ],
        },
        caption: 'The retry policy turned a blip into an outage',
      },
    },
    {
      title: 'Backoff',
      tag: 'concept',
      heading: 'Fix 1: exponential backoff with full jitter',
      eli5: 'Now the **waiter** waits a little before shouting again, and waits longer each time, and picks a random wait so all the waiters do not shout together.',
      body: [
        '**Exponential backoff** doubles the wait between attempts: 100 ms, 200 ms, 400 ms, up to a cap. It gives the dependency time to recover instead of hammering it.',
        '**Full jitter** picks a random delay between 0 and that backoff. Without jitter, clients that failed together retry together, which sends spikes of load at the same instants.',
      ],
      keyIdea: 'Backoff spreads retries in time. Jitter stops clients from retrying in lockstep.',
      metrics: { err: '0.3%', p99: '130 ms', cpu: '38%', load: '1.0x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: 'backoff 100 ms x 2^n', tone: 'good' }, { text: 'full jitter', tone: 'good' }] },
          { ...fraud, status: 'active', load: 60 },
        ],
        links: [link('pay', 'fraud', { label: 'spread out', labelTone: 'good' })],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'try 1', duration: 1.0 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'try 2 (+37 ms)', duration: 1.0, delay: 1.5 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'try 3 (+190 ms)', duration: 1.0, delay: 3.2 },
        ],
        panel: {
          title: 'Wait before each retry',
          icon: 'Clock',
          rows: [
            { text: 'retry 1', value: 'rand(0, 100 ms)' },
            { text: 'retry 2', value: 'rand(0, 200 ms)' },
            { text: 'retry 3', value: 'rand(0, 400 ms)' },
          ],
          footer: { text: 'Cap the backoff, here 2 s', tone: 'muted' },
        },
        caption: 'Spread the retries, never lockstep',
      },
      code: {
        language: 'typescript',
        title: 'After: backoff with full jitter',
        source: `for (let i = 0; i < 4; i++) { // 1 call + 3 retries
  try {
    return await http.post('/fraud', req, { timeout: 2000 });
  } catch (e) {
    if (!isRetryable(e)) throw e;
    if (i === 3) break; // last attempt, no sleep
    const backoff = Math.min(100 * 2 ** i, 2000);
    const jitter = Math.random() * backoff; // full jitter
    await sleep(jitter);
  }
}
throw new Error('fraud-check failed');`,
        highlight: [5, 6, 7, 8, 9, 12],
      },
    },
    {
      title: 'Circuit breaker',
      tag: 'concept',
      heading: 'Fix 2: a circuit breaker per downstream',
      eli5: 'If the chef is clearly overwhelmed, the **waiter** stops carrying slips for a while and tells guests "back in a minute". That gives the chef room.',
      body: [
        'A **circuit breaker** watches failures to one dependency. Above a threshold, for example 50% failures over 10 s, it **opens**: calls fail at once or use a fallback, and nothing reaches the dependency.',
        'After a pause it lets a few trial calls through (half-open). If they succeed it closes. Key it per downstream service.',
        'While open, payment must choose: fail open (accept, review later) or fail closed (reject). A middle path is a rules-only score.',
      ],
      keyIdea: 'A breaker converts slow failure into fast failure and gives the dependency room to recover.',
      metrics: { err: '2%', p99: '300 ms', cpu: '55%', load: '1.2x' },
      metricTones: { err: 'warn', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: 'breaker: OPEN', tone: 'warn' }, { text: 'rules-only', tone: 'good' }] },
          { ...fraud, status: 'active', load: 55, chips: [{ text: '1.2x traffic', tone: 'good' }] },
        ],
        links: [link('pay', 'fraud', { style: 'dashed', label: 'calls paused', labelTone: 'warn' })],
        flows: [{ path: ['pay', 'fraud'], tone: 'request', label: 'half-open trial', duration: 1.4 }],
        panel: {
          title: 'Breaker states',
          icon: 'Shield',
          rows: [
            { text: 'closed', value: 'calls flow', tone: 'good' },
            { text: 'open: failures over 50%', value: 'fail fast', tone: 'warn' },
            { text: 'half-open after pause', value: 'few trial calls' },
            { text: 'fail open vs closed', value: 'rules-only fallback', tone: 'warn' },
          ],
          footer: { text: 'See the circuit breakers lesson', tone: 'muted' },
        },
        caption: 'The dependency is shielded while it recovers',
      },
    },
    {
      title: 'Retry budget',
      tag: 'concept',
      heading: 'Fix 3: a retry budget caps the extra load',
      eli5: 'Each waiter may only reshout for one slip in ten. After that, a slip that fails just fails, so the pile can never run away.',
      body: [
        'A **retry budget** caps retries at a share of total traffic, such as **10%** of baseline requests. Once spent, extra retries fail immediately.',
        'Per-request limits (3 retries each) still allow 4x in total. A global budget limits amplification to at most about 1.1x, however many calls fail.',
      ],
      keyIdea: 'Budget retries across all requests, not per request. The total extra load then has a hard ceiling.',
      metrics: { err: '2%', p99: '300 ms', cpu: '45%', load: '1.1x' },
      metricTones: { err: 'warn', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: 'budget: 10%', tone: 'good' }] },
          { ...fraud, status: 'active', load: 45, chips: [{ text: '1.1x traffic', tone: 'good' }] },
        ],
        links: [link('pay', 'fraud', { label: 'max +10% retries', labelTone: 'good' })],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: '100 calls', duration: 1.2 },
          { path: ['pay', 'fraud'], tone: 'request', label: '10 retries', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Per-request cap vs budget',
          icon: 'Scale',
          rows: [
            { text: '3 retries per request', value: 'up to 4x', tone: 'bad' },
            { text: '10% retry budget', value: 'up to 1.1x', tone: 'good' },
            { text: 'budget spent', value: 'fail immediately', tone: 'warn' },
          ],
        },
        caption: 'A ceiling on amplification',
      },
    },
    {
      title: 'Safe retries',
      tag: 'concept',
      heading: 'Fix 4: retry only what is safe to repeat',
      eli5: 'The slip carries a unique number. If the chef already cooked slip 123, a repeat of it gets the same dish, not a second one.',
      body: [
        'Retry only **retryable** errors such as timeouts and 503s. A 400 fails the same way every time.',
        'A retry may run twice, because the first attempt can succeed after the caller gave up. The double-charge risk is checkout retrying payment. An **idempotency key** (the `paymentId`) lets payment return the first charge result.',
        'Retry at one layer only, pass a deadline downstream, and honor `Retry-After`.',
      ],
      keyIdea: 'Retries are only safe when repeated calls have the same effect as one. Idempotency keys make that true.',
      metrics: { err: '2%', p99: '300 ms', cpu: '45%', load: '1.1x' },
      metricTones: { err: 'warn', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...shop, chips: [{ text: 'key: pay_9001', tone: 'good' }] },
          { ...pay, status: 'ok', load: 45, chips: [{ text: 'dedupe by key', tone: 'good' }] },
        ],
        links: [link('shop', 'pay')],
        flows: [
          { path: ['shop', 'pay'], tone: 'request', label: 'pay_9001', duration: 1.2 },
          { path: ['shop', 'pay'], tone: 'request', label: 'pay_9001 (retry)', duration: 1.2, delay: 1.5 },
          { path: ['pay', 'shop'], tone: 'response', label: 'first charge result', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'Which errors to retry',
          icon: 'List',
          rows: [
            { text: 'timeout', value: 'retry', tone: 'good' },
            { text: '503 overloaded', value: 'retry', tone: 'good' },
            { text: '400 bad request', value: 'never', tone: 'bad' },
            { text: '402 card declined', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Safe to repeat, safe to dedupe',
      },
    },
    {
      title: 'Quiz: fixes',
      tag: 'tradeoff',
      heading: 'Check: which guardrail caps the total?',
      eli5: 'One rule says "each waiter may shout three times". Another says "the whole room may reshout for one slip in ten". Only one stops a whole room from piling up.',
      body: [
        'You have per-request retry limits, jitter, a circuit breaker and a retry budget. They address different parts of the problem.',
        'Pick the one that puts a ceiling on total extra load across all callers.',
      ],
      keyIdea: 'Match the guardrail to the failure: spread, stop, or cap.',
      metrics: { err: '2%', p99: '300 ms', cpu: '45%', load: '1.1x' },
      metricTones: { err: 'warn', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: 'jitter', tone: 'good' }, { text: 'breaker', tone: 'good' }, { text: 'budget 10%', tone: 'good' }] },
          { ...fraud, status: 'ok', load: 45 },
        ],
        links: [link('pay', 'fraud')],
        flows: [{ path: ['pay', 'fraud'], tone: 'request', duration: 1.4 }],
        caption: 'Spread, stop, cap',
      },
      quiz: {
        question: 'Which mechanism puts a hard ceiling on the total extra load retries can add across all callers?',
        options: [
          'Full jitter on each retry delay',
          'A 3 retry limit per request',
          'A retry budget of 10% of baseline traffic',
          'A longer client timeout',
        ],
        answer: 2,
        explain: 'Jitter spreads retries in time and a per-request limit still allows 4x in total. A global retry budget caps the extra traffic as a share of the whole, so amplification cannot exceed about 1.1x.',
      },
    },
    {
      title: 'Bulkheads',
      tag: 'concept',
      heading: 'Fix 5: bulkheads keep one slow dependency contained',
      eli5: 'Give each kind of order its own chef station, so a jam at the dessert station cannot block the soup.',
      body: [
        '**Bulkheads** give each downstream its own thread or connection pool, so one slow dependency cannot use up every thread in the caller.',
        'Payment keeps 20 connections for fraud-check and 20 for the ledger. If fraud-check stalls, only its pool fills. Card charges to the ledger keep flowing.',
      ],
      keyIdea: 'Separate pools contain the damage. A slow dependency can only exhaust its own share.',
      metrics: { err: '1%', p99: '260 ms', cpu: '60%', load: '1.1x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: 'pool: fraud 20', tone: 'good' }, { text: 'pool: ledger 20', tone: 'good' }] },
          { ...fraud, status: 'active', load: 60 },
          { id: 'ledger', kind: 'block', at: at(-1.7, 6.2), label: 'ledger', sub: 'unaffected', icon: 'Database', tint: 'green', status: 'ok' },
        ],
        links: [link('pay', 'fraud'), link('pay', 'ledger')],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'slow, own pool', duration: 1.3 },
          { path: ['pay', 'ledger'], tone: 'request', label: 'still fast', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Separate pools',
          icon: 'Layers',
          rows: [
            { text: 'fraud-check pool', value: 'full, contained', tone: 'warn' },
            { text: 'ledger pool', value: 'free', tone: 'good' },
            { text: 'payment threads', value: 'not exhausted', tone: 'good' },
          ],
        },
        caption: 'Slow dependencies stay contained',
      },
    },
    {
      title: 'Load shedding',
      tag: 'concept',
      heading: 'Fix 6: shed optional work and pass deadlines',
      eli5: 'If the kitchen is full, turn away the least important orders first and keep cooking the ones guests already paid for.',
      body: [
        '**Load shedding** drops lower-priority work when a service is under pressure, such as order-history lookups or promo banners, to keep capacity for card authorization.',
        'Pair it with **deadlines**: pass the remaining time budget downstream so work whose caller has already given up is dropped instead of run.',
      ],
      keyIdea: 'Protect the critical path by dropping optional work first.',
      metrics: { err: '1%', p99: '260 ms', cpu: '60%', load: '1.1x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, load: 60, chips: [{ text: 'shed: promo banners', tone: 'warn' }, { text: 'deadline passed down', tone: 'good' }] },
          { ...fraud, status: 'active', load: 60 },
        ],
        links: [link('pay', 'fraud')],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'card authorization', duration: 1.3 },
        ],
        panel: {
          title: 'Shedding order',
          icon: 'Layers',
          rows: [
            { text: 'promo banners', value: 'drop first', tone: 'warn' },
            { text: 'order-history lookups', value: 'drop next', tone: 'warn' },
            { text: 'card authorization', value: 'always keep', tone: 'good' },
          ],
        },
        caption: 'Optional work goes first',
      },
    },
    {
      title: 'Prove it',
      tag: 'case',
      heading: 'Follow-up: inject latency and watch for amplification',
      eli5: 'Before the lunch rush, the manager tells one chef to slow down on purpose and watches whether the waiters panic. If they stay calm, the rules work.',
      body: [
        'Inject **3 s of latency** (above the 2 s client timeout) or add 30% errors to a dependency in a test or game day. The test must push calls past the timeout, or no retry ever happens and nothing shows. Graph calls per upstream request. If it stays near 1.0 the policy holds. If it climbs toward 4 you still have a storm waiting.',
        'Add alerts on the retry rate and on the ratio between hops, so the next storm is spotted in a minute, not after a page. Make this a monthly game day.',
      ],
      keyIdea: 'A retry policy is not tested until you slow a dependency on purpose and measure the amplification.',
      metrics: { err: '1%', p99: '260 ms', cpu: '55%', load: '1.1x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: '1.08 attempts', tone: 'good' }] },
          { ...fraud, status: 'active', load: 55, chips: [{ text: '+3 s latency', tone: 'warn' }] },
          { id: 'mon', kind: 'monitor', at: at(1.7, 4.6), label: 'alerts', sub: 'retry ratio', status: 'ok' },
        ],
        links: [link('pay', 'fraud'), link('fraud', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'call past 2 s', duration: 1.5 },
          { path: ['fraud', 'mon'], tone: 'event', label: 'ratio 1.08', duration: 1.3, delay: 1.6 },
        ],
        panel: {
          title: 'Game day checklist',
          icon: 'List',
          rows: [
            { text: 'inject 3 s (past the 2 s timeout)', value: 'step 1' },
            { text: 'calls per upstream request', value: 'stays near 1', tone: 'good' },
            { text: 'breaker opens', value: 'yes', tone: 'good' },
            { text: 'alert on retry rate', value: 'fires', tone: 'good' },
          ],
        },
        caption: 'Break it on purpose, in daylight',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A slow dependency is harder to handle than a dead one',
      eli5: 'The kitchen got slow, the waiters kept shouting, and the pile fed itself. Fix the shouting rules and a slow kitchen is just a slow kitchen.',
      body: [
        'Timeline: 02:10 deploy, 02:11 timeouts, 02:13 loop at 4x, 02:14 page, 02:22 rollback, 90 s to recover. Retries turned 1.3x of traffic into 6x on fraud-check.',
        'Prevention for every RPC client: backoff with full jitter, a circuit breaker per downstream, a retry budget around 10%, idempotency keys, bulkheads, load shedding and a staged rollout for model deploys. After the incident the policy became 2 attempts with jitter and a breaker. Scale changes behavior: a retry loop fine at 100 QPS can kill you at 100K.',
      ],
      keyIdea: 'Retries are load amplifiers. Cap them, spread them, and stop them early.',
      metrics: { err: '0.2%', p99: '120 ms', cpu: '36%', load: '1.0x' },
      metricTones: { err: 'good', p99: 'good', cpu: 'good', load: 'good' },
      scene: {
        nodes: [
          { ...shop, status: 'ok' },
          { ...pay, status: 'ok', load: 30, chips: [{ text: 'jitter', tone: 'good' }, { text: 'breaker', tone: 'good' }, { text: 'budget 10%', tone: 'good' }] },
          { ...fraud, status: 'ok', load: 36 },
        ],
        links: chain(),
        flows: [
          { path: ['shop', 'pay', 'fraud'], tone: 'request', duration: 1.4 },
          { path: ['fraud', 'pay', 'shop'], tone: 'response', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Incident summary',
          icon: 'Receipt',
          rows: [
            { text: 'trigger', value: 'model 80 to 900 ms' },
            { text: 'amplifier', value: 'naive 3x retries', tone: 'bad' },
            { text: 'detection', value: 'RPS ratio 6x vs 1.3x' },
            { text: 'mitigation', value: 'model rollback', tone: 'good' },
            { text: 'prevention', value: 'jitter, breaker, budget', tone: 'good' },
          ],
        },
        caption: 'Same traffic, guardrails in place',
      },
      quiz: {
        question: 'During a retry storm, fraud-check is at 100% CPU. What should the team try first?',
        options: [
          'Scale fraud-check out to 3x the pods',
          'Remove the trigger or turn retries off, then let the queue drain',
          'Raise the client timeout from 2 s to 20 s',
          'Restart payment-service pods one at a time',
        ],
        answer: 1,
        explain: 'New capacity is consumed by retry traffic at once. Breaking the feedback loop, by rolling back the trigger or disabling retries, lets load drain in about 90 seconds. Capacity work comes after.',
      },
    },
  ],
};
