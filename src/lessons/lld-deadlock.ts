import type { Lesson, SceneFlow, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });
const flow = (path: string[], label: string, tone: SceneFlow['tone'], delay = 0, duration = 1.4): SceneFlow => ({ path, tone, label, delay, duration });

// Story world: two kids share two crayons (the locks) and each needs both to finish a drawing.
const ta: SceneNode = { id: 'ta', kind: 'worker', at: at(-5.4, -3.2), label: 'Thread A', sub: 'transfer(a, b)' };
const tb: SceneNode = { id: 'tb', kind: 'worker', at: at(-2.6, 3.2), label: 'Thread B', sub: 'transfer(b, a)' };
const la: SceneNode = { id: 'la', kind: 'vault', at: at(1.2, -3.2), label: 'Lock A', sub: 'guards account a' };
const lb: SceneNode = { id: 'lb', kind: 'vault', at: at(3.8, 3.2), label: 'Lock B', sub: 'guards account b' };

export const lldDeadlock: Lesson = {
  id: 'lld-deadlock',
  title: 'Deadlock',
  tagline: 'How two threads can wait on each other forever, the four conditions that cause it, and every way to break one of them.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'What a deadlock looks like and why it never raises an error',
    'The four Coffman conditions and the wait-for graph',
    'The classic two-lock trap and the bank transfer version',
    'Lock ordering, hold-and-wait removal, timeouts with backoff and hierarchical locks',
    'Livelock, self-deadlock, lock granularity, callbacks under a lock and how to find a hang',
  ],
  metrics: [
    { key: 'threads', label: 'Threads', icon: 'Users' },
    { key: 'cpu', label: 'CPU', icon: 'Cpu' },
    { key: 'done', label: 'Work done', icon: 'CheckCircle' },
    { key: 'cycle', label: 'Wait cycle', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Silent hang',
      tag: 'problem',
      heading: 'Two transfers start, and neither ever finishes',
      eli5: 'Two kids share a red crayon and a blue crayon, and each needs both to finish a drawing. One grabs red, the other grabs blue, and both sit there waiting for the other crayon forever.',
      body: [
        'A bank service runs `transfer(a, b)` on one thread and `transfer(b, a)` on another, each guarded by account locks. Most of the time all is well. Then the process stops answering.',
        'No exception, no crash, no CPU burn. Both threads are alive and **blocked**. This is a **deadlock**: a group of threads each waiting for something only another waiting thread can give.',
      ],
      keyIdea: 'A deadlock is a silent freeze. Nothing fails, nothing finishes, and nothing logs an error.',
      metrics: { threads: '2 blocked', cpu: '0%', done: '0 of 2', cycle: 'yes' },
      metricTones: { threads: 'bad', cpu: 'warn', done: 'bad', cycle: 'bad' },
      scene: {
        nodes: [
          { ...ta, status: 'hot', chips: [{ text: 'holds A', tone: 'good' }, { text: 'waits B', tone: 'bad' }] },
          { ...tb, status: 'hot', chips: [{ text: 'holds B', tone: 'good' }, { text: 'waits A', tone: 'bad' }] },
          { ...la, status: 'active' },
          { ...lb, status: 'active' },
        ],
        links: [
          link('ta', 'la', 'holds'),
          link('tb', 'lb', 'holds'),
          link('ta', 'lb', 'waits', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
          link('tb', 'la', 'waits', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
        ],
        flows: [flow(['ta', 'lb'], 'acquire(B)', 'error', 0, 1.6), flow(['tb', 'la'], 'acquire(A)', 'error', 0.5, 1.6)],
        panel: {
          title: 'What the dashboard shows',
          icon: 'Activity',
          rows: [
            { text: 'Process', value: 'running', tone: 'good' },
            { text: 'CPU', value: '0%', tone: 'warn' },
            { text: 'Errors logged', value: '0', tone: 'warn' },
            { text: 'Transfers completed', value: '0', tone: 'bad' },
          ],
          footer: { text: 'Looks healthy, does nothing', tone: 'bad' },
        },
        caption: 'Each thread holds one lock and waits for the other',
      },
    },
    {
      title: 'Four conditions',
      tag: 'concept',
      heading: 'Deadlock needs all four Coffman conditions at once',
      eli5: 'For the crayon standoff to happen, four things must be true: only one kid can hold a crayon, they hold one while wanting another, nobody can snatch a crayon, and they wait in a circle.',
      body: [
        'Four things must hold at the same moment: **mutual exclusion**, **hold and wait**, **no preemption** and **circular wait**.',
        'Remove any one and a deadlock cannot form. Every fix in this lesson is a way to break exactly one of the four.',
      ],
      keyIdea: 'Deadlock needs all four conditions together. Break any one and it becomes impossible.',
      metrics: { threads: '2 blocked', cpu: '0%', done: '0 of 2', cycle: 'yes' },
      metricTones: { threads: 'bad', cycle: 'bad' },
      scene: {
        nodes: [
          { ...ta, status: 'hot' },
          { ...tb, status: 'hot' },
          { ...la, status: 'active', chips: [{ text: 'one holder', tone: 'warn' }] },
          { ...lb, status: 'active', chips: [{ text: 'one holder', tone: 'warn' }] },
        ],
        links: [
          link('ta', 'la', 'holds'),
          link('tb', 'lb', 'holds'),
          link('ta', 'lb', 'waits', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
          link('tb', 'la', 'waits', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
        ],
        panel: {
          title: 'The Coffman conditions',
          icon: 'ListChecks',
          rows: [
            { text: 'Mutual exclusion', value: 'one holder per lock' },
            { text: 'Hold and wait', value: 'keeps A, asks for B' },
            { text: 'No preemption', value: 'only the owner releases' },
            { text: 'Circular wait', value: 'A waits B waits A', tone: 'bad' },
          ],
          footer: { text: 'All four true, so it hangs', tone: 'bad' },
        },
        caption: 'Four conditions, all true here',
      },
    },
    {
      title: 'Two-lock trap',
      tag: 'case',
      heading: 'The smallest deadlock: two locks taken in opposite order',
      eli5: 'The first kid reaches for red then blue. The second kid reaches for blue then red. If they both grab their first crayon at the same moment, nobody can ever reach the second.',
      body: [
        '`t1` takes `lock_a` then `lock_b`. `t2` takes `lock_b` then `lock_a`. The `sleep` widens the window so the bug shows every time. In real code the window is tiny, so it shows once a week under load.',
        'That is the worst kind of bug to own: it passes every test and fires in production at 3am.',
      ],
      keyIdea: 'Two threads taking the same two locks in opposite order is the textbook deadlock.',
      metrics: { threads: '2 blocked', cpu: '0%', done: '0 of 2', cycle: 'yes' },
      metricTones: { threads: 'bad', done: 'bad', cycle: 'bad' },
      scene: {
        nodes: [
          { ...ta, sub: 'with A, then B', status: 'hot', chips: [{ text: 'with lock_a', tone: 'good' }] },
          { ...tb, sub: 'with B, then A', status: 'hot', chips: [{ text: 'with lock_b', tone: 'good' }] },
          { ...la, status: 'active' },
          { ...lb, status: 'active' },
        ],
        links: [
          link('ta', 'la', 'got it'),
          link('tb', 'lb', 'got it'),
          link('ta', 'lb', 'blocked', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
          link('tb', 'la', 'blocked', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
        ],
        flows: [flow(['ta', 'lb'], 'lock_b?', 'error', 0.3), flow(['tb', 'la'], 'lock_a?', 'error', 0.8)],
        panel: {
          title: 'Opposite order',
          icon: 'Shuffle',
          rows: [
            { text: 't1', value: 'A then B' },
            { text: 't2', value: 'B then A', tone: 'warn' },
            { text: 'Result', value: 'hangs forever', tone: 'bad' },
          ],
        },
        caption: 'Same locks, opposite order',
      },
      code: {
        language: 'python',
        title: 'The classic deadlock',
        source: `lock_a = threading.Lock()
lock_b = threading.Lock()

def t1():
    with lock_a:
        time.sleep(0.1)
        with lock_b:
            print("t1 done")

def t2():
    with lock_b:
        time.sleep(0.1)
        with lock_a:
            print("t2 done")

threading.Thread(target=t1).start()
threading.Thread(target=t2).start()
# Hangs forever. t1 holds A, waits for B. t2 holds B, waits for A.`,
        highlight: [5, 7, 11, 13],
      },
    },
    {
      title: 'Wait-for cycle',
      tag: 'concept',
      heading: 'Draw who waits for whom, and look for a cycle',
      eli5: 'Draw an arrow from each kid to the kid whose crayon they want. If the arrows chase each other round in a circle, everyone is stuck. No circle, and someone can finish.',
      body: [
        'A **wait-for graph** has a node per thread and an arrow from thread X to thread Y when X waits for a lock that Y holds.',
        'For single-unit locks, a deadlock is a **cycle** in that graph. A chain with an end is fine, because the thread at the end is running and will release its lock. Databases build this graph to find a cycle and abort one transaction.',
      ],
      keyIdea: 'A cycle in the wait-for graph is a deadlock. A chain that ends is just waiting.',
      metrics: { threads: '2 blocked', cpu: '0%', done: '0 of 2', cycle: 'loop of 2' },
      metricTones: { cycle: 'bad' },
      scene: {
        nodes: [
          { ...ta, sub: 'waits for Thread B', status: 'hot' },
          { ...tb, sub: 'waits for Thread A', status: 'hot' },
        ],
        links: [
          link('ta', 'tb', 'waits for', { labelTone: 'bad' }),
          link('tb', 'ta', 'waits for', { labelTone: 'bad', route: 'straight' }),
        ],
        flows: [flow(['ta', 'tb'], 'waits for', 'error', 0, 2), flow(['tb', 'ta'], 'waits for', 'error', 1, 2)],
        panel: {
          title: 'Reading the graph',
          icon: 'GitBranch',
          rows: [
            { text: 'Thread A to B to A', value: 'cycle, deadlock', tone: 'bad' },
            { text: 'Thread A to B to C (C runs)', value: 'chain, fine', tone: 'good' },
          ],
          footer: { text: 'Circular wait is the one we can design away', tone: 'muted' },
        },
        caption: 'Arrow means waits for',
      },
    },
    {
      title: 'Bank transfer',
      tag: 'case',
      heading: 'The same trap in a normal-looking Account class',
      eli5: 'Two piggy banks each have their own lock. One kid moves coins from bank A to B, and another moves coins from B to A, each locking the "from" bank first. Same crayon standoff.',
      body: [
        '`transfer(src, dst)` locks `src` first, then `dst`. Run `transfer(a, b)` and `transfer(b, a)` together and the lock order is reversed, though the code is identical.',
        'The order of arguments, which the caller chose, decides the order of locks. Nothing in the class prevents this.',
      ],
      keyIdea: 'When lock order follows argument order, callers can create a deadlock without knowing it.',
      metrics: { threads: '2 blocked', cpu: '0%', done: '0 of 2', cycle: 'yes' },
      metricTones: { threads: 'bad', cycle: 'bad' },
      scene: {
        nodes: [
          { ...ta, chips: ['transfer(a, b, 50)'], status: 'hot' },
          { ...tb, at: at(-1.6, 3.2), chips: ['transfer(b, a, 30)'], status: 'hot' },
          { id: 'acca', kind: 'block', at: at(1.2, -3), size: 0.75, label: 'Account a', sub: '_lock held by A', icon: 'Landmark', tint: 'green' },
          { id: 'accb', kind: 'block', at: at(1.2, 3), size: 0.75, label: 'Account b', sub: '_lock held by B', icon: 'Landmark', tint: 'green' },
        ],
        links: [
          link('ta', 'acca', 'locks src'),
          link('tb', 'accb', 'locks src'),
          link('ta', 'accb', 'wants dst', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
          link('tb', 'acca', 'wants dst', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
        ],
        panel: {
          title: 'transfer lock order',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'transfer(a, b)', value: 'a then b' },
            { text: 'transfer(b, a)', value: 'b then a', tone: 'bad' },
          ],
          footer: { text: 'Caller picks the order', tone: 'bad' },
        },
        caption: 'The argument order sets the lock order',
      },
      code: {
        language: 'python',
        title: 'Deadlock-prone transfer',
        source: `class Account:
    def __init__(self, balance):
        self._balance = balance
        self._lock = threading.Lock()

def transfer(src, dst, amount):
    with src._lock:          # first lock follows argument order
        with dst._lock:      # second lock, may be held by the other thread
            src._balance -= amount
            dst._balance += amount`,
        highlight: [7, 8],
      },
    },
    {
      title: 'Break one',
      tag: 'tradeoff',
      heading: 'One strategy per condition',
      eli5: 'To stop the crayon standoff you can change one rule. Make kids pick up crayons in the same order, grab both at once, give up after a while, or give each kid their own crayons.',
      body: [
        'Each fix attacks one condition. **Lock ordering** and **hierarchical locks** break circular wait. **Acquire all at once** breaks hold and wait. **Timeouts** break no preemption. **Not sharing** breaks mutual exclusion.',
        'Ordering is the cheapest and most common choice. The others cost throughput or extra code, and we meet each one next.',
      ],
      keyIdea: 'Pick the condition that is cheapest to break for your design. Usually that is circular wait.',
      metrics: { threads: '-', cpu: '-', done: '-', cycle: 'broken' },
      metricTones: { cycle: 'good' },
      scene: {
        nodes: [
          { id: 'mx', kind: 'block', at: at(-4.4, -2.5), size: 0.8, label: 'No sharing', sub: 'mutual exclusion', icon: 'Copy', tint: 'violet' },
          { id: 'hw', kind: 'block', at: at(0, -2.5), size: 0.8, label: 'All at once', sub: 'hold and wait', icon: 'Lock', tint: 'blue' },
          { id: 'np', kind: 'block', at: at(4.4, -2.5), size: 0.8, label: 'Timeouts', sub: 'no preemption', icon: 'Timer', tint: 'amber' },
          { id: 'cw', kind: 'block', at: at(0, 3), size: 0.8, label: 'Lock order', sub: 'circular wait', icon: 'ListOrdered', tint: 'green', status: 'ok' },
        ],
        panel: {
          title: 'Condition and its fix',
          icon: 'Wrench',
          rows: [
            { text: 'Circular wait', value: 'ordering, levels', tone: 'good' },
            { text: 'Hold and wait', value: 'take all or none' },
            { text: 'No preemption', value: 'timeout and retry' },
            { text: 'Mutual exclusion', value: 'share nothing' },
          ],
          footer: { text: 'Most code breaks circular wait', tone: 'muted' },
        },
        caption: 'Four conditions, four levers',
      },
    },
    {
      title: 'Lock ordering',
      tag: 'concept',
      heading: 'Strategy 1: everyone takes locks in one global order',
      eli5: 'New house rule: red crayon first, always. Whichever kid needs both takes red, then blue. Now nobody can hold blue while waiting for red, so no circle can form.',
      body: [
        'Pick one global order for the locks and make every thread follow it. In the classic trap, `t2` takes `lock_a` first like `t1` does.',
        'The thread that wins `lock_a` can always go on to `lock_b`. The loser waits holding nothing. Waits form a line, never a circle, so **circular wait** is gone.',
      ],
      keyIdea: 'If every thread takes locks in the same order, a wait cycle cannot form.',
      metrics: { threads: '2 running', cpu: '30%', done: '2 of 2', cycle: 'impossible' },
      metricTones: { threads: 'good', done: 'good', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, status: 'ok', chips: [{ text: '1. lock_a', tone: 'good' }, { text: '2. lock_b', tone: 'good' }] },
          { ...tb, status: 'active', chips: [{ text: 'waits lock_a', tone: 'warn' }] },
          { ...la, status: 'active' },
          { ...lb, status: 'active' },
        ],
        links: [link('ta', 'la', 'first'), link('ta', 'lb', 'second', { route: 'straight' }), link('tb', 'la', 'waits, holds nothing', { style: 'dashed', route: 'straight' })],
        flows: [flow(['ta', 'la'], 'lock_a', 'request', 0), flow(['ta', 'lb'], 'lock_b', 'request', 1), flow(['la', 'tb'], 'turn', 'response', 2.4)],
        panel: {
          title: 'Global order',
          icon: 'ListOrdered',
          code: 'def t1():\n    with lock_a:\n        with lock_b: ...\n\ndef t2():\n    with lock_a:   # was lock_b\n        with lock_b: ...',
          footer: { text: 'Both threads agree: A then B', tone: 'good' },
        },
        caption: 'A first, then B, for everyone',
      },
      code: {
        language: 'python',
        title: 'Same order in both threads',
        source: `# Both threads always acquire in the same global order.

def t1():
    with lock_a:
        with lock_b:
            print("t1 done")

def t2():
    with lock_a:           # was lock_b, forced to match the global order
        with lock_b:
            print("t2 done")`,
        highlight: [9, 10],
      },
    },
    {
      title: 'Order by id',
      tag: 'case',
      heading: 'When locks have no natural order, make one up',
      eli5: 'Two piggy banks have no "first" one. So the kids agree on a rule anyone can check, such as the sticker number on each bank. Lower sticker gets locked first, whatever the direction of the move.',
      body: [
        'Per-account locks have no built-in order. Sort the two accounts by a stable key, here `id()`, and lock the smaller one first. `transfer(a, b)` and `transfer(b, a)` now lock in the same order.',
        'Guard the edge case `src is dst`: locking one plain `Lock` twice would hang a single thread. Across processes `id()` is meaningless, so use a stored account number.',
      ],
      keyIdea: 'Sort the locks by a stable key before taking them, and the order no longer depends on the caller.',
      metrics: { threads: '2 running', cpu: '35%', done: '2 of 2', cycle: 'impossible' },
      metricTones: { threads: 'good', done: 'good', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, chips: ['transfer(a, b)'], status: 'active' },
          { ...tb, chips: ['transfer(b, a)'], status: 'active' },
          { id: 'sort', kind: 'block', at: at(0.6, -0.4), size: 0.8, label: 'sort by id', sub: 'first, second', icon: 'ArrowDownUp', tint: 'blue' },
          { id: 'acca', kind: 'block', at: at(3.6, -2.6), size: 0.7, label: 'Account a', sub: 'lower id', icon: 'Landmark', tint: 'green' },
          { id: 'accb', kind: 'block', at: at(3.6, 2.6), size: 0.7, label: 'Account b', sub: 'higher id', icon: 'Landmark', tint: 'green' },
        ],
        links: [link('ta', 'sort', undefined, { route: 'straight' }), link('tb', 'sort', undefined, { route: 'straight' }), link('sort', 'acca', 'locks first', { route: 'straight' }), link('sort', 'accb', 'locks second', { route: 'straight' })],
        flows: [flow(['ta', 'sort', 'acca'], 'lock a', 'request', 0, 1.8), flow(['tb', 'sort', 'acca'], 'lock a', 'request', 1.2, 1.8)],
        panel: {
          title: 'Same order both ways',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'transfer(a, b)', value: 'a, b', tone: 'good' },
            { text: 'transfer(b, a)', value: 'a, b', tone: 'good' },
            { text: 'transfer(a, a)', value: 'lock once', tone: 'muted' },
          ],
        },
        caption: 'The sort fixes the order',
      },
      code: {
        language: 'python',
        title: 'Order accounts before locking',
        source: `def transfer(src, dst, amount):
    if src is dst:
        return                       # one Lock cannot be taken twice
    first, second = (src, dst) if id(src) < id(dst) else (dst, src)
    with first._lock:
        with second._lock:
            src._balance -= amount
            dst._balance += amount`,
        highlight: [4, 5, 6],
      },
      quiz: {
        question: 'transfer(a, b) and transfer(b, a) run at once. Which change removes the deadlock without a timeout?',
        options: [
          'Lock src first and dst second, as written',
          'Always lock the account with the smaller id first',
          'Add time.sleep(0.1) between the two locks',
          'Catch the exception when the threads hang',
        ],
        answer: 1,
        explain: 'Sorting by a stable key gives every thread the same lock order, so no wait cycle can form. A sleep only moves the timing, and a hang raises no exception to catch.',
      },
    },
    {
      title: 'All at once',
      tag: 'concept',
      heading: 'Strategy 2: take every lock or none, never hold and wait',
      eli5: 'Another rule: a kid may only start drawing after picking up both crayons in one go. Only one kid reaches at a time, so two kids can never grab one crayon each and then wait.',
      body: [
        'Break **hold and wait** with a small guard lock. Only one thread is mid-acquisition at a time, so no wait cycle can form. Every acquire in the codebase must go through `lock_both`.',
        'The cost is throughput. A thread blocked on a busy lock stalls every other acquirer behind the guard. A thread also needs every lock up front, which is hard when the next lock depends on what it just read.',
      ],
      keyIdea: 'A guard lock serializes acquisition so no cycle forms, at the price of one shared bottleneck.',
      metrics: { threads: '2 running', cpu: '30%', done: '2 of 2', cycle: 'impossible' },
      metricTones: { threads: 'good', done: 'good', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, status: 'ok', chips: [{ text: 'has A and B', tone: 'good' }] },
          { ...tb, status: 'dim', chips: [{ text: 'holds nothing', tone: 'warn' }] },
          { id: 'guard', kind: 'vault', at: at(0.4, 0), label: 'Guard', sub: 'grab both locks' },
          { ...la, at: at(3.4, -3), status: 'active' },
          { ...lb, at: at(3.4, 3), status: 'active' },
        ],
        links: [link('ta', 'guard', undefined, { route: 'straight' }), link('tb', 'guard', 'waits', { style: 'dashed', route: 'straight' }), link('guard', 'la', undefined, { route: 'straight' }), link('guard', 'lb', undefined, { route: 'straight' })],
        flows: [flow(['ta', 'guard', 'la'], 'A', 'request', 0, 1.6), flow(['ta', 'guard', 'lb'], 'B', 'request', 1.0, 1.6)],
        panel: {
          title: 'Take both or wait',
          icon: 'Lock',
          code: 'ACQUIRE = threading.Lock()\n\ndef lock_both(a, b):\n    with ACQUIRE:\n        a._lock.acquire()\n        b._lock.acquire()  # may wait, guard held\n    # release a and b when done',
          footer: { text: 'One acquirer at a time, so no cycle', tone: 'good' },
        },
        caption: 'Both locks, or nothing',
      },
    },
    {
      title: 'Timeouts',
      tag: 'concept',
      heading: 'Strategy 3: give up after a timeout and release',
      eli5: 'Rule three: if a kid waits too long for the second crayon, they put the first one back and try again later. Now one kid always gives way, so the standoff ends.',
      body: [
        'A lock acquire can take a `timeout`. When the second lock does not arrive in time, the thread **releases** what it holds and reports failure. That breaks **no preemption**, because the lock is given up even though nobody took it.',
        'The caller must now handle `False`: retry, queue the work or fail the request.',
      ],
      keyIdea: 'A timeout turns a permanent hang into a failure the caller can handle.',
      metrics: { threads: '2 running', cpu: '25%', done: '1 of 2', cycle: 'broken by timeout' },
      metricTones: { threads: 'good', done: 'warn', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, status: 'ok', chips: [{ text: 'holds A', tone: 'good' }, { text: 'then gets B', tone: 'good' }] },
          { ...tb, status: 'active', chips: [{ text: 'holds B, waits A', tone: 'warn' }, { text: 'timeout, released B', tone: 'warn' }] },
          { ...la, status: 'active' },
          { ...lb, status: 'active' },
        ],
        links: [
          link('ta', 'la', 'holds'),
          link('tb', 'lb', 'holds, then released'),
          link('tb', 'la', 'waits 1 s, gives up', { style: 'dashed', labelTone: 'warn', route: 'straight' }),
          link('ta', 'lb', 'wants B', { style: 'dashed', route: 'straight' }),
        ],
        flows: [flow(['tb', 'la'], 'acquire(A, timeout=1)', 'error', 0, 1.6), flow(['la', 'tb'], 'False', 'response', 1.8, 1.2), flow(['lb', 'ta'], 'B is free', 'response', 3.2, 1.4)],
        panel: {
          title: 'Outcomes',
          icon: 'Timer',
          rows: [
            { text: 'Second lock arrives', value: 'True, do work', tone: 'good' },
            { text: 'Timeout expires', value: 'False, back off', tone: 'warn' },
            { text: 'Caller', value: 'retries or fails' },
          ],
        },
        caption: 'B gives way, then A gets B',
      },
      code: {
        language: 'python',
        title: 'try_transfer with timeouts',
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
            return False             # back off, caller retries
        finally:
            src._lock.release()
    return False`,
        highlight: [2, 4, 10, 12],
      },
    },
    {
      title: 'Livelock',
      tag: 'case',
      heading: 'Timeouts can trade a deadlock for a livelock',
      eli5: 'Two kids meet in a hallway, both step left, both step right, again and again. They keep moving but never pass. Waiting a random moment before stepping breaks the pattern.',
      body: [
        'If both threads time out together, release together and retry at the same instant, they collide again. They stay active, retry counters climb and no transfer completes. That is a **livelock**.',
        'Add **exponential backoff with jitter**: wait a random time that grows after each failure. Randomness desynchronizes the threads, so one gets both locks.',
      ],
      keyIdea: 'Retries need random backoff, or two polite threads can block each other forever.',
      metrics: { threads: '2 retrying', cpu: 'varies', done: '0 of 2', cycle: 'none, but no progress' },
      metricTones: { threads: 'warn', cpu: 'warn', done: 'bad', cycle: 'warn' },
      scene: {
        nodes: [
          { ...ta, status: 'hot', load: 55, chips: [{ text: 'retry 7', tone: 'warn' }] },
          { ...tb, status: 'hot', load: 50, chips: [{ text: 'retry 7', tone: 'warn' }] },
          { ...la, status: 'active' },
          { ...lb, status: 'active' },
        ],
        links: [link('ta', 'la', 'back off'), link('tb', 'lb', 'back off'), link('ta', 'lb', 'retry', { style: 'dashed', route: 'straight' }), link('tb', 'la', 'retry', { style: 'dashed', route: 'straight' })],
        flows: [flow(['ta', 'lb'], 'retry', 'error', 0, 1.2), flow(['tb', 'la'], 'retry', 'error', 0.1, 1.2)],
        panel: {
          title: 'Deadlock vs livelock',
          icon: 'Repeat',
          rows: [
            { text: 'Deadlock', value: 'blocked, 0% CPU', tone: 'warn' },
            { text: 'Livelock', value: 'active, no progress', tone: 'bad' },
            { text: 'Fix', value: 'random backoff', tone: 'good' },
          ],
          footer: { text: 'Both end with zero progress', tone: 'bad' },
        },
        caption: 'Both retry in lockstep',
      },
      code: {
        language: 'python',
        title: 'Retry with backoff and jitter',
        source: `def transfer_with_retry(src, dst, amount):
    ceiling = 0.01
    for attempt in range(8):
        if try_transfer(src, dst, amount, timeout=0.05):
            return True
        time.sleep(random.uniform(0, ceiling))   # jitter
        ceiling *= 2                             # exponential backoff
    return False                                 # give up, report failure`,
        highlight: [6, 7],
      },
    },
    {
      title: 'Lock levels',
      tag: 'concept',
      heading: 'Strategy 4: give every lock a level and only go up',
      eli5: 'Put a number sticker on every crayon. A kid may only pick up a crayon with a higher number than the one in their hand. If they try to go down, a teacher stops them on the spot.',
      body: [
        'Assign each lock a **level**, for example a connection pool at 10, an account at 20, an audit log at 30. A thread may only take a lock with a level strictly above the highest it holds. Same-level locks, such as two accounts, need a tie-breaker: use `(20, account_id)` so the id decides.',
        'This is lock ordering made checkable. A `LeveledLock` tracks what the current thread holds in a thread-local list and refuses a violation.',
      ],
      keyIdea: 'Levels turn an unwritten ordering convention into a rule the code enforces.',
      metrics: { threads: '2 running', cpu: '30%', done: '2 of 2', cycle: 'impossible' },
      metricTones: { threads: 'good', done: 'good', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, at: at(-5.4, -3.2), status: 'ok', chips: ['level 10, then 20'] },
          { id: 'l10', kind: 'vault', at: at(-1.5, -3.6), label: 'Level 10', sub: 'connection pool' },
          { id: 'l20', kind: 'vault', at: at(1.5, 0.2), label: 'Level 20', sub: 'account' },
          { id: 'l30', kind: 'vault', at: at(4.5, 3.8), label: 'Level 30', sub: 'audit log' },
        ],
        links: [link('ta', 'l10', 'first'), link('l10', 'l20', 'allowed, up', { route: 'straight', labelTone: 'good' }), link('l20', 'l30', 'allowed, up', { route: 'straight', labelTone: 'good' })],
        flows: [flow(['ta', 'l10', 'l20', 'l30'], 'always up', 'request', 0, 3)],
        panel: {
          title: 'The rule',
          icon: 'ListOrdered',
          rows: [
            { text: 'Hold 10, take 20', value: 'ok', tone: 'good' },
            { text: 'Hold 20, take 30', value: 'ok', tone: 'good' },
            { text: 'Hold 20, take 10', value: 'RuntimeError', tone: 'bad' },
            { text: 'Hold 20, take 20', value: 'RuntimeError', tone: 'bad' },
            { text: 'Same level, tuple', value: '(20, id) in id order', tone: 'good' },
          ],
        },
        caption: 'Only upward',
      },
      code: {
        language: 'python',
        title: 'LeveledLock',
        source: `class LeveledLock:
    _local = threading.local()

    def __init__(self, level):
        self._lock = threading.Lock()
        self._level = level

    def __enter__(self):
        held = getattr(self._local, "held", [])
        if held and self._level <= held[-1]._level:
            raise RuntimeError(
                f"Lock order violation: level {self._level} "
                f"while holding {held[-1]._level}")
        self._lock.acquire()
        held.append(self)
        self._local.held = held
        return self

    def __exit__(self, *exc):
        self._local.held.remove(self)
        self._lock.release()`,
        highlight: [10, 11, 12, 15, 16],
      },
    },
    {
      title: 'Fail loudly',
      tag: 'case',
      heading: 'A violation becomes an exception on your laptop, not a hang in prod',
      eli5: 'Without the teacher, the kids only find out about a bad crayon order when everyone is stuck. With the teacher, the very first wrong grab gets a loud "stop" in the classroom, not a mystery later.',
      body: [
        'A plain ordering convention is checked by code review and luck. With levels, the first test that takes locks in the wrong order raises `RuntimeError` with both levels in the message.',
        'The bug no longer needs a rare interleaving to show up. It fails on every run of that path, in development, with a stack trace that points at the line.',
      ],
      keyIdea: 'Checked lock order moves deadlocks from rare production hangs to deterministic test failures.',
      metrics: { threads: '1 raised', cpu: '5%', done: '0 of 1', cycle: 'prevented' },
      metricTones: { threads: 'warn', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, at: at(-4.8, -2), status: 'hot', chips: [{ text: 'holds 20', tone: 'good' }, { text: 'wants 10', tone: 'bad' }] },
          { id: 'l10', kind: 'vault', at: at(-1.5, -3.6), label: 'Level 10', sub: 'connection pool', status: 'dim' },
          { id: 'l20', kind: 'vault', at: at(1.5, 0.2), label: 'Level 20', sub: 'account', status: 'active' },
          { id: 'exc', kind: 'block', at: at(4.6, 0), size: 0.75, label: 'RuntimeError', sub: 'order violation', icon: 'AlertTriangle', tint: 'red', status: 'hot' },
        ],
        links: [link('ta', 'l20', 'holds'), link('ta', 'l10', 'blocked by check', { style: 'dashed', labelTone: 'bad', route: 'straight' }), link('l10', 'exc', 'raises', { route: 'straight', labelTone: 'bad' })],
        flows: [flow(['ta', 'l10', 'exc'], 'level 10 <= 20', 'error', 0, 2.2)],
        panel: {
          title: 'Where the bug shows up',
          icon: 'Bug',
          rows: [
            { text: 'Plain locks', value: 'hang under load', tone: 'bad' },
            { text: 'Leveled locks', value: 'exception in test', tone: 'good' },
            { text: 'Cost', value: 'one list per thread' },
          ],
          footer: { text: 'Fix it in dev, not at 3am', tone: 'good' },
        },
        caption: 'The wrong order is caught immediately',
      },
    },
    {
      title: 'Self-deadlock',
      tag: 'case',
      heading: 'One thread can deadlock with itself',
      eli5: 'A kid holds the red crayon, then asks themselves for the red crayon again before putting it down. They wait for a crayon that only they could hand over, so they wait forever.',
      body: [
        'With a plain `Lock`, a method that holds the lock and calls another method that needs the same lock hangs on its own. No second thread is needed.',
        'An `RLock` (reentrant lock) remembers the owner and a count, so the same thread can acquire it again and must release it the same number of times. Use it when public methods call each other. Use a plain `Lock` for the discipline of no recursion.',
      ],
      keyIdea: 'A plain lock is not reentrant, so calling a locked method from a locked method hangs one thread forever.',
      metrics: { threads: '1 blocked', cpu: '0%', done: '0 of 1', cycle: 'self wait' },
      metricTones: { threads: 'bad', done: 'bad', cycle: 'bad' },
      scene: {
        nodes: [
          { ...ta, at: at(-4.4, 0), status: 'hot', sub: 'withdraw()', chips: [{ text: 'holds lock', tone: 'good' }, { text: 'wants same lock', tone: 'bad' }] },
          { id: 'lk', kind: 'vault', at: at(0.4, 0), label: 'self._lock', sub: 'plain Lock', status: 'hot' },
          { id: 'wd', kind: 'block', at: at(4.4, 0), size: 0.75, label: '_check_funds()', sub: 'needs the lock', icon: 'ArrowDownToLine', tint: 'green' },
        ],
        links: [link('ta', 'lk', 'holds'), link('ta', 'wd', 'calls', { route: 'straight' }), link('wd', 'lk', 'acquire again', { style: 'dashed', labelTone: 'bad', route: 'straight' })],
        flows: [flow(['ta', 'wd', 'lk'], 'acquire again', 'error', 0, 2.2)],
        panel: {
          title: 'Lock vs RLock',
          icon: 'Lock',
          rows: [
            { text: 'Lock, same thread twice', value: 'hangs', tone: 'bad' },
            { text: 'RLock, same thread twice', value: 'count 2, ok', tone: 'good' },
            { text: 'RLock release', value: 'once per acquire' },
          ],
        },
        caption: 'A thread waits for itself',
      },
      code: {
        language: 'python',
        title: 'Reentrant lock for nested calls',
        source: `class BankAccount:
    def __init__(self, balance):
        self._balance = balance
        self._lock = threading.RLock()    # Lock() would hang below

    def withdraw(self, amount):
        with self._lock:                  # acquire 1
            self._check_funds(amount)     # acquires again
            self._balance -= amount

    def _check_funds(self, amount):
        with self._lock:                  # acquire 2, RLock allows it
            if amount > self._balance:
                raise ValueError("insufficient funds")`,
        highlight: [4, 7, 8, 12],
      },
    },
    {
      title: 'Share nothing',
      tag: 'concept',
      heading: 'Strategy 5: remove mutual exclusion by not sharing',
      eli5: 'The simplest way to end crayon fights is to give each kid their own box of crayons. If nothing is shared, nobody has to wait for anybody.',
      body: [
        'The first condition is **mutual exclusion**, and it only matters for shared mutable state. **Immutable** objects, **thread-local** confinement and **message passing** between owned state all remove the shared resource.',
        'An actor owns its data and handles one message at a time from an inbox, so no lock is needed. Waiting on replies can still deadlock, so keep message flows acyclic too.',
      ],
      keyIdea: 'If state is not shared and mutable, there is no lock to wait for.',
      metrics: { threads: '2 running', cpu: '40%', done: '2 of 2', cycle: 'no locks' },
      metricTones: { threads: 'good', done: 'good', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, at: at(-4.8, -3), status: 'ok', sub: 'sends messages' },
          { ...tb, at: at(-4.8, 3), status: 'ok', sub: 'sends messages' },
          { id: 'inbox', kind: 'queue', at: at(-0.6, 0), label: 'Inbox', sub: 'one at a time' },
          { id: 'actor', kind: 'block', at: at(4.2, 0), size: 0.85, label: 'Actor', sub: 'owns the state', icon: 'Box', tint: 'green', status: 'ok' },
        ],
        links: [link('ta', 'inbox', 'send', { route: 'straight' }), link('tb', 'inbox', 'send', { route: 'straight' }), link('inbox', 'actor', 'one by one', { route: 'straight' })],
        flows: [flow(['ta', 'inbox', 'actor'], ('("inc", "x")'), 'event', 0, 2), flow(['tb', 'inbox', 'actor'], '("set", "y", 5)', 'event', 1, 2)],
        panel: {
          title: 'Ways to not share',
          icon: 'Copy',
          rows: [
            { text: 'Immutable objects', value: 'frozen dataclass' },
            { text: 'Thread-local', value: 'one conn per thread' },
            { text: 'Message passing', value: 'actor and inbox' },
          ],
          footer: { text: 'No shared state, no lock to wait on', tone: 'good' },
        },
        caption: 'Threads talk to the owner',
      },
      code: {
        language: 'python',
        title: 'A tiny actor',
        source: `class Actor:
    def __init__(self):
        self._inbox = queue.Queue()
        self._state = {}
        threading.Thread(target=self._loop, daemon=True).start()

    def send(self, msg):
        self._inbox.put(msg)           # callers never touch _state

    def _loop(self):
        while True:
            msg = self._inbox.get()
            if msg is None:
                return
            self._handle(msg)          # only this thread mutates state`,
        highlight: [8, 15],
      },
    },
    {
      title: 'Granularity',
      tag: 'tradeoff',
      heading: 'Finer locks mean more throughput and more ways to deadlock',
      eli5: 'One crayon box for the whole class never causes a standoff, but only one kid can draw. Giving each kid a few crayons is faster, but now they can swap and tangle. Handing out stickers fixes the order.',
      body: [
        'A **coarse** lock (one for the whole catalog) cannot deadlock on itself but serializes every thread. A lock **per entry** lets different items run in parallel, but an operation that touches two entries now needs two locks, and the order matters.',
        '**Lock striping** uses a fixed pool, say 32 locks picked by `hash(key) % 32`. Two keys can land on one stripe, so a two-key operation must sort the stripe indexes and take each distinct stripe once.',
      ],
      keyIdea: 'The finer the locks, the more parallelism you get and the more ordering rules you must follow.',
      metrics: { threads: '8 running', cpu: '70%', done: '8 of 8', cycle: 'needs order' },
      metricTones: { cpu: 'good', cycle: 'warn' },
      scene: {
        nodes: [
          { id: 'coarse', kind: 'block', at: at(-4.4, -2.4), size: 0.8, label: 'Coarse', sub: '1 lock, no deadlock', icon: 'Lock', tint: 'gray' },
          { id: 'fine', kind: 'block', at: at(0, 2.8), size: 0.8, label: 'Per entry', sub: 'many locks, order needed', icon: 'Grid3x3', tint: 'amber' },
          { id: 'stripe', kind: 'block', at: at(4.4, -2.4), size: 0.8, label: 'Striped', sub: '32 locks, sort stripes', icon: 'Rows3', tint: 'green', status: 'ok' },
        ],
        panel: {
          title: 'Three granularities',
          icon: 'Scale',
          rows: [
            { text: 'Coarse', value: 'safe, slow', tone: 'warn' },
            { text: 'Per entry', value: 'fast, order needed', tone: 'warn' },
            { text: 'Striped', value: 'fast, sort stripes', tone: 'good' },
          ],
          footer: { text: 'Benchmark before going finer', tone: 'muted' },
        },
        caption: 'Granularity is a throughput and risk dial',
      },
      code: {
        language: 'python',
        title: 'Two-key operation on a striped catalog',
        source: `class StripedCatalog:
    STRIPES = 32

    def __init__(self):
        self._stripes = [threading.Lock() for _ in range(self.STRIPES)]

    def _idx(self, sku):
        return hash(sku) % self.STRIPES

    def move_stock(self, a, b, n):
        idxs = sorted({self._idx(a), self._idx(b)})   # sort, dedupe
        with contextlib.ExitStack() as stack:
            for i in idxs:
                stack.enter_context(self._stripes[i])
            self._items[a].stock -= n
            self._items[b].stock += n`,
        highlight: [11, 13, 14],
      },
      quiz: {
        question: 'On a striped catalog, move_stock(a, b) and move_stock(b, a) run together and a and b hash to different stripes. What prevents a deadlock?',
        options: [
          'Taking the stripe of the first argument first',
          'Sorting the stripe indexes and locking in that order',
          'Using one extra lock per stripe',
          'Nothing needed, striping cannot deadlock',
        ],
        answer: 1,
        explain: 'Striping still gives many locks, so two-key operations need one global order. Sorting the stripe indexes gives every thread the same order, and deduping handles the case where both keys share a stripe.',
      },
    },
    {
      title: 'Callbacks',
      tag: 'case',
      heading: 'Never call unknown code while holding a lock',
      eli5: 'A kid holds the red crayon and shouts "someone else, do something!" The helper then needs the red crayon too. Hand the crayon back before asking anyone for help.',
      body: [
        'A method that runs a listener, a callback or an I/O call under its lock lets outside code take other locks. That code may call back into your class or wait on a thread that waits on you, and the cycle closes.',
        'Copy what you need under the lock, release it, then call out. Keep critical sections small, and never do I/O under a lock if you can help it.',
      ],
      keyIdea: 'Take a snapshot under the lock and make calls to other code after releasing it.',
      metrics: { threads: '2 blocked', cpu: '0%', done: '0 of 2', cycle: 'via callback' },
      metricTones: { threads: 'bad', done: 'bad', cycle: 'bad' },
      scene: {
        nodes: [
          { ...ta, at: at(-6, -3.2), status: 'hot', sub: 'deposit()', chips: [{ text: 'holds a._lock', tone: 'good' }, { text: 'listener wants b._lock', tone: 'bad' }] },
          { ...tb, at: at(-2.6, 3.2), status: 'hot', sub: 'deposit()', chips: [{ text: 'holds b._lock', tone: 'good' }, { text: 'listener wants a._lock', tone: 'bad' }] },
          { ...la, sub: 'a._lock', status: 'active' },
          { ...lb, sub: 'b._lock', status: 'active' },
        ],
        links: [
          link('ta', 'la', 'holds'),
          link('tb', 'lb', 'holds'),
          link('ta', 'lb', 'wants b._lock', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
          link('tb', 'la', 'wants a._lock', { style: 'dashed', labelTone: 'bad', route: 'straight' }),
        ],
        flows: [flow(['ta', 'lb'], 'notify()', 'error', 0, 2.2), flow(['tb', 'la'], 'notify()', 'error', 0.6, 2.2)],
        panel: {
          title: 'Call out after release',
          icon: 'Bell',
          code: 'def deposit(self, amt):\n    with self._lock:\n        self._balance += amt\n        snap = list(self._listeners)\n        bal = self._balance\n    for fn in snap:      # lock released\n        fn(bal)',
          footer: { text: 'No foreign code under a lock', tone: 'good' },
        },
        caption: 'A callback runs while the lock is held',
      },
    },
    {
      title: 'Finding hangs',
      tag: 'concept',
      heading: 'How to tell a deadlock from a slow system',
      eli5: 'If the class goes quiet, ask every kid "what are you holding and what are you waiting for?" If the answers form a circle, you have a standoff, not just a slow day.',
      body: [
        'A deadlocked process has 0% CPU and requests that never return. Dump the stack of every thread: each blocked one shows the line where it waits, and the locks it holds are in the frames above.',
        'Python has `faulthandler.dump_traceback_later` for a timed dump, and tools such as `py-spy dump` read a live process. Databases do the detection for you: they find the cycle and roll back one **victim**.',
      ],
      keyIdea: 'Dump every thread stack, match what each holds to what each waits for, and look for the circle.',
      metrics: { threads: '2 blocked', cpu: '0%', done: '0 of 2', cycle: 'found in dump' },
      metricTones: { cycle: 'warn' },
      scene: {
        nodes: [
          { ...ta, status: 'hot', chips: [{ text: 'line 7: lock_b', tone: 'bad' }] },
          { ...tb, status: 'hot', chips: [{ text: 'line 13: lock_a', tone: 'bad' }] },
          { id: 'dump', kind: 'block', at: at(3.6, 0), size: 0.8, label: 'thread dump', sub: 'who waits where', icon: 'FileSearch', tint: 'blue', status: 'active' },
        ],
        links: [link('ta', 'dump', 'stack', { route: 'straight' }), link('tb', 'dump', 'stack', { route: 'straight' })],
        flows: [flow(['ta', 'dump'], 'frames', 'data', 0, 1.6), flow(['tb', 'dump'], 'frames', 'data', 0.6, 1.6)],
        panel: {
          title: 'Reading a dump',
          icon: 'FileSearch',
          rows: [
            { text: 'Thread A', value: 'holds A, waits B', tone: 'warn' },
            { text: 'Thread B', value: 'holds B, waits A', tone: 'warn' },
            { text: 'Together', value: 'cycle', tone: 'bad' },
          ],
          footer: { text: 'Databases do this and abort a victim', tone: 'muted' },
        },
        caption: 'Match holds to waits',
      },
      code: {
        language: 'python',
        title: 'A timed stack dump',
        source: `import faulthandler, sys

# Watchdog: dump every thread stack once after 30 s, unless the work ends first.
faulthandler.dump_traceback_later(30, repeat=False)
run_work()
faulthandler.cancel_dump_traceback_later()   # finished in time, no dump

# Or dump on demand, for example from a signal handler or admin endpoint.
faulthandler.dump_traceback(file=sys.stderr, all_threads=True)`,
        highlight: [4, 6, 9],
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Which strategy to reach for',
      eli5: 'For a classroom: first try giving each kid their own crayons. If they must share, number the crayons. Only when you cannot number them, let kids give up and try again after a random wait.',
      body: [
        'Start by not sharing. When you must share, define one global order and enforce it with levels in dev. Use acquire-all-at-once for small fixed groups of locks.',
        'Use timeouts with jittered retries when order cannot be known up front, for example when locks live in different systems. Never hold a lock across I/O or a callback.',
      ],
      keyIdea: 'Prefer designs where the question does not arise, then ordering, then timeouts as the last resort.',
      metrics: { threads: '-', cpu: '-', done: '-', cycle: 'designed out' },
      metricTones: { cycle: 'good' },
      scene: {
        nodes: [
          { id: 's1', kind: 'block', at: at(-4.6, -2.8), size: 0.75, label: 'Share nothing', sub: 'first choice', icon: 'Copy', tint: 'green', status: 'ok' },
          { id: 's2', kind: 'block', at: at(0, -2.8), size: 0.75, label: 'Global order', sub: 'default for locks', icon: 'ListOrdered', tint: 'blue' },
          { id: 's3', kind: 'block', at: at(4.6, -2.8), size: 0.75, label: 'Take all', sub: 'small fixed sets', icon: 'Lock', tint: 'violet' },
          { id: 's4', kind: 'block', at: at(0, 3), size: 0.75, label: 'Timeout + retry', sub: 'last resort', icon: 'Timer', tint: 'amber' },
        ],
        panel: {
          title: 'Decision order',
          icon: 'ListChecks',
          rows: [
            { text: '1. Share nothing', value: 'no lock', tone: 'good' },
            { text: '2. One global order', value: 'cheap, checkable' },
            { text: '3. Take all at once', value: 'small groups' },
            { text: '4. Timeout and retry', value: 'unknown order', tone: 'warn' },
          ],
          footer: { text: 'Benchmark: finer is not always faster', tone: 'muted' },
        },
        caption: 'Cheapest safe option first',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: deadlock in one page',
      eli5: 'Two kids, two crayons, and each needs both. A standoff needs four things, and you stop it by changing one: number the crayons, grab both at once, give up after a while, or share nothing.',
      body: [
        'Deadlock needs **mutual exclusion**, **hold and wait**, **no preemption** and **circular wait** together. A cycle in the wait-for graph is the signature.',
        'Fix it with lock ordering (by key or by level), take-all-at-once, timeouts with jittered backoff, or by sharing nothing. Watch for livelock, self-deadlock, striped locks and callbacks under a lock.',
      ],
      keyIdea: 'Break one of the four conditions on purpose, and prefer designs where shared locks never need to nest.',
      metrics: { threads: '2 running', cpu: '30%', done: '2 of 2', cycle: 'impossible' },
      metricTones: { threads: 'good', done: 'good', cycle: 'good' },
      scene: {
        nodes: [
          { ...ta, status: 'ok' },
          { ...tb, status: 'ok' },
          { ...la, status: 'ok' },
          { ...lb, status: 'ok' },
        ],
        links: [link('ta', 'la', 'A first'), link('ta', 'lb', 'then B', { route: 'straight' }), link('tb', 'la', 'A first', { route: 'straight' }), link('tb', 'lb', 'then B')],
        flows: [flow(['ta', 'la'], 'A', 'request', 0), flow(['ta', 'lb'], 'B', 'request', 0.9), flow(['tb', 'la'], 'A', 'request', 2.2), flow(['tb', 'lb'], 'B', 'request', 3.1)],
        panel: {
          title: 'Fixes at a glance',
          icon: 'CheckCircle',
          rows: [
            { text: 'Circular wait', value: 'order, levels', tone: 'good' },
            { text: 'Hold and wait', value: 'take all' },
            { text: 'No preemption', value: 'timeout, jitter' },
            { text: 'Mutual exclusion', value: 'share nothing' },
          ],
        },
        caption: 'One global order for everyone',
      },
      quiz: {
        question: 'A team adds a 1 second timeout to every lock acquire and retries immediately with no delay. Under heavy load both threads keep timing out, retry counters climb and no transfer completes. What is this and what fixes it?',
        options: [
          'A deadlock, fix it by adding more locks',
          'A livelock, fix it with exponential backoff and random jitter',
          'A race condition, fix it by removing the timeout',
          'A memory leak, fix it by releasing locks later',
        ],
        answer: 1,
        explain: 'The threads are active but making no progress, which is a livelock. Random, growing waits desynchronize them so one of them gets both locks.',
      },
    },
  ],
};
