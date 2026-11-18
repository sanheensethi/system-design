import type { Lesson, SceneFlow, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });
const flow = (path: string[], label: string, tone: SceneFlow['tone'], delay = 0, duration = 1.4): SceneFlow => ({ path, tone, label, delay, duration });

const caller: SceneNode = { id: 'caller', kind: 'block', at: at(-4, -3.8), label: 'Caller', sub: 'the shell', icon: 'Terminal', tint: 'gray' };
const flat: SceneNode = { id: 'flat', kind: 'block', at: at(0, -3.8), label: 'dict', sub: 'path to content', icon: 'Hash', tint: 'amber' };
const node: SceneNode = { id: 'node', kind: 'block', at: at(0, -3.8), label: 'Node', sub: 'abstract class', icon: 'Layers', tint: 'blue' };
const file: SceneNode = { id: 'file', kind: 'block', at: at(-4, 3.4), label: 'File', sub: 'concrete: content', icon: 'File', tint: 'green' };
const dir: SceneNode = { id: 'dir', kind: 'block', at: at(4, 3.4), label: 'Directory', sub: 'concrete: children', icon: 'Folder', tint: 'green' };
const fs: SceneNode = { id: 'fs', kind: 'block', at: at(-4, -3.8), label: 'FileSystem', sub: 'facade, owns root', icon: 'HardDrive', tint: 'green' };
const root: SceneNode = { id: 'root', kind: 'block', at: at(0, -3.8), label: 'root /', sub: 'Directory', icon: 'Folder', tint: 'green' };
const visitor: SceneNode = { id: 'visitor', kind: 'block', at: at(4, -3.8), label: 'Visitor', sub: 'interface', icon: 'Braces', tint: 'violet' };

