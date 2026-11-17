import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const player: SceneNode = { id: 'player', kind: 'phone', at: p(-9, 2), label: 'player', sub: 'lobby screen' };
const gamesrv: SceneNode = { id: 'gamesrv', kind: 'server', at: p(-6.5, -4), label: 'game servers', sub: 'report wins' };
const api: SceneNode = { id: 'api', kind: 'service', at: p(-2.5, 0), label: 'leaderboard API', sub: 'stateless' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(2, 4), label: 'scores DB', sub: 'source of truth' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: p(2, -3.5), label: 'Redis', sub: 'sorted set lb:2026-11' };
const replica: SceneNode = { id: 'replica', kind: 'cache', at: p(7, -5), label: 'Redis replica', sub: 'async copy' };
const oldBoard: SceneNode = { id: 'oldBoard', kind: 'cache', at: p(7, -1), label: 'last month', sub: 'lb:2026-10' };
const reconciler: SceneNode = { id: 'reconciler', kind: 'worker', at: p(6.5, 2.5), label: 'reconciler', sub: 'repairs Redis' };

// Sharded layout.
const sh1: SceneNode = { id: 'sh1', kind: 'shard', at: p(1, -4.5), label: 'shard 1', sub: 'users hash 0' };
const sh2: SceneNode = { id: 'sh2', kind: 'shard', at: p(4.5, -1.5), label: 'shard 2', sub: 'users hash 1' };
const sh3: SceneNode = { id: 'sh3', kind: 'shard', at: p(8, 1.5), label: 'shard 8', sub: 'users hash 7' };

const baseLinks = [
  { from: 'player', to: 'api' },
  { from: 'gamesrv', to: 'api' },
  { from: 'api', to: 'redis' },
  { from: 'api', to: 'db' },
];

