import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const admin: SceneNode = { id: 'admin', kind: 'block', size: 0.72, at: at(-5, -3), label: 'product team', icon: 'Users', tint: 'blue' };
const flags: SceneNode = { id: 'flags', kind: 'block', at: at(0, -3), label: 'flag service', icon: 'Split', tint: 'violet' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: at(5, -3), label: 'metrics' };
const users: SceneNode = { id: 'users', kind: 'phone', at: at(-5, 3), label: 'users', sub: '3,000 req/s' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(0, 3), label: 'app server' };
const recs: SceneNode = { id: 'recs', kind: 'block', size: 0.72, at: at(5, 3), label: 'recommender', icon: 'Star', tint: 'green' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const featureFlags: Lesson = {
  id: 'feature-flags',
  title: 'Feature flags and config (part 1)',
  tagline: 'Ship code switched off, turn it on for a few users at a time, and switch it off again in seconds.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why deploying code and releasing a feature should be two separate events',
    'How a flag is evaluated at runtime, with a safe default when the flag service is unreachable',
    'Targeting rules, and percentage rollouts that stay sticky per user',
    'Dark launches, ramp plans and kill switches for incidents',
    'Flag kinds, A/B experiments, per-environment values and customer overrides',
    'Flags in browsers and mobile apps',
  ],
  metrics: [
    { key: 'exposed', label: 'Users on new feature', icon: 'Users' },
    { key: 'off', label: 'Time to switch off', icon: 'Timer' },
    { key: 'flags', label: 'Live flags', icon: 'Split' },
    { key: 'errors', label: 'Error rate', icon: 'Activity' },
  ],
  steps: [
    {
      title: 'Big launch',
      tag: 'problem',
      heading: 'The launch is tied to the deploy',
      eli5: 'The kitchen can only add a new dish by reprinting every menu at once. If the dish is bad, every table gets it, and fixing it means reprinting again.',
      body: [
        'The shop launches a recommendations panel. The code sat on a branch for six weeks and merging it took three days of conflicts. The launch deploy carried 90 other changes.',
        'At 10 AM every user sees the panel at once. The recommender was load tested at 500 requests per second and real traffic is 3,000. Errors climb to 6%, and the only way back is rolling back the whole deploy.',
      ],
      keyIdea: 'When deploying and releasing are one event, every launch is all-or-nothing and every rollback is too.',
      metrics: { exposed: '100% at once', off: '15 min rollback', flags: '0', errors: '6%' },
      metricTones: { exposed: 'bad', off: 'bad', errors: 'bad' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: 'GET /product/9', tone: 'warn' }] },
          { ...app, status: 'hot', load: 92, badge: 'panel on' },
          { ...recs, status: 'hot', load: 100, chips: [{ text: '3,000 req/s', tone: 'bad' }] },
        ],
        links: [link('users', 'app'), link('app', 'recs', { label: 'tested for 500 req/s', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 4, duration: 1 },
          { path: ['app', 'recs'], tone: 'request', count: 3, duration: 1.3, delay: 1.1 },
          { path: ['recs', 'app'], tone: 'error', label: 'timeout', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Launch day, 10 AM',
          icon: 'Table',
          rows: [
            { text: 'Load tested at', value: '500 req/s' },
            { text: 'Real traffic', value: '3,000 req/s', tone: 'bad' },
            { text: 'Error rate', value: '6%', tone: 'bad' },
            { text: 'Rollback also removes', value: '90 fixes', tone: 'warn' },
          ],
        },
        caption: 'Everyone meets the new feature at the same moment',
      },
    },
    {
      title: 'Two events',
      tag: 'concept',
      heading: 'Deploy and release are different events',
      eli5: 'Cooking a dish and putting it on the menu are two jobs. The cook can finish the dish on Monday. The manager decides on Friday when guests may order it.',
      body: [
        'The deploy did two jobs. It put new code on servers, and it showed a feature to users. A **deploy** is a technical event engineers own. A **release** is a business event that can happen any day after it.',
        'Keeping them apart lets the branch merge on day one, with the feature hidden, and stay small from then on. The six-week branch disappears. This habit is **trunk-based development**.',
      ],
      keyIdea: 'Deploy code dark, then release it later. The two have different risks and different owners.',
      metrics: { exposed: '0%', off: 'n/a', flags: '0', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { id: 'eng', kind: 'block', size: 0.72, at: at(-5, 0), label: 'engineers', icon: 'Code', tint: 'blue' },
          { ...app, at: at(0, 0), badge: 'new code, hidden' },
          { ...users, at: at(5, 0) },
        ],
        links: [link('eng', 'app', { label: 'deploy' }), link('app', 'users', { label: 'old page', arrow: 'end' })],
        flows: [
          { path: ['eng', 'app'], tone: 'data', label: 'v2 code', duration: 1.3 },
          { path: ['users', 'app'], tone: 'request', duration: 1.2, delay: 1.6 },
          { path: ['app', 'users'], tone: 'response', label: 'old page', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'Two separate events',
          icon: 'Split',
          rows: [
            { text: 'Deploy: code reaches servers', value: 'engineers', tone: 'good' },
            { text: 'Release: users see it', value: 'product team', tone: 'good' },
            { text: 'Gap between them', value: 'any number of days', tone: 'muted' },
          ],
        },
        caption: 'The code is live on the server and nobody sees it',
      },
    },
    {
      title: 'Runtime flag',
      tag: 'concept',
      heading: 'A flag is an if statement you can flip from outside',
      eli5: 'The new dish is cooked and ready, but a card on the counter says "not on the menu yet". The **flag service** is the manager who can turn that card over at any time.',
      body: [
        'A **feature flag** is a named switch checked at runtime: `if flags.enabled("recs_panel", user): render panel`. The new code ships with the flag off, so it runs for nobody until someone turns it on.',
        'The value lives in a **flag service**, not in the code. Changing it is a data change, so no build or deploy is involved.',
      ],
      keyIdea: 'Releasing becomes changing a value. Rolling back a release becomes flipping it back.',
      metrics: { exposed: '0%', off: 'instant', flags: '1', errors: '0.2%' },
      metricTones: { off: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active', chips: [{ text: 'recs_panel: off', tone: 'warn' }] }, { ...app, badge: 'checks flag' }, users],
        links: [link('flags', 'app', { style: 'dashed', label: 'recs_panel = off' }), link('users', 'app')],
        flows: [
          { path: ['flags', 'app'], tone: 'data', label: 'off', duration: 1.2 },
          { path: ['users', 'app'], tone: 'request', count: 3, duration: 1.2, delay: 1.5 },
          { path: ['app', 'users'], tone: 'response', label: 'old page', duration: 1.2, delay: 2.8 },
        ],
        caption: 'The new code is on the server and runs for nobody',
      },
      code: {
        language: 'python',
        title: 'Checking a flag in a request handler',
        source: `from flags import client      # holds all flag rules in memory

def product_page(request, product_id):
    page = render_product(product_id)

    # evaluated locally in microseconds, no network call per request
    if client.enabled("recs_panel", user=request.user, default=False):
        try:
            page.add(recommendations(product_id, timeout=0.15))
        except TimeoutError:
            pass                    # the page still works without the panel

    return page`,
        highlight: [7, 9, 11],
      },
    },
    {
      title: 'Safe default',
      tag: 'concept',
      heading: 'Read from memory, and know what to do without it',
      eli5: 'Each waiter keeps a copy of the manager\'s cards in a pocket, so checking one takes no phone call. If the phone line drops, the waiter uses the card they already have.',
      body: [
        'Servers hold every flag rule in memory and refresh it in the background. A check takes microseconds and makes no network call per request.',
        'Every flag needs a **safe default** for when the rules are missing or the flag service is unreachable. For a new feature the default is off. For an ops flag it is the behavior you want during an outage.',
      ],
      keyIdea: 'A flag check must be fast and local, and every flag must say what happens when its value is unknown.',
      metrics: { exposed: '0%', off: 'instant', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'down', chips: [{ text: 'unreachable', tone: 'bad' }] }, { ...app, status: 'ok', chips: [{ text: 'recs_panel: off (cached)', tone: 'good' }] }, users],
        links: [link('flags', 'app', { style: 'faint', label: 'link down', labelTone: 'warn' }), link('users', 'app')],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['app', 'users'], tone: 'response', label: 'old page', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Flag check',
          icon: 'Zap',
          rows: [
            { text: 'Rules held in', value: 'memory' },
            { text: 'Cost per check', value: '~5 µs', tone: 'good' },
            { text: 'Network call per request', value: 'none', tone: 'good' },
            { text: 'Service unreachable', value: 'use default', tone: 'warn' },
          ],
          footer: { text: 'New feature default: off', tone: 'muted' },
        },
        caption: 'A dead flag service does not break the page',
      },
    },
    {
      title: 'Targeting',
      tag: 'concept',
      heading: 'Targeting rules pick who gets it',
      eli5: 'The manager says: staff taste the new dish first, then guests from one neighborhood, then regulars. Anyone not on a list waits for the general rule.',
      body: [
        'A flag carries **targeting rules**, checked in order, and the first match wins. Rules match user attributes: employees first, then one country, then beta users, then a plan such as `pro`.',
        'Users who match no rule fall through to the percentage rule. Order matters, so put the narrowest rule first.',
      ],
      keyIdea: 'Rules run top to bottom and the first match decides. Known groups see a feature before the general public.',
      metrics: { exposed: 'staff only', off: 'instant', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { ...users, label: 'user', sub: 'a@shop.com', chips: [{ text: 'country: NZ', tone: 'default' }] },
          { ...app, status: 'ok', chips: [{ text: 'recs_panel: on', tone: 'good' }] },
          { ...flags, status: 'active', badge: '4 rules' },
        ],
        links: [link('users', 'app'), link('flags', 'app', { style: 'dashed', label: 'rules' })],
        flows: [
          { path: ['flags', 'app'], tone: 'data', label: 'rules', duration: 1.2 },
          { path: ['users', 'app'], tone: 'request', duration: 1.2, delay: 1.5 },
          { path: ['app', 'users'], tone: 'response', label: 'new panel', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'recs_panel rules, in order',
          icon: 'List',
          rows: [
            { text: '1. email ends @shop.com', value: 'on', tone: 'good' },
            { text: '2. country = NZ', value: 'on', tone: 'good' },
            { text: '3. plan = pro', value: 'on', tone: 'good' },
            { text: '4. everyone else', value: '5% rollout', tone: 'warn' },
          ],
        },
        caption: 'The first matching rule wins',
      },
    },
    {
      title: 'Sticky rollout',
      tag: 'concept',
      heading: 'Percentage rollouts must be sticky',
      eli5: 'First 1 table in 100 gets the new dish, then more. A table that got it keeps getting it on every visit, so nobody is confused.',
      body: [
        'A **percentage rollout** turns the feature on for a share of everyone else: 1%, 5%, 25%, 100%. It must be **sticky**. A random pick per request shows the panel on one page view and hides it on the next.',
        'Instead, hash the flag name with the user id into a bucket from 0 to 99, and enable the flag if the bucket is below the percentage. The same user always lands in the same bucket, and raising the percentage only adds users.',
      ],
      keyIdea: 'Bucket users by a stable hash, never by a random draw per request.',
      metrics: { exposed: '5%', off: 'instant', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active', chips: [{ text: 'recs_panel: 5%', tone: 'warn' }] }, { ...app, chips: ['hash(flag + user id) % 100'] }, users],
        links: [link('flags', 'app', { style: 'dashed' }), link('users', 'app')],
        flows: [
          { path: ['flags', 'app'], tone: 'data', label: '5%', duration: 1.1 },
          { path: ['users', 'app'], tone: 'request', label: 'user 42', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Bucket < 5 means on',
          icon: 'Hash',
          rows: [
            { text: 'user 42', value: 'bucket 3: on', tone: 'good' },
            { text: 'user 77', value: 'bucket 61: off', tone: 'muted' },
            { text: 'user 9', value: 'bucket 88: off', tone: 'muted' },
          ],
          footer: { text: 'Raise to 25%: user 42 stays on', tone: 'good' },
        },
        caption: 'The same user lands in the same bucket every time',
      },
      code: {
        language: 'python',
        title: 'Sticky percentage bucketing',
        source: `import hashlib

def bucket(flag_name: str, user_id: str) -> int:
    key = f"{flag_name}:{user_id}".encode()
    return int(hashlib.sha256(key).hexdigest()[:8], 16) % 100

def enabled(flag, user) -> bool:
    if not flag.on:
        return False
    for rule in flag.targets:              # e.g. email ends with @shop.com
        if rule.matches(user):
            return rule.value
    return bucket(flag.name, user.id) < flag.percent

# recs_panel at 5%: user 42 lands in bucket 3, so on, every time.
# Raise to 25% and user 42 stays on; buckets 5..24 join.`,
        highlight: [4, 5, 10, 13],
      },
    },
    {
      title: 'Bucket keys',
      tag: 'concept',
      heading: 'Pick the bucket key, and pass the answer along',
      eli5: 'The waiter needs a name for each table to remember who got the new dish. Guests without a reservation get a numbered ticket, and a guest who gives their name later should not be handed a new dish by surprise.',
      body: [
        'Bucketing needs a stable id. Logged-in users have a user id. Visitors have only a device or cookie id, so a user who logs in can move to a new bucket. Use an **account id** when a whole team must see the same thing.',
        'One request often crosses several services, so evaluate once at the edge and pass the values downstream in a request header. Cached or CDN pages skip flag evaluation, so vary the cache by flag value or leave flagged parts out of the cached page.',
      ],
      keyIdea: 'Choose the bucket key on purpose, evaluate once per request, and remember that cached pages bypass flags.',
      metrics: { exposed: '5%', off: 'instant', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { ...users, label: 'visitor', sub: 'device id d-81', chips: [{ text: 'logs in: user 42', tone: 'warn' }] },
          { ...app, label: 'edge', chips: [{ text: 'evaluates once', tone: 'good' }] },
          { ...recs, label: 'downstream service', icon: 'Layers', tint: 'teal' },
        ],
        links: [link('users', 'app'), link('app', 'recs', { label: 'X-Flags header' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', duration: 1.2 },
          { path: ['app', 'recs'], tone: 'data', label: 'recs_panel=on', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Bucket key choices',
          icon: 'Hash',
          rows: [
            { text: 'User id', value: 'stable after login', tone: 'good' },
            { text: 'Device or cookie id', value: 'works logged out', tone: 'warn' },
            { text: 'Account id', value: 'whole team agrees', tone: 'good' },
            { text: 'Login changes the key', value: 'bucket may change', tone: 'bad' },
          ],
        },
        caption: 'One decision per request, reused by every service',
      },
    },
    {
      title: 'Flag salt',
      tag: 'concept',
      heading: 'Hash the flag name in too',
      eli5: 'If the same few tables were always first to try every new dish, they would eat all the experiments. Shuffling the order for each dish shares the tasting around.',
      body: [
        'If every flag hashed only the user id, the same 1% of users would sit in the low buckets of every flag. They would get every experimental feature at once and carry all the risk.',
        'Mixing the flag name into the hash gives each flag its own shuffle, so the users at risk differ from flag to flag.',
      ],
      keyIdea: 'Salt the hash with the flag name so each rollout draws a different slice of users.',
      metrics: { exposed: '5%', off: 'instant', flags: '3', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { ...users, label: 'user 42', sub: '', chips: ['recs_panel: 3', 'new_checkout: 71', 'dark_mode: 28'] },
          { ...app, chips: ['hash(flag + user id)'] },
          { ...flags, status: 'active', badge: '3 flags at 5%' },
        ],
        links: [link('users', 'app'), link('flags', 'app', { style: 'dashed' })],
        flows: [{ path: ['users', 'app'], tone: 'request', label: 'user 42', duration: 1.3 }],
        panel: {
          title: 'User 42, three flags',
          icon: 'Hash',
          rows: [
            { text: 'recs_panel', value: 'bucket 3: on', tone: 'good' },
            { text: 'new_checkout', value: 'bucket 71: off', tone: 'muted' },
            { text: 'dark_mode', value: 'bucket 28: off', tone: 'muted' },
          ],
          footer: { text: 'Risk is spread across different users', tone: 'good' },
        },
        caption: 'One user, three different buckets',
      },
    },
    {
      title: 'Dark launch',
      tag: 'concept',
      heading: 'Dark launch: run it before showing it',
      eli5: 'Before any guest sees the new dish, the cook makes it for real orders and throws it away. The kitchen finds out whether it can keep up, and no guest is affected.',
      body: [
        'Before showing anything, a **dark launch** calls the new code on real traffic and discards the result. The recommender gets real load while users still see the old page.',
        'Shadow only a sample, for example 5% of requests, which is 150 requests per second. Raise the shadow share in steps like a ramp and compare latency and errors with the old path. If the recommender cannot cope, you find out with nobody watching the page.',
      ],
      keyIdea: 'A dark launch tests the new dependency on real load before any user depends on it.',
      metrics: { exposed: '0% (shadow)', off: 'instant', flags: '1', errors: '0.2%' },
      metricTones: { exposed: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...users, at: at(-5, 0) },
          { ...app, at: at(0, 0), chips: [{ text: 'calls recs, drops result', tone: 'warn' }] },
          { ...recs, at: at(5, 0), status: 'hot', load: 30, chips: ['150 req/s'] },
        ],
        links: [link('users', 'app'), link('app', 'recs', { label: 'shadow calls', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 3, duration: 1.1 },
          { path: ['app', 'recs'], tone: 'event', label: 'shadow', count: 2, duration: 1.4, delay: 1.2 },
          { path: ['app', 'users'], tone: 'response', label: 'old page', duration: 1.1, delay: 2.8 },
        ],
        panel: {
          title: 'Shadow results',
          icon: 'Gauge',
          rows: [
            { text: 'Users who see the panel', value: '0', tone: 'good' },
            { text: 'Shadow share', value: '5%, 150 req/s' },
            { text: 'Recommender load', value: '30%', tone: 'good' },
            { text: 'p99 of shadow calls', value: '90 ms', tone: 'good' },
          ],
        },
        caption: 'Real load, no visible change',
      },
    },
    {
      title: 'Ramp plan',
      tag: 'concept',
      heading: 'Ramp in steps and watch between them',
      eli5: 'The cook sends out the new dish to a few tables, waits to see how the kitchen copes, then sends it to more. If the stove struggles, no more tables get it.',
      body: [
        'Roll out in steps and watch between them: staff, 1%, 5%, 25%, 100%. Each step lasts long enough to see error rate, latency and the load on the dependency, here the recommender.',
        'At 5% the recommender sees 150 requests per second. At 25% it sees 750. The ramp turns an untested 3,000 into a series of small tests.',
      ],
      keyIdea: 'Each rollout step is a test with a number to check before you widen it.',
      metrics: { exposed: '5%', off: 'instant', flags: '1', errors: '0.2%' },
      metricTones: { exposed: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active', chips: [{ text: 'recs_panel: 5%', tone: 'warn' }] }, { ...app, status: 'ok' }, { ...recs, status: 'ok', load: 30, chips: ['150 req/s'] }, { ...mon, at: at(-5, 3) }],
        links: [link('flags', 'app', { style: 'dashed' }), link('app', 'recs'), link('app', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['flags', 'app'], tone: 'data', label: '5%', duration: 1.1 },
          { path: ['app', 'recs'], tone: 'request', duration: 1.2, delay: 1.3 },
          { path: ['app', 'mon'], tone: 'data', label: 'p99, errors', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Recommender load per step',
          icon: 'TrendingUp',
          rows: [
            { text: '1%', value: '30 req/s', tone: 'good' },
            { text: '5%', value: '150 req/s', tone: 'good' },
            { text: '25%', value: '750 req/s', tone: 'warn' },
            { text: '100%', value: '3,000 req/s', tone: 'bad' },
          ],
          footer: { text: 'Load tested limit: 500 req/s', tone: 'warn' },
        },
        caption: 'Widen only when the numbers hold',
      },
    },
    {
      title: 'Kill switch',
      tag: 'case',
      heading: 'Case: switching the panel off in five seconds',
      eli5: 'The new dish is making the kitchen too slow. The manager flips the card back to "not on the menu" and within seconds every waiter stops offering it. Nobody changed a recipe.',
      body: [
        'At 25% the recommender handles 750 requests per second and its latency climbs. The recommender p99 rises from 90 ms to 1.4 s. Product pages time out after 150 ms and drop the panel, and the recommender request queue keeps growing. The on-call engineer sees it on the dashboard.',
        'They set `recs_panel` to off. Every server picks it up within about **five seconds**. The calls stop and the recommender recovers. There is no deploy, no rollback of unrelated code and no build to wait for.',
      ],
      keyIdea: 'A kill switch turns an incident from "roll back the deploy" into "flip one value".',
      metrics: { exposed: '25% to 0%', off: '5 s', flags: '1', errors: '0.2%' },
      metricTones: { off: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...admin, label: 'on-call', status: 'active', tint: 'red' },
          { ...flags, status: 'active', chips: [{ text: 'recs_panel: off', tone: 'good' }] },
          { ...app, status: 'ok' },
          { ...recs, status: 'dim', load: 20, badge: 'recovering' },
        ],
        links: [link('admin', 'flags', { label: 'set off' }), link('flags', 'app', { style: 'dashed', label: 'push ~5 s' }), link('app', 'recs', { style: 'faint' })],
        flows: [
          { path: ['admin', 'flags'], tone: 'request', label: 'off', duration: 1 },
          { path: ['flags', 'app'], tone: 'event', label: 'push', duration: 1.1, delay: 1.2 },
        ],
        panel: {
          title: 'Recommender p99 latency',
          icon: 'Timer',
          rows: [
            { text: 'Before launch', value: '90 ms', tone: 'good' },
            { text: 'At 25%', value: '1.4 s', tone: 'bad' },
            { text: '5 s after the flip', value: '90 ms', tone: 'good' },
          ],
        },
        caption: 'One value change, and the expensive call stops everywhere',
      },
      quiz: {
        question: 'A flag is at 10%. You raise it to 30%. What happens to a user who already saw the feature?',
        options: [
          'They keep seeing it, because their bucket is below 10 and therefore below 30',
          'They have a 30% chance of seeing it on each request',
          'They lose it until the rollout reaches 100%',
          'It depends on which server handles the request',
        ],
        answer: 0,
        explain: 'The bucket comes from a hash of the flag name and user id, so it never changes. Any bucket under 10 is also under 30. Raising the percentage only adds users, and every server computes the same answer.',
      },
    },
    {
      title: 'Degrade well',
      tag: 'concept',
      heading: 'Build kill switches before the incident',
      eli5: 'A good restaurant decides ahead of time what happens when the dessert station breaks: the waiter just offers fruit instead. Nobody has to invent that at midnight.',
      body: [
        'Add kill switches on purpose, before the incident, for anything risky or expensive: a new dependency, a heavy query, a third-party call.',
        'Each one must degrade gracefully, so off means a plainer page and never an error. Pair the call with a short timeout, so a slow dependency costs one panel and not the whole page.',
      ],
      keyIdea: 'A kill switch is only useful if the off path works. Test it before you need it.',
      metrics: { exposed: '25%', off: '5 s', flags: '2', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...users, at: at(-5, 0) }, { ...app, at: at(0, 0), status: 'ok', chips: [{ text: 'timeout 150 ms', tone: 'good' }] }, { ...recs, at: at(5, 0), status: 'down', badge: 'down' }],
        links: [link('users', 'app'), link('app', 'recs', { style: 'faint', label: 'times out', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', duration: 1.1 },
          { path: ['app', 'users'], tone: 'response', label: 'plain page', duration: 1.1, delay: 1.5 },
        ],
        panel: {
          title: 'Product page states',
          icon: 'Table',
          rows: [
            { text: 'Flag on, recs healthy', value: 'page + panel', tone: 'good' },
            { text: 'Flag off', value: 'plain page', tone: 'good' },
            { text: 'Flag on, recs down', value: 'plain page after 150 ms', tone: 'warn' },
          ],
        },
        caption: 'The page works with or without the panel',
      },
    },
    {
      title: 'Flag kinds',
      tag: 'concept',
      heading: 'Four kinds of flag, four lifetimes',
      eli5: 'Some cards on the counter are for a new dish and get thrown away after a week. Others, like "kitchen closed", stay forever. The manager labels each **flag** so everyone knows which is which.',
      body: [
        '**Release flags** hide new work and live days or weeks. **Experiment flags** split users into variants for an A/B test and end with the test.',
        '**Ops flags** are kill switches and tuning knobs such as batch size, and they are meant to stay. **Permission flags** switch features by plan or customer and are really product configuration.',
        'Tag each flag with its kind, an owner and, for short-lived kinds, an expiry date.',
      ],
      keyIdea: 'Give every flag a kind, an owner and an expected lifetime when you create it.',
      metrics: { exposed: 'varies', off: '5 s', flags: '4 kinds', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...admin, badge: 'owner per flag' }, { ...flags, status: 'active', badge: 'kind + expiry' }, { ...app }],
        links: [link('admin', 'flags', { label: 'create flag' }), link('flags', 'app', { style: 'dashed' })],
        flows: [{ path: ['admin', 'flags'], tone: 'request', label: 'expires in 2 weeks', duration: 1.4 }, { path: ['flags', 'app'], tone: 'data', duration: 1.2, delay: 1.6 }],
        panel: {
          title: 'Flag kinds',
          icon: 'Layers',
          rows: [
            { text: 'Release: recs_panel', value: 'days to weeks' },
            { text: 'Experiment: checkout_ab', value: 'until the test ends' },
            { text: 'Ops: kill_recs', value: 'permanent', tone: 'good' },
            { text: 'Permission: pro_export', value: 'permanent', tone: 'good' },
          ],
        },
        caption: 'Short-lived and long-lived flags side by side',
      },
    },
    {
      title: 'Experiments',
      tag: 'concept',
      heading: 'Experiment flags: one hash, two groups',
      eli5: 'Half the tables get the old dessert and half get the new one. The manager counts which tables order seconds. Each table must keep the same dessert, or the count means nothing.',
      body: [
        'An **experiment flag** assigns each user to a variant with the same sticky hash: 50% see the old panel and 50% the new one. Each page view logs an **exposure**, which records the variant that user got.',
        'Compare a metric such as click-through between the groups, and wait for enough users before trusting a gap. A user who flips between variants pollutes both groups.',
      ],
      keyIdea: 'An experiment is a sticky split plus a log of who saw what, so the groups can be compared.',
      metrics: { exposed: '50% / 50%', off: '5 s', flags: '2', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active', chips: [{ text: 'checkout_ab: 50/50', tone: 'default' }] }, { ...app, chips: ['variant B'] }, users, mon],
        links: [link('flags', 'app', { style: 'dashed' }), link('users', 'app'), link('app', 'mon', { style: 'dashed', label: 'exposure events' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'user 42', duration: 1.2 },
          { path: ['app', 'mon'], tone: 'event', label: 'saw B', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Click-through after one week',
          icon: 'TrendingUp',
          rows: [
            { text: 'A: old panel, 50% of users', value: '4.1%' },
            { text: 'B: new panel, 50% of users', value: '4.6%', tone: 'good' },
          ],
          footer: { text: 'Each user stays in one group', tone: 'muted' },
        },
        caption: 'Same stickiness, now used to compare groups',
      },
    },
    {
      title: 'Overrides',
      tag: 'concept',
      heading: 'Environments and customer overrides',
      eli5: 'The practice kitchen already serves the new dish every day. The main dining room serves it to a few tables. One regular guest was promised it early, so the manager made an exception for them.',
      body: [
        'The same flag has a different value per **environment**: on in dev and staging, 5% in production. A rule can also override one customer, so a pilot customer gets the feature while everyone else waits.',
        'Keep overrides few and listed in one place. Each one is a special case someone has to remember to remove.',
      ],
      keyIdea: 'One flag, one value per environment, and a short, visible list of exceptions.',
      metrics: { exposed: '5% + 1 pilot', off: '5 s', flags: '2', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...admin, badge: 'edit per environment' }, { ...flags, status: 'active', chips: ['recs_panel'] }, { ...app, label: 'prod server' }],
        links: [link('admin', 'flags'), link('flags', 'app', { style: 'dashed', label: 'prod values' })],
        flows: [{ path: ['admin', 'flags'], tone: 'request', duration: 1.2 }, { path: ['flags', 'app'], tone: 'data', label: '5%', duration: 1.2, delay: 1.4 }],
        panel: {
          title: 'recs_panel values',
          icon: 'Table',
          rows: [
            { text: 'dev', value: 'on', tone: 'good' },
            { text: 'staging', value: 'on', tone: 'good' },
            { text: 'production', value: '5%', tone: 'warn' },
            { text: 'override: customer acme', value: 'on', tone: 'good' },
          ],
        },
        caption: 'Same flag, different value in each place',
      },
    },
    {
      title: 'Client flags',
      tag: 'concept',
      heading: 'Flags in browsers and mobile apps',
      eli5: 'A guest at the table cannot be handed the manager\'s whole notebook, because they could read every secret plan in it. The waiter tells them only what applies to their table.',
      body: [
        'Apps and browsers also check flags, but a client cannot be trusted with the rule set, since anyone can read it. The server evaluates for that user and returns only final values, such as `{"recs_panel": true}`.',
        'Never put secrets or unreleased feature names in that payload. The phone caches the values and falls back to defaults when offline. Old app versions linger for months, so keep the server-side kill path working too.',
      ],
      keyIdea: 'Evaluate on the server and send clients only the answers, never the rules.',
      metrics: { exposed: '5%', off: '5 s', flags: '2', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...users, label: 'mobile app', sub: 'caches values', chips: [{ text: '{"recs_panel": true}', tone: 'good' }] }, { ...app, label: 'flag API' }, { ...flags, status: 'active' }],
        links: [link('users', 'app', { label: 'user id', arrow: 'both' }), link('flags', 'app', { style: 'dashed', label: 'rules' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'user 42', duration: 1.2 },
          { path: ['flags', 'app'], tone: 'data', label: 'rules', duration: 1.2, delay: 1.3 },
          { path: ['app', 'users'], tone: 'response', label: 'values only', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'What the client gets',
          icon: 'Shield',
          rows: [
            { text: 'Final values for this user', value: 'yes', tone: 'good' },
            { text: 'Targeting rules', value: 'never', tone: 'bad' },
            { text: 'Secrets, unreleased names', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'The rules stay on the server',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: release by data',
      eli5: 'Dishes are cooked before they go on the menu, a few tables try them first, and the manager can pull any dish in seconds. Part 2 is about how the manager\'s notebook reaches every waiter safely.',
      body: [
        'A **feature flag** separates deploy from release. Targeting rules and a sticky, flag-salted hash roll a feature out to 1%, 5%, 25% and 100%, after a dark launch has tested the load. A **kill switch** turns it off in seconds.',
        'Flags have kinds and owners, power experiments, vary by environment and reach clients as final values only. Part 2 covers the config service, safe config changes and flag cleanup.',
      ],
      keyIdea: 'Flags make releases small and reversible. Ship dark, ramp slowly and keep a way to switch off.',
      metrics: { exposed: '5%', off: '5 s', flags: '4 kinds', errors: '0.2%' },
      metricTones: { exposed: 'good', off: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'ok' }, { ...app, status: 'ok' }, { ...recs, status: 'ok', load: 30 }, users],
        links: [link('flags', 'app', { style: 'dashed' }), link('users', 'app'), link('app', 'recs')],
        flows: [
          { path: ['flags', 'app'], tone: 'data', duration: 1.1 },
          { path: ['users', 'app', 'recs'], tone: 'request', duration: 1.8, delay: 1.3 },
        ],
        caption: 'Deploy dark, ramp up, switch off in seconds',
      },
      quiz: {
        question: 'A flag is at 5% in production and the recommender is struggling. What is the fastest safe fix?',
        options: [
          'Set the flag to off in the flag service',
          'Roll back the last deploy',
          'Hotfix the recommender and redeploy',
          'Restart every app server',
        ],
        answer: 0,
        explain: 'The code is already deployed and the flag is data. Setting it to off reaches servers in about five seconds and leaves unrelated changes in place. A rollback, hotfix or restart all take minutes and carry their own risk.',
      },
    },
  ],
};
