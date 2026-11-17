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

// Slots: top row A B C, bottom row D E F, and a row of five R1..R5
const A = at(-3.8, -3.8);
const B = at(0, -3.8);
const C = at(3.8, -3.8);
const D = at(-3.6, 3.8);
const E = at(0, 3.8);
const F = at(3.6, 3.8);
const R1 = at(-7.2, 0);
const R2 = at(-3.6, 0);
const R3 = at(0, 0);
const R4 = at(3.6, 0);
const R5 = at(7.2, 0);

// Colors by role: violet = interface, blue = abstract class, green = concrete class, gray = external system
const order = (pos: [number, number], extra: Partial<SceneNode> = {}) => blk('order', pos, 'Order', 'context', 'green', 'ShoppingBag', extra);
const strategy = (extra: Partial<SceneNode> = {}) => blk('strategy', B, 'ShippingStrategy', 'interface', 'violet', 'Plug', extra);
const standard = (extra: Partial<SceneNode> = {}) => blk('standard', D, 'Standard', 'concrete', 'green', 'Package', extra);
const express = (extra: Partial<SceneNode> = {}) => blk('express', E, 'Express', 'concrete', 'green', 'Package', extra);
const free = (extra: Partial<SceneNode> = {}) => blk('free', F, 'Free', 'concrete', 'green', 'Package', extra);

const bus = (pos: [number, number], extra: Partial<SceneNode> = {}) => blk('bus', pos, 'EventBus', 'publish, subscribe', 'green', 'Rss', extra);
const inventory = (extra: Partial<SceneNode> = {}) => blk('inventory', D, 'Inventory', 'handler', 'gray', 'Package', extra);
const email = (extra: Partial<SceneNode> = {}) => blk('email', E, 'Email', 'handler', 'gray', 'Mail', extra);
const metrics = (extra: Partial<SceneNode> = {}) => blk('metrics', F, 'Metrics', 'handler', 'gray', 'Activity', extra);

const state = (extra: Partial<SceneNode> = {}) => blk('state', B, 'OrderState', 'interface', 'violet', 'Plug', extra);
const pending = (extra: Partial<SceneNode> = {}) => blk('pending', D, 'Pending', 'concrete', 'green', 'Clock', extra);
const paid = (extra: Partial<SceneNode> = {}) => blk('paid', E, 'Paid', 'concrete', 'green', 'Receipt', extra);
const shipped = (extra: Partial<SceneNode> = {}) => blk('shipped', F, 'Shipped', 'concrete', 'green', 'Route', extra);

const remote = (extra: Partial<SceneNode> = {}) => blk('remote', A, 'Remote', 'invoker', 'green', 'Zap', extra);
const command = (extra: Partial<SceneNode> = {}) => blk('command', B, 'Command', 'interface', 'violet', 'Plug', extra);
const turnOn = (extra: Partial<SceneNode> = {}) => blk('turnon', D, 'TurnOn', 'concrete', 'green', 'Package', extra);
const light = (extra: Partial<SceneNode> = {}) => blk('light', E, 'Light', 'receiver', 'gray', 'Zap', extra);
const turnOff = (extra: Partial<SceneNode> = {}) => blk('turnoff', F, 'TurnOff', 'concrete', 'green', 'Package', extra);

const gen = (extra: Partial<SceneNode> = {}) => blk('gen', B, 'ReportGenerator', 'abstract class', 'blue', 'FileText', extra);
const csv = (extra: Partial<SceneNode> = {}) => blk('csv', D, 'CsvEmailReport', 'concrete', 'green', 'Mail', extra);
const json = (extra: Partial<SceneNode> = {}) => blk('json', F, 'JsonS3Report', 'concrete', 'green', 'FileJson', extra);

// The five patterns of this part as a row
const five = (status?: 'ok'): SceneNode[] => [
  blk('p-strategy', R1, 'Strategy', 'swap the algorithm', 'blue', 'Split', { status }),
  blk('p-observer', R2, 'Observer', 'fan out events', 'amber', 'Rss', { status }),
  blk('p-state', R3, 'State', 'mode changes behavior', 'teal', 'Repeat', { status }),
  blk('p-command', R4, 'Command', 'action as object', 'violet', 'Zap', { status }),
  blk('p-template', R5, 'Template', 'fixed skeleton', 'green', 'Layers', { status }),
];

