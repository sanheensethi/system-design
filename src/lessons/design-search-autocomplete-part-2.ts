import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (u = x - y) and screen row (v = x + y). */
const p = (u: number, v: number): [number, number] => [(u + v) / 2, (v - u) / 2];

const user: SceneNode = { id: 'user', kind: 'phone', at: p(-7.2, 0), label: 'searcher', sub: 'types "din"' };
const edge: SceneNode = { id: 'edge', kind: 'cdn', at: p(-3.6, 0), label: 'browser + CDN', sub: 'cached prefixes' };
const svc: SceneNode = { id: 'svc', kind: 'block', at: p(0, 0), label: 'suggest API', sub: 'stateless', icon: 'Search', tint: 'blue' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: p(3.6, 0), label: 'prefix cache', sub: 'Redis · hot prefixes' };
const trie: SceneNode = { id: 'trie', kind: 'server', at: p(7.2, 0), label: 'trie servers', sub: '~60 GB in RAM', tint: 'green' };
const filter: SceneNode = { id: 'filter', kind: 'block', at: p(0, 8), label: 'safety filter', sub: 'live blocklist', icon: 'Shield', tint: 'red' };

const logs: SceneNode = { id: 'logs', kind: 'queue', at: p(-3.6, -8.5), label: 'query log', sub: '~90 GB/day' };
const agg: SceneNode = { id: 'agg', kind: 'block', at: p(0, -8.5), label: 'aggregator', sub: 'daily batch', icon: 'Layers', tint: 'violet' };
const builder: SceneNode = { id: 'builder', kind: 'block', at: p(3.6, -8.5), label: 'trie builder', sub: 'top 15 per node', icon: 'Package', tint: 'amber' };
const snaps: SceneNode = { id: 'snaps', kind: 'storage', at: p(7.2, -8.5), label: 'trie snapshots', sub: 'object storage' };
const trend: SceneNode = { id: 'trend', kind: 'block', at: p(-7.2, -8.5), label: 'trend counter', sub: '5 min windows', icon: 'TrendingUp', tint: 'amber' };

const shardMap: SceneNode = { id: 'shardMap', kind: 'block', at: p(0, -8.5), label: 'shard map', sub: 'prefix ranges', icon: 'Split', tint: 'violet' };
const shardA: SceneNode = { id: 'shardA', kind: 'shard', at: p(-4, 8), label: 'shard a to m', sub: '200 GB' };
const shardS: SceneNode = { id: 'shardS', kind: 'shard', at: p(0, 8), label: 'shard n to s', sub: '200 GB' };
const shardT: SceneNode = { id: 'shardT', kind: 'shard', at: p(4, 8), label: 'shard t to z', sub: '130 GB' };

