import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Layout: read lane on top (s = -3.5), graph and stores in the middle (s = 0), write lane at the bottom (s = 3.5).
const reader: SceneNode = { id: 'reader', kind: 'phone', at: at(-7, -3.8), label: 'reader', sub: 'opens the app' };
const author: SceneNode = { id: 'author', kind: 'phone', at: at(-7, 3.8), label: 'author', sub: 'writes a post' };
const star: SceneNode = { id: 'star', kind: 'user', at: at(-7, 3.8), label: 'pop star', sub: '40M followers' };
const gateway: SceneNode = { id: 'gateway', kind: 'block', at: at(-3.5, 0), label: 'API gateway', sub: 'auth, rate limits', icon: 'Network', tint: 'violet' };
const feedSvc: SceneNode = { id: 'feedSvc', kind: 'block', at: at(0, -3.8), label: 'feed service', icon: 'Rss', tint: 'blue' };
const postSvc: SceneNode = { id: 'postSvc', kind: 'block', at: at(0, 3.8), label: 'post service', icon: 'FileText', tint: 'amber' };
const feedCache: SceneNode = { id: 'feedCache', kind: 'cache', at: at(3.5, -3.8), label: 'feed cache', sub: '500 ids per reader' };
const graph: SceneNode = { id: 'graph', kind: 'db', at: at(3.5, 0), label: 'follow graph', sub: 'who follows whom' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(3.5, 3.8), label: 'fan-out queue' };
const workers: SceneNode = { id: 'workers', kind: 'worker', at: at(7, 3.8), label: 'fan-out workers' };
const postCache: SceneNode = { id: 'postCache', kind: 'cache', at: at(7, -3.8), label: 'post cache', sub: 'posts, users, counts' };
const postDb: SceneNode = { id: 'postDb', kind: 'db', at: at(10.5, 0), label: 'post store', sub: 'sharded by author' };
const storage: SceneNode = { id: 'storage', kind: 'storage', at: at(3.5, 3.8), label: 'object storage', sub: 'photos, video' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designNewsFeed: Lesson = {
  id: 'design-news-feed',
  title: 'Design a news feed (part 1)',
  tagline: 'Build a home feed for 200 million daily users. Part 1 sizes the problem and chooses what to precompute: push posts to followers ahead of time, pull the celebrities.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Requirements, scale numbers and the two hot API calls',
    'The data model: posts, a follow graph in both directions, and a per-reader feed of ids',
    'Fan-out on read versus fan-out on write, with the math for both',
    'The celebrity problem and the hybrid push and pull design',
    'Skipping inactive readers and building their feed on return',
  ],
  metrics: [
    { key: 'reads', label: 'Feed reads', icon: 'Activity' },
    { key: 'latency', label: 'Feed p99', icon: 'Timer' },
    { key: 'fanout', label: 'Fan-out writes', icon: 'Share2' },
    { key: 'db', label: 'Store reads', icon: 'Database' },
    { key: 'cache', label: 'Feed cache', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A home feed for 200 million people a day',
      eli5: 'A town where everyone writes letters and reads letters from the people they follow. The **feed** is the stack each family finds when they open their mailbox, newest letters on top.',
      body: [
        'Users publish posts (text, photos, short videos) and open a **home feed** of recent posts from the accounts they follow, on web and mobile. A user follows up to 5,000 accounts, and some accounts have tens of millions of followers.',
        'The first version is newest first. Ranking, ads and comments come later. The target is a feed that loads in under **200 ms at p99**, stays available, and may be a few seconds stale.',
      ],
      keyIdea: 'A feed is a read of recent posts from everyone you follow. Scope it first: newest first, fast, available, a little stale is fine.',
      metrics: { reads: '?', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '?' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [reader, author, gateway, feedSvc, postSvc],
        links: [link('reader', 'gateway'), link('author', 'gateway'), link('gateway', 'feedSvc'), link('gateway', 'postSvc')],
        flows: [
          { path: ['author', 'gateway', 'postSvc'], tone: 'request', label: 'publish', duration: 1.6 },
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'open feed', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'What we are building',
          icon: 'List',
          rows: [
            { text: 'Publish', value: 'text, photo, video' },
            { text: 'Home feed', value: 'followed accounts' },
            { text: 'Order', value: 'newest first' },
            { text: 'Follows per user', value: 'up to 5,000' },
            { text: 'Feed load', value: 'p99 < 200 ms', tone: 'good' },
            { text: 'Freshness', value: 'seconds are fine', tone: 'muted' },
          ],
        },
        caption: 'Two paths: publish a post, read a feed',
      },
    },
    {
      title: 'Traffic',
      tag: 'concept',
      heading: 'Napkin math: how many reads and writes',
      eli5: 'Count the town first. Most families check their **mailbox** many times a day, but only a few write letters. So the town spends most of its time reading.',
      body: [
        '**200M daily users** open the feed about 10 times a day. That is 2 billion loads, about 23K a second on average and **70K/s at peak** (see the napkin math lesson).',
        'They publish 100M posts a day, about **1,200 a second**. The average user follows 300 accounts, and the average account has 300 followers.',
      ],
      keyIdea: 'Peak feed reads are about 70K/s against 1,200 posts/s. Reads dominate.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '?' },
      metricTones: { reads: 'warn' },
      scene: {
        nodes: [
          { ...reader, chips: ['10 loads a day'] },
          gateway,
          { ...feedSvc, chips: [{ text: '70K/s peak', tone: 'warn' }], load: 55 },
          { ...postSvc, chips: ['1.2K posts/s'], load: 8 },
        ],
        links: [link('reader', 'gateway'), link('gateway', 'feedSvc'), link('gateway', 'postSvc')],
        flows: [
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', count: 6, duration: 1.4 },
          { path: ['reader', 'gateway', 'postSvc'], tone: 'request', count: 1, duration: 1.4, delay: 0.5 },
        ],
        panel: {
          title: 'Traffic',
          icon: 'Gauge',
          rows: [
            { text: 'Daily users', value: '200M' },
            { text: 'Feed loads a day', value: '2 billion' },
            { text: 'Loads per second, average', value: '23K' },
            { text: 'Loads per second, peak', value: '70K', tone: 'warn' },
            { text: 'Posts a day', value: '100M' },
            { text: 'Posts per second', value: '1,200' },
          ],
        },
        caption: 'Many readers, few writers',
      },
    },
    {
      title: 'Storage',
      tag: 'concept',
      heading: 'Napkin math: how much we store',
      eli5: 'Each letter is a thin sheet, but one in five comes with a big photo stapled on. The sheets fit in a drawer. The photos need a whole warehouse.',
      body: [
        'Each post takes about 1 KB of text and metadata: **100 GB a day**. One post in five carries a photo of about 500 KB, which adds **10 TB a day** of media.',
        'Metadata goes in a sharded database. Media goes in **object storage** behind a CDN. Reads beat posts 20 to 1 on average and 60 to 1 at peak, so make reads cheap even if writes cost more.',
      ],
      keyIdea: 'Metadata is small, media is 100 times bigger. Keep them in different stores.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '?' },
      scene: {
        nodes: [
          { ...postSvc, status: 'active' },
          { ...storage, badge: '10 TB/day' },
          { ...postDb, badge: '100 GB/day' },
        ],
        links: [link('postSvc', 'postDb'), link('postSvc', 'storage', { style: 'dashed' })],
        flows: [
          { path: ['postSvc', 'postDb'], tone: 'data', label: '1 KB', duration: 1.5 },
          { path: ['postSvc', 'storage'], tone: 'data', label: '500 KB', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Storage growth',
          icon: 'HardDrive',
          rows: [
            { text: 'Post text and metadata', value: '100 GB/day' },
            { text: 'Photos, 1 post in 5', value: '10 TB/day' },
            { text: 'Metadata a year', value: '36 TB' },
            { text: 'Media a year', value: '3.6 PB', tone: 'warn' },
            { text: 'Reads to posts', value: '20:1 avg, 60:1 peak' },
          ],
        },
        caption: 'Small rows in a database, big files in object storage',
      },
    },
    {
      title: 'Publish API',
      tag: 'concept',
      heading: 'Publishing is one call with a rate limit',
      eli5: 'There is a window at the post office where you drop off a letter. If your photo is big, you first carry it to the warehouse yourself and only hand in its tag number.',
      body: [
        '`POST /v1/posts` publishes. The client first uploads any photo straight to object storage with a pre-signed URL (the object storage lesson), then sends the text plus the media keys.',
        'The API gateway checks the token and applies a **rate limit** per user, so one spam account cannot publish 1,000 posts a minute.',
      ],
      keyIdea: 'Upload media directly to object storage, then publish a small request that only carries the keys.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '?' },
      scene: {
        nodes: [
          { ...author, status: 'active', chips: ['POST /v1/posts'] },
          { ...gateway, status: 'active', badge: '10 posts/min/user' },
          postSvc,
          storage,
        ],
        links: [link('author', 'gateway'), link('gateway', 'postSvc'), link('author', 'storage', { style: 'dashed', label: 'pre-signed upload' })],
        flows: [
          { path: ['author', 'storage'], tone: 'data', label: 'photo', duration: 1.4 },
          { path: ['author', 'gateway', 'postSvc'], tone: 'request', label: 'text + media keys', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'POST /v1/posts',
          icon: 'Code',
          code: '{\n  "text": "First tomatoes",\n  "media_keys": ["m/81/0.jpg"]\n}\n\n201 Created\n{ "post_id": "7301958437128192512" }',
          footer: { text: 'Over the limit: 429 Too Many Requests', tone: 'muted' },
        },
        caption: 'Media goes around the app, text goes through it',
      },
    },
    {
      title: 'Read API',
      tag: 'concept',
      heading: 'Reading a page is one call with a cursor',
      eli5: 'At the other window you ask for your mail and get twenty letters at a time, with a **cursor** bookmark saying where you stopped.',
      body: [
        '`GET /v1/feed?limit=20&cursor=...` returns 20 fully built posts and an opaque `next_cursor`. Each post already includes the author name, avatar URL, like count and media URLs, so the app renders one page with one call.',
        'Follow and unfollow are small calls of their own. They change the follow graph, which the feed uses on every read and every publish.',
      ],
      keyIdea: 'Keep the hot API to two calls: publish a post, and read a page of the feed with a cursor.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '?' },
      scene: {
        nodes: [{ ...reader, status: 'active', chips: ['GET /v1/feed'] }, gateway, { ...feedSvc, status: 'active' }],
        links: [link('reader', 'gateway'), link('gateway', 'feedSvc')],
        flows: [
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'limit=20', duration: 1.5 },
          { path: ['feedSvc', 'gateway', 'reader'], tone: 'response', label: '20 posts + cursor', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'One page, one call',
          icon: 'Table',
          rows: [
            { text: 'Request', value: 'limit + cursor' },
            { text: 'Response', value: '20 built posts' },
            { text: 'Each post carries', value: 'author, likes, media' },
            { text: 'Round trips per page', value: '1', tone: 'good' },
          ],
        },
        caption: 'The app never assembles a post itself',
      },
      code: {
        language: 'json',
        title: 'GET /v1/feed?limit=20 (response, trimmed)',
        source: `{
  "posts": [
    {
      "post_id": "7301958437128192512",
      "author": { "id": "u_381", "name": "Maya Ortiz", "avatar": "https://cdn.example.com/a/381.jpg" },
      "text": "First tomatoes of the season",
      "media": ["https://cdn.example.com/p/7301958437128192512/0.jpg"],
      "likes": 42,
      "liked_by_me": false,
      "created_at": "2026-11-17T08:14:03Z"
    }
  ],
  "next_cursor": "eyJiZWZvcmUiOiI3MzAxOTU4NDM3MTI4MTkyNTEyIn0"
}`,
        highlight: [5, 7, 13],
      },
    },
    {
      title: 'Post store',
      tag: 'concept',
      heading: 'Posts get time-sortable ids and live by author',
      eli5: 'Every letter gets a number that only grows, so a bigger number always means a newer letter. All letters from one writer go on the same shelf.',
      body: [
        '**Posts** live in a store sharded by `author_id` (the sharding lesson), so one author\'s posts sit together. Each post gets a **time-sortable id** (the unique ID lesson), so sorting by id is sorting by time, and no shared counter is needed.',
        'An index on `(author_id, post_id DESC)` makes "the latest 20 posts by this author" a single range read.',
      ],
      keyIdea: 'Sharding by author keeps one author\'s posts together, and time-sortable ids make id order equal time order.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '?' },
      scene: {
        nodes: [author, { ...postSvc, status: 'active' }, { ...postDb, status: 'active', badge: '100 GB/day' }],
        links: [link('author', 'postSvc'), link('postSvc', 'postDb')],
        flows: [{ path: ['author', 'postSvc', 'postDb'], tone: 'data', label: 'INSERT post', duration: 2 }],
        panel: {
          title: 'A 64-bit post id',
          icon: 'Hash',
          rows: [
            { text: 'Timestamp', value: '41 bits' },
            { text: 'Machine', value: '10 bits' },
            { text: 'Sequence', value: '12 bits' },
            { text: 'Sort by id', value: 'sort by time', tone: 'good' },
          ],
        },
        caption: 'Newer post, bigger id',
      },
      code: {
        language: 'sql',
        title: 'Posts, sharded by author_id',
        source: `-- one row per post, sharded by author_id
CREATE TABLE posts (
  post_id     BIGINT PRIMARY KEY,   -- time-sortable 64-bit id
  author_id   BIGINT NOT NULL,
  body        TEXT,
  media_keys  TEXT[],               -- object storage keys, served via CDN
  deleted     BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX posts_by_author ON posts (author_id, post_id DESC);`,
        highlight: [3, 8],
      },
    },
    {
      title: 'Follow graph',
      tag: 'concept',
      heading: 'Store each follow edge in both directions',
      eli5: 'The town keeps two lists. One says who each family follows. The other says who follows each writer. Asking either question is one quick look.',
      body: [
        'The **follow graph** answers two questions: who does this reader follow, and who follows this author. Store the edge twice, once per direction, so both questions are a single indexed range read.',
        'A graph database works too, but this access pattern is simple enough for a key-value or SQL store. Follow and unfollow write both rows.',
      ],
      keyIdea: 'The feed asks the graph two questions. Storing the edge in both directions makes each one a single range read.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '?' },
      scene: {
        nodes: [feedSvc, { ...graph, status: 'active', badge: 'edges both ways' }, workers],
        links: [link('feedSvc', 'graph', { label: 'who do I follow?' }), link('workers', 'graph', { label: 'who follows author?' })],
        flows: [
          { path: ['feedSvc', 'graph'], tone: 'request', label: 'following', duration: 1.4 },
          { path: ['workers', 'graph'], tone: 'request', label: 'followers', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Two tables, one edge',
          icon: 'Users',
          rows: [
            { text: 'followers', value: '(author_id, follower_id)' },
            { text: 'following', value: '(reader_id, author_id)' },
            { text: 'Follow', value: '2 inserts' },
            { text: 'Unfollow', value: '2 deletes' },
          ],
        },
        caption: 'Same edge, two directions',
      },
      code: {
        language: 'sql',
        title: 'The follow graph',
        source: `-- the same edge stored in both directions
CREATE TABLE followers (author_id BIGINT, follower_id BIGINT,
                        PRIMARY KEY (author_id, follower_id));
CREATE TABLE following (reader_id BIGINT, author_id BIGINT,
                        PRIMARY KEY (reader_id, author_id));`,
        highlight: [2, 4],
      },
    },
    {
      title: 'Feed cache',
      tag: 'concept',
      heading: 'A feed is a short list of post ids',
      eli5: 'Each family\'s mailbox holds only a slip of letter numbers, the newest 500. The letters themselves stay on the big shelf, and the slip points to them.',
      body: [
        'The **feed cache** holds one sorted list per reader: the newest 500 post ids. The member is the id and the score is its creation time in ms, because a Redis score is a float exact only to 2^53 and a 63-bit id would lose digits. That is 8 KB per reader and about **1.6 TB raw** for 200M readers.',
        'Real Redis memory is about 5x larger (roughly 8 TB, about 128 shards). Feeds store pointers, posts store content (the data modeling lesson).',
      ],
      keyIdea: 'Store pointers, not posts: 500 ids per reader is small enough to keep every reader\'s feed in memory.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '?', db: '?', cache: '1.6 TB raw' },
      scene: {
        nodes: [feedSvc, { ...feedCache, status: 'active', badge: 'feed:{reader}' }, postCache, postDb],
        links: [link('feedSvc', 'feedCache'), link('feedCache', 'postCache', { style: 'dashed', label: 'ids point to posts' }), link('postCache', 'postDb', { style: 'faint' })],
        flows: [{ path: ['feedCache', 'postCache', 'postDb'], tone: 'data', label: 'post_id', duration: 2 }],
        panel: {
          title: 'Feed cache size',
          icon: 'Layers',
          rows: [
            { text: 'Ids per reader', value: '500' },
            { text: 'Bytes per entry', value: '16' },
            { text: 'Per reader', value: '8 KB' },
            { text: '200M readers', value: '1.6 TB raw', tone: 'warn' },
            { text: 'Real Redis memory, about 5x', value: '~8 TB', tone: 'warn' },
          ],
          footer: { text: 'Sharded Redis, about 128 shards', tone: 'muted' },
        },
        caption: 'Feeds store pointers, posts store content',
      },
      code: {
        language: 'sql',
        title: 'A feed in Redis (sorted set)',
        source: `-- feed cache in Redis, one sorted set per reader
-- score = created_at in ms (fits 2^53), member = post id
ZADD feed:{reader_id} {created_ms} {post_id}
-- newest 20
ZREVRANGE feed:{reader_id} 0 19`,
        highlight: [3, 5],
      },
    },
    {
      title: 'Pull design',
      tag: 'concept',
      heading: 'First version: build the feed when it is read',
      eli5: 'When a family asks for mail, the clerk looks up all 300 people they follow, walks to each writer\'s shelf, grabs the newest letters and sorts them on the spot. That is **fan-out on read**.',
      body: [
        'The feed service reads the reader\'s 300 followees from the graph, asks the post store for the newest posts of each, merges them by id, and returns the top 20. Publishing is one insert. This is **fan-out on read**, also called the pull model.',
        'It has real strengths. Posts show up the instant they are written, an unfollow takes effect at once, and nobody does work for users who never log in. For a product with 100K users it is the right first build.',
      ],
      keyIdea: 'Fan-out on read makes writes trivial and pushes all the work into every feed load.',
      metrics: { reads: '2K/s (early days)', latency: '120 ms', fanout: '0', db: '600K/s', cache: '-' },
      metricTones: { latency: 'good', fanout: 'good' },
      scene: {
        nodes: [reader, gateway, { ...feedSvc, status: 'active', badge: 'merge 300 lists' }, { ...graph, status: 'active' }, { ...postDb, status: 'active' }],
        links: [link('reader', 'gateway'), link('gateway', 'feedSvc'), link('feedSvc', 'graph'), link('feedSvc', 'postDb', { style: 'faint' })],
        flows: [
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'GET /v1/feed', duration: 1.3 },
          { path: ['feedSvc', 'graph'], tone: 'request', label: 'who do I follow?', duration: 1, delay: 1.4 },
          { path: ['graph', 'feedSvc'], tone: 'response', label: '300 ids', duration: 1, delay: 2.5 },
          { path: ['feedSvc', 'postDb'], tone: 'request', label: 'latest from 300 authors', count: 5, duration: 1, delay: 3.6 },
          { path: ['postDb', 'feedSvc'], tone: 'response', count: 5, duration: 1, delay: 4.7 },
        ],
        caption: 'Pull: gather and merge on every load',
      },
    },
    {
      title: 'Pull breaks',
      tag: 'case',
      heading: 'Case: 70K feed loads a second, 300 lookups each',
      eli5: 'Now the whole town asks for mail at breakfast. Every request sends the clerk to 300 shelves, so the clerks run back and forth all day and families wait at the window.',
      body: [
        'At full scale each feed load still touches 300 authors. 70K loads per second times 300 is **21 million** author lookups per second against the post store.',
        'The work also grows with how many accounts a reader follows. A reader who follows 5,000 accounts is 17 times more expensive than average.',
      ],
      keyIdea: 'Pull cost is reads times followees. At 70K reads a second, doing the merge on every read is the expensive side.',
      metrics: { reads: '70K/s peak', latency: '1.6 s', fanout: '0', db: '21M/s', cache: '-' },
      metricTones: { latency: 'bad', db: 'bad' },
      scene: {
        nodes: [
          { ...reader, status: 'hot', badge: 'spinner' },
          { ...feedSvc, status: 'hot', load: 96, badge: '300 calls per load' },
          { ...postDb, status: 'hot', load: 99, badge: '21M lookups/s' },
        ],
        links: [link('reader', 'feedSvc', { label: '70K loads/s', labelTone: 'warn' }), link('feedSvc', 'postDb')],
        flows: [
          { path: ['reader', 'feedSvc'], tone: 'request', count: 5, duration: 1.4 },
          { path: ['feedSvc', 'postDb'], tone: 'request', count: 8, duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Pull cost',
          icon: 'Gauge',
          rows: [
            { text: 'Loads per second', value: '70K' },
            { text: 'Authors per load', value: '300' },
            { text: 'Lookups per second', value: '21M', tone: 'bad' },
            { text: 'Reader with 5,000 follows', value: '17x average', tone: 'warn' },
          ],
        },
        caption: 'Every load repeats the same 300 lookups',
      },
    },
    {
      title: 'Slowest shard',
      tag: 'case',
      heading: 'Case: one feed load waits for the slowest shard',
      eli5: 'Each family\'s request sends the clerk to many different shelf rooms. The clerk can only leave once the slowest room has answered, so one sluggish room slows everyone.',
      body: [
        'Posts are sharded by author, so one feed load fans out to dozens of shards and waits for the slowest one. The p99 is set by the worst shard, and it climbs past a second.',
        'Caching each author\'s recent posts helps, but the merge still happens 70K times a second for the same popular authors. The expensive part is the work, so the next idea is to do it once, at publish time.',
      ],
      keyIdea: 'A scatter-gather read is only as fast as its slowest part, so wide pulls make the p99 worse.',
      metrics: { reads: '70K/s peak', latency: '1.6 s', fanout: '0', db: '21M/s', cache: '-' },
      metricTones: { latency: 'bad' },
      scene: {
        nodes: [
          { ...feedSvc, status: 'hot', load: 96 },
          { id: 'shardA', kind: 'shard', at: at(3.5, -3.8), label: 'shard 3', sub: '20 ms' },
          { id: 'shardB', kind: 'shard', at: at(7, 0), label: 'shard 18', sub: '35 ms' },
          { id: 'shardC', kind: 'shard', at: at(3.5, 3.8), label: 'shard 41', sub: '1.2 s', status: 'hot', badge: 'slowest' },
        ],
        links: [link('feedSvc', 'shardA'), link('feedSvc', 'shardB'), link('feedSvc', 'shardC', { label: 'p99 set here', labelTone: 'warn' })],
        flows: [
          { path: ['feedSvc', 'shardA', 'feedSvc'], tone: 'request', duration: 1.2 },
          { path: ['feedSvc', 'shardB', 'feedSvc'], tone: 'request', duration: 1.4 },
          { path: ['shardC', 'feedSvc'], tone: 'error', label: 'still waiting', duration: 2.6 },
        ],
        caption: 'The page is ready only when the last shard answers',
      },
    },
    {
      title: 'Push design',
      tag: 'concept',
      heading: 'Push each new post into every follower\'s feed',
      eli5: 'Now when a letter arrives, helpers copy its number into the mailbox of each follower right away. That is **fan-out on write**. Opening the mailbox later is instant.',
      body: [
        'Flip the work to publish time. The post service stores the post, then drops a small event on the **fan-out queue** (the message queues lesson) and returns. **Fan-out workers** read the author\'s followers from the graph in batches, skip anyone who muted the author, and add the post id to each follower\'s feed list.',
        'The author never waits for the fan-out.',
      ],
      keyIdea: 'Fan-out on write does the merge once at publish time, in the background.',
      metrics: { reads: '70K/s peak', latency: '-', fanout: '360K/s', db: '-', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...postSvc, status: 'active' }, { ...queue, status: 'active', badge: 'post 7301…' }, { ...workers, status: 'active' }, { ...graph, at: at(10.5, 0) }, { ...feedCache, status: 'ok', badge: '+1 id x 300' }],
        links: [link('postSvc', 'queue'), link('queue', 'workers'), link('workers', 'graph'), link('workers', 'feedCache', { style: 'dashed' })],
        flows: [
          { path: ['postSvc', 'queue', 'workers'], tone: 'event', label: 'post created', duration: 1.6 },
          { path: ['workers', 'graph'], tone: 'request', label: 'followers', duration: 1, delay: 1.7 },
          { path: ['workers', 'feedCache'], tone: 'data', label: 'ZADD x 300', count: 4, duration: 1.4, delay: 2.8 },
        ],
        caption: 'Push at publish time',
      },
    },
    {
      title: 'Cheap reads',
      tag: 'concept',
      heading: 'With push, a feed read is one list read',
      eli5: 'Opening the mailbox is now quick. The clerk reads the top of the slip and fetches twenty letters. No walking to 300 shelves.',
      body: [
        'Reading is now one cache call: take the newest 20 ids from `feed:{reader}`, then fill in the posts. Feed p99 drops to about **60 ms**.',
        'The post store sees only cache misses, about 14K reads a second. A 300-way merge on every read has become one list read.',
      ],
      keyIdea: 'Fan-out on write turns a 300-way merge on read into one list read.',
      metrics: { reads: '70K/s peak', latency: '60 ms', fanout: '360K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { latency: 'good', db: 'good' },
      scene: {
        nodes: [reader, { ...feedSvc, status: 'active' }, { ...feedCache, status: 'ok', badge: '20 newest ids' }, { ...postCache, status: 'ok', badge: '99% hits' }, postDb],
        links: [link('reader', 'feedSvc'), link('feedSvc', 'feedCache'), link('feedSvc', 'postCache', { style: 'faint' }), link('postCache', 'postDb', { style: 'faint' })],
        flows: [
          { path: ['reader', 'feedSvc'], tone: 'request', label: 'GET /v1/feed', duration: 1.3 },
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: 'read 20 ids', duration: 1, delay: 1.4 },
          { path: ['feedSvc', 'postCache'], tone: 'request', label: 'fill in posts', duration: 1.1, delay: 2.6 },
        ],
        panel: {
          title: 'Read cost per feed load',
          icon: 'Timer',
          rows: [
            { text: 'Pull', value: '300 lookups, 1.6 s', tone: 'bad' },
            { text: 'Push', value: '1 list read, 60 ms', tone: 'good' },
            { text: 'Post store reads', value: '14K/s' },
          ],
        },
        caption: 'One list read, then fill in the posts',
      },
    },
    {
      title: 'Push cost',
      tag: 'tradeoff',
      heading: 'The bill moves to writes: 360K inserts a second',
      eli5: 'The helpers now do the copying, so there is a lot more work behind the counter. But a long line of letters waiting only makes mailboxes a little late. It never stops anyone from posting.',
      body: [
        '1,200 posts per second times 300 followers is **360K feed inserts per second** on average and about 1M at peak. Spread over about 128 Redis shards, that is under 10K inserts per second per shard at peak.',
        'The queue absorbs bursts, so a busy minute delays feeds a little and never blocks the author. Workers write in batches, and trim each list to the newest 500.',
      ],
      keyIdea: 'Push cost is posts per second times followers per post. The queue turns bursts into a little lateness.',
      metrics: { reads: '70K/s peak', latency: '60 ms', fanout: '360K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { fanout: 'warn' },
      scene: {
        nodes: [{ ...queue, badge: 'absorbs bursts' }, { ...workers, status: 'active', load: 64, chips: ['1000 per batch'] }, { ...feedCache, status: 'active', badge: '1M inserts/s peak' }],
        links: [link('queue', 'workers'), link('workers', 'feedCache', { style: 'dashed' })],
        flows: [
          { path: ['queue', 'workers'], tone: 'event', duration: 1.2 },
          { path: ['workers', 'feedCache'], tone: 'data', label: 'ZADD batch', count: 5, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Push cost',
          icon: 'Gauge',
          rows: [
            { text: 'Posts per second', value: '1,200' },
            { text: 'Followers per post', value: '300' },
            { text: 'Inserts per second, avg', value: '360K', tone: 'warn' },
            { text: 'Inserts per second, peak', value: '~1M', tone: 'warn' },
          ],
        },
        caption: 'Write work grows with followers',
      },
      code: {
        language: 'python',
        title: 'Fan-out worker',
        source: `FEED_CAP = 500

def on_post_created(event):                      # consumed from the fan-out queue
    post_id, author_id = event["post_id"], event["author_id"]
    created_ms = event["created_ms"]             # score must fit in 53 bits
    for batch in graph.followers(author_id, batch_size=1000):
        pipe = redis.pipeline(transaction=False)
        for reader_id in batch:
            if mutes.contains(reader_id, author_id):
                continue                         # respect mute settings
            key = f"feed:{reader_id}"
            pipe.zadd(key, {post_id: created_ms})  # member = id, score = ms
            pipe.zremrangebyrank(key, 0, -FEED_CAP - 1)  # keep newest 500
        pipe.execute()                           # one round trip per batch`,
        highlight: [6, 9, 12, 13],
      },
    },
    {
      title: 'Celebrities',
      tag: 'case',
      heading: 'Case: a pop star with 40 million followers posts',
      eli5: 'The mayor sends a newsletter to 40 million homes. The helpers must copy it 40 million times, and every other letter in town waits behind that pile. That pile-up is the **celebrity problem**.',
      body: [
        'A single post from an account with **40M followers** means 40M feed inserts. The worker pool does about 1M inserts per second, so this one post occupies the whole pool for 40 seconds, and every ordinary post queued behind it is late.',
        'During a live event, a dozen such accounts post within minutes and feeds fall several minutes behind.',
      ],
      keyIdea: 'Push cost is followers per post. A few huge accounts dominate it.',
      metrics: { reads: '70K/s peak', latency: '60 ms (stale by minutes)', fanout: '1M/s, 40M queued', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { fanout: 'bad', latency: 'warn' },
      scene: {
        nodes: [{ ...star, status: 'active' }, { ...queue, status: 'hot', badge: 'backlog 40M' }, { ...workers, status: 'hot', load: 100, badge: '40 s for 1 post' }, { ...feedCache, status: 'hot', badge: 'all shards busy' }],
        links: [link('star', 'queue', { label: 'one post' }), link('queue', 'workers'), link('workers', 'feedCache', { style: 'dashed' })],
        flows: [
          { path: ['star', 'queue'], tone: 'request', label: 'one post', duration: 1.6 },
          { path: ['queue', 'workers'], tone: 'event', count: 4, duration: 1, delay: 1.7 },
          { path: ['workers', 'feedCache'], tone: 'data', label: '40M inserts', count: 8, duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'One celebrity post',
          icon: 'Star',
          rows: [
            { text: 'Followers', value: '40M' },
            { text: 'Worker pool speed', value: '1M inserts/s' },
            { text: 'Pool busy for', value: '40 s', tone: 'bad' },
            { text: 'Ordinary posts behind it', value: 'late', tone: 'bad' },
          ],
        },
        caption: 'One post, forty million writes',
      },
    },
    {
      title: 'Wasted writes',
      tag: 'case',
      heading: 'Case: bursts hit every shard, and most writes go unread',
      eli5: 'The newsletter lands in every mailbox at once, so every mail room is busy at the same moment. And many of those families have not opened their mailbox in a month.',
      body: [
        'All 40M inserts arrive in one burst and hit every feed cache shard at once, and a hot post id shows up in millions of lists at the same moment.',
        'There is quieter waste too. A large share of any big account\'s followers have not opened the app in a month. Every insert into their feeds is work nobody will read.',
      ],
      keyIdea: 'Push wastes work on readers who never come back, and a burst hits every shard at once.',
      metrics: { reads: '70K/s peak', latency: '60 ms (stale by minutes)', fanout: '1M/s, 40M queued', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { fanout: 'bad', cache: 'warn' },
      scene: {
        nodes: [
          { ...workers, status: 'hot', load: 100 },
          { ...feedCache, status: 'hot', badge: 'every shard' },
          { id: 'active', kind: 'phone', at: at(7, -3.8), label: 'active reader', sub: 'opens daily', status: 'ok' },
          { id: 'asleep', kind: 'phone', at: at(10.5, 0), label: 'asleep reader', sub: 'gone for 30 days', status: 'dim' },
        ],
        links: [link('workers', 'feedCache', { style: 'dashed' }), link('feedCache', 'active', { style: 'faint' }), link('feedCache', 'asleep', { style: 'faint' })],
        flows: [
          { path: ['workers', 'feedCache'], tone: 'data', label: '40M inserts', count: 6, duration: 1.4 },
          { path: ['feedCache', 'active'], tone: 'response', label: 'read', duration: 1.4, delay: 1.5 },
          { path: ['feedCache', 'asleep'], tone: 'error', label: 'never read', duration: 1.4, delay: 1.5 },
        ],
        caption: 'Many inserts feed readers who are asleep',
      },
    },
    {
      title: 'Hybrid',
      tag: 'tradeoff',
      heading: 'Push for most accounts, pull for the few huge ones',
      eli5: 'Ordinary letters still get copied into mailboxes. The mayor\'s newsletter is pinned once on the town board, and when you open your mailbox the clerk adds the board\'s newest notes to your stack. That mix is the **hybrid** model.',
      body: [
        'Pick a threshold, say **100K followers**. Below it, fan out on write as before. Above it, skip the fan-out and only append the post id to the author\'s own **author recent list**, a short sorted list in the post cache. If the cache loses it, the list is rebuilt from the `posts_by_author` index.',
        'That is a tiny fraction of accounts. Skipping their fan-out takes the average from 360K to about **300K inserts per second** and removes the 40M-insert bursts.',
      ],
      keyIdea: 'Push where followers are few, and keep the posts of huge accounts in one author recent list that followers pull.',
      metrics: { reads: '70K/s peak', latency: '-', fanout: '360K to ~300K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { fanout: 'good' },
      scene: {
        nodes: [{ ...star, status: 'active', chips: ['> 100K followers'] }, postSvc, { ...postCache, status: 'ok', badge: 'recent:star' }, { ...queue, status: 'dim', badge: 'skipped' }],
        links: [link('star', 'postSvc'), link('postSvc', 'postCache'), link('postSvc', 'queue', { style: 'faint' })],
        flows: [
          { path: ['star', 'postSvc'], tone: 'request', label: 'one post', duration: 1.3 },
          { path: ['postSvc', 'postCache'], tone: 'data', label: 'recent += id', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Where does the post go?',
          icon: 'Split',
          rows: [
            { text: 'Under 100K followers', value: 'push to feeds' },
            { text: 'Over 100K followers', value: 'recent list only', tone: 'good' },
            { text: 'Recent list size', value: 'a short sorted list' },
            { text: 'Saving from this rule', value: '360K to ~300K/s', tone: 'good' },
            { text: 'Cache loses the list', value: 'rebuild from posts_by_author', tone: 'muted' },
          ],
        },
        caption: 'Big accounts skip the fan-out',
      },
    },
    {
      title: 'Hybrid read',
      tag: 'tradeoff',
      heading: 'On read, merge the pushed list with a few recent lists',
      eli5: 'When you open your mailbox the clerk takes your slip, then glances at the few notices on the town board from writers you follow, and sorts them together. Just a few extra looks.',
      body: [
        'On read, the feed service takes the pushed list, then reads the author recent lists of the few big accounts this reader follows (usually a handful) and merges them by id.',
        'A handful of extra cache reads keeps p99 around **80 ms**, and the 40M-insert bursts are gone.',
      ],
      keyIdea: 'A handful of cache reads at read time replaces 40 million writes at publish time.',
      metrics: { reads: '70K/s peak', latency: '80 ms', fanout: '~300K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { latency: 'good', fanout: 'good' },
      scene: {
        nodes: [reader, { ...feedSvc, status: 'active', badge: 'merge 2 sources' }, { ...feedCache, status: 'ok', badge: 'pushed ids' }, { ...postCache, status: 'ok', badge: 'recent:star' }],
        links: [link('reader', 'feedSvc'), link('feedSvc', 'feedCache'), link('feedSvc', 'postCache')],
        flows: [
          { path: ['reader', 'feedSvc'], tone: 'request', label: 'GET /v1/feed', duration: 1.3 },
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: 'feed:{me}', duration: 0.9, delay: 1.4 },
          { path: ['feedSvc', 'postCache'], tone: 'request', label: 'recent:{star}', duration: 1.1, delay: 1.4 },
          { path: ['feedCache', 'feedSvc'], tone: 'response', duration: 0.9, delay: 2.6 },
          { path: ['postCache', 'feedSvc'], tone: 'response', duration: 1.1, delay: 2.7 },
          { path: ['feedSvc', 'reader'], tone: 'response', label: 'merged page', duration: 1.3, delay: 4 },
        ],
        caption: 'Pushed feed plus pulled recent lists',
      },
      code: {
        language: 'python',
        title: 'Hybrid read: merge pushed ids with pulled recent lists',
        source: `import heapq

def read_feed_ids(reader_id, limit=20, before=None):
    top = f"({before}" if before else "+inf"         # exclusive cursor (ms)
    pushed = redis.zrevrangebyscore(f"feed:{reader_id}", top, "-inf",
                                    start=0, num=limit)
    pulled = []
    for author_id in graph.followed_big_accounts(reader_id):   # a handful
        pulled += redis.zrevrangebyscore(f"recent:{author_id}", top, "-inf",
                                         start=0, num=limit)
    ids = {int(i) for i in pushed + pulled}          # dedupe
    return heapq.nlargest(limit, ids)                # newest first`,
        highlight: [4, 8, 9, 12],
      },
      quiz: {
        question: 'Which accounts should the hybrid design leave out of fan-out on write?',
        options: [
          'Accounts that post very often',
          'Accounts with a very large number of followers',
          'Readers who follow more than 1,000 accounts',
          'Accounts whose posts get the most likes',
        ],
        answer: 1,
        explain: 'Push cost per post equals the author\'s follower count. A few accounts with millions of followers dominate it, so their posts go to an author recent list that followers pull and merge at read time.',
      },
    },
    {
      title: 'Inactive readers',
      tag: 'tradeoff',
      heading: 'Stop pushing to readers who are gone',
      eli5: 'If a family has not opened their mailbox in a month, the helpers stop filling it. When they come back, the clerk builds their stack once and the helpers start filling it again.',
      body: [
        'Treat inactive users the same way. Stop pushing to anyone who has not opened the app in 30 days. When they return, build their feed once by pulling from the post store, store it, and push resumes.',
        'The big-account rule took fan-out from 360K to about 300K inserts per second. Skipping inactive readers takes off about 50K more, so average fan-out drops to about **250K inserts per second**. New users get the same cold start: pull once, then push.',
      ],
      keyIdea: 'Push only to active readers. Rebuild a returning reader\'s feed once, then push resumes.',
      metrics: { reads: '70K/s peak', latency: '80 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { fanout: 'good', cache: 'good' },
      scene: {
        nodes: [
          { id: 'returning', kind: 'phone', at: at(-7, -3.8), label: 'returning reader', sub: 'back after 40 days', status: 'active' },
          { ...feedSvc, status: 'active', badge: 'rebuild once' },
          { ...postDb, status: 'active' },
          { ...feedCache, status: 'ok', badge: 'feed stored' },
        ],
        links: [link('returning', 'feedSvc'), link('feedSvc', 'postDb', { style: 'faint' }), link('feedSvc', 'feedCache')],
        flows: [
          { path: ['returning', 'feedSvc'], tone: 'request', label: 'first open', duration: 1.4 },
          { path: ['feedSvc', 'postDb'], tone: 'request', label: 'pull 300 authors', count: 3, duration: 1.4, delay: 1.5 },
          { path: ['feedSvc', 'feedCache'], tone: 'data', label: 'store feed', duration: 1.2, delay: 3.1 },
        ],
        panel: {
          title: 'Who gets a push',
          icon: 'Users',
          rows: [
            { text: 'Active in the last 30 days', value: 'push', tone: 'good' },
            { text: 'Gone for 30 days', value: 'skip', tone: 'muted' },
            { text: 'Returns', value: 'pull once, push again' },
            { text: 'Skip big accounts (Hybrid)', value: '360K to 300K/s' },
            { text: 'Skip inactive readers', value: '300K to 250K/s' },
            { text: 'Average fan-out', value: '250K/s', tone: 'good' },
          ],
        },
        caption: 'Do the work only for readers who will read it',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Precompute most feeds, pull the rest',
      eli5: 'Copy ordinary letters into **mailboxes** ahead of time, pin the mayor\'s newsletter on the board, and skip the families who are away. Part 2 covers sorting, fetching and keeping it all correct.',
      body: [
        'Pull was simple and collapsed at 21M lookups per second. **Fan-out on write** made each read one cache call and cost 360K inserts per second. The **hybrid** design pulls the few huge accounts and skips inactive readers, which brought fan-out to about 250K per second.',
        'We have a feed of 500 ids per reader. Part 2 ranks them, fills in the posts, and handles pages, deletes and failures.',
      ],
      keyIdea: 'A feed is a read-optimized copy of the follow graph applied to posts. Decide per account whether to build it at write time or read time.',
      metrics: { reads: '70K/s peak', latency: '80 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { latency: 'good', fanout: 'good', db: 'good' },
      scene: {
        nodes: [reader, feedSvc, postSvc, workers, { ...feedCache, status: 'ok' }],
        links: [link('reader', 'feedSvc'), link('feedSvc', 'feedCache'), link('postSvc', 'workers', { label: 'push' }), link('workers', 'feedCache', { style: 'dashed' })],
        flows: [
          { path: ['postSvc', 'workers', 'feedCache'], tone: 'event', label: 'push', duration: 2.4 },
          { path: ['reader', 'feedSvc', 'feedCache'], tone: 'request', label: 'read', duration: 2, delay: 1 },
        ],
        caption: 'Push most, pull the few huge accounts',
      },
      quiz: {
        question: 'A pure pull design costs 70K loads a second times 300 followees. About how many lookups per second is that?',
        options: ['210K', '2.1 million', '21 million', '210 million'],
        answer: 2,
        explain: '70,000 times 300 is 21,000,000 lookups per second. Doing the merge once at publish time and caching the result removes that cost from every read.',
      },
    },
  ],
};
