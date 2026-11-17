import type { Lesson, SceneLink, SceneNode, SceneZone } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const diner: SceneNode = { id: 'diner', kind: 'phone', at: at(-5, -3.5), label: 'diner', sub: 'coffee within 1 km' };
const owner: SceneNode = { id: 'owner', kind: 'client', at: at(-5, 3.5), label: 'owner', sub: 'edits listing' };
const search: SceneNode = { id: 'search', kind: 'block', at: at(0, -3.5), label: 'search service', sub: 'stateless, read-only', icon: 'Search', tint: 'blue' };
const biz: SceneNode = { id: 'biz', kind: 'block', at: at(0, 3.5), label: 'business service', sub: 'CRUD, ~100 writes/s peak', icon: 'Utensils', tint: 'amber' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5, 0), label: 'business DB', sub: '200M rows' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(5, -7), label: 'Redis', sub: 'keyed by geohash' };
const replicas: SceneNode = { id: 'replicas', kind: 'replica', at: at(5, 7), label: 'read replicas', sub: 'x3' };
const job: SceneNode = { id: 'job', kind: 'worker', at: at(0, 3.5), label: 'nightly sync', sub: 'rebuilds cache' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const dns: SceneNode = { id: 'dns', kind: 'dns', at: at(0, -4), label: 'GeoDNS', sub: 'nearest region' };
const dinerUs: SceneNode = { id: 'dinerUs', kind: 'phone', at: at(-6, 0), label: 'diner', sub: 'Chicago' };
const dinerEu: SceneNode = { id: 'dinerEu', kind: 'phone', at: at(6, 0), label: 'diner', sub: 'Paris' };
const stackUs: SceneNode = { id: 'stackUs', kind: 'block', at: at(-3, 4), label: 'search US', sub: 'Redis + replicas', icon: 'Server', tint: 'blue' };
const stackEu: SceneNode = { id: 'stackEu', kind: 'block', at: at(3, 4), label: 'search EU', sub: 'Redis + replicas', icon: 'Server', tint: 'violet' };
const zoneUs: SceneZone = { id: 'us', from: [-3.5, 1.5], to: [-0.2, 6.5], label: 'us-east', tone: 'blue' };
const zoneEu: SceneZone = { id: 'eu', from: [3.5, -1.5], to: [6.8, 3.5], label: 'eu-west', tone: 'violet' };

const SQL_BOX = `CREATE INDEX idx_lat ON business (lat);
CREATE INDEX idx_lng ON business (lng);

-- ~1 km box around the diner in Chicago
SELECT id, name, lat, lng
FROM business
WHERE lat BETWEEN 41.871 AND 41.889   -- band around the whole planet
  AND lng BETWEEN -87.642 AND -87.618 -- band from pole to pole
LIMIT 50;

-- idx_lat finds every row in the latitude band,
-- idx_lng finds every row in the longitude band,
-- and the database intersects two big sets to keep a few dozen.`;

const PY_NEARBY = `import geohash2 as gh          # encode / neighbors helpers
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
    return 2 * 6_371_000 * asin(sqrt(h))`;

const PY_CACHED = `def nearby_cached(lat, lng, radius_m, limit=20):
    p = precision_for(radius_m)
    center = gh.encode(lat, lng, precision=p)
    cells = [center] + gh.neighbors(center)
    keys = [f"geo:{p}:{c}" for c in cells]

    points = []                                      # (id, lat, lng) tuples
    for key, members in zip(keys, r.mget(keys)):   # one round trip
        if members is None:                          # rare miss
            members = load_cell_from_replica(key)   # and refill
        points += json.loads(members)

    hits = [(dist_m(lat, lng, la, ln), i) for i, la, ln in points]
    top = sorted(h for h in hits if h[0] <= radius_m)[:limit]
    return [r.hgetall(f"biz:{i}") for _, i in top]   # details for 20 only`;

export const designProximityService: Lesson = {
  id: 'design-proximity-service',
  title: 'Design a proximity service',
  tagline: 'Find the restaurants within a radius of a moving phone, fast, for 100 million people a day.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Requirements and the back-of-envelope numbers for a read-heavy map service',
    'Why a plain latitude and longitude range query scans far too many rows',
    'Geospatial indexes: fixed grid, geohash, quadtree, Google S2 and Uber H3',
    'The geohash boundary problem, the nine-cell query and widening a sparse search',
    'Choosing an index, then caching by geohash, replicas, multi-region and failover',
  ],
  metrics: [
    { key: 'qps', label: 'Peak search QPS', icon: 'Activity' },
    { key: 'rows', label: 'Rows read per search', icon: 'Table' },
    { key: 'p99', label: 'Search p99', icon: 'Timer' },
    { key: 'db', label: 'DB reads/s', icon: 'Database' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'What is near me, right now?',
      eli5: 'A tourist walks up to the **information desk** and asks for a cafe within a short walk. The clerk has a filing cabinet with every shop in the country and must answer in a blink.',
      body: [
        'A diner opens the app and asks for restaurants within 0.5, 1, 2 or 5 km. Results come back nearest first, with name, rating and distance.',
        'Business owners add or edit a listing, and it is fine if the change shows up the next day. Searches must answer within **200 ms** at p99.',
      ],
      keyIdea: 'Read-heavy, rarely changing data means we can precompute, cache and copy freely. The hard part is the spatial query itself.',
      metrics: { qps: '?', rows: '-', p99: 'goal < 200 ms', db: '-' },
      scene: {
        nodes: [diner, { ...search, status: 'active' }, { ...db, badge: '200M businesses' }],
        links: [link('diner', 'search'), link('search', 'db')],
        flows: [
          { path: ['diner', 'search'], tone: 'request', label: 'near (lat, lng), 1 km', duration: 1.6 },
          { path: ['search', 'db'], tone: 'request', label: 'who is close?', duration: 1, delay: 1.6 },
          { path: ['db', 'search', 'diner'], tone: 'response', label: '20 places', duration: 1.8, delay: 2.7 },
        ],
        panel: {
          title: 'Functional needs',
          icon: 'List',
          rows: [
            { text: 'Radius options', value: '0.5, 1, 2, 5 km' },
            { text: 'Result order', value: 'nearest first' },
            { text: 'Owner edits', value: 'next day is fine' },
            { text: 'Latency goal', value: 'p99 < 200 ms', tone: 'good' },
          ],
        },
        caption: 'A phone asks, the nearest 20 places come back',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: 'The numbers: 17,000 searches a second',
      eli5: 'Imagine a hundred million tourists a day, each asking the **clerk** five questions. The clerk is busy all day, and almost nobody asks to change what is in the cabinet.',
      body: [
        '**100M daily users** run about 5 searches each: 500M a day, around 5,800 per second on average and about **17,000 per second** at peak.',
        'There are **200M businesses** at about 1 KB each, so the table is roughly 200 GB. Edits average about 10 per second (under 1M a day, well under 1% of listings) and peak near 100.',
      ],
      keyIdea: 'On average reads outnumber writes by hundreds to 1 (5,800 vs 10 per second), so the design should favor reads everywhere.',
      metrics: { qps: '17,000/s', rows: '-', p99: 'goal < 200 ms', db: '-' },
      metricTones: { qps: 'warn' },
      scene: {
        nodes: [diner, { ...search, status: 'hot', load: 70, chips: ['GET /search/nearby'] }, { ...db, badge: '200 GB' }],
        links: [link('diner', 'search', { label: '17,000 / s at peak' }), link('search', 'db')],
        flows: [{ path: ['diner', 'search', 'db'], tone: 'request', count: 5, duration: 1.4 }],
        panel: {
          title: 'Back of the envelope',
          icon: 'Gauge',
          rows: [
            { text: 'Searches per day', value: '500M' },
            { text: 'Average QPS', value: '5,800' },
            { text: 'Peak QPS', value: '17,000', tone: 'warn' },
            { text: 'Businesses', value: '200M' },
            { text: 'Table size', value: '~200 GB' },
            { text: 'Edits per second', value: '~10 avg, 100 peak', tone: 'good' },
          ],
        },
        caption: 'Heavy reads, a trickle of writes',
      },
    },
    {
      title: 'Search API',
      tag: 'concept',
      heading: 'One read call, with a cursor',
      eli5: 'The tourist hands the clerk a small slip with where they stand and how far they will walk. The clerk hands back the first page of shops and a bookmark for the next page.',
      body: [
        'The read API is one call: `GET /v1/search/nearby?lat=41.88&lng=-87.63&radius=1000`. It returns a page of business ids, names, distances and a cursor for the next page.',
        'Radius is capped at 5 km, and results are sorted by distance. Detail pages call `GET /v1/businesses/{id}` separately.',
      ],
      keyIdea: 'A paged, distance-sorted nearby call plus a separate detail call keeps each response small.',
      metrics: { qps: '17,000/s', rows: '-', p99: 'goal < 200 ms', db: '-' },
      scene: {
        nodes: [diner, { ...search, status: 'active', chips: ['GET /search/nearby'] }],
        links: [link('diner', 'search', { arrow: 'both' })],
        flows: [
          { path: ['diner', 'search'], tone: 'request', label: 'lat, lng, radius', duration: 1.4 },
          { path: ['search', 'diner'], tone: 'response', label: '20 + cursor', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Nearby response',
          icon: 'FileJson',
          code: '{\n  "results": [\n    {"id": 7, "name": "Blue Door Cafe",\n     "distance_m": 180, "rating": 4.6}\n  ],\n  "next_cursor": "c9f2"\n}',
          footer: { text: 'Radius capped at 5 km', tone: 'muted' },
        },
        caption: 'Small pages, nearest first',
      },
    },
    {
      title: 'Two services',
      tag: 'concept',
      heading: 'Split reads from writes',
      eli5: 'There are two windows at the desk. One answers **where is a cafe** questions all day. The other takes the rare form from a shop owner who changed their hours.',
      body: [
        'The **search service** is stateless and read-only, so it scales by adding copies behind a load balancer. The **business service** handles `POST`, `PUT` and `DELETE` on `/v1/businesses` at about 10 writes per second on average (100 at peak) and owns the database.',
        'Split them so the hot read path and the slow write path scale on their own.',
      ],
      keyIdea: 'Separate the hot, read-only search path from the slow write path so each can scale on its own.',
      metrics: { qps: '17,000/s', rows: '-', p99: 'goal < 200 ms', db: '-' },
      scene: {
        nodes: [diner, owner, { ...search, status: 'active' }, { ...biz, status: 'active' }, db],
        links: [link('diner', 'search'), link('owner', 'biz'), link('search', 'db'), link('biz', 'db')],
        flows: [
          { path: ['diner', 'search', 'db'], tone: 'request', label: 'GET /search/nearby', count: 4, duration: 1.8 },
          { path: ['owner', 'biz'], tone: 'request', label: 'PUT /businesses/7', duration: 1.6, delay: 0.6 },
          { path: ['biz', 'db'], tone: 'data', label: 'UPDATE', duration: 1, delay: 2.3 },
        ],
        caption: 'Many reads on top, a trickle of writes below',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'A business table and a geo index',
      eli5: 'The cabinet has one drawer with a full card per shop, and a second thin drawer that only says which shops sit in which area. Searching only opens the thin drawer.',
      body: [
        'The `business` table holds id, name, address, lat, lng, category and rating. A separate **geo index** answers one question: which business ids sit in this area.',
        'Keeping the index apart means it can be tiny, cached and rebuilt without touching the full rows.',
      ],
      keyIdea: 'Keep a small geo index of ids and coordinates apart from the full business rows.',
      metrics: { qps: '17,000/s', rows: '-', p99: 'goal < 200 ms', db: '-' },
      scene: {
        nodes: [{ ...search, status: 'active' }, { ...db, status: 'ok', badge: 'business + geo_index' }, biz],
        links: [link('search', 'db'), link('biz', 'db')],
        flows: [{ path: ['search', 'db', 'search'], tone: 'request', label: 'ids in this area?', duration: 2 }],
        panel: {
          title: 'Two tables',
          icon: 'Table',
          rows: [
            { text: 'business', value: 'id, name, lat, lng, rating' },
            { text: 'geo_index', value: 'cell, business_id' },
            { text: 'business size', value: '~200 GB' },
            { text: 'geo_index size', value: 'a few GB', tone: 'good' },
          ],
        },
        caption: 'Fat rows below, a thin index beside them',
      },
    },
    {
      title: 'Naive query',
      tag: 'problem',
      heading: 'Why a latitude and longitude range is slow',
      eli5: 'The clerk first pulls every shop on the same east-west street line as the tourist, then every shop on the same north-south line, and only then looks for shops on both lists. Two huge piles for a handful of answers.',
      body: [
        'The first idea: ask for rows with `lat BETWEEN` two values and `lng BETWEEN` two values, with an index on each column. It returns the right answer. It is just very slow.',
        'A B-tree orders rows along one dimension. The `lat` index finds a band that wraps the planet, the `lng` index a band from pole to pole, and the database intersects two big sets.',
      ],
      keyIdea: 'A one-dimensional index cannot answer a two-dimensional question without scanning a whole strip of the world.',
      metrics: { qps: '17,000/s', rows: '~50,000', p99: '2,400 ms', db: '17,000/s' },
      metricTones: { rows: 'bad', p99: 'bad', db: 'bad' },
      scene: {
        nodes: [diner, { ...search, status: 'hot', load: 95, chips: [{ text: 'waiting on DB', tone: 'warn' }] }, { ...db, status: 'hot', load: 98, badge: 'scanning two bands' }],
        links: [link('diner', 'search'), link('search', 'db', { label: 'lat BETWEEN, lng BETWEEN', labelTone: 'warn' })],
        flows: [
          { path: ['diner', 'search'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['search', 'db'], tone: 'request', count: 5, duration: 1.2, delay: 1.2 },
          { path: ['db', 'search'], tone: 'error', label: 'timeout', duration: 2.4, delay: 2.6 },
        ],
        caption: 'Each search intersects two strips of the planet',
      },
      code: { language: 'sql', title: 'The box query and why its indexes do not help', source: SQL_BOX, highlight: [7, 8, 11, 12, 13] },
    },
    {
      title: 'Composite index',
      tag: 'problem',
      heading: 'A composite index does not rescue it',
      eli5: 'Sorting the cabinet by street first and number second helps only when you know the street. The tourist wants every street within a short walk, so the clerk still flips through whole streets.',
      body: [
        'An index on `(lat, lng)` barely helps. A range on the first column stops the second column from narrowing the scan, so the database still walks the whole latitude band.',
        'At 17,000 searches per second, each touching tens of thousands of rows, the database is lost. We need an index that understands two dimensions at once.',
      ],
      keyIdea: 'Combining two columns in one B-tree still sorts by only one of them first.',
      metrics: { qps: '17,000/s', rows: '~30,000', p99: '1,800 ms', db: '17,000/s' },
      metricTones: { rows: 'bad', p99: 'bad', db: 'bad' },
      scene: {
        nodes: [{ ...search, status: 'hot', load: 90 }, { ...db, status: 'hot', load: 96, badge: 'idx (lat, lng)' }],
        links: [link('search', 'db', { label: 'range on lat first', labelTone: 'warn' })],
        flows: [{ path: ['search', 'db'], tone: 'request', count: 5, duration: 1.3 }],
        panel: {
          title: 'What the scan sees',
          icon: 'Table',
          rows: [
            { text: 'lat in band', value: '~30,000 rows', tone: 'bad' },
            { text: 'then filter lng', value: 'row by row', tone: 'warn' },
            { text: 'rows we wanted', value: '~40', tone: 'good' },
          ],
          footer: { text: 'Cell ids turn 2D into 1D', tone: 'muted' },
        },
        caption: 'The second column cannot narrow a range scan',
      },
    },
    {
      title: 'Grid cells',
      tag: 'concept',
      heading: 'Cut the map into cells: the fixed grid',
      eli5: 'The clerk pins a map on the wall and draws equal squares over it. Each square gets a **folder** of the shops inside it, so a question only opens one or two folders.',
      body: [
        'Every spatial index turns two dimensions into a cell id, then looks up cells instead of scanning rows. The simplest is an **evenly divided grid**: fixed 1 km squares, each business stored under its square id.',
        'A search reads the diner\'s square and its neighbors, then computes exact distances for the few hundred rows it gets back.',
      ],
      keyIdea: 'Mapping 2D points to cell ids is the core move. A fixed grid does it simply.',
      metrics: { qps: '17,000/s', rows: '~300 to 5,000', p99: '300 ms', db: '17,000/s' },
      metricTones: { rows: 'warn', p99: 'warn' },
      scene: {
        nodes: [diner, { ...search, status: 'active', chips: ['cell (412, 87)'] }, { ...db, status: 'active', badge: 'cell id index' }],
        links: [link('diner', 'search'), link('search', 'db', { label: 'cells around (412, 87)' })],
        flows: [
          { path: ['diner', 'search'], tone: 'request', duration: 1.2 },
          { path: ['search', 'db'], tone: 'request', duration: 1.2, delay: 1.2 },
          { path: ['db', 'search', 'diner'], tone: 'response', duration: 1.6, delay: 2.5 },
        ],
        caption: 'Fewer rows than a range scan',
      },
    },
    {
      title: 'Grid flaw',
      tag: 'problem',
      heading: 'One cell size cannot fit a city and an ocean',
      eli5: 'A square on the wall map covering downtown holds a thousand shops, while a square over the lake holds none. The clerk wants small squares downtown and one big square for the lake.',
      body: [
        'A square in central Tokyo might hold thousands of businesses while one in the Pacific holds none.',
        'Big cells drown dense cities. Small cells waste billions of empty ids on oceans and deserts. We want cells that shrink where businesses crowd together.',
      ],
      keyIdea: 'Uneven density breaks any single cell size.',
      metrics: { qps: '17,000/s', rows: '0 to 5,000', p99: '300 ms', db: '17,000/s' },
      metricTones: { rows: 'bad' },
      scene: {
        nodes: [{ ...search, status: 'active' }, { ...db, status: 'hot', load: 88, badge: 'downtown cell' }],
        links: [link('search', 'db')],
        flows: [{ path: ['search', 'db'], tone: 'request', count: 3, duration: 1.2 }],
        panel: {
          title: 'Same cell size, two places',
          icon: 'Table',
          rows: [
            { text: 'Downtown Tokyo, 1 km cell', value: '5,000 rows', tone: 'bad' },
            { text: 'Mid-Pacific, 1 km cell', value: '0 rows', tone: 'muted' },
            { text: 'Suburb, 1 km cell', value: '300 rows', tone: 'good' },
          ],
        },
        caption: 'Dense cells stay heavy, empty cells waste space',
      },
    },
    {
      title: 'Geohash',
      tag: 'concept',
      heading: 'Geohash: a cell id you can shorten',
      eli5: 'The clerk splits the map in half again and again, writing a letter for each choice. A short **code** names a big area and a longer code names a small corner inside it, so similar codes usually mean nearby places.',
      body: [
        'A **geohash** halves the longitude range, then the latitude range, again and again, recording one bit per split. The interleaved bits are written in base32, so `9q8yy` is a cell and `9q8yyk` is one of 32 smaller cells inside it.',
        'Length 5 is about 4.9 km square, length 6 about 1.2 km by 0.6 km.',
      ],
      keyIdea: 'Geohash turns a location into a string where a shared prefix means a shared area.',
      metrics: { qps: '17,000/s', rows: '-', p99: '-', db: '-' },
      scene: {
        nodes: [diner, { ...search, status: 'active', chips: ['41.88, -87.63'] }, { ...db, badge: 'geohash column' }],
        links: [link('diner', 'search'), link('search', 'db', { style: 'faint' })],
        flows: [{ path: ['diner', 'search'], tone: 'request', label: '41.88, -87.63', duration: 1.4 }],
        panel: {
          title: 'Same spot, longer hash',
          icon: 'Hash',
          rows: [
            { text: 'length 4', value: 'dp3w   ~39 km' },
            { text: 'length 5', value: 'dp3wj  ~4.9 km' },
            { text: 'length 6', value: 'dp3wjz ~1.2 km' },
          ],
          footer: { text: 'Each longer hash starts with its parent', tone: 'muted' },
        },
        caption: 'Every extra character zooms in on a smaller cell',
      },
    },
    {
      title: 'Prefix index',
      tag: 'concept',
      heading: 'A normal B-tree can search by prefix',
      eli5: 'Because every folder label starts with its bigger area, the clerk can ask for everything that starts with the first few letters. The cabinet is already sorted that way.',
      body: [
        'A longer hash always starts with the hash of its parent, so a prefix query on an ordinary B-tree finds every business in a cell: `WHERE geohash LIKE \'dp3wj%\'`.',
        'The index is a small table of `(geohash, business_id)` rows, about 40 bytes each, so 200M businesses fit in around **8 GB**. A business that moves just gets a new hash string.',
      ],
      keyIdea: 'Prefix-friendly strings let any database act as a spatial index, with cheap updates.',
      metrics: { qps: '17,000/s', rows: '-', p99: '-', db: '-' },
      scene: {
        nodes: [{ ...search, status: 'active' }, { ...db, status: 'ok', badge: 'geohash index 8 GB' }],
        links: [link('search', 'db', { label: "LIKE 'dp3wj%'" })],
        flows: [
          { path: ['search', 'db'], tone: 'request', label: 'prefix scan', duration: 1.2 },
          { path: ['db', 'search'], tone: 'response', label: '~45 ids', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'geo_index rows',
          icon: 'Table',
          rows: [
            { text: 'dp3wjk2', value: 'biz 7' },
            { text: 'dp3wjk5', value: 'biz 91' },
            { text: 'dp3wjm0', value: 'biz 342' },
            { text: '200M rows x 40 B', value: '~8 GB', tone: 'good' },
          ],
        },
        caption: 'One sorted index, one prefix scan per cell',
      },
    },
    {
      title: 'Nearby search',
      tag: 'concept',
      heading: 'Search nine cells, then measure real distance',
      eli5: 'The clerk opens the tourist\'s own folder plus the eight folders around it, then uses a ruler on each shop to keep only the ones within walking distance.',
      body: [
        'Pick the longest hash whose cell is at least as large as the radius (length 5 for 1 km). Take the diner\'s cell plus its 8 neighbors, fetch those ids, and compute the true distance to each.',
        'Cells are squares and the radius is a circle, so the exact distance filter is required. Candidate counts grow with the radius: length 4 cells are about 39 km wide, so a 5 km search in a dense city reads a huge list. That is the bad case for length 4, so cap large radii or cover them with a 5 by 5 block of length-5 cells.',
      ],
      keyIdea: 'Geohash narrows the candidates cheaply, and an exact distance check finishes the job.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '60 ms', db: '17,000/s' },
      metricTones: { rows: 'good', p99: 'good' },
      scene: {
        nodes: [diner, { ...search, status: 'active', chips: ['dp3wj + 8 neighbors'] }, { ...db, status: 'ok', badge: 'geohash index 8 GB' }],
        links: [link('diner', 'search'), link('search', 'db')],
        flows: [
          { path: ['diner', 'search'], tone: 'request', label: '41.88, -87.63', duration: 1.2 },
          { path: ['search', 'db'], tone: 'request', label: '9 prefix scans', duration: 1, delay: 1.3 },
          { path: ['db', 'search'], tone: 'response', label: '~400 ids', duration: 1, delay: 2.4 },
          { path: ['search', 'diner'], tone: 'response', label: 'nearest 20', duration: 1.2, delay: 3.5 },
        ],
        panel: {
          title: 'Candidates by radius',
          icon: 'Table',
          rows: [
            { text: '1 km, length 5', value: '~400 rows', tone: 'good' },
            { text: '5 km, length 4', value: 'huge in a city', tone: 'bad' },
            { text: 'Fix', value: 'cap radius or 5x5 length-5 cells', tone: 'warn' },
          ],
        },
        caption: 'Nine small prefix scans replace two planet-wide bands',
      },
      code: { language: 'python', title: 'Nearby search on a geohash index', source: PY_NEARBY, highlight: [6, 10, 11, 14, 17] },
    },
    {
      title: 'Edge cases',
      tag: 'case',
      heading: 'Case: the cafe across the street is missing',
      eli5: 'A tourist stands right on the line between two squares on the wall map. The cafe across the road sits in the next square, so the clerk must always open the neighboring **folders** too.',
      body: [
        'Two businesses ten meters apart can land in different cells, and the shared prefix can even be empty: points on either side of the equator or the prime meridian are neighbors on the ground but share no prefix.',
        'A shared prefix means close. Close does not mean a shared prefix. So always read the **center cell plus its 8 neighbors**, found by geometry, never by trimming characters.',
      ],
      keyIdea: 'Shared prefix implies nearby, but nearby does not imply shared prefix. Always query the neighbor cells.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '60 ms', db: '17,000/s' },
      scene: {
        nodes: [{ ...diner, chips: [{ text: 'on a cell edge', tone: 'warn' }] }, { ...search, status: 'active' }, { ...db, status: 'ok' }],
        links: [link('diner', 'search'), link('search', 'db')],
        flows: [
          { path: ['search', 'db'], tone: 'request', label: 'center cell only', duration: 1.1 },
          { path: ['db', 'search'], tone: 'error', label: 'cafe missed', duration: 1.1, delay: 1.2 },
          { path: ['search', 'db'], tone: 'request', label: '9 cells', duration: 1.1, delay: 2.5 },
          { path: ['db', 'search', 'diner'], tone: 'response', label: 'cafe found', duration: 1.6, delay: 3.7 },
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
      title: 'Too few results',
      tag: 'case',
      heading: 'Case: a village with two cafes',
      eli5: 'In a tiny village the nine folders hold only two shops. The clerk swaps to bigger folders that cover more land and looks again, up to a limit.',
      body: [
        'In a village, nine length-5 cells may return two places within 1 km. Drop one character to use length 4 cells, and relax the radius too (to 5 km): nothing close enough, so here are the nearest places within 5 km. The exact-distance filter uses the widened radius, otherwise the extra hits would be thrown away.',
        'Stop after a set number of widenings, then return what exists. Never keep widening forever.',
      ],
      keyIdea: 'If a search finds too few results, widen the cells and the radius step by step, with a hard stop.',
      metrics: { qps: '17,000/s', rows: '2, then ~31', p99: '90 ms', db: '17,000/s' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [{ ...search, status: 'active', chips: [{ text: 'length 5: 2 hits', tone: 'warn' }, 'length 4, 5 km: 31 hits'] }, { ...db, status: 'ok' }],
        links: [link('search', 'db', { arrow: 'both' })],
        flows: [
          { path: ['search', 'db'], tone: 'request', label: 'length 5', duration: 1.1 },
          { path: ['db', 'search'], tone: 'error', label: 'only 2', duration: 1.1, delay: 1.2 },
          { path: ['search', 'db'], tone: 'request', label: 'length 4, 5 km', duration: 1.1, delay: 2.5 },
          { path: ['db', 'search'], tone: 'response', label: '31 places within 5 km', duration: 1.1, delay: 3.7 },
        ],
        panel: {
          title: 'Widening rule',
          icon: 'Route',
          rows: [
            { text: 'Start', value: 'length 5, radius 1 km' },
            { text: 'Under 20 hits', value: 'length 4, radius 5 km' },
            { text: 'Distance filter', value: 'uses widened radius' },
            { text: 'Hard stop', value: '2 widenings', tone: 'warn' },
          ],
        },
        caption: 'Widen once, twice, then return what exists',
      },
    },
    {
      title: 'Quadtree',
      tag: 'concept',
      heading: 'Quadtree: cells that split where it is crowded',
      eli5: 'Instead of equal squares, the clerk cuts any square with too many shops into four smaller ones, and keeps cutting. Busy downtown ends up with tiny squares and the empty lake keeps one big **square**.',
      body: [
        'A **quadtree** starts with the whole world as one node and splits any node holding more than, say, 100 businesses into four children. Dense downtowns get deep, small leaves and oceans stay one big leaf.',
        'A search walks down to the diner\'s leaf and widens to neighboring leaves until it has enough results, which also makes a k-nearest query easy.',
      ],
      keyIdea: 'A quadtree adapts cell size to density and finds the k nearest well.',
      metrics: { qps: '17,000/s', rows: '~100 per leaf', p99: '40 ms', db: 'startup only' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [diner, { ...search, status: 'active', chips: ['quadtree in RAM'], badge: '~2M leaves' }, { ...db, status: 'dim', badge: 'read once at boot' }],
        links: [link('diner', 'search'), link('db', 'search', { style: 'dashed', label: 'load at startup' })],
        flows: [
          { path: ['db', 'search'], tone: 'data', label: '200M points', count: 3, duration: 1.6 },
          { path: ['diner', 'search'], tone: 'request', duration: 1.2, delay: 1.8 },
          { path: ['search', 'diner'], tone: 'response', label: 'from memory', duration: 1.2, delay: 3.1 },
        ],
        caption: 'The index lives inside each search server',
      },
    },
    {
      title: 'Quadtree cost',
      tag: 'tradeoff',
      heading: 'What a quadtree costs to run',
      eli5: 'The clerk\'s fancy cut-up map lives in their head, so a new clerk needs a long time to learn it. Changing it while customers wait is awkward, so it gets redrawn overnight.',
      body: [
        'With 200M businesses and 100 per leaf there are about 2M leaves. Ids and node overhead come to a few GB, which fits in one server\'s RAM.',
        'Building it takes minutes, so a fresh server is not ready right away and you must not restart the whole fleet at once. Live updates need locking, so most teams rebuild nightly and swap it in.',
      ],
      keyIdea: 'A quadtree trades operational ease for adaptive cells: RAM use, slow startup and slow updates.',
      metrics: { qps: '17,000/s', rows: '~100 per leaf', p99: '40 ms', db: 'startup only' },
      scene: {
        nodes: [{ ...search, status: 'hot', load: 40, badge: 'building tree' }, { ...db, status: 'active' }],
        links: [link('db', 'search', { label: 'load 200M points', labelTone: 'warn' })],
        flows: [{ path: ['db', 'search'], tone: 'data', count: 4, duration: 1.4 }],
        panel: {
          title: 'Quadtree in numbers',
          icon: 'Layers',
          rows: [
            { text: 'Leaves', value: '~2M' },
            { text: 'Memory', value: 'a few GB' },
            { text: 'Cold build time', value: 'minutes', tone: 'warn' },
            { text: 'Rolling restart', value: 'a few servers at a time', tone: 'warn' },
          ],
        },
        caption: 'Fast to query, slow to warm up',
      },
    },
    {
      title: 'S2 and H3',
      tag: 'concept',
      heading: 'S2 and H3: cells on a sphere',
      eli5: 'A globe is round, so flat squares stretch near the poles. Special map makers cover the globe with ordered tiles instead, and can name any blob of land as a short list of tiles.',
      body: [
        '**S2**, from Google, projects the sphere onto the six faces of a cube and numbers cells along a Hilbert curve, so cells close on the ground usually get close 64-bit ids.',
        'Its region coverer describes any circle or polygon as a small set of mixed-size cells, which suits geofencing. Uber\'s H3 uses hexagons. Both need a library you must learn.',
      ],
      keyIdea: 'S2 and H3 give uniform cells and arbitrary region covers, at the price of a library.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '60 ms', db: '17,000/s' },
      scene: {
        nodes: [
          { ...search, status: 'active' },
          { id: 's2', kind: 'block', at: at(5, -3.5), label: 'S2 cells', sub: 'Hilbert curve ids', icon: 'Globe', tint: 'teal', status: 'active' },
          { id: 'h3', kind: 'block', at: at(5, 3.5), label: 'H3 hexagons', sub: 'equal-distance rings', icon: 'Earth', tint: 'violet' },
        ],
        links: [link('search', 's2'), link('search', 'h3', { style: 'dashed' })],
        flows: [{ path: ['search', 's2'], tone: 'request', label: 'cover this circle', duration: 1.4 }],
        panel: {
          title: 'Why use them',
          icon: 'Globe',
          rows: [
            { text: 'Cell id', value: '64-bit integer' },
            { text: 'Shapes', value: 'circle, polygon' },
            { text: 'Fits', value: 'delivery zones', tone: 'good' },
            { text: 'Cost', value: 'new library', tone: 'warn' },
          ],
        },
        caption: 'Ordered ids on a sphere',
      },
    },
    {
      title: 'Choosing one',
      tag: 'tradeoff',
      heading: 'Grid, geohash, quadtree or S2?',
      eli5: 'There are many ways to cut the wall map. The clerk picks the one that is easiest to keep up to date, since shops change rarely and the **folders** only need a quick refresh at night.',
      body: [
        'We pick **geohash** in a normal table, cached in Redis. Data changes rarely, the index is 8 GB, prefix queries work in any database, and an update is one row.',
        'A quadtree wins for exact k-nearest or extreme density. S2 wins for arbitrary shapes. A fixed grid only fits even density.',
      ],
      keyIdea: 'Pick the simplest index that handles your density and update rate. For slow-changing businesses, geohash in a plain table is enough.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '60 ms', db: '17,000/s' },
      scene: {
        nodes: [
          { id: 'grid', kind: 'block', at: at(-5, -3.5), label: 'fixed grid', sub: 'uneven cells', icon: 'Table', tint: 'gray', status: 'dim' },
          { id: 'geohash', kind: 'block', at: at(0, -3.5), label: 'geohash', sub: 'prefix strings', icon: 'Hash', tint: 'green', status: 'ok', badge: 'our pick' },
          { id: 'quadtree', kind: 'block', at: at(-5, 3.5), label: 'quadtree', sub: 'in-memory tree', icon: 'Split', tint: 'amber' },
          { id: 's2b', kind: 'block', at: at(0, 3.5), label: 'S2 cells', sub: 'Hilbert ids', icon: 'Globe', tint: 'teal' },
        ],
        panel: {
          title: 'Fit for this system',
          icon: 'Scale',
          rows: [
            { text: 'Fixed grid', value: 'uneven density', tone: 'bad' },
            { text: 'Geohash', value: 'simple, any DB', tone: 'good' },
            { text: 'Quadtree', value: 'RAM, slow rebuild', tone: 'warn' },
            { text: 'S2 / H3', value: 'needs a library', tone: 'warn' },
          ],
        },
        caption: 'Four ways to turn a point into a cell',
      },
    },
    {
      title: 'Cache by cell',
      tag: 'concept',
      heading: 'Cache the id list of every cell',
      eli5: 'The clerk keeps photocopies of the busiest **folders** on the counter, so most questions are answered without walking to the back cabinet.',
      body: [
        'Key `geo:5:dp3wj` holds `(id, lat, lng)` entries for that cell, at lengths 4, 5 and 6: about 16 bytes each, three lists per business, roughly **10 GB** in all. Search reads nine lists, filters and sorts by distance, then fetches `biz:{id}` for only the final 20.',
        'Misses go to **read replicas**. Category can sit in the entry, and rating or open now filter the fetched details.',
      ],
      keyIdea: 'When reads run at thousands per second, precompute per-cell lists and keep them in Redis.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '25 ms', db: '~300/s' },
      metricTones: { p99: 'good', db: 'good' },
      scene: {
        nodes: [diner, { ...search, status: 'active' }, { ...cache, status: 'ok', badge: 'hit rate 98%' }, { ...replicas, status: 'dim' }],
        links: [link('diner', 'search'), link('search', 'cache'), link('search', 'replicas', { style: 'dashed', label: 'miss' })],
        flows: [
          { path: ['diner', 'search'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['search', 'cache'], tone: 'request', label: 'GET geo:5:dp3wj + 8', duration: 1, delay: 1.2 },
          { path: ['cache', 'search'], tone: 'response', label: '(id, lat, lng)', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'Redis keys',
          icon: 'Database',
          rows: [
            { text: 'geo:{len}:{hash}', value: 'list of (id, lat, lng)' },
            { text: 'biz:{id}', value: 'details, final 20 only' },
            { text: 'Category, rating, open now', value: 'entry field or details filter' },
            { text: 'Total for cell lists', value: '~10 GB', tone: 'good' },
          ],
        },
        caption: 'Redis answers almost every search',
      },
      code: { language: 'python', title: 'Read path: cell lists from Redis, details by id', source: PY_CACHED, highlight: [5, 8, 9, 10, 12, 14] },
    },
    {
      title: 'Nightly rebuild',
      tag: 'concept',
      heading: 'Rebuild the cell lists every night',
      eli5: 'Every night a helper refreshes the counter copies from the main cabinet. A shop that closed today still shows up until the next refresh.',
      body: [
        'Owners accept next-day edits, so a **nightly sync** rebuilds the cell lists from the database instead of invalidating keys on every write.',
        'A closed or deleted business stays in results until the next rebuild. We accept a day of lag for closures, or keep a small `closed` set that the search service checks at read time and drops from results.',
      ],
      keyIdea: 'Daily change tolerance lets you rebuild in bulk instead of invalidating on every write.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '25 ms', db: '~300/s' },
      metricTones: { db: 'good' },
      scene: {
        nodes: [{ ...search, status: 'active' }, { ...cache, status: 'ok' }, db, { ...job, status: 'active' }],
        links: [
          link('search', 'cache'),
          link('job', 'db', { style: 'faint' }),
          link('job', 'cache', { style: 'faint' }),
        ],
        flows: [
          { path: ['job', 'db', 'cache'], tone: 'data', label: 'nightly rebuild', duration: 2.2 },
        ],
        panel: {
          title: 'Lag from the rebuild',
          icon: 'Clock',
          rows: [
            { text: 'New or edited listing', value: 'next day' },
            { text: 'Closed or deleted', value: 'next day, or closed set', tone: 'warn' },
          ],
        },
        caption: 'Bulk refresh at night, no per-write invalidation',
      },
    },
    {
      title: 'Replicate, not shard',
      tag: 'tradeoff',
      heading: 'Why 200 GB is replicated, not sharded',
      eli5: 'The whole cabinet fits in one room, so the clerk makes copies of it instead of splitting shops across rooms. Splitting by area would crowd the busy rooms.',
      body: [
        '200 GB fits on one primary with read replicas, so sharding is not needed. Sharding by geohash would also create hotspots, because downtown cells take most of the traffic.',
        'If Redis starts cold or fails, searches fall back to the replicas, which are slower but correct, while the cell lists refill.',
      ],
      keyIdea: 'Data that fits on one machine is copied for reads, and Redis is a cache with a replica fallback.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '25 ms', db: '~300/s' },
      scene: {
        nodes: [{ ...search, status: 'active' }, { ...cache, status: 'down', badge: 'cold start' }, { ...replicas, status: 'ok' }, db],
        links: [link('search', 'cache', { style: 'dashed' }), link('search', 'replicas', { label: 'fallback' }), link('db', 'replicas', { label: 'replication' })],
        flows: [
          { path: ['search', 'replicas'], tone: 'request', label: 'cache cold', duration: 1.2 },
          { path: ['replicas', 'search'], tone: 'response', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Copy, do not split',
          icon: 'Scale',
          rows: [
            { text: 'Business table', value: '~200 GB, one primary', tone: 'good' },
            { text: 'Shard by geohash', value: 'downtown hotspots', tone: 'bad' },
            { text: 'Redis cold or down', value: 'read replicas', tone: 'warn' },
          ],
        },
        caption: 'Replicas carry the load when the cache is empty',
      },
    },
    {
      title: 'Regions',
      tag: 'concept',
      heading: 'A full copy in every region',
      eli5: 'Each city gets its own **information desk** with full copies of the folders, so tourists never fly across the ocean to ask a question.',
      body: [
        'Diners are everywhere, so we run the search tier, Redis and replicas in several regions and let **GeoDNS** send each phone to the closest one.',
        'The dataset is a few hundred GB and changes daily, so every region keeps a full copy. Writes still go to one primary.',
      ],
      keyIdea: 'Read-only data small enough to copy lets every region answer alone.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '25 ms', db: '~300/s' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [dinerUs, dinerEu, dns, stackUs, stackEu],
        links: [link('dinerUs', 'dns', { style: 'faint' }), link('dinerEu', 'dns', { style: 'faint' }), link('dinerUs', 'stackUs'), link('dinerEu', 'stackEu')],
        flows: [
          { path: ['dinerUs', 'stackUs'], tone: 'request', label: 'Chicago', duration: 1.4 },
          { path: ['dinerEu', 'stackEu'], tone: 'request', label: 'Paris', duration: 1.4, delay: 0.3 },
        ],
        caption: 'Each phone talks to the nearest region',
      },
    },
    {
      title: 'Region outage',
      tag: 'case',
      heading: 'Case: the US region goes dark',
      eli5: 'When one city\'s **information desk** closes for a storm, tourists are sent to the next town\'s desk. It is a longer walk, but they still get an answer.',
      body: [
        'Health checks fail, GeoDNS stops returning the US address, and Chicago traffic moves to EU. A low TTL (30 to 60 s) plus client retry bounds the damage: some users still hit the dead region until cached answers expire, then searches succeed at about 120 ms instead of 25 ms because of the ocean. Anycast or a global load balancer fails over faster.',
        'Plan each region for its own peak plus the largest region it may absorb, and drill the failover. Some countries also require data to stay inside their borders.',
      ],
      keyIdea: 'Read-only data that fits in every region turns a region outage into a latency bump.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '120 ms (failover)', db: '~300/s' },
      metricTones: { p99: 'warn' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [
          { ...dinerUs, status: 'active' },
          dinerEu,
          { ...dns, status: 'active', badge: 'US unhealthy' },
          { ...stackUs, status: 'down' },
          { ...stackEu, status: 'hot', load: 80, badge: 'serving both' },
        ],
        links: [
          link('dinerUs', 'stackEu', { style: 'dashed', label: '+90 ms', labelTone: 'warn' }),
          link('dinerEu', 'stackEu'),
          link('dinerUs', 'dns', { style: 'faint' }),
        ],
        flows: [
          { path: ['dinerUs', 'dns'], tone: 'handshake', label: 'where?', duration: 1 },
          { path: ['dns', 'dinerUs'], tone: 'response', label: 'EU', duration: 1, delay: 1.1 },
          { path: ['dinerUs', 'stackEu'], tone: 'request', duration: 1.4, delay: 2.2 },
          { path: ['dinerEu', 'stackEu'], tone: 'request', count: 2, duration: 1.2, delay: 0.5 },
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
        'A lat and lng range scans two strips of the planet, so we map points to cells. Fixed grids are uneven, **geohash** works with a plain B-tree if you read 8 neighbors, a **quadtree** adapts in RAM, and **S2** covers any shape.',
        'We chose geohash, cached cell lists in Redis, rebuilt them nightly, read misses from replicas and copied everything to every region. p99 fell from 2.4 s to about 25 ms and DB reads from 17,000 to about 300 per second.',
      ],
      keyIdea: 'Solve the spatial query with cells, then use the read-heavy, slow-changing nature of the data to cache and replicate without fear.',
      metrics: { qps: '17,000/s', rows: '~400', p99: '25 ms', db: '~300/s' },
      metricTones: { qps: 'good', rows: 'good', p99: 'good', db: 'good' },
      scene: {
        nodes: [diner, { ...search, status: 'ok' }, { ...cache, status: 'ok' }, replicas, db],
        links: [link('diner', 'search'), link('search', 'cache'), link('search', 'replicas', { style: 'dashed' }), link('db', 'replicas')],
        flows: [{ path: ['diner', 'search', 'cache', 'search', 'diner'], tone: 'response', count: 3, duration: 2.6 }],
        caption: 'Cells, cache, copies',
      },
      quiz: {
        question: 'Owners edit about 10 listings per second (100 at peak) and accept a one-day delay. Search runs at 17,000 per second. Which caching plan fits best?',
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
