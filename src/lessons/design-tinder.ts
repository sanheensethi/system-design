import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Class-party world: the teacher is the API, green and red cards are swipes, a table is a match.
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-5.5, 0), label: 'Ana', sub: 'swiping' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-1.8, 0), label: 'API', sub: 'gateway', icon: 'Network', tint: 'violet' };

// The deck pipeline runs left to right along one screen row.
const deck: SceneNode = { id: 'deck', kind: 'block', at: at(-7.6, 0), label: 'Deck service', sub: 'builds 20 cards', icon: 'Layers', tint: 'green' };
const geo: SceneNode = { id: 'geo', kind: 'search', at: at(-3.8, 0), label: 'geo index', sub: 'cell id to users' };
const filter: SceneNode = { id: 'filter', kind: 'block', size: 0.8, at: at(0, 0), label: 'preferences', sub: 'in memory', icon: 'Users', tint: 'amber' };
const seen: SceneNode = { id: 'seen', kind: 'cache', at: at(3.8, 0), label: 'seen filter', sub: 'Bloom per user' };
const ranker: SceneNode = { id: 'ranker', kind: 'block', size: 0.8, at: at(7.6, 0), label: 'ranker', sub: 'P(mutual like)', icon: 'Star', tint: 'teal' };

const swipesDb: SceneNode = { id: 'swipes', kind: 'shard', at: at(2, -3.2), label: 'swipes', sub: 'who liked whom' };
const matchesDb: SceneNode = { id: 'matches', kind: 'db', at: at(2, 3.2), label: 'matches', sub: 'one row per pair' };

