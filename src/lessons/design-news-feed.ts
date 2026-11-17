import type { Lesson, SceneNode } from '../engine/types';

// Layout: two rows of services. Top row is the write path, bottom row is the read path.
const reader: SceneNode = { id: 'reader', kind: 'phone', at: [-4.5, 4.5], label: 'reader', sub: 'opens the app' };
const star: SceneNode = { id: 'star', kind: 'user', at: [-4.5, 4.5], label: 'pop star', sub: '40M followers' };
const gateway: SceneNode = { id: 'gateway', kind: 'gateway', at: [-3.25, 3.25], label: 'API gateway', sub: 'auth, rate limits' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: [-6.5, 0.5], label: 'CDN', sub: 'photos, video' };
const postSvc: SceneNode = { id: 'postSvc', kind: 'service', at: [-3.75, -0.25], label: 'post service' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: [-2.25, -1.75], label: 'fan-out queue' };
const ranker: SceneNode = { id: 'ranker', kind: 'service', at: [-2.25, -1.75], label: 'ranker', sub: 'scores candidates' };
const workers: SceneNode = { id: 'workers', kind: 'worker', at: [-0.75, -3.25], label: 'fan-out workers' };
const graph: SceneNode = { id: 'graph', kind: 'db', at: [0.75, -4.75], label: 'follow graph', sub: 'who follows whom' };
const feedSvc: SceneNode = { id: 'feedSvc', kind: 'service', at: [0.25, 3.75], label: 'feed service' };
const feedCache: SceneNode = { id: 'feedCache', kind: 'cache', at: [1.75, 2.25], label: 'feed cache', sub: '500 ids per reader' };
const postCache: SceneNode = { id: 'postCache', kind: 'cache', at: [3.25, 0.75], label: 'post cache', sub: 'posts, users, counts' };
const postDb: SceneNode = { id: 'postDb', kind: 'db', at: [4.75, -0.75], label: 'post store', sub: 'sharded by author' };
const feedReplica: SceneNode = { id: 'feedReplica', kind: 'replica', at: [-1.25, 5.25], label: 'cache replica' };

const writeLinks = [
  { from: 'gateway', to: 'postSvc' },
  { from: 'postSvc', to: 'postDb', style: 'faint' as const },
  { from: 'postSvc', to: 'queue' },
  { from: 'queue', to: 'workers' },
  { from: 'workers', to: 'graph' },
  { from: 'workers', to: 'feedCache', style: 'dashed' as const },
];
const readLinks = [
  { from: 'reader', to: 'gateway' },
  { from: 'gateway', to: 'feedSvc' },
  { from: 'feedSvc', to: 'feedCache' },
  { from: 'feedSvc', to: 'postCache' },
  { from: 'postCache', to: 'postDb', style: 'faint' as const },
];

