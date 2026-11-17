import type { Lesson, SceneNode, SceneZone } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const diner: SceneNode = { id: 'diner', kind: 'phone', at: p(-9, 0), label: 'diner', sub: 'coffee within 1 km' };
const owner: SceneNode = { id: 'owner', kind: 'client', at: p(-9, 5.5), label: 'owner', sub: 'edits listing' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: p(-5.5, 0), label: 'load balancer' };
const lbs: SceneNode = { id: 'lbs', kind: 'server', at: p(-1.5, -2.5), label: 'search service', sub: 'stateless, read-only' };
const biz: SceneNode = { id: 'biz', kind: 'service', at: p(-1.5, 5), label: 'business service', sub: 'CRUD, ~100 writes/s' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(3, 2.5), label: 'business DB', sub: '200M rows' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: p(3, -4.5), label: 'Redis', sub: 'keyed by geohash' };
const replicas: SceneNode = { id: 'replicas', kind: 'replica', at: p(7, -1.5), label: 'read replicas', sub: 'x3' };
const job: SceneNode = { id: 'job', kind: 'worker', at: p(7, 4.5), label: 'nightly sync', sub: 'rebuilds cache' };

// Index options, shown side by side in the comparison step.
const grid: SceneNode = { id: 'grid', kind: 'search', at: p(-6, -1), label: 'fixed grid', sub: 'uneven cells' };
const geohash: SceneNode = { id: 'geohash', kind: 'search', at: p(-2, 2), label: 'geohash', sub: 'string prefixes' };
const quadtree: SceneNode = { id: 'quadtree', kind: 'search', at: p(2, -1), label: 'quadtree', sub: 'in-memory tree' };
const s2: SceneNode = { id: 's2', kind: 'search', at: p(6, 2), label: 'S2 cells', sub: 'Hilbert curve ids' };

// Multi-region pieces.
const dns: SceneNode = { id: 'dns', kind: 'dns', at: p(0, -6), label: 'GeoDNS', sub: 'nearest region' };
const dinerUs: SceneNode = { id: 'dinerUs', kind: 'phone', at: p(-8.5, -2), label: 'diner', sub: 'Chicago' };
const dinerEu: SceneNode = { id: 'dinerEu', kind: 'phone', at: p(8.5, -2), label: 'diner', sub: 'Paris' };
const lbsUs: SceneNode = { id: 'lbsUs', kind: 'server', at: p(-4.5, 1.5), label: 'search US' };
const cacheUs: SceneNode = { id: 'cacheUs', kind: 'cache', at: p(-7.5, 5), label: 'Redis US' };
const repUs: SceneNode = { id: 'repUs', kind: 'replica', at: p(-2.5, 5.5), label: 'replicas US' };
const lbsEu: SceneNode = { id: 'lbsEu', kind: 'server', at: p(4.5, 1.5), label: 'search EU' };
const cacheEu: SceneNode = { id: 'cacheEu', kind: 'cache', at: p(7.5, 5), label: 'Redis EU' };
const repEu: SceneNode = { id: 'repEu', kind: 'replica', at: p(2.5, 5.5), label: 'replicas EU' };

const zoneUs: SceneZone = { id: 'us', from: [-2, 2.4], to: [2, 6.9], label: 'us-east', tone: 'blue' };
const zoneEu: SceneZone = { id: 'eu', from: [2.4, -2], to: [6.9, 2], label: 'eu-west', tone: 'violet' };

const readLinks = [
  { from: 'diner', to: 'lb' },
  { from: 'lb', to: 'lbs' },
];

