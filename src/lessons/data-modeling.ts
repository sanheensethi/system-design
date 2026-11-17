import type { Lesson, SceneNode } from '../engine/types';

const user: SceneNode = { id: 'user', kind: 'phone', at: [-4, 4], label: 'reader', sub: 'opens home feed' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-2.5, 2.5], label: 'feed API', sub: '10K reads/s' };
const users: SceneNode = { id: 'users', kind: 'db', at: [-2.5, -1.5], label: 'users', sub: '50M rows' };
const follows: SceneNode = { id: 'follows', kind: 'db', at: [-0.75, -3.25], label: 'follows', sub: '15B rows' };
const posts: SceneNode = { id: 'posts', kind: 'db', at: [1, -5], label: 'posts', sub: '2B rows' };
const mview: SceneNode = { id: 'mview', kind: 'storage', at: [0.5, 1.5], label: 'author_stats', sub: 'materialized view' };
const feeds: SceneNode = { id: 'feeds', kind: 'shard', at: [2.25, -0.25], label: 'feed_by_user', sub: 'one partition per reader' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: [4, -2], label: 'fan-out worker' };

const readLinks = [
  { from: 'user', to: 'app' },
  { from: 'app', to: 'users' },
  { from: 'app', to: 'follows' },
  { from: 'app', to: 'posts' },
];

