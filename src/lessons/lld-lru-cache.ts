import type { Lesson, SceneFlow, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });
const flow = (path: string[], label: string, tone: SceneFlow['tone'], delay = 0, duration = 1.4): SceneFlow => ({ path, tone, label, delay, duration });

const caller: SceneNode = { id: 'caller', kind: 'block', at: at(-4, -2), label: 'Caller', sub: 'the app', icon: 'Code', tint: 'gray' };
const cache: SceneNode = { id: 'cache', kind: 'block', at: at(0, -2), label: 'LRUCache', sub: 'concrete class', icon: 'Layers', tint: 'green' };
const db: SceneNode = { id: 'db', kind: 'block', at: at(4, -2), label: 'Database', sub: 'external, 120 ms', icon: 'Database', tint: 'gray' };
const iface: SceneNode = { id: 'iface', kind: 'block', at: at(0, 3), label: 'Cache', sub: 'interface', icon: 'Braces', tint: 'violet' };
const map: SceneNode = { id: 'map', kind: 'block', at: at(0, -3), label: 'HashMap', sub: 'key to node, O(1)', icon: 'Hash', tint: 'amber' };
const head: SceneNode = { id: 'head', kind: 'block', size: 0.8, at: at(-6, 2), label: 'head', sub: 'sentinel', icon: 'Package', tint: 'gray' };
const nodeA: SceneNode = { id: 'na', kind: 'block', size: 0.8, at: at(-3, 2), label: 'Node A', sub: 'MRU', icon: 'Package', tint: 'green' };
const nodeB: SceneNode = { id: 'nb', kind: 'block', size: 0.8, at: at(0, 2), label: 'Node B', sub: 'middle', icon: 'Package', tint: 'green' };
const nodeC: SceneNode = { id: 'nc', kind: 'block', size: 0.8, at: at(3, 2), label: 'Node C', sub: 'LRU', icon: 'Package', tint: 'green' };
const tail: SceneNode = { id: 'tail', kind: 'block', size: 0.8, at: at(6, 2), label: 'tail', sub: 'sentinel', icon: 'Package', tint: 'gray' };
const t1: SceneNode = { id: 't1', kind: 'worker', at: at(-4, -3), label: 'Thread 1', sub: 'get("a")' };
const t2: SceneNode = { id: 't2', kind: 'worker', at: at(-4, 3), label: 'Thread 2', sub: 'get("b")' };
const state: SceneNode = { id: 'state', kind: 'block', at: at(0, 0), label: 'Shared list', sub: 'map + linked list', icon: 'Layers', tint: 'amber' };
const lock: SceneNode = { id: 'lock', kind: 'vault', at: at(4, 0), label: 'Lock', sub: 'one RLock' };

const chain = (): SceneLink[] => [link('head', 'na'), link('na', 'nb'), link('nb', 'nc'), link('nc', 'tail')];

