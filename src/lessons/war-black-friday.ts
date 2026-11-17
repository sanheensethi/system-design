import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const shoppers: SceneNode = { id: 'shoppers', kind: 'user', at: at(-4.2, -3.4), label: 'shoppers', sub: '8x normal' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3.4), label: 'checkout API', sub: 'stateless', icon: 'ShoppingBag', tint: 'violet' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(-2.2, 3.4), label: 'Redis', sub: 'cart cache' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(2.2, 3.4), label: 'db-primary', sub: 'carts and orders' };
const flag: SceneNode = { id: 'flag', kind: 'block', size: 0.72, at: at(4.2, -3.4), label: 'flag', sub: 'gdpr_region_prefix', icon: 'Zap', tint: 'amber' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: at(6.4, 0.4), label: 'dashboards', sub: 'Grafana' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const warBlackFriday: Lesson = {
  id: 'war-black-friday',
  title: 'Black Friday checkout meltdown',
  tagline: 'A cache key change on the biggest sales day of the year. Follow the incident from the pager to the postmortem.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'How to read an incident: normal state, trigger, cascade, investigation, mitigation, fix',
    'Why a cache key change is a schema migration and can empty the whole cache at once',
    'Why adding servers to a stateless tier makes a database bottleneck worse',
    'Which graphs and log lines separate a traffic spike from a cache miss storm',
    'Stopping the bleeding with a feature flag, then fixing the cause with dual reads',
    'Canary checks on cache hit rate, freeze windows and a blameless postmortem',
  ],
  metrics: [
    { key: 'success', label: 'Checkout success', icon: 'TrendingUp' },
    { key: 'p99', label: 'API p99', icon: 'Timer' },
    { key: 'hit', label: 'Cache hit rate', icon: 'Gauge' },
    { key: 'dbcpu', label: 'DB CPU', icon: 'Cpu' },
  ],
  steps: [
    {
      title: 'The pager',
      tag: 'problem',
      heading: '11:47 AM, Black Friday: twelve pages at once',
      eli5: 'It is the busiest day at the pizza shop. Suddenly nobody gets their pizza, the **waiters** stand frozen at the counter and the one chef in the back is flat out.',
      body: [
        'Checkout success fell from **98.4% to 31.2%** in 90 seconds. `db-primary` CPU is at 99%. `checkout-api` p99 latency is **14 s** against an SLO of 400 ms. Revenue shows $3.2M an hour instead of $11M.',
        'Priya, the senior on-call, joins the bridge. Dev, three months in, is on with her. The VP of Engineering joins "just to observe".',
      ],
      keyIdea: 'An incident starts as a handful of red numbers and no explanation. The job is to find the cause fast, in the right order.',
      metrics: { success: '31.2%', p99: '14 s', hit: '?', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...shoppers, status: 'hot' },
          { ...api, status: 'hot', load: 96 },
          { ...db, status: 'hot', load: 99 },
        ],
        links: [link('shoppers', 'api', { label: 'HTTPS' }), link('api', 'db')],
        flows: [
          { path: ['shoppers', 'api', 'db'], tone: 'request', label: 'checkout', duration: 1.6 },
          { path: ['api', 'shoppers'], tone: 'error', label: '503 / timeout', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'PagerDuty, 11:47 PT',
          icon: 'Activity',
          rows: [
            { text: 'checkout-success-rate', value: '98.4 → 31.2%', tone: 'bad' },
            { text: 'checkout-api p99', value: '14 s (SLO 400 ms)', tone: 'bad' },
            { text: 'db-primary CPU', value: '99%', tone: 'bad' },
            { text: 'Revenue per hour', value: '$3.2M (was $11M)', tone: 'warn' },
          ],
          footer: { text: '12 pages firing together', tone: 'bad' },
        },
        caption: 'Everything is red and nobody knows why',
      },
    },
    {
      title: 'Normal day',
      tag: 'concept',
      heading: 'Before: a healthy checkout path at 8x traffic',
      eli5: 'Most of the time a **waiter** grabs the guest\'s tray from the warm shelf. The chef only cooks when the shelf has nothing for that guest.',
      body: [
        'Each checkout reads the shopper\'s cart. The API asks **Redis** first, with key `checkout:cart:{user_id}` and a 6 hour TTL. Only a miss goes to `db-primary`.',
        'Hit rate is **92%**, so the database sees about 1 read in 12. The team sized everything for 8x the normal traffic, because the forecast said so, and the CDN graphs agree with the forecast.',
      ],
      keyIdea: 'The database was sized for the traffic that leaks past the cache, not for the traffic that arrives.',
      metrics: { success: '98.4%', p99: '180 ms', hit: '92%', dbcpu: '22%' },
      metricTones: { success: 'good', p99: 'good', hit: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'ok', load: 55 },
          { ...cache, status: 'ok', chips: [{ text: 'hit 92%', tone: 'good' }] },
          { ...db, status: 'ok', load: 22 },
        ],
        links: [link('shoppers', 'api'), link('api', 'cache'), link('api', 'db', { style: 'dashed', label: '8% miss' })],
        flows: [
          { path: ['shoppers', 'api', 'cache', 'api', 'shoppers'], tone: 'request', label: 'GET cart', duration: 2.4, count: 2 },
          { path: ['api', 'db', 'api'], tone: 'request', duration: 1.8, delay: 1.2 },
        ],
        panel: {
          title: 'Capacity plan, Black Friday',
          icon: 'Table',
          rows: [
            { text: 'Traffic', value: '8x normal' },
            { text: 'Cache hit rate', value: '92%', tone: 'good' },
            { text: 'DB reads per 100 requests', value: '8', tone: 'good' },
            { text: 'DB CPU', value: '22%', tone: 'good' },
          ],
        },
        caption: 'The cache soaks up 92% of reads',
      },
    },
    {
      title: 'The deploy',
      tag: 'concept',
      heading: '09:30 ship, 11:40 enable: a small, correct compliance change',
      eli5: 'The new stickers were printed that morning but kept in a drawer. At 11:40 someone told the **waiters** to start using them, and no tray on the shelf has one.',
      body: [
        'A GDPR consent change had to ship that morning for EU compliance. It added a region to the cache key: `checkout:cart:{user_id}` became `checkout:v2:cart:u/{user_id}:{region}`.',
        'The change was correct and passed review. It shipped at 09:30 dormant behind the flag `gdpr_region_prefix`, so nothing changed. Legal asked for it to be enabled before the sale peak, and the flag went on at about 11:40, ten minutes after traffic ramped to 8x.',
      ],
      keyIdea: 'A cache key is a contract with every entry already stored. Changing its shape orphans all of them.',
      metrics: { success: '98.4%', p99: '185 ms', hit: '92%', dbcpu: '22%' },
      metricTones: { success: 'good', p99: 'good', hit: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...flag, status: 'active', chips: [{ text: 'dormant 09:30, on 11:40', tone: 'warn' }] },
          { ...api, status: 'active', load: 58 },
          { ...cache, chips: [{ text: 'old keys: 6 h TTL', tone: 'good' }] },
        ],
        links: [link('flag', 'api', { label: 'config' }), link('api', 'cache')],
        flows: [{ path: ['flag', 'api'], tone: 'event', label: 'key format v2', duration: 1.6 }],
        panel: {
          title: 'config repo, 09:30',
          icon: 'FileCode',
          code: '- key = f"checkout:cart:{user_id}"\n+ key = f"checkout:v2:cart:u/{user_id}:{region}"',
          footer: { text: 'Shipped dormant at 09:30, enabled at 11:40', tone: 'warn' },
        },
        caption: 'The deploy looks harmless',
      },
      code: {
        language: 'python',
        title: 'cart_cache.py after the change',
        source: `def cart_key(user_id: int, region: str) -> str:
    if flags.on("gdpr_region_prefix"):
        # new format, EU data residency
        return f"checkout:v2:cart:u/{user_id}:{region}"
    return f"checkout:cart:{user_id}"

def get_cart(user_id, region):
    key = cart_key(user_id, region)
    cart = redis.get(key)
    if cart is None:
        cart = db.load_cart(user_id)      # miss goes to the primary
        redis.setex(key, 6 * 3600, cart)
    return cart`,
        highlight: [2, 4, 10],
      },
    },
    {
      title: 'Cold cache',
      tag: 'concept',
      heading: 'Every old entry became unreachable at once',
      eli5: 'The **waiters** look for the new sticker and find none. Every guest looks like a new guest, so every order goes to the chef to be cooked from scratch.',
      body: [
        'Redis still holds millions of carts under the old keys. Nothing reads them anymore. Every lookup uses the new key, finds nothing and falls through to the database, which then writes the new key.',
        'The flag went on at 11:40, so none of the new keys existed yet. Hit rate drops from 92% to **4%** within minutes. A normal-day cold cache would trickle into the database. On Black Friday, 8x the traffic arrives into an empty cache at the same moment.',
      ],
      keyIdea: 'A cold cache is a stampede with a delay: the database gets the full read load that the cache used to absorb.',
      metrics: { success: '84%', p99: '2.1 s', hit: '4%', dbcpu: '78%' },
      metricTones: { success: 'warn', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot', load: 80 },
          { ...cache, status: 'dim', chips: [{ text: 'GET v2 key: nil', tone: 'bad' }, { text: 'hit 4%', tone: 'bad' }] },
          { ...db, status: 'hot', load: 78 },
        ],
        links: [link('api', 'cache', { label: 'miss', labelTone: 'bad' }), link('api', 'db', { label: '96% of reads', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'cache'], tone: 'request', label: 'v2 key', duration: 1 },
          { path: ['cache', 'api'], tone: 'error', label: 'nil', duration: 1, delay: 1.1 },
          { path: ['api', 'db'], tone: 'request', label: 'SELECT cart', count: 4, duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Redis keyspace',
          icon: 'Database',
          rows: [
            { text: 'Old keys (checkout:cart:*)', value: '4.1M, unread', tone: 'warn' },
            { text: 'New keys (checkout:v2:*)', value: 'filling slowly', tone: 'warn' },
            { text: 'Hit rate', value: '92 → 4%', tone: 'bad' },
          ],
        },
        caption: 'The cache is healthy and useless',
      },
    },
    {
      title: 'Cascade',
      tag: 'concept',
      heading: 'The database saturates and the pool runs dry',
      eli5: 'One chef cannot cook for every guest. The queue at the stove grows, the **waiters** wait for him, and soon they have no free hands left to take new orders.',
      body: [
        '`db-primary` CPU reaches 99%. Each query now takes seconds, and every checkout holds a database connection while it waits. The connection pool on `checkout-api` is exhausted at 11:48. It holds 5 connections per pod across 40 pods, so **200 in total**.',
        'Requests with no connection wait, then time out. Pods look busy but are only blocked. The slowest component sets the speed of everything in front of it.',
      ],
      keyIdea: 'Saturation spreads backward: a slow stateful tier fills the pools and queues of every tier above it.',
      metrics: { success: '52%', p99: '9 s', hit: '4%', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...shoppers, status: 'active' },
          { ...api, status: 'hot', load: 94, chips: [{ text: 'pool 200/200', tone: 'bad' }] },
          { ...db, status: 'hot', load: 99, chips: [{ text: 'queries 4.8 s', tone: 'bad' }] },
        ],
        links: [link('shoppers', 'api'), link('api', 'db', { label: 'slow', labelTone: 'bad' })],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', count: 3, duration: 2, delay: 1.2 },
          { path: ['api', 'shoppers'], tone: 'error', label: 'timeout', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'checkout-api, 11:48',
          icon: 'Cable',
          rows: [
            { text: 'DB pool (5 per pod x 40 pods)', value: '200 of 200 busy', tone: 'bad' },
            { text: 'Requests waiting for a connection', value: '1,900', tone: 'bad' },
            { text: 'Median DB query', value: '4.8 s', tone: 'bad' },
          ],
          footer: { text: 'Pods are busy waiting, not working', tone: 'warn' },
        },
        caption: 'Waiting threads pile up above the slow database',
      },
    },
    {
      title: 'Errors spread',
      tag: 'concept',
      heading: 'Timeouts, retries and a falling success rate',
      eli5: 'Hungry guests who wait too long walk out and come back, so the line gets longer. Every retry is one more order for the already tired chef.',
      body: [
        'Clients and the CDN give up at 10 s and retry up to 3 times. Retries add load to the same overloaded database, so the queue grows faster than it drains.',
        'By 11:49 checkout success is near 31%. The 14 s p99 is server-side latency, measured at the API after many clients have already timed out and left. That is the shape of a **metastable** failure: even if the trigger vanished, the extra retry load keeps the system down for a while.',
      ],
      keyIdea: 'Retries turn an overload into a longer overload. Past the tipping point the system will not heal on its own.',
      metrics: { success: '31.2%', p99: '14 s', hit: '4%', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...shoppers, status: 'hot', chips: [{ text: 'retry x3', tone: 'warn' }] },
          { ...api, status: 'hot', load: 98 },
          { ...db, status: 'down', load: 99, badge: 'saturated' },
        ],
        links: [link('shoppers', 'api', { label: 'retries', labelTone: 'warn' }), link('api', 'db')],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', count: 5, duration: 1.1 },
          { path: ['api', 'db'], tone: 'request', count: 5, duration: 1.6, delay: 1.1 },
          { path: ['api', 'shoppers'], tone: 'error', label: '504', count: 3, duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'Request outcomes, 11:49',
          icon: 'Activity',
          rows: [
            { text: 'Succeeded', value: '31%', tone: 'bad' },
            { text: 'Timed out at 10 s', value: '58%', tone: 'bad' },
            { text: 'Rejected, pool full', value: '11%', tone: 'warn' },
            { text: 'Retries per failure', value: 'up to 3', tone: 'warn' },
          ],
        },
        caption: 'Retry load keeps the overload going',
      },
    },
    {
      title: 'Traffic spike?',
      tag: 'case',
      heading: '11:49: is it traffic, or an attack?',
      eli5: 'The manager first checks the front door. Is the crowd bigger than expected? It is big, but the crowd is the size the shop planned for.',
      body: [
        'Dev asks the obvious question: are we being DDoSed? Priya checks the CDN. Traffic is high but inside the Black Friday forecast, and the request mix looks normal.',
        'A first check should rule hypotheses out quickly. If load matches the plan, the system must be doing more work per request than usual. The next question is where.',
      ],
      keyIdea: 'Compare current load to the forecast first. If it matches, the problem is cost per request, not request count.',
      metrics: { success: '31.2%', p99: '14 s', hit: '?', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...shoppers, chips: [{ text: 'within forecast', tone: 'good' }] },
          { ...mon, status: 'active' },
          { ...api, status: 'hot', load: 98 },
        ],
        links: [link('shoppers', 'api'), link('api', 'mon', { style: 'faint', label: 'metrics' })],
        flows: [{ path: ['shoppers', 'api'], tone: 'request', count: 3, duration: 1.4 }, { path: ['api', 'mon'], tone: 'event', label: 'metrics', duration: 1.4, delay: 1.5 }],
        panel: {
          title: 'CDN dashboard, 11:50',
          icon: 'Globe',
          rows: [
            { text: 'Requests per second', value: '1.9M (forecast 2.0M)', tone: 'good' },
            { text: 'Top paths', value: 'normal mix', tone: 'good' },
            { text: 'Bot or WAF blocks', value: 'baseline', tone: 'good' },
            { text: 'Origin errors', value: 'rising', tone: 'bad' },
          ],
          footer: { text: 'Not a DDoS. Look deeper.', tone: 'muted' },
        },
        caption: 'The crowd matches the plan',
      },
    },
    {
      title: 'Wrong path',
      tag: 'tradeoff',
      heading: 'Do not scale out the stateless tier',
      eli5: 'Hiring ten more waiters does not help when there is one chef. Ten waiters just shout ten times more orders at him.',
      body: [
        'Dev wants to add checkout pods. Priya lets him start typing, then stops him. Each pod opens 5 connections, so 120 pods would mean 600 against a database already at 99%, 3x as many as now.',
        'Scaling a tier fixes a bottleneck only when that tier is the bottleneck. Find the saturated resource first, then add capacity to it, or cut the work that reaches it.',
      ],
      keyIdea: 'Adding capacity above a dying stateful tier multiplies the pressure on it and makes the incident worse.',
      metrics: { success: '28%', p99: '14 s', hit: '4%', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: [{ text: 'scale 40 to 120 pods', tone: 'warn' }] },
          { ...db, status: 'hot', load: 99, chips: [{ text: 'conns 3x', tone: 'bad' }] },
          { ...mon, status: 'dim' },
        ],
        links: [link('api', 'db', { label: '3x connections', labelTone: 'bad' }), link('api', 'mon', { style: 'faint' })],
        flows: [{ path: ['api', 'db'], tone: 'request', count: 6, duration: 1.2 }, { path: ['db', 'api'], tone: 'error', label: 'too many connections', duration: 1.4, delay: 1.3 }],
        panel: {
          title: 'If Dev had run the command',
          icon: 'Bug',
          rows: [
            { text: 'checkout pods', value: '40 → 120' },
            { text: 'DB connection attempts', value: '3x', tone: 'bad' },
            { text: 'Bottleneck moved?', value: 'no, same DB', tone: 'bad' },
            { text: 'Time to recover', value: 'longer', tone: 'bad' },
          ],
        },
        caption: 'More pods, same one database',
      },
      quiz: {
        question: 'CPU is at 99% on the database and the API pods are waiting on it. What is the best first move?',
        options: [
          'Add API pods so more requests run in parallel',
          'Find why so many reads reach the database, and cut that work',
          'Raise the client retry count so more requests succeed',
          'Restart the API pods to clear their queues',
        ],
        answer: 1,
        explain: 'The database is the saturated resource. More pods or retries add load to it, and a restart only resets queues that refill at once. Reducing the reads that reach it is what helps.',
      },
    },
    {
      title: 'Hit rate',
      tag: 'case',
      heading: '11:51: every request is hitting the database',
      eli5: 'The manager peeks at the warm shelf. The shelf is fine and the helper is busy, but almost no guest finds their tray. Something is wrong with finding trays, not with the shelf.',
      body: [
        'Priya opens the APM trace view. Every checkout trace has a database span. Cache hit rate is **4%** against a normal 92%.',
        'Dev guesses Redis is down. It is not: 200k ops per second, healthy latency, memory fine. Redis is answering fast. It just answers "nothing".',
      ],
      keyIdea: 'A healthy cache with a collapsed hit rate means lookups use keys that were never stored. Look at the keys.',
      metrics: { success: '30%', p99: '14 s', hit: '4%', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...mon, status: 'active' },
          { ...cache, status: 'ok', chips: [{ text: '200k ops/s', tone: 'good' }, { text: 'hit 4%', tone: 'bad' }] },
          { ...db, status: 'hot', load: 99 },
        ],
        links: [link('mon', 'cache', { style: 'faint', label: 'APM' }), link('cache', 'db', { style: 'faint' })],
        flows: [{ path: ['mon', 'cache'], tone: 'request', label: 'inspect', duration: 1.4 }],
        panel: {
          title: 'Redis, 11:53',
          icon: 'Gauge',
          rows: [
            { text: 'Server status', value: 'healthy', tone: 'good' },
            { text: 'Ops per second', value: '200k', tone: 'good' },
            { text: 'p99 latency', value: '0.8 ms', tone: 'good' },
            { text: 'Hit rate', value: '4% (normal 92%)', tone: 'bad' },
          ],
          footer: { text: 'Redis is fine. It is the hit rate.', tone: 'warn' },
        },
        caption: 'The cache answers quickly and finds nothing',
      },
    },
    {
      title: 'Key samples',
      tag: 'case',
      heading: '11:55: the keys do not match',
      eli5: 'The manager reads the stickers. The trays on the shelf say one thing and the waiters ask for another. The two never match, so nothing is ever found.',
      body: [
        'Priya samples what the API asks for and what Redis holds. Requested keys look like `checkout:v2:cart:u/881234:eu`. Stored keys look like `checkout:cart:881234`.',
        'Same user, same data, two different names. Entries written before 11:40 are valid but unreachable, and the few v2 entries written since are too few to matter.',
      ],
      keyIdea: 'Sample real keys from both sides. A format mismatch is obvious in one glance and invisible in every aggregate graph.',
      metrics: { success: '30%', p99: '14 s', hit: '4%', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: [{ text: 'asks: checkout:v2:cart:u/881234:eu', tone: 'warn' }] },
          { ...cache, status: 'dim', chips: [{ text: 'has: checkout:cart:881234', tone: 'good' }] },
        ],
        links: [link('api', 'cache', { label: 'no match', labelTone: 'bad' })],
        flows: [{ path: ['api', 'cache'], tone: 'request', label: 'v2 key', duration: 1.3 }, { path: ['cache', 'api'], tone: 'error', label: 'nil', duration: 1.3, delay: 1.4 }],
        panel: {
          title: 'redis-cli, sampled keys',
          icon: 'Code',
          code: '> SCAN 0 MATCH checkout:* COUNT 5\n1) checkout:cart:881234\n2) checkout:cart:204117\n3) checkout:cart:77031\n> GET checkout:v2:cart:u/881234:eu\n(nil)',
          footer: { text: 'Old format stored, new format requested', tone: 'warn' },
        },
        caption: 'Same cart, two names',
      },
    },
    {
      title: 'Who changed it?',
      tag: 'case',
      heading: '11:58: a change that touched state',
      eli5: 'The manager asks who relabeled the trays. The notebook says a helper did it at 11:40 today for a good reason, and nobody told the kitchen.',
      body: [
        'Priya runs `git blame` on the config repo. The GDPR change added the region prefix to the cache key, for EU data residency. It merged at 09:30 behind a flag, and the flag audit log shows it was enabled at 11:40.',
        'The 11:40 flip lines up with the hit rate curve. Her first question for any deploy near an incident: what in it touched state? Cache keys, flags, schema and config are where the cliff edges are.',
      ],
      keyIdea: 'When a deploy correlates with an incident, ask what in it touched state. Logic bugs rarely fall off cliffs. State changes do.',
      metrics: { success: '30%', p99: '14 s', hit: '4%', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...mon, at: at(8.6, 3), status: 'active', chips: [{ text: 'hit rate cliff 11:40', tone: 'bad' }] },
          { ...flag, status: 'hot', chips: [{ text: 'gdpr_region_prefix: on', tone: 'bad' }] },
          { ...api, status: 'hot', load: 98 },
        ],
        links: [link('mon', 'flag', { style: 'faint', label: 'correlates' }), link('flag', 'api', { label: 'config' })],
        flows: [{ path: ['flag', 'api'], tone: 'event', label: 'v2 keys', duration: 1.4 }],
        panel: {
          title: 'Timeline, today',
          icon: 'Clock',
          rows: [
            { text: '09:30  GDPR key change deployed', value: 'flag off', tone: 'default' },
            { text: '11:30  traffic ramps to 8x', value: 'sale starts', tone: 'default' },
            { text: '11:40  flag enabled, hit rate cliff', value: 'cache cold', tone: 'warn' },
            { text: '11:47  pages fire', value: '31% success', tone: 'bad' },
            { text: '11:58  git blame finds the change', value: 'cause', tone: 'good' },
          ],
        },
        caption: 'The change and the cliff line up',
      },
    },
    {
      title: 'Flip the flag',
      tag: 'concept',
      heading: '12:03: stop the bleeding, fix later',
      eli5: 'Rather than relabel every tray back, the manager flips a switch so the waiters ask for the old sticker again. The original trays are still on the shelf.',
      body: [
        'Priya does not touch the code. She turns off `gdpr_region_prefix`. Keys revert to the old format, and every entry written before 11:40 is reachable again. Entries written under v2 since 11:40 are discarded, which is acceptable because they are only cached copies.',
        'A flag is a mitigation, not a fix. It restores service in minutes, buys time for the real fix and needs no rollback deploy while the system is on fire.',
      ],
      keyIdea: 'Mitigate first with the fastest safe lever, usually a flag or rollback. Understand and fix the cause afterward.',
      metrics: { success: '45%', p99: '9 s', hit: '20%', dbcpu: '92%' },
      metricTones: { success: 'warn', p99: 'bad', hit: 'warn', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...flag, status: 'active', chips: [{ text: 'gdpr_region_prefix: off', tone: 'good' }] },
          { ...api, status: 'active', load: 85 },
          { ...cache, status: 'ok', chips: [{ text: 'old keys valid again', tone: 'good' }] },
        ],
        links: [link('flag', 'api', { label: 'rollout' }), link('api', 'cache')],
        flows: [{ path: ['flag', 'api'], tone: 'event', label: 'key format v1', duration: 1.4 }, { path: ['api', 'cache', 'api'], tone: 'response', label: 'hit', duration: 1.6, delay: 1.5 }],
        panel: {
          title: 'LaunchDarkly, 12:03',
          icon: 'Zap',
          code: 'flag: gdpr_region_prefix\nvalue: false\n# keys revert to checkout:cart:{id}\n# entries from before 11:40 are valid\n# v2 entries since 11:40 are dropped',
          footer: { text: 'No deploy needed', tone: 'good' },
        },
        caption: 'One switch, old keys reachable again',
      },
    },
    {
      title: 'Recovery',
      tag: 'concept',
      heading: '12:11: green, and why recovery took minutes',
      eli5: 'The waiters find their trays again, the chef catches up, and the line shrinks. Guests who were stuck finally get their pizza.',
      body: [
        'Hit rate climbs to **78% within 3 minutes** and settles near 90%. DB CPU falls to 54%, checkout success reaches 94%, then **97.8%** at 12:11. The incident is declared green.',
        'The VP leaves the bridge. Legal is still on it, worried about the compliance deadline, which is a real constraint that the fix must respect.',
      ],
      keyIdea: 'Recovery is visible in the leading metric first. Hit rate moves minutes before success rate does.',
      metrics: { success: '97.8%', p99: '260 ms', hit: '78%', dbcpu: '54%' },
      metricTones: { success: 'good', p99: 'good', hit: 'warn', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...shoppers, status: 'ok' },
          { ...api, status: 'ok', load: 62 },
          { ...cache, status: 'ok', chips: [{ text: 'hit 78%', tone: 'good' }] },
          { ...db, status: 'ok', load: 54 },
        ],
        links: [link('shoppers', 'api'), link('api', 'cache'), link('api', 'db', { style: 'dashed', label: '22% miss' })],
        flows: [
          { path: ['shoppers', 'api', 'cache', 'api', 'shoppers'], tone: 'response', label: '200', duration: 2.4, count: 2 },
          { path: ['api', 'db', 'api'], tone: 'request', duration: 1.8, delay: 1.2 },
        ],
        panel: {
          title: 'Recovery, 12:03 to 12:11',
          icon: 'TrendingUp',
          rows: [
            { text: 'Cache hit rate', value: '4 → 78%', tone: 'good' },
            { text: 'DB CPU', value: '99 → 54%', tone: 'good' },
            { text: 'Checkout success', value: '31 → 97.8%', tone: 'good' },
            { text: 'Total impact', value: '~24 min', tone: 'warn' },
          ],
        },
        caption: 'Back to normal in under 10 minutes after the flag',
      },
      quiz: {
        question: 'Why did flipping the flag restore service within minutes without any warm-up?',
        options: [
          'The flag restarted Redis and cleared stale data',
          'Entries written before 11:40 still existed under the old keys and became reachable again',
          'The flag scaled up the database',
          'Clients stopped retrying once the flag changed',
        ],
        answer: 1,
        explain: 'The 6 hour TTL kept the old entries alive. Returning to the old key format made them reachable, so the cache hit rate recovered without a full re-warm.',
      },
    },
    {
      title: 'Root cause',
      tag: 'concept',
      heading: 'Why a harmless change became an outage',
      eli5: 'On a quiet day the chef could cook every dish fresh, a few at a time. On the busiest day the same cold shelf meant a mountain of orders at once.',
      body: [
        'The cause is a chain. A key change invalidated every cart entry. Every miss had to be served by the database before its key was written, so the cache refilled only as fast as the database could answer, and the database was already saturated. It had been sized for an 8% miss rate, and it got 96%.',
        'Reads are counted against a normal day at 92% hit. The database is comfortable up to about 30x, since it ran at 22% CPU at 8x. A cold cache on a normal day is 12x and fits. At 8x traffic it is 96x and does not.',
      ],
      keyIdea: 'The trigger was small. The outage came from a capacity plan that silently depended on a 92% hit rate.',
      metrics: { success: '31.2%', p99: '14 s', hit: '4%', dbcpu: '99%' },
      metricTones: { success: 'bad', p99: 'bad', hit: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...cache, status: 'dim', chips: [{ text: 'hit 92 → 4%', tone: 'bad' }] },
          { ...db, status: 'hot', load: 99, chips: [{ text: 'comfortable to ~30x', tone: 'warn' }] },
          { ...shoppers, chips: [{ text: '8x traffic', tone: 'warn' }] },
        ],
        links: [link('shoppers', 'cache', { style: 'faint', route: 'straight' }), link('cache', 'db', { label: '12x reads', labelTone: 'bad' })],
        flows: [{ path: ['shoppers', 'cache', 'db'], tone: 'request', count: 5, duration: 1.8 }],
        panel: {
          title: 'DB reads vs normal day at 92% hit',
          icon: 'Table',
          rows: [
            { text: 'Normal day, 92% hit', value: '1x', tone: 'good' },
            { text: 'Normal day, cold cache', value: '12x', tone: 'warn' },
            { text: 'Black Friday, 92% hit', value: '8x', tone: 'good' },
            { text: 'Black Friday, 4% hit', value: '96x', tone: 'bad' },
          ],
          footer: { text: 'DB comfortable up to about 30x', tone: 'warn' },
        },
        caption: 'The plan assumed the cache would always work',
      },
    },
    {
      title: 'Dual read',
      tag: 'concept',
      heading: 'The real fix: migrate keys with a dual read',
      eli5: 'Instead of swapping all the stickers overnight, the waiters check the new sticker first, then the old one, and put the new sticker on as they go. Nobody ever finds an empty shelf.',
      body: [
        'Treat a cache key change like a database migration. Read the **new key**, fall back to the **old key**, and on a fallback copy the value to the new key. Write both for N days, then drop the old read.',
        'Compliance ships the following week this way, with no cold cache and no incident. The legal deadline was never the problem. The rollout method was.',
      ],
      keyIdea: 'Cache key changes are schema migrations. Expand, copy, then contract, never swap.',
      metrics: { success: '98.2%', p99: '200 ms', hit: '91%', dbcpu: '25%' },
      metricTones: { success: 'good', p99: 'good', hit: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active', load: 60 },
          { ...cache, status: 'ok', chips: [{ text: '1. GET v2', tone: 'default' }, { text: '2. GET v1 fallback', tone: 'good' }, { text: '3. SET v2 copy', tone: 'good' }] },
          { ...db, status: 'ok', load: 24 },
        ],
        links: [link('api', 'cache', { arrow: 'both' }), link('api', 'db', { style: 'dashed', label: 'rare' })],
        flows: [
          { path: ['api', 'cache'], tone: 'request', label: 'v2 key', duration: 1 },
          { path: ['api', 'cache'], tone: 'request', label: 'v1 key', duration: 1, delay: 1.1 },
          { path: ['cache', 'api'], tone: 'response', label: 'hit, copy to v2', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Rollout plan',
          icon: 'List',
          rows: [
            { text: 'Day 0: read v2, fall back to v1', value: 'expand', tone: 'good' },
            { text: 'Write v1 and v2 together', value: 'N days', tone: 'default' },
            { text: 'Hit rate stays', value: '~91%', tone: 'good' },
            { text: 'Day N: drop v1', value: 'contract', tone: 'muted' },
          ],
        },
        caption: 'The cache never goes cold',
      },
      code: {
        language: 'python',
        title: 'Dual-read cart lookup',
        source: `def get_cart(user_id, region):
    new_key = f"checkout:v2:cart:u/{user_id}:{region}"
    old_key = f"checkout:cart:{user_id}"

    cart = redis.get(new_key)
    if cart is not None:
        return cart

    cart = redis.get(old_key)            # fall back to the old key
    if cart is None:
        cart = db.load_cart(user_id)     # a true miss
    redis.setex(new_key, 6 * 3600, cart) # copy forward under v2
    return cart`,
        highlight: [5, 9, 13],
      },
    },
    {
      title: 'Hit-rate canary',
      tag: 'concept',
      heading: 'Watch the leading indicator before users do',
      eli5: 'Before opening the whole dining room, the shop lets one table in and checks whether the waiters can still find their trays. If they cannot, the shop stops right there.',
      body: [
        'Hit rate moved before errors did. Add a **pre-deploy canary**: send a small slice of traffic to the new build and compare its cache hit rate to the baseline.',
        'If a deploy drops hit rate by more than 5%, it rolls back automatically. This check would have caught the key change at 1% of traffic when the flag was enabled, not at 100% at 11:47.',
      ],
      keyIdea: 'Hit rate is a leading indicator. Gate deploys on it, and the error rate never has to move.',
      metrics: { success: '98.4%', p99: '185 ms', hit: '92%', dbcpu: '22%' },
      metricTones: { success: 'good', p99: 'good', hit: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...shoppers, chips: [{ text: '1% canary', tone: 'warn' }] },
          { ...api, status: 'active', load: 40, chips: [{ text: 'hit 3% vs 92%', tone: 'bad' }] },
          { ...mon, status: 'active', chips: [{ text: 'rollback', tone: 'good' }] },
        ],
        links: [link('shoppers', 'api'), link('api', 'mon', { label: 'hit rate' })],
        flows: [{ path: ['shoppers', 'api'], tone: 'request', duration: 1.2 }, { path: ['api', 'mon'], tone: 'event', label: 'hit 3%', duration: 1.2, delay: 1.3 }],
        panel: {
          title: 'Canary gate',
          icon: 'Gauge',
          code: 'if canary.hit_rate < baseline.hit_rate - 0.05:\n    rollback(release)\n    page("cache hit rate regression")',
          footer: { text: 'Caught at 1%, not 100%', tone: 'good' },
        },
        caption: 'A bad key change dies at 1% of traffic',
      },
    },
    {
      title: 'Freeze rules',
      tag: 'tradeoff',
      heading: 'Freeze windows and their exceptions',
      eli5: 'On the busiest day the shop stops rearranging the kitchen. If something truly must change, someone who knows the kitchen checks it first.',
      body: [
        'The team adds a **freeze policy**: no schema-shaped changes to hot paths during Black Friday week. That includes cache keys, flags that change data layout, and migrations.',
        'Compliance is real, so exceptions exist, with a review. They are scheduled 30 or more days ahead and must come with a dual-read plan. A freeze with no exceptions just pushes people to bypass it.',
      ],
      keyIdea: 'A freeze lowers risk, and exceptions need review. The goal is a safe rollout, not a blocked one.',
      metrics: { success: '98.4%', p99: '180 ms', hit: '92%', dbcpu: '22%' },
      metricTones: { success: 'good', p99: 'good', hit: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...flag, status: 'dim', chips: [{ text: 'frozen', tone: 'warn' }] },
          { ...api, status: 'ok', load: 55 },
          { ...mon, status: 'ok' },
        ],
        links: [link('flag', 'api', { style: 'dashed', label: 'blocked', labelTone: 'warn' }), link('api', 'mon', { style: 'faint' })],
        flows: [{ path: ['api', 'mon'], tone: 'event', label: 'steady', duration: 1.4 }],
        panel: {
          title: 'Freeze policy',
          icon: 'Shield',
          rows: [
            { text: 'Cache key or schema changes', value: 'frozen', tone: 'warn' },
            { text: 'Exceptions', value: 'review needed', tone: 'default' },
            { text: 'Lead time for exceptions', value: '30+ days', tone: 'default' },
            { text: 'Required with it', value: 'dual-read plan', tone: 'good' },
          ],
        },
        caption: 'A freeze with a reviewed way through',
      },
    },
    {
      title: 'Coalescing',
      tag: 'concept',
      heading: 'Let one request per key reach the database',
      eli5: 'If many guests ask for the same dish together, only one waiter calls the chef and the rest wait for that one tray. The chef cooks it once.',
      body: [
        'Any cold cache can still stampede: a restart, an eviction, a flush. **Request coalescing** lets one request per key, the leader, hit the database while followers wait for its result. **Pre-warming** fills hot keys before traffic arrives.',
        'This is a replay with the guards on, not the real incident. The same cold cache at 4% hit rate would have cost the database far fewer reads.',
      ],
      keyIdea: 'The cache protects the database, so protect the database from the cache going away.',
      metrics: { success: '95%', p99: '420 ms', hit: '4%', dbcpu: '68%' },
      metricTones: { success: 'good', p99: 'warn', hit: 'bad', dbcpu: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'active', load: 70, chips: [{ text: 'what-if: cold cache with guards', tone: 'warn' }, { text: '500 waiters, 1 query', tone: 'good' }] },
          { ...cache, status: 'dim', chips: [{ text: 'cold', tone: 'warn' }] },
          { ...db, status: 'active', load: 68 },
        ],
        links: [link('api', 'cache'), link('api', 'db', { label: '1 per key', labelTone: 'good' })],
        flows: [{ path: ['api', 'db', 'api'], tone: 'request', label: 'single flight', duration: 1.8 }, { path: ['api', 'cache'], tone: 'data', label: 'fill', duration: 1.2, delay: 1.9 }],
        panel: {
          title: 'What-if: replay with guards on',
          icon: 'Shield',
          rows: [
            { text: 'Request coalescing', value: '1 query per key', tone: 'good' },
            { text: 'Pre-warm hot carts', value: 'before sale', tone: 'good' },
            { text: 'Followers', value: 'wait for the leader', tone: 'default' },
          ],
        },
        caption: 'Even a cold cache cannot flatten the database',
      },
      code: {
        language: 'python',
        title: 'Single flight, safe across threads',
        source: `inflight = {}                          # key -> Future
lock = Lock()

def get_cart(key, user_id):
    cart = redis.get(key)
    if cart is not None:
        return cart
    with lock:                             # guard the dict
        fut = inflight.get(key)
        leader = fut is None
        if leader:
            fut = inflight[key] = Future()
    if not leader:
        return fut.result()                # wait for the leader
    try:
        cart = db.load_cart(user_id)
        redis.setex(key, 6 * 3600, cart)
        fut.set_result(cart)
        return cart
    except Exception as exc:
        fut.set_exception(exc)             # waiters see the error too
        raise
    finally:
        with lock:
            del inflight[key]`,
        highlight: [8, 14, 21],
      },
      quiz: {
        question: 'Which change would have stopped a cold cache from overloading the database during this incident?',
        options: [
          'A longer TTL on every cart entry',
          'Request coalescing plus a dual-read key migration',
          'More API pods behind the load balancer',
          'Disabling the retries on the client only',
        ],
        answer: 1,
        explain: 'Dual read avoids the cold cache in the first place, and coalescing limits the damage when a cache does go cold. More pods and a longer TTL do not reduce the reads that reach the database.',
      },
    },
    {
      title: 'Load shedding',
      tag: 'concept',
      heading: 'Fail fast when the database queue is full',
      eli5: 'When the chef has a long queue of orders, the manager tells new guests right away that the kitchen is full. A quick no is kinder than an hour of waiting.',
      body: [
        'Coalescing cuts duplicate reads, but distinct keys can still overload the database. **Load shedding** rejects some requests fast once the database queue passes a limit, instead of letting every request time out slowly. A fast 503 beats a 14 second hang.',
        'Only the leader path sheds. Followers add no database work, so they wait for the leader and are never shed. This is a what-if replay, not the incident timeline.',
      ],
      keyIdea: 'Reject excess work early and cheaply so the work you accept can finish.',
      metrics: { success: '95%', p99: '420 ms', hit: '4%', dbcpu: '68%' },
      metricTones: { success: 'good', p99: 'warn', hit: 'bad', dbcpu: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'active', load: 70, chips: [{ text: 'what-if: cold cache with guards', tone: 'warn' }] },
          { ...db, status: 'active', load: 68, chips: [{ text: 'queue under limit', tone: 'good' }] },
          { ...shoppers, chips: [{ text: 'some get a fast 503', tone: 'warn' }] },
        ],
        links: [link('shoppers', 'api'), link('api', 'db', { label: 'leaders only', labelTone: 'good' })],
        flows: [{ path: ['shoppers', 'api', 'db', 'api'], tone: 'request', duration: 2 }, { path: ['api', 'shoppers'], tone: 'error', label: 'fast 503', duration: 1.2, delay: 2.1 }],
        panel: {
          title: 'What-if: shedding rules',
          icon: 'Shield',
          rows: [
            { text: 'DB queue over limit', value: 'shed leader', tone: 'warn' },
            { text: 'Followers', value: 'never shed', tone: 'good' },
            { text: 'Response', value: 'fast 503', tone: 'good' },
          ],
        },
        caption: 'A fast no keeps the accepted work moving',
      },
      code: {
        language: 'python',
        title: 'Shedding on the leader path only',
        source: `def load_as_leader(key, user_id, fut):
    try:
        if db.queue_depth() > MAX_QUEUE:
            raise Overloaded()             # shed: fast 503
        cart = db.load_cart(user_id)
        redis.setex(key, 6 * 3600, cart)
        fut.set_result(cart)
        return cart
    except Exception as exc:
        fut.set_exception(exc)
        raise`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Postmortem',
      tag: 'concept',
      heading: 'Follow-ups: a blameless postmortem',
      eli5: 'After the busy day, the shop sits down and writes what happened and what to change. The goal is a better shop, not a person to blame.',
      body: [
        'The review is **blameless**. Legal-Alex did nothing wrong, and the change was correct. The system let a risky rollout reach 100% of traffic with no gate. That is what the team fixes.',
        'Each action item has an owner and a date: dual-read migrations, the hit-rate canary, the freeze policy, request coalescing and a runbook line, "stateless tier slow? check the stateful tier first".',
      ],
      keyIdea: 'Fix the process that let a safe change become an outage. Blame teaches people to hide changes.',
      metrics: { success: '98.4%', p99: '180 ms', hit: '92%', dbcpu: '22%' },
      metricTones: { success: 'good', p99: 'good', hit: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...mon, status: 'ok' },
          { ...flag, status: 'ok', chips: [{ text: 'dual read', tone: 'good' }] },
          { ...cache, status: 'ok', chips: [{ text: 'hit 92%', tone: 'good' }] },
        ],
        links: [link('mon', 'flag', { style: 'faint' }), link('flag', 'cache', { style: 'faint' })],
        flows: [{ path: ['mon', 'flag', 'cache'], tone: 'event', label: 'action items', duration: 2 }],
        panel: {
          title: 'Action items',
          icon: 'List',
          rows: [
            { text: 'Dual-read key migrations', value: 'owner set', tone: 'good' },
            { text: 'Hit-rate deploy canary', value: 'owner set', tone: 'good' },
            { text: 'Freeze policy with review', value: 'owner set', tone: 'good' },
            { text: 'Request coalescing and shedding', value: 'owner set', tone: 'good' },
            { text: 'Runbook: stateful tier first', value: 'owner set', tone: 'good' },
          ],
        },
        caption: 'The system changes, nobody gets blamed',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One key change, one cold cache, one saturated database',
      eli5: 'Someone changed the tray stickers, the waiters could not find trays, the lone chef drowned in orders, and a switch fixed it. Next time the shop changes stickers slowly.',
      body: [
        'The path: normal state at 92% hit rate, a key change enabled at 11:40, a cold cache at 4%, a saturated database, then timeouts and retries. Investigation ruled out traffic, then Redis, then found the keys and the deploy.',
        'Mitigation was a flag flip. The fix was dual-read migration, a hit-rate canary, a reviewed freeze, and stampede guards. Scale the tier that is the bottleneck, never the one above it.',
      ],
      keyIdea: 'Find the bottleneck, mitigate fast, then fix the process that let a state change reach everyone at once.',
      metrics: { success: '98.4%', p99: '180 ms', hit: '92%', dbcpu: '22%' },
      metricTones: { success: 'good', p99: 'good', hit: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...shoppers, status: 'ok' },
          { ...api, status: 'ok', load: 55 },
          { ...cache, status: 'ok', chips: [{ text: 'hit 92%', tone: 'good' }] },
          { ...db, status: 'ok', load: 22 },
        ],
        links: [link('shoppers', 'api'), link('api', 'cache'), link('api', 'db', { style: 'dashed' })],
        flows: [{ path: ['shoppers', 'api', 'cache', 'api', 'shoppers'], tone: 'response', duration: 2.4, count: 2 }],
        panel: {
          title: 'Incident in five lines',
          icon: 'FileText',
          rows: [
            { text: 'Trigger', value: 'cache key change', tone: 'warn' },
            { text: 'Cascade', value: 'hit 4%, DB 99%', tone: 'bad' },
            { text: 'Mitigation', value: 'flag off, 12:03', tone: 'good' },
            { text: 'Fix', value: 'dual read, canary', tone: 'good' },
            { text: 'Impact', value: '~24 min', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'A deploy ships a new cache key format and the hit rate falls to near zero while the database melts. What is the right order of response?',
        options: [
          'Scale out the API, then investigate',
          'Roll back or flip the flag for the key format, then fix the rollout with a dual read',
          'Flush Redis to start clean, then redeploy',
          'Wait for the cache to refill on its own',
        ],
        answer: 1,
        explain: 'Reverting the key format makes the existing entries reachable immediately. Scaling the API hurts the database, flushing makes the cold cache worse, and waiting lets retries keep the overload going. The dual read is the durable fix.',
      },
    },
  ],
};
