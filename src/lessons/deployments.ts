import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column and screen row, so nodes in different columns never overlap. */
const P = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const dev: SceneNode = { id: 'dev', kind: 'user', at: P(-7.5, -3.2), label: 'engineer' };
const ci: SceneNode = { id: 'ci', kind: 'worker', at: P(-5, -3.2), label: 'pipeline' };
const reg: SceneNode = { id: 'reg', kind: 'storage', at: P(-2.5, -3.2), label: 'registry' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: P(2.5, -3.2), label: 'metrics' };

const users: SceneNode = { id: 'users', kind: 'client', at: P(-7.5, 3.2), label: 'users', sub: '2,000 req/s' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: P(-5, 3.2), label: 'balancer' };
const s1: SceneNode = { id: 's1', kind: 'server', at: P(-2.5, 3.2), label: 'server 1', sub: 'v1' };
const s2: SceneNode = { id: 's2', kind: 'server', at: P(0, 3.2), label: 'server 2', sub: 'v1' };
const s3: SceneNode = { id: 's3', kind: 'server', at: P(2.5, 3.2), label: 'server 3', sub: 'v1' };
const s4: SceneNode = { id: 's4', kind: 'server', at: P(5, 3.2), label: 'server 4', sub: 'v1' };
const db: SceneNode = { id: 'db', kind: 'db', at: P(7.5, 3.2), label: 'database' };

const fleetLinks = [
  { from: 'users', to: 'lb' },
  { from: 'lb', to: 's1' },
  { from: 'lb', to: 's2' },
  { from: 'lb', to: 's3' },
  { from: 'lb', to: 's4' },
];

