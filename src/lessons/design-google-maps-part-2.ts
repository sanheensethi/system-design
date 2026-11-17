import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-7.6, 0), label: 'driver', sub: 'map app' };
const gw: SceneNode = { id: 'gw', kind: 'block', size: 0.8, at: at(-3.8, 0), label: 'API gateway', icon: 'Network', tint: 'violet' };
const routing: SceneNode = { id: 'routing', kind: 'server', at: at(0, 0), label: 'routing service', sub: 'graph in RAM' };
const graph: SceneNode = { id: 'graph', kind: 'storage', at: at(3.8, 0), label: 'road graph', sub: 'one flat graph' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: at(-3.8, -4), label: 'Kafka', sub: 'by session id' };
const traffic: SceneNode = { id: 'traffic', kind: 'block', size: 0.8, at: at(0, 0), label: 'traffic job', sub: 'map matching', icon: 'Activity', tint: 'green' };
const speeds: SceneNode = { id: 'speeds', kind: 'cache', at: at(3.8, 4), label: 'live speeds', sub: 'per road segment' };
const history: SceneNode = { id: 'history', kind: 'warehouse', at: at(-3.8, 4), label: 'trip history', sub: 'time series' };
const eta: SceneNode = { id: 'eta', kind: 'block', size: 0.8, at: at(1.9, 0), label: 'ETA service', sub: 'live + history', icon: 'Timer', tint: 'amber' };
const nav: SceneNode = { id: 'nav', kind: 'block', size: 0.8, at: at(-1.9, 0), label: 'navigation', sub: 'push to phones', icon: 'Signal', tint: 'green' };

const m = (gps: string, route: string, tiles = '1M/s edge, 50K/s origin') => ({ users: '500M', tiles, gps, route, storage: 'TBs (vector)' });
const G = '2M points/s in 130K req/s';

