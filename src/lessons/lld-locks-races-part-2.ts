import type { Lesson, SceneFlow, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });
const flow = (path: string[], label: string, tone: SceneFlow['tone'], delay = 0, duration = 1.4): SceneFlow => ({ path, tone, label, delay, duration });

// Two threads on top, two locks below: a 2 by 2 grid so cross links stay readable.
const t1: SceneNode = { id: 't1', kind: 'worker', at: at(-3.6, -3.2), label: 'Thread 1', sub: 'a kid in class' };
const t2: SceneNode = { id: 't2', kind: 'worker', at: at(3.6, -3.2), label: 'Thread 2', sub: 'another kid' };
const la: SceneNode = { id: 'la', kind: 'vault', at: at(-3.6, 3.4), label: 'lock_a', sub: 'red marker' };
const lb: SceneNode = { id: 'lb', kind: 'vault', at: at(3.6, 3.4), label: 'lock_b', sub: 'blue marker' };

// Shared state for the lock granularity steps.
const catalog: SceneNode = { id: 'catalog', kind: 'block', at: at(0, 0), label: 'ProductCatalog', sub: 'dict of items', icon: 'Package', tint: 'green' };
const ra: SceneNode = { id: 'ra', kind: 'worker', at: at(-6.4, -2.4), label: 'Thread A', sub: 'update_stock' };
const rb: SceneNode = { id: 'rb', kind: 'worker', at: at(-3.4, 2.6), label: 'Thread B', sub: 'update_stock' };

