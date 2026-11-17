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

// Shared positions
const P1 = at(-3.8, -3.8);
const P2 = at(0, -3.8);
const P3 = at(0, 3.8);

// Reused nodes (violet = interface, blue = abstract, green = concrete, gray = external)
const checkout = blk('checkout', P1, 'Checkout', 'caller', 'green', 'ShoppingBag');
const caller = blk('caller', P1, 'Caller', 'client code', 'green', 'Code');
const account = blk('account', P2, 'BankAccount', 'concrete class', 'green', 'Receipt');
const notifier = blk('notifier', P2, 'Notifier', 'abstract base', 'blue', 'Layers');
const shape = blk('shape', P2, 'Shape', 'abstract base', 'blue', 'Layers');
const gateway = blk('gateway', P2, 'PaymentGateway', 'interface', 'violet', 'Plug');
const stripeImpl = blk('stripe', at(-1.8, 3.8), 'StripeGateway', 'implements', 'green', 'Package');
const fakeImpl = blk('fake', at(1.8, 3.8), 'FakeGateway', 'implements', 'green', 'Package');
const method = blk('method', P2, 'PaymentMethod', 'interface', 'violet', 'Plug');
const card = blk('card', at(-3.6, 3.8), 'CardPayment', 'concrete', 'green', 'Package');
const paypal = blk('paypal', at(0, 3.8), 'PayPalPayment', 'concrete', 'green', 'Package');
const applepay = blk('applepay', at(3.6, 3.8), 'ApplePayPayment', 'concrete', 'green', 'Package');
const circle = blk('circle', at(-3.6, 3.8), 'Circle', 'concrete', 'green', 'Package');
const square = blk('square', at(0, 3.8), 'Square', 'concrete', 'green', 'Package');
const triangle = blk('triangle', at(3.6, 3.8), 'Triangle', 'concrete', 'green', 'Package');

// The four pillars as a row of blocks
const pillars = (extra: Record<string, Partial<SceneNode>> = {}): SceneNode[] => [
  blk('p-enc', at(-5.4, 0), 'Encapsulation', 'hide the state', 'teal', 'Shield', extra['p-enc']),
  blk('p-inh', at(-1.8, 0), 'Inheritance', 'share code', 'blue', 'Copy', extra['p-inh']),
  blk('p-pol', at(1.8, 0), 'Polymorphism', 'same call, own result', 'amber', 'Split', extra['p-pol']),
  blk('p-abs', at(5.4, 0), 'Abstraction', 'what, not how', 'violet', 'Plug', extra['p-abs']),
];

