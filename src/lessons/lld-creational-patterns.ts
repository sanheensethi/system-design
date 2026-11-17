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

// Tints: violet = interface, blue = abstract, green = concrete, gray = external, amber = shared or special

export const lldCreationalPatterns: Lesson = {
  id: 'lld-creational-patterns',
  title: 'Creational patterns',
  tagline: 'How objects come into being: singleton, factory, abstract factory, builder, prototype, flyweight, pool and dependency injection.',
  minutes: 22,
  level: 'Intermediate',
  learn: [
    'Why scattered `new` calls make code rigid, and what a creational pattern moves',
    'Singleton: one instance, and why it is easy to misuse',
    'Factory method and abstract factory: choosing the concrete class in one place',
    'Builder: step by step construction, validation and immutable results',
    'Prototype, flyweight and object pool: cloning, sharing and reusing instead of creating',
    'Dependency injection, containers, and service locator as the modern replacement for most singletons',
  ],
  metrics: [
    { key: 'edits', label: 'Files per new type', icon: 'FileCode' },
    { key: 'creators', label: 'Places that call new', icon: 'Boxes' },
    { key: 'tests', label: 'Test setup', icon: 'Bug' },
    { key: 'pattern', label: 'Pattern', icon: 'Layers' },
  ],
  steps: [
    // 1
    {
      title: 'Scattered new',
      tag: 'problem',
      heading: 'Every caller picks its own concrete class',
      eli5: 'Every kid in the toy shop walks into the back room and builds their own toy from raw parts. When the recipe changes, you have to tell every single kid.',
      body: [
        'A checkout service calls `StripeGateway("sk_live_...")` directly. So does the refund service and the reporting job. Each one knows the class name and the constructor arguments.',
        'Now the team adds a second payment provider. Every `new` call site needs an edit, and every test drags a real gateway in.',
      ],
      keyIdea: 'When callers create their own dependencies, every caller is welded to one concrete class.',
      metrics: { edits: '3 and counting', creators: '3', tests: 'real gateway', pattern: '-' },
      metricTones: { edits: 'bad', creators: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          blk('checkout', A, 'Checkout', 'calls new', 'green', 'ShoppingBag', { status: 'hot' }),
          blk('refund', D, 'Refund', 'calls new', 'green', 'Receipt', { status: 'hot' }),
          blk('stripe', F, 'StripeGateway', 'concrete', 'gray', 'Plug'),
        ],
        links: [link('checkout', 'stripe', { label: 'creates', labelTone: 'warn' }), link('refund', 'stripe', { label: 'creates', labelTone: 'warn' })],
        flows: [
          { path: ['checkout', 'stripe'], tone: 'request', label: 'StripeGateway(key)', duration: 1.4 },
          { path: ['refund', 'stripe'], tone: 'request', label: 'StripeGateway(key)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Same line, three files',
          icon: 'FileCode',
          code: '# checkout.py\ngw = StripeGateway(KEY)\n# refund.py\ngw = StripeGateway(KEY)\n# report.py\ngw = StripeGateway(KEY)',
          footer: { text: 'Adding PayPal means editing all three', tone: 'bad' },
        },
        caption: 'Creation knowledge is copied everywhere',
      },
    },
    // 2
    {
      title: 'The family',
      tag: 'concept',
      heading: 'Creational patterns move the decision about creation',
      eli5: 'Instead of every kid building toys, the shop gets a **workshop** counter. Kids ask for a toy and the workshop decides how it is made.',
      body: [
        'A **creational pattern** controls how, when and by whom an object is made, so callers depend on an interface and not on a constructor.',
        'This lesson covers eight: singleton, factory method, abstract factory, builder, prototype, flyweight, object pool and dependency injection. Each starts from a pain, then shows the fix.',
      ],
      keyIdea: 'Creational patterns answer one question: who creates the object, and how much does the caller need to know?',
      metrics: { edits: '-', creators: '-', tests: '-', pattern: 'creational' },
      scene: {
        nodes: [
          blk('client', A, 'Client', 'wants an object', 'green', 'User'),
          blk('creator', B, 'Creation code', 'one place', 'blue', 'Package'),
          blk('product', C, 'Product', 'interface', 'violet', 'Plug'),
        ],
        links: [link('client', 'creator', { label: 'asks' }), link('creator', 'product', { label: 'creates' })],
        flows: [
          { path: ['client', 'creator'], tone: 'request', label: 'give me one', duration: 1.3 },
          { path: ['creator', 'client'], tone: 'response', label: 'product', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Eight patterns, one question',
          icon: 'List',
          rows: [
            { text: 'Singleton', value: 'exactly one' },
            { text: 'Factory, Abstract factory', value: 'which class' },
            { text: 'Builder', value: 'many options' },
            { text: 'Prototype', value: 'copy an existing one' },
            { text: 'Flyweight, Pool', value: 'reuse, do not rebuild' },
            { text: 'Dependency injection', value: 'someone else creates' },
          ],
        },
        caption: 'Creation moves out of the caller',
      },
    },
    // 3
    {
      title: 'Singleton pain',
      tag: 'problem',
      heading: 'Two config objects that disagree',
      eli5: 'The shop has one price board. If two kids each draw their own board, one says 5 dollars and the other says 7, and nobody knows which is right.',
      body: [
        'One part of the app loads `Config` and sets `db_url`. Another part creates its own `Config()` and sees an empty one. Both look correct alone, and together they disagree.',
        'Some things are shared by nature: app config, a logger, a connection pool. Two copies of them cause bugs.',
      ],
      keyIdea: 'Some resources must exist exactly once, and the class itself should guarantee it.',
      metrics: { edits: '-', creators: '2', tests: '-', pattern: 'singleton' },
      metricTones: { creators: 'bad' },
      scene: {
        nodes: [
          blk('a', A, 'Loader', 'sets db_url', 'green', 'Cable'),
          blk('cfg1', B, 'Config #1', 'db_url set', 'amber', 'FileJson'),
          blk('cfg2', E, 'Config #2', 'db_url empty', 'amber', 'FileJson', { status: 'hot' }),
          blk('b', C, 'Worker', 'reads db_url', 'green', 'Cpu', { status: 'hot' }),
        ],
        links: [link('a', 'cfg1', { label: 'creates' }), link('b', 'cfg2', { label: 'creates', labelTone: 'warn' })],
        flows: [
          { path: ['a', 'cfg1'], tone: 'request', label: 'set(db_url)', duration: 1.3 },
          { path: ['b', 'cfg2'], tone: 'error', label: 'get(db_url) = None', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Two instances',
          icon: 'Bug',
          rows: [
            { text: 'Config #1 db_url', value: 'postgres://...', tone: 'good' },
            { text: 'Config #2 db_url', value: 'None', tone: 'bad' },
            { text: 'a is b', value: 'False', tone: 'bad' },
          ],
        },
        caption: 'Callers cannot see each other changes',
      },
    },
    // 4
    {
      title: 'Singleton',
      tag: 'concept',
      heading: 'Singleton: the class hands out its one instance',
      eli5: 'The shop has one **price board** bolted to the wall. Every kid who asks for the board gets pointed at that same board.',
      body: [
        'A **singleton** keeps its single instance in a class attribute and returns it every time. Here `__new__` creates the object on the first call and reuses it after that.',
        'Callers still write `ConfigSingleton()`, and `a is b` is always true.',
      ],
      keyIdea: 'A singleton makes the class own the rule that only one instance exists.',
      metrics: { edits: '-', creators: '1', tests: '-', pattern: 'singleton' },
      metricTones: { creators: 'good' },
      scene: {
        nodes: [
          blk('a', A, 'Loader', 'caller', 'green', 'Cable'),
          blk('cfg', B, 'Config', 'singleton', 'amber', 'FileJson', { status: 'ok', chips: ['_instance'] }),
          blk('b', C, 'Worker', 'caller', 'green', 'Cpu'),
        ],
        links: [link('a', 'cfg', { label: 'uses' }), link('b', 'cfg', { label: 'uses' })],
        flows: [
          { path: ['a', 'cfg'], tone: 'request', label: 'Config()', duration: 1.2 },
          { path: ['b', 'cfg'], tone: 'request', label: 'Config()', duration: 1.2, delay: 1.3 },
          { path: ['cfg', 'b'], tone: 'response', label: 'same object', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Lazy singleton',
          icon: 'Code',
          code: 'def __new__(cls):\n    if cls._instance is None:\n        cls._instance = super().__new__(cls)\n        cls._instance._data = {}\n    return cls._instance',
          footer: { text: 'a is b is True', tone: 'good' },
        },
        caption: 'One instance, handed to everyone',
      },
      code: {
        language: 'python',
        title: 'Singleton with __new__',
        source: `class ConfigSingleton:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._data = {}
        return cls._instance

    def set(self, k, v):
        self._data[k] = v

    def get(self, k):
        return self._data.get(k)


a = ConfigSingleton()
b = ConfigSingleton()
a.set("db_url", "postgres://...")
assert b.get("db_url") == "postgres://..."
assert a is b`,
        highlight: [2, 4, 5, 6, 8],
      },
    },
    // 5
    {
      title: 'Singleton traps',
      tag: 'tradeoff',
      heading: 'Singleton is a global variable with a nicer name',
      eli5: 'The one price board is handy, but now every kid secretly depends on it. If you want to practice with a pretend board, you cannot, because the real one is bolted on.',
      body: [
        'Tests share the instance, so state leaks from one test into the next. The dependency is hidden, because a class that calls `Config()` inside a method does not show it in its signature.',
        'Threads can race on first creation. Use a lock, or create the instance eagerly at import time. In Python a module-level `config = Config()` in `config.py` is the usual idiom, with no `__new__`.',
      ],
      keyIdea: 'Singletons hide dependencies and leak state between tests. More than two or three in an app means you rebuilt global variables.',
      metrics: { edits: '-', creators: '1', tests: 'shared state', pattern: 'singleton' },
      metricTones: { tests: 'warn' },
      scene: {
        nodes: [
          blk('t1', A, 'Test 1', 'sets debug=True', 'green', 'Bug'),
          blk('cfg', B, 'Config', 'singleton', 'amber', 'FileJson', { status: 'hot' }),
          blk('t2', C, 'Test 2', 'expects debug=False', 'green', 'Bug', { status: 'down' }),
        ],
        links: [link('t1', 'cfg', { label: 'writes' }), link('cfg', 't2', { label: 'leaks', labelTone: 'warn' })],
        flows: [
          { path: ['t1', 'cfg'], tone: 'request', label: 'set(debug, True)', duration: 1.3 },
          { path: ['cfg', 't2'], tone: 'error', label: 'debug = True', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Thread-safe first creation',
          icon: 'Code',
          code: '_lock = threading.Lock()\n\ndef __new__(cls):\n    with cls._lock:\n        if cls._instance is None:\n            cls._instance = super().__new__(cls)\n    return cls._instance',
          footer: { text: 'Prefer dependency injection (later)', tone: 'muted' },
        },
        caption: 'Shared state crosses test boundaries',
      },
    },
    // 6
    {
      title: 'Factory pain',
      tag: 'problem',
      heading: 'An if chain that every caller copies',
      eli5: 'A kid says "I want a car, a doll or a robot", and every helper in the shop has their own long list of which box to open. Add a new toy and every list needs a new line.',
      body: [
        'Notifications can go by email, SMS or push. The code that picks the class looks at a string and chains `if channel == "email"` branches.',
        'That chain is pasted into the signup flow, the billing flow and the alert job. A fourth channel means editing all of them.',
      ],
      keyIdea: 'When the type of object depends on runtime input, the choosing logic should live in one place.',
      metrics: { edits: '3 per new channel', creators: '3', tests: 'real senders', pattern: '-' },
      metricTones: { edits: 'bad', creators: 'bad' },
      scene: {
        nodes: [
          blk('signup', A, 'Signup', 'if channel == ...', 'green', 'User', { status: 'hot' }),
          blk('billing', D, 'Billing', 'if channel == ...', 'green', 'Receipt', { status: 'hot' }),
          blk('email', C, 'Email', 'concrete', 'green', 'Mail'),
          blk('sms', F, 'SMS', 'concrete', 'green', 'Smartphone'),
        ],
        links: [
          link('signup', 'email', { label: 'creates', labelTone: 'warn' }),
          link('signup', 'sms', { label: 'creates', labelTone: 'warn' }),
          link('billing', 'email', { label: 'creates', labelTone: 'warn' }),
          link('billing', 'sms', { label: 'creates', labelTone: 'warn' }),
        ],
        flows: [{ path: ['signup', 'email'], tone: 'request', label: 'Email()', duration: 1.3 }, { path: ['billing', 'sms'], tone: 'request', label: 'SMS()', duration: 1.3, delay: 1.4 }],
        panel: {
          title: 'Pasted in every caller',
          icon: 'Code',
          code: 'if channel == "email":\n    n = Email()\nelif channel == "sms":\n    n = SMS()\nelif channel == "push":\n    n = Push()',
          footer: { text: 'New type: edit every copy', tone: 'bad' },
        },
        caption: 'The decision is duplicated',
      },
    },
    // 7
    {
      title: 'Simple factory',
      tag: 'concept',
      heading: 'Simple factory: one function picks the class',
      eli5: 'The shop puts a **toy counter** at the front. You say "robot" and the counter hands you one. Kids never visit the back room.',
      body: [
        'Email, SMS and Push implement a `Notification` interface. `NotificationFactory.create(channel)` looks the name up in a registry and returns an instance. This is a **simple factory**.',
        'The GoF **factory method** differs: a base `Sender` declares an abstract `create_notification()` hook and each subclass overrides it (see the code).',
              ],
      keyIdea: 'A factory returns the interface and hides which concrete class it built.',
      metrics: { edits: '1', creators: '1', tests: 'fake notification', pattern: 'factory' },
      metricTones: { edits: 'good', creators: 'good' },
      scene: {
        nodes: [
          blk('caller', A, 'Signup', 'caller', 'green', 'User'),
          blk('factory', B, 'NotificationFactory', 'create(channel)', 'blue', 'Package', { status: 'active' }),
          blk('iface', C, 'Notification', 'interface', 'violet', 'Plug'),
          blk('sms', F, 'SMS', 'implements', 'green', 'Smartphone'),
        ],
        links: [link('caller', 'factory', { label: 'uses' }), link('factory', 'sms', { label: 'creates' }), link('factory', 'iface', { label: 'returns' }), link('sms', 'iface', { label: 'implements' })],
        flows: [
          { path: ['caller', 'factory'], tone: 'request', label: 'create("sms")', duration: 1.3 },
          { path: ['factory', 'sms'], tone: 'request', label: 'SMS()', duration: 1.2, delay: 1.4 },
          { path: ['factory', 'caller'], tone: 'response', label: 'Notification', duration: 1.3, delay: 2.7 },
        ],
        panel: {
          title: 'The factory',
          icon: 'Code',
          code: 'registry = {"email": Email, "sms": SMS}\n\ndef create(channel):\n    cls = registry.get(channel)\n    if cls is None:\n        raise ValueError(channel)\n    return cls()',
        },
        caption: 'Callers ask by name, get an interface',
      },
      code: {
        language: 'python',
        title: 'Simple factory, then the GoF factory method',
        source: `from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def send(self, msg): ...


class Email(Notification):
    def send(self, msg): print("email:", msg)


class SMS(Notification):
    def send(self, msg): print("sms:", msg)


class Push(Notification):
    def send(self, msg): print("push:", msg)


class NotificationFactory:
    @staticmethod
    def create(channel: str) -> Notification:
        registry = {"email": Email, "sms": SMS, "push": Push}
        cls = registry.get(channel)
        if cls is None:
            raise ValueError(f"unknown channel {channel}")
        return cls()


NotificationFactory.create("sms").send("Your OTP is 1234")


# GoF factory method: subclasses override the creation hook
class Sender(ABC):
    @abstractmethod
    def create_notification(self) -> Notification: ...

    def notify(self, msg):
        self.create_notification().send(msg)


class SmsSender(Sender):
    def create_notification(self):
        return SMS()`,
        highlight: [4, 23, 24, 25, 26, 28],
      },
    },
    // 8
    {
      title: 'Factory in use',
      tag: 'tradeoff',
      heading: 'Adding a channel touches one place, and skip it for one type',
      eli5: 'A new toy arrives, a kite. You tell the toy counter once and every kid can ask for kites. But if the shop only sells one toy, you do not need a counter.',
      body: [
        'Adding WhatsApp means one new class and one registry line. Signup, billing and alerts are untouched. This is the **open/closed** idea from the SOLID lesson applied to creation.',
        'Skip the factory when you only ever create one kind. Real examples: `open()` returns different IO classes depending on the mode, `codecs.lookup(name)` picks a codec from a string, and SQLAlchemy `create_engine(url)` picks a dialect from the URL.',
      ],
      keyIdea: 'Use a factory when the type depends on runtime input. Skip it when there is only one type.',
      metrics: { edits: '1', creators: '1', tests: 'fake notification', pattern: 'factory' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [
          blk('factory', A, 'NotificationFactory', 'one registry', 'blue', 'Package'),
          blk('email', C, 'Email', 'existing', 'green', 'Mail', { status: 'dim' }),
          blk('wa', E, 'WhatsApp', 'new class', 'green', 'Smartphone', { status: 'active', badge: 'new' }),
        ],
        links: [link('factory', 'email', { label: 'creates' }), link('factory', 'wa', { label: 'creates' })],
        flows: [{ path: ['factory', 'wa'], tone: 'request', label: 'WhatsApp()', duration: 1.4 }],
        panel: {
          title: 'Cost of a new channel',
          icon: 'Table',
          rows: [
            { text: 'New class', value: '1 file', tone: 'good' },
            { text: 'Registry line', value: '1 edit', tone: 'good' },
            { text: 'Callers changed', value: '0', tone: 'good' },
            { text: 'Only one type ever?', value: 'skip factory', tone: 'warn' },
          ],
        },
        caption: 'One place to extend',
      },
      quiz: {
        question: 'Which problem does a factory solve best?',
        options: [
          'The same if chain that picks a concrete class is copied into many callers',
          'A class needs exactly one instance in the whole process',
          'An object has twelve optional constructor arguments',
          'A million objects share the same heavy data',
        ],
        answer: 0,
        explain: 'A factory centralizes the choice of concrete class. Option 2 is singleton, 3 is builder and 4 is flyweight.',
      },
    },
    // 9
    {
      title: 'Abstract factory',
      tag: 'concept',
      heading: 'Abstract factory: a whole family that fits together',
      eli5: 'The shop sells a pirate kit and a space kit. The **kit box** makes sure the pirate hat comes with the pirate sword, never the space helmet.',
      body: [
        'A **simple factory** or **factory method** makes one product. An **abstract factory** makes a family of related products, so they match. A `Theme` factory makes a `Button` and a `Checkbox`, either both dark or both light.',
        'Swap the factory and the whole family swaps. Callers receive a `Button` and a `Checkbox` and cannot mix a dark button with a light checkbox.',
      ],
      keyIdea: 'An abstract factory creates families of related objects that must be used together.',
      metrics: { edits: '1 factory per family', creators: '1', tests: 'one fake factory', pattern: 'abstract factory' },
      scene: {
        nodes: [
          blk('app', A, 'App', 'uses a factory', 'green', 'Laptop'),
          blk('uif', B, 'UIFactory', 'interface', 'violet', 'Plug', { status: 'active' }),
          blk('dark', E, 'DarkFactory', 'implements', 'green', 'Package'),
          blk('btn', C, 'DarkButton', 'creates', 'green', 'Zap'),
          blk('chk', F, 'DarkCheckbox', 'creates', 'green', 'Zap'),
        ],
        links: [link('app', 'uif', { label: 'uses' }), link('dark', 'uif', { label: 'implements' }), link('dark', 'btn', { label: 'creates' }), link('dark', 'chk', { label: 'creates' })],
        flows: [
          { path: ['app', 'uif'], tone: 'request', label: 'create_button()', duration: 1.3 },
          { path: ['dark', 'btn'], tone: 'request', label: 'DarkButton()', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Interface of the family',
          icon: 'Code',
          code: 'class UIFactory(ABC):\n    def create_button(self): ...\n    def create_checkbox(self): ...\n\nclass DarkFactory(UIFactory):\n    def create_button(self):\n        return DarkButton()',
          footer: { text: 'One factory, matching products', tone: 'good' },
        },
        caption: 'Products come in matching sets',
      },
    },
    // 10
    {
      title: 'Builder pain',
      tag: 'problem',
      heading: 'A constructor with twelve arguments',
      eli5: 'A kid orders a custom robot with 12 choices: color, arms, eyes and more. The helper reads out "none, none, none, yes, none, red" and nobody knows which answer belongs to which choice.',
      body: [
        'An `HttpRequest` has a method, URL, headers, body, timeout and retry count, and most are optional. Callers write `HttpRequest("POST", url, None, None, body, 10, 3)`.',
        'Nobody remembers the order. Two `None` values swap places and the bug compiles fine. This is the **telescoping constructor** problem.',
      ],
      keyIdea: 'Positional arguments do not scale. A long optional parameter list is easy to get wrong silently.',
      metrics: { edits: '-', creators: '1', tests: 'long setup', pattern: '-' },
      metricTones: { tests: 'warn' },
      scene: {
        nodes: [
          blk('caller', A, 'Caller', 'passes 7 args', 'green', 'User', { status: 'hot' }),
          blk('req', C, 'HttpRequest', 'constructor', 'green', 'Package', { chips: [{ text: 'None, None, True', tone: 'warn' }] }),
        ],
        links: [link('caller', 'req', { label: 'creates', labelTone: 'warn' })],
        flows: [{ path: ['caller', 'req'], tone: 'error', label: '("POST", url, None, None, body, 10, 3)', duration: 1.8 }],
        panel: {
          title: 'Which None is which?',
          icon: 'Bug',
          code: 'HttpRequest(\n  "POST", url,\n  None, None,\n  body, 10, 3)\n# headers? cookies?\n# timeout? retries?',
          footer: { text: 'Swapped arguments still run', tone: 'bad' },
        },
        caption: 'Positional arguments hide meaning',
      },
    },
    // 11
    {
      title: 'Builder',
      tag: 'concept',
      heading: 'Builder: name each choice, then build',
      eli5: 'The helper hands the kid a checklist. The kid ticks "red", "two arms", "blue eyes", one line at a time, then says "make it". Every choice has a name.',
      body: [
        'A `HttpRequestBuilder` has one method per option. Each sets a field and returns `self`, so calls chain in any order. A final `build()` returns the finished object.',
        'The call reads like a sentence: `.method("POST").url(...).timeout(10).build()`. Skipped options keep their defaults.',
      ],
      keyIdea: 'A builder names every option and defers construction until build() is called.',
      metrics: { edits: '-', creators: '1', tests: 'readable setup', pattern: 'builder' },
      metricTones: { tests: 'good' },
      scene: {
        nodes: [
          blk('caller', A, 'Caller', 'chains calls', 'green', 'User'),
          blk('builder', B, 'RequestBuilder', 'collects options', 'blue', 'Workflow', { status: 'active' }),
          blk('req', C, 'HttpRequest', 'product', 'green', 'Package', { status: 'ok' }),
        ],
        links: [link('caller', 'builder', { label: 'uses' }), link('builder', 'req', { label: 'creates' })],
        flows: [
          { path: ['caller', 'builder'], tone: 'request', label: '.method("POST")', duration: 1.1 },
          { path: ['caller', 'builder'], tone: 'request', label: '.timeout(10)', duration: 1.1, delay: 1.2 },
          { path: ['caller', 'builder'], tone: 'request', label: '.build()', duration: 1.1, delay: 2.4 },
          { path: ['builder', 'req'], tone: 'response', label: 'HttpRequest', duration: 1.2, delay: 3.6 },
        ],
        panel: {
          title: 'Fluent chain',
          icon: 'Code',
          code: 'req = (HttpRequestBuilder()\n   .method("POST")\n   .url(URL)\n   .header("Auth", tok)\n   .timeout(10)\n   .retries(3)\n   .build())',
        },
        caption: 'Each call names one choice',
      },
      code: {
        language: 'python',
        title: 'A fluent builder',
        source: `class HttpRequest:
    def __init__(self):
        self.method = "GET"
        self.url = ""
        self.headers = {}
        self.body = None
        self.timeout = 30
        self.retries = 0


class HttpRequestBuilder:
    def __init__(self):
        self._req = HttpRequest()

    def method(self, m):    self._req.method = m;  return self
    def url(self, u):       self._req.url = u;     return self
    def header(self, k, v): self._req.headers[k] = v; return self
    def body(self, b):      self._req.body = b;    return self
    def timeout(self, t):   self._req.timeout = t; return self
    def retries(self, n):   self._req.retries = n; return self
    def build(self):        return self._req


req = (HttpRequestBuilder()
       .method("POST")
       .url("https://api.example.com/v1/orders")
       .header("Authorization", "Bearer xyz")
       .timeout(10)
       .retries(3)
       .build())`,
        highlight: [12, 14, 20, 23],
      },
    },
    // 12
    {
      title: 'Validate and freeze',
      tag: 'concept',
      heading: 'build() is the place to check rules and lock the object',
      eli5: 'Before the toy leaves the counter, the helper checks the order: "You picked flying but no wings, that will not work." Then the toy is sealed in its box.',
      body: [
        'Collecting options in a builder means `build()` can validate them together: a `POST` needs a body, retries must be 0 or more. A bad combination fails at build time, not later in the network layer.',
        'The builder can also return an **immutable** object. Mutable while building, frozen once built.',
      ],
      keyIdea: 'A builder lets you check a set of options as a whole and hand back an immutable result.',
      metrics: { edits: '-', creators: '1', tests: 'invalid caught early', pattern: 'builder' },
      metricTones: { tests: 'good' },
      scene: {
        nodes: [
          blk('builder', A, 'RequestBuilder', 'mutable', 'blue', 'Workflow'),
          blk('check', B, 'build()', 'validates', 'amber', 'Shield', { status: 'active' }),
          blk('req', C, 'HttpRequest', 'frozen', 'green', 'Package', { status: 'ok' }),
        ],
        links: [link('builder', 'check', { label: 'calls' }), link('check', 'req', { label: 'creates' })],
        flows: [
          { path: ['builder', 'check'], tone: 'request', label: 'build()', duration: 1.2 },
          { path: ['check', 'req'], tone: 'response', label: 'valid, frozen', duration: 1.3, delay: 1.3 },
        ],
        panel: {
          title: 'Rules checked in build()',
          icon: 'Table',
          rows: [
            { text: 'POST needs a body', value: 'checked', tone: 'good' },
            { text: 'retries >= 0', value: 'checked', tone: 'good' },
            { text: 'timeout > 0', value: 'checked', tone: 'good' },
            { text: 'Invalid combination', value: 'ValueError', tone: 'bad' },
          ],
        },
        caption: 'Fail at build time, not at send time',
      },
      code: {
        language: 'python',
        title: 'Validate, then freeze',
        source: `from dataclasses import dataclass


@dataclass(frozen=True)
class HttpRequest:
    method: str
    url: str
    headers: tuple = ()
    body: str | None = None
    timeout: int = 30
    retries: int = 0


class HttpRequestBuilder:
    def __init__(self):
        self._f = {"method": "GET", "url": "", "headers": []}

    def method(self, m):  self._f["method"] = m;  return self
    def url(self, u):     self._f["url"] = u;     return self
    def body(self, b):    self._f["body"] = b;    return self
    def retries(self, n): self._f["retries"] = n; return self

    def build(self) -> HttpRequest:
        f = self._f
        if f["method"] == "POST" and not f.get("body"):
            raise ValueError("POST needs a body")
        if f.get("retries", 0) < 0:
            raise ValueError("retries must be >= 0")
        return HttpRequest(**{**f, "headers": tuple(f["headers"])})`,
        highlight: [4, 23, 25, 26, 27, 28, 29],
      },
    },
    // 13
    {
      title: 'Builder case',
      tag: 'case',
      heading: 'Case: a cache with a size cap, a TTL and a listener',
      eli5: 'A cookie jar can have a limit on cookies, an expiry date and a bell that rings when one is removed. The kid picks only the extras they want, then says "make the jar".',
      body: [
        'Guava, the Java library, builds a cache with `CacheBuilder`: `CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(5, TimeUnit.MINUTES).removalListener(fn).build(loader)`. Each option is optional, and `build()` makes the cache.',
        'Kafka producers and SQL query builders work the same way. Skip a builder for an object with two or three fields. A plain constructor is clearer.',
      ],
      keyIdea: 'Use a builder for many optional settings or staged construction. Skip it for small objects.',
      metrics: { edits: '-', creators: '1', tests: 'readable setup', pattern: 'builder' },
      scene: {
        nodes: [
          blk('app', A, 'App', 'configures', 'green', 'Laptop'),
          blk('cb', B, 'CacheBuilder', 'size, ttl, listener', 'blue', 'Workflow', { status: 'active' }),
          blk('cache', C, 'Cache', 'product', 'green', 'Database', { status: 'ok' }),
        ],
        links: [link('app', 'cb', { label: 'chains' }), link('cb', 'cache', { label: 'creates' })],
        flows: [
          { path: ['app', 'cb'], tone: 'request', label: '.maximumSize(1000)', duration: 1.2 },
          { path: ['app', 'cb'], tone: 'request', label: '.expireAfterWrite(5, MINUTES)', duration: 1.2, delay: 1.3 },
          { path: ['cb', 'cache'], tone: 'response', label: '.build(loader)', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Builder or constructor?',
          icon: 'Scale',
          rows: [
            { text: '2 or 3 fields', value: 'constructor', tone: 'muted' },
            { text: 'Many optional settings', value: 'builder', tone: 'good' },
            { text: 'Rules across fields', value: 'builder', tone: 'good' },
            { text: 'Immutable result', value: 'builder', tone: 'good' },
          ],
        },
        caption: 'Optional settings, one build() call',
      },
    },
    // 14
    {
      title: 'Prototype',
      tag: 'concept',
      heading: 'Prototype: copy an object that is already set up',
      eli5: 'Making a toy from scratch takes an hour. But the shop already has a finished one, so a helper just copies it and changes the color.',
      body: [
        '**Prototype** creates a new object by cloning an existing one. It fits when building from scratch is costly, such as loading a template, or when you want many near-identical objects.',
        'Python has `copy.deepcopy`. Know the catch: a shallow copy shares nested lists and dicts with the original, so a change in the copy leaks back.',
      ],
      keyIdea: 'Prototype clones a configured object. Deep copy when the object holds mutable parts.',
      metrics: { edits: '-', creators: '1 template', tests: '-', pattern: 'prototype' },
      scene: {
        nodes: [
          blk('proto', A, 'Template', 'prototype', 'amber', 'Copy', { status: 'active' }),
          blk('c1', C, 'Clone 1', 'color = red', 'green', 'Package'),
          blk('c2', F, 'Clone 2', 'color = blue', 'green', 'Package'),
        ],
        links: [link('proto', 'c1', { label: 'clone()' }), link('proto', 'c2', { label: 'clone()' })],
        flows: [
          { path: ['proto', 'c1'], tone: 'data', label: 'deepcopy', duration: 1.3 },
          { path: ['proto', 'c2'], tone: 'data', label: 'deepcopy', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Shallow versus deep',
          icon: 'Code',
          code: 'a = Doc(tags=["x"])\nb = copy.copy(a)\nb.tags.append("y")\n# a.tags is now ["x","y"]\n\nc = copy.deepcopy(a)\nc.tags.append("z")  # a unchanged',
          footer: { text: 'Shallow copies share nested data', tone: 'warn' },
        },
        caption: 'Clone, then adjust',
      },
    },
    // 15
    {
      title: 'Flyweight',
      tag: 'concept',
      heading: 'Flyweight: a factory that shares, not creates',
      eli5: 'A million toy trees all need the same picture of an oak. Instead of a copy of the picture inside every tree, every tree points at one shared picture on the wall.',
      body: [
        'A game draws 1,000,000 trees, but only 3 species. Each tree stored its own 2.5 MB texture and mesh, which is 2.5 TB. The process runs out of memory.',
        '**Flyweight** splits shared state (`TreeType`, immutable) from per-object state (`x`, `y`). A factory caches each `TreeType`, so a million trees point at 3 objects: about 31 MB.',
      ],
      keyIdea: 'A flyweight factory returns a cached shared object instead of creating a new one each time.',
      metrics: { edits: '-', creators: '1 cache', tests: '-', pattern: 'flyweight' },
      scene: {
        nodes: [
          blk('tree', A, 'Tree', 'x, y, type', 'green', 'Package', { chips: ['1,000,000 of these'] }),
          blk('factory', B, 'TreeFactory', 'get(species)', 'blue', 'Package', { status: 'active' }),
          blk('type', C, 'TreeType', 'shared, frozen', 'amber', 'Image', { chips: [{ text: '2.5 MB x 3', tone: 'good' }] }),
        ],
        links: [link('tree', 'factory', { label: 'asks' }), link('factory', 'type', { label: 'returns cached' })],
        flows: [
          { path: ['tree', 'factory'], tone: 'request', label: 'get("oak")', duration: 1.2 },
          { path: ['factory', 'type'], tone: 'request', label: 'cache hit', duration: 1.2, delay: 1.3 },
          { path: ['type', 'tree'], tone: 'response', label: 'same object', duration: 1.3, delay: 2.6 },
        ],
        panel: {
          title: 'Memory',
          icon: 'Table',
          rows: [
            { text: 'No sharing', value: '2.5 TB', tone: 'bad' },
            { text: 'Flyweight', value: '~31 MB', tone: 'good' },
            { text: 'First get("oak")', value: '~50 ms disk' },
            { text: 'Next get("oak")', value: '~0.2 us' },
          ],
        },
        caption: 'Intrinsic state shared, extrinsic state per tree',
      },
      code: {
        language: 'python',
        title: 'Flyweight factory',
        source: `from dataclasses import dataclass


@dataclass(frozen=True)
class TreeType:            # shared, immutable
    species: str
    texture: bytes
    mesh: bytes


class TreeFactory:
    _cache: dict[str, TreeType] = {}

    @classmethod
    def get(cls, species: str) -> TreeType:
        if species not in cls._cache:
            cls._cache[species] = TreeType(
                species, load_png(f"{species}.png"), load_mesh(f"{species}.obj"))
        return cls._cache[species]


@dataclass
class Tree:                # per tree
    x: float
    y: float
    type: TreeType`,
        highlight: [4, 11, 15, 16],
      },
    },
    // 16
    {
      title: 'Flyweight limits',
      tag: 'tradeoff',
      heading: 'Where a shared object breaks',
      eli5: 'If one kid scribbles on the shared oak picture, every tree on the wall turns scribbly. The picture must be one nobody can draw on.',
      body: [
        'Mutating the shared object changes every holder, so freeze it. A key like `"Oak "` with a trailing space makes a second cache entry, so normalize keys: `strip().lower()`.',
        'Two threads on an empty cache can both load the same file, so lock the miss path. A cache with thousands of kinds needs an LRU cap. With only 100 objects, skip flyweight.',
      ],
      keyIdea: 'A flyweight must be immutable, keyed cleanly, safe on first access and bounded in size.',
      metrics: { edits: '-', creators: '1 cache', tests: '-', pattern: 'flyweight' },
      metricTones: { pattern: 'warn' },
      scene: {
        nodes: [
          blk('t1', A, 'Tree 1', 'oak', 'green', 'Package'),
          blk('type', B, 'TreeType', 'shared', 'amber', 'Image', { status: 'hot', badge: 'bark = red' }),
          blk('t2', C, 'Tree 2', 'oak', 'green', 'Package', { status: 'hot' }),
        ],
        links: [link('t1', 'type', { label: 'points to' }), link('t2', 'type', { label: 'points to' })],
        flows: [{ path: ['t1', 'type', 't2'], tone: 'error', label: 'one change, all trees', duration: 2 }],
        panel: {
          title: 'Four failure modes',
          icon: 'Bug',
          rows: [
            { text: 'Mutating shared state', value: 'frozen=True', tone: 'warn' },
            { text: 'Key "Oak " twice', value: 'normalize key', tone: 'warn' },
            { text: 'Race on first get', value: 'lock the miss', tone: 'warn' },
            { text: 'Unbounded cache', value: 'LRU cap', tone: 'warn' },
          ],
        },
        caption: 'Sharing is only safe for immutable data',
      },
      quiz: {
        question: 'A million objects each hold the same 2 MB image. Which creational idea fixes the memory use?',
        options: ['Builder', 'Flyweight with a caching factory', 'Prototype with shallow copy', 'Abstract factory'],
        answer: 1,
        explain: 'Flyweight shares one immutable image through a cached factory. A shallow prototype copy still points at shared mutable parts, and builder does not reduce sharing.',
      },
    },
    // 17
    {
      title: 'Object pool',
      tag: 'concept',
      heading: 'Object pool: borrow and return instead of create',
      eli5: 'The shop has 5 shared tricycles. A kid borrows one, rides, and gives it back, so the next kid does not wait for a new tricycle to be built.',
      body: [
        'Some objects are expensive to make: database connections, threads, large buffers. An **object pool** creates a fixed number up front and lends them out with `acquire()`, taking them back with `release()`.',
        'A flyweight is shared by many at once. A pooled object is used by one borrower at a time and must be reset when it returns. If the pool is empty, callers wait or get an error.',
      ],
      keyIdea: 'A pool reuses costly objects one borrower at a time. Always release, and reset state on return.',
      metrics: { edits: '-', creators: '5 created once', tests: '-', pattern: 'object pool' },
      scene: {
        nodes: [
          blk('client', A, 'Request', 'needs a connection', 'green', 'User'),
          blk('pool', B, 'ConnectionPool', '5 connections', 'blue', 'Boxes', { status: 'active', chips: [{ text: '3 free / 2 busy', tone: 'good' }] }),
          blk('conn', C, 'Connection', 'expensive to open', 'gray', 'Database'),
        ],
        links: [link('client', 'pool', { label: 'acquire / release' }), link('pool', 'conn', { label: 'has-a' })],
        flows: [
          { path: ['client', 'pool'], tone: 'request', label: 'acquire()', duration: 1.2 },
          { path: ['pool', 'client'], tone: 'response', label: 'connection', duration: 1.2, delay: 1.3 },
          { path: ['client', 'pool'], tone: 'request', label: 'release(conn)', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Borrow, use, return',
          icon: 'Code',
          code: 'conn = pool.acquire()\ntry:\n    conn.execute(sql)\nfinally:\n    pool.release(conn)',
          footer: { text: 'Forgot release = leaked connection', tone: 'warn' },
        },
        caption: 'Created once, lent many times',
      },
      code: {
        language: 'python',
        title: 'A tiny blocking pool',
        source: `import queue


class Pool:
    def __init__(self, make, size):
        self._q = queue.Queue(maxsize=size)
        for _ in range(size):
            self._q.put(make())

    def acquire(self, timeout=5):
        return self._q.get(timeout=timeout)   # waits if empty

    def release(self, obj):
        self._q.put(obj)


pool = Pool(open_connection, size=5)
conn = pool.acquire()
try:
    conn.execute("SELECT 1")
finally:
    pool.release(conn)`,
        highlight: [6, 7, 8, 11, 14],
      },
    },
    // 18
    {
      title: 'DI pain',
      tag: 'problem',
      heading: 'A class that builds its own collaborators',
      eli5: 'A kid wants to play shop and builds the till, the scale and the bags first. Another kid hands them a ready till and scale, and they can start in a second.',
      body: [
        '`UserService.__init__` calls `UserRepo(Db())` itself. It cannot be tested without a real database, and swapping the database edits the service.',
        'This is creation inside the class again, hiding in the constructor. The fix is to stop creating and start receiving.',
      ],
      keyIdea: 'A class that creates its own dependencies is welded to them and impossible to test alone.',
      metrics: { edits: '2 files to swap db', creators: '2 inside service', tests: 'real database', pattern: '-' },
      metricTones: { edits: 'bad', creators: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          blk('svc', A, 'UserService', 'builds its own', 'green', 'Users', { status: 'hot' }),
          blk('repo', B, 'UserRepo', 'created inside', 'green', 'Table'),
          blk('db', C, 'Db', 'real database', 'gray', 'Database'),
        ],
        links: [link('svc', 'repo', { label: 'creates', labelTone: 'warn' }), link('repo', 'db', { label: 'creates', labelTone: 'warn' })],
        flows: [{ path: ['svc', 'repo', 'db'], tone: 'request', label: 'UserRepo(Db())', duration: 1.8 }],
        panel: {
          title: 'Hidden construction',
          icon: 'Code',
          code: 'class UserService:\n    def __init__(self):\n        self.repo = UserRepo(Db())\n\n# test needs a live database',
          footer: { text: 'No way to pass a fake', tone: 'bad' },
        },
        caption: 'The class decides its own dependencies',
      },
    },
    // 19
    {
      title: 'Injection',
      tag: 'concept',
      heading: 'Dependency injection: pass collaborators in',
      eli5: 'Someone outside the game hands the kid a ready till. The kid never builds one, so any till, even a pretend one, works.',
      body: [
        '**Dependency injection** means a class receives what it needs through its constructor, ideally as an interface. `UserService(repo)` uses whatever `repo` it is given.',
        'Production passes `SqlUserRepo(Db())`. A test passes `FakeUserRepo()`. One place, usually `main`, wires the objects together.',
      ],
      keyIdea: 'Do not create your collaborators. Ask for them in the constructor and let the caller supply them.',
      metrics: { edits: '1 wiring spot', creators: '0 inside service', tests: 'fake repo', pattern: 'dependency injection' },
      metricTones: { edits: 'good', creators: 'good', tests: 'good' },
      scene: {
        nodes: [
          blk('main', A, 'main()', 'wires objects', 'amber', 'Cable', { status: 'active' }),
          blk('svc', B, 'UserService', 'receives repo', 'green', 'Users'),
          blk('iface', C, 'UserRepo', 'interface', 'violet', 'Plug'),
          blk('fake', F, 'FakeUserRepo', 'used in tests', 'green', 'Bug'),
        ],
        links: [link('main', 'svc', { label: 'creates' }), link('svc', 'iface', { label: 'uses' }), link('fake', 'iface', { label: 'implements' })],
        flows: [
          { path: ['main', 'svc'], tone: 'request', label: 'UserService(repo)', duration: 1.3 },
          { path: ['svc', 'iface'], tone: 'request', label: 'find(42)', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Constructor injection',
          icon: 'Code',
          code: 'class UserService:\n    def __init__(self, repo: UserRepo):\n        self.repo = repo\n\n# prod\nsvc = UserService(SqlUserRepo(Db()))\n# test\nsvc = UserService(FakeUserRepo())',
          footer: { text: 'The service never says new', tone: 'good' },
        },
        caption: 'Receive, do not create',
      },
    },
    // 20
    {
      title: 'DI container',
      tag: 'case',
      heading: 'Case: a container that wires the graph for you',
      eli5: 'A helper at the door reads each kid\'s list ("I need a till, the till needs coins") and hands over everything in the right order. Kids just say what they need.',
      body: [
        'With many classes, wiring by hand gets long. A **container** (Spring in Java is the best known) registers how to build each type, reads constructor type hints, and builds dependencies recursively.',
        'It can also keep one instance per type, a **singleton scope**. You get a shared `Db` without a global, because the container hands the same one to every class that asks.',
      ],
      keyIdea: 'A container is a factory that reads constructors, resolves the graph and can share instances without global state.',
      metrics: { edits: '1 registration', creators: '1 container', tests: 'override one binding', pattern: 'dependency injection' },
      metricTones: { creators: 'good' },
      scene: {
        nodes: [
          blk('ctx', A, 'Container', 'get(UserService)', 'blue', 'Package', { status: 'active' }),
          blk('svc', B, 'UserService', 'needs repo', 'green', 'Users'),
          blk('repo', C, 'UserRepo', 'needs db', 'green', 'Table'),
          blk('db', F, 'Db', 'singleton scope', 'amber', 'Database', { status: 'ok' }),
        ],
        links: [link('ctx', 'svc', { label: 'creates' }), link('ctx', 'repo', { label: 'creates' }), link('ctx', 'db', { label: 'creates' }), link('svc', 'repo', { label: 'has-a' }), link('repo', 'db', { label: 'has-a' })],
        flows: [
          { path: ['ctx', 'db'], tone: 'request', label: 'build Db', duration: 1.2 },
          { path: ['ctx', 'repo'], tone: 'request', label: 'build UserRepo(db)', duration: 1.2, delay: 1.3 },
          { path: ['ctx', 'svc'], tone: 'request', label: 'build UserService(repo)', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Resolve, then reuse',
          icon: 'Code',
          code: 'ctx = (Container()\n   .register(Db)\n   .register(UserRepo)\n   .register(UserService))\n\nsvc = ctx.get(UserService)',
          footer: { text: 'Db and UserRepo auto-wired', tone: 'good' },
        },
        caption: 'The container builds dependencies in order',
      },
      code: {
        language: 'python',
        title: 'A minimal container',
        source: `import inspect


class Container:
    def __init__(self):
        self._registry = {}     # type -> factory
        self._singletons = {}   # type -> instance

    def register(self, cls, factory=None, singleton=True):
        self._registry[cls] = (factory or cls, singleton)
        return self

    def get(self, cls):
        if cls in self._singletons:
            return self._singletons[cls]
        factory, is_singleton = self._registry[cls]
        params = inspect.signature(factory).parameters
        kwargs = {n: self.get(p.annotation) for n, p in params.items()
                  if p.annotation is not inspect.Parameter.empty}
        instance = factory(**kwargs)
        if is_singleton:
            self._singletons[cls] = instance
        return instance`,
        highlight: [9, 13, 14, 18, 19, 21, 22],
      },
    },
    // 21
    {
      title: 'Locator trap',
      tag: 'tradeoff',
      heading: 'Service locator hides what injection shows',
      eli5: 'Injection is a kid walking in with the till in hand, so you see what they use. A locator is a kid who sneaks to a secret cupboard mid-game. You cannot tell what they will grab.',
      body: [
        'A **service locator** is a global registry: `ServiceLocator.get("UserRepo")`. It is easy to wire, but the dependency is invisible in the signature, and tests become order dependent.',
        'Constructor injection puts every dependency in the open and lets tests pass fakes. Keep the container at the edge, in `main`, and do not let classes call it themselves.',
      ],
      keyIdea: 'Prefer constructor injection. A locator is a hidden global that hides what a class needs.',
      metrics: { edits: '-', creators: '-', tests: 'order dependent', pattern: 'service locator' },
      metricTones: { tests: 'bad' },
      scene: {
        nodes: [
          blk('svc', A, 'UserService', 'signature says nothing', 'green', 'Users', { status: 'hot' }),
          blk('loc', B, 'ServiceLocator', 'global registry', 'gray', 'Search'),
          blk('repo', C, 'UserRepo', 'hidden dependency', 'green', 'Table'),
        ],
        links: [link('svc', 'loc', { label: 'uses', labelTone: 'warn' }), link('loc', 'repo', { label: 'returns' })],
        flows: [
          { path: ['svc', 'loc'], tone: 'request', label: 'get("UserRepo")', duration: 1.3 },
          { path: ['loc', 'svc'], tone: 'response', label: 'repo', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Locator versus injection',
          icon: 'Scale',
          rows: [
            { text: 'Dependency visible in signature', value: 'DI yes, locator no' },
            { text: 'Test with a fake', value: 'DI easy, locator global', tone: 'warn' },
            { text: 'Setup', value: 'locator is quick' },
            { text: 'Default choice', value: 'constructor DI', tone: 'good' },
          ],
        },
        caption: 'The class pulls from a global',
      },
    },
    // 22
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Match the pattern to the pain',
      eli5: 'Need exactly one price board? Singleton. Many kinds of toy? Counter. Many choices on one toy? Checklist. A copy of a finished toy? Photocopy. Many users of the same picture? Share it.',
      body: [
        'Start from the symptom. Creation logic copied in many places points to a factory. Too many optional arguments points to a builder. Expensive object reuse points to a pool or flyweight.',
        'These combine: factory plus registry makes a plugin system, and a builder with validation makes complex objects safe. In 2026, reach for injection before a singleton.',
      ],
      keyIdea: 'Each creational pattern answers one pain. Pick by symptom, not by familiarity.',
      metrics: { edits: '-', creators: '-', tests: '-', pattern: 'choose by symptom' },
      scene: {
        nodes: [
          blk('sym', A, 'Symptom', 'what hurts', 'gray', 'Bug'),
          blk('pick', C, 'Pattern', 'the fix', 'green', 'Layers', { status: 'ok' }),
        ],
        links: [link('sym', 'pick', { label: 'points to' })],
        flows: [{ path: ['sym', 'pick'], tone: 'request', label: 'match', duration: 1.4 }],
        panel: {
          title: 'Symptom to pattern',
          icon: 'Table',
          rows: [
            { text: 'Need exactly one', value: 'singleton or DI scope' },
            { text: 'Type picked at runtime', value: 'factory' },
            { text: 'Matching families', value: 'abstract factory' },
            { text: 'Many optional args', value: 'builder' },
            { text: 'Costly to rebuild', value: 'prototype, pool' },
            { text: 'Million shared objects', value: 'flyweight' },
          ],
        },
        caption: 'Pain first, pattern second',
      },
    },
    // 23
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Creational patterns in one page',
      eli5: 'The shop has a price board, a toy counter, kit boxes, checklists, photocopies, a shared picture wall, borrowed tricycles and a door helper. Each one fixes one way of getting a toy into a kid\'s hands.',
      body: [
        'Singleton gives one instance, factory and abstract factory choose classes, builder constructs step by step, prototype clones. Flyweight shares, a pool reuses, and dependency injection removes creation from the class.',
        'Keep callers off concrete constructors, and inject dependencies instead of reaching for globals.',
      ],
      keyIdea: 'Move creation out of the caller, then pick the cheapest pattern that fixes the pain.',
      metrics: { edits: '1', creators: '1', tests: 'fakes', pattern: 'recap' },
      metricTones: { edits: 'good', creators: 'good', tests: 'good' },
      scene: {
        nodes: [
          blk('single', A, 'Singleton', 'one', 'amber', 'Star'),
          blk('fact', B, 'Factory', 'which class', 'blue', 'Package'),
          blk('build', C, 'Builder', 'many options', 'blue', 'Workflow'),
          blk('share', D, 'Flyweight, pool', 'reuse', 'green', 'Boxes'),
          blk('di', F, 'Injection', 'receive', 'violet', 'Plug'),
        ],
        links: [link('di', 'fact', { label: 'wires' }), link('fact', 'build', { label: 'can use' })],
        panel: {
          title: 'Remember',
          icon: 'List',
          rows: [
            { text: 'Singleton', value: 'global risk', tone: 'warn' },
            { text: 'Factory', value: 'choose in one place', tone: 'good' },
            { text: 'Builder', value: 'named options', tone: 'good' },
            { text: 'Flyweight', value: 'immutable only', tone: 'warn' },
            { text: 'DI', value: 'default for wiring', tone: 'good' },
          ],
        },
        caption: 'Eight patterns, one question: who creates it',
      },
      quiz: {
        question: 'A service class calls UserRepo(Db()) inside its own constructor. What is the best fix?',
        options: [
          'Make UserRepo a singleton',
          'Pass the repo into the constructor, ideally as an interface',
          'Look the repo up in a global service locator',
          'Copy the repo with deepcopy',
        ],
        answer: 1,
        explain: 'Constructor injection removes creation from the service and lets tests pass a fake. A singleton or locator keeps a hidden global, and cloning does not address the coupling.',
      },
    },
  ],
};