export const lldBehavioralPatterns: Lesson = {
  id: 'lld-behavioral-patterns',
  title: 'Behavioral patterns (part 1)',
  tagline: 'Patterns for how objects talk and share work: strategy, observer, state, command and template method, each from the pain that creates it.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'What the behavioral family fixes: tangled control flow and objects that know too much about each other',
    'Strategy: replacing a growing if/elif chain with swappable algorithm objects',
    'Observer: one event, many listeners, and the pitfalls of fire and forget',
    'State: a finite lifecycle as one class per state, and when an enum is enough',
    'Command: actions as objects for undo, queues and dispatch tables, and Template Method for a fixed skeleton',
  ],
  metrics: [
    { key: 'branches', label: 'if/elif branches', icon: 'Split' },
    { key: 'edits', label: 'Files per new case', icon: 'FileCode' },
    { key: 'knows', label: 'Classes caller knows', icon: 'Network' },
    { key: 'pattern', label: 'Pattern', icon: 'Layers' },
  ],
  steps: [
    // 1
    {
      title: 'Tangled flow',
      tag: 'problem',
      heading: 'One method decides everything, and every change edits it',
      eli5: 'One teacher runs the whole school day alone: lunch, bells, hall passes, trips. Every new rule means rewriting her giant to-do list, and she keeps dropping things.',
      body: [
        'An `OrderService.process()` method grew over a year. It prices shipping by order type, checks the order status, then updates inventory, sends a receipt and bumps a metric.',
        'It works, and it is 400 lines with nine branches. Each new shipping option, status or listener means editing this one method, and every edit risks the other branches.',
      ],
      keyIdea: 'When control flow is tangled in one method, every change touches everything. Behavioral patterns untangle who decides what.',
      metrics: { branches: '9', edits: '1 big file', knows: '4', pattern: 'none' },
      metricTones: { branches: 'bad', edits: 'bad', knows: 'bad' },
      scene: {
        nodes: [
          blk('client', A, 'Checkout', 'caller', 'green', 'ShoppingBag'),
          blk('service', B, 'OrderService', 'process(), 400 lines', 'green', 'FileCode', { status: 'hot', badge: '9 branches' }),
          inventory({ sub: 'reduce stock' }),
          email({ sub: 'send receipt' }),
          metrics({ sub: 'count order' }),
        ],
        links: [
          link('client', 'service', { label: 'process(order)' }),
          link('service', 'inventory', { label: 'calls', labelTone: 'warn' }),
          link('service', 'email', { label: 'calls', labelTone: 'warn' }),
          link('service', 'metrics', { label: 'calls', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['client', 'service'], tone: 'request', label: 'process(order)', duration: 1.2 },
          { path: ['service', 'inventory'], tone: 'request', label: 'reduce()', duration: 1.2, delay: 1.3 },
          { path: ['service', 'email'], tone: 'request', label: 'send()', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Inside process()',
          icon: 'Code',
          code: 'if order.kind == "express": ...\nelif order.kind == "standard": ...\nif order.state == "paid": ...\nelif order.state == "pending": ...\ninventory.reduce(order)\nemail.send_receipt(order)\nmetrics.count(order)',
          footer: { text: 'Every new rule edits this method', tone: 'bad' },
        },
        caption: 'One method, many reasons to change',
      },
    },
    // 2
    {
      title: 'Pain map',
      tag: 'concept',
      heading: 'Behavioral patterns: who talks to whom, and who decides',
      eli5: '**Behavioral patterns** are classroom rules about who may ask whom for what. They keep kids from all shouting at once and keep one teacher from doing everything.',
      body: [
        'Creational patterns say how objects are made and structural patterns say how they are composed. **Behavioral patterns** say how objects communicate and share responsibility.',
        'This part covers five, each named after the pain that creates it. Part 2 covers chain of responsibility, mediator, memento, visitor and iterator.',
      ],
      keyIdea: 'Start from the pain in the code, then pick the pattern that removes it.',
      metrics: { branches: '-', edits: '-', knows: '-', pattern: 'five' },
      scene: {
        nodes: five(),
        panel: {
          title: 'Pain to pattern',
          icon: 'List',
          rows: [
            { text: 'Long if/elif on a type', value: 'Strategy' },
            { text: 'One event, many listeners', value: 'Observer' },
            { text: 'Behavior depends on a mode', value: 'State' },
            { text: 'Undo, queue or schedule', value: 'Command' },
            { text: 'Same algorithm, a few steps differ', value: 'Template Method' },
          ],
          footer: { text: 'Pick the pain first, the pattern second', tone: 'muted' },
        },
        caption: 'Five patterns, five different pains',
      },
    },
    // 3
    {
      title: 'Shipping chain',
      tag: 'case',
      heading: 'Case: shipping rules as a growing if/elif chain',
      eli5: 'Each morning the teacher must decide how every kid gets home: bus, walk or pickup. Every new way means a new line in her notebook, and she has to reread the whole book.',
      body: [
        '`Order` computes shipping with an `if/elif` on `order.shipping`: standard is `5 + 2 * kg`, express is `15 + 3 * kg`. It is fine with two rules.',
        'Then marketing asks for free shipping on Black Friday. The chain grows, `Order` is edited again, and the tests for the old rules must be rerun. The choice depends on runtime context, so it cannot be hard-wired.',
      ],
      keyIdea: 'A conditional chain that picks an algorithm by type grows with every new variant and always edits the same class.',
      metrics: { branches: '4', edits: '1 (Order)', knows: '3 rules', pattern: 'none' },
      metricTones: { branches: 'warn', edits: 'warn' },
      scene: {
        nodes: [
          blk('checkout', A, 'Checkout', 'caller', 'green', 'ShoppingBag'),
          order(B, { status: 'hot', badge: '4 branches', chips: [{ text: 'if / elif / elif', tone: 'warn' }] }),
          blk('promo', C, 'Marketing', 'Black Friday', 'gray', 'Star'),
        ],
        links: [link('checkout', 'order', { label: 'total_shipping()' }), link('promo', 'order', { label: 'new rule', labelTone: 'warn' })],
        flows: [
          { path: ['checkout', 'order'], tone: 'request', label: 'total_shipping()', duration: 1.3 },
          { path: ['promo', 'order'], tone: 'error', label: 'add free shipping', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Order.total_shipping()',
          icon: 'Code',
          code: 'if self.shipping == "standard":\n    return 5 + 2 * self.weight\nelif self.shipping == "express":\n    return 15 + 3 * self.weight\nelif self.shipping == "free":\n    return 0',
          footer: { text: 'Every new rule reopens Order', tone: 'warn' },
        },
        caption: 'A new rule means editing Order again',
      },
    },
    // 4
    {
      title: 'Strategy',
      tag: 'concept',
      heading: 'Strategy: one interface, one class per algorithm',
      eli5: 'Instead of a notebook of rules, each kid carries a **strategy** card: bus, walk or pickup. The teacher only says "go home your way" and never reads the rules.',
      body: [
        '**Strategy** pulls each algorithm into its own class behind one interface, here `ShippingStrategy.cost(weight)`. `Order` holds a strategy (has-a) and calls it. It no longer knows which algorithm it got.',
        'A new rule is a new class. `Order` is closed for edits and open for extension, the open/closed principle from the SOLID lessons.',
      ],
      keyIdea: 'Strategy turns a conditional into polymorphism: the caller holds an interface and the algorithm is an object you pass in.',
      metrics: { branches: '0', edits: '1 new file', knows: '1 interface', pattern: 'Strategy' },
      metricTones: { branches: 'good', edits: 'good', knows: 'good' },
      scene: {
        nodes: [order(A, { status: 'active' }), strategy(), standard(), express({ status: 'active' }), free()],
        links: [
          link('order', 'strategy', { label: 'has-a' }),
          link('standard', 'strategy', { label: 'implements' }),
          link('express', 'strategy', { label: 'implements' }),
          link('free', 'strategy', { label: 'implements' }),
        ],
        flows: [
          { path: ['order', 'strategy', 'express'], tone: 'request', label: 'cost(2.5)', duration: 1.8 },
          { path: ['express', 'strategy', 'order'], tone: 'response', label: '22.5', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Same call, three costs for 2.5 kg',
          icon: 'Table',
          rows: [
            { text: 'StandardShipping', value: '10.0' },
            { text: 'ExpressShipping', value: '22.5', tone: 'good' },
            { text: 'FreeShipping', value: '0' },
          ],
          footer: { text: 'Order never branches on type', tone: 'good' },
        },
        caption: 'Order calls the interface, not a class',
      },
      code: {
        language: 'python',
        title: 'Strategy: one class per shipping rule',
        source: `from abc import ABC, abstractmethod

class ShippingStrategy(ABC):
    @abstractmethod
    def cost(self, weight_kg: float) -> float: ...

class StandardShipping(ShippingStrategy):
    def cost(self, w): return 5 + 2 * w

class ExpressShipping(ShippingStrategy):
    def cost(self, w): return 15 + 3 * w

class FreeShipping(ShippingStrategy):
    def cost(self, w): return 0

class Order:
    def __init__(self, weight, strategy: ShippingStrategy):
        self.weight = weight
        self.strategy = strategy

    def total_shipping(self):
        return self.strategy.cost(self.weight)

order = Order(weight=2.5, strategy=ExpressShipping())
print(order.total_shipping())    # 22.5`,
        highlight: [3, 4, 5, 16, 17, 18, 19, 21, 22],
      },
    },
    // 5
    {
      title: 'Swap at runtime',
      tag: 'tradeoff',
      heading: 'Swap the strategy at runtime, and know when not to bother',
      eli5: 'On sports day the teacher says "everyone walks today". She swaps the **strategy** cards in one go and no kid has to change. If only one way home ever exists, no cards are needed.',
      body: [
        'The strategy is a field, so Black Friday is one assignment: `order.strategy = FreeShipping()`. No branch, no redeploy of `Order`. In Python a plain function is also a strategy: `list.sort(key=...)` takes one.',
        'Skip the pattern when there is one algorithm and never will be another. Strategy adds a class per variant, which only pays once variants exist.',
      ],
      keyIdea: 'Strategy is the cleanest fix for a long conditional that picks an algorithm. It is waste when only one algorithm exists.',
      metrics: { branches: '0', edits: '0 (swap a field)', knows: '1 interface', pattern: 'Strategy' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [order(A, { status: 'active', chips: [{ text: 'strategy = Free()', tone: 'good' }] }), strategy(), standard({ status: 'dim' }), express({ status: 'dim' }), free({ status: 'ok', badge: 'Black Friday' })],
        links: [
          link('order', 'strategy', { label: 'has-a' }),
          link('standard', 'strategy', { label: 'implements', style: 'faint' }),
          link('express', 'strategy', { label: 'implements', style: 'faint' }),
          link('free', 'strategy', { label: 'implements' }),
        ],
        flows: [
          { path: ['order', 'strategy', 'free'], tone: 'request', label: 'cost(2.5)', duration: 1.8 },
          { path: ['free', 'strategy', 'order'], tone: 'response', label: '0', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Runtime swap',
          icon: 'Code',
          code: 'order = Order(2.5, ExpressShipping())\norder.total_shipping()   # 22.5\n\n# black friday promo\norder.strategy = FreeShipping()\norder.total_shipping()   # 0',
          footer: { text: 'A function can be a strategy too', tone: 'muted' },
        },
        caption: 'One assignment changes the algorithm',
      },
    },
    // 6
    {
      title: 'Hard-wired listeners',
      tag: 'case',
      heading: 'Case: the order service calls everyone by hand',
      eli5: 'When the lunch bell should ring, the teacher walks to the art room, the gym and the bus and tells each one. A new class means a new walk and one more thing she can forget.',
      body: [
        'Placing an order matters to inventory, email and analytics. `place_order()` calls all three directly. The order service now imports three modules that have nothing to do with taking an order.',
        'A fourth consumer, say a fraud check, means editing `place_order()` again. A slow email call also slows the customer, and a failing one fails the order.',
      ],
      keyIdea: 'When a publisher calls each consumer by name, every new consumer edits the publisher and every slow consumer slows it down.',
      metrics: { branches: '3 calls', edits: '1 (service)', knows: '3 consumers', pattern: 'none' },
      metricTones: { edits: 'warn', knows: 'bad' },
      scene: {
        nodes: [blk('orders', B, 'OrderService', 'place_order()', 'green', 'ShoppingBag', { status: 'hot', badge: 'knows 3 consumers' }), inventory(), email(), metrics()],
        links: [
          link('orders', 'inventory', { label: 'update()', labelTone: 'warn' }),
          link('orders', 'email', { label: 'send()', labelTone: 'warn' }),
          link('orders', 'metrics', { label: 'track()', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['orders', 'inventory'], tone: 'request', label: 'update_inventory()', duration: 1.2 },
          { path: ['orders', 'email'], tone: 'request', label: 'send_receipt()', duration: 1.2, delay: 1.3 },
          { path: ['orders', 'metrics'], tone: 'request', label: 'track_metric()', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'place_order()',
          icon: 'Code',
          code: 'def place_order(order):\n    save(order)\n    inventory.update(order)\n    email.send_receipt(order)\n    metrics.track(order)\n    # fraud.check(order)  <- next edit',
          footer: { text: 'The publisher knows every listener', tone: 'bad' },
        },
        caption: 'One event, three hard-wired calls',
      },
    },
    // 7
    {
      title: 'Observer',
      tag: 'concept',
      heading: 'Observer: publish once, let listeners subscribe',
      eli5: 'The teacher rings one bell. Everyone who asked to listen, the art room, the gym, the bus, does their own thing. The bell never knows who is listening. Each listener is an **observer**.',
      body: [
        'An **event bus** keeps a list of handlers per event name. Consumers call `subscribe("order_placed", handler)`. The order service calls `publish("order_placed", order)` and moves on.',
        'It does not know or care who listens. A fraud check is a new subscription and `OrderService` stays untouched. Listeners can come and go at runtime.',
      ],
      keyIdea: 'Observer inverts the dependency: consumers know the event, the publisher knows nobody.',
      metrics: { branches: '0', edits: '1 (new handler)', knows: '1 (the bus)', pattern: 'Observer' },
      metricTones: { edits: 'good', knows: 'good' },
      scene: {
        nodes: [blk('orders', A, 'OrderService', 'publisher', 'green', 'ShoppingBag'), bus(B, { status: 'active' }), inventory(), email(), metrics()],
        links: [
          link('orders', 'bus', { label: 'publish' }),
          link('inventory', 'bus', { label: 'subscribes', style: 'dashed' }),
          link('email', 'bus', { label: 'subscribes', style: 'dashed' }),
          link('metrics', 'bus', { label: 'subscribes', style: 'dashed' }),
        ],
        flows: [
          { path: ['orders', 'bus'], tone: 'event', label: 'order_placed', duration: 1.3 },
          { path: ['bus', 'inventory'], tone: 'event', label: 'handler(order)', duration: 1.3, delay: 1.4 },
          { path: ['bus', 'email'], tone: 'event', label: 'handler(order)', duration: 1.3, delay: 1.7 },
          { path: ['bus', 'metrics'], tone: 'event', label: 'handler(order)', duration: 1.3, delay: 2.0 },
        ],
        panel: {
          title: 'Publisher side',
          icon: 'Code',
          code: 'bus.subscribe("order_placed", update_inventory)\nbus.subscribe("order_placed", send_receipt)\nbus.subscribe("order_placed", track_metric)\n\nbus.publish("order_placed", order)',
          footer: { text: 'Publisher knows no listener', tone: 'good' },
        },
        caption: 'Subscribe once, publish forever',
      },
      code: {
        language: 'python',
        title: 'A minimal event bus',
        source: `class EventBus:
    def __init__(self):
        self._subs: dict[str, list] = {}

    def subscribe(self, event, handler):
        self._subs.setdefault(event, []).append(handler)

    def publish(self, event, payload):
        for handler in self._subs.get(event, []):
            handler(payload)

bus = EventBus()

def update_inventory(order): print("inventory --", order["qty"])
def send_receipt(order):     print("receipt sent to", order["user"])
def track_metric(order):     print("metrics: +1 order")

bus.subscribe("order_placed", update_inventory)
bus.subscribe("order_placed", send_receipt)
bus.subscribe("order_placed", track_metric)

bus.publish("order_placed", {"user": "ana@example.com", "sku": "SKU-1", "qty": 2})`,
        highlight: [5, 6, 8, 9, 10, 22],
      },
    },
    // 8
    {
      title: 'Fire and forget',
      tag: 'tradeoff',
      heading: 'The price of Observer: no return value, hidden order, shared failure',
      eli5: 'The bell tells everyone at once but nobody answers back. If the art room ignores it, the bell cannot tell. If one room is slow, the bell may wait for it.',
      body: [
        'Events are fire and forget. The publisher gets no value back from handlers and has no guaranteed order between them. If you need an ordered answer from each consumer, call them directly.',
        'In the bus above, one handler that raises stops the loop and the later handlers never run. Wrap each call in `try/except` and log. Guava cache removal listeners, DOM `addEventListener` and Django signals all work this way.',
      ],
      keyIdea: 'Observer decouples a publisher from many consumers. In return you give up return values, ordering and automatic failure isolation.',
      metrics: { branches: '0', edits: '1 (new handler)', knows: '1 (the bus)', pattern: 'Observer' },
      metricTones: { knows: 'good' },
      scene: {
        nodes: [bus(B, { status: 'active' }), inventory({ status: 'ok', badge: 'ran' }), email({ status: 'down', badge: 'raised' }), metrics({ status: 'dim', badge: 'never ran' })],
        links: [link('bus', 'inventory'), link('bus', 'email'), link('bus', 'metrics')],
        flows: [
          { path: ['bus', 'inventory'], tone: 'event', label: 'handler(order)', duration: 1.2 },
          { path: ['bus', 'email'], tone: 'event', label: 'handler(order)', duration: 1.2, delay: 1.3 },
          { path: ['email', 'bus'], tone: 'error', label: 'SMTPError', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Isolate each handler',
          icon: 'Shield',
          code: 'def publish(self, event, payload):\n    for h in self._subs.get(event, []):\n        try:\n            h(payload)\n        except Exception:\n            log.exception("handler failed")',
          footer: { text: 'One bad listener must not starve the rest', tone: 'warn' },
        },
        caption: 'An exception in one handler stops the loop',
      },
      quiz: {
        question: 'An order must notify inventory, email and analytics, and more consumers will be added over time. Which pattern fits, and what do you give up?',
        options: [
          'Strategy: you give up the ability to swap algorithms',
          'Observer: you give up return values and a guaranteed order between handlers',
          'State: you give up a finite set of modes',
          'Template Method: you give up subclassing',
        ],
        answer: 1,
        explain: 'One event with many independent consumers is Observer. The publisher gets no return value, handler order is not guaranteed, and a raising handler can stop the others unless each call is wrapped.',
      },
    },
    // 9
    {
      title: 'Scattered state',
      tag: 'case',
      heading: 'Case: every method checks the status string',
      eli5: 'A toy robot acts differently when asleep, awake or charging. Its instruction book repeats "if asleep do this, if awake do that" on every page, and one page always gets forgotten.',
      body: [
        'An order is pending, paid, shipped or cancelled. `pay()`, `ship()` and `cancel()` each start with `if self.state == "...":` and branch again for every status.',
        'Four states times three methods is twelve cases spread over three methods. Miss one and a bug ships: an unpaid order goes to the warehouse. The rules of the lifecycle live nowhere in one place.',
      ],
      keyIdea: 'When behavior depends on a mode, an `if state ==` in every method scatters the lifecycle rules and invites missed cases.',
      metrics: { branches: '12', edits: '3 methods', knows: '4 strings', pattern: 'none' },
      metricTones: { branches: 'bad', edits: 'bad' },
      scene: {
        nodes: [
          blk('client', A, 'Checkout', 'caller', 'green', 'ShoppingBag'),
          order(B, { status: 'hot', badge: '12 cases', chips: [{ text: 'if state == ...', tone: 'warn' }] }),
          blk('warehouse', C, 'Warehouse', 'ships the box', 'gray', 'Package', { status: 'down' }),
        ],
        links: [link('client', 'order', { label: 'ship()' }), link('order', 'warehouse', { label: 'ships', labelTone: 'bad' })],
        flows: [
          { path: ['client', 'order'], tone: 'request', label: 'ship() on unpaid', duration: 1.3 },
          { path: ['order', 'warehouse'], tone: 'error', label: 'shipped, unpaid', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'The same check, three times',
          icon: 'Code',
          code: 'def ship(self):\n    if self.state == "paid":\n        self.state = "shipped"\n    elif self.state == "shipped":\n        raise Error("already shipped")\n    # forgot "pending"',
          footer: { text: 'A forgotten branch ships unpaid orders', tone: 'bad' },
        },
        caption: 'A missed branch lets an unpaid order ship',
      },
    },
    // 10
    {
      title: 'State',
      tag: 'concept',
      heading: 'State: one class per mode, and the object switches itself',
      eli5: 'Each mode gets its own instruction card: asleep, awake, charging. The robot holds one card at a time and does what it says. When the mode changes, it swaps cards. Each card is a **state**.',
      body: [
        '**State** gives each lifecycle mode its own class behind an `OrderState` interface. `Pending`, `Paid` and `Shipped` each implement `pay()`, `ship()` and `cancel()` for their own mode.',
        '`Order` delegates every call to its current state. A state changes the mode by assigning `order.state = Paid()`. An illegal move, like shipping while pending, raises inside that state.',
      ],
      keyIdea: 'State puts each mode in one class and lets the transitions live next to the behavior they allow.',
      metrics: { branches: '0', edits: '1 new class', knows: '1 interface', pattern: 'State' },
      metricTones: { branches: 'good', edits: 'good' },
      scene: {
        nodes: [order(A, { status: 'active' }), state(), pending({ status: 'ok' }), paid(), shipped()],
        links: [
          link('order', 'state', { label: 'has-a' }),
          link('pending', 'state', { label: 'implements', style: 'faint' }),
          link('paid', 'state', { label: 'implements', style: 'faint' }),
          link('shipped', 'state', { label: 'implements', style: 'faint' }),
          link('pending', 'paid', { label: 'pay()', style: 'dashed' }),
          link('paid', 'shipped', { label: 'ship()', style: 'dashed' }),
        ],
        flows: [
          { path: ['order', 'state', 'pending'], tone: 'request', label: 'pay()', duration: 1.6 },
          { path: ['pending', 'paid'], tone: 'event', label: 'state = Paid()', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Legal moves per state',
          icon: 'Table',
          rows: [
            { text: 'Pending', value: 'pay, cancel' },
            { text: 'Paid', value: 'ship, cancel' },
            { text: 'Shipped', value: 'none', tone: 'warn' },
            { text: 'Cancelled', value: 'cancel (no-op)', tone: 'muted' },
          ],
          footer: { text: 'The table lives in the classes', tone: 'good' },
        },
        caption: 'The order delegates to its current state',
      },
      code: {
        language: 'python',
        title: 'State: one class per mode',
        source: `from abc import ABC, abstractmethod

class OrderState(ABC):
    @abstractmethod
    def pay(self, order): ...
    @abstractmethod
    def ship(self, order): ...

class Pending(OrderState):
    def pay(self, order):
        print("payment received"); order.state = Paid()
    def ship(self, order):
        raise RuntimeError("can't ship unpaid order")

class Paid(OrderState):
    def pay(self, order):  raise RuntimeError("already paid")
    def ship(self, order):
        print("shipping!"); order.state = Shipped()

class Order:
    def __init__(self):
        self.state: OrderState = Pending()
    def pay(self):  self.state.pay(self)
    def ship(self): self.state.ship(self)`,
        highlight: [10, 11, 12, 13, 17, 18, 22, 23, 24],
      },
    },
    // 11
    {
      title: 'State or enum',
      tag: 'tradeoff',
      heading: 'Illegal moves, idempotent cancel, and when an enum is enough',
      eli5: 'A card can say "no" kindly: a robot that is charging cannot walk, so its card says so. But if the robot only has two modes, a sticky note is simpler than a stack of cards.',
      body: [
        'Each state decides what is legal. `Shipped.cancel()` raises "in transit, cannot cancel". `Cancelled.cancel()` does nothing, so cancelling twice is safe (idempotent). TCP connection states and workflow engines use the same idea.',
        'Two or three modes with trivial differences do not need classes. A simple enum and one `if` is easier to read. Use State when the lifecycle is a real finite machine with different behavior per mode.',
      ],
      keyIdea: 'State pays off for a real lifecycle with behavior per mode. For two or three trivial modes, an enum and an if is enough.',
      metrics: { branches: '0', edits: '1 new class', knows: '1 interface', pattern: 'State' },
      scene: {
        nodes: [
          blk('client', A, 'Client', 'calls cancel()', 'gray', 'User'),
          shipped({ at: B, status: 'hot', badge: 'in transit', chips: [{ text: 'cancel() raises', tone: 'bad' }] }),
          blk('cancelled', C, 'Cancelled', 'concrete', 'green', 'Shield', { status: 'ok', chips: [{ text: 'cancel() no-op', tone: 'good' }] }),
        ],
        links: [link('client', 'shipped', { label: 'cancel()' }), link('client', 'cancelled', { label: 'cancel()' })],
        flows: [
          { path: ['client', 'shipped'], tone: 'request', label: 'cancel()', duration: 1.3 },
          { path: ['shipped', 'client'], tone: 'error', label: 'in transit', duration: 1.3, delay: 1.4 },
          { path: ['client', 'cancelled'], tone: 'request', label: 'cancel()', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'When to skip State',
          icon: 'Scale',
          rows: [
            { text: 'Real lifecycle, many modes', value: 'State', tone: 'good' },
            { text: 'Behavior differs per mode', value: 'State', tone: 'good' },
            { text: '2 or 3 trivial modes', value: 'enum + if', tone: 'warn' },
            { text: 'Rules change rarely', value: 'enum + if', tone: 'warn' },
          ],
          footer: { text: 'Do not add a class per flag', tone: 'muted' },
        },
        caption: 'Illegal moves fail inside the state',
      },
    },
    // 12
    {
      title: 'Vanishing call',
      tag: 'case',
      heading: 'Case: a method call is gone the moment it finishes',
      eli5: 'You say "light on" out loud and the light goes on. Nobody wrote it down, so nobody can undo it, save it for later or hand it to a helper.',
      body: [
        'A remote control calls `light.turn_on()` directly. The call happens and leaves no trace. There is no history to undo from, and nothing to put in a queue or run at 7 pm.',
        'A method call is ephemeral. To undo, log, queue or schedule an action, the action itself must be a thing you can keep.',
      ],
      keyIdea: 'A direct method call cannot be undone, queued, logged or scheduled, because nothing remains of it afterward.',
      metrics: { branches: '-', edits: '2 per action', knows: '1 receiver', pattern: 'none' },
      metricTones: { edits: 'warn' },
      scene: {
        nodes: [
          remote(),
          light({ at: B, sub: 'receiver', status: 'active' }),
          blk('queue', E, 'Job queue', 'scheduler', 'gray', 'Inbox', { status: 'dim' }),
        ],
        links: [
          link('remote', 'light', { label: 'turn_on()' }),
          link('remote', 'queue', { label: 'what do I enqueue?', labelTone: 'warn', style: 'dashed' }),
        ],
        flows: [{ path: ['remote', 'light'], tone: 'request', label: 'turn_on()', duration: 1.4 }],
        panel: {
          title: 'After the call',
          icon: 'Table',
          rows: [
            { text: 'Light is on', value: 'yes', tone: 'good' },
            { text: 'Undo available', value: 'no', tone: 'bad' },
            { text: 'Can queue it', value: 'no', tone: 'bad' },
            { text: 'Can log it', value: 'no', tone: 'bad' },
          ],
          footer: { text: 'The call left nothing behind', tone: 'bad' },
        },
        caption: 'A direct call is gone once it returns',
      },
    },
    // 13
    {
      title: 'Command',
      tag: 'concept',
      heading: 'Command: wrap the action in an object with execute and undo',
      eli5: 'Write the request on a slip of paper: "turn the light on". The slip can sit in a tray, go to a helper, or be torn up by writing the opposite slip. The slip is a **command**.',
      body: [
        'A **Command** is an object with `execute()` and `undo()`. `TurnOnCommand` holds a reference to the `Light` (the receiver). The `RemoteControl` (the invoker) only knows the `Command` interface.',
        'Because the action is now data, the remote can store it. `undo()` of `TurnOn` is `turn_off()`, and each command knows its own opposite.',
      ],
      keyIdea: 'Command turns a call into an object, so actions can be stored, queued, logged and reversed.',
      metrics: { branches: '-', edits: '1 new class', knows: '1 interface', pattern: 'Command' },
      metricTones: { edits: 'good', knows: 'good' },
      scene: {
        nodes: [remote({ status: 'active' }), command(), turnOn({ status: 'active' }), light(), turnOff()],
        links: [
          link('remote', 'command', { label: 'uses' }),
          link('turnon', 'command', { label: 'implements', style: 'faint' }),
          link('turnoff', 'command', { label: 'implements', style: 'faint' }),
          link('turnon', 'light', { label: 'has-a' }),
          link('turnoff', 'light', { label: 'has-a' }),
        ],
        flows: [
          { path: ['remote', 'command', 'turnon', 'light'], tone: 'request', label: 'execute()', duration: 2.2 },
          { path: ['light', 'turnon'], tone: 'response', label: 'light ON', duration: 1.2, delay: 2.3 },
        ],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class Command(ABC):\n    def execute(self): ...\n    def undo(self): ...\n\nTurnOnCommand(light).execute()   # on\nTurnOnCommand(light).undo()      # off',
          footer: { text: 'Invoker never touches the receiver', tone: 'good' },
        },
        caption: 'The remote presses a command, not a method',
      },
      code: {
        language: 'python',
        title: 'Command with undo',
        source: `from abc import ABC, abstractmethod

class Command(ABC):
    @abstractmethod
    def execute(self): ...
    @abstractmethod
    def undo(self): ...

class Light:
    def __init__(self): self.on = False
    def turn_on(self):  self.on = True;  print("light ON")
    def turn_off(self): self.on = False; print("light OFF")

class TurnOnCommand(Command):
    def __init__(self, light): self.light = light
    def execute(self): self.light.turn_on()
    def undo(self):    self.light.turn_off()

class TurnOffCommand(Command):
    def __init__(self, light): self.light = light
    def execute(self): self.light.turn_off()
    def undo(self):    self.light.turn_on()`,
        highlight: [3, 5, 7, 14, 16, 17],
      },
    },
    // 14
    {
      title: 'Undo and queues',
      tag: 'tradeoff',
      heading: 'A history stack gives undo, and the same object feeds queues',
      eli5: 'Keep the used slips in a pile. To undo, take the top slip and do its opposite. The same slips can wait in a tray for a helper to do later.',
      body: [
        'The remote keeps a `history` list. `press(cmd)` runs it and pushes it. `undo_last()` pops the top command and calls its `undo()`. The same objects can go into a queue (Celery and Sidekiq tasks) or a macro, and database migrations are commands with up and down.',
        'Skip it for one-off actions you never undo. A plain function does the job and a Command class is ceremony.',
      ],
      keyIdea: 'Command is worth its classes when you need undo, a queue, a log or a macro. For a one-off call it is overhead.',
      metrics: { branches: '-', edits: '1 new class', knows: '1 interface', pattern: 'Command' },
      scene: {
        nodes: [remote({ status: 'active', chips: [{ text: 'history: [On, Off]', tone: 'good' }] }), command(), turnOn(), light({ badge: 'OFF' })],
        links: [link('remote', 'command', { label: 'press / undo_last' }), link('turnon', 'command', { label: 'implements', style: 'faint' }), link('turnon', 'light', { label: 'has-a' })],
        flows: [
          { path: ['remote', 'command', 'turnon', 'light'], tone: 'request', label: 'undo()', duration: 2.2 },
          { path: ['light', 'turnon', 'command', 'remote'], tone: 'response', label: 'history.pop()', duration: 2.2, delay: 2.3 },
        ],
        panel: {
          title: 'press, press, undo, undo',
          icon: 'Code',
          code: 'remote.press(TurnOnCommand(light))   # ON\nremote.press(TurnOffCommand(light))  # OFF\nremote.undo_last()                   # ON\nremote.undo_last()                   # OFF',
          footer: { text: 'History is a stack of Command objects', tone: 'muted' },
        },
        caption: 'Undo pops a command and reverses it',
      },
    },
    // 15
    {
      title: 'Redis dispatch',
      tag: 'case',
      heading: 'Case: how a Redis-style server dispatches SET, GET and INCR',
      eli5: 'The post office has one slip type per job, and a board that says which clerk handles which slip. The clerk at the door just reads the name on the slip and passes it on.',
      body: [
        'Each wire command (`SET`, `GET`, `INCR`) is a class with `execute(store, args)`. The server keeps a registry that maps the command name to its object and calls `execute`. There is no giant `if name == "SET"` chain.',
        'Adding a command is adding a class and a registry entry. The same registry idea shows up as a dispatch table in many servers.',
      ],
      keyIdea: 'A registry of command objects, keyed by name, replaces the dispatch if/elif and makes the command set easy to extend.',
      metrics: { branches: '0', edits: '1 class + 1 entry', knows: '1 registry', pattern: 'Command' },
      metricTones: { branches: 'good', edits: 'good' },
      scene: {
        nodes: [
          blk('client', A, 'Client', 'SET foo bar', 'gray', 'User'),
          blk('server', B, 'Server', 'registry', 'green', 'Network', { status: 'active' }),
          blk('setcmd', D, 'SetCmd', 'execute()', 'green', 'Package'),
          blk('getcmd', E, 'GetCmd', 'execute()', 'green', 'Package'),
          blk('incrcmd', F, 'IncrCmd', 'execute()', 'green', 'Package'),
        ],
        links: [
          link('client', 'server', { label: 'wire bytes' }),
          link('server', 'setcmd', { label: 'creates', style: 'faint' }),
          link('server', 'getcmd', { label: 'creates', style: 'faint' }),
          link('server', 'incrcmd', { label: 'creates', style: 'faint' }),
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', label: 'SET foo bar', duration: 1.3 },
          { path: ['server', 'setcmd'], tone: 'request', label: 'execute(store, args)', duration: 1.5, delay: 1.4 },
          { path: ['setcmd', 'server', 'client'], tone: 'response', label: 'OK', duration: 1.6, delay: 3.0 },
        ],
        panel: {
          title: 'Dispatch table',
          icon: 'Code',
          code: 'self.commands = {\n    "SET":  SetCmd(),\n    "GET":  GetCmd(),\n    "INCR": IncrCmd(),\n}\ncmd = self.commands[name.upper()]\nresult = cmd.execute(self.store, args)',
          footer: { text: 'New command: one class, one entry', tone: 'good' },
        },
        caption: 'The name picks the command object',
      },
      quiz: {
        question: 'You need undo and redo for a drawing tool, plus a way to replay recorded actions. Which pattern is the natural fit?',
        options: [
          'Strategy, one algorithm object per tool',
          'Observer, notify listeners on every stroke',
          'Command, each action is an object with execute and undo kept in a history',
          'Template Method, a fixed skeleton with swappable steps',
        ],
        answer: 2,
        explain: 'Command stores each action as an object with execute and undo. A history stack gives undo and redo, and the same objects can be recorded and replayed or queued.',
      },
    },
    // 16
    {
      title: 'Copy-paste skeleton',
      tag: 'case',
      heading: 'Case: two reports that are 80 percent the same code',
      eli5: 'Two kids color the same worksheet and each redraws the whole outline by hand. When the title box moves, you must fix both sheets, and one always gets missed.',
      body: [
        'A CSV-by-email report and a JSON-to-S3 report each repeat the same algorithm: build a header, format the body, add a footer, deliver. Only the body format and the delivery differ.',
        'Someone changes the footer and fixes one copy. The other report keeps the old footer for months. Copy-pasted skeletons drift apart.',
      ],
      keyIdea: 'When variants share most of an algorithm and differ in a few steps, copy-paste lets the shared part drift.',
      metrics: { branches: '-', edits: '2 (one per copy)', knows: '-', pattern: 'none' },
      metricTones: { edits: 'warn' },
      scene: {
        nodes: [
          csv({ at: A, status: 'hot', badge: 'footer fixed' }),
          blk('boss', B, 'Change request', 'new footer', 'gray', 'FileText'),
          json({ at: C, status: 'hot', badge: 'old footer' }),
        ],
        links: [link('boss', 'csv', { label: 'edit' }), link('boss', 'json', { label: 'forgotten', labelTone: 'bad', style: 'dashed' })],
        flows: [
          { path: ['boss', 'csv'], tone: 'request', label: 'new footer', duration: 1.3 },
          { path: ['boss', 'json'], tone: 'error', label: 'missed', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Both reports repeat',
          icon: 'List',
          rows: [
            { text: 'build header', value: 'same', tone: 'warn' },
            { text: 'format body', value: 'differs' },
            { text: 'build footer', value: 'same', tone: 'warn' },
            { text: 'deliver', value: 'differs' },
          ],
          footer: { text: 'Two copies of the shared steps', tone: 'bad' },
        },
        caption: 'The shared steps live in two places',
      },
    },
    // 17
    {
      title: 'Template Method',
      tag: 'concept',
      heading: 'Template Method: the base class owns the order of steps',
      eli5: 'The teacher prints the worksheet outline once, with blank boxes. Each kid colors the boxes their own way. The printed outline is the **template**, and nobody redraws it.',
      body: [
        '**Template Method** puts the algorithm in one method of an abstract base class: `generate()` calls `build_header()`, `format_body()`, `build_footer()` and `deliver()` in a fixed order.',
        'Subclasses override only the steps that differ. The base class calls the subclass, not the other way round: "do not call us, we call you". The skeleton lives in one place.',
      ],
      keyIdea: 'Template Method fixes the order of an algorithm in a base class and lets subclasses fill in the variable steps.',
      metrics: { branches: '-', edits: '1 (the template)', knows: '1 base class', pattern: 'Template Method' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [blk('caller', A, 'Caller', 'client code', 'gray', 'User'), gen({ status: 'active' }), csv(), json()],
        links: [
          link('caller', 'gen', { label: 'generate()' }),
          link('csv', 'gen', { label: 'extends' }),
          link('json', 'gen', { label: 'extends' }),
        ],
        flows: [
          { path: ['caller', 'gen'], tone: 'request', label: 'generate(rows)', duration: 1.3 },
          { path: ['gen', 'csv'], tone: 'request', label: 'format_body()', duration: 1.4, delay: 1.4 },
          { path: ['gen', 'csv'], tone: 'request', label: 'deliver()', duration: 1.4, delay: 3.0 },
        ],
        panel: {
          title: 'The skeleton',
          icon: 'Code',
          code: 'def generate(self, data):\n    header = self.build_header()   # default\n    body   = self.format_body(data) # abstract\n    footer = self.build_footer()   # default\n    out = header + body + footer\n    self.deliver(out)              # abstract\n    return out',
          footer: { text: 'Steps 2 and 5 are filled by subclasses', tone: 'good' },
        },
        caption: 'The base class runs the steps in order',
      },
      code: {
        language: 'python',
        title: 'Template Method: a report skeleton',
        source: `from abc import ABC, abstractmethod
import json

class ReportGenerator(ABC):
    def generate(self, data):
        header = self.build_header()
        body   = self.format_body(data)
        footer = self.build_footer()
        output = header + body + footer
        self.deliver(output)
        return output

    def build_header(self):            # default, may override
        return "=== REPORT ===\\n"
    def build_footer(self):
        return "\\n=== END ===\\n"

    @abstractmethod
    def format_body(self, data): ...   # must override
    @abstractmethod
    def deliver(self, output): ...     # must override

class CsvEmailReport(ReportGenerator):
    def format_body(self, rows):
        return "\\n".join(",".join(map(str, r)) for r in rows)
    def deliver(self, output):
        print("emailing report:\\n", output)

class JsonS3Report(ReportGenerator):
    def format_body(self, rows):
        return json.dumps(rows)
    def deliver(self, output):
        print("uploading to s3:\\n", output)`,
        highlight: [5, 6, 7, 8, 9, 10, 13, 15, 19, 21],
      },
    },
    // 18
    {
      title: 'Hooks and limits',
      tag: 'tradeoff',
      heading: 'Hooks versus required steps, and where Template Method stops working',
      eli5: 'Some boxes on the worksheet are already filled with a default, and a kid can paint over them. Other boxes are empty, and every kid must fill them. If every box is different, a plain blank page is better.',
      body: [
        'A step with a default (`build_header`) is a **hook**: a subclass may override it. A step marked `@abstractmethod` is required, so a subclass that forgets it cannot be created. Frameworks use this a lot: Django class-based views and `unittest.TestCase` (`setUp`, test, `tearDown`).',
        'Skip it when almost every step differs. Then the template is empty and subclasses repeat everything. Compose strategies instead. Inheritance is also fixed when the class is written, while a strategy can be swapped at runtime.',
      ],
      keyIdea: 'Template Method fits a clear skeleton with a few variable steps. When most steps vary, composing strategies is cleaner.',
      metrics: { branches: '-', edits: '1 new subclass', knows: '1 base class', pattern: 'Template Method' },
      scene: {
        nodes: [
          gen({ at: B, status: 'active', chips: [{ text: 'generate() fixed', tone: 'good' }] }),
          blk('hook', D, 'build_header', 'hook, has default', 'amber', 'Repeat'),
          blk('required', F, 'format_body', 'abstract, required', 'red', 'Shield'),
        ],
        links: [link('gen', 'hook', { label: 'calls' }), link('gen', 'required', { label: 'calls' })],
        flows: [
          { path: ['gen', 'hook'], tone: 'request', label: 'default ok', duration: 1.3 },
          { path: ['gen', 'required'], tone: 'request', label: 'must override', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Template or Strategy?',
          icon: 'Scale',
          rows: [
            { text: 'One skeleton, few steps differ', value: 'Template', tone: 'good' },
            { text: 'Most steps differ', value: 'Strategy', tone: 'warn' },
            { text: 'Choose variant at runtime', value: 'Strategy', tone: 'warn' },
            { text: 'Variant fixed per class', value: 'Template' },
          ],
          footer: { text: 'Inheritance binds at class definition', tone: 'muted' },
        },
        caption: 'Hooks have defaults, abstract steps are required',
      },
    },
    // 19
    {
      title: 'Look-alikes',
      tag: 'tradeoff',
      heading: 'Strategy, State and Template Method look alike, and differ in who decides',
      eli5: 'All three swap how something is done. With **strategy** you pick the card from outside. With state the toy swaps its own card. With a template the outline is printed and you only color it.',
      body: [
        '**Strategy**: the caller picks an algorithm and passes it in. Strategies do not know each other. **State**: the object changes its own behavior as it moves between modes, and states often trigger the transitions.',
        '**Template Method**: the variation sits in a subclass chosen when the object is created, and a base class owns the skeleton. Same shape, different intent. Ask who chooses and when.',
      ],
      keyIdea: 'Strategy is chosen from outside, State switches from inside, Template Method is fixed by the subclass you instantiate.',
      metrics: { branches: '-', edits: '-', knows: '-', pattern: 'compare' },
      scene: {
        nodes: [
          blk('l-strategy', A, 'Strategy', 'caller picks', 'blue', 'Split'),
          blk('l-state', B, 'State', 'object switches', 'teal', 'Repeat'),
          blk('l-template', C, 'Template', 'subclass fills', 'green', 'Layers'),
        ],
        panel: {
          title: 'Who decides, and when',
          icon: 'Table',
          rows: [
            { text: 'Strategy', value: 'caller, at runtime' },
            { text: 'State', value: 'object, on events' },
            { text: 'Template Method', value: 'subclass, at creation' },
            { text: 'Strategy swaps', value: 'yes', tone: 'good' },
            { text: 'State swaps itself', value: 'yes', tone: 'good' },
            { text: 'Template swaps', value: 'no', tone: 'warn' },
          ],
        },
        caption: 'Same shape, different intent',
      },
    },
    // 20
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: five patterns, five pains',
      eli5: 'Five classroom helpers: a way-home card, a bell, a mood card, an order slip and a worksheet outline. Each fixes one mess, and you pick the helper that matches the mess.',
      body: [
        '**Strategy** swaps an algorithm. **Observer** fans one event out to many listeners. **State** moves behavior into per-mode classes. **Command** makes an action an object. **Template Method** fixes a skeleton and lets subclasses fill steps.',
        'Do not start with a pattern. Start with the pain. Part 2 covers chain of responsibility, mediator, memento, visitor and iterator.',
      ],
      keyIdea: 'Behavioral patterns untangle who decides and who talks to whom. Match the pattern to the pain, and skip it when no pain exists.',
      metrics: { branches: '0', edits: '1 new class', knows: '1 interface', pattern: 'five' },
      metricTones: { branches: 'good', edits: 'good', knows: 'good' },
      scene: {
        nodes: five('ok'),
        panel: {
          title: 'Pick by pain',
          icon: 'List',
          rows: [
            { text: 'Long if/elif on type', value: 'Strategy' },
            { text: 'One event, many listeners', value: 'Observer' },
            { text: 'Mode-dependent behavior', value: 'State' },
            { text: 'Undo, queue, macro', value: 'Command' },
            { text: '80% same algorithm', value: 'Template Method' },
          ],
          footer: { text: 'No pain yet, no pattern yet', tone: 'muted' },
        },
        caption: 'Five patterns, one rule: start from the pain',
      },
      quiz: {
        question: 'An `Order` has a `state` string and every method repeats `if self.state == ...`. Which fix removes those branches and keeps the lifecycle rules in one place per mode?',
        options: [
          'Strategy: pass in a different shipping algorithm',
          'Observer: publish an event on each change',
          'State: one class per mode, and the order delegates to its current state',
          'Template Method: put the common steps in a base class',
        ],
        answer: 2,
        explain: 'Behavior that depends on a mode is the State pattern. Each state class holds the legal moves for its mode, and Order delegates every call to the current state.',
      },
    },
  ],
};
