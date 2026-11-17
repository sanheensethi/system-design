import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-7.6, 0), label: 'driver', sub: 'map app' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(-3.8, -4), label: 'CDN edge', sub: 'tile cache' };
const tilestore: SceneNode = { id: 'tilestore', kind: 'storage', at: at(0, -4), label: 'tile store', sub: 'object storage' };
const render: SceneNode = { id: 'render', kind: 'block', size: 0.8, at: at(3.8, -4), label: 'tile renderer', sub: 'batch job', icon: 'Image', tint: 'violet' };
const mapdata: SceneNode = { id: 'mapdata', kind: 'db', at: at(7.6, -4), label: 'map data', sub: 'roads, names, places' };
const gw: SceneNode = { id: 'gw', kind: 'block', size: 0.8, at: at(-3.8, 4), label: 'API gateway', icon: 'Network', tint: 'violet' };
const locsvc: SceneNode = { id: 'locsvc', kind: 'block', size: 0.8, at: at(0, 4), label: 'location', sub: 'thin, stateless', icon: 'Signal', tint: 'blue' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: at(3.8, 4), label: 'Kafka', sub: 'by session id' };
const traffic: SceneNode = { id: 'traffic', kind: 'block', size: 0.8, at: at(7.6, 4), label: 'traffic job', sub: 'map matching', icon: 'Activity', tint: 'green' };
const geocode: SceneNode = { id: 'geocode', kind: 'search', at: at(3.8, 4), label: 'geocoder', sub: 'address index' };

const m = (tiles: string, gps: string, route: string, storage: string, users = '500M') => ({ users, tiles, gps, route, storage });