export const deployments: Lesson = {
  id: 'deployments',
  title: 'Deployments: CI/CD, blue-green, canary',
  tagline: 'Ship new code many times a day without users noticing, and back out in seconds when it is wrong.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why manual deploys fail, and what a build, test and deploy pipeline replaces',
    'Rolling updates and the health checks they depend on',
    'Blue-green: a second fleet and an instant switch',
    'Canary releases with automatic rollback on metrics',
    'Database changes that survive two code versions: expand and contract',
  ],
  metrics: [
    { key: 'freq', label: 'Deploys' },
    { key: 'down', label: 'Downtime per deploy' },
    { key: 'blast', label: 'Users on a bad build' },
    { key: 'rollback', label: 'Rollback time' },
  ],
  steps: [
    {
      title: 'Manual deploy',
      tag: 'problem',
      heading: 'Friday, 6 PM: a deploy by hand',
      eli5: 'The baker changes the bread recipe at every counter by hand, from memory, while the shop is open. All four counters close at once, one gets the wrong recipe, and customers leave with nothing.',
      body: [
        'The shop runs on four app servers behind a load balancer. Every two weeks an engineer builds the code on a laptop, copies it to each server, edits a config file and restarts the process. The steps live in a wiki page that is slightly out of date.',
        'Tonight the build picked up a library version that only exists on that laptop. Server 3 was skipped by mistake and still runs the old code. All four were restarted together, so the site was down for 12 minutes. Going back means repeating the ritual with the old build, if anyone kept it.',
        'Because deploys hurt, the team deploys rarely. Rare deploys are large, large deploys break more often, and a break is harder to trace when 200 changes went out together.',
      ],
      keyIdea: 'A manual deploy is an untested program run by a tired human. Risk grows with the size of each release.',
      metrics: { freq: 'every 2 weeks', down: '12 min', blast: '100%', rollback: '45 min' },
      scene: {
        nodes: [
          { ...dev, status: 'hot', badge: 'scp + restart' },
          users,
          lb,
          { ...s1, status: 'down', badge: 'restarting' },
          { ...s2, status: 'down', badge: 'restarting' },
          { ...s3, status: 'hot', badge: 'forgotten' },
          { ...s4, status: 'down', badge: 'restarting' },
        ],
        links: [...fleetLinks, { from: 'dev', to: 's1', style: 'dashed' }, { from: 'dev', to: 's2', style: 'dashed' }],
        flows: [
          { path: ['dev', 's1'], tone: 'data', label: 'copy build', duration: 1.4 },
          { path: ['dev', 's2'], tone: 'data', duration: 1.6 },
          { path: ['users', 'lb'], tone: 'request', count: 4, duration: 1, delay: 1 },
          { path: ['lb', 'users'], tone: 'error', label: '503', duration: 1, delay: 2.1 },
        ],
        caption: 'Every server restarts at once',
      },
    },
    {
      title: 'Pipeline',
      tag: 'concept',
      heading: 'CI/CD: the same steps, run by a machine',
      eli5: 'Now a checklist machine, the **pipeline**, mixes every new recipe the same way, tastes it, and puts the finished dough on a labelled shelf. No recipe reaches a counter without passing the taste test.',
      body: [
        '**Continuous integration** (CI) means every commit to the main branch is built and tested automatically within minutes. A failing test blocks the change while it is still small and its author still remembers it.',
        'The build produces one **immutable artifact**, usually a container image tagged with the commit hash, stored in a registry. The same artifact moves through staging and production. Nothing is rebuilt on the way, so what you tested is what you ship.',
        '**Continuous delivery** (CD) automates the path from that artifact to production, with either a button or no gate at all. Deploys become small and frequent: ten changes a day of 20 lines each are far easier to reason about than one release of 4,000 lines.',
      ],
      keyIdea: 'Build once, test automatically, and promote the same artifact everywhere. Small frequent deploys are safer than big rare ones.',
      metrics: { freq: '10 per day', down: '12 min', blast: '100%', rollback: '45 min' },
      scene: {
        nodes: [dev, { ...ci, status: 'active', badge: 'build, test' }, { ...reg, status: 'ok', badge: 'shop:3f9c2a1' }, s1, s2, s3, s4],
        links: [
          { from: 'dev', to: 'ci' },
          { from: 'ci', to: 'reg' },
          { from: 'reg', to: 's1', style: 'dashed' },
          { from: 'reg', to: 's2', style: 'dashed' },
          { from: 'reg', to: 's3', style: 'dashed' },
          { from: 'reg', to: 's4', style: 'dashed' },
        ],
        flows: [
          { path: ['dev', 'ci'], tone: 'request', label: 'git push', duration: 1 },
          { path: ['ci', 'reg'], tone: 'data', label: 'image', duration: 1, delay: 1.1 },
          { path: ['reg', 's1'], tone: 'data', duration: 1.2, delay: 2.2 },
          { path: ['reg', 's2'], tone: 'data', duration: 1.2, delay: 2.2 },
          { path: ['reg', 's3'], tone: 'data', duration: 1.2, delay: 2.2 },
          { path: ['reg', 's4'], tone: 'data', duration: 1.2, delay: 2.2 },
        ],
        caption: 'Commit, build, test, store, deploy',
      },
      code: {
        language: 'yaml',
        title: 'A pipeline definition (GitHub Actions style)',
        source: `name: ship
on:
  push:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make lint test                       # fail here, not in prod
      - run: docker build -t registry.internal/shop:\${{ github.sha }} .
      - run: docker push registry.internal/shop:\${{ github.sha }}

  deploy-staging:
    needs: build-test
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh staging \${{ github.sha }}   # same image
      - run: ./smoke-test.sh https://staging.shop.internal

  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh prod \${{ github.sha }} --strategy canary`,
        highlight: [11, 12, 19, 26],
      },
    },
    {
      title: 'Rolling update',
      tag: 'concept',
      heading: 'Rolling update: one server at a time',
      eli5: 'Change the recipe at one counter while the other three keep serving. When that counter is ready again, the **balancer** at the door sends people to it and the next counter takes its turn.',
      body: [
        'A **rolling update** replaces servers in small batches. Take server 1 out of the load balancer, let its in-flight requests finish (**connection draining**), start the new version, wait for it to pass a **readiness check**, and put it back. Then do server 2.',
        'Users never see an outage, because three of four servers are always serving. The cost is capacity: during the rollout you run at 75%, so do it off peak or start an extra server first.',
        'Two things to remember. For several minutes **both versions serve traffic**, so v2 must be compatible with v1 in its API and its data. And rollback is another rolling update in reverse, which takes as long as the rollout did.',
      ],
      keyIdea: 'Rolling updates remove downtime, but old and new code run side by side until the rollout ends.',
      metrics: { freq: '10 per day', down: '0', blast: 'grows to 100%', rollback: '8 min' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active' },
          { ...s1, sub: 'v2', status: 'ok', badge: 'ready' },
          { ...s2, sub: 'v2', status: 'active', badge: 'draining, starting' },
          { ...s3, badge: 'serving' },
          { ...s4, badge: 'serving' },
          reg,
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 's1' },
          { from: 'lb', to: 's2', style: 'faint' },
          { from: 'lb', to: 's3' },
          { from: 'lb', to: 's4' },
          { from: 'reg', to: 's2', style: 'dashed' },
        ],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['lb', 's1'], tone: 'request', duration: 1, delay: 1 },
          { path: ['lb', 's3'], tone: 'request', duration: 1, delay: 1 },
          { path: ['lb', 's4'], tone: 'request', duration: 1, delay: 1 },
          { path: ['reg', 's2'], tone: 'data', label: 'v2 image', duration: 1.4, delay: 0.4 },
          { path: ['lb', 's2'], tone: 'handshake', label: 'GET /ready', duration: 1, delay: 2.2 },
        ],
        caption: 'Three servers carry traffic while one is replaced',
      },
    },
    {
      title: 'Blue-green',
      tag: 'tradeoff',
      heading: 'Blue-green: build a second fleet, then flip',
      eli5: 'Set up a whole second row of counters with the new bread while customers still use the first row. When the new row is ready, the **balancer** turns the sign at the door. If the bread is bad, turn the sign back.',
      body: [
        'In a **blue-green** deployment the live fleet (blue) keeps serving while you start a complete second fleet (green) on the new version. You test green with real infrastructure and no real users. Then the load balancer switches all traffic from blue to green in one step.',
        'Rollback is the same switch in reverse and takes seconds, because blue is still running. There is never a mixed fleet behind the balancer, which helps when v1 and v2 cannot serve the same user session.',
        'You pay for it with double the servers during the deploy, and with a blunt switch: 100% of users meet the new version at the same moment. Both fleets also share one database, so the schema must work for both colors.',
      ],
      keyIdea: 'Blue-green buys an instant rollback for the price of a second fleet. Everyone still gets the new version at once.',
      metrics: { freq: '10 per day', down: '0', blast: '100% at the switch', rollback: '10 s' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: 'switch to green' },
          { ...s1, label: 'blue pool', sub: '4 servers, v1', status: 'dim', badge: 'standby' },
          { ...s3, label: 'green pool', sub: '4 servers, v2', status: 'ok', badge: 'live' },
          { ...db, badge: 'shared' },
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 's1', style: 'faint' },
          { from: 'lb', to: 's3' },
          { from: 's1', to: 'db', style: 'faint' },
          { from: 's3', to: 'db' },
        ],
        flows: [
          { path: ['users', 'lb', 's3'], tone: 'request', count: 4, duration: 1.6 },
          { path: ['s3', 'db'], tone: 'request', duration: 1.2, delay: 1.6 },
          { path: ['s3', 'lb', 'users'], tone: 'response', duration: 1.6, delay: 2.9 },
        ],
        caption: 'All traffic moves in one switch, and can move back',
      },
    },
    {
      title: 'Canary',
      tag: 'concept',
      heading: 'Canary: let 5% of traffic try it first',
      eli5: 'Give the new bread to 1 customer in 20 and watch their faces. If they are happy, give it to more people. Most customers never taste a bad batch.',
      body: [
        'A **canary release** sends a small slice of real traffic, say 5%, to the new version while 95% stays on the old one. Real users exercise real data paths that no staging environment has.',
        'You then compare the canary against the baseline on the same golden signals: error rate, latency percentiles, saturation. If they match for ten minutes, raise the share to 25%, then 50%, then 100%.',
        'A bug in the new build now reaches 5% of users for a few minutes instead of everyone. The price is time, since a careful rollout takes 30 to 60 minutes, and you need enough traffic for 5% to be statistically meaningful. At 2,000 requests per second the canary sees 100 per second, which is plenty.',
      ],
      keyIdea: 'A canary limits the blast radius: expose a few users, measure, and only then widen.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: '95% / 5%' },
          { ...s1, badge: 'baseline' },
          s2,
          s3,
          { ...s4, label: 'canary', sub: 'v2', status: 'active', badge: '100 req/s' },
          { ...mon, status: 'active', badge: 'compare v1, v2' },
        ],
        links: [...fleetLinks, { from: 's4', to: 'mon', style: 'dashed' }, { from: 's1', to: 'mon', style: 'dashed' }],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 5, duration: 0.9 },
          { path: ['lb', 's1'], tone: 'request', count: 3, duration: 1, delay: 1 },
          { path: ['lb', 's2'], tone: 'request', count: 3, duration: 1, delay: 1 },
          { path: ['lb', 's3'], tone: 'request', count: 3, duration: 1, delay: 1 },
          { path: ['lb', 's4'], tone: 'request', label: '5%', duration: 1, delay: 1 },
          { path: ['s4', 'mon'], tone: 'data', duration: 1.2, delay: 2.1 },
          { path: ['s1', 'mon'], tone: 'data', duration: 1.2, delay: 2.1 },
        ],
        caption: 'A small, measured slice of real traffic',
      },
    },
    {
      title: 'Auto rollback',
      tag: 'case',
      heading: 'Case: the canary fails and nobody is paged',
      eli5: 'The **metrics** helper sees that people with the new bread are making sour faces. It tells the balancer to stop handing it out, before the baker even looks up.',
      body: [
        'Version 2 has a bug: checkout fails for carts with a discount code. Tests missed it. The canary starts at 5% and within two minutes its error rate is **4%**, against **0.2%** on the baseline.',
        'The rollout controller checks the numbers every minute. The canary is above twice the baseline and above the 1% floor, so the controller sets its traffic weight to 0, marks the release failed and posts the comparison to the team channel. Total exposure: 5% of users for two minutes.',
        'Compare the canary with the baseline over the same minutes, never with yesterday. If a payment provider is having a bad hour, both versions suffer equally and the canary should not be blamed for it.',
      ],
      keyIdea: 'Let a machine watch the canary and pull it. A rollback that waits for a human is minutes slower.',
      metrics: { freq: '10 per day', down: '0', blast: '5% for 2 min', rollback: '10 s, automatic' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: 'canary weight 0' },
          { ...s1, status: 'ok', badge: 'errors 0.2%' },
          { ...s2, status: 'ok' },
          { ...s3, status: 'ok' },
          { ...s4, label: 'canary', sub: 'v2', status: 'down', badge: 'errors 4%' },
          { ...mon, status: 'hot', badge: '20x baseline' },
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 's1' },
          { from: 'lb', to: 's2' },
          { from: 'lb', to: 's3' },
          { from: 'lb', to: 's4', style: 'faint' },
          { from: 's4', to: 'mon', style: 'dashed' },
          { from: 'mon', to: 'lb', style: 'dashed', label: 'abort' },
        ],
        flows: [
          { path: ['s4', 'mon'], tone: 'error', label: '4% errors', duration: 1.1 },
          { path: ['mon', 'lb'], tone: 'event', label: 'roll back', duration: 1.4, delay: 1.2 },
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 0.9, delay: 2.7 },
          { path: ['lb', 's1'], tone: 'request', duration: 1, delay: 3.7 },
          { path: ['lb', 's2'], tone: 'request', duration: 1, delay: 3.7 },
          { path: ['lb', 's3'], tone: 'request', duration: 1, delay: 3.7 },
        ],
        caption: 'Metrics pull the canary out in two minutes',
      },
      code: {
        language: 'python',
        title: 'Canary analysis loop',
        source: `STAGES = [5, 25, 50, 100]          # percent of traffic on the new version
SOAK_MINUTES = 10

def healthy(new, old):
    err_new, err_old = errors(new, "2m"), errors(old, "2m")
    if err_new > max(2 * err_old, 0.01):        # 2x baseline and above 1%
        return False
    return p99(new, "2m") <= 1.2 * p99(old, "2m")

def rollout(new, old):
    for pct in STAGES:
        router.set_weight(new, pct)
        for _ in range(SOAK_MINUTES):
            time.sleep(60)
            if not healthy(new, old):
                router.set_weight(new, 0)       # rollback in one call
                notify(f"{new} failed at {pct}%, rolled back")
                return False
    retire(old)
    return True`,
        highlight: [6, 8, 15, 16],
      },
      quiz: {
        question: 'A release must never have two versions serving users at the same time, and rollback must take seconds. Which strategy fits?',
        options: ['Rolling update', 'Blue-green', 'Canary at 5%', 'Restart all servers together'],
        answer: 1,
        explain: 'Blue-green switches all traffic at once between two complete fleets, so users never see a mix, and switching back is instant. Rolling and canary both run two versions side by side by design.',
      },
    },
    {
      title: 'Schema trap',
      tag: 'case',
      heading: 'Case: a column rename breaks the rollout',
      eli5: 'All counters share one pantry. A baker relabels the "flour" jar to "wheat" for the new recipe. The counters still using the old recipe look for "flour", find nothing, and stop baking.',
      body: [
        'A developer renames the column `fullname` to `display_name`. The migration runs first and takes a second. Then the rolling update begins.',
        'For the next eight minutes servers 3 and 4 still run v1, which selects `fullname`. That column no longer exists, so half of all profile requests fail with a SQL error. Rolling back the code does not help either: v1 is the version that is broken, and the old column is gone.',
        'Every strategy in this lesson has a window where **old code and new code share one database**. Rolling has it during the rollout, canary for an hour, blue-green until the old fleet is retired. A schema change must therefore work with the version before it and the version after it.',
      ],
      keyIdea: 'Code can be rolled back in seconds. A destructive schema change cannot, and it breaks whichever version did not expect it.',
      metrics: { freq: '10 per day', down: '8 min, partial', blast: '50%', rollback: 'blocked' },
      scene: {
        nodes: [
          users,
          lb,
          { ...s1, sub: 'v2', status: 'ok', badge: 'display_name' },
          { ...s2, sub: 'v2', status: 'ok' },
          { ...s3, status: 'down', badge: 'fullname?' },
          { ...s4, status: 'down', badge: 'fullname?' },
          { ...db, status: 'hot', badge: 'column renamed' },
        ],
        links: [...fleetLinks, { from: 's1', to: 'db' }, { from: 's4', to: 'db' }],
        flows: [
          { path: ['users', 'lb', 's4'], tone: 'request', duration: 1.4 },
          { path: ['s4', 'db'], tone: 'request', label: 'SELECT fullname', duration: 1, delay: 1.5 },
          { path: ['db', 's4'], tone: 'error', label: 'no such column', duration: 1, delay: 2.6 },
          { path: ['s4', 'lb', 'users'], tone: 'error', label: '500', duration: 1.4, delay: 3.7 },
        ],
        caption: 'Old code meets a schema it does not know',
      },
    },
    {
      title: 'Expand, contract',
      tag: 'concept',
      heading: 'Expand and contract: change the schema in safe steps',
      eli5: 'Put a second jar labelled "wheat" next to the "flour" jar and fill both. When every counter uses the new label, and only then, take the old jar away.',
      body: [
        'Split the rename into steps that are each **backward compatible**, and deploy them separately. **Expand**: add the new column, nullable, next to the old one. Old code ignores it. Deploy code that writes both columns and still reads the old one.',
        '**Migrate**: copy old values into the new column in small batches so no long lock is held. Then deploy code that reads the new column, still writing both. At this point rolling back one version is always safe, because both columns are current.',
        '**Contract**: once no running version touches the old column, stop writing it and drop it in a later deploy. One rename became four small deploys over a few days. That is the trade: more steps, and no moment where any live version is broken.',
      ],
      keyIdea: 'Add first, move readers and writers, remove last. Each deploy must work with the schema before and after it.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      scene: {
        nodes: [
          users,
          lb,
          { ...s1, sub: 'v2', status: 'ok', badge: 'writes both' },
          { ...s2, sub: 'v2', status: 'ok' },
          { ...s3, status: 'ok', badge: 'reads fullname' },
          { ...s4, status: 'ok' },
          { ...db, status: 'ok', badge: 'both columns' },
        ],
        links: [...fleetLinks, { from: 's1', to: 'db' }, { from: 's4', to: 'db' }],
        flows: [
          { path: ['users', 'lb', 's1'], tone: 'request', duration: 1.4 },
          { path: ['s1', 'db'], tone: 'data', label: 'write both', duration: 1.2, delay: 1.5 },
          { path: ['users', 'lb', 's4'], tone: 'request', duration: 1.4, delay: 0.4 },
          { path: ['s4', 'db'], tone: 'request', label: 'SELECT fullname', duration: 1, delay: 1.9 },
          { path: ['db', 's4'], tone: 'response', label: 'row', duration: 1, delay: 3 },
        ],
        caption: 'Both versions find the column they expect',
      },
      code: {
        language: 'sql',
        title: 'Renaming a column with expand and contract',
        source: `-- Deploy 1 (expand): additive, old code does not notice
ALTER TABLE users ADD COLUMN display_name text;

-- Deploy 2: app writes BOTH columns, still reads fullname

-- Backfill in small batches, repeat until 0 rows are updated
UPDATE users SET display_name = fullname
WHERE id IN (
  SELECT id FROM users
  WHERE display_name IS NULL AND fullname IS NOT NULL
  LIMIT 5000
);

-- Deploy 3: app reads display_name, still writes both
-- Deploy 4: app stops writing fullname

-- Deploy 5 (contract): only after no running version uses it
ALTER TABLE users DROP COLUMN fullname;`,
        highlight: [2, 7, 11, 18],
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Which strategy, and when to roll back',
      eli5: 'A small shop swaps counters one at a time. A busy shop lets a few customers taste first. Either way, the baker keeps yesterday\'s dough on the shelf in the **registry** in case today\'s goes wrong.',
      body: [
        '**Rolling** is the default: no extra fleet, no downtime, and a slow rollback. **Blue-green** fits when versions cannot mix or rollback must be instant, and you can afford double capacity for a while. **Canary** fits high-traffic services where a bad release is expensive. Many teams combine them: a canary first, then a rolling update for the rest.',
        'When a release misbehaves, **roll back first and debug afterwards**. Rollback is fast and known to work because the previous artifact is still in the registry. Rolling forward with a hot fix means writing new code under pressure, and is right mainly when the old version cannot run anymore, for example after a contract step.',
        'One more separation helps: putting code on servers does not have to mean showing it to users. Shipping a change switched off and turning it on later is the subject of the feature flags lesson.',
      ],
      keyIdea: 'Pick the strategy by how much a bad release costs you. Whatever you pick, keep rollback one command away.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      scene: {
        nodes: [
          dev,
          { ...ci, status: 'ok' },
          { ...reg, status: 'active', badge: 'v1 kept for rollback' },
          users,
          lb,
          { ...s1, sub: 'v2', status: 'ok' },
          { ...s2, sub: 'v2', status: 'ok' },
          { ...s3, sub: 'v2', status: 'ok' },
          { ...s4, sub: 'v2', status: 'ok' },
        ],
        links: [...fleetLinks, { from: 'dev', to: 'ci' }, { from: 'ci', to: 'reg' }, { from: 'reg', to: 's1', style: 'dashed' }],
        flows: [
          { path: ['dev', 'ci', 'reg'], tone: 'request', label: 'commit', duration: 1.6 },
          { path: ['reg', 's1'], tone: 'data', duration: 1.2, delay: 1.7 },
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 0.9, delay: 1 },
          { path: ['lb', 's2'], tone: 'request', duration: 1, delay: 2 },
          { path: ['lb', 's3'], tone: 'request', duration: 1, delay: 2 },
        ],
        caption: 'The previous artifact is always one step away',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Small changes, shipped often, easy to undo',
      eli5: 'The machine tastes every recipe, a few customers try the new bread first, and the old dough stays on the shelf. The pantry gets a new jar before the old one goes away.',
      body: [
        'A **pipeline** builds one artifact per commit, tests it and promotes it unchanged. **Rolling updates** replace servers in batches behind health checks. **Blue-green** flips between two fleets for an instant rollback. A **canary** exposes 5% of traffic and lets metrics decide whether to continue.',
        'All of them run two versions against one database for a while, so schema changes go through **expand and contract**. The team went from one risky deploy every two weeks with 12 minutes of downtime to ten a day with none, and a bad build now reaches 5% of users for about two minutes.',
      ],
      keyIdea: 'Safe delivery is small steps, a limited blast radius and a fast way back.',
      metrics: { freq: '10 per day', down: '0', blast: '5% for 2 min', rollback: '10 s, automatic' },
      scene: {
        nodes: [dev, ci, reg, { ...mon, status: 'ok' }, users, lb, { ...s1, sub: 'v2', status: 'ok' }, { ...s3, sub: 'v2', status: 'ok' }, { ...db, status: 'ok' }],
        links: [
          { from: 'dev', to: 'ci' },
          { from: 'ci', to: 'reg' },
          { from: 'reg', to: 's1', style: 'dashed' },
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 's1' },
          { from: 'lb', to: 's3' },
          { from: 's3', to: 'db' },
          { from: 's3', to: 'mon', style: 'dashed' },
        ],
        flows: [
          { path: ['dev', 'ci', 'reg', 's1'], tone: 'data', duration: 2.4 },
          { path: ['users', 'lb', 's3', 'db'], tone: 'request', duration: 2, delay: 0.6 },
          { path: ['s3', 'mon'], tone: 'data', duration: 1.2, delay: 2.7 },
        ],
      },
      quiz: {
        question: 'You need to change the type of a column that live code reads. Which first step is safe during a rolling update?',
        options: [
          'Alter the column in place, then deploy the new code',
          'Deploy the new code first, then alter the column',
          'Add a new column next to the old one and have the code write both',
          'Stop all servers, alter the column, start them again',
        ],
        answer: 2,
        explain: 'Adding a column is invisible to old code, so both versions keep working. The first two options each break one of the versions while they overlap, and the last one is planned downtime.',
      },
    },
  ],
};
