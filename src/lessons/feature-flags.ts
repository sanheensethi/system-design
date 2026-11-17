import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column and screen row, so nodes in different columns never overlap. */
const P = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const admin: SceneNode = { id: 'admin', kind: 'user', at: P(-5, -3.2), label: 'product team' };
const flagsvc: SceneNode = { id: 'flagsvc', kind: 'service', at: P(-1.25, -3.2), label: 'flag service' };
const store: SceneNode = { id: 'store', kind: 'db', at: P(2.5, -3.2), label: 'config store', sub: 'versioned' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: P(5, -3.2), label: 'metrics' };

const users: SceneNode = { id: 'users', kind: 'phone', at: P(-7.5, 3.2), label: 'users', sub: '3,000 req/s' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: P(-5, 3.2), label: 'balancer' };
const s1: SceneNode = { id: 's1', kind: 'server', at: P(-2.5, 3.2), label: 'server 1' };
const s2: SceneNode = { id: 's2', kind: 'server', at: P(0, 3.2), label: 'server 2' };
const s3: SceneNode = { id: 's3', kind: 'server', at: P(2.5, 3.2), label: 'server 3' };
const pay: SceneNode = { id: 'pay', kind: 'service', at: P(5, 3.2), label: 'recommender' };

const fleetLinks = [
  { from: 'users', to: 'lb' },
  { from: 'lb', to: 's1' },
  { from: 'lb', to: 's2' },
  { from: 'lb', to: 's3' },
];
const pushLinks = [
  { from: 'admin', to: 'flagsvc' },
  { from: 'flagsvc', to: 'store' },
  { from: 'flagsvc', to: 's1', style: 'dashed' as const },
  { from: 'flagsvc', to: 's2', style: 'dashed' as const },
  { from: 'flagsvc', to: 's3', style: 'dashed' as const },
];