export const designProximityService: Lesson = {
  id: 'design-proximity-service',
  title: 'Design a proximity service',
  tagline: 'Find the restaurants within a radius of a moving phone, fast, for 100 million people a day.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Why a plain latitude and longitude range query scans far too many rows',
    'Geospatial indexes: fixed grid, geohash, quadtree and S2 cells',
    'The geohash boundary problem and the nine-cell query that fixes it',
    'Choosing an index for read-heavy data that rarely changes',
    'Caching by geohash, read replicas and serving from several regions',
  ],
  metrics: [
    { key: 'qps', label: 'Peak search QPS' },
    { key: 'rows', label: 'Rows read per search' },
    { key: 'p99', label: 'Search p99' },
    { key: 'db', label: 'DB reads/s' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'What is near me, right now?',
      eli5: 'A tourist walks up to the **information desk** and asks for a cafe within a short walk. The clerk has a filing cabinet with every shop in the country and must answer in a blink.',
      body: [
        'A diner opens the app and asks for restaurants within a radius of 0.5, 1, 2 or 5 km. The results come back as a list, nearest first, with name, rating and distance. Business owners can add or edit a listing, and it is fine if the change shows up the next day.',
        'Scale: **100M daily users**, about 5 searches each, so 500M searches a day. That is roughly 5,800 searches per second on average and about **17,000 per second** at peak. There are **200M businesses**. At about 1 KB each, the business table is around 200 GB. Searches must answer within **200 ms** at p99.',
        'Writes are tiny next to reads: a few million listing edits a day, around 100 per second. This is a read-heavy system on data that barely moves, and that shapes every choice that follows.',
      ],
      keyIdea: 'Read-heavy, rarely changing data means we can precompute, cache and copy freely. The hard part is the spatial query itself.',
      metrics: { qps: '17,000/s', rows: '-', p99: 'goal < 200 ms', db: '-' },
      scene: {
        nodes: [diner, lb, { ...lbs, status: 'active', badge: '17,000 searches/s' }, { ...db, badge: '200M businesses' }],
        links: [...readLinks, { from: 'lbs', to: 'db' }],
        flows: [
          { path: ['diner', 'lb', 'lbs'], tone: 'request', label: 'near (lat, lng), 1 km', duration: 1.6 },
          { path: ['lbs', 'db'], tone: 'request', label: 'who is close?', duration: 1, delay: 1.6 },
          { path: ['db', 'lbs', 'lb', 'diner'], tone: 'response', label: '20 places', duration: 1.8, delay: 2.7 },
        ],
        caption: '17,000 searches per second against 200M places',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'Two services, two very different loads',
      eli5: 'There are two windows at the desk. One answers **where is a cafe** questions all day long. The other takes the rare form from a shop owner who changed their opening hours.',
      body: [
        'The read API is one call: `GET /v1/search/nearby?lat=41.88&lng=-87.63&radius=1000`. It returns a page of business ids, names, distances and a cursor for the next page. Detail pages call `GET /v1/businesses/{id}`. Owners use `POST`, `PUT` and `DELETE` on `/v1/businesses`.',
        'Split this into two services. The **search service** is stateless and read-only, so it scales by adding copies behind the load balancer. The **business service** handles the CRUD calls at about 100 writes per second and owns the database.',
        'The data model has a `business` table (id, name, address, lat, lng, category, rating) and a separate **geo index** that answers one question: which business ids sit in this area. Most of this lesson is about how to build that index.',
      ],
      keyIdea: 'Separate the hot, read-only search path from the slow write path so each can scale on its own.',
      metrics: { qps: '17,000/s', rows: '-', p99: 'goal < 200 ms', db: '-' },
      scene: {
        nodes: [diner, owner, lb, { ...lbs, status: 'active' }, { ...biz, status: 'active' }, db],
        links: [...readLinks, { from: 'owner', to: 'biz' }, { from: 'lbs', to: 'db' }, { from: 'biz', to: 'db' }],
        flows: [
          { path: ['diner', 'lb', 'lbs'], tone: 'request', label: 'GET /search/nearby', count: 4, duration: 1.4 },
          { path: ['lbs', 'db'], tone: 'request', count: 3, duration: 1, delay: 1.4 },
          { path: ['owner', 'biz'], tone: 'request', label: 'PUT /businesses/7', duration: 1.6, delay: 0.6 },
          { path: ['biz', 'db'], tone: 'data', label: 'UPDATE', duration: 1, delay: 2.3 },
        ],
        caption: 'Many reads on the left, a trickle of writes below',
      },
    },
    {
      title: 'Naive query',
      tag: 'problem',
      heading: 'Why a latitude and longitude range is slow',
      eli5: 'The clerk first pulls every shop on the same east-west street line as the tourist, then every shop on the same north-south line, and only then looks for shops on both lists. Two huge piles for a handful of answers.',
      body: [
        'The first idea: draw a box around the diner and ask for rows with `lat BETWEEN` two values and `lng BETWEEN` two values, with an index on each column. It returns the right answer. It is just very slow.',
        'A B-tree index orders rows along one dimension. The `lat` index finds every business in a thin band that wraps the whole planet, and the `lng` index finds every business in a band from pole to pole. Each band can hold many thousands of rows in a busy part of the world. The database intersects the two large sets to keep the few dozen rows inside the box.',
        'A composite index on `(lat, lng)` barely helps, because a range on the first column stops the second column from narrowing the scan. At 17,000 searches per second, each touching tens of thousands of rows, the database is lost. We need an index that understands two dimensions at once.',
      ],
      keyIdea: 'A one-dimensional index cannot answer a two-dimensional question without scanning a whole strip of the world.',
      metrics: { qps: '17,000/s', rows: '~50,000', p99: '2,400 ms', db: '17,000/s' },
      scene: {
        nodes: [diner, lb, { ...lbs, status: 'hot', badge: 'waiting on DB' }, { ...db, status: 'hot', badge: 'scanning two bands' }],
        links: [...readLinks, { from: 'lbs', to: 'db' }],
        flows: [
          { path: ['diner', 'lb', 'lbs'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['lbs', 'db'], tone: 'request', label: 'lat BETWEEN, lng BETWEEN', count: 5, duration: 1.2, delay: 1.2 },
          { path: ['db', 'lbs'], tone: 'error', label: 'timeout', duration: 2.4, delay: 2.6 },
        ],
        caption: 'Each search intersects two strips of the planet',
      },
      code: {
        language: 'sql',
        title: 'The box query and why its indexes do not help',
        source: `CREATE INDEX idx_lat ON business (lat);
CREATE INDEX idx_lng ON business (lng);

-- ~1 km box around the diner in Chicago
SELECT id, name, lat, lng
FROM business
WHERE lat BETWEEN 41.871 AND 41.889   -- band around the whole planet
  AND lng BETWEEN -87.642 AND -87.618 -- band from pole to pole
LIMIT 50;

-- idx_lat finds every row in the latitude band,
-- idx_lng finds every row in the longitude band,
-- and the database intersects two big sets to keep a few dozen.`,
        highlight: [7, 8, 11, 12, 13],
      },
    },
    {
      title: 'Grid cells',
      tag: 'concept',
      heading: 'Cut the map into cells: the fixed grid',
      eli5: 'The clerk pins a map on the wall and draws equal squares over it. Each square gets a **folder** of the shops inside it, so a question only opens one or two folders.',
      body: [
        'Every spatial index follows the same trick: turn two dimensions into a cell id, then look up cells instead of scanning rows. The simplest version is an **evenly divided grid**. Cut the world into fixed squares, say 1 km on a side, and store each business under the id of its square.',
        'A search computes the diner\'s square, reads it and its neighbors, and computes exact distances for the few hundred businesses it gets back. That is already a huge win over two planet-sized bands.',
        'The flaw is density. A square in central Tokyo might hold thousands of businesses while a square in the Pacific holds none. Big cells drown dense cities, small cells waste billions of empty ids on oceans and deserts. We want cells that shrink where businesses crowd together.',
      ],
      keyIdea: 'Mapping 2D points to cell ids is the core move. A fixed grid does it, but one cell size cannot fit both a city and an ocean.',
      metrics: { qps: '17,000/s', rows: '~300 to 5,000', p99: '300 ms', db: '17,000/s' },
      scene: {
        nodes: [diner, lb, { ...lbs, status: 'active', badge: 'cell (412, 87)' }, { ...db, status: 'active', badge: 'downtown cell: 5,000 rows' }],
        links: [...readLinks, { from: 'lbs', to: 'db' }],
        flows: [
          { path: ['diner', 'lb', 'lbs'], tone: 'request', duration: 1.2 },
          { path: ['lbs', 'db'], tone: 'request', label: 'cells around (412, 87)', duration: 1.2, delay: 1.2 },
          { path: ['db', 'lbs', 'lb', 'diner'], tone: 'response', duration: 1.6, delay: 2.5 },
        ],
        caption: 'Fewer rows, but dense cells are still heavy',
      },
    },
    {
      title: 'Geohash',
      tag: 'concept',
      heading: 'Geohash: a cell id you can shorten',
      eli5: 'The clerk splits the map in half again and again, writing a letter for each choice. A short **code** names a big area and a longer code names a small corner inside it, so similar codes usually mean nearby places.',
      body: [
        'A **geohash** halves the longitude range, then the latitude range, again and again, recording one bit per split. The interleaved bits are written in base32, so `9q8yy` is a cell and `9q8yyk` is one of 32 smaller cells inside it. Length 5 is about 4.9 km square, length 6 about 1.2 km by 0.6 km.',
        'Because a longer hash always starts with the hash of its parent, a prefix query on an ordinary B-tree finds every business in a cell: `WHERE geohash LIKE \'dp3wj%\'`. The index is a small table of `(geohash, business_id)` rows: about 40 bytes each, so 200M businesses fit in around **8 GB**.',
        'To search, pick the longest hash whose cell is at least as large as the radius (length 5 for 1 km), take the diner\'s cell plus its 8 neighbors, fetch those ids, and compute the true distance to each. Updates are cheap: a business that moves gets a new hash string.',
      ],
      keyIdea: 'Geohash turns location into a string where a shared prefix means a shared area, so a normal database index can do spatial search.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '60 ms', db: '17,000/s' },
      scene: {
        nodes: [diner, lb, { ...lbs, status: 'active', badge: 'dp3wj + 8 neighbors' }, { ...db, status: 'ok', badge: 'geohash index 8 GB' }],
        links: [...readLinks, { from: 'lbs', to: 'db' }],
        flows: [
          { path: ['diner', 'lb', 'lbs'], tone: 'request', label: '41.88, -87.63', duration: 1.2 },
          { path: ['lbs', 'db'], tone: 'request', label: '9 prefix scans', duration: 1, delay: 1.3 },
          { path: ['db', 'lbs'], tone: 'response', label: '~400 ids', duration: 1, delay: 2.4 },
          { path: ['lbs', 'lb', 'diner'], tone: 'response', label: 'nearest 20', duration: 1.2, delay: 3.5 },
        ],
        caption: 'Nine small prefix scans replace two planet-wide bands',
      },
      code: {
        language: 'python',
        title: 'Nearby search on a geohash index',
        source: `import geohash2 as gh          # encode / neighbors helpers
from math import radians, sin, cos, asin, sqrt

def precision_for(radius_m):
    # longest hash whose cell edge is still >= the radius
    return 6 if radius_m <= 500 else 5 if radius_m <= 2000 else 4

def nearby(lat, lng, radius_m, limit=20):
    p = precision_for(radius_m)
    center = gh.encode(lat, lng, precision=p)
    cells = [center] + gh.neighbors(center)            # 9 cells
    rows = db.query(
        "SELECT business_id, lat, lng FROM geo_index "
        "WHERE " + " OR ".join(["geohash LIKE %s"] * 9),
        [c + "%" for c in cells])
    hits = [(dist_m(lat, lng, r.lat, r.lng), r.business_id) for r in rows]
    return sorted(h for h in hits if h[0] <= radius_m)[:limit]

def dist_m(a, b, c, d):                                # haversine
    a, b, c, d = map(radians, (a, b, c, d))
    h = sin((c - a) / 2) ** 2 + cos(a) * cos(c) * sin((d - b) / 2) ** 2
    return 2 * 6_371_000 * asin(sqrt(h))`,
        highlight: [6, 10, 11, 14, 17],
      },
    },
    {
      title: 'Edge cases',
      tag: 'case',
      heading: 'Case: the cafe across the street is missing',
      eli5: 'A tourist stands right on the line between two squares on the wall map. The cafe across the road sits in the next square, so the clerk must always open the neighboring **folders** too.',
      body: [
        'Two businesses ten meters apart can land in different cells. Worse, the shared prefix can be short or even empty: points on either side of the equator or the prime meridian are neighbors on the ground yet have no common prefix at all. A shared prefix tells you two points are close. Two close points can still have different prefixes.',
        'A search that reads only the diner\'s own cell misses the cafe across the boundary. That is why the query always reads the **center cell plus its 8 neighbors**, computed by geometry, never by trimming characters off the string.',
        'The second edge case is too few results. In a village, nine length-5 cells may return two places. Drop one character to widen the search to length 4 cells and try again, up to a limit, then return what exists.',
      ],
      keyIdea: 'Shared prefix implies nearby, but nearby does not imply shared prefix. Always query the neighbor cells.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '60 ms', db: '17,000/s' },
      scene: {
        nodes: [{ ...diner, badge: 'on a cell edge' }, lb, { ...lbs, status: 'active', badge: 'center + 8 neighbors' }, { ...db, status: 'ok' }],
        links: [...readLinks, { from: 'lbs', to: 'db' }],
        flows: [
          { path: ['lbs', 'db'], tone: 'request', label: 'center cell only', duration: 1.1 },
          { path: ['db', 'lbs'], tone: 'error', label: 'cafe missed', duration: 1.1, delay: 1.2 },
          { path: ['lbs', 'db'], tone: 'request', label: '9 cells', duration: 1.1, delay: 2.5 },
          { path: ['db', 'lbs', 'lb', 'diner'], tone: 'response', label: 'cafe found', duration: 1.6, delay: 3.7 },
        ],
        caption: 'One cell misses the neighbor, nine cells catch it',
      },
      quiz: {
        question: 'A diner stands one meter north of the equator. The nearest cafe is two meters south of it. Why does a search on the diner\'s geohash prefix alone miss the cafe?',
        options: [
          'Geohash cannot encode points near the equator',
          'The two points fall in cells whose hashes share no prefix, so only a neighbor-cell lookup finds the cafe',
          'The B-tree index on geohash is out of date',
          'The radius is too small for geohash length 5',
        ],
        answer: 1,
        explain: 'The first split of a geohash is at the equator and prime meridian, so points just across those lines get different first characters. Neighbor cells are computed by geometry, which is why the nine-cell query finds the cafe.',
      },
    },
    {
      title: 'Quadtree',
      tag: 'concept',
      heading: 'Quadtree: cells that split where it is crowded',
      eli5: 'Instead of equal squares, the clerk cuts any square with too many shops into four smaller ones, and keeps cutting. Busy downtown ends up with tiny squares and the empty lake keeps one big **square**.',
      body: [
        'A **quadtree** starts with the whole world as one node and splits any node holding more than, say, 100 businesses into four children. Dense downtowns end up with deep, small leaves, oceans stay as one big leaf. Each leaf holds roughly the same number of businesses, which is what the fixed grid could not do.',
        'It is an in-memory structure built by each search server at startup. With 200M businesses and 100 per leaf there are about 2M leaves; ids and node overhead come to a few GB, which fits in one server\'s RAM. A search walks down to the diner\'s leaf and widens to neighboring leaves until it has enough results, which also makes a k-nearest query easy.',
        'The costs are operational. Building the tree for 200M points takes minutes, so a fresh server is not ready right away and you must not restart the whole fleet at once. Live updates to a shared tree need locking, so most teams rebuild it nightly and swap it in.',
      ],
      keyIdea: 'A quadtree adapts cell size to density and finds the k nearest well, at the cost of living in RAM and being slow to rebuild.',
      metrics: { qps: '17,000/s', rows: '~100 per leaf', p99: '40 ms', db: 'startup only' },
      scene: {
        nodes: [diner, lb, { ...lbs, status: 'active', badge: 'quadtree in RAM, ~2M leaves' }, { ...db, status: 'dim', badge: 'read once at boot' }],
        links: [...readLinks, { from: 'lbs', to: 'db', style: 'dashed', label: 'load at startup' }],
        flows: [
          { path: ['db', 'lbs'], tone: 'data', label: '200M points', count: 3, duration: 1.6 },
          { path: ['diner', 'lb', 'lbs'], tone: 'request', duration: 1.2, delay: 1.8 },
          { path: ['lbs', 'lb', 'diner'], tone: 'response', label: 'from memory', duration: 1.2, delay: 3.1 },
        ],
        caption: 'The index lives inside each search server',
      },
    },
    {
      title: 'Choosing one',
      tag: 'tradeoff',
      heading: 'Grid, geohash, quadtree or S2?',
      eli5: 'There are many ways to cut the wall map. The clerk picks the one that is easiest to keep up to date, since shops change rarely and the **folders** only need a quick refresh at night.',
      body: [
        '**S2**, from Google, projects the sphere onto the six faces of a cube and numbers cells along a Hilbert curve, so cells close on the ground usually get close 64-bit ids. Its region coverer describes any circle or polygon as a small set of cells of mixed sizes, which suits geofencing. Uber\'s H3 takes a similar idea with hexagons. Both need a library you have to learn.',
        'For this system we pick **geohash** stored in a normal table and cached in Redis. Data changes rarely, the index is 8 GB, prefix queries work in any database, and an update is one row. A quadtree would win if we needed exact k-nearest results or extreme density. S2 would win for arbitrary shapes such as delivery zones.',
        'The fixed grid is only worth it when density is even, such as sensor stations on a regular layout.',
      ],
      keyIdea: 'Pick the simplest index that handles your density and update rate. For slow-changing businesses, geohash in a plain table is enough.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '60 ms', db: '17,000/s' },
      scene: {
        nodes: [{ ...grid, status: 'dim' }, { ...geohash, status: 'ok', badge: 'our pick' }, quadtree, s2],
        flows: [],
        caption: 'Four ways to turn a point into a cell',
      },
    },
    {
      title: 'Cache, replicas',
      tag: 'concept',
      heading: 'Cache by geohash, read from replicas',
      eli5: 'The clerk keeps photocopies of the busiest **folders** on the counter and a few copy cabinets in the back room. Every night a helper refreshes the copies from the main cabinet.',
      body: [
        'Searches still hit the database 17,000 times a second. Since data changes rarely, cache aggressively. Key `geo:5:dp3wj` holds the list of business ids in that cell, at lengths 4, 5 and 6. Each business appears in three lists of 8-byte ids, so the whole map is about 5 GB, small enough for every Redis replica to hold a full copy. Key `biz:{id}` holds the details for the detail page.',
        'Owners were told edits show up the next day, so a **nightly sync** job rebuilds the cell lists from the database instead of invalidating keys on every write. The few misses go to **read replicas** of the business DB (see the replication lesson); replication lag of seconds does not matter here.',
        'The search service now does nine `MGET`-style reads to Redis and a sort. It holds no state, so it scales horizontally behind the load balancer.',
      ],
      keyIdea: 'When the data changes daily and reads run at thousands per second, precompute per-cell lists and copy them everywhere.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '25 ms', db: '~300/s' },
      scene: {
        nodes: [diner, lb, { ...lbs, status: 'active' }, { ...cache, status: 'ok', badge: 'hit rate 98%' }, replicas, db, { ...job, status: 'active' }],
        links: [
          ...readLinks,
          { from: 'lbs', to: 'cache' },
          { from: 'lbs', to: 'replicas', style: 'dashed' },
          { from: 'db', to: 'replicas', label: 'replication' },
          { from: 'job', to: 'db', style: 'faint' },
          { from: 'job', to: 'cache', style: 'faint' },
        ],
        flows: [
          { path: ['diner', 'lb', 'lbs'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['lbs', 'cache'], tone: 'request', label: 'GET geo:5:dp3wj + 8', duration: 1, delay: 1.2 },
          { path: ['cache', 'lbs'], tone: 'response', label: 'ids', duration: 1, delay: 2.3 },
          { path: ['db', 'replicas'], tone: 'data', duration: 1.4, delay: 0.5 },
          { path: ['job', 'cache'], tone: 'data', label: 'nightly rebuild', duration: 1.6, delay: 3 },
        ],
        caption: 'Redis answers almost every search, the database rests',
      },
      code: {
        language: 'python',
        title: 'Read path: cell lists from Redis, details by id',
        source: `def nearby_cached(lat, lng, radius_m, limit=20):
    p = precision_for(radius_m)
    center = gh.encode(lat, lng, precision=p)
    cells = [center] + gh.neighbors(center)
    keys = [f"geo:{p}:{c}" for c in cells]

    ids = []
    for key, members in zip(keys, r.mget(keys)):   # one round trip
        if members is None:                          # rare miss
            members = load_cell_from_replica(key)   # and refill
        ids += json.loads(members)

    places = [r.hgetall(f"biz:{i}") for i in ids]   # pipelined in practice
    hits = [(dist_m(lat, lng, float(b["lat"]), float(b["lng"])), b) for b in places]
    return sorted((h for h in hits if h[0] <= radius_m), key=lambda h: h[0])[:limit]`,
        highlight: [5, 8, 9, 10, 15],
      },
    },
    {
      title: 'Region outage',
      tag: 'case',
      heading: 'Case: the US region goes dark',
      eli5: 'Each city has its own **information desk** with full copies of the folders. When one desk closes for a storm, tourists are sent to the next town\'s desk. It is a longer walk, but they still get an answer.',
      body: [
        'Diners are everywhere, so we run the search tier, Redis and read replicas in several regions (see the multi-region lesson) and let **GeoDNS** send each phone to the closest one. The whole dataset is a few hundred GB and changes daily, so every region keeps a full copy. Writes still go to one primary; a day of lag for edits was already accepted.',
        'Then the US region loses power. Health checks fail, GeoDNS stops returning the US address, and Chicago traffic moves to the EU region. Searches get slower, from about 25 ms to about 120 ms because of the ocean, yet they all succeed, because the EU region holds every business in the world.',
        'This only works if each region has headroom for a neighbor\'s traffic. Plan each region for its own peak plus the largest region it may absorb, and drill the failover. Some countries also require that certain data stays inside their borders, which can limit what each region may store.',
      ],
      keyIdea: 'Read-only data that fits in every region turns a region outage into a latency bump.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '120 ms (failover)', db: '~300/s' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...dinerUs, status: 'active' },
          dinerEu,
          { ...dns, status: 'active', badge: 'US unhealthy' },
          { ...lbsUs, status: 'down' },
          { ...cacheUs, status: 'down' },
          { ...repUs, status: 'down' },
          { ...lbsEu, status: 'hot', badge: 'serving both' },
          { ...cacheEu, status: 'ok' },
          { ...repEu, status: 'ok' },
        ],
        links: [
          { from: 'dinerUs', to: 'lbsEu', style: 'dashed', label: '+90 ms' },
          { from: 'dinerEu', to: 'lbsEu' },
          { from: 'lbsUs', to: 'cacheUs', style: 'faint' },
          { from: 'lbsUs', to: 'repUs', style: 'faint' },
          { from: 'lbsEu', to: 'cacheEu' },
          { from: 'lbsEu', to: 'repEu' },
        ],
        flows: [
          { path: ['dinerUs', 'dns'], tone: 'handshake', label: 'where?', duration: 1 },
          { path: ['dns', 'dinerUs'], tone: 'response', label: 'EU', duration: 1, delay: 1.1 },
          { path: ['dinerUs', 'lbsEu'], tone: 'request', duration: 1.4, delay: 2.2 },
          { path: ['dinerEu', 'lbsEu'], tone: 'request', count: 2, duration: 1.2, delay: 0.5 },
          { path: ['lbsEu', 'cacheEu', 'lbsEu'], tone: 'response', duration: 1.2, delay: 3.6 },
        ],
        caption: 'GeoDNS moves Chicago to the surviving region',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A spatial index, then copies everywhere',
      eli5: 'Cut the wall map into **folders** by area, always open the neighbors too, keep copies of busy folders on the counter, and put a full set in every town.',
      body: [
        'A lat and lng range query scans two strips of the planet, so spatial search needs an index that maps 2D points to cells. A fixed grid is simple but uneven. **Geohash** gives prefix-friendly strings that a plain B-tree can search, as long as you read the 8 neighbor cells. A **quadtree** adapts to density in RAM, and **S2** covers arbitrary shapes with ordered cell ids.',
        'Because businesses change rarely, we chose geohash, cached per-cell id lists in Redis, rebuilt them nightly, read misses from replicas, and copied the whole dataset to every region. Search p99 went from 2.4 s to about 25 ms, and database reads fell from 17,000 to about 300 per second.',
      ],
      keyIdea: 'Solve the spatial query with cells, then use the read-heavy, slow-changing nature of the data to cache and replicate without fear.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '25 ms', db: '~300/s' },
      scene: {
        nodes: [diner, owner, lb, lbs, biz, { ...cache, status: 'ok' }, replicas, db, job],
        links: [
          ...readLinks,
          { from: 'owner', to: 'biz' },
          { from: 'biz', to: 'db' },
          { from: 'lbs', to: 'cache' },
          { from: 'lbs', to: 'replicas', style: 'dashed' },
          { from: 'db', to: 'replicas' },
          { from: 'job', to: 'cache', style: 'faint' },
        ],
        flows: [
          { path: ['diner', 'lb', 'lbs', 'cache', 'lbs', 'lb', 'diner'], tone: 'response', count: 3, duration: 2.6 },
          { path: ['owner', 'biz', 'db', 'replicas'], tone: 'data', duration: 2.2, delay: 1 },
        ],
      },
      quiz: {
        question: 'Owners edit about 100 listings per second and accept a one-day delay. Search runs at 17,000 per second. Which caching plan fits best?',
        options: [
          'No cache: query the primary database for every search',
          'Per-geohash id lists in Redis, rebuilt by a nightly job, with misses read from replicas',
          'Write-back cache so owner edits are acknowledged faster',
          'Invalidate every cell key on every edit, with a 1-second TTL',
        ],
        answer: 1,
        explain: 'Reads dominate and the business data may lag by a day, so precomputed cell lists refreshed nightly keep Redis hit rates high with no invalidation traffic. A 1-second TTL would throw away most of the cache, and write-back adds risk for no benefit.',
      },
    },
  ],
};
