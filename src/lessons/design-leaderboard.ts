import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const player: SceneNode = { id: 'player', kind: 'phone', at: p(-7, 3.5), label: 'player', sub: 'lobby screen' };
const gamesrv: SceneNode = { id: 'gamesrv', kind: 'server', at: p(-7, -3.5), label: 'game servers', sub: 'report wins' };
const api: SceneNode = { id: 'api', kind: 'block', at: p(-2, 0), label: 'Leaderboard API', sub: 'stateless', icon: 'Network', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(3.5, 4), label: 'scores DB', sub: 'source of truth' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: p(3.5, -4), label: 'Redis', sub: 'sorted set lb:2026-11', tint: 'red' };
const oldBoard: SceneNode = { id: 'oldBoard', kind: 'cache', at: p(8, -1), label: 'last month', sub: 'lb:2026-10', tint: 'gray' };
const reconciler: SceneNode = { id: 'reconciler', kind: 'worker', at: p(8, 3.5), label: 'reconciler', sub: 'repairs Redis' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designLeaderboard: Lesson = {
  id: 'design-leaderboard',
  title: 'Design a gaming leaderboard (part 1)',
  tagline: 'Show the top 10 and every player\'s exact rank for 25 million players, with scores changing thousands of times a second.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Requirements, traffic numbers and a trusted write path from game servers',
    'Why SQL ORDER BY is fine for the top 10 and hopeless for "my rank" at scale',
    'Redis sorted sets: ZINCRBY, ZREVRANGE and ZREVRANK, and why each is O(log n)',
    'Keeping the database as the source of truth and making score writes safe to retry',
    'Monthly, daily and per-country boards as separate keys, and fair tie-breaking',
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
      title: 'Requirements',
      tag: 'problem',
      heading: 'Top 10 and "where am I?" for 25 million players',
      eli5: 'On sports day every race win earns points. Thousands of kids keep asking the teacher two things: who is in the top 10, and what place am I in on the **scoreboard**?',
      body: [
        'A mobile game ranks players by points won this month. Every match win adds points. The lobby shows the **top 10**, plus the player\'s own rank with the four players just above and below.',
        'Targets: a win shows on the board within a second or two, rank reads return in under **50 ms** at p99, and no win is ever lost or counted twice.',
      ],
      keyIdea: 'Every rank depends on everyone else\'s score, so the board is one shared, always-changing ordering.',
      metrics: { players: '25M', writes: '?', reads: '?', p99: 'goal < 50 ms', work: '-' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active' }, db],
        links: [link('gamesrv', 'api'), link('player', 'api'), link('api', 'db')],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'event', label: 'win +10', count: 3, duration: 1.2 },
          { path: ['player', 'api'], tone: 'request', label: 'top 10, my rank', count: 3, duration: 1.2, delay: 1.3 },
          { path: ['api', 'player'], tone: 'response', label: 'rank #1,204,551', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'What the lobby shows',
          icon: 'Star',
          rows: [
            { text: '#1  Nova', value: '9,420' },
            { text: '#2  Kite', value: '9,385' },
            { text: '...', value: '' },
            { text: '#1,204,550  Sam', value: '1,850', tone: 'muted' },
            { text: '#1,204,551  You', value: '1,850', tone: 'good' },
          ],
          footer: { text: 'Top 10 plus 4 neighbors each side', tone: 'muted' },
        },
        caption: 'Wins come from game servers, questions from players',
      },
    },
    {
      title: 'Traffic',
      tag: 'concept',
      heading: 'The numbers: 3,000 writes and 15,000 reads a second',
      eli5: 'Lots of kids race at once, and even more kids keep glancing at the **scoreboard** to check their place. Looking happens five times as often as scoring.',
      body: [
        '**10M daily players**, and **25M** have at least one win this month. Each plays about 10 matches a day and wins about half: 50M score updates a day, around 600 per second on average and **3,000 per second** at the evening peak.',
        'Lobby views read much more often: about **15,000 reads per second** at peak, split between top 10 and my rank.',
      ],
      keyIdea: 'Reads outnumber writes five to one, so the read path decides the design.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'goal < 50 ms', work: '-' },
      metricTones: { writes: 'warn', reads: 'warn' },
      scene: {
        nodes: [
          { ...player, chips: [{ text: 'GET /me', tone: 'warn' }] },
          { ...gamesrv, chips: ['POST /scores'] },
          { ...api, status: 'active' },
        ],
        links: [link('gamesrv', 'api', { label: '3,000 writes/s' }), link('player', 'api', { label: '15,000 reads/s', labelTone: 'warn' })],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'event', label: '1 write', duration: 1.4 },
          { path: ['player', 'api'], tone: 'request', label: '5 reads', count: 5, duration: 1.4, delay: 0.2 },
        ],
        panel: {
          title: 'Back-of-envelope',
          icon: 'Gauge',
          rows: [
            { text: 'Monthly players', value: '25M' },
            { text: 'Wins per day', value: '50M' },
            { text: 'Average writes', value: '600/s' },
            { text: 'Peak writes', value: '3,000/s', tone: 'warn' },
            { text: 'Peak reads', value: '15,000/s', tone: 'warn' },
          ],
        },
        caption: 'Five reads for every write',
      },
    },
    {
      title: 'Trusted writes',
      tag: 'concept',
      heading: 'Only game servers can report a score',
      eli5: 'Only the **referee** at the finish line can tell the teacher who won. A kid shouting "I won!" from the sidelines is not written down.',
      body: [
        'Game servers run the match and report the result, never the phone, so a cheater cannot post a score directly. The write endpoint is internal and needs a service credential. The phone gets a read-only token.',
        'The API also checks the report: the match exists, the player was in it, and the points fit the rules of that match type.',
      ],
      keyIdea: 'The client displays scores. A trusted server decides them.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'goal < 50 ms', work: '-' },
      scene: {
        nodes: [
          { ...player, chips: [{ text: 'POST /scores', tone: 'bad' }] },
          { ...gamesrv, status: 'ok', chips: ['service token'] },
          { ...api, status: 'active' },
        ],
        links: [link('gamesrv', 'api', { label: 'internal, authenticated' }), link('player', 'api', { label: 'read-only token', labelTone: 'warn' })],
        flows: [
          { path: ['player', 'api'], tone: 'error', label: '403 write denied', duration: 1.4 },
          { path: ['gamesrv', 'api'], tone: 'event', label: 'match 88123 +10', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Who may call what',
          icon: 'Shield',
          rows: [
            { text: 'POST /v1/scores', value: 'game servers', tone: 'good' },
            { text: 'GET /v1/leaderboard/*', value: 'players' },
            { text: 'POST from a phone', value: '403', tone: 'bad' },
          ],
        },
        caption: 'The phone can read, never write',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Three calls',
      eli5: 'The referee tells the teacher who won. Kids only ask questions: "who is top?" and "what is my place?" Both questions can also be about last month.',
      body: [
        '`POST /v1/scores` is internal, called by game servers with `{match_id, user_id, points}`. `GET /v1/leaderboard/top?n=10` returns the top players. `GET /v1/leaderboard/me?around=4` returns my rank, my score and four neighbors on each side.',
        'Both reads take an optional `month`, defaulting to the current one.',
      ],
      keyIdea: 'One write call and two read calls cover the whole product.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'goal < 50 ms', work: '-' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active' }],
        links: [link('gamesrv', 'api'), link('player', 'api')],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'request', label: 'POST match 88123', duration: 1.2 },
          { path: ['player', 'api'], tone: 'request', label: 'GET /me?around=4', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'The API',
          icon: 'Code',
          code: 'POST /v1/scores\n  {match_id, user_id, points}\nGET /v1/leaderboard/top?n=10\nGET /v1/leaderboard/me?around=4\n  both take ?month=2026-11',
        },
        caption: 'Game servers write, players read',
      },
    },
    {
      title: 'Data',
      tag: 'concept',
      heading: 'Two tables: an audit trail and a running total',
      eli5: 'The teacher writes every win in a **notebook** with the race number and the kid\'s name, so the same kid\'s win in the same race is never written twice. A second page keeps each kid\'s running total.',
      body: [
        'A `wins` table records each reported result with `(match_id, user_id)` as the primary key, so one match can score several players and a retried report is rejected as a duplicate. A `monthly_scores` table holds the running total per player per month, plus an indexed `updated_at`.',
        'The first is the audit trail. The second is what gets ranked, and `updated_at` is used later by the reconciler and the tie-break.',
      ],
      keyIdea: 'Make each win unique by match and player, so every later layer can retry safely.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: 'goal < 50 ms', work: '-' },
      scene: {
        nodes: [gamesrv, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'wins, monthly_scores' }],
        links: [link('gamesrv', 'api'), link('api', 'db')],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'request', label: 'match 88123', duration: 1.2 },
          { path: ['api', 'db'], tone: 'data', label: 'INSERT win', duration: 1.2, delay: 1.3 },
          { path: ['gamesrv', 'api', 'db'], tone: 'error', label: 'retry: duplicate', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Tables',
          icon: 'Table',
          rows: [
            { text: 'wins', value: 'PK (match_id, user_id)' },
            { text: 'wins columns', value: 'points, at' },
            { text: 'monthly_scores', value: 'PK (month, user_id)' },
            { text: 'monthly_scores columns', value: 'score, updated_at (indexed)' },
          ],
          footer: { text: 'A retried match and player is rejected', tone: 'good' },
        },
        caption: 'Same match and player twice, one win',
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
      metricTones: { p99: 'good' },
      scene: {
        nodes: [player, { ...api, status: 'active' }, { ...db, status: 'ok', badge: 'index on score' }],
        links: [link('player', 'api'), link('api', 'db')],
        flows: [
          { path: ['player', 'api', 'db'], tone: 'request', label: 'ORDER BY score DESC LIMIT 10', duration: 1.8 },
          { path: ['db', 'api', 'player'], tone: 'response', label: '10 rows', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Index on (month, score DESC)',
          icon: 'List',
          rows: [
            { text: '1. Nova', value: '9,420' },
            { text: '2. Kite', value: '9,385' },
            { text: '3. Pip', value: '9,301' },
            { text: '... 99,997 more', value: '', tone: 'muted' },
          ],
          footer: { text: 'Top 10 stops after 10 entries', tone: 'good' },
        },
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
        'A B-tree finds my score quickly, but it does not know how many entries sit above it. `COUNT(*)` walks every one of them. The average player walks about **12M index entries**, and our example player at #1,204,551 walks 1.2M. Most players sit deeper than that.',
        'About 7,500 rank queries per second at the average depth is tens of billions of index entries per second. No database does that.',
      ],
      keyIdea: 'A sorted index gives order. Turning order into a position means counting, and that costs time proportional to the rank.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '3 s+', work: '~12M entries (average)' },
      metricTones: { p99: 'bad', work: 'bad' },
      scene: {
        nodes: [{ ...player, status: 'hot', sub: 'spinner...' }, { ...api, status: 'hot', badge: 'timeouts' }, { ...db, status: 'hot', load: 100, badge: 'COUNT(*)' }],
        links: [link('player', 'api'), link('api', 'db')],
        flows: [
          { path: ['player', 'api'], tone: 'request', label: 'my rank?', count: 4, duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'COUNT where score > 1,840', count: 4, duration: 1.2, delay: 1 },
          { path: ['db', 'api', 'player'], tone: 'error', label: 'timeout', duration: 2, delay: 2.4 },
        ],
        panel: {
          title: 'One rank query',
          icon: 'Timer',
          rows: [
            { text: 'Players above me, average', value: '~12M', tone: 'bad' },
            { text: 'Entries walked, average', value: '~12M', tone: 'bad' },
            { text: 'Rank #1,204,551', value: '1.2M walked', tone: 'warn' },
            { text: 'Queries per second', value: '~7,500', tone: 'warn' },
            { text: 'Entries per second', value: 'tens of billions', tone: 'bad' },
          ],
        },
        caption: 'Each rank query counts millions of rows',
      },
    },
    {
      title: 'Scaling out',
      tag: 'tradeoff',
      heading: 'Replicas and caching do not fix the count',
      eli5: 'Hiring more teachers still means each one counts millions of names. And writing a kid\'s place on a card is pointless, because it changes whenever anyone passes them.',
      body: [
        'Read replicas share the load, yet every replica still counts millions of entries per query. Caching the answer barely helps: each win shifts the rank of everyone it passes, so a cached rank goes stale within seconds.',
        'We need a structure that keeps the counts up to date as scores change, so a rank can be read without walking the list.',
      ],
      keyIdea: 'More copies of a slow query are still slow. The fix is a structure that stores positions.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '3 s+', work: '~12M per replica' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot' },
          { id: 'rep1', kind: 'replica', at: p(3.5, -4), label: 'replica 1', status: 'hot', load: 97 },
          { id: 'rep2', kind: 'replica', at: p(3.5, 4), label: 'replica 2', status: 'hot', load: 95 },
        ],
        links: [link('api', 'rep1'), link('api', 'rep2')],
        flows: [
          { path: ['api', 'rep1'], tone: 'request', label: 'COUNT 12M', duration: 1.4 },
          { path: ['api', 'rep2'], tone: 'request', label: 'COUNT 12M', duration: 1.4, delay: 0.2 },
        ],
        panel: {
          title: 'Fixes that fall short',
          icon: 'Copy',
          rows: [
            { text: 'Read replicas', value: 'each still counts 12M', tone: 'bad' },
            { text: 'Cache the rank', value: 'stale in seconds', tone: 'bad' },
            { text: 'Needed', value: 'counts kept up to date', tone: 'good' },
          ],
        },
        caption: 'Copies of a slow query are still slow',
      },
    },
    {
      title: 'Sorted sets',
      tag: 'concept',
      heading: 'Redis sorted sets keep the ranking for you',
      eli5: 'The teacher switches to a magic **scoreboard** that slides each kid into the right place the moment they score. Finding the top 10 or anyone\'s place is now a quick glance, with no counting.',
      body: [
        'A Redis **sorted set** stores members with a numeric score and keeps them ordered (the caching lesson introduced Redis). Inside, a hash maps member to score and a **skip list** keeps the order.',
        'Reads on it are answered from memory, so a rank no longer touches a disk or walks an index.',
      ],
      keyIdea: 'A sorted set keeps members ordered by score in memory, with a hash beside it for quick lookups.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      metricTones: { p99: 'good', work: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...redis, status: 'ok', badge: 'sorted set' }, { ...db, status: 'dim' }],
        links: [link('api', 'redis'), link('api', 'db', { style: 'faint' })],
        flows: [
          { path: ['api', 'redis'], tone: 'request', label: 'ZREVRANK', duration: 1.4 },
          { path: ['redis', 'api'], tone: 'response', label: '#1,204,551', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Inside lb:2026-11',
          icon: 'Layers',
          rows: [
            { text: 'Hash', value: 'user -> score' },
            { text: 'Skip list', value: 'ordered by score' },
            { text: 'Member', value: 'user:42' },
            { text: 'Score', value: '1850' },
          ],
        },
        caption: 'Order and lookup in one structure',
      },
    },
    {
      title: 'Skip list',
      tag: 'concept',
      heading: 'How a skip list counts while it searches',
      eli5: 'The scoreboard has express lanes. Each lane sign says "skip 100 kids ahead", so the teacher adds up the signs on the way and knows your place without counting everyone.',
      body: [
        'A skip list is a sorted list with express lanes. Each link also records how many entries it jumps over, so Redis adds up a member\'s rank while it walks down to it.',
        'With 25M players a lookup takes a few dozen steps (Redis uses a fan-out of four, so about 40 comparisons). That is why rank, insert and top N all cost O(log n) and never O(n).',
      ],
      keyIdea: 'Storing span counts on each link turns a search into a rank lookup at no extra cost.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      metricTones: { work: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...redis, status: 'ok', badge: 'span counts', load: 5 }],
        links: [link('api', 'redis', { label: 'ZREVRANK user:42', arrow: 'both' })],
        flows: [{ path: ['api', 'redis', 'api'], tone: 'request', label: '~40 hops', duration: 2.2 }],
        panel: {
          title: 'Walking down to user:42',
          icon: 'Route',
          rows: [
            { text: 'Top lane jump', value: '+1,000,000' },
            { text: 'Next lane', value: '+200,000' },
            { text: 'Next lane', value: '+4,000' },
            { text: 'Lower lanes, ~37 more hops', value: '+551', tone: 'muted' },
            { text: 'Sum of spans', value: 'rank 1,204,551', tone: 'good' },
          ],
          footer: { text: 'A few dozen steps, not 1.2M', tone: 'good' },
        },
        caption: 'Rank is the sum of the jumps',
      },
    },
    {
      title: 'Commands',
      tag: 'concept',
      heading: 'ZINCRBY, ZREVRANGE and ZREVRANK',
      eli5: 'Three things the teacher can do on the magic board: add points to a kid, read the first ten, or ask "what place is this kid?" Each is a quick glance.',
      body: [
        '`ZINCRBY lb:2026-11 10 user:42` adds points in O(log n). `ZREVRANGE lb:2026-11 0 9 WITHSCORES` returns the top 10 in O(log n + 10). `ZREVRANK lb:2026-11 user:42` returns my rank in O(log n).',
        'Neighbors are one more range call around my rank. Newer Redis versions also spell the range call `ZRANGE ... REV`.',
      ],
      keyIdea: 'Top N, rank and neighbors are all single logarithmic calls.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...gamesrv, chips: ['ZINCRBY +10'] }, { ...api, status: 'active' }, { ...redis, status: 'ok', chips: ['ZREVRANGE 0 9', 'ZREVRANK'] }],
        links: [link('gamesrv', 'api'), link('api', 'redis')],
        flows: [
          { path: ['gamesrv', 'api', 'redis'], tone: 'request', label: 'ZINCRBY +10', duration: 1.8 },
          { path: ['redis', 'api'], tone: 'response', label: 'top 10 / #1,204,551', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Cost per call',
          icon: 'Timer',
          rows: [
            { text: 'ZINCRBY', value: 'O(log n)', tone: 'good' },
            { text: 'ZREVRANGE 0 9', value: 'O(log n + 10)', tone: 'good' },
            { text: 'ZREVRANK', value: 'O(log n)', tone: 'good' },
          ],
        },
        caption: 'Three calls, all logarithmic',
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
      title: 'One node',
      tag: 'concept',
      heading: 'Memory and speed: the whole board fits on one machine',
      eli5: 'The whole magic scoreboard fits on one table in the hall, and one teacher can read it thousands of times a second.',
      body: [
        'Memory is roughly 100 bytes per player with a short id, so 25M players need a few GB. One Redis node serves on the order of 100,000 of these operations per second.',
        'Our peak is 18,000 operations per second, so one node has room to spare. Keep member ids short, since they are repeated in every board.',
      ],
      keyIdea: 'At 25M players a single Redis node holds the board and has about 5x headroom.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...redis, status: 'ok', load: 18, badge: '~3 GB' }],
        links: [link('api', 'redis', { label: '18,000 ops/s' })],
        flows: [
          { path: ['api', 'redis'], tone: 'request', count: 4, label: 'reads + writes', duration: 1.4 },
          { path: ['redis', 'api'], tone: 'response', count: 4, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Sizing one node',
          icon: 'HardDrive',
          rows: [
            { text: 'Bytes per player', value: '~100' },
            { text: 'Memory for 25M', value: '~3 GB' },
            { text: 'Node capacity', value: '~100,000 ops/s' },
            { text: 'Our peak', value: '18,000 ops/s', tone: 'good' },
          ],
        },
        caption: 'Plenty of headroom',
      },
    },
    {
      title: 'Write path',
      tag: 'concept',
      heading: 'The database stays the source of truth',
      eli5: 'The teacher still writes every win in the **notebook** first, then moves the kid on the scoreboard. If the board is ever wiped, the notebook has every point.',
      body: [
        'Redis holds the ranking, but it never holds the only copy of anyone\'s points. On each win the API inserts into `wins` keyed by `(match_id, user_id)` and bumps `monthly_scores` in one transaction, then updates Redis.',
        'A retried report for the same player hits the primary key and is ignored, so a win counts once, while other players in the same match still score.',
      ],
      keyIdea: 'Commit the win to the database first, then copy it into Redis.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [gamesrv, { ...api, status: 'active' }, { ...db, status: 'active', badge: '1. commit' }, { ...redis, status: 'ok', badge: '2. update' }],
        links: [link('gamesrv', 'api'), link('api', 'db'), link('api', 'redis')],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'request', label: 'match 88123 +10', duration: 1 },
          { path: ['api', 'db'], tone: 'data', label: 'INSERT win, total = 1,850', duration: 1, delay: 1.1 },
          { path: ['db', 'api'], tone: 'response', label: 'committed', duration: 0.9, delay: 2.2 },
          { path: ['api', 'redis'], tone: 'data', label: 'update rank', duration: 0.9, delay: 3.2 },
        ],
        panel: {
          title: 'Order of writes',
          icon: 'List',
          rows: [
            { text: '1. INSERT wins (PK match_id, user_id)', value: 'dedupe', tone: 'good' },
            { text: '2. UPDATE monthly_scores', value: 'same tx' },
            { text: '3. Update Redis', value: 'after commit' },
          ],
        },
        caption: 'Database first, Redis second',
      },
    },
    {
      title: 'Safe retries',
      tag: 'concept',
      heading: 'ZADD with an absolute total is safe to repeat',
      eli5: 'If the teacher is told "add 10" twice, the kid gets 20 by mistake. If she is told "set it to 1,850", saying it twice changes nothing.',
      body: [
        '`ZINCRBY` is unsafe to retry: if Redis applied it but the reply was lost, a retry adds the points twice. So the API writes the new total, read back from the database, with `ZADD`, which sets an absolute score.',
        'Applying it twice leaves the same value (the timeouts, retries, backoff and jitter lesson calls this idempotency). The `GT` flag, available since Redis 6.2, only ever raises a score, so a late write of an older total cannot overwrite a newer one.',
      ],
      keyIdea: 'Write absolute totals with ZADD GT, so repeats and late arrivals are harmless.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...redis, status: 'ok', badge: 'user:42 = 1,850' }],
        links: [link('api', 'redis')],
        flows: [
          { path: ['api', 'redis'], tone: 'data', label: 'ZADD GT 1,850', duration: 1.2 },
          { path: ['redis', 'api'], tone: 'error', label: 'reply lost', duration: 1.2, delay: 1.3 },
          { path: ['api', 'redis'], tone: 'data', label: 'retry: same ZADD', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Retry after a lost reply',
          icon: 'Repeat',
          rows: [
            { text: 'ZINCRBY +10, retried', value: '1,860', tone: 'bad' },
            { text: 'ZADD 1,850, retried', value: '1,850', tone: 'good' },
            { text: 'Late ZADD GT 1,840', value: 'ignored', tone: 'good' },
          ],
        },
        caption: 'Same write twice, same board',
      },
    },
    {
      title: 'Reconciler',
      tag: 'concept',
      heading: 'A reconciler repairs any drift',
      eli5: 'A helper walks past the scoreboard now and then and compares it with the notebook. If a kid\'s points are missing from the board, she fixes it.',
      body: [
        'If the Redis write fails after the commit, the user id goes on a retry list, and a **reconciler** regularly compares rows with a recent `updated_at` against Redis and repairs any difference, packing each value from `score` and `updated_at`.',
        'The board may lag by seconds, and no points are ever lost.',
      ],
      keyIdea: 'A background repair job turns a failed copy into a short delay.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [{ ...db, status: 'active', badge: 'rows changed' }, { ...redis, status: 'ok', badge: 'missing 1 update' }, { ...reconciler, status: 'active' }],
        links: [link('reconciler', 'db', { style: 'dashed' }), link('reconciler', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['db', 'reconciler'], tone: 'data', label: 'recent totals', duration: 1.4 },
          { path: ['reconciler', 'redis'], tone: 'event', label: 'ZADD GT repair', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Reconciler loop',
          icon: 'Repeat',
          rows: [
            { text: 'Read rows with updated_at in last 5 min', value: 'DB' },
            { text: 'Pack score + updated_at, compare with ZSCORE', value: 'Redis' },
            { text: 'Differ? ZADD GT', value: 'repair', tone: 'good' },
          ],
          footer: { text: 'Lag of seconds, no lost points', tone: 'good' },
        },
        caption: 'Compare, then repair',
      },
    },
    {
      title: 'Monthly boards',
      tag: 'concept',
      heading: 'A new board every month',
      eli5: 'On the first day of each month the teacher hangs a fresh, empty **scoreboard** and carries last month\'s board to the archive, where anyone can still look up the old results.',
      body: [
        'Each month gets its own key: `lb:2026-11`, then `lb:2026-12`. The reset is free. On December 1 at 00:00 UTC, writes start going to a key that does not exist yet, and the first `ZADD` creates it. Nobody has to wipe 25M entries at midnight.',
        'Pick one time zone for the reset and show the countdown in the app.',
      ],
      keyIdea: 'Put the time period in the key name, so a reset is a new key.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [gamesrv, { ...api, status: 'active' }, { ...redis, label: 'this month', sub: 'lb:2026-12', status: 'ok', badge: 'new, empty' }, { ...oldBoard, status: 'dim' }],
        links: [link('gamesrv', 'api'), link('api', 'redis'), link('api', 'oldBoard', { style: 'faint' })],
        flows: [
          { path: ['gamesrv', 'api', 'redis'], tone: 'request', label: 'ZADD lb:2026-12', count: 2, duration: 1.8 },
        ],
        panel: {
          title: 'Midnight, December 1 UTC',
          icon: 'Clock',
          rows: [
            { text: 'lb:2026-11', value: 'stops changing', tone: 'muted' },
            { text: 'lb:2026-12', value: 'created by first ZADD', tone: 'good' },
            { text: 'Entries wiped', value: '0', tone: 'good' },
          ],
        },
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
      title: 'Archive',
      tag: 'concept',
      heading: 'Archive the old board and let it expire',
      eli5: 'Last month\'s board goes to the archive room with the final places written down. Once the results are safely filed, the old board is taken down.',
      body: [
        'Old boards stop changing. A job saves the final top 1,000 and every player\'s final rank to the database for history pages and rewards.',
        'Then it sets `EXPIRE` on the old key a few days later, which frees its memory without anyone deleting 25M entries by hand.',
      ],
      keyIdea: 'Save the final standings first, then set an expiry so the old key frees its own memory.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [{ ...redis, label: 'this month', sub: 'lb:2026-12', status: 'ok' }, { ...oldBoard, status: 'dim', badge: 'EXPIRE in 7 days' }, { ...db, badge: 'final ranks saved' }],
        links: [link('oldBoard', 'db', { style: 'dashed', label: 'archive' })],
        flows: [
          { path: ['oldBoard', 'db'], tone: 'data', label: 'final standings', duration: 1.6 },
        ],
        panel: {
          title: 'Closing a month',
          icon: 'Clock',
          rows: [
            { text: 'lb:2026-11', value: 'stops changing', tone: 'muted' },
            { text: 'Final top 1,000 and ranks', value: 'saved to DB', tone: 'good' },
            { text: 'lb:2026-11', value: 'EXPIRE in a few days', tone: 'muted' },
          ],
        },
        caption: 'File the results, then expire the key',
      },
    },
    {
      title: 'More boards',
      tag: 'concept',
      heading: 'Daily, weekly and country boards are more keys',
      eli5: 'The same trick gives a board for today, this week, or each country. Each one is another sheet on the wall, and each win is written on every sheet it belongs to.',
      body: [
        'One key per board: `lb:day:2026-12-01`, `lb:week:2026-W49` or `lb:IN:2026-12`. Each win then writes to a few keys, which costs a few more O(log n) operations and nothing else.',
        'Short-lived boards need their own expiry. Set `EXPIRE` on each daily key when its first `ZADD` creates it, or the keys pile up every day.',
      ],
      keyIdea: 'One key per board: each extra board costs one more write per win and needs its own expiry.',
      metrics: { players: '25M', writes: '3,000/s peak (x3 keys)', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...redis, label: 'this month', sub: 'lb:2026-12', status: 'ok', chips: ['lb:day:2026-12-01', 'lb:IN:2026-12'] }],
        links: [link('api', 'redis')],
        flows: [
          { path: ['api', 'redis'], tone: 'request', label: 'ZADD x3 keys', count: 3, duration: 1.4 },
        ],
        panel: {
          title: 'One key per board',
          icon: 'Layers',
          rows: [
            { text: 'lb:2026-12', value: 'monthly' },
            { text: 'lb:day:2026-12-01', value: 'daily, EXPIRE at creation' },
            { text: 'lb:IN:2026-12', value: 'per country' },
            { text: 'Writes per win', value: '3 ZADDs', tone: 'warn' },
          ],
        },
        caption: 'Another board is another key',
      },
    },
    {
      title: 'Ties',
      tag: 'tradeoff',
      heading: 'Ties: who ranks higher on equal points?',
      eli5: 'Two kids both have 120 points, so they both stand in 5th place. The next kid is 7th, because two kids are ahead of them.',
      body: [
        'When scores are equal, Redis orders members by their name, byte by byte. For player ids that order is arbitrary, and players notice when someone who got there later sits above them. Pick a rule and make it visible: equal scores share a rank, or the earlier achiever ranks higher.',
        '**Shared rank** (both are 5th): read my score, then `ZCOUNT lb:2026-11 (1850 +inf` returns how many players are strictly above, and my rank is that plus one. Still O(log n).',
      ],
      keyIdea: 'Decide the tie rule up front. Shared ranks use ZCOUNT.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [{ ...api, status: 'active', badge: 'ZCOUNT above me' }, { ...redis, status: 'ok', chips: ['Sam 1,850', 'You 1,850'] }],
        links: [link('api', 'redis')],
        flows: [
          { path: ['api', 'redis'], tone: 'request', label: 'ZCOUNT (1850 +inf', duration: 1.4 },
          { path: ['redis', 'api'], tone: 'response', label: '1,204,549 above', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Shared rank',
          icon: 'Table',
          rows: [
            { text: 'Sam, 1,850', value: '#1,204,550' },
            { text: 'You, 1,850', value: '#1,204,550', tone: 'good' },
            { text: 'Next player, 1,840', value: '#1,204,552' },
          ],
          footer: { text: 'Rank = players strictly above + 1', tone: 'muted' },
        },
        caption: 'Equal points share one rank',
      },
    },
    {
      title: 'Earliest wins',
      tag: 'tradeoff',
      heading: 'Earliest wins: pack time into the score',
      eli5: 'To make the earlier kid stand higher, the teacher writes the points big and the time left in tiny digits after it. Same points, more time left, higher place.',
      body: [
        'Redis scores are 64-bit floats, exact for integers up to 2^53. Put points in the high bits and the seconds left in the month in the low 22 bits (2^22 seconds is about 48 days). At equal points the earlier finisher has more seconds left, so a larger value.',
        'That leaves 31 bits for points, over two billion. Writes already send absolute totals with `ZADD GT`, so the packed value is recomputed on every win from `score` and `updated_at` in `monthly_scores`, which is why that table keeps the time.',
      ],
      keyIdea: 'Earliest-first packs a time into the low bits of the score.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      scene: {
        nodes: [gamesrv, { ...api, status: 'active', badge: 'pack points + time' }, { ...redis, status: 'ok', badge: '1850 << 22 | time left' }, db],
        links: [link('gamesrv', 'api'), link('api', 'db'), link('api', 'redis')],
        flows: [
          { path: ['gamesrv', 'api'], tone: 'request', label: 'reached 1,850 at 14:02', duration: 1.2 },
          { path: ['api', 'db'], tone: 'data', label: 'commit', duration: 1, delay: 1.3 },
          { path: ['api', 'redis'], tone: 'data', label: 'ZADD GT packed', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Layout of the 53 exact bits',
          icon: 'Binary',
          rows: [
            { text: 'High 31 bits', value: 'points (over 2 billion)' },
            { text: 'Low 22 bits', value: 'seconds left in month' },
            { text: 'Same points, earlier', value: 'larger value', tone: 'good' },
          ],
        },
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
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: a sorted set in front, the database behind it',
      eli5: 'Write each win in the **notebook**, keep a magic scoreboard that sorts itself, and hang a new one every month. Part 2 covers what happens when the school gets huge.',
      body: [
        'SQL handles the top 10 at any size, but "my rank" counts every row above you. A Redis **sorted set** keeps order and position together in a skip list, so `ZINCRBY`, `ZREVRANGE` and `ZREVRANK` all cost O(log n) and rank reads dropped from seconds to about 2 ms.',
        'The database stays the source of truth: wins are unique by `(match_id, user_id)`, totals are copied with idempotent `ZADD GT`, and a reconciler repairs drift. Months are separate keys, and ties need a rule.',
      ],
      keyIdea: 'Use a data structure that knows positions for the reads, and keep a durable store you can rebuild it from.',
      metrics: { players: '25M', writes: '3,000/s peak', reads: '15,000/s peak', p99: '2 ms', work: '~40 skip-list steps' },
      metricTones: { p99: 'good', work: 'good' },
      scene: {
        nodes: [player, gamesrv, { ...api, status: 'active' }, { ...redis, status: 'ok' }, db],
        links: [link('gamesrv', 'api'), link('player', 'api'), link('api', 'redis'), link('api', 'db')],
        flows: [
          { path: ['gamesrv', 'api', 'db'], tone: 'data', label: 'win', duration: 1.6 },
          { path: ['api', 'redis'], tone: 'data', label: 'ZADD GT', duration: 1, delay: 1.7 },
          { path: ['player', 'api', 'redis'], tone: 'request', label: 'rank?', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Part 1 in one table',
          icon: 'Star',
          rows: [
            { text: 'Rank in SQL', value: '12M entries', tone: 'bad' },
            { text: 'Rank in a sorted set', value: '~40 steps', tone: 'good' },
            { text: 'Source of truth', value: 'database' },
            { text: 'Redis write', value: 'ZADD GT total' },
            { text: 'Reset', value: 'new key per month' },
          ],
        },
        caption: 'Part 1 design',
      },
      quiz: {
        question: 'After a network timeout, the leaderboard API retries `ZINCRBY lb:2026-11 10 user:42`. What can go wrong, and what is the fix?',
        options: [
          'Nothing, ZINCRBY is idempotent',
          'The player may get the points twice. Commit the win in the database keyed by match and player and write the absolute total with ZADD GT',
          'The sorted set becomes unsorted until the next restart',
          'The retry is rejected because the key already exists',
        ],
        answer: 1,
        explain: 'If the first ZINCRBY was applied but its reply was lost, the retry adds the points again. Recording the win once per match and player and writing an absolute total makes the Redis write safe to repeat.',
      },
    },
  ],
};
