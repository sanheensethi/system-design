import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column and screen row. */
const P = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const dev: SceneNode = { id: 'dev', kind: 'block', size: 0.8, at: P(-6, -3.4), label: 'engineer', icon: 'Code', tint: 'blue' };
const ci: SceneNode = { id: 'ci', kind: 'block', size: 0.8, at: P(-2, -3.4), label: 'pipeline', icon: 'Workflow', tint: 'violet' };
const reg: SceneNode = { id: 'reg', kind: 'block', size: 0.8, at: P(2, -3.4), label: 'registry', icon: 'Package', tint: 'amber' };
const mon: SceneNode = { id: 'mon', kind: 'block', size: 0.8, at: P(6, -3.4), label: 'metrics', icon: 'Activity', tint: 'teal' };

const users: SceneNode = { id: 'users', kind: 'block', size: 0.8, at: P(-6, 3.4), label: 'users', sub: '2,000 req/s', icon: 'Users', tint: 'blue' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: P(-3, 3.4), label: 'balancer' };
const s1: SceneNode = { id: 's1', kind: 'server', at: P(0, 3.4), label: 'server 1', sub: 'v1' };
const s2: SceneNode = { id: 's2', kind: 'server', at: P(2.5, 3.4), label: 'server 2', sub: 'v1' };
const s3: SceneNode = { id: 's3', kind: 'server', at: P(5, 3.4), label: 'server 3', sub: 'v1' };
const s4: SceneNode = { id: 's4', kind: 'server', at: P(7.5, 3.4), label: 'server 4', sub: 'v1' };
const db: SceneNode = { id: 'db', kind: 'db', at: P(7.5, -0.2), label: 'database' };


