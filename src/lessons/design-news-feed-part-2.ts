import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Same layout as part 1: read lane on top, stores in the middle, write lane at the bottom.
const reader: SceneNode = { id: 'reader', kind: 'phone', at: at(-7, -3.8), label: 'reader', sub: 'opens the app' };
const author: SceneNode = { id: 'author', kind: 'phone', at: at(-7, 3.8), label: 'author', sub: 'writes a post' };
const feedSvc: SceneNode = { id: 'feedSvc', kind: 'block', at: at(0, -3.8), label: 'feed service', icon: 'Rss', tint: 'blue' };
const postSvc: SceneNode = { id: 'postSvc', kind: 'block', at: at(0, 3.8), label: 'post service', icon: 'FileText', tint: 'amber' };
const ranker: SceneNode = { id: 'ranker', kind: 'block', at: at(-3.5, 0), label: 'ranker', sub: 'scores candidates', icon: 'TrendingUp', tint: 'green' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(-3.5, 0), label: 'CDN', sub: 'photos, video' };
const feedCache: SceneNode = { id: 'feedCache', kind: 'cache', at: at(3.5, -3.8), label: 'feed cache', sub: '500 ids per reader' };
const postCache: SceneNode = { id: 'postCache', kind: 'cache', at: at(7, -3.8), label: 'post cache', sub: 'posts, users, counts' };
const graph: SceneNode = { id: 'graph', kind: 'db', at: at(3.5, 0), label: 'follow graph', sub: 'who follows whom' };
const postDb: SceneNode = { id: 'postDb', kind: 'db', at: at(10.5, 0), label: 'post store', sub: 'sharded by author' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(3.5, 3.8), label: 'fan-out queue' };
const workers: SceneNode = { id: 'workers', kind: 'worker', at: at(7, 3.8), label: 'fan-out workers' };
const replica: SceneNode = { id: 'feedReplica', kind: 'replica', at: at(7, 0), label: 'cache replica', sub: 'copy of shard 17' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designNewsFeedPart2: Lesson = {
  id: 'design-news-feed-part-2',
  title: 'Design a news feed (part 2)',
  tagline: 'Turn 500 ids into a page: rank, hydrate, scroll with cursors, stay correct after deletes, and survive a dead cache shard.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Ranking in brief, ads and mixing, and hydrating twenty posts from caches',
    'The caches a feed uses, hot posts, and like counters',
    'Media through the CDN, cursor pagination and the new posts banner',
    'Deletes, unfollows and mutes applied at read time',
    'Durable fan-out events, reading your own post, and sharding the feed cache',
    'What happens when a feed cache shard dies, and what to monitor',
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
      title: 'What is left',
      tag: 'problem',
      heading: 'We have 500 ids. A page needs more than that',
      eli5: 'The mailbox slip only has letter numbers. To hand the family a nice stack, the clerk still has to pick the best ones, fetch the letters, add pictures and mark where they stopped.',
      body: [
        'Part 1 left each reader with a list of up to 500 post ids, built by push for most accounts and by pull for the few huge ones. The p99 is about 80 ms.',
        'A page still needs ranking, the posts themselves, media, a cursor for scrolling and correct deletes. It also needs a plan for the day a cache shard dies.',
      ],
      keyIdea: 'Ids are not a page. Ranking, hydration, paging and failure handling are what remain.',
      metrics: { reads: '70K/s peak', latency: '80 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [reader, { ...feedSvc, status: 'active' }, { ...feedCache, status: 'ok', badge: '500 ids' }, postCache],
        links: [link('reader', 'feedSvc'), link('feedSvc', 'feedCache'), link('feedSvc', 'postCache', { style: 'dashed' })],
        flows: [
          { path: ['reader', 'feedSvc'], tone: 'request', label: 'GET /v1/feed', duration: 1.4 },
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: '500 ids', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Still to do',
          icon: 'List',
          rows: [
            { text: 'Rank the candidates', value: 'next' },
            { text: 'Fill in 20 posts', value: 'hydrate' },
            { text: 'Scroll without repeats', value: 'cursor' },
            { text: 'Deletes and unfollows', value: 'correct' },
            { text: 'A dead cache shard', value: 'recover' },
          ],
        },
        caption: 'Ids in the cache, a page still to build',
      },
    },
    {
      title: 'Ranking',
      tag: 'concept',
      heading: 'Rank the newest 100 candidates, keep the top 20',
      eli5: 'The clerk does not hand over letters in the order they arrived. The clerk puts the ones you will probably like most on top, the way you would sort your own mail.',
      body: [
        'The newest 100 of the 500 ids are the candidates. A ranked feed scores each with signals such as author affinity, post age, and early likes and comments, kept in a **feature store** and read in one batch per page.',
        'Scoring all 500 would be 500 x 70K = **35M lookups a second**. Scoring 100 is 7M, and the ranked list is cached per session. Newest first is the special case where the score is the creation time.',
      ],
      keyIdea: 'Ranking reads features for every candidate. Cap the candidates at the newest 100, batch the reads from a feature store, and cache the ranked list per session.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [feedSvc, { ...feedCache, status: 'ok' }, { ...ranker, status: 'active', load: 45, chips: ['100 candidates'] }, { id: 'features', kind: 'cache', at: at(7, 0), label: 'feature store', sub: 'counts, affinity', status: 'ok', badge: '7M lookups/s' }],
        links: [link('feedSvc', 'feedCache'), link('feedSvc', 'ranker', { label: 'tens of ms' }), link('ranker', 'features', { label: 'batched read' })],
        flows: [
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: 'newest 100 ids', duration: 1.2 },
          { path: ['feedSvc', 'ranker'], tone: 'request', label: 'score', duration: 1.2, delay: 1.3 },
          { path: ['ranker', 'features'], tone: 'request', label: '100 x features', duration: 1.2, delay: 2.6 },
          { path: ['ranker', 'feedSvc'], tone: 'response', label: 'top 20', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'What scoring costs',
          icon: 'TrendingUp',
          rows: [
            { text: 'Score all 500', value: '35M lookups/s', tone: 'bad' },
            { text: 'Score the newest 100', value: '7M lookups/s', tone: 'warn' },
            { text: 'Features live in', value: 'feature store, batched' },
            { text: 'Ranked list per session', value: 'cached, see cursors' },
          ],
          footer: { text: 'Newest first = score is the creation time', tone: 'muted' },
        },
        caption: 'Score 100, keep 20',
      },
    },
    {
      title: 'Mixing in',
      tag: 'tradeoff',
      heading: 'Ads and variety are rules on top of the ranked list',
      eli5: 'After sorting, the clerk adds a few notices from the town shop and makes sure you do not get five letters in a row from the same writer.',
      body: [
        'Ads and suggested posts come from other services and are mixed into the top 20 at fixed slots after ranking, so they never need to enter the feed cache.',
        'Simple **diversity rules** keep the page varied: no more than two posts in a row from one author, and no repeats of posts the reader already saw. Each rule is a cheap pass over 20 items.',
      ],
      keyIdea: 'Do the cheap business rules after ranking, on 20 items, not on every candidate.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [
          { ...feedSvc, status: 'active', chips: ['top 20 ranked'] },
          { id: 'ads', kind: 'block', at: at(-3.5, 0), label: 'ads service', sub: 'sponsored posts', icon: 'Star', tint: 'amber' },
          { ...reader, chips: ['page of 20'] },
        ],
        links: [link('ads', 'feedSvc', { label: 'slot 4 and 12' }), link('feedSvc', 'reader')],
        flows: [
          { path: ['ads', 'feedSvc'], tone: 'response', label: '2 sponsored', duration: 1.4 },
          { path: ['feedSvc', 'reader'], tone: 'response', label: 'page of 20', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Rules after ranking',
          icon: 'Split',
          rows: [
            { text: 'Sponsored posts', value: 'fixed slots' },
            { text: 'Same author in a row', value: 'max 2' },
            { text: 'Already seen', value: 'drop' },
          ],
        },
        caption: 'Ads and variety are a pass over 20 items',
      },
    },
    {
      title: 'Hydration',
      tag: 'concept',
      heading: 'Turn 20 ids into 20 posts with batched reads',
      eli5: 'The slip has only numbers, so the clerk fetches each letter from nearby **caches** in one batch, not one at a time.',
      body: [
        'The feed service turns 20 ids into 20 posts with batched reads from several caches: post content, author name and avatar, like and comment counters, and whether you liked each one.',
        'At 70K pages a second that is about 1.4M post lookups per second against the cache. The ranker\'s feature reads go to the feature store, not here. With a 99% hit rate the post store sees about **14K reads per second**.',
      ],
      keyIdea: 'Hydration is batched cache reads. The 99% hit rate is what keeps the post store quiet.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { db: 'good' },
      scene: {
        nodes: [{ ...feedSvc, status: 'active' }, { ...postCache, status: 'ok', badge: '99% hits', chips: ['MGET 20 posts'] }, { ...postDb, badge: '14K reads/s' }],
        links: [link('feedSvc', 'postCache'), link('postCache', 'postDb', { style: 'faint', label: '1% misses' })],
        flows: [
          { path: ['feedSvc', 'postCache'], tone: 'request', label: 'MGET 20 posts', duration: 1.4 },
          { path: ['postCache', 'feedSvc'], tone: 'response', label: '20 posts', duration: 1.4, delay: 1.5 },
          { path: ['postCache', 'postDb'], tone: 'request', label: 'miss', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Hydration math',
          icon: 'Gauge',
          rows: [
            { text: 'Pages per second', value: '70K' },
            { text: 'Posts per page', value: '20' },
            { text: 'Cache lookups per second', value: '1.4M' },
            { text: 'Hit rate', value: '99%', tone: 'good' },
            { text: 'Post store reads', value: '14K/s', tone: 'good' },
          ],
        },
        caption: '1.4M lookups a second, almost all from cache',
      },
    },
    {
      title: 'Cache layers',
      tag: 'concept',
      heading: 'A feed uses five different caches',
      eli5: 'The clerk keeps five boxes near the window: the slips, the letters, the who-follows-whom list, a note of which letters you already liked, and tally marks.',
      body: [
        'Each kind of data has its own access pattern and its own cache: the **feed cache** (ids per reader), the **content cache** (posts and authors), the **social graph cache** (follow lists and which followees are big accounts), the **action cache** (did I like this), and the **counter cache** (likes, comments).',
        'Splitting them lets each scale and expire on its own terms. Content is almost immutable, counters change constantly.',
      ],
      keyIdea: 'One cache per access pattern: ids, content, graph, my actions, counters.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [
          { ...feedSvc, status: 'active' },
          { ...feedCache, status: 'ok', badge: 'ids' },
          { ...postCache, status: 'ok', badge: 'content' },
          { ...graph, at: at(-3.5, 0), kind: 'cache', status: 'ok', badge: 'follow lists' },
        ],
        links: [link('feedSvc', 'feedCache'), link('feedSvc', 'postCache'), link('feedSvc', 'graph')],
        flows: [
          { path: ['feedSvc', 'feedCache'], tone: 'request', duration: 1.2 },
          { path: ['feedSvc', 'postCache'], tone: 'request', duration: 1.2, delay: 0.3 },
          { path: ['feedSvc', 'graph'], tone: 'request', duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'Five caches',
          icon: 'Layers',
          rows: [
            { text: 'Feed cache', value: 'post ids per reader' },
            { text: 'Content cache', value: 'posts, authors' },
            { text: 'Graph cache', value: 'follows, big accounts' },
            { text: 'Action cache', value: 'liked by me' },
            { text: 'Counter cache', value: 'likes, comments' },
          ],
        },
        caption: 'Each access pattern gets its own cache',
      },
    },
    {
      title: 'Hot posts',
      tag: 'case',
      heading: 'Case: one viral post is read 200,000 times a second',
      eli5: 'A letter everybody wants is read so often that the one shelf holding it gets crowded. The clerk keeps a copy at the window and splits the tally marks across several sheets.',
      body: [
        'A viral post makes one cache key hot, and its like counter takes thousands of increments a second. One key lives on one cache node, which becomes the bottleneck.',
        'Keep a **local in-process cache** with a 2 second expiry on the feed service for the hottest posts. Split a hot counter into 8 slots (`likes:7301:0` to `:7`), increment a random slot, and sum them on read.',
      ],
      keyIdea: 'A hot key needs a short local copy, and a hot counter needs to be split across keys.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [
          { ...feedSvc, status: 'active', badge: 'local cache 2 s' },
          { id: 'counters', kind: 'cache', at: at(3.5, 0), label: 'like counters', sub: '8 slots per hot post', status: 'ok' },
          { ...postCache, status: 'hot', load: 92, chips: [{ text: 'GET post 7301 x 200K/s', tone: 'warn' }] },
        ],
        links: [link('feedSvc', 'postCache', { label: 'hot key', labelTone: 'warn' }), link('feedSvc', 'counters')],
        flows: [
          { path: ['feedSvc', 'postCache'], tone: 'request', count: 6, duration: 1.2 },
          { path: ['feedSvc', 'counters'], tone: 'data', label: 'likes:7301:5 += 1', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Hot key fixes',
          icon: 'Zap',
          code: 'local cache   2 s expiry\nlikes:7301:0..7\nINCR a random slot\nread = sum of 8 slots',
          footer: { text: 'A few seconds of stale likes is fine', tone: 'muted' },
        },
        caption: 'Spread one hot key across many',
      },
    },
    {
      title: 'Media',
      tag: 'concept',
      heading: 'Images and video never pass through the feed service',
      eli5: 'The letter itself is only words. Pictures come from a kiosk on your own street, and the phone grabs them while it is still reading the words.',
      body: [
        'Posts carry CDN URLs (the CDN lesson). The phone downloads images from an edge near the reader while the JSON is still being parsed.',
        'The feed service handles about 1 KB per post of JSON, while the 10 TB a day of media goes from object storage to the edge to the phone.',
      ],
      keyIdea: 'Return URLs, not bytes. The CDN carries the heavy part of every page.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...reader, status: 'active' }, { ...cdn, status: 'active', badge: 'edge hit' }, feedSvc, { id: 'storage', kind: 'storage', at: at(0, 3.8), label: 'object storage', sub: 'origin' }],
        links: [link('reader', 'feedSvc', { label: 'JSON, 20 KB' }), link('reader', 'cdn', { style: 'dashed', label: 'images' }), link('cdn', 'storage', { style: 'faint', label: 'miss only' })],
        flows: [
          { path: ['feedSvc', 'reader'], tone: 'response', label: 'JSON with URLs', duration: 1.4 },
          { path: ['cdn', 'reader'], tone: 'data', label: 'images', count: 3, duration: 1.4, delay: 1.5 },
        ],
        caption: 'The JSON is small, the CDN carries the images',
      },
    },
    {
      title: 'Cursors',
      tag: 'tradeoff',
      heading: 'A cursor keeps pages stable while new posts arrive',
      eli5: 'Your bookmark says "I stopped at letter 7301", so the next pile starts right after it, even if new letters arrived on top.',
      body: [
        'With an offset such as `offset=20`, ten new posts at the top shift everything down and page two repeats posts. A **cursor** holds the last id, so page two starts where page one ended.',
        'For a ranked feed, the cursor is a key into the ranked top-N list, held in a **session cache** with a TTL of about 10 minutes. An expired cursor restarts from the top.',
      ],
      keyIdea: 'A cursor pins the place in the list. An offset moves when the list grows.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...reader, chips: ['next page'] }, { ...feedSvc, status: 'active', badge: 'before=7301…' }, { ...feedCache, status: 'ok' }, { id: 'sessions', kind: 'cache', at: at(7, 0), label: 'session cache', sub: 'ranked top-N, 10 min TTL', status: 'ok' }],
        links: [link('reader', 'feedSvc', { label: 'cursor' }), link('feedSvc', 'feedCache'), link('feedSvc', 'sessions', { style: 'dashed', label: 'ranked list' })],
        flows: [
          { path: ['reader', 'feedSvc'], tone: 'request', label: 'cursor=7301…', duration: 1.4 },
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: 'ids < 7301', duration: 1.2, delay: 1.5 },
          { path: ['feedSvc', 'reader'], tone: 'response', label: 'next 20', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Offset versus cursor',
          icon: 'Table',
          rows: [
            { text: 'offset=20, 10 new posts arrive', value: '10 repeats', tone: 'bad' },
            { text: 'cursor=7301, 10 new posts arrive', value: 'no repeats', tone: 'good' },
            { text: 'Ranked feed cursor', value: 'key into session cache' },
            { text: 'Session cache TTL', value: '~10 min' },
            { text: 'Expired cursor', value: 'restart from the top', tone: 'warn' },
          ],
        },
        caption: 'The next page starts at the bookmark',
      },
      quiz: {
        question: 'Ten new posts arrive at the top while a reader looks at page one. Why does `offset=20` repeat posts on page two?',
        options: [
          'The offset is applied before the list is sorted',
          'New posts push older posts down, so the same posts shift into the next window',
          'The cache evicts the first page',
          'Offsets are slower than cursors',
        ],
        answer: 1,
        explain: 'An offset counts positions from the top. When ten new posts arrive, every old post moves down ten places, so page two starts with posts the reader already saw. A cursor names the last id seen and ignores new arrivals.',
      },
    },
    {
      title: 'New posts',
      tag: 'tradeoff',
      heading: 'Check for new posts without moving the page',
      eli5: 'A little flag on the mailbox says new mail is waiting. You choose when to look, so the stack you are reading does not shuffle.',
      body: [
        'Posts arrive in the feed cache within seconds of being published. The app does not reorder what the reader is looking at. It asks `since=<newest id>` when it comes to the foreground and every minute or so while open, and shows a "12 new posts" banner.',
        'Pulled author recent lists are always current because they are read live.',
      ],
      keyIdea: 'Poll for a count of new posts and let the reader choose when to refresh.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...reader, status: 'active', badge: '12 new posts' }, { ...feedSvc, status: 'active' }, { ...feedCache, status: 'ok', badge: 'newest 7313…' }],
        links: [link('reader', 'feedSvc', { label: 'every minute' }), link('feedSvc', 'feedCache')],
        flows: [
          { path: ['reader', 'feedSvc'], tone: 'request', label: 'since=7301…', duration: 1.4 },
          { path: ['feedSvc', 'feedCache'], tone: 'request', label: 'count newer', duration: 1.2, delay: 1.5 },
          { path: ['feedSvc', 'reader'], tone: 'response', label: 'count: 12', duration: 1.4, delay: 2.8 },
        ],
        caption: 'Count first, load when the reader taps',
      },
    },
    {
      title: 'Deletes',
      tag: 'concept',
      heading: 'Apply deletes, unfollows and mutes at read time',
      eli5: 'If a writer takes back a letter or you stop following them, the clerk does not search every mailbox. The clerk just skips those letters when handing you the stack.',
      body: [
        'Removing a deleted post from 40M lists is slow, so hydration drops posts marked `deleted` and authors the reader no longer follows or has muted or blocked. Old ids age out of the 500 cap.',
        'The filter is a flag check on data hydration already loaded, so it adds almost no cost.',
      ],
      keyIdea: 'Filter at read time. Rewriting millions of lists for one delete costs more than checking a flag.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...feedSvc, status: 'active', badge: 'drop deleted' }, { ...feedCache, status: 'ok', badge: 'still holds id' }, { ...postCache, badge: 'deleted: true', status: 'active' }],
        links: [link('feedSvc', 'feedCache'), link('feedSvc', 'postCache')],
        flows: [
          { path: ['feedSvc', 'feedCache'], tone: 'request', duration: 1.2 },
          { path: ['feedSvc', 'postCache'], tone: 'request', label: 'MGET 20', duration: 1.2, delay: 1.3 },
          { path: ['postCache', 'feedSvc'], tone: 'error', label: '1 deleted, skip', duration: 1.3, delay: 2.6 },
        ],
        panel: {
          title: 'Read-time filters',
          icon: 'Shield',
          rows: [
            { text: 'Post marked deleted', value: 'drop' },
            { text: 'Author unfollowed', value: 'drop' },
            { text: 'Author muted or blocked', value: 'drop' },
            { text: 'Old ids', value: 'age out at 500' },
          ],
        },
        caption: 'The list can hold stale ids, the page never shows them',
      },
    },
    {
      title: 'Durable events',
      tag: 'concept',
      heading: 'A post must never be lost before it is fanned out',
      eli5: 'Once the letter is on the big shelf, the delivery note goes into a pile that is kept until a helper signs off. A slow helper makes mail late, never lost.',
      body: [
        'Posts are durable in the post store before the fan-out event is queued, and the queue keeps events until workers confirm them. Workers are **idempotent**: adding the same id to a sorted set twice changes nothing, so a retry is safe.',
        'An event that fails repeatedly moves to a dead letter queue for inspection. If the event cannot be queued, a small transactional **outbox table** in the post store lets a relay publish it later.',
      ],
      keyIdea: 'Store first, queue second, process at least once with idempotent writes.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...postSvc, status: 'active' }, { ...postDb, badge: 'saved first' }, { ...queue, status: 'ok', badge: 'events kept' }, { ...workers, status: 'active', chips: ['retry, same result'] }],
        links: [link('postSvc', 'postDb'), link('postSvc', 'queue'), link('queue', 'workers')],
        flows: [
          { path: ['postSvc', 'postDb'], tone: 'data', label: '1: store', duration: 1.2 },
          { path: ['postSvc', 'queue'], tone: 'event', label: '2: queue', duration: 1.2, delay: 1.3 },
          { path: ['queue', 'workers'], tone: 'event', label: '3: fan out', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Delivery guarantees',
          icon: 'Shield',
          rows: [
            { text: 'Order of steps', value: 'store, queue, fan out' },
            { text: 'Delivery', value: 'at least once' },
            { text: 'Duplicate ZADD', value: 'no change', tone: 'good' },
            { text: 'Repeated failure', value: 'dead letter queue' },
          ],
        },
        caption: 'Late is acceptable, lost is not',
      },
    },
    {
      title: 'Own posts',
      tag: 'tradeoff',
      heading: 'Authors must see their own post at once',
      eli5: 'Followers may get your letter a few seconds later, but you should see your own letter on top of your own stack right away.',
      body: [
        'Fan-out is eventually consistent, so followers see a post within seconds. The author cannot wait that long. The post service also inserts the id into the author\'s own feed list in the same request, and the app shows the new post immediately.',
        'The same rule covers a new follow: pull that author\'s last few posts into the reader\'s list at once.',
      ],
      keyIdea: 'Eventual consistency is fine for others and wrong for your own actions, so write your own feed synchronously.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...author, status: 'active', badge: 'sees it now' }, { ...postSvc, status: 'active' }, { ...feedCache, status: 'ok', badge: 'own list +1' }, { ...queue, badge: 'followers later' }],
        links: [link('author', 'postSvc'), link('postSvc', 'feedCache', { label: 'own feed, now' }), link('postSvc', 'queue', { style: 'dashed', label: 'followers, seconds' })],
        flows: [
          { path: ['author', 'postSvc'], tone: 'request', label: 'publish', duration: 1.2 },
          { path: ['postSvc', 'feedCache'], tone: 'data', label: 'own list', duration: 1.4, delay: 1.3 },
          { path: ['postSvc', 'queue'], tone: 'event', label: 'for followers', duration: 1.4, delay: 1.3 },
        ],
        caption: 'Your own post is never late',
      },
    },
    {
      title: 'Sharding',
      tag: 'concept',
      heading: 'Shard the feed cache by reader id',
      eli5: 'The mailboxes are split into 128 rows of the mail room, and a family\'s number tells you which row. Each row also has a spare row that keeps copies.',
      body: [
        'The feed cache runs **128 shards**, chosen by hashing the reader id (the consistent hashing lesson). Real Redis memory is about 5x the 1.6 TB raw figure, roughly 8 TB, so that is about 1.6M readers and 64 GB per shard. A read touches one shard, and a fan-out batch groups readers by shard.',
        'Lists are trimmed to 500 ids. Readers inactive for 30 days are evicted first, and the cache is **derived data** that can be rebuilt, so losing a key costs time and not content.',
      ],
      keyIdea: 'Shard by reader so one read hits one shard, and treat the feed cache as rebuildable.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '128 shards, 64 GB each' },
      scene: {
        nodes: [
          { ...feedSvc, status: 'active', chips: ['hash(reader) % 128'] },
          { id: 'shardA', kind: 'shard', at: at(3.5, -3.8), label: 'shard 16', sub: '1.6M readers' },
          { id: 'shardB', kind: 'shard', at: at(7, 0), label: 'shard 17', sub: '1.6M readers', status: 'active' },
          { id: 'shardC', kind: 'shard', at: at(3.5, 3.8), label: 'shard 18', sub: '1.6M readers' },
        ],
        links: [link('feedSvc', 'shardA', { style: 'faint' }), link('feedSvc', 'shardB'), link('feedSvc', 'shardC', { style: 'faint' })],
        flows: [{ path: ['feedSvc', 'shardB', 'feedSvc'], tone: 'request', label: 'feed:{reader}', duration: 2 }],
        panel: {
          title: 'Feed cache layout',
          icon: 'Layers',
          rows: [
            { text: 'Shards', value: '128' },
            { text: 'Readers per shard', value: '1.6M' },
            { text: 'Memory per shard, with overhead', value: '64 GB' },
            { text: 'Replica per shard', value: '1' },
          ],
        },
        caption: 'One reader, one shard',
      },
    },
    {
      title: 'Shard dies',
      tag: 'case',
      heading: 'Case: a feed cache shard dies at peak',
      eli5: 'One row of mailboxes is knocked over. A spare row with copies takes its place in a few seconds.',
      body: [
        'One primary dies at 8 PM, and the feeds of about 1.6M readers are gone from it. Each shard has a **replica** (the replication lesson). The failover manager promotes it in about 10 seconds, and readers on that shard see errors or an older page for those seconds.',
        'Replicas copy asynchronously, so the promoted replica may miss the last second of pushes. Those ids are filled back in by the next fan-out or the next rebuild.',
      ],
      keyIdea: 'Replicas turn a dead shard into ten seconds of errors for 1/128 of readers.',
      metrics: { reads: '70K/s peak', latency: '400 ms on 1 shard', fanout: '250K/s', db: '14K/s', cache: '127 of 128 shards' },
      metricTones: { latency: 'warn', cache: 'warn' },
      scene: {
        nodes: [reader, { ...feedSvc, status: 'active' }, { ...feedCache, status: 'down', badge: 'shard 17 down' }, { ...replica, status: 'ok', badge: 'promoted in 10 s' }],
        links: [link('reader', 'feedSvc'), link('feedSvc', 'feedCache', { style: 'faint' }), link('feedSvc', 'feedReplica')],
        flows: [
          { path: ['feedSvc', 'feedCache'], tone: 'error', label: 'timeout', duration: 1.2 },
          { path: ['feedSvc', 'feedReplica'], tone: 'request', label: 'retry on replica', duration: 1.4, delay: 1.3 },
          { path: ['feedReplica', 'feedSvc'], tone: 'response', label: 'older page', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Failover',
          icon: 'Activity',
          rows: [
            { text: 'Readers affected', value: '~1.6M (1 of 128)' },
            { text: 'Promotion time', value: '~10 s' },
            { text: 'Last second of pushes', value: 'may be missing', tone: 'warn' },
            { text: 'Other 127 shards', value: 'unaffected', tone: 'good' },
          ],
        },
        caption: 'Promote the replica',
      },
    },
    {
      title: 'Safe rebuild',
      tag: 'case',
      heading: 'Case: the replica is gone too, so rebuild slowly',
      eli5: 'If the spare row is also lost, clerks rebuild mailboxes one family at a time as they come asking, and a limited number each minute so the shelves are not stormed.',
      body: [
        'If the replica is also lost, affected readers fall back to pull: 550 loads a second times 300 authors is 165K post store lookups a second, 12 times the 14K baseline. Even a cap of 1K rebuilds a second means 1K x 300 = 300K lookups, 20 times baseline.',
        'So rebuild each feed once (single-flight), on demand for readers who open the app, from the author recent lists in the post cache. Only 1% miss, about 3K a second at the store.',
      ],
      keyIdea: 'The feed cache is derived data: protect it with replicas, and rebuild it on demand from author recent lists so the post store stays quiet.',
      metrics: { reads: '70K/s peak', latency: '400 ms on 1 shard', fanout: '250K/s', db: '~17K/s with rebuilds', cache: '127 of 128 shards' },
      metricTones: { db: 'warn', cache: 'warn' },
      scene: {
        nodes: [{ ...feedSvc, status: 'active', badge: 'rebuild cap 1K/s' }, { ...feedCache, status: 'down', badge: 'shard 17 gone' }, { ...postCache, status: 'ok', chips: ['recent:{author} lists'] }, { ...postDb, status: 'active', load: 30, badge: '~3K misses/s' }],
        links: [link('feedSvc', 'feedCache', { style: 'faint' }), link('feedSvc', 'postCache'), link('postCache', 'postDb', { style: 'faint', label: '1% misses' })],
        flows: [
          { path: ['feedSvc', 'postCache', 'feedSvc'], tone: 'response', label: 'catching up feed', duration: 1.6 },
          { path: ['feedSvc', 'postCache'], tone: 'request', label: 'rebuild: 300 recent lists', duration: 1.6, delay: 1.7 },
          { path: ['postCache', 'postDb'], tone: 'request', label: 'misses', duration: 1.2, delay: 3.4 },
          { path: ['feedSvc', 'feedCache'], tone: 'data', label: 'store feed', duration: 1.4, delay: 4.7 },
        ],
        panel: {
          title: 'Unsafe versus safe fallback',
          icon: 'Gauge',
          rows: [
            { text: 'Uncapped pull, post store', value: '165K lookups/s', tone: 'bad' },
            { text: 'Cap 1K x 300, post store', value: '300K lookups/s', tone: 'bad' },
            { text: 'Cap 1K x 300, recent lists', value: '300K cache reads/s', tone: 'good' },
            { text: 'Post store misses, 1%', value: '~3K/s', tone: 'good' },
            { text: 'Who rebuilds', value: 'readers who open the app, not all 1.6M (27 min at 1K/s)' },
          ],
        },
        caption: 'Rebuild each feed once, at a capped rate',
      },
    },
    {
      title: 'Monitoring',
      tag: 'concept',
      heading: 'Watch fan-out lag, not just latency',
      eli5: 'The post office manager watches how long a letter takes from drop-off to mailbox, how long the pile is, and how often a clerk finds the letter nearby.',
      body: [
        'The metric that predicts trouble is **fan-out lag**: the age of the oldest unprocessed event in the queue, along with queue depth. Alert when lag passes 30 seconds, and the worker pool needs more capacity or a celebrity is posting.',
        'Also track publish-to-visible time at p99, feed p99 per shard, cache hit rates and the number of capped rebuilds.',
      ],
      keyIdea: 'Fan-out lag and publish-to-visible time say whether followers see posts on time. Latency alone will not.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      scene: {
        nodes: [{ ...queue, status: 'active', badge: 'lag 4 s' }, { ...workers, status: 'ok' }, { id: 'monitor', kind: 'monitor', at: at(0, 3.8), label: 'metrics', sub: 'alerts' }, { ...feedCache, status: 'ok' }],
        links: [link('queue', 'workers'), link('workers', 'feedCache', { style: 'dashed' }), link('queue', 'monitor', { style: 'faint' })],
        flows: [
          { path: ['queue', 'workers'], tone: 'event', duration: 1.2 },
          { path: ['queue', 'monitor'], tone: 'data', label: 'lag, depth', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'What to alert on',
          icon: 'Activity',
          rows: [
            { text: 'Fan-out lag', value: '> 30 s', tone: 'warn' },
            { text: 'Publish to visible, p99', value: '< 5 s', tone: 'good' },
            { text: 'Feed p99 per shard', value: '< 200 ms' },
            { text: 'Post cache hit rate', value: '> 99%' },
            { text: 'Capped rebuilds', value: 'rising = trouble', tone: 'warn' },
          ],
        },
        caption: 'Measure how late posts are',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Precompute most feeds, pull the rest, keep ids small',
      eli5: 'Copy ordinary letters into **mailboxes** ahead of time, pin the mayor\'s newsletter on the board, keep only letter numbers in the box, and fetch the letters and pictures when the family looks.',
      body: [
        'Pull collapsed at 21M lookups per second. **Fan-out on write** made each read one cache call and cost 360K inserts per second. The **hybrid** design pulls the few huge accounts and skips inactive readers, bringing fan-out to about 250K per second at a p99 near 90 ms.',
        'The feed cache holds 500 ids per reader. Ranking picks from them, caches hydrate them and the CDN serves media. Cursors keep scrolling stable, read-time filters handle deletes, and replicas plus a capped rebuild cover a dead shard.',
      ],
      keyIdea: 'A feed is a read-optimized copy of the follow graph applied to posts. Decide per account whether to build it at write time or read time.',
      metrics: { reads: '70K/s peak', latency: '90 ms', fanout: '250K/s', db: '14K/s', cache: '1.6 TB raw' },
      metricTones: { latency: 'good', fanout: 'good', db: 'good' },
      scene: {
        nodes: [reader, { ...feedSvc, status: 'active' }, { ...feedCache, status: 'ok' }, { ...postCache, status: 'ok' }, { ...workers, status: 'ok' }],
        links: [link('reader', 'feedSvc'), link('feedSvc', 'feedCache'), link('feedSvc', 'postCache'), link('workers', 'feedCache', { style: 'dashed', label: 'push' })],
        flows: [
          { path: ['workers', 'feedCache'], tone: 'event', label: 'push', duration: 2 },
          { path: ['reader', 'feedSvc', 'feedCache'], tone: 'request', duration: 2, delay: 1 },
          { path: ['feedSvc', 'postCache', 'feedSvc'], tone: 'response', label: 'hydrate', duration: 1.4, delay: 3 },
        ],
        caption: 'Push, rank, hydrate, serve',
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