export const designNewsFeed: Lesson = {
  id: 'design-news-feed',
  title: 'Design a news feed',
  tagline: 'Build a home feed for 200 million daily users: push posts to followers ahead of time, pull the celebrities, and keep it fast and fresh.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'The publish path and the read path, and the scale numbers behind each',
    'Fan-out on write versus fan-out on read, with the math for both',
    'The celebrity problem and the hybrid push and pull design',
    'A per-reader feed cache of ids, hydrated from post and user caches',
    'Cursor pagination, ranking in brief, and keeping the feed fresh',
    'What happens when a feed cache shard dies',
  ],
  metrics: [
    { key: 'reads', label: 'Feed reads' },
    { key: 'latency', label: 'Feed p99' },
    { key: 'fanout', label: 'Fan-out writes' },
    { key: 'db', label: 'Store reads' },
    { key: 'cache', label: 'Feed cache' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A home feed for 200 million people a day',
      eli5: 'A town where everyone writes letters and reads letters from the people they follow. The **feed** is the stack each family finds when they open their mailbox, newest letters on top.',
      body: [
        'Users publish posts (text, photos, short videos) and open a **home feed** that shows recent posts from the accounts they follow. Web and mobile. A user follows up to 5,000 accounts, and some accounts have tens of millions of followers. The first version is newest first. Ranking comes later.',
        'Napkin math (see the napkin math lesson): **200M daily users** open the feed about 10 times a day, so 2 billion feed loads a day, about 23K per second on average and **70K/s at peak**. They publish 100M posts a day, about 1,200/s on average. The average user follows 300 accounts, and the average account has 300 followers.',
        'Storage: 1 KB of text and metadata per post is 100 GB a day. One post in five carries a photo of about 500 KB, which adds 10 TB a day of media. The target is a feed that loads in under **200 ms at p99**. Reads outnumber posts 60 to 1, so the design should make reads cheap even if writes cost more.',
      ],
      keyIdea: 'A feed is read about 60 times for every post written, so spend effort at write time to make the read cheap.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '-', db: '-', cache: '-' },
      scene: {
        nodes: [reader, gateway, postSvc, feedSvc, postDb, graph],
        links: [
          { from: 'reader', to: 'gateway' },
          { from: 'gateway', to: 'postSvc' },
          { from: 'gateway', to: 'feedSvc' },
          { from: 'postSvc', to: 'postDb' },
          { from: 'feedSvc', to: 'graph', style: 'faint' },
          { from: 'feedSvc', to: 'postDb', style: 'faint' },
        ],
        flows: [
          { path: ['reader', 'gateway', 'postSvc'], tone: 'request', label: 'publish', duration: 1.4 },
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'open feed', count: 4, duration: 1.4, delay: 1.2 },
        ],
        caption: 'Two paths: publish a post, read a feed',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Two calls carry almost all the traffic',
      eli5: 'There are two windows at the post office. At one you drop off a letter. At the other you ask for your mail and get it twenty letters at a time, with a **cursor** that says where you stopped.',
      body: [
        '`POST /v1/posts` publishes. The client first uploads any photo straight to object storage with a pre-signed URL (the object storage lesson), then sends the text plus the media keys. The API gateway checks the token and applies a **rate limit** per user, so one spam account cannot publish 1,000 posts a minute.',
        '`GET /v1/feed?limit=20&cursor=...` reads. It returns 20 fully built posts and an opaque `next_cursor`. Each post already includes the author name, avatar URL, like count and media URLs, so the app renders one page with one call.',
        'Follow and unfollow are small calls of their own. They change the follow graph, which the feed uses on every read and every publish.',
      ],
      keyIdea: 'Keep the hot API to two calls: publish a post, and read a page of the feed with a cursor.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '-', db: '-', cache: '-' },
      scene: {
        nodes: [{ ...reader, status: 'active' }, { ...gateway, status: 'active', badge: '10 posts/min/user' }, postSvc, feedSvc],
        links: [
          { from: 'reader', to: 'gateway' },
          { from: 'gateway', to: 'postSvc' },
          { from: 'gateway', to: 'feedSvc' },
        ],
        flows: [
          { path: ['reader', 'gateway', 'postSvc'], tone: 'request', label: 'POST /v1/posts', duration: 1.5 },
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'GET /v1/feed', duration: 1.5, delay: 1.7 },
          { path: ['feedSvc', 'gateway', 'reader'], tone: 'response', label: '20 posts + cursor', duration: 1.5, delay: 3.3 },
        ],
        caption: 'Publish and read are the two hot calls',
      },
      code: {
        language: 'json',
        title: 'GET /v1/feed?limit=20 (response, trimmed)',
        source: `{
  "posts": [
    {
      "post_id": "7301958437128192",
      "author": { "id": "u_381", "name": "Maya Ortiz", "avatar": "https://cdn.example.com/a/381.jpg" },
      "text": "First tomatoes of the season",
      "media": ["https://cdn.example.com/p/7301958437128192/0.jpg"],
      "likes": 42,
      "liked_by_me": false,
      "created_at": "2026-11-17T08:14:03Z"
    }
  ],
  "next_cursor": "eyJiZWZvcmUiOiI3MzAxOTU4NDM3MTI4MTkyIn0"
}`,
        highlight: [5, 7, 13],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Posts, a follow graph, and a feed of ids',
      eli5: 'Every letter gets a number that grows over time and goes on the big shelf. A list says who follows whom. A family\'s **feed** is only a slip of letter numbers in their mailbox, the newest 500.',
      body: [
        '**Posts** live in a store sharded by `author_id` (the sharding lesson), so one author\'s posts sit together. Each post gets a **time-sortable id** (the unique ID lesson), so sorting by id is sorting by time, and no shared counter is needed.',
        'The **follow graph** answers two questions: who does this reader follow, and who follows this author. Store the edge twice, once per direction, so both questions are a single indexed range read. A graph database works too, but this access pattern is simple enough for a key-value or SQL store.',
        'The **feed cache** holds one sorted list per reader: post ids only, newest 500, scored by id. At 16 bytes an entry that is 8 KB per reader and about **1.6 TB** for 200M readers before data structure overhead, spread across a sharded Redis cluster. This is the data modeling lesson\'s idea of storing data in the shape it is read.',
      ],
      keyIdea: 'Store each post once, store the graph in both directions, and give every reader a short list of post ids.',
      metrics: { reads: '70K/s peak', latency: 'target < 200 ms', fanout: '-', db: '-', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...postDb, status: 'active', badge: '100 GB/day' }, { ...graph, status: 'active', badge: 'edges both ways' }, { ...feedCache, status: 'active', badge: 'feed:{reader}' }, postCache],
        links: [
          { from: 'postCache', to: 'postDb', style: 'faint' },
          { from: 'feedCache', to: 'postCache', style: 'dashed', label: 'ids point to posts' },
        ],
        flows: [{ path: ['feedCache', 'postCache', 'postDb'], tone: 'data', label: 'post_id', duration: 1.8 }],
        caption: 'Feeds store pointers, posts store content',
      },
      code: {
        language: 'sql',
        title: 'Posts and the follow graph',
        source: `-- one row per post, sharded by author_id
CREATE TABLE posts (
  post_id     BIGINT PRIMARY KEY,   -- time-sortable 64-bit id
  author_id   BIGINT NOT NULL,
  body        TEXT,
  media_keys  TEXT[],               -- object storage keys, served via CDN
  deleted     BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX posts_by_author ON posts (author_id, post_id DESC);

-- the same edge stored in both directions
CREATE TABLE followers (author_id BIGINT, follower_id BIGINT,
                        PRIMARY KEY (author_id, follower_id));
CREATE TABLE following (reader_id BIGINT, author_id BIGINT,
                        PRIMARY KEY (reader_id, author_id));

-- feed cache in Redis: ZADD feed:{reader_id} {post_id} {post_id}`,
        highlight: [3, 9, 12, 14, 17],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'First version: build the feed when it is read',
      eli5: 'When a family asks for mail, the clerk looks up all 300 people they follow, walks to each writer\'s shelf, grabs the newest letters and sorts them on the spot. That is **fan-out on read**.',
      body: [
        'The simplest design computes the feed on demand. The feed service reads the reader\'s 300 followees from the graph, asks the post store for the newest posts of each, merges them by id, and returns the top 20. Publishing is one insert. This is **fan-out on read**, also called the pull model.',
        'It has real strengths. Posts show up the instant they are written, an unfollow takes effect at once, and nobody does work for users who never log in. For a product with 100K users it is the right first build.',
      ],
      keyIdea: 'Fan-out on read makes writes trivial and pushes all the work into every feed load.',
      metrics: { reads: '2K/s (early days)', latency: '120 ms', fanout: '0', db: '600K/s', cache: '-' },
      scene: {
        nodes: [reader, gateway, { ...feedSvc, status: 'active', badge: 'merge 300 lists' }, { ...graph, status: 'active' }, { ...postDb, status: 'active' }],
        links: [
          { from: 'reader', to: 'gateway' },
          { from: 'gateway', to: 'feedSvc' },
          { from: 'feedSvc', to: 'graph' },
          { from: 'feedSvc', to: 'postDb' },
        ],
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
      title: 'It breaks',
      tag: 'case',
      heading: 'Case: 70K feed loads a second, 300 lookups each',
      eli5: 'Now the whole town asks for mail at breakfast. Every request sends the clerk to 300 shelves, so the clerks run back and forth all day and families wait at the window.',
      body: [
        'At full scale each feed load still touches 300 authors. 70K loads per second times 300 is **21 million** author lookups per second. Posts are sharded by author, so one feed load fans out to dozens of shards and waits for the slowest one. The p99 is set by the worst shard, and it climbs past a second.',
        'Caching each author\'s recent posts helps, but the merge still happens 70K times a second for the same popular authors, and the work grows with how many accounts a reader follows. A reader who follows 5,000 accounts is 17 times more expensive than average.',
      ],
      keyIdea: 'Pull cost is reads times followees. At 60 reads per post, doing the merge on every read is the expensive side.',
      metrics: { reads: '70K/s peak', latency: '1.6 s', fanout: '0', db: '21M/s', cache: '-' },
      scene: {
        nodes: [{ ...reader, status: 'hot', badge: 'spinner' }, { ...gateway, status: 'hot' }, { ...feedSvc, status: 'hot', badge: '300 calls per load' }, { ...graph, status: 'hot' }, { ...postDb, status: 'hot', badge: '21M lookups/s' }],
        links: [
          { from: 'reader', to: 'gateway' },
          { from: 'gateway', to: 'feedSvc' },
          { from: 'feedSvc', to: 'graph' },
          { from: 'feedSvc', to: 'postDb' },
        ],
        flows: [
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['feedSvc', 'postDb'], tone: 'request', count: 8, duration: 1, delay: 1.2 },
          { path: ['postDb', 'feedSvc'], tone: 'error', label: 'slow shard', duration: 2.4, delay: 2.3 },
        ],
        caption: 'Every load waits for the slowest of many shards',
      },
    },
    {
      title: 'Fan-out on write',
      tag: 'concept',
      heading: 'Push each new post into every follower\'s feed',
      eli5: 'Now when a letter arrives, helpers copy its number into the mailbox of each follower right away. That is **fan-out on write**. Opening the mailbox later is instant.',
      body: [
        'Flip the work to publish time. The post service stores the post, then drops a small event on the **fan-out queue** (the message queues lesson) and returns. **Fan-out workers** read the author\'s followers from the graph in batches, skip anyone who muted the author, and add the post id to each follower\'s feed list.',
        'Reading is now one cache call: take the newest 20 ids from `feed:{reader}`, then fill in the posts. Feed p99 drops to about **60 ms**, and the post store sees only cache misses.',
        'The bill moves to writes. 1,200 posts per second times 300 followers is **360K feed inserts per second** on average and about 1M at peak. Redis handles that across a few dozen shards, and the queue absorbs bursts, so a busy minute delays feeds a little and never blocks the author.',
      ],
      keyIdea: 'Fan-out on write precomputes every feed, turning a 300-way merge on read into one list read.',
      metrics: { reads: '70K/s peak', latency: '60 ms', fanout: '360K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [reader, gateway, { ...postSvc, status: 'active' }, { ...queue, status: 'active', badge: 'post 7301…' }, { ...workers, status: 'active' }, graph, { ...feedSvc, status: 'ok' }, { ...feedCache, status: 'ok', badge: '+1 id x 300' }, postDb],
        links: [...writeLinks, { from: 'reader', to: 'gateway' }, { from: 'gateway', to: 'feedSvc' }, { from: 'feedSvc', to: 'feedCache' }],
        flows: [
          { path: ['gateway', 'postSvc'], tone: 'request', label: 'publish', duration: 1 },
          { path: ['postSvc', 'postDb'], tone: 'data', label: 'insert', duration: 1, delay: 1.1 },
          { path: ['postSvc', 'queue', 'workers'], tone: 'event', label: 'post created', duration: 1.4, delay: 1.1 },
          { path: ['workers', 'graph'], tone: 'request', label: 'followers', duration: 0.9, delay: 2.6 },
          { path: ['workers', 'feedCache'], tone: 'data', label: 'ZADD x 300', count: 4, duration: 1.2, delay: 3.6 },
          { path: ['reader', 'gateway', 'feedSvc', 'feedCache'], tone: 'request', label: 'read 20 ids', duration: 1.6, delay: 4.9 },
        ],
        caption: 'Push at publish time, read one list later',
      },
      code: {
        language: 'python',
        title: 'Fan-out worker',
        source: `FEED_CAP = 500

def on_post_created(event):                      # consumed from the fan-out queue
    post_id, author_id = event["post_id"], event["author_id"]
    for batch in graph.followers(author_id, batch_size=1000):
        pipe = redis.pipeline(transaction=False)
        for reader_id in batch:
            if mutes.contains(reader_id, author_id):
                continue                         # respect mute settings
            key = f"feed:{reader_id}"
            pipe.zadd(key, {post_id: post_id})   # score = time-sortable id
            pipe.zremrangebyrank(key, 0, -FEED_CAP - 1)  # keep newest 500
        pipe.execute()                           # one round trip per batch`,
        highlight: [5, 8, 11, 12],
      },
    },
    {
      title: 'Celebrities',
      tag: 'case',
      heading: 'Case: a pop star with 40 million followers posts',
      eli5: 'The mayor sends a newsletter to 40 million homes. The helpers must copy it 40 million times, and every other letter in town waits behind that pile. That pile-up is the **celebrity problem**.',
      body: [
        'A single post from an account with **40M followers** means 40M feed inserts. The worker pool does about 1M inserts per second, so this one post occupies the whole pool for 40 seconds, and every ordinary post queued behind it is late. During a live event, a dozen such accounts post within minutes and feeds fall several minutes behind.',
        'The writes also land unevenly. All 40M inserts arrive in one burst and hit every feed cache shard at once, and a hot post id shows up in millions of lists at the same moment.',
        'There is quieter waste too. A large share of any big account\'s followers have not opened the app in a month. Every insert into their feeds is work nobody will read.',
      ],
      keyIdea: 'Push cost is followers per post. A few huge accounts dominate it, and inactive followers waste it.',
      metrics: { reads: '70K/s peak', latency: '60 ms (stale by minutes)', fanout: '1M/s, 40M queued', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...star, status: 'active' }, gateway, postSvc, { ...queue, status: 'hot', badge: 'backlog 40M' }, { ...workers, status: 'hot', badge: '40 s for 1 post' }, graph, { ...feedCache, status: 'hot', badge: 'all shards busy' }],
        links: [{ from: 'star', to: 'gateway' }, ...writeLinks.filter((l) => l.to !== 'postDb')],
        flows: [
          { path: ['star', 'gateway', 'postSvc', 'queue'], tone: 'request', label: 'one post', duration: 1.6 },
          { path: ['queue', 'workers'], tone: 'event', count: 4, duration: 1, delay: 1.7 },
          { path: ['workers', 'feedCache'], tone: 'data', label: '40M inserts', count: 8, duration: 1.4, delay: 2.8 },
        ],
        caption: 'One post, forty million writes',
      },
    },
    {
      title: 'Hybrid',
      tag: 'tradeoff',
      heading: 'Push for most accounts, pull for the few huge ones',
      eli5: 'Ordinary letters still get copied into mailboxes. The mayor\'s newsletter is pinned once on the town board, and when you open your mailbox the clerk adds the board\'s newest notes to your stack. That mix is the **hybrid** model.',
      body: [
        'Pick a threshold, say **100K followers**. Below it, fan out on write as before. Above it, skip the fan-out and only append the post id to the author\'s own **outbox**, a short sorted list in the post cache. That is a tiny fraction of accounts and a large fraction of the fan-out work.',
        'On read, the feed service takes the pushed list, then reads the outboxes of the few big accounts this reader follows (usually a handful) and merges them by id. A handful of extra cache reads keeps p99 around **80 ms**, and the 40M-insert bursts are gone.',
        'Treat inactive users the same way. Stop pushing to anyone who has not opened the app in 30 days. When they return, build their feed once by pulling, store it, and push resumes. Average fan-out drops to about **250K inserts per second**.',
      ],
      keyIdea: 'Push where followers are few and active, pull where followers are many or asleep, and merge at read time.',
      metrics: { reads: '70K/s peak', latency: '80 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [reader, gateway, { ...feedSvc, status: 'active', badge: 'merge 2 sources' }, { ...feedCache, status: 'ok', badge: 'pushed ids' }, { ...postCache, status: 'ok', badge: 'outbox:star' }, postDb, { ...workers, status: 'ok' }, { ...queue, status: 'ok' }],
        links: [...readLinks, { from: 'queue', to: 'workers' }, { from: 'workers', to: 'feedCache', style: 'dashed' }],
        flows: [
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'GET /v1/feed', duration: 1.3 },
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: 'feed:{me}', duration: 0.9, delay: 1.4 },
          { path: ['feedSvc', 'postCache'], tone: 'request', label: 'outbox:{star}', duration: 1.1, delay: 1.4 },
          { path: ['feedCache', 'feedSvc'], tone: 'response', duration: 0.9, delay: 2.5 },
          { path: ['postCache', 'feedSvc'], tone: 'response', duration: 1.1, delay: 2.6 },
          { path: ['feedSvc', 'gateway', 'reader'], tone: 'response', label: 'merged page', duration: 1.3, delay: 3.9 },
        ],
        caption: 'Pushed feed plus pulled outboxes',
      },
      code: {
        language: 'python',
        title: 'Hybrid read: merge pushed ids with pulled outboxes',
        source: `import heapq

def read_feed_ids(reader_id, limit=20, before=None):
    top = f"({before}" if before else "+inf"         # exclusive cursor
    pushed = redis.zrevrangebyscore(f"feed:{reader_id}", top, "-inf",
                                    start=0, num=limit)
    pulled = []
    for author_id in graph.followed_big_accounts(reader_id):   # a handful
        pulled += redis.zrevrangebyscore(f"outbox:{author_id}", top, "-inf",
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
        explain: 'Push cost per post equals the author\'s follower count. A few accounts with millions of followers dominate it, so their posts go to an outbox that followers pull and merge at read time.',
      },
    },
    {
      title: 'Build the page',
      tag: 'concept',
      heading: 'Rank the candidates, then hydrate twenty posts',
      eli5: 'The mailbox slip only has letter numbers. The clerk picks the 20 you will like most, fetches the letters from nearby **caches**, and the pictures come from a kiosk on your street.',
      body: [
        '**Ranking, in brief.** The 500 ids are candidates. A ranked feed scores each one with signals such as how often you interact with the author, the post\'s age, early likes and comments, and media type, then sorts by score. The ranker runs a trained model on precomputed features and must finish in tens of milliseconds. Newest first is the special case where the score is the id.',
        '**Hydration.** The feed service turns 20 ids into 20 posts with batched reads from several caches: post content, author name and avatar, like and comment counters, and whether you liked each one. At 70K pages a second that is about 1.4M post lookups per second against the cache. With a 99% hit rate the post store sees about **14K reads per second**.',
        '**Media** never passes through the feed service. Posts carry CDN URLs (the CDN lesson), and the phone downloads images from an edge near the reader while the JSON is still being parsed.',
      ],
      keyIdea: 'The feed cache stores ids. Ranking chooses among them, caches fill them in, and the CDN serves the bytes.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [reader, { ...cdn, status: 'active', badge: 'edge hit' }, gateway, { ...ranker, status: 'active' }, { ...feedSvc, status: 'active' }, feedCache, { ...postCache, status: 'ok', badge: '99% hits' }, { ...postDb, badge: '14K reads/s' }],
        links: [...readLinks, { from: 'feedSvc', to: 'ranker' }, { from: 'reader', to: 'cdn', style: 'dashed' }],
        flows: [
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: '500 ids', duration: 1 },
          { path: ['feedSvc', 'ranker'], tone: 'request', label: 'score', duration: 1.2, delay: 1.1 },
          { path: ['ranker', 'feedSvc'], tone: 'response', label: 'top 20', duration: 1.2, delay: 2.4 },
          { path: ['feedSvc', 'postCache'], tone: 'request', label: 'MGET 20 posts', duration: 1, delay: 3.7 },
          { path: ['feedSvc', 'gateway', 'reader'], tone: 'response', label: 'JSON page', duration: 1.3, delay: 4.8 },
          { path: ['cdn', 'reader'], tone: 'data', label: 'images', count: 3, duration: 1, delay: 6.1 },
        ],
        caption: 'Ids in, ranked and hydrated posts out',
      },
    },
    {
      title: 'Pages, freshness',
      tag: 'tradeoff',
      heading: 'Cursors for scrolling, a banner for new posts',
      eli5: 'Your bookmark says "I stopped at letter 7301", so the next pile starts after it even if new letters arrived on top. A little flag on the mailbox says new mail is waiting, and you choose when to look.',
      body: [
        '**Pagination** uses a cursor. With an offset such as `offset=20`, ten new posts arriving at the top shift everything down, and page two repeats posts from page one. A cursor holds the last id (or, for a ranked feed, a handle to the ranked list built for this session), so page two starts exactly where page one ended. The API design lesson covers why cursors beat offsets.',
        '**Freshness.** Posts arrive in the feed cache within seconds of being published. The app does not reorder what the reader is looking at. It asks `since=<newest id>` when it comes to the foreground and every minute or so while open, and shows a "12 new posts" banner. Pulled outboxes are always current because they are read live.',
        '**Deletes and unfollows** are applied at read time. Removing a deleted post from 40M lists is slow, so hydration drops posts marked deleted and authors the reader no longer follows. Old ids age out of the 500 cap.',
      ],
      keyIdea: 'Cursors keep pages stable while the feed grows, and read-time filters keep it correct without rewriting millions of lists.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...reader, status: 'active', badge: '12 new posts' }, gateway, { ...feedSvc, status: 'active', badge: 'cursor before=7301…' }, { ...feedCache, status: 'ok' }, { ...postCache, badge: 'deleted: hidden' }],
        links: readLinks.filter((l) => l.to !== 'postDb'),
        flows: [
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'next page', duration: 1.3 },
          { path: ['feedSvc', 'feedCache', 'feedSvc'], tone: 'response', label: 'ids < cursor', duration: 1.4, delay: 1.4 },
          { path: ['reader', 'gateway', 'feedSvc'], tone: 'request', label: 'since=newest', duration: 1.3, delay: 3.2 },
          { path: ['feedSvc', 'gateway', 'reader'], tone: 'response', label: 'count: 12', duration: 1.3, delay: 4.6 },
        ],
        caption: 'Scroll down by cursor, check for new posts on top',
      },
    },
    {
      title: 'Shard failure',
      tag: 'case',
      heading: 'Case: a feed cache shard dies at peak',
      eli5: 'One row of mailboxes is knocked over. A spare row with copies takes its place, and if some copies are missing, clerks rebuild those mailboxes one family at a time instead of all at once.',
      body: [
        'The feed cache runs 32 shards. One primary dies at 8 PM, and the feeds of about 6M readers are gone from it. Each shard has a **replica** (the replication lesson). The failover manager promotes it in about 10 seconds, and readers on that shard see errors or an older page for those seconds.',
        'If the replica is also lost, fall back to pull for the affected readers. A naive fallback is dangerous: 1/32 of 70K loads is about 2,200 loads a second, each needing a 300-author merge, which is 650K post store lookups a second on top of normal load. So rebuild each reader\'s feed **once** with single-flight (the caching lesson), cap rebuilds to a fixed rate, and show a short "catching up" feed from the big-account outboxes meanwhile.',
        'Nothing is lost on the write side. Posts are durable in the post store before the fan-out event is queued, and the queue keeps events until workers confirm them, so a slow worker pool only makes feeds late. Every post is already safe.',
      ],
      keyIdea: 'The feed cache is derived data: protect it with replicas, and rebuild it slowly from the post store when you must.',
      metrics: { reads: '70K/s peak', latency: '400 ms on 1 shard', fanout: '250K/s', db: '14K/s + capped rebuilds', cache: '31 of 32 shards' },
      scene: {
        nodes: [reader, { ...feedSvc, status: 'active', badge: 'rebuild, 1K feeds/s cap' }, { ...feedCache, status: 'down', badge: 'shard 17 down' }, { ...feedReplica, status: 'ok', badge: 'promoted' }, postCache, { ...postDb, status: 'active' }, { ...workers, status: 'ok' }, { ...queue, status: 'ok', badge: 'events kept' }],
        links: [
          { from: 'reader', to: 'feedSvc' },
          { from: 'feedSvc', to: 'feedCache', style: 'faint' },
          { from: 'feedSvc', to: 'feedReplica' },
          { from: 'feedSvc', to: 'postCache' },
          { from: 'postCache', to: 'postDb', style: 'faint' },
          { from: 'queue', to: 'workers' },
          { from: 'workers', to: 'feedReplica', style: 'dashed' },
        ],
        flows: [
          { path: ['feedSvc', 'feedCache'], tone: 'error', label: 'timeout', duration: 1 },
          { path: ['feedSvc', 'feedReplica'], tone: 'request', label: 'retry on replica', duration: 1.1, delay: 1.1 },
          { path: ['feedSvc', 'postCache', 'postDb'], tone: 'request', label: 'rebuild one feed', duration: 1.6, delay: 2.4 },
          { path: ['queue', 'workers', 'feedReplica'], tone: 'event', label: 'fan-out resumes', duration: 1.6, delay: 2.4 },
        ],
        caption: 'Promote the replica, rebuild what is missing slowly',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Precompute most feeds, pull the rest, keep ids small',
      eli5: 'Copy ordinary letters into **mailboxes** ahead of time, pin the mayor\'s newsletter on the board, keep only letter numbers in the box, and fetch the letters and pictures when the family looks.',
      body: [
        'Pull was simple and collapsed at 21M lookups per second. **Fan-out on write** made each read one cache call and cost 360K inserts per second. The **hybrid** design pulls the few accounts with huge followings and skips inactive readers, which brought fan-out to about 250K per second and kept p99 near 90 ms.',
        'The feed cache holds 500 ids per reader. Ranking picks from them, caches hydrate them, and the CDN serves media. Cursors keep scrolling stable, read-time filters handle deletes and unfollows, and replicas plus a rate-capped rebuild cover a dead shard.',
      ],
      keyIdea: 'A feed is a read-optimized copy of the follow graph applied to posts. Decide per account whether to build it at write time or read time.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [reader, cdn, gateway, postSvc, queue, workers, feedSvc, { ...feedCache, status: 'ok' }, { ...postCache, status: 'ok' }],
        links: [...readLinks.filter((l) => l.to !== 'postDb'), { from: 'gateway', to: 'postSvc' }, { from: 'postSvc', to: 'queue' }, { from: 'queue', to: 'workers' }, { from: 'workers', to: 'feedCache', style: 'dashed' }, { from: 'reader', to: 'cdn', style: 'dashed' }],
        flows: [
          { path: ['gateway', 'postSvc', 'queue', 'workers', 'feedCache'], tone: 'event', label: 'push', duration: 2.6 },
          { path: ['reader', 'gateway', 'feedSvc', 'feedCache'], tone: 'request', duration: 2, delay: 1 },
          { path: ['feedSvc', 'postCache', 'feedSvc'], tone: 'response', label: 'hydrate', duration: 1.4, delay: 3.1 },
          { path: ['cdn', 'reader'], tone: 'data', duration: 1, delay: 4.6 },
        ],
      },
      quiz: {
        question: 'Posts arrive at 1,200/s and the average account has 300 followers. With pure fan-out on write, about how many feed cache inserts per second does that create on average?',
        options: ['4,000', '36,000', '360,000', '21,000,000'],
        answer: 2,
        explain: '1,200 posts per second times 300 followers is 360,000 inserts per second. That is the write-side bill the hybrid design trims by pulling big accounts and skipping inactive readers.',
      },
    },
  ],
};
