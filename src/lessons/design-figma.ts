import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const ana: SceneNode = { id: 'ana', kind: 'client', at: at(-5, -4.4), label: 'Ana', sub: 'browser tab' };
const ben: SceneNode = { id: 'ben', kind: 'client', at: at(-5, 5), label: 'Ben', sub: 'browser tab' };
const mp: SceneNode = { id: 'mp', kind: 'block', at: at(-0.6, 0), label: 'Multiplayer', sub: 'one doc per process', icon: 'Users', tint: 'violet' };
const oplog: SceneNode = { id: 'oplog', kind: 'queue', at: at(3.4, -3), label: 'Op log', sub: 'per-doc partition' };
const snap: SceneNode = { id: 'snap', kind: 'storage', at: at(3.4, 3.2), label: 'Snapshots', sub: 'object storage' };
const api: SceneNode = { id: 'api', kind: 'block', size: 0.8, at: at(-0.6, -3.6), label: 'File API', sub: 'REST', icon: 'Network', tint: 'blue' };
const meta: SceneNode = { id: 'meta', kind: 'db', at: at(3.4, -3.6), label: 'Metadata DB', sub: 'files, teams' };

export const designFigma: Lesson = {
  id: 'design-figma',
  title: 'Design Figma',
  tagline: 'Real-time multiplayer design: why CRDTs beat locks, one process per document, and how edits survive crashes and offline trips.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Requirements and scale numbers for a collaborative design tool',
    'Why sending operations beats saving whole files, and why concurrent operations need a merge rule',
    'CRDT versus OT, and the CRDT type each property needs',
    'One authoritative process per document, the op log and snapshots',
    'Cursors, offline edits, a 60 fps renderer, version history, and surviving a crash',
  ],
  metrics: [
    { key: 'editors', label: 'Editors on a file', icon: 'Users' },
    { key: 'ops', label: 'Ops per second', icon: 'Activity' },
    { key: 'sock', label: 'Sockets', icon: 'Plug' },
    { key: 'lat', label: 'Edit to peer', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Many people drag shapes on the same canvas at once',
      eli5: 'A class paints one huge poster together. Ana and Ben both reach for the same red square at the same moment, and the poster has to end up the same for everyone.',
      body: [
        'Several people edit one design file and see each other\'s cursors live. Edits made offline must merge cleanly on reconnect. Files keep unlimited version history with branching, and hold **10,000+ layers** that must render at 60 fps in a browser.',
        'Comments, reusable components and design tokens come on top.',
      ],
      keyIdea: 'The hard part is two people changing the same thing at the same moment, and still ending with identical files.',
      metrics: { editors: '?', ops: '?', sock: '?', lat: '?' },
      scene: {
        nodes: [{ ...ana, chips: ['move rect'] }, { ...ben, chips: ['recolor rect'] }, { ...mp, status: 'active' }],
        links: [link('ana', 'mp'), link('ben', 'mp')],
        flows: [
          { path: ['ana', 'mp'], tone: 'request', label: 'move', duration: 1.3 },
          { path: ['ben', 'mp'], tone: 'request', label: 'recolor', duration: 1.3, delay: 0.2 },
          { path: ['mp', 'ana'], tone: 'event', label: 'both edits', duration: 1.3, delay: 1.6 },
        ],
        panel: {
          title: 'Functional requirements',
          icon: 'List',
          rows: [
            { text: 'Live multi-user editing and cursors' },
            { text: 'Offline edits merge on reconnect' },
            { text: 'Version history and branching' },
            { text: '10,000+ layers at 60 fps' },
            { text: 'Comments, components, tokens' },
          ],
        },
        caption: 'Two edits, one shared truth',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: 'The numbers: 4M daily users, 500M files, and a hot file with 50 editors',
      eli5: 'The school has 4 million painters, but only about 50 crowd around one poster at a time. The hard part is keeping a huge pile of posters safe, not the crowd at one.',
      body: [
        '**4M** daily users, **500M** files at about **20 MB** each is **10 PB** raw, and **500K** concurrent WebSockets. A hot brainstorm file has **50** editors.',
        'Cursors at 20 Hz from 50 people is **1,000 messages/s** per file. Edits at 5 ops/s each is **250 ops/s**. Both are small. Storing every op adds about **1 PB per year**.',
      ],
      keyIdea: 'One file is a light workload. Total storage, open sockets and the 20 MB file size shape the design.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '?' },
      metricTones: { sock: 'warn' },
      scene: {
        nodes: [{ ...ana, chips: ['4M DAU'] }, { ...mp, chips: [{ text: '50 editors', tone: 'warn' }], load: 20 }, { ...snap, sub: '10 PB' }],
        links: [link('ana', 'mp'), link('mp', 'snap')],
        flows: [{ path: ['ana', 'mp', 'snap'], tone: 'request', label: '250 ops/s', count: 3, duration: 2 }],
        panel: {
          title: 'Napkin math',
          icon: 'Table',
          rows: [
            { text: 'Cursors, hot file', value: '20 Hz x 50 = 1,000/s' },
            { text: 'Edits, hot file', value: '5 x 50 = 250 ops/s' },
            { text: 'Raw files', value: '500M x 20 MB = 10 PB' },
            { text: 'Op history growth', value: '~1 PB/year', tone: 'warn' },
            { text: 'Open sockets', value: '500K' },
          ],
        },
        caption: 'Light per file, heavy in total',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'REST to open a file, a WebSocket to edit it',
      eli5: 'Walking to the art cupboard to fetch a poster is a slow errand. Once you are painting, you keep a string tied to the teacher so every brush stroke is passed along at once.',
      body: [
        '**REST** lists files, opens one (returns the latest snapshot plus the ops after it), and handles comments and permissions. Edits ride one **WebSocket** with small binary frames.',
        'Each op carries a client id and a counter, so a resend after a dropped socket never applies twice. See the real-time delivery lesson for transport trade-offs.',
      ],
      keyIdea: 'Open a file over REST, then edit over one socket where each op is tiny and idempotent.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '?' },
      scene: {
        nodes: [{ ...ana, chips: ['ws://'] }, { ...api, at: at(-1, -4), chips: ['GET /files/9'] }, { ...mp, at: at(2, 0.6), chips: ['edits'] }],
        links: [link('ana', 'api', { label: 'HTTPS', route: 'straight' }), link('ana', 'mp', { label: 'WebSocket' })],
        flows: [
          { path: ['ana', 'api'], tone: 'request', label: 'open file', duration: 1.3 },
          { path: ['api', 'ana'], tone: 'response', label: 'snapshot + ops', duration: 1.3, delay: 1.4 },
          { path: ['ana', 'mp'], tone: 'request', label: 'op', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Surface',
          icon: 'Code',
          code: 'GET  /files/{id}        open\nGET  /files/{id}/versions\nPOST /files/{id}/comments\nWS   up   op, cursor\nWS   down op, cursor, ack',
          footer: { text: 'Op id makes a resend safe', tone: 'good' },
        },
        caption: 'Slow errands over REST, edits over the socket',
      },
      code: {
        language: 'json',
        title: 'Frames on the socket',
        source: `// client -> server
{ "t": "op", "client": "ana-7", "n": 41, "node": "rect:12", "set": { "fill": "#e11" } }

// server -> everyone else
{ "t": "op", "seq": 90311, "client": "ana-7", "node": "rect:12", "set": { "fill": "#e11" } }

// ack to the sender
{ "t": "ack", "client": "ana-7", "n": 41, "seq": 90311 }`,
        highlight: [2, 5, 8],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'A file is a tree of objects, each with properties',
      eli5: 'The poster is a family tree of shapes. A frame holds a group, the group holds a square, and each square has a few settings like its color and place.',
      body: [
        'A document is a **tree**: page, frames, groups, shapes. Each node has an id, a parent, a position among its siblings, and properties such as `x`, `y`, `fill`, `opacity`.',
        'Every edit is one small op on one node: set a property, insert a node, move a node under a new parent. Metadata (files, teams, permissions) lives in an ordinary database.',
      ],
      keyIdea: 'A design file is a tree of property bags, so every edit reduces to set, insert or move on one node.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '?' },
      scene: {
        nodes: [{ ...meta, at: at(-3.6, 0) }, { ...mp, at: at(0, 0), label: 'Document', sub: 'tree of nodes', status: 'active' }, { ...snap, at: at(3.6, 0), sub: 'file blob' }],
        links: [link('meta', 'mp'), link('mp', 'snap')],
        panel: {
          title: 'One node',
          icon: 'Braces',
          code: '{ id: "rect:12",\n  parent: "frame:3",\n  pos: "0.35",\n  x: 120, y: 80,\n  fill: "#e11",\n  opacity: 1 }',
          footer: { text: 'Edits: set, insert, move', tone: 'muted' },
        },
        caption: 'Tree of nodes, properties on each',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The first version: load the file, edit, save the whole thing',
      eli5: 'Each painter copies the whole poster onto their own sheet, paints, then walks back and pins their sheet over the old one on the wall.',
      body: [
        'The client downloads the 20 MB file, edits it locally, and uploads the whole file on save. The server stores the newest upload. It is easy to build and fine for one author.',
      ],
      keyIdea: 'Whole-file saves work for one person. They are a bet that nobody else edited meanwhile.',
      metrics: { editors: '1', ops: '-', sock: '-', lat: 'on save' },
      scene: {
        nodes: [{ ...ana, at: at(-4, 0), chips: ['20 MB file'] }, { ...api, at: at(0, 0), chips: ['PUT /files/9'] }, { ...snap, at: at(4, 0) }],
        links: [link('ana', 'api', { label: '20 MB upload', labelTone: 'warn' }), link('api', 'snap')],
        flows: [
          { path: ['ana', 'api', 'snap'], tone: 'data', label: 'whole file', duration: 2 },
          { path: ['snap', 'api', 'ana'], tone: 'response', label: 'saved', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Save cost',
          icon: 'Download',
          rows: [
            { text: 'Bytes per save', value: '20 MB', tone: 'warn' },
            { text: 'Edit changed', value: '~100 bytes' },
          ],
          footer: { text: 'Fine for one author', tone: 'muted' },
        },
        caption: 'Last upload wins',
      },
    },
    {
      title: 'Lost update',
      tag: 'case',
      heading: 'Where it breaks: Ben\'s save erases Ana\'s work',
      eli5: 'Ana and Ben each paint a copy. Ben pins his sheet last, and Ana\'s new star vanishes from the wall without anyone saying a word.',
      body: [
        'Ana adds a button at 10:00. Ben, who opened the file at 9:55, changes a color and saves at 10:02. His upload holds the old tree plus his change, so **Ana\'s button is gone**.',
        'A lock fixes it but allows one editor at a time, which defeats the goal. The fix is to send small **operations** instead of files, about 100 bytes against 20 MB.',
      ],
      keyIdea: 'Last-write-wins on a whole file silently destroys concurrent work. Send ops, not files.',
      metrics: { editors: '2', ops: '-', sock: '-', lat: 'on save' },
      metricTones: { editors: 'bad' },
      scene: {
        nodes: [{ ...ana, chips: ['+ button'] }, { ...ben, chips: ['recolor'] }, { ...api, at: at(-0.6, 0), status: 'hot', badge: 'last save wins' }, { ...snap, at: at(3.4, 0), status: 'down', badge: 'button lost' }],
        links: [link('ana', 'api'), link('ben', 'api'), link('api', 'snap')],
        flows: [
          { path: ['ana', 'api', 'snap'], tone: 'data', label: '10:00 save', duration: 1.6 },
          { path: ['ben', 'api', 'snap'], tone: 'error', label: '10:02 save', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: '9:55 Ben opens file' },
            { text: '10:00 Ana saves a button', tone: 'good' },
            { text: '10:02 Ben saves old tree', tone: 'bad' },
            { text: 'Result: no button', tone: 'bad' },
          ],
        },
        caption: 'The newer save erased the older one',
      },
    },
    {
      title: 'Ops collide',
      tag: 'concept',
      heading: 'Small ops fix the size problem and expose the real one',
      eli5: 'Instead of carrying the whole poster, painters shout one short instruction like "make square 12 red". Two shouts can arrive in different order for different painters.',
      body: [
        'An op is about 100 bytes, so edits stream instantly. But Ana and Ben now send ops at the same moment, and each peer applies them in the order it receives them.',
        'Ana sets `x = 10` while Ben sets `x = 50`. Ana\'s screen applies hers, then his, and shows 50. Ben\'s screen applies his, then hers, and shows 10. The files **diverge**.',
      ],
      keyIdea: 'Applying the same ops in different orders must give the same result, or peers drift apart forever.',
      metrics: { editors: '2', ops: '10/s', sock: '2', lat: '~50 ms' },
      metricTones: { editors: 'warn' },
      scene: {
        nodes: [{ ...ana, chips: [{ text: 'x = 50', tone: 'bad' }] }, { ...ben, chips: [{ text: 'x = 10', tone: 'bad' }] }, { ...mp, label: 'Relay', sub: 'forwards ops' }],
        links: [link('ana', 'mp'), link('ben', 'mp')],
        flows: [
          { path: ['ana', 'mp', 'ben'], tone: 'request', label: 'set x=10', duration: 1.8 },
          { path: ['ben', 'mp', 'ana'], tone: 'request', label: 'set x=50', duration: 1.8, delay: 0.1 },
        ],
        panel: {
          title: 'Order of arrival',
          icon: 'Repeat',
          rows: [
            { text: 'Ana applies: 10 then 50', value: 'x = 50', tone: 'warn' },
            { text: 'Ben applies: 50 then 10', value: 'x = 10', tone: 'warn' },
          ],
          footer: { text: 'Same ops, different files', tone: 'bad' },
        },
        caption: 'Two peers, two different answers',
      },
    },
    {
      title: 'OT vs CRDT',
      tag: 'tradeoff',
      heading: 'Two ways to make concurrent ops converge',
      eli5: 'One rule: a referee rewrites every shout to fit the others. The other rule: shouts are written so that any order gives the same poster. Figma picked the second.',
      body: [
        '**Operational transformation** rewrites each op against the concurrent ones, and Google Docs started there. It needs a central server to order ops, and a transform per pair of op types.',
        'A **CRDT** (conflict-free replicated data type) makes ops commute, so any order converges. The OT server is a single point of failure and editing freezes if it hiccups, while CRDT clients keep editing locally. Figma chose it because a design tool has a small, bounded set of ops.',
      ],
      keyIdea: 'CRDTs trade a few extra bytes of metadata per op for merges that work in any order, including after offline gaps.',
      quiz: {
        question: 'Why can two peers applying the same ops in different orders still converge with a CRDT?',
        options: [
          'The server rewrites every op to fit the others',
          'Ops commute by construction, so order does not change the result',
          'Every peer applies ops in wall-clock order',
          'Peers lock the property before editing it',
        ],
        answer: 1,
        explain: 'A CRDT is designed so merging is commutative and associative. Rewriting ops is operational transformation, and locking removes concurrency.',
      },
      metrics: { editors: '2', ops: '10/s', sock: '2', lat: '~50 ms' },
      scene: {
        nodes: [{ ...ana, chips: ['CRDT op'] }, { ...mp, label: 'Merge rule', sub: 'any order, same result', status: 'ok' }, { ...ben, chips: ['CRDT op'] }],
        links: [link('ana', 'mp'), link('ben', 'mp')],
        flows: [
          { path: ['ana', 'mp'], tone: 'request', label: 'op A', duration: 1.2 },
          { path: ['ben', 'mp'], tone: 'request', label: 'op B', duration: 1.2, delay: 0.1 },
        ],
        panel: {
          title: 'OT versus CRDT',
          icon: 'Table',
          rows: [
            { text: 'Core idea', value: 'transform vs commute' },
            { text: 'Central server needed', value: 'OT yes, CRDT optional' },
            { text: 'Offline edits', value: 'OT brittle, CRDT natural', tone: 'good' },
            { text: 'Cost', value: 'OT pairs, CRDT metadata', tone: 'warn' },
            { text: 'Complexity', value: 'OT O(N^2) pairs, CRDT one type per field' },
          ],
        },
        caption: 'Commutative ops need no referee',
      },
    },
    {
      title: 'Last writer wins',
      tag: 'concept',
      heading: 'Simple properties: a register with a timestamp',
      eli5: 'Every shout carries a ticket number. If two painters shout different colors for the same square, everyone keeps the shout with the bigger ticket number.',
      body: [
        'For plain values such as fill color or opacity, each property is a **last-write-wins register**. An op carries a **Lamport timestamp** (a counter plus a client id for tie-breaks), and the highest wins on every peer.',
        'Ana\'s `x = 10` and Ben\'s `x = 50` now resolve the same everywhere. See the clocks and ordering lesson for why a counter beats wall-clock time.',
      ],
      keyIdea: 'One timestamp per property makes any arrival order end on the same winner.',
      metrics: { editors: '2', ops: '10/s', sock: '2', lat: '~50 ms' },
      scene: {
        nodes: [{ ...ana, chips: ['x=10 @ (7, ana)'] }, { ...ben, chips: ['x=50 @ (8, ben)'] }, { ...mp, label: 'x register', sub: 'highest stamp wins', status: 'ok', badge: 'x = 50' }],
        links: [link('ana', 'mp'), link('ben', 'mp')],
        flows: [
          { path: ['ana', 'mp', 'ben'], tone: 'request', label: 'x=10 @7', duration: 1.8 },
          { path: ['ben', 'mp', 'ana'], tone: 'request', label: 'x=50 @8', duration: 1.8, delay: 0.1 },
        ],
        panel: {
          title: 'Both peers',
          icon: 'Gauge',
          rows: [
            { text: 'Ana ends with', value: 'x = 50', tone: 'good' },
            { text: 'Ben ends with', value: 'x = 50', tone: 'good' },
          ],
          footer: { text: 'Converged', tone: 'good' },
        },
        caption: 'Higher timestamp wins everywhere',
      },
      code: {
        language: 'typescript',
        title: 'A last-write-wins property',
        source: `type Stamp = { counter: number; client: string };
type Reg<T> = { value: T; stamp: Stamp };

const newer = (a: Stamp, b: Stamp) =>
  a.counter !== b.counter ? a.counter > b.counter : a.client > b.client;

function applySet<T>(reg: Reg<T>, value: T, stamp: Stamp): Reg<T> {
  return newer(stamp, reg.stamp) ? { value, stamp } : reg;
}`,
        highlight: [4, 5, 8],
      },
    },
    {
      title: 'Layer order',
      tag: 'concept',
      heading: 'Ordering layers with fractions, not integers',
      eli5: 'Stickers are stacked in order. If two painters each slip a sticker between sticker 3 and 4, give them labels like 3.5 and 3.6 so neither bumps the other.',
      body: [
        'Z-order inside a parent is a list, and integer positions break: two inserts at index 3 both claim 3 and shift everything after them.',
        'Use **fractional indexing**: a new layer between `0.3` and `0.4` gets `0.35`. Both users compute the same midpoint, and the client id breaks the tie, so both layers survive in a stable order.',
      ],
      keyIdea: 'Give every child a sortable key between its neighbors, and inserts never renumber anything.',
      metrics: { editors: '2', ops: '10/s', sock: '2', lat: '~50 ms' },
      scene: {
        nodes: [{ ...ana, chips: ['insert @ 0.35'] }, { ...ben, chips: ['insert @ 0.35'] }, { ...mp, label: 'Layer list', sub: 'sorted by key', status: 'ok' }],
        links: [link('ana', 'mp'), link('ben', 'mp')],
        flows: [
          { path: ['ana', 'mp'], tone: 'request', label: 'pos 0.35', duration: 1.2 },
          { path: ['ben', 'mp'], tone: 'request', label: 'pos 0.35', duration: 1.2, delay: 0.1 },
        ],
        panel: {
          title: 'Children of frame:3',
          icon: 'Layers',
          rows: [
            { text: 'rect:1', value: '0.3' },
            { text: 'star (Ana)', value: '0.35, ana', tone: 'good' },
            { text: 'oval (Ben)', value: '0.35, ben', tone: 'good' },
            { text: 'rect:2', value: '0.4' },
          ],
          footer: { text: 'Both inserts survive', tone: 'good' },
        },
        caption: 'Same key, client id breaks the tie',
      },
    },
    {
      title: 'Tree moves',
      tag: 'concept',
      heading: 'Two users drag one layer to different parents',
      eli5: 'Ana carries a toy to the red box while Ben carries it to the blue box. One box has to win, and nobody may put a box inside itself.',
      body: [
        'A move sets a layer\'s `parent`. If both users move it, the op with the larger timestamp wins, the same register rule as before.',
        'Moves also risk **cycles**: Ana puts A inside B while Ben puts B inside A. During merge, any op that would create a cycle is rejected, so the tree stays a tree.',
      ],
      keyIdea: 'Moves are last-write-wins on the parent pointer, plus a cycle check at merge time.',
      metrics: { editors: '2', ops: '10/s', sock: '2', lat: '~50 ms' },
      scene: {
        nodes: [{ ...ana, chips: ['move A into B'] }, { ...ben, chips: ['move B into A'] }, { ...mp, label: 'Tree merge', sub: 'rejects cycles', status: 'active', badge: '1 op rejected' }],
        links: [link('ana', 'mp'), link('ben', 'mp')],
        flows: [
          { path: ['ana', 'mp'], tone: 'request', label: 'A in B', duration: 1.2 },
          { path: ['ben', 'mp'], tone: 'error', label: 'B in A', duration: 1.2, delay: 0.2 },
        ],
        panel: {
          title: 'Merge result',
          icon: 'Network',
          rows: [
            { text: 'Same layer, two parents', value: 'larger stamp wins' },
            { text: 'A in B, B in A', value: 'second rejected', tone: 'warn' },
          ],
          footer: { text: 'Tree stays acyclic', tone: 'good' },
        },
        caption: 'No move may create a loop',
      },
    },
    {
      title: 'Server owns truth',
      tag: 'tradeoff',
      heading: 'CRDT ops, but one server decides the order',
      eli5: 'The painters could trade shouts directly, but it is simpler to have one teacher who hears every shout, numbers it, and repeats it. Everyone still follows the same merge rules.',
      body: [
        'Pure peer-to-peer CRDTs need no server. Figma kept a **server that owns the truth** per document: it receives ops, assigns a sequence number, applies them to in-memory state and rebroadcasts.',
        'The CRDT rules still make offline edits merge. The server only removes decentralization we did not need. The cost: one document lives on one process.',
      ],
      keyIdea: 'Use CRDT ops for correct merging and a single authority for ordering. Pragmatism over purity.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      quiz: {
        question: 'What does the single server per document add on top of CRDT merge rules?',
        options: [
          'A single order and a sequence number',
          'The ability to merge offline edits',
          'Commutative ops',
          'Locks on every property',
        ],
        answer: 0,
        explain: 'The CRDT rules already handle merging. The server adds one agreed order and a sequence number for every op.',
      },
      scene: {
        nodes: [{ ...ana, chips: ['op'] }, { ...mp, status: 'active', badge: 'seq 90311' }, { ...ben, chips: ['op'] }],
        links: [link('ana', 'mp', { arrow: 'both' }), link('ben', 'mp', { arrow: 'both' })],
        flows: [
          { path: ['ana', 'mp'], tone: 'request', label: 'op', duration: 1.2 },
          { path: ['mp', 'ben'], tone: 'event', label: 'op #90311', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One authority per file',
          icon: 'Server',
          rows: [
            { text: 'Assigns sequence numbers' },
            { text: 'Holds CRDT state in memory' },
            { text: 'Appends to the op log' },
            { text: 'Hot file = hot process', tone: 'warn' },
          ],
        },
        caption: 'CRDT merging, server ordering',
      },
    },
    {
      title: 'Op round trip',
      tag: 'concept',
      heading: 'Apply locally first, confirm later',
      eli5: 'When Ana moves her square she sees it move at once on her own sheet. The teacher then numbers her shout and repeats it to Ben, and Ana\'s sheet just gets a tick mark.',
      body: [
        'The client applies each op to its own copy **immediately**, so dragging feels instant. It then sends the op and keeps it as pending until the ack arrives.',
        'The server numbers the op, writes it to the log, and broadcasts it. Ben sees it about 50 ms later. Ana\'s ack confirms the order, and pending ops are re-applied on top of anything new from others.',
      ],
      keyIdea: 'Optimistic local apply gives zero-lag editing. The server order and the merge rules reconcile the rest.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [{ ...ana, chips: ['applied at once'] }, { ...mp, status: 'active' }, { ...ben, chips: ['sees it ~50 ms'] }, { ...oplog, at: at(3.4, 0) }],
        links: [link('ana', 'mp', { arrow: 'both' }), link('mp', 'ben'), link('mp', 'oplog')],
        flows: [
          { path: ['ana', 'mp'], tone: 'request', label: 'op n=41', duration: 1 },
          { path: ['mp', 'oplog'], tone: 'data', label: 'append', duration: 1, delay: 1.1 },
          { path: ['mp', 'ben'], tone: 'event', label: 'op #90311', duration: 1, delay: 1.1 },
          { path: ['mp', 'ana'], tone: 'response', label: 'ack', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Pending list on Ana',
          icon: 'List',
          rows: [
            { text: 'n=41 sent, waiting', tone: 'warn' },
            { text: 'ack seq 90311 arrives', tone: 'good' },
            { text: 'pending cleared' },
          ],
        },
        caption: 'Local first, then confirmed',
      },
    },
    {
      title: 'Cursors',
      tag: 'concept',
      heading: 'Cursors are cheap, throwaway messages',
      eli5: 'Seeing a friend\'s finger point at the poster is nice but you do not need to keep a record of it. If one pointing gets lost, the next one replaces it.',
      body: [
        'Cursor and selection updates arrive at 20 Hz per user, so 50 people send **1,000 messages/s**. They go through the same multiplayer process but skip the CRDT and the op log.',
        'They are **ephemeral**: only the latest position matters, a dropped update is harmless, and when a socket closes the cursor vanishes. Nothing is written to disk.',
      ],
      keyIdea: 'Presence is fire-and-forget. Persisting or ordering it would cost more than it is worth.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      scene: {
        nodes: [{ ...ana, chips: ['cursor 20 Hz'] }, { ...mp, chips: ['1,000 msg/s'], load: 25 }, { ...ben, chips: ['sees Ana point'] }],
        links: [link('ana', 'mp'), link('mp', 'ben')],
        flows: [
          { path: ['ana', 'mp'], tone: 'event', label: 'x,y', count: 3, duration: 1.2 },
          { path: ['mp', 'ben'], tone: 'event', label: 'x,y', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Cursor frame',
          icon: 'Signal',
          rows: [
            { text: 'Stored in op log', value: 'no', tone: 'good' },
            { text: 'Needs ack', value: 'no', tone: 'good' },
            { text: 'Lost update', value: 'harmless' },
            { text: 'On disconnect', value: 'removed' },
          ],
        },
        caption: 'Latest position only, never saved',
      },
    },
    {
      title: 'Log and snapshots',
      tag: 'concept',
      heading: 'Every op goes in a log, and snapshots keep reopening fast',
      eli5: 'The teacher writes every shout in a notebook and, every so often, takes a photo of the whole poster. To rebuild the poster, start from the latest photo and replay the shouts after it.',
      body: [
        'Each op is appended to a durable **op log**, one partition per document. Replaying all of it for a 20 MB file with millions of ops would take far too long.',
        'So a snapshot service checkpoints the full state to object storage every N ops. Opening a file loads the latest snapshot and replays only the ops after it. See the event sourcing lesson for the same idea.',
      ],
      keyIdea: 'The log is the truth and history. Snapshots only bound how much of it you replay.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      scene: {
        nodes: [{ ...mp, at: at(-3.8, 0) }, { ...oplog, at: at(0, -3.4) }, { ...snap, at: at(0, 3.4) }, { ...api, at: at(3.8, 0), label: 'Open file' }],
        links: [link('mp', 'oplog'), link('mp', 'snap', { label: 'every N ops' }), link('oplog', 'api'), link('snap', 'api')],
        flows: [
          { path: ['mp', 'oplog'], tone: 'data', label: 'op', duration: 1.1 },
          { path: ['mp', 'snap'], tone: 'data', label: 'checkpoint', duration: 1.4, delay: 1.2 },
          { path: ['snap', 'api'], tone: 'response', label: 'latest snapshot', duration: 1.2, delay: 2.8 },
          { path: ['oplog', 'api'], tone: 'response', label: 'ops after it', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'Open a file',
          icon: 'FileText',
          rows: [
            { text: 'Load snapshot at seq 90,000' },
            { text: 'Replay ops 90,001 to 90,311', value: '311 ops', tone: 'good' },
            { text: 'Full replay instead', value: 'millions', tone: 'bad' },
          ],
        },
        caption: 'Snapshot plus the tail of the log',
      },
      code: {
        language: 'typescript',
        title: 'Rebuild a document',
        source: `async function load(docId: string): Promise<Doc> {
  const snap = await snapshots.latest(docId);      // seq + full state
  const doc = decode(snap.bytes);
  for await (const op of opLog.read(docId, snap.seq + 1)) {
    doc.apply(op);                                  // CRDT apply is idempotent
  }
  return doc;
}`,
        highlight: [2, 4, 5],
      },
    },
    {
      title: 'Offline edits',
      tag: 'case',
      heading: 'Case: Ana edits on a train, then reconnects',
      eli5: 'Ana paints in a tunnel with no string to the teacher. When she comes out, she reads her shouts out in order, and the merge rules fold them in with everything the others did.',
      body: [
        'Offline, the client keeps applying ops locally and queues them with their timestamps. On reconnect it fetches the ops it missed and sends its queue.',
        'Because ops commute, a long gap needs no special handling, which is where OT struggles. If both sides changed the same property, the larger timestamp wins, so one value is kept, not both.',
      ],
      keyIdea: 'A CRDT makes offline just a long delay. Merge the queue and the missed ops with the same rules.',
      metrics: { editors: '51', ops: '250/s', sock: '500K', lat: 'catch-up' },
      metricTones: { lat: 'warn' },
      scene: {
        nodes: [{ ...ana, status: 'dim', chips: [{ text: '38 queued ops', tone: 'warn' }] }, { ...mp, status: 'active' }, { ...ben, chips: ['kept editing'] }],
        links: [link('ana', 'mp', { label: 'reconnect', labelTone: 'warn' }), link('ben', 'mp')],
        flows: [
          { path: ['mp', 'ana'], tone: 'response', label: 'missed ops', duration: 1.3 },
          { path: ['ana', 'mp'], tone: 'request', label: '38 queued', count: 3, duration: 1.3, delay: 1.4 },
          { path: ['mp', 'ben'], tone: 'event', label: 'merged', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Reconnect',
          icon: 'Wifi',
          rows: [
            { text: 'Fetch ops after seq 90,311' },
            { text: 'Send 38 queued ops' },
            { text: 'Same property edited', value: 'higher stamp wins', tone: 'warn' },
            { text: 'All peers converge', tone: 'good' },
          ],
        },
        caption: 'Offline is a long delay',
      },
    },
    {
      title: 'Shard by file',
      tag: 'concept',
      heading: 'Each file lives on exactly one multiplayer process',
      eli5: 'Every poster has one teacher assigned to it. A front desk looks at the poster number and sends each painter to the right teacher.',
      body: [
        'All editors of a file must reach the same process, so ordering stays simple and state sits in memory. A router maps `file id` to a process, using the consistent hashing lesson or a directory, and sends each socket there.',
        'The file count is huge but each is light, so many files share one machine. When a process dies, the router reassigns its files.',
      ],
      keyIdea: 'Partition by file id: a file never spans processes, and files spread across many of them.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      scene: {
        nodes: [{ ...ana, at: at(-5, 0), chips: ['file 9'] }, { id: 'router', kind: 'lb', at: at(-1.6, 0), label: 'Router', sub: 'file id to process' }, { ...mp, id: 'mp1', at: at(2.2, -3.2), label: 'Process 1', sub: 'files 1, 9, 14' }, { ...mp, id: 'mp2', at: at(2.2, 3.2), label: 'Process 2', sub: 'files 2, 5, 7', tint: 'teal' }],
        links: [link('ana', 'router'), link('router', 'mp1'), link('router', 'mp2', { style: 'faint' })],
        flows: [{ path: ['ana', 'router', 'mp1'], tone: 'request', label: 'file 9', duration: 2 }],
        panel: {
          title: 'Routing',
          icon: 'Route',
          rows: [
            { text: 'hash(file 9)', value: 'process 1' },
            { text: 'Every editor of file 9', value: 'process 1', tone: 'good' },
            { text: 'Process dies', value: 'reassign files', tone: 'warn' },
          ],
        },
        caption: 'One file, one owner',
      },
    },
    {
      title: 'Hot file limit',
      tag: 'tradeoff',
      heading: 'The cost: one file cannot grow past one process',
      eli5: 'One teacher per poster is tidy, but if a thousand painters crowd one poster, that single teacher cannot hear them all. A normal class of 50 is fine.',
      body: [
        'A single writer gives strong ordering and a simple in-memory CRDT. The price is that a hot file is a hot process, and one document cannot use more than about one core.',
        'That is acceptable at 250 ops/s. Cheaper moves are to give the busiest files their own process and to keep view-only users off the write path. Past that, large events are a different problem.',
      ],
      keyIdea: 'Single-writer shards are simple and fast until one file outgrows one core. Plan for it, do not shard inside a file.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      metricTones: { ops: 'warn' },
      scene: {
        nodes: [{ ...ana, at: at(-5, 0), chips: ['1,000 editors?'] }, { ...mp, at: at(0, 0), status: 'hot', load: 92, chips: [{ text: 'one core', tone: 'bad' }] }, { ...oplog, at: at(4, 0) }],
        links: [link('ana', 'mp'), link('mp', 'oplog')],
        flows: [{ path: ['ana', 'mp', 'oplog'], tone: 'request', label: 'ops', count: 4, duration: 1.6 }],
        panel: {
          title: 'Hot file budget',
          icon: 'Gauge',
          rows: [
            { text: '50 editors, 250 ops/s', value: 'fine', tone: 'good' },
            { text: '1,000 editors', value: 'core saturated', tone: 'bad' },
            { text: 'Mitigation', value: 'dedicated process' },
          ],
        },
        caption: 'Strong ordering costs scale-out',
      },
    },
    {
      title: 'Rendering',
      tag: 'concept',
      heading: 'Draw 10,000 layers at 60 fps with WebAssembly and WebGL',
      eli5: 'Painting a huge poster with thousands of tiny shapes is slow if you redraw everything. So the painter only redraws the part of the poster that the window is showing.',
      body: [
        'DOM or SVG would collapse at 10,000 layers. The editor is a C++ engine compiled to **WebAssembly** that draws straight to **WebGL** on a canvas.',
        'Each frame draws only the visible viewport. Offscreen objects are culled using a **quadtree**, a spatial index over bounding boxes, and hover hit-testing uses the same tree.',
      ],
      keyIdea: 'Own the renderer, draw only what is in view, and index space so lookups skip most layers.',
      metrics: { editors: '1', ops: '-', sock: '-', lat: '16 ms/frame' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [{ id: 'wasm', kind: 'block', at: at(-3.6, 0), label: 'WASM engine', sub: 'C++ core', icon: 'Cpu', tint: 'amber' }, { id: 'quad', kind: 'block', at: at(0, 0), label: 'Quadtree', sub: 'culls offscreen', icon: 'Split', tint: 'teal' }, { id: 'gl', kind: 'block', at: at(3.6, 0), label: 'WebGL', sub: 'canvas', icon: 'Layers', tint: 'violet', status: 'ok' }],
        links: [link('wasm', 'quad'), link('quad', 'gl')],
        flows: [{ path: ['wasm', 'quad', 'gl'], tone: 'data', label: '300 visible', duration: 2 }],
        panel: {
          title: 'One frame',
          icon: 'Timer',
          rows: [
            { text: 'Layers in file', value: '10,000' },
            { text: 'Inside viewport', value: '~300', tone: 'good' },
            { text: 'Frame budget', value: '16 ms' },
            { text: 'Cost: WASM download', value: '2 to 3 MB', tone: 'warn' },
          ],
        },
        caption: 'Draw what is visible',
      },
    },
    {
      title: 'Assets',
      tag: 'concept',
      heading: 'Images and fonts come from object storage and a CDN',
      eli5: 'Photos and special letters are not painted on the poster. They sit in a cupboard, and each painter fetches the copy from the shelf nearest to them.',
      body: [
        'Raster images and fonts are large and rarely change, so they stay out of the op stream. The document stores only a reference by content hash. See the object storage and CDN lessons.',
        'The client fetches each asset from the nearest **CDN** edge on demand and caches it. Opening a 20 MB file therefore means a snapshot plus just the assets in view.',
      ],
      keyIdea: 'Keep big immutable blobs out of the op log. Store a hash in the document and serve the bytes from a CDN.',
      metrics: { editors: '1', ops: '-', sock: '-', lat: 'edge hit' },
      scene: {
        nodes: [{ ...ana, at: at(-4, 0), chips: ['img:9f3a'] }, { id: 'cdn', kind: 'cdn', at: at(0, 0), label: 'Asset CDN', sub: 'images, fonts' }, { ...snap, at: at(4, 0), label: 'Asset store', sub: 'by content hash' }],
        links: [link('ana', 'cdn'), link('cdn', 'snap')],
        flows: [
          { path: ['ana', 'cdn'], tone: 'request', label: 'GET img:9f3a', duration: 1.2 },
          { path: ['cdn', 'snap'], tone: 'request', label: 'miss', duration: 1.2, delay: 1.3 },
          { path: ['snap', 'cdn', 'ana'], tone: 'response', label: 'image bytes', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Where bytes live',
          icon: 'HardDrive',
          rows: [
            { text: 'Shape properties', value: 'op log' },
            { text: 'Image or font', value: 'object store' },
            { text: 'Document holds', value: 'hash only', tone: 'good' },
          ],
        },
        caption: 'Blobs stay out of the op stream',
      },
    },
    {
      title: 'Versions',
      tag: 'concept',
      heading: 'Version history and branches fall out of the log',
      eli5: 'Because the teacher wrote down every shout, you can rewind the poster to last Tuesday, or copy it to a side poster and try a new idea there.',
      body: [
        'The op log already records every change, so **history** is a snapshot plus a prefix of the log. Named versions are bookmarks at a sequence number. Restoring one writes new ops, never deleting old ones.',
        'A **branch** forks from a version into a new document with its own log. Merging it back reuses the CRDT merge rules, like git for designs. History is roughly 100x a file\'s size over its life, and new op data is about 1 PB per year.',
      ],
      keyIdea: 'An append-only log gives history for free. Branches are forks of it, merged with the same rules.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      scene: {
        nodes: [{ ...oplog, at: at(-3.6, 0), sub: 'seq 1 ... 90,311' }, { id: 'main', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'main', icon: 'Share2', tint: 'blue' }, { id: 'branch', kind: 'block', size: 0.8, at: at(0, 3.2), label: 'branch', icon: 'Split', tint: 'green' }],
        links: [link('oplog', 'main'), link('oplog', 'branch', { label: 'fork at seq 80,000' })],
        flows: [
          { path: ['oplog', 'main'], tone: 'data', label: 'ops', duration: 1.3 },
          { path: ['oplog', 'branch'], tone: 'data', label: 'copy', duration: 1.3, delay: 0.3 },
          { path: ['branch', 'main'], tone: 'event', label: 'merge', duration: 1.3, delay: 1.8 },
        ],
        panel: {
          title: 'History is the log',
          icon: 'Clock',
          rows: [
            { text: 'View version', value: 'snapshot + log prefix' },
            { text: 'Restore', value: 'new ops, nothing erased', tone: 'good' },
            { text: 'Log vs file, ~100x', value: '~100x', tone: 'warn' },
          ],
        },
        caption: 'Rewind, fork, merge',
      },
    },
    {
      title: 'Comments, components',
      tag: 'concept',
      heading: 'Comments and reusable components sit beside the CRDT',
      eli5: 'A sticky note on the poster says "make this bigger" and belongs to the wall, not the painting. A stamp lets many painters reuse one drawing, and fixing the stamp fixes every print.',
      body: [
        '**Comments** pin to a node id and a position, and live in the ordinary metadata database. They need permissions and notifications, not merge rules.',
        'A **component** has one main definition and many instances that reference it with a few overrides. Editing the main updates every instance. **Design tokens** (colors, spacing) are shared properties instances read by name.',
      ],
      keyIdea: 'Use the CRDT for the shared canvas and a plain database for everything that is not concurrent editing.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      scene: {
        nodes: [{ ...mp, at: at(-3.8, 0), label: 'Document', sub: 'canvas tree', status: 'active' }, { ...meta, at: at(0, -3.4), label: 'Comments', sub: 'node id + thread' }, { id: 'comp', kind: 'block', size: 0.8, at: at(3.8, 0), label: 'Component', sub: 'main + instances', icon: 'Boxes', tint: 'amber' }],
        links: [link('mp', 'meta', { label: 'anchor' }), link('mp', 'comp', { label: 'instance of' })],
        panel: {
          title: 'Where each lives',
          icon: 'Table',
          rows: [
            { text: 'Shapes, properties', value: 'CRDT + op log' },
            { text: 'Comments, permissions', value: 'metadata DB' },
            { text: 'Component instance', value: 'ref + overrides' },
            { text: 'Design tokens', value: 'named properties' },
          ],
        },
        caption: 'Not everything needs a CRDT',
      },
    },
    {
      title: 'Crash',
      tag: 'case',
      heading: 'Failure: the process owning a hot file dies',
      eli5: 'The teacher for poster 9 faints. Another teacher picks up the notebook and the latest photo, rebuilds the poster, and the painters hand over any shouts that never got a tick.',
      body: [
        'Sockets drop and clients reconnect with backoff. The router assigns file 9 to a healthy process, which loads the latest snapshot and replays the log tail, as in the earlier step.',
        'Clients resend their **unacked** ops. The op id makes the resend idempotent, so nothing applies twice. Jitter spreads the reconnect storm, and no acknowledged edit is lost because acks follow the log write.',
      ],
      keyIdea: 'The log is durable and ops are idempotent, so a crash costs a reconnect and a replay, not data.',
      metrics: { editors: '50', ops: '0, then 250/s', sock: '500K', lat: '~2 s gap' },
      metricTones: { ops: 'bad', lat: 'warn' },
      scene: {
        nodes: [{ ...ana, at: at(-5, 0), chips: ['unacked: 3'] }, { ...mp, id: 'mp1', at: at(-1, -3.2), status: 'down', label: 'Process 1', badge: 'crashed' }, { ...mp, id: 'mp2', at: at(-1, 3.2), label: 'Process 2', status: 'ok', tint: 'teal' }, { ...oplog, at: at(4, 0) }],
        links: [link('ana', 'mp2'), link('mp2', 'oplog', { arrow: 'both' })],
        flows: [
          { path: ['oplog', 'mp2'], tone: 'response', label: 'replay tail', duration: 1.3 },
          { path: ['ana', 'mp2'], tone: 'request', label: 'resend 3 ops', duration: 1.3, delay: 1.4 },
          { path: ['mp2', 'ana'], tone: 'response', label: 'acks', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Repeat',
          rows: [
            { text: 'Reconnect with jittered backoff' },
            { text: 'New owner loads snapshot + tail' },
            { text: 'Resend unacked ops', value: 'idempotent', tone: 'good' },
            { text: 'Acked edits lost', value: '0', tone: 'good' },
          ],
        },
        caption: 'Replay the log, resend the unacked',
      },
      quiz: {
        question: 'Why is resending unacknowledged ops safe after a crash?',
        options: [
          'The new process ignores ops from clients',
          'Each op has a client id and counter, so applying it twice changes nothing',
          'Clients rebuild the whole file and overwrite it',
          'The CDN deduplicates them',
        ],
        answer: 1,
        explain: 'Ops carry ids and CRDT application is idempotent, so a duplicate is detected or has no effect. Acks follow the log write, so acknowledged ops are already durable.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The design in one picture',
      eli5: 'Everyone paints on one poster with one teacher per poster. Shouts are numbered, written in a notebook, and photographed now and then. Pointing fingers are not saved.',
      body: [
        'Clients apply ops locally, send them over a WebSocket, and a single multiplayer process per file orders them, merges with CRDT rules, logs them and rebroadcasts. Snapshots bound replay, and the log gives history and branches.',
        'Cursors are ephemeral, assets come from a CDN, a WASM and WebGL engine renders 10,000 layers, and the router moves files after a crash.',
      ],
      keyIdea: 'Small commutative ops, one authority per file, a durable log, and snapshots turn concurrent editing into a replayable stream.',
      metrics: { editors: '50', ops: '250/s', sock: '500K', lat: '~50 ms' },
      metricTones: { editors: 'good', ops: 'good', lat: 'good' },
      scene: {
        nodes: [{ ...ana, at: at(-5, -1.6) }, { ...mp, at: at(-1.2, -1.6), status: 'ok' }, { ...oplog, at: at(3.2, -3.4) }, { ...snap, at: at(6.2, 1.6) }],
        links: [link('ana', 'mp', { arrow: 'both' }), link('mp', 'oplog'), link('mp', 'snap')],
        flows: [
          { path: ['ana', 'mp'], tone: 'request', label: 'op', duration: 1.1 },
          { path: ['mp', 'oplog'], tone: 'data', label: 'append', duration: 1.1, delay: 1.2 },
          { path: ['mp', 'snap'], tone: 'data', label: 'checkpoint', duration: 1.1, delay: 1.3 },
          { path: ['mp', 'ana'], tone: 'event', label: 'ack', duration: 1.1, delay: 2.5 },
        ],
        panel: {
          title: 'Decisions',
          icon: 'Scale',
          rows: [
            { text: 'Ops over whole files' },
            { text: 'CRDT over OT' },
            { text: 'Single writer per file', value: 'hot file limit', tone: 'warn' },
            { text: 'Log + snapshots' },
            { text: 'Cursors not persisted' },
          ],
        },
        caption: 'Merge anywhere, order in one place',
      },
      quiz: {
        question: 'What is the main cost of giving each document one authoritative process?',
        options: [
          'Offline edits can no longer merge',
          'A hot document cannot use more than about one core',
          'Ops stop being idempotent',
          'Cursor updates must be stored in the log',
        ],
        answer: 1,
        explain: 'One writer per file keeps ordering and state simple, but all load for that file lands on one process. Offline merging still works because of the CRDT rules.',
      },
    },
  ],
};