export const designTinder: Lesson = {
  id: 'design-tinder',
  title: 'Design Tinder',
  tagline: 'Show each user nearby people who fit, record swipes, and notice a mutual right swipe, for 10 million daily users.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Why one SQL query on latitude and longitude collapses at 240K candidate reads per second',
    'A geo index of S2 cells, a mutual preference filter and a Bloom filter that hides profiles already seen',
    'A pair-based ranker, and caps plus a new-user boost so attention is shared out',
    'Detecting a match when both people swipe at the same instant: write first, then read',
    'Sharding the geo index by cell, moving users, splitting hotspots, degrading when parts fail, and location privacy',
  ],
  metrics: [
    { key: 'swipes', label: 'Swipes/s', icon: 'Repeat' },
    { key: 'cands', label: 'Candidate reads/s', icon: 'Download' },
    { key: 'deck', label: 'Deck time', icon: 'Timer' },
    { key: 'matches', label: 'Matches/s', icon: 'Users' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Two strangers, one mutual yes',
      eli5: 'At a big class party every kid holds a **green card** and a red card. Hold green for a kid you like. If that kid holds green for you too, the teacher gives you both a table to talk at.',
      body: [
        'A user opens the app and sees one profile card at a time, drawn from people **nearby** who fit their age and gender preferences. A right swipe likes, a left swipe passes. When two people have each swiped right on the other, it is a **match** and a chat opens.',
        'Two rules sit on top. A profile you already swiped on must not come back, and attention must be spread out so a few popular profiles do not collect every like.',
      ],
      keyIdea: 'A match needs two independent right swipes, so the hard parts are choosing who to show and noticing the second yes.',
      metrics: { swipes: '-', cands: '-', deck: '-', matches: '-' },
      scene: {
        nodes: [
          { id: 'ana', kind: 'phone', at: at(-5, 0), label: 'Ana', sub: 'swipes right', chips: [{ text: 'right on Ben', tone: 'good' }] },
          { id: 'match', kind: 'block', at: at(0, 0), label: 'match?', sub: 'both said yes', icon: 'Users', tint: 'red' },
          { id: 'ben', kind: 'phone', at: at(5, 0), label: 'Ben', sub: 'swipes right', chips: [{ text: 'right on Ana', tone: 'good' }] },
        ],
        links: [link('ana', 'match'), link('ben', 'match')],
        flows: [
          { path: ['ana', 'match'], tone: 'request', label: 'right', duration: 1.2 },
          { path: ['ben', 'match'], tone: 'request', label: 'right', duration: 1.2, delay: 1.3 },
          { path: ['match', 'ana'], tone: 'response', label: 'it\'s a match', duration: 1.2, delay: 2.7 },
          { path: ['match', 'ben'], tone: 'response', label: 'it\'s a match', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'What the system must do',
          icon: 'List',
          rows: [
            { text: 'Candidates near me', value: 'geo + prefs' },
            { text: 'Swipe left or right', value: 'write' },
            { text: 'Both right = match', value: 'detect + chat' },
            { text: 'Never re-show a profile', value: 'seen filter' },
            { text: 'Fair attention', value: 'caps + boost' },
          ],
        },
        caption: 'A match is two yeses that found each other',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: '2 billion swipes a day, 240K candidate reads a second',
      eli5: 'Count the party: so many kids, each flipping cards again and again. The **teacher** at the door has to answer all of them quickly without losing track.',
      body: [
        '**75M** people use the app each month and **10M** each day. They make **2B swipes a day**, about 23K a second. **30M matches** a day is only 350 a second.',
        'A deck holds 20 cards, so 23K swipes a second is about 1.2K deck requests a second, or 2.4K at the 2x peak. A **candidate read** is one profile row examined while building a deck, about 100 per deck, so peak is **240K candidate reads a second**.',
      ],
      keyIdea: 'Swipes are 23K writes a second, but finding candidates is the heavy path at 240K candidate reads a second at peak.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '-', matches: '350/s' },
      scene: {
        nodes: [
          { ...phone, chips: [{ text: '10M daily users', tone: 'good' }] },
          api,
          { id: 'profiles', kind: 'db', at: at(2, -3.8), label: 'profiles', sub: '300M', badge: '240K reads/s' },
          { id: 'swipes', kind: 'db', at: at(2, 3.8), label: 'swipes', sub: '2B rows a day', badge: '23K writes/s' },
        ],
        links: [link('phone', 'api'), link('api', 'profiles'), link('api', 'swipes')],
        flows: [
          { path: ['phone', 'api', 'profiles'], tone: 'request', label: 'deck', duration: 1.6 },
          { path: ['phone', 'api', 'swipes'], tone: 'request', label: 'swipe', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Napkin numbers',
          icon: 'Table',
          rows: [
            { text: 'Monthly / daily users', value: '75M / 10M' },
            { text: 'Swipes per day', value: '2B (23K/s)' },
            { text: 'Matches per day', value: '30M (350/s)' },
            { text: 'Deck requests (20 cards)', value: '1.2K/s avg, 2.4K/s peak' },
            { text: 'Candidate reads, peak', value: '2.4K x ~100 rows = 240K/s', tone: 'warn' },
            { text: 'Profiles in geo index', value: '300M' },
          ],
        },
        caption: 'Reads dominate, but both paths are large',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Three calls carry the whole app',
      eli5: 'You ask the **teacher** "who is here for me to meet?" and get 20 name cards. Later you hold up a card, and sometimes the teacher says "you both picked each other!"',
      body: [
        '`GET /v1/deck` returns the next 20 cards: id, name, age, distance and photo URLs. `POST /v1/swipes` records one swipe and answers at once whether it matched. `PUT /v1/location` sends the phone position when the app opens.',
        'The phone keeps the deck as a local list, so flipping from card to card never waits on the network.',
      ],
      keyIdea: 'The deck is fetched in batches and swipes are sent one at a time, with the match answer in the swipe response.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '-', matches: '350/s' },
      scene: {
        nodes: [
          { ...phone, chips: ['GET /deck', 'POST /swipes'] },
          api,
          { id: 'deck', kind: 'block', size: 0.8, at: at(2, -3.2), label: 'deck', icon: 'Layers', tint: 'green' },
          { id: 'swipe', kind: 'block', size: 0.8, at: at(2, 3.2), label: 'swipes', icon: 'Repeat', tint: 'amber' },
        ],
        links: [link('phone', 'api'), link('api', 'deck'), link('api', 'swipe')],
        flows: [
          { path: ['phone', 'api', 'deck', 'api', 'phone'], tone: 'request', label: 'GET /deck', duration: 2.4 },
          { path: ['phone', 'api', 'swipe', 'api', 'phone'], tone: 'request', label: 'POST /swipes', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'What each call returns',
          icon: 'Braces',
          rows: [
            { text: 'GET /v1/deck?limit=20', value: '20 cards' },
            { text: 'POST /v1/swipes', value: '{matched}' },
            { text: 'PUT /v1/location', value: '204' },
            { text: 'GET /v1/matches', value: 'match list' },
          ],
        },
        caption: 'Batch the reads, answer each swipe',
      },
      code: {
        language: 'bash',
        title: 'The three hot calls',
        source: `curl -H "Authorization: Bearer $TOKEN" "https://api.example/v1/deck?limit=20"
# {"cards":[{"user_id":"u_881","name":"Ben","age":29,"distance_km":4}, ...]}

curl -X POST https://api.example/v1/swipes -d '{"target":"u_881","dir":"right"}'
# {"matched":true,"match_id":"u_204:u_881"}

curl -X PUT https://api.example/v1/location -d '{"lat":40.74,"lng":-73.99}'`,
        highlight: [1, 4, 7],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Three tables and one key per pair',
      eli5: 'The teacher keeps **three notebooks**: who each kid is, who held up which card for whom, and which pairs got a table.',
      body: [
        '**Profiles** hold age, gender, preferences, position and photos, keyed by `user_id`. **Swipes** is the big table, one row per swipe keyed `(swiper, target)`. At about 40 bytes a row, 2B a day is roughly 80 GB a day.',
        '**Matches** holds one row per pair. The key is the two ids sorted, so (A, B) and (B, A) land on the same row.',
      ],
      keyIdea: 'Swipes are keyed by who swiped, matches by the sorted pair, so each lookup the system needs is one key read.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '-', matches: '350/s' },
      scene: {
        nodes: [
          { id: 'api', kind: 'block', size: 0.8, at: at(0, -3.5), label: 'API', icon: 'Network', tint: 'violet' },
          { id: 'profiles', kind: 'db', at: at(-4, 3.5), label: 'profiles', sub: '300M rows' },
          { id: 'swipes', kind: 'db', at: at(0, 3.5), label: 'swipes', sub: '(swiper, target)' },
          { id: 'matches', kind: 'db', at: at(4, 3.5), label: 'matches', sub: 'sorted pair id' },
        ],
        links: [link('api', 'profiles'), link('api', 'swipes'), link('api', 'matches')],
        flows: [
          { path: ['api', 'profiles'], tone: 'data', duration: 1.4 },
          { path: ['api', 'swipes'], tone: 'data', duration: 1.4, delay: 0.5 },
          { path: ['api', 'matches'], tone: 'data', duration: 1.4, delay: 1.0 },
        ],
        panel: {
          title: 'Rows and sizes',
          icon: 'Table',
          rows: [
            { text: 'profiles', value: '300M rows' },
            { text: 'swipes per day', value: '2B rows' },
            { text: 'swipe row', value: '~40 bytes' },
            { text: 'matches per day', value: '30M rows' },
          ],
          footer: { text: '~80 GB of swipes a day', tone: 'warn' },
        },
        caption: 'Who they are, who liked whom, who matched',
      },
      code: {
        language: 'sql',
        title: 'Schema sketch',
        source: `CREATE TABLE profiles (user_id BIGINT PRIMARY KEY, age INT, gender TEXT,
  want_gender TEXT[], want_age_min INT, want_age_max INT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, cell_id BIGINT);

CREATE TABLE swipes (swiper BIGINT, target BIGINT, dir TEXT, ts TIMESTAMPTZ,
  PRIMARY KEY (swiper, target));

-- pair_id = smaller id, a colon, larger id: "204:881"
CREATE TABLE matches (pair_id TEXT PRIMARY KEY, a BIGINT, b BIGINT, ts TIMESTAMPTZ);`,
        highlight: [5, 6, 8, 9],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'Start with one SQL query',
      eli5: 'At a tiny party the teacher just looks around the room and points at kids who fit. That works fine with twenty kids and one **teacher**.',
      body: [
        'Begin with one SQL database. To build a deck, filter profiles inside a latitude and longitude box around the user, apply the age and gender rules, and drop anyone already in that user\'s swipes.',
        'A swipe is one insert plus one lookup of the reverse swipe. For a few thousand users in one city this is fine, and it is the right first version.',
      ],
      keyIdea: 'One database and one query is a correct design. It only fails when the numbers grow.',
      metrics: { swipes: '5/s', cands: '20/s', deck: '~40 ms', matches: '-' },
      metricTones: { deck: 'good' },
      scene: {
        nodes: [
          { ...phone, sub: '10K users in town' },
          api,
          { id: 'db', kind: 'db', at: at(2, 0), label: 'SQL database', sub: 'profiles + swipes', status: 'ok' },
        ],
        links: [link('phone', 'api'), link('api', 'db')],
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'build deck', duration: 1.8 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '20 cards', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'The deck query',
          icon: 'Code',
          code: 'SELECT p.user_id FROM profiles p\nWHERE p.lat BETWEEN :lat-0.3 AND :lat+0.3\n  AND p.lng BETWEEN :lng-0.3 AND :lng+0.3\n  AND p.age BETWEEN :min AND :max\n  AND p.gender = ANY(:want)\n  AND p.user_id NOT IN (SELECT target\n      FROM swipes WHERE swiper = :me)\nLIMIT 20',
          footer: { text: 'Fine at 10K users, around 40 ms', tone: 'good' },
        },
        caption: 'One query does the whole job',
      },
    },
    {
      title: 'It breaks',
      tag: 'case',
      heading: 'At 240K reads a second the query collapses',
      eli5: 'Now thousands of parties run at once. The teacher cannot walk **the whole room** for every kid, and the list of every kid you already looked at keeps growing.',
      body: [
        'A latitude and longitude box is two range filters, so the database uses one index well and scans the rest. In a big city the box holds millions of profiles, and every deck runs it. The `NOT IN` list grows by about 200 swipes a day per active user.',
        'The same database also takes 23K swipe writes a second. One box cannot serve both loads, and splitting it by hand is the sharding lesson.',
      ],
      keyIdea: 'A coordinate range scan and an ever-growing exclusion list do not survive 240K reads a second.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '2+ s', matches: '350/s' },
      metricTones: { cands: 'bad', deck: 'bad' },
      scene: {
        nodes: [
          { ...phone, badge: '240K reads/s' },
          api,
          { id: 'db', kind: 'db', at: at(2, 0), label: 'SQL database', sub: 'profiles + swipes', status: 'hot', load: 100, chips: [{ text: 'box scan: millions', tone: 'bad' }, { text: 'NOT IN swipes', tone: 'warn' }] },
        ],
        links: [link('phone', 'api', { label: 'deck timeouts', labelTone: 'warn' }), link('api', 'db')],
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'build deck', duration: 1.4, count: 3 },
          { path: ['db', 'api', 'phone'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Where the time goes',
          icon: 'Gauge',
          rows: [
            { text: 'Lat/lng box scan', value: 'millions of rows', tone: 'bad' },
            { text: 'NOT IN swipes', value: 'grows daily', tone: 'warn' },
            { text: 'Candidate reads', value: '240K/s', tone: 'bad' },
            { text: 'Swipe writes', value: '23K/s', tone: 'warn' },
            { text: 'Deck time', value: '2+ s', tone: 'bad' },
          ],
        },
        caption: 'Reads and writes fight over one box',
      },
    },
    {
      title: 'Geo cells',
      tag: 'concept',
      heading: 'Index people by map cell, not by coordinates',
      eli5: 'Draw squares on the gym floor and number them. Each kid stands in one square and the teacher keeps a list per square. Ask for square 7 and you get its kids at once: a **floor map**.',
      body: [
        'Cut the map into cells that each have an id, for example **S2 cells**, geohash or an Elasticsearch geo index. Store each profile under the id of its cell, so "who is here" is a key lookup instead of a scan.',
        'S2 cells come in levels, and each level splits a cell into four. Pick the level by how many people a cell should hold. The proximity service lesson covers geohash, quadtrees and S2.',
      ],
      keyIdea: 'A cell id turns a two-dimensional range scan into a key read.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '-', matches: '350/s' },
      scene: {
        nodes: [
          deck,
          { ...geo, at: at(-3.8, -3.2), status: 'active', sub: 'cell id to users' },
          { id: 'profiles', kind: 'db', at: at(-3.8, 3.2), label: 'profiles', sub: 'full rows by id' },
        ],
        links: [link('deck', 'geo'), link('deck', 'profiles')],
        flows: [
          { path: ['deck', 'geo'], tone: 'request', label: 'cell 4f3a1', duration: 1.5 },
          { path: ['geo', 'deck'], tone: 'response', label: 'user ids', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Geo index: cell to user ids',
          icon: 'Earth',
          rows: [
            { text: 'cell 4f3a1', value: 'u_12, u_90, u_203 ...' },
            { text: 'cell 4f3a3', value: 'u_7, u_44 ...' },
            { text: 'cell 4f3a4', value: 'u_65, u_311 ...' },
          ],
          footer: { text: 'One key read per cell', tone: 'good' },
        },
        caption: 'Who is in this cell is one lookup',
      },
    },
    {
      title: 'Radius query',
      tag: 'concept',
      heading: 'A radius turns into two or three cells',
      eli5: 'To find kids close to you, the teacher checks only the two or three squares around you instead of the whole gym. That is a **radius query**.',
      body: [
        'For a radius of 10 to 50 miles, an S2 **region coverer** picks a few cells, at mixed levels, that together cover the circle. The query reads those 2 or 3 cells and merges the lists into about **5,000** nearby user ids.',
        'The cells stick out past the circle, so one distance check per id trims the corners.',
      ],
      keyIdea: 'Mixed-level cells cover any radius with a handful of key reads, then an exact distance check trims the edges.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~25 ms for ids', matches: '350/s' },
      metricTones: { deck: 'good' },
      scene: {
        nodes: [
          { ...phone, at: at(-11.4, 0), sub: '40.74, -73.99' },
          deck,
          { ...geo, status: 'active', chips: [{ text: '3 cells', tone: 'good' }] },
        ],
        links: [link('phone', 'deck'), link('deck', 'geo')],
        flows: [
          { path: ['phone', 'deck'], tone: 'request', label: 'GET /deck', duration: 1.2 },
          { path: ['deck', 'geo'], tone: 'request', label: 'cover 25 mi', duration: 1.2, delay: 1.3 },
          { path: ['geo', 'deck'], tone: 'response', label: '~5,000 ids', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'From radius to ids',
          icon: 'Search',
          rows: [
            { text: 'Radius', value: '10 to 50 mi' },
            { text: 'Cells covering it', value: '2 to 3' },
            { text: 'User ids returned', value: '~5,000' },
            { text: 'Exact distance trim', value: 'per id' },
          ],
        },
        caption: 'Three key reads instead of a scan',
      },
      code: {
        language: 'python',
        title: 'Nearby ids from cells',
        source: `def nearby(lat, lng, radius_km):
    region = Cap(Point(lat, lng), radius_km)
    cells = RegionCoverer(max_cells=4).covering(region)   # mixed levels
    ids = []
    for cell in cells:
        ids += geo_index.get(cell)         # one key read per cell
    return [u for u in ids if dist(u, lat, lng) <= radius_km]`,
        highlight: [3, 6, 7],
      },
      quiz: {
        question: 'Why does the deck service read 2 or 3 cells from the geo index instead of filtering every profile by latitude and longitude?',
        options: [
          'Cells are always exactly circular, so no distance check is needed',
          'A cell id is a key, so nearby search becomes a few key reads instead of a range scan',
          'Cells hide each user\'s exact position, so privacy is solved',
          'The cells replace the preference filter',
        ],
        answer: 1,
        explain: 'Cells are keys, so reading one is one lookup. They still stick out past the circle, so a distance check follows, and privacy and preferences are separate steps.',
      },
    },
    {
      title: 'Preferences',
      tag: 'concept',
      heading: 'Both people must fit each other',
      eli5: 'Each kid wears a **name tag** saying who they want to meet. The teacher checks your tag against the kid, and the kid\'s tag against you.',
      body: [
        'The 5,000 ids still include people the user does not want. The filter checks the candidate against **my** preferences, and checks me against **their** preferences. A one-way fit wastes a card, because a mutual yes is impossible.',
        'It runs in memory on the deck service. Each geo index entry carries the few fields it needs: age, gender and preferences, about 60 bytes.',
      ],
      keyIdea: 'Filter in both directions, in memory, before spending any effort on ranking.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~30 ms', matches: '350/s' },
      scene: {
        nodes: [deck, { ...geo, status: 'dim' }, { ...filter, status: 'active' }],
        links: [link('deck', 'geo'), link('geo', 'filter')],
        flows: [
          { path: ['deck', 'geo', 'filter'], tone: 'request', label: '~5,000 ids', duration: 2.0 },
          { path: ['filter', 'deck'], tone: 'response', label: 'fits both ways', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Ana (27) checks Ben (29)',
          icon: 'Users',
          rows: [
            { text: 'Ben\'s age 29 in my 25 to 32', value: 'pass', tone: 'good' },
            { text: 'Ben\'s gender in my list', value: 'pass', tone: 'good' },
            { text: 'My age 27 in his 24 to 30', value: 'pass', tone: 'good' },
            { text: 'My gender in his list', value: 'drop', tone: 'bad' },
          ],
          footer: { text: 'One failed side drops the pair', tone: 'muted' },
        },
        caption: 'Each side has a veto',
      },
      code: {
        language: 'python',
        title: 'Mutual compatibility',
        source: `def compatible(me, c):
    return (
        me.want_age_min <= c.age <= me.want_age_max
        and c.gender in me.want_gender
        and c.want_age_min <= me.age <= c.want_age_max
        and me.gender in c.want_gender
    )`,
        highlight: [3, 4, 5, 6],
      },
    },
    {
      title: 'Seen filter',
      tag: 'concept',
      heading: 'A Bloom filter remembers who you already saw',
      eli5: 'Every kid you look at gets a stamp on a **stamp card** that is yours alone. Before showing someone new, the teacher checks whether they are already stamped.',
      body: [
        'Storing every seen id in a `NOT IN` list is too big and too slow. A per-user **Bloom filter** (the Bloom filters lesson) answers "seen in the last 30 days?" in constant time and little space.',
        'At about 6,000 entries per user and a 1% false positive rate, that is roughly 7 KB a user, or about **72 GB** for 10M daily users. One Redis cluster holds it.',
      ],
      keyIdea: 'A Bloom filter per user answers "already seen?" in O(1) and fits in memory for every active user.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~40 ms', matches: '350/s' },
      scene: {
        nodes: [{ ...filter, status: 'dim' }, { ...seen, status: 'active', chips: [{ text: '7 KB per user', tone: 'good' }] }, { ...swipesDb, at: at(7.6, 0), sub: 'source of truth' }],
        links: [link('filter', 'seen'), link('swipes', 'seen', { style: 'dashed', label: 'fills filter' })],
        flows: [
          { path: ['filter', 'seen'], tone: 'request', label: 'seen u_881?', duration: 1.4 },
          { path: ['seen', 'filter'], tone: 'response', label: 'no, keep', duration: 1.4, delay: 1.5 },
          { path: ['swipes', 'seen'], tone: 'data', label: 'add seen', duration: 1.4, delay: 3.0 },
        ],
        panel: {
          title: 'Sizing the seen filter',
          icon: 'Hash',
          rows: [
            { text: 'Entries per user, 30 days', value: '~6,000' },
            { text: 'Bits per entry at 1%', value: '~10' },
            { text: 'Size per user', value: '~7 KB' },
            { text: '10M daily users', value: '~72 GB', tone: 'good' },
          ],
        },
        caption: 'A tiny filter instead of a huge list',
      },
    },
    {
      title: 'Bloom tradeoffs',
      tag: 'tradeoff',
      heading: 'False positives are fine here, repeats are not',
      eli5: 'The stamp card is small and quick, but it sometimes shows a stamp that is not there, so a new kid gets skipped. A skipped kid is fine. A repeated kid is not.',
      body: [
        'A Bloom filter never calls a seen profile unseen, so it never repeats one. It sometimes calls a fresh one seen, hiding about 1% of good candidates. Nobody notices.',
        'A Bloom filter cannot delete, and matched or blocked people must be listed and undone. Keep an **exact set** for them. For expiry, keep about five weekly filters per user, check all of them, and discard the oldest each week.',
      ],
      keyIdea: 'Use an approximate filter where a miss is harmless and an exact set where a fact must be listed or reversed.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~40 ms', matches: '350/s' },
      scene: {
        nodes: [
          { ...filter, status: 'dim' },
          { ...seen, badge: '1% false hits', chips: [{ text: 'seen in 30 days', tone: 'default' }] },
          { id: 'exact', kind: 'cache', at: at(7.6, 0), label: 'exact set', sub: 'matched + blocked', status: 'active', chips: [{ text: 'listable, undoable', tone: 'good' }] },
        ],
        links: [link('filter', 'seen'), link('filter', 'exact')],
        flows: [
          { path: ['filter', 'seen'], tone: 'request', label: 'approx check', duration: 1.4 },
          { path: ['filter', 'exact'], tone: 'request', label: 'exact check', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Bloom filter tradeoff',
          icon: 'Scale',
          rows: [
            { text: 'Space per user', value: 'O(1), ~7 KB', tone: 'good' },
            { text: 'Speed', value: 'very fast', tone: 'good' },
            { text: 'Con: false positives', value: '~1% skipped', tone: 'warn' },
            { text: 'Con: no delete', value: '5 weekly filters', tone: 'warn' },
          ],
        },
        caption: 'Approximate for seen, exact for blocked',
      },
    },
    {
      title: 'Ranker',
      tag: 'concept',
      heading: 'Order the pile by chance of a mutual yes',
      eli5: 'A helper called the **sorter** guesses which kids you and they would both like, and puts those at the top of your pile of cards.',
      body: [
        'After filtering, a few hundred candidates remain, in no useful order. The **ranker** scores each by the predicted chance that both people swipe right, and returns the best 20 as the deck.',
        'It uses features of the pair: shared interests, age gap, distance, mutual friends through an optional link, and the user\'s history of who they tend to like.',
      ],
      keyIdea: 'Rank by the chance of a mutual yes, because a match needs both people, not just a like.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~120 ms', matches: '350/s' },
      scene: {
        nodes: [{ ...seen, status: 'dim', chips: [] }, { ...ranker, status: 'active' }, { id: 'features', kind: 'cache', at: at(11.4, 0), label: 'features', sub: 'interests, history' }],
        links: [link('seen', 'ranker'), link('features', 'ranker', { style: 'dashed' })],
        flows: [
          { path: ['seen', 'ranker'], tone: 'request', label: '~300 candidates', duration: 1.4 },
          { path: ['features', 'ranker'], tone: 'data', label: 'pair features', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Features of the pair',
          icon: 'Star',
          rows: [
            { text: 'Shared interests', value: 'overlap' },
            { text: 'Age gap', value: 'years apart' },
            { text: 'Distance', value: 'km' },
            { text: 'Mutual friends (opt-in link)', value: 'count' },
            { text: 'Reciprocity history', value: 'who I like' },
          ],
          footer: { text: 'Output: ordered queue of 20', tone: 'good' },
        },
        caption: 'A model predicts P(mutual right swipe)',
      },
    },
    {
      title: 'Score trap',
      tag: 'case',
      heading: 'One score per person runs away',
      eli5: 'If the sorter gives every kid one score, the same few kids go on top of everyone\'s pile and the rest wait forever. A **score for the pair** works better.',
      body: [
        'An ELO-style desirability score per user feeds on itself. High scorers are shown to everyone, collect more right swipes and score higher. Low scorers are shown to nobody, so their score never gets a chance to move.',
        'The fix is a score that belongs to the **pair**: how well this viewer fits this candidate. Each viewer gets a different order, so the same top few do not fill every deck.',
      ],
      keyIdea: 'A per-person score creates a rich-get-richer loop. A per-pair score gives every viewer their own order.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~120 ms', matches: '350/s' },
      scene: {
        nodes: [
          { ...ranker, tint: 'gray', sub: 'one score per user', at: at(7.6, 0) },
          { id: 'top', kind: 'user', at: at(3.8, -5.6), label: 'top profile', sub: 'high score', status: 'hot', badge: 'in every deck' },
          { id: 'newbie', kind: 'user', at: at(3.8, 5.6), label: 'low score', sub: 'rarely shown', status: 'dim', badge: 'in no deck' },
        ],
        links: [link('ranker', 'top', { label: 'ranked first', labelTone: 'warn' }), link('ranker', 'newbie', { style: 'faint' })],
        flows: [
          { path: ['ranker', 'top'], tone: 'request', label: 'shown to all', duration: 1.4, count: 3 },
        ],
        panel: {
          title: 'Score by person versus by pair',
          icon: 'Scale',
          rows: [
            { text: 'Per person', value: 'runaway loop', tone: 'bad' },
            { text: 'Same top few in every deck', value: 'yes', tone: 'bad' },
            { text: 'Per pair', value: 'f(viewer, candidate)', tone: 'good' },
            { text: 'Each viewer', value: 'own order', tone: 'good' },
          ],
        },
        caption: 'Popularity feeds on itself',
      },
    },
    {
      title: 'Fair attention',
      tag: 'concept',
      heading: 'Cap the most popular and boost the new',
      eli5: 'The teacher says each kid can be shown to 500 others a day, and a new kid gets 100 free looks at the start. That is the **fair-turns rule**.',
      body: [
        'A per-profile counter (the rate limiting lesson) caps impressions at **500 a day**, even for the most popular. At 2B impressions across 300M profiles the average is about 7, so the cap only touches the top of the curve.',
        'New users get a **boost** of 100 impressions at sign-up, so they can collect first reactions instead of waiting at the back of every deck.',
      ],
      keyIdea: 'A daily impression cap and a sign-up boost force attention into a long tail.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~120 ms', matches: '350/s' },
      scene: {
        nodes: [
          { ...ranker, at: at(7.6, 0) },
          { id: 'cap', kind: 'limiter', at: at(3.8, 0), label: 'impression cap', sub: '500 per day', status: 'active' },
          { id: 'top', kind: 'user', at: at(3.8, -5.6), label: 'top profile', sub: 'high demand', status: 'ok', chips: [{ text: '500 / 500', tone: 'warn' }] },
          { id: 'newbie', kind: 'user', at: at(3.8, 7), label: 'new user', sub: 'just signed up', status: 'ok', chips: [{ text: '+100 boost', tone: 'good' }] },
        ],
        links: [link('ranker', 'cap'), link('cap', 'top', { style: 'faint' }), link('cap', 'newbie', { style: 'faint' })],
        flows: [
          { path: ['ranker', 'cap'], tone: 'request', label: 'can show?', duration: 1.3 },
          { path: ['cap', 'ranker'], tone: 'response', label: 'yes, 187 so far', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Attention rules',
          icon: 'Scale',
          rows: [
            { text: 'Average impressions a day', value: '2B / 300M = ~7' },
            { text: 'Cap per profile', value: '500 a day' },
            { text: 'New user boost', value: '100 impressions' },
          ],
          footer: { text: 'Counter resets daily', tone: 'muted' },
        },
        caption: 'Shared attention by rule',
      },
      code: {
        language: 'python',
        title: 'Daily impression cap',
        source: `DAILY_CAP = 500

def may_show(profile_id, today):
    key = f"imp:{profile_id}:{today}"
    n = redis.incr(key)                    # atomic
    if n == 1:
        redis.expire(key, 86400)           # starts the day's window
    return n <= DAILY_CAP`,
        highlight: [5, 8],
      },
    },
    {
      title: 'Deck prefetch',
      tag: 'concept',
      heading: 'Send 20 cards ahead and keep the photos near',
      eli5: 'The teacher hands you a stack of 20 cards at once. You flip through them while the next stack is fetched, and the pictures come from a **photo wall** near you.',
      body: [
        'The whole pipeline (geo lookup, preferences, seen filter, ranker) targets under 300 ms at p99. The phone hides it by keeping a queue of 20 cards and asking for the next batch when 5 are left.',
        'Photos are the heavy bytes and live in object storage behind a CDN (the CDN lesson). The deck holds only URLs, and the phone preloads the next two photos while the user looks at the current card.',
      ],
      keyIdea: 'Prefetching hides the pipeline latency, and a CDN carries the photo bytes.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      metricTones: { deck: 'good' },
      scene: {
        nodes: [
          { ...phone, chips: [{ text: 'queue: 20 cards', tone: 'good' }, 'refill at 5'] },
          { ...deck, at: at(-1.8, 0) },
          { id: 'cdn', kind: 'cdn', at: at(2, -3.2), label: 'CDN', sub: 'photos' },
        ],
        links: [link('phone', 'deck'), link('phone', 'cdn', { style: 'dashed', label: 'preload 2 photos' })],
        flows: [
          { path: ['phone', 'deck'], tone: 'request', label: 'GET /deck', duration: 1.2 },
          { path: ['deck', 'phone'], tone: 'response', label: '20 cards', duration: 1.2, delay: 1.3 },
          { path: ['cdn', 'phone'], tone: 'data', label: 'photo', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Latency budget, p99 target',
          icon: 'Timer',
          rows: [
            { text: 'Geo lookup', value: '~25 ms' },
            { text: 'Preference filter', value: '~5 ms' },
            { text: 'Seen filter', value: '~10 ms' },
            { text: 'Ranker', value: '~60 ms' },
            { text: 'Network and overhead', value: '~100 ms' },
          ],
          footer: { text: 'Under 300 ms, hidden by prefetch', tone: 'good' },
        },
        caption: 'The user never waits for the pipeline',
      },
    },
    {
      title: 'Swipe writes',
      tag: 'concept',
      heading: 'A swipe is one write keyed by the swiper',
      eli5: 'When you hold up a card, the teacher writes it in the big notebook under **your name** and answers right away.',
      body: [
        'The swipes store is partitioned by `swiper_id` (the sharding lesson). A swipe is a write to one partition, and "everything I swiped on" is one range read that rebuilds a lost seen filter.',
        'A left swipe writes the row, marks the profile seen, and returns. A right swipe does the same, then also looks for the reverse swipe. At 23K writes a second, that is a modest load for a partitioned store.',
      ],
      keyIdea: 'Partition swipes by swiper so each write and each history read hits one partition.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      scene: {
        nodes: [
          phone,
          { ...api, label: 'swipe API', sub: 'POST /swipes', tint: 'amber' },
          { ...swipesDb, status: 'active', chips: [{ text: 'key: swiper_id', tone: 'good' }] },
          { ...seen, at: at(2, 3.2), label: 'seen filter', sub: 'Bloom per user' },
        ],
        links: [link('phone', 'api'), link('api', 'swipes'), link('api', 'seen', { style: 'dashed' })],
        flows: [
          { path: ['phone', 'api', 'swipes'], tone: 'request', label: '(Ana, Ben, right)', duration: 1.8 },
          { path: ['api', 'seen'], tone: 'event', label: 'mark seen', duration: 1.2, delay: 1.9 },
          { path: ['api', 'phone'], tone: 'response', label: 'ok', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'What each swipe does',
          icon: 'List',
          rows: [
            { text: 'Left swipe', value: 'write + mark seen' },
            { text: 'Right swipe', value: 'write + mark seen + check reverse' },
            { text: 'Partition key', value: 'swiper_id' },
            { text: 'Write rate', value: '23K/s' },
          ],
        },
        caption: 'Write under my own name',
      },
    },
    {
      title: 'Match race',
      tag: 'case',
      heading: 'Two right swipes at the same instant',
      eli5: 'Two kids hold up green at the same moment at different doors. Each door writes its card first, then looks for the other card, so at least one door spots the pair and **calls the match**.',
      body: [
        'Ana and Ben swipe right within a millisecond, on different servers. If each reads first and writes second, both reads find nothing and the match is lost.',
        '**Write first, then read.** Whichever read runs second must see the other write, so the reverse read must be strongly consistent, on the primary or a linearizable store, since a lagging replica can miss it. Both servers may spot the match, so `matches` uses the sorted pair as a unique key.',
      ],
      keyIdea: 'Write your swipe, then read the reverse, and make the match insert idempotent on the sorted pair.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      metricTones: { matches: 'good' },
      scene: {
        nodes: [
          { id: 'ana', kind: 'phone', at: at(-6, -3.8), label: 'Ana', sub: 'right on Ben' },
          { id: 'ben', kind: 'phone', at: at(-6, 3.8), label: 'Ben', sub: 'right on Ana' },
          { id: 'svc', kind: 'block', size: 0.8, at: at(-2, 0), label: 'swipe API', icon: 'Repeat', tint: 'amber' },
          { ...swipesDb, at: at(2, -3.8) },
          { ...matchesDb, at: at(2, 3.8), chips: [{ text: 'unique 204:881', tone: 'good' }] },
        ],
        links: [link('ana', 'svc'), link('ben', 'svc'), link('svc', 'swipes'), link('svc', 'matches')],
        flows: [
          { path: ['ana', 'svc', 'swipes'], tone: 'request', label: '1: write', duration: 1.6 },
          { path: ['ben', 'svc', 'swipes'], tone: 'request', label: '1: write', duration: 1.6 },
          { path: ['swipes', 'svc'], tone: 'response', label: '2: read reverse', duration: 1.3, delay: 1.8 },
          { path: ['svc', 'matches'], tone: 'data', label: '3: insert pair', duration: 1.3, delay: 3.2 },
        ],
        panel: {
          title: 'Why the order matters',
          icon: 'Repeat',
          rows: [
            { text: 'Read then write', value: 'both miss it', tone: 'bad' },
            { text: 'Write then read', value: 'one sees it', tone: 'good' },
            { text: 'Both see it', value: 'unique pair key', tone: 'good' },
          ],
          footer: { text: 'The read must see the other write (the consistency models lesson)', tone: 'muted' },
        },
        caption: 'One match row, never zero, never two',
      },
      code: {
        language: 'python',
        title: 'Swipe handler',
        source: `def swipe(me, target, direction):
    swipes.put((me, target), direction)          # 1. write first
    if direction != "right":
        return {"matched": False}
    if swipes.get((target, me)) == "right":      # 2. then read the reverse
        pair = f"{min(me, target)}:{max(me, target)}"
        matches.insert_if_absent(pair)           # 3. unique key, one row
        events.publish("match", pair)            # 4. every detector publishes
        return {"matched": True, "match_id": pair}
    return {"matched": False}`,
        highlight: [2, 5, 7, 8],
      },
      quiz: {
        question: 'Ana and Ben swipe right at the same instant on different servers. Which order makes sure the match is noticed?',
        options: [
          'Each server reads the other\'s swipe, then writes its own',
          'Each server writes its own swipe, then reads the other\'s',
          'Each server only writes, and a nightly job finds matches',
          'Only the server that got the first swipe checks for a match',
        ],
        answer: 1,
        explain: 'With write then read, the later of the two reads must see the earlier write, so at least one server spots the pair. The unique pair key stops a double match.',
      },
    },
    {
      title: 'Match alert',
      tag: 'concept',
      heading: 'Tell the first swiper without making Ben wait',
      eli5: 'When a pair matches, the teacher drops a note in a **mail slot**. A runner delivers it to the kid who already went home and sets up their table.',
      body: [
        'Ben\'s swipe response already says `matched: true`, so he sees the screen at once. Ana swiped hours ago and may be offline, so a `match` event goes on a queue (the message queues lesson). Every server that detects the match publishes it, so a crash after the insert cannot lose the push to Ana.',
        'A notifier worker sends Ana a push and asks the chat service to create the conversation (the chat lesson). The swipe never waits for either.',
      ],
      keyIdea: 'The second swiper learns from the response, the first from an event, and the swipe path stays short.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      scene: {
        nodes: [
          { ...matchesDb, at: at(-7.6, 0) },
          { id: 'mq', kind: 'queue', at: at(-3.8, 0), label: 'match events', sub: 'queue' },
          { id: 'notifier', kind: 'worker', at: at(0, 0), label: 'notifier', sub: 'push + chat' },
          { id: 'ana', kind: 'phone', at: at(3.8, -3.8), label: 'Ana', sub: 'offline', chips: [{ text: 'push: new match', tone: 'good' }] },
          { id: 'chat', kind: 'block', size: 0.8, at: at(3.8, 3.8), label: 'chat', sub: 'new thread', icon: 'Mail', tint: 'blue' },
        ],
        links: [link('matches', 'mq'), link('mq', 'notifier'), link('notifier', 'ana'), link('notifier', 'chat')],
        flows: [
          { path: ['matches', 'mq'], tone: 'event', label: 'match 204:881', duration: 1.2 },
          { path: ['mq', 'notifier'], tone: 'event', duration: 1.2, delay: 1.3 },
          { path: ['notifier', 'ana'], tone: 'event', label: 'push', duration: 1.3, delay: 2.6 },
          { path: ['notifier', 'chat'], tone: 'request', label: 'create thread', duration: 1.3, delay: 2.6 },
        ],
        panel: {
          title: 'Who learns how',
          icon: 'Mail',
          rows: [
            { text: 'Ben (second swiper)', value: 'swipe response', tone: 'good' },
            { text: 'Ana (first swiper)', value: 'push from event' },
            { text: 'Chat thread', value: 'created by worker' },
          ],
          footer: { text: 'Duplicate events are harmless: consumers are idempotent on pair id', tone: 'muted' },
        },
        caption: 'Async fan-out after the match row exists',
      },
    },
    {
      title: 'Geo shards',
      tag: 'concept',
      heading: 'Split the geo index by cell range',
      eli5: 'The gym is huge, so the floor map is split into rooms. Each room holds neighboring squares, and a **room list** tells the teacher which room to ask.',
      body: [
        'About 300M entries at 60 bytes fit in 18 GB. Peak is 2.4K decks a second times 2 to 3 cell reads of about 5,000 ids, roughly 6K reads and 30M ids a second, too much for one machine with headroom. Partition the geo index by **S2 cell id**, in ranges, with a few cells per shard.',
        'S2 ids follow a space-filling curve, so neighboring cells get neighboring ids and a radius query usually hits one or two shards. Hashing the cell id (the consistent hashing lesson) would scatter neighbors and fan out every query.',
      ],
      keyIdea: 'Range-partition by cell id so nearby cells share a shard and a query stays on one or two shards.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      scene: {
        nodes: [
          { ...deck, at: at(0, -3.5) },
          { id: 'sa', kind: 'shard', at: at(-4, 3.5), label: 'shard A', sub: 'cells 0 to 3', status: 'active', load: 55 },
          { id: 'sb', kind: 'shard', at: at(0, 3.5), label: 'shard B', sub: 'cells 4 to 7', status: 'active', load: 48 },
          { id: 'sc', kind: 'shard', at: at(4, 3.5), label: 'shard C', sub: 'cells 8 to 11', load: 30 },
        ],
        links: [link('deck', 'sa'), link('deck', 'sb'), link('deck', 'sc', { style: 'faint' })],
        flows: [
          { path: ['deck', 'sa'], tone: 'request', label: 'cell 2', duration: 1.4 },
          { path: ['deck', 'sb'], tone: 'request', label: 'cell 4', duration: 1.4, delay: 0.2 },
          { path: ['sa', 'deck'], tone: 'response', duration: 1.4, delay: 1.6 },
          { path: ['sb', 'deck'], tone: 'response', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Cell range to shard',
          icon: 'Earth',
          rows: [
            { text: 'cells 0 to 3', value: 'shard A' },
            { text: 'cells 4 to 7', value: 'shard B' },
            { text: 'cells 8 to 11', value: 'shard C' },
            { text: 'Radius touching cells 3 and 4', value: 'A + B, scatter-gather', tone: 'warn' },
            { text: 'Peak load', value: '2.4K decks x 2 to 3 cells = ~6K reads/s' },
          ],
          footer: { text: 'Union the lists from both shards', tone: 'muted' },
        },
        caption: 'Neighbors live together',
      },
    },
    {
      title: 'Moving users',
      tag: 'concept',
      heading: 'A move is a delete and an insert',
      eli5: 'A kid walks from one square to another. The teacher crosses them off the old square\'s list, adds them to the new one, and keeps an **A-to-Z roll call** saying where each kid is.',
      body: [
        'When a user\'s cell changes, the entry must leave the old shard and join the new one. Update on app open or after about a kilometer of movement, not on every GPS tick.',
        'A second, global index maps `user_id` to current cell and shard. Without it, finding "u_881" for a swipe or a block would mean asking every shard.',
      ],
      keyIdea: 'Cell-based shards need a user-to-cell index, and location writes should be throttled to real moves.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      scene: {
        nodes: [
          { ...phone, at: at(-7.6, 0), sub: 'moved 5 km' },
          { ...api, at: at(-3.8, 0), label: 'location API', sub: 'PUT /location' },
          { id: 'idx', kind: 'db', at: at(0, 3.6), label: 'user index', sub: 'user_id to cell' },
          { id: 'sa', kind: 'shard', at: at(3.8, -3.6), label: 'shard A', sub: 'old cell', chips: [{ text: 'remove u_204', tone: 'warn' }] },
          { id: 'sb', kind: 'shard', at: at(3.8, 3.6), label: 'shard B', sub: 'new cell', chips: [{ text: 'add u_204', tone: 'good' }] },
        ],
        links: [link('phone', 'api'), link('api', 'idx'), link('api', 'sa'), link('api', 'sb')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: '40.80, -73.95', duration: 1.2 },
          { path: ['api', 'idx'], tone: 'data', label: 'cell 5', duration: 1.2, delay: 1.3 },
          { path: ['api', 'sa'], tone: 'error', label: 'remove', duration: 1.3, delay: 2.6 },
          { path: ['api', 'sb'], tone: 'data', label: 'add', duration: 1.3, delay: 2.6 },
        ],
        panel: {
          title: 'When to update location',
          icon: 'Route',
          rows: [
            { text: 'App opened', value: 'update' },
            { text: 'Moved about 1 km', value: 'update' },
            { text: 'Every GPS tick', value: 'skip', tone: 'warn' },
            { text: 'Cell changed', value: 'delete + insert', tone: 'good' },
          ],
        },
        caption: 'Old cell forgets, new cell learns',
      },
    },
    {
      title: 'Hotspots',
      tag: 'case',
      heading: 'A conference floods one cell',
      eli5: 'A big crowd shows up in one square and its room gets jammed. The teacher cuts that square into four smaller squares and hands them to different rooms: **splitting a hot square**.',
      body: [
        'A conference, stadium or airport puts tens of thousands of active users in one cell. Its shard runs hot while neighbors idle, and the S2 benefit of "efficient proximity queries" becomes the problem.',
        'S2 cells are hierarchical, so split the hot cell into its four children and give them to different shards. Cache the hot cell\'s candidate list for a few seconds. Dense cities get finer cells from the start.',
      ],
      keyIdea: 'Cells are cheap to subdivide, so split the hot ones and keep dense areas finer than quiet ones.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '2 s, then back', matches: '350/s' },
      metricTones: { deck: 'warn' },
      scene: {
        nodes: [
          { ...deck, at: at(-3.8, 0) },
          { id: 'hot', kind: 'shard', at: at(0, -3.6), label: 'shard B', sub: 'conference cell', status: 'hot', load: 96 },
          { id: 'sa', kind: 'shard', at: at(3.8, 0), label: 'shard A', sub: 'quiet', load: 22 },
          { id: 'sc', kind: 'shard', at: at(0, 3.6), label: 'shard C', sub: 'quiet', load: 18 },
        ],
        links: [link('deck', 'hot', { label: 'one cell, 96% load', labelTone: 'warn' }), link('hot', 'sa', { style: 'dashed', label: 'child cell 1' }), link('hot', 'sc', { style: 'dashed', label: 'child cell 2' })],
        flows: [
          { path: ['deck', 'hot'], tone: 'request', label: 'same cell', duration: 1.2, count: 3 },
          { path: ['hot', 'sa'], tone: 'data', label: 'move cell', duration: 1.4, delay: 1.6 },
          { path: ['hot', 'sc'], tone: 'data', label: 'move cell', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Split a hot cell',
          icon: 'Split',
          rows: [
            { text: 'Before: one cell, one shard', value: '96% load', tone: 'bad' },
            { text: 'After: 4 child cells', value: '~a quarter each', tone: 'good' },
            { text: 'Hot cell candidates cached', value: 'a few seconds' },
          ],
          footer: { text: 'Then merge them back when the crowd leaves', tone: 'muted' },
        },
        caption: 'Subdivide the cell that is on fire',
      },
    },
    {
      title: 'Degrade',
      tag: 'case',
      heading: 'Every stage has a fallback',
      eli5: 'If one room closes or the sorter is out, the teacher still hands you cards: from a **spare room**, or sorted by who is closest. A shorter, plainer stack beats no stack.',
      body: [
        'Every stage of the deck can fail. A geo shard is down, so read its replica or skip that cell for a shorter deck. The ranker times out at 50 ms, so sort by distance. The seen filter is lost, so rebuild it from the swipes store and meanwhile check the last day of swipes exactly.',
        'A deck that is a bit worse still lets the user swipe. A swipe write that fails is retried by the phone, and is safe to repeat because the key is `(swiper, target)`.',
      ],
      keyIdea: 'Degrade the deck, never block it: a plainer deck beats an error, and repeated swipe writes are harmless.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '~150 ms, plain', matches: '350/s' },
      metricTones: { deck: 'warn' },
      scene: {
        nodes: [
          { ...phone, at: at(-7.6, 0), badge: 'got 20 cards' },
          { ...deck, at: at(-3.8, 0), status: 'active' },
          { id: 'sa', kind: 'shard', at: at(0, -3.6), label: 'shard A', sub: 'primary', status: 'down' },
          { id: 'ra', kind: 'replica', at: at(0, 3.6), label: 'replica A', sub: 'takes over', status: 'ok' },
          { ...ranker, at: at(3.8, 0), status: 'down', sub: 'timeout 50 ms' },
        ],
        links: [link('phone', 'deck'), link('deck', 'sa', { style: 'dashed' }), link('deck', 'ra'), link('deck', 'ranker', { style: 'dashed' })],
        flows: [
          { path: ['deck', 'ra'], tone: 'request', label: 'read replica', duration: 1.3 },
          { path: ['deck', 'ranker'], tone: 'error', label: 'timeout', duration: 1.3, delay: 1.4 },
          { path: ['deck', 'phone'], tone: 'response', label: 'sorted by distance', duration: 1.4, delay: 2.9 },
        ],
        panel: {
          title: 'Fallback per stage',
          icon: 'Shield',
          rows: [
            { text: 'Geo shard down', value: 'replica, else skip cell', tone: 'warn' },
            { text: 'Ranker timeout', value: 'sort by distance', tone: 'warn' },
            { text: 'Seen filter lost', value: 'rebuild from swipes', tone: 'warn' },
            { text: 'Swipe write fails', value: 'client retries, idempotent', tone: 'good' },
          ],
        },
        caption: 'Worse deck, still a deck',
      },
    },
    {
      title: 'Location privacy',
      tag: 'tradeoff',
      heading: 'Distance shown to others leaks position',
      eli5: 'The teacher tells you "about 3 miles away", never the exact desk. That way nobody can walk around the room and work out where a kid sits: a **blurry distance**.',
      body: [
        'Showing "2 km away" lets an attacker move to a few points, read the distance from each, and **trilaterate** a target\'s home. The server must round distances up to whole miles and never send exact coordinates to other users.',
        'The cost is a coarser "nearby". Rounding on the server is required, because a check in the client can be bypassed.',
      ],
      keyIdea: 'Keep exact positions server side and show only rounded distance, because repeated readings reveal where someone is.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      scene: {
        nodes: [
          { id: 'ana', kind: 'phone', at: at(-5.5, 0), label: 'Ana', sub: 'exact position stored' },
          { ...deck, at: at(-1.8, 0), chips: [{ text: 'round up to 1 mi', tone: 'good' }] },
          { id: 'mallory', kind: 'user', at: at(2, 0), label: 'stranger', sub: 'moves around', chips: [{ text: '3 mi away', tone: 'warn' }] },
        ],
        links: [link('ana', 'deck'), link('deck', 'mallory')],
        flows: [
          { path: ['ana', 'deck'], tone: 'request', label: '40.74, -73.99', duration: 1.4 },
          { path: ['deck', 'mallory'], tone: 'response', label: '"3 mi away"', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What leaves the server',
          icon: 'Shield',
          rows: [
            { text: 'Coordinates to other users', value: 'never', tone: 'good' },
            { text: 'Shown distance', value: 'rounded up', tone: 'good' },
            { text: 'Exact distance from the client', value: 'unsafe', tone: 'bad' },
            { text: 'Hide profile', value: 'leaves geo index' },
          ],
        },
        caption: 'Blur on the server, not the phone',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One mutual yes, found at 240K reads a second',
      eli5: 'Floor map, name tags, stamp card, sorter, fair turns and write-then-look for matches. Together they run the **whole party** for millions of kids.',
      body: [
        'The deck pipeline is geo cells, a two-way preference filter, a Bloom seen filter and a pair-based ranker, with caps and a boost for fairness. Swipes are one write keyed by swiper, and a match is found by writing first, then reading the reverse.',
        'The geo index shards by cell range, splits hot cells, and every stage has a fallback.',
      ],
      keyIdea: 'Cheap approximate checks narrow the crowd, one careful ordering finds the match, and every stage can degrade.',
      metrics: { swipes: '23K/s', cands: '240K/s', deck: '< 300 ms p99', matches: '350/s' },
      metricTones: { deck: 'good', matches: 'good' },
      scene: {
        nodes: [
          { ...phone, at: at(-7.6, 0), badge: '10M daily' },
          { ...deck, at: at(-3.8, 0) },
          { ...geo, at: at(0, -3.6), status: 'ok' },
          { ...seen, at: at(0, 3.6), status: 'ok' },
          { ...swipesDb, at: at(3.8, 0), status: 'ok' },
        ],
        links: [link('phone', 'deck'), link('deck', 'geo'), link('deck', 'seen'), link('deck', 'swipes')],
        flows: [
          { path: ['phone', 'deck', 'geo'], tone: 'request', label: 'deck', duration: 1.6 },
          { path: ['deck', 'seen'], tone: 'request', label: 'filter', duration: 1.2, delay: 1.7 },
          { path: ['phone', 'deck', 'swipes'], tone: 'request', label: 'swipe', duration: 1.6, delay: 3.0 },
        ],
        panel: {
          title: 'Design in one table',
          icon: 'Table',
          rows: [
            { text: 'S2 cells', value: 'fast, hotspots to split' },
            { text: 'Bloom seen filter', value: 'tiny, 1% skips' },
            { text: 'Pair-based ranking', value: 'no runaway score' },
            { text: 'Cap + boost', value: 'long-tail attention' },
            { text: 'Write, then read', value: 'no missed match' },
          ],
        },
        caption: 'Narrow the crowd, then catch the pair',
      },
      quiz: {
        question: 'The Bloom seen filter wrongly says "seen" about 1% of profiles Ana never saw. What is the effect?',
        options: [
          'Ana is shown some profiles twice',
          'Matches are missed',
          'Ana is silently never shown about 1% of otherwise valid candidates for that window',
          'Ana\'s swipes are lost',
        ],
        answer: 2,
        explain: 'A Bloom filter has false positives but no false negatives. A false positive hides a fresh profile, which is harmless with thousands of candidates. Repeats would need a false negative.',
      },
    },
  ],
};
