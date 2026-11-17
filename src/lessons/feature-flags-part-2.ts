import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const admin: SceneNode = { id: 'admin', kind: 'block', size: 0.72, at: at(-5, -3), label: 'engineer', icon: 'Code', tint: 'blue' };
const flags: SceneNode = { id: 'flags', kind: 'block', at: at(0, -3), label: 'config service', icon: 'Split', tint: 'violet' };
const store: SceneNode = { id: 'store', kind: 'db', at: at(5, -3), label: 'config store', sub: 'versioned' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: at(5, -3), label: 'metrics' };
const users: SceneNode = { id: 'users', kind: 'phone', at: at(-5, 3), label: 'users', sub: '3,000 req/s' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(0, 3), label: 'server 1' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: at(5, 3), label: 'server 2' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const featureFlagsPart2: Lesson = {
  id: 'feature-flags-part-2',
  title: 'Feature flags and config (part 2)',
  tagline: 'How config reaches every server, why a bad push is dangerous, and how to keep flags from piling up.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'How a config service pushes versioned changes to every server, and what happens when it is down',
    'Polling versus streaming, and why servers briefly disagree',
    'Why a bad config push can break more than a bad deploy',
    'Validating, reviewing, staging, versioning and reverting config changes',
    'Stale flags, flag combinations and cleanup',
    'Build versus buy: hosted flag products and plain config stores',
  ],
  metrics: [
    { key: 'exposed', label: 'Servers on new value', icon: 'Server' },
    { key: 'off', label: 'Time to revert', icon: 'Timer' },
    { key: 'flags', label: 'Live flags', icon: 'Split' },
    { key: 'errors', label: 'Error rate', icon: 'Activity' },
  ],
  steps: [
    {
      title: 'Where values live',
      tag: 'problem',
      heading: 'Flags and settings need a home',
      eli5: 'The manager has a new rule for the day, but three waiters need to hear it. Writing it on every menu takes a reprint, and asking the manager before every order makes a queue.',
      body: [
        'Flags are one kind of runtime **configuration**, a decision per user. Timeouts, pool sizes, rate limits and service addresses are dynamic config values, one value for everyone. Where should the values live?',
        'In code, a change needs a deploy. In environment variables it needs a restart, so the kill switch stops being fast. In a database row read on every request, 3,000 requests per second become 3,000 extra queries per second on one table.',
      ],
      keyIdea: 'Config must change without a deploy or restart, and be read without a network call per request.',
      metrics: { exposed: '0 of 3', off: 'minutes', flags: '1', errors: '0.2%' },
      metricTones: { off: 'bad' },
      scene: {
        nodes: [{ ...admin }, { ...store, at: at(0, -3), label: 'config DB', status: 'hot', load: 88 }, { ...app, at: at(5, 3), status: 'hot', chips: [{ text: 'SELECT value ...', tone: 'warn' }] }],
        links: [link('admin', 'store', { label: 'edit' }), link('app', 'store', { label: '3,000 reads/s', labelTone: 'warn' })],
        flows: [
          { path: ['admin', 'store'], tone: 'request', duration: 1.2 },
          { path: ['app', 'store'], tone: 'request', count: 4, duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Where could a value live?',
          icon: 'Table',
          rows: [
            { text: 'In code', value: 'needs a deploy', tone: 'bad' },
            { text: 'Environment variable', value: 'needs a restart', tone: 'bad' },
            { text: 'DB read per request', value: '3,000 reads/s', tone: 'warn' },
            { text: 'Config service + memory', value: 'push, read local', tone: 'good' },
          ],
        },
        caption: 'Every simple option has a cost',
      },
    },
    {
      title: 'Config service',
      tag: 'concept',
      heading: 'A config service: write rarely, read from memory',
      eli5: 'The manager writes each change in a notebook, the **config store**, and every waiter copies the new page into a pocket. Orders are handled from the pocket copy, so nobody waits on the notebook.',
      body: [
        'A **config service** stores values, versions every change and serves them to servers. The store must be correct and is written rarely. Reads must be fast and may be a few seconds stale.',
        'Each server loads the full rule set into memory and swaps in a new version all at once, so a request never sees half of an update.',
      ],
      keyIdea: 'Store config in one correct place, copy it to every server, and read it locally.',
      metrics: { exposed: '3 of 3', off: '5 s', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [admin, { ...flags, status: 'active' }, { ...store, status: 'ok', badge: 'v418' }, { ...app, status: 'ok', badge: 'v418 in RAM' }],
        links: [link('admin', 'flags', { label: 'write' }), link('flags', 'store'), link('flags', 'app', { style: 'dashed', label: 'v418' })],
        flows: [
          { path: ['admin', 'flags', 'store'], tone: 'request', label: 'timeout_ms = 150', duration: 1.8 },
          { path: ['flags', 'app'], tone: 'data', label: 'v418', duration: 1.2, delay: 2.1 },
          { path: ['app', 'flags'], tone: 'handshake', label: 'ack', duration: 1.2, delay: 3.4 },
        ],
        panel: {
          title: 'Two paths, two needs',
          icon: 'Split',
          rows: [
            { text: 'Write path', value: 'rare, correct', tone: 'good' },
            { text: 'Read path', value: 'memory, microseconds', tone: 'good' },
            { text: 'Each change', value: 'new version number' },
          ],
        },
        caption: 'One write, pushed to every server, read from memory',
      },
    },
    {
      title: 'Push or poll',
      tag: 'concept',
      heading: 'Polling versus streaming',
      eli5: 'One waiter checks the notebook every few minutes. Another keeps the manager on an open line and hears about changes the moment they happen. The second hears sooner and the first needs less setup.',
      body: [
        '**Polling** asks every 5 to 30 seconds. It is simple, and a change takes up to one interval to arrive. **Streaming** keeps a connection open and the service pushes a new version at once.',
        'Polling adds load at scale: 10,000 servers polling every 5 seconds is 2,000 requests per second for a value that rarely changes. A cheap version check or an ETag keeps each poll tiny.',
      ],
      keyIdea: 'Polling is simple and delayed. Streaming is faster and needs long-lived connections.',
      metrics: { exposed: '2 of 2', off: '0 to 5 s', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active' }, { ...app, at: at(-4, 3), chips: ['poll every 5 s'] }, { ...app2, at: at(4, 3), label: 'server 2', chips: [{ text: 'stream: push', tone: 'good' }] }],
        links: [link('app', 'flags', { arrow: 'end', label: 'any change?' }), link('flags', 'app2', { style: 'dashed', label: 'open stream' })],
        flows: [
          { path: ['app', 'flags'], tone: 'request', label: 'v418?', duration: 1.3 },
          { path: ['flags', 'app'], tone: 'response', label: 'same', duration: 1.3, delay: 1.4 },
          { path: ['flags', 'app2'], tone: 'event', label: 'v419', duration: 1.3, delay: 1 },
        ],
        panel: {
          title: 'Poll or stream',
          icon: 'Repeat',
          rows: [
            { text: 'Poll, 10,000 servers at 5 s', value: '2,000 req/s', tone: 'warn' },
            { text: 'Poll: delay to a change', value: 'up to 5 s' },
            { text: 'Stream: delay to a change', value: '~1 s', tone: 'good' },
          ],
        },
        caption: 'Same data, different timing and cost',
      },
    },
    {
      title: 'Service down',
      tag: 'case',
      heading: 'Case: the config service goes down at 3 AM',
      eli5: 'The manager\'s phone dies. Every waiter keeps using the pocket copy of the cards. Even a waiter who steps out and returns still has it, because they also wrote it on a slip in their apron.',
      body: [
        'Servers keep serving with the last version they received. They also write it to local disk, so a restart still has it.',
        'Only a brand-new server with nothing cached falls back to the defaults in code, which is why defaults must be safe. Config is a soft dependency: its outage must never become your outage.',
      ],
      keyIdea: 'Serve from the last good version, persist it to disk, and keep safe code defaults for the cold start.',
      metrics: { exposed: '3 of 3 (cached)', off: 'n/a', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'down', badge: 'down' }, { ...app, status: 'ok', chips: [{ text: 'v418 in RAM + disk', tone: 'good' }] }, users],
        links: [link('flags', 'app', { style: 'faint', label: 'no connection', labelTone: 'warn' }), link('users', 'app')],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['app', 'users'], tone: 'response', label: '200', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Server during the outage',
          icon: 'HardDrive',
          rows: [
            { text: 'Running server', value: 'last good version', tone: 'good' },
            { text: 'Restarted server', value: 'version from disk', tone: 'good' },
            { text: 'New server, no cache', value: 'code defaults', tone: 'warn' },
          ],
        },
        caption: 'The site stays up without its config service',
      },
      quiz: {
        question: 'The config service is down and one app server restarts. Which values does it use?',
        options: [
          'None, it refuses to start until the config service returns',
          'The last version it saved to local disk, with code defaults for anything missing',
          'Random values until the service is back',
          'The values from the other servers, fetched directly',
        ],
        answer: 1,
        explain: 'Servers persist the last good version locally, so a restart still starts with real values. Code defaults cover only a server that never received any. Refusing to start would turn a config outage into a site outage.',
      },
    },
    {
      title: 'Stale reads',
      tag: 'concept',
      heading: 'Servers briefly disagree',
      eli5: 'The manager calls waiter 1 first, then waiter 2. For a few seconds one table is told about the new dish and the next table is not. Both waiters are right about what they were last told.',
      body: [
        'Writes go through one store and get one version number. Servers read their local copy, so they can be briefly behind the store.',
        'So one server has v419 while another still has v418 for up to five seconds. Do not depend on two flags flipping at the same instant. Read a flag once per request and use that value throughout.',
      ],
      keyIdea: 'Expect a short window where servers differ, and design so that is harmless.',
      metrics: { exposed: '1 of 2', off: '5 s', flags: '1', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active', badge: 'v419 written' }, { ...app, at: at(-4, 3), status: 'ok', chips: [{ text: 'v419: on', tone: 'good' }] }, { ...app2, at: at(4, 3), chips: [{ text: 'v418: off', tone: 'warn' }] }],
        links: [link('flags', 'app', { style: 'dashed' }), link('flags', 'app2', { style: 'dashed', label: 'still on its way', labelTone: 'warn' })],
        flows: [
          { path: ['flags', 'app'], tone: 'data', label: 'v419', duration: 1 },
          { path: ['flags', 'app2'], tone: 'data', label: 'v419', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Same moment, two answers',
          icon: 'Table',
          rows: [
            { text: 'Server 1', value: 'v419, on', tone: 'good' },
            { text: 'Server 2', value: 'v418, off', tone: 'warn' },
            { text: 'Gap closes in', value: 'up to 5 s', tone: 'muted' },
          ],
        },
        caption: 'Brief, harmless disagreement',
      },
    },
    {
      title: 'Bad push',
      tag: 'case',
      heading: 'Case: a config change takes the whole site down',
      eli5: 'The manager calls every waiter at once with a typo: "serve 0 tables". Every waiter obeys right away, and the whole restaurant stops serving within seconds.',
      body: [
        'An engineer lowers the database connection pool from `40` to `4` for one small service. It is typed into the global section by mistake, so it applies to every service. Nothing tests it, because config is not code, and it reaches every server within five seconds.',
        'Requests queue for a connection and time out. The error rate goes from 0.2% to 70%. The alert names symptoms, not the config edit, so finding the cause takes 20 minutes.',
      ],
      keyIdea: 'A config change can reach every server faster than any deploy, with none of the safety steps.',
      metrics: { exposed: '3 of 3 servers', off: '20 min to find', flags: '1 bad value', errors: '70%' },
      metricTones: { exposed: 'bad', off: 'bad', errors: 'bad' },
      scene: {
        nodes: [{ ...admin, status: 'hot', chips: [{ text: 'pool_size = 4', tone: 'bad' }] }, { ...flags, status: 'hot', badge: 'pushed to all' }, { ...app, status: 'down', badge: 'pool exhausted' }, users],
        links: [link('admin', 'flags', { label: 'global edit', labelTone: 'warn' }), link('flags', 'app', { style: 'dashed', label: '5 s' }), link('users', 'app')],
        flows: [
          { path: ['admin', 'flags'], tone: 'request', duration: 1 },
          { path: ['flags', 'app'], tone: 'event', duration: 1, delay: 1.2 },
          { path: ['users', 'app'], tone: 'request', count: 3, duration: 1, delay: 2.4 },
          { path: ['app', 'users'], tone: 'error', label: '503', count: 2, duration: 1, delay: 3.5 },
        ],
        panel: {
          title: 'After the push',
          icon: 'Activity',
          rows: [
            { text: 'db.pool_size', value: '40 to 4', tone: 'bad' },
            { text: 'Error rate', value: '0.2% to 70%', tone: 'bad' },
            { text: 'Time to find the cause', value: '20 min', tone: 'warn' },
          ],
        },
        caption: 'Every server takes the bad value within five seconds',
      },
    },
    {
      title: 'Fast and wide',
      tag: 'tradeoff',
      heading: 'The speed that helps a kill switch hurts here',
      eli5: 'A new recipe goes through tasting, a trial table and a few days. A note from the manager goes to every waiter in a second, with nobody checking it first.',
      body: [
        'A code deploy goes through tests, review and a canary over about 30 minutes. A config push reaches 100% of servers in seconds, often with none of that.',
        'The same speed that makes a kill switch great makes a bad value dangerous. Many large outages in the industry started as a config change.',
      ],
      keyIdea: 'Fast to apply must never mean unchecked and applied everywhere at once.',
      metrics: { exposed: '100% in 5 s', off: 'unchecked', flags: '1', errors: '0.2%' },
      metricTones: { exposed: 'bad' },
      scene: {
        nodes: [{ id: 'pipe', kind: 'block', size: 0.72, at: at(-5, -3), label: 'deploy pipeline', sub: 'canary, 30 min', icon: 'Route', tint: 'amber' }, { ...flags, label: 'config push', sub: '5 s, all servers', status: 'hot' }, { ...app, at: at(-2.5, 3) }],
        links: [link('pipe', 'app', { label: '1% then 100%', labelTone: 'good' }), link('flags', 'app', { label: '100% at once', labelTone: 'warn' })],
        flows: [
          { path: ['pipe', 'app'], tone: 'data', label: 'code', duration: 2.4 },
          { path: ['flags', 'app'], tone: 'event', label: 'config', duration: 0.8, delay: 0.2 },
        ],
        panel: {
          title: 'Deploy against config push',
          icon: 'Scale',
          rows: [
            { text: 'Tests before release', value: 'code: yes, config: rarely', tone: 'warn' },
            { text: 'Review', value: 'code: yes, config: often no', tone: 'warn' },
            { text: 'Time to reach all servers', value: 'code: 30 min, config: 5 s', tone: 'bad' },
          ],
        },
        caption: 'Two paths into production, one with no guard rails',
      },
    },
    {
      title: 'Validate',
      tag: 'concept',
      heading: 'Validate and review before saving',
      eli5: 'Before the manager calls the waiters, a deputy checks the note: "serve 0 tables" is not allowed, and a rule for the whole restaurant needs a second signature.',
      body: [
        '**Validate** before saving. A schema with types and ranges rejects `pool_size = 4` for a service whose floor is 10, and rejects broken JSON. A change typed into the global section should be flagged as global.',
        'Require a second person to approve ops config, the same as code review. Review is cheap compared with a 20-minute outage.',
      ],
      keyIdea: 'A schema catches typos and out-of-range values, and review catches wrong scope.',
      metrics: { exposed: '0 of 3', off: 'n/a', flags: '1', errors: '0.2%' },
      metricTones: { exposed: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...admin, chips: [{ text: 'pool_size = 4', tone: 'bad' }] }, { id: 'gate', kind: 'block', at: at(0, -3), label: 'validator', sub: 'schema + review', icon: 'Shield', tint: 'teal' }, { ...store, status: 'ok', badge: 'still v418' }],
        links: [link('admin', 'gate', { label: 'propose' }), link('gate', 'store', { style: 'faint', label: 'blocked', labelTone: 'warn' })],
        flows: [
          { path: ['admin', 'gate'], tone: 'request', label: 'pool_size = 4', duration: 1.2 },
          { path: ['gate', 'admin'], tone: 'error', label: 'min is 10', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Checks on db.pool_size',
          icon: 'Shield',
          rows: [
            { text: 'Type is integer', value: 'pass', tone: 'good' },
            { text: 'Range 10 to 200', value: 'fail: 4', tone: 'bad' },
            { text: 'Scope: global', value: 'needs approver', tone: 'warn' },
          ],
        },
        caption: 'The bad value never reaches the store',
      },
    },
    {
      title: 'Stage it',
      tag: 'concept',
      heading: 'Canary config like code',
      eli5: 'The manager tells one waiter first and watches that table. If it goes well, the other waiters hear it. If the table is unhappy, the manager reads out the old page again.',
      body: [
        '**Stage** the push. Send the new version to one server or one zone first, watch error rate and latency for a few minutes, and widen only if the numbers hold. This is a canary for config.',
        'The deployments lesson\'s automatic rollback works here too. Here the check runs after 3 minutes, the canary shows pool waits, and the revert then takes seconds. The change never reached the other servers.',
      ],
      keyIdea: 'Push to a small slice, compare it with the rest, and revert on a bad signal.',
      metrics: { exposed: '1 of 3', off: '3 min to detect, seconds to revert', flags: '1 bad value', errors: '0.3%' },
      metricTones: { exposed: 'good', off: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active', badge: 'canary: 1 server' }, { ...mon, at: at(0, 3), status: 'hot', badge: 'pool waits on s1' }, { ...app, at: at(-4, 3), status: 'hot', chips: [{ text: 'v419 canary', tone: 'warn' }] }, { ...app2, at: at(4, 3), status: 'ok', chips: ['v418'] }],
        links: [link('flags', 'app', { style: 'dashed', label: 'v419' }), link('app', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['flags', 'app'], tone: 'data', label: 'v419', duration: 1.1 },
          { path: ['app', 'mon'], tone: 'error', label: 'p99 up', duration: 1.4, delay: 1.3 },
          { path: ['flags', 'app'], tone: 'data', label: 'back to v418', duration: 1.1, delay: 3 },
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
      title: 'Audit trail',
      tag: 'concept',
      heading: 'Version, annotate and revert',
      eli5: 'Every note the manager gives is written in the notebook with the date and who asked. When something goes wrong, the first question is "what changed?" and the answer is on the page.',
      body: [
        'Every change gets a version number, an author and a reason, and it shows as a marker on the dashboards. When an alert fires, "what changed?" has an answer on screen instead of a 20-minute hunt.',
        'Rollback means pushing the previous version, which takes seconds. The history doubles as an audit log. Also log the config or flag version used on each request, and diff config between environments to catch drift.',
      ],
      keyIdea: 'Version every change with an author and a reason, so reverting is one push and blame is one lookup.',
      metrics: { exposed: '1 of 3', off: 'seconds to revert', flags: '1', errors: '0.3%' },
      metricTones: { off: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...flags, status: 'active' }, { ...store, status: 'ok', badge: 'v419 reverted to v418' }, { ...mon, at: at(0, 3), badge: 'change markers' }],
        links: [link('flags', 'store', { label: 'revert' }), link('store', 'mon', { style: 'dashed', label: 'markers' })],
        flows: [
          { path: ['flags', 'store'], tone: 'request', label: 'revert', duration: 1.2 },
          { path: ['store', 'mon'], tone: 'event', label: 'v419 marker', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Change history',
          icon: 'List',
          rows: [
            { text: 'v420: revert to v418', value: 'auto, canary', tone: 'good' },
            { text: 'v419: pool_size 40 to 4', value: 'eng-12, "tune"', tone: 'bad' },
            { text: 'v418: timeout_ms = 150', value: 'eng-07, "recs"' },
          ],
        },
        caption: 'Every value has an author and a reason',
      },
    },
    {
      title: 'Stale flags',
      tag: 'tradeoff',
      heading: 'Every flag is a branch you have to remove',
      eli5: 'Old cards pile up on the counter. Nobody remembers what "card 37" does, and turning it over might bring back a dish from last year.',
      body: [
        'Two years later the codebase has 340 flags. Half sit at 100% for months and nobody remembers their owner. Each flag adds a path through its code.',
        'A forgotten flag flipped by accident can bring back code written against an old schema. Dead branches are **technical debt** with a real failure mode.',
      ],
      keyIdea: 'A flag that has done its job is a liability until its code path is deleted.',
      metrics: { exposed: 'n/a', off: '5 s', flags: '340, mostly stale', errors: '0.2%' },
      metricTones: { flags: 'bad' },
      scene: {
        nodes: [{ ...admin, badge: 'owner unknown' }, { ...flags, status: 'hot', badge: '340 flags' }, { ...store, badge: '170 at 100% for months' }],
        links: [link('admin', 'flags'), link('flags', 'store')],
        flows: [{ path: ['flags', 'store'], tone: 'data', count: 4, duration: 1.4 }],
        panel: {
          title: 'Flag inventory',
          icon: 'Layers',
          rows: [
            { text: 'Live flags', value: '340', tone: 'warn' },
            { text: 'At 100% for months', value: '170', tone: 'bad' },
            { text: 'Owner unknown', value: '120', tone: 'bad' },
          ],
        },
        caption: 'Flags that never die turn into hidden code paths',
      },
    },
    {
      title: 'Combinations',
      tag: 'concept',
      heading: 'Flags multiply the paths to test',
      eli5: 'Two cards on the counter give four possible days. Ten cards give over a thousand. Nobody can taste-test every possible day.',
      body: [
        'Ten interacting flags make 1,024 combinations, and nobody tests them all. Test both positions of each flag you are changing, plus the default.',
        'Keep flags independent where you can. A flag that only works when another is on is a hidden dependency, so write it down or merge the two.',
      ],
      keyIdea: 'Paths double with every flag. Keep flags independent and test both positions of the ones you touch.',
      metrics: { exposed: 'n/a', off: '5 s', flags: '10 interacting', errors: '0.2%' },
      metricTones: { flags: 'warn' },
      scene: {
        nodes: [{ ...flags, status: 'active', badge: '10 flags' }, { ...app, status: 'hot', badge: '1,024 paths' }, { ...mon, at: at(-5, 3), badge: 'tests cover 2' }],
        links: [link('flags', 'app', { style: 'dashed' }), link('app', 'mon', { style: 'dashed' })],
        flows: [{ path: ['flags', 'app'], tone: 'data', count: 3, duration: 1.4 }],
        panel: {
          title: 'Paths through the code',
          icon: 'Binary',
          rows: [
            { text: '1 flag', value: '2' },
            { text: '5 flags', value: '32' },
            { text: '10 flags', value: '1,024', tone: 'warn' },
            { text: '20 flags', value: '1,048,576', tone: 'bad' },
          ],
        },
        caption: 'Each new flag doubles the possible states',
      },
    },
    {
      title: 'Cleanup',
      tag: 'concept',
      heading: 'Removal is part of the feature',
      eli5: 'When a new dish is on the menu for good, the manager throws away its card and the cook stops keeping the old recipe. Cards for "kitchen closed" stay on purpose.',
      body: [
        'Treat removal as part of the feature. When a release flag stays at 100% for two weeks, open a ticket to delete the flag and the old code path. Report flags past their expiry, and cap live release flags per team.',
        'Ops flags and kill switches stay on purpose. Tag them so the cleanup report skips them, and test both positions.',
      ],
      keyIdea: 'A release flag is finished on the day its code path is deleted. Reaching 100% is only halfway.',
      metrics: { exposed: 'n/a', off: '5 s', flags: '12 live', errors: '0.2%' },
      metricTones: { flags: 'good' },
      scene: {
        nodes: [{ ...admin, badge: 'owner gets a ticket' }, { ...flags, status: 'ok', badge: '12 live' }, { ...mon, at: at(5, -3), badge: 'expiry report' }],
        links: [link('flags', 'admin', { label: 'expired', labelTone: 'warn' }), link('flags', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['flags', 'admin'], tone: 'event', label: 'ticket', duration: 1.3 },
          { path: ['flags', 'mon'], tone: 'data', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Flag lifecycle',
          icon: 'Workflow',
          rows: [
            { text: 'Release flag at 100%', value: '2 weeks', tone: 'muted' },
            { text: 'Ticket to delete code path', value: 'opened', tone: 'warn' },
            { text: 'Flag and old code removed', value: 'done', tone: 'good' },
            { text: 'Ops flag, kill switch', value: 'kept, tagged', tone: 'good' },
          ],
        },
        caption: 'Flags are created with an end date',
      },
    },
    {
      title: 'Build or buy',
      tag: 'concept',
      heading: 'Flag products and plain config stores',
      eli5: 'A small cafe can keep its cards in a shoebox. A big chain buys a card system that handles cards, tasting groups and a history book. Pick the size that fits.',
      body: [
        'Hosted products such as LaunchDarkly, Split.io, Flagsmith and ConfigCat give targeting, rollouts and audit logs. Unleash is open source, and AWS AppConfig adds staged rollouts for config.',
        'For plain config without targeting, etcd, Consul or ZooKeeper hold small values and notify watchers. Secrets belong in a secrets manager, not in the flag or config service. Whatever you pick, keep a thin wrapper in your code so you can swap it.',
      ],
      keyIdea: 'Buy targeting and audit if you need them, use a plain store for simple config, and wrap either one.',
      metrics: { exposed: 'n/a', off: '5 s', flags: '12 live', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...flags, label: 'flag product', sub: 'hosted or open source', status: 'active' }, { ...store, at: at(5, -3), label: 'etcd, Consul', sub: 'plain config' }, { ...app, label: 'your wrapper', sub: 'flags.enabled()' }],
        links: [link('flags', 'app', { style: 'dashed', label: 'SDK' }), link('store', 'app', { style: 'dashed', label: 'watch' })],
        flows: [
          { path: ['flags', 'app'], tone: 'data', duration: 1.2 },
          { path: ['store', 'app'], tone: 'data', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Options',
          icon: 'Package',
          rows: [
            { text: 'LaunchDarkly, Split.io', value: 'hosted' },
            { text: 'Unleash, Flagsmith', value: 'open source' },
            { text: 'AWS AppConfig', value: 'staged config' },
            { text: 'etcd, Consul, ZooKeeper', value: 'plain config' },
          ],
        },
        caption: 'Same idea at every size',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 2 recap: config safety',
      eli5: 'Changes go in a notebook, a checker reads each one, one waiter hears it first, and old cards get thrown away. If the phone dies, waiters use the copy in their pocket.',
      body: [
        'A **config service** stores versioned values and pushes them to servers, which read from memory and keep the last good version if the service is down. Servers may disagree for a few seconds.',
        'Config moves faster than code, so it needs the same safety: validation, review, a canary and a one-step revert. Every flag gets a kind, an owner and an expiry, and release flags are deleted with their old code.',
      ],
      keyIdea: 'Treat config values as production changes and flag code as debt to pay off.',
      metrics: { exposed: '3 of 3', off: 'seconds to revert', flags: '12 live', errors: '0.2%' },
      metricTones: { off: 'good', flags: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...admin }, { ...flags, status: 'ok' }, { ...store, status: 'ok' }, { ...app, status: 'ok' }],
        links: [link('admin', 'flags'), link('flags', 'store'), link('flags', 'app', { style: 'dashed' })],
        flows: [
          { path: ['admin', 'flags', 'store'], tone: 'request', duration: 1.6 },
          { path: ['flags', 'app'], tone: 'data', duration: 1.2, delay: 1.8 },
        ],
        caption: 'Validated, staged, versioned and cleaned up',
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
