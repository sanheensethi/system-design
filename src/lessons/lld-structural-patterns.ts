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

// Colors: violet = interface, blue = abstract, green = concrete, gray = external system
const checkout = blk('checkout', A, 'Checkout', 'your app', 'green', 'ShoppingBag');
const gateway = blk('gateway', B, 'PaymentGateway', 'interface', 'violet', 'Plug');
const adapter = blk('adapter', C, 'StripeAdapter', 'concrete', 'green', 'Cable');
const legacy = blk('legacy', F, 'LegacyStripe', 'external library', 'gray', 'Package');

export const lldStructuralPatterns: Lesson = {
  id: 'lld-structural-patterns',
  title: 'Structural patterns (part 1)',
  tagline: 'Adapter, Decorator, Facade and Proxy: four ways to compose objects so pieces that do not fit can still work together.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Adapter: making a library with the wrong interface fit the one your code expects',
    'Decorator: stacking behavior around an object, as wrapper classes and as Python decorators',
    'Facade: one method that hides a five-subsystem orchestration, and what it costs',
    'Proxy: a stand-in with the same interface, in its virtual, protection, remote and caching flavors',
    'How the four look alike, and how to tell them apart by intent',
  ],
  metrics: [
    { key: 'callers', label: 'Callers changed', icon: 'Users' },
    { key: 'classes', label: 'New classes', icon: 'Boxes' },
    { key: 'pattern', label: 'Pattern', icon: 'Layers' },
  ],
  steps: [
    // 1
    {
      title: 'Pieces misfit',
      tag: 'problem',
      heading: 'Your code speaks one interface, the library speaks another',
      eli5: 'In the **toy shop**, the new battery toy needs a round plug but the shelf only has square sockets. You cannot saw the toy apart, so the plug does not fit.',
      body: [
        'Your checkout calls `gateway.charge(cents, token)`. The payment library you must use offers `do_payment(dollars, card_token, currency)`. Different name, different arguments, different units.',
        '**Structural patterns** are about how objects are composed so mismatched or heavy pieces still work together. Seven of them follow. The shared pain: two pieces of code speak different languages.',
      ],
      keyIdea: 'Structural patterns solve composition problems: how objects connect, wrap and share.',
      metrics: { callers: '0', classes: '0', pattern: 'none' },
      metricTones: { pattern: 'bad' },
      scene: {
        nodes: [checkout, legacy],
        links: [link('checkout', 'legacy', { label: 'charge(1999, tok) ???', labelTone: 'bad', route: 'straight' })],
        flows: [{ path: ['checkout', 'legacy'], tone: 'error', label: 'charge()', duration: 1.4 }],
        panel: {
          title: 'The mismatch',
          icon: 'Cable',
          rows: [
            { text: 'Your call', value: 'charge(cents, token)' },
            { text: 'Library offers', value: 'do_payment(dollars, ...)', tone: 'warn' },
            { text: 'Unit', value: 'cents vs dollars', tone: 'bad' },
            { text: 'Library source', value: 'cannot edit', tone: 'bad' },
          ],
        },
        caption: 'Neither side can change',
      },
    },
    // 2
    {
      title: 'Adapter',
      tag: 'concept',
      heading: 'Adapter: translate one interface into another',
      eli5: 'A travel **adapter** is a small piece that has a round plug on one side and a square hole on the other. The toy and the socket never change.',
      body: [
        'Define the interface your app wants, `PaymentGateway`. Write `StripeAdapter` to implement it and hold a `LegacyStripe`. Each call is translated and forwarded.',
        'Checkout depends only on the interface. The adapter is the one place that knows both vocabularies.',
      ],
      keyIdea: 'An adapter implements the interface you want and delegates to the object you have.',
      metrics: { callers: '0', classes: '1', pattern: 'Adapter' },
      metricTones: { callers: 'good' },
      scene: {
        nodes: [checkout, gateway, { ...adapter, status: 'active' }, legacy],
        links: [
          link('checkout', 'gateway', { label: 'uses' }),
          link('adapter', 'gateway', { label: 'implements' }),
          link('adapter', 'legacy', { label: 'has-a' }),
        ],
        flows: [
          { path: ['checkout', 'gateway', 'adapter'], tone: 'request', label: 'charge(1999, tok)', duration: 1.8 },
          { path: ['adapter', 'legacy'], tone: 'request', label: 'do_payment(19.99, tok)', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Adapter in 7 lines',
          icon: 'Code',
          code: 'class StripeAdapter(PaymentGateway):\n    def __init__(self, legacy):\n        self.legacy = legacy\n    def charge(self, cents, token):\n        r = self.legacy.do_payment(\n            cents / 100, token)\n        return r["id"]',
        },
        caption: 'Checkout never sees the library',
      },
      code: {
        language: 'python',
        title: 'Adapter: translate and forward',
        source: `from abc import ABC, abstractmethod

class PaymentGateway(ABC):                      # what your app expects
    @abstractmethod
    def charge(self, cents: int, token: str) -> str: ...

class LegacyStripe:                             # third party, cannot edit
    def do_payment(self, amount_dollars, card_token, currency="usd"):
        return {"id": f"ch_{card_token}", "amount": amount_dollars}

class StripeAdapter(PaymentGateway):
    def __init__(self, legacy: LegacyStripe):
        self.legacy = legacy
    def charge(self, cents, token):
        dollars = cents / 100                   # unit translation
        result = self.legacy.do_payment(dollars, token)
        return result["id"]

gateway: PaymentGateway = StripeAdapter(LegacyStripe())
print(gateway.charge(1999, "tok_abc"))          # ch_tok_abc`,
        highlight: [11, 12, 15, 16, 19],
      },
    },
    // 3
    {
      title: 'Adapter use',
      tag: 'tradeoff',
      heading: 'When an adapter earns its place',
      eli5: 'You only carry the travel adapter when the socket is foreign. If you built the toy yourself, you would just fit the right plug on it.',
      body: [
        'Use it for a third-party library, or to move callers from an old API to a new one without rewriting them. Swapping vendors becomes one new adapter class.',
        '**When not to:** if you own both sides, change the interface directly. An adapter over your own code is a layer with no job. Python logging handlers and Django database backends are adapters in the wild.',
      ],
      keyIdea: 'Adapt what you cannot change. Fix what you own.',
      metrics: { callers: '0', classes: '1 per vendor', pattern: 'Adapter' },
      scene: {
        nodes: [
          blk('app', A, 'Checkout', 'depends on interface', 'green', 'ShoppingBag'),
          blk('port', B, 'PaymentGateway', 'interface', 'violet', 'Plug'),
          blk('ad1', D, 'StripeAdapter', 'vendor 1', 'green', 'Cable', { status: 'ok' }),
          blk('ad2', F, 'AcmePayAdapter', 'vendor 2, new', 'green', 'Cable', { status: 'active' }),
        ],
        links: [link('app', 'port', { label: 'uses' }), link('ad1', 'port', { label: 'implements' }), link('ad2', 'port', { label: 'implements' })],
        flows: [{ path: ['app', 'port', 'ad2'], tone: 'request', label: 'charge()', duration: 1.8 }],
        panel: {
          title: 'Use it, or skip it',
          icon: 'Scale',
          rows: [
            { text: 'Third-party library', value: 'adapt', tone: 'good' },
            { text: 'Old API to new API', value: 'adapt', tone: 'good' },
            { text: 'You own both sides', value: 'edit directly', tone: 'warn' },
          ],
        },
        caption: 'A new vendor is one new class',
      },
    },
    // 4
    {
      title: 'Decorator',
      tag: 'concept',
      heading: 'Decorator: add behavior without touching the original',
      eli5: 'A **decorator** is gift wrap. The toy inside stays the same, but you can add a ribbon layer, then a paper layer, and it still looks like a gift you can hand over.',
      body: [
        'You want logging, caching or auth around existing calls without editing every caller or every implementation. A decorator implements the same interface as the thing it wraps, holds one, and adds work before or after forwarding.',
        'Because the wrapper has the same type, wrappers stack to any depth.',
      ],
      keyIdea: 'A decorator is-a and has-a the same interface: it wraps one and looks like one.',
      metrics: { callers: '0', classes: '2', pattern: 'Decorator' },
      scene: {
        nodes: [
          blk('client', A, 'Client', 'asks cost()', 'green', 'User'),
          blk('drink', B, 'Drink', 'interface', 'violet', 'Plug'),
          blk('coffee', D, 'Coffee', 'concrete, $5', 'green', 'Package'),
          blk('milk', F, 'MilkDecorator', 'wraps a Drink, +$1', 'green', 'Layers', { status: 'active' }),
        ],
        links: [
          link('client', 'drink', { label: 'uses' }),
          link('coffee', 'drink', { label: 'implements' }),
          link('milk', 'drink', { label: 'implements' }),
          link('milk', 'coffee', { label: 'has-a', style: 'dashed' }),
        ],
        flows: [
          { path: ['client', 'drink', 'milk'], tone: 'request', label: 'cost()', duration: 1.6 },
          { path: ['milk', 'coffee'], tone: 'request', label: 'cost()', duration: 1.2, delay: 1.7 },
          { path: ['coffee', 'milk'], tone: 'response', label: '5', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'One wrapper',
          icon: 'Code',
          code: 'class MilkDecorator:\n    def __init__(self, wrapped):\n        self.wrapped = wrapped\n    def cost(self):\n        return self.wrapped.cost() + 1\n    def desc(self):\n        return self.wrapped.desc() + " + milk"',
        },
        caption: 'Same interface in, same interface out',
      },
    },
    // 5
    {
      title: 'Stacking',
      tag: 'case',
      heading: 'Stack decorators and the call travels inward',
      eli5: 'You unwrap the gift from the outside in: ribbon, then paper, then the toy. Each layer adds its own small price to the total.',
      body: [
        '`SugarDecorator(MilkDecorator(Coffee()))` is a three-layer onion. `cost()` enters the outermost layer, each layer calls inward, and the totals add on the way back: 5 + 1 + 0.5 = **$6.50**.',
        'Adding a new topping is one new class. Nothing existing changes, and the combinations are built at runtime.',
      ],
      keyIdea: 'Decorators compose at runtime, so N add-ons are N classes, not 2 to the Nth subclasses.',
      metrics: { callers: '0', classes: '3', pattern: 'Decorator' },
      scene: {
        nodes: [
          blk('sugar', A, 'Sugar', 'outer, +$0.50', 'green', 'Layers'),
          blk('milk', B, 'Milk', 'middle, +$1', 'green', 'Layers'),
          blk('coffee', C, 'Coffee', 'core, $5', 'green', 'Package', { badge: '$6.50 total', status: 'ok' }),
        ],
        links: [link('sugar', 'milk', { label: 'wraps' }), link('milk', 'coffee', { label: 'wraps' })],
        flows: [
          { path: ['sugar', 'milk', 'coffee'], tone: 'request', label: 'cost()', duration: 2 },
          { path: ['coffee', 'milk', 'sugar'], tone: 'response', label: '5, 6, 6.5', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Build the onion',
          icon: 'Code',
          code: 'drink = SugarDecorator(\n    MilkDecorator(Coffee()))\nprint(drink.desc(), drink.cost())\n# coffee + milk + sugar  6.5',
        },
        caption: 'cost() goes in, the sum comes out',
      },
      code: {
        language: 'python',
        title: 'Object-oriented decorators',
        source: `class Coffee:
    def cost(self): return 5
    def desc(self): return "coffee"

class MilkDecorator:
    def __init__(self, wrapped): self.wrapped = wrapped
    def cost(self): return self.wrapped.cost() + 1
    def desc(self): return self.wrapped.desc() + " + milk"

class SugarDecorator:
    def __init__(self, wrapped): self.wrapped = wrapped
    def cost(self): return self.wrapped.cost() + 0.5
    def desc(self): return self.wrapped.desc() + " + sugar"

drink = SugarDecorator(MilkDecorator(Coffee()))
print(drink.desc(), "$", drink.cost())   # coffee + milk + sugar $ 6.5`,
        highlight: [7, 13, 16],
      },
    },
    // 6
    {
      title: 'Function wrappers',
      tag: 'concept',
      heading: 'In Python, a decorator can be a function',
      eli5: 'Instead of wrapping the whole toy, you wrap just one trick it does. A stopwatch is clipped on to the trick, and the trick itself stays the same.',
      body: [
        'A function that takes a function and returns a wrapped one is a **decorator** too. `@timed` and `@cached` add timing and memoizing to `slow_square` without touching its body.',
        'Order matters. `@timed` over `@cached` times the cache lookup as well. Swap them and the timer sits inside the cache, so cache hits go unmeasured.',
      ],
      keyIdea: 'Same pattern, smaller scale: wrap a callable, return a callable, stack as needed.',
      metrics: { callers: '0', classes: '0', pattern: 'Decorator' },
      scene: {
        nodes: [
          blk('call', A, 'Caller', 'slow_square(4)', 'green', 'User'),
          blk('timed', B, '@timed', 'outer wrapper', 'blue', 'Timer'),
          blk('cached', C, '@cached', 'inner wrapper', 'blue', 'Copy'),
          blk('fib', F, 'slow_square', 'real function, sleeps 0.5 s', 'green', 'Code', { status: 'active' }),
        ],
        links: [link('call', 'timed'), link('timed', 'cached', { label: 'wraps' }), link('cached', 'fib', { label: 'wraps' })],
        flows: [
          { path: ['call', 'timed', 'cached', 'fib'], tone: 'request', label: 'slow_square(4)', duration: 2.2 },
          { path: ['fib', 'cached', 'timed', 'call'], tone: 'response', label: '16', duration: 2.2, delay: 2.3 },
        ],
        panel: {
          title: 'Second call',
          icon: 'Gauge',
          rows: [
            { text: 'First call', value: '0.5 s, then logged', tone: 'warn' },
            { text: 'Second call', value: 'cache hit, near 0 s', tone: 'good' },
          ],
          footer: { text: 'slow_square itself was never edited', tone: 'good' },
        },
        caption: 'Wrappers around one function',
      },
      code: {
        language: 'python',
        title: 'Function decorators',
        source: `import time
from functools import wraps

def timed(fn):
    @wraps(fn)
    def inner(*args, **kwargs):
        start = time.time()
        result = fn(*args, **kwargs)
        print(f"{fn.__name__} took {time.time() - start:.3f}s")
        return result
    return inner

def cached(fn):
    store = {}
    @wraps(fn)
    def inner(*args):
        if args not in store:
            store[args] = fn(*args)
        return store[args]
    return inner

@timed
@cached
def slow_square(n):
    time.sleep(0.5)                  # pretend this is expensive
    return n * n

slow_square(4)   # about 0.5s, logged
slow_square(4)   # cache hit, near 0s`,
        highlight: [6, 8, 9, 16, 17, 18, 22, 23],
      },
    },
    // 7
    {
      title: 'Decorator use',
      tag: 'tradeoff',
      heading: 'Decorate cross-cutting concerns, not core behavior',
      eli5: 'Ribbons are for extras you can add or take off. If the toy cannot work without its wheels, you build the wheels in.',
      body: [
        'Good fits: logging, caching, auth, retries, anything that cuts across many classes. The set of features can differ per object and be composed at runtime. `BufferedReader(FileReader)` in Java and web middleware stacks are the same idea.',
        '**When not to:** behavior that is always on and fundamental. Bake it into the class. A long stack of wrappers is also hard to debug, because the stack trace shows every layer.',
      ],
      keyIdea: 'A decorator should be removable without breaking the object. If it is not, it belongs inside.',
      metrics: { callers: '0', classes: '1 per concern', pattern: 'Decorator' },
      scene: {
        nodes: [
          blk('c', A, 'Caller', 'same call', 'green', 'User'),
          blk('log', B, 'Logging', 'cross-cutting', 'blue', 'FileText'),
          blk('auth', C, 'Auth', 'cross-cutting', 'blue', 'Shield'),
          blk('svc', F, 'Service', 'core logic', 'green', 'Server', { status: 'ok' }),
        ],
        links: [link('c', 'log'), link('log', 'auth', { label: 'wraps' }), link('auth', 'svc', { label: 'wraps' })],
        flows: [{ path: ['c', 'log', 'auth', 'svc'], tone: 'request', label: 'handle()', duration: 2.2 }],
        panel: {
          title: 'Wrap it or build it in',
          icon: 'Scale',
          rows: [
            { text: 'Logging, caching, auth, retry', value: 'wrap', tone: 'good' },
            { text: 'Optional per object', value: 'wrap', tone: 'good' },
            { text: 'Always on, fundamental', value: 'build in', tone: 'warn' },
          ],
        },
        caption: 'Each concern is one layer',
      },
      quiz: {
        question: 'What makes a decorator stackable?',
        options: [
          'It subclasses the class it wraps',
          'It has the same interface as the object it wraps, so a wrapper can wrap another wrapper',
          'It copies the wrapped object first',
          'It must be written as a Python @ function',
        ],
        answer: 1,
        explain: 'The wrapper is the same type as the thing inside, so callers cannot tell the difference and wrappers nest. Function decorators are the same idea applied to callables.',
      },
    },
    // 8
    {
      title: 'Facade pain',
      tag: 'problem',
      heading: 'Placing one order means calling five systems in the right order',
      eli5: 'To buy one toy, a customer would have to visit the stock room, the cash room, the packing room and the mail room, in that order. They will skip one.',
      body: [
        'Checkout must reserve stock, charge the card, schedule shipping and send an email. If payment fails, the stock must be released.',
        'Every caller that repeats this sequence can get it wrong. One forgets the release, another sends the email before the charge.',
      ],
      keyIdea: 'When every caller must orchestrate the same subsystems, someone will orchestrate them wrongly.',
      metrics: { callers: '4 know the steps', classes: '0', pattern: 'none' },
      metricTones: { callers: 'bad' },
      scene: {
        nodes: [
          blk('caller', B, 'Caller', 'must know 4 steps', 'green', 'User', { status: 'hot' }),
          blk('inv', D, 'Inventory', 'reserve, release', 'gray', 'Package'),
          blk('pay', E, 'Payment', 'charge', 'gray', 'Receipt'),
          blk('ship', F, 'Shipping + mail', 'schedule, email', 'gray', 'Route'),
        ],
        links: [link('caller', 'inv'), link('caller', 'pay'), link('caller', 'ship')],
        flows: [
          { path: ['caller', 'inv'], tone: 'request', label: 'reserve()', duration: 1.2 },
          { path: ['caller', 'pay'], tone: 'request', label: 'charge()', duration: 1.2, delay: 1.3 },
          { path: ['caller', 'ship'], tone: 'request', label: 'schedule() + email()', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Bugs waiting to happen',
          icon: 'Bug',
          rows: [
            { text: 'Forgot to release stock', value: 'ghost reservations', tone: 'bad' },
            { text: 'Email before charge', value: 'false confirmation', tone: 'bad' },
            { text: 'Order of steps', value: 'copied 4 times', tone: 'warn' },
          ],
        },
        caption: 'The same recipe, repeated everywhere',
      },
    },
    // 9
    {
      title: 'Facade',
      tag: 'concept',
      heading: 'Facade: one door into a complicated house',
      eli5: 'A **facade** is the shop counter. You say "one toy, please" and the shopkeeper walks to every back room for you.',
      body: [
        '`OrderFacade.place_order(user, sku, qty, price)` owns the recipe: reserve, charge, ship, notify, and release stock if the charge fails.',
        'Callers make one call. The subsystems do not know the facade exists, and the order of steps lives in exactly one place.',
      ],
      keyIdea: 'A facade is a simple front for a complex subsystem. It adds no new capability, only one safer path and the ordering.',
      metrics: { callers: '1 call', classes: '1', pattern: 'Facade' },
      metricTones: { callers: 'good' },
      scene: {
        nodes: [
          blk('caller', A, 'Caller', 'one call', 'green', 'User'),
          blk('facade', B, 'OrderFacade', 'place_order()', 'green', 'Boxes', { status: 'active' }),
          blk('inv', D, 'Inventory', 'subsystem', 'gray', 'Package'),
          blk('pay', E, 'Payment', 'subsystem', 'gray', 'Receipt'),
          blk('ship', F, 'Shipping + mail', 'subsystem', 'gray', 'Route'),
        ],
        links: [link('caller', 'facade', { label: 'uses' }), link('facade', 'inv', { label: 'has-a' }), link('facade', 'pay', { label: 'has-a' }), link('facade', 'ship', { label: 'has-a' })],
        flows: [
          { path: ['caller', 'facade'], tone: 'request', label: 'place_order()', duration: 1.2 },
          { path: ['facade', 'inv'], tone: 'request', label: 'reserve()', duration: 1.2, delay: 1.3 },
          { path: ['facade', 'pay'], tone: 'request', label: 'charge()', duration: 1.2, delay: 2.6 },
          { path: ['facade', 'ship'], tone: 'request', label: 'schedule() + email()', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'The recipe lives here',
          icon: 'Code',
          code: 'def place_order(self, user, sku, qty, price):\n    self.inv.reserve(sku, qty)\n    try:\n        self.pay.charge(user, price * qty)\n    except Exception:\n        self.inv.release(sku, qty)\n        raise\n    self.ship.schedule(sku, qty, user)',
        },
        caption: 'One method, four steps, one rollback',
      },
      code: {
        language: 'python',
        title: 'OrderFacade',
        source: `class OrderFacade:
    """One call that hides the orchestration."""
    def __init__(self):
        self.inv  = InventorySystem()
        self.pay  = PaymentSystem()
        self.ship = ShippingSystem()
        self.mail = NotificationSystem()

    def place_order(self, user, sku, qty, price):
        self.inv.reserve(sku, qty)
        try:
            self.pay.charge(user, price * qty)
        except Exception:
            self.inv.release(sku, qty)       # undo the reservation
            raise
        self.ship.schedule(sku, qty, user)
        self.mail.email(user, f"Your order for {qty}x {sku} is confirmed")

OrderFacade().place_order("sanheen@x.com", "SKU-42", 2, 9.99)`,
        highlight: [9, 10, 11, 12, 13, 14, 15, 16],
      },
    },
    // 10
    {
      title: 'Facade limits',
      tag: 'tradeoff',
      heading: 'A facade hides control, so keep the back door open',
      eli5: 'The counter is great for most shoppers. A collector who wants to inspect every shelf should still be allowed into the back room.',
      body: [
        'Use a facade when most callers need only the happy path across a complex subsystem. `requests.get()` hides sockets, TLS, pooling and redirects the same way.',
        '**When not to:** callers that need fine control, since the facade hides exactly that. The facade should also own the failure paths, for example a refund if shipping fails after a successful charge. Keep the subsystems public so they can bypass it. A facade that grows every method in the system becomes a god object.',
      ],
      keyIdea: 'A facade simplifies the common path. It must not be the only path.',
      metrics: { callers: '1 call', classes: '1', pattern: 'Facade' },
      scene: {
        nodes: [
          blk('normal', A, 'Most callers', 'happy path', 'green', 'Users'),
          blk('facade', B, 'OrderFacade', 'simple front', 'green', 'Boxes'),
          blk('power', D, 'Power caller', 'needs control', 'green', 'Key', { status: 'active' }),
          blk('pay', F, 'Payment', 'direct access', 'gray', 'Receipt'),
        ],
        links: [link('normal', 'facade', { label: 'uses' }), link('facade', 'pay', { label: 'has-a' }), link('power', 'pay', { label: 'uses', style: 'dashed' })],
        flows: [
          { path: ['normal', 'facade', 'pay'], tone: 'request', label: 'place_order()', duration: 2 },
          { path: ['power', 'pay'], tone: 'request', label: 'refund(partial)', duration: 1.4, delay: 2.1 },
        ],
        panel: {
          title: 'Facade or not',
          icon: 'Scale',
          rows: [
            { text: 'Most callers want the happy path', value: 'facade', tone: 'good' },
            { text: 'Some need fine-grained control', value: 'keep direct access', tone: 'warn' },
            { text: 'Facade keeps growing methods', value: 'split it', tone: 'bad' },
          ],
        },
        caption: 'Counter for most, back door for few',
      },
    },
    // 11
    {
      title: 'Proxy',
      tag: 'concept',
      heading: 'Proxy: stand in for something else, with the same interface',
      eli5: 'The shop window shows a photo of a big toy. The real one stays in the stock room until a child actually asks to play with it.',
      body: [
        'Reaching the real object is expensive, dangerous or remote. A **proxy** implements the same interface, holds (or will create) the real object, and decides when and whether to forward.',
        'Here `ImageProxy` loads nothing at construction. The first `display()` creates the `RealImage` and reads the disk. In a gallery of 100 images, only the ones viewed ever load.',
      ],
      keyIdea: 'A proxy controls access to an object while looking exactly like it.',
      metrics: { callers: '0', classes: '1', pattern: 'Proxy' },
      scene: {
        nodes: [
          blk('client', A, 'Gallery', '100 images', 'green', 'Layers'),
          blk('loader', B, 'ImageLoader', 'interface', 'violet', 'Plug'),
          blk('proxy', D, 'ImageProxy', 'path only, lazy', 'green', 'Copy', { status: 'active' }),
          blk('real', F, 'RealImage', '2.5 MB from disk', 'green', 'HardDrive'),
        ],
        links: [link('client', 'loader', { label: 'uses' }), link('proxy', 'loader', { label: 'implements' }), link('real', 'loader', { label: 'implements' }), link('proxy', 'real', { label: 'creates on first use', style: 'dashed' })],
        flows: [
          { path: ['client', 'loader', 'proxy'], tone: 'request', label: 'display()', duration: 1.6 },
          { path: ['proxy', 'real'], tone: 'request', label: 'load once', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Lazy loading',
          icon: 'Code',
          code: 'class ImageProxy(ImageLoader):\n    def __init__(self, path):\n        self.path = path\n        self._real = None\n    def display(self):\n        if self._real is None:\n            self._real = RealImage(self.path)\n        self._real.display()',
        },
        caption: 'Only viewed images touch the disk',
      },
      code: {
        language: 'python',
        title: 'Virtual proxy',
        source: `class ImageLoader(ABC):
    @abstractmethod
    def display(self): ...

class RealImage(ImageLoader):
    def __init__(self, path):
        self.path = path
        self._load()                  # expensive: reads from disk
    def _load(self):
        print(f"loading {self.path} from disk...")
    def display(self):
        print(f"displaying {self.path}")

class ImageProxy(ImageLoader):
    def __init__(self, path):
        self.path = path
        self._real = None             # lazy: not loaded yet
    def display(self):
        if self._real is None:        # load only on first use
            self._real = RealImage(self.path)
        self._real.display()

gallery = [ImageProxy(f"img_{i}.png") for i in range(100)]
gallery[3].display()                  # only this one hits the disk`,
        highlight: [14, 17, 19, 20, 21, 24],
      },
    },
    // 12
    {
      title: 'Proxy flavors',
      tag: 'case',
      heading: 'Four kinds of proxy, one shape',
      eli5: 'The same stand-in can be a photo in the window, a guard who checks your ticket, a phone to the far warehouse, or a clerk who remembers last answers.',
      body: [
        'The structure never changes: same interface, forward to a real subject. The **purpose** decides the flavor. SQLAlchemy lazy relationships, `kube-proxy` and every RPC client stub are real examples.',
        '**When not to:** when the overhead of the proxy outweighs the resource it guards. Wrapping a cheap in-memory object in a proxy only adds indirection.',
      ],
      keyIdea: 'Virtual, protection, remote and caching proxies share one structure and differ only in why they intercept.',
      metrics: { callers: '0', classes: '1 per purpose', pattern: 'Proxy' },
      scene: {
        nodes: [
          blk('client', A, 'Client', 'same call', 'green', 'User'),
          blk('proxy', B, 'Proxy', 'same interface', 'green', 'Shield', { status: 'active' }),
          blk('subject', F, 'Real subject', 'costly or remote', 'gray', 'Server'),
        ],
        links: [link('client', 'proxy', { label: 'uses' }), link('proxy', 'subject', { label: 'has-a' })],
        flows: [
          { path: ['client', 'proxy'], tone: 'request', label: 'call()', duration: 1.2 },
          { path: ['proxy', 'subject'], tone: 'request', label: 'maybe forward', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Flavors',
          icon: 'List',
          rows: [
            { text: 'Virtual', value: 'lazy load expensive objects' },
            { text: 'Protection', value: 'check permissions, then forward' },
            { text: 'Remote', value: 'local stub calls across a network' },
            { text: 'Caching', value: 'memoize expensive calls' },
          ],
        },
        caption: 'One shape, four reasons',
      },
      code: {
        language: 'python',
        title: 'Protection and caching proxies',
        source: `class ProtectionProxy:
    def __init__(self, subject, user):
        self.subject, self.user = subject, user

    def read(self, doc_id):
        if self.user.role != "admin":
            raise PermissionError("denied")   # stopped at the proxy
        return self.subject.read(doc_id)      # allowed, forwarded

class CachingProxy:
    def __init__(self, subject):
        self.subject, self.store = subject, {}

    def read(self, doc_id):
        if doc_id not in self.store:          # miss: forward once
            self.store[doc_id] = self.subject.read(doc_id)
        return self.store[doc_id]`,
        highlight: [6, 7, 8, 15, 16, 17],
      },
    },
    // 13
    {
      title: 'Look-alikes',
      tag: 'recap',
      heading: 'Four patterns that look alike, told apart by intent',
      eli5: 'A translator plug, gift wrap, a shop counter and a window photo all sit between you and a toy. They differ in why they are there.',
      body: [
        'Adapter, Decorator and Proxy all wrap one object. Adapter **changes** the interface. Decorator **keeps** it and adds behavior. Proxy keeps it and **controls access**. Facade wraps many objects behind a **new, simpler** interface.',
        'Ask what the wrapper is for before naming it.',
      ],
      keyIdea: 'Same wrapping shape, different intent: translate, add, guard or simplify.',
      metrics: { callers: 'unchanged', classes: '1 each', pattern: 'all four' },
      metricTones: { callers: 'good' },
      scene: {
        nodes: [
          blk('ad', A, 'Adapter', 'translate', 'green', 'Cable', { status: 'ok' }),
          blk('de', B, 'Decorator', 'add behavior', 'green', 'Layers', { status: 'ok' }),
          blk('fa', D, 'Facade', 'simplify many', 'green', 'Boxes', { status: 'ok' }),
          blk('pr', F, 'Proxy', 'guard access', 'green', 'Shield', { status: 'ok' }),
        ],
        links: [],
        panel: {
          title: 'What each does to the interface',
          icon: 'Table',
          rows: [
            { text: 'Adapter', value: 'changes it' },
            { text: 'Decorator', value: 'same, adds behavior' },
            { text: 'Proxy', value: 'same, controls access' },
            { text: 'Facade', value: 'new, simpler, many objects' },
          ],
        },
        caption: 'Intent names the pattern',
      },
      quiz: {
        question: 'A wrapper has the same interface as the object it wraps and only forwards calls after checking the caller has permission. Which pattern is it?',
        options: ['Adapter', 'Decorator', 'Protection proxy', 'Facade'],
        answer: 2,
        explain: 'It keeps the interface and controls access, which is a protection proxy. A decorator would add behavior to the result, an adapter would change the interface, and a facade would front several objects.',
      },
    },
  ],
};