export const lldLocksRacesPart2: Lesson = {
  id: 'lld-locks-races-part-2',
  title: 'Locks and races (part 2)',
  tagline: 'Deadlock and how to prevent it, how coarse or fine a lock should be, the classic concurrency bugs, and designs that need fewer locks.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'The four Coffman conditions and the three ways to break them: lock ordering, timeouts and hierarchical locks',
    'Coarse, per-entry and striped locking, and what each one costs',
    'Lost update, double-read, broken double-checked locking, ABA and memory visibility',
    'Immutable objects, thread confinement and message passing',
    'A checklist for concurrency in a low level design interview',
  ],
  metrics: [
    { key: 'state', label: 'Program', icon: 'Activity' },
    { key: 'safe', label: 'Thread-safe', icon: 'Shield' },
    { key: 'cost', label: 'Cost', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Hung program',
      tag: 'problem',
      heading: 'Two threads, two locks, and a program that never finishes',
      eli5: 'Two kids each hold one marker and each wants the other kid\'s marker too. Neither will give theirs up first, so both stand there forever, markers in hand.',
      body: [
        'Part 1 fixed races with locks. Locks bring a new failure. `t1` takes `lock_a` and then waits for `lock_b`. `t2` takes `lock_b` and then waits for `lock_a`.',
        'Nothing crashes and no error is raised. Both threads sleep forever and the program hangs. This is **deadlock**.',
      ],
      keyIdea: 'Deadlock is two or more threads each waiting for a lock another one holds. Nothing throws, the program just stops.',
      metrics: { state: 'hung', safe: 'yes', cost: 'no progress' },
      metricTones: { state: 'bad', cost: 'bad' },
      scene: {
        nodes: [
          { ...t1, status: 'hot', chips: [{ text: 'holds lock_a', tone: 'good' }, { text: 'wants lock_b', tone: 'bad' }] },
          { ...t2, status: 'hot', chips: [{ text: 'holds lock_b', tone: 'good' }, { text: 'wants lock_a', tone: 'bad' }] },
          { ...la, status: 'down' },
          { ...lb, status: 'down' },
        ],
        links: [link('t1', 'la', 'holds'), link('t2', 'lb', 'holds'), link('t1', 'lb', 'waits', { labelTone: 'bad' }), link('t2', 'la', 'waits', { labelTone: 'bad' })],
        flows: [flow(['t1', 'lb'], 'acquire()', 'error', 0, 1.8), flow(['t2', 'la'], 'acquire()', 'error', 0.4, 1.8)],
        panel: {
          title: 'Who waits for whom',
          icon: 'Bug',
          rows: [
            { text: 'Thread 1', value: 'holds A, wants B', tone: 'warn' },
            { text: 'Thread 2', value: 'holds B, wants A', tone: 'warn' },
            { text: 'Result', value: 'both wait forever', tone: 'bad' },
          ],
          footer: { text: 'No exception, no timeout, no log line', tone: 'bad' },
        },
        caption: 'A cycle of waiting',
      },
    },
    {
      title: 'Four conditions',
      tag: 'concept',
      heading: 'Deadlock needs four things at once',
      eli5: 'Kids freeze like this only when four things are true: one marker per kid, holding while asking, no grabbing, and a circle of asking. Remove any one and the class moves again.',
      body: [
        'Deadlock needs all four **Coffman conditions** to hold at the same time: **mutual exclusion**, **hold and wait**, **no preemption** and **circular wait**.',
        'That gives a clear plan. Break any one condition and deadlock becomes impossible. The next steps break them in three different ways.',
      ],
      keyIdea: 'Four conditions must all hold for a deadlock. Remove one and it cannot happen.',
      metrics: { state: 'analysis', safe: 'yes', cost: '-' },
      scene: {
        nodes: [
          { ...t1, status: 'hot' },
          { ...t2, status: 'hot' },
          { ...la, status: 'down' },
          { ...lb, status: 'down' },
        ],
        links: [link('t1', 'la', 'held'), link('t2', 'lb', 'held'), link('t1', 'lb', 'wait'), link('t2', 'la', 'wait')],
        flows: [flow(['t1', 'lb', 't2', 'la', 't1'], 'cycle', 'error', 0, 3)],
        panel: {
          title: 'Coffman conditions',
          icon: 'Table',
          rows: [
            { text: 'Mutual exclusion', value: 'one holder per lock' },
            { text: 'Hold and wait', value: 'holds one, waits for another' },
            { text: 'No preemption', value: 'only released voluntarily' },
            { text: 'Circular wait', value: 'a cycle in the wait-for graph' },
          ],
          footer: { text: 'All four together cause deadlock', tone: 'warn' },
        },
        caption: 'All four at once',
      },
    },
    {
      title: 'Three fixes',
      tag: 'concept',
      heading: 'Each prevention strategy breaks one condition',
      eli5: 'A class has three ways to unfreeze: everyone asks for markers in the same order, a kid gives up after waiting a while, or markers are numbered and you only ask for a bigger number.',
      body: [
        '**Lock ordering** and **hierarchical locking** break circular wait. **Timeouts** break no preemption, because a thread gives up and releases what it holds.',
        'Mutual exclusion is the reason for a lock, so it stays. The same code can use more than one strategy.',
      ],
      keyIdea: 'Pick the condition you can break cheaply: order the locks, add timeouts, or enforce levels.',
      metrics: { state: 'fixable', safe: 'yes', cost: 'small' },
      metricTones: { state: 'good' },
      scene: {
        nodes: [
          { id: 'dead', kind: 'block', at: at(-6.4, -2.4), label: 'Deadlock', sub: 'four conditions', icon: 'Bug', tint: 'red' },
          { id: 'ord', kind: 'block', at: at(0, -3.2), label: 'Lock ordering', sub: 'breaks circular wait', icon: 'List', tint: 'green' },
          { id: 'tmo', kind: 'block', at: at(3.4, 2.6), label: 'Timeouts', sub: 'breaks no preemption', icon: 'Timer', tint: 'green' },
          { id: 'hie', kind: 'block', at: at(-3.4, 3.6), label: 'Hierarchy', sub: 'breaks circular wait', icon: 'Layers', tint: 'green' },
        ],
        links: [link('dead', 'ord', 'prevented by', { labelTone: 'good' }), link('dead', 'tmo', 'prevented by', { labelTone: 'good' }), link('dead', 'hie', 'prevented by', { labelTone: 'good' })],
        flows: [flow(['dead', 'ord'], 'order', 'response', 0), flow(['dead', 'hie'], 'levels', 'response', 0.6), flow(['dead', 'tmo'], 'give up', 'response', 1.2)],
        panel: {
          title: 'Strategy and condition',
          icon: 'Shield',
          rows: [
            { text: 'Lock ordering', value: 'circular wait', tone: 'good' },
            { text: 'Hierarchical locks', value: 'circular wait', tone: 'good' },
            { text: 'Timeouts', value: 'no preemption', tone: 'good' },
          ],
        },
        caption: 'Break one condition',
      },
    },
    {
      title: 'Lock ordering',
      tag: 'concept',
      heading: 'Lock ordering: everyone takes the locks in the same order',
      eli5: 'The teacher says: always take the red marker first, then the blue one. Now no kid can hold blue while waiting for red, so no circle can form.',
      body: [
        'Pick a global order for the locks and never break it. If `t2` also takes `lock_a` before `lock_b`, it simply waits for `t1` to finish. Nobody holds B while waiting for A.',
        'The cycle cannot form, so deadlock cannot happen.',
      ],
      keyIdea: 'A fixed global lock order removes circular wait.',
      metrics: { state: 'running', safe: 'yes', cost: 'one rule to follow' },
      metricTones: { state: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...t1, status: 'active', chips: [{ text: 'A then B', tone: 'good' }] },
          { ...t2, status: 'active', chips: [{ text: 'A then B', tone: 'good' }] },
          { ...la, status: 'ok', sub: 'taken first' },
          { ...lb, status: 'ok', sub: 'taken second' },
        ],
        links: [link('t1', 'la', 'acquire 1'), link('t2', 'la', 'acquire 1', { labelTone: 'warn' }), link('la', 'lb', 'then', { style: 'dashed', arrow: 'end' })],
        flows: [flow(['t1', 'la', 'lb'], 'A then B', 'handshake', 0, 2), flow(['t2', 'la'], 'waits for A', 'request', 2.2, 1.4)],
        panel: {
          title: 'Same order',
          icon: 'List',
          code: 'def t1():\n    with lock_a:\n        with lock_b:\n            ...\n\ndef t2():\n    with lock_a:   # was lock_b\n        with lock_b:',
          footer: { text: 'Deadlock needs a cycle. There is none.', tone: 'good' },
        },
        caption: 'Same order, no cycle',
      },
      code: {
        language: 'python',
        title: 'Both threads follow the global order',
        source: `import threading

lock_a = threading.Lock()
lock_b = threading.Lock()

def t1():
    with lock_a:
        with lock_b:
            print("t1 done")

def t2():
    with lock_a:           # was lock_b: forced to match the global order
        with lock_b:
            print("t2 done")`,
        highlight: [13, 14],
      },
    },
    {
      title: 'Order by id',
      tag: 'case',
      heading: 'Case: transfers have no natural order, so make one',
      eli5: 'Two kids swap crayon boxes. If each grabs their own box first, they freeze. So the rule is: always grab the box with the smaller sticker number first.',
      body: [
        'In a transfer from `src` to `dst`, one thread may run `transfer(a, b)` while another runs `transfer(b, a)`. Locking source first then destination deadlocks.',
        'Order by something stable. Compare `id(src)` and `id(dst)`, lock the lower one first, and every transfer agrees on the order.',
      ],
      keyIdea: 'When locks have no natural order, derive one from a stable key such as id().',
      metrics: { state: 'running', safe: 'yes', cost: 'a compare per call' },
      metricTones: { state: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'transfer(a, b)', sub: 'Thread A' },
          { ...rb, at: at(-3.4, 2.6), label: 'transfer(b, a)', sub: 'Thread B' },
          { id: 'acca', kind: 'block', at: at(0, -2.4), label: 'Account a', sub: 'lower id, lock 1st', icon: 'Database', tint: 'green' },
          { id: 'accb', kind: 'block', at: at(3.6, 2.6), label: 'Account b', sub: 'higher id, lock 2nd', icon: 'Database', tint: 'green' },
        ],
        links: [link('ra', 'acca', '1st'), link('ra', 'accb', '2nd'), link('rb', 'acca', '1st', { labelTone: 'warn' })],
        flows: [flow(['ra', 'acca'], 'lock a', 'handshake', 0), flow(['ra', 'accb'], 'lock b', 'handshake', 1.2), flow(['rb', 'acca'], 'waits for a', 'request', 2.4)],
        panel: {
          title: 'Order by id()',
          icon: 'Hash',
          code: 'first, second = (\n    (src, dst) if id(src) < id(dst)\n    else (dst, src)\n)\nwith first._lock:\n    with second._lock:\n        ...',
          footer: { text: 'Both calls lock a before b', tone: 'good' },
        },
        caption: 'Derived order, no cycle',
      },
      code: {
        language: 'python',
        title: 'Transfer with ordered locks',
        source: `def transfer(src, dst, amount):
    # lock the lower id first, whatever the direction of the transfer
    first, second = (src, dst) if id(src) < id(dst) else (dst, src)
    with first._lock:
        with second._lock:
            src._balance -= amount
            dst._balance += amount`,
        highlight: [3, 4, 5],
      },
    },
    {
      title: 'Timeouts',
      tag: 'concept',
      heading: 'Timeouts: give up instead of waiting forever',
      eli5: 'A kid waits a few seconds for the blue marker. If it never comes, the kid puts the red marker back and tries again later. Nobody freezes for good.',
      body: [
        '`lock.acquire(timeout=1.0)` returns `False` if the lock is not free in time. The thread releases what it holds and backs off. That breaks **no preemption**.',
        'The caller must handle the failure, usually with a retry. The code needs a `try` and `finally` around each acquire so every lock that was taken is released.',
      ],
      keyIdea: 'A timeout turns a silent hang into a failed attempt the caller can handle.',
      metrics: { state: 'running', safe: 'yes', cost: 'retry logic' },
      metricTones: { state: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { ...t1, status: 'active', chips: [{ text: 'gave up after 1 s', tone: 'warn' }] },
          { ...la, status: 'active', sub: 'released' },
          { ...lb, status: 'down', sub: 'held by Thread 2' },
        ],
        links: [link('t1', 'la', 'got it', { labelTone: 'good' }), link('t1', 'lb', 'timeout 1.0 s', { labelTone: 'warn' })],
        flows: [flow(['t1', 'lb'], 'acquire(timeout)', 'request', 0, 1.6), flow(['lb', 't1'], 'False', 'error', 1.8, 1.2), flow(['t1', 'la'], 'release()', 'response', 3.2, 1.2)],
        panel: {
          title: 'Back off',
          icon: 'Timer',
          rows: [
            { text: 'acquire(timeout=1.0)', value: 'True or False' },
            { text: 'On False', value: 'release what you hold', tone: 'warn' },
            { text: 'Then', value: 'caller retries', tone: 'good' },
          ],
          footer: { text: 'Breaks no preemption', tone: 'good' },
        },
        caption: 'Wait a while, then let go',
      },
      code: {
        language: 'python',
        title: 'Transfer that backs off',
        source: `def try_transfer(src, dst, amount, timeout=1.0):
    if src._lock.acquire(timeout=timeout):
        try:
            if dst._lock.acquire(timeout=timeout):
                try:
                    src._balance -= amount
                    dst._balance += amount
                    return True
                finally:
                    dst._lock.release()
            return False        # could not get dst: back off
        finally:
            src._lock.release()
    return False`,
        highlight: [2, 4, 9, 10, 12],
      },
    },
    {
      title: 'Backoff, jitter',
      tag: 'tradeoff',
      heading: 'Retries can collide forever unless they are spread out',
      eli5: 'Two kids both give up and both try again after exactly three seconds. They meet again, give up again, and repeat. If each waits a slightly different random time, they stop meeting.',
      body: [
        'Timeouts trade a hang for a **livelock**: both threads keep acting and keep failing, because they retry in step with each other.',
        'Retry with **backoff** (wait longer each time) and **jitter** (add a random amount). The retries drift apart, one thread gets both locks, and the other follows.',
      ],
      keyIdea: 'A timeout needs a retry with backoff and jitter, or two threads can fail in lockstep forever.',
      metrics: { state: 'retrying', safe: 'yes', cost: 'extra latency' },
      metricTones: { state: 'warn', cost: 'warn' },
      scene: {
        nodes: [
          { ...t1, status: 'active', chips: [{ text: 'retry in 0.12 s', tone: 'good' }] },
          { ...t2, status: 'active', chips: [{ text: 'retry in 0.31 s', tone: 'good' }] },
          { id: 'tr', kind: 'block', at: at(0, 3.4), label: 'try_transfer', sub: 'returns False on timeout', icon: 'Repeat', tint: 'green' },
        ],
        links: [link('t1', 'tr', 'retry'), link('t2', 'tr', 'retry')],
        flows: [flow(['t1', 'tr'], 'attempt 2', 'request', 0, 1.6), flow(['t2', 'tr'], 'attempt 2', 'request', 1.8, 1.6)],
        panel: {
          title: 'Wait before retry',
          icon: 'Timer',
          code: 'delay = 0.05\nfor attempt in range(5):\n    if try_transfer(a, b, 10):\n        break\n    time.sleep(delay + random.random() * delay)\n    delay *= 2',
          footer: { text: 'Different waits, no lockstep', tone: 'good' },
        },
        caption: 'Randomness breaks the tie',
      },
    },
    {
      title: 'Hierarchy',
      tag: 'concept',
      heading: 'Hierarchical locking: levels, and a loud error on a violation',
      eli5: 'Every marker has a number on it. A kid may only pick up a marker with a bigger number than the one in hand. If a kid tries otherwise, the teacher shouts right away.',
      body: [
        'Give every lock a **level**. A thread may only acquire locks in strictly increasing level. A thread-local list remembers what it already holds.',
        'Break the rule and `LeveledLock` raises an exception. A rare hang in production becomes a loud error on your laptop, the first time the code runs.',
      ],
      keyIdea: 'Hierarchical locks turn a timing-dependent deadlock into an immediate, deterministic exception.',
      metrics: { state: 'running', safe: 'yes', cost: 'bookkeeping per acquire' },
      metricTones: { state: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...t1, status: 'active', chips: [{ text: 'holds level 2', tone: 'good' }] },
          { id: 'l2', kind: 'vault', at: at(0, -3.2), label: 'LeveledLock 2', sub: 'held' },
          { id: 'l1', kind: 'vault', at: at(3.6, 3.4), label: 'LeveledLock 1', sub: 'level too low', status: 'hot' },
        ],
        links: [link('t1', 'l2', 'holds'), link('t1', 'l1', 'acquire()', { labelTone: 'bad' })],
        flows: [flow(['t1', 'l1'], 'level 1 <= 2', 'error', 0, 1.8), flow(['l1', 't1'], 'RuntimeError', 'error', 2, 1.4)],
        panel: {
          title: 'Level check in __enter__',
          icon: 'Layers',
          code: 'held = self._thread_locals.held\nif held and self._level <= held[-1]._level:\n    raise RuntimeError(\n        "Lock order violation"\n    )\nself._lock.acquire()',
          footer: { text: 'Fails in dev, not at 3am', tone: 'good' },
        },
        caption: 'The order is enforced in code',
      },
      code: {
        language: 'python',
        title: 'LeveledLock',
        source: `import threading

class LeveledLock:
    _thread_locals = threading.local()

    def __init__(self, level):
        self._lock = threading.Lock()
        self._level = level

    def __enter__(self):
        held = getattr(self._thread_locals, "held", [])
        if held and self._level <= held[-1]._level:
            raise RuntimeError(
                f"Lock order violation: acquiring level {self._level} "
                f"while holding level {held[-1]._level}"
            )
        self._lock.acquire()
        held.append(self)
        self._thread_locals.held = held
        return self

    def __exit__(self, *exc):
        self._thread_locals.held.remove(self)
        self._lock.release()`,
        highlight: [12, 13, 14, 17],
      },
      quiz: {
        question: 'Which prevention strategy breaks the "no preemption" condition?',
        options: [
          'Lock ordering',
          'Hierarchical locking',
          'Acquiring with a timeout and backing off',
          'Using an RLock instead of a Lock',
        ],
        answer: 2,
        explain: 'With a timeout, a thread that cannot get its next lock gives up and releases the ones it holds, so a lock is taken away from a waiting holder. Ordering and hierarchy break circular wait. An RLock does not prevent deadlock between threads.',
      },
    },
    {
      title: 'One big lock',
      tag: 'concept',
      heading: 'Coarse-grained: one lock guards the whole catalog',
      eli5: 'The whole toy shelf has one marker. Only the kid holding it may look at any toy at all, even though the kids want different toys. It is safe and simple, and everyone queues.',
      body: [
        'A `ProductCatalog` with one `Lock` is simple and correct. But every `get` blocks every other `get`, so reads on different SKUs queue up behind each other.',
        'That is fine for a prototype. Under 10,000 requests per second, one hot lock becomes the whole system\'s speed limit.',
      ],
      keyIdea: 'One lock is the simplest correct design. It is also the one that serializes everything.',
      metrics: { state: 'running', safe: 'yes', cost: 'contention' },
      metricTones: { safe: 'good', cost: 'bad' },
      scene: {
        nodes: [
          { ...ra, status: 'active', load: 90, chips: ['get("sku1")'] },
          { ...rb, status: 'dim', load: 15, chips: [{ text: 'waiting', tone: 'warn' }] },
          { ...catalog, status: 'hot', badge: '1 lock' },
          { id: 'biglock', kind: 'vault', at: at(4, 0), label: 'self._lock', sub: 'one for everything', status: 'hot' },
        ],
        links: [link('ra', 'biglock', 'holds'), link('rb', 'biglock', 'blocked', { labelTone: 'warn' }), link('biglock', 'catalog', 'guards', { arrow: 'none' })],
        flows: [flow(['ra', 'biglock', 'catalog'], 'get', 'request', 0, 1.6), flow(['rb', 'biglock'], 'waits', 'error', 1.8, 1.4)],
        panel: {
          title: 'Coarse-grained',
          icon: 'Gauge',
          code: 'def add(self, sku, item):\n    with self._lock:\n        self._items[sku] = item\n\ndef get(self, sku):\n    with self._lock:\n        return self._items.get(sku)',
          footer: { text: 'Reads block reads', tone: 'warn' },
        },
        caption: 'Every call queues on one lock',
      },
    },
    {
      title: 'Lock per entry',
      tag: 'concept',
      heading: 'Fine-grained: one lock per SKU, plus a map lock',
      eli5: 'Every toy gets its own marker, so kids who want different toys never wait. But the kid who looks up which marker belongs to which toy still needs a quick turn at a list on the wall.',
      body: [
        'Give each SKU its own lock. Two threads updating different SKUs never contend.',
        'But finding the right lock means reading a dict of locks, and that dict needs its own `_map_lock`. If that becomes hot, you moved the bottleneck, not removed it.',
      ],
      keyIdea: 'Per-entry locks cut contention between keys, and add a lookup lock and a lot of lock objects.',
      metrics: { state: 'running', safe: 'yes', cost: 'map lock now hot' },
      metricTones: { safe: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { ...ra, status: 'active', chips: ['sku1'] },
          { ...rb, status: 'active', chips: ['sku2'] },
          { id: 'maplock', kind: 'vault', at: at(0, -3.2), label: '_map_lock', sub: 'guards the lock dict', status: 'hot', load: 70 },
          { id: 'lk1', kind: 'vault', at: at(3.4, 2.6), label: 'lock for sku1', sub: 'own lock' },
          { ...catalog, at: at(0, 4.6), size: 0.8 },
        ],
        links: [link('ra', 'maplock', 'find lock'), link('rb', 'maplock', 'find lock'), link('ra', 'lk1', 'holds', { style: 'dashed' })],
        flows: [flow(['ra', 'maplock'], '_lock_for(sku1)', 'request', 0, 1.4), flow(['rb', 'maplock'], '_lock_for(sku2)', 'request', 0.4, 1.4)],
        panel: {
          title: 'Lock lookup',
          icon: 'Key',
          code: 'def _lock_for(self, sku):\n    with self._map_lock:\n        if sku not in self._locks:\n            self._locks[sku] = Lock()\n        return self._locks[sku]',
          footer: { text: 'The map lock can become the bottleneck', tone: 'warn' },
        },
        caption: 'Fewer collisions, one new hot spot',
      },
      code: {
        language: 'python',
        title: 'Lock per SKU',
        source: `class ProductCatalog:
    def __init__(self):
        self._items = {}
        self._locks = {}
        self._map_lock = threading.Lock()

    def _lock_for(self, sku):
        with self._map_lock:
            if sku not in self._locks:
                self._locks[sku] = threading.Lock()
            return self._locks[sku]

    def update_stock(self, sku, delta):
        with self._lock_for(sku):
            self._items[sku].stock += delta`,
        highlight: [5, 8, 14],
      },
    },
    {
      title: 'Striping',
      tag: 'concept',
      heading: 'Lock striping: a fixed pool of locks, picked by hash',
      eli5: 'The shop has 32 markers, not one per toy. A toy\'s name decides which marker it uses. Two toys sometimes share a marker, but kids rarely wait, and nobody keeps a list.',
      body: [
        'Create a fixed array of locks, here `STRIPES = 32`, and pick one with `hash(sku) % STRIPES`. There is no lock dict and no map lock.',
        'Two SKUs can share a stripe, so collisions happen, but contention drops by about a factor of 32. Java\'s `ConcurrentHashMap` built its reputation on this idea.',
      ],
      keyIdea: 'Striping caps the number of locks and still cuts contention. The sweet spot between one lock and one per key.',
      metrics: { state: 'running', safe: 'yes', cost: 'contention / 32' },
      metricTones: { safe: 'good', cost: 'good' },
      scene: {
        nodes: [
          { ...ra, status: 'active', chips: ['hash % 32 = 5'] },
          { ...rb, status: 'active', chips: ['hash % 32 = 17'] },
          { id: 's5', kind: 'vault', at: at(0, -3.2), label: 'stripe 5', sub: 'of 32 locks' },
          { id: 's17', kind: 'vault', at: at(3.4, 2.6), label: 'stripe 17', sub: 'of 32 locks' },
          { ...catalog, at: at(0, 4.6), size: 0.8, status: 'ok' },
        ],
        links: [link('ra', 's5', 'sku1'), link('rb', 's17', 'sku2')],
        flows: [flow(['ra', 's5'], 'acquire', 'handshake', 0, 1.4), flow(['rb', 's17'], 'acquire', 'handshake', 0.4, 1.4)],
        panel: {
          title: 'Three designs compared',
          icon: 'Table',
          rows: [
            { text: 'One lock', value: 'simple, all wait', tone: 'bad' },
            { text: 'Lock per key', value: 'many locks, map lock', tone: 'warn' },
            { text: 'Striped, 32 locks', value: 'fixed, low contention', tone: 'good' },
          ],
        },
        caption: 'Different stripes, no waiting',
      },
      code: {
        language: 'python',
        title: 'StripedCatalog',
        source: `class StripedCatalog:
    STRIPES = 32

    def __init__(self):
        self._items = {}
        self._stripes = [threading.Lock() for _ in range(self.STRIPES)]

    def _stripe_for(self, sku):
        return self._stripes[hash(sku) % self.STRIPES]

    def update_stock(self, sku, delta):
        with self._stripe_for(sku):
            self._items[sku].stock += delta`,
        highlight: [6, 9, 12],
      },
    },
    {
      title: 'Lost update',
      tag: 'case',
      heading: 'Bug 1: the lost update, again',
      eli5: 'Two kids copy the number off the board, each add one, and each write back. The board only goes up by one. The second kid erased the first kid\'s work.',
      body: [
        'Two threads read the same value, change it, and write it back. The second write overwrites the first. This is the counter bug from Part 1.',
        'The fix is the same: hold a lock across the whole read-modify-write, or use an atomic **compare-and-swap** (CAS) and retry when it fails.',
      ],
      keyIdea: 'Lost update is a read-modify-write with no protection. Lock it or CAS it.',
      metrics: { state: 'wrong', safe: 'no', cost: '-' },
      metricTones: { state: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), status: 'active', chips: ['read 5, write 6'] },
          { ...rb, at: at(-3.4, 2.6), status: 'active', chips: ['read 5, write 6'] },
          { id: 'val', kind: 'block', at: at(0, 0), label: 'value', sub: 'should be 7', icon: 'Hash', tint: 'amber', status: 'hot', badge: '6' },
        ],
        links: [link('ra', 'val', 'read, write'), link('rb', 'val', 'read, write')],
        flows: [flow(['ra', 'val'], 'write 6', 'request', 0), flow(['rb', 'val'], 'write 6', 'error', 0.8)],
        panel: {
          title: 'Fix it',
          icon: 'Shield',
          rows: [
            { text: 'Lock around read-modify-write', value: 'always works', tone: 'good' },
            { text: 'CAS and retry', value: 'lock-free', tone: 'good' },
            { text: 'Nothing', value: 'lost update', tone: 'bad' },
          ],
        },
        caption: 'The second write erases the first',
      },
    },
    {
      title: 'Double-read',
      tag: 'case',
      heading: 'Bug 2: two reads that disagree',
      eli5: 'A kid counts the red crayons, then walks over and counts the blue ones. Meanwhile a friend moved some red crayons to blue. The total on the kid\'s paper never matched the box at any moment.',
      body: [
        'Each read is safe on its own. But another thread can change the account between `get_balance()` and `get_savings()`, so the sum was never true at any instant.',
        'Fix it by taking a **snapshot** under one lock, so both values come from the same moment, or by returning an immutable view.',
      ],
      keyIdea: 'Reading two values separately can give a combination that never existed. Snapshot them under one lock.',
      metrics: { state: 'stale total', safe: 'no', cost: '-' },
      metricTones: { state: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Reader', sub: 'display_balance', status: 'active' },
          { id: 'acct', kind: 'block', at: at(0, -0.8), label: 'Account', sub: 'main + savings', icon: 'Database', tint: 'green', status: 'hot' },
          { ...rb, at: at(-3.4, 3), label: 'Writer', sub: 'withdraw 500', status: 'active' },
        ],
        links: [link('ra', 'acct', 'read twice'), link('rb', 'acct', 'writes in between')],
        flows: [flow(['ra', 'acct'], 'get_balance()', 'request', 0), flow(['rb', 'acct'], 'withdraw(500)', 'request', 1.2), flow(['ra', 'acct'], 'get_savings()', 'request', 2.4)],
        panel: {
          title: 'The stale sum',
          icon: 'Bug',
          code: 'main = account.get_balance()   # 1000\n# another thread withdraws 500\nsavings = account.get_savings()  # 500\nprint(main + savings)  # stale',
          footer: { text: 'Snapshot under one lock', tone: 'good' },
        },
        caption: 'A total that never existed',
      },
    },
    {
      title: 'Broken DCL',
      tag: 'case',
      heading: 'Bug 3: double-checked locking depends on the language',
      eli5: 'The rule "check the shelf, then lock the door and check again" works in one school. In another school, a kid might see the shelf label before the toy is actually on it. Always check the school\'s rules.',
      body: [
        'In Python, double-checked locking is safe, because the GIL makes a reference assignment atomic. In Java before 1.5, and in C++ without `std::atomic`, it was broken.',
        'The runtime could publish a reference to a **partially constructed** object. The lesson: correctness depends on the language memory model, so never port the idiom blindly.',
      ],
      keyIdea: 'A pattern that is correct in one memory model can be broken in another. Re-derive correctness per language.',
      metrics: { state: 'python ok', safe: 'depends', cost: '-' },
      metricTones: { safe: 'warn' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Thread A', sub: 'constructing', status: 'active' },
          { id: 'inst', kind: 'block', at: at(0, 0), label: '_instance', sub: 'reference set early?', icon: 'Package', tint: 'amber', status: 'hot' },
          { ...rb, at: at(-3.4, 2.6), label: 'Thread B', sub: 'sees non-None', status: 'active', chips: [{ text: 'half-built object', tone: 'bad' }] },
        ],
        links: [link('ra', 'inst', 'publishes'), link('rb', 'inst', 'reads')],
        flows: [flow(['ra', 'inst'], 'assign ref', 'request', 0), flow(['rb', 'inst'], 'if not None', 'error', 1.2)],
        panel: {
          title: 'Same idiom, three languages',
          icon: 'Table',
          rows: [
            { text: 'Python (GIL)', value: 'safe', tone: 'good' },
            { text: 'Java before 1.5', value: 'broken without volatile', tone: 'bad' },
            { text: 'C++ without atomic', value: 'broken', tone: 'bad' },
          ],
        },
        caption: 'The memory model decides',
      },
    },
    {
      title: 'ABA problem',
      tag: 'case',
      heading: 'Bug 4: the ABA problem in lock-free code',
      eli5: 'A kid sees a red block on top of the pile and goes to fetch glue. A friend takes the red block, takes the blue one, then puts the red block back. The kid sees red on top and thinks nothing changed.',
      body: [
        'In a lock-free stack, thread 1 reads `top = A` and `next = B`, then pauses. Thread 2 pops `A`, pops `B`, and pushes `A` back. The top is `A` again.',
        'Thread 1 runs `CAS(top, A, B)`. It succeeds because the top is `A` again, and the freed node `B` becomes the top. The stack is corrupt. Fix it by tagging each value with a version counter, or with hazard pointers.',
      ],
      keyIdea: 'CAS checks that the value matches, not that nothing happened in between. Add a version tag.',
      metrics: { state: 'corrupt', safe: 'no', cost: '-' },
      metricTones: { state: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Thread 1', sub: 'paused with top = A', status: 'dim' },
          { ...rb, at: at(-3.4, 2.6), label: 'Thread 2', sub: 'pop A, pop B, push A', status: 'active' },
          { id: 'stack', kind: 'block', at: at(0, 0), label: 'Stack', sub: 'top is A again', icon: 'Layers', tint: 'amber', status: 'hot' },
        ],
        links: [link('ra', 'stack', 'CAS(top, A, B)', { labelTone: 'bad' }), link('rb', 'stack', 'pop, pop, push')],
        flows: [flow(['rb', 'stack'], 'pop A, pop B, push A', 'request', 0, 1.8), flow(['ra', 'stack'], 'CAS succeeds', 'error', 2, 1.6)],
        panel: {
          title: 'ABA in four lines',
          icon: 'Bug',
          code: '# T1 reads top = A, next = B, pauses\n# T2 pops A, pops B, pushes A\n# top is A again\n# T1: CAS(top, A, B) succeeds\n# top is now the freed node B',
          footer: { text: 'Fix: version counter, or hazard pointers', tone: 'good' },
        },
        caption: 'The value matched, the history did not',
      },
      quiz: {
        question: 'Why does a CAS on a lock-free stack still corrupt it in the ABA problem?',
        options: [
          'CAS is not atomic on most CPUs',
          'CAS only checks that the value equals the expected one, and the value was changed and changed back',
          'The GIL blocks the second thread',
          'CAS always fails when two threads race',
        ],
        answer: 1,
        explain: 'CAS compares the current value with the expected one. If another thread popped and re-pushed the same node, the value matches even though the structure behind it changed. A version tag on the value makes that case fail.',
      },
    },
    {
      title: 'Visibility',
      tag: 'case',
      heading: 'Bug 5: a write that other threads cannot see yet',
      eli5: 'A kid pins up a "lunch is ready" sign before the lunch is on the table. Another kid sees the sign, runs over, and finds an empty table. The kid who set the sign did things in a different order than the code said.',
      body: [
        'Thread A sets `config`, then `config_ready = True`. Thread B spins until `config_ready`, then uses `config`. In C++, Java without `volatile`, or Rust without `Ordering`, B may see the flag before the config.',
        'The compiler or CPU reordered the writes. Python hides this behind the GIL, but every other system you design will not.',
      ],
      keyIdea: 'Without a memory barrier, another thread can see writes in a different order. Do not rely on Python hiding it.',
      metrics: { state: 'stale config', safe: 'no', cost: '-' },
      metricTones: { state: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Thread A', sub: 'writes config, flag', status: 'active' },
          { id: 'flag', kind: 'block', at: at(0, -0.8), label: 'config_ready', sub: 'True already', icon: 'Zap', tint: 'violet', status: 'active' },
          { ...rb, at: at(-3.4, 3), label: 'Thread B', sub: 'spins on the flag', status: 'active', chips: [{ text: 'old config', tone: 'bad' }] },
        ],
        links: [link('ra', 'flag', 'sets'), link('rb', 'flag', 'reads')],
        flows: [flow(['ra', 'flag'], 'config_ready = True', 'request', 0), flow(['rb', 'flag'], 'sees True', 'error', 1.4)],
        panel: {
          title: 'Reordered',
          icon: 'Bug',
          code: '# Thread A\nconfig = load_config()\nconfig_ready = True\n\n# Thread B\nwhile not config_ready: pass\nuse(config)   # may be old',
          footer: { text: 'Fix: lock, Event, or atomic with ordering', tone: 'good' },
        },
        caption: 'The flag arrived before the data',
      },
    },
    {
      title: 'Immutable',
      tag: 'concept',
      heading: 'Design out the problem: immutable objects need no lock',
      eli5: 'If a picture is laminated, no kid can scribble on it. So any number of kids can look at it at the same time. To change it, you make a new laminated copy.',
      body: [
        'An object that cannot change after construction is safe to share across threads with no lock. Nobody can see a half-updated value.',
        'A `frozen=True` dataclass is the Python tool. Methods like `translate` return a new object instead of modifying the old one.',
      ],
      keyIdea: 'If state never changes, there is nothing to race on. Share immutable objects freely.',
      metrics: { state: 'running', safe: 'yes', cost: 'a copy per change' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Thread A', sub: 'reads', status: 'ok' },
          { ...rb, at: at(-3.4, 2.6), label: 'Thread B', sub: 'reads', status: 'ok' },
          { id: 'pt', kind: 'block', at: at(0, 0), label: 'Point', sub: 'frozen dataclass', icon: 'Package', tint: 'green', status: 'ok', badge: 'no lock' },
          { id: 'pt2', kind: 'block', at: at(4, 0), label: 'Point (new)', sub: 'translate() copy', icon: 'Package', tint: 'green' },
        ],
        links: [link('ra', 'pt', 'reads'), link('rb', 'pt', 'reads'), link('pt', 'pt2', 'creates')],
        flows: [flow(['ra', 'pt'], 'x, y', 'response', 0), flow(['rb', 'pt'], 'x, y', 'response', 0.4), flow(['pt', 'pt2'], 'translate(1, 1)', 'data', 1.2)],
        panel: {
          title: 'Frozen dataclass',
          icon: 'Shield',
          code: '@dataclass(frozen=True)\nclass Point:\n    x: float\n    y: float\n\n    def translate(self, dx, dy):\n        return Point(self.x + dx, self.y + dy)',
          footer: { text: 'Change means a new object', tone: 'good' },
        },
        caption: 'Nothing to lock',
      },
      code: {
        language: 'python',
        title: 'An immutable Point',
        source: `from dataclasses import dataclass

@dataclass(frozen=True)        # immutable
class Point:
    x: float
    y: float

    def translate(self, dx, dy):
        return Point(self.x + dx, self.y + dy)   # new object, no mutation`,
        highlight: [3, 9],
      },
    },
    {
      title: 'Confinement',
      tag: 'concept',
      heading: 'Thread confinement: if only one thread touches it, nothing races',
      eli5: 'Every kid gets their own pencil box. Nobody shares, so nobody waits and nobody fights. It costs one box per kid.',
      body: [
        '`threading.local()` gives each thread its own copy of a value. Each thread opens its own database connection the first time it asks for one.',
        'No sharing, no locks. That is how most database and HTTP client libraries stay thread-safe. The cost is one object per thread.',
      ],
      keyIdea: 'State owned by exactly one thread cannot race. Use thread-local storage for per-thread resources.',
      metrics: { state: 'running', safe: 'yes', cost: 'one copy per thread' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Thread A', sub: 'own connection', status: 'ok' },
          { ...rb, at: at(-3.4, 2.6), label: 'Thread B', sub: 'own connection', status: 'ok' },
          { id: 'ca', kind: 'block', at: at(0, -2.4), label: 'conn A', sub: 'thread-local', icon: 'Plug', tint: 'green' },
          { id: 'cb', kind: 'block', at: at(3.4, 2.6), label: 'conn B', sub: 'thread-local', icon: 'Plug', tint: 'green' },
        ],
        links: [link('ra', 'ca', 'owns'), link('rb', 'cb', 'owns')],
        flows: [flow(['ra', 'ca'], 'query', 'request', 0), flow(['rb', 'cb'], 'query', 'request', 0.5)],
        panel: {
          title: 'Per-thread connection',
          icon: 'Plug',
          code: 'thread_local = threading.local()\n\ndef get_db_connection():\n    conn = getattr(thread_local, "conn", None)\n    if conn is None:\n        conn = db.connect()\n        thread_local.conn = conn\n    return conn',
          footer: { text: 'No sharing, no locks', tone: 'good' },
        },
        caption: 'One owner each',
      },
    },
    {
      title: 'Message passing',
      tag: 'concept',
      heading: 'Message passing: one owner, everyone else sends mail',
      eli5: 'One kid owns the tally board. Everyone else drops a note in that kid\'s mailbox: "add one". The kid reads notes one at a time, so the board is never touched by two hands.',
      body: [
        'An **actor** owns its state and has an inbox, a `queue.Queue`. Other threads call `send(msg)`. A single loop thread handles one message at a time.',
        'There is no shared memory to protect, so a race on that state is impossible by construction. Erlang, Akka and Go channels work this way.',
      ],
      keyIdea: 'Pass messages to the one thread that owns the state, instead of sharing the state and locking it.',
      metrics: { state: 'running', safe: 'yes', cost: 'a queue hop per call' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Thread A', sub: 'send(("inc", "x"))', status: 'active' },
          { ...rb, at: at(-3.4, 2.6), label: 'Thread B', sub: 'send(("inc", "x"))', status: 'active' },
          { id: 'inbox', kind: 'block', at: at(0, 0), label: 'Inbox', sub: 'queue.Queue', icon: 'Inbox', tint: 'blue' },
          { id: 'actor', kind: 'block', at: at(4, 0), label: 'Actor', sub: 'owns _state', icon: 'Boxes', tint: 'green', status: 'ok' },
        ],
        links: [link('ra', 'inbox', 'send'), link('rb', 'inbox', 'send'), link('inbox', 'actor', 'get(), one at a time')],
        flows: [flow(['ra', 'inbox'], 'inc x', 'event', 0), flow(['rb', 'inbox'], 'inc x', 'event', 0.4), flow(['inbox', 'actor'], 'inc x', 'request', 1.4)],
        panel: {
          title: 'The actor loop',
          icon: 'Repeat',
          code: 'def _loop(self):\n    while True:\n        msg = self._inbox.get()\n        if msg is None:\n            return\n        self._handle(msg)',
          footer: { text: 'Only this thread touches _state', tone: 'good' },
        },
        caption: 'State has one owner',
      },
      code: {
        language: 'python',
        title: 'A minimal actor',
        source: `import queue, threading

class Actor:
    def __init__(self):
        self._inbox = queue.Queue()
        self._state = {}
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def send(self, msg):
        self._inbox.put(msg)

    def _loop(self):
        while True:
            msg = self._inbox.get()
            if msg is None:
                return
            self._handle(msg)

    def _handle(self, msg):
        kind, *args = msg
        if kind == "set":
            self._state[args[0]] = args[1]
        elif kind == "inc":
            self._state[args[0]] = self._state.get(args[0], 0) + 1`,
        highlight: [10, 11, 14, 15, 16],
      },
    },
    {
      title: 'The mindset',
      tag: 'tradeoff',
      heading: 'Use locks when you must, design so you rarely must',
      eli5: 'A new class monitor makes a rule for every tiny thing. A good one arranges the room so kids rarely need a rule: own boxes, laminated pictures, and a mailbox for the tally board.',
      body: [
        'Early-career engineers learn to use locks. Mid-career engineers learn when not to. Senior engineers design systems where the question rarely comes up.',
        'Immutable data, confined state and message-passing boundaries remove whole categories of bugs. Locks remain for the shared state that is left.',
      ],
      keyIdea: 'Prefer immutable, confined or message-passed state. Keep locks for what is left.',
      metrics: { state: 'designed', safe: 'yes', cost: 'fewer locks' },
      metricTones: { safe: 'good', cost: 'good' },
      scene: {
        nodes: [
          { id: 'lockd', kind: 'block', at: at(-6.4, -3.2), label: 'Lock it', sub: 'last resort', icon: 'Key', tint: 'amber' },
          { id: 'immd', kind: 'block', at: at(0, -3.2), label: 'Immutable', sub: 'share freely', icon: 'Shield', tint: 'green' },
          { id: 'confd', kind: 'block', at: at(-3.4, 3.6), label: 'Confine', sub: 'one thread owns it', icon: 'User', tint: 'green' },
          { id: 'msgd', kind: 'block', at: at(3.4, 2.6), label: 'Message', sub: 'actor owns it', icon: 'Mail', tint: 'green' },
        ],
        links: [link('lockd', 'immd', 'try first', { style: 'dashed', arrow: 'none' }), link('lockd', 'confd', 'try first', { style: 'dashed', arrow: 'none' })],
        flows: [flow(['lockd', 'immd'], 'prefer', 'response', 0), flow(['lockd', 'confd'], 'prefer', 'response', 0.6)],
        panel: {
          title: 'Ladder of choices',
          icon: 'List',
          rows: [
            { text: 'Immutable object', value: 'no lock', tone: 'good' },
            { text: 'Thread-local state', value: 'no lock', tone: 'good' },
            { text: 'Message to an owner', value: 'no shared state', tone: 'good' },
            { text: 'Lock or atomic', value: 'only if shared', tone: 'warn' },
          ],
        },
        caption: 'Fewer shared mutable things',
      },
    },
    {
      title: 'Checklist',
      tag: 'tradeoff',
      heading: 'A concurrency checklist for a design interview',
      eli5: 'Before the class starts, the teacher walks the room: who shares what, which rule covers it, and are any rules going to make two kids wait for each other. Then it is safe to begin.',
      body: [
        'Find every piece of mutable shared state and ask who can touch it. If more than one thread can, pick a protection: lock, atomic, immutable, thread-local or message-passed.',
        'Keep critical sections small and avoid I/O under a lock. Use stdlib primitives like `queue.Queue` and `concurrent.futures`. Benchmark, because fine-grained locking is often slower than it looks.',
      ],
      keyIdea: 'Name the shared state, choose its protection, order the locks, keep sections small and prefer the stdlib.',
      metrics: { state: 'reviewed', safe: 'yes', cost: '-' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...ra, at: at(-6.4, -2.4), label: 'Thread A', sub: 'who touches what?', status: 'active' },
          { id: 'shared', kind: 'block', at: at(0, 0), label: 'Shared state', sub: 'list it, protect it', icon: 'Database', tint: 'amber', status: 'active' },
          { ...rb, at: at(-3.4, 2.6), label: 'Thread B', sub: 'who touches what?', status: 'active' },
        ],
        links: [link('ra', 'shared', 'uses'), link('rb', 'shared', 'uses')],
        flows: [flow(['ra', 'shared'], 'check', 'handshake', 0), flow(['rb', 'shared'], 'check', 'handshake', 0.6)],
        panel: {
          title: 'Before you write code',
          icon: 'List',
          rows: [
            { text: 'List all shared mutable state', value: 'who touches it?' },
            { text: 'Pick a protection', value: 'lock, atomic, immutable...' },
            { text: 'Multi-object operations', value: 'global order or timeouts' },
            { text: 'Critical sections', value: 'small, no I/O', tone: 'warn' },
            { text: 'Tools', value: 'stdlib first', tone: 'good' },
            { text: 'Speed claims', value: 'benchmark', tone: 'warn' },
          ],
          footer: { text: 'Do not reason about memory barriers in Python. Assume no GIL.', tone: 'muted' },
        },
        caption: 'Check before you code',
      },
    },
    {
      title: 'Part 2 recap',
      tag: 'recap',
      heading: 'Recap: prevent deadlock, size your locks, design out the rest',
      eli5: 'Give the class one rule for asking for markers, hand out a sensible number of markers, and arrange the room so most kids never need to share. That keeps everyone busy and nobody stuck.',
      body: [
        'Deadlock needs four conditions. Break one with lock ordering, timeouts with jittered retries, or lock levels. Match lock size to contention: coarse, per-key or striped.',
        'Know the classic bugs: lost update, double-read, broken double-checked locking, ABA and visibility. Prefer immutable, confined and message-passed state.',
      ],
      keyIdea: 'Recognize the shape of the problem fast enough that the right tool jumps out.',
      metrics: { state: 'running', safe: 'yes', cost: 'small critical sections' },
      metricTones: { state: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...t1, status: 'ok', chips: [{ text: 'A then B', tone: 'good' }] },
          { ...t2, status: 'ok', chips: [{ text: 'A then B', tone: 'good' }] },
          { ...la, status: 'ok' },
          { ...lb, status: 'ok' },
        ],
        links: [link('t1', 'la', '1st'), link('t2', 'la', '1st'), link('la', 'lb', '2nd', { style: 'dashed' })],
        flows: [flow(['t1', 'la', 'lb'], 'A then B', 'handshake', 0, 2), flow(['t2', 'la', 'lb'], 'A then B', 'handshake', 2.2, 2)],
        panel: {
          title: 'Part 2 cheat sheet',
          icon: 'Table',
          rows: [
            { text: 'Deadlock', value: 'order, timeout, levels', tone: 'good' },
            { text: 'Contention', value: 'stripe the lock', tone: 'good' },
            { text: 'Lost update', value: 'lock or CAS' },
            { text: 'ABA', value: 'version tag' },
            { text: 'Fewer locks', value: 'immutable, local, messages', tone: 'good' },
          ],
        },
        caption: 'The same order for everyone',
      },
      quiz: {
        question: 'A shared catalog serves 10,000 reads per second on thousands of SKUs and one global lock is the bottleneck. What is the best next step?',
        options: [
          'Switch to an RLock',
          'Add a lock per SKU in a dict with its own map lock',
          'Use a fixed pool of locks and pick one by hash of the SKU',
          'Remove the lock and rely on the GIL',
        ],
        answer: 2,
        explain: 'Striping caps the number of locks, needs no lock dict, and cuts contention by roughly the number of stripes. A per-SKU dict adds a map lock that can become the new bottleneck. An RLock does not reduce contention, and the GIL does not make updates atomic.',
      },
    },
  ],
};