export const designLeaderboard: Lesson = {
  id: 'design-leaderboard',
  title: 'Design a gaming leaderboard',
  tagline: 'Show the top 10 and every player\'s exact rank for 25 million players, with scores changing thousands of times a second.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Why SQL ORDER BY is fine for the top 10 and hopeless for "my rank" at scale',
    'Redis sorted sets: ZINCRBY, ZREVRANGE and ZREVRANK, and why each is O(log n)',
    'Keeping the database as the source of truth and making score writes safe to retry',
    'Monthly boards as separate keys, and fair tie-breaking',
    'Sharding a huge board by score range or by fixed partitions, and rebuilding after a cache loss',
  ],
  metrics: [
    { key: 'players', label: 'Players on board' },
    { key: 'writes', label: 'Score updates' },
    { key: 'reads', label: 'Board reads' },
    { key: 'p99', label: 'My-rank p99' },
    { key: 'work', label: 'Work per rank query' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Top 10 and "where am I?" for 25 million players',
      eli5: 'On sports day every race win earns points. Thousands of kids keep asking the teacher two things: who is in the top 10, and what place am I in on the **scoreboard**?',
      body: [
        'A mobile game ranks players by points won this month. Every match win adds points. The lobby shows the **top 10**, plus the player\'s own rank with the four players just above and below.',
        'Scale: **10M daily players**, and **25M** have at least one win this month. Each plays about 10 matches a day and wins about half: 50M score updates a day, around 600 per second on average and **3,000 per second** at the evening peak. Lobby views read the board much more often: about **15,000 reads per second** at peak, split between top 10 and my rank.',
        'Targets: a win shows on the board within a second or two, rank reads return in under **50 ms** at p99, and no win is ever lost or counted twice. Game servers report results, never the phone, so a cheater cannot post a score directly.',
      ],
      keyIdea: 'Reads outnumber writes five to one, and every rank depends on everyone else\'s score.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'goal < 50 ms', work: '-' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active' }, db],
        links: [
          { from: 'player', to: 'api' },
          { from: 'gamesrv', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'event', label: 'win +10', count: 3, duration: 1.2 },
          { path: ['player', 'api'], tone: 'request', label: 'top 10, my rank', count: 5, duration: 1.2, delay: 0.4 },
          { path: ['api', 'db'], tone: 'request', count: 4, duration: 1, delay: 1.6 },
          { path: ['api', 'player'], tone: 'response', label: 'rank #1,204,551', duration: 1.2, delay: 2.8 },
        ],
        caption: 'Wins come from game servers, questions from players',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'Three calls and two tables',
      eli5: 'The referee at each race tells the teacher who won. Kids only ask questions. The teacher writes every win in a **notebook** with the race number, so the same win is never written twice.',
      body: [
        '`POST /v1/scores` is internal, called by game servers with `{match_id, user_id, points}`. `GET /v1/leaderboard/top?n=10` returns the top players. `GET /v1/leaderboard/me?around=4` returns my rank, my score and four neighbors on each side. Both reads take an optional `month`, defaulting to the current one.',
        'A `wins` table records each scored match with `match_id` as the primary key, so a retried report is rejected as a duplicate. A `monthly_scores` table holds one row per player per month with the running total. The first is the audit trail, the second is what gets ranked.',
        'Writing is easy. The hard part is reading: a rank is a fact about the whole table, and it changes whenever anyone above or below you wins.',
      ],
      keyIdea: 'Make each win unique by match id from the start, so every later layer can retry safely.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'goal < 50 ms', work: '-' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'wins, monthly_scores' }],
        links: [
          { from: 'player', to: 'api' },
          { from: 'gamesrv', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'request', label: 'POST match 88123', duration: 1.2 },
          { path: ['api', 'db'], tone: 'data', label: 'INSERT win', duration: 1, delay: 1.2 },
          { path: ['player', 'api'], tone: 'request', label: 'GET /me?around=4', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Game servers write, players read',
      },
    },
    {
      title: 'SQL first',
      tag: 'concept',
      heading: 'First try: one table and an index',
      eli5: 'The teacher keeps a **notebook** sorted by points. Reading the top 10 means reading the first ten lines, which takes no time at all.',
      body: [
        'Each win runs an upsert that adds points to the player\'s row. An index on `(month, score DESC)` keeps rows in score order, so the top 10 is an index scan that stops after ten rows. That stays fast at any size.',
        'My rank is the number of players with a higher score, plus one. With 100,000 players this takes a few milliseconds and the design is perfectly fine. Many games never outgrow it, and a design review should say so before reaching for anything else.',
      ],
      keyIdea: 'An ordered index answers "the first N" cheaply. Whether it can answer "how many before me" is the real question.',
      metrics: { players: '100K (launch)', writes: '20/s', reads: '100/s', p99: '5 ms', work: '~50K index entries' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active' }, { ...db, status: 'ok', badge: 'index on score' }],
        links: [
          { from: 'player', to: 'api' },
          { from: 'gamesrv', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['player', 'api', 'db'], tone: 'request', label: 'ORDER BY score DESC LIMIT 10', duration: 1.8 },
          { path: ['db', 'api', 'player'], tone: 'response', label: '10 rows', duration: 1.8, delay: 1.9 },
        ],
        caption: 'Fine at launch with 100,000 players',
      },
      code: {
        language: 'sql',
        title: 'The whole leaderboard in Postgres',
        source: `CREATE TABLE monthly_scores (
  month   char(7) NOT NULL,              -- '2026-11'
  user_id bigint  NOT NULL,
  score   bigint  NOT NULL,
  PRIMARY KEY (month, user_id)
);
CREATE INDEX by_score ON monthly_scores (month, score DESC);

-- a win: add 10 points
INSERT INTO monthly_scores VALUES ('2026-11', 42, 10)
ON CONFLICT (month, user_id) DO UPDATE SET score = monthly_scores.score + 10;

-- top 10: walks the index and stops after 10 entries
SELECT user_id, score FROM monthly_scores
WHERE month = '2026-11' ORDER BY score DESC LIMIT 10;

-- my rank: must count every player above me
SELECT COUNT(*) + 1 FROM monthly_scores
WHERE month = '2026-11' AND score > (
  SELECT score FROM monthly_scores WHERE month = '2026-11' AND user_id = 42);`,
        highlight: [7, 15, 18, 19],
      },
    },
    {
      title: 'Rank melts',
      tag: 'problem',
      heading: 'Why "my rank" melts the database',
      eli5: 'To tell a kid their place, the teacher counts every name above theirs, one by one. For a kid in the middle of 25 million names, that takes ages, and thousands of kids are asking at once.',
      body: [
        'A B-tree finds my score quickly, but it does not know how many entries sit above it. `COUNT(*)` walks every one of them. A player in the middle of 25M walks about **12M index entries**, and most players are somewhere in the middle.',
        'About 7,500 rank queries per second at that depth is tens of billions of index entries per second. No database does that. Read replicas share the load, yet every replica still counts millions of entries per query. Caching the answer barely helps: each win shifts the rank of everyone it passes, so a cached rank goes stale within seconds.',
        'We need a structure that keeps the counts up to date as scores change, so a rank can be read without walking the list.',
      ],
      keyIdea: 'A sorted index gives order. Turning order into a position means counting, and that costs time proportional to the rank.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '3 s+', work: '~12M index entries' },
      scene: {
        nodes: [{ ...player, status: 'hot', sub: 'spinner...' }, gamesrv, { ...api, status: 'hot', badge: 'timeouts' }, { ...db, status: 'hot', badge: 'CPU 100%: COUNT(*)' }],
        links: [
          { from: 'player', to: 'api' },
          { from: 'gamesrv', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['player', 'api'], tone: 'request', label: 'my rank?', count: 6, duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'COUNT where score > 1,840', count: 6, duration: 1.2, delay: 1 },
          { path: ['db', 'api', 'player'], tone: 'error', label: 'timeout', duration: 2, delay: 2.4 },
        ],
        caption: 'Each rank query counts millions of rows',
      },
    },
    {
      title: 'Sorted sets',
      tag: 'concept',
      heading: 'Redis sorted sets keep the ranking for you',
      eli5: 'The teacher switches to a magic **scoreboard** that slides each kid into the right place the moment they score. Finding the top 10 or anyone\'s place is now a quick glance, with no counting.',
      body: [
        'A Redis **sorted set** stores members with a numeric score and keeps them ordered (the caching lesson introduced Redis). Inside, a hash maps member to score and a **skip list** keeps the order. Each skip-list link also records how many entries it jumps over, so Redis adds up a member\'s rank while it walks down to it.',
        'The three calls we need are all logarithmic. `ZINCRBY lb:2026-11 10 user:42` adds points in O(log n). `ZREVRANGE lb:2026-11 0 9 WITHSCORES` returns the top 10 in O(log n + 10). `ZREVRANK lb:2026-11 user:42` returns my rank in O(log n). With 25M players, log2 n is about 25 steps. Newer Redis versions also spell the range call `ZRANGE ... REV`.',
        'Memory is roughly 100 bytes per player with a short id, so 25M players need a few GB, and one Redis node serves on the order of 100,000 of these operations per second. The whole board fits on one machine with room to spare.',
      ],
      keyIdea: 'A sorted set keeps order and position together, so top N, rank and neighbors all cost O(log n).',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~25 skip-list steps' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active' }, { ...redis, status: 'ok', badge: '~3 GB, O(log n)' }, { ...db, status: 'dim' }],
        links: baseLinks,
        flows: [
          { path: ['gamesrv', 'api', 'redis'], tone: 'request', label: 'ZINCRBY +10', count: 2, duration: 1.6 },
          { path: ['player', 'api', 'redis'], tone: 'request', label: 'ZREVRANK', count: 3, duration: 1.6, delay: 0.8 },
          { path: ['redis', 'api', 'player'], tone: 'response', label: '#1,204,551', duration: 1.6, delay: 2.5 },
        ],
        caption: 'Rank is read straight from the skip list',
      },
      code: {
        language: 'python',
        title: 'Top 10, my rank and my neighbors with redis-py',
        source: `import redis
r = redis.Redis(host="lb-redis.internal", decode_responses=True)

def board(month):
    return f"lb:{month}"                                   # one sorted set per month

def add_win(month, user_id, points):
    r.zincrby(board(month), points, f"user:{user_id}")      # O(log n)

def top(month, n=10):
    return r.zrevrange(board(month), 0, n - 1, withscores=True)   # O(log n + n)

def me(month, user_id, around=4):
    key, member = board(month), f"user:{user_id}"
    rank = r.zrevrank(key, member)                         # O(log n), 0-based
    if rank is None:
        return None                                        # no wins this month
    lo = max(rank - around, 0)
    neighbors = r.zrevrange(key, lo, rank + around, withscores=True)
    return rank + 1, neighbors`,
        highlight: [8, 11, 15, 19],
      },
    },
    {
      title: 'Source of truth',
      tag: 'concept',
      heading: 'The database stays the source of truth',
      eli5: 'The teacher still writes every win in the **notebook** first, then moves the kid on the scoreboard. If the board is ever wiped, the notebook has every point.',
      body: [
        'Redis holds the ranking, but it never holds the only copy of anyone\'s points. On each win the API inserts into `wins` keyed by `match_id` and bumps `monthly_scores` in one transaction, then updates Redis. A retried report hits the primary key and is ignored, so a win counts once.',
        '`ZINCRBY` is unsafe to retry: if Redis applied it but the reply was lost, a retry adds the points twice. So the API writes the new total, read back from the database, with `ZADD`, which sets an absolute score. Applying it twice leaves the same value (the timeouts, retries, backoff and jitter lesson calls this idempotency). The `GT` flag, available since Redis 6.2, only ever raises a score, so a late write of an older total cannot overwrite a newer one.',
        'If the Redis write fails after the commit, the user id goes on a retry list, and a **reconciler** regularly compares recently changed rows with Redis and repairs any difference. The board may lag by seconds, and no points are ever lost.',
      ],
      keyIdea: 'Commit the win to the database first, then copy an absolute total into Redis with a write that is safe to repeat.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~25 skip-list steps' },
      scene: {
        nodes: [
          player,
          gamesrv,
          { ...api, status: 'active' },
          { ...db, status: 'active', badge: 'commit first' },
          { ...redis, status: 'ok', badge: 'ZADD GT 1,850' },
          { ...reconciler, status: 'active' },
        ],
        links: [...baseLinks, { from: 'reconciler', to: 'db', style: 'dashed' }, { from: 'reconciler', to: 'redis', style: 'dashed' }],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'request', label: 'match 88123 +10', duration: 1 },
          { path: ['api', 'db'], tone: 'data', label: 'INSERT win, total = 1,850', duration: 1, delay: 1.1 },
          { path: ['db', 'api'], tone: 'response', label: 'committed', duration: 0.9, delay: 2.2 },
          { path: ['api', 'redis'], tone: 'data', label: 'ZADD GT', duration: 0.9, delay: 3.2 },
          { path: ['reconciler', 'redis'], tone: 'event', label: 'repair drift', duration: 1.4, delay: 4.2 },
        ],
        caption: 'Database first, then an idempotent copy into Redis',
      },
    },
    {
      title: 'Monthly boards',
      tag: 'concept',
      heading: 'A new board every month',
      eli5: 'On the first day of each month the teacher hangs a fresh, empty **scoreboard** and carries last month\'s board to the archive, where anyone can still look up the old results.',
      body: [
        'Each month gets its own key: `lb:2026-11`, then `lb:2026-12`. The reset is free. On December 1 at 00:00 UTC, writes start going to a key that does not exist yet, and the first `ZADD` creates it. Nobody has to wipe 25M entries at midnight.',
        'Old boards stop changing. A job saves the final top 1,000 and every player\'s final rank to the database for history pages and rewards, then sets an expiry on the old key a few days later to free its memory. Pick one time zone for the reset and show the countdown in the app.',
        'The same idea gives daily, weekly or per-country boards: one key per board. Each win then writes to a few keys, which costs a few more O(log n) operations and nothing else.',
      ],
      keyIdea: 'Put the time period in the key name, so a reset is a new key and an old board is just a key you archive and expire.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~25 skip-list steps' },
      scene: {
        nodes: [
          player,
          gamesrv,
          { ...api, status: 'active' },
          { ...redis, label: 'this month', sub: 'lb:2026-12', status: 'ok', badge: 'new, empty' },
          { ...oldBoard, status: 'dim', badge: 'EXPIRE in 7 days' },
          { ...db, badge: 'final ranks saved' },
        ],
        links: [...baseLinks, { from: 'oldBoard', to: 'db', style: 'dashed', label: 'archive' }],
        flows: [
          { path: ['gamesrv', 'api', 'redis'], tone: 'request', label: 'ZADD lb:2026-12', count: 2, duration: 1.6 },
          { path: ['oldBoard', 'db'], tone: 'data', label: 'final standings', duration: 1.6, delay: 1.2 },
          { path: ['player', 'api', 'redis'], tone: 'request', label: 'top 10', duration: 1.6, delay: 2.4 },
        ],
        caption: 'December writes go to a new key',
      },
      quiz: {
        question: 'It is December 1 at 00:00 UTC. What must happen to reset the monthly leaderboard?',
        options: [
          'Delete all 25M entries from lb:2026-11 as fast as possible',
          'Nothing urgent: new wins write to lb:2026-12, which starts empty, and the old key is archived and expired later',
          'Set every score in lb:2026-11 to zero with ZADD',
          'Restart Redis so memory is cleared',
        ],
        answer: 1,
        explain: 'With the month in the key name, the reset is a change of key. The old board stays readable for final results until a job archives it and sets an expiry.',
      },
    },
    {
      title: 'Ties',
      tag: 'tradeoff',
      heading: 'Ties: who ranks higher on equal points?',
      eli5: 'Two kids both have 120 points. The rule says whoever got there first stands higher, so the teacher writes a tiny **time** next to each score to break the tie.',
      body: [
        'When scores are equal, Redis orders members by their name, byte by byte. For player ids that order is arbitrary, and players notice when someone who got there later sits above them. Pick a rule and make it visible: equal scores share a rank, or the earlier achiever ranks higher.',
        '**Shared rank** (both are 5th): read my score, then `ZCOUNT lb:2026-11 (1850 +inf` returns how many players are strictly above, and my rank is that plus one. Still O(log n).',
        '**Earlier wins**: pack the time into the score. Redis scores are 64-bit floats, exact for integers up to 2^53. Put points in the high bits and the seconds left in the month in the low 22 bits (2^22 seconds is about 48 days). At equal points the earlier finisher has more seconds left, so a larger value. That leaves 31 bits for points, over two billion. Since writes already send absolute totals with `ZADD GT`, the packed value is recomputed on every win.',
      ],
      keyIdea: 'Decide the tie rule up front. Shared ranks use ZCOUNT, earliest-first packs a time into the low bits of the score.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~25 skip-list steps' },
      scene: {
        nodes: [gamesrv, { ...api, status: 'active', badge: 'pack points + time' }, { ...redis, status: 'ok', badge: '1850 << 22 | time left' }, db],
        links: baseLinks.filter((l) => l.from !== 'player'),
        flows: [
          { path: ['gamesrv', 'api'], tone: 'request', label: 'reached 1,850 at 14:02', duration: 1.2 },
          { path: ['api', 'db'], tone: 'data', label: 'commit', duration: 1, delay: 1.3 },
          { path: ['api', 'redis'], tone: 'data', label: 'ZADD GT packed', duration: 1, delay: 2.4 },
        ],
        caption: 'Same points, earlier time, higher rank',
      },
      code: {
        language: 'python',
        title: 'Earliest-first tie-breaking packed into one Redis score',
        source: `from datetime import datetime, timezone

TIME_BITS = 22                          # 2**22 s is about 48.5 days > one month
TIME_MAX = (1 << TIME_BITS) - 1         # points get the remaining 31 bits of 2**53

def packed(points, achieved_at, month_start):
    secs = int((achieved_at - month_start).total_seconds())
    # More points always wins. At equal points, more time left (earlier) wins.
    return points * (1 << TIME_BITS) + (TIME_MAX - secs)

def points_of(value):
    return int(value) >> TIME_BITS      # what the app shows

def record_total(month, user_id, total, now):
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    value = packed(total, now, start)
    # GT: only raise the score, so a late, older total is ignored
    r.zadd(f"lb:{month}", {f"user:{user_id}": value}, gt=True)`,
        highlight: [3, 9, 12, 18],
      },
    },
    {
      title: 'Sharding',
      tag: 'tradeoff',
      heading: 'Too big for one node: sharding the board',
      eli5: 'The game goes worldwide and one **scoreboard** cannot hold every kid. The school splits it over several boards, then has to work out the overall top 10 and each kid\'s place across all of them.',
      body: [
        'Now picture an all-time global board with **500M players**: tens of GB of memory and around **50,000 writes per second**, more than one node should carry with headroom for failover. We shard it (the sharding lesson), and the shard key decides which query gets hard.',
        '**By score range**: shard 1 holds 0 to 999 points, shard 2 holds 1,000 to 9,999, and so on. The top 10 lives on the highest shard. My rank is my rank inside my shard plus the sizes of all shards above it (`ZCARD`, cheap to cache). The costs: a player who crosses a boundary must move between shards, and scores are skewed, so low ranges are crowded while the top range is tiny. Boundaries need tuning as the game ages.',
        '**Fixed partitions** by hash of user id, as in the scene: load is even and players never move. Top 10 becomes a **scatter-gather**: ask all 8 shards for their top 10 and merge 80 entries. My rank asks every shard for `ZCOUNT` above my score and sums the answers. Every read touches all shards, but each call is O(log n) and they run in parallel, so it stays at a few milliseconds, and the top 10 can be cached for a second.',
      ],
      keyIdea: 'Score-range shards make top N cheap but move players and skew load. Hash partitions spread load evenly but turn every read into scatter-gather.',
      metrics: { players: '500M (all-time)', writes: '50,000/s', reads: '60,000/s', p99: '~6 ms', work: '8 shards x O(log n)' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active', badge: 'merge 8 answers' }, { ...sh1, status: 'active' }, { ...sh2, status: 'active' }, { ...sh3, status: 'active' }],
        links: [
          { from: 'player', to: 'api' },
          { from: 'gamesrv', to: 'api' },
          { from: 'api', to: 'sh1' },
          { from: 'api', to: 'sh2' },
          { from: 'api', to: 'sh3' },
        ],
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
      title: 'Cache loss',
      tag: 'case',
      heading: 'Case: the Redis node dies at peak',
      eli5: 'Someone knocks the **scoreboard** over and it shatters. A spare board that copied every change goes up in seconds. If both are lost, the teacher rebuilds the board from the notebook, line by line.',
      body: [
        'At 8 pm the Redis primary holding `lb:2026-11` crashes. A replica with automatic failover (the replication and failover lessons) is promoted within seconds. Replication is asynchronous, so the last few updates may be missing. The reconciler re-applies recently changed rows from `monthly_scores`, and because every write is `ZADD GT` with an absolute total, re-applying is harmless.',
        'If both copies are lost, rebuild from the database. A job reads `monthly_scores` for the month in pages and loads them with pipelined `ZADD` batches of a few thousand: 25M rows at about 100,000 per second takes around **four minutes**. The API keeps writing new totals to the new key during the rebuild, and `GT` keeps whichever value is newer. Meanwhile the lobby shows a top 10 snapshot that a job saves every minute, and "my rank" shows as updating.',
        'This is why Redis never held the only copy. Losing it costs a few minutes of degraded rank reads, never a player\'s points.',
      ],
      keyIdea: 'If the cache can be rebuilt from the source of truth, a cache loss becomes a short degradation instead of data loss.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'rebuilding ~4 min', work: '~25 skip-list steps' },
      scene: {
        nodes: [
          player,
          gamesrv,
          { ...api, status: 'active', badge: 'serve snapshot' },
          { ...redis, status: 'down', badge: 'crashed' },
          { ...replica, status: 'ok', badge: 'promoted' },
          { ...db, status: 'active', badge: '25M rows intact' },
          { ...reconciler, label: 'rebuild job', sub: 'pipelined ZADD', status: 'active' },
        ],
        links: [
          { from: 'player', to: 'api' },
          { from: 'gamesrv', to: 'api' },
          { from: 'api', to: 'redis', style: 'faint' },
          { from: 'api', to: 'replica' },
          { from: 'api', to: 'db' },
          { from: 'reconciler', to: 'db' },
          { from: 'reconciler', to: 'replica' },
        ],
        flows: [
          { path: ['api', 'redis'], tone: 'error', label: 'no reply', duration: 1 },
          { path: ['api', 'replica'], tone: 'request', label: 'after failover', duration: 1.2, delay: 1.2 },
          { path: ['db', 'reconciler'], tone: 'data', label: 'recent totals', count: 3, duration: 1.2, delay: 2.4 },
          { path: ['reconciler', 'replica'], tone: 'data', label: 'ZADD GT batch', count: 3, duration: 1.2, delay: 3.6 },
        ],
        caption: 'Promote the replica, refill from the database',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A sorted set in front, the database behind it',
      eli5: 'Write each win in the **notebook**, keep a magic scoreboard that sorts itself, hang a new one every month, and keep a spare in case one breaks.',
      body: [
        'SQL handles the top 10 at any size, but "my rank" counts every row above you, about 12M entries for a typical player out of 25M. A Redis **sorted set** keeps order and position together in a skip list, so `ZINCRBY`, `ZREVRANGE` and `ZREVRANK` all cost O(log n) and rank reads dropped from seconds to about 2 ms.',
        'The database stays the source of truth: wins are unique by `match_id`, totals are copied into Redis with idempotent `ZADD GT`, and a reconciler repairs drift. Months are separate keys. Ties need a rule, either shared ranks with `ZCOUNT` or time packed into the score. A board too big for one node is sharded by score range or by hash with scatter-gather, and a lost cache is rebuilt from the database in minutes.',
      ],
      keyIdea: 'Use a data structure that knows positions for the reads, and keep a durable store you can rebuild it from.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~25 skip-list steps' },
      scene: {
        nodes: [player, gamesrv, api, { ...redis, status: 'ok' }, { ...replica, status: 'ok' }, db, reconciler],
        links: [
          ...baseLinks,
          { from: 'redis', to: 'replica', style: 'dashed' },
          { from: 'reconciler', to: 'db', style: 'faint' },
          { from: 'reconciler', to: 'redis', style: 'faint' },
        ],
        flows: [
          { path: ['gamesrv', 'api', 'db'], tone: 'data', label: 'win', duration: 1.6 },
          { path: ['api', 'redis'], tone: 'data', label: 'ZADD GT', duration: 1, delay: 1.7 },
          { path: ['redis', 'replica'], tone: 'data', duration: 1, delay: 2.7 },
          { path: ['player', 'api', 'redis', 'api', 'player'], tone: 'response', count: 3, duration: 2.4, delay: 0.5 },
        ],
      },
      quiz: {
        question: 'After a network timeout, the leaderboard API retries `ZINCRBY lb:2026-11 10 user:42`. What can go wrong, and what is the fix?',
        options: [
          'Nothing, ZINCRBY is idempotent',
          'The player may get the points twice. Commit the win in the database keyed by match_id and write the absolute total with ZADD GT',
          'The sorted set becomes unsorted until the next restart',
          'The retry is rejected because the key already exists',
        ],
        answer: 1,
        explain: 'If the first ZINCRBY was applied but its reply was lost, the retry adds the points again. Recording the win once by match_id and writing an absolute total makes the Redis write safe to repeat.',
      },
    },
  ],
};