export const dataModeling: Lesson = {
  id: 'data-modeling',
  title: 'Data modeling and materialized views',
  tagline: 'Store each fact once, or store the answer your screen needs. Learn when to do which, and what the copies cost.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'What normalization buys you and why joins get expensive at scale',
    'Denormalization and the update anomalies it creates',
    'Materialized views: a query result the database stores and refreshes',
    'Modeling for access patterns in NoSQL: one table per query',
    'Fan-out on write as a precomputed view of the home feed',
  ],
  metrics: [
    { key: 'read', label: 'Feed read' },
    { key: 'rows', label: 'Rows touched per read' },
    { key: 'writes', label: 'Writes per post' },
    { key: 'copies', label: 'Copies of a name' },
  ],
  steps: [
    {
      title: 'Slow feed',
      tag: 'problem',
      heading: 'The home feed takes 1.2 seconds to load',
      eli5: 'A pupil asks the school office, "what did my 300 friends write today?" The clerk has to open three filing cabinets and flip through thousands of cards to answer one question.',
      body: [
        'A social app has 50 million users. Each follows about 300 accounts. The home feed shows the 20 newest posts from the people you follow, with each author\'s name and avatar.',
        'The schema is textbook clean: a `users` table, a `follows` table and a `posts` table. Building one feed means joining all three. The database finds your 300 followees, pulls recent posts for each, sorts about 6,000 candidate rows, keeps 20, and looks up 20 author rows.',
        'At **10,000 feed reads per second** this query averages 1.2 seconds and the database is saturated. Indexes are already in place. The work itself is the problem: the data is stored in one shape and read in another.',
      ],
      keyIdea: 'When the stored shape and the read shape differ, every read pays to convert one into the other.',
      metrics: { read: '1,200 ms', rows: '~6,300', writes: '1', copies: '1' },
      scene: {
        nodes: [user, { ...app, status: 'hot', badge: '1.2 s' }, { ...users, status: 'hot' }, { ...follows, status: 'hot', badge: '300 followees' }, { ...posts, status: 'hot', badge: '6,000 candidates' }],
        links: readLinks,
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'GET /feed', duration: 1 },
          { path: ['app', 'follows'], tone: 'request', label: 'who do I follow?', duration: 1.2, delay: 1 },
          { path: ['app', 'posts'], tone: 'request', label: 'their posts', count: 5, duration: 1.4, delay: 2.2 },
          { path: ['app', 'users'], tone: 'request', label: 'author names', duration: 1.2, delay: 3.6 },
          { path: ['app', 'user'], tone: 'response', duration: 1, delay: 4.9 },
        ],
        caption: 'One screen, three tables, thousands of rows',
      },
    },
    {
      title: 'Normalize',
      tag: 'concept',
      heading: 'Normalization: every fact lives in one place',
      eli5: 'The school office keeps one card per pupil, and the address is written only on that card. When a family moves, the clerk fixes a single card and every list that points to it is right again.',
      body: [
        'The clean schema is **normalized**. Each fact is stored exactly once, and other tables refer to it by ID. A post row holds `author_id`, never the author\'s name. The name lives in one row of `users`.',
        'That gives three real benefits. A rename is one row update. Two copies of a fact can never disagree, because there is only one. And the tables can answer questions nobody planned for, since a join can combine them in any way.',
        'Normalization is the right default for a system of record: orders, payments, accounts. Start here. Leave it only for a read path you have measured and found too slow.',
      ],
      keyIdea: 'Normalized data is cheap to write and impossible to make inconsistent. The cost shows up at read time, as joins.',
      metrics: { read: '1,200 ms', rows: '~6,300', writes: '1', copies: '1' },
      scene: {
        nodes: [{ ...user, label: 'author', sub: 'changes name' }, { ...app, sub: 'profile API', status: 'active' }, { ...users, status: 'ok', badge: '1 row updated' }, { ...follows, status: 'dim' }, { ...posts, badge: 'author_id = 7' }],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'users' },
          { from: 'posts', to: 'users', style: 'dashed', label: 'author_id' },
        ],
        flows: [
          { path: ['user', 'app', 'users'], tone: 'request', label: 'rename to "Mina K."', duration: 1.6 },
          { path: ['users', 'app', 'user'], tone: 'response', label: 'done', duration: 1.6, delay: 1.7 },
          { path: ['posts', 'users'], tone: 'handshake', label: 'still points to row 7', duration: 1.4, delay: 3.4 },
        ],
        caption: 'One fact, one row, one update',
      },
      code: {
        language: 'sql',
        title: 'The normalized schema and the feed query it forces',
        source: `CREATE TABLE users   (id BIGINT PRIMARY KEY, name TEXT, avatar_url TEXT);
CREATE TABLE follows (follower_id BIGINT, followee_id BIGINT,
                      PRIMARY KEY (follower_id, followee_id));
CREATE TABLE posts   (id BIGINT PRIMARY KEY, author_id BIGINT REFERENCES users(id),
                      body TEXT, created_at TIMESTAMPTZ);
CREATE INDEX posts_by_author ON posts (author_id, created_at DESC);

-- home feed for user 42
SELECT p.id, p.body, p.created_at, u.name, u.avatar_url
FROM follows f
JOIN posts p ON p.author_id = f.followee_id
JOIN users u ON u.id = p.author_id
WHERE f.follower_id = 42
ORDER BY p.created_at DESC
LIMIT 20;`,
        highlight: [4, 10, 11, 12, 14],
      },
    },
    {
      title: 'Join cost',
      tag: 'concept',
      heading: 'Why the join hurts more as you grow',
      eli5: 'With 30 pupils, flipping through the cabinets is quick. With 50 million, the cabinets fill many buildings, and the clerk has to phone other buildings to finish one answer.',
      body: [
        'A join is work done per read. This one does 300 index range scans on `posts`, merges the results and sorts them. The cost grows with how many accounts you follow and how much they post. No index can return "the newest 20 across these 300 authors" in one step.',
        'It gets worse when one machine is no longer enough. After sharding, your followees\' posts are spread over many shards. The join becomes a **scatter-gather**: query every shard, wait for the slowest one, merge in the app. Many distributed stores do not offer joins at all for this reason.',
        'Feeds are read about 100 times for every post written. Paying the conversion cost on the read side means paying it on the busy side.',
      ],
      keyIdea: 'Join cost scales with data size and vanishes as an option across shards. On a read-heavy path, that cost is paid on every request.',
      metrics: { read: '1,200 ms', rows: '~6,300', writes: '1', copies: '1' },
      scene: {
        zones: [
          { id: 'sa', from: [-3.4, -2.4], to: [-1.6, -0.6], label: 'shard 1', tone: 'blue' },
          { id: 'sb', from: [-1.65, -4.15], to: [0.15, -2.35], label: 'shard 2', tone: 'amber' },
          { id: 'sc', from: [0.1, -5.9], to: [1.9, -4.1], label: 'shard 3', tone: 'violet' },
        ],
        nodes: [
          user,
          { ...app, status: 'hot', badge: 'merge + sort' },
          { ...users, kind: 'shard', label: 'posts A to H', sub: undefined },
          { ...follows, kind: 'shard', label: 'posts I to P', sub: undefined, status: 'hot', badge: 'slowest: 900 ms' },
          { ...posts, kind: 'shard', label: 'posts Q to Z', sub: undefined },
        ],
        links: readLinks,
        flows: [
          { path: ['app', 'users'], tone: 'request', duration: 1 },
          { path: ['app', 'follows'], tone: 'request', label: 'scatter', duration: 1 },
          { path: ['app', 'posts'], tone: 'request', duration: 1 },
          { path: ['users', 'app'], tone: 'response', duration: 1, delay: 1.2 },
          { path: ['posts', 'app'], tone: 'response', duration: 1, delay: 1.4 },
          { path: ['follows', 'app'], tone: 'response', label: 'gather', duration: 2.4, delay: 1.6 },
        ],
        caption: 'After sharding, a join becomes scatter-gather',
      },
    },
    {
      title: 'Denormalize',
      tag: 'concept',
      heading: 'Denormalization: copy the data to where it is read',
      eli5: 'To save trips to the pupil cards, the clerk writes each pupil\'s name right on every piece of homework. Reading a page is faster, because the name is already there.',
      body: [
        '**Denormalization** stores a fact in more than one place on purpose, so a read can skip a join. Copy the author\'s `name` and `avatar_url` into each post row. The feed no longer touches `users` at all.',
        'Other common forms: a `like_count` column on the post in place of counting rows in a `likes` table, and an embedded list of the first three comments. In a document database this is the normal style. One document holds everything one screen needs.',
        'The trade is direct. Reads get cheaper. Writes get more expensive and more complicated, because every copy of a fact now has to be kept correct by your code.',
      ],
      keyIdea: 'Denormalizing moves work from read time to write time. Do it for the fields a hot read path needs, and nothing more.',
      metrics: { read: '800 ms', rows: '~6,000', writes: '1', copies: '1 + one per post' },
      scene: {
        nodes: [user, { ...app, status: 'active' }, { ...users, status: 'dim', badge: 'skipped' }, follows, { ...posts, status: 'active', badge: '+ author_name, avatar' }],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'follows' },
          { from: 'app', to: 'posts' },
          { from: 'users', to: 'posts', style: 'dashed', label: 'copied in' },
        ],
        flows: [
          { path: ['user', 'app'], tone: 'request', duration: 0.9 },
          { path: ['app', 'follows'], tone: 'request', duration: 1.1, delay: 1 },
          { path: ['app', 'posts'], tone: 'request', count: 4, duration: 1.2, delay: 2.1 },
          { path: ['posts', 'app', 'user'], tone: 'response', label: 'posts with names', duration: 1.6, delay: 3.4 },
        ],
        caption: 'The name travels with the post',
      },
    },
    {
      title: 'Anomalies',
      tag: 'case',
      heading: 'Case: the rename that only half happened',
      eli5: 'A pupil changes her name. Her card in the office is fixed in a second, but her old name is still written on 40,000 pieces of homework. For a while, some pages say one name and some say the other.',
      body: [
        'Mina changes her display name. In the normalized schema that was one row. Now the name is also copied into her 40,000 posts. The app updates `users`, then starts updating posts, and crashes a third of the way through.',
        'This is an **update anomaly**: copies of one fact that disagree. Readers see the new name on her profile and the old one on most of her posts. Related problems are the insert anomaly (a copy that was never written) and the delete anomaly (a copy left behind after the original is gone).',
        'The defenses are practical. Keep the normalized row as the **source of truth** and treat copies as derived. Propagate changes with a background job or a change stream that retries until done. Prefer to copy fields that rarely change. Some fields are safe to leave alone: an order should keep the price that was charged, whatever the product costs today.',
      ],
      keyIdea: 'Every copy is a promise to update it. Keep one source of truth, propagate changes asynchronously, and expect copies to lag.',
      metrics: { read: '800 ms', rows: '~6,000', writes: '1 + 40,000 on rename', copies: '40,001' },
      scene: {
        nodes: [
          { ...user, label: 'Mina', sub: 'renames herself' },
          { ...app, sub: 'profile API', status: 'hot', badge: 'crashed mid-update' },
          { ...users, status: 'ok', badge: 'new name' },
          { ...follows, status: 'dim' },
          { ...posts, status: 'hot', badge: '13,000 new, 27,000 old' },
        ],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'users' },
          { from: 'app', to: 'posts' },
        ],
        flows: [
          { path: ['user', 'app', 'users'], tone: 'request', label: 'rename', duration: 1.4 },
          { path: ['app', 'posts'], tone: 'data', label: 'update 40,000 copies', count: 4, duration: 1.4, delay: 1.5 },
          { path: ['posts', 'app'], tone: 'error', label: 'interrupted', duration: 1.2, delay: 3.2 },
        ],
        caption: 'Two tables now disagree about one name',
      },
      quiz: {
        question: 'You denormalize `author_name` into every post row. Which statement about the trade is correct?',
        options: [
          'Reads and writes both get cheaper',
          'Reads skip a join, and a rename must now update every copy or leave them stale',
          'The users table can be dropped, since posts hold the names',
          'Nothing changes as long as there is an index on author_name',
        ],
        answer: 1,
        explain: 'Denormalization shifts cost from reads to writes. The users row stays the source of truth, and each copy has to be updated when the fact changes.',
      },
    },
    {
      title: 'Materialized view',
      tag: 'concept',
      heading: 'Materialized views: let the database keep the copy',
      eli5: 'The office pins a noticeboard with "posts per pupil this week", the **materialized view**. Nobody recounts the cards for each question. A clerk rewrites the board every few minutes, so it can be slightly old.',
      body: [
        'A normal view is a saved query that runs each time you read it. A **materialized view** stores the query\'s result on disk like a table. Reading it is a plain indexed lookup, however expensive the query behind it was.',
        'The profile page shows each author\'s post count, total likes and last post time. Computing that from 2 billion posts takes seconds. As a materialized view it is one row per author, read in a millisecond.',
        'The catch is freshness. The stored result is only as new as its last **refresh**. Some databases refresh on a schedule or on demand and recompute the whole thing. Others maintain the view incrementally as base rows change. Either way you have chosen a derived copy with known staleness, managed by the database and not by your application code.',
      ],
      keyIdea: 'A materialized view is denormalization with the database doing the bookkeeping. You trade freshness for read speed.',
      metrics: { read: '800 ms', rows: '~6,000', writes: '1', copies: 'managed by the DB' },
      scene: {
        nodes: [{ ...user, sub: 'opens a profile' }, { ...app, sub: 'profile API', status: 'active' }, { ...users, status: 'dim' }, { ...follows, status: 'dim' }, { ...posts, badge: 'source rows' }, { ...mview, status: 'ok', badge: '1 row per author' }],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'mview' },
          { from: 'posts', to: 'mview', style: 'dashed', label: 'refresh every 5 min' },
        ],
        flows: [
          { path: ['user', 'app', 'mview'], tone: 'request', label: 'stats for author 7', duration: 1.5 },
          { path: ['mview', 'app', 'user'], tone: 'response', label: '1 ms', duration: 1.5, delay: 1.6 },
          { path: ['posts', 'mview'], tone: 'data', label: 'recompute', count: 3, duration: 2, delay: 3.3 },
        ],
        caption: 'The query runs on refresh. Reads fetch the stored result.',
      },
      code: {
        language: 'sql',
        title: 'PostgreSQL: a materialized view and its refresh',
        source: `CREATE MATERIALIZED VIEW author_stats AS
SELECT author_id,
       count(*)        AS post_count,
       sum(like_count) AS total_likes,
       max(created_at) AS last_post_at
FROM posts
GROUP BY author_id;

-- needed so the refresh below can run without blocking readers
CREATE UNIQUE INDEX ON author_stats (author_id);

-- run from a scheduler, for example every 5 minutes
REFRESH MATERIALIZED VIEW CONCURRENTLY author_stats;

-- the profile page reads one precomputed row
SELECT * FROM author_stats WHERE author_id = 7;`,
        highlight: [1, 10, 13, 16],
      },
    },
    {
      title: 'Access patterns',
      tag: 'concept',
      heading: 'NoSQL modeling: start from the queries',
      eli5: 'A new school has no clerk who can cross-check cabinets. So it builds one drawer for each question people ask. "Show my feed" gets its own drawer, already in the right order.',
      body: [
        'In a relational database you model the entities first and write queries later. In a wide-column or key-value store the order flips. Joins are missing or impractical, so you list the **access patterns** first and build a table for each one.',
        'Each table is designed around its key. The **partition key** decides which node holds the rows and is the thing you look up by. The **sort key** (clustering key) orders rows inside a partition. A good read hits one partition and takes a contiguous slice.',
        'For "newest 20 posts in a reader\'s feed", the table is `feed_by_user`: partition by `user_id`, sort by `post_time` descending, and carry the author name and a snippet in each row. The same post appears in many tables and many partitions. In this style, duplication is the design and not a shortcut.',
      ],
      keyIdea: 'In NoSQL, write down the queries first, then give each one a table whose key answers it with a single partition read.',
      metrics: { read: '5 ms', rows: '20', writes: '1 per table', copies: 'one per feed row' },
      scene: {
        nodes: [user, { ...app, status: 'active' }, { ...feeds, status: 'ok', badge: 'user 42: 20 newest rows' }],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'feeds' },
        ],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'GET /feed', duration: 0.9 },
          { path: ['app', 'feeds'], tone: 'request', label: 'partition 42, LIMIT 20', duration: 1.1, delay: 1 },
          { path: ['feeds', 'app', 'user'], tone: 'response', label: 'ready-made feed', duration: 1.6, delay: 2.2 },
        ],
        caption: 'One partition, one ordered slice',
      },
      code: {
        language: 'sql',
        title: 'Cassandra (CQL): a table shaped like the feed screen',
        source: `CREATE TABLE feed_by_user (
    user_id     bigint,
    post_time   timestamp,
    post_id     bigint,
    author_id   bigint,
    author_name text,          -- denormalized on purpose
    snippet     text,
    PRIMARY KEY ((user_id), post_time, post_id)
) WITH CLUSTERING ORDER BY (post_time DESC, post_id DESC);

-- the only query this table exists for
SELECT post_id, author_name, snippet, post_time
FROM feed_by_user
WHERE user_id = 42
LIMIT 20;`,
        highlight: [6, 8, 9, 14],
      },
    },
    {
      title: 'Fan-out on write',
      tag: 'concept',
      heading: 'Fan-out on write: a materialized view you maintain yourself',
      eli5: 'When a pupil writes a note, a helper walks down the hall and drops a copy into the cubby of every friend. Later, each friend just opens their own cubby. Nobody visits the office.',
      body: [
        'Something has to fill `feed_by_user`. When Mina posts, the post is saved once in `posts` (the source of truth) and an event goes to a **fan-out worker**. The worker looks up her followers and inserts one row into each follower\'s feed partition.',
        'This is **fan-out on write**. It is the feed query from step 1, run ahead of time and stored: a materialized view of "posts by people I follow", maintained incrementally by your own code. One post from an account with 300 followers causes 301 writes. A feed read is now a single partition read of 20 rows in about 5 ms.',
        'The fan-out is asynchronous. Followers see the post a moment later, which is fine for a feed. The author\'s own "post saved" response does not wait for it.',
      ],
      keyIdea: 'Fan-out on write precomputes each reader\'s feed at post time, so the hot read path does no joining at all.',
      metrics: { read: '5 ms', rows: '20', writes: '301', copies: 'one per feed row' },
      scene: {
        nodes: [
          { ...user, label: 'Mina', sub: 'publishes a post' },
          { ...app, sub: 'post API', status: 'active' },
          { ...follows, badge: '300 followers' },
          { ...posts, status: 'ok', badge: '1 row: source of truth' },
          { ...worker, status: 'active', badge: '300 inserts' },
          { ...feeds, status: 'active', badge: '+1 row in 300 partitions' },
        ],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'posts' },
          { from: 'posts', to: 'worker', style: 'dashed', label: 'event' },
          { from: 'worker', to: 'follows', style: 'faint' },
          { from: 'worker', to: 'feeds' },
        ],
        flows: [
          { path: ['user', 'app', 'posts'], tone: 'request', label: 'new post', duration: 1.5 },
          { path: ['posts', 'worker'], tone: 'event', label: 'post created', duration: 1, delay: 1.6 },
          { path: ['worker', 'follows', 'worker'], tone: 'request', label: 'who follows Mina?', duration: 1.6, delay: 2.7 },
          { path: ['worker', 'feeds'], tone: 'data', label: 'insert', count: 6, duration: 1.2, delay: 4.4 },
        ],
        caption: 'One post in, 300 feed rows out',
      },
    },
    {
      title: 'The bill',
      tag: 'tradeoff',
      heading: 'Read cost against write cost',
      eli5: 'Copying a note into 300 cubbies is fine. Copying the head teacher\'s note into 5 million cubbies takes all day. For her, it is smarter to pin one copy on the wall and let everyone look when they pass.',
      body: [
        'Precomputing moved the cost. It did not remove it. An account with 5 million followers turns one post into **5 million feed writes**. The fan-out queue backs up, and followers get the post minutes late. Storage grows too: every post is referenced once per follower.',
        'The opposite design, **fan-out on read**, stores nothing extra and runs the join when the feed is opened. Writes are trivial and reads are slow. That was step 1.',
        'Real feeds mix the two. Ordinary accounts fan out on write. Very large accounts are skipped by the worker, and their recent posts are fetched at read time and merged into the precomputed feed. The rule behind every choice in this lesson is the same: compare how often the data is read with how often it changes, and put the work on the rarer side.',
      ],
      keyIdea: 'Precompute when reads far outnumber writes and the fan-out is bounded. Compute at read time when one write would touch millions of copies.',
      metrics: { read: '5 ms (+ merge)', rows: '20 + a few', writes: '301 typical, 5M for a star', copies: 'bounded by the hybrid' },
      scene: {
        nodes: [
          { ...user, label: 'star account', sub: '5M followers' },
          { ...app, sub: 'post API' },
          { ...follows, status: 'hot', badge: '5,000,000 followers' },
          { ...posts, status: 'ok', badge: 'read at feed time' },
          { ...worker, status: 'hot', badge: 'skips big accounts' },
          { ...feeds, badge: 'ordinary posts only' },
        ],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'posts' },
          { from: 'posts', to: 'worker', style: 'dashed' },
          { from: 'worker', to: 'follows', style: 'faint' },
          { from: 'worker', to: 'feeds', style: 'faint' },
        ],
        flows: [
          { path: ['user', 'app', 'posts'], tone: 'request', label: 'new post', duration: 1.5 },
          { path: ['posts', 'worker'], tone: 'event', duration: 1, delay: 1.6 },
          { path: ['worker', 'follows'], tone: 'error', label: '5M writes? no', duration: 1.2, delay: 2.7 },
        ],
        caption: 'Some writes are too wide to fan out',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Store the truth once, and the answers where they are read',
      eli5: 'Keep one true card for every pupil in the office. Then make as many handy copies as your busiest questions need, and remember that every copy has to be kept up to date.',
      body: [
        '**Normalize** the system of record: one fact, one row, no anomalies. When a hot read path pays too much for joins, **denormalize** for that path: copy fields, keep counters, or let the database maintain a **materialized view**. Each copy needs an owner and a refresh mechanism, and it will lag.',
        'In NoSQL stores, design a table per **access pattern** around a partition key and a sort key. **Fan-out on write** applies the same idea to feeds: the feed read dropped from 1,200 ms and 6,300 rows to 5 ms and 20 rows, and each post now costs about 301 writes.',
      ],
      keyIdea: 'A data model is a choice about when to do the work. Do it on the side of the read/write ratio that happens less often.',
      metrics: { read: '5 ms', rows: '20', writes: '301', copies: 'derived, async' },
      scene: {
        nodes: [user, { ...app, status: 'ok' }, users, follows, { ...posts, status: 'ok' }, { ...worker, status: 'ok' }, { ...feeds, status: 'ok' }],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'feeds' },
          { from: 'posts', to: 'worker', style: 'dashed' },
          { from: 'worker', to: 'feeds' },
          { from: 'worker', to: 'follows', style: 'faint' },
          { from: 'posts', to: 'users', style: 'faint' },
        ],
        flows: [
          { path: ['user', 'app', 'feeds'], tone: 'request', duration: 1.4 },
          { path: ['feeds', 'app', 'user'], tone: 'response', label: '5 ms', duration: 1.4, delay: 1.5 },
          { path: ['posts', 'worker', 'feeds'], tone: 'data', count: 4, duration: 1.8, delay: 3 },
        ],
      },
      quiz: {
        question: 'A dashboard shows revenue per country per day. The query scans 400 million order rows and takes 40 seconds. It is viewed 5,000 times a day, and numbers that are 10 minutes old are acceptable. What fits best?',
        options: [
          'Normalize the orders table further',
          'A materialized view (or summary table) refreshed every few minutes',
          'Copy the country name into every order row',
          'Fan out each order into every viewer\'s personal table',
        ],
        answer: 1,
        explain: 'The result is small, read often and allowed to be slightly stale. Store the aggregated result and refresh it on a schedule, so each view is a cheap lookup.',
      },
    },
  ],
};
