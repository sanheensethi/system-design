import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Top row: rider, API, dispatch. Bottom row: driver, location gateway, ping log. Middle right: geo index.
const rider: SceneNode = { id: 'rider', kind: 'phone', at: at(-4.2, -3.2), label: 'rider app', sub: 'wants a car' };
const driver: SceneNode = { id: 'driver', kind: 'phone', at: at(-4.2, 3.2), label: 'driver app', sub: 'ping every 4 s' };
const api: SceneNode = { id: 'api', kind: 'block', size: 0.8, at: at(0, -3.6), label: 'API', sub: 'gateway', icon: 'Network', tint: 'violet' };
const dispatch: SceneNode = { id: 'dispatch', kind: 'block', size: 0.8, at: at(5.4, -3.4), label: 'dispatch', sub: 'matching', icon: 'Route', tint: 'amber' };
const locgw: SceneNode = { id: 'locgw', kind: 'block', size: 0.8, at: at(0, 3.6), label: 'location gw', sub: 'WebSocket', icon: 'Signal', tint: 'blue' };
const pings: SceneNode = { id: 'pings', kind: 'queue', at: at(5.4, 3.4), label: 'ping log', sub: 'Kafka topic' };
const geo: SceneNode = { id: 'geo', kind: 'cache', at: at(2.4, 0), label: 'geo index', sub: 'Redis, by cell' };
const trips: SceneNode = { id: 'trips', kind: 'db', at: at(-2, 0.4), label: 'trip DB', sub: 'Postgres' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designUber: Lesson = {
  id: 'design-uber',
  title: 'Design Uber ride matching',
  tagline: 'Send the nearest free driver an offer in under two seconds, with five million drivers moving at once.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Requirements, scale numbers and the API and data model of a ride platform',
    'Why scanning every driver fails and how a cell index (geohash, quadtree, H3, S2) fixes it',
    'A location pipeline that ingests 1.25 million pings per second',
    'Matching, the double-assignment race, a lock on the driver and a database backstop',
    'Surge pricing, ETA, city sharding and what happens when parts fail',
  ],
  metrics: [
    { key: 'pings', label: 'Pings/s', icon: 'Signal' },
    { key: 'read', label: 'Nearby read', icon: 'Search' },
    { key: 'match', label: 'Offer p99', icon: 'Timer' },
    { key: 'safety', label: 'Double bookings', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A rider taps a button and a car must show up',
      eli5: 'A town taxi office has one wall map. Kids call in asking for a ride, and the **dispatch** lady must pin the closest free car on the map, fast, and never send one car to two kids.',
      body: [
        'Rider sends pickup and drop pins. The system finds nearby drivers, picks one, the driver accepts, the rider watches the car move, the trip ends and the fare is settled. Drivers send a location every 4 s while online.',
        'Targets: first offer sent in under 2 s at p99 (acceptance is a separate wait), 1M location updates per second, no driver ever assigned to two riders, 99.99% availability.',
      ],
      keyIdea: 'Three hard parts: a flood of location writes, a fast "who is near me" read, and a match that can never double-book.',
      metrics: { pings: '?', read: '?', match: '< 2 s target', safety: '0 allowed' },
      scene: {
        nodes: [
          { ...rider, status: 'active', chips: ['pickup + drop pins'] },
          { ...dispatch, status: 'active', badge: 'offer < 2 s' },
          { ...driver, chips: [{ text: 'online', tone: 'good' }] },
        ],
        links: [link('rider', 'dispatch', { label: 'request ride' }), link('dispatch', 'driver', { label: 'offer' })],
        flows: [
          { path: ['rider', 'dispatch'], tone: 'request', label: 'ride request', duration: 1.4 },
          { path: ['dispatch', 'driver'], tone: 'event', label: 'offer', duration: 1.4, delay: 1.5 },
          { path: ['driver', 'dispatch', 'rider'], tone: 'response', label: 'accepted', duration: 1.8, delay: 3 },
        ],
        panel: {
          title: 'Non-functional targets',
          icon: 'Gauge',
          rows: [
            { text: 'First offer p99', value: '< 2 s' },
            { text: 'Location updates', value: '1M per s' },
            { text: 'Double assignment', value: 'never', tone: 'bad' },
            { text: 'Availability', value: '99.99%' },
          ],
        },
        caption: 'Request, offer, accept',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'Back-of-envelope: 5M drivers, 100M rides a day',
      eli5: 'Five million taxi cars each shout their spot every 4 seconds. The office must hear all the shouting while kids ask "who is near me?" a thousand times a second.',
      body: [
        'Pings: 5M drivers at one per 4 s is **1.25M writes/s**. At 200 B each that is 250 MB/s in and about 22 TB a day raw.',
        'Reads: 100M rides a day is 1,200 nearby-car reads/s on average and about 12k/s at 10x peak. Trips: 100M x 2 KB is 200 GB a day, roughly 70 TB a year.',
      ],
      keyIdea: 'Writes (1.25M/s) dwarf reads (12k/s). Design the location path as a write-heavy stream.',
      metrics: { pings: '1.25M/s', read: '12k/s peak', match: '< 2 s', safety: '0' },
      metricTones: { pings: 'warn' },
      scene: {
        nodes: [
          { ...driver, chips: ['5M online'] },
          { ...locgw, status: 'hot', load: 88 },
          { ...rider, chips: ['100M rides/day'] },
          { ...api, load: 55 },
        ],
        links: [link('driver', 'locgw', { label: '1 ping / 4 s' }), link('rider', 'api', { label: '12k/s peak' })],
        flows: [
          { path: ['driver', 'locgw'], tone: 'data', count: 4, label: '200 B', duration: 1.2 },
          { path: ['rider', 'api'], tone: 'request', label: 'nearby?', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Capacity',
          icon: 'Table',
          rows: [
            { text: 'Ping writes', value: '1.25M/s', tone: 'bad' },
            { text: 'Ingress', value: '250 MB/s' },
            { text: 'Raw per day', value: '22 TB' },
            { text: 'Nearby reads', value: '1.2k/s, 12k/s peak' },
            { text: 'Trips per year', value: '~70 TB' },
          ],
        },
        caption: 'The write path is the monster',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'The API: pings in, a ride out, one state to watch',
      eli5: 'Kids use three words with the taxi office: "I am here" from the cars, "I want a ride" from kids, and "where is my car?" to peek.',
      body: [
        'Drivers send pings over a long-lived WebSocket. Riders use plain HTTPS. The ride request is a `POST` and returns a trip id at once, because matching takes time. The rider then follows the trip over a stream.',
        'Retries must be safe, so the ride request carries an idempotency key (see the API design lesson).',
      ],
      keyIdea: 'Return a trip id immediately and stream state changes. Never hold the request open while matching.',
      metrics: { pings: '1.25M/s', read: '12k/s peak', match: '< 2 s', safety: '0' },
      scene: {
        nodes: [
          { ...rider, chips: [{ text: 'POST /rides', tone: 'good' }, 'GET /rides/{id}'] },
          { ...api, status: 'active' },
          { ...driver, chips: ['WS location.ping'] },
        ],
        links: [link('rider', 'api', { label: 'HTTPS' }), link('driver', 'api', { label: 'WebSocket', route: 'straight' })],
        flows: [
          { path: ['rider', 'api'], tone: 'request', label: 'POST /rides', duration: 1.4 },
          { path: ['api', 'rider'], tone: 'response', label: '202 trip_id', duration: 1.4, delay: 1.5 },
          { path: ['driver', 'api'], tone: 'data', label: 'ping', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Core calls',
          icon: 'Code',
          code: 'POST /rides            -> 202 {trip_id}\nGET  /rides/{id}       -> state, driver, ETA\nWS   location.ping     lat, lng, ts\nPOST /offers/{id}/accept\nPOST /rides/{id}/end   -> fare',
        },
        caption: 'A trip id back at once, then a stream',
      },
      code: {
        language: 'json',
        title: 'Ride request and its answer',
        source: `// POST /rides   (Idempotency-Key: 7f3a...)
{ "pickup": {"lat": 19.0760, "lng": 72.8777},
  "drop":   {"lat": 19.1197, "lng": 72.8468},
  "product": "standard" }

// 202 Accepted
{ "trip_id": "t_9001", "state": "searching",
  "quote": {"fare": 214, "surge": 1.4} }`,
        highlight: [2, 7],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Two kinds of data: hot positions and durable trips',
      eli5: 'The office keeps two notebooks. A scribble pad where each car crosses out its old spot, and a neat ledger of every finished ride.',
      body: [
        'A driver position is tiny, changes every 4 s and only the latest matters. It lives in memory. A **trip** is a durable record with a state machine, money and two people, so it lives in Postgres.',
        'Keep them apart. The pad can lose a few seconds without harm. The ledger must never lose a row.',
      ],
      keyIdea: 'Latest location is disposable and fast. A trip is durable and transactional. Split the stores.',
      metrics: { pings: '1.25M/s', read: '12k/s peak', match: '< 2 s', safety: '0' },
      scene: {
        nodes: [
          { ...geo, at: at(0, 0), status: 'active', chips: ['driver:77 -> cell'] },
          { ...trips, at: at(4.4, 0), status: 'active', chips: ['trip t_9001'] },
          { ...driver, chips: ['id 77'] },
        ],
        links: [link('driver', 'geo', { label: 'latest only', style: 'dashed' }), link('geo', 'trips', { label: 'on accept', arrow: 'end' })],
        flows: [
          { path: ['driver', 'geo'], tone: 'data', label: 'lat, lng', duration: 1.4 },
          { path: ['geo', 'trips'], tone: 'event', label: 'promote', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Two stores',
          icon: 'Database',
          rows: [
            { text: 'driver: id, lat, lng, ts, status', value: 'memory', tone: 'warn' },
            { text: 'trip: id, rider, driver, state', value: 'Postgres', tone: 'good' },
            { text: 'trip: pickup, drop, fare, ts', value: 'Postgres', tone: 'good' },
          ],
          footer: { text: 'Trip states: searching, offered, accepted, arrived, riding, done, paid', tone: 'muted' },
        },
        caption: 'Disposable positions, durable trips',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple version: one table of drivers, one query',
      eli5: 'The office keeps a list of every car and its spot. For each kid it walks down the whole list and measures which car is closest.',
      body: [
        'Store `drivers(id, lat, lng, status)` in one SQL table. Each ping is an `UPDATE`. A ride request runs `SELECT ... WHERE status = online` and sorts by distance.',
        'It is correct, easy to explain and fine for one small city. Now put 5M drivers into it.',
      ],
      keyIdea: 'A table plus a distance sort works at city-pilot size. It is the baseline to break.',
      metrics: { pings: '2k/s', read: '5 ms', match: '80 ms', safety: '0' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [
          { ...rider, chips: ['nearby?'] },
          { ...api },
          { ...trips, at: at(4.4, 0), label: 'drivers table', sub: 'lat, lng, status', status: 'active' },
          { ...driver },
        ],
        links: [link('rider', 'api'), link('api', 'trips'), link('driver', 'trips', { label: 'UPDATE', route: 'straight' })],
        flows: [
          { path: ['rider', 'api', 'trips'], tone: 'request', label: 'SELECT near me', duration: 1.8 },
          { path: ['trips', 'api', 'rider'], tone: 'response', label: 'closest 5', duration: 1.8, delay: 1.9 },
          { path: ['driver', 'trips'], tone: 'data', label: 'ping', duration: 1.2, delay: 0.5 },
        ],
        panel: {
          title: 'The naive query',
          icon: 'Code',
          code: "SELECT id FROM drivers\nWHERE status = 'online'\nORDER BY dist(lat, lng, :la, :ln)\nLIMIT 5;",
          footer: { text: 'Reads every online driver', tone: 'warn' },
        },
        caption: 'Fine for a pilot city',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'Scanning 5M drivers per request collapses',
      eli5: 'Now the list has five million cars. For every kid the lady reads the whole list, and while she reads, the cars keep crossing out their spots. Everybody waits.',
      body: [
        'A full scan of 5M rows costs about 50 ms of CPU per read. At 12k reads/s that needs 600 cores just to answer "who is near me", before ranking.',
        'Worse, 1.25M `UPDATE`s per second hit the same table. No single SQL primary takes that. Two problems: reads touch far too much data, and writes are far too many.',
      ],
      keyIdea: 'Read by location, not by scanning. Write to memory, not to a disk table.',
      metrics: { pings: '1.25M/s', read: '50 ms per core', match: '> 5 s', safety: '0' },
      metricTones: { pings: 'bad', read: 'bad', match: 'bad' },
      scene: {
        nodes: [
          { ...rider, chips: [{ text: 'nearby? x 12k/s', tone: 'warn' }] },
          { ...trips, at: at(4.4, 0), label: 'drivers table', sub: '5M rows', status: 'hot', load: 100 },
          { ...driver, chips: [{ text: 'UPDATE x 1.25M/s', tone: 'bad' }] },
        ],
        links: [link('rider', 'trips', { label: 'full scan', labelTone: 'warn' }), link('driver', 'trips', { label: 'writes', labelTone: 'bad', route: 'straight' })],
        flows: [
          { path: ['rider', 'trips'], tone: 'request', label: 'scan 5M', duration: 1.6 },
          { path: ['trips', 'rider'], tone: 'error', label: 'timeout', duration: 1.6, delay: 1.8 },
          { path: ['driver', 'trips'], tone: 'data', count: 5, duration: 1.2 },
        ],
        panel: {
          title: 'Why it falls over',
          icon: 'Gauge',
          rows: [
            { text: 'Scan cost', value: '50 ms/read', tone: 'bad' },
            { text: 'At 12k reads/s', value: '600 cores', tone: 'bad' },
            { text: 'Writes on one table', value: '1.25M/s', tone: 'bad' },
          ],
        },
        caption: 'Too much read, too much write',
      },
    },
    {
      title: 'Cells',
      tag: 'concept',
      heading: 'Slice the map into cells and look only in a few',
      eli5: 'The lady draws squares on the wall map and sticks each car in its square. To find a car near a kid she checks the kid\'s square and the squares next to it.',
      body: [
        'A **spatial index** turns two numbers (lat, lng) into one **cell id**. Drivers are grouped by cell. A nearby query reads the rider\'s cell and its neighbors, a few dozen drivers instead of 5M.',
        'A ping moves a driver from one cell to another only when the driver crosses a boundary. Most pings change nothing but a timestamp.',
      ],
      keyIdea: 'Turn "within 5 km" into "in these few cells". The scan shrinks from millions to dozens.',
      metrics: { pings: '1.25M/s', read: '< 1 ms', match: '-', safety: '0' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [
          { ...rider, chips: ['cell 9q8yy'] },
          { ...api },
          { ...geo, at: at(4.4, 0), status: 'active', chips: ['9q8yy: 12 drivers', '9q8yz: 7 drivers'] },
        ],
        links: [link('rider', 'api'), link('api', 'geo', { label: 'cell + 8 neighbors' })],
        flows: [
          { path: ['rider', 'api', 'geo'], tone: 'request', label: 'near 9q8yy', duration: 1.8 },
          { path: ['geo', 'api', 'rider'], tone: 'response', label: '~40 drivers', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Index shape',
          icon: 'Layers',
          code: 'cell("9q8yy") -> {drivers}\nlookup  : O(1) per cell\nquery   : 1 + 8 neighbors\nscanned : ~40, not 5,000,000',
        },
        caption: 'A map key instead of a table scan',
      },
    },
    {
      title: 'Index choices',
      tag: 'tradeoff',
      heading: 'Quadtree, geohash, H3 or S2',
      eli5: 'There are four ways to draw the squares on the wall map. Some are easy to draw, some fit the round Earth better, and one adds new lines where the town is crowded.',
      body: [
        '**Quadtree** splits crowded areas more finely, but 1M writes/s means constant rebalancing and locks. **Geohash** is a string key that any key-value store can range over, but neighbors can share no prefix.',
        '**H3** uses hexagons (6 equal neighbors, good for surge). **S2** uses 64-bit cell ids on a sphere, and a region is a set of range scans. Both need a library.',
      ],
      keyIdea: 'Pick the index for the query shape. Geohash is the simplest to defend, H3 and S2 are the grown-up choices.',
      metrics: { pings: '1.25M/s', read: '< 1 ms', match: '-', safety: '0' },
      scene: {
        nodes: [
          { ...geo, at: at(0, -0.4), label: 'geo index', status: 'active' },
          { id: 'q', kind: 'block', size: 0.7, at: at(-4, -3.2), label: 'quadtree', icon: 'Split', tint: 'gray' },
          { id: 'g', kind: 'block', size: 0.7, at: at(-2.6, 3.8), label: 'geohash', icon: 'Hash', tint: 'green' },
          { id: 'h', kind: 'block', size: 0.7, at: at(2, -3.4), label: 'H3', icon: 'Boxes', tint: 'violet' },
          { id: 's', kind: 'block', size: 0.7, at: at(4, 3.2), label: 'S2', icon: 'Earth', tint: 'blue' },
        ],
        links: [link('q', 'geo', { style: 'faint' }), link('g', 'geo'), link('h', 'geo', { style: 'faint' }), link('s', 'geo', { style: 'faint' })],
        panel: {
          title: 'Four ways to cell the map',
          icon: 'Table',
          rows: [
            { text: 'Quadtree', value: 'tree locks under writes', tone: 'warn' },
            { text: 'Geohash', value: 'string key, 8 neighbors', tone: 'good' },
            { text: 'H3', value: 'hexagons, 6 neighbors' },
            { text: 'S2', value: '64-bit ids, range scans' },
          ],
          footer: { text: 'A dispatch grid by city plus H3 for analytics is common', tone: 'muted' },
        },
        caption: 'The index is where the engineering lives',
      },
      quiz: {
        question: 'Why is a quadtree a poor fit for the live driver index at 1M writes per second?',
        options: [
          'It cannot store points at all',
          'Constant rebalancing and node locks under heavy writes',
          'It uses hexagons, which are slower',
          'It needs a SQL database',
        ],
        answer: 1,
        explain: 'A quadtree adapts to density, which is great for static data. When every driver moves every 4 s, splits, merges and locks become the bottleneck.',
      },
    },
    {
      title: 'Neighbor cells',
      tag: 'concept',
      heading: 'The boundary problem and the 9-cell trick',
      eli5: 'A kid stands right on the line between two squares. The nearest car may be in the next square, so the lady checks all the squares around the kid, not just one.',
      body: [
        'A rider at the edge of a cell has cars just across the line. Two cells that touch on the map may share no string prefix, so a prefix scan misses them.',
        'Fix: compute the rider\'s cell, add its 8 neighbors, and read all 9. Then filter by real distance. At precision 6 a geohash cell is about 1.2 km by 0.6 km.',
      ],
      keyIdea: 'Always query the cell plus its neighbors, then filter by true distance.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '-', safety: '0' },
      scene: {
        nodes: [
          { ...rider, chips: ['on a cell edge'] },
          { ...api },
          { ...geo, at: at(4.4, 0), status: 'active', chips: ['9 cells read'] },
        ],
        links: [link('rider', 'api'), link('api', 'geo', { label: '9 lookups' })],
        flows: [
          { path: ['api', 'geo'], tone: 'request', count: 3, label: 'cell + 8', duration: 1.4 },
          { path: ['geo', 'api'], tone: 'response', label: 'filter by distance', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Cells searched',
          icon: 'Layers',
          code: '+----+----+----+\n| NW |  N | NE |\n+----+----+----+\n|  W | me |  E |\n+----+----+----+\n| SW |  S | SE |\n+----+----+----+',
        },
        caption: 'One cell is not enough',
      },
      code: {
        language: 'python',
        title: 'Nearby drivers with geohash',
        source: `def nearby(lat, lng, radius_m):
    cell = geohash.encode(lat, lng, precision=6)   # ~1.2 km x 0.6 km
    found, fresh = set(), time.time() - 15         # ignore stale pings
    for c in [cell] + geohash.neighbors(cell):     # 9 cells
        for driver_id in redis.zrangebyscore(f"geo:{c}", fresh, "+inf"):
            d = redis.hgetall(f"driver:{driver_id}")
            if d and haversine(lat, lng, d.lat, d.lng) <= radius_m:
                found.add(driver_id)
    return found`,
        highlight: [2, 4, 5, 7],
      },
    },
    {
      title: 'Ping pipeline',
      tag: 'concept',
      heading: 'Absorbing 1.25M pings per second',
      eli5: 'Cars shout their spots into a big funnel at the office door. Helpers take shouts off the funnel in batches and update the wall map, so the shouting never stops the lady.',
      body: [
        'Drivers connect to a **location gateway** over WebSocket, sticky by driver id. It writes each ping to a log (Kafka, see the message queues lesson), partitioned by `driver_id`, which keeps pings per driver in order and spreads the load.',
        'A consumer drops any ping whose `ts` is older than the stored one, then updates the geo index in Redis. The log absorbs bursts, and replaying it rebuilds the index.',
      ],
      keyIdea: 'Gateway, log, consumer. Writes never go straight to the index, so spikes queue instead of dropping.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '-', safety: '0' },
      metricTones: { pings: 'good' },
      scene: {
        nodes: [
          { ...driver },
          { ...locgw, status: 'active', chips: ['sticky by driver'] },
          { ...pings, status: 'active', badge: '1.25M/s' },
          { ...geo, at: at(5.4, -3.2), chips: ['consumer updates'] },
        ],
        links: [link('driver', 'locgw', { label: 'WebSocket' }), link('locgw', 'pings'), link('pings', 'geo', { style: 'dashed' })],
        flows: [
          { path: ['driver', 'locgw', 'pings'], tone: 'data', label: 'ping', duration: 1.8 },
          { path: ['pings', 'geo'], tone: 'event', label: 'apply', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'One ping',
          icon: 'Signal',
          rows: [
            { text: 'driver_id', value: '77' },
            { text: 'lat, lng', value: '19.076, 72.877' },
            { text: 'ts, status', value: 'now, free' },
            { text: 'partition key', value: 'driver_id' },
          ],
        },
        caption: 'A log between gateway and index',
      },
    },
    {
      title: 'Fresh positions',
      tag: 'concept',
      heading: 'Keep only the latest spot, and let stale ones expire',
      eli5: 'Each car has one sticker on the wall map. When it moves, it peels the old sticker and puts a new one. A car that stops shouting loses its sticker after a short time.',
      body: [
        'Each cell is a sorted set scored by ping time. A ping removes the driver from the old cell, adds it to the new one with the new score, and refreshes `driver:{id}`. Same cell, only the score changes.',
        'A phone that loses signal sends nothing, so its score goes stale. Reads skip scores older than 15 s and a sweep trims them with `ZREMRANGEBYSCORE`. Set members have no TTL, so the score is the expiry.',
      ],
      keyIdea: 'Store only the latest position and score it by time. Stale drivers are trimmed by score, since set members cannot expire.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '-', safety: '0' },
      scene: {
        nodes: [
          { ...pings, badge: 'ping 77' },
          { ...geo, status: 'active', chips: ['geo:9q8yy: {77}', 'score = ping ts'] },
          { ...driver, status: 'down', label: 'driver 91', sub: 'lost signal' },
        ],
        links: [link('pings', 'geo'), link('driver', 'geo', { style: 'faint', label: 'silent', labelTone: 'warn' })],
        flows: [{ path: ['pings', 'geo'], tone: 'data', label: 'move 77', duration: 1.6 }],
        panel: {
          title: 'On each ping',
          icon: 'Code',
          code: 'ZREM  geo:{old_cell} 77\nZADD  geo:{new_cell} {ts} 77\nHSET  driver:77 lat lng ts\nZREMRANGEBYSCORE geo:{cell}\n      0 {now-15}',
          footer: { text: 'Silent for 15 s: trimmed from the cell', tone: 'good' },
        },
        caption: 'The index forgets silent drivers',
      },
    },
    {
      title: 'Ranking',
      tag: 'concept',
      heading: 'From 40 nearby cars to the best one',
      eli5: 'The lady has 40 cars near the kid. She does not just pick the closest. She prefers the one that gets there soonest and is free.',
      body: [
        'The geo index returns 20 to 50 candidates. Dispatch drops busy drivers, then ranks by **pickup ETA** (road time, not straight line), then driver rating and acceptance history.',
        'It tries them in order. Match latency means time to the first offer (lookup, rank, lock), about 500 ms here. Whether the driver accepts is a separate wait the rider sees.',
      ],
      keyIdea: 'Nearest by road time beats nearest by distance. Rank a short list, never the whole fleet.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '< 500 ms rank', safety: '0' },
      scene: {
        nodes: [
          { ...api },
          { ...geo, status: 'ok', chips: ['40 candidates'] },
          { ...dispatch, status: 'active', chips: ['rank by ETA'] },
        ],
        links: [link('api', 'dispatch'), link('dispatch', 'geo', { arrow: 'both', label: 'candidates' })],
        flows: [
          { path: ['api', 'dispatch'], tone: 'request', label: 'match', duration: 1.2 },
          { path: ['dispatch', 'geo', 'dispatch'], tone: 'request', label: '40 candidates', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Ranked candidates',
          icon: 'List',
          rows: [
            { text: '1. driver 77', value: 'ETA 2 min', tone: 'good' },
            { text: '2. driver 52', value: 'ETA 3 min' },
            { text: '3. driver 18', value: 'ETA 4 min' },
            { text: 'busy or offline', value: 'dropped', tone: 'muted' },
          ],
        },
        caption: 'A short ranked list',
      },
    },
    {
      title: 'The race',
      tag: 'case',
      heading: 'Two riders, one best driver, same millisecond',
      eli5: 'Two kids call at the same moment and two ladies both point at the same taxi. Each writes "car 77 is mine". The car drives to one kid and the other waits forever.',
      body: [
        'Two dispatch workers rank candidates for two riders and both pick driver 77. Both read "free", both send an offer. The driver sees two offers, or one rider is told yes and then left stranded.',
        'Reading the state and then writing it is a check-then-act race. It has to become one atomic step.',
      ],
      keyIdea: 'Read-then-write on driver status is a race. Claiming a driver must be a single atomic operation.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '< 2 s', safety: '2 riders, 1 car' },
      metricTones: { safety: 'bad' },
      scene: {
        nodes: [
          { id: 'r1', kind: 'phone', at: at(-4.2, -3.2), label: 'rider A', chips: ['wants 77'] },
          { id: 'r2', kind: 'phone', at: at(-4.2, 3.2), label: 'rider B', chips: ['wants 77'] },
          { ...dispatch, at: at(0, 0), status: 'hot', label: 'dispatch x2' },
          { id: 'd77', kind: 'phone', at: at(4.2, 0), label: 'driver 77', sub: 'two offers', status: 'hot', badge: 'double booked' },
        ],
        links: [link('r1', 'dispatch'), link('r2', 'dispatch'), link('dispatch', 'd77')],
        flows: [
          { path: ['r1', 'dispatch', 'd77'], tone: 'request', label: 'offer A', duration: 1.8 },
          { path: ['r2', 'dispatch', 'd77'], tone: 'error', label: 'offer B', duration: 1.8, delay: 0.1 },
        ],
        panel: {
          title: 'Interleaving',
          icon: 'Bug',
          code: 'A: read 77 -> free\nB: read 77 -> free\nA: write 77 = busy(A)\nB: write 77 = busy(B)\n   both riders promised car 77',
          footer: { text: 'Classic check-then-act race', tone: 'bad' },
        },
        caption: 'Same driver offered twice',
      },
    },
    {
      title: 'Lock the driver',
      tag: 'concept',
      heading: 'One atomic claim on the driver, with a timer',
      eli5: 'Each taxi has a "taken" flag that can only be set if it is empty, all in one move. First lady to set it wins. Second lady sees it set and picks the next car.',
      body: [
        'Lock the **driver**, not the rider. Redis `SET key value NX EX 30` sets the key only if it does not exist, in one atomic call (see the distributed locks lesson).',
        '`NX` makes the claim a compare-and-set. `EX 30` makes the lock expire by itself if the dispatch worker or the driver app crashes. The loser tries the next ranked driver.',
      ],
      keyIdea: 'SET NX EX on the driver is a lock that exactly one dispatcher can win and that frees itself on failure.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '< 2 s', safety: '0' },
      metricTones: { safety: 'good' },
      scene: {
        nodes: [
          { id: 'dA', kind: 'block', size: 0.72, at: at(-4.2, -3.2), label: 'dispatch A', icon: 'Route', tint: 'amber', chips: [{ text: 'SET NX ok', tone: 'good' }] },
          { id: 'dB', kind: 'block', size: 0.72, at: at(-4.2, 3.2), label: 'dispatch B', icon: 'Route', tint: 'gray', chips: [{ text: 'SET NX fails', tone: 'warn' }] },
          { id: 'lock', kind: 'cache', at: at(0, 0), label: 'driver lock', sub: 'Redis', status: 'active', chips: ['driver:77:lock = A'] },
          { id: 'd52', kind: 'phone', at: at(4.2, 3.2), label: 'driver 52', sub: 'B tries next', status: 'ok' },
        ],
        links: [link('dA', 'lock'), link('dB', 'lock'), link('dB', 'd52', { style: 'dashed' })],
        flows: [
          { path: ['dA', 'lock'], tone: 'request', label: 'SET NX', duration: 1.4 },
          { path: ['lock', 'dA'], tone: 'response', label: 'OK', duration: 1.2, delay: 1.5 },
          { path: ['dB', 'lock'], tone: 'request', label: 'SET NX', duration: 1.4, delay: 0.1 },
          { path: ['lock', 'dB'], tone: 'error', label: 'nil', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Why it is safe',
          icon: 'Key',
          rows: [
            { text: 'NX', value: 'only if empty', tone: 'good' },
            { text: 'EX 30', value: 'self-expires', tone: 'good' },
            { text: 'Cost', value: 'O(1), in memory' },
          ],
        },
        caption: 'First write wins',
      },
      code: {
        language: 'python',
        title: 'Claim a driver, or move on',
        source: `for driver in ranked_candidates:
    # atomic: set only if the key does not exist, expire in 30 s
    got = redis.set(f"driver:{driver.id}:lock", rider_id, nx=True, ex=30)
    if got:
        send_offer(driver, rider)
        break          # winner. Other dispatchers skip this driver`,
        highlight: [3, 4, 5],
      },
    },
    {
      title: 'Why not SQL',
      tag: 'tradeoff',
      heading: 'Why the lock is in Redis and not a DB transaction',
      eli5: 'The "taken" flag could be written in the ledger instead of on the car. But then every lady lines up at the ledger for every car, and a lost pen stays stuck forever.',
      body: [
        'A Postgres transaction per match is fine at 1k TPS. The trouble is the hot row: `drivers.status` serializes every match that touches the same driver, and each transaction holds disk-backed locks.',
        'A Redis key is O(1) and its TTL bounds any failure. Trips still land in Postgres, where a partial unique index on `trips(driver_id)` for active trips rejects a second accept even if Redis loses a lock.',
      ],
      keyIdea: 'Use the cheap, expiring lock for the short race and a database constraint as the durable last guard.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '< 2 s', safety: '0' },
      scene: {
        nodes: [
          { ...dispatch, at: at(-4, 0), size: 0.72 },
          { id: 'rlock', kind: 'cache', at: at(-1.4, -3.2), label: 'Redis lock', sub: 'NX + TTL', status: 'ok', chips: [{ text: 'O(1)', tone: 'good' }] },
          { ...trips, at: at(1.6, 3.2), label: 'Postgres row', sub: 'drivers.status', status: 'hot', chips: [{ text: 'hot row lock', tone: 'warn' }] },
        ],
        links: [link('dispatch', 'rlock', { label: 'chosen', labelTone: 'good' }), link('dispatch', 'trips', { label: 'serializes', labelTone: 'warn', style: 'dashed' })],
        flows: [{ path: ['dispatch', 'rlock'], tone: 'request', label: 'claim', duration: 1.2 }],
        panel: {
          title: 'Lock store compared',
          icon: 'Scale',
          rows: [
            { text: 'Redis SET NX EX', value: 'O(1), self-expiring', tone: 'good' },
            { text: 'SQL row lock', value: 'serialized, sticky', tone: 'warn' },
            { text: 'Backstop', value: 'unique index, active trips', tone: 'good' },
            { text: 'Redis is lost', value: 'locks expire, retry', tone: 'muted' },
          ],
        },
        caption: 'Short-lived claim in memory',
      },
      quiz: {
        question: 'Why does the driver lock use `EX 30`?',
        options: [
          'To make the lock faster to acquire',
          'So a crashed dispatcher or driver app cannot hold a driver forever',
          'To count how many offers a driver got',
          'To keep the trip in Postgres for 30 s',
        ],
        answer: 1,
        explain: 'The expiry is the safety net. If the process that took the lock dies before releasing it, the lock disappears on its own and the driver becomes matchable again.',
      },
    },
    {
      title: 'Offer and accept',
      tag: 'concept',
      heading: 'Offer, accept, decline or time out',
      eli5: 'The lady rings the taxi and asks "can you take this kid?" The driver has a few seconds to say yes. If he says no or stays quiet, she unlocks him and rings the next one.',
      body: [
        'Dispatch pushes the offer over the open WebSocket with a 12 s window, well below the 30 s lock. **Accept** sets the driver `busy` in its hash, removes it from the cell set and inserts the trip, then releases the lock.',
        '**Decline** or timeout releases the lock and the next candidate is tried, one driver at a time. Release is a compare-and-delete on the owner value (a small Lua script), so a late worker cannot free a lock it lost.',
      ],
      keyIdea: 'One offer at a time, with a window far shorter than the lock. Accept marks the driver busy, anything else releases only your own lock.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      metricTones: { match: 'good' },
      scene: {
        nodes: [
          { ...dispatch, status: 'active' },
          { ...driver, chips: [{ text: 'offer: 2 min away', tone: 'good' }] },
          { ...trips, at: at(-4.2, -3.2), label: 'trip DB', chips: ['t_9001'] },
          { ...geo, at: at(4.2, 3.2), label: 'driver lock', chips: ['driver:77:lock'] },
        ],
        links: [link('dispatch', 'driver', { label: 'offer, 12 s' }), link('driver', 'trips', { label: 'accept', route: 'straight' }), link('dispatch', 'geo', { style: 'dashed' })],
        flows: [
          { path: ['dispatch', 'driver'], tone: 'event', label: 'offer', duration: 1.4 },
          { path: ['driver', 'trips'], tone: 'response', label: 'accept', duration: 1.4, delay: 1.5 },
          { path: ['dispatch', 'geo'], tone: 'request', label: 'release if mine', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Offer outcomes',
          icon: 'List',
          rows: [
            { text: 'Accept', value: 'busy, trip row, unlock', tone: 'good' },
            { text: 'Decline', value: 'release lock, next driver', tone: 'warn' },
            { text: 'No reply in 12 s', value: 'release lock, next driver', tone: 'warn' },
            { text: 'Release', value: 'Lua compare-and-delete' },
            { text: 'Offer 12 s vs lock', value: '30 s', tone: 'muted' },
          ],
        },
        caption: 'Busy on yes, release on anything else',
      },
    },
    {
      title: 'No match',
      tag: 'case',
      heading: 'No cars, all decline, or someone cancels',
      eli5: 'If no taxi is near the kid, the lady checks the squares one ring further out. If nobody says yes for a while, she tells the kid "no cars right now". If anyone backs out, the taxi is freed.',
      body: [
        'No candidates, or every driver declines? Dispatch widens the search by one ring of neighbor cells (9 cells become 25), up to a radius cap. A total match deadline of 45 s ends it with "no cars available".',
        'A rider cancel, or a driver cancel after accept, clears `busy`, puts the driver back in the cell set, releases the lock and either re-matches or closes the trip. Hot cells such as a stadium use a finer cell level.',
      ],
      keyIdea: 'Matching has a deadline and an exit. Widen by rings, give up cleanly, and free the driver on every cancel.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      scene: {
        nodes: [
          { ...rider, chips: [{ text: 'no cars available', tone: 'warn' }] },
          { ...dispatch, status: 'active', chips: ['deadline 45 s'] },
          { ...geo, at: at(2.4, 0), status: 'active', chips: ['ring 1: 9 cells', 'ring 2: 25 cells'] },
          { ...driver, chips: [{ text: 'cancel', tone: 'warn' }] },
        ],
        links: [link('dispatch', 'geo', { arrow: 'both', label: 'widen ring' }), link('dispatch', 'rider', { label: 'give up', labelTone: 'warn' }), link('driver', 'dispatch', { label: 'cancel' })],
        flows: [
          { path: ['dispatch', 'geo'], tone: 'request', label: 'ring 2', duration: 1.4 },
          { path: ['dispatch', 'rider'], tone: 'error', label: 'no cars', duration: 1.4, delay: 1.6 },
          { path: ['driver', 'dispatch'], tone: 'event', label: 'cancel, free driver', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Match exits',
          icon: 'List',
          rows: [
            { text: 'Widen search', value: '9 cells, then 25' },
            { text: 'Match deadline', value: '45 s, then no cars', tone: 'warn' },
            { text: 'Cancel after accept', value: 'free driver, re-match', tone: 'good' },
            { text: 'Hot cell (stadium)', value: 'finer cell level', tone: 'muted' },
          ],
        },
        caption: 'Every path ends and frees the driver',
      },
    },
    {
      title: 'Trip lifecycle',
      tag: 'concept',
      heading: 'Live tracking, then the trip and the fare',
      eli5: 'Once the driver says yes, the kid sees a little car crawl across the map. When the ride ends, the office writes the price in the ledger and takes the money.',
      body: [
        'The trip is a state machine: `searching`, `offered`, `accepted`, `arrived`, `riding`, `done`, `paid`. Each state change is a transaction in the trip DB. Positions never touch it: the rider\'s app follows the driver\'s pings through the location gateway and ping log.',
        'On `done`, the fare is computed from distance, time and surge and charged through a payment service (see the distributed transactions lesson).',
      ],
      keyIdea: 'Trip state is durable and transactional. Live positions reuse the ping stream and skip the trip DB.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      scene: {
        nodes: [
          { ...rider, chips: ['car 2 min away'] },
          { ...trips, at: at(0, -3.2), status: 'active', chips: ['state: riding'] },
          { ...driver, at: at(4.2, -3.2) },
          { ...locgw, at: at(0.4, 4.4), sub: 'via ping log' },
          { id: 'pay', kind: 'service', at: at(-4.2, 3.2), label: 'payments', sub: 'charge fare', status: 'ok' },
        ],
        links: [link('driver', 'trips', { label: 'state' }), link('driver', 'locgw', { label: 'position' }), link('locgw', 'rider', { label: 'position' }), link('trips', 'pay', { label: 'on done' })],
        flows: [
          { path: ['driver', 'trips'], tone: 'event', label: 'state', duration: 1.4 },
          { path: ['driver', 'locgw', 'rider'], tone: 'data', label: 'position', duration: 2, delay: 0.3 },
          { path: ['trips', 'pay'], tone: 'event', label: 'fare 214', duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'Trip states',
          icon: 'Workflow',
          code: 'searching -> offered\noffered   -> accepted\naccepted  -> arrived\narrived   -> riding\nriding    -> done -> paid',
        },
        caption: 'Durable states, streaming positions',
      },
    },
    {
      title: 'Surge pricing',
      tag: 'concept',
      heading: 'Surge: demand over supply, per hexagon',
      eli5: 'When many kids want rides in one neighborhood and few cars are there, the office asks for a bit more money, so more drivers drive over.',
      body: [
        'Surge is computed per **H3 hexagon** (about 1 km2 at level 8). A stream job (see the stream processing lesson) windows pings and ride requests by hex, computes `demand / supply` and writes a multiplier table to Redis every 30 s.',
        'Dispatch and the quote call read the multiplier at request time. The 30 s lag keeps prices stable instead of jumping on every ping.',
      ],
      keyIdea: 'Surge is an offline-ish aggregation by cell, published to a table that the hot path only reads.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      scene: {
        nodes: [
          { ...pings, at: at(-4.2, 0), badge: 'pings + requests' },
          { id: 'flink', kind: 'worker', at: at(0, 0), label: 'stream job', sub: 'window by hex', status: 'active' },
          { id: 'surge', kind: 'cache', at: at(4.2, 0), label: 'surge table', sub: 'hex -> x', status: 'ok', chips: ['8928308280f: 1.8x'] },
        ],
        links: [link('pings', 'flink', { label: '30 s window' }), link('flink', 'surge', { label: 'write' })],
        flows: [
          { path: ['pings', 'flink'], tone: 'data', count: 3, duration: 1.4 },
          { path: ['flink', 'surge'], tone: 'event', label: 'multiplier', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Surge per hex',
          icon: 'TrendingUp',
          rows: [
            { text: 'Hex A: 120 req, 100 cars', value: '1.2x' },
            { text: 'Hex B: 300 req, 100 cars', value: '3.0x', tone: 'bad' },
            { text: 'Hex C: 40 req, 200 cars', value: '1.0x', tone: 'good' },
          ],
          footer: { text: 'Recomputed every 30 s', tone: 'muted' },
        },
        caption: 'Prices follow the supply gap',
      },
    },
    {
      title: 'ETA model',
      tag: 'concept',
      heading: 'ETA comes from a model, not a shortest-path run',
      eli5: 'The lady guesses "about 4 minutes" from what usually happens on this street at this hour, instead of drawing a new route every time a kid asks.',
      body: [
        'Running a full route search per candidate per request is too slow. An ETA service uses a learned model: pickup and drop hex, time of day, a live traffic score and the historical median for that pair of hexes.',
        'It answers in milliseconds. An offline job retrains nightly. Exact routing is the maps lesson (see Design Google Maps).',
      ],
      keyIdea: 'Use a fast learned ETA for ranking and quotes. Keep exact routing for turn-by-turn.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      scene: {
        nodes: [
          { ...dispatch, at: at(-4.2, 0), size: 0.72 },
          { id: 'eta', kind: 'block', size: 0.8, at: at(0, 0), label: 'ETA service', sub: 'model', icon: 'Gauge', tint: 'green', status: 'active' },
          { id: 'train', kind: 'warehouse', at: at(4.2, 0), label: 'trip history', sub: 'nightly retrain' },
        ],
        links: [link('dispatch', 'eta', { label: 'hex pair + time' }), link('train', 'eta', { label: 'weights', style: 'dashed' })],
        flows: [
          { path: ['dispatch', 'eta'], tone: 'request', label: 'ETA(a, b)?', duration: 1.4 },
          { path: ['eta', 'dispatch'], tone: 'response', label: '214 s', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Model features',
          icon: 'Cpu',
          rows: [
            { text: 'Origin and drop hex' },
            { text: 'Time of day, weekday' },
            { text: 'Live traffic score' },
            { text: 'Historical median, this pair' },
          ],
          footer: { text: 'Answer in ms, retrain nightly', tone: 'good' },
        },
        caption: 'Prediction beats pathfinding here',
      },
    },
    {
      title: 'City shards',
      tag: 'concept',
      heading: 'Shard by city, because a match never crosses one',
      eli5: 'Each town gets its own taxi office, wall map and ledger. A kid in one town never needs a car from a town far away, so the offices do not need to talk.',
      body: [
        'A driver in Mumbai never matches a rider in Delhi. So both the geo index (Redis) and trips (Postgres) are sharded by `city_id`. The gateway looks up a driver\'s home city in a small global table and routes the connection to that region.',
        'Cross-city traffic is under 0.1% (airport rides) and goes through a fallback between neighboring city shards. See the sharding lesson for the general rules.',
      ],
      keyIdea: 'Pick the shard key that matches the query. Cities are natural, load-balanced boundaries.',
      metrics: { pings: '1.25M/s (many shards)', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      scene: {
        nodes: [
          { ...api, at: at(-4.2, 0), size: 0.8, sub: 'city lookup' },
          { id: 'mum', kind: 'shard', at: at(0, -3.2), label: 'Mumbai', sub: 'Redis + Postgres', status: 'active' },
          { id: 'del', kind: 'shard', at: at(0, 3.2), label: 'Delhi', sub: 'Redis + Postgres', status: 'active' },
          { id: 'blr', kind: 'shard', at: at(4.2, 0), label: 'Bengaluru', sub: 'Redis + Postgres', status: 'active' },
        ],
        links: [link('api', 'mum'), link('api', 'del'), link('api', 'blr'), link('mum', 'blr', { style: 'faint', label: '< 0.1%' })],
        flows: [
          { path: ['api', 'mum'], tone: 'request', label: 'city_id=MUM', duration: 1.4 },
          { path: ['api', 'del'], tone: 'request', label: 'city_id=DEL', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Shard key',
          icon: 'Split',
          rows: [
            { text: 'geo index', value: 'by city_id' },
            { text: 'trips', value: 'by city_id' },
            { text: 'Cross-city (airports)', value: '< 0.1%', tone: 'muted' },
          ],
        },
        caption: 'One match, one city',
      },
    },
    {
      title: 'Trip history',
      tag: 'concept',
      heading: 'Finished trips and old pings go to the warehouse',
      eli5: 'At night the office copies the day\'s ledger and old map snapshots into a big archive room. Planners use it later to learn where cars should wait.',
      body: [
        'Pings and trips are also written to object storage and a warehouse (see the data warehouse lesson). Trips are 200 GB/day. Raw pings are 22 TB/day, so keep them only as long as analytics and ETA training need.',
        'This is off the hot path. A slow warehouse must never delay a match.',
      ],
      keyIdea: 'Analytics and ML read a copy. The match path never waits on them.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      scene: {
        nodes: [
          { ...pings, at: at(-4.2, 0), badge: '22 TB/day' },
          { id: 'lake', kind: 'storage', at: at(-1.6, -3.2), label: 'object store', sub: 'raw pings, parquet' },
          { id: 'wh', kind: 'warehouse', at: at(4.2, 0), label: 'warehouse', sub: 'trips, features', status: 'ok' },
          { ...trips, at: at(1.6, 3.2), chips: ['200 GB/day'] },
        ],
        links: [link('pings', 'lake', { style: 'dashed' }), link('trips', 'wh', { style: 'dashed' }), link('lake', 'wh')],
        flows: [
          { path: ['pings', 'lake', 'wh'], tone: 'data', label: 'batch', duration: 2 },
          { path: ['trips', 'wh'], tone: 'data', label: 'CDC', duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'Where history goes',
          icon: 'Warehouse',
          rows: [
            { text: 'Raw pings, 22 TB/day', value: 'short retention', tone: 'warn' },
            { text: 'Trips, 200 GB/day', value: '~70 TB/yr' },
            { text: 'Used for', value: 'ETA, surge, fraud, BI' },
          ],
        },
        caption: 'Off the hot path',
      },
    },
    {
      title: 'Failures',
      tag: 'case',
      heading: 'When a Redis shard, a dispatcher or a phone dies',
      eli5: 'If one town\'s wall map falls down, the helpers re-pin every car from the shout funnel. If a lady faints holding a flag, the flag melts after a bit and the car is free again.',
      body: [
        '**Redis shard lost:** a replica takes over and the ping log replays the last seconds, so drivers reappear within one 4 s cycle. A lock lost in failover is caught by the unique index on active trips.',
        '**Dispatcher crash:** its locks expire in 30 s and the request retries by idempotency key. **Driver app crash:** the lock times out and the stale score drops the driver. **Gateway loss:** the phone reconnects, sticky by driver id.',
      ],
      keyIdea: 'Every piece of in-memory state has an expiry or a replayable log behind it, and the database constraint guards the one thing that must never break.',
      metrics: { pings: '1.25M/s', read: '~2 ms', match: '1.9 s p99', safety: '0' },
      metricTones: { match: 'warn', safety: 'good' },
      scene: {
        nodes: [
          { ...geo, status: 'down', chips: [{ text: 'primary lost', tone: 'bad' }] },
          { id: 'geo2', kind: 'replica', at: at(0, 0), label: 'geo replica', sub: 'promoted', status: 'ok', chips: [{ text: 'takes over', tone: 'good' }] },
          { ...pings, status: 'active', chips: ['replay last 30 s'] },
          { ...dispatch, status: 'active', chips: ['retries by key'] },
        ],
        links: [link('pings', 'geo2', { label: 'replay' }), link('dispatch', 'geo2'), link('geo', 'geo2', { style: 'faint', label: 'failover' })],
        flows: [
          { path: ['pings', 'geo2'], tone: 'event', label: 'rebuild', duration: 1.6 },
          { path: ['dispatch', 'geo2'], tone: 'request', label: 'nearby', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Failure and recovery',
          icon: 'Shield',
          rows: [
            { text: 'Redis shard', value: 'replica + replay', tone: 'good' },
            { text: 'Dispatcher', value: 'locks expire, retry', tone: 'good' },
            { text: 'Lost lock', value: 'unique index rejects', tone: 'good' },
            { text: 'Driver app', value: 'stale score drops it', tone: 'good' },
            { text: 'Gateway', value: 'reconnect elsewhere', tone: 'good' },
          ],
        },
        caption: 'Heals inside one ping cycle',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: the index decides what is cheap',
      eli5: 'The taxi office keeps a map of squares, never reads the whole list, and puts a flag on a car before offering it. Each town has its own office, and flags melt if a lady faints.',
      body: [
        'Write 1.25M pings/s through a gateway and a log into an in-memory cell index. Read by cell plus neighbors, rank 20 to 50 candidates by ETA, and claim one with `SET NX EX` so no driver is double-booked.',
        'Trips are durable in Postgres. Surge and ETA come from stream and model jobs. Shard by city and use TTLs and replays so failures heal on their own.',
      ],
      keyIdea: 'Build the index for the query shape, claim atomically, shard by city, and give every in-memory fact an expiry.',
      metrics: { pings: '1.25M/s', read: '~1 ms', match: '1.4 s p99', safety: '0' },
      metricTones: { pings: 'good', read: 'good', match: 'good', safety: 'good' },
      scene: {
        nodes: [
          { ...rider, status: 'ok' },
          { ...dispatch, status: 'ok' },
          { ...geo, status: 'ok', chips: ['cells + neighbors'] },
          { ...driver, status: 'ok' },
          { ...pings, status: 'ok' },
        ],
        links: [link('rider', 'dispatch'), link('dispatch', 'geo'), link('driver', 'pings'), link('pings', 'geo', { style: 'dashed' })],
        flows: [
          { path: ['rider', 'dispatch', 'geo'], tone: 'request', label: 'near me', duration: 1.8 },
          { path: ['driver', 'pings', 'geo'], tone: 'data', label: 'ping', duration: 1.8, delay: 0.4 },
        ],
        panel: {
          title: 'The design on one card',
          icon: 'List',
          rows: [
            { text: 'Index', value: 'cells + 8 neighbors' },
            { text: 'Ingest', value: 'gateway, log, Redis' },
            { text: 'Claim', value: 'SET NX EX on driver' },
            { text: 'Shard', value: 'city_id' },
          ],
        },
        caption: 'Index, claim, shard, expire',
      },
      quiz: {
        question: 'Two dispatchers pick the same driver at once. What stops a double booking?',
        options: [
          'Each rider is locked in the database',
          'The first atomic `SET NX EX` on the driver wins and the other tries the next driver',
          'The driver app rejects the second offer',
          'The geo index removes the driver on every read',
        ],
        answer: 1,
        explain: 'The claim on the driver is atomic, so exactly one dispatcher gets it. The loser sees a nil reply and moves down its ranked list. The 30 s expiry frees the driver if the winner crashes.',
      },
    },
  ],
};
