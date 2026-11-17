import type { Lesson, SceneNode, SceneZone } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const phone: SceneNode = { id: 'phone', kind: 'phone', at: p(-9.5, 0.5), label: 'driver', sub: 'map app' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: p(-5.5, -4.5), label: 'CDN edge', sub: 'tile cache' };
const gw: SceneNode = { id: 'gw', kind: 'gateway', at: p(-5.5, 1.5), label: 'API gateway' };
const tilestore: SceneNode = { id: 'tilestore', kind: 'storage', at: p(-1, -7), label: 'tile store', sub: 'object storage' };
const render: SceneNode = { id: 'render', kind: 'worker', at: p(3, -6.5), label: 'tile renderer', sub: 'batch job' };
const mapdata: SceneNode = { id: 'mapdata', kind: 'db', at: p(7, -6.5), label: 'map data', sub: 'roads, names, POIs' };
const locsvc: SceneNode = { id: 'locsvc', kind: 'service', at: p(-1.5, -2.5), label: 'location service', sub: 'thin, stateless' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: p(2.5, -2), label: 'Kafka', sub: 'by session id' };
const traffic: SceneNode = { id: 'traffic', kind: 'worker', at: p(6.5, -2.5), label: 'traffic job', sub: 'map matching' };
const history: SceneNode = { id: 'history', kind: 'warehouse', at: p(10, -4), label: 'trip history', sub: 'time series' };
const speeds: SceneNode = { id: 'speeds', kind: 'cache', at: p(10, 1), label: 'live speeds', sub: 'per road segment' };
const routing: SceneNode = { id: 'routing', kind: 'server', at: p(-1.5, 3.5), label: 'routing service', sub: 'graph in RAM' };
const graph: SceneNode = { id: 'graph', kind: 'storage', at: p(2.5, 6.5), label: 'routing tiles', sub: 'level 0: all streets' };
const arterial: SceneNode = { id: 'arterial', kind: 'storage', at: p(6.5, 3.5), label: 'level 1 tiles', sub: 'arterial roads' };
const hwy: SceneNode = { id: 'hwy', kind: 'storage', at: p(10, 0), label: 'level 2 tiles', sub: 'highways only' };
const eta: SceneNode = { id: 'eta', kind: 'service', at: p(6, 4), label: 'ETA service', sub: 'live + history' };
const nav: SceneNode = { id: 'nav', kind: 'server', at: p(2.5, 1.5), label: 'navigation service', sub: 'push to phones' };
const geocode: SceneNode = { id: 'geocode', kind: 'search', at: p(-1.5, 9), label: 'geocoder', sub: 'address index' };

const zoneTiles: SceneZone = { id: 'ztiles', from: [-5.8, -3.8], to: [-3.3, 1.2], label: 'static: tiles', tone: 'blue' };

