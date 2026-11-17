import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const player: SceneNode = { id: 'player', kind: 'phone', at: p(-7, 3.5), label: 'player', sub: 'lobby screen' };
const api: SceneNode = { id: 'api', kind: 'block', at: p(-2, 0), label: 'Leaderboard API', sub: 'stateless', icon: 'Network', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(3.5, 4), label: 'scores DB', sub: 'source of truth' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: p(3.5, -4), label: 'Redis', sub: 'sorted set lb:2026-11', tint: 'red' };
const replica: SceneNode = { id: 'replica', kind: 'cache', at: p(8, -4), label: 'Redis replica', sub: 'async copy', tint: 'red' };
const reconciler: SceneNode = { id: 'reconciler', kind: 'worker', at: p(8, 3.5), label: 'rebuild job', sub: 'pipelined ZADD' };
const snap: SceneNode = { id: 'snap', kind: 'block', at: p(8, 0), size: 0.72, label: 'top 10 cache', sub: '1 s TTL', icon: 'Star', tint: 'amber' };

const sh1: SceneNode = { id: 'sh1', kind: 'shard', at: p(2, -4.5), label: 'shard 1', sub: 'users hash 0' };
const sh2: SceneNode = { id: 'sh2', kind: 'shard', at: p(4.5, -0.5), label: 'shard 2', sub: 'users hash 1' };
const sh3: SceneNode = { id: 'sh3', kind: 'shard', at: p(7, 3.5), label: 'shard 8', sub: 'users hash 7' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designLeaderboardPart2: Lesson = {
  id: 'design-leaderboard-part-2',
  title: 'Design a gaming leaderboard (part 2)',
  tagline: 'Cache the top 10, push live updates, add friends boards, shard a 500M-player board and recover from a lost Redis.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'Caching the top 10 and pushing live rank changes',
    'Friends boards from small sorted sets',
    'Sharding a huge board by score range or by hash, with scatter-gather reads',
    'Approximate ranks for the long tail of a giant board',
    'Failover and rebuilding Redis from the database',
  ],
  metrics: [
    { key: 'players', label: 'Players on board', icon: 'Users' },
    { key: 'writes', label: 'Score updates', icon: 'Zap' },
    { key: 'reads', label: 'Board reads', icon: 'Download' },
    { key: 'p99', label: 'My-rank p99', icon: 'Timer' },
    { key: 'work', label: 'Work per rank query', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Top 10 cache',
      tag: 'concept',
      heading: 'Everyone asks for the same top 10',
      eli5: 'Thousands of kids ask the teacher for the top 10, and the answer is the same for all of them. She writes it on a small card once a second and points at the card.',
      body: [
        'The top 10 is identical for every player, so about half of the 15,000 reads per second ask for the same answer. Cache it in the API for one second.',
        'Redis now sees one top 10 call a second per API server instead of thousands. A one-second delay is invisible to players, and "my rank" stays live because it differs per player.',
      ],
      keyIdea: 'A shared answer is worth caching for a second. A per-player answer is not.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '7,500/s on Redis', p99: '2 ms', work: '~40 skip-list steps' },
      metricTones: { reads: 'good' },
      scene: {
        nodes: [player, { ...api, status: 'active' }, { ...snap, status: 'ok', badge: 'hit' }, { ...redis, status: 'ok', load: 9 }],
        links: [link('player', 'api'), link('api', 'snap'), link('api', 'redis')],
        flows: [
          { path: ['player', 'api', 'snap'], tone: 'request', label: 'top 10', count: 3, duration: 1.6 },
          { path: ['api', 'redis'], tone: 'request', label: 'once a second', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Which reads can share',
          icon: 'Copy',
          rows: [
            { text: 'Top 10', value: 'same for all', tone: 'good' },
            { text: 'My rank', value: 'per player', tone: 'warn' },
            { text: 'Redis top-10 calls', value: '1 per second', tone: 'good' },
          ],
        },
        caption: 'One Redis call serves thousands of lobbies',
      },
    },
    {
      title: 'Live updates',
      tag: 'concept',
      heading: 'Pushing rank changes instead of polling',
      eli5: 'Instead of every kid walking up to ask again and again, the teacher calls out when someone passes you.',
      body: [
        'Polling "my rank" every few seconds from every open lobby is wasteful. Instead the app keeps a WebSocket open to a push service, and the API publishes an event when the top 10 changes or a player\'s rank moves a lot.',
        'Fan-out is the cost: a win moves the rank of millions of others, so push only top 10 changes and let rank refresh on a slower timer.',
      ],
      keyIdea: 'Push the few changes everyone cares about and poll the rest slowly.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '7,500/s on Redis', p99: '2 ms', work: '~40 skip-list steps' },
      metricTones: { reads: 'good' },
      scene: {
        nodes: [
          { ...player, chips: ['WebSocket open'] },
          { ...api, status: 'active' },
          { id: 'push', kind: 'block', at: p(8, 0), size: 0.72, label: 'push service', icon: 'Rss', tint: 'teal' },
          { ...redis, status: 'ok' },
        ],
        links: [link('api', 'redis'), link('api', 'push'), link('push', 'player', { label: 'top 10 changed', style: 'dashed' })],
        flows: [
          { path: ['api', 'redis'], tone: 'data', label: 'ZADD', duration: 1.2 },
          { path: ['api', 'push'], tone: 'event', label: 'top 10 changed', duration: 1.2, delay: 1.3 },
          { path: ['push', 'player'], tone: 'event', label: 'new top 10', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'What gets pushed',
          icon: 'Rss',
          rows: [
            { text: 'Top 10 changed', value: 'push', tone: 'good' },
            { text: 'My rank moved a lot', value: 'push' },
            { text: 'My rank moved by 1', value: 'wait for timer', tone: 'muted' },
          ],
        },
        caption: 'Few events, sent to many',
      },
    },
    {
      title: 'Friends board',
      tag: 'concept',
      heading: 'A friends leaderboard from small sorted sets',
      eli5: 'Each kid also has a small board only for their friends. Finding your place among 200 friends is a glance, even though the school has 25 million kids.',
      body: [
        'A friends board ranks you among a few hundred people, so it does not need the global structure. Read each friend\'s score with one pipelined `ZMSCORE` call on the global key and sort the answers in the API.',
        'For a few hundred friends that is tiny work. Store friend lists in the database and cache them per player.',
      ],
      keyIdea: 'A small group is ranked by reading its scores and sorting them in memory.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '7,500/s on Redis', p99: '4 ms', work: '200 lookups' },
      scene: {
        nodes: [player, { ...api, status: 'active', badge: 'sort 200 scores' }, { ...redis, status: 'ok', chips: ['ZMSCORE x200'] }, db],
        links: [link('player', 'api'), link('api', 'redis'), link('api', 'db', { style: 'faint', label: 'friend ids' })],
        flows: [
          { path: ['player', 'api'], tone: 'request', label: 'GET /friends', duration: 1.2 },
          { path: ['api', 'redis'], tone: 'request', label: '200 scores', duration: 1.2, delay: 1.3 },
          { path: ['api', 'player'], tone: 'response', label: 'friends ranked', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Friends of user 42',
          icon: 'Users',
          rows: [
            { text: '#1  Kite', value: '9,385' },
            { text: '#2  Pip', value: '9,301' },
            { text: '#3  You', value: '1,850', tone: 'good' },
          ],
          footer: { text: 'Cost grows with friends, not players', tone: 'good' },
        },
        caption: 'Rank among friends, not among everyone',
      },
    },
    {
      title: 'Why shard',
      tag: 'tradeoff',
      heading: 'Too big for one node: 500M players',
      eli5: 'The game goes worldwide and one **scoreboard** cannot hold every kid. The school splits it over several boards.',
      body: [
        'Picture an all-time global board with **500M players**: tens of GB of memory and around **50,000 writes per second**, more than one node should carry with headroom for failover.',
        'Redis Cluster shards by key, and one sorted set is one key that lives in one slot on one node, so the cluster cannot split the board for us. The app has to split it into several keys (the sharding lesson), and the shard key decides which query gets hard.',
      ],
      keyIdea: 'Past one node\'s memory or throughput, the board has to be split, and the split decides which reads are cheap.',
      metrics: { players: '500M (all-time)', writes: '50,000/s', reads: '60,000/s', p99: '~6 ms', work: '8 shards x O(log n)' },
      metricTones: { writes: 'warn', reads: 'warn' },
      scene: {
        nodes: [{ ...api, status: 'hot' }, { ...redis, status: 'hot', load: 92, badge: '~60 GB' }],
        links: [link('api', 'redis', { label: '110,000 ops/s', labelTone: 'warn' })],
        flows: [{ path: ['api', 'redis'], tone: 'request', count: 5, label: 'reads + writes', duration: 1.2 }],
        panel: {
          title: 'The all-time board',
          icon: 'Database',
          rows: [
            { text: 'Players', value: '500M', tone: 'warn' },
            { text: 'Memory', value: 'tens of GB', tone: 'warn' },
            { text: 'Writes', value: '50,000/s', tone: 'warn' },
            { text: 'Reads', value: '60,000/s', tone: 'warn' },
          ],
          footer: { text: 'No headroom for failover', tone: 'bad' },
        },
        caption: 'One node is at its limit',
      },
    },
    {
      title: 'Score ranges',
      tag: 'tradeoff',
      heading: 'Shard by score range',
      eli5: 'One board is for kids with 0 to 999 points, another for 1,000 to 9,999. The top board has few kids, so the top 10 is quick to find.',
      body: [
        'Shard 1 holds 0 to 999 points, shard 2 holds 1,000 to 9,999, and so on. The top 10 lives on the highest shard. My rank is my rank in my shard plus the sizes of the shards above (`ZCARD`, cheap to cache). Scores are skewed, so low ranges are crowded.',
        'A player crossing a boundary moves shards. Redis cannot do that atomically across nodes, so run `ZADD` on the new shard, then `ZREM` on the old. A crash between leaves a brief double entry for the reconciler to fix.',
      ],
      keyIdea: 'Score-range shards make top N cheap, but players move and load is skewed.',
      metrics: { players: '500M (all-time)', writes: '50,000/s', reads: '60,000/s', p99: '~3 ms', work: '1 shard + ZCARDs' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { ...sh1, label: 'shard top', sub: '10,000+ points', status: 'ok', badge: '2M players' },
          { ...sh2, label: 'shard mid', sub: '1,000 to 9,999', status: 'active', badge: '60M players' },
          { ...sh3, label: 'shard low', sub: '0 to 999', status: 'hot', load: 88, badge: '438M players' },
        ],
        links: [link('api', 'sh1'), link('api', 'sh2'), link('api', 'sh3')],
        flows: [
          { path: ['api', 'sh1'], tone: 'request', label: 'top 10', duration: 1.4 },
          { path: ['sh1', 'api'], tone: 'response', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Trade-offs',
          icon: 'Scale',
          rows: [
            { text: 'Top 10', value: 'one shard', tone: 'good' },
            { text: 'Crossing a boundary', value: 'move player', tone: 'warn' },
            { text: 'Low shard', value: 'crowded', tone: 'bad' },
          ],
        },
        caption: 'Cheap top 10, uneven load',
      },
    },
    {
      title: 'Hash partitions',
      tag: 'tradeoff',
      heading: 'Shard by hash and scatter-gather',
      eli5: 'Kids are dealt to 8 boards by their name, so each board has the same number. To find the overall top 10, the teacher asks every board for its best 10 and merges them.',
      body: [
        '**Fixed partitions** by hash of user id: load is even and players never move. Top 10 is a **scatter-gather**: ask all 8 shards for their top 10 and merge 80 entries. My rank sums `ZCOUNT` above my score from every shard.',
        'Pick a generous fixed count up front, such as 256 partitions on 8 nodes, so a new node takes whole partitions instead of rehashing players.',
        'Each call is O(log n) and they run in parallel, so reads stay at a few milliseconds.',
      ],
      keyIdea: 'Hash partitions spread load evenly but turn every read into scatter-gather.',
      metrics: { players: '500M (all-time)', writes: '50,000/s', reads: '60,000/s', p99: '~6 ms', work: '8 shards x O(log n)' },
      scene: {
        nodes: [player, { ...api, status: 'active', badge: 'merge 8 answers' }, { ...sh1, status: 'active' }, { ...sh2, status: 'active' }, { ...sh3, status: 'active' }],
        links: [link('player', 'api'), link('api', 'sh1'), link('api', 'sh2'), link('api', 'sh3')],
        flows: [
          { path: ['player', 'api'], tone: 'request', label: 'top 10', duration: 1 },
          { path: ['api', 'sh1'], tone: 'request', label: 'top 10', duration: 1, delay: 1.1 },
          { path: ['api', 'sh2'], tone: 'request', label: 'top 10', duration: 1, delay: 1.1 },
          { path: ['api', 'sh3'], tone: 'request', label: 'top 10', duration: 1, delay: 1.1 },
          { path: ['sh1', 'api'], tone: 'response', duration: 1, delay: 2.2 },
          { path: ['sh2', 'api'], tone: 'response', duration: 1, delay: 2.2 },
          { path: ['sh3', 'api'], tone: 'response', duration: 1, delay: 2.2 },
          { path: ['api', 'player'], tone: 'response', label: 'merged top 10', duration: 1, delay: 3.3 },
        ],
        caption: 'Scatter to every shard, gather and merge',
      },
    },
    {
      title: 'Approximate rank',
      tag: 'tradeoff',
      heading: 'Approximate rank for the long tail',
      eli5: 'A kid in 312,004,118th place does not care about the last digits. The teacher says "around 312 million" by adding up the counts of kids in every points band above theirs.',
      body: [
        'At 500M players nobody checks whether they are 312,004,118th or 312,004,121st. Keep a counter per score bucket (for example, per 10 points) and show ranks below the top 10,000 as "about 312M". A player with 600 points is below 62M players at 1,000 or more plus the buckets from 610 to 999, about 312M in all.',
        'Rank is a sum over every higher bucket. Coarse counters (per 1,000 points) beside the fine ones make it one pipelined read of about 100 counters. Exact rank stays for the top and for friends.',
      ],
      keyIdea: 'Spend exactness where players look closely, and approximate the long tail.',
      metrics: { players: '500M (all-time)', writes: '50,000/s', reads: '60,000/s', p99: '~2 ms', work: 'sum of ~100 buckets' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [player, { ...api, status: 'active', badge: '~312M' }, { ...redis, status: 'ok', label: 'buckets', sub: 'count per 10 points', chips: ['600-609: 3.1M'] }],
        links: [link('player', 'api'), link('api', 'redis')],
        flows: [
          { path: ['player', 'api', 'redis'], tone: 'request', label: 'buckets above 600', duration: 1.8 },
          { path: ['redis', 'api', 'player'], tone: 'response', label: 'about 312M', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Rank by buckets',
          icon: 'Table',
          rows: [
            { text: 'Players above 600 points', value: 'sum of buckets' },
            { text: 'Example: 600 points', value: 'about 312M', tone: 'good' },
            { text: 'Top 10,000', value: 'exact', tone: 'good' },
            { text: 'Everyone else', value: 'about', tone: 'muted' },
          ],
        },
        caption: 'Exact at the top, about at the bottom',
      },
    },
    {
      title: 'Node failure',
      tag: 'case',
      heading: 'Case: the Redis node dies at peak',
      eli5: 'Someone knocks the **scoreboard** over and it shatters. A spare board that copied every change goes up in seconds.',
      body: [
        'At 8 pm the Redis primary holding `lb:2026-11` crashes. A replica with automatic failover (the replication and failover lessons) is promoted within seconds.',
        'Replication is asynchronous, so the last few updates may be missing. The reconciler re-applies recently changed rows from `monthly_scores`, and because every write is `ZADD GT` with an absolute total, re-applying is harmless.',
      ],
      keyIdea: 'Failover brings a copy back in seconds. A reconciler fills the small gap.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'blip, then 2 ms', work: '~40 skip-list steps' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...redis, status: 'down', badge: 'crashed' }, { ...replica, status: 'ok', badge: 'promoted' }, { ...db, status: 'active' }],
        links: [link('api', 'redis', { style: 'faint' }), link('api', 'replica'), link('api', 'db')],
        flows: [
          { path: ['api', 'redis'], tone: 'error', label: 'no reply', duration: 1 },
          { path: ['api', 'replica'], tone: 'request', label: 'after failover', duration: 1.2, delay: 1.2 },
          { path: ['db', 'api', 'replica'], tone: 'data', label: 'recent totals', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: 'Primary crashes', value: 't = 0', tone: 'bad' },
            { text: 'Replica promoted', value: 'seconds', tone: 'good' },
            { text: 'Recent updates re-applied', value: 'reconciler' },
          ],
        },
        caption: 'Promote the replica, refill the gap',
      },
    },
    {
      title: 'Rebuild',
      tag: 'case',
      heading: 'Both copies lost: rebuild from the database',
      eli5: 'If both boards are lost, the teacher rebuilds the board from the notebook, line by line, while a small card shows the top 10 from a minute ago.',
      body: [
        'A job reads `monthly_scores` (score and `updated_at`) for the month in pages, packs each value, and loads them with pipelined `ZADD` batches of a few thousand: 25M rows at about 100,000 per second takes around **four minutes**. New writes go to the new key during the rebuild, and `GT` keeps whichever value is newer.',
        'Meanwhile the lobby shows a top 10 snapshot that a job saves every minute, and "my rank" shows as updating.',
      ],
      keyIdea: 'If the cache can be rebuilt from the source of truth, a cache loss is a short degradation, never data loss.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'rebuilding ~4 min', work: '100K rows/s' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [{ ...api, status: 'active', badge: 'serve snapshot' }, { ...replica, label: 'new Redis', sub: 'refilling', status: 'active', load: 55 }, { ...db, status: 'active', badge: '25M rows intact' }, reconciler],
        links: [link('api', 'replica'), link('reconciler', 'db'), link('reconciler', 'replica')],
        flows: [
          { path: ['db', 'reconciler'], tone: 'data', label: 'pages of rows', count: 3, duration: 1.2 },
          { path: ['reconciler', 'replica'], tone: 'data', label: 'ZADD GT batch', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Rebuild math',
          icon: 'Timer',
          rows: [
            { text: 'Rows to load', value: '25M' },
            { text: 'Load speed', value: '~100,000/s' },
            { text: 'Total', value: '~4 minutes', tone: 'warn' },
            { text: 'Points lost', value: '0', tone: 'good' },
          ],
        },
        caption: 'Refill from the database',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Scale it, shard it, rebuild it',
      eli5: 'Keep the top 10 on a card, shout big changes, split the board when the school gets huge, and rebuild from the notebook if the board breaks.',
      body: [
        'The top 10 is cached for a second and rank changes are pushed only when they matter. Friends boards sort a few hundred scores in memory. Past one node, shard by score range (cheap top 10, moving players) or by hash (even load, scatter-gather), and approximate the long tail.',
        'A lost Redis comes back by failover in seconds or a rebuild from the database in minutes, which is why Redis never held the only copy.',
      ],
      keyIdea: 'Cache what is shared, shard by the query you must keep cheap, and keep a durable store you can rebuild from.',
      metrics: { players: '500M (all-time)', writes: '50,000/s', reads: '60,000/s', p99: '~6 ms', work: '8 shards x O(log n)' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [player, { ...api, status: 'active' }, { ...snap, status: 'ok' }, { ...sh1, status: 'ok' }, db],
        links: [link('player', 'api'), link('api', 'snap'), link('api', 'sh1'), link('api', 'db')],
        flows: [
          { path: ['player', 'api', 'snap'], tone: 'request', label: 'top 10', duration: 1.6 },
          { path: ['api', 'sh1'], tone: 'request', label: 'ZCOUNT', duration: 1.2, delay: 1.7 },
          { path: ['db', 'api'], tone: 'data', label: 'rebuild source', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Part 2 in one table',
          icon: 'Star',
          rows: [
            { text: 'Top 10', value: 'cached 1 s', tone: 'good' },
            { text: 'Friends', value: 'ZMSCORE + sort' },
            { text: 'By score range', value: 'cheap top N' },
            { text: 'By hash', value: 'scatter-gather' },
            { text: 'Lost cache', value: 'rebuild ~4 min', tone: 'warn' },
          ],
        },
        caption: 'The full design',
      },
      quiz: {
        question: 'A global board is sharded into 8 hash partitions by user id. How do you compute one player\'s exact rank?',
        options: [
          'Ask only the shard that holds the player',
          'Ask every shard for ZCOUNT above the player\'s score and add the counts, plus one',
          'Copy all shards into one Redis node first',
          'Use the player\'s rank inside their own shard, times 8',
        ],
        answer: 1,
        explain: 'Hash partitions mix players of every score into every shard, so the players above you are spread across all of them. Counting above your score on each shard in parallel and summing gives the exact rank.',
      },
    },
  ],
};