export const designGoogleMapsPart2: Lesson = {
  id: 'design-google-maps-part-2',
  title: 'Design Google Maps (part 2)',
  tagline: 'Route across a continent in a blink, keep ETAs honest with live traffic, and guide drivers turn by turn.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Routing on a road graph: Dijkstra, A-star and why they are too slow at continental scale',
    'Routing tiles at several levels, shortcuts and a region-aware routing fleet',
    'Map matching, live speeds and historical speeds, and how they blend into an ETA',
    'Turn-by-turn guidance, rerouting, pushed traffic updates and offline maps',
    'What happens when the traffic pipeline falls behind at rush hour',
  ],
  metrics: [
    { key: 'users', label: 'Daily users', icon: 'Users' },
    { key: 'tiles', label: 'Tile requests', icon: 'Image' },
    { key: 'gps', label: 'GPS ingest', icon: 'Signal' },
    { key: 'route', label: 'Long route time', icon: 'Timer' },
    { key: 'storage', label: 'Map storage', icon: 'HardDrive' },
  ],
  steps: [
    {
      title: 'Road graph',
      tag: 'concept',
      heading: 'Roads are a graph with travel times as weights',
      eli5: 'To plan a trip, the clerk draws every crossroad as a dot and every street as a line with a number on it: the minutes to drive it. The best trip is the cheapest chain of lines.',
      body: [
        'Roads form a **graph**: intersections are nodes, road segments are directed edges, and each edge weighs its travel time, since a fast highway beats a shorter side street.',
        '**Dijkstra\'s algorithm** grows a frontier outward from the start, always expanding the closest unexplored node, until it reaches the goal.',
      ],
      keyIdea: 'Routing is a shortest-path search where the weight of an edge is time, not distance.',
      metrics: m(G, 'goal < 1 s'),
      scene: {
        nodes: [phone, gw, routing, graph],
        links: [link('phone', 'gw'), link('gw', 'routing'), link('routing', 'graph')],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'A to B', duration: 1.6 },
          { path: ['routing', 'graph'], tone: 'request', label: 'expand closest', count: 3, duration: 1, delay: 1.7 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: 'route', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'The road graph',
          icon: 'Network',
          rows: [
            { text: 'Node', value: 'intersection' },
            { text: 'Edge', value: 'one-way road segment' },
            { text: 'Weight', value: 'seconds to drive' },
            { text: 'Dijkstra', value: 'closest first' },
          ],
        },
        caption: 'Cheapest chain of road segments wins',
      },
    },
    {
      title: 'A-star',
      tag: 'concept',
      heading: 'A-star leans the search toward the goal',
      eli5: 'The clerk checks streets outward from home, but peeks at a compass too. Streets that point toward the destination get checked first, so far fewer dead ends get explored.',
      body: [
        '**A-star** (`A*`) adds a lower bound on the time left: straight-line distance at top speed. The frontier then leans toward the destination instead of growing in a circle.',
        'For a 5 km trip across town, A* explores a few thousand intersections and answers in milliseconds.',
      ],
      keyIdea: 'A* is Dijkstra plus an optimistic guess of the time left, and it never loses correctness if the guess is never too high.',
      metrics: m(G, 'ms (short trip)'),
      metricTones: { route: 'good' },
      scene: {
        nodes: [phone, gw, { ...routing, status: 'ok', badge: 'few thousand nodes' }, graph],
        links: [link('phone', 'gw'), link('gw', 'routing'), link('routing', 'graph')],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: '5 km across town', duration: 1.6 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: 'a few ms', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Priority of a node',
          icon: 'Code',
          code: 'cost  = time so far\nguess = straight line / top speed\nnext  = lowest cost + guess',
          footer: { text: 'Guess never too high: still optimal', tone: 'good' },
        },
        caption: 'Short trips are easy',
      },
      code: {
        language: 'python',
        title: 'A* on a road graph, with travel time as the cost',
        source: `import heapq, math

TOP_SPEED = 36.0   # m/s, about 130 km/h: never overestimates the time left

def route(graph, coords, start, goal):
    # graph[u] -> [(v, seconds), ...]
    def h(u):                                   # optimistic seconds to goal
        return straight_line_m(coords[u], coords[goal]) / TOP_SPEED

    best = {start: 0.0}
    prev = {}
    frontier = [(h(start), start)]
    while frontier:
        _, u = heapq.heappop(frontier)
        if u == goal:
            return path_from(prev, goal), best[goal]
        for v, secs in graph[u]:
            t = best[u] + secs
            if t < best.get(v, math.inf):       # found a faster way to v
                best[v] = t
                prev[v] = u
                heapq.heappush(frontier, (t + h(v), v))
    return None, math.inf`,
        highlight: [3, 8, 18, 19, 22],
      },
    },
    {
      title: 'Too slow',
      tag: 'problem',
      heading: 'Across a continent, one flat graph is too slow',
      eli5: 'For a trip to the coast, the clerk unrolls one giant **street map** with every alley and checks street after street outward from home. Fine for the shops, hopeless for the coast.',
      body: [
        'For a 1,000 km drive A* still explores millions of nodes, because every local street near the corridor looks plausible. The road graph of a whole continent needs tens of GB of RAM in one process.',
        'At 7,000 route requests per second, many of them long, that means seconds per request and a fleet of very large machines. The search has to stop looking at side streets in the middle of the trip.',
      ],
      keyIdea: 'On a flat graph of every street, the work grows with the size of the region between the two points.',
      metrics: m(G, '~5 s'),
      metricTones: { route: 'bad' },
      scene: {
        nodes: [
          { ...phone, chips: ['Chicago to Denver'] },
          gw,
          { ...routing, status: 'hot', load: 98, badge: 'millions of nodes' },
          { ...graph, status: 'hot', badge: 'tens of GB' },
        ],
        links: [link('phone', 'gw'), link('gw', 'routing'), link('routing', 'graph')],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'Chicago to Denver', duration: 1.5 },
          { path: ['routing', 'graph'], tone: 'request', label: 'expand, expand, expand', count: 5, duration: 1, delay: 1.6 },
          { path: ['routing', 'gw', 'phone'], tone: 'error', label: '5 s later', duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'One 1,000 km route',
          icon: 'Timer',
          rows: [
            { text: 'Nodes explored', value: 'millions', tone: 'bad' },
            { text: 'Graph in RAM', value: 'tens of GB', tone: 'bad' },
            { text: 'Time per request', value: '~5 s', tone: 'bad' },
            { text: 'Peak load', value: '7K routes/s' },
          ],
          footer: { text: 'Every side street gets explored', tone: 'bad' },
        },
        caption: 'The corridor is full of plausible streets',
      },
    },
    {
      title: 'Routing tiles',
      tag: 'concept',
      heading: 'Cut the road graph into routing tiles',
      eli5: 'The planner does not unroll the whole country. The graph is cut into **map pages**, and the planner pulls only the pages this trip touches.',
      body: [
        'Cut the road graph into **routing tiles**, the same idea as map tiles. Each tile holds the nodes and edges inside it plus the edges that cross into its neighbors.',
        'Tiles are built offline from map data, stored in object storage, and loaded on demand into the routing servers\' memory, which keeps the hot ones cached. A server holds only the tiles it needs.',
      ],
      keyIdea: 'Routing tiles make the graph loadable in pieces, so no server needs the whole world in RAM.',
      metrics: m(G, '~5 s'),
      scene: {
        nodes: [
          { id: 'mapdata', kind: 'db', at: at(-7.6, 0), label: 'map data', sub: 'roads, turns' },
          { id: 'builder', kind: 'block', size: 0.8, at: at(-3.8, -4), label: 'tile builder', sub: 'offline job', icon: 'Layers', tint: 'violet' },
          { ...graph, id: 'tiles', at: at(3.8, -4), label: 'routing tiles', sub: 'object storage', badge: 'edges cross tile borders' },
          { ...routing, at: at(0, 4), status: 'active', chips: ['hot tiles in RAM'] },
        ],
        links: [link('mapdata', 'builder'), link('builder', 'tiles'), link('tiles', 'routing', { label: 'on demand' })],
        flows: [
          { path: ['mapdata', 'builder', 'tiles'], tone: 'data', label: 'build tiles', duration: 2 },
          { path: ['tiles', 'routing'], tone: 'data', label: 'load tile', count: 2, duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'A routing tile holds',
          icon: 'Layers',
          rows: [
            { text: 'Nodes inside it', value: 'intersections' },
            { text: 'Edges inside it', value: 'road segments' },
            { text: 'Edges across borders', value: 'link to neighbors' },
          ],
          footer: { text: 'Built offline, loaded on demand', tone: 'muted' },
        },
        caption: 'The graph in pieces',
      },
    },
    {
      title: 'Levels',
      tag: 'concept',
      heading: 'Routing tiles at several levels',
      eli5: 'The planner uses town maps only near home and near the destination, and a **highway map** for the long middle.',
      body: [
        'Build tiles at **several levels**. Level 0 has every street in small tiles. Level 1 keeps arterial roads in larger tiles. Level 2 keeps only highways in very large tiles.',
        'A long route searches local tiles near the origin until it reaches a road that exists on a higher level, climbs, crosses the country on highways, then comes back down to local tiles near the destination. That cuts a flat search of millions of nodes to about **100K nodes**, or roughly 500 ms.',
      ],
      keyIdea: 'Search the detailed graph only near the two ends and a coarse highway graph in between.',
      metrics: m(G, '~500 ms'),
      metricTones: { route: 'good' },
      scene: {
        nodes: [
          { ...routing, at: at(0, -4), status: 'active', badge: '~100K nodes explored' },
          { id: 'l0', kind: 'storage', at: at(-3.8, 4), label: 'level 0', sub: 'all streets', status: 'ok', badge: 'start and end' },
          { id: 'l1', kind: 'storage', at: at(0, 4), label: 'level 1', sub: 'arterial roads', status: 'ok' },
          { id: 'l2', kind: 'storage', at: at(3.8, 4), label: 'level 2', sub: 'highways only', status: 'ok', badge: 'the long middle' },
        ],
        links: [link('routing', 'l0'), link('routing', 'l1'), link('routing', 'l2')],
        flows: [
          { path: ['routing', 'l0'], tone: 'request', label: 'near origin', duration: 1, delay: 0 },
          { path: ['routing', 'l1'], tone: 'request', label: 'climb', duration: 1, delay: 1 },
          { path: ['routing', 'l2'], tone: 'request', label: 'cross the country', duration: 1, delay: 2 },
          { path: ['routing', 'l0'], tone: 'request', label: 'near destination', duration: 1, delay: 3 },
        ],
        panel: {
          title: 'Tile levels',
          icon: 'Layers',
          rows: [
            { text: 'Level 0', value: 'every street, small tiles' },
            { text: 'Level 1', value: 'arterials, larger tiles' },
            { text: 'Level 2', value: 'highways, huge tiles' },
          ],
          footer: { text: '~100K nodes, not millions', tone: 'good' },
        },
        caption: 'Detail at the two ends, highways in between',
      },
    },
    {
      title: 'Shortcuts',
      tag: 'concept',
      heading: 'Shortcut edges make long routes fast',
      eli5: 'The planner also keeps a note saying "from this junction to that one, the best way takes 40 minutes". It jumps across the note instead of walking every street.',
      body: [
        'Production routers also precompute shortcut edges between important nodes (contraction hierarchies is one well-known method), so a query skips even more. The search drops from about 100K nodes to about **20K**, and long routes come back in about **100 ms**.',
        'Shortcut weights depend on travel times. When live traffic changes them, the shortcuts for the affected areas are refreshed every few minutes.',
      ],
      keyIdea: 'Precompute the answers that never change much, so a query only stitches a few pieces together.',
      metrics: m(G, '~100 ms'),
      metricTones: { route: 'good' },
      scene: {
        nodes: [
          { ...phone, chips: ['Chicago to Denver'] },
          gw,
          { ...routing, status: 'ok', badge: '~20K nodes explored' },
          { ...graph, id: 'shortcuts', label: 'shortcut edges', sub: 'precomputed offline' },
        ],
        links: [link('phone', 'gw'), link('gw', 'routing'), link('routing', 'shortcuts')],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'Chicago to Denver', duration: 1.6 },
          { path: ['routing', 'shortcuts'], tone: 'request', label: 'jump', count: 2, duration: 1, delay: 1.7 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: '100 ms', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'Long route search',
          icon: 'Route',
          rows: [
            { text: 'Flat graph', value: 'millions of nodes', tone: 'bad' },
            { text: 'Tiles at levels', value: '~100K nodes, ~500 ms', tone: 'good' },
            { text: 'Plus shortcuts', value: '~20K nodes, ~100 ms', tone: 'good' },
          ],
          footer: { text: 'Refresh affected shortcuts every few minutes', tone: 'muted' },
        },
        caption: 'Stitch a few precomputed jumps',
      },
    },
    {
      title: 'Routing fleet',
      tag: 'concept',
      heading: 'Send each request to a server that knows the area',
      eli5: 'The desk has several planners, and each one keeps pages for a part of the country on the table. A trip from Chicago goes to the planner who already has Chicago open.',
      body: [
        'Routing servers keep tiles in RAM, so the gateway sends a request to a server that already holds tiles near the origin. When a route leaves its area, the server pulls the other tiles from object storage.',
        'Popular origin and destination pairs repeat, but traffic changes the best answer. Cache results briefly, keyed by the start and end cells, and let the cache expire in minutes.',
      ],
      keyIdea: 'Pin geography to servers for warm caches, and keep any result cache short-lived because traffic moves.',
      metrics: m(G, '~100 ms'),
      metricTones: { route: 'good' },
      scene: {
        nodes: [
          { ...gw, at: at(-5.7, 0) },
          { ...routing, id: 'rw', at: at(-2.5, -4), label: 'routing west', sub: 'Midwest tiles', chips: ['Chicago to Denver'], load: 55 },
          { ...routing, id: 're', at: at(2.5, 4), label: 'routing east', sub: 'Atlantic tiles', chips: ['Boston to NYC'], load: 40 },
          { ...graph, id: 'tiles', at: at(5.7, 0), label: 'routing tiles', sub: 'object storage' },
        ],
        links: [link('gw', 'rw', { label: 'origin in Chicago' }), link('gw', 're', { label: 'origin in Boston' }), link('rw', 'tiles', { style: 'dashed' }), link('re', 'tiles', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'rw'], tone: 'request', label: 'route', duration: 1.4 },
          { path: ['gw', 're'], tone: 'request', label: 'route', duration: 1.4, delay: 1.5 },
          { path: ['tiles', 'rw'], tone: 'data', label: 'other tiles', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Routing fleet',
          icon: 'Server',
          rows: [
            { text: 'Pick server by', value: 'origin cell' },
            { text: 'Tiles in RAM', value: 'its own region' },
            { text: 'Other tiles', value: 'pulled on demand' },
            { text: 'Result cache', value: 'minutes' },
          ],
        },
        caption: 'Warm tiles, short-lived results',
      },
    },
    {
      title: 'Map matching',
      tag: 'concept',
      heading: 'Map matching: from noisy points to road segments',
      eli5: 'Drivers\' cards say roughly where they were, but the pen wobbles. A back-room clerk redraws each trip on the real street map and writes down how fast cars moved on each street.',
      body: [
        'The traffic job **map-matches** each batch. GPS is noisy, so it snaps the whole trace to the most likely sequence of road segments instead of picking the nearest road for each point.',
        'It then computes an average speed per segment per minute and writes it to the **live speeds** store, a few GB in memory keyed by segment id.',
      ],
      keyIdea: 'Match whole traces to roads, then reduce them to one speed per segment per minute.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [{ ...kafka, at: at(-3.8, 0) }, { ...traffic, at: at(0, 0), status: 'active' }, { ...speeds, at: at(3.8, 0), status: 'ok', badge: 'updated each minute' }],
        links: [link('kafka', 'traffic'), link('traffic', 'speeds')],
        flows: [
          { path: ['kafka', 'traffic'], tone: 'event', label: 'GPS batches', count: 3, duration: 1.4 },
          { path: ['traffic', 'speeds'], tone: 'event', label: 'segment speeds', count: 2, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Per batch',
          icon: 'Activity',
          rows: [
            { text: 'Raw points', value: 'noisy, about 5 m off' },
            { text: 'Snap to roads', value: 'likeliest path' },
            { text: 'Speed', value: 'per segment, per minute' },
            { text: 'Store', value: 'few GB in memory' },
          ],
        },
        caption: 'Points in, segment speeds out',
      },
    },
    {
      title: 'History',
      tag: 'concept',
      heading: 'History: the usual speed at this hour',
      eli5: 'The desk also keeps notes on how busy each street usually is on a Monday morning or a Saturday night. It trusts these notes when the board is stale or the trip is far in the future.',
      body: [
        '**History** gives the usual speed of each segment by day of week and time of day, built offline from months of trips.',
        'It is the fallback when live data is missing or old, and the better guide for roads the driver reaches later in the trip.',
      ],
      keyIdea: 'History turns months of trips into a typical speed per segment, per weekday and hour.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [
          { ...history, at: at(-3.8, 0) },
          { id: 'hjob', kind: 'block', size: 0.8, at: at(0, 0), label: 'offline job', sub: 'nightly', icon: 'Clock', tint: 'blue', status: 'active' },
          { id: 'usual', kind: 'storage', at: at(3.8, 0), label: 'usual speeds', sub: 'segment, weekday, hour' },
        ],
        links: [link('history', 'hjob'), link('hjob', 'usual')],
        flows: [
          { path: ['history', 'hjob'], tone: 'data', label: 'months of trips', count: 3, duration: 1.4 },
          { path: ['hjob', 'usual'], tone: 'data', label: 'averages', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'One segment, two hours',
          icon: 'Table',
          rows: [
            { text: 'Mon 08:00, I-90 seg 4412', value: '34 km/h', tone: 'bad' },
            { text: 'Sat 08:00, same segment', value: '88 km/h', tone: 'good' },
          ],
          footer: { text: 'Same road, different usual speed', tone: 'muted' },
        },
        caption: 'Months of trips, averaged',
      },
    },
    {
      title: 'ETA blend',
      tag: 'concept',
      heading: 'ETA: live traffic for now, history for later',
      eli5: 'A **traffic board** shows how fast each road moves right now. For roads the trip reaches in an hour, the planner trusts the usual-speed notes more, because today\'s jam may be gone by then.',
      body: [
        'A route\'s ETA is the sum of its segment times. Near the start, live speed dominates. For a segment the driver reaches in 40 minutes, the estimate leans toward history, because today\'s jam may have cleared by then.',
        'Routing searches on an in-memory snapshot of these blended weights. The ETA service re-times only the final 2 to 3 candidates, with arrival time per segment, turn and light penalties and learned corrections.',
      ],
      keyIdea: 'Use live speeds for the next few minutes of the trip and historical patterns for the parts you will reach later.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [
          { ...routing, at: at(-7.6, 0) },
          { ...eta, at: at(-1.9, 0), status: 'active', badge: '42 min' },
          { ...speeds, at: at(3.8, -4), status: 'ok' },
          { ...history, at: at(3.8, 4) },
        ],
        links: [link('routing', 'eta'), link('eta', 'speeds'), link('eta', 'history', { style: 'dashed' })],
        flows: [
          { path: ['routing', 'eta'], tone: 'request', label: '2 to 3 finalists', duration: 1.2 },
          { path: ['eta', 'speeds'], tone: 'request', label: 'now', duration: 1.2, delay: 1.3 },
          { path: ['eta', 'history'], tone: 'request', label: 'Tue 17:40', duration: 1.2, delay: 1.5 },
          { path: ['eta', 'routing'], tone: 'response', label: '42, 47, 51 min', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Weight on live speed',
          icon: 'Gauge',
          rows: [
            { text: 'Segment in 2 min', value: 'live 100%', tone: 'good' },
            { text: 'Segment in 15 min', value: 'live 50%, history 50%' },
            { text: 'Segment in 40 min', value: 'history 90%', tone: 'warn' },
          ],
        },
        caption: 'Live near the start, history further out',
      },
      quiz: {
        question: 'A road segment 40 minutes ahead on your route has a jam right now. How should the ETA treat it?',
        options: [
          'Use the live speed in full, because it is the newest data',
          'Lean on the historical speed for that hour, since the jam may have cleared by the time you arrive',
          'Ignore the segment',
          'Use the posted speed limit',
        ],
        answer: 1,
        explain: 'Live speed describes now, and the driver reaches that segment in 40 minutes. History for that weekday and hour predicts the future better. Near the start of the trip, live speed wins.',
      },
    },
    {
      title: 'Route choices',
      tag: 'concept',
      heading: 'Weights steer routes around jams',
      eli5: 'The planner uses the same blended minutes on every street, so jammed streets look expensive and get skipped. It hands over a few good trips, and the visitor picks.',
      body: [
        'Routing uses the blended times as edge weights, so routes steer around jams. It returns up to three routes: the best, plus alternatives found by penalizing the best route\'s edges and searching again (one common method).',
        'The router reads those weights from an in-memory snapshot of the speeds store, refreshed every minute or so, because it cannot make a network call per edge. The ETA service then refines only the finalists and the app shows them side by side.',
      ],
      keyIdea: 'The same live and historical times drive both route choice and arrival time.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [phone, { ...routing, at: at(-1.9, -4), status: 'active' }, { ...speeds, at: at(3.8, -4), status: 'ok', badge: 'snapshot in RAM' }, { ...eta, at: at(-1.9, 4), status: 'active' }],
        links: [link('phone', 'routing'), link('routing', 'speeds', { label: 'edge weights' }), link('routing', 'eta', { arrow: 'both' })],
        flows: [
          { path: ['phone', 'routing'], tone: 'request', label: 'GET /routes', duration: 1.4 },
          { path: ['speeds', 'routing'], tone: 'data', label: 'blended weights', duration: 1.2, delay: 1.5 },
          { path: ['routing', 'eta'], tone: 'request', label: 'finalists', duration: 1.2, delay: 2.8 },
          { path: ['eta', 'routing', 'phone'], tone: 'response', label: '42, 47, 51 min', duration: 1.8, delay: 4.2 },
        ],
        panel: {
          title: 'What the phone shows',
          icon: 'Route',
          rows: [
            { text: 'Route A, via highway', value: '42 min', tone: 'good' },
            { text: 'Route B, via arterials', value: '47 min' },
            { text: 'Route C, avoids tolls', value: '51 min' },
          ],
        },
        caption: 'Up to three timed candidates',
      },
    },
    {
      title: 'Turn by turn',
      tag: 'concept',
      heading: 'The phone guides, even without a signal',
      eli5: 'The driver carries the trip on paper and reads out each turn on their own, so they do not need to call the desk at every corner.',
      body: [
        'The route response carries the full geometry and the list of maneuvers, so the phone guides the driver locally. It matches its own GPS to the route and says "in 300 m, turn left" without a server round trip.',
        'That keeps guidance working through tunnels and dead zones.',
      ],
      keyIdea: 'Send the whole route once and let the phone do the guidance.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [{ ...phone, status: 'active', chips: ['in 300 m, turn left'] }, { ...gw, status: 'dim' }, { ...routing, status: 'dim' }],
        links: [link('phone', 'gw', { style: 'faint' }), link('gw', 'routing', { style: 'faint' })],
        flows: [{ path: ['routing', 'gw', 'phone'], tone: 'response', label: 'geometry + maneuvers', duration: 2 }],
        panel: {
          title: 'Route response',
          icon: 'Braces',
          code: '{ "eta_s": 2520,\n  "geometry": "encoded polyline",\n  "maneuvers": [\n    { "turn": "left", "in_m": 300,\n      "street": "S Wacker Dr" } ] }',
          footer: { text: 'No server call for each turn', tone: 'good' },
        },
        caption: 'One download, local guidance',
      },
    },
    {
      title: 'Rerouting',
      tag: 'concept',
      heading: 'Off route: ask for a new route from here',
      eli5: 'If the driver takes a wrong turn, they call the desk and say "I am here now, what next?". The planner starts a fresh trip from that corner.',
      body: [
        '**Off route**: when the phone stays away from the route line for a few seconds, it asks the routing service for a new route from where it is now.',
        'It is an ordinary route request from a new starting point, so it comes back in about the same 100 ms.',
      ],
      keyIdea: 'A reroute is just a new route request from the current position.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [{ ...phone, status: 'active', badge: 'missed a turn' }, gw, { ...routing, status: 'active' }],
        links: [link('phone', 'gw'), link('gw', 'routing')],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'reroute from here', duration: 1.6 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: 'new route', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Off-route rule',
          icon: 'Route',
          rows: [
            { text: 'Away from the line for', value: 'a few seconds' },
            { text: 'Action', value: 'new route request' },
            { text: 'Latency', value: '~100 ms', tone: 'good' },
          ],
        },
        caption: 'The phone decides, the server answers',
      },
    },
    {
      title: 'Push updates',
      tag: 'concept',
      heading: 'The server pushes traffic news',
      eli5: 'If the desk hears of a crash ahead, a **messenger** runs to the driver first and says "there is a faster way now".',
      body: [
        'The **navigation service** holds a push connection to each navigating phone (the real-time delivery lesson). An index maps road segments to active sessions. When a segment speed changes a lot, only sessions whose route crosses it are re-evaluated against alternatives. The rest are throttled to one check every 10 minutes.',
        'That is about 3K re-checks per second for 2M phones, which sits inside the 7K routes per second peak. It pushes a suggestion if one saves enough time, plus a fresh arrival time either way.',
      ],
      keyIdea: 'The phone owns guidance and off-route detection. The server pushes what only it can know: traffic changes ahead.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [
          { ...speeds, at: at(-7.6, 0), badge: 'jam on I-90', status: 'hot' },
          { ...nav, at: at(-1.9, 0), status: 'active', badge: 'jam ahead: -6 min' },
          { ...routing, at: at(3.8, -4) },
          { ...phone, at: at(3.8, 4), status: 'active' },
        ],
        links: [link('speeds', 'nav'), link('nav', 'routing'), link('nav', 'phone', { style: 'dashed', label: 'push' })],
        flows: [
          { path: ['speeds', 'nav'], tone: 'event', label: 'new jam', duration: 1.4 },
          { path: ['nav', 'routing', 'nav'], tone: 'request', label: 'compare', duration: 1.6, delay: 1.5 },
          { path: ['nav', 'phone'], tone: 'event', label: 'faster route?', duration: 1.4, delay: 3.2 },
        ],
        panel: {
          title: 'Navigation service',
          icon: 'Signal',
          rows: [
            { text: 'Connection', value: 'push, per phone' },
            { text: 'Checks', value: 'sessions on a changed segment' },
            { text: 'Others', value: 'throttled, every ~10 min' },
            { text: 'Re-check rate', value: '~3K/s, within 7K/s peak', tone: 'good' },
            { text: 'Pushes', value: 'a better route if it saves enough' },
            { text: 'Always', value: 'fresh arrival time' },
          ],
        },
        caption: 'Traffic news travels to the phone',
      },
    },
    {
      title: 'Offline maps',
      tag: 'concept',
      heading: 'Offline maps: take the region with you',
      eli5: 'Before a trip into the hills, the visitor takes home a folder of map pages and a highway map, so they can find their way with no phone line.',
      body: [
        'The phone can download a region: its vector tiles, its routing tiles and an address index. Vector tiles are small, so a city is often tens to hundreds of MB.',
        'Routing then runs on the device over the downloaded tiles, using historical speeds only. Live traffic and fresh closures need a connection.',
      ],
      keyIdea: 'The same tiles that serve the cloud can be packaged and run on the phone, at the cost of freshness.',
      metrics: m(G, '~100 ms'),
      scene: {
        nodes: [
          { ...phone, status: 'active', badge: 'no signal' },
          { ...{ id: 'cdn', kind: 'cdn' as const, label: 'CDN edge', sub: 'region download' }, at: at(-1.9, -4) },
          { id: 'pack', kind: 'storage', at: at(3.8, 4), label: 'region pack', sub: 'on the phone', status: 'ok', badge: 'tiles + routing + index' },
        ],
        links: [link('phone', 'cdn', { label: 'on Wi-Fi' }), link('phone', 'pack', { style: 'dashed' })],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'download Chicago', duration: 1.4 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'region pack', count: 3, duration: 1.6, delay: 1.5 },
          { path: ['pack', 'phone'], tone: 'data', label: 'route offline', duration: 1.4, delay: 3.3 },
        ],
        panel: {
          title: 'Offline trade-offs',
          icon: 'Download',
          rows: [
            { text: 'Map and search', value: 'works', tone: 'good' },
            { text: 'Routing', value: 'works, usual speeds', tone: 'good' },
            { text: 'Live traffic', value: 'missing', tone: 'warn' },
            { text: 'Fresh closures', value: 'missing', tone: 'warn' },
          ],
        },
        caption: 'Everything static travels with the phone',
      },
    },
    {
      title: 'Rush hour lag',
      tag: 'case',
      heading: 'Case: a snowstorm hits at 5 pm',
      eli5: 'At 5 pm the cards pile up faster than the back room can read them, so the **traffic board** shows roads as they were ten minutes ago.',
      body: [
        'More people navigate, uploads rise to **2.6M points per second**, and map matching gets slower because traces are messy. Consumer lag on Kafka grows to 10 minutes.',
        'Live speeds now describe the roads as they were at 4:50, and ETAs start promising arrival times that are far too early.',
      ],
      keyIdea: 'A slow consumer means derived data ages silently unless something measures its age.',
      metrics: m('2.6M points/s (storm)', '~100 ms'),
      metricTones: { gps: 'bad' },
      scene: {
        nodes: [
          { ...phone, status: 'active', badge: 'snow, more trips' },
          { ...kafka, at: at(-3.8, -4), status: 'hot', badge: 'lag 10 min' },
          { ...traffic, at: at(0, 0), status: 'hot', load: 97 },
          { ...speeds, at: at(3.8, 4), status: 'down', badge: 'stale: 4:50 pm' },
        ],
        links: [link('phone', 'kafka'), link('kafka', 'traffic'), link('traffic', 'speeds')],
        flows: [
          { path: ['phone', 'kafka'], tone: 'event', label: '2.6M/s', count: 5, duration: 1.4 },
          { path: ['kafka', 'traffic'], tone: 'event', label: 'backlog', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'The storm at 5 pm',
          icon: 'Activity',
          rows: [
            { text: 'GPS points', value: '2.6M/s', tone: 'warn' },
            { text: 'Kafka consumer lag', value: '10 min', tone: 'bad' },
            { text: 'Live speeds are from', value: '4:50 pm', tone: 'bad' },
          ],
          footer: { text: 'ETAs too early', tone: 'bad' },
        },
        caption: 'Live speeds fall ten minutes behind',
      },
    },
    {
      title: 'Stale speeds',
      tag: 'case',
      heading: 'Stamp data with its age and fall back',
      eli5: 'Every note on the traffic board has a time written on it. When a note is too old, the planner ignores it and trusts the usual-speed notes until the board catches up.',
      body: [
        'Every live speed carries a timestamp. When it is older than a few minutes, the ETA service weights it down, leans on history for that hour, and the app marks traffic as delayed. History knows nothing about snow, so stale data is blended with a conservative slowdown factor, the ETA range widens, and the app flags low confidence.',
        'Tiles never depended on traffic, and routing keeps working on historical weights. A slow subsystem makes answers less precise, and the map stays up.',
      ],
      keyIdea: 'Stamp derived data with its age, and have every reader fall back to a cautious default when it is too old.',
      metrics: m('2.6M points/s (storm)', '~100 ms'),
      metricTones: { route: 'good' },
      scene: {
        nodes: [
          { ...speeds, at: at(-3.8, -4), status: 'down', badge: 'stale: 4:50 pm' },
          { ...history, at: at(-3.8, 4), status: 'ok' },
          { ...eta, at: at(1.9, 0), status: 'active', badge: 'fallback: history' },
          { ...routing, at: at(7.6, 0), status: 'ok' },
        ],
        links: [link('eta', 'speeds', { style: 'faint' }), link('eta', 'history'), link('routing', 'eta')],
        flows: [
          { path: ['eta', 'speeds'], tone: 'error', label: 'too old', duration: 1.2 },
          { path: ['eta', 'history'], tone: 'request', label: 'use history', duration: 1.2, delay: 1.3 },
          { path: ['eta', 'routing'], tone: 'response', label: 'ETA, lower confidence', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Degrade by layer',
          icon: 'Shield',
          rows: [
            { text: 'Tiles', value: 'unaffected', tone: 'good' },
            { text: 'Routing', value: 'historical weights', tone: 'good' },
            { text: 'ETA', value: 'history + slowdown, wider range', tone: 'warn' },
            { text: 'App', value: 'flags low confidence', tone: 'warn' },
            { text: 'Live speeds', value: 'ignored when old', tone: 'bad' },
          ],
        },
        caption: 'Precision drops, the map stays up',
      },
    },
    {
      title: 'Catching up',
      tag: 'case',
      heading: 'Kafka holds the backlog while consumers scale out',
      eli5: 'The conveyor belt keeps every card safe while more back-room clerks join. Each clerk takes one lane of the belt, so there must be spare lanes ready.',
      body: [
        'Kafka buffers the backlog, so the location service keeps accepting uploads and no points are lost.',
        'Meanwhile the traffic job scales out, up to one consumer per partition, which is why the topic was created with spare partitions. When lag reaches zero, live speeds are fresh again.',
      ],
      keyIdea: 'A durable stream turns a surge into a delay, and spare partitions let consumers scale to clear it.',
      metrics: m('2.6M points/s (storm)', '~100 ms'),
      scene: {
        nodes: [
          { id: 'locsvc', kind: 'block', size: 0.8, at: at(-7.6, 0), label: 'location', sub: 'still accepting', icon: 'Signal', tint: 'blue', status: 'ok' },
          { ...kafka, at: at(-3.8, -4), status: 'hot', badge: 'lag 10 min' },
          { ...traffic, at: at(0, 0), status: 'hot', badge: 'scaling 40 to 96', load: 90 },
          { ...speeds, at: at(3.8, 4), status: 'active', badge: 'catching up' },
        ],
        links: [link('locsvc', 'kafka'), link('kafka', 'traffic'), link('traffic', 'speeds')],
        flows: [
          { path: ['locsvc', 'kafka'], tone: 'event', label: 'still accepted', count: 4, duration: 1.4 },
          { path: ['kafka', 'traffic', 'speeds'], tone: 'event', label: 'more consumers', count: 3, duration: 2.4, delay: 1.5 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Workflow',
          rows: [
            { text: 'Uploads', value: 'accepted, none lost', tone: 'good' },
            { text: 'Traffic consumers', value: '40 to 96', tone: 'warn' },
            { text: 'Max consumers', value: 'one per partition' },
          ],
          footer: { text: 'Lag back to zero: speeds fresh', tone: 'good' },
        },
        caption: 'Scale out the readers, not the writers',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 2 recap: a layered graph and honest ETAs',
      eli5: 'Plan long trips on the highway map, mix the live board with the usual notes, let the driver read the turns, and keep the board honest about how old it is.',
      body: [
        'Routing runs A* over **routing tiles** at several levels with shortcut edges, so a cross-country route touches about 20K nodes and returns in about 100 ms. ETAs blend live segment speeds with history.',
        'The phone handles turn-by-turn and off-route detection, and the navigation service pushes better routes. When the traffic stream lags, stale speeds are detected by age and ETAs fall back to history.',
      ],
      keyIdea: 'Search a hierarchy instead of the whole world, and make every derived input carry its age.',
      metrics: m(G, '~100 ms'),
      metricTones: { route: 'good', gps: 'good' },
      scene: {
        nodes: [
          phone,
          { ...gw, at: at(-3.8, -4) },
          { ...routing, at: at(3.8, -4), status: 'ok' },
          { ...eta, at: at(3.8, 4), status: 'ok' },
          { ...nav, at: at(-3.8, 4), status: 'ok' },
        ],
        links: [link('phone', 'gw'), link('gw', 'routing'), link('routing', 'eta', { arrow: 'both' }), link('nav', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'route', duration: 1.8 },
          { path: ['routing', 'eta', 'routing'], tone: 'request', label: 'time it', duration: 1.6, delay: 1.9 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: 'route + ETA', duration: 1.8, delay: 3.6 },
          { path: ['nav', 'phone'], tone: 'event', label: 'faster route?', duration: 1.4, delay: 5.4 },
        ],
        panel: {
          title: 'Part 2 numbers',
          icon: 'Table',
          rows: [
            { text: 'Flat graph, long route', value: '~5 s', tone: 'bad' },
            { text: 'Tiles, levels, shortcuts', value: '~100 ms', tone: 'good' },
            { text: 'Reroute', value: '~100 ms', tone: 'good' },
            { text: 'Stale speeds', value: 'fall back to history', tone: 'warn' },
          ],
        },
        caption: 'Layered search, timed routes, honest ETAs',
      },
      quiz: {
        question: 'Cross-country routes take 5 s on a single graph of every street. Which change fixes the cause?',
        options: [
          'Add more CDN edges',
          'Switch from A* to Dijkstra',
          'Split the graph into routing tiles at several levels, so only the ends use local streets and the middle uses a highway-only graph',
          'Upload GPS points every second instead of every 15 seconds',
        ],
        answer: 2,
        explain: 'The slow part is exploring millions of local streets along the corridor. A hierarchy of routing tiles limits detailed search to the two ends. Dijkstra explores even more than A*, and the CDN and GPS changes do not touch routing at all.',
      },
    },
  ],
};
