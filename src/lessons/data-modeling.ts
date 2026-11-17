import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s * 1.25 + d) / 2, (s * 1.25 - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const reader: SceneNode = { id: 'reader', kind: 'phone', at: at(-4, -3), label: 'reader', sub: 'opens home feed' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3), label: 'feed API', sub: '10K reads/s', icon: 'Rss', tint: 'violet' };
const users: SceneNode = { id: 'users', kind: 'db', at: at(-4, 3), label: 'users', sub: '50M rows' };
const posts: SceneNode = { id: 'posts', kind: 'db', at: at(0, 3), label: 'posts', sub: '2B rows' };
const follows: SceneNode = { id: 'follows', kind: 'db', at: at(4, 3), label: 'follows', sub: '15B rows' };
const feeds: SceneNode = { id: 'feeds', kind: 'shard', at: at(4, -3), label: 'feed_by_user', sub: 'one partition per reader' };
const worker: SceneNode = { id: 'worker', kind: 'block', at: at(4, 4.6), label: 'fan-out worker', icon: 'Workflow', tint: 'amber' };

export const dataModeling: Lesson = {
  id: 'data-modeling',
  title: 'Data modeling and materialized views',
  tagline: 'Store each fact once, or store the answer your screen needs. Learn when to do which, and what the copies cost.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'What normalization buys you, the normal forms, and why joins get expensive at scale',
    'Denormalization, its forms, and the update, insert and delete anomalies it creates',
    'Materialized views and summary tables: a query result stored and refreshed',
    'Modeling for access patterns in NoSQL: partition keys, sort keys, embedding',
    'Fan-out on write, the celebrity problem and the hybrid feed',
    'Star schemas and rebuilding derived data from a log',
  ],
  metrics: [
    { key: 'read', label: 'Feed read', icon: 'Timer' },
    { key: 'rows', label: 'Rows per read', icon: 'Table' },
    { key: 'writes', label: 'Writes per post', icon: 'Copy' },
    { key: 'copies', label: 'Copies of a name', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'Slow feed',
      tag: 'problem',
      heading: 'The home feed takes 1.2 seconds to load',
      eli5: 'A pupil asks the school office, "what did my 300 friends write today?" The clerk opens three filing cabinets and flips through thousands of cards to answer one question.',
      body: [
        'A social app has 50 million users, each following about 300 accounts. The home feed shows the 20 newest posts from those people, with each author\'s name and avatar.',
        'At **10,000 feed reads per second** the query averages 1.2 seconds and the database is saturated. Indexes exist already. The data is stored in one shape and read in another.',
      ],
      keyIdea: 'When the stored shape and the read shape differ, every read pays to convert one into the other.',
      metrics: { read: '1,200 ms', rows: '~12,300', writes: '1', copies: '1' },
      metricTones: { read: 'bad', rows: 'bad' },
      scene: {
        nodes: [
          reader,
          { ...api, status: 'hot', load: 96, chips: [{ text: 'GET /feed', tone: 'warn' }] },
          { ...users, status: 'hot' },
          { ...posts, status: 'hot', badge: '12,000 candidates' },
          { ...follows, status: 'hot', badge: '300 followees' },
        ],
        links: [link('reader', 'api'), link('api', 'users'), link('api', 'posts'), link('api', 'follows')],
        flows: [
          { path: ['reader', 'api'], tone: 'request', label: 'GET /feed', duration: 1 },
          { path: ['api', 'follows'], tone: 'request', label: 'who do I follow?', duration: 1.2, delay: 1 },
          { path: ['api', 'posts'], tone: 'request', label: 'their posts', count: 5, duration: 1.4, delay: 2.2 },
          { path: ['api', 'users'], tone: 'request', label: 'author names', duration: 1.2, delay: 3.6 },
          { path: ['api', 'reader'], tone: 'response', duration: 1, delay: 4.9 },
        ],
        panel: {
          title: 'One feed, three tables',
          icon: 'Table',
          rows: [
            { text: 'Followees found', value: '300' },
            { text: 'Candidate posts', value: '~12,000', tone: 'warn' },
            { text: 'Author rows looked up', value: '20' },
            { text: 'Average latency', value: '1,200 ms', tone: 'bad' },
          ],
        },
        caption: 'One screen, three tables, thousands of rows',
      },
    },
    {
      title: 'Normalize',
      tag: 'concept',
      heading: 'Normalization: every fact lives in one place',
      eli5: 'The school office keeps one card per pupil, and the address is written only on that card. When a family moves, the clerk fixes a single card and every list that points to it is right again.',
      body: [
        'The clean schema is **normalized**: each fact is stored once and other tables refer to it by ID. A post holds `author_id`, never the author\'s name. The name lives in one row of `users`.',
        'A rename is one row update, two copies can never disagree, and a join can answer questions nobody planned for. Start here for any system of record: orders, payments, accounts.',
      ],
      keyIdea: 'Normalized data is cheap to write and impossible to make inconsistent. The cost shows up at read time, as joins.',
      metrics: { read: '1,200 ms', rows: '~12,300', writes: '1', copies: '1' },
      metricTones: { writes: 'good', copies: 'good' },
      scene: {
        nodes: [
          { ...reader, label: 'author', sub: 'changes name' },
          { ...api, sub: 'profile API', status: 'active' },
          { ...users, status: 'ok', badge: '1 row updated' },
          { ...posts, badge: 'author_id = 7' },
        ],
        links: [link('reader', 'api'), link('api', 'users'), link('posts', 'users', { style: 'dashed', label: 'author_id' })],
        flows: [
          { path: ['reader', 'api', 'users'], tone: 'request', label: 'rename to "Mina K."', duration: 1.6 },
          { path: ['users', 'api', 'reader'], tone: 'response', label: 'done', duration: 1.6, delay: 1.7 },
          { path: ['posts', 'users'], tone: 'handshake', label: 'still points to row 7', duration: 1.4, delay: 3.4 },
        ],
        panel: {
          title: 'What normalization buys',
          icon: 'Shield',
          rows: [
            { text: 'Rename a user', value: '1 row', tone: 'good' },
            { text: 'Copies that can disagree', value: '0', tone: 'good' },
            { text: 'Ad hoc questions', value: 'any join', tone: 'good' },
          ],
        },
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
      title: 'Normal forms',
      tag: 'concept',
      heading: 'Normal forms: the rules behind the clean schema',
      eli5: 'A tidy office has three rules: one fact per box on a card, every box belongs to that card, and nothing about the pupil\'s address is written on a homework sheet.',
      body: [
        '**1NF**: one value per cell, no repeating lists. **2NF**: every column depends on the whole key. **3NF**: columns depend on the key and nothing else. Most real schemas stop at 3NF.',
        'A `posts` table with `author_name` breaks 3NF, because the name depends on `author_id` and not on the post. Moving it into `users` fixes that.',
      ],
      keyIdea: 'Each normal form removes one way for a fact to be stored twice. 3NF is the usual stopping point.',
      metrics: { read: '1,200 ms', rows: '~12,300', writes: '1', copies: '1' },
      scene: {
        nodes: [
          { ...posts, status: 'hot', badge: 'author_name: Mina' },
          { id: 'rule', kind: 'block', at: at(0, -3), label: '3NF check', sub: 'depends on the key only', icon: 'Scale', tint: 'amber' },
          { ...users, status: 'ok', badge: 'name lives here' },
        ],
        links: [link('posts', 'rule'), link('rule', 'users', { label: 'move it' })],
        flows: [
          { path: ['posts', 'rule'], tone: 'request', label: 'author_name?', duration: 1.4 },
          { path: ['rule', 'users'], tone: 'data', label: 'move to users', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Normal forms in one line each',
          icon: 'List',
          rows: [
            { text: '1NF', value: 'one value per cell' },
            { text: '2NF', value: 'whole key, not part' },
            { text: '3NF', value: 'the key, nothing else' },
            { text: 'author_name in posts', value: 'breaks 3NF', tone: 'bad' },
          ],
        },
        caption: 'A column that depends on another column does not belong here',
      },
    },
    {
      title: 'Join cost',
      tag: 'concept',
      heading: 'Why the join hurts more as you grow',
      eli5: 'With 30 pupils, flipping through the cabinets is quick. With 50 million, the cabinets fill many buildings, and the clerk has to phone other buildings to finish one answer.',
      body: [
        'A join is work done per read. 2B posts over 50M users is about 40 posts per author, so 300 followees give about 12,000 candidate rows. The query does 300 index range scans, merges them and sorts. Cost grows with accounts followed and how much they post.',
        'No index can return "the newest 20 across these 300 authors" in one step. The merge and sort happen on every request.',
      ],
      keyIdea: 'Join cost scales with data size, and the database repeats the work on every read.',
      metrics: { read: '1,200 ms', rows: '~12,300', writes: '1', copies: '1' },
      metricTones: { read: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot', load: 96, badge: 'merge + sort' },
          { ...users, status: 'active' },
          { ...posts, status: 'hot', chips: [{ text: '300 range scans', tone: 'warn' }] },
          { ...follows, status: 'active' },
        ],
        links: [link('api', 'users'), link('api', 'posts'), link('api', 'follows')],
        flows: [
          { path: ['api', 'follows', 'api'], tone: 'request', label: '300 ids', duration: 1.4 },
          { path: ['api', 'posts'], tone: 'request', label: 'range scan x300', count: 5, duration: 1.4, delay: 1.5 },
          { path: ['posts', 'api'], tone: 'response', label: '12,000 rows', count: 5, duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Work per feed read',
          icon: 'Gauge',
          rows: [
            { text: 'Index range scans on posts', value: '300', tone: 'warn' },
            { text: 'Rows merged', value: '~12,000', tone: 'warn' },
            { text: 'Rows kept after sort', value: '20' },
          ],
        },
        caption: 'The merge and sort are repeated on every request',
      },
    },
    {
      title: 'Scatter-gather',
      tag: 'concept',
      heading: 'After sharding, the join becomes scatter-gather',
      eli5: 'Now the cabinets sit in three different buildings. The clerk phones all three and waits for the slowest one before writing the answer down.',
      body: [
        'When one machine is no longer enough, followees\' posts spread over many shards. The join becomes a **scatter-gather**: query every shard, wait for the slowest, merge in the app.',
        'Many distributed stores offer no joins at all for this reason.',
      ],
      keyIdea: 'Across shards a join costs one request per shard, and the slowest shard sets your latency.',
      metrics: { read: '1,200 ms', rows: '~12,300', writes: '1', copies: '1' },
      metricTones: { read: 'bad' },
      scene: {
        zones: [
          { id: 'sa', from: [-1.4, 2.6], to: [0.4, 4.4], label: 'shard 1', tone: 'blue' },
          { id: 'sb', from: [0.6, 0.6], to: [2.4, 2.4], label: 'shard 2', tone: 'amber' },
          { id: 'sc', from: [2.6, -1.4], to: [4.4, 0.4], label: 'shard 3', tone: 'violet' },
        ],
        nodes: [
          { ...api, status: 'hot', badge: 'merge + sort' },
          { id: 's1', kind: 'shard', at: at(-4, 3), label: 'posts A to H' },
          { id: 's2', kind: 'shard', at: at(0, 3), label: 'posts I to P', status: 'hot', badge: 'slowest: 900 ms' },
          { id: 's3', kind: 'shard', at: at(4, 3), label: 'posts Q to Z' },
        ],
        links: [link('api', 's1'), link('api', 's2'), link('api', 's3')],
        flows: [
          { path: ['api', 's1'], tone: 'request', label: 'scatter', duration: 1 },
          { path: ['api', 's2'], tone: 'request', duration: 1 },
          { path: ['api', 's3'], tone: 'request', duration: 1 },
          { path: ['s1', 'api'], tone: 'response', duration: 1, delay: 1.2 },
          { path: ['s3', 'api'], tone: 'response', duration: 1, delay: 1.4 },
          { path: ['s2', 'api'], tone: 'response', label: 'gather', duration: 2.4, delay: 1.6 },
        ],
        panel: {
          title: 'Latency of one feed read',
          icon: 'Clock',
          rows: [
            { text: 'Shard 1', value: '120 ms' },
            { text: 'Shard 3', value: '180 ms' },
            { text: 'Shard 2 (slowest)', value: '900 ms', tone: 'bad' },
          ],
          footer: { text: 'The read waits for shard 2', tone: 'bad' },
        },
        caption: 'Wait for the slowest shard, then merge',
      },
    },
    {
      title: 'Read:write ratio',
      tag: 'concept',
      heading: 'The deciding question: who runs more often?',
      eli5: 'The school writes one note a day but reads it out loud to a hundred pupils. It is wiser to do the hard work once at writing time than a hundred times at reading time.',
      body: [
        'Feeds are read about **100 times for every post written**. At 10,000 reads per second there are roughly 100 posts per second.',
        'Paying the conversion cost on the read side means paying it on the busy side. Move the work to the rarer side of the ratio.',
      ],
      keyIdea: 'Compare how often data is read with how often it changes, and put the work on the rarer side.',
      metrics: { read: '1,200 ms', rows: '~12,300', writes: '1', copies: '1' },
      scene: {
        nodes: [
          { ...reader, label: 'readers', chips: ['10,000 GET /feed per s'] },
          { ...api, status: 'hot', load: 96 },
          { id: 'author', kind: 'phone', at: at(-4, 3), label: 'authors', sub: 'write posts', chips: ['100 POST /posts per s'] },
          { ...posts, status: 'active' },
        ],
        links: [link('reader', 'api'), link('api', 'posts'), link('author', 'posts')],
        flows: [
          { path: ['reader', 'api', 'posts'], tone: 'request', label: '10,000 reads', count: 6, duration: 1.4 },
          { path: ['author', 'posts'], tone: 'data', label: '100 writes', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Per second',
          icon: 'Scale',
          rows: [
            { text: 'Feed reads', value: '10,000', tone: 'warn' },
            { text: 'Posts written', value: '100' },
            { text: 'Read : write', value: '100 : 1', tone: 'warn' },
          ],
          footer: { text: 'Do the work where it happens less', tone: 'muted' },
        },
        caption: 'The read side is the busy side',
      },
    },
    {
      title: 'Denormalize',
      tag: 'concept',
      heading: 'Denormalization: copy the data to where it is read',
      eli5: 'To save trips to the pupil cards, the clerk writes each pupil\'s name right on every piece of homework. Reading a page is faster, because the name is already there.',
      body: [
        '**Denormalization** stores a fact in more than one place on purpose, so a read can skip a join. Copy the author\'s `name` and `avatar_url` into each post row, and the feed no longer touches `users`.',
        'Reads get cheaper. Writes get more expensive, because every copy now has to be kept correct by your code.',
      ],
      keyIdea: 'Denormalizing moves work from read time to write time. Do it for the fields a hot read path needs, and nothing more.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1', copies: '1 + one per post' },
      metricTones: { read: 'warn', copies: 'warn' },
      scene: {
        nodes: [
          reader,
          { ...api, status: 'active' },
          { ...users, status: 'dim', badge: 'skipped' },
          { ...posts, status: 'active', badge: '+ author_name, avatar' },
          follows,
        ],
        links: [link('reader', 'api'), link('api', 'follows'), link('api', 'posts'), link('users', 'posts', { style: 'dashed', label: 'copied in' })],
        flows: [
          { path: ['reader', 'api'], tone: 'request', duration: 0.9 },
          { path: ['api', 'follows'], tone: 'request', duration: 1.1, delay: 1 },
          { path: ['api', 'posts'], tone: 'request', count: 4, duration: 1.2, delay: 2.1 },
          { path: ['posts', 'api', 'reader'], tone: 'response', label: 'posts with names', duration: 1.6, delay: 3.4 },
        ],
        panel: {
          title: 'The trade',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Join with users', value: 'gone', tone: 'good' },
            { text: 'Feed read', value: '1,200 to 800 ms', tone: 'good' },
            { text: 'Copies of a name', value: 'one per post', tone: 'warn' },
          ],
        },
        caption: 'The name travels with the post',
      },
    },
    {
      title: 'Forms of copying',
      tag: 'concept',
      heading: 'Denormalization takes three common shapes',
      eli5: 'The clerk can write the name on each homework sheet, keep a running tally on the noticeboard, or staple the first three comments to the page. Each saves a trip to the cabinets.',
      body: [
        'A **copied field** (`author_name`). A **counter** such as `like_count`, so no `COUNT(*)` over a `likes` table. An **embedded list**, such as the first three comments stored on the post.',
        'Each removes a join or an aggregate from the read and adds a write that must keep it correct. In a document database this is the normal style: one document holds what one screen needs.',
      ],
      keyIdea: 'Copy a field, keep a counter, or embed a short list. Each is a read shortcut with a write to maintain it.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1', copies: '1 + one per post' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { ...posts, status: 'ok', chips: ['author_name', 'like_count', 'comments[3]'] },
          { id: 'likes', kind: 'db', at: at(4, 3), label: 'likes', sub: '9B rows', status: 'dim', badge: 'no COUNT(*)' },
        ],
        links: [link('api', 'posts'), link('likes', 'posts', { style: 'dashed', label: '+1 on like' })],
        flows: [
          { path: ['api', 'posts', 'api'], tone: 'request', label: 'one row, whole screen', duration: 1.6 },
          { path: ['likes', 'posts'], tone: 'data', label: 'like_count + 1', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Shapes of denormalization',
          icon: 'Copy',
          rows: [
            { text: 'Copied field', value: 'author_name' },
            { text: 'Counter', value: 'like_count' },
            { text: 'Embedded list', value: 'comments[3]' },
          ],
          footer: { text: 'Each one is a write you now own', tone: 'warn' },
        },
        caption: 'Everything the screen needs is on the post',
      },
    },
    {
      title: 'Rename anomaly',
      tag: 'case',
      heading: 'Case: the rename that only half happened',
      eli5: 'A pupil changes her name. Her office card is fixed in a second, but her old name is still written on 40,000 homework sheets. For a while, some pages say one name and some say the other.',
      body: [
        'Mina renames herself. Her name is also copied into 40,000 posts. The app updates `users`, then starts on the posts, and crashes a third of the way through.',
        'This is an **update anomaly**: copies of one fact that disagree. Readers see the new name on her profile and the old one on most posts.',
      ],
      keyIdea: 'Every copy is a promise to update it. Half-finished updates leave copies that disagree.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1 + 40,000 on rename', copies: '40,001' },
      metricTones: { writes: 'bad', copies: 'bad' },
      scene: {
        nodes: [
          { ...reader, label: 'Mina', sub: 'renames herself' },
          { ...api, sub: 'profile API', status: 'hot', badge: 'crashed mid-update' },
          { ...users, status: 'ok', badge: 'new name' },
          { ...posts, status: 'hot', badge: '13,000 new, 27,000 old' },
        ],
        links: [link('reader', 'api'), link('api', 'users'), link('api', 'posts')],
        flows: [
          { path: ['reader', 'api', 'users'], tone: 'request', label: 'rename', duration: 1.4 },
          { path: ['api', 'posts'], tone: 'data', label: 'update 40,000 copies', count: 4, duration: 1.4, delay: 1.5 },
          { path: ['posts', 'api'], tone: 'error', label: 'interrupted', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Mina\'s name after the crash',
          icon: 'Users',
          rows: [
            { text: 'users row', value: 'Mina K.', tone: 'good' },
            { text: 'Posts updated', value: '13,000', tone: 'good' },
            { text: 'Posts still old', value: '27,000', tone: 'bad' },
          ],
        },
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
      title: 'More anomalies',
      tag: 'concept',
      heading: 'Insert and delete anomalies',
      eli5: 'A new pupil joins, but nobody writes her name on her first homework sheet. Another pupil leaves, yet her name stays on old sheets. Both leave the office and the sheets out of step.',
      body: [
        'An **insert anomaly** is a copy that was never written: a post saved without its `author_name`. A **delete anomaly** is a copy left behind after the original is gone: a deleted account whose name still shows on posts.',
        'Update, insert and delete anomalies are all the same failure: a copy and its source disagree.',
      ],
      keyIdea: 'Three ways a copy goes wrong: it is changed late, never written, or never removed.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1', copies: '40,001' },
      metricTones: { copies: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'active', sub: 'post API' },
          { ...users, status: 'ok', badge: 'row deleted' },
          { ...posts, status: 'hot', chips: [{ text: 'author_name: null', tone: 'bad' }, { text: 'author_name: Ghost', tone: 'bad' }] },
        ],
        links: [link('api', 'posts'), link('users', 'posts', { style: 'dashed', label: 'copy' })],
        flows: [
          { path: ['api', 'posts'], tone: 'request', label: 'insert, name missed', duration: 1.4 },
          { path: ['users', 'posts'], tone: 'error', label: 'delete never reached', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Three anomalies',
          icon: 'Bug',
          rows: [
            { text: 'Update', value: 'copy is stale', tone: 'bad' },
            { text: 'Insert', value: 'copy never written', tone: 'bad' },
            { text: 'Delete', value: 'copy left behind', tone: 'bad' },
          ],
        },
        caption: 'The copy and its source disagree',
      },
    },
    {
      title: 'Defenses',
      tag: 'concept',
      heading: 'Keep one source of truth and propagate changes',
      eli5: 'The office card stays the one true record. A helper reads each change and walks it out to the sheets, and tries again if a door is locked. Sheets may be a little late, never lost.',
      body: [
        'Keep the normalized row as the **source of truth**. Save the event in the same transaction as the change (a **transactional outbox**) or read the database log (**change-data-capture**), so a crash cannot lose it.',
        'Consumers retry, so make them **idempotent**: key feed rows on `(user_id, post_time, post_id)` and apply counters by event ID. Expect lag, never loss.',
      ],
      keyIdea: 'One owner, a reliable event, idempotent consumers. Expect lag, never loss or double counting.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1 + 40,000 on rename', copies: '40,001, async' },
      metricTones: { copies: 'warn' },
      scene: {
        nodes: [
          { ...users, status: 'ok', badge: 'source of truth' },
          { id: 'sync', kind: 'block', at: at(0, 3), label: 'sync job', sub: 'retries until done', icon: 'Repeat', tint: 'teal', status: 'active' },
          { ...posts, at: at(4, 3), status: 'active', badge: 'derived copies' },
        ],
        links: [link('users', 'sync', { style: 'dashed', label: 'change stream' }), link('sync', 'posts')],
        flows: [
          { path: ['users', 'sync'], tone: 'event', label: 'name changed', duration: 1.4 },
          { path: ['sync', 'posts'], tone: 'data', label: 'update copies', count: 4, duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Rules for a copy',
          icon: 'Shield',
          rows: [
            { text: 'Owner', value: 'users row', tone: 'good' },
            { text: 'Event leaves via', value: 'outbox or CDC', tone: 'good' },
            { text: 'Update path', value: 'async, retried', tone: 'good' },
            { text: 'Consumers', value: 'idempotent', tone: 'good' },
            { text: 'Copy only fields that', value: 'rarely change', tone: 'good' },
          ],
        },
        caption: 'Copies follow the source, a little late',
      },
    },
    {
      title: 'Snapshots',
      tag: 'case',
      heading: 'Case: some copies should never be updated',
      eli5: 'The shop writes the price on your receipt. If the price changes tomorrow, your receipt must still show what you paid. That copy is meant to stay old.',
      body: [
        'An order should keep the price that was charged, whatever the product costs today. That is a **snapshot**: a copy taken on purpose at one moment and never synced.',
        'Addresses on shipped orders and tax rates on invoices work the same way. Ask of each copy: should it follow the source, or freeze it?',
      ],
      keyIdea: 'A snapshot is a copy that records history. Do not sync it, and do not mistake it for a stale copy.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1', copies: 'frozen at purchase' },
      metricTones: { copies: 'good' },
      scene: {
        nodes: [
          { id: 'products', kind: 'db', at: at(-4, 3), label: 'products', sub: 'price now $15', status: 'ok', badge: 'was $12' },
          { id: 'checkout', kind: 'block', at: at(0, -3), label: 'checkout', icon: 'ShoppingBag', tint: 'green' },
          { id: 'orders', kind: 'db', at: at(4, 3), label: 'orders', sub: 'order 9001', status: 'ok', badge: 'price_paid $12' },
        ],
        links: [link('checkout', 'products'), link('checkout', 'orders')],
        flows: [
          { path: ['checkout', 'products', 'checkout'], tone: 'request', label: 'price? $12', duration: 1.6 },
          { path: ['checkout', 'orders'], tone: 'data', label: 'save price_paid', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Order 9001 after a price change',
          icon: 'Receipt',
          rows: [
            { text: 'products.price', value: '$15' },
            { text: 'orders.price_paid', value: '$12', tone: 'good' },
          ],
          footer: { text: 'The receipt must not change', tone: 'good' },
        },
        caption: 'This copy is history, not a cache',
      },
    },
    {
      title: 'Materialized view',
      tag: 'concept',
      heading: 'Materialized views: let the database keep the copy',
      eli5: 'The office pins a noticeboard with "posts per pupil this week", the **materialized view**. Nobody recounts the cards for each question. Reading the board is instant.',
      body: [
        'A normal view is a saved query that runs on each read. A **materialized view** stores the query\'s result on disk like a table. Reading it is a plain indexed lookup, however costly the query was.',
        'The profile page shows each author\'s post count, total likes and last post time. From 2 billion posts that takes seconds. As a view it is one row per author, read in a millisecond.',
      ],
      keyIdea: 'A materialized view is denormalization with the database doing the bookkeeping.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1', copies: 'managed by the DB' },
      scene: {
        nodes: [
          { ...reader, sub: 'opens a profile' },
          { ...api, sub: 'profile API', status: 'active' },
          { id: 'mview', kind: 'block', at: at(4, -3), label: 'author_stats', sub: 'materialized view', icon: 'Table', tint: 'green', status: 'ok', badge: '1 row per author' },
          { ...posts, at: at(4, 3), badge: '2B source rows' },
        ],
        links: [link('reader', 'api'), link('api', 'mview'), link('posts', 'mview', { style: 'dashed', label: 'refresh every 5 min' })],
        flows: [
          { path: ['reader', 'api', 'mview'], tone: 'request', label: 'stats for author 7', duration: 1.5 },
          { path: ['mview', 'api', 'reader'], tone: 'response', label: '1 ms', duration: 1.5, delay: 1.6 },
          { path: ['posts', 'mview'], tone: 'data', label: 'recompute', count: 3, duration: 2, delay: 3.3 },
        ],
        panel: {
          title: 'Profile stats: two ways',
          icon: 'Timer',
          rows: [
            { text: 'Aggregate 2B posts live', value: 'seconds', tone: 'bad' },
            { text: 'Read the stored row', value: '1 ms', tone: 'good' },
          ],
        },
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
      title: 'Refresh',
      tag: 'tradeoff',
      heading: 'Freshness: how new is the stored result?',
      eli5: 'The noticeboard is only as new as the last time a clerk rewrote it. Rewrite it often and it is fresher but the clerk is busy. Rewrite it rarely and it is cheap but old.',
      body: [
        'The stored result is only as new as its last **refresh**. Some databases recompute everything on a schedule or on demand. Others maintain the view incrementally as base rows change.',
        'You chose a derived copy with known staleness. A full refresh over 2 billion rows is costly, so match the interval to the staleness users accept.',
      ],
      keyIdea: 'A materialized view trades freshness for read speed. Pick the refresh strategy by how stale is acceptable.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1', copies: 'up to 5 min old' },
      metricTones: { copies: 'warn' },
      scene: {
        nodes: [
          { ...posts, at: at(-4, 3), status: 'active', badge: 'new post at 10:02' },
          { id: 'cron', kind: 'block', at: at(0, 3), label: 'refresh job', sub: 'every 5 min', icon: 'Clock', tint: 'amber' },
          { id: 'mview', kind: 'block', at: at(4, 3), label: 'author_stats', sub: 'materialized view', icon: 'Table', tint: 'green', status: 'ok', badge: 'shows 10:00' },
        ],
        links: [link('posts', 'cron', { style: 'dashed' }), link('cron', 'mview', { label: 'recompute', labelTone: 'warn' })],
        flows: [
          { path: ['posts', 'cron'], tone: 'data', label: 'scan', count: 3, duration: 1.6 },
          { path: ['cron', 'mview'], tone: 'data', label: 'swap in result', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Refresh strategies',
          icon: 'Repeat',
          rows: [
            { text: 'Full, on a schedule', value: 'minutes stale' },
            { text: 'CONCURRENTLY', value: 'readers not blocked', tone: 'good' },
            { text: 'Incremental', value: 'seconds stale', tone: 'good' },
            { text: 'Full over 2B rows', value: 'heavy', tone: 'warn' },
          ],
        },
        caption: 'The board shows 10:00 until the next refresh',
      },
    },
    {
      title: 'Summary tables',
      tag: 'concept',
      heading: 'No materialized views? Build the table yourself',
      eli5: 'Some schools have no noticeboard clerk. So a helper keeps a tally sheet and adds one tick for every new note that arrives, so the totals are always close.',
      body: [
        'Not every database has them: MySQL does not. A **summary table** is the same idea built by hand, a plain table such as `author_stats` that your own code keeps up to date.',
        'A scheduled job can rebuild it, or a consumer of the change stream can add to it within seconds. A compacted stream topic keeps the latest value per key, like a changelog for the view.',
      ],
      keyIdea: 'A summary table is a materialized view you maintain: a job rebuilds it, or a stream consumer updates it.',
      metrics: { read: '800 ms', rows: '~12,000', writes: '1 + 1 tick', copies: 'seconds old' },
      scene: {
        nodes: [
          { ...posts, at: at(-4, 3), status: 'active' },
          { id: 'stream', kind: 'queue', at: at(0, 3), label: 'change stream', sub: 'every insert' },
          { id: 'tally', kind: 'storage', at: at(4, 3), label: 'author_stats', sub: 'summary table', status: 'ok', badge: 'post_count + 1' },
        ],
        links: [link('posts', 'stream', { style: 'dashed' }), link('stream', 'tally')],
        flows: [
          { path: ['posts', 'stream'], tone: 'event', label: 'post created', duration: 1.2 },
          { path: ['stream', 'tally'], tone: 'data', label: '+1 for author 7', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Who keeps it fresh',
          icon: 'Workflow',
          rows: [
            { text: 'Scheduled job', value: 'minutes' },
            { text: 'Stream consumer', value: 'seconds', tone: 'good' },
            { text: 'Trigger on write', value: 'instant, slows writes', tone: 'warn' },
            { text: 'Retried event', value: 'applied once, by event ID', tone: 'good' },
          ],
        },
        caption: 'Same idea, kept by your code',
      },
    },
    {
      title: 'Access patterns',
      tag: 'concept',
      heading: 'NoSQL modeling: start from the queries',
      eli5: 'A new school has no clerk who can cross-check cabinets. So it builds one drawer for each question people ask. "Show my feed" gets its own drawer, already in the right order.',
      body: [
        'In a relational database you model entities first and write queries later. In a wide-column or key-value store the order flips. Joins are missing or impractical, so you list the **access patterns** first and build a table for each.',
        'For "newest 20 posts in a reader\'s feed" the table is `feed_by_user`, carrying the author name and a snippet in each row. The same post appears in many tables. Here duplication is the design.',
      ],
      keyIdea: 'In NoSQL, write down the queries first, then give each one a table that answers it in a single read.',
      metrics: { read: '5 ms', rows: '20', writes: '1 per table', copies: 'one per feed row' },
      metricTones: { read: 'good', rows: 'good' },
      scene: {
        nodes: [
          reader,
          { ...api, status: 'active' },
          { ...feeds, status: 'ok', badge: 'user 42: 20 newest rows' },
        ],
        links: [link('reader', 'api'), link('api', 'feeds')],
        flows: [
          { path: ['reader', 'api'], tone: 'request', label: 'GET /feed', duration: 0.9 },
          { path: ['api', 'feeds'], tone: 'request', label: 'partition 42, LIMIT 20', duration: 1.1, delay: 1 },
          { path: ['feeds', 'api', 'reader'], tone: 'response', label: 'ready-made feed', duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Access pattern, then table',
          icon: 'Table',
          rows: [
            { text: 'Newest 20 posts for a reader', value: 'feed_by_user' },
            { text: 'Posts by one author', value: 'posts_by_author' },
            { text: 'Followers of one account', value: 'followers_by_user' },
          ],
          footer: { text: 'One query, one table', tone: 'muted' },
        },
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
      title: 'Keys',
      tag: 'concept',
      heading: 'Partition key and sort key decide the read',
      eli5: 'Each drawer has a label on the front (which pupil) and the notes inside are stacked by date. Finding "Mina\'s newest notes" means opening one drawer and taking from the top.',
      body: [
        'The **partition key** decides which node holds the rows and is what you look up by. The **sort key** (clustering key) orders rows inside a partition. A good read hits one partition and takes a contiguous slice.',
        'Choose a key with many values, such as `user_id`. A key like `country` piles millions of rows on one node: a **hot partition**.',
      ],
      keyIdea: 'Partition by a key with many values and sort by what you slice on. A low-cardinality key creates a hot partition.',
      metrics: { read: '5 ms', rows: '20', writes: '1 per table', copies: 'one per feed row' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { ...feeds, status: 'ok', badge: 'PK user_id: spread evenly' },
          { id: 'bycountry', kind: 'shard', at: at(0, 3), label: 'feed_by_country', sub: 'PK country', status: 'hot', load: 97, badge: 'hot partition' },
        ],
        links: [link('api', 'feeds'), link('api', 'bycountry', { label: 'all US traffic', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'feeds'], tone: 'request', label: 'user 42', duration: 1.2 },
          { path: ['api', 'bycountry'], tone: 'error', label: 'country = US', count: 5, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Primary key anatomy',
          icon: 'Key',
          code: 'PRIMARY KEY ((user_id), post_time)\n          ^^^^^^^  ^^^^^^^^^\n          partition  sort within\n          (which node)  the partition',
          footer: { text: 'Many values spread load. Few values pile it up.', tone: 'muted' },
        },
        caption: 'The key is the layout of the data',
      },
    },
    {
      title: 'Embed or link',
      tag: 'concept',
      heading: 'Documents: embed what is read together',
      eli5: 'If a recipe card always needs its three photos, glue them to the card. If a photo belongs to hundreds of cards, keep it in a drawer and write down where it is.',
      body: [
        '**Embed** data that is read together, changes together and stays small: a post with its top 3 comments. **Reference** (store an ID) when the child is large, shared, or grows without limit: all the comments on a viral post.',
        'Embedding gives one read per screen. Referencing keeps documents small and one source of truth for the shared part.',
      ],
      keyIdea: 'Embed small things read together. Reference things that are shared or unbounded.',
      metrics: { read: '5 ms', rows: '1 document', writes: '1', copies: 'embedded copies' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { id: 'postdoc', kind: 'db', at: at(-4, 3), label: 'post doc', sub: 'top 3 comments embedded', status: 'ok', badge: '1 read' },
          { id: 'comments', kind: 'db', at: at(4, 3), label: 'comments', sub: 'own collection', status: 'active', badge: 'millions' },
        ],
        links: [link('api', 'postdoc', { label: '1 read' }), link('api', 'comments', { label: 'by post_id' })],
        flows: [
          { path: ['api', 'postdoc', 'api'], tone: 'request', label: 'post + top 3', duration: 1.5 },
          { path: ['api', 'comments', 'api'], tone: 'request', label: 'next page of comments', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'post document',
          icon: 'FileJson',
          code: '{ "id": 501,\n  "author_id": 7,\n  "body": "...",\n  "top_comments": [\n    {"id": 1, "text": "..."}\n  ] }\n// rest: comments where post_id = 501',
          footer: { text: 'Top 3 embedded, the rest linked by post_id', tone: 'muted' },
        },
        caption: 'Glue the small parts, link the big ones',
      },
      quiz: {
        question: 'A post document could hold its comments in an array. Comments on viral posts reach millions. What is the better model?',
        options: [
          'Embed all comments in the post document',
          'Store comments in their own collection keyed by post_id and page through them',
          'Copy each comment into every reader\'s feed row',
          'Drop the comments, since documents cannot reference one another',
        ],
        answer: 1,
        explain: 'An unbounded child makes a document huge and slow to rewrite. A separate collection keyed by post_id reads one page at a time and keeps the post small.',
      },
    },
    {
      title: 'Fan-out on write',
      tag: 'concept',
      heading: 'Fan-out on write: a materialized view you maintain yourself',
      eli5: 'When a pupil writes a note, a helper walks down the hall and drops a copy into the cubby of every friend. Later, each friend just opens their own cubby. Nobody visits the office.',
      body: [
        'When Mina posts, the post is saved once in `posts` (the source of truth) and an event goes to a **fan-out worker**. The worker looks up her followers and inserts one row into each follower\'s feed partition.',
        'It is asynchronous, so the author\'s "post saved" does not wait for it. Followers see the post a moment later.',
      ],
      keyIdea: 'Fan-out on write precomputes each reader\'s feed at post time, so the hot read path does no joining at all.',
      metrics: { read: '5 ms', rows: '20', writes: '301', copies: 'one per feed row' },
      metricTones: { read: 'good', writes: 'warn' },
      scene: {
        nodes: [
          { ...reader, label: 'Mina', sub: 'publishes a post' },
          { ...api, sub: 'post API', status: 'active' },
          { ...posts, status: 'ok', badge: '1 row: source of truth' },
          { ...worker, status: 'active', badge: '300 followers' },
          { ...feeds, status: 'active', badge: '+1 row in 300 partitions' },
        ],
        links: [link('reader', 'api'), link('api', 'posts'), link('posts', 'worker', { style: 'dashed', label: 'event' }), link('worker', 'feeds')],
        flows: [
          { path: ['reader', 'api', 'posts'], tone: 'request', label: 'new post', duration: 1.5 },
          { path: ['posts', 'worker'], tone: 'event', label: 'post created', duration: 1.2, delay: 1.6 },
          { path: ['worker', 'feeds'], tone: 'data', label: 'insert', count: 6, duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'One post from Mina',
          icon: 'Copy',
          rows: [
            { text: 'Row in posts', value: '1' },
            { text: 'Feed rows (300 followers)', value: '300' },
            { text: 'Writes in total', value: '301', tone: 'warn' },
            { text: 'Feed read afterwards', value: '5 ms', tone: 'good' },
            { text: 'Event leaves via', value: 'outbox or CDC' },
          ],
        },
        caption: 'One post in, 300 feed rows out',
      },
    },
    {
      title: 'The bill',
      tag: 'tradeoff',
      heading: 'Read cost against write cost',
      eli5: 'Copying a note into 300 cubbies is fine. Copying the head teacher\'s note into 5 million cubbies takes all day. For her, it is smarter to pin one copy on the wall and let everyone look when they pass.',
      body: [
        'The raw operation count does not fall: 100 posts/s x 301 is about **30,000 row inserts/s**, three times the 10,000 reads/s. It pays because a keyed insert is far cheaper than the 1.2 s join each read paid before.',
        'An account with 5 million followers turns one post into **5 million feed writes** and the queue backs up. The opposite, **fan-out on read**, stores nothing extra and pays the join on every read (step 1).',
      ],
      keyIdea: 'Precompute when reads far outnumber writes and the fan-out is bounded. Compute at read time when one write would touch millions of copies.',
      metrics: { read: '5 ms', rows: '20', writes: '301 typical, 5M for a star', copies: 'unbounded for a star' },
      metricTones: { writes: 'bad', copies: 'bad' },
      scene: {
        nodes: [
          { ...reader, label: 'star account', sub: '5M followers' },
          { ...api, sub: 'post API' },
          { ...posts, status: 'ok', badge: '1 row' },
          { ...worker, status: 'hot', load: 99, badge: '5,000,000 followers' },
          { ...feeds, badge: 'would get 5M rows', status: 'dim' },
        ],
        links: [link('reader', 'api'), link('api', 'posts'), link('posts', 'worker', { style: 'dashed' }), link('worker', 'feeds', { style: 'faint', label: '5M writes', labelTone: 'warn' })],
        flows: [
          { path: ['reader', 'api', 'posts'], tone: 'request', label: 'new post', duration: 1.5 },
          { path: ['posts', 'worker'], tone: 'event', duration: 1, delay: 1.6 },
          { path: ['worker', 'feeds'], tone: 'error', label: '5M writes? no', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'Writes per post',
          icon: 'Copy',
          rows: [
            { text: 'Ordinary: 100 posts/s x 301', value: '~30K inserts/s', tone: 'warn' },
            { text: 'Reads: 10K/s x 1.2 s join', value: 'saved', tone: 'good' },
            { text: 'Ordinary account (300)', value: '301' },
            { text: 'Star account (5M)', value: '5,000,001', tone: 'bad' },
            { text: 'Delivery lag for the star', value: 'minutes', tone: 'bad' },
          ],
        },
        caption: 'Some writes are too wide to fan out',
      },
    },
    {
      title: 'Hybrid feed',
      tag: 'tradeoff',
      heading: 'Real feeds mix both, and need upkeep',
      eli5: 'Ordinary pupils drop notes into cubbies. The head teacher pins hers on the wall. When you open your cubby you also glance at the wall and put her note on top.',
      body: [
        'Ordinary accounts fan out on write. Very large ones are skipped, and their recent posts are fetched at read time and merged in.',
        'Upkeep: trim each partition to the newest 1,000 rows (or a TTL), fan out deletes and unfollows, and merge the author\'s own posts at read time. Fetch `author_name` at read time too, since a rename would touch millions of copies.',
      ],
      keyIdea: 'Fan out the many small accounts, pull the few huge ones at read time, and keep every feed trimmed and cleaned.',
      metrics: { read: '5 ms (+ merge)', rows: '20 + a few', writes: '301 typical, none for a star', copies: 'bounded' },
      metricTones: { read: 'good', writes: 'good' },
      scene: {
        nodes: [
          reader,
          { ...api, status: 'active', badge: 'merge two sources' },
          { ...feeds, status: 'ok', badge: 'ordinary posts' },
          { ...posts, status: 'ok', badge: 'star posts, read live' },
        ],
        links: [link('reader', 'api'), link('api', 'feeds'), link('api', 'posts')],
        flows: [
          { path: ['reader', 'api'], tone: 'request', label: 'GET /feed', duration: 1 },
          { path: ['api', 'feeds', 'api'], tone: 'request', label: '20 precomputed', duration: 1.4, delay: 1.1 },
          { path: ['api', 'posts', 'api'], tone: 'request', label: 'recent star posts', duration: 1.4, delay: 2.6 },
          { path: ['api', 'reader'], tone: 'response', label: 'merged feed', duration: 1, delay: 4.1 },
        ],
        panel: {
          title: 'Who goes where',
          icon: 'Split',
          rows: [
            { text: 'Under a follower limit', value: 'fan out on write', tone: 'good' },
            { text: 'Star accounts', value: 'pull on read', tone: 'good' },
            { text: 'Reader merges', value: 'a few star feeds' },
            { text: 'Old rows', value: 'trim to N or TTL' },
            { text: 'Delete, unfollow', value: 'fan out deletes' },
          ],
        },
        caption: 'Precomputed feed plus a live merge',
      },
    },
    {
      title: 'Star schema',
      tag: 'concept',
      heading: 'Analytics: denormalize on purpose, again',
      eli5: 'A report card sits in the middle with the number of lessons attended, and arrows to a few lists: pupils, subjects, days. It is wide and repeats names, but counting is fast.',
      body: [
        'A warehouse stores a central **fact table** (one row per sale) around denormalized **dimension tables** (customer, product, date). That layout is a **star schema**.',
        'Queries scan huge column ranges and join only a few wide tables. Normalized OLTP, denormalized OLAP: each fits its workload.',
      ],
      keyIdea: 'Transactional systems normalize for correct writes. Analytical systems denormalize for fast scans.',
      metrics: { read: '40 s to 2 s', rows: 'scan, not lookup', writes: 'batch loads', copies: 'dimensions repeat names' },
      scene: {
        nodes: [
          { id: 'fact', kind: 'warehouse', at: at(0, 0), label: 'sales fact', sub: '400M rows', status: 'active' },
          { id: 'dcust', kind: 'block', size: 0.72, at: at(-4, 0), label: 'customer', icon: 'Users', tint: 'blue' },
          { id: 'dprod', kind: 'block', size: 0.72, at: at(4, 0), label: 'product', icon: 'Package', tint: 'amber' },
          { id: 'ddate', kind: 'block', size: 0.72, at: at(0, -4.6), label: 'date', icon: 'Clock', tint: 'violet' },
          { id: 'dstore', kind: 'block', size: 0.72, at: at(0, 6), label: 'country', icon: 'Globe', tint: 'green' },
        ],
        links: [link('fact', 'dcust'), link('fact', 'dprod'), link('fact', 'ddate'), link('fact', 'dstore')],
        flows: [
          { path: ['ddate', 'fact'], tone: 'request', label: 'revenue by day', duration: 1.4 },
          { path: ['dstore', 'fact'], tone: 'request', label: 'by country', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'OLTP against OLAP',
          icon: 'Warehouse',
          rows: [
            { text: 'Schema', value: 'normalized | star' },
            { text: 'Reads', value: 'row lookups | big scans' },
            { text: 'Writes', value: 'many small | batch' },
          ],
        },
        caption: 'One wide fact table, a few flat dimensions',
      },
    },
    {
      title: 'Derived data',
      tag: 'concept',
      heading: 'Treat every copy as rebuildable',
      eli5: 'If the cubbies spill or a mistake is found, the helper does not panic. She reads the office log from the start and refills every cubby. The log never forgets.',
      body: [
        'Keep the source of truth and an ordered **change log**. Feed rows, summary tables and search indexes are all derived from it, and any of them can be rebuilt by replaying the log.',
        'That gives you **backfill** too: a new access pattern is a new derived table filled from history, with no change to the source.',
      ],
      keyIdea: 'Source of truth plus a log. Every copy is derived and disposable, so a bug in one is a rebuild, not a disaster.',
      metrics: { read: '5 ms', rows: '20', writes: '301', copies: 'derived, rebuildable' },
      metricTones: { copies: 'good' },
      scene: {
        nodes: [
          { ...posts, at: at(-4, 3), status: 'ok', badge: 'source of truth' },
          { id: 'log', kind: 'queue', at: at(0, 3), label: 'change log', sub: 'replayable' },
          { ...feeds, at: at(4, 3), badge: 'rebuilt from log' },
          { id: 'stats', kind: 'storage', at: at(0, -3), label: 'author_stats', sub: 'summary table' },
        ],
        links: [link('posts', 'log', { style: 'dashed' }), link('log', 'feeds'), link('log', 'stats')],
        flows: [
          { path: ['posts', 'log'], tone: 'event', label: 'every change', duration: 1.2 },
          { path: ['log', 'feeds'], tone: 'data', label: 'replay', count: 4, duration: 1.4, delay: 1.3 },
          { path: ['log', 'stats'], tone: 'data', label: 'replay', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Derived from the log',
          icon: 'Repeat',
          rows: [
            { text: 'Feed rows', value: 'rebuildable', tone: 'good' },
            { text: 'Summary tables', value: 'rebuildable', tone: 'good' },
            { text: 'New access pattern', value: 'backfill', tone: 'good' },
          ],
        },
        caption: 'Copies are disposable, the log is not',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Store the truth once, and the answers where they are read',
      eli5: 'Keep one true card for every pupil in the office. Then make as many handy copies as your busiest questions need, and remember that every copy has to be kept up to date.',
      body: [
        '**Normalize** the system of record. When a hot read path pays too much for joins, **denormalize** for that path or let the database keep a **materialized view**. Each copy needs an owner and a refresh, and it will lag.',
        'In NoSQL, design a table per **access pattern** around its keys. **Fan-out on write** cut the feed from 1,200 ms and 12,300 rows to 5 ms and 20 rows, for about 301 writes per post.',
      ],
      keyIdea: 'A data model is a choice about when to do the work. Do it on the side of the read/write ratio that happens less often.',
      metrics: { read: '5 ms', rows: '20', writes: '301', copies: 'derived, async' },
      metricTones: { read: 'good', rows: 'good', writes: 'warn' },
      scene: {
        nodes: [
          reader,
          { ...api, status: 'ok' },
          { ...feeds, status: 'ok' },
          { ...posts, status: 'ok' },
          { ...worker, status: 'ok' },
        ],
        links: [link('reader', 'api'), link('api', 'feeds'), link('posts', 'worker', { style: 'dashed' }), link('worker', 'feeds')],
        flows: [
          { path: ['reader', 'api', 'feeds'], tone: 'request', duration: 1.4 },
          { path: ['feeds', 'api', 'reader'], tone: 'response', label: '5 ms', duration: 1.4, delay: 1.5 },
          { path: ['posts', 'worker', 'feeds'], tone: 'data', count: 4, duration: 1.8, delay: 3 },
        ],
        panel: {
          title: 'The whole lesson',
          icon: 'Layers',
          rows: [
            { text: 'System of record', value: 'normalized', tone: 'good' },
            { text: 'Hot read path', value: 'precomputed', tone: 'good' },
            { text: 'Every copy', value: 'owned, lagging', tone: 'warn' },
          ],
        },
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