export const designGoogleMaps: Lesson = {
  id: 'design-google-maps',
  title: 'Design Google Maps',
  tagline: 'Draw the whole planet at any zoom, route across a continent in a blink, and keep ETAs honest with live traffic.',
  minutes: 26,
  level: 'Advanced',
  learn: [
    'Map tiles per zoom level, pre-rendered and served from a CDN, and how big the world map really is',
    'Raster versus vector tiles, and why modern apps ship data instead of pictures',
    'Batching GPS points on the phone and streaming them through Kafka on the server',
    'Routing on a road graph cut into routing tiles at several levels, so long routes stay fast',
    'ETAs from live traffic and history, rerouting during navigation, and geocoding addresses',
  ],
  metrics: [
    { key: 'users', label: 'Daily users' },
    { key: 'tiles', label: 'Tile requests' },
    { key: 'gps', label: 'GPS ingest' },
    { key: 'route', label: 'Long route time' },
    { key: 'storage', label: 'Map storage' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A map, a route and a voice that says turn left',
      eli5: 'A busy **travel desk** hands out map pages, plans trips and listens to drivers calling in where they are. Half a billion people use it every day, and each one wants an answer before the light turns green.',
      body: [
        'Four features matter. Show a map the user can pan and zoom. Turn a typed address into a point on the map. Find a route with an arrival time (ETA). Guide a driver turn by turn and reroute when traffic changes or they miss a turn. Reviews, street photos and transit timetables are out of scope.',
        'Scale targets: **500M daily users**. Map views drive about **1M tile requests per second** at peak. About 200M route requests a day, around **7,000 per second** at peak counting reroutes. At rush hour about **2M phones navigate at once**, each taking a GPS fix every second.',
        'Latency targets: tiles appear in under 200 ms, routes return in under 1 s, and an ETA for an hour drive is right to within a few minutes. Freshness differs by data: a new street may take days to appear, a closed road should change routes within minutes.',
      ],
      keyIdea: 'Four very different workloads share one app: static pictures, a firehose of GPS writes, heavy graph search and text search.',
      metrics: { users: '500M', tiles: '1M/s peak', gps: '2M points/s', route: 'goal < 1 s', storage: '-' },
      scene: {
        nodes: [phone, cdn, gw, { ...tilestore, status: 'dim' }, { ...locsvc, status: 'active' }, { ...routing, status: 'active' }],
        links: [
          { from: 'phone', to: 'cdn' },
          { from: 'cdn', to: 'tilestore', style: 'faint' },
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'locsvc' },
          { from: 'gw', to: 'routing' },
        ],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'tiles', count: 4, duration: 1 },
          { path: ['phone', 'gw', 'locsvc'], tone: 'event', label: 'GPS', count: 3, duration: 1.4, delay: 0.5 },
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'route A to B', duration: 1.4, delay: 1.5 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: '42 min', duration: 1.4, delay: 3 },
        ],
        caption: 'Tiles, locations and routes: three very different loads',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'Four endpoints, four kinds of data',
      eli5: 'The desk has four windows: one hands out map pages, one takes "I am here" calls, one plans trips, and one turns a street address into a pin. Each window has its own line and its own **clerks**.',
      body: [
        '`GET /tiles/{version}/{z}/{x}/{y}` returns one tile and is cacheable. `POST /v1/locations` uploads a batch of GPS points. `GET /v1/routes?from=…&to=…&mode=drive` returns up to three routes with ETAs and turn steps. `GET /v1/geocode?q=…` returns candidate places with coordinates.',
        'Everything starts from **map data**: road segments with speed limits and turn rules, names, buildings and places. Offline jobs derive three products from it: rendered tiles in object storage, the road graph for routing, and a geocoding index. Two more kinds of data come from phones: location history, an append-only time series (the time-series databases lesson), and live speeds per road segment, which are small and hot.',
        'Tiles are static files. Locations are a firehose of small writes. Routing burns CPU and memory. Geocoding is a search problem. So each becomes its own service that scales on its own, behind one gateway, with tiles bypassing the gateway entirely through the CDN.',
      ],
      keyIdea: 'Split by workload shape: static files to the CDN, writes to a stream, graph search and text search to their own services.',
      metrics: { users: '500M', tiles: '1M/s peak', gps: '2M points/s', route: 'goal < 1 s', storage: '-' },
      scene: {
        nodes: [phone, cdn, gw, tilestore, locsvc, routing, geocode],
        links: [
          { from: 'phone', to: 'cdn' },
          { from: 'cdn', to: 'tilestore' },
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'locsvc' },
          { from: 'gw', to: 'routing' },
          { from: 'gw', to: 'geocode' },
        ],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'GET /tiles/…', count: 3, duration: 1 },
          { path: ['phone', 'gw', 'locsvc'], tone: 'event', label: 'POST /locations', duration: 1.4, delay: 0.6 },
          { path: ['phone', 'gw', 'geocode'], tone: 'request', label: 'GET /geocode', duration: 1.4, delay: 1.4 },
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'GET /routes', duration: 1.4, delay: 2.4 },
        ],
        caption: 'Tiles skip the gateway, everything else goes through it',
      },
    },
    {
      title: 'Map tiles',
      tag: 'concept',
      heading: 'Cut the world into tiles per zoom level',
      eli5: 'The desk prints every **map page** ahead of time, from one page for the whole world down to one page per city block, and stacks copies by the door. Most visitors grab a page from the stack and never talk to a clerk.',
      body: [
        'The map is cut into square **tiles**. Zoom 0 is the whole world in one tile, and each zoom level splits every tile into four, so zoom z has 4^z tiles. Street level is around zoom 15 to 18. The client works out which tiles cover the screen, fetches them by `z/x/y`, and prefetches a ring around the edges so panning feels instant.',
        'Tiles change only when map data changes, so a batch job **pre-renders** them and writes them to object storage. The URL carries the data version, which makes each tile immutable and safe to cache for weeks at the CDN (the content delivery networks lesson). Cities are hot for everyone, so at a 95% edge hit rate the 1M tile requests per second become about **50,000 per second** at the origin.',
        'How big is the world? Summing 4^z from zoom 0 to 21 gives about **5.9 trillion tiles**. At roughly 20 KB per image that is about **120 PB**. Most of it is never stored: about 70% of the planet is water, and an all-ocean tile is the same image every time, so it is stored once and shared. Deep zooms of empty land can be rendered on demand and cached. The stored set is still petabytes.',
      ],
      keyIdea: 'Tiles turn an infinite map into a finite set of cacheable files, and the CDN absorbs almost all of the traffic.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s', route: 'goal < 1 s', storage: '~120 PB raw raster' },
      scene: {
        nodes: [phone, { ...cdn, status: 'ok', badge: '95% hits' }, { ...tilestore, status: 'active', badge: '5.9T tile slots' }, { ...render, status: 'active' }, mapdata],
        links: [
          { from: 'phone', to: 'cdn' },
          { from: 'cdn', to: 'tilestore' },
          { from: 'render', to: 'tilestore' },
          { from: 'mapdata', to: 'render' },
        ],
        flows: [
          { path: ['mapdata', 'render'], tone: 'data', label: 'new data version', duration: 1.2 },
          { path: ['render', 'tilestore'], tone: 'data', label: 'write tiles', count: 3, duration: 1.2, delay: 1.2 },
          { path: ['phone', 'cdn'], tone: 'request', label: '15/8407/12178', count: 4, duration: 1, delay: 0.4 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'hit', count: 3, duration: 1, delay: 1.5 },
          { path: ['cdn', 'tilestore'], tone: 'request', label: 'rare miss', duration: 1.2, delay: 2.6 },
        ],
        caption: 'Rendered once, cached at the edge, fetched by z/x/y',
      },
      code: {
        language: 'python',
        title: 'From a GPS point to a cacheable tile URL',
        source: `import math

def tile_for(lat, lng, zoom):
    n = 2 ** zoom                                  # tiles per side at this zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)                      # Web Mercator projection
    y = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y

def tile_url(lat, lng, zoom, version="2026-11-10"):
    x, y = tile_for(lat, lng, zoom)
    # The data version is in the path, so a tile never changes once published.
    # A new map release means new URLs, never a purge of old ones.
    return f"https://tiles.example.com/{version}/{zoom}/{x}/{y}.mvt"

print(tile_url(41.88, -87.63, 15))    # .../15/8407/12178.mvt (downtown Chicago)
print(4 ** 15)                        # 1,073,741,824 tiles at zoom 15 alone`,
        highlight: [4, 7, 12, 13, 14],
      },
    },
    {
      title: 'Vector tiles',
      tag: 'tradeoff',
      heading: 'Ship pictures or ship data?',
      eli5: 'An old map page is a finished picture. A **vector page** is a short list of lines and names that the visitor draws with their own pencil, so they can turn it, enlarge it or switch language without coming back to the desk.',
      body: [
        '**Raster tiles** are images rendered on the server. Any device can show them and the client does almost nothing. But style, language and screen density are baked into the pixels: dark mode, a second language or a high-density screen each needs another full tile set to render, store and cache. Zooming between levels looks blurry.',
        '**Vector tiles** carry geometry and attributes: this line is a primary road with this name, this polygon is a park. The phone draws them on its GPU. They are several times smaller than images of the same area, one tile can be drawn at many zoom levels, and the map can rotate, tilt or change style and language on the device. The costs are heavier clients, more battery, and drawing bugs that differ per device.',
        'Mobile map apps today generally use vector tiles and keep raster for satellite imagery and very old clients. Because the client can overzoom, the vector set can stop around zoom 14 to 16, and the stored world drops from petabytes to **terabytes**. CDN bandwidth drops with it.',
      ],
      keyIdea: 'Raster tiles keep clients simple. Vector tiles move drawing to the phone and cut storage and bandwidth by orders of magnitude.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s', route: 'goal < 1 s', storage: 'TBs (vector)' },
      scene: {
        nodes: [
          { ...phone, status: 'active', badge: 'draws on GPU' },
          { ...cdn, status: 'ok', badge: 'small, compressed' },
          { ...tilestore, status: 'ok', badge: 'vector, zoom 0 to 15' },
          render,
          mapdata,
        ],
        links: [
          { from: 'phone', to: 'cdn' },
          { from: 'cdn', to: 'tilestore' },
          { from: 'render', to: 'tilestore' },
          { from: 'mapdata', to: 'render' },
        ],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', count: 2, duration: 1 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'roads, labels, polygons', duration: 1.2, delay: 1.1 },
          { path: ['mapdata', 'render', 'tilestore'], tone: 'data', label: 'encode, no drawing', duration: 2, delay: 0.6 },
        ],
        caption: 'The server ships data, the phone draws the map',
      },
      quiz: {
        question: 'The product team wants dark mode and street names in the reader\'s own language. With raster tiles, what does that cost?',
        options: [
          'Nothing, the CDN handles it',
          'A separate rendered, stored and cached tile set for each style and language combination',
          'Only a new client release',
          'A bigger routing graph',
        ],
        answer: 1,
        explain: 'Raster tiles bake style and labels into pixels, so every combination is another full set to render, store and cache. Vector tiles send the data once and let the client apply style and language.',
      },
    },
    {
      title: 'GPS uploads',
      tag: 'concept',
      heading: 'Batch GPS points on the phone, stream them on the server',
      eli5: 'Drivers do not call the desk every second. They jot their spot on a card each second and hand in a bundle every 15 seconds. The desk drops each bundle on a **conveyor belt** that clerks in the back read at their own pace.',
      body: [
        'A navigating phone takes a GPS fix every second. One request per fix would be 2M requests per second at rush hour and a radio that never sleeps. The phone **batches** instead: it buffers points and uploads every 15 seconds, so about **130,000 requests per second** carry the same 2M points. If an upload fails, the points stay in the buffer for the next try.',
        'The **location service** stays thin: authenticate, validate, append the batch to **Kafka** partitioned by session id, return. Nothing heavy runs on the request path, so it scales by adding copies (the message queues and streams lesson).',
        'Several consumers read the same stream at their own pace. The traffic job turns points into speeds per road segment. A history writer stores trips for training ETA models. Map quality jobs spot roads that are missing from the map. Raw points are personal data, so they get a short retention and are aggregated before anyone analyzes them.',
      ],
      keyIdea: 'Batch on the device to cut requests, then put a durable stream between the write path and every consumer.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s in 130K req/s', route: 'goal < 1 s', storage: 'TBs (vector)' },
      scene: {
        nodes: [
          { ...phone, badge: '15 points per upload' },
          gw,
          { ...locsvc, status: 'active' },
          { ...kafka, status: 'active', badge: '~100 MB/s' },
          { ...traffic, status: 'active' },
          history,
          speeds,
        ],
        links: [
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'locsvc' },
          { from: 'locsvc', to: 'kafka' },
          { from: 'kafka', to: 'traffic' },
          { from: 'kafka', to: 'history', style: 'dashed' },
          { from: 'traffic', to: 'speeds' },
        ],
        flows: [
          { path: ['phone', 'gw', 'locsvc'], tone: 'request', label: 'batch of 15', count: 3, duration: 1.4 },
          { path: ['locsvc', 'kafka'], tone: 'event', label: 'append', count: 3, duration: 0.9, delay: 1.4 },
          { path: ['locsvc', 'gw', 'phone'], tone: 'response', label: '202', duration: 1.2, delay: 2.3 },
          { path: ['kafka', 'traffic', 'speeds'], tone: 'event', duration: 1.6, delay: 2.4 },
          { path: ['kafka', 'history'], tone: 'data', label: 'trips', duration: 1.6, delay: 2.8 },
        ],
        caption: 'One thin write path, many readers of the stream',
      },
      code: {
        language: 'json',
        title: 'POST /v1/locations: one batched upload',
        source: `{
  "session_id": "nav-7f3a91",
  "sent_at": 1763367330,
  "points": [
    { "t": 1763367316, "lat": 41.88012, "lng": -87.63010, "speed": 13.4, "heading": 92, "acc_m": 5 },
    { "t": 1763367317, "lat": 41.88013, "lng": -87.62994, "speed": 13.6, "heading": 92, "acc_m": 5 },
    { "t": 1763367318, "lat": 41.88013, "lng": -87.62977, "speed": 13.9, "heading": 91, "acc_m": 4 }
  ],
  "dropped_points": 0
}`,
        highlight: [2, 4, 5],
      },
    },
    {
      title: 'Geocoding',
      tag: 'concept',
      heading: 'Geocoding: from typed text to a point',
      eli5: 'A visitor says "the bakery on Fifth Street". The clerk looks it up in a thick **address book** that lists every street, house number and shop with its spot on the map.',
      body: [
        '**Geocoding** turns "233 S Wacker Dr, Chicago" into a latitude and longitude. The text is split into parts (number, street, city, postcode), normalized ("Dr" becomes "Drive", case and accents folded) and looked up in a search index of places and street segments (the search index lesson). When the house number itself is missing, it is interpolated along the street segment from the numbers at each end.',
        'People type badly, so ranking matters as much as matching: prefer results near the area on screen, popular places and exact token matches. The answer is a short list of candidates with a confidence each, and the app asks the user to pick when the top two are close.',
        '**Reverse geocoding** goes the other way, from a GPS point to the nearest address, with a geospatial index such as the geohash cells from the proximity service lesson. Popular queries repeat a lot, so a cache in front of the geocoder absorbs much of the load. The chosen point then becomes the destination for routing.',
      ],
      keyIdea: 'Geocoding is search plus geography: parse, normalize, match against an index, rank by place and popularity.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s in 130K req/s', route: 'goal < 1 s', storage: 'TBs (vector)' },
      scene: {
        nodes: [phone, gw, { ...geocode, status: 'active', badge: 'top match 0.97' }, { ...routing, status: 'dim' }],
        links: [
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'geocode' },
          { from: 'gw', to: 'routing', style: 'faint' },
        ],
        flows: [
          { path: ['phone', 'gw', 'geocode'], tone: 'request', label: '"233 s wacker"', duration: 1.6 },
          { path: ['geocode', 'gw', 'phone'], tone: 'response', label: '41.8789, -87.6359', duration: 1.6, delay: 1.8 },
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'route to it', duration: 1.6, delay: 3.6 },
        ],
        caption: 'Text in, ranked candidate points out',
      },
    },
    {
      title: 'Naive routing',
      tag: 'problem',
      heading: 'Shortest path on one giant graph is too slow',
      eli5: 'To plan a trip across the country, a new clerk unrolls one giant **street map** with every alley on it and checks street after street outward from home. Fine for a trip to the shops, hopeless for a trip to the coast.',
      body: [
        'Roads form a **graph**: intersections are nodes, road segments are directed edges, and each edge weighs its travel time, since a fast highway beats a shorter side street. **Dijkstra\'s algorithm** grows a frontier outward from the start, always expanding the closest unexplored node, until it reaches the goal. **A-star** (`A*`) adds a lower bound on the time left (straight-line distance at top speed), so the frontier leans toward the destination.',
        'For a 5 km trip across town, A* explores a few thousand intersections and answers in milliseconds. For a 1,000 km drive it still explores millions of nodes, because every local street near the corridor looks plausible. And the road graph of a whole continent needs tens of GB of RAM in one process.',
        'At 7,000 route requests per second, many of them long, that means seconds per request and a fleet of very large machines. The search has to stop looking at side streets in the middle of the trip.',
      ],
      keyIdea: 'A* is correct and fine for short trips, but on a flat graph of every street its work grows with the size of the region between the two points.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s in 130K req/s', route: '~5 s', storage: 'TBs (vector)' },
      scene: {
        nodes: [phone, gw, { ...routing, status: 'hot', badge: 'millions of nodes explored' }, { ...graph, label: 'road graph', sub: 'one flat graph, every street', status: 'hot', badge: 'tens of GB' }],
        links: [
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'routing' },
          { from: 'routing', to: 'graph' },
        ],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'Chicago to Denver', duration: 1.5 },
          { path: ['routing', 'graph'], tone: 'request', label: 'expand, expand, expand', count: 5, duration: 1, delay: 1.5 },
          { path: ['routing', 'gw', 'phone'], tone: 'error', label: '5 s later', duration: 1.5, delay: 3.6 },
        ],
        caption: 'Every side street along the way gets explored',
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
      title: 'Routing tiles',
      tag: 'concept',
      heading: 'Routing tiles at several levels',
      eli5: 'The planner uses town maps only near home and near the destination, and a **highway map** for the long middle. Each map is cut into pages, and the planner only pulls the pages this trip touches.',
      body: [
        'Cut the road graph into **routing tiles**, the same idea as map tiles. Each tile holds the nodes and edges inside it plus the edges that cross into its neighbors. Tiles are built offline from map data, stored in object storage, and loaded on demand into the routing servers\' memory, which keeps the hot ones cached.',
        'Build them at **several levels**. Level 0 has every street in small tiles. Level 1 keeps arterial roads in larger tiles. Level 2 keeps only highways in very large tiles. A long route searches local tiles near the origin until it reaches a road that exists on a higher level, climbs, crosses the country on highways, then comes back down to local tiles near the destination.',
        'The search now touches thousands of nodes instead of millions, and a server holds only the tiles it needs. Production routers also precompute shortcut edges between important nodes (contraction hierarchies is one well-known method) so a query skips even more. Long routes come back in about **100 ms**.',
      ],
      keyIdea: 'Search the detailed graph only near the two ends and a coarse highway graph in between.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s in 130K req/s', route: '~100 ms', storage: 'TBs (vector)' },
      scene: {
        nodes: [
          phone,
          gw,
          { ...routing, status: 'active', badge: '~20K nodes explored' },
          { ...graph, status: 'ok', badge: 'start and end only' },
          { ...arterial, status: 'ok' },
          { ...hwy, status: 'ok', badge: 'the long middle' },
        ],
        links: [
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'routing' },
          { from: 'routing', to: 'graph' },
          { from: 'routing', to: 'arterial' },
          { from: 'routing', to: 'hwy' },
        ],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'Chicago to Denver', duration: 1.4 },
          { path: ['routing', 'graph'], tone: 'request', label: 'near origin', duration: 0.9, delay: 1.4 },
          { path: ['routing', 'arterial'], tone: 'request', label: 'climb', duration: 0.9, delay: 2.2 },
          { path: ['routing', 'hwy'], tone: 'request', label: 'cross the country', duration: 0.9, delay: 3 },
          { path: ['routing', 'graph'], tone: 'request', label: 'near destination', duration: 0.9, delay: 3.8 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: '100 ms', duration: 1.4, delay: 4.7 },
        ],
        caption: 'Detail at the two ends, highways in between',
      },
    },
    {
      title: 'ETA',
      tag: 'concept',
      heading: 'ETA: live traffic for now, history for later',
      eli5: 'A **traffic board** at the desk shows how fast each road moves right now, fed by drivers\' cards. For roads the trip reaches an hour from now, the planner trusts notes about the usual speed at that hour more than the board.',
      body: [
        'The traffic job **map-matches** each batch: GPS is noisy, so it snaps the whole trace to the most likely sequence of road segments, then computes an average speed per segment per minute. The result goes to the **live speeds** store, a few GB in memory keyed by segment id.',
        '**History** gives the usual speed of each segment by day of week and time of day, built offline from months of trips. A route\'s ETA is the sum of its segment times. Near the start, live speed dominates. For a segment the driver reaches in 40 minutes, the estimate leans toward history, because today\'s jam may have cleared by then.',
        'Routing uses the same blended times as edge weights, so routes steer around jams, and the shortcut weights for affected areas are refreshed every few minutes. Real systems feed these signals into learned models, and the data flow stays the same.',
      ],
      keyIdea: 'Use live speeds for the next few minutes of the trip and historical patterns for the parts you will reach later.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s in 130K req/s', route: '~100 ms', storage: 'TBs (vector)' },
      scene: {
        nodes: [
          kafka,
          { ...traffic, status: 'active' },
          { ...speeds, status: 'ok', badge: 'updated each minute' },
          history,
          { ...eta, status: 'active', badge: '42 min' },
          { ...routing, status: 'active' },
        ],
        links: [
          { from: 'kafka', to: 'traffic' },
          { from: 'traffic', to: 'speeds' },
          { from: 'kafka', to: 'history', style: 'dashed' },
          { from: 'eta', to: 'speeds' },
          { from: 'eta', to: 'history', style: 'dashed' },
          { from: 'routing', to: 'eta' },
        ],
        flows: [
          { path: ['kafka', 'traffic', 'speeds'], tone: 'event', label: 'segment speeds', count: 3, duration: 1.8 },
          { path: ['routing', 'eta'], tone: 'request', label: '3 candidate routes', duration: 1.2, delay: 1 },
          { path: ['eta', 'speeds'], tone: 'request', label: 'now', duration: 1, delay: 2.2 },
          { path: ['eta', 'history'], tone: 'request', label: 'Tue 17:40', duration: 1.2, delay: 2.4 },
          { path: ['eta', 'routing'], tone: 'response', label: '42, 47, 51 min', duration: 1.2, delay: 3.8 },
        ],
        caption: 'Live speeds near the start, history further out',
      },
    },
    {
      title: 'Navigation',
      tag: 'concept',
      heading: 'Turn by turn, and rerouting when things change',
      eli5: 'The driver carries the trip on paper and reads out each turn on their own. If they miss a turn, they call the desk for a new one. If the desk hears of a crash ahead, a **messenger** calls the driver first.',
      body: [
        'The route response carries the full geometry and the list of maneuvers, so the phone guides the driver locally. It matches its own GPS to the route and says "in 300 m, turn left" without a server round trip, which keeps guidance working through tunnels and dead zones.',
        '**Off route**: when the phone stays away from the route line for a few seconds, it asks the routing service for a new route from where it is now. It is an ordinary route request from a new starting point, so it comes back in about the same 100 ms.',
        '**Better route**: the **navigation service** holds a push connection to each navigating phone (the real-time delivery lesson). Every minute or two, or when the traffic job reports a new jam on the current route, it compares the route\'s ETA with alternatives and pushes a suggestion if one saves enough time, plus a fresh arrival time either way.',
      ],
      keyIdea: 'The phone owns turn-by-turn guidance and off-route detection. The server pushes what only it can know: traffic changes ahead.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s in 130K req/s', route: '~100 ms', storage: 'TBs (vector)' },
      scene: {
        nodes: [
          { ...phone, status: 'active', badge: 'missed a turn' },
          gw,
          { ...nav, status: 'active', badge: 'jam ahead: -6 min' },
          { ...routing, status: 'active' },
          { ...speeds, badge: 'jam on I-90' },
        ],
        links: [
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'routing' },
          { from: 'nav', to: 'phone', style: 'dashed', label: 'push' },
          { from: 'nav', to: 'routing' },
          { from: 'nav', to: 'speeds' },
        ],
        flows: [
          { path: ['phone', 'gw', 'routing'], tone: 'request', label: 'reroute from here', duration: 1.4 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: 'new route', duration: 1.4, delay: 1.5 },
          { path: ['speeds', 'nav'], tone: 'event', label: 'new jam', duration: 1.2, delay: 3 },
          { path: ['nav', 'routing', 'nav'], tone: 'request', label: 'compare', duration: 1.4, delay: 4.2 },
          { path: ['nav', 'phone'], tone: 'event', label: 'faster route?', duration: 1.4, delay: 5.6 },
        ],
        caption: 'The phone reroutes on demand, the server pushes traffic news',
      },
    },
    {
      title: 'Rush hour lag',
      tag: 'case',
      heading: 'Case: the traffic pipeline falls behind at rush hour',
      eli5: 'At 5 pm the cards pile up faster than the back room can read them, and the **traffic board** shows roads as they were ten minutes ago. The planner sees the board is old and leans on the usual-speed notes until it catches up.',
      body: [
        'A snowstorm hits a big city at 5 pm. More people navigate, uploads rise to **2.6M points per second**, and map matching gets slower because traces are messy. Consumer lag on Kafka grows to 10 minutes. Live speeds now describe the roads as they were at 4:50, and ETAs start promising arrival times that are far too early.',
        'The design holds because each layer degrades on its own. Kafka buffers the backlog, so the location service keeps accepting uploads and no points are lost. Every live speed carries a timestamp: when it is older than a few minutes, the ETA service weights it down, leans on history for that hour and weather, and the app marks traffic as delayed. Meanwhile the traffic job scales out, up to one consumer per partition, which is why the topic was created with spare partitions.',
        'Tiles never depended on traffic, and routing keeps working on historical weights. A slow subsystem makes answers less precise, and the map stays up.',
      ],
      keyIdea: 'Stamp derived data with its age, and have every reader fall back to a safe default when it is too old.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2.6M points/s (storm)', route: '~100 ms', storage: 'TBs (vector)' },
      scene: {
        nodes: [
          { ...phone, status: 'active', badge: 'snow, more trips' },
          { ...locsvc, status: 'ok', badge: 'still accepting' },
          { ...kafka, status: 'hot', badge: 'lag 10 min' },
          { ...traffic, status: 'hot', badge: 'scaling 40 to 96' },
          { ...speeds, status: 'down', badge: 'stale: 4:50 pm' },
          { ...history, status: 'ok' },
          { ...eta, status: 'active', badge: 'fallback: history' },
        ],
        links: [
          { from: 'phone', to: 'locsvc' },
          { from: 'locsvc', to: 'kafka' },
          { from: 'kafka', to: 'traffic' },
          { from: 'traffic', to: 'speeds' },
          { from: 'eta', to: 'speeds', style: 'faint' },
          { from: 'eta', to: 'history' },
        ],
        flows: [
          { path: ['phone', 'locsvc', 'kafka'], tone: 'event', count: 5, duration: 1.4 },
          { path: ['kafka', 'traffic'], tone: 'event', label: 'backlog', duration: 2.4, delay: 1 },
          { path: ['eta', 'speeds'], tone: 'error', label: 'too old', duration: 1, delay: 2 },
          { path: ['eta', 'history'], tone: 'request', label: 'use history', duration: 1.2, delay: 3.1 },
        ],
        caption: 'The stream absorbs the surge, ETAs fall back to history',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Static tiles, a GPS stream and a layered road graph',
      eli5: 'Print **map pages** ahead and stack them by the door, collect drivers\' cards in bundles, plan long trips on the highway map, and keep the traffic board honest about how old it is.',
      body: [
        'Tiles per zoom level are pre-rendered from map data, stored in object storage and served through a CDN, so 1M requests per second become about 50,000 at the origin. Vector tiles cut the world from petabytes of images to terabytes of data and let the phone restyle the map. Phones batch GPS points every 15 seconds, and a thin location service appends them to Kafka for traffic, history and map quality jobs.',
        'Geocoding is search over addresses and places. Routing runs A* over **routing tiles** at several levels, so a cross-country route touches thousands of nodes and returns in about 100 ms. ETAs blend live segment speeds with history, the phone handles turn-by-turn and off-route detection, and the navigation service pushes better routes. When the traffic stream lags, stale speeds are detected by age and ETAs fall back to history.',
      ],
      keyIdea: 'Precompute everything that is static, stream everything that moves, and search a hierarchy instead of the whole world.',
      metrics: { users: '500M', tiles: '1M/s edge, 50K/s origin', gps: '2M points/s in 130K req/s', route: '~100 ms', storage: 'TBs (vector)' },
      scene: {
        zones: [zoneTiles],
        nodes: [phone, { ...cdn, status: 'ok' }, gw, tilestore, locsvc, kafka, { ...traffic, status: 'ok' }, { ...routing, status: 'ok' }, graph],
        links: [
          { from: 'phone', to: 'cdn' },
          { from: 'cdn', to: 'tilestore' },
          { from: 'phone', to: 'gw' },
          { from: 'gw', to: 'locsvc' },
          { from: 'locsvc', to: 'kafka' },
          { from: 'kafka', to: 'traffic' },
          { from: 'gw', to: 'routing' },
          { from: 'routing', to: 'graph' },
        ],
        flows: [
          { path: ['phone', 'cdn', 'phone'], tone: 'response', label: 'tiles', count: 3, duration: 1.6 },
          { path: ['phone', 'gw', 'locsvc', 'kafka', 'traffic'], tone: 'event', duration: 2.4, delay: 0.5 },
          { path: ['phone', 'gw', 'routing', 'graph'], tone: 'request', duration: 2, delay: 1.2 },
          { path: ['routing', 'gw', 'phone'], tone: 'response', label: 'route + ETA', duration: 1.6, delay: 3.3 },
        ],
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