export const lldLruCache: Lesson = {
  id: 'lld-lru-cache',
  title: 'LRU cache',
  tagline: 'Build a fixed-size cache that drops the least recently used entry, with O(1) get and put, then make it safe for threads.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'The get and put contract, and why both must be O(1)',
    'Why a list scan and a timestamp map both fail, step by step',
    'A hash map plus a doubly linked list with sentinels',
    'get, put, update and eviction in a few pointer moves',
    'A coarse lock, its bottleneck, and lock striping',
  ],
  metrics: [
    { key: 'get', label: 'get cost', icon: 'Timer' },
    { key: 'evict', label: 'Evict cost', icon: 'Gauge' },
    { key: 'threads', label: 'Threads', icon: 'Cpu' },
    { key: 'safe', label: 'Thread safe', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Why a cache',
      tag: 'problem',
      heading: 'The database is slow and memory is small',
      eli5: 'The big toy cupboard is across the hall and slow to reach. The **cache** is a small shelf by the teacher that holds only 3 toys, so the favorites are close.',
      body: [
        'Every request reads the database at about 120 ms. A hot subset of keys gets asked for again and again, so a copy in memory answers in microseconds.',
        'Memory is limited. The cache has a fixed **capacity**, say 3 entries here. When it is full, something must go. The **least recently used** entry is the usual pick, because a key not touched for a while is the least likely to be needed next.',
      ],
      keyIdea: 'A cache trades a bounded amount of memory for speed, and an eviction policy decides who leaves when it is full.',
      metrics: { get: '120 ms (no cache)', evict: '-', threads: '1', safe: 'n/a' },
      metricTones: { get: 'bad' },
      scene: {
        nodes: [caller, { ...cache, status: 'active', chips: ['capacity = 3'] }, { ...db, status: 'hot' }],
        links: [link('caller', 'cache', 'get(key)'), link('cache', 'db', 'miss: 120 ms', { labelTone: 'warn' })],
        flows: [flow(['caller', 'cache'], 'get("a")', 'request'), flow(['cache', 'db'], 'miss', 'request', 1.5), flow(['db', 'cache', 'caller'], 'value', 'response', 3)],
        panel: {
          title: 'The contract',
          icon: 'Table',
          rows: [
            { text: 'get(key)', value: 'value or -1' },
            { text: 'put(key, value)', value: 'insert or update' },
            { text: 'capacity', value: 'fixed, > 0' },
            { text: 'when full', value: 'drop least recent', tone: 'warn' },
          ],
          footer: { text: 'Goal: both calls in O(1)', tone: 'good' },
        },
        caption: 'A small fast copy in front of a slow store',
      },
    },
    {
      title: 'The interface',
      tag: 'concept',
      heading: 'Start with the API: a small interface',
      eli5: 'The shelf has two rules written on a card: "ask for a toy" and "put a toy on the shelf". Anyone using the shelf only reads the card.',
      body: [
        'Callers need two operations. `get(key)` returns the value and counts as a use. `put(key, value)` stores it and evicts if the cache is over capacity.',
        'Put them behind a `Cache` **interface**. `LRUCache` **implements** it, so later an LFU or TTL cache can swap in without the caller changing.',
      ],
      keyIdea: 'Design to the interface first. Callers depend on get and put, never on how eviction works.',
      metrics: { get: '?', evict: '?', threads: '1', safe: 'n/a' },
      scene: {
        nodes: [caller, { ...iface, at: at(0, 3) }, { ...cache, at: at(4, 3), status: 'active' }],
        links: [link('caller', 'iface', 'uses', { style: 'dashed' }), link('cache', 'iface', 'implements')],
        flows: [flow(['caller', 'iface'], 'get(k)', 'request'), flow(['iface', 'cache'], 'get(k)', 'request', 1.5)],
        panel: {
          title: 'Cache interface',
          icon: 'Braces',
          code: 'from abc import ABC, abstractmethod\n\nclass Cache(ABC):\n    @abstractmethod\n    def get(self, key): ...\n    @abstractmethod\n    def put(self, key, value): ...',
          footer: { text: 'LRUCache implements it', tone: 'muted' },
        },
        caption: 'Callers see two methods',
      },
    },
    {
      title: 'v1 list scan',
      tag: 'case',
      heading: 'v1: a list ordered by recency, and its O(n) cost',
      eli5: 'The shelf holds toys in a row with the newest play at the right end. To find one toy the teacher checks every spot from the left. Slow when the shelf is big.',
      body: [
        'Keep a Python list of `(key, value)` pairs, most recent at the end. `get` scans for the key, pops it out and appends it to the end. `put` does the same, then drops index 0 when too long. `pop(0)` shifts every element, so even eviction is linear.',
        'It is correct and tiny, and **O(n)** on every call. At 10,000 entries and 100,000 calls a second that is about a billion comparisons a second.',
      ],
      keyIdea: 'Correct is not enough for a cache. A scan on every call makes the cache slower than the database it protects.',
      metrics: { get: 'O(n)', evict: 'O(n) pop(0)', threads: '1', safe: 'no' },
      metricTones: { get: 'bad', evict: 'bad' },
      scene: {
        nodes: [caller, { ...cache, status: 'hot', load: 95, sub: 'list of pairs' }, { id: 'scan', kind: 'block', at: at(4, -2), label: 'Linear scan', sub: 'checks every entry', icon: 'Search', tint: 'red' }],
        links: [link('caller', 'cache', 'get(k)'), link('cache', 'scan', 'for kk, v in data', { labelTone: 'warn' })],
        flows: [flow(['caller', 'cache'], 'get("z")', 'request'), flow(['cache', 'scan'], 'n compares', 'request', 1.5)],
        panel: {
          title: 'v1 get',
          icon: 'Code',
          code: 'def get(self, k):\n  for i, (kk, v) in enumerate(self.data):\n    if kk == k:\n      self.data.pop(i)\n      self.data.append((k, v))\n      return v\n  return -1',
          footer: { text: 'Scan is O(n), pop(i) is O(n) too', tone: 'bad' },
        },
        caption: 'Every call walks the list',
      },
    },
    {
      title: 'v2 timestamps',
      tag: 'case',
      heading: 'v2: a hash map with timestamps fixes lookup, not eviction',
      eli5: 'Each toy has a sticker with when it was last played. Finding a toy is instant, but finding the oldest sticker means reading them all.',
      body: [
        'Store `key -> (value, last_used)` in a dict. `get` is a dict lookup plus a stamp write, so lookup becomes **O(1)**. Use a monotonic counter for the stamp, since `time.time()` values can collide.',
        'Eviction is the problem. To find the oldest entry you call `min()` over every timestamp, which is **O(n)** again. A sorted structure would make it `O(log n)`, still not O(1).',
      ],
      keyIdea: 'A hash map gives O(1) lookup. Eviction needs the oldest entry without searching for it.',
      metrics: { get: 'O(1)', evict: 'O(n) min()', threads: '1', safe: 'no' },
      metricTones: { get: 'good', evict: 'bad' },
      scene: {
        nodes: [caller, { ...map, at: at(0, -2), label: 'dict', sub: 'key to (value, ts)', status: 'ok' }, { id: 'min', kind: 'block', at: at(4, -2), label: 'min(ts)', sub: 'scans all entries', icon: 'Search', tint: 'red', status: 'hot' }],
        links: [link('caller', 'map', 'get / put'), link('map', 'min', 'on evict', { labelTone: 'warn' })],
        flows: [flow(['caller', 'map'], 'get("a")', 'request'), flow(['map', 'caller'], 'value', 'response', 1.5), flow(['map', 'min'], 'find oldest', 'request', 3)],
        panel: {
          title: 'v2 eviction',
          icon: 'Code',
          code: 'if len(self.map) > self.cap:\n  oldest = min(self.map,\n    key=lambda x: self.map[x][1])  # counter\n  del self.map[oldest]',
          footer: { text: 'We need the oldest in O(1)', tone: 'warn' },
        },
        caption: 'Fast lookup, slow eviction',
      },
    },
    {
      title: 'Two structures',
      tag: 'concept',
      heading: 'The insight: one structure to find, one to order',
      eli5: 'Keep an index card that says exactly where each toy sits, plus the row of toys itself with the newest at the left. The card finds a toy, the row tells who is oldest.',
      body: [
        'Lookup wants a **hash map**. Ordering wants a list where moving an item to the front and dropping the last item are both O(1). A **doubly linked list** does that.',
        'The trick is that the map stores a pointer to the list node. Find the node in O(1), then unlink and relink it in O(1). Neither structure alone is enough. Together they are.',
      ],
      keyIdea: 'Hash map for where, linked list for when. The map holds pointers into the list.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      metricTones: { get: 'good', evict: 'good' },
      scene: {
        nodes: [{ ...map, at: at(-4, -2) }, { ...nodeA, at: at(4, -2), label: 'Linked list', sub: 'recency order', icon: 'Share2' }, { ...cache, at: at(0, 3), status: 'active', sub: 'owns both' }],
        links: [link('cache', 'map', 'has-a'), link('cache', 'na', 'has-a'), link('map', 'na', 'points to nodes', { style: 'dashed' })],
        flows: [flow(['cache', 'map'], 'find node', 'request'), flow(['map', 'na'], 'node ref', 'data', 1.5)],
        panel: {
          title: 'Who does what',
          icon: 'Table',
          rows: [
            { text: 'HashMap', value: 'find by key', tone: 'good' },
            { text: 'Linked list', value: 'order by use', tone: 'good' },
            { text: 'Move to front', value: 'O(1)' },
            { text: 'Drop the last', value: 'O(1)' },
          ],
          footer: { text: 'Both halves are O(1)', tone: 'good' },
        },
        caption: 'Two structures, one cache',
      },
    },
    {
      title: 'Why doubly linked',
      tag: 'concept',
      heading: 'Why doubly linked, and why sentinels',
      eli5: 'Each toy in the row holds hands with its left and right neighbor. To pull a toy out, both neighbors can just grab each other. Two guards stand at the ends so nobody checks for "no neighbor".',
      body: [
        'To unlink a node you need its predecessor. A singly linked list would walk from the head to find it, which is O(n). A node with `prev` and `next` removes itself with two pointer writes.',
        '**Sentinel** nodes `head` and `tail` hold no data. Real nodes always have a neighbor on both sides, so there are no `None` checks and no special case for an empty list.',
      ],
      keyIdea: 'prev pointers make removal O(1). Sentinels remove every edge case at the ends.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      scene: {
        nodes: [head, nodeA, nodeB, nodeC, tail],
        links: chain().map((l) => ({ ...l, arrow: 'both' as const })),
        flows: [flow(['na', 'nb'], 'next', 'request'), flow(['nb', 'na'], 'prev', 'response', 1.5)],
        panel: {
          title: 'Layout',
          icon: 'Code',
          code: 'head <-> A <-> B <-> C <-> tail\n\nhead.next = most recent (MRU)\ntail.prev = least recent (LRU)',
          footer: { text: 'Sentinels carry no data', tone: 'muted' },
        },
        caption: 'Recent at the head, old at the tail',
      },
    },
    {
      title: 'Node and list',
      tag: 'concept',
      heading: 'The Node class and two list helpers',
      eli5: 'Each toy gets a small name tag with its key, its value and two hands. Two moves are all the teacher needs: pull a toy out of the row, and put a toy first in line.',
      body: [
        '`Node` stores `key`, `value`, `prev` and `next`. The key lives in the node too, because eviction starts from a node and must delete its entry from the map.',
        '`_remove(n)` joins the neighbors. `_add_front(n)` splices `n` between `head` and the old first node. Each is a handful of pointer writes with no loops, so each is O(1).',
      ],
      keyIdea: 'Everything else in the cache is built from two O(1) moves: unlink a node, and insert after head.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      scene: {
        nodes: [{ ...head, status: 'active' }, { ...nodeA, label: 'Node', sub: 'key, value, prev, next', status: 'active' }, { ...cache, at: at(4, -2), label: 'LRUCache', sub: '_remove, _add_front' }],
        links: [link('cache', 'head', 'has-a'), link('cache', 'na', 'creates')],
        flows: [flow(['cache', 'na'], '_remove(n)', 'request'), flow(['cache', 'head'], '_add_front(n)', 'request', 1.5)],
        panel: {
          title: 'Two pointer moves',
          icon: 'Code',
          code: 'def _remove(self, n):\n    n.prev.nxt = n.nxt\n    n.nxt.prev = n.prev\n\ndef _add_front(self, n):\n    n.nxt, n.prev = self.head.nxt, self.head\n    self.head.nxt.prev = n\n    self.head.nxt = n',
          footer: { text: 'No loops, so O(1)', tone: 'good' },
        },
        caption: 'Unlink and insert after head',
      },
      code: {
        language: 'python',
        title: 'v3: the node, the cache shell and the helpers',
        source: `class Node:
    __slots__ = ("k", "v", "prev", "nxt")
    def __init__(self, k, v):
        self.k, self.v = k, v
        self.prev = self.nxt = None

class LRUCache(Cache):
    def __init__(self, cap):
        self.cap = cap
        self.map = {}                       # key -> Node
        self.head, self.tail = Node(0, 0), Node(0, 0)
        self.head.nxt = self.tail           # empty list
        self.tail.prev = self.head

    def _remove(self, n):
        n.prev.nxt = n.nxt
        n.nxt.prev = n.prev

    def _add_front(self, n):
        n.nxt, n.prev = self.head.nxt, self.head
        self.head.nxt.prev = n
        self.head.nxt = n`,
        highlight: [11, 12, 13, 16, 17, 20, 21, 22],
      },
    },
    {
      title: 'get',
      tag: 'concept',
      heading: 'get: look up, then move to the front',
      eli5: 'Asked for a toy, the teacher checks the index card, finds the toy, hands it over and moves it to the front of the row. A toy you just used is now the newest.',
      body: [
        'A `get` that finds the key is a **use**, so it changes the order. Look up the node in the map, `_remove` it, `_add_front` it and return its value. A missing key returns `-1` and touches nothing.',
        'Reading mutates the list. That detail will matter when threads arrive.',
      ],
      keyIdea: 'A read is also a write to the recency order. get = map lookup + unlink + insert at front.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      scene: {
        nodes: [caller, { ...cache, at: at(0, -2), status: 'active' }, { ...nodeB, at: at(4, -2), label: 'Node B', sub: 'found via map', status: 'active' }, { ...head, at: at(0, 3) }],
        links: [link('caller', 'cache', 'get("b")'), link('cache', 'nb', 'map["b"]'), link('cache', 'head', 'move to front')],
        flows: [flow(['caller', 'cache'], 'get("b")', 'request'), flow(['cache', 'nb'], 'map lookup', 'request', 1.5), flow(['cache', 'head'], '_add_front', 'data', 3), flow(['cache', 'caller'], 'value', 'response', 4.5)],
        panel: {
          title: 'get(key)',
          icon: 'Code',
          code: 'def get(self, k):\n    if k not in self.map:\n        return -1\n    n = self.map[k]\n    self._remove(n)\n    self._add_front(n)\n    return n.v',
          footer: { text: 'Miss: -1, order unchanged', tone: 'muted' },
        },
        caption: 'A hit becomes the most recent',
      },
    },
    {
      title: 'put',
      tag: 'concept',
      heading: 'put: two cases, new key and existing key',
      eli5: 'If the toy is already on the shelf, the teacher swaps in the new version and moves it to the front. If it is new, a fresh name tag goes on and it joins at the front.',
      body: [
        'If the key exists, update `n.v` and move the node to the front. Do not create a second node, or the map and the list disagree.',
        'If the key is new, create a `Node`, store it in the map and `_add_front` it. Then check the size: more than `cap` means evict.',
      ],
      keyIdea: 'Update in place when the key exists. Create and insert when it does not. Check capacity last.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      scene: {
        nodes: [caller, { ...cache, status: 'active' }, { ...map, at: at(4, -2), status: 'active', chips: ['"d" -> Node D'] }],
        links: [link('caller', 'cache', 'put("d", 4)'), link('cache', 'map', 'map["d"] = node')],
        flows: [flow(['caller', 'cache'], 'put("d", 4)', 'request'), flow(['cache', 'map'], 'store node', 'data', 1.5)],
        panel: {
          title: 'put(key, value)',
          icon: 'Code',
          code: 'def put(self, k, v):\n    if k in self.map:\n        n = self.map[k]; n.v = v\n        self._remove(n); self._add_front(n)\n        return\n    n = Node(k, v)\n    self.map[k] = n\n    self._add_front(n)',
          footer: { text: 'Then: if len(map) > cap, evict', tone: 'warn' },
        },
        caption: 'Insert or update, then check size',
      },
    },
    {
      title: 'Evict',
      tag: 'concept',
      heading: 'Eviction: drop tail.prev and delete its map entry',
      eli5: 'The shelf is full and a new toy arrives. The teacher takes the toy at the far right, the one nobody played with for longest, and removes its card from the index.',
      body: [
        'The least recently used node is always `tail.prev`, no search needed. `_remove` it from the list and `del self.map[lru.k]` from the map. This is why the node stores its key.',
        'Forgetting the map delete is the classic bug. The list shrinks, the map keeps a dangling pointer and the cache grows without bound.',
      ],
      keyIdea: 'tail.prev is the victim. Remove it from both structures, or the cache leaks.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      metricTones: { evict: 'good' },
      scene: {
        nodes: [{ ...cache, at: at(-4, -2), status: 'active', chips: ['size 4 > cap 3'] }, { ...nodeC, at: at(0, -2), status: 'down', sub: 'LRU, evicted' }, { ...map, at: at(4, -2), chips: ['del map["c"]'] }, { ...tail, at: at(0, 3) }],
        links: [link('cache', 'nc', 'tail.prev'), link('cache', 'map', 'del key'), link('nc', 'tail')],
        flows: [flow(['cache', 'nc'], '_remove', 'request'), flow(['cache', 'map'], 'del map[k]', 'request', 1.5)],
        panel: {
          title: 'Evict',
          icon: 'Code',
          code: 'if len(self.map) > self.cap:\n    lru = self.tail.prev\n    self._remove(lru)\n    del self.map[lru.k]',
          footer: { text: 'Both structures, every time', tone: 'warn' },
        },
        caption: 'The oldest leaves from both',
      },
      code: {
        language: 'python',
        title: 'The complete LRUCache',
        source: `class Node:
    __slots__ = ("k", "v", "prev", "nxt")
    def __init__(self, k, v):
        self.k, self.v = k, v
        self.prev = self.nxt = None

class LRUCache(Cache):
    def __init__(self, cap):
        if cap <= 0:
            raise ValueError("cap must be > 0")
        self.cap = cap
        self.map = {}
        self.head, self.tail = Node(0, 0), Node(0, 0)
        self.head.nxt = self.tail
        self.tail.prev = self.head

    def _remove(self, n):
        n.prev.nxt = n.nxt
        n.nxt.prev = n.prev

    def _add_front(self, n):
        n.nxt, n.prev = self.head.nxt, self.head
        self.head.nxt.prev = n
        self.head.nxt = n

    def get(self, k):
        n = self.map.get(k)
        if n is None:
            return -1
        self._remove(n)
        self._add_front(n)
        return n.v

    def put(self, k, v):
        n = self.map.get(k)
        if n is not None:
            n.v = v
            self._remove(n)
            self._add_front(n)
            return
        n = Node(k, v)
        self.map[k] = n
        self._add_front(n)
        if len(self.map) > self.cap:
            lru = self.tail.prev
            self._remove(lru)
            del self.map[lru.k]`,
        highlight: [44, 45, 46, 47],
      },
      quiz: {
        question: 'On eviction you unlink tail.prev from the list but forget to delete it from the map. What happens?',
        options: [
          'Nothing, the garbage collector cleans it',
          'The cache grows past capacity and get can still return the evicted key',
          'The list becomes singly linked',
          'put starts raising exceptions',
        ],
        answer: 1,
        explain: 'The map still points at the removed node, so get finds it and tries to unlink it again, and the map never shrinks. Evict must update both structures.',
      },
    },
    {
      title: 'Trace it',
      tag: 'case',
      heading: 'Trace: capacity 3, five operations',
      eli5: 'Watch the shelf as toys come and go. The newest is always at the left, and when a fourth toy arrives, the one at the right end goes back to the cupboard.',
      body: [
        'Run `put(a)`, `put(b)`, `put(c)`, `get(a)`, `put(d)`. After the first three the order is c, b, a. The `get(a)` moves `a` to the front: a, c, b.',
        'Now `put(d)` pushes the size to 4. `tail.prev` is `b`, so `b` is evicted. The final order is d, a, c. Notice `a` survived because it was just used.',
      ],
      keyIdea: 'The tail is whoever has gone longest without a get or put. A recent read protects an entry.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      scene: {
        nodes: [head, { ...nodeA, label: 'd', sub: 'new', status: 'active' }, { ...nodeB, label: 'a', sub: 'saved by get' }, { ...nodeC, label: 'c', sub: 'LRU now' }, tail],
        links: chain(),
        flows: [flow(['head', 'na'], 'put(d)', 'request')],
        panel: {
          title: 'Order after each call',
          icon: 'List',
          rows: [
            { text: 'put a, b, c', value: 'c b a' },
            { text: 'get(a)', value: 'a c b', tone: 'good' },
            { text: 'put(d), size 4', value: 'evict b', tone: 'warn' },
            { text: 'final', value: 'd a c', tone: 'good' },
          ],
          footer: { text: 'Front = newest, back = oldest', tone: 'muted' },
        },
        caption: 'a was used, so b is the victim',
      },
    },
    {
      title: 'Edge cases',
      tag: 'tradeoff',
      heading: 'Bad capacity and missing keys',
      eli5: 'What if someone asks for a shelf that holds zero toys, or for a toy that was never there? The rules still have to give a clear answer.',
      body: [
        'Capacity 0 or negative is rejected in the constructor with a `ValueError`, since no put could ever stay. Capacity 1 is fine: every new key evicts the previous one.',
        'A missing key returns `-1`. If `-1` is a legal value, return a sentinel or raise `KeyError` instead, so a miss differs from a stored `-1`.',
      ],
      keyIdea: 'Validate capacity up front, and make a miss distinguishable from a real value.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '1', safe: 'no' },
      scene: {
        nodes: [caller, { ...cache, status: 'active' }, { id: 'ctor', kind: 'block', at: at(4, -2), label: 'Constructor check', sub: 'cap > 0', icon: 'Shield', tint: 'amber', status: 'active' }],
        links: [link('caller', 'cache', 'LRUCache(0)'), link('cache', 'ctor', 'validate')],
        flows: [flow(['caller', 'cache'], 'cap = 0', 'request'), flow(['cache', 'ctor'], 'check', 'request', 1.5), flow(['ctor', 'caller'], 'ValueError', 'error', 3)],
        panel: {
          title: 'Edge cases',
          icon: 'Bug',
          rows: [
            { text: 'capacity 0 or less', value: 'ValueError', tone: 'warn' },
            { text: 'capacity 1', value: 'keeps newest', tone: 'good' },
            { text: 'get missing key', value: '-1 or KeyError' },
          ],
        },
        caption: 'Small inputs, defined answers',
      },
    },
    {
      title: 'Threads break it',
      tag: 'problem',
      heading: 'Two threads and a shared linked list',
      eli5: 'Two kids reach for toys at the same moment and both try to rearrange the row. One pulls a toy while the other grabs its neighbor, and the row ends up tangled.',
      body: [
        'A web server runs many threads against one cache. `get` is read-modify-write on the list: unlink, then insert. Two threads can interleave those pointer writes.',
        'Thread 1 unlinks `A` while thread 2 unlinks `B`, its neighbor. Each reads the other\'s old `prev` or `next`, and a node ends up pointing at something already removed. The list is corrupt, and the map may still point into it.',
      ],
      keyIdea: 'Even get mutates the list. Without mutual exclusion, concurrent pointer moves corrupt the structure.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '2', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [t1, t2, { ...state, status: 'hot', badge: 'prev/next tangled', chips: [{ text: 'head.next -> B (removed)', tone: 'bad' }] }],
        links: [link('t1', 'state', 'unlink A', { labelTone: 'warn' }), link('t2', 'state', 'unlink B', { labelTone: 'warn' })],
        flows: [flow(['t1', 'state'], '_remove(A)', 'error'), flow(['t2', 'state'], '_remove(B)', 'error')],
        panel: {
          title: 'The race',
          icon: 'Bug',
          rows: [
            { text: 'T1 reads A.prev, A.nxt', value: 'head, B' },
            { text: 'T2 reads B.prev, B.nxt', value: 'A, C' },
            { text: 'T1 writes head.nxt, B.prev', value: '= B, head', tone: 'warn' },
            { text: 'T2 writes A.nxt, C.prev', value: '= C, A', tone: 'warn' },
            { text: 'Result', value: 'head -> B, C -> A', tone: 'bad' },
          ],
          footer: { text: 'Head points at removed B, C points back at removed A', tone: 'bad' },
        },
        caption: 'Interleaved pointer writes',
      },
    },
    {
      title: 'v4 one lock',
      tag: 'concept',
      heading: 'v4: one RLock around every operation',
      eli5: 'The teacher puts a key on a hook. A kid must hold the key to touch the row, and only one kid has it at a time. Everyone else waits their turn.',
      body: [
        'Add `self.lock = threading.RLock()` and wrap the body of `get` and `put` in `with self.lock:`. Only one thread runs inside at a time, so the list and map always change as a unit.',
        'An `RLock` lets the same thread take the lock again. That helps when `put` later calls a helper that also locks. Use `get` under the lock too: it writes the order.',
      ],
      keyIdea: 'A lock makes each operation atomic. Hold it for get as well as put, because get reorders the list.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '2', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [t1, { ...t2, status: 'dim', sub: 'waiting' }, { ...lock, status: 'active' }, { ...state, at: at(0, 0), status: 'ok' }],
        links: [link('t1', 'lock', 'acquire'), link('t2', 'lock', 'blocked', { style: 'dashed', labelTone: 'warn' }), link('lock', 'state', 'guards')],
        flows: [flow(['t1', 'lock'], 'acquire', 'request'), flow(['lock', 'state'], 'get("a")', 'data', 1.5), flow(['state', 't1'], 'value', 'response', 3)],
        panel: {
          title: 'v4 get',
          icon: 'Code',
          code: 'def get(self, k):\n    with self.lock:\n        if k not in self.map:\n            return -1\n        n = self.map[k]\n        self._remove(n)\n        self._add_front(n)\n        return n.v',
          footer: { text: 'self.lock = threading.RLock()', tone: 'muted' },
        },
        caption: 'One thread inside at a time',
      },
    },
    {
      title: 'Lock bottleneck',
      tag: 'tradeoff',
      heading: 'The cost of one lock: everyone queues',
      eli5: 'With one key on one hook, 16 kids line up for a single toy at a time. The shelf is safe, but most kids are standing around.',
      body: [
        'A hit takes microseconds, but every hit takes the same lock. With 16 busy threads, most are waiting. Throughput stops growing as you add threads, and tail latency rises. In CPython the GIL already caps pure-Python speedup, so the effect is sharpest in Java, Go, C++ or free-threaded Python.',
        'This is the safe baseline. Many caches ship it and it is fine at modest load. Past that, the lock is the bottleneck, and the fix is to hold less of the cache behind each lock.',
      ],
      keyIdea: 'One global lock is correct and simple, and it serializes everything. Contention grows with thread count.',
      metrics: { get: 'O(1) + wait', evict: 'O(1)', threads: '16', safe: 'yes' },
      metricTones: { get: 'warn', threads: 'warn' },
      scene: {
        nodes: [{ ...t1, label: 'Threads', sub: '16 callers', status: 'hot', load: 92 }, { ...lock, status: 'hot', badge: '15 waiting' }, { ...state, status: 'active' }],
        links: [link('t1', 'lock', 'queue', { labelTone: 'warn' }), link('lock', 'state')],
        flows: [{ path: ['t1', 'lock', 'state'], tone: 'request', count: 4, duration: 2, label: 'get' }],
        panel: {
          title: 'Throughput with one lock (illustrative)',
          icon: 'Gauge',
          rows: [
            { text: '1 thread', value: '1x' },
            { text: '4 threads', value: '~1x', tone: 'warn' },
            { text: '16 threads', value: '~1x, waiting', tone: 'bad' },
          ],
          footer: { text: 'More cores, same speed', tone: 'bad' },
        },
        caption: 'Safe, and a single lane',
      },
    },
    {
      title: 'v5 striping',
      tag: 'concept',
      heading: 'v5: lock striping with sharded caches',
      eli5: 'Instead of one shelf and one key, the room has 16 small shelves, each with its own key. A toy goes to a shelf by its name, so kids rarely fight over the same key.',
      body: [
        'Make `StripedLRU` hold `N` independent `LRUCache` shards, each with its own lock and capacity `cap // N`. The shard is `hash(key) % N`. Two keys on different shards never wait on each other.',
        'With 16 shards, lock contention drops by about 16 times if keys spread evenly. In CPython the GIL limits the gain. Striping pays off in Java, Go, C++ or free-threaded Python.',
      ],
      keyIdea: 'Split the cache by key hash so each lock guards a small slice. Contention divides by the stripe count.',
      metrics: { get: 'O(1), little wait', evict: 'O(1)', threads: '16', safe: 'yes' },
      metricTones: { get: 'good', safe: 'good' },
      scene: {
        nodes: [{ ...t1, label: 'Threads', sub: '16 callers', load: 40 }, { id: 'striped', kind: 'block', at: at(0, -2), label: 'StripedLRU', sub: 'hash(k) % N', icon: 'Split', tint: 'green' }, { id: 's0', kind: 'block', size: 0.8, at: at(4, -3), label: 'Shard 0', sub: 'own lock', icon: 'Layers', tint: 'green' }, { id: 's1', kind: 'block', size: 0.8, at: at(4, 3), label: 'Shard 1', sub: 'own lock', icon: 'Layers', tint: 'green' }],
        links: [link('t1', 'striped'), link('striped', 's0', 'hash % N = 0'), link('striped', 's1', 'hash % N = 1')],
        flows: [flow(['t1', 'striped', 's0'], 'get("a")', 'request'), flow(['t1', 'striped', 's1'], 'get("b")', 'request', 0.3)],
        panel: {
          title: 'StripedLRU',
          icon: 'Code',
          code: 'class StripedLRU(Cache):\n    def __init__(self, cap, n=16):\n        per = max(1, cap // n)\n        self.shards = [LRUCache(per)\n                       for _ in range(n)]\n    def _shard(self, k):\n        return self.shards[hash(k) % len(self.shards)]',
          footer: { text: 'get/put call _shard(k).get/put', tone: 'muted' },
        },
        caption: 'Different keys, different locks',
      },
      code: {
        language: 'python',
        title: 'v5: a striped cache',
        source: `import threading

class LRUCache(Cache):
    def __init__(self, cap):
        # ... map, head, tail as before
        self.lock = threading.RLock()

    def get(self, k):
        with self.lock:
            ...

class StripedLRU(Cache):
    def __init__(self, cap, stripes=16):
        per = max(1, cap // stripes)
        self.shards = [LRUCache(per) for _ in range(stripes)]

    def _shard(self, k):
        return self.shards[hash(k) % len(self.shards)]

    def get(self, k):    return self._shard(k).get(k)
    def put(self, k, v): self._shard(k).put(k, v)`,
        highlight: [6, 9, 14, 15, 18, 20, 21],
      },
    },
    {
      title: 'Striping costs',
      tag: 'tradeoff',
      heading: 'What striping gives up',
      eli5: 'Each small shelf now keeps its own newest-to-oldest row. The oldest toy overall might survive on one shelf while a newer toy leaves another that was full.',
      body: [
        'Global LRU order is lost. A hot shard may evict an entry that is newer than the oldest one in a quiet shard. Total capacity is also split: `cap // N` can round down, and skewed keys fill one shard first.',
        'For most caching workloads this is fine, and production caches take the same trade. If strict global order matters, keep the single lock and accept the wait.',
      ],
      keyIdea: 'Striping buys concurrency by giving up exact global LRU. Choose it when throughput matters more than perfect order.',
      metrics: { get: 'O(1), little wait', evict: 'O(1) per shard', threads: '16', safe: 'yes' },
      metricTones: { evict: 'warn' },
      scene: {
        nodes: [{ id: 's0', kind: 'block', at: at(-4, -2), label: 'Shard 0', sub: 'full, hot', icon: 'Layers', tint: 'green', status: 'hot', load: 88 }, { id: 's1', kind: 'block', at: at(4, -2), label: 'Shard 1', sub: 'half empty', icon: 'Layers', tint: 'green', status: 'ok', load: 20 }, { ...state, at: at(0, 4), label: 'Global order', sub: 'no longer exact', tint: 'red' }],
        links: [link('s0', 'state', 'evicts a newer key', { labelTone: 'warn' }), link('s1', 'state', 'keeps an older key', { labelTone: 'warn' })],
        flows: [flow(['s0', 'state'], 'evict', 'error')],
        panel: {
          title: 'Trade-off',
          icon: 'Scale',
          rows: [
            { text: 'One lock', value: 'exact order, slow', tone: 'warn' },
            { text: 'N stripes', value: 'fast, approximate', tone: 'good' },
            { text: 'Skewed keys', value: 'one shard fills', tone: 'warn' },
          ],
          footer: { text: 'Pick by workload', tone: 'muted' },
        },
        caption: 'Order is per shard',
      },
    },
    {
      title: 'OrderedDict',
      tag: 'concept',
      heading: 'The library shortcut: OrderedDict',
      eli5: 'A real toy shop sells a shelf that already keeps the row for you. You still need to know how it works, because the teacher will ask.',
      body: [
        'Python\'s `OrderedDict` has `move_to_end` and `popitem(last=False)`, so a 10 line LRU wraps it. An interview usually wants the manual version, which shows you know why it is O(1).',
      ],
      keyIdea: 'Know the manual build, and use the library in production.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '16', safe: 'yes' },
      scene: {
        nodes: [{ ...cache, at: at(-4, 0), sub: 'wraps OrderedDict' }, { id: 'od', kind: 'block', at: at(4, 0), label: 'OrderedDict', sub: 'map + order built in', icon: 'Layers', tint: 'amber', status: 'active' }],
        links: [link('cache', 'od', 'move_to_end')],
        flows: [flow(['cache', 'od'], 'get(k)', 'request')],
        panel: {
          title: 'OrderedDict version',
          icon: 'Code',
          code: 'class LRU:  # d = OrderedDict()\n  def get(self, k):\n    if k not in self.d: return -1\n    self.d.move_to_end(k)\n    return self.d[k]\n  def put(self, k, v):\n    self.d[k] = v; self.d.move_to_end(k)\n    if len(self.d) > self.cap: self.d.popitem(last=False)',
          footer: { text: 'Same idea, ready-made parts', tone: 'muted' },
        },
        caption: 'Same idea, ready-made parts',
      },
    },
    {
      title: 'Extensions',
      tag: 'concept',
      heading: 'The policy sits behind the interface',
      eli5: 'Other shelf rules like "toys expire" or "keep the most played" use the same card with two rules, so the shelf can change and the kids never notice.',
      body: [
        'Extensions reuse the same shape. A **TTL** per node adds expiry, and an LFU policy can swap in behind the `Cache` interface. Hit and miss counters make the cache observable.',
      ],
      keyIdea: 'Keep the eviction policy behind an interface so it can change.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '16', safe: 'yes' },
      scene: {
        nodes: [{ ...iface, at: at(0, -3) }, { ...cache, at: at(-4, 2), sub: 'LRU policy' }, { id: 'lfu', kind: 'block', at: at(4, 2), label: 'LFUCache', sub: 'could swap in', icon: 'Layers', tint: 'green', status: 'dim' }],
        links: [link('cache', 'iface', 'implements'), link('lfu', 'iface', 'implements', { style: 'dashed' })],
        flows: [flow(['iface', 'cache'], 'get(k)', 'request')],
        panel: {
          title: 'Policies',
          icon: 'Table',
          rows: [
            { text: 'LRU', value: 'drop least recent' },
            { text: 'LFU', value: 'drop least used' },
            { text: 'TTL', value: 'drop expired', tone: 'good' },
          ],
          footer: { text: 'Same Cache interface', tone: 'muted' },
        },
        caption: 'Swap the policy, keep the API',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: the road from O(n) to a safe O(1)',
      eli5: 'A small shelf, a row of toys with the newest first, an index card to find any toy, one key on a hook for safety, and many small shelves when the room gets busy.',
      body: [
        'The list scan and the timestamp map each fix one half. The hash map plus doubly linked list with sentinels gives O(1) get, put and eviction, with `tail.prev` as the victim. Space is O(capacity).',
        'Threads need a lock because get reorders the list. One RLock is correct but serial. Lock striping divides contention and trades away exact global order.',
      ],
      keyIdea: 'Hash map to find, linked list to order, a lock to protect, and stripes to scale.',
      metrics: { get: 'O(1)', evict: 'O(1)', threads: '16', safe: 'yes' },
      metricTones: { get: 'good', evict: 'good', safe: 'good' },
      scene: {
        nodes: [{ ...cache, at: at(-3, -2), status: 'ok' }, { ...map, at: at(1, -2), status: 'ok' }, { ...lock, at: at(-3, 3), status: 'ok' }, { ...nodeA, at: at(1, 3), label: 'Linked list', sub: 'head + tail', status: 'ok', icon: 'Share2' }],
        links: [link('cache', 'map', 'has-a'), link('cache', 'lock', 'has-a'), link('cache', 'na', 'has-a')],
        flows: [flow(['cache', 'map'], 'find', 'request'), flow(['cache', 'na'], 'reorder', 'data', 1.5)],
        panel: {
          title: 'The versions',
          icon: 'Table',
          rows: [
            { text: 'v1 list', value: 'O(n) every call', tone: 'bad' },
            { text: 'v2 dict + timestamps', value: 'O(n) evict', tone: 'warn' },
            { text: 'v3 dict + DLL', value: 'O(1), 1 thread', tone: 'good' },
            { text: 'v4 + RLock', value: 'safe, serial', tone: 'warn' },
            { text: 'v5 striped', value: 'safe, parallel', tone: 'good' },
          ],
        },
        caption: 'Each version fixed one pain',
      },
      quiz: {
        question: 'Why does a get call need the lock in a multi-threaded LRU cache?',
        options: [
          'Dictionary reads are never safe in Python',
          'get moves the node to the front, so it changes the linked list',
          'The lock makes the lookup O(1)',
          'The lock keeps the capacity from changing',
        ],
        answer: 1,
        explain: 'A hit unlinks the node and re-inserts it at the head to mark it recent. Two threads doing that at once can corrupt the pointers, so get must hold the lock like put does.',
      },
    },
  ],
};
