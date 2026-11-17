import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const blk = (id: string, pos: [number, number], label: string, sub: string, tint: Tint, icon: string, extra: Partial<SceneNode> = {}): SceneNode => ({
  id,
  kind: 'block',
  at: pos,
  label,
  sub,
  tint,
  icon,
  ...extra,
});
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Slots: top row A B C, bottom row D E F
const A = at(-3.8, -3.8);
const B = at(0, -3.8);
const C = at(3.8, -3.8);
const D = at(-3.6, 3.8);
const E = at(0, 3.8);
const F = at(3.6, 3.8);

export const lldStructuralPatternsPart2: Lesson = {
  id: 'lld-structural-patterns-part-2',
  title: 'Structural patterns (part 2)',
  tagline: 'Flyweight, Composite and Bridge: sharing state across millions of objects, treating trees uniformly, and splitting two dimensions of variation.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Flyweight: intrinsic versus extrinsic state, a factory cache, and why shared state must be immutable',
    'Composite: one interface for leaves and branches, so recursive code needs no type checks',
    'Bridge: turning an N by M class matrix into N plus M classes by holding the implementation',
    'How each pattern breaks in production and when not to use it',
    'Choosing a pattern from the symptom, and how patterns combine',
  ],
  metrics: [
    { key: 'memory', label: 'Memory', icon: 'HardDrive' },
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'checks', label: 'Type checks', icon: 'Bug' },
    { key: 'pattern', label: 'Pattern', icon: 'Layers' },
  ],
  steps: [
    // 1
    {
      title: 'A million trees',
      tag: 'problem',
      heading: 'One million trees, each carrying its own 2.5 MB of texture',
      eli5: 'In the **toy shop** play-forest, every tiny tree owns a full-size paint set and a full-size mold. A million trees would need a million paint sets, and the shop floor is full.',
      body: [
        'A game draws a forest. Each `Tree` stores `x`, `y`, and also its species, a 2 MB texture and a 500 KB mesh. Only 3 species exist, yet every tree loads its own copy.',
        '1,000,000 trees times 2.5 MB is **2.5 TB**. The process runs out of memory before it draws a frame.',
      ],
      keyIdea: 'When millions of objects repeat the same few heavy values, copying them per object is the bug.',
      metrics: { memory: '2.5 TB', classes: '1', checks: '-', pattern: 'none' },
      metricTones: { memory: 'bad' },
      scene: {
        nodes: [
          blk('t1', A, 'Tree', 'x, y + 2.5 MB', 'green', 'Package', { status: 'hot', load: 95 }),
          blk('t2', B, 'Tree', 'x, y + 2.5 MB', 'green', 'Package', { status: 'hot' }),
          blk('t3', C, 'Tree', 'x, y + 2.5 MB', 'green', 'Package', { status: 'hot' }),
        ],
        panel: {
          title: 'Memory per tree',
          icon: 'HardDrive',
          rows: [
            { text: 'x, y + type reference, 24 bytes', value: '24 bytes' },
            { text: 'texture PNG', value: '2 MB', tone: 'bad' },
            { text: 'mesh', value: '500 KB', tone: 'bad' },
            { text: '1,000,000 trees', value: '2.5 TB', tone: 'bad' },
          ],
          footer: { text: 'Only 3 distinct species exist', tone: 'warn' },
        },
        caption: 'Three species, a million copies',
      },
    },
    // 2
    {
      title: 'Flyweight',
      tag: 'concept',
      heading: 'Flyweight: share the intrinsic state, pass in the extrinsic',
      eli5: 'One big stamp for "oak tree" sits on a shelf. Every tree in the forest is just a spot on the map plus a note saying "use the oak stamp".',
      body: [
        'Split each object. **Intrinsic** state is shared and immutable: species, texture, mesh. **Extrinsic** state is unique per object: `x` and `y`.',
        'A `TreeFactory` keeps a cache keyed by species and hands out the same `TreeType` every time. A `Tree` holds a reference, not a copy. Memory drops from 2.5 TB to about **31 MB**. Real Python objects carry more overhead, so read this as a model of the saving.',
      ],
      keyIdea: 'Flyweight keeps one shared copy of the heavy, unchanging state and gives each object only what is unique.',
      metrics: { memory: '31 MB', classes: '3', checks: '-', pattern: 'Flyweight' },
      metricTones: { memory: 'good' },
      scene: {
        nodes: [
          blk('tree1', A, 'Tree', 'x=12.5, y=7.3', 'green', 'Package'),
          blk('tree2', D, 'Tree', 'x=99, y=1.2', 'green', 'Package'),
          blk('factory', B, 'TreeFactory', 'cache by species', 'blue', 'Boxes', { status: 'active' }),
          blk('type', F, 'TreeType', 'oak, frozen, shared', 'green', 'Layers', { status: 'ok', badge: '1 copy' }),
        ],
        links: [
          link('tree1', 'type', { label: 'has-a', style: 'dashed' }),
          link('tree2', 'type', { label: 'has-a', style: 'dashed' }),
          link('factory', 'type', { label: 'creates once' }),
        ],
        flows: [
          { path: ['tree1', 'factory'], tone: 'request', label: 'get("oak")', duration: 1.4 },
          { path: ['factory', 'type', 'tree1'], tone: 'response', label: 'same object', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Memory after',
          icon: 'HardDrive',
          rows: [
            { text: '1M Tree objects: 24 MB (24 bytes each)', value: '24 MB' },
            { text: '3 TreeType objects', value: '7.5 MB' },
            { text: 'Before', value: '2.5 TB', tone: 'bad' },
            { text: 'After', value: 'about 31 MB', tone: 'good' },
          ],
        },
        caption: 'A million references to three objects',
      },
      code: {
        language: 'python',
        title: 'Flyweight with a factory cache',
        source: `from dataclasses import dataclass

@dataclass(frozen=True)
class TreeType:                     # intrinsic (shared) state
    species: str
    texture: bytes
    mesh: bytes
    bark_color: str

class TreeFactory:
    _cache: dict[str, TreeType] = {}
    @classmethod
    def get(cls, species: str) -> TreeType:
        if species not in cls._cache:
            cls._cache[species] = TreeType(
                species=species,
                texture=load_png(f"{species}.png"),
                mesh=load_mesh(f"{species}.obj"),
                bark_color={"oak": "#4a2e1a", "pine": "#3d2a1f"}[species],
            )
        return cls._cache[species]

@dataclass
class Tree:                         # extrinsic (unique) state only
    x: float
    y: float
    type: TreeType                  # a reference, not a copy

forest = [Tree(random_x(), random_y(), TreeFactory.get("oak"))
          for _ in range(1_000_000)]`,
        highlight: [3, 10, 13, 14, 24, 27],
      },
    },
    // 3
    {
      title: 'Flyweight limits',
      tag: 'tradeoff',
      heading: 'Shared means one bug hits everyone',
      eli5: 'If one child scribbles red on the shared oak stamp, every oak tree in the forest turns red. Shared things must be locked, and the stamp shelf needs a limit.',
      body: [
        '**Mutation:** `oak.bark_color = "red"` recolors every tree, so use `frozen=True`. **Key leak:** `"Oak "` makes a second cache entry, so normalize keys. **Unbounded cache:** 10,000 species grows forever, so cap it with an LRU. **Races:** two threads can both load on a first miss, so lock the fill.',
        '**When not to:** about 100 objects, where the factory costs more than it saves, or shared state that actually changes. Java `Integer.valueOf` caching -128 to 127 is the same idea.',
      ],
      keyIdea: 'A flyweight must be immutable, keyed cleanly and bounded. Otherwise sharing becomes shared damage.',
      metrics: { memory: '31 MB', classes: '3', checks: '-', pattern: 'Flyweight' },
      scene: {
        nodes: [
          blk('bad', A, 'oak.bark = red', 'mutation', 'red', 'Bug', { status: 'down' }),
          blk('type', B, 'TreeType', 'frozen=True', 'green', 'Shield', { status: 'ok' }),
          blk('cache', F, 'Cache', 'normalize, cap, lock', 'blue', 'Boxes', { status: 'active' }),
        ],
        links: [link('bad', 'type', { label: 'FrozenInstanceError', labelTone: 'good' }), link('type', 'cache', { label: 'held by' })],
        flows: [{ path: ['bad', 'type'], tone: 'error', label: 'write blocked', duration: 1.6 }],
        panel: {
          title: 'Four ways it breaks',
          icon: 'List',
          rows: [
            { text: 'Mutating the flyweight', value: 'frozen=True', tone: 'good' },
            { text: 'Key "Oak " vs "oak"', value: 'strip().lower()', tone: 'good' },
            { text: '10,000 kinds, no cap', value: 'LRU limit', tone: 'good' },
            { text: 'Two threads, first miss', value: 'lock the fill', tone: 'good' },
          ],
        },
        caption: 'Sharing is safe only when immutable',
      },
      quiz: {
        question: 'In the forest example, which field is extrinsic state?',
        options: ['The texture bytes', 'The mesh', 'The tree x and y position', 'The species name'],
        answer: 2,
        explain: 'Extrinsic state is unique to each object and passed in at use time. Species, texture and mesh are the same for every oak, so they are intrinsic and shared.',
      },
    },
    // 4
    {
      title: 'Tree of things',
      tag: 'problem',
      heading: 'Recursive code that checks types at every step',
      eli5: 'A toy box can hold toys and also smaller toy boxes. To count the pieces, you keep asking "is this a toy or a box?" over and over.',
      body: [
        'A file system has `File` and `Directory`. To compute a total size, `total_size(node)` branches on `isinstance` for the node, then again for every child, and raises `TypeError` for anything unknown.',
        'Adding a `Symlink` class means finding and editing every one of those branches.',
      ],
      keyIdea: 'Type checks scattered through recursive code are a sign that the types should share an interface.',
      metrics: { memory: '-', classes: '2', checks: '2 per node', pattern: 'none' },
      metricTones: { checks: 'bad' },
      scene: {
        nodes: [
          blk('fn', A, 'total_size()', 'caller', 'green', 'Code', { status: 'hot' }),
          blk('file', D, 'File', 'size', 'green', 'FileText'),
          blk('dir', F, 'Directory', 'children', 'green', 'Package'),
        ],
        links: [link('fn', 'file', { label: 'isinstance?', labelTone: 'warn' }), link('fn', 'dir', { label: 'isinstance?', labelTone: 'warn' })],
        flows: [
          { path: ['fn', 'file'], tone: 'request', label: 'File?', duration: 1.3 },
          { path: ['fn', 'dir'], tone: 'request', label: 'Directory?', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'The branching',
          icon: 'Code',
          code: 'if isinstance(node, File):\n    return node.size\nelif isinstance(node, Directory):\n    for child in node.children:\n        if isinstance(child, File): ...\n        elif isinstance(child, Directory): ...\n        else: raise TypeError',
        },
        caption: 'Every new node type edits this code',
      },
    },
    // 5
    {
      title: 'Composite',
      tag: 'concept',
      heading: 'Composite: leaves and branches share one interface',
      eli5: 'Give every toy and every toy box the same label: "how many pieces?". A toy answers 1. A box asks everything inside and adds the answers.',
      body: [
        'Define `FSNode` with `size()` and `delete()`. `File` is the **leaf** and answers directly. `Directory` is the **composite**: it holds `list[FSNode]` and answers by asking each child.',
        'Because a directory can hold files and directories, the recursion comes free. The caller never writes `isinstance`.',
      ],
      keyIdea: 'Composite lets a client treat one object and a group of objects through the same interface.',
      metrics: { memory: '-', classes: '3', checks: '0', pattern: 'Composite' },
      metricTones: { checks: 'good' },
      scene: {
        nodes: [
          blk('node', B, 'FSNode', 'size(), delete()', 'violet', 'Plug'),
          blk('file', D, 'File', 'leaf', 'green', 'FileText'),
          blk('dir', F, 'Directory', 'composite', 'green', 'Package', { status: 'active' }),
        ],
        links: [
          link('file', 'node', { label: 'implements' }),
          link('dir', 'node', { label: 'implements' }),
          link('dir', 'node', { label: 'has-a (many)', style: 'dashed', route: 'straight' }),
        ],
        flows: [{ path: ['dir', 'node', 'file'], tone: 'request', label: 'size()', duration: 1.8 }],
        panel: {
          title: 'Same call, both kinds',
          icon: 'Code',
          code: 'class Directory(FSNode):\n    def size(self):\n        return sum(c.size()\n                   for c in self.children)\n    def delete(self):\n        for c in self.children:\n            c.delete()\n        print(f"rmdir {self.name}")',
        },
        caption: 'Directory holds FSNode, not just File',
      },
      code: {
        language: 'python',
        title: 'Composite file system',
        source: `from abc import ABC, abstractmethod

class FSNode(ABC):
    @abstractmethod
    def size(self) -> int: ...
    @abstractmethod
    def delete(self) -> None: ...

class File(FSNode):
    def __init__(self, name: str, bytes_: int):
        self.name, self._bytes = name, bytes_
    def size(self) -> int:
        return self._bytes
    def delete(self) -> None:
        print(f"rm {self.name}")

class Directory(FSNode):
    def __init__(self, name: str):
        self.name = name
        self.children: list[FSNode] = []
    def add(self, child: FSNode):
        self.children.append(child)
    def size(self) -> int:
        return sum(c.size() for c in self.children)
    def delete(self) -> None:
        for c in self.children:
            c.delete()
        print(f"rmdir {self.name}")`,
        highlight: [3, 19, 25, 26, 27, 28],
      },
    },
    // 6
    {
      title: 'Size trace',
      tag: 'case',
      heading: 'Case: root.size() walks the tree depth first',
      eli5: 'Ask the big box how many pieces. It asks the little box and the loose toy, the little box asks its toys, and the answers add back up.',
      body: [
        'Tree: `/` holds `a.txt` (100) and `home/`. `home/` holds `b.txt` (200) and `c.log` (50).',
        '`root.size()` calls `a.size()` for 100 and `home.size()`. Home sums 200 and 50 to get 250. Root sums 100 and 250 to get **350**. `delete()` has the same shape and removes children before the directory, like `rm -r`.',
      ],
      keyIdea: 'One call at the root fans out through the whole tree, and each node only knows its own children.',
      metrics: { memory: '-', classes: '3', checks: '0', pattern: 'Composite' },
      scene: {
        nodes: [
          blk('root', A, 'root /', 'Directory', 'green', 'Package', { badge: '350' }),
          blk('a', D, 'a.txt', 'File, 100', 'green', 'FileText'),
          blk('home', C, 'home/', 'Directory', 'green', 'Package', { badge: '250' }),
          blk('b', E, 'b.txt', 'File, 200', 'green', 'FileText'),
          blk('c', F, 'c.log', 'File, 50', 'green', 'FileText'),
        ],
        links: [link('root', 'a'), link('root', 'home'), link('home', 'b'), link('home', 'c')],
        flows: [
          { path: ['root', 'home', 'b'], tone: 'request', label: 'size()', duration: 1.8 },
          { path: ['b', 'home', 'root'], tone: 'response', label: '200 + 50 = 250', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Sums on the way back',
          icon: 'Table',
          rows: [
            { text: 'b.txt + c.log', value: '200 + 50' },
            { text: 'home/', value: '250' },
            { text: 'a.txt + home/', value: '100 + 250' },
            { text: 'root.size()', value: '350', tone: 'good' },
          ],
        },
        caption: 'Leaves answer, branches add',
      },
    },
    // 7
    {
      title: 'Composite limits',
      tag: 'tradeoff',
      heading: 'Where a composite breaks',
      eli5: 'A box that is put inside itself never ends. A box stacked 10,000 deep is too tall to count. And a toy that pretends to hold other toys will surprise you.',
      body: [
        '**Cycle:** `home.add(root)` makes `size()` recurse forever, so forbid adding an ancestor. **Depth:** 10,000 levels hits Python\'s recursion limit, so use an explicit stack. **Lying interface:** keep `add` on `Directory` only, not on `FSNode`. **Mutation:** `delete()` should loop over `list(self.children)`.',
        '**When not to:** the tree is really flat, or leaves and branches differ so much that the shared interface is a lie. Used in the DOM, React trees, the Python `ast` module and `unittest.TestSuite`.',
      ],
      keyIdea: 'Composite assumes a real tree and an interface that is honest for both leaves and branches.',
      metrics: { memory: '-', classes: '3', checks: '0', pattern: 'Composite' },
      scene: {
        nodes: [
          blk('root', A, 'root /', 'Directory', 'green', 'Package'),
          blk('home', D, 'home/', 'Directory', 'green', 'Package', { status: 'hot' }),
          blk('bug', C, 'RecursionError', 'cycle or depth', 'red', 'Bug', { status: 'down' }),
        ],
        links: [link('root', 'home', { label: 'has-a' }), link('home', 'root', { label: 'add(root) cycle', labelTone: 'bad', style: 'dashed' })],
        flows: [{ path: ['root', 'home', 'root'], tone: 'error', label: 'size()', duration: 1.8 }],
        panel: {
          title: 'Fixes',
          icon: 'List',
          rows: [
            { text: 'Cycle in the tree', value: 'refuse ancestors', tone: 'good' },
            { text: 'Very deep tree', value: 'iterative DFS', tone: 'good' },
            { text: 'File.add() that raises', value: 'add only on Directory', tone: 'good' },
            { text: 'delete() while looping', value: 'loop over a copy', tone: 'good' },
          ],
        },
        caption: 'A tree must stay a tree',
      },
      quiz: {
        question: 'Why should add(child) live on Directory and not on the shared FSNode interface?',
        options: [
          'It makes size() faster',
          'File.add() would exist but always raise, so the interface would lie to callers',
          'Python forbids methods on abstract classes',
          'It prevents cycles automatically',
        ],
        answer: 1,
        explain: 'A method that leaves of the tree cannot honor breaks the uniform interface and surprises callers at runtime. Keep child management on the composite only.',
      },
    },
    // 8
    {
      title: 'Class matrix',
      tag: 'problem',
      heading: 'Two kinds of variation multiply into a pile of classes',
      eli5: 'The shop sells figures in two shapes and two paint styles. If every pair needs its own mold, adding one new paint style means a new mold for every shape.',
      body: [
        'Shapes (`Circle`, `Square`) times renderers (SVG, Canvas) gives `CircleSVG`, `CircleCanvas`, `SquareSVG`, `SquareCanvas`: 4 classes.',
        'Add OpenGL and Metal and it is 8. Add Triangle, Star and Path and it is 20. The growth is **quadratic**, and every new combination copies logic.',
      ],
      keyIdea: 'Inheritance on two independent axes at once gives N times M classes.',
      metrics: { memory: '-', classes: '4 now, 20 later', checks: '-', pattern: 'none' },
      metricTones: { classes: 'bad' },
      scene: {
        nodes: [
          blk('cs', A, 'CircleSVG', 'class 1', 'green', 'Package', { status: 'hot' }),
          blk('cc', C, 'CircleCanvas', 'class 2', 'green', 'Package', { status: 'hot' }),
          blk('ss', D, 'SquareSVG', 'class 3', 'green', 'Package', { status: 'hot' }),
          blk('sc', F, 'SquareCanvas', 'class 4', 'green', 'Package', { status: 'hot' }),
        ],
        panel: {
          title: 'Classes needed',
          icon: 'Table',
          rows: [
            { text: '2 shapes x 2 renderers', value: '4' },
            { text: '2 shapes x 4 renderers', value: '8', tone: 'warn' },
            { text: '5 shapes x 4 renderers', value: '20', tone: 'bad' },
          ],
          footer: { text: 'Quadratic growth', tone: 'bad' },
        },
        caption: 'One class per pair',
      },
    },
    // 9
    {
      title: 'Bridge',
      tag: 'concept',
      heading: 'Bridge: the abstraction holds the implementation',
      eli5: 'Keep the figure mold and the paint set apart. A figure just carries a paint set and says "paint yourself with this". Swap the paint set and the same figure looks new.',
      body: [
        'Split into two hierarchies. **Abstraction**: `Shape` with `Circle` and `Square` (what to draw). **Implementor**: `Renderer` with SVG and Canvas (how to draw primitives). `Shape` stores a `renderer`, and that reference is the **bridge**.',
        '`Circle.draw()` calls `renderer.draw_circle(...)`. Now it is N + M classes: adding OpenGL is **one** new class. You can even swap `circle.renderer` at runtime.',
      ],
      keyIdea: 'Bridge replaces inheritance on a second axis with composition, so the two axes vary independently.',
      metrics: { memory: '-', classes: '4 now, 9 later', checks: '-', pattern: 'Bridge' },
      metricTones: { classes: 'good' },
      scene: {
        nodes: [
          blk('shape', A, 'Shape', 'abstract, has renderer', 'blue', 'Layers'),
          blk('circle', D, 'Circle', 'extends Shape', 'green', 'Package', { status: 'active' }),
          blk('renderer', C, 'Renderer', 'interface', 'violet', 'Plug'),
          blk('svg', F, 'SVGRenderer', 'concrete', 'green', 'FileCode'),
        ],
        links: [
          link('circle', 'shape', { label: 'extends' }),
          link('shape', 'renderer', { label: 'has-a (the bridge)' }),
          link('svg', 'renderer', { label: 'implements' }),
        ],
        flows: [
          { path: ['circle', 'renderer', 'svg'], tone: 'request', label: 'draw_circle(10,10,5)', duration: 2 },
        ],
        panel: {
          title: 'The bridge in the base class',
          icon: 'Code',
          code: 'class Shape(ABC):\n    def __init__(self, renderer):\n        self.renderer = renderer\nclass Circle(Shape):\n    def draw(self):\n        self.renderer.draw_circle(\n            self.x, self.y, self.r)',
        },
        caption: 'Shape knows what, Renderer knows how',
      },
      code: {
        language: 'python',
        title: 'Bridge: shapes and renderers',
        source: `from abc import ABC, abstractmethod

class Renderer(ABC):                        # implementor
    @abstractmethod
    def draw_circle(self, x, y, r): ...
    @abstractmethod
    def draw_rect(self, x, y, w, h): ...

class SVGRenderer(Renderer):
    def draw_circle(self, x, y, r):
        print(f'<circle cx="{x}" cy="{y}" r="{r}"/>')
    def draw_rect(self, x, y, w, h):
        print(f'<rect x="{x}" y="{y}" width="{w}" height="{h}"/>')

class CanvasRenderer(Renderer):
    def draw_circle(self, x, y, r):
        print(f"ctx.arc({x},{y},{r},0,2*PI); ctx.stroke();")
    def draw_rect(self, x, y, w, h):
        print(f"ctx.rect({x},{y},{w},{h}); ctx.stroke();")

class Shape(ABC):                           # abstraction
    def __init__(self, renderer: Renderer):
        self.renderer = renderer            # the bridge
    @abstractmethod
    def draw(self): ...

class Circle(Shape):
    def __init__(self, renderer, x, y, r):
        super().__init__(renderer); self.x, self.y, self.r = x, y, r
    def draw(self):
        self.renderer.draw_circle(self.x, self.y, self.r)

Circle(SVGRenderer(), 10, 10, 5).draw()    # <circle cx="10" cy="10" r="5"/>`,
        highlight: [3, 22, 24, 33],
      },
    },
    // 10
    {
      title: 'Bridge limits',
      tag: 'tradeoff',
      heading: 'Bridge pays off only with two real dimensions',
      eli5: 'If every figure only ever uses one paint set, keeping them apart is extra work for nothing. It helps when both really change.',
      body: [
        'Real fits: persistence (MySQL, Postgres) times entity (User, Order), theme times widget, cloud times service. JDBC is a bridge, with the driver as implementor.',
        '**Watch for:** an implementor that grows 47 primitives, so keep it small and orthogonal. Stateful renderers that leak a "current color" between shapes. A missing method that only fails on one combination. **When not to:** you have one dimension. You need a class, not a bridge.',
      ],
      keyIdea: 'Bridge is for two axes that both change. With one axis it is indirection you pay for and never use.',
      metrics: { memory: '-', classes: 'N + M', checks: '-', pattern: 'Bridge' },
      scene: {
        nodes: [
          blk('abs', A, 'Abstraction', 'what: Shape, Entity', 'blue', 'Layers'),
          blk('impl', C, 'Implementor', 'how: Renderer, Driver', 'violet', 'Plug'),
          blk('one', F, 'One axis only', 'skip the bridge', 'gray', 'Bug', { status: 'dim' }),
        ],
        links: [link('abs', 'impl', { label: 'has-a' })],
        panel: {
          title: 'Fit check',
          icon: 'Scale',
          rows: [
            { text: 'Entity x database', value: 'bridge', tone: 'good' },
            { text: 'Theme x widget', value: 'bridge', tone: 'good' },
            { text: 'Cloud x service', value: 'bridge', tone: 'good' },
            { text: 'One renderer ever', value: 'plain class', tone: 'warn' },
          ],
        },
        caption: 'Count the axes before bridging',
      },
    },
    // 11
    {
      title: 'Pick a pattern',
      tag: 'case',
      heading: 'Start from the symptom, not the pattern name',
      eli5: 'You do not pick a tool because it is shiny. You pick it because something is stuck, and then you check it really is the right one.',
      body: [
        'Wrong interface from a library: **Adapter**. Logging or caching around calls: **Decorator**. Five subsystems per task: **Facade**. Expensive or remote object: **Proxy**. Millions of objects with a few kinds: **Flyweight**. Tree of the same interface: **Composite**. Two axes of variation: **Bridge**.',
        'Patterns also combine: a middleware stack is a decorator chain. If no pain exists yet, a pattern is speculative complexity. Naming a pile of patterns in one design reads as memorized, not understood. Pick two or three that fit.',
      ],
      keyIdea: 'Feel the pain first. Then name the pattern that fits it, and use no more than two or three.',
      metrics: { memory: '-', classes: '-', checks: '-', pattern: 'by symptom' },
      scene: {
        nodes: [
          blk('pain', A, 'Symptom', 'what hurts', 'amber', 'Bug'),
          blk('pat', C, 'Pattern', 'the named fix', 'green', 'Layers', { status: 'ok' }),
          blk('yagni', F, 'No pain yet', 'skip the pattern', 'gray', 'Shield', { status: 'dim' }),
        ],
        links: [link('pain', 'pat', { label: 'then' })],
        panel: {
          title: 'Symptom to pattern',
          icon: 'Table',
          rows: [
            { text: 'Library has wrong interface', value: 'Adapter' },
            { text: 'Add logging, auth, retry', value: 'Decorator' },
            { text: 'Callers orchestrate 5 systems', value: 'Facade' },
            { text: 'Real object costly or remote', value: 'Proxy' },
            { text: 'Millions of look-alike objects', value: 'Flyweight' },
            { text: 'Tree, or two axes', value: 'Composite, Bridge' },
          ],
        },
        caption: 'Pain, then pattern',
      },
    },
    // 12
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Seven structural patterns, one question each',
      eli5: 'The toy shop has a plug adapter, gift wrap, a counter, a window photo, one shared stamp, boxes in boxes and a mix-and-match paint set. Each fixes one stuck spot.',
      body: [
        '**Adapter** translates, **Decorator** adds, **Facade** simplifies, **Proxy** guards. **Flyweight** shares state, **Composite** treats trees uniformly, **Bridge** splits two axes.',
        'Each one trades a little indirection for a specific kind of flexibility. Use it only when the matching pain is real.',
      ],
      keyIdea: 'Structural patterns answer how objects connect: wrap, front, share, nest and split.',
      metrics: { memory: '2.5 TB to 31 MB', classes: '20 to 9', checks: '0', pattern: 'seven' },
      metricTones: { memory: 'good', classes: 'good', checks: 'good' },
      scene: {
        nodes: [
          blk('fw', A, 'Flyweight', 'share state', 'green', 'Copy', { status: 'ok' }),
          blk('co', C, 'Composite', 'uniform tree', 'green', 'Package', { status: 'ok' }),
          blk('br', F, 'Bridge', 'two axes', 'green', 'Cable', { status: 'ok' }),
        ],
        panel: {
          title: 'Part 2 results',
          icon: 'TrendingUp',
          rows: [
            { text: 'Forest memory', value: '2.5 TB to ~31 MB', tone: 'good' },
            { text: 'Type checks in size()', value: '0', tone: 'good' },
            { text: '5 shapes x 4 renderers', value: '9 classes, not 20', tone: 'good' },
          ],
        },
        caption: 'Share, nest, split',
      },
      quiz: {
        question: 'You have 5 shape types and 4 rendering backends and the class count is 20. Which change brings it to 9?',
        options: [
          'Flyweight, so shapes share state',
          'Composite, so shapes form a tree',
          'Bridge, so Shape holds a Renderer and the two hierarchies grow separately',
          'Facade, so callers use one method',
        ],
        answer: 2,
        explain: 'Bridge turns N times M into N plus M: 5 shapes plus 4 renderers is 9 classes. The other patterns solve different problems.',
      },
    },
  ],
};