export const deployments: Lesson = {
  id: 'deployments',
  title: 'Deployments: CI/CD, blue-green, canary',
  tagline: 'Ship new code many times a day without users noticing, and back out in seconds when it is wrong.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Why manual and big-batch deploys fail, and what a build, test and deploy pipeline replaces',
    'Immutable artifacts, environments, and config kept apart from code',
    'Rolling updates, health checks and connection draining',
    'Blue-green: a second fleet and an instant switch',
    'Canary releases with automatic rollback on metrics',
    'Database changes that survive two code versions: expand and contract',
    'Deploy versus release, rollback versus roll forward, infrastructure as code and delivery metrics',
  ],
  metrics: [
    { key: 'freq', label: 'Deploys', icon: 'Repeat' },
    { key: 'down', label: 'Downtime per deploy', icon: 'Timer' },
    { key: 'blast', label: 'Users on a bad build', icon: 'Users' },
    { key: 'rollback', label: 'Rollback time', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Manual deploy',
      tag: 'problem',
      heading: 'Friday, 6 PM: a deploy by hand',
      eli5: 'The baker changes the bread recipe at every counter by hand, from memory, while the shop is open. All four counters close at once, one gets the wrong recipe, and customers leave with nothing.',
      body: [
        'The shop runs on four app servers behind a load balancer. Every two weeks an engineer builds on a laptop, copies the code to each server, edits a config file and restarts. The steps live in a wiki page that is slightly out of date.',
        'Tonight the build used a library version that only exists on that laptop. Servers 1, 2 and 4 were restarted together, so the site was down for 12 minutes. Server 3 was skipped and still runs old code.',
      ],
      keyIdea: 'A manual deploy is an untested program run by a tired human.',
      metrics: { freq: 'every 2 weeks', down: '12 min', blast: '100%', rollback: '45 min' },
      metricTones: { down: 'bad', blast: 'bad', rollback: 'bad' },
      scene: {
        nodes: [
          { ...dev, status: 'hot', badge: 'scp + restart' },
          lb,
          { ...s1, status: 'down', badge: 'restarting' },
          { ...s3, status: 'hot', badge: 'skipped' },
        ],
        links: [link('lb', 's1'), link('lb', 's3'), link('dev', 's1', { style: 'dashed', label: 'copy by hand', labelTone: 'warn' })],
        flows: [
          { path: ['dev', 's1'], tone: 'data', label: 'copy build', duration: 1.4 },
          { path: ['lb', 's1'], tone: 'error', label: '503', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'The wiki checklist',
          icon: 'List',
          rows: [
            { text: 'Build on laptop', value: 'unknown libs', tone: 'warn' },
            { text: 'Copy to 4 servers', value: 'missed 1', tone: 'bad' },
            { text: 'Restart all', value: '12 min down', tone: 'bad' },
          ],
          footer: { text: 'Nobody kept the old build', tone: 'bad' },
        },
        caption: 'Every server restarts at once',
      },
    },
    {
      title: 'Big batches',
      tag: 'problem',
      heading: 'Painful deploys make releases bigger',
      eli5: 'Because changing the recipe is such a mess, the baker does it only twice a month. Then 200 small tweaks arrive at once, and when the bread tastes odd nobody knows which tweak did it.',
      body: [
        'Because deploys hurt, the team deploys rarely. Rare deploys are large, and large deploys break more often. A break is hard to trace when 200 changes went out together.',
        'Going back means repeating the ritual with the old build, if anyone kept it. That took 45 minutes tonight.',
      ],
      keyIdea: 'Risk grows with the size of each release, so the cure for painful deploys is to deploy more often.',
      metrics: { freq: 'every 2 weeks', down: '12 min', blast: '100%', rollback: '45 min' },
      metricTones: { freq: 'bad', rollback: 'bad' },
      scene: {
        nodes: [{ ...dev, badge: '200 changes' }, { ...ci, tint: 'gray', status: 'dim' }, { ...s1, status: 'hot', badge: 'which change?' }],
        links: [link('dev', 'ci', { style: 'faint' }), link('dev', 's1', { label: 'one big release', labelTone: 'warn' })],
        flows: [{ path: ['dev', 's1'], tone: 'data', label: '200 changes', count: 3, duration: 1.6 }],
        panel: {
          title: 'Release size vs trouble',
          icon: 'TrendingUp',
          rows: [
            { text: '20 lines, daily', value: 'easy to trace', tone: 'good' },
            { text: '4,000 lines, biweekly', value: 'hard to trace', tone: 'bad' },
          ],
        },
        caption: 'Rare deploys pile up risk',
      },
    },
    {
      title: 'CI',
      tag: 'concept',
      heading: 'Continuous integration: every commit is built and tested',
      eli5: 'A checklist machine, the **pipeline**, mixes every new recipe the same way and tastes it. A bad batch is stopped while it is still one small tweak and the baker remembers it.',
      body: [
        '**Continuous integration** (CI) means every commit to the main branch is built and tested automatically within minutes. A failing test blocks the change while it is small and its author still remembers it.',
        'Typical stages: lint, unit tests, build, a scan of dependencies. Fast feedback matters most here, so slow suites run later in the pipeline.',
      ],
      keyIdea: 'CI catches a break within minutes of the commit that caused it.',
      metrics: { freq: '10 per day', down: '12 min', blast: '100%', rollback: '45 min' },
      metricTones: { freq: 'good' },
      scene: {
        nodes: [dev, { ...ci, status: 'active', badge: 'lint, test' }, { ...reg, status: 'dim' }],
        links: [link('dev', 'ci', { label: 'git push' }), link('ci', 'reg', { style: 'faint' })],
        flows: [
          { path: ['dev', 'ci'], tone: 'request', label: 'git push', duration: 1.2 },
          { path: ['ci', 'dev'], tone: 'response', label: 'tests pass', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'On every push',
          icon: 'Workflow',
          rows: [
            { text: 'lint', value: '8 s', tone: 'good' },
            { text: 'unit tests', value: '2 min', tone: 'good' },
            { text: 'dependency scan', value: '40 s', tone: 'good' },
          ],
          footer: { text: 'A red check blocks the merge', tone: 'muted' },
        },
        caption: 'A failing test blocks a small change',
      },
    },
    {
      title: 'Artifact',
      tag: 'concept',
      heading: 'Build once: one immutable artifact',
      eli5: 'The pipeline puts the finished dough in a sealed, labelled box on the **registry** shelf. Every counter gets the same box. Nobody remixes it on the way.',
      body: [
        'The build produces one **immutable artifact**, usually a container image tagged with the commit hash, stored in a registry. The same artifact moves through staging and production.',
        'Nothing is rebuilt on the way, so what you tested is what you ship. A rebuild can quietly pick up a new library version that nobody tested.',
      ],
      keyIdea: 'Build once, tag by commit hash, and promote the same artifact everywhere.',
      metrics: { freq: '10 per day', down: '12 min', blast: '100%', rollback: '45 min' },
      scene: {
        nodes: [{ ...ci, status: 'active' }, { ...reg, status: 'ok', badge: 'shop:3f9c2a1' }, { ...s1, status: 'dim' }],
        links: [link('ci', 'reg', { label: 'push image' }), link('reg', 's1', { style: 'dashed', label: 'pull same image' })],
        flows: [
          { path: ['ci', 'reg'], tone: 'data', label: 'image', duration: 1.2 },
          { path: ['reg', 's1'], tone: 'data', label: 'same image', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Image tags',
          icon: 'Package',
          rows: [
            { text: 'shop:3f9c2a1', value: 'this commit', tone: 'good' },
            { text: 'shop:b71e0d4', value: 'previous', tone: 'muted' },
            { text: 'shop:latest', value: 'avoid', tone: 'bad' },
          ],
          footer: { text: 'A pushed tag never moves', tone: 'muted' },
        },
        caption: 'The tested image is the shipped image',
      },
    },
    {
      title: 'Environments',
      tag: 'concept',
      heading: 'CD: promote the artifact through environments',
      eli5: 'The sealed box goes to a practice counter first. If the taste test there passes, the same box goes to the real counters. A button or no button, but always the same box.',
      body: [
        '**Continuous delivery** (CD) automates the path from artifact to production. Staging runs integration tests and a **smoke test** against real endpoints. Production follows with a button (delivery) or no gate at all (**deployment**).',
        'Config differs per environment (database address, secrets, flags) and is injected at start, never baked into the image.',
      ],
      keyIdea: 'Same artifact, different config per environment.',
      metrics: { freq: '10 per day', down: '12 min', blast: '100%', rollback: '45 min' },
      metricTones: { freq: 'good' },
      scene: {
        nodes: [
          { ...reg, status: 'ok' },
          { id: 'stg', kind: 'block', size: 0.8, at: P(-2, 0), label: 'staging', icon: 'Layers', tint: 'amber', status: 'active', badge: 'smoke test' },
          { id: 'prod', kind: 'block', size: 0.8, at: P(3, 3.4), label: 'production', icon: 'Server', tint: 'green' },
        ],
        links: [link('reg', 'stg', { label: 'staging config' }), link('stg', 'prod', { label: 'if green' })],
        flows: [
          { path: ['reg', 'stg'], tone: 'data', label: 'shop:3f9c2a1', duration: 1.4 },
          { path: ['stg', 'prod'], tone: 'data', label: 'same image', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Per environment',
          icon: 'Table',
          rows: [
            { text: 'image', value: 'identical', tone: 'good' },
            { text: 'DB address', value: 'differs', tone: 'warn' },
            { text: 'secrets', value: 'injected at start', tone: 'warn' },
          ],
        },
        caption: 'Promote, never rebuild',
      },
    },
    {
      title: 'Pipeline code',
      tag: 'concept',
      heading: 'The pipeline is a file in the repo',
      eli5: 'The checklist is written in the recipe book itself, so everyone follows the same steps and the steps change only when the book changes.',
      body: [
        'The whole path is declared as code next to the application and reviewed like any change. Each job runs only if the previous one passed, so a red test never reaches production. Small, frequent deploys now cost almost nothing.',
      ],
      keyIdea: 'A pipeline in version control is reviewable, repeatable and the same for every engineer.',
      metrics: { freq: '10 per day', down: '12 min', blast: '100%', rollback: '45 min' },
      scene: {
        nodes: [dev, { ...ci, status: 'active', badge: 'build, test, deploy' }, { ...reg, status: 'ok' }],
        links: [link('dev', 'ci'), link('ci', 'reg')],
        flows: [
          { path: ['dev', 'ci'], tone: 'request', label: 'git push', duration: 1 },
          { path: ['ci', 'reg'], tone: 'data', label: 'image', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Gates',
          icon: 'Workflow',
          rows: [
            { text: 'build-test', value: 'first', tone: 'good' },
            { text: 'deploy-staging', value: 'needs build-test' },
            { text: 'deploy-prod', value: 'needs staging' },
          ],
        },
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
        'A **rolling update** replaces servers in small batches: take server 1 out of the load balancer, start the new version, put it back, then do server 2. Three of four servers are always serving, so users see no outage.',
        'Taking a server out means **connection draining**: the balancer stops sending it new requests and lets in-flight ones finish before the old version stops.',
        'The cost is capacity. During the rollout you run at 75%, so do it off peak or start an extra server first.',
      ],
      keyIdea: 'Rolling updates remove downtime by replacing servers a few at a time.',
      metrics: { freq: '10 per day', down: '0', blast: 'grows to 100%', rollback: '8 min' },
      metricTones: { down: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active' },
          { ...s1, sub: 'v2', status: 'ok', badge: 'ready' },
          { ...s2, status: 'active', badge: 'replacing' },
          { ...s3, load: 80, chips: ['GET /cart'] },
          { ...s4, load: 80 },
        ],
        links: [link('lb', 's1'), link('lb', 's2', { style: 'faint' }), link('lb', 's3'), link('lb', 's4')],
        flows: [
          { path: ['lb', 's1'], tone: 'request', duration: 1 },
          { path: ['lb', 's3'], tone: 'request', duration: 1 },
          { path: ['lb', 's4'], tone: 'request', duration: 1 },
        ],
        panel: {
          title: 'Capacity during rollout',
          icon: 'Gauge',
          rows: [
            { text: 'serving', value: '3 of 4', tone: 'warn' },
            { text: 'each server load', value: '60% to 80%', tone: 'warn' },
          ],
          footer: { text: 'Roll off peak or add a spare', tone: 'muted' },
        },
        caption: 'Three servers carry traffic while one is replaced',
      },
    },
    {
      title: 'Health checks',
      tag: 'concept',
      heading: 'Readiness checks keep the roll safe',
      eli5: 'Before a counter reopens, the baker checks it is really ready. Only when it answers "ready" do customers get sent to it again.',
      body: [
        'A **readiness check** keeps traffic away from the new server until it answers correctly: the balancer probes `GET /ready`, and only a 200 puts the server back in rotation. A separate **liveness check** restarts a process that is stuck.',
        'If the new version never turns ready, the rollout halts with the old servers still serving. The readiness check is what makes a rolling update stop itself.',
      ],
      keyIdea: 'A rollout moves only as fast as the new servers prove themselves ready.',
      metrics: { freq: '10 per day', down: '0', blast: 'grows to 100%', rollback: '8 min' },
      metricTones: { down: 'good' },
      scene: {
        nodes: [{ ...lb, status: 'active' }, { ...s2, sub: 'v2', status: 'active', badge: 'starting' }, { ...reg, at: P(2.5, -3.4) }],
        links: [link('reg', 's2', { style: 'dashed', label: 'pull v2' }), link('lb', 's2', { label: 'GET /ready', arrow: 'both' })],
        flows: [
          { path: ['reg', 's2'], tone: 'data', label: 'v2 image', duration: 1.4 },
          { path: ['lb', 's2'], tone: 'handshake', label: 'GET /ready', duration: 1, delay: 1.6 },
          { path: ['s2', 'lb'], tone: 'response', label: '200', duration: 1, delay: 2.7 },
        ],
        panel: {
          title: 'Readiness probe config',
          icon: 'Activity',
          code: 'readinessProbe:\n  httpGet: { path: /ready, port: 8080 }\n  periodSeconds: 5\n  failureThreshold: 3',
          footer: { text: 'Liveness uses the same shape and restarts the pod', tone: 'muted' },
        },
        caption: 'Traffic returns only after /ready says 200',
      },
      quiz: {
        question: 'During a rolling update, which check decides whether the balancer sends traffic to the new server?',
        options: ['Liveness check', 'Readiness check', 'The pipeline test stage', 'DNS TTL'],
        answer: 1,
        explain: 'Readiness says the instance can take traffic now. Liveness only decides whether to restart a stuck process.',
      },
    },
    {
      title: 'Mixed versions',
      tag: 'tradeoff',
      heading: 'The catch: two versions run at once',
      eli5: 'For a few minutes some counters bake the old recipe and some the new one. Both must work with the same menu and pantry, and going back is another slow round of counter swaps.',
      body: [
        'For several minutes **both versions serve traffic**, so v2 must be compatible with v1 in its API and its data. A user can even hit v2 on one request and v1 on the next.',
        'Rollback is another rolling update in reverse, which takes as long as the rollout did: about 8 minutes here.',
      ],
      keyIdea: 'Rolling updates have no downtime, but old and new code overlap and rollback is slow.',
      metrics: { freq: '10 per day', down: '0', blast: 'grows to 100%', rollback: '8 min' },
      metricTones: { rollback: 'warn' },
      scene: {
        nodes: [
          { ...lb, status: 'active' },
          { ...s1, sub: 'v2', status: 'ok' },
          { ...s2, sub: 'v2', status: 'ok' },
          { ...s3, chips: [{ text: 'v1 response', tone: 'warn' }] },
          { ...s4 },
        ],
        links: [link('lb', 's1'), link('lb', 's2'), link('lb', 's3'), link('lb', 's4')],
        flows: [
          { path: ['lb', 's1'], tone: 'request', label: 'v2', duration: 1 },
          { path: ['lb', 's3'], tone: 'request', label: 'v1', duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'Rollback by rolling back',
          icon: 'Clock',
          rows: [
            { text: 'rollout v1 to v2', value: '8 min' },
            { text: 'rollback v2 to v1', value: '8 min', tone: 'warn' },
          ],
        },
        caption: 'Two versions behind one balancer',
      },
    },
    {
      title: 'Blue-green',
      tag: 'tradeoff',
      heading: 'Blue-green: build a second fleet, then flip',
      eli5: 'Set up a whole second row of counters with the new bread while customers still use the first row. When the new row is ready, the **balancer** turns the sign at the door. If the bread is bad, turn the sign back.',
      body: [
        'In **blue-green** the live fleet (blue) keeps serving while you start a complete second fleet (green) on the new version and test it with no real users. Then the balancer switches all traffic in one step.',
        'Rollback is the same switch in reverse and takes seconds, because blue is still running. There is never a mixed fleet behind the balancer.',
      ],
      keyIdea: 'Blue-green buys instant rollback for the price of a second fleet.',
      metrics: { freq: '10 per day', down: '0', blast: '100% at the switch', rollback: '10 s' },
      metricTones: { rollback: 'good', blast: 'warn' },
      scene: {
        nodes: [
          { ...users, at: P(-6, 0) },
          { ...lb, at: P(-3, 0), status: 'active', badge: 'switch to green' },
          { ...s1, at: P(0, -3.4), label: 'blue pool', sub: '4 servers, v1', status: 'dim', badge: 'standby' },
          { ...s3, at: P(4, 3.4), label: 'green pool', sub: '4 servers, v2', status: 'ok', badge: 'live' },
        ],
        links: [link('users', 'lb'), link('lb', 's1', { style: 'faint' }), link('lb', 's3', { label: '100%' })],
        flows: [
          { path: ['users', 'lb', 's3'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['s3', 'lb', 'users'], tone: 'response', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Switch cost',
          icon: 'Scale',
          rows: [
            { text: 'servers during deploy', value: '8 (2x)', tone: 'warn' },
            { text: 'users on v2 at switch', value: '100%', tone: 'warn' },
            { text: 'rollback', value: 'flip back', tone: 'good' },
          ],
        },
        caption: 'All traffic moves in one switch, and can move back',
      },
      quiz: {
        question: 'A release must never have two versions serving users at the same time, and rollback must take seconds. Which strategy fits?',
        options: ['Rolling update', 'Blue-green', 'Canary at 5%', 'Restart all servers together'],
        answer: 1,
        explain: 'Blue-green switches all traffic at once between two complete fleets, so users never see a mix, and switching back is instant. Rolling and canary both run two versions side by side by design.',
      },
    },
    {
      title: 'Canary',
      tag: 'concept',
      heading: 'Canary: let 5% of traffic try it first',
      eli5: 'Give the new bread to 1 customer in 20 and watch their faces. If they are happy, give it to more people. Most customers never taste a bad batch.',
      body: [
        'A **canary release** sends a small slice of real traffic, say 5%, to the new version while 95% stays on the old one. Compare error rate and latency with the baseline. If they match for ten minutes, go to 25%, 50%, then 100%.',
        'Route by a hash of the user id so the same user always sees the same version. Random per-request splitting flips one user between v1 and v2 and makes the comparison noisy.',
      ],
      keyIdea: 'A canary limits the blast radius: expose a few users, measure, then widen.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      metricTones: { blast: 'good', rollback: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active', badge: 'hash(user id)', chips: ['95% / 5%'] },
          { ...s1, sub: 'v1', badge: 'baseline', chips: ['1,900 req/s'] },
          { ...s4, label: 'canary', sub: 'v2', status: 'active', chips: ['100 req/s'] },
          mon,
        ],
        links: [link('lb', 's1'), link('lb', 's4', { label: '5%' }), link('s4', 'mon', { style: 'dashed' }), link('s1', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['lb', 's1'], tone: 'request', count: 4, duration: 1 },
          { path: ['lb', 's4'], tone: 'request', label: '5%', duration: 1, delay: 0.3 },
          { path: ['s4', 'mon'], tone: 'data', duration: 1.2, delay: 1.4 },
          { path: ['s1', 'mon'], tone: 'data', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Rollout stages',
          icon: 'TrendingUp',
          rows: [
            { text: '5%', value: '10 min soak', tone: 'good' },
            { text: '25%', value: '10 min soak' },
            { text: '50%', value: '10 min soak' },
            { text: '100%', value: 'retire old' },
          ],
        },
        caption: 'A small, measured slice of real traffic',
      },
    },
    {
      title: 'Canary cost',
      tag: 'tradeoff',
      heading: 'What a canary costs you',
      eli5: 'Tasting by a few customers takes time, and 1 customer in 20 only tells you something if the shop has enough customers to begin with.',
      body: [
        'The price is time: a careful rollout takes 30 to 60 minutes. You also need enough traffic for 5% to mean something. At 2,000 requests per second the canary sees 100 per second, which is plenty. At 10 per second it would see half a request.',
        'Low-traffic services often use blue-green plus synthetic tests instead.',
      ],
      keyIdea: 'A canary needs traffic and time. Without both, the signal is noise.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      scene: {
        nodes: [
          { ...s4, label: 'big shop', sub: '2,000 req/s', status: 'ok', chips: [{ text: '5% = 100 req/s', tone: 'good' }] },
          { ...s1, label: 'tiny shop', sub: '10 req/s', status: 'dim', chips: [{ text: '5% = 0.5 req/s', tone: 'warn' }] },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Is 5% enough?',
          icon: 'Gauge',
          rows: [
            { text: '2,000 req/s', value: '100 req/s canary', tone: 'good' },
            { text: '10 req/s', value: '0.5 req/s canary', tone: 'bad' },
            { text: 'full rollout', value: '30 to 60 min', tone: 'warn' },
          ],
        },
        caption: 'Traffic decides whether a canary can tell you anything',
      },
    },
    {
      title: 'Auto rollback',
      tag: 'case',
      heading: 'Case: the canary fails and nobody is paged',
      eli5: 'The **metrics** helper sees that people with the new bread are making sour faces. It tells the balancer to stop handing it out, before the baker even looks up.',
      body: [
        'Version 2 has a bug: checkout fails for carts with a discount code. Tests missed it. Within two minutes the canary error rate is **4%** against **0.2%** on the baseline.',
        'The controller sets the canary weight to 0 and posts the comparison to the team channel. Total exposure: 5% of users for two minutes. Always compare against the baseline over the same minutes, never against yesterday.',
      ],
      keyIdea: 'Let a machine watch the canary and pull it. A rollback that waits for a human is minutes slower.',
      metrics: { freq: '10 per day', down: '0', blast: '5% for 2 min', rollback: '10 s, automatic' },
      metricTones: { blast: 'good', rollback: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active', badge: 'canary weight 0' },
          { ...s1, status: 'ok', badge: 'errors 0.2%' },
          { ...s4, label: 'canary', sub: 'v2', status: 'down', badge: 'errors 4%' },
          { ...mon, status: 'hot', badge: '20x baseline' },
        ],
        links: [link('lb', 's1'), link('lb', 's4', { style: 'faint' }), link('s4', 'mon', { style: 'dashed' }), link('mon', 'lb', { style: 'dashed', label: 'abort' })],
        flows: [
          { path: ['s4', 'mon'], tone: 'error', label: '4% errors', duration: 1.1 },
          { path: ['mon', 'lb'], tone: 'event', label: 'roll back', duration: 1.4, delay: 1.2 },
          { path: ['lb', 's1'], tone: 'request', duration: 1, delay: 2.8 },
        ],
        panel: {
          title: 'Canary vs baseline',
          icon: 'Activity',
          rows: [
            { text: 'error rate', value: '4% vs 0.2%', tone: 'bad' },
            { text: 'decision', value: 'weight to 0', tone: 'good' },
            { text: 'exposure', value: '5% for 2 min', tone: 'good' },
          ],
        },
        caption: 'Metrics pull the canary out in two minutes',
      },
      quiz: {
        question: 'The canary shows 4% errors against 0.2% on the baseline. What should the controller do first?',
        options: ['Raise the canary to 25% to get more data', 'Set the canary weight to 0', 'Wait for a human to read the dashboard', 'Redeploy the baseline'],
        answer: 1,
        explain: 'Pulling the canary weight to 0 stops the damage in seconds. Debugging comes after users are safe.',
      },
    },
    {
      title: 'Analysis loop',
      tag: 'concept',
      heading: 'The canary analysis loop in code',
      eli5: 'The metrics helper follows a simple rule: if the new bread gets twice as many sour faces as the old, stop handing it out. Otherwise give it to a few more people.',
      body: [
        'The controller raises the weight stage by stage and judges each stage with a rule: error rate above twice the baseline and above a 1% floor fails, and so does p99 latency over 1.2 times the baseline. One call to set the weight to 0 is the rollback.',
      ],
      keyIdea: 'Define pass and fail in numbers before the rollout starts.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s, automatic' },
      scene: {
        nodes: [{ ...lb, status: 'active' }, { ...mon, at: P(0, -3.4), status: 'active' }, { ...s4, label: 'canary', sub: 'v2' }],
        links: [link('mon', 'lb', { style: 'dashed', label: 'set weight' }), link('lb', 's4')],
        flows: [{ path: ['mon', 'lb'], tone: 'event', label: 'weight 25%', duration: 1.4 }],
        panel: {
          title: 'Fail rules',
          icon: 'Shield',
          rows: [
            { text: 'errors', value: '> 2x baseline and > 1%', tone: 'bad' },
            { text: 'p99 latency', value: '> 1.2x baseline', tone: 'bad' },
            { text: 'otherwise', value: 'next stage', tone: 'good' },
          ],
        },
        caption: 'Numbers decide, not people',
      },
      code: {
        language: 'python',
        title: 'Canary analysis loop',
        source: `STAGES = [5, 25, 50]               # judged against the old fleet
SOAK_MINUTES = 10

def healthy(new, old):
    # window starts after the weight change, not before it
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
    router.set_weight(new, 100)                 # old gets no traffic, no baseline left
    retire(old)
    return True`,
        highlight: [7, 9, 16, 17],
      },
    },
    {
      title: 'Schema trap',
      tag: 'case',
      heading: 'Case: a column rename breaks the rollout',
      eli5: 'All counters share one pantry. A baker relabels the "flour" jar to "wheat" for the new recipe. The counters still using the old recipe look for "flour", find nothing, and stop baking.',
      body: [
        'A developer renames the column `fullname` to `display_name`. The migration runs first, then the rolling update begins. For eight minutes servers 3 and 4 still run v1, which selects `fullname`.',
        'That column is gone, so half of all profile requests fail. Rolling back the code does not help: v1 is the broken version, and the old column no longer exists.',
      ],
      keyIdea: 'Code rolls back in seconds. A destructive schema change cannot, and it breaks whichever version did not expect it.',
      metrics: { freq: '10 per day', down: '8 min, partial', blast: '50%', rollback: 'blocked' },
      metricTones: { down: 'bad', blast: 'bad', rollback: 'bad' },
      scene: {
        nodes: [
          { ...s1, sub: 'v2', status: 'ok', chips: ['display_name'] },
          { ...s4, at: P(2.5, 3.4), status: 'down', chips: [{ text: 'SELECT fullname', tone: 'bad' }] },
          { ...db, at: P(5, -0.2), status: 'hot', badge: 'column renamed' },
        ],
        links: [link('s1', 'db'), link('s4', 'db')],
        flows: [
          { path: ['s4', 'db'], tone: 'request', label: 'SELECT fullname', duration: 1.2 },
          { path: ['db', 's4'], tone: 'error', label: 'no such column', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Schema vs code',
          icon: 'Table',
          rows: [
            { text: 'v2 reads display_name', value: 'works', tone: 'good' },
            { text: 'v1 reads fullname', value: 'SQL error', tone: 'bad' },
            { text: 'rollback to v1', value: 'still broken', tone: 'bad' },
          ],
        },
        caption: 'Old code meets a schema it does not know',
      },
    },
    {
      title: 'Shared database',
      tag: 'concept',
      heading: 'Every strategy shares one database',
      eli5: 'However the counters swap recipes, they all keep using the one shared pantry. So any change to the pantry has to suit the old recipe and the new one.',
      body: [
        'Every strategy in this lesson has a window where **old code and new code share one database**. Rolling has it for minutes, canary for an hour, blue-green until the old fleet is retired.',
        'A schema change must therefore work with the version before it and the version after it.',
      ],
      keyIdea: 'The database has one schema, and two code versions have to live with it.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      scene: {
        nodes: [
          { ...s1, at: P(-3, -3.4), sub: 'v1', label: 'old code' },
          { ...s3, at: P(2, 3.4), sub: 'v2', label: 'new code' },
          { ...db, at: P(6, 0), badge: 'one schema' },
        ],
        links: [link('s1', 'db'), link('s3', 'db')],
        flows: [
          { path: ['s1', 'db'], tone: 'request', duration: 1.2 },
          { path: ['s3', 'db'], tone: 'request', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'How long they overlap',
          icon: 'Clock',
          rows: [
            { text: 'rolling', value: 'minutes' },
            { text: 'canary', value: 'about an hour' },
            { text: 'blue-green', value: 'until blue retires' },
          ],
        },
        caption: 'Two versions, one schema',
      },
    },
    {
      title: 'Expand, contract',
      tag: 'concept',
      heading: 'Expand and contract: change the schema in safe steps',
      eli5: 'Put a second jar labelled "wheat" next to the "flour" jar and fill both. When every counter uses the new label, and only then, take the old jar away.',
      body: [
        '**Expand**: add the new column, nullable, next to the old one. Old code ignores it. Deploy code that writes both columns. **Migrate**: backfill old values in small batches so no long lock is held, then deploy code that reads the new column.',
        '**Contract**: once no running version touches the old column, stop writing it and drop it in a later deploy. One rename became five small deploys over days, and no live version was ever broken.',
      ],
      keyIdea: 'Add first, move readers and writers, remove last.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      metricTones: { down: 'good' },
      scene: {
        nodes: [
          { ...s1, at: P(-3, -3.4), sub: 'v1', label: 'old code', status: 'ok', chips: ['reads fullname'] },
          { ...s3, at: P(2, 3.4), sub: 'v2', label: 'new code', status: 'ok', chips: ['writes both'] },
          { ...db, at: P(6, 0), status: 'ok', badge: 'both columns' },
        ],
        links: [link('s1', 'db'), link('s3', 'db')],
        flows: [
          { path: ['s3', 'db'], tone: 'data', label: 'write both', duration: 1.2 },
          { path: ['s1', 'db'], tone: 'request', label: 'SELECT fullname', duration: 1.2, delay: 0.5 },
          { path: ['db', 's1'], tone: 'response', label: 'row', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Five deploys',
          icon: 'List',
          rows: [
            { text: '1 add column', value: 'expand' },
            { text: '2 write both', value: 'then backfill' },
            { text: '3 read new', value: 'still write both' },
            { text: '4 stop writing old' },
            { text: '5 drop old column', value: 'contract', tone: 'warn' },
          ],
        },
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
      title: 'Deploy vs release',
      tag: 'concept',
      heading: 'Deploying code is not releasing it',
      eli5: 'The new bread can sit in the back of every counter, covered by a cloth. Taking the cloth off for customers is a separate decision from carrying the bread in.',
      body: [
        'Putting code on servers does not have to mean showing it to users. Ship the change switched off behind a **feature flag**, then turn it on for 1%, then everyone. A bad feature is switched off in seconds with no deploy.',
        'Config and secrets also live outside the image, so changing them is not a rebuild. Flags are covered in depth in the feature flags lesson.',
      ],
      keyIdea: 'Separate deploy (code on servers) from release (users see it). Flags make release a switch.',
      metrics: { freq: '10 per day', down: '0', blast: '1%', rollback: 'seconds' },
      metricTones: { blast: 'good', rollback: 'good' },
      scene: {
        nodes: [
          { ...s1, sub: 'v2', status: 'ok', badge: 'code deployed' },
          { id: 'flag', kind: 'block', size: 0.8, at: P(3, -3.4), label: 'flag', sub: 'new_checkout', icon: 'Split', tint: 'violet', status: 'active', badge: 'on for 1%' },
          { ...users, at: P(-4, 3.4) },
        ],
        links: [link('flag', 's1', { style: 'dashed', label: 'read flag' }), link('users', 's1')],
        flows: [
          { path: ['users', 's1'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['flag', 's1'], tone: 'event', label: '1% on', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Two separate steps',
          icon: 'Split',
          rows: [
            { text: 'deploy', value: 'code on servers', tone: 'good' },
            { text: 'release', value: 'flag turned on' },
            { text: 'kill', value: 'flag turned off', tone: 'good' },
          ],
        },
        caption: 'The code ships dark, the flag decides who sees it',
      },
    },
    {
      title: 'Rollback',
      tag: 'tradeoff',
      heading: 'Roll back first, debug afterwards',
      eli5: 'If today\'s bread tastes wrong, put yesterday\'s dough back first. Figure out what went wrong once the customers are fed.',
      body: [
        'Rollback is fast and known to work, because the previous artifact is still in the registry. Rolling forward with a hot fix means writing new code under pressure.',
        'Roll forward is right mainly when the old version cannot run anymore, for example after a contract step dropped a column.',
      ],
      keyIdea: 'Keep the previous artifact and rollback one command away.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s to 8 min' },
      metricTones: { rollback: 'warn' },
      scene: {
        nodes: [
          { ...reg, status: 'active', badge: 'v1 kept' },
          { ...lb, at: P(-4, 3.4), status: 'active' },
          { ...s1, sub: 'v1', status: 'ok', badge: 'restored' },
        ],
        links: [link('reg', 's1', { style: 'dashed', label: 'redeploy v1' }), link('lb', 's1')],
        flows: [
          { path: ['reg', 's1'], tone: 'data', label: 'shop:b71e0d4', duration: 1.4 },
          { path: ['lb', 's1'], tone: 'request', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'Rollback time by strategy',
          icon: 'Scale',
          rows: [
            { text: 'rolling update', value: 'about 8 min', tone: 'warn' },
            { text: 'blue-green, canary to 0', value: 'about 10 s', tone: 'good' },
            { text: 'feature flag off', value: 'seconds', tone: 'good' },
            { text: 'vs hot fix', value: 'rollback wins: known-good artifact', tone: 'good' },
          ],
        },
        caption: 'The previous artifact is always one step away',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Which strategy, and when',
      eli5: 'A small shop swaps counters one at a time. A busy shop lets a few customers taste first. A shop where the recipe cannot mix builds a whole second row.',
      body: [
        '**Rolling** is the default: no extra fleet, no downtime, slow rollback. **Blue-green** fits when versions cannot mix or rollback must be instant. **Canary** fits high-traffic services where a bad release is expensive.',
        'Many teams combine them: a canary first, then a rolling update for the rest. Pick by how much a bad release costs you.',
      ],
      keyIdea: 'The costlier a bad release, the more you pay for a small blast radius.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      scene: {
        nodes: [
          { id: 'roll', kind: 'block', size: 0.8, at: P(-4, 3.4), label: 'rolling', icon: 'Repeat', tint: 'blue' },
          { id: 'bg', kind: 'block', size: 0.8, at: P(0, 3.4), label: 'blue-green', icon: 'ArrowLeftRight', tint: 'green' },
          { id: 'can', kind: 'block', size: 0.8, at: P(4, 3.4), label: 'canary', icon: 'Bug', tint: 'amber' },
        ],
        links: [],
        panel: {
          title: 'Pick by need',
          icon: 'Table',
          rows: [
            { text: 'rolling', value: 'cheap, slow rollback' },
            { text: 'blue-green', value: '2x servers, 10 s rollback' },
            { text: 'canary', value: 'needs traffic and time' },
          ],
          footer: { text: 'Canary then rolling is common', tone: 'muted' },
        },
        caption: 'No single best strategy',
      },
    },
    {
      title: 'As code',
      tag: 'concept',
      heading: 'Infrastructure and rollouts as code',
      eli5: 'The shop layout and the rollout rules are written in a plan book. To change the shop, you change the plan and a helper makes the shop match it.',
      body: [
        '**Infrastructure as code** (Terraform, Helm) describes servers and networks in files. With **GitOps**, a controller keeps the live system equal to what git says, so a deploy is a merged commit and a rollback is a revert.',
        'Orchestrators such as Kubernetes run rolling updates from a config: how many pods may be unavailable at once, and the readiness probe.',
      ],
      keyIdea: 'If the desired state lives in git, every change has a diff, an author and an undo.',
      metrics: { freq: '10 per day', down: '0', blast: '5%', rollback: '10 s' },
      scene: {
        nodes: [
          { ...dev, at: P(-5, -3.4), badge: 'merge commit' },
          { id: 'git', kind: 'block', size: 0.8, at: P(-1, -3.4), label: 'git repo', icon: 'FileCode', tint: 'violet' },
          { id: 'ctl', kind: 'block', size: 0.8, at: P(3, 3.4), label: 'controller', icon: 'Cpu', tint: 'teal', status: 'active', badge: 'sync' },
        ],
        links: [link('dev', 'git'), link('git', 'ctl', { label: 'pull desired state' })],
        flows: [
          { path: ['dev', 'git'], tone: 'request', label: 'merge', duration: 1.2 },
          { path: ['git', 'ctl'], tone: 'event', label: 'new tag', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Deployment excerpt',
          icon: 'Code',
          code: 'strategy:\n  type: RollingUpdate\n  rollingUpdate:\n    maxUnavailable: 1\n    maxSurge: 1\n# under the container:\nreadinessProbe:\n  httpGet: { path: /ready, port: 8080 }',
          footer: { text: 'Revert the commit to roll back', tone: 'muted' },
        },
        caption: 'Git is the source of truth',
      },
    },
    {
      title: 'Delivery metrics',
      tag: 'concept',
      heading: 'How to tell if delivery is getting better',
      eli5: 'The baker keeps score: how often new bread goes out, how fast it gets from idea to counter, how often it goes wrong, and how fast it is fixed.',
      body: [
        'Four numbers (the DORA metrics) track delivery health: **deploy frequency**, **lead time** from commit to production, **change failure rate** and **time to restore**. Elite teams ship many times a day with failure rates near 5%.',
        'Watch them together. Speed without a low failure rate means reckless, and the reverse means slow.',
      ],
      keyIdea: 'Measure frequency, lead time, failure rate and time to restore, and read them together.',
      metrics: { freq: '10 per day', down: '0', blast: '5% for 2 min', rollback: '10 s, automatic' },
      metricTones: { freq: 'good', down: 'good', blast: 'good', rollback: 'good' },
      scene: {
        nodes: [
          { ...ci, at: P(-4, 0), status: 'ok' },
          { ...mon, at: P(0, 0), status: 'ok', badge: 'DORA' },
          { ...users, at: P(4, 0) },
        ],
        links: [link('ci', 'mon', { style: 'dashed' }), link('mon', 'users', { style: 'faint' })],
        panel: {
          title: 'Before and after',
          icon: 'TrendingUp',
          rows: [
            { text: 'deploy frequency', value: '2 weeks to 10 per day', tone: 'good' },
            { text: 'lead time', value: 'days to under 1 hour', tone: 'good' },
            { text: 'time to restore', value: '45 min to 10 s', tone: 'good' },
            { text: 'change failure rate', value: 'watch it', tone: 'warn' },
          ],
        },
        caption: 'Four numbers, read together',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Small changes, shipped often, easy to undo',
      eli5: 'The machine tastes every recipe, a few customers try the new bread first, the old dough stays on the shelf, and the pantry gets a new jar before the old one goes away.',
      body: [
        'A **pipeline** builds one artifact per commit, tests it and promotes it unchanged. **Rolling updates** replace servers behind health checks, **blue-green** flips between two fleets, and a **canary** lets metrics judge 5% of traffic. All of them share one database, so schema changes use **expand and contract**.',
        'The team went from a risky deploy every two weeks with 12 minutes of downtime to ten a day with none.',
      ],
      keyIdea: 'Safe delivery is small steps, a limited blast radius and a fast way back.',
      metrics: { freq: '10 per day', down: '0', blast: '5% for 2 min', rollback: '10 s, automatic' },
      metricTones: { freq: 'good', down: 'good', blast: 'good', rollback: 'good' },
      scene: {
        nodes: [{ ...dev, at: P(-6, -3.4) }, { ...ci, status: 'ok' }, { ...reg, status: 'ok' }, { ...mon, at: P(6, -3.4), status: 'ok' }],
        links: [link('dev', 'ci'), link('ci', 'reg'), link('reg', 'mon', { style: 'dashed', label: 'canary metrics' })],
        flows: [{ path: ['dev', 'ci', 'reg', 'mon'], tone: 'data', duration: 3 }],
        caption: 'Commit, build, canary, measure',
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
