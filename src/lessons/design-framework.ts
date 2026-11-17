import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];

const user: SceneNode = { id: 'user', kind: 'phone', at: p(-7.5, 0), label: 'voters' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: p(-4.5, 0), label: 'load balancer' };
const app: SceneNode = { id: 'app', kind: 'server', at: p(-1.5, 0), label: 'poll API' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: p(1.5, -4), label: 'Redis', sub: 'live results' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: p(1.5, 2.5), label: 'vote queue' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: p(4.5, 2.5), label: 'counters', sub: 'batch workers' };
const replica: SceneNode = { id: 'replica', kind: 'replica', at: p(4.5, -4), label: 'replica' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(7.5, 0), label: 'Postgres', sub: 'polls, votes' };

const blackBox: SceneNode = { ...app, label: 'QuickPoll', sub: 'a black box' };

const simpleLinks: SceneLink[] = [
  { from: 'user', to: 'lb' },
  { from: 'lb', to: 'app' },
  { from: 'app', to: 'cache' },
  { from: 'app', to: 'db' },
];
const fullLinks: SceneLink[] = [
  { from: 'user', to: 'lb' },
  { from: 'lb', to: 'app' },
  { from: 'app', to: 'cache' },
  { from: 'app', to: 'queue' },
  { from: 'queue', to: 'worker' },
  { from: 'worker', to: 'db' },
  { from: 'worker', to: 'cache', style: 'dashed' },
];

