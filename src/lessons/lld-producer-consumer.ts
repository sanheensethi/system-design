import type { Lesson, SceneFlow, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });
const flow = (path: string[], label: string, tone: SceneFlow['tone'], delay = 0, duration = 1.4): SceneFlow => ({ path, tone, label, delay, duration });

const prod: SceneNode = { id: 'prod', kind: 'worker', at: at(-5.5, 0), label: 'Producer', sub: 'the baker' };
const buf: SceneNode = { id: 'buf', kind: 'block', at: at(0, 0), label: 'Buffer', sub: 'shared queue', icon: 'Inbox', tint: 'amber' };
const cons: SceneNode = { id: 'cons', kind: 'worker', at: at(5.5, 0), label: 'Consumer', sub: 'the shopper' };
const lock: SceneNode = { id: 'lock', kind: 'vault', at: at(-3, -6.4), label: 'Lock', sub: 'one holder' };

export const lldProducerConsumer: Lesson = {
  id: 'lld-producer-consumer',
  title: 'Producer-consumer',
  tagline: 'Hand work from one set of threads to another through a bounded buffer, without busy loops, lost items or a runaway queue.',
  minutes: 22,
  level: 'Intermediate',
  learn: [
    'Why producers and consumers need a buffer between them, and why a plain list breaks',
    'Condition variables: wait, notify and the while loop that guards them',
    'A bounded buffer built three ways: condition, semaphores and queue.Queue',
    'Backpressure, full-buffer policies, shutdown with a poison pill and failing consumers',
    'Where the pattern grows into a message queue between machines',
  ],
  metrics: [
    { key: 'depth', label: 'Items waiting', icon: 'Inbox' },
    { key: 'rate', label: 'Handled', icon: 'Gauge' },
    { key: 'safe', label: 'Thread-safe', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Fast and slow',
      tag: 'problem',
      heading: 'One side makes work faster than the other can use it',
      eli5: 'A baker puts 500 loaves on the counter every hour. The shopper only carries away 100. The loaves pile up on the floor until there is no room left to walk.',
      body: [
        'A web server accepts uploads and a worker thread resizes them. Uploads arrive at **500 per second**. The worker finishes **100 per second**. The list between them grows by 400 every second.',
        'After a minute it holds 24,000 images in memory. Soon the process runs out of memory, or each upload waits so long that users give up.',
      ],
      keyIdea: 'When the thing that makes work and the thing that uses work run at different speeds, the gap has to go somewhere.',
      metrics: { depth: '24,000 and growing', rate: '100 / s of 500 / s', safe: '-' },
      metricTones: { depth: 'bad', rate: 'warn' },
      scene: {
        nodes: [
          { ...prod, chips: ['500 / s'] },
          { ...buf, status: 'hot', sub: 'unbounded list', badge: '24,000' },
          { ...cons, load: 100, chips: [{ text: '100 / s', tone: 'warn' }] },
        ],
        links: [link('prod', 'buf', 'append'), link('buf', 'cons', 'pop')],
        flows: [flow(['prod', 'buf'], 'image', 'request', 0, 0.9), flow(['prod', 'buf'], 'image', 'request', 0.3, 0.9), flow(['buf', 'cons'], 'image', 'response', 1.1, 1.4)],
        panel: {
          title: 'One minute of uploads',
          icon: 'Timer',
          rows: [
            { text: 'Arrive', value: '30,000' },
            { text: 'Resized', value: '6,000', tone: 'good' },
            { text: 'Still waiting', value: '24,000', tone: 'bad' },
            { text: 'Memory used', value: 'climbing', tone: 'warn' },
          ],
          footer: { text: 'The list has no upper limit', tone: 'bad' },
        },
        caption: 'The gap piles up in memory',
      },
    },
    {
      title: 'The pattern',
      tag: 'concept',
      heading: 'Producers, a buffer and consumers, each doing one job',
      eli5: 'The baker never hands bread to the shopper. The baker sets loaves on the **shelf**, and the shopper takes them off it whenever ready. Neither has to wait for the other.',
      body: [
        '**Producer-consumer** splits the work in two. **Producers** create items. **Consumers** process them. A **buffer** sits between and holds items in flight.',
        'The buffer decouples the two sides. Producers do not call a consumer, they drop an item and move on. Consumers can come, go or multiply without producers knowing.',
      ],
      keyIdea: 'Producers and consumers never talk to each other. They only share a buffer.',
      metrics: { depth: '0 to 5', rate: '-', safe: '-' },
      scene: {
        nodes: [
          { ...prod, status: 'active', chips: ['put(item)'] },
          { ...buf, status: 'active' },
          { ...cons, status: 'active', chips: ['get()'] },
        ],
        links: [link('prod', 'buf', 'put'), link('buf', 'cons', 'get')],
        flows: [flow(['prod', 'buf'], 'put(item)', 'request', 0, 1.2), flow(['buf', 'cons'], 'get()', 'response', 1.3, 1.2)],
        panel: {
          title: 'Who does what',
          icon: 'Workflow',
          rows: [
            { text: 'Producer', value: 'makes items', tone: 'good' },
            { text: 'Buffer', value: 'holds them in order' },
            { text: 'Consumer', value: 'processes items', tone: 'good' },
          ],
          footer: { text: 'The buffer is the only shared thing', tone: 'muted' },
        },
        caption: 'Two sides joined by one shared queue',
      },
    },
    {
      title: 'Plain list races',
      tag: 'case',
      heading: 'A plain list fails the moment two consumers touch it',
      eli5: 'Two shoppers both see one loaf left. Both reach for it at the same instant. One gets the bread and the other grabs at empty air.',
      body: [
        'The obvious buffer is a `list`: producers `append`, consumers check `if buf:` and then `pop(0)`. Check, then act. Two consumers can both see one item, and both try to take it.',
        'The loser crashes with `IndexError`, or worse, both take the same item. This is the check-then-act race from the locks lesson, now on a queue.',
      ],
      keyIdea: 'Checking that the buffer has an item and taking the item are two steps. Another thread can slip between them.',
      metrics: { depth: '1', rate: 'IndexError', safe: 'no' },
      metricTones: { rate: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...buf, status: 'hot', badge: '1 item' },
          { ...cons, id: 'c1', at: at(5, -3.4), label: 'Consumer 1', chips: [{ text: 'if buf: True', tone: 'good' }] },
          { ...cons, id: 'c2', at: at(5, 3.4), label: 'Consumer 2', chips: [{ text: 'if buf: True', tone: 'good' }] },
        ],
        links: [link('buf', 'c1', 'pop(0)'), link('buf', 'c2', 'pop(0)')],
        flows: [flow(['buf', 'c1'], 'item', 'response', 0, 1.3), flow(['buf', 'c2'], 'IndexError', 'error', 0.3, 1.3)],
        panel: {
          title: 'One bad interleaving',
          icon: 'Bug',
          code: 'C1: if buf:        # True\nC2: if buf:        # True\nC1: buf.pop(0)     # ok\nC2: buf.pop(0)     # IndexError',
          footer: { text: 'Check and take must be one step', tone: 'bad' },
        },
        caption: 'Two consumers, one item',
      },
      code: {
        language: 'python',
        title: 'The broken version',
        source: `buf = []

def producer():
    while True:
        buf.append(make_item())

def consumer():
    while True:
        if buf:                    # check
            item = buf.pop(0)      # act: another thread may have emptied it
            process(item)`,
        highlight: [8, 9],
      },
    },
    {
      title: 'Busy waiting',
      tag: 'case',
      heading: 'Spinning on an empty buffer burns a whole CPU core',
      eli5: 'The shopper stands at the empty shelf and stares at it, asking "bread yet? bread yet?" thousands of times a second. They get nothing done and wear themselves out.',
      body: [
        'Wrap the check in a loop: `while not buf: pass`. It works, but the consumer now uses 100% of a core to wait for nothing. Ten idle consumers cost ten cores.',
        'This is **busy waiting**. The thread is awake and asking the same question over and over, while the producer, which is the only one who can answer, may be starved of CPU.',
      ],
      keyIdea: 'A waiting thread should sleep and be woken. Asking "is it ready yet?" in a loop wastes the CPU that someone else needs.',
      metrics: { depth: '0', rate: '0 / s', safe: 'no' },
      metricTones: { rate: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...prod, chips: [{ text: 'slow to start', tone: 'warn' }] },
          { ...buf, badge: 'empty' },
          { ...cons, status: 'hot', load: 100, chips: [{ text: 'while not buf: pass', tone: 'bad' }] },
        ],
        links: [link('prod', 'buf'), link('cons', 'buf', 'is it there?', { labelTone: 'warn' })],
        flows: [flow(['cons', 'buf'], 'empty?', 'request', 0, 0.5), flow(['buf', 'cons'], 'yes, empty', 'error', 0.5, 0.5)],
        panel: {
          title: 'Cost of 10 idle consumers',
          icon: 'Cpu',
          rows: [
            { text: 'CPU used', value: '10 cores', tone: 'bad' },
            { text: 'Items processed', value: '0' },
            { text: 'Producer CPU left', value: 'starved', tone: 'warn' },
          ],
          footer: { text: 'All heat, no work', tone: 'bad' },
        },
        caption: 'The consumer polls as fast as it can',
      },
    },
    {
      title: 'Sleep and poll',
      tag: 'tradeoff',
      heading: 'Sleeping between checks trades CPU for latency',
      eli5: 'The shopper checks the shelf, then naps for a minute. They no longer tire themselves out, but fresh bread can sit there for a full minute before anyone notices.',
      body: [
        'Add `time.sleep(0.1)` between checks and the CPU drops to near zero. Now an item can wait up to **100 ms** after it arrives before a consumer even looks.',
        'Shorten the sleep and you burn CPU again. Lengthen it and you add delay. No sleep value is right. The consumer needs the producer to wake it the moment an item arrives.',
      ],
      keyIdea: 'Polling picks a point on a curve between wasted CPU and added latency. What we want is a wake-up call, not a better interval.',
      metrics: { depth: '0 to 1', rate: '10 checks / s', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...prod, chips: ['put at t = 0.01 s'] },
          { ...buf, badge: '1 item' },
          { ...cons, load: 3, chips: [{ text: 'sleep(0.1)', tone: 'default' }, { text: 'sees it at t = 0.10 s', tone: 'warn' }] },
        ],
        links: [link('prod', 'buf'), link('cons', 'buf', 'check every 100 ms', { labelTone: 'warn' })],
        flows: [flow(['prod', 'buf'], 'item', 'request', 0, 0.9), flow(['cons', 'buf'], 'check', 'request', 1.5, 0.9)],
        panel: {
          title: 'Sleep length',
          icon: 'Clock',
          rows: [
            { text: 'sleep(0.001)', value: 'CPU high', tone: 'warn' },
            { text: 'sleep(0.1)', value: 'up to 100 ms late', tone: 'warn' },
            { text: 'sleep(1)', value: 'up to 1 s late', tone: 'bad' },
            { text: 'Wake on arrival', value: 'both low', tone: 'good' },
          ],
        },
        caption: 'Either the CPU or the user pays',
      },
    },
    {
      title: 'Condition',
      tag: 'concept',
      heading: 'A condition variable lets a thread sleep until woken',
      eli5: 'The shopper sits down and the baker has a small **bell**. When bread is set out, the baker rings it, and only then does the shopper get up to look.',
      body: [
        'A **condition variable** pairs a lock with a waiting room. `wait()` releases the lock and puts the thread to sleep. `notify()` wakes a sleeper, which takes the lock again before it continues.',
        'The thread costs nothing while asleep and wakes the moment someone calls `notify`. The lock still guards the buffer, so the check and the take become one safe step.',
      ],
      keyIdea: 'wait() sleeps and gives up the lock together. notify() wakes a sleeper, which gets the lock back before running.',
      metrics: { depth: '0', rate: '-', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: ['notify()'] },
          { ...buf, status: 'active' },
          { ...cons, load: 0, chips: [{ text: 'wait() asleep', tone: 'good' }] },
          { ...lock, status: 'active' },
        ],
        links: [link('prod', 'lock', 'acquire'), link('lock', 'buf', 'guards', { arrow: 'none' }), link('buf', 'cons', 'wake up')],
        flows: [flow(['prod', 'lock', 'buf'], 'append', 'request', 0, 1.4), flow(['buf', 'cons'], 'notify', 'event', 1.5, 1.2)],
        panel: {
          title: 'Condition API',
          icon: 'Code',
          code: 'cond = threading.Condition()\nwith cond:          # take the lock\n    cond.wait()     # unlock + sleep\n    cond.notify()   # wake one\n    cond.notify_all()  # wake all',
          footer: { text: 'wait() must be called holding the lock', tone: 'muted' },
        },
        caption: 'Sleep costs nothing. Notify wakes it.',
      },
    },
    {
      title: 'put and wait',
      tag: 'concept',
      heading: 'put() blocks while the buffer is full',
      eli5: 'The shelf has room for 5 loaves. If it is full, the baker sits down and waits. When a shopper takes one, the bell rings and the baker puts the next loaf out.',
      body: [
        'A **bounded buffer** has a fixed `capacity`. `put` takes the lock and checks for room. If the buffer is full, it calls `wait()` and sleeps. Otherwise it appends the item.',
        'After adding, it calls `notify` so a sleeping consumer knows there is something to take. Producers that find the buffer full simply stop here, and that is the whole point.',
      ],
      keyIdea: 'A full buffer makes the producer wait. The pause is how the buffer limits memory.',
      metrics: { depth: '5 of 5', rate: '-', safe: 'yes' },
      metricTones: { depth: 'warn', safe: 'good' },
      scene: {
        nodes: [
          { ...prod, status: 'hot', chips: [{ text: 'put() blocked', tone: 'warn' }] },
          { ...buf, badge: '5 of 5 full', status: 'active' },
          { ...lock, sub: 'free' },
        ],
        links: [link('prod', 'lock', 'acquire'), link('lock', 'buf', 'guards', { arrow: 'none' })],
        flows: [flow(['prod', 'lock'], 'put', 'request', 0, 1), flow(['lock', 'prod'], 'full, wait()', 'error', 1.1, 1)],
        panel: {
          title: 'put(item)',
          icon: 'Code',
          code: 'with cond:\n    while len(buf) == capacity:\n        cond.wait()\n    buf.append(item)\n    cond.notify_all()',
          footer: { text: 'Full: sleep. Room: append and notify', tone: 'muted' },
        },
        caption: 'The producer sleeps when there is no room',
      },
      code: {
        language: 'python',
        title: 'BoundedBuffer.put',
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
                self._cond.wait()          # unlock, sleep, relock
            self._buf.append(item)
            self._cond.notify_all()        # wake any waiting consumers`,
        highlight: [12, 13, 14, 15],
      },
    },
    {
      title: 'get and while',
      tag: 'concept',
      heading: 'get() waits in a while loop, never an if',
      eli5: 'When the bell rings, the shopper gets up and looks at the shelf again. Someone else may have grabbed the loaf already, so the shopper checks every time before taking.',
      body: [
        '`get` mirrors `put`: take the lock, wait while the buffer is empty, pop the oldest item, notify producers that a slot is free, and return the item.',
        'The wait must sit in a `while`, because by the time a woken thread gets the lock back, another thread may have taken the item. Spurious wakeups also exist. After `wait()` returns, check again. `if` is a bug.',
      ],
      keyIdea: 'Always re-check the condition after wait() returns. A wake-up means "look again", not "it is your turn".',
      metrics: { depth: '1 to 0', rate: '-', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...buf, badge: '1 item' },
          { ...cons, id: 'c1', at: at(5, -3.4), label: 'Consumer 1', chips: [{ text: 'woke, re-checks', tone: 'good' }] },
          { ...cons, id: 'c2', at: at(5, 3.4), label: 'Consumer 2', chips: [{ text: 'woke, re-checks', tone: 'good' }] },
        ],
        links: [link('buf', 'c1', 'notify'), link('buf', 'c2', 'notify')],
        flows: [flow(['buf', 'c1'], 'item', 'response', 0, 1.3), flow(['buf', 'c2'], 'empty, wait again', 'event', 0.4, 1.3)],
        panel: {
          title: 'get()',
          icon: 'Code',
          code: 'with cond:\n    while not buf:\n        cond.wait()\n    item = buf.popleft()\n    cond.notify_all()\n    return item',
          footer: { text: 'while re-checks, if trusts a stale answer', tone: 'warn' },
        },
        caption: 'Two woke up, one item, so one goes back to sleep',
      },
      code: {
        language: 'python',
        title: 'BoundedBuffer.get',
        source: `    def get(self):
        with self._cond:
            while not self._buf:           # while, not if
                self._cond.wait()
            item = self._buf.popleft()
            self._cond.notify_all()        # wake any waiting producers
            return item`,
        highlight: [3, 4],
      },
      quiz: {
        question: 'Why does get() wait inside a while loop instead of an if?',
        options: [
          'A woken thread must re-check, because another thread may have taken the item first',
          'A while loop releases the lock faster than an if',
          'wait() returns immediately unless it sits in a loop',
          'It keeps the items in order',
        ],
        answer: 0,
        explain: 'Between notify and the woken thread getting the lock back, another consumer can take the item. Spurious wakeups can also happen. Re-checking the condition makes both harmless.',
      },
    },
    {
      title: 'Backpressure',
      tag: 'concept',
      heading: 'A bounded buffer pushes back on fast producers',
      eli5: 'A full shelf tells the baker to slow down. The baker bakes only as fast as the shopper takes bread. No bread hits the floor.',
      body: [
        'Back to the upload server. With a capacity of 1,000, the buffer fills in about 2.5 seconds. Then each `put` waits for the consumer, and uploads run at the consumer\'s **100 per second**.',
        'This is **backpressure**: the slow side slows the fast side. Memory stays flat at 1,000 items. The system chooses to wait over crashing.',
      ],
      keyIdea: 'Bounding the buffer turns an overload into a wait. Memory stays flat, and the producer speed follows the consumer.',
      metrics: { depth: '1,000 (capped)', rate: '100 / s', safe: 'yes' },
      metricTones: { depth: 'good', rate: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...prod, load: 20, chips: [{ text: 'waits in put()', tone: 'warn' }] },
          { ...buf, sub: 'capacity 1,000', status: 'ok', badge: '1,000 of 1,000' },
          { ...cons, load: 90, chips: [{ text: '100 / s', tone: 'good' }] },
        ],
        links: [link('prod', 'buf', 'blocked when full', { labelTone: 'warn' }), link('buf', 'cons')],
        flows: [flow(['prod', 'buf'], 'one at a time', 'request', 0, 1.4), flow(['buf', 'cons'], 'item', 'response', 0.8, 1.4)],
        panel: {
          title: 'Same load, bounded buffer',
          icon: 'Gauge',
          rows: [
            { text: 'Memory', value: 'flat at 1,000 items', tone: 'good' },
            { text: 'Producer speed', value: '100 / s', tone: 'warn' },
            { text: 'Consumer speed', value: '100 / s', tone: 'good' },
            { text: 'Crash risk', value: 'gone', tone: 'good' },
          ],
          footer: { text: 'Callers feel the slowdown, memory does not blow up', tone: 'muted' },
        },
        caption: 'The queue length is capped, so the speed matches',
      },
    },
    {
      title: 'Two conditions',
      tag: 'tradeoff',
      heading: 'One notify_all wakes everyone, two conditions wake the right side',
      eli5: 'With one bell, every shopper and every baker jump up when it rings. Most sit back down. Two bells, one for "bread out" and one for "room on shelf", wake only who should hear.',
      body: [
        'With one condition, `notify_all` wakes producers and consumers together. Most go straight back to sleep, a **thundering herd** that wastes CPU. Plain `notify` is cheaper but may wake the wrong side and stall.',
        'Create two conditions on the same lock: `not_full` for producers and `not_empty` for consumers. `put` notifies `not_empty`. `get` notifies `not_full`. Each wake-up now goes to the side that can use it.',
      ],
      keyIdea: 'Share one lock but give each reason for waiting its own condition, so a notify only wakes threads that can act.',
      metrics: { depth: '0 to 5', rate: '-', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: [{ text: 'sleeps on not_full', tone: 'default' }] },
          { ...buf, status: 'active' },
          { ...cons, chips: [{ text: 'sleeps on not_empty', tone: 'default' }] },
          { ...lock, sub: 'shared' },
        ],
        links: [link('prod', 'lock'), link('lock', 'buf', 'guards', { arrow: 'none' }), link('buf', 'cons', 'notify not_empty'), link('buf', 'prod', 'notify not_full')],
        flows: [flow(['buf', 'cons'], 'not_empty', 'event', 0, 1.2), flow(['buf', 'prod'], 'not_full', 'event', 1.3, 1.2)],
        panel: {
          title: 'One lock, two conditions',
          icon: 'Code',
          code: 'lock = threading.Lock()\nnot_full  = threading.Condition(lock)\nnot_empty = threading.Condition(lock)\n# put: not_full.wait()\n#      not_empty.notify()\n# get: not_empty.wait()\n#      not_full.notify()',
          footer: { text: 'Fewer wake-ups, no wrong-side stall', tone: 'good' },
        },
        caption: 'Each side has its own bell',
      },
    },
    {
      title: 'Semaphores',
      tag: 'concept',
      heading: 'Two semaphores count free slots and filled slots',
      eli5: 'Hang a jar of 5 tickets by the shelf. The baker takes a ticket before setting out a loaf. A shopper takes a loaf and drops a ticket back. No tickets, the baker waits.',
      body: [
        'A **semaphore** is a counter with a built-in wait. `acquire` takes one and sleeps at zero, `release` gives one back. Use two: `slots` starts at the capacity (free room), `items` starts at 0 (ready items).',
        '`put` runs `slots.acquire()`, appends, then `items.release()`. `get` runs `items.acquire()`, pops, then `slots.release()`. A small `Lock` still guards the list itself.',
      ],
      keyIdea: 'Semaphores count what is available. The producer waits on free slots, the consumer waits on filled slots.',
      metrics: { depth: '2 of 5', rate: '-', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: ['slots.acquire()'] },
          { ...buf, status: 'active', badge: '2 items, 3 free' },
          { ...cons, chips: ['items.acquire()'] },
          { id: 'sem', kind: 'block', at: at(0, 6.6), label: 'Semaphores', sub: 'slots 3, items 2', icon: 'Hash', tint: 'violet' },
        ],
        links: [link('prod', 'buf', 'put'), link('buf', 'cons', 'get'), link('buf', 'sem', 'counts', { arrow: 'none' })],
        flows: [flow(['prod', 'buf'], 'slots - 1', 'request', 0, 1.2), flow(['buf', 'cons'], 'items - 1', 'response', 1.3, 1.2)],
        panel: {
          title: 'Semaphore version',
          icon: 'Code',
          code: 'slots = Semaphore(cap)  # free room\nitems = Semaphore(0)    # ready items\nmutex = Lock()          # guards the list\n# put: slots.acquire; add; items.release\n# get: items.acquire; take; slots.release',
          footer: { text: 'Same behavior, different bookkeeping', tone: 'muted' },
        },
        caption: 'The counters do the waiting',
      },
      code: {
        language: 'python',
        title: 'Bounded buffer with semaphores',
        source: `class SemBuffer:
    def __init__(self, capacity):
        self._buf = deque()
        self._slots = threading.Semaphore(capacity)  # free room
        self._items = threading.Semaphore(0)         # ready items
        self._mutex = threading.Lock()

    def put(self, item):
        self._slots.acquire()              # sleep if full
        with self._mutex:
            self._buf.append(item)
        self._items.release()              # one more item

    def get(self):
        self._items.acquire()              # sleep if empty
        with self._mutex:
            item = self._buf.popleft()
        self._slots.release()              # one more free slot
        return item`,
        highlight: [8, 12, 15, 19],
      },
    },
    {
      title: 'queue.Queue',
      tag: 'concept',
      heading: 'Python already ships this class: queue.Queue',
      eli5: 'Good news: the bakery already sells a ready-made shelf with the bell and the tickets built in. Use it instead of building your own.',
      body: [
        '`queue.Queue(maxsize=N)` is the bounded buffer, with the lock, the conditions and the counting done for you. `put` blocks when full, `get` blocks when empty.',
        'It also tracks unfinished work: each `get` is followed by `task_done()`, and `q.join()` sleeps until every item has been marked done. When the standard library gives you a thread-safe tool, use it.',
      ],
      keyIdea: 'In real code, reach for queue.Queue. Build your own only to learn how it works or when you need behavior it lacks.',
      metrics: { depth: '0 to 100', rate: '-', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: ['q.put(item)'] },
          { ...buf, label: 'queue.Queue', sub: 'maxsize = 100', tint: 'green', status: 'ok' },
          { ...cons, chips: ['q.get()', 'q.task_done()'] },
        ],
        links: [link('prod', 'buf', 'put, blocks if full'), link('buf', 'cons', 'get, blocks if empty')],
        flows: [flow(['prod', 'buf'], 'put', 'request', 0, 1.2), flow(['buf', 'cons'], 'get', 'response', 1.3, 1.2)],
        panel: {
          title: 'queue.Queue methods',
          icon: 'List',
          rows: [
            { text: 'put(item)', value: 'block if full' },
            { text: 'get()', value: 'block if empty' },
            { text: 'task_done()', value: 'mark one finished' },
            { text: 'join()', value: 'wait for all done' },
          ],
        },
        caption: 'The tested version of everything so far',
      },
      code: {
        language: 'python',
        title: 'The whole pattern in a few lines',
        source: `import queue, threading

q = queue.Queue(maxsize=100)

def producer():
    for i in range(1000):
        q.put(i)               # blocks if full

def consumer():
    while True:
        item = q.get()         # blocks if empty
        process(item)
        q.task_done()

p = threading.Thread(target=producer)
p.start()
threading.Thread(target=consumer, daemon=True).start()
p.join()                       # wait for every put() first
q.join()                       # then wait until all 1000 are done`,
        highlight: [7, 11, 13, 18, 19],
      },
    },
    {
      title: 'Many workers',
      tag: 'case',
      heading: 'Add more producers or consumers to match the speeds',
      eli5: 'One shopper carries 100 loaves an hour but the baker makes 500. Send 5 shoppers to the same shelf. Each takes what they can, and the bread stops piling up.',
      body: [
        'The buffer is safe for any number of threads on either side. If one consumer handles 100 per second and producers make 500, five consumers close the gap. That is the **worker pool**. Threads scale I/O-bound work. Resizing images is CPU-bound, and CPython threads share the GIL, so there use `multiprocessing` or code that releases the GIL.',
        'The cost is order. Two consumers take items 1 and 2 together and the slower one finishes last, so results can come out in a different order than they went in.',
      ],
      keyIdea: 'Scale the slow side by adding consumers. Accept that completion order is no longer guaranteed.',
      metrics: { depth: 'about 0', rate: '500 / s', safe: 'yes' },
      metricTones: { depth: 'good', rate: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: ['500 / s'] },
          { ...buf, status: 'ok', badge: '3 waiting' },
          { ...cons, label: 'Consumers x5', sub: 'worker pool', load: 70, chips: [{ text: '5 x 100 / s', tone: 'good' }] },
        ],
        links: [link('prod', 'buf'), link('buf', 'cons', 'get')],
        flows: [flow(['prod', 'buf'], 'item', 'request', 0, 1), flow(['buf', 'cons'], 'job 1', 'response', 1.1, 1.2), flow(['buf', 'cons'], 'job 2', 'response', 1.4, 1.2), flow(['buf', 'cons'], 'job 3', 'response', 1.7, 1.2)],
        panel: {
          title: 'Consumers needed',
          icon: 'Users',
          rows: [
            { text: 'Arrival rate', value: '500 / s' },
            { text: 'One consumer', value: '100 / s', tone: 'warn' },
            { text: 'Consumers needed', value: '5', tone: 'good' },
            { text: 'Finish order', value: 'not guaranteed', tone: 'warn' },
            { text: 'CPU-bound in CPython', value: 'use processes', tone: 'warn' },
          ],
        },
        caption: 'More consumers, same buffer',
      },
    },
    {
      title: 'Poison pill',
      tag: 'concept',
      heading: 'Shut down consumers with a sentinel value',
      eli5: 'At closing time the baker puts a card on the shelf that says "CLOSED". A shopper who picks up the card knows to go home instead of waiting for bread that will never come.',
      body: [
        'A consumer sleeping in `get()` has no way to learn that production is over. Producers put a special **sentinel** (a **poison pill**) on the queue, often `None`. A consumer that receives it exits its loop.',
        'With several consumers, each needs a pill. Either put one pill per consumer, or let each consumer pass the pill on with `q.put(None)` before it exits. Pills go behind real items, so real work finishes first.',
      ],
      keyIdea: 'Shutdown travels through the queue as an ordinary item. Every consumer must get one pill.',
      metrics: { depth: '2 items + 1 pill', rate: 'draining', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: [{ text: 'done: put(None)', tone: 'good' }] },
          { ...buf, badge: 'item, item, None', status: 'active' },
          { ...cons, id: 'c1', at: at(5, -3.4), label: 'Consumer 1', chips: [{ text: 'got None, exit', tone: 'good' }] },
          { ...cons, id: 'c2', at: at(5, 3.4), label: 'Consumer 2', chips: [{ text: 'puts None back', tone: 'default' }] },
        ],
        links: [link('prod', 'buf'), link('buf', 'c1'), link('buf', 'c2')],
        flows: [flow(['prod', 'buf'], 'None', 'event', 0, 1), flow(['buf', 'c1'], 'None', 'event', 1.1, 1.2), flow(['c1', 'buf', 'c2'], 'None again', 'event', 2.4, 1.6)],
        panel: {
          title: 'Consumer loop',
          icon: 'Code',
          code: 'while True:\n    item = q.get()\n    if item is None:\n        q.put(None)  # pass it on\n        break\n    process(item)',
          footer: { text: 'Real items drain before the pills', tone: 'muted' },
        },
        caption: 'A pill tells each consumer to stop',
      },
    },
    {
      title: 'Many producers',
      tag: 'case',
      heading: 'With several producers, send pills only after all are done',
      eli5: 'Three bakers share one shelf. If the first baker to finish hangs the CLOSED card, every shopper goes home while the other two bakers still have bread coming.',
      body: [
        'If the first producer to finish sends the pills, consumers exit while other producers still produce. Their items are never consumed, and they can block forever on a full queue.',
        'Join all producers first, then put one `None` per consumer. Or let consumers count pills and stop after N. Wait with `thread.join()` on consumers, because a passed-on pill is never marked done and `q.join()` would hang.',
      ],
      keyIdea: 'Pills go in only after the last producer is done. Then wait on the consumer threads.',
      metrics: { depth: '2 producers, 1 pill too early', rate: 'items stranded', safe: 'no' },
      metricTones: { rate: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...prod, id: 'p1', at: at(-5.5, -3.4), label: 'Producer 1', chips: [{ text: 'done, sends None', tone: 'warn' }] },
          { ...prod, id: 'p2', at: at(-5.5, 3.4), label: 'Producer 2', status: 'hot', chips: [{ text: 'still producing', tone: 'bad' }] },
          { ...buf, badge: 'None' },
          { ...cons, status: 'down', chips: [{ text: 'exited early', tone: 'bad' }] },
        ],
        links: [link('p1', 'buf', 'None'), link('p2', 'buf', 'items'), link('buf', 'cons')],
        flows: [flow(['p1', 'buf'], 'None', 'event', 0, 1), flow(['buf', 'cons'], 'None', 'event', 1.1, 1.2), flow(['p2', 'buf'], 'item, nobody left', 'error', 2.4, 1.4)],
        panel: {
          title: 'Safe shutdown order',
          icon: 'Code',
          code: 'for p in producers:\n    p.join()\nfor _ in consumers:\n    q.put(None)\nfor c in consumers:\n    c.join()',
          footer: { text: 'Join with thread.join(), not q.join()', tone: 'good' },
        },
        caption: 'One early pill strands the other producer',
      },
    },
    {
      title: 'Other shutdowns',
      tag: 'tradeoff',
      heading: 'Queue.shutdown() and timeouts are other ways to stop',
      eli5: 'Instead of a CLOSED card, the shop can lock the door, which tells every shopper at once. Or shoppers can glance at a sign every minute and leave when it says closed.',
      body: [
        'Python 3.13 added `Queue.shutdown()`. After it, `put` raises `ShutDown`, and `get` raises it once the queue is empty, so consumers need no sentinel.',
        'On older versions, use `get(timeout=1)`. It raises `queue.Empty` on expiry, and the consumer checks a `threading.Event` stop flag before looping again. `get_nowait` raises `Empty` right away.',
      ],
      keyIdea: 'A pill, shutdown() and a timeout with a stop flag all end consumers. Pick the one your Python version and design allow.',
      metrics: { depth: 'drains, then stops', rate: '-', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: [{ text: 'q.shutdown()', tone: 'good' }] },
          { ...buf, badge: 'draining', status: 'active' },
          { ...cons, chips: [{ text: 'get() raises ShutDown', tone: 'good' }] },
        ],
        links: [link('prod', 'buf', 'shutdown'), link('buf', 'cons', 'get')],
        flows: [flow(['prod', 'buf'], 'shutdown', 'event', 0, 1), flow(['buf', 'cons'], 'ShutDown', 'event', 1.1, 1.2)],
        panel: {
          title: 'Three ways to stop',
          icon: 'List',
          rows: [
            { text: 'Poison pill', value: 'works everywhere', tone: 'good' },
            { text: 'Queue.shutdown()', value: 'Python 3.13+', tone: 'good' },
            { text: 'get(timeout) + Event', value: 'older versions', tone: 'warn' },
          ],
        },
        caption: 'Pick a stop signal that fits',
      },
    },
    {
      title: 'When full',
      tag: 'tradeoff',
      heading: 'A full buffer can block, time out, drop or reject',
      eli5: 'The shelf is full and a new loaf is ready. The baker can wait, wait for a few minutes then give up, throw away the oldest loaf, or tell customers "come back later".',
      body: [
        '`put` blocks by default, which is right for internal pipelines. A web handler cannot wait forever, so use `put(item, timeout=2)`, which raises `queue.Full` on expiry. `put_nowait` raises it right away.',
        'On `Full` you choose: **reject** the request with a 503 and a retry hint, **drop** the item if it is disposable (metrics, logs), or fall back to slower storage. Never lose data in silence.',
      ],
      keyIdea: 'Block for internal work, time out or reject at the edge, drop only data you can afford to lose.',
      metrics: { depth: '100 of 100', rate: '-', safe: 'yes' },
      metricTones: { depth: 'warn', safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: [{ text: 'put(timeout=2)', tone: 'warn' }] },
          { ...buf, badge: '100 of 100', status: 'hot' },
          { id: 'edge', kind: 'block', at: at(5.5, 0), label: 'Caller', sub: 'gets 503', icon: 'Users', tint: 'gray' },
        ],
        links: [link('prod', 'buf', 'queue.Full'), link('prod', 'edge', 'reject', { route: 'straight', style: 'dashed' })],
        flows: [flow(['prod', 'buf'], 'put', 'request', 0, 1), flow(['buf', 'prod'], 'Full', 'error', 1.1, 1), flow(['prod', 'edge'], '503 retry', 'error', 2.2, 1.6)],
        panel: {
          title: 'Choices when full',
          icon: 'Scale',
          rows: [
            { text: 'Block', value: 'internal pipeline', tone: 'good' },
            { text: 'Timeout, then reject', value: 'web request', tone: 'good' },
            { text: 'Drop oldest or newest', value: 'metrics, logs', tone: 'warn' },
            { text: 'Silent loss', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'The policy is part of the design',
      },
    },
    {
      title: 'Bad items',
      tag: 'case',
      heading: 'One failing item must not stall the whole queue',
      eli5: 'A shopper picks up a loaf, drops it and storms off. The shelf keeps a count of loaves "being carried", so it would wait for that shopper forever. The shopper must always report back.',
      body: [
        'If `process(item)` raises, the consumer thread dies and `task_done()` never runs. `q.join()` then waits forever. Wrap the work in `try`/`finally` so `task_done()` always runs.',
        'Catch the error, log it, and move on. Retry a few times, then send the item to a **dead-letter** list for a human to inspect. One bad item should cost one item.',
      ],
      keyIdea: 'Always call task_done(), even on failure, and keep one bad item from killing a consumer.',
      metrics: { depth: '1 stuck', rate: 'join() hangs', safe: 'no' },
      metricTones: { depth: 'bad', rate: 'bad' },
      scene: {
        nodes: [
          { ...buf, badge: '1 poison item' },
          { ...cons, status: 'down', chips: [{ text: 'ValueError', tone: 'bad' }, { text: 'task_done() skipped', tone: 'warn' }] },
          { id: 'dead', kind: 'block', at: at(0, 6.6), label: 'Dead letters', sub: 'for inspection', icon: 'Mail', tint: 'red' },
        ],
        links: [link('buf', 'cons', 'get'), link('cons', 'dead', 'after 3 tries', { style: 'dashed' })],
        flows: [flow(['buf', 'cons'], 'bad item', 'response', 0, 1.2), flow(['cons', 'dead'], 'giving up', 'error', 1.4, 1.4)],
        panel: {
          title: 'Safe consumer loop',
          icon: 'Shield',
          code: 'item = q.get()\ntry:\n    process(item)\nexcept Exception:\n    log.exception(item)\n    dead.append(item)\nfinally:\n    q.task_done()',
          footer: { text: 'finally always reports back', tone: 'good' },
        },
        caption: 'Report back, keep going, set the bad one aside',
      },
      quiz: {
        question: 'A consumer raises an exception inside process() and never calls task_done(). What happens to q.join()?',
        options: [
          'It returns anyway after a short timeout',
          'It waits forever, since one item is never marked finished',
          'It raises queue.Empty',
          'It skips the failed item automatically',
        ],
        answer: 1,
        explain: 'join() returns only when every item has been marked done. Put task_done() in a finally block so a failure cannot leave the count one short.',
      },
    },
    {
      title: 'Work outside lock',
      tag: 'tradeoff',
      heading: 'Never process an item while holding the buffer lock',
      eli5: 'A shopper who takes a loaf should step away from the shelf before eating it. If they stand at the shelf while chewing, nobody else can reach the bread.',
      body: [
        'Keep the critical section tiny: pop the item, release the lock, then process. If `process` ran inside `with cond:`, every other thread would queue behind it and the pool would run one at a time.',
        'Holding a lock while calling out can also **deadlock**: if `process` touches another lock, and that code later wants the buffer lock, both wait on each other. Lock only the queue operation.',
      ],
      keyIdea: 'Hold the buffer lock only to move an item in or out. Do the slow work after letting go.',
      metrics: { depth: 'growing', rate: '1 consumer at a time', safe: 'yes, but slow' },
      metricTones: { rate: 'bad', depth: 'warn' },
      scene: {
        nodes: [
          { ...cons, id: 'c1', at: at(-5.5, 0), label: 'Consumer 1', status: 'hot', load: 95, chips: [{ text: 'process() under lock', tone: 'bad' }] },
          { ...lock, at: at(0, 0), status: 'hot', sub: 'held for 80 ms' },
          { ...cons, id: 'c2', at: at(5.5, -3.4), label: 'Consumer 2', chips: [{ text: 'waiting for lock', tone: 'warn' }] },
          { ...cons, id: 'c3', at: at(5.5, 3.4), label: 'Consumer 3', chips: [{ text: 'waiting for lock', tone: 'warn' }] },
        ],
        links: [link('c1', 'lock', 'holds'), link('c2', 'lock', 'waits', { labelTone: 'warn' }), link('c3', 'lock', 'waits', { labelTone: 'warn' })],
        flows: [flow(['c1', 'lock'], 'held', 'error', 0, 1.2), flow(['c2', 'lock'], 'blocked', 'error', 0.4, 1.2), flow(['c3', 'lock'], 'blocked', 'error', 0.8, 1.2)],
        panel: {
          title: 'Where process() goes',
          icon: 'Code',
          code: '# wrong\nwith cond:\n    item = get_item()\n    process(item)\n# right\nwith cond:\n    item = get_item()\nprocess(item)',
          footer: { text: 'Lock for nanoseconds, not milliseconds', tone: 'good' },
        },
        caption: 'A long critical section serializes the pool',
      },
    },
    {
      title: 'Sizing',
      tag: 'tradeoff',
      heading: 'Pick a capacity that absorbs bursts without hiding lag',
      eli5: 'A tiny shelf makes the baker wait on every loaf. A giant shelf lets bread go stale before anyone buys it. Pick one big enough for a busy minute, not a whole day.',
      body: [
        'A buffer smooths bursts. If 1,000 items arrive in one second and consumers drain 400 per second, a capacity near 600 absorbs the burst. Too small and producers stall on every spike.',
        'Too large and the queue hides trouble: at 100 items per second, a 100,000 capacity means an item can wait **1,000 seconds**. Watch queue depth and wait time. A depth that stays high means add consumers.',
      ],
      keyIdea: 'Size the buffer for a burst you expect, and alert on depth. A huge buffer only delays the bad news.',
      metrics: { depth: '600 (burst)', rate: '400 / s', safe: 'yes' },
      metricTones: { depth: 'good', rate: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...prod, chips: [{ text: 'burst 1,000 / s', tone: 'warn' }] },
          { ...buf, sub: 'capacity 600', badge: '600 of 600', status: 'ok' },
          { ...cons, load: 80, chips: ['400 / s'] },
        ],
        links: [link('prod', 'buf'), link('buf', 'cons')],
        flows: [flow(['prod', 'buf'], 'burst', 'request', 0, 1), flow(['prod', 'buf'], 'burst', 'request', 0.3, 1), flow(['buf', 'cons'], 'item', 'response', 1, 1.2)],
        panel: {
          title: 'Capacity versus wait',
          icon: 'Table',
          rows: [
            { text: 'Capacity 10', value: 'producers stall on bursts', tone: 'warn' },
            { text: 'Capacity 600', value: 'absorbs a 1 s burst', tone: 'good' },
            { text: 'Capacity 100,000', value: 'items wait up to 1,000 s', tone: 'bad' },
          ],
          footer: { text: 'Wait time = depth / drain rate', tone: 'muted' },
        },
        caption: 'Enough room for a burst, not for a backlog',
      },
    },
    {
      title: 'Across machines',
      tag: 'case',
      heading: 'The same shape between machines is a message queue',
      eli5: 'Make the bakery a chain. The baker is in one town and the shoppers are in another, so the shelf becomes a delivery van with a logbook. Same idea, bigger distances.',
      body: [
        'A thread buffer lives in one process and dies with it. A **message queue** such as RabbitMQ or Kafka is the same pattern across machines: services publish, workers consume, and the broker holds the items on disk.',
        '`task_done()` becomes an **acknowledgment** (an ack in RabbitMQ, an offset commit in Kafka): if a worker crashes before acking, the broker redelivers the item. Bounded capacity becomes queue limits and consumer lag. See the message queues lesson.',
      ],
      keyIdea: 'Producer-consumer scales from threads to services. The buffer becomes a durable broker, and task_done becomes an ack or offset commit.',
      metrics: { depth: 'on disk', rate: '-', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...prod, label: 'Order service', sub: 'publishes' },
          { id: 'broker', kind: 'block', at: at(0, 0), label: 'Message queue', sub: 'external broker', icon: 'Mail', tint: 'gray', status: 'ok' },
          { ...cons, label: 'Email worker', sub: 'consumes' },
        ],
        links: [link('prod', 'broker', 'publish'), link('broker', 'cons', 'deliver')],
        flows: [flow(['prod', 'broker'], 'order placed', 'event', 0, 1.2), flow(['broker', 'cons'], 'order placed', 'event', 1.3, 1.2), flow(['cons', 'broker'], 'ack', 'response', 2.6, 1)],
        panel: {
          title: 'Thread version to broker',
          icon: 'Network',
          rows: [
            { text: 'Buffer in memory', value: 'durable broker' },
            { text: 'task_done()', value: 'ack' },
            { text: 'queue.Full', value: 'queue limits, lag' },
            { text: 'Dead list', value: 'dead-letter queue' },
            { text: 'Poison pill', value: 'close or cancel the consumer' },
          ],
        },
        caption: 'Same pattern, different distances',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Producer-consumer in one page',
      eli5: 'Bakers put bread on a shelf of 5 spots. Shoppers take it. A bell wakes whoever should move, a full shelf makes bakers wait, and a "CLOSED" card tells everyone to go home.',
      body: [
        'Split work into **producers**, a **bounded buffer** and **consumers**. Guard the buffer with a lock and wait on **conditions** (or semaphores), always inside a `while` loop. In practice, use `queue.Queue`.',
        'Choose a full-buffer policy, send a poison pill per consumer on shutdown, always call `task_done()` in `finally`, process outside the lock, and size the buffer for a burst. Across machines, the same idea is a message queue.',
      ],
      keyIdea: 'A bounded, blocking queue between two sides gives safe handoff, backpressure and clean shutdown.',
      metrics: { depth: 'bounded', rate: 'matched', safe: 'yes' },
      metricTones: { depth: 'good', rate: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...prod, status: 'ok', chips: ['put(item)'] },
          { ...buf, label: 'queue.Queue', sub: 'bounded, blocking', tint: 'green', status: 'ok' },
          { ...cons, status: 'ok', chips: ['get()', 'task_done()'] },
          { ...lock, sub: 'inside the queue' },
        ],
        links: [link('prod', 'buf', 'put'), link('buf', 'cons', 'get'), link('lock', 'buf', 'guards', { arrow: 'none' })],
        flows: [flow(['prod', 'buf'], 'item', 'request', 0, 1.2), flow(['buf', 'cons'], 'item', 'response', 1.3, 1.2)],
        panel: {
          title: 'Checklist',
          icon: 'List',
          rows: [
            { text: 'Bounded buffer', value: 'backpressure', tone: 'good' },
            { text: 'wait in a while', value: 'no stale wake-ups', tone: 'good' },
            { text: 'Poison pill each', value: 'clean shutdown', tone: 'good' },
            { text: 'task_done in finally', value: 'join() returns', tone: 'good' },
            { text: 'Work outside lock', value: 'parallel pool', tone: 'good' },
          ],
        },
        caption: 'The pattern, complete',
      },
      quiz: {
        question: 'Producers are much faster than consumers. What does a bounded buffer do about it?',
        options: [
          'Grows until memory runs out, so nothing is lost',
          'Silently drops the oldest items',
          'Makes put() wait when full, so producers slow to the consumer speed',
          'Speeds up the consumers automatically',
        ],
        answer: 2,
        explain: 'A bounded blocking queue turns overload into waiting. Producers sleep in put() until a consumer frees a slot, which keeps memory flat. Dropping is a separate policy you must choose on purpose.',
      },
    },
  ],
};