export const featureFlags: Lesson = {
  id: 'feature-flags',
  title: 'Feature flags and config',
  tagline: 'Ship code switched off, turn it on for a few users at a time, and switch it off again in seconds.',
  minutes: 13,
  level: 'Intermediate',
  learn: [
    'Why deploying code and releasing a feature should be two separate events',
    'How a flag is evaluated at runtime, and how percentage rollouts stay sticky per user',
    'Kill switches for incidents',
    'How a config service pushes changes to every server, and what happens when it is down',
    'Why a bad config push can break more than a bad deploy, and how to stage config changes',
    'Stale flags as technical debt',
  ],
  metrics: [
    { key: 'exposed', label: 'Users on new feature' },
    { key: 'off', label: 'Time to switch off' },
    { key: 'flags', label: 'Live flags' },
    { key: 'errors', label: 'Error rate' },
  ],
  steps: [
    {
      title: 'Big launch',
      tag: 'problem',
      heading: 'The launch is tied to the deploy',
      eli5: 'The kitchen can only put a new dish on the menu by reprinting every menu at once. If the dish is bad, every table gets it, and fixing it means reprinting again.',
      body: [
        'The shop is launching a new recommendations panel on the product page. The code sat on a branch for six weeks while marketing picked a date. Merging it caused three days of conflicts, and the launch deploy carried 90 other changes with it.',
        'At 10 AM the deploy goes out and every user sees the panel at once. It calls a recommender service that was load tested at 500 requests per second. Real traffic is 3,000. Product pages slow down, errors climb to 6%, and the only way back is a rollback of the whole deploy, which also removes the 90 unrelated fixes.',
        'The deploy did two jobs at once. It put new code on servers, and it showed a feature to users. Those jobs have very different risks and should happen at different times.',
      ],
      keyIdea: 'When deploying and releasing are one event, every launch is all-or-nothing and every rollback is too.',
      metrics: { exposed: '100% at once', off: '15 min rollback', flags: '0', errors: '6%' },
      scene: {
        nodes: [
          users,
          lb,
          { ...s1, status: 'hot', badge: 'panel on' },
          { ...s2, status: 'hot', badge: 'panel on' },
          { ...s3, status: 'hot', badge: 'panel on' },
          { ...pay, status: 'hot', badge: '3,000 req/s vs 500' },
        ],
        links: [...fleetLinks, { from: 's1', to: 'pay' }, { from: 's2', to: 'pay' }, { from: 's3', to: 'pay' }],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 5, duration: 0.9 },
          { path: ['lb', 's1', 'pay'], tone: 'request', count: 2, duration: 1.4, delay: 1 },
          { path: ['lb', 's2', 'pay'], tone: 'request', count: 2, duration: 1.4, delay: 1 },
          { path: ['lb', 's3', 'pay'], tone: 'request', count: 2, duration: 1.4, delay: 1 },
          { path: ['pay', 's2'], tone: 'error', label: 'timeout', duration: 1, delay: 2.6 },
        ],
        caption: 'Everyone meets the new feature at the same moment',
      },
    },
    {
      title: 'Runtime flag',
      tag: 'concept',
      heading: 'A flag: an if statement you can flip from outside',
      eli5: 'The new dish is cooked and ready in the kitchen, but a card on the counter says "not on the menu yet". The **flag service** is the manager who can turn that card over at any time.',
      body: [
        'A **feature flag** is a named switch checked at runtime: `if flags.enabled("recs_panel", user): render panel`. The new code is merged and deployed with the flag off. It runs nowhere until someone turns it on.',
        'This separates **deploy** (code reaches servers, a technical event owned by engineers) from **release** (users see the feature, a business event that can happen any day after). The branch can merge on day one, behind the flag, and keep merging small changes, which ends the six-week branch.',
        'The flag value comes from a **flag service** and is read from memory on each server, so checking a flag costs microseconds. Every flag needs a safe default for when the service cannot be reached, and for a new feature that default is off.',
      ],
      keyIdea: 'Deploy code dark, then release it by changing data. Rolling back a release becomes flipping a value.',
      metrics: { exposed: '0%', off: 'instant', flags: '1', errors: '0.2%' },
      scene: {
        nodes: [
          admin,
          { ...flagsvc, status: 'active', badge: 'recs_panel: off' },
          users,
          lb,
          { ...s1, badge: 'code deployed, dark' },
          { ...s2 },
          { ...s3 },
        ],
        links: [...fleetLinks, { from: 'admin', to: 'flagsvc' }, { from: 'flagsvc', to: 's1', style: 'dashed' }, { from: 'flagsvc', to: 's2', style: 'dashed' }, { from: 'flagsvc', to: 's3', style: 'dashed' }],
        flows: [
          { path: ['flagsvc', 's1'], tone: 'data', label: 'off', duration: 1.2 },
          { path: ['flagsvc', 's2'], tone: 'data', duration: 1.2 },
          { path: ['flagsvc', 's3'], tone: 'data', duration: 1.2 },
          { path: ['users', 'lb', 's1'], tone: 'request', count: 3, duration: 1.4, delay: 1.3 },
          { path: ['s1', 'lb', 'users'], tone: 'response', label: 'old page', duration: 1.4, delay: 2.8 },
        ],
        caption: 'The new code is on every server and runs for nobody',
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
      title: 'Rollout',
      tag: 'concept',
      heading: 'Percentage rollouts and targeting',
      eli5: 'First only the staff taste the new dish, then 1 table in 100, then more. A table that got the dish keeps getting it on every visit, so nobody is confused.',
      body: [
        'Flags carry rules, checked in order. **Targeting** matches attributes: employees first, then one country, then beta users. A **percentage rollout** then turns the feature on for a share of everyone else: 1%, 5%, 25%, 100%.',
        'The percentage must be **sticky**. Picking at random on each request would show the panel on one page view and hide it on the next. Instead, hash the flag name with the user id into a bucket from 0 to 99 and enable the flag if the bucket is below the percentage. The same user always lands in the same bucket, and raising the percentage only adds users.',
        'Hashing with the flag name matters. If every flag used only the user id, the same 1% of users would get every experimental feature at once and carry all the risk.',
      ],
      keyIdea: 'Target known groups first, then roll out by a sticky hash of user and flag, widening in steps.',
      metrics: { exposed: '5%', off: 'instant', flags: '1', errors: '0.2%' },
      scene: {
        nodes: [
          { ...admin, badge: 'staff + 5%' },
          { ...flagsvc, status: 'active', badge: 'recs_panel: 5%' },
          users,
          lb,
          { ...s1, status: 'ok', badge: 'bucket 3: on' },
          { ...s2, badge: 'bucket 61: off' },
          { ...s3, badge: 'bucket 88: off' },
          { ...pay, status: 'ok', badge: '150 req/s' },
        ],
        links: [...fleetLinks, ...pushLinks.filter((l) => l.to !== 'store'), { from: 's1', to: 'pay' }],
        flows: [
          { path: ['admin', 'flagsvc'], tone: 'request', label: 'set 5%', duration: 1 },
          { path: ['flagsvc', 's1'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['flagsvc', 's2'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['flagsvc', 's3'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['users', 'lb', 's1', 'pay'], tone: 'request', duration: 1.8, delay: 2.3 },
        ],
        caption: 'A small, stable slice of users sees the panel',
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
      title: 'Kill switch',
      tag: 'case',
      heading: 'Case: switching the panel off in five seconds',
      eli5: 'The new dish is making the kitchen too slow. The manager flips the card back to "not on the menu" and within seconds every waiter stops offering it. Nobody had to change a recipe.',
      body: [
        'At 25% the recommender handles 750 requests per second and its latency starts climbing. Product pages wait on it and p99 rises from 300 ms to 1.4 s. The on-call engineer sees it on the dashboard.',
        'They set `recs_panel` to off. The flag service pushes the change and every server picks it up within about **five seconds**. The calls stop, the recommender recovers, and the product page is back to normal. No deploy, no rollback of unrelated code, no build to wait for.',
        'A flag used this way is a **kill switch**. Good systems add them on purpose for anything risky or expensive: a new dependency, a heavy query, a third-party call. Each one should degrade gracefully, so off means a slightly plainer page instead of an error.',
      ],
      keyIdea: 'A kill switch turns an incident from "roll back the deploy" into "flip one value", and it is ready before you need it.',
      metrics: { exposed: '25% to 0%', off: '5 s', flags: '1', errors: '0.2%' },
      scene: {
        nodes: [
          { ...admin, label: 'on-call', status: 'active', badge: 'recs_panel off' },
          { ...flagsvc, status: 'active' },
          users,
          lb,
          { ...s1, status: 'ok' },
          { ...s2, status: 'ok' },
          { ...s3, status: 'ok' },
          { ...pay, status: 'dim', badge: 'recovering' },
        ],
        links: [...fleetLinks, ...pushLinks.filter((l) => l.to !== 'store'), { from: 's2', to: 'pay', style: 'faint' }],
        flows: [
          { path: ['admin', 'flagsvc'], tone: 'request', label: 'off', duration: 1 },
          { path: ['flagsvc', 's1'], tone: 'event', label: 'push', duration: 1, delay: 1.1 },
          { path: ['flagsvc', 's2'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['flagsvc', 's3'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['users', 'lb', 's2', 'lb', 'users'], tone: 'response', label: 'fast page', duration: 2.4, delay: 2.4 },
        ],
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
      title: 'Config service',
      tag: 'concept',
      heading: 'How changes reach every server',
      eli5: 'The manager writes each change in a notebook, the **config store**, and calls every waiter. Each waiter keeps a copy in a pocket, so if the phone line drops they still know today\'s menu.',
      body: [
        'Flags are one kind of runtime **configuration**. Timeouts, pool sizes, rate limits and service addresses are others. A **config service** stores them, versions every change and pushes it out. The store needs to be correct and is written rarely, while reads must be fast and may be a few seconds stale.',
        'Each server holds the full rule set in memory and keeps a streaming connection open (or polls every few seconds). A change is pushed as a new version, applied atomically, and acknowledged. Reads never touch the network, so 3,000 requests per second cost nothing extra.',
        'The servers must survive the config service being down. They keep serving with the last version they received, and they write it to local disk so a restart still has it. Only a brand-new server with nothing cached falls back to code defaults.',
      ],
      keyIdea: 'Push config to servers and read it from memory. When the config service fails, servers keep the last good version.',
      metrics: { exposed: '0%', off: '5 s', flags: '1', errors: '0.2%' },
      scene: {
        nodes: [
          admin,
          { ...flagsvc, status: 'active', badge: 'stream' },
          { ...store, status: 'ok', badge: 'v418' },
          users,
          lb,
          { ...s1, badge: 'v418 in RAM' },
          { ...s2, badge: 'v418 in RAM' },
          { ...s3, badge: 'v418 in RAM' },
        ],
        links: [...fleetLinks, ...pushLinks],
        flows: [
          { path: ['admin', 'flagsvc', 'store'], tone: 'request', label: 'timeout_ms = 150', duration: 1.6 },
          { path: ['flagsvc', 's1'], tone: 'data', label: 'v418', duration: 1.1, delay: 1.7 },
          { path: ['flagsvc', 's2'], tone: 'data', duration: 1.1, delay: 1.7 },
          { path: ['flagsvc', 's3'], tone: 'data', duration: 1.1, delay: 1.7 },
          { path: ['s1', 'flagsvc'], tone: 'handshake', label: 'ack', duration: 1.1, delay: 2.9 },
        ],
        caption: 'One write, pushed to every server, read from memory',
      },
    },
    {
      title: 'Flag kinds',
      tag: 'concept',
      heading: 'Four kinds of flag, four lifetimes',
      eli5: 'Some cards on the counter are for a new dish and get thrown away after a week. Others, like "kitchen closed", stay forever. The manager labels each **flag** so everyone knows which is which.',
      body: [
        '**Release flags** hide unfinished or new work. They should live days or weeks and be deleted once the feature is at 100%. **Experiment flags** split users into variants for an A/B test and end when the test ends.',
        '**Ops flags** are kill switches and tuning knobs such as "disable recommendations" or "batch size". They are meant to stay. **Permission flags** turn features on for paying plans or specific customers, and are really product configuration.',
        'Tag each flag with its kind, an owner and, for short-lived kinds, an expiry date. The kind tells you whether a flag that has been on for six months is a healthy kill switch or forgotten debt.',
      ],
      keyIdea: 'Give every flag a kind, an owner and an expected lifetime when you create it.',
      metrics: { exposed: '100%', off: '5 s', flags: '4 kinds', errors: '0.2%' },
      scene: {
        nodes: [
          { ...admin, badge: 'owner per flag' },
          { ...flagsvc, status: 'active', badge: 'release, experiment' },
          { ...store, badge: 'ops, permission' },
          { ...s1, badge: 'recs_panel 100%' },
          { ...s2, badge: 'checkout_ab 50/50' },
          { ...s3, badge: 'kill_recs: off' },
        ],
        links: pushLinks,
        flows: [
          { path: ['admin', 'flagsvc', 'store'], tone: 'request', label: 'expires 2 weeks', duration: 1.6 },
          { path: ['flagsvc', 's1'], tone: 'data', duration: 1.1, delay: 1.7 },
          { path: ['flagsvc', 's2'], tone: 'data', duration: 1.1, delay: 1.7 },
          { path: ['flagsvc', 's3'], tone: 'data', duration: 1.1, delay: 1.7 },
        ],
        caption: 'Short-lived and long-lived flags side by side',
      },
    },
    {
      title: 'Bad push',
      tag: 'case',
      heading: 'Case: a config change takes the whole site down',
      eli5: 'The manager calls every waiter at once with a typo: "serve 0 tables". Every waiter obeys right away, and the whole restaurant stops serving in a second.',
      body: [
        'An engineer lowers the database connection pool from `40` to `4` for one small service. The change is typed into the global section by mistake, so it applies to every service. It passes no tests, because config is not code, and the config service pushes it everywhere within five seconds.',
        'Every server now has 4 connections to the database. Requests queue for a connection, time out, and the error rate goes from 0.2% to 70% across the site. The engineer is not sure which change caused it, because the alert names symptoms, not the config edit.',
        'The speed that makes kill switches great is the danger here. A code deploy goes through a pipeline and a canary over 30 minutes. A config push reaches 100% of servers in seconds with no review. Many large outages in the industry started exactly this way.',
      ],
      keyIdea: 'A config change can reach every server faster than any deploy, so it needs at least the same safety steps.',
      metrics: { exposed: '100% of servers', off: '20 min to find', flags: '1 bad value', errors: '70%' },
      scene: {
        nodes: [
          { ...admin, status: 'hot', badge: 'pool_size = 4' },
          { ...flagsvc, status: 'hot', badge: 'pushed to all' },
          { ...store, badge: 'v419' },
          users,
          lb,
          { ...s1, status: 'down', badge: 'pool exhausted' },
          { ...s2, status: 'down', badge: 'pool exhausted' },
          { ...s3, status: 'down', badge: 'pool exhausted' },
        ],
        links: [...fleetLinks, ...pushLinks],
        flows: [
          { path: ['admin', 'flagsvc'], tone: 'request', label: 'global edit', duration: 1 },
          { path: ['flagsvc', 's1'], tone: 'event', duration: 0.9, delay: 1.1 },
          { path: ['flagsvc', 's2'], tone: 'event', duration: 0.9, delay: 1.1 },
          { path: ['flagsvc', 's3'], tone: 'event', duration: 0.9, delay: 1.1 },
          { path: ['users', 'lb'], tone: 'request', count: 4, duration: 0.9, delay: 2.2 },
          { path: ['lb', 'users'], tone: 'error', label: '503', count: 3, duration: 1, delay: 3.2 },
        ],
        caption: 'Every server takes the bad value in the same five seconds',
      },
    },
    {
      title: 'Stage config',
      tag: 'concept',
      heading: 'Treat config changes like deploys',
      eli5: 'Now the manager tells one waiter first and watches. If that table is happy, the rest of the waiters hear it. Every change is written in the **config store** notebook, so the old page is easy to go back to.',
      body: [
        '**Validate** before saving: a schema with types and ranges rejects `pool_size = 4` for a service whose floor is 10, and rejects broken JSON. Require a second person to approve changes to ops config, the same as code review.',
        '**Stage** the push. Send the new version to one server or one zone first, watch error rate and latency for a few minutes, and widen only if the numbers hold. This is a canary for config, and the deployments lesson\'s automatic rollback works here too.',
        '**Version and annotate**. Every change gets a version number, an author and a reason, and it appears as a marker on the dashboards. Rollback means pushing the previous version, which takes seconds. Here the canary server showed pool waits within a minute and the change was reverted before it reached the other servers.',
      ],
      keyIdea: 'Validate, review, canary and version every config change. Fast to apply should never mean fast to apply everywhere at once.',
      metrics: { exposed: '1 server', off: '30 s rollback', flags: '1 bad value', errors: '0.3%' },
      scene: {
        nodes: [
          admin,
          { ...flagsvc, status: 'active', badge: 'canary: 1 server' },
          { ...store, status: 'ok', badge: 'revert to v418' },
          { ...mon, status: 'hot', badge: 'pool waits on s1' },
          users,
          lb,
          { ...s1, status: 'hot', badge: 'v419 canary' },
          { ...s2, status: 'ok', badge: 'v418' },
          { ...s3, status: 'ok', badge: 'v418' },
        ],
        links: [...fleetLinks, ...pushLinks, { from: 's1', to: 'mon', style: 'dashed' }],
        flows: [
          { path: ['flagsvc', 's1'], tone: 'data', label: 'v419', duration: 1.1 },
          { path: ['s1', 'mon'], tone: 'error', label: 'p99 up', duration: 1.4, delay: 1.2 },
          { path: ['flagsvc', 'store'], tone: 'request', label: 'revert', duration: 1, delay: 2.8 },
          { path: ['flagsvc', 's1'], tone: 'data', label: 'v418', duration: 1.1, delay: 3.9 },
        ],
        caption: 'The bad value reaches one server and is reverted',
      },
      code: {
        language: 'python',
        title: 'Validate, then roll config out in stages',
        source: `SCHEMA = {
    "db.pool_size":  {"type": int, "min": 10, "max": 200},
    "recs.timeout_ms": {"type": int, "min": 50, "max": 2000},
}

def validate(change):
    rule = SCHEMA[change.key]
    if not isinstance(change.value, rule["type"]):
        raise ValueError(f"{change.key} must be {rule['type'].__name__}")
    if not rule["min"] <= change.value <= rule["max"]:
        raise ValueError(f"{change.key} out of range")

def roll_out(change):
    validate(change)
    version = store.save(change, author=change.author, reason=change.reason)
    for wave in [["s1"], ["s2"], ["s3"]]:           # one server, then the rest
        push(version, to=wave)
        time.sleep(180)
        if error_rate(wave) > 2 * baseline() or p99(wave) > 1.5 * baseline_p99():
            push(version - 1, to=everyone())          # revert in seconds
            return "reverted"
    return "done"`,
        highlight: [10, 15, 17, 19, 20],
      },
    },
    {
      title: 'Stale flags',
      tag: 'tradeoff',
      heading: 'Every flag is a branch you have to remove',
      eli5: 'Old cards pile up on the counter. Nobody remembers what "card 37" does, and turning it over might bring back a dish from last year. Someone has to throw old cards away.',
      body: [
        'Two years later the codebase has 340 flags. Half are at 100% for months and nobody remembers their owner. Each one doubles the paths through its code, and ten interacting flags make 1,024 combinations that nobody tests.',
        'Stale flags also hide risk. A forgotten flag flipped by accident can bring back code written against an old schema. Leaving dead branches in the code is **technical debt** with a real failure mode.',
        'Treat removal as part of the feature. When a release flag reaches 100% and stays there for two weeks, open a ticket to delete the flag and the old code path. Report flags past their expiry, and some teams cap the number of live release flags per team. Ops flags and kill switches are kept on purpose, so tag them and test both positions.',
      ],
      keyIdea: 'A release flag is finished on the day its code path is deleted. Reaching 100% is only the halfway point.',
      metrics: { exposed: '100%', off: '5 s', flags: '340, mostly stale', errors: '0.2%' },
      scene: {
        nodes: [
          { ...admin, badge: 'owner unknown' },
          { ...flagsvc, status: 'hot', badge: '340 flags' },
          { ...store, badge: '170 at 100% for months' },
          { ...s1, badge: '1,024 paths' },
          s2,
          s3,
        ],
        links: pushLinks,
        flows: [
          { path: ['flagsvc', 's1'], tone: 'data', count: 4, duration: 1.4 },
          { path: ['flagsvc', 's2'], tone: 'data', count: 4, duration: 1.4 },
          { path: ['flagsvc', 's3'], tone: 'data', count: 4, duration: 1.4 },
        ],
        caption: 'Flags that never die turn into hidden code paths',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Release by data, carefully',
      eli5: 'Dishes are cooked before they go on the menu, a few tables try them first, and the manager can pull any dish in seconds. Changes to the notebook go to one waiter first, and old cards get thrown away.',
      body: [
        'A **feature flag** separates deploy from release. Targeting and a sticky hash roll a feature out to 1%, 5%, 25% and 100%, and a **kill switch** turns it off in seconds. A **config service** stores versioned values and pushes them to servers, which read from memory and keep the last good version if the service is down.',
        'Config moves faster than code, so it needs the same safety: validation, review, a canary and a one-step revert. Every flag gets a kind, an owner and an expiry, and release flags are deleted along with their old code once they reach 100%.',
      ],
      keyIdea: 'Flags make releases small and reversible. Treat their values as production changes and their code as debt to pay off.',
      metrics: { exposed: '100%', off: '5 s', flags: '12 live', errors: '0.2%' },
      scene: {
        nodes: [admin, { ...flagsvc, status: 'ok' }, { ...store, status: 'ok' }, mon, users, lb, { ...s1, status: 'ok' }, { ...s2, status: 'ok' }, { ...s3, status: 'ok' }],
        links: [...fleetLinks, ...pushLinks, { from: 's1', to: 'mon', style: 'dashed' }],
        flows: [
          { path: ['admin', 'flagsvc', 'store'], tone: 'request', duration: 1.6 },
          { path: ['flagsvc', 's1'], tone: 'data', duration: 1.1, delay: 1.7 },
          { path: ['s1', 'mon'], tone: 'data', duration: 1.2, delay: 2.9 },
          { path: ['users', 'lb', 's2'], tone: 'request', duration: 1.4, delay: 1 },
        ],
      },
      quiz: {
        question: 'A timeout value is changed in the config service and the error rate jumps across the whole site within seconds. What would have limited the damage most?',
        options: [
          'Polling for config every minute instead of streaming it',
          'Pushing the change to one server or zone first and reverting automatically on bad metrics',
          'Storing config in environment variables',
          'Adding more app servers',
        ],
        answer: 1,
        explain: 'A staged rollout with automatic revert keeps a bad value on a small slice of servers. Slower polling only delays the same outage, and environment variables need a restart to change, which makes the kill switch useless.',
      },
    },
  ],
};
