import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const client: SceneNode = { id: 'client', kind: 'client', at: at(-5, 0), label: 'Editor', sub: 'browser or app' };
const gw: SceneNode = { id: 'gw', kind: 'block', at: at(-1.7, 0), label: 'Gateway', sub: 'REST + WebSocket', icon: 'Network', tint: 'violet' };
const bsvc: SceneNode = { id: 'bsvc', kind: 'block', at: at(1.6, 0), label: 'Block service', sub: 'CRUD on blocks', icon: 'Boxes', tint: 'blue' };
const pg: SceneNode = { id: 'pg', kind: 'db', at: at(5, 0), label: 'Postgres', sub: 'block table' };
const rt: SceneNode = { id: 'rt', kind: 'block', at: at(1.6, 3.6), label: 'Realtime', sub: 'op fan-out', icon: 'Zap', tint: 'teal' };

export const designNotion: Lesson = {
  id: 'design-notion',
  title: 'Design Notion',
  tagline: 'A workspace of pages built from blocks, edited by many people at once, searchable, and answerable by AI.',
  minutes: 20,
  level: 'Advanced',
  learn: [
    'Why every block is a database row and a page is just a block of type page',
    'How CRDTs, fractional indexing and last-writer-wins moves merge edits without a lock',
    'Why Postgres is sharded by workspace id, and what a re-shard costs',
    'Block-level permissions that inherit down a tree, and the cache that makes them fast',
    'Search and AI answers fed from the same change stream',
  ],
  metrics: [
    { key: 'dau', label: 'Daily users', icon: 'Users' },
    { key: 'qps', label: 'Peak QPS', icon: 'Activity' },
    { key: 'blocks', label: 'Blocks', icon: 'Boxes' },
    { key: 'load', label: 'Page load', icon: 'Timer' },
    { key: 'shards', label: 'DB shards', icon: 'Split' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A page that is also a database, edited by a crowd',
      eli5: 'Picture a class scrapbook made of sticky notes. Everyone adds notes at once, some kids are away from the classroom, and some notes are secret. Now make a million scrapbooks.',
      body: [
        'Notion pages are trees of **blocks**: paragraphs, headings, toggles, databases, embeds. A page can hold other pages.',
        'The system needs real-time collaboration, offline edits, permissions per block, guest users, search across the whole workspace, and AI features: summarize a page, draft text, answer questions over the workspace.',
      ],
      keyIdea: 'Notion is a tree of blocks with collaboration, permissions, search and AI all hanging off the same data.',
      metrics: { dau: '30M', qps: '?', blocks: '?', load: '?', shards: '1' },
      scene: {
        nodes: [
          { ...client, status: 'active', chips: ['edit paragraph', { text: 'offline ok', tone: 'good' }] },
          { ...gw, tint: 'gray' },
          { id: 'ws', kind: 'block', at: at(1.6, 0), label: 'Workspace', sub: 'pages, blocks', icon: 'Layers', tint: 'amber' },
        ],
        links: [link('client', 'gw'), link('gw', 'ws')],
        flows: [{ path: ['client', 'gw', 'ws'], tone: 'request', label: 'edit', duration: 1.8 }],
        panel: {
          title: 'Functional requirements',
          icon: 'List',
          rows: [
            { text: 'Block tree editor', value: 'pages of blocks' },
            { text: 'Real-time + offline', value: 'many editors' },
            { text: 'Per-block permissions', value: 'guests too' },
            { text: 'Workspace search', value: 'full text' },
            { text: 'AI summarize, draft, Q&A', value: 'over your data' },
          ],
        },
        caption: 'One tree, five features',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'The numbers that shape the design',
      eli5: 'Count the sticky notes in every scrapbook in every school. There are far more reading kids than writing kids, so the **cupboard** has to hand out notes quickly.',
      body: [
        'Targets: **30M daily users**, 100M workspaces, **20B blocks**. An average page has about 50 blocks, so that is roughly 400M pages. Most workspaces are tiny and a few have 10K pages or more.',
        'Reads outnumber writes about 20 to 1. Peak load is **500K reads/s and 25K writes/s**. At about 1 KB per block, 20B blocks is on the order of 20 TB before indexes.',
      ],
      keyIdea: 'Read-heavy, huge row count, and every write must reach other editors fast.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '?', shards: '1' },
      scene: {
        nodes: [
          { ...client, chips: ['30M DAU'] },
          { ...gw, tint: 'violet', chips: [{ text: '500K reads/s', tone: 'warn' }, '25K writes/s'] },
          { ...pg, status: 'hot', badge: '20B rows' },
        ],
        links: [link('client', 'gw'), link('gw', 'pg', { label: '20 : 1 reads to writes' })],
        flows: [
          { path: ['client', 'gw', 'pg'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['pg', 'gw', 'client'], tone: 'response', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Napkin math',
          icon: 'Table',
          rows: [
            { text: 'Daily users', value: '30M' },
            { text: 'Workspaces', value: '100M' },
            { text: 'Blocks', value: '20B' },
            { text: 'Pages (50 blocks each)', value: '~400M' },
            { text: 'Blocks at ~1 KB', value: '~20 TB', tone: 'warn' },
            { text: 'Peak reads / writes', value: '500K / 25K' },
          ],
        },
        caption: 'One table of 20 billion rows is the first problem',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'REST to load a page, a socket to keep it live',
      eli5: 'You ask the teacher for a scrapbook with a quick note (**REST**). Then you stay on the line with a helper who tells you the moment a friend sticks something new on it.',
      body: [
        'Loading and saving use REST-style calls: `GET /pages/{id}` returns the page and its blocks, and bulk or offline saves go as batches of changes called **transactions**. See the API styles lesson for the trade-offs.',
        'Live updates ride one **WebSocket** per open page. Ops go up the socket, the realtime node calls the block service to persist them, and other people\'s edits come back down. `POST /transactions` is only for bulk or offline saves.',
      ],
      keyIdea: 'Request-response for loading and saving, a long-lived socket for live edits.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '?', shards: '1' },
      scene: {
        nodes: [client, gw, { ...bsvc, at: at(1.6, -3), chips: ['GET /pages/{id}', 'POST /transactions'] }, { ...rt, at: at(3.6, 4), chips: [{ text: 'ws: op, cursor', tone: 'good' }] }],
        links: [link('client', 'gw'), link('gw', 'bsvc'), link('gw', 'rt', { arrow: 'both', label: 'WebSocket' })],
        flows: [
          { path: ['client', 'gw', 'bsvc'], tone: 'request', label: 'GET page', duration: 1.8 },
          { path: ['client', 'gw', 'rt'], tone: 'event', label: 'op', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'The two channels',
          icon: 'Code',
          code: 'GET  /pages/{id}        load\nPOST /transactions      bulk + offline save\nWS   /live?page={id}    live ops (persisted\n                        via block service)\n                        and cursors',
        },
        caption: 'Load over REST, collaborate over a socket',
      },
    },
    {
      title: 'Why blocks',
      tag: 'concept',
      heading: 'Store blocks as rows, not documents as blobs',
      eli5: 'Instead of gluing a whole scrapbook into one lump, every sticky note gets its own slot in the cupboard. You can lend one note, move it, or copy it without touching the rest.',
      body: [
        'A document store keeps each page as one big blob. Notion stores **each block as a row**, and a page is just a block whose type is `page`.',
        'That lets you share one block, move it between pages, reference it from several places (**synced blocks**), and render part of a page without loading the whole tree. It is the most important decision in the design.',
      ],
      keyIdea: 'A block is the unit of storage, sharing, permission and sync. A page is a block that has children.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '?', shards: '1' },
      scene: {
        nodes: [
          { id: 'page', kind: 'block', at: at(-4.8, 0), label: 'Page', sub: 'type: page', icon: 'FileText', tint: 'amber' },
          { id: 'head', kind: 'block', size: 0.72, at: at(-0.8, -3), label: 'Heading', icon: 'Code', tint: 'blue' },
          { id: 'para', kind: 'block', size: 0.72, at: at(-0.8, 3), label: 'Paragraph', icon: 'FileText', tint: 'blue' },
          { id: 'tog', kind: 'block', size: 0.72, at: at(3.4, 0), label: 'Toggle', icon: 'List', tint: 'violet', chips: ['has children'] },
        ],
        links: [link('page', 'head'), link('page', 'para'), link('page', 'tog')],
        panel: {
          title: 'Block as the unit',
          icon: 'Boxes',
          rows: [
            { text: 'Share one block', value: 'own ACL', tone: 'good' },
            { text: 'Move across pages', value: 'change parent', tone: 'good' },
            { text: 'Synced block', value: 'many parents', tone: 'good' },
            { text: 'Partial render', value: 'no full load', tone: 'good' },
          ],
        },
        caption: 'Every node in the tree is a row',
      },
    },
    {
      title: 'Block schema',
      tag: 'concept',
      heading: 'The block table',
      eli5: 'Every sticky note has a slip with its own number, who its parent note is, what kind of note it is, and the list of notes stuck on top of it.',
      body: [
        '`workspace_id` is the shard key that the sharding step uses. `parent_id` points up the tree and `content` lists the child ids. Each child row also carries an `order_key` that sorts it among its siblings. `properties` holds the text and formatting as JSON, `permissions` holds overrides, and `version` counts changes.',
        'Because `type` is just a string, a new block type needs no schema change. Each child points back to its parent with `parent_id`.',
      ],
      keyIdea: 'One narrow table with a parent pointer, a child list and a shard key describes the whole workspace.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '?', shards: '1' },
      code: {
        language: 'sql',
        title: 'Simplified block table',
        source: `CREATE TABLE block (
  id           UUID PRIMARY KEY,
  workspace_id UUID NOT NULL, -- shard key
  parent_id    UUID,          -- up the tree
  type         TEXT,          -- paragraph, heading, toggle, page
  properties   JSONB,         -- text, formatting
  content      UUID[],        -- child ids
  order_key    TEXT,          -- fractional index among siblings
  permissions  JSONB,         -- overrides only
  version      BIGINT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
);`,
        highlight: [3, 4, 7, 8],
      },
      scene: {
        nodes: [
          { id: 'pagen', kind: 'block', at: at(-3, 0), label: 'Page', sub: 'id p1', icon: 'FileText', tint: 'amber', chips: ['content: [b1, b2]'] },
          { id: 'b1', kind: 'block', size: 0.72, at: at(1.2, -3), label: 'Block b1', sub: 'parent p1', icon: 'Code', tint: 'blue' },
          { id: 'b2', kind: 'block', size: 0.72, at: at(1.2, 3), label: 'Block b2', sub: 'parent p1', icon: 'FileText', tint: 'blue' },
        ],
        links: [link('pagen', 'b1', { label: 'content[0]' }), link('pagen', 'b2', { label: 'content[1]' })],
        panel: {
          title: 'One row per block',
          icon: 'Table',
          rows: [
            { text: 'workspace_id', value: 'shard key' },
            { text: 'parent_id', value: 'up the tree' },
            { text: 'content[]', value: 'child ids' },
            { text: 'order_key', value: 'sibling order' },
            { text: 'properties', value: 'JSONB text' },
            { text: 'version', value: 'for sync' },
          ],
        },
        caption: 'The tree lives in a few columns',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The first version: one service, one Postgres',
      eli5: 'One helper walks to one cupboard and fetches sticky notes when anyone asks. It works while the class is small.',
      body: [
        'Start with a gateway, a block service and a single Postgres holding the block table. A page load fetches the page row, then each child, then their children.',
        'Postgres suits this: transactions keep a move atomic, and joins help permission checks. The trouble is volume.',
      ],
      keyIdea: 'A stateless block service over one relational database is the right first design. Everything after this fixes what breaks.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '200 ms', shards: '1' },
      metricTones: { load: 'warn' },
      scene: {
        nodes: [client, gw, bsvc, pg],
        links: [link('client', 'gw'), link('gw', 'bsvc'), link('bsvc', 'pg')],
        flows: [
          { path: ['client', 'gw', 'bsvc', 'pg'], tone: 'request', label: 'GET page', duration: 2 },
          { path: ['pg', 'bsvc', 'gw', 'client'], tone: 'response', label: 'blocks', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Version 1',
          icon: 'Boxes',
          rows: [
            { text: 'Stateless block service', tone: 'good' },
            { text: 'One Postgres, one block table' },
            { text: 'Page load: fetch tree row by row', tone: 'warn' },
          ],
        },
        caption: 'Works for a demo, not for 20 billion blocks',
      },
    },
    {
      title: 'Hot pages',
      tag: 'case',
      heading: 'Case: a page load turns into dozens of queries',
      eli5: 'To show one scrapbook, the helper runs to the cupboard once per sticky note. Fifty notes means fifty trips, and a thousand kids asking means a traffic jam.',
      body: [
        'Loading a page with 50 blocks one row at a time is an N+1 pattern. A toggle holding more blocks adds another round of queries. At about 4 ms each, 50 sequential lookups cost around **200 ms** of database time.',
        'This is the cost of blocks as rows: a hot page means many row fetches, and 500K reads per second multiplies that.',
      ],
      keyIdea: 'Row-per-block gives flexibility, and the price is that every page view fans out into row reads.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '200 ms', shards: '1' },
      metricTones: { load: 'bad' },
      scene: {
        nodes: [
          { ...client, badge: 'spinner' },
          { ...bsvc, status: 'hot', load: 91, chips: [{ text: '50 queries per page', tone: 'bad' }] },
          { ...pg, status: 'hot', load: 88 },
        ],
        links: [link('client', 'bsvc', { label: 'GET /pages/p1' }), link('bsvc', 'pg', { label: '1 query per block', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'bsvc', 'pg'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['pg', 'bsvc', 'client'], tone: 'response', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'One page view',
          icon: 'Timer',
          rows: [
            { text: 'Page row', value: '1 query' },
            { text: 'Child blocks', value: '50 queries', tone: 'warn' },
            { text: 'Per query', value: '~4 ms' },
            { text: 'Database time', value: '~200 ms', tone: 'bad' },
          ],
        },
        caption: 'Page views multiply into row fetches',
      },
    },
    {
      title: 'Batch the tree',
      tag: 'tradeoff',
      heading: 'Fix: fetch a subtree in one batch, visible part first',
      eli5: 'The helper takes a list and brings back every sticky note on the visible part of the scrapbook in one trip. The notes hidden inside folded flaps come later.',
      body: [
        'Read the page row, then fetch all its children with one `WHERE id = ANY(...)` query. Walk one level per round trip, not one block per round trip, so depth costs a few queries instead of dozens.',
        'Render what is on screen first and load collapsed toggles on demand. Hot pages also go in a cache keyed by page id.',
      ],
      keyIdea: 'Batch by level and load lazily. Row-per-block stays flexible and the page load drops to a handful of queries.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      metricTones: { load: 'good' },
      code: {
        language: 'sql',
        title: 'One query per level',
        source: `-- level 0: the page
SELECT * FROM block WHERE id = $1;

-- level 1: all visible children in one go
SELECT * FROM block
WHERE id = ANY($2::uuid[]);   -- page.content

-- toggles stay collapsed until opened`,
        highlight: [5, 6],
      },
      scene: {
        nodes: [
          client,
          { ...bsvc, status: 'ok', load: 35, chips: [{ text: '3 queries per page', tone: 'good' }] },
          { id: 'pcache', kind: 'cache', at: at(1.6, 3.6), label: 'Page cache', sub: 'hot pages' },
          { ...pg, load: 40 },
        ],
        links: [link('client', 'bsvc'), link('bsvc', 'pcache'), link('bsvc', 'pg', { label: 'ANY(ids)' })],
        flows: [
          { path: ['client', 'bsvc', 'pcache', 'bsvc'], tone: 'request', duration: 1.8 },
          { path: ['bsvc', 'pg', 'bsvc', 'client'], tone: 'response', label: 'blocks', duration: 2, delay: 1.9 },
        ],
        panel: {
          title: 'After batching',
          icon: 'Timer',
          rows: [
            { text: 'Queries per page', value: '50 to 3', tone: 'good' },
            { text: 'Page load', value: '200 to 25 ms', tone: 'good' },
            { text: 'Collapsed toggles', value: 'lazy' },
          ],
        },
        caption: 'Walk the tree by level, not by row',
      },
      quiz: {
        question: 'Why does storing every block as its own row make a page view expensive, and what is the main fix?',
        options: [
          'Rows are large, so compress them',
          'Each page view fans out into many row reads, so fetch children in batches per level and cache hot pages',
          'Postgres cannot store trees, so switch to a document blob',
          'Blocks must be loaded in one query per block for correctness',
        ],
        answer: 1,
        explain: 'The flexibility of one row per block means a page view touches many rows. Batching each tree level into one query and caching hot pages cuts it to a few queries.',
      },
    },
    {
      title: 'Edit conflicts',
      tag: 'problem',
      heading: 'Two people type in the same paragraph',
      eli5: 'Two kids write on the same sticky note at the same moment. If the teacher keeps only the last note she sees, one kid\'s words vanish.',
      body: [
        'Alice adds "big " and Bob adds "red " to `The cat sat`. If each client sends the whole paragraph and the server keeps the last write, one edit disappears.',
        'Locking a paragraph while someone types ruins live collaboration. Edits must merge, and offline edits must merge too.',
      ],
      keyIdea: 'Last write wins loses work. Collaborative editing needs a merge rule that keeps both edits.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      scene: {
        nodes: [
          { id: 'alice', kind: 'user', at: at(-4.8, -3), label: 'Alice', chips: [{ text: 'insert "big "', tone: 'good' }] },
          { id: 'bob', kind: 'user', at: at(-4.8, 3), label: 'Bob', chips: [{ text: 'insert "red "', tone: 'good' }] },
          { ...bsvc, at: at(0, 0), status: 'hot', badge: 'last write wins' },
        ],
        links: [link('alice', 'bsvc'), link('bob', 'bsvc')],
        flows: [
          { path: ['alice', 'bsvc'], tone: 'request', label: 'The big cat', duration: 1.6 },
          { path: ['bob', 'bsvc'], tone: 'request', label: 'The red cat', duration: 1.6, delay: 0.3 },
        ],
        panel: {
          title: 'Whole-value overwrite',
          icon: 'Code',
          code: 'start      The cat sat\nAlice      The big cat sat\nBob        The red cat sat\nserver     The red cat sat\n           "big " is lost',
          footer: { text: 'Both edits should survive', tone: 'bad' },
        },
        caption: 'A merge rule is needed',
      },
    },
    {
      title: 'OT or CRDT',
      tag: 'tradeoff',
      heading: 'Operational transform or CRDT',
      eli5: 'There are two ways to keep both kids\' words. Either a referee rewrites each message to fit the others (**OT**), or every word gets a name tag so it can be put in the right spot in any order (**CRDT**).',
      body: [
        '**OT** transforms operations against concurrent ones so they converge, and needs a central server to order them. **CRDTs** are designed so operations commute: apply them in any order and every copy ends up the same.',
        'CRDTs fit offline edits and a server that is only a relay. Notion uses them for block content. Replicas and ordering come from the clocks and ordering lesson.',
      ],
      keyIdea: 'OT needs one serializer. CRDTs merge anywhere, in any order, which is what offline editing needs.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      scene: {
        nodes: [
          { id: 'ot', kind: 'block', at: at(-3, -2), label: 'OT', sub: 'transform ops', icon: 'ArrowLeftRight', tint: 'amber' },
          { id: 'crdt', kind: 'block', at: at(3, -2), label: 'CRDT', sub: 'ops commute', icon: 'Share2', tint: 'green', status: 'ok' },
          { id: 'srv', kind: 'server', at: at(0, 3.4), label: 'Server', sub: 'relay or serializer' },
        ],
        links: [link('ot', 'srv', { label: 'must order ops', labelTone: 'warn' }), link('crdt', 'srv', { label: 'any order' })],
        panel: {
          title: 'OT vs CRDT',
          icon: 'Scale',
          rows: [
            { text: 'Central server', value: 'OT: needed, CRDT: optional' },
            { text: 'Offline edits', value: 'OT: brittle, CRDT: natural', tone: 'good' },
            { text: 'Complexity', value: 'OT: per op pair' },
            { text: 'Used by', value: 'Notion, Figma, Linear' },
          ],
        },
        caption: 'Notion picks CRDTs',
      },
    },
    {
      title: 'Text CRDT',
      tag: 'concept',
      heading: 'Block text as a sequence CRDT',
      eli5: 'Every letter gets a name tag, like "Alice\'s third letter". An edit says "put this letter after tag X", so it lands in the right place no matter what order the notes arrive.',
      body: [
        'The text in a block\'s `properties` is a **sequence CRDT**, in the family of RGA and Yjs `Y.Text`. Each character has a unique id made of an actor and a counter.',
        'An insert names the character it goes after, and a delete marks a character as removed (a tombstone). Replaying the same operations in any order gives the same text.',
      ],
      keyIdea: 'Name each character by identity, not by position, and concurrent inserts stop colliding.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      code: {
        language: 'typescript',
        title: 'Operations name characters, not offsets',
        source: `type Id = { actor: string; n: number };

type Op =
  | { kind: 'insert'; id: Id; after: Id | null; ch: string }
  | { kind: 'delete'; id: Id };

// Alice and Bob both insert after id a1.
const alice: Op = { kind: 'insert', id: { actor: 'A', n: 7 }, after: { actor: 'A', n: 1 }, ch: 'b' };
const bob: Op   = { kind: 'insert', id: { actor: 'B', n: 3 }, after: { actor: 'A', n: 1 }, ch: 'r' };
// Ties break on (n, actor), so every replica orders them the same way.`,
        highlight: [4, 5, 9],
      },
      scene: {
        nodes: [
          { id: 'ca', kind: 'user', at: at(-4.8, -3), label: 'Alice', chips: ['ins b after a1'] },
          { id: 'cb', kind: 'user', at: at(-4.8, 3), label: 'Bob', chips: ['ins r after a1'] },
          { id: 'text', kind: 'block', at: at(0, 0), label: 'Y.Text', sub: 'sequence CRDT', icon: 'FileText', tint: 'green', status: 'ok', badge: 'same on all replicas' },
        ],
        links: [link('ca', 'text'), link('cb', 'text')],
        flows: [
          { path: ['ca', 'text'], tone: 'event', label: 'op', duration: 1.6 },
          { path: ['cb', 'text'], tone: 'event', label: 'op', duration: 1.6, delay: 0.3 },
        ],
        panel: {
          title: 'Character ids',
          icon: 'Table',
          rows: [
            { text: 'insert', value: 'after a known id' },
            { text: 'delete', value: 'tombstone' },
            { text: 'tie', value: 'break by (n, actor)' },
            { text: 'result', value: 'big red cat', tone: 'good' },
          ],
        },
        caption: 'Both edits survive, in the same order everywhere',
      },
      quiz: {
        question: 'Two editors make concurrent inserts in the same block of text. Which design lets the merge give the same text on every replica, even for edits made offline?',
        options: [
          'Keep the last write and discard the other',
          'Lock the block while someone types',
          'A sequence CRDT where each character has a unique id and inserts name the character they follow',
          'Send the whole paragraph from each client and compare timestamps',
        ],
        answer: 2,
        explain: 'Operations that name characters by identity commute, so any arrival order gives the same text. Locks and whole-value overwrites lose edits or block collaboration.',
      },
    },
    {
      title: 'Child order',
      tag: 'concept',
      heading: 'Ordering children with fractional indexing',
      eli5: 'To slip a sticky note between note 1 and note 2, give it the number 1.5. You never have to renumber the other notes.',
      body: [
        'A block\'s children need a stable order. Integer positions break when two people insert at the same slot, so each child gets a **fractional index**, a string that sorts between its neighbors. The key lives on the child row in the `order_key` column, so an insert writes one row and never touches the parent\'s `content` array.',
        'Insert between `a0` and `a1` and you get `a0V`. Nobody else\'s keys change. Two inserts that pick the same key are separated by a tie-break on the writer id.',
      ],
      keyIdea: 'Give each child a sortable key between its neighbors so an insert never rewrites the list.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      scene: {
        nodes: [
          { id: 'k1', kind: 'block', size: 0.72, at: at(-4, 0), label: 'Block', sub: 'key a0', icon: 'FileText', tint: 'blue' },
          { id: 'k2', kind: 'block', size: 0.72, at: at(0, 0), label: 'New block', sub: 'key a0V', icon: 'Zap', tint: 'green', status: 'active' },
          { id: 'k3', kind: 'block', size: 0.72, at: at(4, 0), label: 'Block', sub: 'key a1', icon: 'FileText', tint: 'blue' },
        ],
        links: [link('k1', 'k2', { arrow: 'none', route: 'straight' }), link('k2', 'k3', { arrow: 'none', route: 'straight' })],
        panel: {
          title: 'Insert between a0 and a1',
          icon: 'Code',
          code: 'order_key on each child row\na0   first\na0V  new (sorts between)\na1   second\n\nno other key changes',
          footer: { text: 'Same trick Figma uses for layers', tone: 'muted' },
        },
        caption: 'Sort keys, not positions',
      },
    },
    {
      title: 'Moves',
      tag: 'concept',
      heading: 'Moving blocks: last writer wins, never a cycle',
      eli5: 'Two kids move the same sticky note to different pages at once. The note ends up on whichever move has the later time. And no note may be stuck on top of itself.',
      body: [
        'Moving a block changes its `parent_id`. Concurrent moves of the same block use **last-writer-wins** on a timestamp, so every replica picks the same parent.',
        'Moving A under B while someone moves B under A would make a loop. The server rejects any move that would put a block under its own descendant.',
      ],
      keyIdea: 'Last-writer-wins settles who gets the block. A cycle check keeps the result a tree.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      scene: {
        nodes: [
          { id: 'pa', kind: 'block', size: 0.72, at: at(-4, -3), label: 'Page A', icon: 'FileText', tint: 'amber' },
          { id: 'pb', kind: 'block', size: 0.72, at: at(4, -3), label: 'Page B', icon: 'FileText', tint: 'amber' },
          { id: 'mv', kind: 'block', size: 0.72, at: at(0, 3), label: 'Block', sub: 'parent: B (later)', icon: 'Share2', tint: 'green', status: 'ok' },
        ],
        links: [link('pa', 'mv', { style: 'faint', label: 't=10' }), link('pb', 'mv', { label: 't=12 wins' })],
        panel: {
          title: 'Move rules',
          icon: 'Scale',
          rows: [
            { text: 'Same block, two parents', value: 'latest timestamp', tone: 'good' },
            { text: 'A under B, B under A', value: 'rejected', tone: 'bad' },
            { text: 'Check', value: 'walk up from new parent' },
          ],
        },
        caption: 'Moves converge and the tree stays a tree',
      },
    },
    {
      title: 'Realtime service',
      tag: 'concept',
      heading: 'Fan out operations over WebSockets',
      eli5: 'A class helper sits next to the scrapbook. When one kid adds a note, the helper shouts it to everyone looking at that page, so they all see it at once.',
      body: [
        'A **realtime service** holds the WebSocket connections. Clients open a socket per page. An operation arrives, is persisted by calling the block service (the only save path for live edits), and is forwarded to every other connection on that page.',
        'Routing a page to one realtime node gives it a single place to broadcast from. This is the push pattern from the realtime delivery lesson and the pub/sub lesson.',
      ],
      keyIdea: 'Persist the op, then fan it out to everyone on the same page.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      scene: {
        nodes: [
          { id: 'u1', kind: 'client', at: at(-5, -3), label: 'Alice' },
          { ...rt, at: at(0, 0), chips: ['page p1: 3 sockets'], status: 'active' },
          { id: 'u2', kind: 'client', at: at(5, -3), label: 'Bob' },
          { id: 'u3', kind: 'client', at: at(5, 3.5), label: 'Cara' },
        ],
        links: [link('u1', 'rt', { arrow: 'both' }), link('rt', 'u2', { arrow: 'both' }), link('rt', 'u3', { arrow: 'both' })],
        flows: [
          { path: ['u1', 'rt'], tone: 'event', label: 'op', duration: 1.4 },
          { path: ['rt', 'u2'], tone: 'event', label: 'op', duration: 1.4, delay: 1.5 },
          { path: ['rt', 'u3'], tone: 'event', label: 'op', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'One edit, three screens',
          icon: 'Zap',
          rows: [
            { text: 'Alice types', value: 'op sent' },
            { text: 'Saved via block service', value: 'version +1' },
            { text: 'Broadcast to the page', value: 'Bob, Cara', tone: 'good' },
          ],
        },
        caption: 'Edits reach everyone viewing the page',
      },
    },
    {
      title: 'Offline sync',
      tag: 'concept',
      heading: 'Editing offline and syncing later',
      eli5: 'A kid takes a scrapbook home and adds notes on the bus. Back at school, every new note is stuck onto the class copy, and the notes from other kids are stuck onto the kid\'s copy.',
      body: [
        'The client keeps a local copy and a queue of operations. While offline, edits apply locally and wait in the queue.',
        'On reconnect, the client sends its queue and asks for everything newer than the last `version` it saw. Because operations are CRDTs, both sides merge without a manual conflict dialog.',
      ],
      keyIdea: 'Apply locally first, queue the ops, and exchange them by version when the network returns.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '1' },
      scene: {
        nodes: [
          { ...client, status: 'dim', chips: [{ text: 'offline', tone: 'warn' }] },
          { id: 'local', kind: 'storage', at: at(-2.4, 5), label: 'Local store', sub: 'copy + op queue' },
          { ...gw },
          { ...rt, at: at(1.6, 0), label: 'Sync', sub: 'since version 880', icon: 'Repeat' },
        ],
        links: [link('client', 'local', { arrow: 'both' }), link('client', 'gw', { style: 'dashed', label: 'back online' }), link('gw', 'rt')],
        flows: [
          { path: ['client', 'gw', 'rt'], tone: 'event', label: '12 ops', duration: 1.8 },
          { path: ['rt', 'gw', 'client'], tone: 'data', label: 'ops since 880', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Reconnect handshake',
          icon: 'Repeat',
          rows: [
            { text: 'Client sends', value: '12 queued ops' },
            { text: 'Client asks', value: 'ops since v880' },
            { text: 'Server merges', value: 'CRDT, no conflict', tone: 'good' },
          ],
        },
        caption: 'Offline is just a long network delay',
      },
    },
    {
      title: 'DB is full',
      tag: 'case',
      heading: 'Case: 20 billion rows on one machine',
      eli5: 'There are so many sticky notes now that one cupboard cannot hold them, and a thousand kids queue at the one door.',
      body: [
        'At 20B rows and about 20 TB of data plus indexes, one Postgres cannot hold the table, and its CPU is the bottleneck for 500K reads and 25K writes per second. Replicas help reads, but writes and size still sit on one machine.',
        'The data has to be split across many databases. The replication and sharding lessons cover the general options. The question here is which key to split on.',
      ],
      keyIdea: 'Replicas scale reads. Size and writes need sharding, and the shard key is the design decision.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '600 ms', shards: '1' },
      metricTones: { load: 'bad', shards: 'bad' },
      scene: {
        nodes: [
          { ...gw, status: 'hot' },
          { ...bsvc, load: 92 },
          { ...pg, status: 'hot', load: 98, badge: '20 TB, 20B rows' },
        ],
        links: [link('gw', 'bsvc'), link('bsvc', 'pg', { label: '500K reads/s', labelTone: 'bad' })],
        flows: [{ path: ['gw', 'bsvc', 'pg'], tone: 'error', count: 4, duration: 1.8 }],
        panel: {
          title: 'One database',
          icon: 'Database',
          rows: [
            { text: 'Rows', value: '20B', tone: 'bad' },
            { text: 'Disk', value: '~20 TB', tone: 'bad' },
            { text: 'CPU', value: '98%', tone: 'bad' },
            { text: 'Writes', value: '25K/s' },
          ],
          footer: { text: 'Shard it. But on which key?', tone: 'warn' },
        },
        caption: 'The block table outgrows one server',
      },
      quiz: {
        question: 'Read replicas are added to the full database. Why does that not fix the size and write limits?',
        options: [
          'Replicas only work for text columns',
          'Every replica holds a full copy of the data and every write still goes to one primary, so size and write load do not shrink',
          'Replicas make reads slower than the primary',
          'Postgres cannot have more than one replica',
        ],
        answer: 1,
        explain: 'Replicas copy the whole table and only serve reads. The 20 TB and the 25K writes per second still sit on one primary, so the data must be split by a shard key.',
      },
    },
    {
      title: 'Shard by workspace',
      tag: 'concept',
      heading: 'Shard key: the workspace id',
      eli5: 'Give each class its own cupboard. All the sticky notes of one class stay together, so one trip fetches a whole scrapbook.',
      body: [
        'Every block carries a `workspace_id`, and the block table is sharded by it, about **2,000 shards** at roughly 10M blocks each. A page, its blocks, and its permissions live in the same shard, so loads and moves stay inside one database with real transactions.',
        'Routing is a lookup from workspace to shard. The consistent hashing lesson explains why a ring or a mapping table makes adding shards cheap.',
      ],
      keyIdea: 'Colocate everything a workspace touches, so almost every query and transaction stays in one shard.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '2,000' },
      metricTones: { load: 'good', shards: 'good' },
      scene: {
        nodes: [
          { ...bsvc, at: at(-4.2, 0), chips: ['workspace_id = w7'] },
          { id: 'rtr', kind: 'block', size: 0.72, at: at(0, 0), label: 'Shard map', sub: 'w7 to shard 41', icon: 'Route', tint: 'violet' },
          { id: 's41', kind: 'shard', at: at(4, -3), label: 'Shard 41', sub: 'w7, w90', status: 'active' },
          { id: 's42', kind: 'shard', at: at(4, 3.4), label: 'Shard 42', sub: 'w8, w15' },
        ],
        links: [link('bsvc', 'rtr'), link('rtr', 's41', { label: 'w7' }), link('rtr', 's42', { style: 'faint' })],
        flows: [
          { path: ['bsvc', 'rtr', 's41'], tone: 'request', label: 'w7', duration: 1.8 },
          { path: ['s41', 'rtr', 'bsvc'], tone: 'response', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Why workspace_id',
          icon: 'Split',
          rows: [
            { text: 'Page and its blocks', value: 'one shard', tone: 'good' },
            { text: 'Move block in a page', value: 'one transaction', tone: 'good' },
            { text: 'Permission walk', value: 'one shard', tone: 'good' },
            { text: 'Shards / rows each', value: '~2,000 / ~10M' },
          ],
        },
        caption: 'Workspaces never cross shards for ordinary work',
      },
    },
    {
      title: 'Re-sharding',
      tag: 'tradeoff',
      heading: 'Why Postgres, and what sharding it costs',
      eli5: 'Cupboards are tidy and safe, but when a class gets too big you have to carry notes to a new cupboard without anyone losing a note.',
      body: [
        'Postgres gives transactions and joins, which permissions and moves need. The cost is that sharding a relational database is painful. Notion is known to have re-sharded its database in 2021 as the old shards filled.',
        'A re-shard copies data to new shards while writes continue: double-write, backfill, verify, then switch reads. See the migration patterns lesson. A very large workspace is also a hot-shard risk.',
      ],
      keyIdea: 'Choose a relational store for the transactions, and plan the re-shard before you need it.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '2,000' },
      scene: {
        nodes: [
          { id: 'old', kind: 'shard', at: at(-4.5, 0), label: 'Old shard', sub: 'nearly full', status: 'hot', load: 90 },
          { id: 'newa', kind: 'shard', at: at(2, -3), label: 'New shard A', sub: 'receives w7', status: 'ok' },
          { id: 'newb', kind: 'shard', at: at(2, 3.4), label: 'New shard B', sub: 'receives w90', status: 'ok' },
        ],
        links: [link('old', 'newa', { label: 'backfill', labelTone: 'warn' }), link('old', 'newb', { label: 'backfill', labelTone: 'warn' })],
        flows: [
          { path: ['old', 'newa'], tone: 'data', label: 'rows', duration: 1.8 },
          { path: ['old', 'newb'], tone: 'data', label: 'rows', duration: 1.8, delay: 0.3 },
        ],
        panel: {
          title: 'Re-shard steps',
          icon: 'List',
          rows: [
            { text: '1. Double-write', value: 'old + new' },
            { text: '2. Backfill', value: 'copy history' },
            { text: '3. Verify', value: 'compare rows' },
            { text: '4. Switch reads', value: 'then retire old', tone: 'good' },
          ],
          footer: { text: 'Postgres: easy transactions, painful sharding', tone: 'warn' },
        },
        caption: 'Splitting a live database is the hardest operation',
      },
    },
    {
      title: 'Permissions',
      tag: 'concept',
      heading: 'Block-level permissions inherit down the tree',
      eli5: 'Each sticky note inherits its scrapbook\'s rule: "friends only". A note can say its own rule instead. To check if you can read one, the monitor looks at the note, then the page, then the class, until she finds a rule.',
      body: [
        'Permissions follow a graph model (ReBAC, in the style of Google\'s Zanzibar). A block inherits access from its parent unless it carries an explicit grant or deny.',
        'To check "can user U read block B?", walk up the `parent_id` chain until the first explicit rule, then check whether U is in it directly, through a team or the workspace, or as public. The ancestors come from one batched fetch, not one query per level. The walk is still work on every read, which is why the next step caches it.',
      ],
      keyIdea: 'Most blocks store nothing. The nearest ancestor with an explicit rule decides.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '2,000' },
      code: {
        language: 'typescript',
        title: 'Walk up until a rule is found',
        source: `async function canRead(userId: string, teams: string[], blockId: string) {
  const chain = await getAncestors(blockId); // one batched fetch, nearest first
  for (const b of chain) {
    const p = b.permissions;
    const rule = p?.[userId] ?? teams.map(t => p?.[t]).find(Boolean) ?? p?.public;
    if (rule) return rule !== 'deny';  // explicit rule wins
  }                                    // else inherit from parent
  return false;
}`,
        highlight: [2, 5, 6],
      },
      scene: {
        nodes: [
          { id: 'wsp', kind: 'block', size: 0.72, at: at(-4.5, -3), label: 'Workspace', sub: 'team: read', icon: 'Users', tint: 'violet' },
          { id: 'pgm', kind: 'block', size: 0.72, at: at(0, 0), label: 'Page', sub: 'inherits', icon: 'FileText', tint: 'amber' },
          { id: 'blk', kind: 'block', size: 0.72, at: at(4.5, 3), label: 'Block', sub: 'deny: guests', icon: 'Shield', tint: 'red', status: 'active' },
        ],
        links: [link('wsp', 'pgm'), link('pgm', 'blk')],
        flows: [{ path: ['blk', 'pgm', 'wsp'], tone: 'request', label: 'who decides?', duration: 2.2 }],
        panel: {
          title: 'Resolve access for a guest',
          icon: 'Shield',
          rows: [
            { text: 'Block', value: 'explicit deny', tone: 'bad' },
            { text: 'Page', value: 'inherit' },
            { text: 'Workspace', value: 'team: read' },
            { text: 'Result for guest', value: 'denied', tone: 'bad' },
          ],
        },
        caption: 'The nearest explicit rule wins',
      },
    },
    {
      title: 'ACL cache',
      tag: 'concept',
      heading: 'Cache the effective permission',
      eli5: 'Walking up three levels for every look is slow. The monitor writes the answer on a card: "Sam can see this note". She tears up the cards when a rule changes above it.',
      body: [
        'A tree walk per block is too slow at 500K reads per second. Materialize the **effective ACL** in Redis, keyed by `(user_id, block_id, epoch)`.',
        'The hard part is invalidation. A rule change can alter the answer for a whole subtree, and the keys are users times blocks, so they cannot be dropped by lookup. Instead each page keeps a **permission epoch** that is part of every key under it. A grant change bumps one number and stale entries miss. A short TTL is the backstop.',
      ],
      keyIdea: 'Cache the answer of the walk, and invalidate on any change to the block or its ancestors.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '2,000' },
      scene: {
        nodes: [
          { ...bsvc, at: at(-4.5, 0), chips: ['can U read B?'] },
          { id: 'acl', kind: 'cache', at: at(0, 0), label: 'ACL cache', sub: '(user, block, epoch)' },
          { id: 'authz', kind: 'block', size: 0.72, at: at(4.5, -3), label: 'Permissions', sub: 'tree walk', icon: 'Shield', tint: 'violet' },
        ],
        links: [link('bsvc', 'acl'), link('acl', 'authz', { style: 'dashed', label: 'on miss' })],
        flows: [
          { path: ['bsvc', 'acl'], tone: 'request', label: 'hit', duration: 1.4 },
          { path: ['acl', 'authz', 'acl'], tone: 'request', label: 'miss: walk', duration: 2, delay: 1.5 },
          { path: ['acl', 'bsvc'], tone: 'response', label: 'allow', duration: 1.4, delay: 3.6 },
        ],
        panel: {
          title: 'Invalidation',
          icon: 'Key',
          rows: [
            { text: 'Key', value: '(user, block, epoch)' },
            { text: 'Grant changed on page', value: 'bump page epoch', tone: 'warn' },
            { text: 'Old entries', value: 'miss, then expire' },
            { text: 'Backstop', value: 'TTL, 5 min' },
          ],
          footer: { text: 'See the caching lesson for invalidation', tone: 'muted' },
        },
        caption: 'Fast checks need careful invalidation',
      },
    },
    {
      title: 'Change stream',
      tag: 'concept',
      heading: 'CDC feeds search from the same changes',
      eli5: 'Whenever a note changes, a clerk copies the change onto a notice and drops it in a box. The librarian reads the box and updates the index at the back of the library.',
      body: [
        'Searching 20B blocks cannot scan Postgres. **Change data capture** reads each committed block change and publishes it to Kafka, so the write path stays fast.',
        'A consumer indexes blocks into Elasticsearch, into one Elasticsearch cluster of about 1,000 shards, with documents routed by `workspace_id`. See the search index lesson. Results are filtered by the user\'s permissions before they are shown.',
      ],
      keyIdea: 'Publish every committed change once, and let search and AI consume it on their own schedule.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '2,000' },
      scene: {
        nodes: [
          { ...pg, at: at(-5, 0), label: 'Postgres', sub: 'block table' },
          { id: 'kafka', kind: 'queue', at: at(-1.6, 0), label: 'Kafka', sub: 'block changes' },
          { id: 'es', kind: 'search', at: at(2, -3), label: 'Elasticsearch', sub: '~1,000 shards, routed by workspace' },
          { id: 'vec', kind: 'db', at: at(2, 3.4), label: 'Vector DB', sub: 'embeddings' },
        ],
        links: [link('pg', 'kafka', { label: 'CDC' }), link('kafka', 'es'), link('kafka', 'vec')],
        flows: [
          { path: ['pg', 'kafka'], tone: 'event', label: 'change', duration: 1.4 },
          { path: ['kafka', 'es'], tone: 'event', label: 'index', duration: 1.4, delay: 1.5 },
          { path: ['kafka', 'vec'], tone: 'event', label: 'embed', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'One stream, two consumers',
          icon: 'Rss',
          rows: [
            { text: 'Source', value: 'committed blocks' },
            { text: 'Search', value: 'one cluster, routed by workspace' },
            { text: 'AI', value: 'chunks + embeddings' },
          ],
          footer: { text: 'Both are eventually consistent', tone: 'muted' },
        },
        caption: 'Write once, index twice',
      },
    },
    {
      title: 'AI answers',
      tag: 'concept',
      heading: 'AI Q&A over a workspace with RAG',
      eli5: 'To answer "what did we plan for the trip?", the helper finds the few most similar sticky notes, hides the ones you may not read, and gives the rest to a clever reader to write the answer.',
      body: [
        'Each block change is chunked, embedded by a model and stored in a vector database. The AI service embeds a question the same way and retrieves the top-K nearest chunks by cosine similarity.',
        '**Filter the chunks by the asker\'s permissions** before they reach the LLM, then pass them with the question. This is retrieval-augmented generation (RAG). See the RAG lesson.',
        'Filtering after retrieval can leave few results, so a real system pre-filters by workspace in the vector query, post-filters by ACL, and over-fetches K.',
      ],
      keyIdea: 'Retrieve by meaning, filter by permission, and only then let the model write.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '2,000' },
      scene: {
        nodes: [
          { ...client, at: at(-5, 0), chips: ['Ask: what did we decide?'] },
          { id: 'vec2', kind: 'db', at: at(-1.6, -3.4), label: 'Vector DB', sub: 'top-K chunks' },
          { id: 'acl2', kind: 'block', size: 0.72, at: at(-1.6, 4.2), label: 'ACL filter', sub: 'drop unreadable', icon: 'Shield', tint: 'violet' },
          { id: 'ai', kind: 'block', at: at(2.6, 0), label: 'AI service', sub: 'LLM + RAG', icon: 'Zap', tint: 'teal' },
        ],
        links: [link('client', 'vec2'), link('vec2', 'acl2'), link('acl2', 'ai')],
        flows: [
          { path: ['client', 'vec2'], tone: 'request', label: 'question', duration: 1.4 },
          { path: ['vec2', 'acl2'], tone: 'data', label: 'top 20', duration: 1.4, delay: 1.5 },
          { path: ['acl2', 'ai'], tone: 'data', label: 'allowed 12', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'RAG pipeline',
          icon: 'Workflow',
          rows: [
            { text: '1. Embed the question' },
            { text: '2. Top-K by cosine similarity' },
            { text: '3. Filter by ACL', value: 'before the LLM', tone: 'good' },
            { text: '4. LLM writes the answer' },
          ],
        },
        caption: 'The model only sees what the asker may see',
      },
    },
    {
      title: 'Failures',
      tag: 'case',
      heading: 'When parts fail',
      eli5: 'If the helper who shouts new notes falls ill, kids keep writing, and a new helper catches them up from the notes list. A stale rule card could hide or reveal a note by mistake, so the cards expire.',
      body: [
        'A **realtime node dies**: sockets drop, clients reconnect to another node and ask for ops since their last `version`. No edit is lost because ops were saved before fan-out.',
        'A **hot shard** from one huge workspace gets its own dedicated shard, or is sub-partitioned by page subtree, which means accepting cross-shard moves for that tenant. A **stale ACL cache** is bounded by invalidation and a short TTL. **Search or AI lag** only delays results, since the change stream replays from Kafka.',
      ],
      keyIdea: 'The database is the source of truth. Realtime, cache, search and AI can all be rebuilt from it.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '40 ms', shards: '2,000' },
      scene: {
        nodes: [
          { ...client, at: at(-5, 0), chips: [{ text: 'reconnecting', tone: 'warn' }] },
          { id: 'rtdown', kind: 'block', at: at(-1.6, -3), label: 'Realtime A', sub: 'crashed', icon: 'Zap', tint: 'red', status: 'down' },
          { id: 'rtup', kind: 'block', at: at(-1.6, 3.4), label: 'Realtime B', sub: 'takes over', icon: 'Zap', tint: 'teal', status: 'ok' },
          { ...pg, at: at(3, 0), chips: ['ops since v880'] },
        ],
        links: [link('client', 'rtdown', { style: 'faint' }), link('client', 'rtup', { label: 'reconnect' }), link('rtup', 'pg')],
        flows: [
          { path: ['client', 'rtup', 'pg'], tone: 'request', label: 'since v880', duration: 1.8 },
          { path: ['pg', 'rtup', 'client'], tone: 'response', label: 'missed ops', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Failure and recovery',
          icon: 'Bug',
          rows: [
            { text: 'Realtime node dies', value: 'reconnect + replay', tone: 'good' },
            { text: 'Hot shard', value: 'own shard or subtree split' },
            { text: 'Stale ACL cache', value: 'invalidate + TTL' },
            { text: 'Search or AI lag', value: 'replay Kafka', tone: 'good' },
          ],
        },
        caption: 'Rebuild everything from the block table',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole design on one page',
      eli5: 'A class scrapbook of sticky notes: every note has its own slot, helpers shout changes, class cupboards keep notes together, a monitor checks who may read, and a librarian finds notes by meaning.',
      body: [
        'Blocks are rows, sharded by workspace into about 2,000 Postgres shards. Pages load by batching each tree level and caching hot pages.',
        'Text merges as a sequence CRDT, order uses fractional indexes, moves use last-writer-wins with a cycle check. Permissions inherit and are cached. One CDC stream feeds search and AI.',
      ],
      keyIdea: 'Block rows, CRDT merges, workspace shards, inherited permissions, and one change stream for search and AI.',
      metrics: { dau: '30M', qps: '500K r / 25K w', blocks: '20B', load: '25 ms', shards: '2,000' },
      metricTones: { load: 'good', shards: 'good' },
      scene: {
        nodes: [
          { ...client, at: at(-5, 0) },
          { ...gw, at: at(-1.7, 0) },
          { ...bsvc, at: at(1.6, -3), chips: [{ text: 'batched reads', tone: 'good' }] },
          { ...rt, at: at(1.6, 3.4) },
          { id: 'shards', kind: 'shard', at: at(5, -3), label: 'Postgres', sub: '~2,000 shards', status: 'ok' },
        ],
        links: [link('client', 'gw'), link('gw', 'bsvc'), link('gw', 'rt'), link('bsvc', 'shards')],
        flows: [
          { path: ['client', 'gw', 'bsvc', 'shards'], tone: 'request', label: 'load', duration: 2 },
          { path: ['client', 'gw', 'rt'], tone: 'event', label: 'live ops', duration: 1.8, delay: 2.1 },
        ],
        panel: {
          title: 'Decisions',
          icon: 'Scale',
          rows: [
            { text: 'Storage', value: 'block rows' },
            { text: 'Merge', value: 'CRDT' },
            { text: 'Shard key', value: 'workspace_id' },
            { text: 'Access', value: 'inherit + cache' },
            { text: 'Search + AI', value: 'CDC stream' },
          ],
        },
        caption: 'Notion in one picture',
      },
      quiz: {
        question: 'A guest is removed from a workspace. Which pieces must be updated so the guest stops seeing blocks in search and AI answers?',
        options: [
          'Only the Postgres permissions column, search and AI follow automatically',
          'The permission data, the cached ACLs for the subtree, and the ACL filter applied on search and retrieval results',
          'Rebuild the whole vector database',
          'Nothing, because the guest\'s session token blocks access',
        ],
        answer: 1,
        explain: 'Permissions live in the block tree, are cached by (user, block), and are applied as a filter when search and AI retrieve chunks. All three must reflect the change.',
      },
    },
  ],
};
