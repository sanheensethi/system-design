import type { Lesson, SceneFlow, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });
const flow = (path: string[], label: string, tone: SceneFlow['tone'], delay = 0, duration = 1.4): SceneFlow => ({ path, tone, label, delay, duration });

const ta: SceneNode = { id: 'ta', kind: 'worker', at: at(-6.4, -2.4), label: 'Thread A', sub: 'a kid at the board' };
const tb: SceneNode = { id: 'tb', kind: 'worker', at: at(-3.4, 2.6), label: 'Thread B', sub: 'another kid' };
const counter: SceneNode = { id: 'counter', kind: 'block', at: at(0, 0), label: 'counter', sub: 'shared int', icon: 'Hash', tint: 'amber' };
const lock: SceneNode = { id: 'lock', kind: 'vault', at: at(4, 0), label: 'Lock', sub: 'one holder at a time' };

export const lldLocksRaces: Lesson = {
  id: 'lld-locks-races',
  title: 'Locks and races (part 1)',
  tagline: 'Why two threads break a clean class, and the synchronization primitives, thread-safe structures and patterns that fix it.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Why counter += 1 loses updates even with the GIL, and the check-then-act bank bug',
    'Lock, RLock, Semaphore, Event and Condition: what each one is for',
    'Compare-and-swap and why it matters even in Python',
    'Thread-safe counter, queue.Queue and copy-on-write collections',
    'Producer-consumer, reader-writer lock, thread pools and double-checked locking',
  ],
  metrics: [
    { key: 'value', label: 'Shared value', icon: 'Hash' },
    { key: 'safe', label: 'Thread-safe', icon: 'Shield' },
    { key: 'cost', label: 'Cost', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Lost counts',
      tag: 'problem',
      heading: 'Ten threads, one counter, a different wrong answer every run',
      eli5: 'Ten kids each walk up to the classroom whiteboard and add one tally mark, 100,000 times. When they finish, the board says a smaller number than it should, and a different one every day.',
      body: [
        'Ten threads each run `counter += 1` 100,000 times. The answer should be **1,000,000**. Example output is 742,381, then 893,004. Results vary by Python version and machine. CPython 3.10 and later makes the race rarer, and free-threaded builds make it common. A rare bug is still a bug.',
        'Nothing crashed and no error appeared. The class design looks clean and the bug lives in the timing. That is what makes concurrency bugs the hardest kind to find.',
      ],
      keyIdea: 'A race condition gives a wrong answer without any error, and a different wrong answer each run.',
      metrics: { value: 'e.g. 742,381 (want 1,000,000)', safe: 'no', cost: '-' },
      metricTones: { value: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...ta, status: 'active', chips: ['counter += 1'] },
          { ...tb, status: 'active', chips: ['counter += 1'] },
          { ...counter, status: 'hot', badge: '742,381' },
        ],
        links: [link('ta', 'counter', 'writes', { arrow: 'end' }), link('tb', 'counter', 'writes', { arrow: 'end' })],
        flows: [flow(['ta', 'counter'], '+1', 'request', 0), flow(['tb', 'counter'], '+1', 'request', 0.4)],
        panel: {
          title: 'Ten threads, 100,000 each',
          icon: 'Bug',
          rows: [
            { text: 'Expected', value: '1,000,000', tone: 'good' },
            { text: 'Example run 1', value: '742,381', tone: 'bad' },
            { text: 'Example run 2', value: '893,004', tone: 'bad' },
            { text: 'Run 3', value: 'varies by run', tone: 'warn' },
          ],
          footer: { text: 'No exception, just a wrong number', tone: 'bad' },
        },
        caption: 'Same code, a different answer every run',
      },
      code: {
        language: 'python',
        title: 'The famous racy counter',
        source: `import threading

counter = 0

def increment():
    global counter
    for _ in range(100_000):
        counter += 1          # NOT atomic

threads = [threading.Thread(target=increment) for _ in range(10)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)   # expected 1_000_000, example output 742_381 (varies by version)`,
        highlight: [8],
      },
    },
    {
      title: 'The GIL',
      tag: 'concept',
      heading: 'The GIL does not make your code thread-safe',
      eli5: 'Only one kid may hold the chalk at any moment, which is the **GIL**. But a kid can hand the chalk over in the middle of doing sums, so the board still gets muddled.',
      body: [
        'CPython has a **Global Interpreter Lock**. It runs one bytecode at a time. Some people think that makes shared data safe.',
        'It only guarantees that a single bytecode is atomic. `counter += 1` compiles to four: load, load, add, store. A thread switch can land between any two of them, so every pattern in this lesson still applies.',
      ],
      keyIdea: 'The GIL makes single bytecodes atomic. A statement that takes several bytecodes can still be cut in half.',
      metrics: { value: '-', safe: 'no', cost: '-' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...ta, chips: ['running'] },
          { id: 'gil', kind: 'block', at: at(0, -2.6), label: 'GIL', sub: 'one bytecode at a time', icon: 'Cpu', tint: 'gray' },
          { ...tb, chips: [{ text: 'waiting for GIL', tone: 'warn' }] },
          { ...counter, at: at(4, 0) },
        ],
        links: [link('ta', 'gil'), link('gil', 'counter', 'bytecodes'), link('tb', 'gil')],
        flows: [flow(['ta', 'gil', 'counter'], 'LOAD', 'request', 0, 1.6), flow(['tb', 'gil', 'counter'], 'LOAD', 'request', 1.8, 1.6)],
        panel: {
          title: 'counter += 1 is four bytecodes',
          icon: 'Binary',
          code: 'LOAD  counter\nLOAD  1\nADD\nSTORE counter\n# a switch may happen\n# between any two lines',
          footer: { text: 'Atomic per bytecode, not per statement', tone: 'warn' },
        },
        caption: 'One bytecode at a time still leaves gaps',
      },
    },
    {
      title: 'Lost update',
      tag: 'concept',
      heading: 'Read, add, write: how an update gets lost',
      eli5: 'Two kids both read "5" off the board. Each adds one in their head and writes "6". The board should say 7, but both wrote the same 6, so one tally mark vanished.',
      body: [
        'Break the statement apart: `tmp = counter` (read), `tmp = tmp + 1` (add), `counter = tmp` (write). Two threads can each read 5, each compute 6, and each write 6.',
        'That is a **lost update**. A **race condition** is any bug where the result depends on how the threads happen to interleave.',
      ],
      keyIdea: 'A read-modify-write on shared state is three steps. If another thread slips in between, its work is overwritten.',
      metrics: { value: '6 (want 7)', safe: 'no', cost: '-' },
      metricTones: { value: 'bad' },
      scene: {
        nodes: [
          { ...ta, chips: [{ text: 'tmp = 5', tone: 'default' }, { text: 'write 6', tone: 'warn' }] },
          { ...tb, chips: [{ text: 'tmp = 5', tone: 'default' }, { text: 'write 6', tone: 'warn' }] },
          { ...counter, status: 'hot', badge: '6, should be 7' },
        ],
        links: [link('counter', 'ta', 'read', { arrow: 'end' }), link('counter', 'tb', 'read', { arrow: 'end' })],
        flows: [
          flow(['counter', 'ta'], 'read 5', 'response', 0, 1.1),
          flow(['counter', 'tb'], 'read 5', 'response', 0.3, 1.1),
          flow(['ta', 'counter'], 'write 6', 'error', 1.5, 1.1),
          flow(['tb', 'counter'], 'write 6', 'error', 1.9, 1.1),
        ],
        panel: {
          title: 'One bad interleaving',
          icon: 'Table',
          rows: [
            { text: 'A reads counter', value: '5' },
            { text: 'B reads counter', value: '5' },
            { text: 'A writes counter', value: '6' },
            { text: 'B writes counter', value: '6', tone: 'bad' },
          ],
          footer: { text: 'Should be 7. One increment is lost', tone: 'bad' },
        },
        caption: 'Both threads write the same new value',
      },
    },
    {
      title: 'Check then act',
      tag: 'case',
      heading: 'Case: the bank transfer that goes negative',
      eli5: 'The class piggy bank holds 100 coins. Two kids both peek, see 100, and each take out 100. The check was true for both, but only one withdrawal should have been allowed.',
      body: [
        'Two threads call `transfer(src, dst, 100)` while `src.balance` is 100. Both pass the `if`, both subtract. The account ends at **-100**.',
        'This is **TOCTOU**: time of check to time of use. The check was true when it ran and false by the time the code acted on it.',
      ],
      keyIdea: 'Check-then-act is a race even when each line is correct. The check and the act must happen as one unit.',
      metrics: { value: '-100 (want 0)', safe: 'no', cost: '-' },
      metricTones: { value: 'bad' },
      scene: {
        nodes: [
          { ...ta, chips: ['balance >= 100: ok'] },
          { ...tb, chips: ['balance >= 100: ok'] },
          { id: 'src', kind: 'block', at: at(0, 0), label: 'Account', sub: 'balance 100', icon: 'Database', tint: 'green', status: 'hot', badge: '-100' },
        ],
        links: [link('ta', 'src', 'withdraw 100'), link('tb', 'src', 'withdraw 100')],
        flows: [flow(['ta', 'src'], 'balance -= 100', 'request', 0), flow(['tb', 'src'], 'balance -= 100', 'error', 0.6)],
        panel: {
          title: 'Check, then act',
          icon: 'Code',
          code: 'def transfer(src, dst, amount):\n    if src.balance >= amount:\n        src.balance -= amount\n        dst.balance += amount',
          footer: { text: 'Both threads pass the if before either subtracts', tone: 'bad' },
        },
        caption: 'The check went stale before the act',
      },
      code: {
        language: 'python',
        title: 'Account.transfer with a TOCTOU window',
        source: `class Account:
    def __init__(self, balance):
        self.balance = balance

def transfer(src, dst, amount):
    if src.balance >= amount:       # check
        src.balance -= amount       # act (another thread may have run in between)
        dst.balance += amount`,
        highlight: [6, 7],
      },
    },
    {
      title: 'Mutex',
      tag: 'concept',
      heading: 'Lock: let one thread through at a time',
      eli5: 'Put one marker in a box by the board. A kid must hold the marker to write, and the next kid waits until it is put back. That marker is the **lock**.',
      body: [
        'A **Lock** (mutex) enforces mutual exclusion: at most one thread holds it. The code between acquire and release is the **critical section**.',
        'Wrap the shared update in `with lock:`. It acquires on entry and always releases on exit, even when an exception is thrown. The counter now ends at 1,000,000 every time.',
      ],
      keyIdea: 'A lock turns a multi-step update into one indivisible unit, as long as every thread uses the same lock.',
      metrics: { value: '1,000,000', safe: 'yes', cost: 'critical section serialized' },
      metricTones: { value: 'good', safe: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { ...ta, status: 'active', chips: [{ text: 'holds lock', tone: 'good' }] },
          { ...tb, chips: [{ text: 'waiting', tone: 'warn' }] },
          { ...counter, status: 'ok', badge: '1,000,000' },
          { ...lock, status: 'active' },
        ],
        links: [link('ta', 'lock', 'acquire()'), link('tb', 'lock', 'acquire()', { labelTone: 'warn' }), link('lock', 'counter', 'guards', { arrow: 'none' })],
        flows: [flow(['ta', 'lock'], 'acquire()', 'handshake', 0), flow(['lock', 'counter'], 'counter += 1', 'request', 1.2), flow(['ta', 'lock'], 'release()', 'response', 2.6)],
        panel: {
          title: 'with lock:',
          icon: 'Key',
          code: 'lock = threading.Lock()\n\ndef increment():\n    for _ in range(100_000):\n        with lock:\n            counter += 1',
          footer: { text: 'Acquire on enter, release on exit', tone: 'good' },
        },
        caption: 'One thread inside the critical section',
      },
      code: {
        language: 'python',
        title: 'The counter, fixed with a Lock',
        source: `import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:          # acquire on enter, release on exit
            counter += 1

threads = [threading.Thread(target=increment) for _ in range(10)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)   # 1_000_000, every time`,
        highlight: [9, 10],
      },
    },
    {
      title: 'Lock cost',
      tag: 'tradeoff',
      heading: 'Correctness has a price: keep the critical section small',
      eli5: 'With one marker, only one kid writes at a time. The line behind them grows. The longer a kid holds the marker, the longer everyone else stands around.',
      body: [
        'The locked counter runs about **5 to 10 times slower** than the racy one. Locks serialize threads through the critical section, so extra threads mostly wait.',
        'Put only the shared update inside the lock. Never do I/O or sleep while holding it. A thread that stalls under a lock stalls every thread behind it.',
      ],
      keyIdea: 'The cost of a lock is the time spent holding it. Hold it for as little work as possible.',
      metrics: { value: '1,000,000', safe: 'yes', cost: '5 to 10x slower' },
      metricTones: { value: 'good', safe: 'good', cost: 'bad' },
      scene: {
        nodes: [
          { ...ta, status: 'active', load: 95, chips: [{ text: 'holds lock', tone: 'good' }] },
          { ...tb, chips: [{ text: 'waiting', tone: 'warn' }], load: 10 },
          { ...lock, status: 'hot' },
        ],
        links: [link('ta', 'lock'), link('tb', 'lock', 'blocked', { labelTone: 'warn' })],
        flows: [flow(['ta', 'lock'], 'slow I/O under lock', 'error', 0, 1.8)],
        panel: {
          title: 'What to keep inside',
          icon: 'Gauge',
          rows: [
            { text: 'counter += 1', value: 'inside', tone: 'good' },
            { text: 'read a file', value: 'outside', tone: 'warn' },
            { text: 'network call', value: 'outside', tone: 'warn' },
            { text: 'time.sleep', value: 'never inside', tone: 'bad' },
          ],
          footer: { text: 'Small critical sections, short waits', tone: 'good' },
        },
        caption: 'Waiting threads add no throughput',
      },
    },
    {
      title: 'Self-deadlock',
      tag: 'case',
      heading: 'Case: a plain Lock hangs when the same thread asks twice',
      eli5: 'A kid holds the marker and calls another helper kid, who also needs the marker. The helper waits for the marker the first kid holds, and the first kid waits for the helper. Nobody moves.',
      body: [
        'Public methods often call each other. `outer()` takes the lock and calls `inner()`, which takes the same lock. A plain `Lock` does not know who holds it, so the second acquire blocks forever.',
        'The thread is waiting for itself. No error is raised. The program just hangs.',
      ],
      keyIdea: 'A plain Lock is not reentrant. Acquiring it twice from one thread blocks that thread forever.',
      metrics: { value: 'hung', safe: 'no', cost: '-' },
      metricTones: { value: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...ta, status: 'hot', chips: [{ text: 'blocked on itself', tone: 'bad' }] },
          { id: 'outer', kind: 'block', at: at(-1, 0), label: 'outer()', sub: 'takes the lock', icon: 'Code', tint: 'green' },
          { id: 'inner', kind: 'block', at: at(3, -2), label: 'inner()', sub: 'needs it again', icon: 'Code', tint: 'green' },
          { ...lock, at: at(3, 3), status: 'down', sub: 'held by Thread A' },
        ],
        links: [link('ta', 'outer'), link('outer', 'inner', 'calls'), link('inner', 'lock', 'acquire()', { labelTone: 'bad' })],
        flows: [flow(['ta', 'outer', 'inner'], 'outer()', 'request', 0), flow(['inner', 'lock'], 'acquire() again', 'error', 2.2)],
        panel: {
          title: 'Plain Lock',
          icon: 'Bug',
          code: 'def outer():\n    with lock:\n        inner()   # hangs\n\ndef inner():\n    with lock:\n        do_work()',
          footer: { text: 'The same thread waits for itself', tone: 'bad' },
        },
        caption: 'Second acquire never returns',
      },
    },
    {
      title: 'RLock',
      tag: 'concept',
      heading: 'RLock: the lock that remembers its owner',
      eli5: 'This marker has a name tag and a counter. The same kid can pick it up again without waiting, and must put it down as many times as they picked it up.',
      body: [
        'An **RLock** (reentrant lock) tracks the owning thread and a count. The owner can acquire it N times and must release N times. Other threads wait until the count returns to 0.',
        'Use it when public methods call each other and both need the lock. Use a plain Lock when you want the discipline of no recursive acquisition.',
      ],
      keyIdea: 'RLock lets one thread re-enter its own lock. Other threads still wait.',
      metrics: { value: 'works', safe: 'yes', cost: 'small bookkeeping' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...ta, status: 'active', chips: [{ text: 'transfer_to()', tone: 'default' }] },
          { id: 'acct', kind: 'block', at: at(0, -1), label: 'BankAccount', sub: 'concrete class', icon: 'Database', tint: 'green' },
          { id: 'rlock', kind: 'vault', at: at(4, 1), label: 'RLock', sub: 'owner A, count 2', status: 'ok' },
        ],
        links: [link('ta', 'acct', 'calls'), link('acct', 'rlock', 'has-a')],
        flows: [flow(['ta', 'acct'], 'transfer_to()', 'request', 0), flow(['acct', 'rlock'], 'acquire (1)', 'handshake', 1.2), flow(['acct', 'rlock'], 'acquire (2)', 'handshake', 2.4)],
        panel: {
          title: 'RLock state',
          icon: 'Key',
          rows: [
            { text: 'Owner', value: 'Thread A' },
            { text: 'transfer_to() acquires', value: 'count 1' },
            { text: 'withdraw() acquires', value: 'count 2', tone: 'good' },
            { text: 'Other threads', value: 'wait until 0', tone: 'warn' },
          ],
        },
        caption: 'Same owner may re-enter',
      },
      code: {
        language: 'python',
        title: 'BankAccount with an RLock',
        source: `import threading

class BankAccount:
    def __init__(self, balance):
        self._balance = balance
        self._lock = threading.RLock()

    def deposit(self, amount):
        with self._lock:
            self._balance += amount

    def transfer_to(self, other, amount):
        with self._lock:              # acquire 1
            self.withdraw(amount)     # acquires again
            other.deposit(amount)

    def withdraw(self, amount):
        with self._lock:              # acquire 2, RLock allows it
            if self._balance < amount:
                raise ValueError("insufficient funds")
            self._balance -= amount`,
        highlight: [13, 14, 18, 19],
      },
      quiz: {
        question: 'A method holding a plain threading.Lock calls another method that acquires the same lock. What happens?',
        options: [
          'The second acquire succeeds because it is the same thread',
          'It raises a RuntimeError at once',
          'The thread blocks forever waiting for itself',
          'The first lock is released automatically',
        ],
        answer: 2,
        explain: 'A plain Lock does not record its owner, so the second acquire waits for a release that the same thread can never perform. An RLock records the owner and a count, so the same thread may re-enter.',
      },
    },
    {
      title: 'Semaphore',
      tag: 'concept',
      heading: 'Semaphore: a lock with room for N holders',
      eli5: 'The class has 3 swings and 10 kids. A **semaphore** is a bucket of 3 tokens. A kid takes a token to swing and puts it back after. The fourth kid waits for a free token.',
      body: [
        'A **Semaphore(N)** lets up to N threads inside at once. The N+1th waits until one leaves. It is the tool for bounded resource pools.',
        'Typical uses: a connection pool, a rate limit on outbound API calls, and capacity bounds in producer-consumer.',
      ],
      keyIdea: 'A Lock is a semaphore of 1. Use a semaphore when N concurrent users are fine but N+1 is not.',
      metrics: { value: '3 inside', safe: 'yes', cost: '7 waiting' },
      metricTones: { safe: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { id: 'c1', kind: 'worker', at: at(-6.4, -4), label: 'Thread t0', sub: 'inside', status: 'active' },
          { id: 'c2', kind: 'worker', at: at(-3.4, 0), label: 'Thread t1', sub: 'inside', status: 'active' },
          { id: 'c3', kind: 'worker', at: at(-6.4, 4), label: 'Thread t9', sub: 'waiting', status: 'dim' },
          { id: 'sem', kind: 'vault', at: at(0, 0), label: 'Semaphore(3)', sub: '3 tokens' },
          { id: 'api', kind: 'block', at: at(4, 0), label: 'External API', sub: 'max 3 calls', icon: 'Globe', tint: 'gray' },
        ],
        links: [link('c1', 'sem'), link('c2', 'sem'), link('c3', 'sem', 'blocked', { labelTone: 'warn' }), link('sem', 'api', 'uses')],
        flows: [flow(['c1', 'sem', 'api'], 'call_api()', 'request', 0, 1.6), flow(['c2', 'sem', 'api'], 'call_api()', 'request', 0.5, 1.6)],
        panel: {
          title: 'Semaphore(3) with 10 threads',
          icon: 'Gauge',
          rows: [
            { text: 'Inside the with block', value: '3', tone: 'good' },
            { text: 'Waiting for a token', value: '7', tone: 'warn' },
            { text: 'Token returned on exit', value: 'next one enters' },
          ],
        },
        caption: 'At most three calls in flight',
      },
      code: {
        language: 'python',
        title: 'At most 3 concurrent API calls',
        source: `import threading, time, random

api_semaphore = threading.Semaphore(3)

def call_api(name):
    with api_semaphore:
        print(f"{name} entering")
        time.sleep(random.uniform(0.1, 0.3))
        print(f"{name} leaving")

threads = [threading.Thread(target=call_api, args=(f"t{i}",)) for i in range(10)]
for t in threads: t.start()
for t in threads: t.join()`,
        highlight: [3, 6],
      },
    },
    {
      title: 'Event',
      tag: 'concept',
      heading: 'Event: one-shot signaling between threads',
      eli5: 'The teacher holds up a flag. Kids waiting at the door cannot go until the flag goes up. A kid who arrives late sees it is already up and walks straight in. That is an **event**.',
      body: [
        'An **Event** is a boolean flag with wait-until-true behavior. `wait()` blocks until another thread calls `set()`. After that, every `wait()` returns at once, including late arrivals.',
        '`clear()` resets it. Use an Event to say "start" or "stop", not to guard data.',
      ],
      keyIdea: 'An Event signals that something has happened. It carries no data and protects nothing.',
      metrics: { value: '-', safe: 'yes', cost: '-' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 'w1', kind: 'worker', at: at(-6.4, -3), label: 'Worker 1', sub: 'wait()', chips: [{ text: 'blocked', tone: 'warn' }] },
          { id: 'w2', kind: 'worker', at: at(-3.4, 3), label: 'Worker 2', sub: 'wait()', chips: [{ text: 'blocked', tone: 'warn' }] },
          { id: 'ev', kind: 'block', at: at(0, 0), label: 'ready', sub: 'Event, flag False', icon: 'Zap', tint: 'violet' },
          { id: 'launcher', kind: 'worker', at: at(4, 0), label: 'Launcher', sub: 'sleeps 2 s, then set()' },
        ],
        links: [link('w1', 'ev', 'wait()'), link('w2', 'ev', 'wait()'), link('launcher', 'ev', 'set()')],
        flows: [flow(['launcher', 'ev'], 'set()', 'event', 0, 1.4), flow(['ev', 'w1'], 'go!', 'response', 1.6, 1.2), flow(['ev', 'w2'], 'go!', 'response', 1.8, 1.2)],
        panel: {
          title: 'Event methods',
          icon: 'List',
          rows: [
            { text: 'wait()', value: 'block until set' },
            { text: 'set()', value: 'flag = True, wake all', tone: 'good' },
            { text: 'clear()', value: 'flag = False' },
            { text: 'wait() after set()', value: 'returns at once', tone: 'good' },
          ],
        },
        caption: 'One signal wakes every waiter',
      },
      code: {
        language: 'python',
        title: 'Start signal',
        source: `import threading, time

ready = threading.Event()

def worker():
    print("waiting for start signal...")
    ready.wait()          # blocks until ready.set()
    print("go!")

def launcher():
    time.sleep(2)
    print("firing start signal")
    ready.set()

threading.Thread(target=worker).start()
threading.Thread(target=worker).start()
threading.Thread(target=launcher).start()`,
        highlight: [7, 13],
      },
    },
    {
      title: 'Condition',
      tag: 'concept',
      heading: 'Condition variable: wait for state, not just for a lock',
      eli5: 'A cubby shelf holds 3 lunchboxes. A kid who wants to add one when it is full sits down and waits. A kid who wants one when it is empty waits too. Whoever changes the shelf rings a little bell.',
      body: [
        'A **Condition** bundles a lock with a wait queue. `wait()` releases the lock, sleeps, and reacquires the lock on wake. `notify_all()` wakes the waiters.',
        'A bounded buffer needs two waits: producers wait while it is full, consumers wait while it is empty. Both use one Condition around the same lock.',
      ],
      keyIdea: 'A Condition lets a thread sleep until the shared state it needs is true, without spinning and without holding the lock.',
      metrics: { value: 'buffer 2 of 3', safe: 'yes', cost: '-' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 'prod', kind: 'worker', at: at(-4, -2), label: 'Producer', sub: 'put(item)' },
          { id: 'buf', kind: 'block', at: at(0, 0), label: 'BoundedBuffer', sub: 'capacity 3', icon: 'Layers', tint: 'green', chips: ['2 of 3 full'] },
          { id: 'cons', kind: 'worker', at: at(4, -2), label: 'Consumer', sub: 'get()' },
          { id: 'cond', kind: 'vault', at: at(0, 4), label: 'Condition', sub: 'lock + wait queue' },
        ],
        links: [link('prod', 'buf', 'put'), link('buf', 'cons', 'get'), link('buf', 'cond', 'has-a')],
        flows: [flow(['prod', 'buf'], 'put(item)', 'request', 0), flow(['buf', 'cond'], 'notify_all()', 'event', 1.2), flow(['buf', 'cons'], 'item', 'response', 2.4)],
        panel: {
          title: 'Two waits, one Condition',
          icon: 'Table',
          rows: [
            { text: 'put() when full', value: 'wait()', tone: 'warn' },
            { text: 'get() when empty', value: 'wait()', tone: 'warn' },
            { text: 'after append or pop', value: 'notify_all()', tone: 'good' },
          ],
        },
        caption: 'Sleep until the state is right',
      },
      code: {
        language: 'python',
        title: 'BoundedBuffer with a Condition',
        source: `import threading
from collections import deque

class BoundedBuffer:
    def __init__(self, capacity):
        self._buf = deque()
        self._capacity = capacity
        self._cond = threading.Condition()

    def put(self, item):
        with self._cond:
            while len(self._buf) == self._capacity:
                self._cond.wait()          # releases lock, waits, reacquires
            self._buf.append(item)
            self._cond.notify_all()        # wake waiting consumers

    def get(self):
        with self._cond:
            while not self._buf:
                self._cond.wait()
            item = self._buf.popleft()
            self._cond.notify_all()        # wake waiting producers
            return item`,
        highlight: [12, 13, 20, 21],
      },
    },
    {
      title: 'While, not if',
      tag: 'tradeoff',
      heading: 'Always wait in a while loop',
      eli5: 'The bell rings, but by the time you reach the shelf another kid already grabbed the lunchbox. You must look again before you take it. One look is not enough.',
      body: [
        '**Spurious wakeups** are real, and `notify_all()` wakes many waiters when only one can proceed. By the time a woken thread holds the lock again, the state may have changed.',
        'Re-check the condition after `wait()` returns. `if` is a bug. `while` is correct.',
      ],
      keyIdea: 'A wakeup says "something changed", not "your condition is true". Loop and check again.',
      metrics: { value: 'buffer 0 of 3', safe: 'while only', cost: '-' },
      metricTones: { safe: 'warn' },
      scene: {
        nodes: [
          { id: 'c1', kind: 'worker', at: at(-6.4, -3), label: 'Consumer 1', sub: 'woken', chips: [{ text: 'takes the item', tone: 'good' }] },
          { id: 'buf', kind: 'block', at: at(0, 0), label: 'BoundedBuffer', sub: 'now empty again', icon: 'Layers', tint: 'green', status: 'dim' },
          { id: 'c2', kind: 'worker', at: at(-3.4, 3), label: 'Consumer 2', sub: 'woken too', chips: [{ text: 'if: pops empty!', tone: 'bad' }] },
          { id: 'cond', kind: 'vault', at: at(4, 0), label: 'Condition', sub: 'notify_all()' },
        ],
        links: [link('cond', 'c1', 'wakes'), link('cond', 'c2', 'wakes'), link('c1', 'buf'), link('c2', 'buf')],
        flows: [flow(['cond', 'c1', 'buf'], 'popleft()', 'response', 0, 1.6), flow(['cond', 'c2', 'buf'], 'popleft()', 'error', 1.8, 1.6)],
        panel: {
          title: 'The two shapes',
          icon: 'Code',
          code: '# bug\nif not buf:\n    cond.wait()\n\n# correct\nwhile not buf:\n    cond.wait()',
          footer: { text: 'Re-check after every wakeup', tone: 'good' },
        },
        caption: 'Two woken, one item',
      },
    },
    {
      title: 'CAS',
      tag: 'concept',
      heading: 'Compare-and-swap: update without a lock',
      eli5: 'A kid says "if the board still says 5, change it to 6, otherwise tell me". If someone else changed it first, the kid looks at the new number and tries again. No marker needed.',
      body: [
        '**Compare-and-swap** is one CPU instruction: if memory holds the expected value, store the new one and report success. Otherwise change nothing and report failure. The whole check-and-write is atomic.',
        'The caller loops: load, compute, CAS, and retry if someone got there first. Python itself has no CAS in the stdlib, but Java `AtomicInteger` and C++ `std::atomic` use it, and lock-free structures are built on it.',
      ],
      keyIdea: 'CAS replaces a lock with a retry loop. It never blocks, but it may repeat work.',
      metrics: { value: '6', safe: 'yes', cost: 'retries under contention' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...ta, chips: ['load = 5'] },
          { ...tb, chips: ['load = 5'] },
          { id: 'atom', kind: 'block', at: at(0, 0), label: 'atom', sub: 'atomic int', icon: 'Zap', tint: 'teal', badge: '6' },
        ],
        links: [link('ta', 'atom', 'CAS(5, 6)'), link('tb', 'atom', 'CAS(5, 6)', { labelTone: 'warn' })],
        flows: [flow(['ta', 'atom'], 'CAS(5, 6) ok', 'request', 0, 1.4), flow(['atom', 'ta'], 'True', 'response', 1.5, 1.0), flow(['tb', 'atom'], 'CAS(5, 6)', 'error', 2.6, 1.4), flow(['atom', 'tb'], 'False, retry', 'error', 4.1, 1.0)],
        panel: {
          title: 'CAS as pseudocode',
          icon: 'Binary',
          code: 'atomic {\n    if memory[addr] == expected:\n        memory[addr] = new\n        return True\n    return False\n}',
          footer: { text: 'One CPU instruction, no lock', tone: 'good' },
        },
        caption: 'The loser sees False and retries',
      },
      code: {
        language: 'python',
        title: 'Lock-free counter idiom (pseudo-Python)',
        source: `def atomic_increment(atom):
    while True:
        current = atom.load()
        if atom.compare_and_swap(current, current + 1):
            return current + 1
        # else: someone beat us, retry`,
        highlight: [2, 4],
      },
    },
    {
      title: 'Safe counter',
      tag: 'concept',
      heading: 'Build the lock into the class: ThreadSafeCounter',
      eli5: 'Instead of every kid remembering the marker rule, put the board and its marker in one little box. Kids can only use the box, and the box handles the rule.',
      body: [
        'Callers should not have to remember a lock. A thread-safe class owns its lock and takes it inside each public method, so correct use is the only use.',
        'Reads take the lock too. On CPython a plain read is less of a problem, but in Java or C++ an unsynchronized 64-bit read can return a **torn value**, half old and half new.',
      ],
      keyIdea: 'Encapsulate the lock with the data it guards. Every public method, reads included, goes through it.',
      metrics: { value: 'exact', safe: 'yes', cost: 'one lock per call' },
      metricTones: { value: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...ta, chips: ['increment()'] },
          { id: 'tsc', kind: 'block', at: at(0, 0), label: 'ThreadSafeCounter', sub: 'concrete class', icon: 'Hash', tint: 'green' },
          { id: 'tl', kind: 'vault', at: at(4, 0), label: 'Lock', sub: 'private field' },
          { ...tb, chips: ['value()'] },
        ],
        links: [link('ta', 'tsc', 'uses'), link('tb', 'tsc', 'uses'), link('tsc', 'tl', 'has-a')],
        flows: [flow(['ta', 'tsc', 'tl'], 'increment()', 'request', 0, 1.6), flow(['tb', 'tsc', 'tl'], 'value()', 'request', 1.8, 1.6)],
        panel: {
          title: 'Public methods hold the lock',
          icon: 'Shield',
          rows: [
            { text: 'increment()', value: 'with self._lock', tone: 'good' },
            { text: 'value()', value: 'with self._lock', tone: 'good' },
            { text: '_value', value: 'private', tone: 'muted' },
          ],
          footer: { text: 'Callers cannot forget the lock', tone: 'good' },
        },
        caption: 'The class guards its own state',
      },
      code: {
        language: 'python',
        title: 'ThreadSafeCounter',
        source: `import threading

class ThreadSafeCounter:
    def __init__(self):
        self._value = 0
        self._lock = threading.Lock()

    def increment(self):
        with self._lock:
            self._value += 1

    def value(self):
        with self._lock:
            return self._value`,
        highlight: [9, 13],
      },
    },
    {
      title: 'queue.Queue',
      tag: 'concept',
      heading: 'queue.Queue: thread-safe by design',
      eli5: 'The school has a mail slot with a basket. Kids drop notes in from one side and the teacher takes them out the other side. The slot already knows how to take turns, so nobody builds their own.',
      body: [
        '`queue.Queue` does all the locking and condition waiting for you. `put()` blocks when the queue is full and `get()` blocks when it is empty.',
        'Set `maxsize` to bound memory. When the stdlib gives you a thread-safe tool, use it before writing your own.',
      ],
      keyIdea: 'Prefer stdlib primitives such as queue.Queue over hand-rolled locks and conditions.',
      metrics: { value: 'queue 100 max', safe: 'yes', cost: 'blocks when full or empty' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 'prod', kind: 'worker', at: at(-4, -2), label: 'Producer', sub: 'q.put(i)' },
          { id: 'q', kind: 'block', at: at(0, 0), label: 'Queue', sub: 'maxsize 100', icon: 'Inbox', tint: 'green', chips: ['locks inside'] },
          { id: 'cons', kind: 'worker', at: at(4, -2), label: 'Consumer', sub: 'q.get()' },
        ],
        links: [link('prod', 'q', 'put'), link('q', 'cons', 'get')],
        flows: [flow(['prod', 'q'], 'put(i)', 'request', 0), flow(['q', 'cons'], 'item', 'response', 1.5), flow(['cons', 'q'], 'task_done()', 'event', 2.9, 1.0)],
        panel: {
          title: 'Blocking built in',
          icon: 'Table',
          rows: [
            { text: 'put() when full', value: 'blocks', tone: 'warn' },
            { text: 'get() when empty', value: 'blocks', tone: 'warn' },
            { text: 'None sentinel', value: 'tells consumer to stop' },
          ],
        },
        caption: 'Locks and waits live inside the queue',
      },
      code: {
        language: 'python',
        title: 'One producer, one consumer',
        source: `import queue, threading

q = queue.Queue(maxsize=100)

def producer():
    for i in range(1000):
        q.put(i)             # blocks if full
    q.put(None)              # sentinel

def consumer():
    while True:
        item = q.get()       # blocks if empty
        if item is None:
            break
        process(item)
        q.task_done()

threading.Thread(target=producer).start()
threading.Thread(target=consumer).start()`,
        highlight: [3, 7, 12, 14],
      },
    },
    {
      title: 'Copy-on-write',
      tag: 'tradeoff',
      heading: 'Copy-on-write: readers never wait',
      eli5: 'The class schedule is printed on a sheet. To change it, the teacher prints a whole new sheet and swaps it onto the wall. Kids reading the old sheet are not disturbed.',
      body: [
        'A **copy-on-write** collection never changes in place. A write builds a new copy and swaps the reference. Readers iterate a snapshot with no lock, and old readers are unaffected.',
        'Great for config, listener lists and routing tables, where reads vastly outnumber writes. Terrible when writes are frequent, because every write copies all N items.',
      ],
      keyIdea: 'Copy-on-write trades expensive writes for free reads. It fits read-mostly data only.',
      metrics: { value: 'v2', safe: 'yes', cost: 'write O(N), read free' },
      metricTones: { safe: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { id: 'reader', kind: 'worker', at: at(-6, -2), label: 'Reader', sub: 'iterates v1, no lock' },
          { id: 'v1', kind: 'block', at: at(-1.2, -2), label: 'tuple v1', sub: 'old snapshot', icon: 'Package', tint: 'gray', status: 'dim' },
          { id: 'v2', kind: 'block', at: at(2.4, 3), label: 'tuple v2', sub: 'new copy + item', icon: 'Package', tint: 'green' },
          { id: 'writer', kind: 'worker', at: at(-3, 3), label: 'Writer', sub: 'append(item)' },
        ],
        links: [link('reader', 'v1', 'iter'), link('writer', 'v2', 'copy + swap')],
        flows: [flow(['reader', 'v1'], 'iter()', 'request', 0), flow(['writer', 'v2'], 'append()', 'data', 0.5)],
        panel: {
          title: 'Reads vs writes',
          icon: 'Gauge',
          rows: [
            { text: 'Read', value: 'lock-free', tone: 'good' },
            { text: 'Write', value: 'copies N items', tone: 'warn' },
            { text: 'Good for', value: 'config, listeners, routes' },
          ],
        },
        caption: 'Readers keep their snapshot',
      },
      code: {
        language: 'python',
        title: 'COWList',
        source: `class COWList:
    """Reads are lock-free; writes copy the whole list."""
    def __init__(self):
        self._data = ()
        self._lock = threading.Lock()

    def __iter__(self):
        return iter(self._data)   # snapshot; old readers unaffected

    def append(self, item):
        with self._lock:
            self._data = self._data + (item,)`,
        highlight: [8, 12],
      },
      quiz: {
        question: 'Which workload suits a copy-on-write collection best?',
        options: [
          'A counter updated by every request',
          'A listener list read 10,000 times for every change',
          'A queue with constant puts and gets',
          'A shopping cart edited on every click',
        ],
        answer: 1,
        explain: 'Every write copies the whole structure, so it only pays off when reads vastly outnumber writes. A counter, a queue and a busy cart all write constantly.',
      },
    },
    {
      title: 'Producer-consumer',
      tag: 'case',
      heading: 'Pattern: bounded producer-consumer with a poison pill',
      eli5: 'Two kids fill a basket with crayons and three kids empty it. The basket only holds 5, so fillers wait when it is full. When the fillers finish, the teacher drops in one "last one" card per emptier so each knows to stop.',
      body: [
        'Producers put items into a bounded queue. Consumers take them. The bound gives **back-pressure**: fast producers slow down instead of eating all memory.',
        'To shut down, the main thread joins the producers, then puts one `None` **poison pill** per consumer. Each consumer breaks on its first `None`, so nothing is dropped and no consumer re-queues a pill.',
      ],
      keyIdea: 'A bounded queue decouples fast and slow threads and caps memory. A poison pill shuts the pipeline down cleanly.',
      metrics: { value: 'queue 5 max', safe: 'yes', cost: '-' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 'p0', kind: 'worker', at: at(-6.4, -3), label: 'Producer P0', sub: 'puts items' },
          { id: 'p1', kind: 'worker', at: at(-3.4, 3), label: 'Producer P1', sub: 'puts items' },
          { id: 'pq', kind: 'block', at: at(0, 0), label: 'Queue(5)', sub: 'bounded', icon: 'Inbox', tint: 'green' },
          { id: 'k0', kind: 'worker', at: at(3.4, -3), label: 'Consumer C0', sub: 'gets items' },
          { id: 'k1', kind: 'worker', at: at(6.4, 3), label: 'Consumer C1', sub: 'stops on its pill' },
        ],
        links: [link('p0', 'pq'), link('p1', 'pq'), link('pq', 'k0'), link('pq', 'k1')],
        flows: [flow(['p0', 'pq', 'k0'], 'P0-7', 'request', 0, 2), flow(['p1', 'pq', 'k1'], 'P1-3', 'request', 0.6, 2), flow(['pq', 'k1'], 'None', 'event', 2.8, 1.2)],
        panel: {
          title: 'Shutdown',
          icon: 'List',
          rows: [
            { text: 'After producers join', value: 'one put(None) each consumer' },
            { text: 'Consumer sees None', value: 'break, exit' },
            { text: 'All consumers', value: 'stop, no items lost', tone: 'good' },
          ],
        },
        caption: 'Bounded queue, clean stop',
      },
      code: {
        language: 'python',
        title: 'Two producers, three consumers',
        source: `import threading, queue, time, random

def producer(q, name):
    for i in range(20):
        q.put(f"{name}-{i}")          # blocks if full
        time.sleep(random.random() * 0.05)

def consumer(q, name):
    while True:
        item = q.get()
        if item is None:
            break                      # one pill, one exit
        time.sleep(random.random() * 0.1)

q = queue.Queue(maxsize=5)
producers = [threading.Thread(target=producer, args=(q, f"P{i}")) for i in range(2)]
consumers = [threading.Thread(target=consumer, args=(q, f"C{i}")) for i in range(3)]
for t in producers + consumers: t.start()
for p in producers: p.join()           # all items are queued
for _ in consumers: q.put(None)        # one pill per consumer
for c in consumers: c.join()`,
        highlight: [11, 19, 20],
      },
    },
    {
      title: 'Reader-writer',
      tag: 'concept',
      heading: 'Reader-writer lock: many readers or one writer',
      eli5: 'Lots of kids can read the poster on the wall at the same time. But when the teacher wants to change the poster, everyone steps back until she is done.',
      body: [
        'Reads do not conflict with each other, so a plain Lock is too strict. An **RWLock** lets many readers in together, but a writer needs the data to itself.',
        'The stdlib does not ship one, so you build it from a Lock and two Conditions. Track the reader count, whether a writer is active and how many writers are waiting.',
      ],
      keyIdea: 'Shared access for readers, exclusive access for writers. It pays off when reads dominate.',
      metrics: { value: '2 readers in', safe: 'yes', cost: 'writer waits for 2' },
      metricTones: { safe: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { id: 'r1', kind: 'worker', at: at(-6, -3), label: 'Reader 1', sub: 'inside', status: 'active' },
          { id: 'r2', kind: 'worker', at: at(-3.4, 1.4), label: 'Reader 2', sub: 'inside', status: 'active' },
          { id: 'rw', kind: 'vault', at: at(0.4, -1.6), label: 'RWLock', sub: 'readers 2' },
          { id: 'data', kind: 'block', at: at(4, -1), label: 'Config', sub: 'read-mostly', icon: 'FileJson', tint: 'amber' },
          { id: 'wr', kind: 'worker', at: at(-0.2, 5), label: 'Writer', sub: 'waits for exclusive', chips: [{ text: 'waiting', tone: 'warn' }] },
        ],
        links: [link('r1', 'rw'), link('r2', 'rw'), link('rw', 'data', 'guards', { arrow: 'none' }), link('wr', 'rw', 'acquire_write()', { labelTone: 'warn' })],
        flows: [flow(['r1', 'rw', 'data'], 'read', 'request', 0), flow(['r2', 'rw', 'data'], 'read', 'request', 0.3)],
        panel: {
          title: 'Who may enter',
          icon: 'Table',
          rows: [
            { text: 'Reader + reader', value: 'allowed', tone: 'good' },
            { text: 'Reader + writer', value: 'blocked', tone: 'bad' },
            { text: 'Writer + writer', value: 'blocked', tone: 'bad' },
          ],
        },
        caption: 'Readers share, writers wait for quiet',
      },
    },
    {
      title: 'RWLock code',
      tag: 'tradeoff',
      heading: 'Writer starvation and the waiting-writers fix',
      eli5: 'If new kids keep joining the crowd reading the poster, the teacher never gets a turn. So once she is waiting, new kids must wait behind her.',
      body: [
        'A naive reader-preferring RWLock lets writers **starve**: under constant read load the reader count never reaches 0.',
        'The `_waiting_writers` counter fixes it. Once a writer is queued, new readers wait. Fairness is a policy choice, so pick it on purpose.',
      ],
      keyIdea: 'Every reader-writer lock must choose who goes first. Reader preference starves writers.',
      metrics: { value: 'writer served', safe: 'yes', cost: 'readers wait for it' },
      metricTones: { safe: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { id: 'r3', kind: 'worker', at: at(-4, -2), label: 'New reader', sub: 'arrives late', chips: [{ text: 'waits behind writer', tone: 'warn' }] },
          { id: 'rw', kind: 'vault', at: at(0, 0), label: 'RWLock', sub: 'waiting_writers 1' },
          { id: 'wr', kind: 'worker', at: at(4, -2), label: 'Writer', sub: 'queued first', status: 'active' },
        ],
        links: [link('r3', 'rw', 'acquire_read()', { labelTone: 'warn' }), link('wr', 'rw', 'acquire_write()')],
        flows: [flow(['wr', 'rw'], 'waiting_writers += 1', 'request', 0, 1.4), flow(['r3', 'rw'], 'wait()', 'error', 1.6, 1.4)],
        panel: {
          title: 'The check that stops starvation',
          icon: 'Code',
          code: 'def acquire_read(self):\n    with self._lock:\n        while self._writer or self._waiting_writers > 0:\n            self._read_ok.wait()\n        self._readers += 1',
          footer: { text: 'Readers yield once a writer queues', tone: 'good' },
        },
        caption: 'Writers get a turn',
      },
      code: {
        language: 'python',
        title: 'A writer-preferring RWLock',
        source: `class RWLock:
    def __init__(self):
        self._readers = 0
        self._lock = threading.Lock()
        self._read_ok = threading.Condition(self._lock)
        self._write_ok = threading.Condition(self._lock)
        self._writer = False
        self._waiting_writers = 0

    def acquire_read(self):
        with self._lock:
            while self._writer or self._waiting_writers > 0:
                self._read_ok.wait()
            self._readers += 1

    def release_read(self):
        with self._lock:
            self._readers -= 1
            if self._readers == 0:
                self._write_ok.notify()

    def acquire_write(self):
        with self._lock:
            self._waiting_writers += 1
            while self._writer or self._readers > 0:
                self._write_ok.wait()
            self._waiting_writers -= 1
            self._writer = True

    def release_write(self):
        with self._lock:
            self._writer = False
            self._read_ok.notify_all()
            self._write_ok.notify()`,
        highlight: [11, 24, 27],
      },
    },
    {
      title: 'Thread pool',
      tag: 'concept',
      heading: 'Thread pool: stop creating raw threads',
      eli5: 'The school has 10 helper kids on call. Teachers hand jobs to the front desk and a free helper picks each one up, instead of hiring a new kid for every errand.',
      body: [
        'A **ThreadPoolExecutor** keeps a fixed set of worker threads. You submit work, workers pick it up, and each submission gives back a `Future` for the result.',
        'Pools bound resource use, recycle threads and let you compose results. If you spawn raw `Thread` objects in production code, about 90% of the time a pool is what you wanted.',
      ],
      keyIdea: 'A pool caps how many threads exist and reuses them. Submit tasks, do not spawn threads.',
      metrics: { value: '100 urls, 10 workers', safe: 'yes', cost: 'bounded' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 'caller', kind: 'block', at: at(-4, 0), label: 'Caller', sub: 'pool.map(fetch, urls)', icon: 'Code', tint: 'gray' },
          { id: 'pool', kind: 'block', at: at(0, 0), label: 'ThreadPool', sub: 'max_workers 10', icon: 'Users', tint: 'green' },
          { id: 'pw1', kind: 'worker', at: at(3.6, -3), label: 'Worker 1', sub: 'fetch(url)', load: 70 },
          { id: 'pw2', kind: 'worker', at: at(6.4, 3), label: 'Worker 2', sub: 'fetch(url)', load: 70 },
        ],
        links: [link('caller', 'pool', 'submit'), link('pool', 'pw1', 'creates'), link('pool', 'pw2', 'creates')],
        flows: [flow(['caller', 'pool', 'pw1'], 'fetch(url 1)', 'request', 0, 1.6), flow(['caller', 'pool', 'pw2'], 'fetch(url 2)', 'request', 0.5, 1.6), flow(['pw1', 'pool', 'caller'], 'Future result', 'response', 2.2, 1.6)],
        panel: {
          title: 'What a pool gives you',
          icon: 'Gauge',
          rows: [
            { text: 'Thread count', value: 'bounded', tone: 'good' },
            { text: 'Thread creation cost', value: 'paid once', tone: 'good' },
            { text: 'Result handle', value: 'Future' },
          ],
        },
        caption: 'Fixed workers, many tasks',
      },
      code: {
        language: 'python',
        title: 'Fetch 100 URLs with 10 workers',
        source: `from concurrent.futures import ThreadPoolExecutor

def fetch(url):
    # ... network call
    return len(url)

urls = [f"https://example.com/{i}" for i in range(100)]

with ThreadPoolExecutor(max_workers=10) as pool:
    results = list(pool.map(fetch, urls))`,
        highlight: [9, 10],
      },
    },
    {
      title: 'Lazy singleton',
      tag: 'case',
      heading: 'Case: double-checked locking on a lazy singleton',
      eli5: 'Only one class pet fish may exist. A kid peeks at the tank without asking. If it is empty, the kid asks for the key, looks again, and only then buys the fish. Most kids never need the key.',
      body: [
        '`get()` checks `_instance` without the lock, which is fast. Only when it is empty does a thread take the lock, **check again**, and create the object. The second check stops two threads both creating it.',
        'In Python it works because the GIL makes reference assignment atomic. Do not port it blindly: its correctness depends on the language memory model.',
      ],
      keyIdea: 'Double-checked locking keeps the lock off the hot path, but it is only as safe as your language memory model.',
      metrics: { value: '1 instance', safe: 'yes (in Python)', cost: 'lock only on first call' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...ta, chips: ['check 1: None'] },
          { ...tb, chips: ['check 1: None'] },
          { id: 'single', kind: 'block', at: at(0, 0), label: 'LazySingleton', sub: '_instance', icon: 'Package', tint: 'green', badge: 'created once' },
          { ...lock, status: 'active', sub: 'class-level lock' },
        ],
        links: [link('ta', 'single', 'get()'), link('tb', 'single', 'get()'), link('single', 'lock', 'has-a')],
        flows: [flow(['ta', 'single', 'lock'], 'check 2, create', 'request', 0, 1.8), flow(['tb', 'single', 'lock'], 'check 2: exists', 'response', 2.2, 1.8)],
        panel: {
          title: 'Two checks',
          icon: 'Code',
          code: 'if cls._instance is None:      # check 1, no lock\n    with cls._lock:\n        if cls._instance is None:  # check 2, locked\n            cls._instance = cls()',
          footer: { text: 'Java before 1.5 broke this without volatile', tone: 'warn' },
        },
        caption: 'Lock only when the object is missing',
      },
      code: {
        language: 'python',
        title: 'LazySingleton',
        source: `class LazySingleton:
    _instance = None
    _lock = threading.Lock()

    @classmethod
    def get(cls):
        if cls._instance is None:            # first check (no lock)
            with cls._lock:
                if cls._instance is None:    # second check (under lock)
                    cls._instance = cls()
        return cls._instance`,
        highlight: [7, 9],
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Recap: pick the primitive that matches the problem',
      eli5: 'Each classroom rule fits one kind of mess: a marker for the board, tokens for the swings, a flag for the door, a shelf with a bell for passing lunchboxes. Pick the rule that matches the mess.',
      body: [
        'Races come from unsynchronized read-modify-write and check-then-act on shared state. The GIL does not prevent them.',
        'Use a Lock for exclusion, RLock for re-entry, Semaphore for N holders, Event for signals, Condition for waiting on state. Prefer `queue.Queue` and pools. Part 2 covers deadlock, lock granularity and designs that avoid locks.',
      ],
      keyIdea: 'Name the shared state, then choose the primitive. Prefer the stdlib tool over a hand-rolled one.',
      metrics: { value: 'correct', safe: 'yes', cost: 'keep sections small' },
      metricTones: { value: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...ta, status: 'ok' },
          { ...counter, status: 'ok', badge: '1,000,000' },
          { ...lock, status: 'ok' },
          { ...tb, status: 'ok' },
        ],
        links: [link('ta', 'lock'), link('tb', 'lock'), link('lock', 'counter', 'guards', { arrow: 'none' })],
        flows: [flow(['ta', 'lock', 'counter'], 'increment()', 'request', 0, 1.6), flow(['tb', 'lock', 'counter'], 'increment()', 'request', 1.8, 1.6)],
        panel: {
          title: 'Primitive cheat sheet',
          icon: 'Table',
          rows: [
            { text: 'Lock / RLock', value: 'one holder / re-entry' },
            { text: 'Semaphore(N)', value: 'N holders' },
            { text: 'Event', value: 'signal' },
            { text: 'Condition', value: 'wait for state' },
            { text: 'queue.Queue', value: 'hand-off' },
            { text: 'CAS', value: 'lock-free retry' },
          ],
        },
        caption: 'Match the primitive to the problem',
      },
      quiz: {
        question: 'Two threads both run `if balance >= 100: balance -= 100` on a balance of 100. Why can the balance go negative even with the GIL?',
        options: [
          'The GIL is released on every function call',
          'The check and the subtraction are separate steps, so another thread can run between them',
          'Integers in Python are not thread-safe',
          'The if statement is evaluated lazily',
        ],
        answer: 1,
        explain: 'The GIL only makes single bytecodes atomic. The check and the update are many bytecodes, so both threads can pass the check before either subtracts. Hold one lock across both.',
      },
    },
  ],
};