export const designFramework: Lesson = {
  id: 'design-framework',
  title: 'A framework for any design',
  tagline: 'Six steps that take you from a one-line prompt to a design you can defend, shown on a small poll app.',
  minutes: 15,
  level: 'Beginner',
  learn: [
    'A repeatable order for any design problem, and why the order matters',
    'The five questions that turn vague requirements into constraints',
    'How scale numbers decide which boxes you need',
    'Why the API and data model come before the architecture diagram',
    'How to find the hard part and spend your time there',
    'How to close with bottlenecks, failure cases and trade-offs',
  ],
  metrics: [
    { key: 'stage', label: 'Step' },
    { key: 'reads', label: 'Peak reads' },
    { key: 'votes', label: 'Peak votes' },
    { key: 'boxes', label: 'Boxes drawn' },
  ],
  steps: [
    {
      title: 'Blank page',
      tag: 'problem',
      heading: '"Design a poll app." Where do you even start?',
      eli5: 'Someone says "open a pizza shop!" and you rush out to buy five ovens and a delivery truck. You never asked how many people are coming or what they want to eat. Those dim **boxes** are the ovens nobody needed yet.',
      body: [
        'The prompt is one line: design **QuickPoll**, an app where people create a poll, share a link and vote. The whiteboard is empty and the clock is running.',
        'The common mistake is to start drawing familiar boxes. A queue, a cache, a few shards, because big systems have them. Ten minutes later there is a busy diagram and no way to say why any box is there or whether it is enough.',
        'Every design in this course follows the same sequence instead. It works in an interview and it works for a real design document, because it forces each box to answer a stated need.',
      ],
      keyIdea: 'A box you cannot trace back to a requirement or a number is a guess. Start with questions, then draw.',
      metrics: { stage: '0 of 6', reads: '?', votes: '?', boxes: '4 guesses' },
      scene: {
        nodes: [
          user,
          { ...cache, status: 'dim', sub: undefined, badge: 'why?' },
          { ...queue, status: 'dim', badge: 'why?' },
          { ...replica, status: 'dim', badge: 'why?' },
          { ...db, status: 'dim', sub: undefined, label: 'shards', kind: 'shard', badge: 'how many?' },
        ],
        links: [
          { from: 'user', to: 'cache', style: 'faint' },
          { from: 'user', to: 'queue', style: 'faint' },
          { from: 'queue', to: 'db', style: 'faint' },
          { from: 'cache', to: 'replica', style: 'faint' },
        ],
        flows: [{ path: ['user', 'queue'], tone: 'error', label: '?', duration: 2 }],
        caption: 'Boxes first, reasons never',
      },
    },
    {
      title: 'Six steps',
      tag: 'concept',
      heading: 'The sequence: six steps, always in this order',
      eli5: 'Opening a pizza shop goes in order: ask who is coming, count the pizzas, write the menu, plan the shelves, sketch the kitchen, then worry about the busiest hour. The **black box** is the shop before we plan it.',
      body: [
        '**1. Clarify requirements.** What it must do and how well. **2. Estimate scale.** Requests per second and storage. **3. Define the API and data model.** What goes in, what comes out, what is stored.',
        '**4. Draw the high-level design.** The simplest set of boxes that serves the API at that scale. **5. Deep dive on the hard part.** The one or two places where the simple design breaks. **6. Bottlenecks and trade-offs.** What fails, what you gave up, what you would do at ten times the load.',
        'The order matters because each step feeds the next. Requirements decide what to count. The counts decide which boxes you need. The API and data model decide what flows between them. Start with a black box and open it one step at a time.',
      ],
      keyIdea: 'Requirements, scale, API and data, high-level design, deep dive, trade-offs. Each step is the input to the next.',
      metrics: { stage: '0 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [user, { ...blackBox, status: 'active', badge: '?' }],
        links: [{ from: 'user', to: 'app' }],
        flows: [
          { path: ['user', 'app'], tone: 'request', duration: 1.4 },
          { path: ['app', 'user'], tone: 'response', duration: 1.4, delay: 1.5 },
        ],
        caption: 'Start with users and one black box',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'Step 1: clarify, with five questions',
      eli5: 'Before cooking, ask: what do people want to eat, how many are coming, do they mostly eat in or order, must every order be perfect, how fast, and can we ever close? The **voters** are the customers we are asking.',
      body: [
        '**Functional requirements** are the verbs. For QuickPoll: create a poll with up to 10 options, vote once per user per poll, see the results. State what is out of scope too: no comments, no poll search, no anonymous voting.',
        '**Non-functional requirements** come from five questions. **Scale?** 10 million daily users. **Read to write ratio?** About 3 views per vote, so both paths matter. **Consistency?** One vote per user must be exact. Result counts may lag a second or two. **Latency?** p99 under 200 ms to vote or view. **Availability?** 99.9%.',
        'Each answer removes options. "Counts may lag" permits caching and asynchronous counting. "Exactly one vote" demands a uniqueness check somewhere durable. Say the answers out loud and get agreement before going on.',
      ],
      keyIdea: 'Ask about scale, read:write ratio, consistency, latency and availability. The answers are your design constraints.',
      metrics: { stage: '1 of 6', reads: '?', votes: '?', boxes: '1' },
      scene: {
        nodes: [{ ...user, status: 'active', sub: '10M daily' }, { ...blackBox, badge: 'p99 < 200 ms · 99.9%' }],
        links: [{ from: 'user', to: 'app' }],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'create poll', duration: 1.4 },
          { path: ['user', 'app'], tone: 'request', label: 'vote once', duration: 1.4, delay: 1.5 },
          { path: ['app', 'user'], tone: 'response', label: 'results', duration: 1.4, delay: 3 },
        ],
        caption: 'Three verbs and five constraints',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: 'Step 2: turn users into requests per second and gigabytes',
      eli5: 'Count before you buy ovens. If 100 people each eat two slices at dinner time, you know how many pizzas per hour the **kitchen** must bake and how big the fridge must be.',
      body: [
        '10 million daily users, each viewing 10 polls and voting on 3. That is 100 million views and 30 million votes a day. A day has 86,400 seconds, so about **1,160 reads/s** and **350 votes/s** on average. Peak is roughly 3 times average: 3,500 reads/s and 1,000 votes/s.',
        'Averages hide the hard case. Ask about it directly: a celebrity shares a poll and it alone takes **5,000 votes/s** for a few minutes. Write that number down. It will matter later.',
        'Storage: a vote is about 50 bytes and a poll about 1 KB. With 500,000 new polls a day that is roughly 2 GB a day, 730 GB a year. This fits on one database machine for a while, so sharding is not needed on day one.',
      ],
      keyIdea: 'Rough numbers are enough. They tell you which parts need more than one machine and which do not.',
      metrics: { stage: '2 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '1' },
      scene: {
        nodes: [
          { ...user, sub: '10M daily', badge: '10 views, 3 votes each' },
          { ...blackBox, status: 'active', badge: '3,500 reads/s · 1,000 votes/s' },
        ],
        links: [{ from: 'user', to: 'app' }],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'views', count: 6, duration: 1.2 },
          { path: ['user', 'app'], tone: 'event', label: 'votes', count: 2, duration: 1.2, delay: 1.3 },
        ],
        caption: 'Now the black box has a load on it',
      },
      code: {
        language: 'python',
        title: 'Napkin math for QuickPoll',
        source: `DAU = 10_000_000
VIEWS_PER_USER, VOTES_PER_USER = 10, 3
POLLS_PER_DAY = 500_000
DAY = 86_400                                 # seconds

read_qps = DAU * VIEWS_PER_USER / DAY        # ~1,160/s average
vote_qps = DAU * VOTES_PER_USER / DAY        # ~350/s average
peak_reads = read_qps * 3                    # ~3,500/s
peak_votes = vote_qps * 3                    # ~1,000/s
viral_poll = 5_000                           # votes/s on ONE poll

VOTE_BYTES, POLL_BYTES = 50, 1_000
per_day = DAU * VOTES_PER_USER * VOTE_BYTES + POLLS_PER_DAY * POLL_BYTES   # 2 GB
per_year = per_day * 365                                                   # 730 GB`,
        highlight: [6, 7, 8, 9, 10],
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Step 3a: write the API before the boxes',
      eli5: 'Write the menu before building the kitchen. The menu says what a customer can ask for and what they get back. The **poll API** is the counter where orders are taken.',
      body: [
        'The API is the contract between clients and the system. Writing it down turns each functional requirement into a concrete call, and it exposes questions early: who is the voter, what happens on a second vote, are results paginated?',
        'QuickPoll needs four endpoints. Create a poll, read a poll, cast a vote, read the results. The vote call takes the user from the auth token, never from the request body, or anyone could vote as anyone.',
        'Note which calls are reads and which are writes, and attach the numbers from step 2. `GET results` is the 3,500/s path. `POST votes` is the 1,000/s path with the 5,000/s spike. Those two will shape the design.',
      ],
      keyIdea: 'A short list of endpoints pins down exactly what the system does and which calls carry the load.',
      metrics: { stage: '3 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '1' },
      scene: {
        nodes: [user, { ...app, status: 'active', badge: '4 endpoints' }],
        links: [{ from: 'user', to: 'app' }],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'POST /votes', duration: 1.3 },
          { path: ['app', 'user'], tone: 'response', label: '200 or 409', duration: 1.3, delay: 1.4 },
          { path: ['user', 'app'], tone: 'request', label: 'GET /results', duration: 1.3, delay: 2.8 },
          { path: ['app', 'user'], tone: 'response', label: '{counts}', duration: 1.3, delay: 4.2 },
        ],
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
        'List the entities and how each API call finds them. A **poll** has options. A **vote** links a user, a poll and an option. Results are counts of votes per option.',
        'Requirements become schema. "One vote per user per poll" becomes a primary key on `(poll_id, user_id)`: the database itself rejects a duplicate, whatever the application does. Reads always arrive with a `poll_id`, so every lookup is by key.',
        'The data is relational, needs a uniqueness guarantee and totals 730 GB a year, so a SQL database is the plain choice. A `vote_count` column on each option makes results a cheap read. Keep that column in mind: it becomes the hot spot.',
      ],
      keyIdea: 'Design tables from the access patterns in the API, and let the database enforce the rules that must never break.',
      metrics: { stage: '3 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '2' },
      scene: {
        nodes: [user, app, { ...db, status: 'active', badge: 'PK (poll_id, user_id)' }],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['user', 'app', 'db'], tone: 'request', label: 'INSERT vote', duration: 1.8 },
          { path: ['db', 'app', 'user'], tone: 'response', label: 'ok', duration: 1.8, delay: 1.9 },
          { path: ['user', 'app', 'db'], tone: 'request', label: 'same vote again', duration: 1.8, delay: 3.8 },
          { path: ['db', 'app', 'user'], tone: 'error', label: '409 duplicate', duration: 1.8, delay: 5.7 },
        ],
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
      eli5: 'Now sketch the kitchen: a host at the door, a few cooks, a shelf room, and a scoreboard on the wall so nobody has to count orders again. Every **box** is there because a number asked for it.',
      body: [
        'Draw only what the requirements and numbers call for. 4,500 requests per second at peak is more than one app server should carry, and 99.9% forbids a single one, so: a **load balancer** in front of 6 stateless API servers.',
        'Results are read 3,500 times a second and may lag a second, so a **cache** holds each poll\'s counts with a 1-second TTL. One **SQL database** stores polls and votes. Votes go straight to it: insert the vote, add one to the option\'s `vote_count`.',
        'Walk one request of each type through the diagram, out loud. If every endpoint has a path and every box has a reason, the high-level design is done. Resist adding anything else yet.',
      ],
      keyIdea: 'Each box should trace back to a requirement or a number. If it does not, leave it out for now.',
      metrics: { stage: '4 of 6', reads: '3,500/s', votes: '1,000/s', boxes: '4' },
      scene: {
        nodes: [
          user,
          { ...lb, status: 'ok', badge: '99.9% needs > 1 server' },
          { ...app, status: 'ok', sub: '6 servers' },
          { ...cache, status: 'ok', badge: 'TTL 1 s' },
          { ...db, status: 'ok' },
        ],
        links: simpleLinks,
        flows: [
          { path: ['user', 'lb', 'app', 'cache'], tone: 'request', label: 'GET results', count: 3, duration: 1.8 },
          { path: ['cache', 'app', 'lb', 'user'], tone: 'response', count: 3, duration: 1.8, delay: 1.9 },
          { path: ['user', 'lb', 'app', 'db'], tone: 'event', label: 'POST vote', duration: 2, delay: 3.8 },
        ],
        caption: 'Four boxes, each with a reason',
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
      title: 'Hot poll',
      tag: 'case',
      heading: 'Step 5: find where the simple design breaks',
      eli5: 'A famous singer tells everyone to order the same pizza. All the cooks reach for the one order book at once, and only one hand can write in it at a time. The **database** is that order book.',
      body: [
        'Now replay the worst number from step 2: one poll taking **5,000 votes per second**. Every vote runs `UPDATE options SET vote_count = vote_count + 1` on the same row.',
        'A row can be changed by one transaction at a time. If each transaction holds the row lock for about 1 ms while it commits, that row tops out near 1,000 updates per second. 5,000 arrive. The rest wait, connections pile up and the database slows down for every other poll too.',
        'This is the hard part of QuickPoll. Adding API servers does not help, and neither does sharding, because all the load lands on one row. Finding this spot is the point of the deep dive: spend your time where the design fails, and skip the parts that are routine.',
      ],
      keyIdea: 'Push your worst-case number through the simple design. Where it jams is where the deep dive belongs.',
      metrics: { stage: '5 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '4' },
      scene: {
        nodes: [
          { ...user, status: 'hot', badge: 'viral poll' },
          lb,
          { ...app, status: 'hot', sub: '6 servers', badge: 'waiting on DB' },
          cache,
          { ...db, status: 'hot', badge: '1 row, 5,000 writers' },
        ],
        links: simpleLinks,
        flows: [
          { path: ['user', 'lb', 'app'], tone: 'event', label: 'POST vote', count: 8, duration: 1.2 },
          { path: ['app', 'db'], tone: 'event', label: 'count + 1', count: 8, duration: 1.4, delay: 1.2 },
          { path: ['db', 'app', 'lb', 'user'], tone: 'error', label: 'timeout', count: 3, duration: 2.4, delay: 2.8 },
        ],
        caption: 'Every vote fights for the same row lock',
      },
    },
    {
      title: 'Deep dive',
      tag: 'concept',
      heading: 'Step 5, continued: fix the hard part, and only that',
      eli5: 'Instead of every cook grabbing the order book, they drop tickets in a tray. One helper takes a handful of tickets at a time and writes the total in the book once. The **vote queue** is the tray.',
      body: [
        'Take the counting off the request path. The API checks for a duplicate with a Redis `SET voted:{poll}:{user} NX`, appends the vote to a **queue** and answers `202 Accepted` in a few milliseconds.',
        '**Batch workers** read the queue 1,000 votes at a time. They bulk-insert the vote rows and add the batch total to each option in one `UPDATE`. The hot row now sees about 5 updates per second, down from 5,000. The workers also bump the counts in Redis so results stay fresh.',
        'Notice what made this legal: the requirement that counts may lag a second or two. The primary key on `(poll_id, user_id)` is still the final judge of duplicates when the batch is written. The fix adds two boxes, and each one answers the specific failure we found.',
      ],
      keyIdea: 'A deep dive changes the one path that broke. Here: queue the votes, count in batches, serve results from the cache.',
      metrics: { stage: '5 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '6' },
      scene: {
        nodes: [
          user,
          lb,
          { ...app, sub: '6 servers', badge: '202 in 5 ms' },
          { ...cache, status: 'active', badge: 'dedupe + counts' },
          { ...queue, status: 'active', badge: '5,000 votes/s in' },
          { ...worker, status: 'active', badge: 'batches of 1,000' },
          { ...db, status: 'ok', badge: '5 updates/s' },
        ],
        links: fullLinks,
        flows: [
          { path: ['user', 'lb', 'app'], tone: 'event', label: 'POST vote', count: 6, duration: 1.2 },
          { path: ['app', 'cache', 'app'], tone: 'handshake', label: 'SET NX', duration: 1, delay: 1.2 },
          { path: ['app', 'queue'], tone: 'event', count: 6, duration: 1, delay: 2.2 },
          { path: ['queue', 'worker', 'db'], tone: 'data', label: '1 batch', duration: 1.6, delay: 3.2 },
          { path: ['worker', 'cache'], tone: 'data', label: 'counts', duration: 1.2, delay: 4.8 },
        ],
        caption: 'Votes are queued, then counted in batches',
      },
    },
    {
      title: 'Trade-offs',
      tag: 'tradeoff',
      heading: 'Step 6: say what can fail and what you gave up',
      eli5: 'Before opening night, ask: what if the oven breaks, what if twice as many people come, and what did we skip to open on time? A spare **replica** oven is ready in the corner.',
      body: [
        '**Single points of failure.** The database is one machine and the SLO is 99.9%, so add a **replica** with automatic failover. Redis holds the dedupe keys and live counts: if it is lost, rebuild the counts from the database and fall back to the primary key for dedupe.',
        '**What we gave up.** A voter gets `202` before the vote is durable, and results trail by about a second. If the queue backs up, results go stale while votes stay safe. That matches the stated consistency requirement, so say so.',
        '**Next bottleneck.** At 10 times the scale, 7 TB a year no longer fits one database, and votes would be sharded by `poll_id`. Name it and move on. A design is finished when the remaining risks are stated, since there will always be some.',
      ],
      keyIdea: 'Close by naming the failure cases, the trade-offs you accepted and the next thing that breaks at 10x.',
      metrics: { stage: '6 of 6', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '7' },
      scene: {
        nodes: [
          user,
          lb,
          { ...app, sub: '6 servers' },
          { ...cache, badge: 'rebuildable' },
          { ...queue, badge: 'lag ~1 s' },
          worker,
          { ...db, status: 'down', badge: 'primary fails' },
          { ...replica, status: 'active', badge: 'promoted' },
        ],
        links: [
          ...fullLinks,
          { from: 'db', to: 'replica', style: 'dashed', label: 'replicate' },
          { from: 'worker', to: 'replica' },
        ],
        flows: [
          { path: ['user', 'lb', 'app', 'queue'], tone: 'event', count: 4, duration: 1.8 },
          { path: ['queue', 'worker', 'db'], tone: 'error', label: 'primary down', duration: 1.6, delay: 1.8 },
          { path: ['queue', 'worker', 'replica'], tone: 'data', label: 'retry on new primary', duration: 1.6, delay: 3.5 },
        ],
        caption: 'The queue holds votes while the database fails over',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Same six steps, every design',
      eli5: 'Ask, count, write the menu, plan the shelves, sketch the kitchen, fix the busiest spot, and plan for a broken oven. Do it in that order and every **box** in the kitchen has a job.',
      body: [
        '**Clarify** with the five questions: scale, read:write ratio, consistency, latency, availability. **Estimate** the load, including the worst single case. Write the **API** and the **data model**. Draw the **simplest design** that carries the numbers. **Deep dive** where it breaks. Finish with **failures and trade-offs**.',
        'QuickPoll went from one black box to seven boxes. The load balancer and server pool came from the availability target and the peak rate. The cache came from "counts may lag". The queue and workers came from 5,000 votes per second on one row. The replica came from 99.9%.',
        'As a rough time split for a 45-minute discussion: 5 minutes on requirements, 5 on numbers, 10 on API and data, 10 on the high-level design, and the rest on the deep dive and trade-offs. Every whole-system lesson later in the course follows this arc.',
      ],
      keyIdea: 'Requirements and numbers come first, and every box you draw should point back to one of them.',
      metrics: { stage: 'done', reads: '3,500/s', votes: '5,000/s on 1 poll', boxes: '7' },
      scene: {
        nodes: [
          user,
          { ...lb, status: 'ok' },
          { ...app, status: 'ok', sub: '6 servers' },
          { ...cache, status: 'ok' },
          { ...queue, status: 'ok' },
          { ...worker, status: 'ok' },
          { ...db, status: 'ok' },
          { ...replica, status: 'ok' },
        ],
        links: [...fullLinks, { from: 'db', to: 'replica', style: 'dashed' }],
        flows: [
          { path: ['user', 'lb', 'app', 'cache'], tone: 'request', label: 'results', count: 3, duration: 1.8 },
          { path: ['cache', 'app', 'lb', 'user'], tone: 'response', count: 3, duration: 1.8, delay: 1.9 },
          { path: ['user', 'lb', 'app', 'queue', 'worker', 'db'], tone: 'event', label: 'vote', duration: 3, delay: 0.6 },
          { path: ['db', 'replica'], tone: 'data', duration: 1.2, delay: 3.6 },
        ],
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