export const designSearchAutocompletePart2: Lesson = {
  id: 'design-search-autocomplete-part-2',
  title: 'Design search autocomplete (part 2)',
  tagline: 'Cut the traffic at the client, shard the trie, keep it safe and current, and survive failures.',
  minutes: 17,
  level: 'Intermediate',
  learn: [
    'Debouncing and browser caching to cut requests before they leave the device',
    'Sharding the trie by measured load when some letters are far busier than others',
    'Languages, regions, ranking signals and typo tolerance',
    'Filtering harmful suggestions at build time and serve time',
    'Trending queries without a rebuild, failure handling, and what to measure',
  ],
  metrics: [
    { key: 'qps', label: 'Peak requests', icon: 'Activity' },
    { key: 'p99', label: 'p99 server side', icon: 'Timer' },
    { key: 'ram', label: 'Trie in RAM', icon: 'HardDrive' },
    { key: 'fresh', label: 'Freshness', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Where we are',
      tag: 'problem',
      heading: 'Fast read path, but every keystroke still hits it',
      eli5: 'The librarian answers fast now, but every kid still asks after every single letter, and the line outside is getting long. The desk needs fewer questions, not a faster librarian.',
      body: [
        'Part 1 gave us a cache and a trie in RAM, with p99 near 35 ms server side. But the design still receives **700K requests per second** at peak, one for every keystroke.',
        'The cheapest request is one that never reaches us. The next steps start at the client.',
      ],
      keyIdea: 'Serving every keystroke is wasteful. Most of the work can disappear before it reaches the servers.',
      metrics: { qps: '700K/s', p99: '35 ms', ram: '~60 GB', fresh: '24 h' },
      metricTones: { qps: 'bad', p99: 'good' },
      scene: {
        nodes: [{ ...user, chips: ['d', 'di', 'din', 'dinn'] }, { ...svc, status: 'hot', load: 88, badge: '700K/s' }, { ...cache, status: 'active' }],
        links: [{ from: 'user', to: 'svc', label: 'a request per key', labelTone: 'warn' }, { from: 'svc', to: 'cache' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', count: 5, duration: 0.9 },
          { path: ['svc', 'cache', 'svc'], tone: 'response', count: 3, duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'One search, typed fast',
          icon: 'List',
          rows: [
            { text: 'Characters typed', value: '20' },
            { text: 'Requests sent', value: '20', tone: 'bad' },
            { text: 'Answers actually read', value: 'a few', tone: 'warn' },
          ],
        },
        caption: 'Most keystrokes never needed an answer',
      },
    },
    {
      title: 'Debounce',
      tag: 'concept',
      heading: 'Debounce, and cancel stale requests',
      eli5: 'The librarian waits until the kid pauses before guessing. If the kid keeps talking, she throws away the old guess, so a late answer never covers a newer one.',
      body: [
        'Most keystrokes do not need a request. **Debouncing** waits until typing pauses for about 100 ms and sends only the latest prefix. For fast typists, 20 requests per search drop to about 6. Slower typists save less, so the real savings come from debounce plus caching.',
        'The client also cancels any request still in flight when a newer one starts, so an old answer can never overwrite a newer one.',
      ],
      keyIdea: 'Wait for a pause, send only the newest prefix, and cancel older requests.',
      metrics: { qps: '210K/s', p99: '35 ms', ram: '~60 GB', fresh: '24 h' },
      metricTones: { qps: 'warn' },
      scene: {
        nodes: [{ ...user, status: 'active', badge: 'waits 100 ms', chips: ['d', 'di', 'din'] }, { ...svc, status: 'active', badge: 'sees only "din"' }],
        links: [{ from: 'user', to: 'svc', label: '20 requests become 6' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'din (after pause)', duration: 1.2 },
          { path: ['svc', 'user'], tone: 'response', label: 'top 10', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Debounce 100 ms',
          icon: 'Timer',
          rows: [
            { text: 'Requests per search', value: '20 to about 6', tone: 'good' },
            { text: 'Peak at the servers', value: '700K to 210K/s', tone: 'good' },
            { text: 'Stale answers', value: 'cancelled', tone: 'good' },
          ],
        },
        caption: 'Send only what the user will read',
      },
      code: {
        language: 'typescript',
        title: 'Debounce and cancel in the search box',
        source: `const DEBOUNCE_MS = 100;
let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: AbortController | undefined;

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const prefix = input.value.trim().toLowerCase();
    if (!prefix) return render([]);
    inflight?.abort();                       // drop the older request
    inflight = new AbortController();
    try {
      const url = \`/v1/suggest?q=\${encodeURIComponent(prefix)}&locale=\${locale}&k=10\`;
      const res = await fetch(url, { signal: inflight.signal });  // browser cache answers repeats
      render((await res.json()).suggestions);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err;  // aborts are expected
    }
  }, DEBOUNCE_MS);
});`,
        highlight: [6, 7, 11, 12, 15],
      },
    },
    {
      title: 'Browser and CDN',
      tag: 'concept',
      heading: 'Let the browser and a CDN answer repeats',
      eli5: 'The kid keeps a little **notebook** of answers already heard. Rubbing out a letter means checking the notebook, not asking again. A neighborhood notebook at the door helps everyone nearby.',
      body: [
        'The response carries `Cache-Control: public, max-age=300`. Backspacing from `dinn` to `din` is answered from the **browser cache** with no network, and a CDN (the CDN lesson) absorbs popular prefixes for a whole region.',
        'Together with debouncing, peak traffic reaching our servers falls from 700K to about **125K requests per second**. Personalized lists would need `private`, so keep them a separate, small call. Blocklist removals purge these caches (see live filter).',
      ],
      keyIdea: 'Make responses cacheable, so the cheapest request is the one the network never carries.',
      metrics: { qps: '125K/s', p99: '30 ms', ram: '~60 GB', fresh: '24 h' },
      metricTones: { qps: 'good', p99: 'good' },
      scene: {
        nodes: [{ ...user, status: 'active' }, { ...edge, status: 'ok', badge: 'max-age=300' }, { ...svc, status: 'active', load: 30 }],
        links: [{ from: 'user', to: 'edge' }, { from: 'edge', to: 'svc', label: 'only misses continue' }],
        flows: [
          { path: ['user', 'edge'], tone: 'request', label: 'din (backspace)', duration: 1 },
          { path: ['edge', 'user'], tone: 'response', label: 'cached', duration: 1, delay: 1.1 },
          { path: ['user', 'edge', 'svc'], tone: 'request', label: 'dinosaur f', duration: 1.4, delay: 2.3 },
        ],
        panel: {
          title: 'Peak requests at our servers',
          icon: 'Activity',
          rows: [
            { text: 'Every keystroke', value: '700K/s', tone: 'bad' },
            { text: 'After debounce', value: '210K/s', tone: 'warn' },
            { text: 'After browser + CDN cache', value: '125K/s', tone: 'good' },
          ],
        },
        caption: '700K keystrokes per second become 125K requests',
      },
    },
    {
      title: 'Hot letters',
      tag: 'case',
      heading: 'Case: twenty languages, and the letter s is on fire',
      eli5: 'Too many drawers for one librarian, so three librarians split them by letter. Lots of books start with s and few with x, so the s librarian is swamped. Splitting drawers by letter is **sharding by prefix**.',
      body: [
        'The product launches in 20 locales. All tries together reach about **530 GB**, too much for one server\'s RAM. We shard by prefix (the sharding lesson): the first try gives each letter range its own trie servers.',
        'Within a day the shard holding `s` runs at 3x the load of the others, while the `x`, `y`, `z` servers idle. p99 on that shard jumps to 400 ms.',
      ],
      keyIdea: 'Letters are not uniform, in size or in traffic. The alphabet is a bad shard key.',
      metrics: { qps: '125K/s', p99: '400 ms on shard n to s', ram: '~530 GB, 3 shards', fresh: '24 h' },
      metricTones: { p99: 'bad', ram: 'warn' },
      scene: {
        nodes: [
          { ...svc, status: 'active', badge: 'route by prefix' },
          { ...shardA, status: 'ok', load: 40 },
          { ...shardS, status: 'hot', load: 95, badge: '3x load on "s"', chips: [{ text: 'sho', tone: 'warn' }, { text: 'sun', tone: 'warn' }] },
          { ...shardT, status: 'dim', load: 12, badge: 'mostly idle' },
        ],
        links: [
          { from: 'svc', to: 'shardA' },
          { from: 'svc', to: 'shardS' },
          { from: 'svc', to: 'shardT' },
        ],
        flows: [
          { path: ['svc', 'shardS'], tone: 'request', label: 's...', count: 5, duration: 1.2 },
          { path: ['svc', 'shardA'], tone: 'request', duration: 1.2, delay: 0.6 },
          { path: ['svc', 'shardT'], tone: 'request', duration: 1.6, delay: 1.2 },
        ],
        panel: {
          title: 'First try: split by letter',
          icon: 'Split',
          rows: [
            { text: 'a to m', value: '40% load', tone: 'good' },
            { text: 'n to s', value: '95% load', tone: 'bad' },
            { text: 't to z', value: '12% load', tone: 'muted' },
          ],
          footer: { text: 'p99 on the hot shard: 400 ms', tone: 'bad' },
        },
        caption: 'The alphabet is a bad shard key',
      },
    },
    {
      title: 'Shard map',
      tag: 'concept',
      heading: 'Shard on measured load with a movable shard map',
      eli5: 'A front-desk helper keeps a chart of which librarian has which letters, based on how busy each letter was yesterday. When the s drawers get too busy, she moves the line between librarians.',
      body: [
        'A **shard map** service holds ranges like `a to m`, `n to s`, `t to z`, chosen from yesterday\'s request counts and node counts. It moves a boundary (say `sa to sm` versus `sn to sz`) when a range runs hot.',
        'The builder cuts each snapshot along the same ranges. The suggest API reads the map and routes each prefix. A boundary change ships with the next snapshot build, and the map version flips with it.',
      ],
      keyIdea: 'Skewed keys need ranges that move with measured load, not a fixed alphabet split.',
      metrics: { qps: '125K/s', p99: '40 ms', ram: '~530 GB, 3 shards', fresh: '24 h' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...svc, status: 'active' },
          { ...shardMap, status: 'active', badge: 'move boundary' },
          { ...shardA, status: 'ok', load: 55 },
          { ...shardS, status: 'ok', load: 60 },
        ],
        links: [
          { from: 'svc', to: 'shardMap', style: 'dashed', label: 'which shard?' },
          { from: 'svc', to: 'shardA' },
          { from: 'svc', to: 'shardS' },
        ],
        flows: [
          { path: ['svc', 'shardMap'], tone: 'request', label: 'which shard has "sho"?', duration: 1, delay: 0 },
          { path: ['svc', 'shardS'], tone: 'request', label: 'sho', count: 3, duration: 1.2, delay: 1.2 },
          { path: ['svc', 'shardA'], tone: 'request', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Ranges from yesterday\'s load',
          icon: 'Table',
          rows: [
            { text: 'a to m', value: 'shard 1' },
            { text: 'n to sm', value: 'shard 2' },
            { text: 'sn to z', value: 'shard 3', tone: 'good' },
          ],
          footer: { text: 'Boundary moved to balance load', tone: 'good' },
        },
        caption: 'Ranges follow the traffic',
      },
      quiz: {
        question: 'Why is splitting the trie by first letter a poor shard strategy?',
        options: [
          'Tries cannot be split at all',
          'Letters differ a lot in query volume and traffic, so some shards run hot while others idle',
          'The browser cache stops working',
          'Each shard needs a different top-k size',
        ],
        answer: 1,
        explain: 'Many more queries start with s or c than with x or z, in both size and traffic. A shard map that follows measured load lets us move a boundary when a range runs hot.',
      },
    },
    {
      title: 'Hot prefixes',
      tag: 'tradeoff',
      heading: 'Replicate the hottest prefixes instead of a bigger box',
      eli5: 'The one-letter and two-letter cards are tiny but everyone wants them. Copies of those few cards go on every librarian\'s desk and at the door. A busy librarian gets a helper, not a bigger room.',
      body: [
        'The hottest prefixes are one or two characters long. Prefixes shorter than the boundary depth, such as `s`, belong to no single shard, so a small replicated table serves them, and the edge caches them.',
        'A hot shard gets extra replicas rather than a bigger box. Each shard also keeps at least three replicas behind the load balancer for failures.',
      ],
      keyIdea: 'Spread the hottest, smallest answers everywhere, and add replicas to hot shards instead of scaling up.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...edge, status: 'ok', badge: '1 to 2 char prefixes' },
          { ...svc, status: 'active' },
          { ...shardS, status: 'ok', load: 55, badge: '+2 replicas' },
        ],
        links: [{ from: 'edge', to: 'svc' }, { from: 'svc', to: 'shardS' }],
        flows: [
          { path: ['edge', 'svc'], tone: 'request', label: 'only long prefixes', duration: 1.2 },
          { path: ['svc', 'shardS'], tone: 'request', label: 'sho', count: 3, duration: 1.2, delay: 1.3 },
          { path: ['shardS', 'svc'], tone: 'response', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Where answers live',
          icon: 'Copy',
          rows: [
            { text: '1 to 2 character prefixes', value: 'replicated table + edge', tone: 'good' },
            { text: 'Longer prefixes', value: 'one shard' },
            { text: 'Hot shard', value: 'more replicas', tone: 'good' },
            { text: 'Replicas per shard', value: '3 or more' },
          ],
        },
        caption: 'Copy the small hot answers, split the big cold ones',
      },
    },
    {
      title: 'Languages',
      tag: 'concept',
      heading: 'Languages and regions: Unicode nodes, one trie per locale',
      eli5: 'Kids who speak other languages get their own set of drawers with their own letters. Kids in different towns also ask for different books, so each town gets its own set.',
      body: [
        'To support non-English queries, trie nodes store **Unicode** characters, not only a to z. Each locale gets its own trie, since the top queries in one country differ from another\'s.',
        'Normalize the query the same way at build and serve time (Unicode NFC, case folding, accents, full-width forms). Per-locale responses are cached at the edge, keyed by locale.',
      ],
      keyIdea: 'Store Unicode in the nodes and build a trie per locale, so rankings match what each region actually searches.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 20 locales', fresh: '24 h' },
      scene: {
        nodes: [{ ...user, chips: ['en-US: din', 'es-MX: cen'] }, { ...edge, status: 'active' }, { ...svc, status: 'active' }],
        links: [{ from: 'user', to: 'edge' }, { from: 'edge', to: 'svc', label: 'locale in the key' }],
        flows: [
          { path: ['user', 'edge', 'svc'], tone: 'request', label: 'locale=es-MX&q=cen', duration: 1.6 },
          { path: ['svc', 'edge', 'user'], tone: 'response', label: 'cena, centro...', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One trie per locale',
          icon: 'Globe',
          rows: [
            { text: 'en-US', value: 'din: dinner ideas' },
            { text: 'es-MX', value: 'cen: cena, centro' },
            { text: 'ja-JP', value: 'Unicode nodes' },
            { text: 'All 20 locales', value: '~530 GB' },
            { text: 'Normalization', value: 'same at build + serve' },
            { text: 'IME typing (CJK)', value: 'send at compositionend', tone: 'good' },
          ],
        },
        caption: 'Same design, one trie per locale',
      },
    },
    {
      title: 'Build filter',
      tag: 'concept',
      heading: 'Never suggest something harmful: filter at build time',
      eli5: 'Some cards have mean or unsafe titles on them. Before the new cards go in the drawers, a grown-up reads them and crosses out the bad ones, so most bad cards never reach a kid.',
      body: [
        'Popularity is not approval. People search for hateful, sexual, violent and defamatory phrases, and a suggestion puts words in the user\'s mouth. Some suggestions also have to vanish for legal reasons, such as a court order or a privacy request.',
        'At build time, the aggregator drops queries matching blocklists and a classifier, so most bad text never reaches the trie.',
      ],
      keyIdea: 'Popularity is not approval. Filter during the build so most harmful text never enters the trie.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h' },
      scene: {
        nodes: [{ ...logs }, { ...agg, status: 'active', badge: 'drops bad queries' }, { ...filter, at: p(0, 0), status: 'active', badge: 'blocklist + classifier' }, { ...builder }],
        links: [{ from: 'logs', to: 'agg' }, { from: 'filter', to: 'agg', style: 'dashed' }, { from: 'agg', to: 'builder' }],
        flows: [
          { path: ['logs', 'agg'], tone: 'data', duration: 1.2 },
          { path: ['filter', 'agg'], tone: 'request', label: 'check', duration: 1, delay: 1.3 },
          { path: ['agg', 'builder'], tone: 'data', label: 'clean counts', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Dropped before the trie',
          icon: 'Shield',
          rows: [
            { text: 'Hateful or violent', value: 'dropped', tone: 'bad' },
            { text: 'Sexually explicit', value: 'dropped', tone: 'bad' },
            { text: 'Court orders, privacy', value: 'dropped', tone: 'bad' },
            { text: 'Everything else', value: 'kept', tone: 'good' },
          ],
        },
        caption: 'The first line of defense runs offline',
      },
    },
    {
      title: 'Live filter',
      tag: 'concept',
      heading: 'And filter again at serve time, within minutes',
      eli5: 'If a bad card slips through at 3 PM, a grown-up at the desk crosses it out right away. The next night\'s cards leave it out for good. That desk checker is the **safety filter**.',
      body: [
        'At serve time, a **safety filter** in the suggest API checks each returned item against a small, live blocklist. Each node keeps about 15 entries, not 10, so filtering still leaves a full list.',
        'When a harmful suggestion is reported at 3 PM, an operator adds it to the blocklist and the change purges the CDN and prefix cache for affected prefixes, and clients drop items on a small pushed blocklist. It is gone in about a minute, with no rebuild.',
      ],
      keyIdea: 'Filter during the build for scale, and again at serve time so removals take effect in minutes.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h' },
      scene: {
        nodes: [{ ...svc, status: 'active' }, { ...cache }, { ...trie }, { ...filter, status: 'active', badge: 'removed 1 of 15' }],
        links: [{ from: 'svc', to: 'cache' }, { from: 'cache', to: 'trie' }, { from: 'svc', to: 'filter', label: 'live blocklist' }],
        flows: [
          { path: ['svc', 'cache', 'trie'], tone: 'request', duration: 1.2 },
          { path: ['trie', 'cache', 'svc'], tone: 'response', label: '15 candidates', duration: 1.2, delay: 1.3 },
          { path: ['svc', 'filter', 'svc'], tone: 'request', label: 'check blocklist', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Why 15 per node',
          icon: 'List',
          rows: [
            { text: 'Candidates stored', value: '15' },
            { text: 'Removed by blocklist', value: '1', tone: 'warn' },
            { text: 'Returned to the user', value: '10', tone: 'good' },
            { text: 'Cache invalidation', value: 'purge CDN + prefix cache', tone: 'good' },
            { text: 'Client', value: 'pushed blocklist' },
          ],
          footer: { text: 'Operator edit live in under a minute', tone: 'good' },
        },
        caption: 'Every list passes the filter on the way out',
      },
      quiz: {
        question: 'Why store about 15 suggestions per trie node when the API returns 10?',
        options: [
          'The trie needs spare entries to stay balanced',
          'Serve-time filtering may remove some, and 15 leaves a full list of 10 afterwards',
          'Fifteen is the standard cache line size',
          'The client asks for 15 and ignores the rest',
        ],
        answer: 1,
        explain: 'The live blocklist removes items after the lookup. Storing a few extra candidates per node means the user still gets ten safe suggestions.',
      },
    },
    {
      title: 'Ranking',
      tag: 'concept',
      heading: 'Beyond raw counts: ranking and personalization',
      eli5: 'Books that many kids asked for come first, but a book asked about this very hour counts extra. A kid\'s own favorites go on a tiny separate card, so the shared cards stay the same for everybody.',
      body: [
        'Counts are the base score. We blend in recency (the decay from part 1), the locale, and sometimes quality signals such as how often users accept a suggestion.',
        'Personal history (a user\'s own recent searches) is a separate small call merged on the client. It keeps the shared answers cacheable with `public` and avoids storing personal data in the trie.',
      ],
      keyIdea: 'Keep the shared ranking global and cacheable. Add personalization as a small, separate layer.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h' },
      scene: {
        nodes: [{ ...user, status: 'active', chips: ['din'], badge: 'merge on client' }, { ...edge, status: 'ok', badge: 'public, shared' }, { ...svc, status: 'active' }, { id: 'history', kind: 'block', at: p(-7.2, 7.5), label: 'history', sub: 'local storage', icon: 'User', tint: 'green' }],
        links: [{ from: 'user', to: 'edge', label: 'public' }, { from: 'edge', to: 'svc' }, { from: 'user', to: 'history', label: 'private, small call' }],
        flows: [
          { path: ['user', 'edge', 'svc'], tone: 'request', label: 'din', duration: 1.4 },
          { path: ['svc', 'edge', 'user'], tone: 'response', label: 'shared top 10', duration: 1.4, delay: 1.5 },
          { path: ['history', 'user'], tone: 'response', label: 'my recent', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'Score = a blend',
          icon: 'Star',
          rows: [
            { text: 'Weighted search count', value: 'base' },
            { text: 'Recency decay', value: 'adds' },
            { text: 'Acceptance rate', value: 'adds' },
            { text: 'Personal history', value: 'separate call', tone: 'good' },
          ],
          footer: { text: 'Personal data stays out of the trie', tone: 'good' },
        },
        caption: 'Global ranking, private layer on top',
      },
    },
    {
      title: 'Typos',
      tag: 'tradeoff',
      heading: 'Typos: strict prefixes miss "dinnr"',
      eli5: 'A kid says "dinnr" and the drawers hold no such letters. A helper guesses what the kid meant, but that guessing takes extra time and sometimes guesses wrong.',
      body: [
        'A strict prefix match finds nothing for `dinnr`. One fix is **fuzzy matching**: look up prefixes within an edit distance of 1 or 2, or map common misspellings to the right query ahead of time.',
        'Fuzzy lookups cost more per request, so we run them only when the strict result is empty or weak, and we often precompute the mapping offline.',
      ],
      keyIdea: 'Typo tolerance is an extra, costlier path. Use it only when the strict lookup returns little.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [{ ...user, chips: [{ text: 'dinnr', tone: 'warn' }] }, { ...svc, status: 'active', badge: 'strict: 0 results' }, { ...trie, status: 'active', badge: 'edit distance 1' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'trie', label: 'fuzzy path', labelTone: 'warn' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'dinnr', duration: 1 },
          { path: ['svc', 'trie'], tone: 'request', label: 'try "dinner"', duration: 1.2, delay: 1.1 },
          { path: ['trie', 'svc', 'user'], tone: 'response', label: 'dinner ideas...', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'Strict versus fuzzy',
          icon: 'Search',
          rows: [
            { text: 'Strict prefix "dinnr"', value: '0 results', tone: 'bad' },
            { text: 'Edit distance 1', value: '"dinner"', tone: 'good' },
            { text: 'Extra cost', value: 'more work per call', tone: 'warn' },
          ],
          footer: { text: 'Run it only when strict is weak', tone: 'muted' },
        },
        caption: 'A slower path for a small share of queries',
      },
    },
    {
      title: 'Trending',
      tag: 'tradeoff',
      heading: 'Breaking news cannot wait for tomorrow\'s build',
      eli5: 'Kids suddenly ask about a comet that appeared tonight, but the cards were written last night. A helper tallies the last few minutes of slips on a **whiteboard**, and the librarian mixes those in.',
      body: [
        'A storm gets a name at 9 AM and millions search for it. The daily trie does not know the word until tomorrow, and a full rebuild every few minutes is too expensive.',
        'A **trend counter** reads the query log as a stream (the stream processing lesson) and counts queries in 5-minute windows. A query trends when its recent rate is far above its daily baseline.',
      ],
      keyIdea: 'Keep the big trie on a slow cycle and add a fast stream path for what changed in the last minutes.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      scene: {
        nodes: [{ ...svc }, { ...logs, status: 'active' }, { ...trend, status: 'active', badge: '40x baseline' }],
        links: [{ from: 'svc', to: 'logs', style: 'faint' }, { from: 'logs', to: 'trend', label: 'stream' }],
        flows: [
          { path: ['svc', 'logs'], tone: 'event', label: 'storm names', count: 4, duration: 1 },
          { path: ['logs', 'trend'], tone: 'event', label: '5-minute windows', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Trend test for "storm names"',
          icon: 'TrendingUp',
          rows: [
            { text: 'Daily baseline', value: '12 / 5 min' },
            { text: 'Last window', value: '480 / 5 min', tone: 'warn' },
            { text: 'Ratio', value: '40x', tone: 'bad' },
            { text: 'Verdict', value: 'trending', tone: 'good' },
          ],
        },
        caption: 'A fast path watches for sudden spikes',
      },
    },
    {
      title: 'Overlay',
      tag: 'tradeoff',
      heading: 'Merge a small trending overlay with the trie',
      eli5: 'The helper writes a short note card for the front desk with the hot new books. The librarian reads the note and the drawer card together, then boosts the note\'s books. Old notes get thrown away after a few hours.',
      body: [
        'The counter writes a small **trending overlay**, a few thousand prefixes with their hot queries, into the prefix cache. The suggest API merges it with the trie\'s list and boosts trending items. It passes the same safety filter.',
        'The trade is complexity: two ranking sources must be blended so a spike does not crowd out stable suggestions. Entries expire after a few hours unless they keep trending.',
      ],
      keyIdea: 'A small overlay is cheap to rebuild every minute, as long as it expires and cannot crowd out the stable results.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      scene: {
        nodes: [{ ...svc }, { ...cache, status: 'active', badge: 'overlay: storm names' }, { ...trie }, { ...trend, status: 'active' }],
        links: [{ from: 'svc', to: 'cache' }, { from: 'cache', to: 'trie' }, { from: 'trend', to: 'cache', style: 'dashed', label: 'overlay every minute' }],
        flows: [
          { path: ['trend', 'cache'], tone: 'data', label: 'trending overlay', duration: 1.2 },
          { path: ['svc', 'cache', 'svc'], tone: 'response', label: 'trie list + overlay', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Merge rule',
          icon: 'Layers',
          rows: [
            { text: 'Trie list for "sto"', value: 'stock, store...' },
            { text: 'Overlay for "sto"', value: 'storm names', tone: 'warn' },
            { text: 'Merged', value: 'storm names first', tone: 'good' },
            { text: 'Overlay TTL', value: 'a few hours' },
          ],
        },
        caption: 'A small streaming path covers the last few minutes',
      },
    },
    {
      title: 'Bad snapshot',
      tag: 'case',
      heading: 'Case: a bad snapshot must never go live',
      eli5: 'One night the card-maker writes every card wrong. The librarian tests a few drawers before using the new set and keeps the old one handy. Switching back to the old set is a **rollback**.',
      body: [
        'A bug in the builder truncates every query to 8 characters. Loaded blindly, every suggestion worldwide would break within minutes. So each snapshot passes **validation** before the swap: size within 10% of yesterday, a golden set of prefixes that must overlap yesterday\'s, and a canary load on one server first (the deployments lesson).',
        'Servers keep the previous snapshot on disk and can swap back in seconds.',
      ],
      keyIdea: 'Validate every snapshot before it serves, and keep the last good one for an instant rollback.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      scene: {
        nodes: [{ ...builder, status: 'down', badge: 'bad build' }, { ...snaps, status: 'hot', badge: 'validation failed' }, { ...trie, status: 'ok', badge: 'kept v2026-11-15' }],
        links: [{ from: 'builder', to: 'snaps' }, { from: 'snaps', to: 'trie', style: 'dashed', label: 'rejected', labelTone: 'warn' }],
        flows: [
          { path: ['builder', 'snaps'], tone: 'data', label: 'v2026-11-16', duration: 1 },
          { path: ['snaps', 'trie'], tone: 'error', label: 'rejected', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Snapshot gate',
          icon: 'Shield',
          rows: [
            { text: 'Size within 10% of yesterday', value: 'failed', tone: 'bad' },
            { text: 'Golden prefixes overlap', value: 'failed', tone: 'bad' },
            { text: 'Canary on one server', value: 'not reached', tone: 'muted' },
            { text: 'Rollback target', value: 'v2026-11-15', tone: 'good' },
          ],
        },
        caption: 'A bad build never reaches users',
      },
    },
    {
      title: 'Fail quiet',
      tag: 'case',
      heading: 'A dead trie server, and why autocomplete may fail quiet',
      eli5: 'If one librarian is out sick, another takes her drawers and a new one copies the cards from the back room. If a whole desk is jammed, the kid just types the word and no list appears. That beats a slow list.',
      body: [
        'Health checks pull a dead replica out within seconds. A replacement downloads the snapshot from object storage instead of rebuilding.',
        'Autocomplete is optional. If a shard is down, the API returns an empty list within its 50 ms timeout (the timeouts lesson) and the search box still works. Failing quiet is better than slowing down typing.',
      ],
      keyIdea: 'Degrade to no suggestions instead of slow suggestions.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...user }, { ...svc, status: 'active', badge: '50 ms timeout' }, { ...shardS, at: p(3.6, 0), status: 'down', badge: 'all replicas down' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'shardS', label: 'timeout', labelTone: 'warn' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'sho', duration: 1 },
          { path: ['svc', 'shardS'], tone: 'error', label: 'no answer', duration: 1.2, delay: 1.1 },
          { path: ['svc', 'user'], tone: 'response', label: 'empty list, fast', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Failure handling',
          icon: 'Activity',
          rows: [
            { text: 'Dead replica', value: 'pulled in seconds', tone: 'good' },
            { text: 'Replacement', value: 'loads snapshot' },
            { text: 'Shard fully down', value: 'empty list', tone: 'warn' },
            { text: 'Search box', value: 'still works', tone: 'good' },
          ],
        },
        caption: 'Fail quiet, never slow',
      },
    },
    {
      title: 'Measure',
      tag: 'concept',
      heading: 'What to measure to know it works',
      eli5: 'The librarian counts how fast she answers, how often the desk card was enough, and how often a kid picks one of her suggestions. A good answer that nobody picks is still a bad answer.',
      body: [
        'Watch latency (p50 and p99 per shard), cache hit rate, snapshot age and validation results, and the error and timeout rate.',
        'Measure quality too: how often users pick a suggestion, and how much typing it saves. Test ranking changes with A/B experiments before they roll out.',
      ],
      keyIdea: 'Speed metrics say the system is up. Acceptance metrics say the suggestions are any good.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      scene: {
        nodes: [{ ...user, chips: ['picked a suggestion'] }, { ...svc, status: 'active' }, { ...logs, status: 'active', badge: 'clicks + impressions' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'logs', style: 'dashed' }],
        flows: [
          { path: ['user', 'svc'], tone: 'event', label: 'accepted "dinner ideas"', duration: 1.2 },
          { path: ['svc', 'logs'], tone: 'event', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Dashboard',
          icon: 'Gauge',
          rows: [
            { text: 'p99 latency', value: '35 ms', tone: 'good' },
            { text: 'Prefix cache hit rate', value: '~70%', tone: 'good' },
            { text: 'Snapshot age', value: '< 24 h', tone: 'good' },
            { text: 'Suggestion acceptance', value: 'A/B tested' },
          ],
        },
        caption: 'Measure speed and usefulness',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Precompute everything, serve from RAM, fail quiet',
      eli5: 'Count the slips every night, write ten best titles in every drawer of the **trie**, keep the favorites on the desk, and let a grown-up cross out bad ones. Kids get answers before they finish the word.',
      body: [
        'The read path is client debounce and browser cache, then CDN, a stateless suggest API, a prefix cache, and sharded trie servers with the **top 10 cached at every node**. Peak traffic fell from 700K keystrokes to 125K requests per second, and p99 sits near 35 ms server side against a 50 ms budget.',
        'The write path is a query log, a daily aggregation, validated snapshots and a pointer swap. A live filter removes harmful suggestions in minutes, and a streaming overlay adds trending queries between builds.',
      ],
      keyIdea: 'Autocomplete is fast because all the ranking happens before anyone types.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~530 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      metricTones: { qps: 'good', p99: 'good', fresh: 'good' },
      scene: {
        nodes: [{ ...user }, { ...edge, status: 'ok' }, { ...svc, status: 'ok' }, { ...cache, status: 'ok' }, { ...trie, status: 'ok' }],
        links: [
          { from: 'user', to: 'edge' },
          { from: 'edge', to: 'svc' },
          { from: 'svc', to: 'cache' },
          { from: 'cache', to: 'trie' },
        ],
        flows: [
          { path: ['user', 'edge', 'svc', 'cache', 'trie'], tone: 'request', duration: 2 },
          { path: ['trie', 'cache', 'svc', 'edge', 'user'], tone: 'response', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Final numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Keystrokes at peak', value: '700K/s' },
            { text: 'Requests at our servers', value: '125K/s', tone: 'good' },
            { text: 'p99 server side', value: '35 ms of 50', tone: 'good' },
            { text: 'Staleness', value: '24 h + 5 min overlay' },
          ],
        },
        caption: 'The whole read path',
      },
      quiz: {
        question: 'Users report that a hurricane named this morning does not show up in suggestions. What is the best fix?',
        options: [
          'Rebuild the full trie every five minutes',
          'Raise the prefix cache TTL so hot answers stay longer',
          'Add a streaming trend counter that writes a small overlay merged with the trie\'s results',
          'Lower the debounce delay in the browser',
        ],
        answer: 2,
        explain: 'The daily trie cannot know about a term born today, and rebuilding the whole thing every few minutes is wasteful. A small streaming overlay covers recent spikes cheaply and expires on its own.',
      },
    },
  ],
};