export const lldFileSystem: Lesson = {
  id: 'lld-file-system',
  title: 'In-memory file system',
  tagline: 'Model files and folders as a tree, add size and search without a pile of type checks, then handle permissions and symbolic links.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Why a flat dict of paths fails, and the tree that replaces it',
    'The Composite pattern: one size() and path() for files and folders alike',
    'Path resolution, mkdir, read, list, move, copy and delete',
    'The Visitor pattern for search and disk usage without touching node classes',
    'Permissions with an owner and a mode, and symbolic links with loop detection',
    'Edge cases: moving a folder into itself, name clashes, threads',
  ],
  metrics: [
    { key: 'rename', label: 'Rename cost', icon: 'Timer' },
    { key: 'lookup', label: 'Lookup cost', icon: 'Gauge' },
    { key: 'types', label: 'Node types', icon: 'Layers' },
    { key: 'ops', label: 'Operations', icon: 'Code' },
  ],
  steps: [
    {
      title: 'Flat dict',
      tag: 'problem',
      heading: 'The first idea: one dict from path to content',
      eli5: 'Imagine a toy cabinet where every toy has a long label like "big-box/red-box/car", but there are no boxes at all, only labels stuck on a pile of toys.',
      body: [
        'An interviewer asks for an in-memory file system. The quick answer is `fs = {"/a/b/c.txt": "hello"}`, and `ls` filters keys by prefix.',
        'It breaks fast. A **directory** is not an object, so an empty one cannot exist. `ls` scans every key. Renaming `/a/b` to `/a/x` rewrites every key under it, which is O(N).',
      ],
      keyIdea: 'A flat dict has no directories, so empty folders, cheap renames and fast listing are all impossible.',
      metrics: { rename: 'O(N) keys', lookup: 'O(1) exact, O(N) ls', types: '0', ops: '2' },
      metricTones: { rename: 'bad', lookup: 'warn' },
      scene: {
        nodes: [caller, { ...flat, status: 'hot', chips: ['3 keys'] }],
        links: [link('caller', 'flat', 'ls("/a")', { labelTone: 'warn' })],
        flows: [flow(['caller', 'flat'], 'ls("/a")', 'request'), flow(['flat', 'caller'], 'scan all keys', 'error', 1.5)],
        panel: {
          title: 'What the dict cannot do',
          icon: 'X',
          rows: [
            { text: 'Empty directory', value: 'no key to hold it', tone: 'bad' },
            { text: 'ls /a', value: 'scan every key', tone: 'warn' },
            { text: 'rename /a/b to /a/x', value: 'rewrite N keys', tone: 'bad' },
          ],
          footer: { text: 'Directories must be first-class objects', tone: 'bad' },
        },
        caption: 'Paths as strings hide the structure',
      },
      code: {
        language: 'python',
        title: 'The flat version',
        source: `fs = {
    "/a/b/c.txt": "hello",
    "/a/b/d.txt": "world",
    "/a/e/f.txt": "foo",
}

def ls(path):
    # scans every key, and "/a/b" also matches "/a/bc/x"
    return [k for k in fs if k.startswith(path)]`,
        highlight: [8, 9],
      },
    },
    {
      title: 'Tree of nodes',
      tag: 'concept',
      heading: 'A tree: directories hold children by name',
      eli5: 'Now the cabinet has real **boxes**. A box can hold toys or other boxes, and each one remembers which box it sits in.',
      body: [
        'Make the structure real. A `File` holds content. A `Directory` holds a dict `children` from name to node. Each node keeps a `parent` link so it can find its way back up.',
        'Looking up one name inside a directory is O(1). Renaming a folder changes one key in one dict, and everything below it moves with it.',
      ],
      keyIdea: 'Model the tree itself: directories are nodes with a name-to-child map, and every node knows its parent.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '2' },
      metricTones: { rename: 'good' },
      scene: {
        nodes: [{ ...node, label: 'Node', sub: 'name, parent' }, file, dir],
        links: [link('file', 'node', 'extends'), link('dir', 'node', 'extends')],
        panel: {
          title: 'Two kinds of node',
          icon: 'Folder',
          rows: [
            { text: 'File', value: 'name, parent, content' },
            { text: 'Directory', value: 'name, parent, children{}' },
            { text: 'rename folder', value: 'one dict key', tone: 'good' },
          ],
        },
        caption: 'Directories are real objects now',
      },
      code: {
        language: 'python',
        title: 'v2: the tree',
        source: `class Node:
    def __init__(self, name, parent=None):
        self.name = name
        self.parent = parent

class File(Node):
    def __init__(self, name, parent=None, content=""):
        super().__init__(name, parent)
        self.content = content

class Directory(Node):
    def __init__(self, name, parent=None):
        super().__init__(name, parent)
        self.children = {}   # name -> Node

    def add(self, node):
        node.parent = self
        self.children[node.name] = node`,
        highlight: [14, 16, 17],
      },
    },
    {
      title: 'Composite',
      tag: 'concept',
      heading: 'Composite: treat a file and a folder the same way',
      eli5: 'Ask any box or toy "how heavy are you?" A toy just says its weight. A box adds up everything inside it. You never need to check which one you asked.',
      body: [
        'The caller wants `size()`. If `Node` is an abstract class with `size()`, a `File` returns its byte count and a `Directory` sums its children. This is the **Composite** pattern.',
        'No `isinstance` checks. The recursion hides in the directory, and the same trick gives `path()` by walking `parent` links up to the root.',
      ],
      keyIdea: 'Composite gives leaves and containers one interface, so callers never ask which kind they hold.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '3' },
      scene: {
        nodes: [{ ...node, sub: 'abstract: size()' }, file, dir, caller],
        links: [link('file', 'node', 'extends'), link('dir', 'node', 'extends'), link('dir', 'node', 'has-a', { style: 'dashed' }), link('caller', 'node', 'uses')],
        flows: [flow(['caller', 'node', 'dir', 'file'], 'size()', 'request'), flow(['file', 'dir', 'caller'], '42 bytes', 'response', 1.8)],
        panel: { title: 'One call, any node', icon: 'Layers', code: 'root.size()\n  = docs.size() + a.txt.size()\n  = (b.txt + c.txt) + 12\n  = 100 + 12' },
        caption: 'Directory.size() recurses into its children',
      },
      code: {
        language: 'python',
        title: 'v3: Composite',
        source: `from abc import ABC, abstractmethod

class Node(ABC):
    def __init__(self, name, parent=None):
        self.name = name
        self.parent = parent

    @abstractmethod
    def size(self) -> int: ...

    def path(self):
        if self.parent is None:
            return "/"
        up = self.parent.path()
        return ("" if up == "/" else up) + "/" + self.name

class File(Node):
    def size(self):
        return len(self.content.encode())

class Directory(Node):
    def size(self):
        return sum(c.size() for c in self.children.values())`,
        highlight: [8, 9, 18, 19, 22, 23],
      },
    },
    {
      title: 'Resolve a path',
      tag: 'concept',
      heading: 'Resolving a path walks the tree one name at a time',
      eli5: 'To find "big-box/red-box/car" you open the big box, then the red box inside it, then pick the car. One name, one step.',
      body: [
        'Users hand us strings like `/a/b/c.txt`. A private `_resolve` splits on `/`, starts at the root and looks up each part in `children`. Each step is O(1), so the whole walk is O(depth).',
        'Two errors matter: a missing name raises `FileNotFoundError`, and walking through a `File` as if it were a folder raises `NotADirectoryError`. Both belong in `_resolve`, once.',
      ],
      keyIdea: 'One private resolver turns a path into a node, so every public operation shares the same walk and the same errors.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '4' },
      scene: {
        nodes: [fs, { ...root, status: 'active' }, { id: 'a', kind: 'block', at: at(4, -3.8), label: 'a', sub: 'Directory', icon: 'Folder', tint: 'green' }, { id: 'c', kind: 'block', at: at(0, 3.4), label: 'c.txt', sub: 'File', icon: 'File', tint: 'green' }],
        links: [link('fs', 'root', 'has-a'), link('root', 'a', 'children["a"]'), link('a', 'c', 'children["c.txt"]')],
        flows: [flow(['fs', 'root', 'a', 'c'], '_resolve("/a/c.txt")', 'request')],
        panel: { title: 'Walk for /a/c.txt', icon: 'Route', rows: [{ text: 'parts', value: '["a", "c.txt"]' }, { text: 'root.children["a"]', value: 'Directory', tone: 'good' }, { text: 'a.children["c.txt"]', value: 'File', tone: 'good' }, { text: 'missing name', value: 'FileNotFoundError', tone: 'bad' }] },
        caption: 'Split, then look up each name',
      },
      code: {
        language: 'python',
        title: 'The resolver',
        source: `class FileSystem:
    def __init__(self):
        self.root = Directory("")

    def _resolve(self, path):
        node = self.root
        for part in [p for p in path.split("/") if p]:
            if not isinstance(node, Directory):
                raise NotADirectoryError(node.name)
            if part not in node.children:
                raise FileNotFoundError(path)
            node = node.children[part]
        return node`,
        highlight: [7, 8, 10, 11],
      },
    },
    {
      title: 'Core operations',
      tag: 'concept',
      heading: 'mkdir, write, read and ls sit on top of the resolver',
      eli5: 'A **FileSystem** is the person at the front of the cabinet. You tell them "put this toy in the red box" and they do the walking for you.',
      body: [
        'The `FileSystem` class is a facade over the root. `mkdir` with parents creates each missing folder along the path. `write` creates the file or replaces its content. `ls` returns sorted child names.',
        'Decide the rules up front and say them out loud: writing over a directory is an error, `mkdir` on an existing folder is a no-op, and names cannot contain `/`.',
      ],
      keyIdea: 'Public operations stay thin: resolve the parent, then act on one directory.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '7' },
      scene: {
        nodes: [caller, { ...fs, at: at(0, -3.8), status: 'active' }, { ...root, at: at(4, -3.8) }],
        links: [link('caller', 'fs', 'uses'), link('fs', 'root', 'has-a')],
        flows: [flow(['caller', 'fs'], 'mkdir("/a/b")', 'request'), flow(['fs', 'root'], 'add(Directory)', 'request', 1.5), flow(['root', 'fs', 'caller'], 'ok', 'response', 3)],
        panel: { title: 'Public API', icon: 'List', rows: [{ text: 'mkdir(path)', value: 'create parents' }, { text: 'write(path, text)', value: 'create or replace' }, { text: 'read(path)', value: 'content' }, { text: 'ls(path)', value: 'sorted names' }] },
        caption: 'The facade owns the root',
      },
      code: {
        language: 'python',
        title: 'FileSystem operations',
        source: `    def mkdir(self, path):
        node = self.root
        for part in [p for p in path.split("/") if p]:
            if part not in node.children:
                node.add(Directory(part))
            node = node.children[part]
            if not isinstance(node, Directory):
                raise NotADirectoryError(part)

    def write(self, path, text):
        parent_path, _, name = path.rpartition("/")
        parent = self._resolve(parent_path)
        if not isinstance(parent, Directory):
            raise NotADirectoryError(parent_path)
        old = parent.children.get(name)
        if isinstance(old, Directory):
            raise IsADirectoryError(path)
        if old:
            old.content = text
        else:
            parent.add(File(name, content=text))

    def read(self, path):
        return self._resolve(path).content

    def ls(self, path):
        return sorted(self._resolve(path).children)`,
        highlight: [4, 5, 7, 8, 13, 14, 16, 17],
      },
    },
    {
      title: 'Move and rename',
      tag: 'case',
      heading: 'Moving a node is two dict edits, plus one guard',
      eli5: 'To move a box you lift it out of one big box and drop it into another. Everything inside comes along, and you never touch the toys.',
      body: [
        '`mv(src, dst)` removes the node from its old parent, sets a new name and parent, and adds it to the new directory. Nothing below it is touched, so a move is O(1) plus two resolves.',
        'The guard: moving `/a` into `/a/b/c` would make a folder its own descendant and cut it off from the root. Walk up from the target with `parent` and refuse if you meet the source.',
      ],
      keyIdea: 'A move rewires one link. Check that the destination is not inside the source before you do it.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '8' },
      scene: {
        nodes: [{ ...fs, status: 'active' }, { ...root, at: at(0, -3.8) }, { ...dir, id: 'src', at: at(-4, 3.4), label: 'a', sub: 'moving' }, { ...dir, id: 'dst', at: at(4, 3.4), label: 'x', sub: 'new parent' }],
        links: [link('fs', 'root', 'has-a'), link('root', 'src', 'children'), link('root', 'dst', 'children')],
        flows: [flow(['fs', 'root', 'src'], 'detach', 'request'), flow(['src', 'dst'], 'move: re-parent', 'data', 1.6)],
        panel: { title: 'Guard against cycles', icon: 'ShieldAlert', rows: [{ text: 'mv /a /x', value: 'ok', tone: 'good' }, { text: 'mv /a /a/b', value: 'ValueError', tone: 'bad' }, { text: 'name already in /x', value: 'FileExistsError', tone: 'warn' }] },
        caption: 'The subtree travels as one piece',
      },
      code: {
        language: 'python',
        title: 'mv with a cycle check',
        source: `    def mv(self, src, dst_dir, new_name=None):
        node = self._resolve(src)
        target = self._resolve(dst_dir)
        up = target
        while up is not None:          # walk to the root
            if up is node:
                raise ValueError("cannot move into itself")
            up = up.parent
        if (new_name or node.name) in target.children:
            raise FileExistsError(new_name or node.name)
        del node.parent.children[node.name]
        node.name = new_name or node.name
        target.add(node)`,
        highlight: [4, 5, 6, 7, 10, 12],
      },
    },
    {
      title: 'Copy and delete',
      tag: 'case',
      heading: 'Copy duplicates the subtree, delete just drops one link',
      eli5: 'Copying a box means making new toys for every toy inside it. Throwing a box away is easy: you stop pointing at it, and everything inside goes with it.',
      body: [
        '`cp` must be a **deep copy** that recurses through children, so the new tree shares nothing with the old one. It is O(size of the subtree). Reusing the same node objects would make an edit to one copy show up in the other.',
        '`rm` removes one entry from the parent dict. Python frees the rest when nothing points at it. Refuse to delete the root, and make non-empty folders need a recursive flag.',
      ],
      keyIdea: 'Copy walks the whole subtree to build new nodes. Delete cuts one reference and lets garbage collection do the rest.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '10' },
      scene: {
        nodes: [{ ...fs, status: 'active' }, { ...dir, id: 'orig', at: at(-4, 3.4), label: 'docs', sub: 'original' }, { ...dir, id: 'copy', at: at(4, 3.4), label: 'docs-copy', sub: 'new objects', status: 'ok' }, { ...root, at: at(0, -3.8) }],
        links: [link('fs', 'root', 'has-a'), link('root', 'orig', 'children'), link('root', 'copy', 'creates')],
        flows: [flow(['orig', 'copy'], 'clone() each child', 'data'), flow(['fs', 'root'], 'rm: del children[name]', 'request', 1.6)],
        panel: { title: 'Cost', icon: 'Table', rows: [{ text: 'cp subtree of k nodes', value: 'O(k)', tone: 'warn' }, { text: 'rm anything', value: 'O(1) unlink', tone: 'good' }, { text: 'rm non-empty dir', value: 'needs recursive=True', tone: 'warn' }] },
        caption: 'Copy builds new nodes, delete drops one link',
      },
      code: {
        language: 'python',
        title: 'Deep copy as a Node method',
        source: `class File(Node):
    def clone(self):
        return File(self.name, content=self.content)

class Directory(Node):
    def clone(self):
        copy = Directory(self.name)
        for child in self.children.values():
            copy.add(child.clone())
        return copy

# FileSystem methods
    def rm(self, path, recursive=False):
        node = self._resolve(path)
        if node.parent is None:
            raise ValueError("cannot remove root")
        if isinstance(node, Directory) and node.children and not recursive:
            raise OSError("directory not empty")
        del node.parent.children[node.name]

    def cp(self, src, dst_dir):
        node = self._resolve(src)
        target = self._resolve(dst_dir)
        if node.name in target.children:
            raise FileExistsError(node.name)
        target.add(node.clone())`,
        highlight: [7, 8, 9],
      },
    },
    {
      title: 'Check: tree',
      tag: 'tradeoff',
      heading: 'Flat dict or tree?',
      eli5: 'A pile of labeled toys is quick to build but a mess to tidy. Boxes inside boxes take a little more setup and then stay tidy forever.',
      body: [
        'The dict is simple for exact lookups and nothing else. The tree costs a few classes and pays back on rename, listing, size and empty folders.',
        'The deeper win is Composite: one interface over leaves and containers, so new operations do not start with `if isinstance`.',
      ],
      keyIdea: 'Pay for the tree once and every directory operation gets cheaper and clearer.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '10' },
      metricTones: { rename: 'good' },
      scene: {
        nodes: [{ ...flat, at: at(-4, -3.8), status: 'dim' }, { ...node, at: at(4, -3.8), sub: 'Composite tree', status: 'ok' }, { ...file, at: at(0, 3.4) }],
        links: [link('node', 'file', 'has-a', { style: 'dashed' })],
        panel: { title: 'Dict versus tree', icon: 'Scale', rows: [{ text: 'rename a folder', value: 'O(N) vs O(1)' }, { text: 'empty directory', value: 'no vs yes' }, { text: 'ls one folder', value: 'O(N) vs O(k)' }, { text: 'size of folder', value: 'scan vs recurse' }] },
        caption: 'Same data, different shape',
      },
      quiz: {
        question: 'Why does renaming a folder cost O(1) in the tree but O(N) in the flat dict?',
        options: [
          'The tree stores names in a faster hash function',
          'Only one key in one parent dict changes, and the children move with their parent',
          'The tree keeps a cache of every path',
          'Renaming in a tree is lazy and happens later',
        ],
        answer: 1,
        explain: 'In the tree each file is reached through its parent, so changing the folder name edits one entry. In the dict, every path string contains the folder name and must be rewritten.',
      },
    },
    {
      title: 'Op sprawl',
      tag: 'problem',
      heading: 'Every new feature wants to live inside the node classes',
      eli5: 'Every time someone wants a new question answered, like "which toys are red?", you would have to teach every single box and toy how to answer it.',
      body: [
        'Product asks for content search, disk usage per folder, a listing with sizes, a JSON export. Each is a recursive walk. Adding them as methods on `File` and `Directory` bloats both classes.',
        'Worse, each new operation edits every node class. That breaks the **open/closed principle**: you change tested code just to add something that is not about nodes at all.',
      ],
      keyIdea: 'Operations that walk the tree should live outside the node classes, or every feature edits the model.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '10 and growing' },
      metricTones: { ops: 'warn' },
      scene: {
        nodes: [{ ...file, at: at(-4, 3.4), status: 'hot', chips: ['search()', 'usage()', 'to_json()'] }, { ...dir, at: at(4, 3.4), status: 'hot', chips: ['search()', 'usage()', 'to_json()'] }, { ...node, at: at(0, -3.8), sub: 'abstract: grows' }],
        links: [link('file', 'node', 'extends'), link('dir', 'node', 'extends')],
        panel: { title: 'One new operation touches', icon: 'AlertTriangle', rows: [{ text: 'Node', value: 'add abstract method', tone: 'warn' }, { text: 'File', value: 'implement it', tone: 'warn' }, { text: 'Directory', value: 'implement it', tone: 'warn' }] },
        caption: 'Node classes swell with every feature',
      },
    },
    {
      title: 'Visitor',
      tag: 'concept',
      heading: 'Visitor: one accept() hook, any number of operations',
      eli5: 'Instead of teaching every box new tricks, you let a **visitor** walk through the cabinet. Each box just says "come in" and tells the visitor whether it is a toy or a box.',
      body: [
        'Give `Node` one method, `accept(visitor)`. A `File` calls `visitor.visit_file(self)`. A `Directory` calls `visitor.visit_directory(self)` and then lets each child accept the same visitor.',
        'The node picks which `visit_` method runs, and the visitor picks what it does. Adding an operation is a new `Visitor` class. The nodes stay untouched.',
      ],
      keyIdea: 'accept() is added once. After that, new operations are new visitor classes and the node classes never change.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '10 and growing' },
      scene: {
        nodes: [{ ...visitor, at: at(4, -3.8), status: 'active' }, { ...dir, at: at(-4, 3.4), sub: 'accept() recurses' }, { ...file, at: at(4, 3.4), sub: 'accept() calls visit_file' }],
        links: [link('dir', 'visitor', 'uses'), link('file', 'visitor', 'uses')],
        flows: [flow(['dir', 'visitor'], 'visit_directory(d)', 'request'), flow(['dir', 'file', 'visitor'], 'child.accept(v)', 'request', 1.6)],
        panel: { title: 'Who decides what', icon: 'Split', rows: [{ text: 'Node', value: 'which visit_ method' }, { text: 'Visitor', value: 'what to do there' }] },
        caption: 'The node routes, the visitor works',
      },
      code: {
        language: 'python',
        title: 'v4: accept and the Visitor interface',
        source: `class Visitor(ABC):
    @abstractmethod
    def visit_file(self, f): ...
    @abstractmethod
    def visit_directory(self, d): ...

class File(Node):
    def accept(self, v):
        v.visit_file(self)

class Directory(Node):
    def accept(self, v):
        v.visit_directory(self)
        for child in self.children.values():
            child.accept(v)`,
        highlight: [8, 9, 12, 13, 14, 15],
      },
    },
    {
      title: 'Two visitors',
      tag: 'case',
      heading: 'Search and disk usage as visitors',
      eli5: 'One visitor goes through the cabinet looking for red toys and writes down where he found them. Another just weighs each box. Same walk, different notebook.',
      body: [
        'A `SearchVisitor` keeps a `hits` list. In `visit_file` it checks the content for the query and records `f.path()`. `visit_directory` does nothing.',
        'A `DiskUsageVisitor` ignores files and records `d.size()` for each directory in a dict. The two share no code and neither touched `File` or `Directory`. The visitor holds its own state.',
      ],
      keyIdea: 'Each operation is a small class holding its own result, and the same traversal serves all of them.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '12' },
      scene: {
        nodes: [{ ...visitor, at: at(0, -3.8) }, { id: 'search', kind: 'block', at: at(-4, 3.4), label: 'SearchVisitor', sub: 'hits: list', icon: 'Search', tint: 'green' }, { id: 'usage', kind: 'block', at: at(4, 3.4), label: 'DiskUsage', sub: 'by_dir: dict', icon: 'PieChart', tint: 'green' }],
        links: [link('search', 'visitor', 'implements'), link('usage', 'visitor', 'implements')],
        flows: [flow(['visitor', 'search'], 'visit_file(f)', 'request'), flow(['visitor', 'usage'], 'visit_directory(d)', 'request', 1.6)],
        panel: { title: 'Result after one walk', icon: 'Table', rows: [{ text: 'hits', value: '["/a/b/c.txt"]', tone: 'good' }, { text: 'by_dir["/a"]', value: '112 bytes' }, { text: 'by_dir["/a/b"]', value: '100 bytes' }] },
        caption: 'Same traversal, different notebook',
      },
      code: {
        language: 'python',
        title: 'Two concrete visitors',
        source: `class SearchVisitor(Visitor):
    def __init__(self, query):
        self.query = query
        self.hits = []

    def visit_file(self, f):
        if self.query in f.content:
            self.hits.append(f.path())

    def visit_directory(self, d):
        pass

class DiskUsageVisitor(Visitor):
    def __init__(self):
        self.by_dir = {}

    def visit_file(self, f):
        pass

    def visit_directory(self, d):
        self.by_dir[d.path()] = d.size()`,
        highlight: [6, 7, 8, 21],
      },
    },
    {
      title: 'Visitor cost',
      tag: 'tradeoff',
      heading: 'Visitor makes one change easy and another hard',
      eli5: 'It is easy to add a new visitor with a new job. It is hard to add a new kind of thing, like a magic box, because every visitor needs a new "what do I do here" rule.',
      body: [
        'Adding an operation is cheap: write one class. Adding a **node type**, such as `Symlink`, means a new `visit_symlink` in the interface and in every existing visitor.',
        'Pick by what changes more. Node types are stable here (file, folder, link) and operations keep coming, so Visitor fits. If the node types change often, plain methods on the nodes are the better choice.',
      ],
      keyIdea: 'Visitor optimizes for adding operations and pays for it when adding node types.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2 to 3', ops: '12' },
      scene: {
        nodes: [{ ...visitor, at: at(0, -3.8) }, { id: 'v1', kind: 'block', at: at(-4, 3.4), label: 'Search', sub: 'visit_symlink?', icon: 'Search', tint: 'amber', status: 'hot' }, { id: 'v2', kind: 'block', at: at(4, 3.4), label: 'DiskUsage', sub: 'visit_symlink?', icon: 'PieChart', tint: 'amber', status: 'hot' }],
        links: [link('v1', 'visitor', 'implements'), link('v2', 'visitor', 'implements')],
        panel: { title: 'What changes more?', icon: 'Scale', rows: [{ text: 'New operation', value: 'one new class', tone: 'good' }, { text: 'New node type', value: 'edit every visitor', tone: 'bad' }] },
        caption: 'A new node type ripples through all visitors',
      },
    },
    {
      title: 'Permissions',
      tag: 'concept',
      heading: 'Permissions: an owner, a mode and a check before access',
      eli5: 'Some boxes have a sticker saying who may open them. Before you open one, the front desk looks at the sticker and your name.',
      body: [
        'Give each `Node` an `ACL` with an `owner`, a `mode` such as `0o600` and optional per-user extras. `can_read(user)` and `can_write(user)` decide.',
        'Check at the `FileSystem` boundary, not inside nodes, so the model stays simple and every public call goes through one gate. A fuller resolver would also check execute permission on each folder along the path. This sketch leaves that out.',
      ],
      keyIdea: 'Keep permission data on the node and the decision in one check at the entry point.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '2', ops: '14' },
      scene: {
        nodes: [{ ...caller, sub: 'user: sam' }, { ...fs, at: at(0, -3.8), status: 'active' }, { id: 'acl', kind: 'block', at: at(4, -3.8), label: 'ACL', sub: 'owner, mode', icon: 'Lock', tint: 'violet' }, { ...file, at: at(0, 3.4), chips: ['0o600 owner=amy'] }],
        links: [link('caller', 'fs', 'uses'), link('file', 'acl', 'has-a'), link('fs', 'acl', 'uses')],
        flows: [flow(['caller', 'fs'], 'read("/a/c.txt")', 'request'), flow(['fs', 'acl'], 'can_read("sam")', 'request', 1.5), flow(['acl', 'fs', 'caller'], 'PermissionError', 'error', 3)],
        panel: { title: 'Mode 0o600', icon: 'Lock', rows: [{ text: 'owner amy', value: 'read, write', tone: 'good' }, { text: 'extra: bob', value: 'read', tone: 'good' }, { text: 'others (sam)', value: 'none', tone: 'bad' }] },
        caption: 'One gate checks the ACL before the read',
      },
      code: {
        language: 'python',
        title: 'v5: ACL and the gate',
        source: `from dataclasses import dataclass, field

@dataclass
class ACL:
    owner: str
    mode: int = 0o644
    extra: dict = field(default_factory=dict)  # user -> mask

    def can_read(self, user):
        if user == self.owner:
            return bool(self.mode & 0o400)
        return bool(self.extra.get(user, self.mode & 0o004) & 0o4)

# in Node.__init__, after self.parent = parent:
#     self.acl = ACL(owner="root")

class FileSystem:
    def read(self, path, user):
        node = self._resolve(path)
        if not node.acl.can_read(user):
            raise PermissionError(path)
        return node.content`,
        highlight: [9, 10, 11, 15, 20, 21],
      },
    },
    {
      title: 'Symlinks',
      tag: 'concept',
      heading: 'Symbolic links: a node that points at a path',
      eli5: 'A symlink is a note in one box that says "the toy you want is in the red box". You follow the note to find it.',
      body: [
        'A `Symlink` is a third node type. It stores a `target_path` string, not a reference, so it can point at something that does not exist yet. Its `size()` is the length of that string. It gets `accept()` calling `visit_symlink`: `SearchVisitor` skips links and `DiskUsageVisitor` counts the link text length.',
        '`_resolve` now follows links as it walks. When a part of the path is a symlink, restart resolution from its target and carry on with the remaining parts.',
      ],
      keyIdea: 'A symlink stores a path and the resolver follows it mid-walk, so links can dangle and can point anywhere.',
      metrics: { rename: 'O(1)', lookup: 'O(depth + links)', types: '3', ops: '15' },
      scene: {
        nodes: [{ ...node, at: at(0, -3.8) }, { id: 'sym', kind: 'block', at: at(-4, 3.4), label: 'Symlink', sub: 'target_path', icon: 'Link', tint: 'green', status: 'active' }, { ...file, at: at(4, 3.4), sub: '/docs/a.txt' }],
        links: [link('sym', 'node', 'extends'), link('file', 'node', 'extends'), link('sym', 'file', 'points to', { style: 'dashed' })],
        flows: [flow(['sym', 'file'], 'resolve(target_path)', 'request')],
        panel: { title: 'A link is just text', icon: 'Link', rows: [{ text: '/home/me/a', value: '-> /docs/a.txt' }, { text: 'size()', value: 'len("/docs/a.txt") = 11' }, { text: 'target deleted', value: 'dangling', tone: 'warn' }] },
        caption: 'The link stores a path, not an object',
      },
    },
    {
      title: 'Loop guard',
      tag: 'case',
      heading: 'Links can loop, so count the hops',
      eli5: 'If note A says "see note B" and note B says "see note A", you would walk in circles forever. So you give up after a fixed number of notes.',
      body: [
        '`/a` links to `/b` and `/b` links to `/a`. Without a guard, `_resolve` recurses until the stack blows. Pass a `depth` counter and raise `OSError` past a limit. Linux uses 40 and reports `ELOOP`.',
        'A counter is simpler than a visited set and catches long chains too. Also decide whether the final part follows the link: `read` follows it, while `rm` calls `_resolve(path, follow=False)` so it removes the link itself.',
      ],
      keyIdea: 'Bound the number of symlink hops. Mention it before the interviewer asks.',
      metrics: { rename: 'O(1)', lookup: 'O(depth + 40)', types: '3', ops: '15' },
      metricTones: { lookup: 'warn' },
      scene: {
        nodes: [{ id: 'la', kind: 'block', at: at(-4, 0), label: '/a', sub: 'Symlink', icon: 'Link', tint: 'green', status: 'hot' }, { id: 'lb', kind: 'block', at: at(4, 0), label: '/b', sub: 'Symlink', icon: 'Link', tint: 'green', status: 'hot' }, { ...fs, at: at(0, -4) }],
        links: [link('la', 'lb', 'points to', { labelTone: 'warn' }), link('lb', 'la', 'points to', { labelTone: 'warn' })],
        flows: [flow(['fs', 'la', 'lb', 'la'], 'resolve("/a")', 'request'), flow(['la', 'fs'], 'OSError: too many links', 'error', 2.5)],
        panel: { title: 'Depth counter', icon: 'Repeat', rows: [{ text: 'hop 1', value: '/a to /b' }, { text: 'hop 2', value: '/b to /a' }, { text: 'hop 41', value: 'OSError', tone: 'bad' }, { text: 'rm and lstat', value: 'use follow=False' }] },
        caption: 'Stop at 40 hops',
      },
      code: {
        language: 'python',
        title: 'v6: resolve with loop detection',
        source: `class Symlink(Node):
    def __init__(self, name, target_path, parent=None):
        super().__init__(name, parent)
        self.target_path = target_path

    def size(self):
        return len(self.target_path)

    def accept(self, v):
        v.visit_symlink(self)

class FileSystem:
    def _resolve(self, path, follow=True, depth=0):
        if depth > 40:
            raise OSError("too many levels of symbolic links")
        parts = [p for p in path.split("/") if p]
        node = self.root
        for i, part in enumerate(parts):
            if not isinstance(node, Directory):
                raise NotADirectoryError(node.name)
            if part not in node.children:
                raise FileNotFoundError(path)
            node = node.children[part]
            last = i == len(parts) - 1
            if isinstance(node, Symlink) and (follow or not last):
                node = self._resolve(node.target_path, True, depth + 1)
        return node

# rm and lstat call self._resolve(path, follow=False)`,
        highlight: [9, 10, 14, 15, 25, 26],
      },
    },
    {
      title: 'Edge cases',
      tag: 'tradeoff',
      heading: 'What a complete answer also mentions',
      eli5: 'Two kids reaching into the same box at the same time can grab the same toy. The grown-up lets one kid in at a time.',
      body: [
        '**Threads:** two writers on one directory can corrupt `children`. A single lock on the `FileSystem` is the simple fix. A lock per directory scales better but needs a fixed lock order for `mv`, or two moves can deadlock.',
        '**Smaller points:** names cannot be empty, `.` or contain `/`. Support `.` and `..` in paths by popping the walk. Hard links need a reference count. A `mtime` field fits on `Node`. Glob search is one more visitor.',
      ],
      keyIdea: 'Name the open edges: concurrency, name rules, relative paths, hard links. Naming them shows the model is ready for them.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '3', ops: '15+' },
      scene: {
        nodes: [{ id: 't1', kind: 'worker', at: at(-4, -3.8), label: 'Thread 1', sub: 'mv /a /x' }, { id: 't2', kind: 'worker', at: at(-4, 3), label: 'Thread 2', sub: 'write /a/f' }, { id: 'shared', kind: 'block', at: at(0, 0), label: 'children{}', sub: 'shared state', icon: 'Layers', tint: 'amber', status: 'hot', load: 88 }, { id: 'lock', kind: 'vault', at: at(4, 0), label: 'Lock', sub: 'one RLock' }],
        links: [link('t1', 'shared', 'writes', { labelTone: 'warn' }), link('t2', 'shared', 'writes', { labelTone: 'warn' }), link('shared', 'lock', 'guarded by')],
        flows: [flow(['t1', 'shared', 'lock'], 'acquire', 'request'), flow(['t2', 'shared'], 'waits', 'error', 1.5)],
        panel: { title: 'Lock choices', icon: 'Lock', rows: [{ text: 'one global lock', value: 'simple, serial', tone: 'warn' }, { text: 'lock per directory', value: 'parallel, needs order', tone: 'warn' }, { text: 'read-write lock', value: 'many readers', tone: 'good' }] },
        caption: 'Shared children need a lock',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The model from flat dict to Composite, Visitor and links',
      eli5: 'We went from a pile of labeled toys to boxes inside boxes. Every box answers the same questions, visitors do the looking around, and notes can point to other boxes.',
      body: [
        '**Tree** beats the dict: real directories, O(1) rename. **Composite** gives `size()` and `path()` on any node. A private `_resolve` handles every path.',
        '**Visitor** adds search and usage without touching nodes, at the cost of hard new node types. ACLs gate access at one entry point. Symlinks store paths and need a hop limit.',
      ],
      keyIdea: 'Composite for the structure, Visitor for the operations, one resolver, one permission gate, one loop guard.',
      metrics: { rename: 'O(1)', lookup: 'O(depth)', types: '3', ops: '15+' },
      metricTones: { rename: 'good', lookup: 'good' },
      scene: {
        nodes: [{ ...node, at: at(0, -3.8), status: 'ok' }, { ...file, at: at(-4, 3.4) }, { ...dir, at: at(0, 3.4) }, { id: 'sym', kind: 'block', at: at(4, 3.4), label: 'Symlink', sub: 'concrete: target', icon: 'Link', tint: 'green' }, { ...visitor, at: at(4, -3.8) }],
        links: [link('file', 'node', 'extends'), link('dir', 'node', 'extends'), link('sym', 'node', 'extends'), link('node', 'visitor', 'accepts', { style: 'dashed' })],
        panel: { title: 'The finished model', icon: 'CheckCircle', rows: [{ text: 'Node', value: 'Composite root', tone: 'good' }, { text: 'Visitor', value: 'search, usage', tone: 'good' }, { text: 'ACL', value: 'owner + mode', tone: 'good' }, { text: 'Symlink', value: 'path, 40 hops', tone: 'good' }] },
        caption: 'Four ideas, one small model',
      },
      quiz: {
        question: 'Node types are stable, but product keeps asking for new tree operations. What does the Visitor pattern give you?',
        options: [
          'Each new operation is one new class and no node class changes',
          'Each new operation must be added to File and Directory',
          'Faster O(1) traversal of the whole tree',
          'Automatic protection against symlink loops',
        ],
        answer: 0,
        explain: 'With accept() in place, an operation is a Visitor subclass. Nodes stay closed for change. The price is paid when a new node type appears, because every visitor needs a method for it.',
      },
    },
  ],
};