export const designGoogleMaps: Lesson = {
  id: 'design-google-maps',
  title: 'Design Google Maps (part 1)',
  tagline: 'Draw the whole planet at any zoom, find any address, and take in a firehose of GPS points. Routing and ETAs follow in part 2.',
  minutes: 20,
  level: 'Advanced',
  learn: [
    'The four workloads of a maps app and the numbers that size them',
    'Map tiles per zoom level, the tile math, and how big the world map really is',
    'Raster versus vector tiles, and why modern apps ship data instead of pictures',
    'Keeping tiles fresh, and geocoding and reverse geocoding addresses',
    'Batching GPS points on the phone and streaming them through Kafka on the server',
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
      title: 'Requirements',
      tag: 'problem',
      heading: 'A map, a place search, a route and a voice that says turn left',
      eli5: 'A busy **travel desk** hands out map pages, finds streets, plans trips and talks drivers through each turn. Half a billion people use it every day.',
      body: [
        'Four features matter. Show a map the user can pan and zoom. Turn a typed address into a point on the map. Find a route with an arrival time (ETA). Guide a driver turn by turn and reroute when traffic changes or they miss a turn.',
        'Reviews, street photos and transit timetables are out of scope. Each of the four features loads the system in a different way, and that drives the whole design.',
      ],
      keyIdea: 'Four very different workloads share one app: static pictures, text search, graph search and a firehose of GPS writes.',
      metrics: m('-', '-', '-', '-'),
      scene: {
        nodes: [
          phone,
          { id: 'f_map', kind: 'block', size: 0.8, at: at(-3.8, -4), label: 'the map', sub: 'pan and zoom', icon: 'Earth', tint: 'blue' },
          { id: 'f_geo', kind: 'block', size: 0.8, at: at(3.8, -4), label: 'find a place', sub: 'text to point', icon: 'Search', tint: 'amber' },
          { id: 'f_route', kind: 'block', size: 0.8, at: at(-3.8, 4), label: 'route + ETA', sub: 'A to B', icon: 'Route', tint: 'violet' },
          { id: 'f_nav', kind: 'block', size: 0.8, at: at(3.8, 4), label: 'guidance', sub: 'turn by turn', icon: 'Signal', tint: 'green' },
        ],
        links: [link('phone', 'f_map'), link('phone', 'f_route'), link('f_map', 'f_geo', { style: 'faint' }), link('f_route', 'f_nav', { style: 'faint' })],
        flows: [
          { path: ['phone', 'f_map'], tone: 'request', label: 'tiles', count: 3, duration: 1.2 },
          { path: ['phone', 'f_route'], tone: 'request', label: 'A to B', duration: 1.2, delay: 1.2 },
          { path: ['f_route', 'phone'], tone: 'response', label: '42 min', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'In scope',
          icon: 'List',
          rows: [
            { text: 'Show the map', value: 'pan, zoom' },
            { text: 'Find a place', value: 'text to point' },
            { text: 'Route and ETA', value: 'A to B' },
            { text: 'Turn by turn', value: 'reroute live' },
          ],
          footer: { text: 'Out: reviews, street photos, transit', tone: 'muted' },
        },
        caption: 'One app, four workloads',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: 'The numbers that shape the design',
      eli5: 'Half a billion visitors a day each flip through many **map pages**, some ask for trips, and two million drivers jot down their spot every second.',
      body: [
        '**500M daily users**. Map views drive about **1M tile requests per second** at peak. About 200M route requests a day is around **7,000 per second** at peak, counting reroutes and the periodic route re-checks of navigating phones.',
        'At rush hour about **2M phones navigate at once**, each taking a GPS fix every second. Targets: tiles in under 200 ms, routes in under 1 s, and an ETA for an hour drive right to within a few minutes.',
      ],
      keyIdea: 'Tiles are the biggest request stream, GPS the biggest write stream, and routing the heaviest work per request.',
      metrics: m('1M/s peak', '2M points/s', 'goal < 1 s', '-'),
      scene: {
        nodes: [
          phone,
          { ...cdn, chips: ['1M tiles/s'] },
          { id: 'routing', kind: 'block', size: 0.8, at: at(3.8, -4), label: 'routing', sub: 'graph search', icon: 'Route', tint: 'violet', chips: ['7K routes/s'] },
          { ...locsvc, chips: ['2M points/s'] },
        ],
        links: [link('phone', 'cdn'), link('phone', 'routing'), link('phone', 'locsvc')],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'tiles', count: 4, duration: 1 },
          { path: ['phone', 'locsvc'], tone: 'event', label: 'GPS', count: 3, duration: 1.4, delay: 1 },
          { path: ['phone', 'routing'], tone: 'request', label: 'route', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Peak load and targets',
          icon: 'Gauge',
          rows: [
            { text: 'Tile requests', value: '1M/s' },
            { text: 'Route requests', value: '7K/s' },
            { text: 'GPS points', value: '2M/s' },
            { text: 'Tile latency', value: '< 200 ms', tone: 'good' },
            { text: 'Route latency', value: '< 1 s', tone: 'good' },
          ],
          footer: { text: 'Hour-long ETA within a few minutes', tone: 'muted' },
        },
        caption: 'Three streams, three orders of magnitude',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Four endpoints',
      eli5: 'The desk has four windows: one hands out map pages, one takes "I am here" notes, one plans trips and one finds streets. The page window sits outside with its own line.',
      body: [
        '`GET /tiles/{version}/{z}/{x}/{y}` returns one cacheable tile. `POST /v1/locations` uploads a batch of GPS points. `GET /v1/routes?from=…&to=…&mode=drive` returns up to three routes with ETAs and turn steps.',
        '`GET /v1/geocode?q=…` returns candidate places with coordinates. Tiles are plain static files, so they skip the gateway and go through the CDN.',
      ],
      keyIdea: 'Only the tile endpoint is a cacheable static file. The other three need a service behind a gateway.',
      metrics: m('1M/s peak', '2M points/s', 'goal < 1 s', '-'),
      scene: {
        nodes: [phone, cdn, gw],
        links: [link('phone', 'cdn', { label: 'static' }), link('phone', 'gw', { label: 'dynamic' })],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'GET /tiles/…', duration: 1.4 },
          { path: ['phone', 'gw'], tone: 'request', label: 'POST /locations', duration: 1.4, delay: 1.5 },
          { path: ['phone', 'gw'], tone: 'request', label: 'GET /routes', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'The API',
          icon: 'Code',
          code: 'GET  /tiles/{ver}/{z}/{x}/{y}\nPOST /v1/locations\nGET  /v1/routes?from&to&mode\nGET  /v1/geocode?q=',
          footer: { text: 'Tiles bypass the gateway', tone: 'muted' },
        },
        caption: 'Tiles skip the gateway, everything else goes through it',
      },
    },
    {
      title: 'Services',
      tag: 'concept',
      heading: 'Split by the shape of the workload',
      eli5: 'Each window gets its own **clerks**, because handing out pages, taking notes, planning trips and finding streets are very different jobs.',
      body: [
        'Tiles are static files. Locations are a firehose of small writes. Routing burns CPU and memory. Geocoding is a search problem.',
        'So each becomes its own service that scales on its own, behind one gateway. Static files go to the CDN, writes go to a stream, and graph search and text search get their own servers.',
      ],
      keyIdea: 'Split by workload shape so each part scales and fails on its own.',
      metrics: m('1M/s peak', '2M points/s', 'goal < 1 s', '-'),
      scene: {
        nodes: [
          { ...cdn, at: at(-7.6, 0), chips: [{ text: 'static files', tone: 'good' }] },
          { ...gw, at: at(0, -4) },
          { ...locsvc, at: at(-3.8, 4), chips: ['small writes'] },
          { id: 'routing', kind: 'block', size: 0.8, at: at(0, 4), label: 'routing', sub: 'graph in RAM', icon: 'Route', tint: 'violet', chips: ['CPU and RAM'] },
          { ...geocode, at: at(3.8, 4), chips: ['text search'] },
        ],
        links: [link('gw', 'locsvc'), link('gw', 'routing'), link('gw', 'geocode')],
        flows: [
          { path: ['gw', 'locsvc'], tone: 'event', label: 'GPS', duration: 1.2 },
          { path: ['gw', 'routing'], tone: 'request', label: 'route', duration: 1.2, delay: 1.2 },
          { path: ['gw', 'geocode'], tone: 'request', label: 'search', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Workload to home',
          icon: 'Split',
          rows: [
            { text: 'Static pictures', value: 'CDN' },
            { text: 'Small writes', value: 'stream' },
            { text: 'Graph search', value: 'routing servers' },
            { text: 'Text search', value: 'search index' },
          ],
        },
        caption: 'One service per workload shape',
      },
    },
    {
      title: 'Map data',
      tag: 'concept',
      heading: 'Everything starts from map data',
      eli5: 'The desk keeps one big **master atlas** of every street and shop. Back-room staff copy it into map pages, a street list for trip planning and an address book.',
      body: [
        '**Map data** holds road segments with speed limits and turn rules, names, buildings and places. It comes from surveys, satellite imagery, partner feeds and corrections from users.',
        'Offline jobs derive three products from it: rendered tiles in object storage, the road graph for routing, and a geocoding index. Requests never touch the master data directly.',
      ],
      keyIdea: 'One source of truth feeds three derived stores, and each is built offline for its own query shape.',
      metrics: m('1M/s peak', '2M points/s', 'goal < 1 s', '-'),
      scene: {
        nodes: [
          { ...mapdata, at: at(-5.7, 0), status: 'active' },
          { ...tilestore, at: at(0, -4), badge: 'for the map' },
          { id: 'graph', kind: 'storage', at: at(0, 4), label: 'road graph', sub: 'for routing', badge: 'segments, turns' },
          { id: 'geoidx', kind: 'search', at: at(5.7, 0), label: 'address index', sub: 'for geocoding' },
        ],
        links: [link('mapdata', 'tilestore'), link('mapdata', 'graph'), link('mapdata', 'geoidx')],
        flows: [
          { path: ['mapdata', 'tilestore'], tone: 'data', label: 'render', count: 2, duration: 1.4 },
          { path: ['mapdata', 'graph'], tone: 'data', label: 'build graph', count: 2, duration: 1.4, delay: 1.2 },
          { path: ['mapdata', 'geoidx'], tone: 'data', label: 'index', count: 2, duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'In the map data',
          icon: 'Database',
          rows: [
            { text: 'Road segments', value: 'limits, turn rules' },
            { text: 'Names', value: 'streets, places' },
            { text: 'Buildings and places', value: 'with a point' },
            { text: 'Sources', value: 'surveys, imagery, feeds' },
          ],
        },
        caption: 'One source, three offline products',
      },
    },
    {
      title: 'Map tiles',
      tag: 'concept',
      heading: 'Cut the world into tiles per zoom level',
      eli5: 'The desk prints the world as **map pages**: one page for the whole planet, four pages that zoom in on it, sixteen that zoom in again, all the way down to one block.',
      body: [
        'The map is cut into square **tiles**. Zoom 0 is the whole world in one tile, and each zoom level splits every tile into four, so zoom z has 4^z tiles. Street level is around zoom 15 to 18.',
        'The client works out which tiles cover its screen and fetches each by `z/x/y`. It also prefetches a ring of tiles around the edges so panning feels instant.',
      ],
      keyIdea: 'Tiles turn an unbounded map into a finite grid of small files addressed by zoom, column and row.',
      metrics: m('1M/s peak', '2M points/s', 'goal < 1 s', '-'),
      scene: {
        nodes: [{ ...phone, chips: ['15/8407/12178'] }, cdn, tilestore],
        links: [link('phone', 'cdn', { label: 'z/x/y' }), link('cdn', 'tilestore')],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: '15/8407/12178', count: 3, duration: 1.2 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'tile', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Tiles per zoom level',
          icon: 'Layers',
          rows: [
            { text: 'Zoom 0, the world', value: '1 tile' },
            { text: 'Zoom 1', value: '4 tiles' },
            { text: 'Zoom 10, a city', value: '1M tiles' },
            { text: 'Zoom 15, a street', value: '1.07B tiles' },
            { text: 'Zoom 18, a building', value: '68.7B tiles' },
          ],
          footer: { text: '4^z tiles at zoom z', tone: 'muted' },
        },
        caption: 'Each zoom level quadruples the tile count',
      },
    },
    {
      title: 'Tile math',
      tag: 'concept',
      heading: 'From a GPS point to a tile address',
      eli5: 'Every spot on Earth has a page number. The visitor does a little sum with their latitude and longitude to learn which **map page** to ask for, with no clerk needed.',
      body: [
        'The client turns latitude and longitude into tile numbers with the **Web Mercator** projection. At zoom z the world is a grid of 2^z by 2^z tiles. Longitude gives the column `x` and latitude gives the row `y`.',
        'The sum is pure arithmetic, so the phone and the server compute the same URL with no lookup.',
      ],
      keyIdea: 'A tile address is a formula of position and zoom, so any client can build the URL itself.',
      metrics: m('1M/s peak', '2M points/s', 'goal < 1 s', '-'),
      scene: {
        nodes: [{ ...phone, chips: ['41.88, -87.63'] }, cdn, tilestore],
        links: [link('phone', 'cdn'), link('cdn', 'tilestore')],
        flows: [{ path: ['phone', 'cdn'], tone: 'request', label: '.../15/8407/12178', duration: 1.6 }],
        panel: {
          title: 'Chicago at zoom 15',
          icon: 'Code',
          code: 'n = 2^15 = 32768\nx = (lng + 180) / 360 * n\ny = mercator(lat) * n\n-> x = 8407, y = 12178',
          footer: { text: 'Pure math, no lookup', tone: 'good' },
        },
        caption: 'Position and zoom in, tile URL out',
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
      title: 'Tile serving',
      tag: 'concept',
      heading: 'Immutable tiles, served from the edge',
      eli5: 'Back-room staff print the pages once and stack copies by the door. Most visitors grab a page from the stack and never talk to a clerk.',
      body: [
        'Tiles change only when map data changes, so a batch job **pre-renders** them into object storage. The URL carries the data version, which makes each tile immutable and safe to cache for weeks at the CDN (the content delivery networks lesson). The app reads the current version from a small **manifest** (cached a few minutes) and builds tile URLs from it, so a new release means new URLs.',
        'Cities are hot for everyone. At a 95% edge hit rate, 1M requests per second become about **50,000 per second** at the origin.',
      ],
      keyIdea: 'Versioned URLs make tiles cacheable forever, and the CDN absorbs almost all of the traffic.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', '-'),
      metricTones: { tiles: 'good' },
      scene: {
        nodes: [phone, { ...cdn, status: 'ok', badge: '95% hits', load: 55 }, { ...tilestore, chips: [{ text: '50K req/s', tone: 'good' }] }],
        links: [link('phone', 'cdn', { label: '1M req/s' }), link('cdn', 'tilestore', { label: 'rare miss' })],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: '1M/s', count: 4, duration: 1 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'hit', count: 3, duration: 1, delay: 1.1 },
          { path: ['cdn', 'tilestore'], tone: 'request', label: 'miss', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'One second at peak',
          icon: 'Gauge',
          rows: [
            { text: 'Edge requests', value: '1M' },
            { text: 'Hit rate', value: '95%', tone: 'good' },
            { text: 'Reach the origin', value: '50K', tone: 'good' },
            { text: 'Cache lifetime', value: 'weeks (versioned URL)' },
            { text: 'Manifest (names the version)', value: 'cache of a few minutes' },
          ],
        },
        caption: 'Rendered once, cached at the edge',
      },
    },
    {
      title: 'World size',
      tag: 'concept',
      heading: 'How big is the world, really?',
      eli5: 'Printing every page at every zoom would fill a warehouse of warehouses. So the desk skips blank blue pages, copies one blue page many times and prints the dull ones only on request.',
      body: [
        'Summing 4^z from zoom 0 to 21 gives about **5.9 trillion tiles**. At roughly 20 KB per image that is about **120 PB** as a raw upper bound.',
        'Most of it is never stored. About 70% of the planet is water, and an all-ocean tile is the same image every time, so it is stored once and shared. Deep zooms of empty land are rendered on demand and cached. The stored raster set is still **tens of PB**.',
      ],
      keyIdea: 'Raw tile math gives an absurd number. Sharing identical tiles and rendering the dull ones on demand brings it down.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'stored raster: tens of PB'),
      metricTones: { storage: 'bad' },
      scene: {
        nodes: [
          { ...tilestore, status: 'hot', badge: '5.9T tile slots' },
          { ...render, status: 'active', chips: ['on demand'] },
          mapdata,
        ],
        links: [link('mapdata', 'render'), link('render', 'tilestore')],
        flows: [
          { path: ['mapdata', 'render'], tone: 'data', label: 'new version', duration: 1.2 },
          { path: ['render', 'tilestore'], tone: 'data', label: 'write tiles', count: 3, duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Raster tile storage',
          icon: 'HardDrive',
          rows: [
            { text: 'Zoom 0 to 21', value: '5.9T tiles' },
            { text: 'At 20 KB each (raw upper bound)', value: '~120 PB', tone: 'warn' },
            { text: 'Ocean (70% of Earth)', value: 'one shared image', tone: 'good' },
            { text: 'Empty land, deep zoom', value: 'render on demand', tone: 'good' },
          ],
          footer: { text: 'Stored raster: tens of PB', tone: 'warn' },
        },
        caption: 'Too big to store naively',
      },
    },
    {
      title: 'Raster tiles',
      tag: 'tradeoff',
      heading: 'Raster tiles: simple client, heavy server',
      eli5: 'A finished **picture page** shows on any visitor\'s table with no effort. But the colors and street names are painted in, so a night version or a French version needs a whole new stack of pages.',
      body: [
        '**Raster tiles** are images rendered on the server. Any device can show them and the client does almost nothing.',
        'Style, language and screen density are baked into the pixels. Dark mode, a second language or a high-density screen each needs another full tile set to render, store and cache. Zooming between levels looks blurry.',
      ],
      keyIdea: 'Raster tiles keep clients simple but multiply server storage by every style, language and density.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'stored raster: tens of PB'),
      metricTones: { storage: 'bad' },
      scene: {
        nodes: [
          phone,
          { ...tilestore, id: 'set1', at: at(-3.8, -4), label: 'light, English', sub: '1 full set' },
          { ...tilestore, id: 'set2', at: at(3.8, -4), label: 'dark, English', sub: '+1 full set', status: 'hot' },
          { ...tilestore, id: 'set3', at: at(0, 4), label: 'light, French', sub: '+1 full set', status: 'hot' },
        ],
        links: [link('phone', 'set1'), link('phone', 'set2', { style: 'dashed' }), link('phone', 'set3', { style: 'dashed' })],
        flows: [{ path: ['phone', 'set2'], tone: 'request', label: 'dark mode', duration: 1.6 }],
        panel: {
          title: 'Sets to render, store, cache',
          icon: 'Copy',
          rows: [
            { text: 'Light, English', value: '1 set' },
            { text: 'Dark, English', value: '+1 set', tone: 'warn' },
            { text: 'Light, French', value: '+1 set', tone: 'warn' },
            { text: 'Dark, French', value: '+1 set', tone: 'warn' },
          ],
          footer: { text: 'Styles x languages x densities', tone: 'bad' },
        },
        caption: 'Every combination is its own tile set',
      },
    },
    {
      title: 'Vector tiles',
      tag: 'tradeoff',
      heading: 'Vector tiles: ship data, draw on the phone',
      eli5: 'A **vector page** is a short list of lines and names. The visitor draws it with their own pencil, so they can turn it, enlarge it or switch language without coming back to the desk.',
      body: [
        '**Vector tiles** carry geometry and attributes: this line is a primary road with this name, this polygon is a park. The phone draws them on its GPU, so the map can rotate, tilt or change style and language on the device.',
        'They are several times smaller than images of the same area. The costs are heavier clients, more battery, and drawing bugs that differ per device.',
      ],
      keyIdea: 'Vector tiles move drawing to the phone, so one tile serves every style, language and zoom.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'TBs (vector)'),
      metricTones: { storage: 'good' },
      scene: {
        nodes: [{ ...phone, status: 'active', badge: 'draws on GPU' }, { ...cdn, status: 'ok', badge: 'small, compressed' }, { ...tilestore, status: 'ok', badge: 'vector' }],
        links: [link('phone', 'cdn'), link('cdn', 'tilestore')],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', count: 2, duration: 1 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'roads, labels, polygons', duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'Vector versus raster',
          icon: 'Scale',
          rows: [
            { text: 'Tile size', value: 'several times smaller', tone: 'good' },
            { text: 'Style and language', value: 'changed on device', tone: 'good' },
            { text: 'Rotate and tilt', value: 'free', tone: 'good' },
            { text: 'Battery and GPU', value: 'more work', tone: 'warn' },
            { text: 'Drawing bugs', value: 'differ per device', tone: 'warn' },
          ],
        },
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
      title: 'Overzoom',
      tag: 'tradeoff',
      heading: 'Vector lets you store far less',
      eli5: 'Because the visitor draws the page themselves, one detailed page can be enlarged to look fine at many zoom levels. The desk stops printing the deepest levels altogether.',
      body: [
        'Mobile map apps today generally use vector tiles and keep raster for satellite imagery and very old clients.',
        'Because the client can overzoom a vector tile, the vector set can stop around zoom 14 to 16. The stored world drops from tens of petabytes to **terabytes**, and CDN bandwidth drops with it.',
      ],
      keyIdea: 'Overzoom on the device removes the deepest zoom levels from storage entirely.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'TBs (vector)'),
      metricTones: { storage: 'good' },
      scene: {
        nodes: [phone, { ...cdn, status: 'ok' }, { ...tilestore, status: 'ok', badge: 'zoom 0 to 15' }],
        links: [link('phone', 'cdn'), link('cdn', 'tilestore')],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'zoom 15 tile', duration: 1.2 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'drawn at zoom 18', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Stored tile set',
          icon: 'HardDrive',
          rows: [
            { text: 'Raster, zoom 0 to 21', value: 'tens of PB (120 PB raw)', tone: 'bad' },
            { text: 'Vector, zoom 0 to 15', value: 'terabytes', tone: 'good' },
            { text: 'Zoom 16 to 21', value: 'overzoom on phone', tone: 'good' },
          ],
          footer: { text: 'CDN bandwidth drops with it', tone: 'good' },
        },
        caption: 'The phone stretches a tile past the stored levels',
      },
    },
    {
      title: 'Fresh data',
      tag: 'concept',
      heading: 'Keeping the map fresh',
      eli5: 'A new street can wait for the next print run. A closed road cannot, so the desk pins a sticky note on the trip planner right away and reprints the pages later.',
      body: [
        'A new street may take days to appear. The renderer finds which tiles the changed data touches, rebuilds only those and publishes a new data version. Old URLs keep working until their caches age out.',
        'A closed road cannot wait. It goes into a fast overlay that routing reads within minutes, and the tiles catch up in the next release.',
        'Traffic colors are not in the tiles. The phone fetches per-segment speeds (or a short-lived overlay layer) from the live speeds store and paints them over the static base map.',
      ],
      keyIdea: 'Slow changes ride the tile pipeline. Urgent changes take a faster side path.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'TBs (vector)'),
      scene: {
        nodes: [
          { ...mapdata, status: 'active', badge: 'road closed' },
          { ...render, chips: ['changed tiles only'] },
          tilestore,
          { id: 'routing', kind: 'block', size: 0.8, at: at(3.8, 4), label: 'routing', sub: 'closure overlay', icon: 'Route', tint: 'violet', status: 'ok' },
        ],
        links: [link('mapdata', 'render'), link('render', 'tilestore'), link('mapdata', 'routing', { label: 'minutes', labelTone: 'good' })],
        flows: [
          { path: ['mapdata', 'routing'], tone: 'event', label: 'closure', duration: 1.4 },
          { path: ['mapdata', 'render'], tone: 'data', label: 'new version', duration: 1.4, delay: 1.5 },
          { path: ['render', 'tilestore'], tone: 'data', label: 'changed tiles', count: 2, duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Freshness targets',
          icon: 'Clock',
          rows: [
            { text: 'New street', value: 'days', tone: 'warn' },
            { text: 'Closed road in routing', value: 'minutes', tone: 'good' },
            { text: 'Closed road on the tile', value: 'next release', tone: 'warn' },
            { text: 'Traffic colors', value: 'overlay on the phone', tone: 'good' },
          ],
        },
        caption: 'Routing hears about a closure first',
      },
    },
    {
      title: 'Geocoding',
      tag: 'concept',
      heading: 'Geocoding: from typed text to a point',
      eli5: 'A visitor says "the bakery on Fifth Street". The clerk splits the words into number, street and town, then looks them up in a thick **address book**.',
      body: [
        '**Geocoding** turns "233 S Wacker Dr, Chicago" into a latitude and longitude. The text is split into parts (number, street, city, postcode), normalized ("Dr" becomes "Drive", case and accents folded) and looked up in a search index of places and street segments (the search index lesson).',
        'When the house number itself is missing, it is interpolated along the street segment from the numbers at each end.',
      ],
      keyIdea: 'Geocoding is search plus geography: parse, normalize, match against an index.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'TBs (vector)'),
      scene: {
        nodes: [phone, gw, { ...geocode, status: 'active', badge: 'top match 0.97' }],
        links: [link('phone', 'gw'), link('gw', 'geocode')],
        flows: [
          { path: ['phone', 'gw', 'geocode'], tone: 'request', label: '"233 s wacker"', duration: 1.6 },
          { path: ['geocode', 'gw', 'phone'], tone: 'response', label: '41.8789, -87.6359', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Parse and normalize',
          icon: 'Search',
          code: '"233 S Wacker Dr, Chicago"\nnumber:  233\nstreet:  S Wacker Dr\ncity:    Chicago\nnormal:  Dr -> Drive',
          footer: { text: 'Missing number: interpolate along the street', tone: 'muted' },
        },
        caption: 'Text in, point out',
      },
    },
    {
      title: 'Ranking',
      tag: 'concept',
      heading: 'Ranking matters as much as matching',
      eli5: 'People ask for streets with crumpled words. The clerk shows the few most likely pages first, favoring ones near where the visitor already looks, and asks "which one?" when two look alike.',
      body: [
        'People type badly, so ranking matters as much as matching. Results near the area on screen, popular places and exact token matches rank higher. While the user types, a prefix index suggests completions.',
        'The answer is a short list of candidates with a confidence each. The app asks the user to pick when the top two are close.',
      ],
      keyIdea: 'Return a ranked short list with confidence, and let the user break ties.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'TBs (vector)'),
      scene: {
        nodes: [phone, gw, { ...geocode, status: 'active', chips: [{ text: '233 S Wacker Dr, IL  0.97', tone: 'good' }, { text: 'Wacker Dr, WI  0.41', tone: 'warn' }] }],
        links: [link('phone', 'gw'), link('gw', 'geocode')],
        flows: [
          { path: ['phone', 'gw', 'geocode'], tone: 'request', label: '"wacker" + map view', duration: 1.6 },
          { path: ['geocode', 'gw', 'phone'], tone: 'response', label: 'ranked list', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Ranking signals',
          icon: 'TrendingUp',
          rows: [
            { text: 'Near the map view', value: 'boost' },
            { text: 'Popular place', value: 'boost' },
            { text: 'Exact token match', value: 'boost' },
            { text: 'Typo fixed', value: 'small penalty', tone: 'warn' },
          ],
          footer: { text: 'Top two close? Ask the user', tone: 'muted' },
        },
        caption: 'Near, popular and exact come first',
      },
    },
    {
      title: 'Reverse geocode',
      tag: 'concept',
      heading: 'Reverse geocoding and a cache in front',
      eli5: 'Sometimes a visitor points at a spot and asks "what is this address?". The clerk checks a **sticky-note board** of recent answers before walking to the address book.',
      body: [
        '**Reverse geocoding** goes the other way, from a GPS point to the nearest address, with a geospatial index such as the geohash cells from the proximity service lesson. The same index answers "coffee near me".',
        'Popular queries repeat a lot, so a cache in front of the geocoder absorbs much of the load. The cache key is the geohash cell (for example `dp3wm`), not the exact coordinates, because raw latitude and longitude would almost never repeat. The chosen point then becomes the destination for routing.',
      ],
      keyIdea: 'A geospatial index answers point-to-place, and a cache absorbs the repeated queries.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s', 'goal < 1 s', 'TBs (vector)'),
      scene: {
        nodes: [
          phone,
          { id: 'gcache', kind: 'cache', at: at(-3.8, -4), label: 'geocode cache', sub: 'repeat queries', status: 'ok', badge: 'key: geohash cell' },
          { ...geocode, at: at(0, 0), status: 'active', chips: ['geohash dp3wm'] },
          { id: 'routing', kind: 'block', size: 0.8, at: at(3.8, 4), label: 'routing', icon: 'Route', tint: 'violet', status: 'dim' },
        ],
        links: [link('phone', 'gcache'), link('gcache', 'geocode', { style: 'dashed', label: 'miss' }), link('phone', 'routing', { style: 'faint' })],
        flows: [
          { path: ['phone', 'gcache'], tone: 'request', label: '41.88, -87.63', duration: 1.4 },
          { path: ['gcache', 'geocode'], tone: 'request', label: 'miss', duration: 1.2, delay: 1.5 },
          { path: ['geocode', 'gcache', 'phone'], tone: 'response', label: '233 S Wacker Dr', duration: 1.6, delay: 2.8 },
          { path: ['phone', 'routing'], tone: 'request', label: 'route to it', duration: 1.4, delay: 4.5 },
        ],
        panel: {
          title: 'Two directions',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Forward', value: 'text to point' },
            { text: 'Reverse', value: 'point to address' },
            { text: 'Nearby search', value: 'same geo index' },
          ],
        },
        caption: 'Point in, address out',
      },
    },
    {
      title: 'GPS batching',
      tag: 'concept',
      heading: 'Batch GPS points on the phone',
      eli5: 'Drivers do not call the desk every second. They jot their spot on a card each second and hand in a bundle every 15 seconds.',
      body: [
        'A navigating phone takes a GPS fix every second. One request per fix would be 2M requests per second at rush hour, and the radio would never sleep.',
        'The phone **batches**: it buffers points and uploads every 15 seconds, so about **130,000 requests per second** carry the same 2M points. A failed upload stays in the buffer for the next try. Batching delays each point by up to 15 s, which is fine for traffic speeds.',
      ],
      keyIdea: 'Batch on the device to cut requests by 15x and let the radio sleep.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s in 130K req/s', 'goal < 1 s', 'TBs (vector)'),
      metricTones: { gps: 'good' },
      scene: {
        nodes: [{ ...phone, badge: '15 points per upload' }, gw, { ...locsvc, status: 'active' }],
        links: [link('phone', 'gw', { label: 'every 15 s' }), link('gw', 'locsvc')],
        flows: [{ path: ['phone', 'gw', 'locsvc'], tone: 'request', label: 'batch of 15', count: 3, duration: 1.6 }],
        panel: {
          title: 'Requests per second',
          icon: 'Gauge',
          rows: [
            { text: 'One request per fix', value: '2M', tone: 'bad' },
            { text: 'One batch per 15 s', value: '130K', tone: 'good' },
            { text: 'Failed upload', value: 'stays buffered' },
            { text: 'Added delay', value: 'up to 15 s', tone: 'warn' },
          ],
        },
        caption: 'Fifteen points ride in one request',
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
      title: 'Location service',
      tag: 'concept',
      heading: 'A thin location service in front of Kafka',
      eli5: 'The clerk at the note window only checks the bundle and drops it on a **conveyor belt** to the back room. Nothing slow happens at the window, so the line keeps moving.',
      body: [
        'The **location service** stays thin: authenticate, validate, append the batch to **Kafka** keyed by session id, return `202`. Nothing heavy runs on the request path, so it scales by adding copies (the message queues and streams lesson).',
        'Keying by session keeps one trip\'s points in order inside a partition. 2M points a second at about 50 bytes each is roughly **100 MB/s**, which a modest Kafka cluster handles.',
      ],
      keyIdea: 'Keep the write path thin and put a durable stream behind it.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s in 130K req/s', 'goal < 1 s', 'TBs (vector)'),
      scene: {
        nodes: [phone, gw, { ...locsvc, status: 'active', chips: ['validate, append'] }, { ...kafka, status: 'active', badge: '~100 MB/s' }],
        links: [link('phone', 'gw'), link('gw', 'locsvc'), link('locsvc', 'kafka')],
        flows: [
          { path: ['phone', 'gw', 'locsvc'], tone: 'request', label: 'batch of 15', duration: 1.6 },
          { path: ['locsvc', 'kafka'], tone: 'event', label: 'append', count: 3, duration: 1, delay: 1.7 },
          { path: ['locsvc', 'gw', 'phone'], tone: 'response', label: '202', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'The write path',
          icon: 'Workflow',
          rows: [
            { text: '1. Authenticate', value: 'token' },
            { text: '2. Validate', value: 'shape, bounds' },
            { text: '3. Append to Kafka', value: 'key: session id' },
            { text: '4. Reply', value: '202 Accepted' },
            { text: 'Partitions', value: '128, spare for scale-out' },
          ],
          footer: { text: '2M points x 50 B = 100 MB/s', tone: 'muted' },
        },
        caption: 'Accept fast, process later',
      },
    },
    {
      title: 'Stream readers',
      tag: 'concept',
      heading: 'Many readers on one stream',
      eli5: 'Several back-room clerks read the same conveyor belt at their own speed. One updates the traffic board, one files trip cards, one checks for missing streets.',
      body: [
        'Several consumers read the same stream at their own pace. The **traffic job** turns points into speeds per road segment. A history writer stores trips for training ETA models. Map quality jobs spot roads that are missing from the map.',
        'Raw points are personal data, so they get a short retention and are aggregated before anyone analyzes them.',
      ],
      keyIdea: 'A durable stream lets each consumer read at its own pace without touching the write path.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s in 130K req/s', 'goal < 1 s', 'TBs (vector)'),
      scene: {
        nodes: [
          { ...kafka, at: at(-7.6, 0), status: 'active' },
          { ...traffic, at: at(-3.8, -4), status: 'active' },
          { id: 'speeds', kind: 'cache', at: at(3.8, -4), label: 'live speeds', sub: 'per road segment' },
          { id: 'history', kind: 'warehouse', at: at(-3.8, 4), label: 'trip history', sub: 'time series' },
          { id: 'quality', kind: 'block', size: 0.8, at: at(3.8, 4), label: 'map quality', sub: 'missing roads', icon: 'Search', tint: 'amber' },
        ],
        links: [link('kafka', 'traffic'), link('traffic', 'speeds'), link('kafka', 'history', { style: 'dashed' }), link('kafka', 'quality', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'traffic', 'speeds'], tone: 'event', label: 'segment speeds', duration: 2 },
          { path: ['kafka', 'history'], tone: 'data', label: 'trips', duration: 1.6, delay: 1 },
          { path: ['kafka', 'quality'], tone: 'data', label: 'unknown roads', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Consumers',
          icon: 'Rss',
          rows: [
            { text: 'Traffic job', value: 'speeds per segment' },
            { text: 'History writer', value: 'trips for ETA models' },
            { text: 'Map quality', value: 'missing roads' },
            { text: 'Raw points', value: 'short retention', tone: 'warn' },
          ],
          footer: { text: 'Aggregate before anyone analyzes', tone: 'muted' },
        },
        caption: 'One stream, three readers',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: tiles, search and a GPS stream',
      eli5: 'Print **map pages** ahead and stack them by the door, keep an address book for street searches, and collect drivers\' cards in bundles on a conveyor belt.',
      body: [
        'Tiles per zoom level are pre-rendered from map data and served through a CDN, so 1M requests per second become about 50,000 at the origin. Vector tiles cut the world from petabytes to terabytes and let the phone restyle the map.',
        'Geocoding is search plus ranking. Phones batch GPS points every 15 seconds, and a thin location service appends them to Kafka for several readers. Part 2 turns to routing, ETAs and navigation.',
      ],
      keyIdea: 'Precompute everything that is static and stream everything that moves.',
      metrics: m('1M/s edge, 50K/s origin', '2M points/s in 130K req/s', 'goal < 1 s', 'TBs (vector)'),
      metricTones: { tiles: 'good', gps: 'good', storage: 'good' },
      scene: {
        nodes: [phone, { ...cdn, status: 'ok' }, { ...tilestore, status: 'ok' }, gw, { ...kafka, status: 'ok' }],
        links: [link('phone', 'cdn'), link('cdn', 'tilestore'), link('phone', 'gw'), link('gw', 'kafka')],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'tiles', count: 3, duration: 1.2 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'vector tile', duration: 1.2, delay: 1.3 },
          { path: ['phone', 'gw', 'kafka'], tone: 'event', label: 'GPS batch', duration: 2, delay: 2.6 },
        ],
        panel: {
          title: 'Part 1 numbers',
          icon: 'Table',
          rows: [
            { text: 'Tiles at the origin', value: '50K/s', tone: 'good' },
            { text: 'Raster world', value: 'tens of PB', tone: 'warn' },
            { text: 'Vector world', value: 'terabytes', tone: 'good' },
            { text: 'GPS requests', value: '130K/s', tone: 'good' },
          ],
        },
        caption: 'Static through the CDN, moving through the stream',
      },
      quiz: {
        question: 'Peak tile traffic is 1M requests per second and the CDN hit rate is 95%. About how many requests per second reach the tile store?',
        options: ['1M', '500K', '50K', '5K'],
        answer: 2,
        explain: 'A 95% hit rate leaves 5% misses, and 5% of 1M is 50,000 per second. Versioned, immutable tile URLs are what make such a high hit rate possible.',
      },
    },
  ],
};
