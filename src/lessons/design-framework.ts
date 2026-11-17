import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column d (right is positive) and screen row s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'phone', at: at(-7.5, 0), label: 'voters' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: at(-4.5, 0), label: 'load balancer' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-1.5, 0), label: 'poll API' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(1.5, -4), label: 'Redis', sub: 'live results' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(1.5, 2.5), label: 'vote queue' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: at(4.5, 2.5), label: 'counters', sub: 'batch workers' };
const replica: SceneNode = { id: 'replica', kind: 'replica', at: at(4.5, -4), label: 'replica' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(7.5, 0), label: 'Postgres', sub: 'polls, votes' };

const blackBox: SceneNode = { ...app, label: 'QuickPoll', sub: 'a black box' };
const reviewer: SceneNode = { id: 'reviewer', kind: 'block', at: at(-6, 0), label: 'reviewer', sub: 'your teammate', icon: 'Users', tint: 'teal' };

const simpleLinks: SceneLink[] = [link('user', 'lb'), link('lb', 'app'), link('app', 'cache'), link('app', 'db')];

export const designFramework: Lesson = {
  id: 'design-framework',
  title: 'A framework for any design',
  tagline: 'Six steps that take you from a one-line prompt to a design you can defend, shown on a small poll app.',
  minutes: 18,
  level: 'Beginner',
  learn: [
    'A repeatable order for any design problem, and why the order matters',
    'How to scope the problem and ask questions before you draw',
    'The five questions that turn vague requirements into constraints, with the tiers behind each',
    'How scale numbers decide which boxes you need',
    'Why the API and data model come before the architecture diagram',
    'How to find the hard part, spend your time there, and close with failures and trade-offs',
  ],
  metrics: [
    { key: 'stage', label: 'Step', icon: 'Route' },
    { key: 'reads', label: 'Peak reads', icon: 'Download' },
    { key: 'votes', label: 'Peak votes', icon: 'Inbox' },
    { key: 'boxes', label: 'Boxes drawn', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'Blank page',
      tag: 'problem',
      heading: '"Design a poll app." Where do you even start?',
      eli5: 'Someone says "open a pizza shop!" and you rush out to buy five ovens and a delivery truck. You never asked how many people are coming. Those dim **boxes** are the ovens nobody needed yet.',
      body: [
        'The prompt is one line: design **QuickPoll**, an app where people create a poll, share a link and vote. The whiteboard is empty and the clock is running.',
        'The common move is to draw familiar boxes: a queue, a cache, a few shards. Ten minutes later the diagram is busy and nobody can say why any box is there.',
      ],
      keyIdea: 'A box you cannot trace back to a requirement or a number is a guess. Start with questions, then draw.',
      metrics: { stage: '0 of 6', reads: '?', votes: '?', boxes: '4 guesses' },
      metricTones: { boxes: 'bad' },
      scene: {
        nodes: [
          user,
          { id: 'cache', kind: 'block', at: at(-1.5, -3.5), label: 'cache', icon: 'Zap', tint: 'gray', status: 'dim', badge: 'why?' },
          { id: 'queue', kind: 'block', at: at(-1.5, 3.5), label: 'queue', icon: 'Inbox', tint: 'gray', status: 'dim', badge: 'why?' },
          { id: 'db', kind: 'block', at: at(4, 0), label: 'shards', icon: 'Split', tint: 'gray', status: 'dim', badge: 'how many?' },
        ],
        links: [link('user', 'cache', { style: 'faint' }), link('user', 'queue', { style: 'faint' }), link('queue', 'db', { style: 'faint' })],
        flows: [{ path: ['user', 'queue'], tone: 'error', label: '?', duration: 2 }],
        panel: {
          title: 'What the diagram can justify',
          icon: 'List',
          rows: [
            { text: 'Boxes drawn', value: '4' },
            { text: 'Requirements asked', value: '0', tone: 'bad' },
            { text: 'Numbers counted', value: '0', tone: 'bad' },
            { text: 'Reasons for any box', value: '0', tone: 'bad' },
          ],
        },
        caption: 'Boxes first, reasons never',
      },
    },
    {
      title: 'Slow down',
      tag: 'concept',
      heading: 'Slow down: the questions matter more than the first answer',
      eli5: 'A pizza shop owner who builds ovens before asking anyone what they want to eat is guessing. The **reviewer** is the neighbor who tells us what the shop needs, if we ask.',
      body: [
        'Rushing to an answer is a red flag, in an interview and in a real design review. What gets judged is the questions you ask, the assumptions you write down and how you respond to feedback.',
        'Over-engineering is the other red flag: every extra box adds a cost that compounds. Treat the reviewer as a teammate, think out loud, and ask for a hint when stuck.',
      ],
      keyIdea: 'Design is a conversation. Ask, write assumptions down, and think out loud before you draw.',
      metrics: { stage: '0 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [reviewer, { ...blackBox, chips: ['assumptions: written down'] }],
        links: [link('reviewer', 'app', { arrow: 'both', label: 'questions' })],
        flows: [
          { path: ['reviewer', 'app'], tone: 'request', label: 'how many users?', duration: 1.6 },
          { path: ['app', 'reviewer'], tone: 'response', label: '10M daily', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'What reviewers look for',
          icon: 'Users',
          rows: [
            { text: 'Ask about scope and scale', tone: 'good' },
            { text: 'Write assumptions down', tone: 'good' },
            { text: 'Think out loud', tone: 'good' },
            { text: 'Jump to a solution', tone: 'bad' },
            { text: 'Over-engineer', tone: 'bad' },
          ],
        },
        caption: 'The reviewer is on your side',
      },
    },
    {
      title: 'Six steps',
      tag: 'concept',
      heading: 'The sequence: six steps, always in this order',
      eli5: 'Opening a pizza shop goes in order: ask who is coming, count the pizzas, write the menu, plan the shelves, sketch the kitchen, then worry about the busiest hour. The **black box** is the shop before we plan it.',
      body: [
        'Each step feeds the next. Requirements decide what to count. The counts decide which boxes you need. The API and data model decide what flows between them.',
        'Some guides compress this to four steps: scope, high-level design, deep dive, wrap-up. It is the same arc with coarser cuts. Start with a black box and open it one step at a time.',
      ],
      keyIdea: 'Requirements, scale, API and data, high-level design, deep dive, trade-offs. Each step is the input to the next.',
      metrics: { stage: '0 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [user, { ...blackBox, status: 'active', badge: '?' }],
        links: [link('user', 'app')],
        flows: [
          { path: ['user', 'app'], tone: 'request', duration: 1.4 },
          { path: ['app', 'user'], tone: 'response', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The six steps',
          icon: 'Route',
          rows: [
            { text: '1. Clarify requirements' },
            { text: '2. Estimate scale' },
            { text: '3. Define the API and data model' },
            { text: '4. Draw the high-level design' },
            { text: '5. Deep dive on the hard part' },
            { text: '6. Bottlenecks and trade-offs' },
          ],
        },
        caption: 'Start with users and one black box',
      },
    },
    {
      title: 'Scope',
      tag: 'concept',
      heading: 'Step 1: functional requirements and scope',
      eli5: 'Before cooking, decide which dishes are on tonight\'s menu and which are not. The **voters** are the customers, and the menu is short on purpose.',
      body: [
        '**Functional requirements** are the verbs. For QuickPoll: create a poll with up to 10 options, vote once per user per poll, see the results.',
        'State what is out of scope too: no comments, no poll search, no anonymous voting. Also ask which clients exist, web or mobile. A short scope keeps the design honest.',
      ],
      keyIdea: 'List the verbs the system must support, and say out loud which ones you are leaving out.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [{ ...user, status: 'active' }, { ...blackBox, chips: ['create poll', 'vote once', 'see results'] }],
        links: [link('user', 'app')],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'create poll', duration: 1.4 },
          { path: ['user', 'app'], tone: 'request', label: 'vote once', duration: 1.4, delay: 1.5 },
          { path: ['app', 'user'], tone: 'response', label: 'results', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'QuickPoll scope',
          icon: 'List',
          rows: [
            { text: 'Create a poll, up to 10 options', tone: 'good' },
            { text: 'Vote once per user per poll', tone: 'good' },
            { text: 'See the results', tone: 'good' },
            { text: 'Comments', value: 'out', tone: 'muted' },
            { text: 'Poll search', value: 'out', tone: 'muted' },
            { text: 'Anonymous voting', value: 'out', tone: 'muted' },
          ],
        },
        caption: 'Three verbs in, three features out',
      },
    },
    {
      title: 'Five questions',
      tag: 'concept',
      heading: 'Step 1, continued: five questions give the constraints',
      eli5: 'Before cooking, ask: how many guests, do they mostly eat in or take away, must every plate be perfect, how fast, and can we ever close? The **questions** are the checklist taped to the kitchen door.',
      body: [
        'Non-functional requirements come from five questions: **scale**, **read to write ratio**, **consistency**, **latency** and **availability**.',
        'Each answer constrains the next, and together they point at the architecture. The next five steps take them one at a time.',
      ],
      keyIdea: 'Ask about scale, read:write ratio, consistency, latency and availability. The answers are your design constraints.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [
          { id: 'q1', kind: 'block', size: 0.8, at: at(-7.5, 0), label: 'scale', icon: 'Users', tint: 'blue' },
          { id: 'q2', kind: 'block', size: 0.8, at: at(-3.75, 0), label: 'read:write', icon: 'ArrowLeftRight', tint: 'green' },
          { id: 'q3', kind: 'block', size: 0.8, at: at(0, 0), label: 'consistency', icon: 'Scale', tint: 'violet' },
          { id: 'q4', kind: 'block', size: 0.8, at: at(3.75, 0), label: 'latency', icon: 'Timer', tint: 'amber' },
          { id: 'q5', kind: 'block', size: 0.8, at: at(7.5, 0), label: 'availability', icon: 'Shield', tint: 'red' },
        ],
        links: [link('q1', 'q2'), link('q2', 'q3'), link('q3', 'q4'), link('q4', 'q5')],
        panel: {
          title: 'What each answer decides',
          icon: 'Table',
          rows: [
            { text: 'Scale', value: 'how many boxes' },
            { text: 'Read:write', value: 'replicate or shard' },
            { text: 'Consistency', value: 'sync or async, cache or not' },
            { text: 'Latency', value: 'how many hops' },
            { text: 'Availability', value: 'how much redundancy' },
          ],
        },
        caption: 'Five questions before any box',
      },
    },
    {
      title: 'Scale tiers',
      tag: 'concept',
      heading: 'Question 1: how big is it?',
      eli5: 'A lemonade stand needs one table. A town fair needs several stalls. A world cup needs stadiums in many cities. The **tier** tells you which one you are building.',
      body: [
        '**Scale** means daily users, requests per second and data size. Under 1K QPS is one box. From 1K to 100K QPS needs replicas and sharding. Over 100K QPS means multiple regions.',
        'QuickPoll has 10 million daily users, about 4,500 requests a second at peak. That is the middle tier. Treat the tier as a starting guess, because data size also decides. Here a cache absorbs the reads and 730 GB fits one machine, so replicas for load and shards are deferred until the 10x case.',
      ],
      keyIdea: 'Rough QPS and data size put you in a tier, and the tier tells you how much machinery to expect.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      metricTones: {},
      scene: {
        nodes: [
          { id: 'small', kind: 'block', at: at(-4.5, 0), label: 'small', sub: '< 1K QPS', icon: 'Server', tint: 'green' },
          { id: 'medium', kind: 'block', at: at(0, 0), label: 'medium', sub: '1K to 100K', icon: 'Layers', tint: 'amber', status: 'active', badge: 'QuickPoll is here' },
          { id: 'large', kind: 'block', at: at(4.5, 0), label: 'large', sub: '> 100K QPS', icon: 'Globe', tint: 'red' },
        ],
        links: [link('small', 'medium'), link('medium', 'large')],
        panel: {
          title: 'What each tier looks like',
          icon: 'Table',
          rows: [
            { text: 'Small', value: 'one box' },
            { text: 'Medium', value: 'replicas and shards', tone: 'warn' },
            { text: 'Large', value: 'multi-region' },
          ],
          footer: { text: '10M daily users: about 4,500 req/s at peak', tone: 'muted' },
        },
        caption: 'Size decides how much machinery',
      },
    },
    {
      title: 'Read:write',
      tag: 'concept',
      heading: 'Question 2: more reads or more writes?',
      eli5: 'If most guests only look at the menu board, put up more boards. If most guests hand in orders, hire more order-takers. The **cook** needs to know which crowd is coming.',
      body: [
        'The **read to write ratio** is the biggest architecture-shaping number after scale. Read-heavy, above 10:1, means replicate and cache. Write-heavy, below 3:1, means shard. Balanced means both.',
        'QuickPoll sees about 3 views per vote, so both paths matter. The ratio is a first guess too. A cache absorbs the reads and the data fits one machine, so the final design needs no sharding and uses its replica only for failover.',
      ],
      keyIdea: 'Read-heavy systems replicate and cache. Write-heavy systems shard. Balanced ones need both.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [
          { id: 'lever_read', kind: 'block', at: at(-4.5, -3), label: 'replicate + cache', sub: 'read-heavy', icon: 'Copy', tint: 'green' },
          { ...blackBox, at: at(0, 0), badge: 'about 3 reads per vote' },
          { id: 'lever_write', kind: 'block', at: at(4.5, 3), label: 'shard', sub: 'write-heavy', icon: 'Split', tint: 'amber' },
        ],
        links: [link('app', 'lever_read'), link('app', 'lever_write')],
        panel: {
          title: 'Ratio and what it implies',
          icon: 'Table',
          rows: [
            { text: '1000:1 news page', value: 'CDN + cache' },
            { text: '100:1 social feed', value: 'precomputed feeds, replicas' },
            { text: '10:1 shop browsing', value: 'cache hot items' },
            { text: '1:1 chat', value: 'partitioning matters' },
            { text: '1:10 telemetry', value: 'write-optimized store' },
          ],
        },
        caption: 'The ratio picks the first lever',
      },
    },
    {
      title: 'Consistency',
      tag: 'concept',
      heading: 'Question 3: how fresh must a read be?',
      eli5: 'Some answers must be perfect, like how much money is in the till. Others can be a minute old, like how many pizzas were sold today. The **ladder** says how fresh each one needs to be.',
      body: [
        'Consistency is a ladder. **Strong**: every read sees the latest write. **Read-your-writes**: you see your own edits. **Monotonic reads**: time never goes backward. **Eventual**: replicas converge if writes stop.',
        'Pick the weakest rung you can get away with. Strong reads can cost many times the latency, especially across regions, and break first in a partition. Ask whether you need strong globally or only within a region. Spend it only where a wrong answer costs money.',
      ],
      keyIdea: 'Pick the weakest consistency that is still correct, and confine strong consistency to the few operations that need it.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [
          { id: 'c1', kind: 'block', size: 0.8, at: at(-5.6, 0), label: 'strong', icon: 'Shield', tint: 'red' },
          { id: 'c2', kind: 'block', size: 0.8, at: at(-1.9, 0), label: 'read-your-writes', icon: 'User', tint: 'amber' },
          { id: 'c3', kind: 'block', size: 0.8, at: at(1.9, 0), label: 'monotonic', icon: 'TrendingUp', tint: 'teal' },
          { id: 'c4', kind: 'block', size: 0.8, at: at(5.6, 0), label: 'eventual', icon: 'Copy', tint: 'green' },
        ],
        links: [link('c1', 'c2'), link('c2', 'c3'), link('c3', 'c4')],
        panel: {
          title: 'Where each rung fits',
          icon: 'Table',
          rows: [
            { text: 'Strong', value: 'balances, inventory' },
            { text: 'Read-your-writes', value: 'profile edits' },
            { text: 'Monotonic', value: 'feed scrolling' },
            { text: 'Eventual', value: 'likes, view counts' },
          ],
          footer: { text: 'QuickPoll: exact votes, eventual counts', tone: 'good' },
        },
        caption: 'Cheaper and faster as you go right',
      },
    },
    {
      title: 'Latency',
      tag: 'concept',
      heading: 'Question 4: how fast must it answer?',
      eli5: 'A guest at the counter wants a slice in a minute. A guest who ordered a cake for Saturday can wait. The **speed limit** tells the kitchen how many steps it may take.',
      body: [
        'The **latency** target sets how many hops you can afford. Ask for p99, not the average, because the slowest 1% are the requests users remember.',
        'Under 50 ms p99, stay in-region and cache hot paths. Under 300 ms allows one cross-region hop. Over 1 s, queues are fine. QuickPoll asks for p99 under 200 ms.',
      ],
      keyIdea: 'A p99 target decides how many network hops and cache layers fit in a request.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'p99 < 200 ms', tone: 'good' }] },
          { ...blackBox, at: at(0, 0) },
          { ...cache, at: at(6, 0) },
        ],
        links: [link('user', 'app', { label: '200 ms budget' }), link('app', 'cache', { label: 'about 1 ms' })],
        flows: [
          { path: ['user', 'app', 'cache'], tone: 'request', duration: 2 },
          { path: ['cache', 'app', 'user'], tone: 'response', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Target and what it allows',
          icon: 'Timer',
          rows: [
            { text: '< 50 ms p99', value: 'in-region, cache hot paths' },
            { text: '< 300 ms', value: 'one cross-region hop' },
            { text: '> 1 s', value: 'queues are fine' },
          ],
        },
        caption: 'The budget is spent hop by hop',
      },
    },
    {
      title: 'Availability',
      tag: 'concept',
      heading: 'Question 5: how much downtime is allowed?',
      eli5: 'A shop open every day needs a spare cook in case one gets sick. The more days a year it may never close, the more spare cooks it needs. The **spare** is the second server.',
      body: [
        '**Availability** is a number of nines. 99% allows 3.6 days of downtime a year. 99.9% allows 8.8 hours. 99.99% allows 52 minutes. 99.999% allows about 5 minutes.',
        'Each nine changes the design. 99.9% needs more than one server and automatic failover. QuickPoll targets 99.9%.',
      ],
      keyIdea: 'Each extra nine buys less downtime and adds redundancy: spare servers, zones, regions.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [
          lb,
          { ...app, at: at(-1.9, -3), label: 'server A', status: 'ok' },
          { ...app, id: 'app2', at: at(1.9, 3), label: 'server B', status: 'down', badge: 'one fails' },
        ],
        links: [link('lb', 'app'), link('lb', 'app2', { style: 'dashed' })],
        flows: [{ path: ['lb', 'app'], tone: 'request', count: 3, duration: 1.6 }],
        panel: {
          title: 'Nines and what they need',
          icon: 'Shield',
          rows: [
            { text: '99%', value: 'single region, basic HA' },
            { text: '99.9%', value: 'multi-AZ, auto failover', tone: 'good' },
            { text: '99.99%', value: 'multi-region, tested failover' },
            { text: '99.999%', value: 'active-active, no single control plane' },
          ],
        },
        caption: 'Server B fails and traffic keeps flowing',
      },
    },
    {
      title: 'Our answers',
      tag: 'case',
      heading: 'QuickPoll answers the five questions',
      eli5: 'Now the shop owner says it out loud: ten thousand guests a day, they mostly look, a wrong total is not a disaster but a double vote is, and it must answer fast. The **voters** nod.',
      body: [
        'Say the answers out loud and get agreement. Each one removes options: "counts may lag" permits caching and asynchronous counting, and "exactly one vote" demands a uniqueness check somewhere durable.',
        'A wrong assumption here costs the rest of the hour.',
      ],
      keyIdea: 'State your answers, get agreement, and treat them as the contract for every later choice.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [{ ...user, status: 'active', sub: '10M daily' }, { ...blackBox, badge: 'p99 < 200 ms · 99.9%' }],
        links: [link('user', 'app')],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'vote once', duration: 1.4 },
          { path: ['app', 'user'], tone: 'response', label: 'results', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Agreed constraints',
          icon: 'Table',
          rows: [
            { text: 'Scale', value: '10M daily users' },
            { text: 'Read:write', value: 'about 3 : 1' },
            { text: 'Consistency', value: 'one vote exact, counts may lag', tone: 'warn' },
            { text: 'Latency', value: 'p99 < 200 ms' },
            { text: 'Availability', value: '99.9%' },
          ],
        },
        caption: 'Five answers, agreed out loud',
      },
      quiz: {
        question: 'You are asked to design a photo-sharing app. What should you do first?',
        options: [
          'Draw a CDN, object storage and a sharded database, since photo apps need them',
          'Pick the database, because everything depends on storage',
          'Ask what it must do and pin down scale, read:write ratio, consistency, latency and availability',
          'Start with the hardest part, such as the feed ranking',
        ],
        answer: 2,
        explain: 'Requirements come first. They decide what to count, the counts decide which boxes you need, and only then can you tell which part is the hard one.',
      },
    },
    {
      title: 'Traffic',
      tag: 'concept',
      heading: 'Step 2: turn users into requests per second',
      eli5: 'Count before you buy ovens. If 100 people each eat two slices at dinner time, you know how many pizzas per hour the **kitchen** must bake.',
      body: [
        '10 million daily users, each viewing 10 polls and voting on 3. That is 100 million views and 30 million votes a day.',
        'A day has 86,400 seconds, so the average is about **1,160 reads/s** and **350 votes/s**.',
      ],
      keyIdea: 'Rough numbers are enough. They tell you which parts need more than one machine and which do not.',
      metrics: { stage: '2 of 6', reads: '1,160/s avg', votes: '350/s avg', boxes: '1' },
      scene: {
        nodes: [{ ...user, sub: '10M daily' }, { ...blackBox, status: 'active', chips: ['1,160 reads/s', '350 votes/s'] }],
        links: [link('user', 'app')],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'views', count: 6, duration: 1.2 },
          { path: ['user', 'app'], tone: 'event', label: 'votes', count: 2, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Per day, then per second',
          icon: 'Table',
          rows: [
            { text: '10M users × 10 views', value: '100M reads' },
            { text: '10M users × 3 votes', value: '30M votes' },
            { text: '÷ 86,400 seconds', value: '1,160 + 350 /s' },
          ],
        },
        caption: 'Now the black box has a load on it',
      },
      code: {
        language: 'python',
        title: 'Napkin math: average load',
        source: `DAU = 10_000_000
VIEWS_PER_USER, VOTES_PER_USER = 10, 3
DAY = 86_400                                 # seconds

read_qps = DAU * VIEWS_PER_USER / DAY        # ~1,160/s average
vote_qps = DAU * VOTES_PER_USER / DAY        # ~350/s average`,
        highlight: [5, 6],
      },
    },
    {
      title: 'Peak and viral',
      tag: 'concept',
      heading: 'Averages hide the hard case',
      eli5: 'The shop is calm most of the day and swamped at lunch. One day a singer tells all fans to order the same pizza. The **kitchen** must survive the swamp, not the quiet.',
      body: [
        'Peak is roughly 3 times the average: **3,500 reads/s** and **1,000 votes/s**.',
        'Then ask for the worst single case. A celebrity shares one poll and it alone takes **5,000 votes/s** for a few minutes, on top of the normal peak. Total: about 8,500 requests a second. Write that number down. It will matter later.',
      ],
      keyIdea: 'Design for peak, then find the single worst-case number and write it down.',
      metrics: { stage: '2 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '1' },
      metricTones: { votes: 'warn' },
      scene: {
        nodes: [
          user,
          { ...blackBox, status: 'active', chips: ['3,500 reads/s', { text: '1,000 votes/s', tone: 'warn' }] },
          { id: 'viral', kind: 'block', at: at(5, -3), label: 'viral poll', sub: 'one celebrity share', icon: 'Zap', tint: 'red', chips: [{ text: '5,000 votes/s', tone: 'bad' }] },
        ],
        links: [link('user', 'app'), link('viral', 'app')],
        flows: [{ path: ['viral', 'app'], tone: 'event', label: 'votes', count: 6, duration: 1.2 }],
        panel: {
          title: 'Load shapes',
          icon: 'TrendingUp',
          rows: [
            { text: 'Average', value: '1,160 r/s · 350 v/s' },
            { text: 'Peak (3x)', value: '3,500 r/s · 1,000 v/s', tone: 'warn' },
            { text: 'One viral poll', value: '5,000 v/s', tone: 'bad' },
          ],
        },
        caption: 'The viral poll is the number to remember',
      },
      code: {
        language: 'python',
        title: 'Napkin math: peak and the worst case',
        source: `peak_reads = read_qps * 3                    # ~3,500/s
peak_votes = vote_qps * 3                    # ~1,000/s
viral_poll = 5_000                           # votes/s on ONE poll
worst_total = peak_reads + peak_votes + viral_poll   # ~8,500 req/s`,
        highlight: [1, 2, 3, 4],
      },
    },
    {
      title: 'Storage',
      tag: 'concept',
      heading: 'How much data piles up',
      eli5: 'Check the fridge before you stock it. A slip of paper for each order and a recipe card for each new dish add up to a small box a day. The **database** is that filing room.',
      body: [
        'A vote is about 50 bytes and a poll about 1 KB. With 30 million votes and 500,000 new polls a day that is roughly 2 GB a day, 730 GB a year.',
        'That fits on one database machine for a while, so sharding is not needed on day one.',
      ],
      keyIdea: 'Multiply object size by count per day, then by 365. If one machine holds it, do not shard yet.',
      metrics: { stage: '2 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '2' },
      scene: {
        nodes: [{ ...app, at: at(-3, 0) }, { ...db, at: at(3, 0), status: 'ok', badge: '730 GB per year' }],
        links: [link('app', 'db')],
        flows: [{ path: ['app', 'db'], tone: 'data', label: '50 B per vote', duration: 1.6 }],
        panel: {
          title: 'Storage per day',
          icon: 'HardDrive',
          rows: [
            { text: '30M votes × 50 B', value: '1.5 GB' },
            { text: '500K polls × 1 KB', value: '0.5 GB' },
            { text: 'Per day', value: '2 GB' },
            { text: 'Per year', value: '730 GB', tone: 'good' },
          ],
          footer: { text: 'One machine is enough for now', tone: 'good' },
        },
        caption: 'Small enough for one database',
      },
      code: {
        language: 'python',
        title: 'Napkin math: storage',
        source: `POLLS_PER_DAY = 500_000
VOTE_BYTES, POLL_BYTES = 50, 1_000
per_day = DAU * VOTES_PER_USER * VOTE_BYTES + POLLS_PER_DAY * POLL_BYTES   # 2 GB
per_year = per_day * 365                                                   # 730 GB`,
        highlight: [3, 4],
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Step 3a: write the API before the boxes',
      eli5: 'Write the menu before building the kitchen. The menu says what a customer can ask for and what they get back. The **poll API** is the counter where orders are taken.',
      body: [
        'The API is the contract between clients and the system. Each functional requirement becomes a call, and questions surface early: who is the voter, what happens on a second vote, are results paginated?',
        'QuickPoll needs four endpoints. The vote takes the user from the auth token, never the request body, or anyone could vote as anyone.',
      ],
      keyIdea: 'A short list of endpoints pins down exactly what the system does and which calls carry the load.',
      metrics: { stage: '3 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '1' },
      scene: {
        nodes: [user, { ...app, status: 'active', chips: ['POST /votes', 'GET /results'] }],
        links: [link('user', 'app')],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'POST /votes', duration: 1.3 },
          { path: ['app', 'user'], tone: 'response', label: '200 or 409', duration: 1.3, delay: 1.4 },
          { path: ['user', 'app'], tone: 'request', label: 'GET /results', duration: 1.3, delay: 2.8 },
          { path: ['app', 'user'], tone: 'response', label: '{counts}', duration: 1.3, delay: 4.2 },
        ],
        panel: {
          title: 'Endpoints and their load',
          icon: 'Network',
          rows: [
            { text: 'POST /polls', value: 'about 6/s' },
            { text: 'GET /polls/{id}', value: 'light' },
            { text: 'POST /votes', value: '1,000/s, 5,000/s viral', tone: 'warn' },
            { text: 'GET /results', value: '3,500/s', tone: 'warn' },
          ],
          footer: { text: 'These two calls will shape the design', tone: 'muted' },
        },
        caption: 'The black box gets a front door',
      },
      code: {
        language: 'bash',
        title: 'QuickPoll API sketch',
        source: `# Create a poll (about 6/s)
POST /v1/polls                    {question, options[]}   -> 201 {poll_id, share_url}

# Read a poll's question and options
GET  /v1/polls/{poll_id}                                  -> 200 {question, options[], closes_at}

# Cast a vote. The user comes from the auth token. (1,000/s peak, 5,000/s viral)
POST /v1/polls/{poll_id}/votes    {option_id}             -> 200 {ok} | 409 already voted

# Read the tally (3,500/s peak)
GET  /v1/polls/{poll_id}/results                          -> 200 {counts: {option_id: n}, as_of}`,
        highlight: [8, 11],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Step 3b: decide what is stored and how it is looked up',
      eli5: 'Plan the shelves: one for the recipes, one for the list of who already got a free slice. Label them so the cook finds things fast. The **database** is the shelf room.',
      body: [
        'A **poll** has options. A **vote** links a user, a poll and an option. Every call arrives with a `poll_id`, so every lookup is by key. SQL fits: relational data and 730 GB a year.',
        '"One vote per user per poll" becomes a primary key on `(poll_id, user_id)`: the database rejects a duplicate whatever the app does. A `vote_count` column makes results cheap. Remember it, it becomes the hot spot.',
      ],
      keyIdea: 'Design tables from the access patterns in the API, and let the database enforce the rules that must never break.',
      metrics: { stage: '3 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '2' },
      scene: {
        nodes: [user, app, { ...db, status: 'active', badge: 'PK (poll_id, user_id)' }],
        links: [link('user', 'app'), link('app', 'db')],
        flows: [
          { path: ['user', 'app', 'db'], tone: 'request', label: 'INSERT vote', duration: 1.8 },
          { path: ['db', 'app', 'user'], tone: 'response', label: 'ok', duration: 1.8, delay: 1.9 },
          { path: ['user', 'app', 'db'], tone: 'request', label: 'same vote again', duration: 1.8, delay: 3.8 },
          { path: ['db', 'app', 'user'], tone: 'error', label: '409 duplicate', duration: 1.8, delay: 5.7 },
        ],
        panel: {
          title: 'Tables and keys',
          icon: 'Table',
          rows: [
            { text: 'polls', value: 'PK poll_id' },
            { text: 'options', value: 'PK option_id, vote_count' },
            { text: 'votes', value: 'PK (poll_id, user_id)', tone: 'good' },
          ],
          footer: { text: 'The schema enforces one vote per user', tone: 'good' },
        },
        caption: 'The schema enforces one vote per user',
      },
      code: {
        language: 'sql',
        title: 'QuickPoll tables',
        source: `CREATE TABLE polls (
  poll_id    BIGINT PRIMARY KEY,
  owner_id   BIGINT NOT NULL,
  question   TEXT NOT NULL,
  closes_at  TIMESTAMPTZ
);

CREATE TABLE options (
  option_id  BIGINT PRIMARY KEY,
  poll_id    BIGINT NOT NULL REFERENCES polls,
  label      TEXT NOT NULL,
  vote_count BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE votes (
  poll_id    BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  option_id  BIGINT NOT NULL,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)        -- one vote per user per poll
);`,
        highlight: [12, 20],
      },
    },
    {
      title: 'High-level design',
      tag: 'concept',
      heading: 'Step 4: the simplest design that meets the numbers',
      eli5: 'Now sketch the kitchen: a host at the door, a few cooks, a shelf room, and a scoreboard on the wall so nobody counts orders twice. Every **box** is there because a number asked for it.',
      body: [
        'Draw only what the numbers call for. At about 1,000 req/s per server, 4,500 at peak needs 5 servers plus 1 spare, so a **load balancer** in front of 6 stateless API servers. 99.9% forbids a single one anyway.',
        'Results may lag, so a **cache** holds each poll\'s counts for 1 second. One **SQL database** stores polls and votes. Cache size and bandwidth stay small (see the math).',
      ],
      keyIdea: 'Each box should trace back to a requirement or a number. If it does not, leave it out for now.',
      metrics: { stage: '4 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '4' },
      metricTones: { boxes: 'good' },
      scene: {
        nodes: [
          user,
          { ...lb, status: 'ok' },
          { ...app, status: 'ok', sub: '6 servers', load: 75 },
          { ...cache, status: 'ok', badge: 'TTL 1 s' },
          { ...db, status: 'ok' },
        ],
        links: simpleLinks,
        flows: [
          { path: ['user', 'lb', 'app', 'cache'], tone: 'request', label: 'GET results', count: 3, duration: 1.8 },
          { path: ['cache', 'app', 'lb', 'user'], tone: 'response', count: 3, duration: 1.8, delay: 1.9 },
          { path: ['user', 'lb', 'app', 'db'], tone: 'event', label: 'POST vote', duration: 2, delay: 3.8 },
        ],
        panel: {
          title: 'Why each box exists',
          icon: 'Boxes',
          rows: [
            { text: 'Load balancer', value: '99.9% needs > 1 server' },
            { text: '6 API servers', value: '4,500 / 1,000 = 5, +1 spare' },
            { text: 'Cache, TTL 1 s', value: 'counts may lag' },
            { text: 'SQL database', value: 'uniqueness, 730 GB a year' },
          ],
        },
        caption: 'Four boxes, each with a reason',
      },
      code: {
        language: 'python',
        title: 'Napkin math: servers, cache, bandwidth',
        source: `peak_qps = peak_reads + peak_votes            # ~4,500 req/s (viral case: deep dive)
PER_SERVER = 1_000                            # assumed req/s per app server
servers = -(-peak_qps // PER_SERVER) + 1      # ceil(4.5) = 5, plus 1 spare = 6

cache_bytes = 100_000 * 200                   # hot polls x ~200 B = ~20 MB
bandwidth = peak_reads * 1_000                # ~3.5 MB/s, not a constraint`,
        highlight: [2, 3],
      },
    },
    {
      title: 'Walkthrough',
      tag: 'concept',
      heading: 'Walk one request of each type through the diagram',
      eli5: 'Trace one guest through the shop with your finger: door, host, cook, shelf, table. If you cannot trace a path for every kind of guest, something is missing.',
      body: [
        'Walk one read and one write, out loud. Every endpoint needs a path and every box needs a reason.',
        'Concrete cases expose edge cases: a cache miss reads the database and refills the cache, and a second vote returns `409`. Resist adding anything else yet.',
      ],
      keyIdea: 'If every endpoint has a path and every box has a reason, the high-level design is done.',
      metrics: { stage: '4 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '4' },
      scene: {
        nodes: [
          user,
          { ...lb, status: 'ok' },
          { ...app, status: 'active', sub: '6 servers' },
          { ...cache, status: 'ok', chips: [{ text: 'hit', tone: 'good' }] },
          { ...db, status: 'ok', chips: ['INSERT vote'] },
        ],
        links: simpleLinks,
        flows: [
          { path: ['user', 'lb', 'app', 'cache', 'app', 'lb', 'user'], tone: 'request', label: 'GET results', duration: 3 },
          { path: ['user', 'lb', 'app', 'db', 'app', 'lb', 'user'], tone: 'event', label: 'POST vote', duration: 3, delay: 3.2 },
        ],
        panel: {
          title: 'Two paths, spoken aloud',
          icon: 'Route',
          code: 'GET  /results -> lb -> app -> cache (hit)\n                              -> db   (miss, refill)\nPOST /votes   -> lb -> app -> db\n                 INSERT vote, vote_count + 1\n                 duplicate -> 409',
        },
        caption: 'One read path and one write path',
      },
    },
    {
      title: 'Hot poll',
      tag: 'case',
      heading: 'Step 5: find where the simple design breaks',
      eli5: 'A famous singer tells everyone to order the same pizza. All the cooks reach for the one order book at once, and only one hand can write in it at a time. The **database** is that order book.',
      body: [
        'Replay the worst number from step 2: one poll taking **5,000 votes per second**, on top of the normal peak, so about 8,500 requests a second in total. That is above the 6,000 the six servers can take, so the API tier saturates too. Every vote runs `UPDATE options SET vote_count = vote_count + 1` on the same row.',
        'One transaction changes a row at a time. At about 1 ms per commit, that row tops out near 1,000 updates a second. 5,000 arrive, connections pile up and every other poll slows down too.',
      ],
      keyIdea: 'Push your worst-case number through the simple design. Where it jams is where the deep dive belongs.',
      metrics: { stage: '5 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '4' },
      metricTones: { votes: 'bad' },
      scene: {
        nodes: [
          { ...user, status: 'hot', badge: 'viral poll' },
          lb,
          { ...app, status: 'hot', sub: '6 servers', load: 100, badge: '8,500 req/s vs 6,000' },
          { ...db, status: 'hot', load: 100, badge: '1 row, 5,000 writers' },
        ],
        links: [link('user', 'lb'), link('lb', 'app'), link('app', 'db', { label: 'one row lock', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'lb', 'app'], tone: 'event', label: 'POST vote', count: 8, duration: 1.2 },
          { path: ['app', 'db'], tone: 'event', label: 'count + 1', count: 8, duration: 1.4, delay: 1.2 },
          { path: ['db', 'app', 'lb', 'user'], tone: 'error', label: 'timeout', count: 3, duration: 2.4, delay: 2.8 },
        ],
        panel: {
          title: 'One row, two numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Row ceiling', value: '~1,000 updates/s' },
            { text: 'Votes arriving', value: '5,000/s', tone: 'bad' },
            { text: 'More API servers', value: 'no help', tone: 'bad' },
            { text: 'Sharding', value: 'no help, same row', tone: 'bad' },
          ],
          footer: { text: 'Spend the deep dive here, skip the routine parts', tone: 'warn' },
        },
        caption: 'Every vote fights for the same row lock',
      },
    },
    {
      title: 'Deep dive',
      tag: 'concept',
      heading: 'Step 5, continued: fix the hard part, and only that',
      eli5: 'Instead of every cook grabbing the order book, they drop tickets in a tray. One helper takes a handful of tickets at a time and writes the total in the book once. The **vote queue** is the tray.',
      body: [
        'The API dedupes with Redis `SET voted:{poll}:{user} NX`, enqueues the vote and replies `202 {accepted}`. The `409` now comes from the `SET NX`. If the enqueue fails, the API deletes the key and returns `503`.',
        'The queue is a durable log, so `202` means queued, not counted. **Batch workers** insert 1,000 votes with `ON CONFLICT DO NOTHING` and count only inserted rows, so replays are safe.',
      ],
      keyIdea: 'A deep dive changes the one path that broke. Here: queue the votes, count in batches, serve results from the cache.',
      metrics: { stage: '5 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '6' },
      metricTones: { votes: 'warn', boxes: 'good' },
      scene: {
        nodes: [
          { ...app, sub: '6 servers', badge: '202 in 5 ms' },
          { ...cache, status: 'active', badge: 'dedupe + counts' },
          { ...queue, status: 'active', badge: '5,000 votes/s in' },
          { ...worker, status: 'active', badge: 'batches of 1,000' },
          { ...db, status: 'ok', badge: '5 updates/s' },
        ],
        links: [link('app', 'cache'), link('app', 'queue'), link('queue', 'worker'), link('worker', 'db'), link('worker', 'cache', { style: 'dashed' })],
        flows: [
          { path: ['app', 'cache', 'app'], tone: 'handshake', label: 'SET NX', duration: 1, delay: 0 },
          { path: ['app', 'queue'], tone: 'event', count: 6, duration: 1, delay: 1 },
          { path: ['queue', 'worker', 'db'], tone: 'data', label: '1 batch', duration: 1.6, delay: 2 },
          { path: ['worker', 'cache'], tone: 'data', label: 'counts', duration: 1.2, delay: 3.6 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Gauge',
          rows: [
            { text: 'Row updates', value: '5,000/s to 5/s', tone: 'good' },
            { text: 'Vote reply', value: '202 in about 5 ms', tone: 'good' },
            { text: 'Duplicate vote', value: '409 from Redis NX', tone: 'good' },
            { text: 'Enqueue fails', value: 'delete key, 503', tone: 'warn' },
            { text: 'Counts lag', value: 'about 1 s', tone: 'warn' },
            { text: 'New boxes', value: '2: queue, workers' },
          ],
        },
        caption: 'Votes are queued, then counted in batches',
      },
      code: {
        language: 'sql',
        title: 'Worker batch: exact counts, safe to replay',
        source: `BEGIN;
WITH ins AS (
  INSERT INTO votes (poll_id, user_id, option_id)
  VALUES ($1, $2, $3), ...                -- up to 1,000 queued votes
  ON CONFLICT DO NOTHING
  RETURNING option_id
)
UPDATE options o
SET vote_count = o.vote_count + c.n
FROM (SELECT option_id, count(*) AS n FROM ins GROUP BY option_id) c
WHERE o.option_id = c.option_id;
COMMIT;                                   -- then ack the batch on the queue`,
        highlight: [4, 6, 9],
      },
      quiz: {
        question: 'Why does sharding the database by poll_id not fix the viral poll?',
        options: [
          'A shard cannot hold 730 GB',
          'All 5,000 votes a second still land on the same row, on the same shard',
          'Sharding needs a cache in front of it first',
          'Shard keys must always be user ids',
        ],
        answer: 1,
        explain: 'Sharding spreads different polls across machines, but one poll is one row on one shard. The fix has to reduce the updates to that row, which is what queueing and batching do.',
      },
    },
    {
      title: 'Failures',
      tag: 'tradeoff',
      heading: 'Step 6: what can fail, and how you will know',
      eli5: 'Before opening night, ask: what if the oven breaks, or the tray of tickets spills? A spare **replica** oven stands ready in the corner, and the tickets wait safely in the tray.',
      body: [
        'The database is one machine against a 99.9% target, so add a **replica** with automatic failover. If Redis is lost, rebuild counts from the database.',
        'The queue is replicated across zones and a crashed worker\'s batch is retried safely. Run the load balancer as an active pair or multi-AZ, and alert on queue depth, errors and p99.',
      ],
      keyIdea: 'Find every single point of failure, say how the design survives it, and name the alerts that would tell you.',
      metrics: { stage: '6 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '7' },
      metricTones: { boxes: 'good' },
      scene: {
        nodes: [
          { ...queue, badge: 'holding votes' },
          worker,
          { ...db, status: 'down', badge: 'primary fails' },
          { ...replica, status: 'active', badge: 'promoted' },
        ],
        links: [link('queue', 'worker'), link('worker', 'db'), link('db', 'replica', { style: 'dashed', label: 'replicate' }), link('worker', 'replica')],
        flows: [
          { path: ['queue', 'worker', 'db'], tone: 'error', label: 'primary down', duration: 1.6 },
          { path: ['queue', 'worker', 'replica'], tone: 'data', label: 'retry on new primary', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Failure and the answer',
          icon: 'Shield',
          rows: [
            { text: 'Database dies', value: 'replica takes over', tone: 'good' },
            { text: 'Redis lost', value: 'replica, or rebuild from DB', tone: 'good' },
            { text: 'Queue backs up', value: 'results stale, votes safe', tone: 'warn' },
            { text: 'Worker crashes', value: 'batch retried, no double count', tone: 'good' },
            { text: 'Load balancer', value: 'active pair or multi-AZ', tone: 'good' },
            { text: 'Queue itself', value: 'replicated across zones', tone: 'good' },
          ],
          footer: { text: 'Alert on queue depth, errors, p99', tone: 'muted' },
        },
        caption: 'The queue holds votes while the database fails over',
      },
    },
    {
      title: 'Trade-offs',
      tag: 'tradeoff',
      heading: 'Step 6, continued: say what you gave up and what breaks next',
      eli5: 'Opening on time meant skipping a few things: guests get a ticket before their pizza is baked, and the scoreboard runs a second behind. The **second kitchen** waits for a bigger crowd.',
      body: [
        'A voter gets `202` once the vote is durably queued but before it is counted, and results trail by about a second. That matches the stated consistency requirement, so say so.',
        'At 10 times the scale, 7 TB a year no longer fits one database, and votes would be sharded by `poll_id`. Name it and move on. A design is finished when the remaining risks are stated.',
      ],
      keyIdea: 'Close by naming the trade-offs you accepted and the next thing that breaks at 10x.',
      metrics: { stage: '6 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '7' },
      metricTones: { votes: 'warn' },
      scene: {
        nodes: [
          { ...queue, badge: 'lag ~1 s' },
          worker,
          { ...db, kind: 'shard', label: 'shard A', sub: 'poll_id range', at: at(7.5, -2.5), status: 'active' },
          { id: 'db2', kind: 'shard', at: at(7.5, 3.5), label: 'shard B', sub: 'poll_id range', status: 'active' },
        ],
        links: [link('queue', 'worker'), link('worker', 'db'), link('worker', 'db2')],
        flows: [
          { path: ['queue', 'worker', 'db'], tone: 'data', label: 'poll 1', duration: 1.6 },
          { path: ['queue', 'worker', 'db2'], tone: 'data', label: 'poll 2', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Given up, and next at 10x',
          icon: 'Scale',
          rows: [
            { text: 'Vote reply', value: 'accepted before counted', tone: 'warn' },
            { text: 'Results', value: 'trail by about 1 s', tone: 'warn' },
            { text: 'Duplicate votes', value: 'still exact', tone: 'good' },
            { text: 'At 10x', value: '7 TB/yr, shard by poll_id' },
          ],
        },
        caption: 'Accepted lag now, shards at 10 times the load',
      },
    },
    {
      title: 'Time split',
      tag: 'concept',
      heading: 'Spend the 45 minutes on purpose',
      eli5: 'A cook with 45 minutes does not spend 40 of them chopping one onion. Ask, count, plan, then spend the rest on the part most likely to burn. The **reviewer** is watching the clock too.',
      body: [
        'A rough split for 45 minutes: 5 on requirements, 5 on numbers, 10 on API and data, 10 on the high-level design, and 15 on the deep dive and trade-offs.',
        'Design the most critical component first and go deep on one or two. Never say the design is perfect. Say what you would do with more time.',
      ],
      keyIdea: 'Time is a budget. Spend it on the hard part, and skip details that do not show you can scale a system.',
      metrics: { stage: '6 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '7' },
      scene: {
        nodes: [
          { id: 'ask', kind: 'block', at: at(-4.5, 0), label: 'ask + count', sub: '10 min', icon: 'Search', tint: 'blue' },
          { id: 'draw', kind: 'block', at: at(0, 0), label: 'draw', sub: '20 min', icon: 'Boxes', tint: 'violet' },
          { id: 'defend', kind: 'block', at: at(4.5, 0), label: 'dive + defend', sub: '15 min', icon: 'Shield', tint: 'amber', status: 'active' },
        ],
        links: [link('ask', 'draw'), link('draw', 'defend')],
        panel: {
          title: 'A 45-minute budget',
          icon: 'Clock',
          rows: [
            { text: 'Requirements', value: '5 min' },
            { text: 'Numbers', value: '5 min' },
            { text: 'API and data model', value: '10 min' },
            { text: 'High-level design', value: '10 min' },
            { text: 'Deep dive and trade-offs', value: '15 min', tone: 'good' },
          ],
        },
        caption: 'Most of the clock goes to the hard part',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Same six steps, every design',
      eli5: 'Ask, count, write the menu, plan the shelves, sketch the kitchen, fix the busiest spot, and plan for a broken oven. Do it in that order and every **box** in the kitchen has a job.',
      body: [
        '**Clarify** with the five questions. **Estimate** the load, including the worst single case. Write the **API** and **data model**. Draw the **simplest design**. **Deep dive** where it breaks. Finish with **failures and trade-offs**.',
        'QuickPoll went from one black box to seven boxes, and each one points back to a requirement or a number. Every whole-system lesson later in the course follows this arc.',
      ],
      keyIdea: 'Requirements and numbers come first, and every box you draw should point back to one of them.',
      metrics: { stage: 'done', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '7' },
      metricTones: { boxes: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'ok', sub: '6 servers' },
          { ...cache, status: 'ok' },
          { ...queue, status: 'ok' },
          { ...worker, status: 'ok' },
          { ...db, status: 'ok' },
        ],
        links: [link('app', 'cache'), link('app', 'queue'), link('queue', 'worker'), link('worker', 'db'), link('worker', 'cache', { style: 'dashed' })],
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'results', count: 3, duration: 1.8 },
          { path: ['app', 'queue', 'worker', 'db'], tone: 'event', label: 'vote', duration: 3, delay: 2 },
        ],
        panel: {
          title: 'Each box and its reason',
          icon: 'Boxes',
          rows: [
            { text: 'Load balancer, 6 servers', value: '99.9%, peak rate' },
            { text: 'Cache', value: 'counts may lag' },
            { text: 'Queue and workers', value: '5,000 votes/s on one row' },
            { text: 'Replica', value: '99.9% survives a failure' },
            { text: 'SQL primary key', value: 'one vote per user' },
          ],
          footer: { text: 'Seven boxes, each traced to a requirement', tone: 'good' },
        },
        caption: 'Seven boxes, each traced to a requirement',
      },
      quiz: {
        question: 'In QuickPoll, which requirement made it acceptable to put votes on a queue and count them in batches?',
        options: [
          'p99 latency under 200 ms',
          'Result counts may lag by a second or two',
          '99.9% availability',
          '10 million daily users',
        ],
        answer: 1,
        explain: 'Asynchronous counting means results trail the votes. That is only allowed because the consistency requirement said counts may lag, while one vote per user stays exact through the primary key.',
      },
    },
  ],
};