export const lldOop: Lesson = {
  id: 'lld-oop',
  title: 'Four pillars of OOP',
  tagline: 'Encapsulation, inheritance, polymorphism and abstraction: what each one buys you in production, and how each one goes wrong.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'Why a design that works on day one can still fail the first change request',
    'Encapsulation: a class that protects its own invariants',
    'Inheritance: shared behavior, and when composition is the better answer',
    'Polymorphism: replacing type checks with one call that each object answers',
    'Abstraction: depending on an interface so implementations can be swapped, and how abstractions leak',
  ],
  metrics: [
    { key: 'edits', label: 'Files per change', icon: 'FileCode' },
    { key: 'ifs', label: 'Type checks', icon: 'Split' },
    { key: 'tests', label: 'Unit-testable', icon: 'Bug' },
    { key: 'open', label: 'Public state', icon: 'Shield' },
  ],
  steps: [
    // 1
    {
      title: 'Day-one class',
      tag: 'problem',
      heading: 'The payment class that ages badly',
      eli5: 'The toy shop till only knew one kind of coin. Each time a kid showed up with new money, the shopkeeper stuck another sticky note on the **till**, until nobody could read it.',
      body: [
        'Day one, checkout takes credit cards. One `process()` method validates the card and charges Stripe. It works, so it ships.',
        'Then PayPal, Apple Pay, UPI, a gift card, and gift card plus card together. Six months later `process()` is 400 lines with 12 optional arguments, and nobody wants to touch the refund path.',
      ],
      keyIdea: 'The code worked on day one. The design is what failed to last.',
      metrics: { edits: '5', ifs: '9', tests: 'No', open: '-' },
      metricTones: { edits: 'bad', ifs: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          checkout,
          blk('processor', P2, 'PaymentProcessor', '400 lines', 'gray', 'Receipt', { status: 'hot', badge: '12 arguments' }),
          blk('stripe-ext', P3, 'Stripe', 'external', 'gray', 'Globe'),
        ],
        links: [link('checkout', 'processor', { label: 'uses' }), link('processor', 'stripe-ext', { label: 'uses' })],
        flows: [
          { path: ['checkout', 'processor'], tone: 'request', label: 'process(amount, card, cvv...)', duration: 1.4 },
          { path: ['processor', 'stripe-ext'], tone: 'request', label: 'charge', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'process() after six months',
          icon: 'FileCode',
          code: 'def process(self, amount, method,\n            card=None, cvv=None, paypal=None,\n            upi=None, gift=None, ...):\n    if method == "card": ...\n    elif method == "paypal": ...\n    elif method == "upi": ...',
          footer: { text: 'One more elif for every new method', tone: 'bad' },
        },
        caption: 'One class that knows every payment method',
      },
      code: {
        language: 'python',
        title: 'Day one: this works, ship it',
        source: `class PaymentProcessor:
    def process(self, amount, card_number, cvv, expiry):
        # validate card
        if not card_number.isdigit() or len(card_number) != 16:
            raise ValueError("bad card")
        # charge via Stripe
        print(f"Charging \${amount} to card {card_number[-4:]}")
        return {"status": "ok", "txn_id": "stripe_abc123"}`,
        highlight: [2, 4, 7],
      },
    },
    // 2
    {
      title: 'The test',
      tag: 'concept',
      heading: 'The test for a good design',
      eli5: 'A good till has one new slot added for a new kind of coin. A bad till gets opened up and rewired every time. The test is: **one new slot**, nothing else touched.',
      body: [
        'Nothing about the first requirement was wrong. The design was. A payment processor should not know about card numbers. It should know about a generic payment method and delegate.',
        'Good low-level design is invisible when things are calm and obvious when things change. If adding a payment method means editing five files, the design is wrong. If it means adding one new file, the design is right.',
      ],
      keyIdea: 'Judge a design by what a new feature costs: five files edited, or one file added.',
      metrics: { edits: '5 now, 1 goal', ifs: '9', tests: 'No', open: '-' },
      metricTones: { edits: 'warn' },
      scene: {
        nodes: [
          blk('ask', P1, 'Feature ask', 'add Apple Pay', 'gray', 'Zap'),
          blk('bad', P2, 'Today', 'edit 5 files', 'red', 'Bug', { status: 'hot' }),
          blk('good', P3, 'Goal', 'add 1 file', 'green', 'Package', { status: 'ok' }),
        ],
        links: [link('ask', 'bad', { label: 'forces', labelTone: 'warn' }), link('ask', 'good', { label: 'should need', labelTone: 'good' })],
        flows: [
          { path: ['ask', 'bad'], tone: 'error', label: 'edit 5 files', duration: 1.4 },
          { path: ['ask', 'good'], tone: 'response', label: 'add 1 file', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Cost of Apple Pay',
          icon: 'Scale',
          rows: [
            { text: 'Processor edited', value: 'yes', tone: 'bad' },
            { text: 'Refund path edited', value: 'yes', tone: 'bad' },
            { text: 'Tests edited', value: 'yes', tone: 'bad' },
            { text: 'Goal: new file only', value: '1 file', tone: 'good' },
          ],
          footer: { text: 'Change should be added, not edited in', tone: 'muted' },
        },
        caption: 'Adding versus editing',
      },
    },
    // 3
    {
      title: 'Four tools',
      tag: 'concept',
      heading: 'Four pillars, four jobs',
      eli5: 'The shop keeps tidy with **four tricks**: put the gears inside the toy, share one pattern, give every toy the same play button, and hide how each toy works behind that button.',
      body: [
        'Skip the textbook definitions. Each pillar buys something specific in production.',
        '**Encapsulation** lets you change internals on a rainy Tuesday. **Inheritance** shares behavior. **Polymorphism** replaces `if/elif` chains on type. **Abstraction** lets you swap implementations without callers noticing.',
      ],
      keyIdea: 'Each pillar has a job and a failure mode. Learn both.',
      metrics: { edits: '-', ifs: '-', tests: '-', open: '-' },
      scene: {
        nodes: pillars(),
        panel: {
          title: 'What each one buys',
          icon: 'List',
          rows: [
            { text: 'Encapsulation', value: 'change internals safely' },
            { text: 'Inheritance', value: 'share, do not copy' },
            { text: 'Polymorphism', value: 'no type if-chains' },
            { text: 'Abstraction', value: 'swap implementations' },
          ],
          footer: { text: 'Next: each one, violation first', tone: 'muted' },
        },
        caption: 'The four pillars of OOP',
      },
    },
    // 4
    {
      title: 'Open fields',
      tag: 'problem',
      heading: 'Encapsulation violated: anyone can touch the balance',
      eli5: 'The piggy bank has no lid. Anyone can reach in, pull coins out, or drop in a button, and the **BankAccount** cannot say no.',
      body: [
        '**Encapsulation** bundles data with the methods that use it, and hides the state so callers cannot poke at it. Here nothing is hidden: `balance` is a public field.',
        'Any code, anywhere, can set it to `-500` or add a string to it. The class has no say, so one bad write breaks every report that reads it.',
      ],
      keyIdea: 'Every public field is a promise you must keep forever.',
      metrics: { open: '1 field', edits: '-', ifs: '-', tests: '-' },
      metricTones: { open: 'bad' },
      scene: {
        nodes: [
          caller,
          account,
          blk('reports', P3, 'Reports', 'reads balance', 'green', 'Table'),
        ],
        links: [link('caller', 'account', { label: 'sets balance', labelTone: 'warn' }), link('reports', 'account', { label: 'reads balance' })],
        flows: [
          { path: ['caller', 'account'], tone: 'error', label: 'balance = -500', duration: 1.4 },
          { path: ['account', 'reports'], tone: 'error', label: 'balance: -500', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'No protection',
          icon: 'Code',
          code: 'class BankAccount:\n    def __init__(self):\n        self.balance = 0\n\nacct = BankAccount()\nacct.balance = -500\nacct.balance += "oops"',
          footer: { text: 'The class cannot defend itself', tone: 'bad' },
        },
        caption: 'A public field is open to all',
      },
    },
    // 5
    {
      title: 'Hide state',
      tag: 'concept',
      heading: 'Encapsulate: the class guards its own invariants',
      eli5: 'Now the piggy bank has a lid with a slot. You can only drop coins in or ask for some back, and the bank says no if it is empty. The lid is the **encapsulation**.',
      body: [
        'Make the state private (`_balance`, by convention in Python) and expose behavior: `deposit()` and `withdraw()`. Each method checks the rule before changing anything.',
        'A read-only `@property` lets callers see the balance but not set it. No outside code can put the account into a broken state.',
      ],
      keyIdea: 'The class protects its own invariants, so callers cannot break them.',
      metrics: { open: '0 fields', edits: '-', ifs: '-', tests: '-' },
      metricTones: { open: 'good' },
      scene: {
        nodes: [
          caller,
          { ...account, status: 'ok', chips: ['deposit()', 'withdraw()', '@property balance'] },
          blk('state', P3, '_balance', 'private state', 'amber', 'Key'),
        ],
        links: [link('caller', 'account', { label: 'uses' }), link('account', 'state', { label: 'has-a' })],
        flows: [
          { path: ['caller', 'account'], tone: 'request', label: 'withdraw(900)', duration: 1.2 },
          { path: ['account', 'caller'], tone: 'error', label: 'ValueError', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Rule lives in the method',
          icon: 'Shield',
          code: 'def withdraw(self, amount):\n    if amount > self._balance:\n        raise ValueError(\n            "insufficient funds")\n    self._balance -= amount',
          footer: { text: 'Overdraw is refused at the door', tone: 'good' },
        },
        caption: 'Behavior in, raw state out',
      },
      code: {
        language: 'python',
        title: 'BankAccount, encapsulated',
        source: `class BankAccount:
    def __init__(self):
        self._balance = 0  # underscore means "don't touch"

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("deposit must be positive")
        self._balance += amount

    def withdraw(self, amount: float) -> None:
        if amount > self._balance:
            raise ValueError("insufficient funds")
        self._balance -= amount

    @property
    def balance(self) -> float:
        return self._balance`,
        highlight: [3, 6, 11, 15],
      },
    },
    // 6
    {
      title: 'Free to change',
      tag: 'tradeoff',
      heading: 'What hiding buys: a rainy-Tuesday refactor',
      eli5: 'Because the lid hides the inside, the shopkeeper can swap the box inside for a bigger one and nobody notices, as long as the **slot** works the same way.',
      body: [
        'A private field is a detail you can change. Move the balance from a float to integer cents, or to a ledger of entries, and no caller breaks because none of them touched it.',
        'Python only marks privacy by convention, so the discipline is yours. Encapsulation is the default. If you expose a raw field, be ready to say why.',
      ],
      keyIdea: 'Public is a promise forever. Private is free to change.',
      metrics: { open: '0 fields', edits: '1', ifs: '-', tests: '-' },
      metricTones: { open: 'good', edits: 'good' },
      scene: {
        nodes: [
          caller,
          { ...account, status: 'ok', chips: ['@property balance'] },
          blk('state', P3, '_cents', 'was float', 'amber', 'Key', { badge: 'changed' }),
        ],
        links: [link('caller', 'account', { label: 'uses' }), link('account', 'state', { label: 'has-a' })],
        flows: [
          { path: ['caller', 'account'], tone: 'request', label: 'balance', duration: 1.2 },
          { path: ['account', 'caller'], tone: 'response', label: '10.50', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Same slot, new box',
          icon: 'Table',
          rows: [
            { text: 'Public API', value: 'unchanged', tone: 'good' },
            { text: 'Callers edited', value: '0', tone: 'good' },
            { text: 'Inside: float', value: 'integer cents', tone: 'muted' },
            { text: 'Raw public field', value: 'needs a reason', tone: 'warn' },
          ],
          footer: { text: 'Hidden detail, free change', tone: 'good' },
        },
        caption: 'Internals change, callers do not',
      },
    },
    // 7
    {
      title: 'Copy-paste',
      tag: 'problem',
      heading: 'Inheritance missing: the same method pasted three times',
      eli5: 'Three toy animals each carry a hand-drawn copy of the same sewing label. When the label changes, someone has to redo all three by hand, and one always gets missed.',
      body: [
        '`EmailNotifier`, `SMSNotifier` and `PushNotifier` all start with the same `format_header()` and the same send wrapper, pasted into each class.',
        'Change the greeting and you edit three places. Miss one and customers get different headers depending on the channel. Copy-paste is shared behavior with no home.',
      ],
      keyIdea: 'When you paste a method into three classes, you need shared behavior.',
      metrics: { edits: '3 copies', ifs: '-', tests: '-', open: '-' },
      metricTones: { edits: 'bad' },
      scene: {
        nodes: [
          blk('email', at(-3.6, 0), 'EmailNotifier', 'concrete', 'green', 'Mail', { chips: [{ text: 'format_header()', tone: 'warn' }] }),
          blk('sms', at(0, 0), 'SMSNotifier', 'concrete', 'green', 'Smartphone', { chips: [{ text: 'format_header()', tone: 'warn' }] }),
          blk('push', at(3.6, 0), 'PushNotifier', 'concrete', 'green', 'Signal', { chips: [{ text: 'format_header()', tone: 'warn' }] }),
        ],
        links: [link('email', 'sms', { label: 'copy', labelTone: 'warn' }), link('sms', 'push', { label: 'copy', labelTone: 'warn' })],
        flows: [
          { path: ['email', 'sms'], tone: 'error', label: 'copy-paste', duration: 1.2 },
          { path: ['sms', 'push'], tone: 'error', label: 'copy-paste', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Greeting change',
          icon: 'Copy',
          code: 'def format_header(self, user):\n    return (f"Hi {user.name}, this is "\n            "a notification from Acme Corp.")\n\n# same 3 lines in 3 classes',
          footer: { text: 'Miss one copy and channels disagree', tone: 'bad' },
        },
        caption: 'One method, three copies',
      },
    },
    // 8
    {
      title: 'Share it',
      tag: 'concept',
      heading: 'Inherit: share, do not copy',
      eli5: 'Now every animal uses one **base** sewing pattern pinned to the wall. Each animal adds only its own parts, like the ears or the tail.',
      body: [
        '**Inheritance** says class B is a specialized kind of class A and gets its capabilities by default. Move the shared method into a `Notifier` base class.',
        'Each subclass overrides only `send()`. `PushNotifier` follows the same pattern as the two shown. Edit the header once and all three channels change.',
      ],
      keyIdea: 'Inheritance shares behavior between classes that are really kinds of the same thing.',
      metrics: { edits: '1', ifs: '-', tests: '-', open: '-' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [
          { ...notifier, chips: ['format_header()', 'send() abstract'] },
          blk('email', at(-3.6, 3.8), 'EmailNotifier', 'extends', 'green', 'Mail', { status: 'active' }),
          blk('sms', at(0, 3.8), 'SMSNotifier', 'extends', 'green', 'Smartphone'),
          blk('push', at(3.6, 3.8), 'PushNotifier', 'extends', 'green', 'Signal'),
        ],
        links: [link('email', 'notifier', { label: 'extends' }), link('sms', 'notifier', { label: 'extends' }), link('push', 'notifier', { label: 'extends' })],
        flows: [
          { path: ['email', 'notifier'], tone: 'request', label: 'format_header()', duration: 1.4 },
          { path: ['notifier', 'email'], tone: 'response', label: 'Hi Ana, ...', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Shared once, overridden per channel',
          icon: 'Layers',
          code: 'class Notifier:\n    def format_header(self, user): ...\n    def send(self, user, body):\n        raise NotImplementedError\n\nclass EmailNotifier(Notifier):\n    def send(self, user, body): ...',
          footer: { text: 'Header lives in one place', tone: 'good' },
        },
        caption: 'Subclasses reuse the base',
      },
      code: {
        language: 'python',
        title: 'A shared base class',
        source: `class Notifier:
    def format_header(self, user):
        return f"Hi {user.name}, this is a notification from Acme Corp."

    def send(self, user, body):
        raise NotImplementedError


class EmailNotifier(Notifier):
    def send(self, user, body):
        print("[email]", self.format_header(user), body)


class SMSNotifier(Notifier):
    def send(self, user, body):
        print("[sms]", self.format_header(user), body)


class PushNotifier(Notifier):
    def send(self, user, body):
        print("[push]", self.format_header(user), body)`,
        highlight: [2, 3, 10, 11, 16],
      },
    },
    // 9
    {
      title: 'Is-a or has-a',
      tag: 'tradeoff',
      heading: 'The inheritance trap: prefer composition',
      eli5: 'A toy car is not a battery, but it has a battery inside. If it is "a kind of", use the family pattern. If it "has a", put the thing inside. That is **composition**.',
      body: [
        'Inheritance is the most over-used pillar. Use it only when the relationship is truly "X is a kind of Y". `EmailNotifier` is a `Notifier`.',
        'It is not an SMTP client. It has one. Hold the client as a field and call it. This is **composition**, and it stays flexible: you can swap the client without touching the class tree.',
        'The client is passed in through the constructor, so a test can hand in a fake one. That sets up the abstraction step later, where depending on a concrete client becomes the problem to fix.',
      ],
      keyIdea: 'If it is not truly "is a kind of", use "has a": hold it as a field.',
      metrics: { edits: '1', ifs: '-', tests: '-', open: '-' },
      scene: {
        nodes: [
          { ...notifier, at: P1 },
          blk('email', P2, 'EmailNotifier', 'concrete', 'green', 'Mail', { status: 'active' }),
          blk('smtp', P3, 'SmtpClient', 'external', 'gray', 'Cable'),
        ],
        links: [link('email', 'notifier', { label: 'extends' }), link('email', 'smtp', { label: 'has-a' })],
        flows: [{ path: ['email', 'smtp'], tone: 'request', label: 'client.send(msg)', duration: 1.4 }],
        panel: {
          title: 'Is-a versus has-a',
          icon: 'Table',
          rows: [
            { text: 'EmailNotifier is a Notifier', value: 'extends', tone: 'good' },
            { text: 'EmailNotifier has an SmtpClient', value: 'field', tone: 'good' },
            { text: 'EmailNotifier extends SmtpClient', value: 'wrong', tone: 'bad' },
          ],
          footer: { text: 'We revisit this in the Strategy pattern', tone: 'muted' },
        },
        caption: 'Extend for kinds, hold for parts',
      },
      code: {
        language: 'python',
        title: 'Composition: hold the collaborator',
        source: `class EmailNotifier(Notifier):  # is-a Notifier
    def __init__(self, client):
        self._client = client       # has-a SmtpClient

    def send(self, user, body):
        msg = self.format_header(user) + "\\n" + body
        self._client.send(user.email, msg)`,
        highlight: [1, 3, 7],
      },
      quiz: {
        question: 'EmailNotifier needs to send through an SMTP client. What is the best relationship?',
        options: [
          'EmailNotifier extends SmtpClient, to reuse its methods',
          'EmailNotifier holds an SmtpClient as a field',
          'Copy the SmtpClient methods into EmailNotifier',
          'Make SmtpClient a global that everything imports',
        ],
        answer: 1,
        explain: 'A notifier is not an SMTP client, it uses one. Holding it as a field is composition, so you can swap the client without reshaping the class tree.',
      },
    },
    // 10
    {
      title: 'Type sniffing',
      tag: 'problem',
      heading: 'Polymorphism missing: if/elif on type',
      eli5: 'The shopkeeper checks every toy tag one by one: if it is a ball, do this, if it is a block, do that. A new toy means a new tag check, forever.',
      body: [
        '`area(shape)` takes a dictionary and branches on its `kind`: circle, square, triangle. It works for three shapes.',
        'Add a hexagon and you edit `area()`. Add a perimeter function and it needs the same chain. Every new type touches every function that sniffs types.',
      ],
      keyIdea: 'A chain of type checks must be edited for every new type, forever.',
      metrics: { edits: '1 + every chain', ifs: '3', tests: '-', open: '-' },
      metricTones: { ifs: 'bad', edits: 'warn' },
      scene: {
        nodes: [
          caller,
          blk('area', P2, 'area(shape)', 'if / elif chain', 'gray', 'Split', {
            status: 'hot',
            chips: [{ text: 'kind == circle', tone: 'warn' }, { text: 'kind == square', tone: 'warn' }, { text: 'kind == triangle', tone: 'warn' }],
          }),
          blk('hexagon', P3, 'Hexagon', 'new shape', 'gray', 'Star', { badge: 'edit area()' }),
        ],
        links: [link('caller', 'area', { label: 'uses' }), link('hexagon', 'area', { label: 'forces an edit', labelTone: 'warn' })],
        flows: [
          { path: ['caller', 'area'], tone: 'request', label: 'area(shape)', duration: 1.2 },
          { path: ['hexagon', 'area'], tone: 'error', label: 'unknown kind', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Type-sniffing',
          icon: 'Code',
          code: 'def area(shape):\n    if shape["kind"] == "circle":\n        return 3.14159 * shape["r"] ** 2\n    elif shape["kind"] == "square":\n        return shape["side"] ** 2\n    elif shape["kind"] == "triangle":\n        return 0.5 * shape["base"] * shape["height"]',
        },
        caption: 'The caller asks what it is, then decides',
      },
    },
    // 11
    {
      title: 'Same call',
      tag: 'concept',
      heading: 'Polymorphism: one call, each object answers',
      eli5: 'Every toy now has the same **play** button. Press it and the ball bounces, the block stacks, the drum drums. The kid never asks which toy it is.',
      body: [
        '**Polymorphism** means callers use a common interface and the object decides what actually runs. `Shape` declares `area()`. `Circle`, `Square` and `Triangle` each implement it.',
        'The caller calls `s.area()` and never checks a type. The `if/elif` chain is gone because the objects carry their own behavior.',
        'Python also allows duck typing: any object with an `area()` method works, with no base class. The ABC makes the contract explicit and enforced, because a subclass that forgets `area()` fails at creation.',
      ],
      keyIdea: 'Callers use the common contract. The object decides what runs.',
      metrics: { ifs: '0', edits: '-', tests: '-', open: '-' },
      metricTones: { ifs: 'good' },
      scene: {
        nodes: [caller, { ...shape, chips: ['area() abstract'] }, circle, square, triangle],
        links: [
          link('caller', 'shape', { label: 'uses' }),
          link('circle', 'shape', { label: 'extends' }),
          link('square', 'shape', { label: 'extends' }),
          link('triangle', 'shape', { label: 'extends' }),
        ],
        flows: [
          { path: ['caller', 'shape', 'circle'], tone: 'request', label: 'area()', duration: 1.6 },
          { path: ['caller', 'shape', 'square'], tone: 'request', label: 'area()', duration: 1.6, delay: 1.7 },
          { path: ['caller', 'shape', 'triangle'], tone: 'request', label: 'area()', duration: 1.6, delay: 3.4 },
        ],
        panel: {
          title: 'The caller stays unaware',
          icon: 'Split',
          code: 'shapes = [Circle(3), Square(4),\n          Triangle(5, 6)]\ntotal = sum(s.area() for s in shapes)',
          footer: { text: 'No type check anywhere', tone: 'good' },
        },
        caption: 'Same message, different behavior',
      },
      code: {
        language: 'python',
        title: 'Polymorphic dispatch',
        source: `from abc import ABC, abstractmethod
import math


class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...


class Circle(Shape):
    def __init__(self, r): self.r = r
    def area(self): return math.pi * self.r ** 2


class Square(Shape):
    def __init__(self, side): self.side = side
    def area(self): return self.side ** 2


class Triangle(Shape):
    def __init__(self, b, h): self.b, self.h = b, h
    def area(self): return 0.5 * self.b * self.h`,
        highlight: [5, 6, 7, 12, 16, 20],
      },
    },
    // 12
    {
      title: 'New shape',
      tag: 'case',
      heading: 'Adding a shape means adding one class',
      eli5: 'A new toy arrives with its own play button. The kid presses it the same way and nothing else in the shop needs changing.',
      body: [
        'Now the hexagon arrives. Write `Hexagon(Shape)` with its own `area()`. The caller, `Circle` and every other class stay exactly as they were.',
        'This is why polymorphism pays off: new behavior arrives as a new class, and existing code does not change.',
      ],
      keyIdea: 'A new type is a new class. No existing code changes.',
      metrics: { ifs: '0', edits: '1', tests: '-', open: '-' },
      metricTones: { ifs: 'good', edits: 'good' },
      scene: {
        nodes: [
          { ...caller, status: 'dim' },
          { ...shape, chips: ['area() abstract'] },
          { ...circle, status: 'dim' },
          blk('hexagon', P3, 'Hexagon', 'new, extends', 'green', 'Package', { status: 'active', badge: 'new file' }),
        ],
        links: [link('caller', 'shape', { label: 'unchanged' }), link('circle', 'shape', { label: 'extends' }), link('hexagon', 'shape', { label: 'extends' })],
        flows: [{ path: ['caller', 'shape', 'hexagon'], tone: 'request', label: 'area()', duration: 1.6 }],
        panel: {
          title: 'The whole change',
          icon: 'FileCode',
          code: 'class Hexagon(Shape):\n    def __init__(self, side):\n        self.side = side\n\n    def area(self):\n        return 1.5 * 3 ** 0.5 * self.side ** 2',
          footer: { text: 'Callers untouched', tone: 'good' },
        },
        caption: 'Open for new shapes, closed for edits',
      },
    },
    // 13
    {
      title: 'Hard-wired',
      tag: 'problem',
      heading: 'Abstraction missing: the caller knows the concrete tool',
      eli5: 'The till is glued to one real coin machine. To practice ringing up toys, the shopkeeper has to use real money and wait for the real machine.',
      body: [
        '`Checkout.charge()` imports the Stripe SDK and calls `stripe.Charge.create()` directly. Stripe is hard-coded forever.',
        'Now write a unit test for `Checkout`. It hits Stripe over the network, needs live keys and can charge real money. Good luck.',
      ],
      keyIdea: 'A class that names its concrete dependency cannot be tested or swapped.',
      metrics: { edits: '-', ifs: '-', tests: 'Needs network', open: '-' },
      metricTones: { tests: 'bad' },
      scene: {
        nodes: [
          blk('test', P1, 'Unit test', 'wants speed', 'green', 'Bug', { status: 'hot' }),
          blk('checkout', P2, 'Checkout', 'imports stripe', 'green', 'ShoppingBag'),
          blk('stripe-ext', P3, 'Stripe SDK', 'network call', 'gray', 'Globe'),
        ],
        links: [link('test', 'checkout', { label: 'calls' }), link('checkout', 'stripe-ext', { label: 'uses (hard-coded)', labelTone: 'warn' })],
        flows: [
          { path: ['test', 'checkout'], tone: 'request', label: 'pay(1000)', duration: 1.2 },
          { path: ['checkout', 'stripe-ext'], tone: 'request', label: 'Charge.create', duration: 1.2, delay: 1.3 },
          { path: ['stripe-ext', 'checkout', 'test'], tone: 'error', label: 'no network', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Hard-coded to Stripe',
          icon: 'Code',
          code: 'import stripe\n\nclass Checkout:\n    def charge(self, amount, token):\n        stripe.Charge.create(\n            amount=amount, source=token,\n            currency="usd")',
          footer: { text: 'No test without Stripe', tone: 'bad' },
        },
        caption: 'The test drags in the real network',
      },
    },
    // 14
    {
      title: 'The contract',
      tag: 'concept',
      heading: 'Abstract: program to a concept, not a thing',
      eli5: 'The till now has a **coin slot** of one shape. Any machine that fits the slot works, the real one or a pretend one made of cardboard.',
      body: [
        '**Abstraction** exposes what something does and hides how. Define a `PaymentGateway` interface with one method, `charge()`.',
        '`StripeGateway` and `FakeGateway` both implement it. `Checkout` holds a `PaymentGateway` and knows nothing else about who is behind it.',
      ],
      keyIdea: 'Depend on the interface. The implementation behind it can change.',
      metrics: { edits: '-', ifs: '-', tests: 'Yes', open: '-' },
      metricTones: { tests: 'good' },
      scene: {
        nodes: [
          { ...checkout, sub: 'depends on interface' },
          { ...gateway, chips: ['charge(amount, token)'] },
          stripeImpl,
          fakeImpl,
        ],
        links: [
          link('checkout', 'gateway', { label: 'has-a' }),
          link('stripe', 'gateway', { label: 'implements' }),
          link('fake', 'gateway', { label: 'implements' }),
        ],
        flows: [
          { path: ['checkout', 'gateway'], tone: 'request', label: 'charge()', duration: 1.2 },
          { path: ['gateway', 'stripe'], tone: 'request', label: 'charge()', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The contract',
          icon: 'Plug',
          code: 'class PaymentGateway(ABC):\n    @abstractmethod\n    def charge(self, amount: int,\n               token: str) -> str: ...',
          footer: { text: 'What it does, not how', tone: 'good' },
        },
        caption: 'Checkout sees only the interface',
      },
      code: {
        language: 'python',
        title: 'Depend on an abstract interface',
        source: `from abc import ABC, abstractmethod


class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, amount: int, token: str) -> str: ...


class StripeGateway(PaymentGateway):
    def charge(self, amount, token):
        # real Stripe call here
        return "stripe_txn_123"


class FakeGateway(PaymentGateway):
    def charge(self, amount, token):
        return "fake_txn_" + token


class Checkout:
    def __init__(self, gateway: PaymentGateway):
        self.gateway = gateway

    def pay(self, amount, token):
        return self.gateway.charge(amount, token)`,
        highlight: [4, 5, 6, 10, 16, 21, 22],
      },
    },
    // 15
    {
      title: 'Swap it',
      tag: 'case',
      heading: 'Pass the implementation in: prod versus test',
      eli5: 'On a busy day the till is hooked to the real coin machine. For practice, the shopkeeper clips on the cardboard one from outside. The till itself is never changed. That is **dependency injection**.',
      body: [
        'Because `Checkout` receives its gateway through the constructor, the caller picks the implementation. Production passes `StripeGateway`. A test passes `FakeGateway`.',
        'The test runs in microseconds, with no network and no keys. `Checkout` is identical in both.',
      ],
      keyIdea: 'Inject the dependency, and swapping it costs nothing.',
      metrics: { edits: '0', ifs: '-', tests: 'Yes', open: '-' },
      metricTones: { tests: 'good', edits: 'good' },
      scene: {
        nodes: [
          { ...checkout, sub: 'unchanged' },
          gateway,
          { ...stripeImpl, status: 'dim' },
          { ...fakeImpl, status: 'active', badge: 'in tests' },
        ],
        links: [
          link('checkout', 'gateway', { label: 'has-a' }),
          link('stripe', 'gateway', { label: 'implements' }),
          link('fake', 'gateway', { label: 'implements' }),
        ],
        flows: [
          { path: ['checkout', 'gateway', 'fake'], tone: 'request', label: 'charge(1000, tok_test)', duration: 1.8 },
          { path: ['fake', 'gateway', 'checkout'], tone: 'response', label: 'fake_txn_tok_test', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Two wirings, one Checkout',
          icon: 'Cable',
          code: '# prod\nCheckout(StripeGateway()).pay(\n    1000, "tok_live")\n\n# test\nCheckout(FakeGateway()).pay(\n    1000, "tok_test")',
          footer: { text: 'Caller chooses, Checkout never knows', tone: 'good' },
        },
        caption: 'Same Checkout, different gateway',
      },
    },
    // 16
    {
      title: 'Three kinds',
      tag: 'concept',
      heading: 'Interface, abstract class, concrete class',
      eli5: 'A slot drawn on paper is just a shape. A half-built toy has the slot and some real pieces. A finished toy works right away. You cannot play with a drawing.',
      body: [
        'An **interface** is a contract with no code, like `PaymentGateway`. An **abstract class** adds shared code, like `Notifier.format_header()`. A **concrete class** is complete and can be created.',
        'In Python, trying to create a class with an unimplemented `@abstractmethod` raises `TypeError`. The contract is enforced when you build the object.',
      ],
      keyIdea: 'Contracts are abstract. Only concrete classes are ever instantiated.',
      metrics: { edits: '-', ifs: '-', tests: '-', open: '-' },
      scene: {
        nodes: [
          blk('gateway', at(-3.6, -3.8), 'PaymentGateway', 'interface', 'violet', 'Plug'),
          blk('notifier', at(3.6, -3.8), 'Notifier', 'abstract class', 'blue', 'Layers'),
          blk('stripe', at(-3.6, 3.8), 'StripeGateway', 'concrete', 'green', 'Package'),
          blk('email', at(3.6, 3.8), 'EmailNotifier', 'concrete', 'green', 'Mail'),
        ],
        links: [link('stripe', 'gateway', { label: 'implements' }), link('email', 'notifier', { label: 'extends' })],
        flows: [
          { path: ['stripe', 'gateway'], tone: 'request', label: 'charge()', duration: 1.4 },
          { path: ['email', 'notifier'], tone: 'request', label: 'format_header()', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'What each one holds',
          icon: 'Table',
          rows: [
            { text: 'Interface', value: 'contract only', tone: 'default' },
            { text: 'Abstract class', value: 'contract + shared code', tone: 'default' },
            { text: 'Concrete class', value: 'complete, can be created', tone: 'good' },
            { text: 'Shape()', value: 'TypeError', tone: 'bad' },
          ],
          footer: { text: 'Abstract types cannot be built', tone: 'muted' },
        },
        caption: 'Violet, blue, green in this course',
      },
    },
    // 17
    {
      title: 'Leaky',
      tag: 'case',
      heading: 'When an abstraction leaks',
      eli5: 'If the till tells every kid "sorry, the red light on the Stripe machine is on", kids learn about machines they should never see. The slot should speak only shop words.',
      body: [
        'Rule of thumb: if a change in how something works forces a change in who uses it, the abstraction is leaking.',
        '`Checkout` catches `stripe.CardError`. A new `PayPalGateway` raises its own error, and `Checkout` has to change. The gateway should translate failures into one of its own, like `PaymentDeclined`.',
      ],
      keyIdea: 'A good abstraction speaks its own words and hides the implementation vocabulary.',
      metrics: { edits: '2', ifs: '-', tests: 'Yes', open: '-' },
      metricTones: { edits: 'bad' },
      scene: {
        nodes: [
          { ...checkout, status: 'hot', chips: [{ text: 'except stripe.CardError', tone: 'bad' }] },
          { ...gateway, chips: ['charge()'] },
          stripeImpl,
          { ...paypal, at: at(1.8, 3.8), label: 'PayPalGateway', sub: 'new', badge: 'PayPalError' },
        ],
        links: [
          link('checkout', 'gateway', { label: 'has-a' }),
          link('stripe', 'gateway', { label: 'implements' }),
          link('paypal', 'gateway', { label: 'implements' }),
        ],
        flows: [
          { path: ['paypal', 'gateway', 'checkout'], tone: 'error', label: 'PayPalError', duration: 1.8 },
        ],
        panel: {
          title: 'Leaky versus clean',
          icon: 'Shield',
          code: '# leaky: caller knows Stripe\nexcept stripe.CardError: ...\n\n# clean: gateway translates\nexcept PaymentDeclined: ...',
          footer: { text: 'Translate errors at the boundary', tone: 'good' },
        },
        caption: 'The vendor vocabulary escaped',
      },
      quiz: {
        question: 'Checkout catches stripe.CardError. A new PayPalGateway raises PayPalError and Checkout breaks. What went wrong?',
        options: [
          'PayPal should have raised stripe.CardError too',
          'Checkout needs another except clause for each gateway',
          'The abstraction leaks: the gateway should raise its own PaymentDeclined',
          'Interfaces cannot raise errors',
        ],
        answer: 2,
        explain: 'Checkout learned how Stripe fails, so a change in how a gateway works forced a change in its user. Each gateway should translate its failures into the interface\'s own error.',
      },
    },
    // 18
    {
      title: 'Together',
      tag: 'case',
      heading: 'Back to the payment class: all four at work',
      eli5: 'The shop now uses all four tricks: a lid on each piggy bank, a base pattern, one play button, and a slot for any coin machine. New coin, new toy, nothing else changes.',
      body: [
        '`Checkout` depends on a `PaymentMethod` interface (abstraction). Each method is its own class that guards its own data (encapsulation) and answers `pay()` its own way (polymorphism).',
        'Apple Pay is one new file. No `if`, no edits to `Checkout`. That is the test from step 2, and it passes.',
      ],
      keyIdea: 'The pillars work as a set: abstraction names the seam, polymorphism fills it.',
      metrics: { edits: '1', ifs: '0', tests: 'Yes', open: '0' },
      metricTones: { edits: 'good', ifs: 'good', tests: 'good', open: 'good' },
      scene: {
        nodes: [
          { ...checkout, sub: 'unchanged' },
          { ...method, chips: ['pay(amount)'] },
          card,
          paypal,
          { ...applepay, status: 'active', badge: 'new file' },
        ],
        links: [
          link('checkout', 'method', { label: 'has-a' }),
          link('card', 'method', { label: 'implements' }),
          link('paypal', 'method', { label: 'implements' }),
          link('applepay', 'method', { label: 'implements' }),
        ],
        flows: [{ path: ['checkout', 'method', 'applepay'], tone: 'request', label: 'pay(1000)', duration: 1.8 }],
        panel: {
          title: 'Who does what',
          icon: 'List',
          rows: [
            { text: 'Abstraction', value: 'PaymentMethod', tone: 'good' },
            { text: 'Polymorphism', value: 'pay() per class', tone: 'good' },
            { text: 'Encapsulation', value: 'card data stays inside', tone: 'good' },
            { text: 'Inheritance', value: 'optional shared base', tone: 'muted' },
          ],
          footer: { text: 'Apple Pay = 1 new file', tone: 'good' },
        },
        caption: 'Adding, not editing',
      },
      code: {
        language: 'python',
        title: 'The redesign in 20 lines',
        source: `from abc import ABC, abstractmethod


class PaymentMethod(ABC):
    @abstractmethod
    def pay(self, amount: int) -> str: ...


class CardPayment(PaymentMethod):
    def __init__(self, number: str):
        self._number = number  # encapsulated

    def pay(self, amount):
        return f"card ****{self._number[-4:]} charged {amount}"


class PayPalPayment(PaymentMethod):
    def pay(self, amount):
        return f"paypal charged {amount}"


class Checkout:
    def __init__(self, method: PaymentMethod):
        self.method = method

    def pay(self, amount):
        return self.method.pay(amount)`,
        highlight: [4, 5, 11, 14, 24],
      },
    },
    // 19
    {
      title: 'Failure modes',
      tag: 'tradeoff',
      heading: 'Each pillar has a failure mode',
      eli5: 'Every trick can be overdone: lids with a hundred buttons, a family tree ten levels deep, play buttons that secretly check which toy it is, and slots nobody ever uses.',
      body: [
        'Encapsulation goes wrong when getters and setters expose every field anyway. Inheritance goes wrong when the relationship is not truly "is a" or the tree gets deep. Python allows multiple inheritance, and deep or multiple trees invite the diamond problem, where two parents share a grandparent and the method order gets confusing.',
        'Polymorphism goes wrong when `isinstance` checks creep back in. Abstraction goes wrong when it leaks, or when you build a plugin framework before the second plugin exists.',
      ],
      keyIdea: 'Use the pillars to remove pain you can see, not to decorate code.',
      metrics: { edits: '-', ifs: '-', tests: '-', open: '-' },
      scene: {
        nodes: pillars({
          'p-enc': { status: 'hot', chips: [{ text: 'getters for all', tone: 'warn' }] },
          'p-inh': { status: 'hot', chips: [{ text: 'deep trees', tone: 'warn' }] },
          'p-pol': { status: 'hot', chips: [{ text: 'isinstance()', tone: 'warn' }] },
          'p-abs': { status: 'hot', chips: [{ text: 'leaks, unused', tone: 'warn' }] },
        }),
        panel: {
          title: 'Rules of thumb',
          icon: 'Scale',
          rows: [
            { text: 'Encapsulation', value: 'default, expose with a reason', tone: 'good' },
            { text: 'Inheritance', value: 'only for true is-a', tone: 'warn' },
            { text: 'Polymorphism', value: 'no type checks in callers', tone: 'good' },
            { text: 'Abstraction', value: 'wait for the 2nd implementation', tone: 'warn' },
          ],
          footer: { text: 'Every speculative abstraction is a bet', tone: 'muted' },
        },
        caption: 'Four tools, four ways to overuse them',
      },
    },
    // 20
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: four pillars, one goal',
      eli5: 'Keep the gears inside the toy, share what is shared, give every toy the same play button, and put a slot where something might change. Then new toys never break the shop.',
      body: [
        '**Encapsulation** protects invariants and frees internals. **Inheritance** shares behavior between true kinds, with composition as the default for parts. **Polymorphism** removes type checks. **Abstraction** lets you depend on what, not how.',
        'The goal is code that survives change: a new payment method is one new file.',
      ],
      keyIdea: 'Design so change is added, not edited in.',
      metrics: { edits: '1', ifs: '0', tests: 'Yes', open: '0' },
      metricTones: { edits: 'good', ifs: 'good', tests: 'good', open: 'good' },
      scene: {
        nodes: pillars({
          'p-enc': { status: 'ok' },
          'p-inh': { status: 'ok' },
          'p-pol': { status: 'ok' },
          'p-abs': { status: 'ok' },
        }),
        panel: {
          title: 'Keep this',
          icon: 'List',
          rows: [
            { text: 'Public field', value: 'a forever promise' },
            { text: 'Copy-paste', value: 'needs a base class' },
            { text: 'Type if-chain', value: 'needs polymorphism' },
            { text: 'Concrete import', value: 'needs an interface' },
          ],
          footer: { text: 'Each smell points to a pillar', tone: 'good' },
        },
        caption: 'Four pillars, one test: add, do not edit',
      },
      quiz: {
        question: 'Apple Pay must be added without editing Checkout. Which pillars make that possible together?',
        options: [
          'Encapsulation only, because it hides the card data',
          'Abstraction and polymorphism: Checkout depends on an interface, and each method answers pay() its own way',
          'Inheritance only, because every method extends Checkout',
          'None of them, adding a method always edits Checkout',
        ],
        answer: 1,
        explain: 'Checkout holds a PaymentMethod interface (abstraction). Each new class fills it and answers pay() in its own way (polymorphism), so Checkout never changes.',
      },
    },
  ],
};
