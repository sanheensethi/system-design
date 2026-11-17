import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const blk = (id: string, label: string, sub: string, tint: Tint, icon: string, pos: [number, number], extra: Partial<SceneNode> = {}): SceneNode => ({
  id,
  kind: 'block',
  at: pos,
  label,
  sub,
  tint,
  icon,
  ...extra,
});
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...(label ? { label } : {}), ...extra });

// Class diagram cast. Interfaces are violet, abstract classes blue, concrete classes green, outside systems gray.
const checkout = blk('checkout', 'Checkout', 'concrete class', 'green', 'ShoppingBag', at(-3.8, -3.8));
const gateway = blk('gateway', 'PaymentGateway', 'interface', 'violet', 'Plug', at(0, -3.8));
const stripe = blk('stripe', 'StripeGateway', 'concrete class', 'green', 'Server', at(-3.6, 3.8), { size: 0.72 });
const fake = blk('fake', 'FakeGateway', 'concrete class', 'green', 'Bug', at(3.6, 3.8), { size: 0.72 });

export const lldUml: Lesson = {
  id: 'lld-uml',
  title: 'UML class and sequence diagrams (part 1)',
  tagline: 'Part 1: the class diagram. Boxes, visibility, interfaces and the arrows that say who knows whom.',
  minutes: 11,
  level: 'Beginner',
  learn: [
    'The parts of a class box: name, attributes, methods and visibility',
    'Interfaces, abstract classes, extends and implements',
    'Association, aggregation, composition, dependency and how to pick the arrow',
    'Turning code and a written spec into a class diagram, and back',
    'How much detail to draw, and the extends arrow that lies',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'links', label: 'Relationships', icon: 'Share2' },
    { key: 'msgs', label: 'Messages', icon: 'Repeat' },
    { key: 'view', label: 'View', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'Words fail',
      tag: 'problem',
      heading: 'Three engineers, one sentence, three different designs',
      eli5: 'Three kids describe the same toy robot in words. One says it holds a battery, one says it builds a battery, one says it is a battery. They need a drawing everyone reads the same way.',
      body: [
        'In a design review someone says "`Checkout` uses the payment gateway". One engineer hears that it holds a gateway for its whole life. Another hears that it creates one per payment. A third hears that it is a gateway.',
        'Each reading leads to different code and different tests. Prose hides the difference. A **diagram** with agreed symbols makes it visible.',
      ],
      keyIdea: 'Plain sentences leave the relationship between two classes open to interpretation. A fixed notation closes it.',
      metrics: { classes: '3', links: '?', msgs: '?', view: 'prose' },
      metricTones: { links: 'bad' },
      scene: {
        nodes: [
          { ...checkout, chips: [{ text: '"uses the gateway"', tone: 'warn' }] },
          { ...gateway, tint: 'gray', status: 'hot', badge: '3 readings' },
          { ...stripe, tint: 'gray', sub: '?' },
        ],
        links: [link('checkout', 'gateway', 'uses?', { labelTone: 'warn' }), link('stripe', 'gateway', 'is?', { labelTone: 'warn' })],
        flows: [
          { path: ['checkout', 'gateway'], tone: 'error', label: 'holds? creates?', duration: 1.6 },
          { path: ['stripe', 'gateway'], tone: 'error', label: 'extends?', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One sentence, three codebases',
          icon: 'FileText',
          rows: [
            { text: 'Holds one for its whole life', value: 'field', tone: 'warn' },
            { text: 'Creates one per payment', value: 'local variable', tone: 'warn' },
            { text: 'Is a kind of gateway', value: 'inheritance', tone: 'warn' },
          ],
          footer: { text: 'Same words, different code', tone: 'bad' },
        },
        caption: 'Prose cannot pin a relationship down',
      },
    },
    {
      title: 'Two views',
      tag: 'concept',
      heading: 'UML gives you two drawings: what exists and what happens',
      eli5: 'A toy shop keeps two papers. One is the **blueprint sheet**, showing which parts exist and how they plug together. The other is a comic strip showing who passes what to whom while the toy runs.',
      body: [
        '**UML** is a standard set of diagram types. Two of them cover almost every low level design discussion.',
        'A **class diagram** is the structure: classes, interfaces and the relationships between them. A **sequence diagram** is the behavior: which objects send which messages, in order, for one scenario. UML has more types (state, activity), and you rarely need them to start.',
      ],
      keyIdea: 'A class diagram shows what the code is made of. A sequence diagram shows what one run of it does.',
      metrics: { classes: '-', links: '-', msgs: '-', view: 'structure + behavior' },
      scene: {
        nodes: [
          blk('cd', 'Class diagram', 'structure', 'violet', 'Boxes', at(-3.8, -3.2)),
          blk('sd', 'Sequence diagram', 'behavior', 'blue', 'Repeat', at(3.8, -3.2)),
          blk('code', 'The code', 'one truth', 'green', 'FileCode', at(0, 3.4)),
        ],
        links: [link('cd', 'code', 'what exists'), link('sd', 'code', 'what runs')],
        flows: [
          { path: ['cd', 'code'], tone: 'request', label: 'classes, fields', duration: 1.5 },
          { path: ['sd', 'code'], tone: 'event', label: 'method calls', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Which one answers what',
          icon: 'Layers',
          rows: [
            { text: 'Who knows whom?', value: 'class diagram' },
            { text: 'What can each class do?', value: 'class diagram' },
            { text: 'Who calls whom, in what order?', value: 'sequence diagram' },
            { text: 'What happens when payment fails?', value: 'sequence diagram' },
          ],
          footer: { text: 'Draw structure first, then one scenario', tone: 'muted' },
        },
        caption: 'Two drawings of the same code',
      },
    },
    {
      title: 'Class box',
      tag: 'concept',
      heading: 'A class is a box with three compartments',
      eli5: 'Every toy **blueprint** has the same three boxes on it: the name of the toy at the top, the parts it keeps inside in the middle, and the things it can do at the bottom.',
      body: [
        'A class box stacks three compartments. The top holds the **name**. The middle holds the **attributes** (the fields the object remembers). The bottom holds the **operations** (the methods it can run).',
        'Each attribute reads `name: Type` and each method reads `name(param: Type): ReturnType`. Leave the lower compartments off when the details do not matter yet.',
      ],
      keyIdea: 'Name on top, state in the middle, behavior at the bottom. Every class box reads the same way.',
      metrics: { classes: '1', links: '0', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          { ...checkout, at: at(-2.5, 0), status: 'active', chips: ['name', 'attributes', 'methods'] },
          blk('order', 'Order', 'concrete class', 'green', 'Receipt', at(3.6, 0), { size: 0.72, status: 'dim' }),
        ],
        panel: {
          title: 'Checkout as a UML box',
          icon: 'Table',
          code: 'Checkout\n--------------------------\n- gateway: PaymentGateway\n- retries: int\n--------------------------\n+ pay(order: Order): Receipt\n+ refund(txn_id: str): bool',
          footer: { text: 'Hide compartments you do not need', tone: 'muted' },
        },
        caption: 'Three compartments, always in this order',
      },
      code: {
        language: 'python',
        title: 'The same class in code',
        source: `class Checkout:
    def __init__(self, gateway: PaymentGateway):
        self._gateway = gateway      # attribute: - gateway
        self._retries = 3            # attribute: - retries

    def pay(self, order: Order) -> Receipt:   # operation: + pay
        ...

    def refund(self, txn_id: str) -> bool:    # operation: + refund
        ...`,
        highlight: [3, 4, 6, 9],
      },
    },
    {
      title: 'Visibility',
      tag: 'concept',
      heading: 'Visibility marks say what the outside world may touch',
      eli5: 'A toy has buttons on the outside you may press, and a battery door you should leave shut. A little **plus** sign marks the buttons, and a little **minus** marks the battery door.',
      body: [
        'A symbol before each member sets its **visibility**: `+` public, `-` private, `#` protected (visible to subclasses), `~` package. Underline a member to show it is `static`.',
        'Visibility is where encapsulation shows on the diagram. Every `+` is a promise you keep. Every `-` is a detail you can change on a quiet afternoon.',
      ],
      keyIdea: 'Public members are promises. Private members are freedom. The diagram should show which is which.',
      metrics: { classes: '2', links: '1', msgs: '1', view: 'class' },
      scene: {
        nodes: [
          blk('client', 'Client code', 'outside caller', 'gray', 'Code', at(-4, 0), { size: 0.72 }),
          blk('account', 'BankAccount', 'concrete class', 'green', 'Receipt', at(2.4, 0), {
            status: 'active',
            chips: ['- _balance: float', '+ deposit(amt)', '+ withdraw(amt)'],
          }),
        ],
        links: [link('client', 'account', 'can reach +')],
        flows: [
          { path: ['client', 'account'], tone: 'request', label: 'deposit(50)', duration: 1.4 },
          { path: ['account', 'client'], tone: 'error', label: '_balance hidden', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Visibility symbols',
          icon: 'Shield',
          rows: [
            { text: '+ public', value: 'anyone', tone: 'good' },
            { text: '- private', value: 'this class only', tone: 'warn' },
            { text: '# protected', value: 'plus subclasses' },
            { text: '~ package', value: 'same module' },
            { text: 'underlined', value: 'static member', tone: 'muted' },
          ],
        },
        caption: 'The plus and minus signs are the API',
      },
      code: {
        language: 'python',
        title: 'Python has no keyword, so a leading underscore means private',
        source: `class BankAccount:
    def __init__(self):
        self._balance = 0.0          # - _balance: float

    def deposit(self, amount: float) -> None:    # + deposit
        if amount <= 0:
            raise ValueError("deposit must be positive")
        self._balance += amount

    @property
    def balance(self) -> float:      # + balance: float (read only)
        return self._balance`,
        highlight: [3, 5, 11],
      },
    },
    {
      title: 'Interfaces',
      tag: 'concept',
      heading: 'Interfaces and abstract classes get their own marks',
      eli5: 'An **interface** is a plug shape stamped on a toy shop shelf. It says what shape plugs in, and the shelf does not care which toy is on the other end.',
      body: [
        'An **interface** is a contract with no code: write `<<interface>>` above the name. An **abstract class** can hold some code but cannot be built on its own: write its name in italics, or add `{abstract}`. Abstract methods are italic too.',
        'A **concrete class** is a plain box. Use the stereotype `<<enumeration>>` for a fixed set of values such as `PaymentStatus`.',
      ],
      keyIdea: 'Interface, abstract class and concrete class are three different boxes. The label says which one you are looking at.',
      metrics: { classes: '3', links: '0', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          { ...gateway, at: at(-3.8, -1), status: 'active', chips: ['<<interface>>', 'charge(amount, token)'] },
          blk('notifier', 'Notifier', 'abstract class', 'blue', 'Mail', at(0, 3.4), { status: 'active', chips: ['{abstract}', 'send(user, body)'] }),
          { ...stripe, at: at(3.8, -1), size: 0.72, chips: ['charge(amount, token)'] },
        ],
        panel: {
          title: 'Three boxes, three marks',
          icon: 'Boxes',
          rows: [
            { text: '<<interface>> name', value: 'no code at all', tone: 'default' },
            { text: 'Name in italics', value: 'abstract class' },
            { text: 'Plain name', value: 'concrete class' },
            { text: '<<enumeration>>', value: 'fixed values', tone: 'muted' },
          ],
        },
        caption: 'Violet interface, blue abstract, green concrete',
      },
      code: {
        language: 'python',
        title: 'Both are written with ABC in Python',
        source: `from abc import ABC, abstractmethod

class PaymentGateway(ABC):           # <<interface>>: only abstract methods
    @abstractmethod
    def charge(self, amount: int, token: str) -> str: ...

class Notifier(ABC):                 # abstract class: some real code
    def format_header(self, user) -> str:
        return f"Hi {user.name}, a note from Acme Corp."

    @abstractmethod
    def send(self, user, body: str) -> None: ...   # italic in the box`,
        highlight: [3, 7, 11],
      },
    },
    {
      title: 'Extends',
      tag: 'concept',
      heading: 'Extends: a solid line and a hollow triangle',
      eli5: 'A **base blueprint** for "notification toy" has the greeting written once. The email toy and the text toy both start from it, and each adds its own way of delivering.',
      body: [
        '**Generalization** means "is a kind of". Draw a solid line with a hollow triangle at the parent end. `EmailNotifier` and `SMSNotifier` extend `Notifier`, so the shared header code lives once in the parent.',
        'Test the arrow with one question: is the child really a kind of the parent, in every place the parent is used? If the answer is only "it reuses some code", prefer a has-a link.',
      ],
      keyIdea: 'Extends means is-a. If the child cannot stand in for the parent everywhere, do not draw the triangle.',
      metrics: { classes: '3', links: '2', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          blk('notifier', 'Notifier', 'abstract class', 'blue', 'Mail', at(0, -3.8)),
          blk('email', 'EmailNotifier', 'concrete class', 'green', 'Mail', at(-3.6, 3.8), { size: 0.72, status: 'ok' }),
          blk('sms', 'SMSNotifier', 'concrete class', 'green', 'Signal', at(3.6, 3.8), { size: 0.72, status: 'ok' }),
        ],
        links: [link('email', 'notifier', 'extends'), link('sms', 'notifier', 'extends')],
        flows: [
          { path: ['email', 'notifier'], tone: 'request', label: 'format_header()', duration: 1.5 },
          { path: ['sms', 'notifier'], tone: 'request', label: 'format_header()', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Generalization',
          icon: 'Share2',
          rows: [
            { text: 'Line', value: 'solid' },
            { text: 'Arrow end', value: 'hollow triangle at parent' },
            { text: 'Read it as', value: 'is a kind of' },
            { text: 'Shared code lives in', value: 'the parent', tone: 'good' },
          ],
        },
        caption: 'The child points up at its parent',
      },
      code: {
        language: 'python',
        title: 'Shared header, separate delivery',
        source: `class EmailNotifier(Notifier):       # EmailNotifier --|> Notifier
    def send(self, user, body: str) -> None:
        print("[email]", self.format_header(user), body)

class SMSNotifier(Notifier):         # SMSNotifier --|> Notifier
    def send(self, user, body: str) -> None:
        print("[sms]", self.format_header(user)[:60], body)`,
        highlight: [1, 5],
      },
    },
    {
      title: 'Implements',
      tag: 'concept',
      heading: 'Implements: the same triangle on a dashed line',
      eli5: 'The plug shape on the shelf is only a drawing. The real toys that have that plug are connected to it with a dotted line, because the toys carry their own parts.',
      body: [
        '**Realization** means "promises to provide the contract". Draw a dashed line with a hollow triangle pointing at the interface. `StripeGateway` and `FakeGateway` both implement `PaymentGateway`.',
        'The dashed line is the quick way to tell implements from extends. An implementer inherits no code, only the obligation to supply every method. The caller sees the interface and never the class behind it.',
      ],
      keyIdea: 'A dashed line with a hollow triangle means implements. The arrow points at the contract.',
      metrics: { classes: '3', links: '2', msgs: '-', view: 'class' },
      scene: {
        nodes: [{ ...gateway }, { ...stripe, status: 'ok' }, { ...fake, status: 'ok' }],
        links: [link('stripe', 'gateway', 'implements', { style: 'dashed' }), link('fake', 'gateway', 'implements', { style: 'dashed' })],
        flows: [
          { path: ['stripe', 'gateway'], tone: 'handshake', label: 'charge() promised', duration: 1.5 },
          { path: ['fake', 'gateway'], tone: 'handshake', label: 'charge() promised', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Extends versus implements',
          icon: 'Table',
          rows: [
            { text: 'Extends (class to class)', value: 'solid, triangle' },
            { text: 'Implements (class to interface)', value: 'dashed, triangle' },
            { text: 'Code is inherited by', value: 'extends only', tone: 'warn' },
          ],
          footer: { text: 'Same head, different line', tone: 'muted' },
        },
        caption: 'Two classes promise one contract',
      },
      code: {
        language: 'python',
        title: 'Two implementations of one contract',
        source: `class StripeGateway(PaymentGateway):    # dashed: realizes the interface
    def charge(self, amount: int, token: str) -> str:
        # real Stripe call goes here
        return "stripe_txn_123"

class FakeGateway(PaymentGateway):      # dashed: realizes the same interface
    def charge(self, amount: int, token: str) -> str:
        return "fake_txn_" + token`,
        highlight: [1, 6],
      },
    },
    {
      title: 'Association',
      tag: 'concept',
      heading: 'Association: a plain arrow for "has a reference to"',
      eli5: 'A **customer card** in the toy shop points at the orders that customer made. One customer can have many orders, and each order points back at exactly one customer.',
      body: [
        'An **association** is a solid line, with an open arrowhead when only one side knows the other. It becomes a field in code. Write a **multiplicity** at each end: `1`, `0..1`, `*` (many) or `1..*` (at least one).',
        'A `Customer` places `0..*` `Order`s. An `Order` has `1..*` `LineItem`s. Multiplicity answers the question a list or a single field would settle in code.',
      ],
      keyIdea: 'An association is a stored reference. The numbers at each end say how many.',
      metrics: { classes: '3', links: '2', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          blk('customer', 'Customer', 'concrete class', 'green', 'Users', at(-5.1, 0), { size: 0.72 }),
          blk('order', 'Order', 'concrete class', 'green', 'Receipt', at(0, 0), { status: 'active' }),
          blk('item', 'LineItem', 'concrete class', 'green', 'Package', at(5.1, 0), { size: 0.72 }),
        ],
        links: [link('customer', 'order', '1  places  0..*', { route: 'straight' }), link('order', 'item', '1  has  1..*', { route: 'straight' })],
        flows: [
          { path: ['customer', 'order'], tone: 'data', label: 'orders: list', duration: 1.6 },
          { path: ['order', 'item'], tone: 'data', label: 'items: list', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Multiplicity',
          icon: 'Hash',
          rows: [
            { text: '1', value: 'exactly one' },
            { text: '0..1', value: 'optional' },
            { text: '*  (or 0..*)', value: 'any number' },
            { text: '1..*', value: 'at least one' },
          ],
        },
        caption: 'Arrows say who holds the reference',
      },
      code: {
        language: 'python',
        title: 'Each association is a field',
        source: `class Customer:
    def __init__(self, name: str):
        self.name = name
        self.orders: list[Order] = []       # Customer 1 --> 0..* Order

class Order:
    def __init__(self, items: list[LineItem]):
        assert len(items) >= 1               # Order 1 --> 1..* LineItem
        self.items = items`,
        highlight: [4, 8],
      },
    },
    {
      title: 'Whole and part',
      tag: 'concept',
      heading: 'Aggregation and composition: who owns the lifetime',
      eli5: 'A toy **box** and its pieces. If the pieces are glued in, throwing out the toy throws out the pieces. If they sit loose, you can take them out and use them in another toy.',
      body: [
        '**Composition** is a filled diamond on the owner: the part cannot outlive the whole. A `LineItem` dies with its `Order`. **Aggregation** is a hollow diamond: the part is shared and lives on without the whole.',
        'The aggregation diamond is the least used mark in UML. Many teams draw a plain association instead. Keep the filled diamond for real ownership, where deleting the owner deletes the parts.',
      ],
      keyIdea: 'Filled diamond means owns and destroys. Hollow diamond means holds but does not own. When unsure, use a plain association.',
      metrics: { classes: '4', links: '2', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          blk('order', 'Order', 'owner', 'green', 'Receipt', at(-3.6, -3.4)),
          blk('item', 'LineItem', 'owned part', 'green', 'Package', at(-3.6, 3.8), { size: 0.72 }),
          blk('team', 'Team', 'holder', 'green', 'Users', at(3.6, -3.4)),
          blk('player', 'Player', 'shared part', 'green', 'User', at(3.6, 3.8), { size: 0.72 }),
        ],
        links: [link('order', 'item', 'composition: owns', { route: 'straight' }), link('team', 'player', 'aggregation: shares', { route: 'straight' })],
        flows: [
          { path: ['order', 'item'], tone: 'error', label: 'deleted together', duration: 1.6 },
          { path: ['team', 'player'], tone: 'data', label: 'player lives on', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Ask: what happens on delete?',
          icon: 'Scale',
          rows: [
            { text: 'Delete the Order', value: 'its LineItems go too', tone: 'bad' },
            { text: 'Delete the Checkout', value: 'the gateway lives on', tone: 'good' },
          ],
          footer: { text: 'Lifetime decides the diamond', tone: 'muted' },
        },
        caption: 'Filled diamond owns, hollow diamond shares',
      },
    },
    {
      title: 'Dependency',
      tag: 'concept',
      heading: 'Dependency: a dashed arrow for "uses briefly"',
      eli5: 'A toy shop clerk glances at an order slip while wrapping a gift, then the slip is gone. The clerk never keeps it, and builds a fresh receipt each time.',
      body: [
        'A **dependency** is a dashed arrow with an open head: the class touches another one inside a method, but does not keep it. A parameter, a return type or a local variable all count. Label it `uses`.',
        'When a method builds a new instance, write `creates` on the dependency. The class now knows the other class by name, so a change to `Receipt` can break `Checkout`.',
      ],
      keyIdea: 'Dependency is the weakest link. Nothing is stored, but a change in the other class can still break this one.',
      metrics: { classes: '3', links: '2', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          { ...checkout, at: at(-3.6, 0), status: 'active' },
          blk('order', 'Order', 'method parameter', 'green', 'Receipt', at(3.6, -3.4), { size: 0.72 }),
          blk('receipt', 'Receipt', 'created inside pay()', 'green', 'FileText', at(3.6, 3.8), { size: 0.72 }),
        ],
        links: [link('checkout', 'order', 'uses', { style: 'dashed' }), link('checkout', 'receipt', 'creates', { style: 'dashed' })],
        flows: [
          { path: ['checkout', 'order'], tone: 'request', label: 'order.total()', duration: 1.5 },
          { path: ['checkout', 'receipt'], tone: 'data', label: 'Receipt(txn_id)', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Where the dependency shows up',
          icon: 'Code',
          code: 'def pay(self, order: Order) -> Receipt:\n    #   uses  ^^^^^        creates ^^^^^^^\n    txn = self._gateway.charge(...)\n    return Receipt(txn)',
        },
        caption: 'Dashed arrow, nothing stored',
      },
    },
    {
      title: 'Pick the arrow',
      tag: 'concept',
      heading: 'Pick the arrow by asking one question',
      eli5: 'Before drawing a line between two toys, ask: is it a kind of that toy, does it keep it, or does it only touch it for a moment? The answer picks the line.',
      body: [
        'Ask in this order. Is it a kind of the other? **Extends** or **implements**. Does it keep a reference? **Association**, and a diamond if it owns the lifetime. Does it only touch the other inside a method? **Dependency**.',
        'Pick the weakest link that is still true. A diagram full of strong arrows claims more coupling than the code has.',
      ],
      keyIdea: 'Choose the weakest relationship that tells the truth. Fewer and weaker arrows mean less coupling.',
      metrics: { classes: '4', links: '3', msgs: '-', view: 'class' },
      scene: {
        nodes: [{ ...checkout, at: at(-3.8, -3.6) }, { ...gateway, at: at(0, -3.6) }, { ...stripe, at: at(0, 3.8) }, blk('receipt', 'Receipt', 'concrete class', 'green', 'FileText', at(-3.8, 3.8), { size: 0.72 })],
        links: [
          link('checkout', 'gateway', 'has-a', { route: 'straight' }),
          link('stripe', 'gateway', 'implements', { style: 'dashed', route: 'straight' }),
          link('checkout', 'receipt', 'creates', { style: 'dashed', route: 'straight' }),
        ],
        panel: {
          title: 'The six arrows',
          icon: 'Route',
          rows: [
            { text: 'extends', value: 'solid, triangle' },
            { text: 'implements', value: 'dashed, triangle' },
            { text: 'has-a (association)', value: 'solid, open arrow' },
            { text: 'owns (composition)', value: 'filled diamond' },
            { text: 'uses, creates (dependency)', value: 'dashed, open arrow' },
          ],
        },
        caption: 'Every line in this lesson in one scene',
      },
      quiz: {
        question: 'A method `refund(self, order: Order)` reads `order.total()` and never stores the order. Which relationship does the diagram show from the class to `Order`?',
        options: ['Composition, because it works with the order', 'Association, because it has an Order', 'Dependency, drawn dashed with a "uses" label', 'Implements, because it handles the order'],
        answer: 2,
        explain: 'The class only touches `Order` inside one method and keeps nothing. That is a dependency. If `Order` were saved in a field, it would be an association.',
      },
    },
    {
      title: 'Read one',
      tag: 'case',
      heading: 'Reading a whole class diagram, starting from the interface',
      eli5: 'Look at the shelf with the plug shape on it. The clerk plugs in whichever toy is handy. To see how the shop runs, find the shape everyone points at and work outward.',
      body: [
        'Find the box with the most arrows pointing **at** it. Here it is `PaymentGateway`. `Checkout` holds one (association). `StripeGateway` and `FakeGateway` implement it (dashed triangles).',
        'This is dependency inversion on paper. `Checkout` knows only the interface, so adding `RazorpayGateway` later adds a box and changes no existing one.',
      ],
      keyIdea: 'Find the box everything points at. A good design has arrows pointing at stable interfaces, not at concrete classes.',
      metrics: { classes: '4', links: '3', msgs: '-', view: 'class' },
      scene: {
        nodes: [{ ...checkout, status: 'active' }, { ...gateway }, { ...stripe, status: 'ok' }, { ...fake, status: 'ok' }],
        links: [
          link('checkout', 'gateway', 'has-a'),
          link('stripe', 'gateway', 'implements', { style: 'dashed' }),
          link('fake', 'gateway', 'implements', { style: 'dashed' }),
        ],
        flows: [{ path: ['checkout', 'gateway'], tone: 'request', label: 'charge()', duration: 1.6 }],
        panel: {
          title: 'Reading order',
          icon: 'List',
          rows: [
            { text: '1. Find the most pointed-at box', value: 'PaymentGateway' },
            { text: '2. Who holds it?', value: 'Checkout' },
            { text: '3. Who implements it?', value: 'Stripe, Fake' },
            { text: '4. What can change freely?', value: 'the two implementers', tone: 'good' },
          ],
        },
        caption: 'Arrows point at the stable thing',
      },
      code: {
        language: 'python',
        title: 'The diagram, as code',
        source: `class Checkout:
    def __init__(self, gateway: PaymentGateway):
        self.gateway = gateway          # association to the interface

    def pay(self, order: Order) -> Receipt:
        txn = self.gateway.charge(order.total_cents(), order.token)
        return Receipt(order.id, txn)

Checkout(StripeGateway()).pay(order)   # production
Checkout(FakeGateway()).pay(order)     # test`,
        highlight: [3, 5, 6, 7],
      },
    },
    {
      title: 'Code to boxes',
      tag: 'concept',
      heading: 'Reading code turns it into boxes and arrows',
      eli5: 'You can look at a finished toy and draw its blueprint. A part glued inside is a keeps-it line. A part used for a moment is a touches-it line.',
      body: [
        'Every construct in code has one arrow. A field that holds another class is an **association**. A parameter or local variable is a **dependency**. A subclass is **extends**. An `ABC` or `Protocol` with implementers is **implements**.',
        'Working from code to diagram checks your drawing. Working from diagram to code tells you what to type before you open the editor.',
      ],
      keyIdea: 'Fields become associations, parameters become dependencies, base classes become triangles.',
      metrics: { classes: '-', links: '-', msgs: '-', view: 'mapping' },
      scene: {
        nodes: [
          blk('pycode', 'Python code', 'what you type', 'gray', 'FileCode', at(-3.8, 0), { size: 0.85 }),
          blk('diagram', 'Class diagram', 'what you draw', 'violet', 'Boxes', at(3.8, 0), { size: 0.85 }),
        ],
        links: [link('pycode', 'diagram', 'read it', { route: 'straight', arrow: 'both' })],
        flows: [
          { path: ['pycode', 'diagram'], tone: 'request', label: 'self.x = X()', duration: 1.6 },
          { path: ['diagram', 'pycode'], tone: 'response', label: 'arrow becomes field', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Code to arrow',
          icon: 'Table',
          rows: [
            { text: 'self._gw = gateway (field)', value: 'association' },
            { text: 'def pay(self, order: Order)', value: 'dependency' },
            { text: 'x = Receipt() in a method', value: 'creates' },
            { text: 'class B(A)', value: 'extends' },
            { text: 'class S(PaymentGateway)', value: 'implements' },
          ],
        },
        caption: 'Every line of code has one arrow',
      },
    },
    {
      title: 'Spec to boxes',
      tag: 'case',
      heading: 'From a written spec to a first class diagram',
      eli5: 'The shop owner says: "A customer buys toys, and we give a receipt." Circle the things (customer, toy, receipt) and the doing words (buys, give). Things become boxes, doing words become buttons.',
      body: [
        'Take the requirement: "A customer places an order. Checkout pays through a gateway and creates a receipt." Underline the **nouns**: they are candidate classes. Underline the **verbs**: they are candidate methods.',
        '"Has" and "contains" become associations. "Is a" becomes extends. Drop nouns that are only data (a name, a price): they become attributes of a class, not a class of their own.',
      ],
      keyIdea: 'Nouns become classes, verbs become methods, "has" becomes an association. Plain data becomes an attribute.',
      metrics: { classes: '5', links: '3', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          blk('customer', 'Customer', 'noun: class', 'green', 'Users', at(-5.1, -3.8), { size: 0.72 }),
          blk('order', 'Order', 'noun: class', 'green', 'Receipt', at(-1.7, -3.8), { status: 'active' }),
          { ...checkout, at: at(0, 3.8), sub: 'noun: class', size: 0.72 },
          { ...gateway, at: at(-4, 3.8), size: 0.72 },
          blk('receipt', 'Receipt', 'noun: class', 'green', 'FileText', at(4, 3.8), { size: 0.72 }),
        ],
        links: [
          link('customer', 'order', 'places', { route: 'straight' }),
          link('checkout', 'gateway', 'pays via', { route: 'straight' }),
          link('checkout', 'receipt', 'creates', { route: 'straight', style: 'dashed' }),
        ],
        flows: [
          { path: ['customer', 'order'], tone: 'request', label: 'places', duration: 1.4 },
          { path: ['checkout', 'gateway'], tone: 'request', label: 'pays via', duration: 1.4, delay: 2.6 },
          { path: ['checkout', 'receipt'], tone: 'data', label: 'creates', duration: 1.4, delay: 4.1 },
        ],
        panel: {
          title: 'Spec sentence, marked up',
          icon: 'FileText',
          rows: [
            { text: 'customer, order, checkout, gateway, receipt', value: 'classes', tone: 'good' },
            { text: 'places, pays, creates', value: 'methods, arrows' },
            { text: 'line items, price, name', value: 'attributes', tone: 'muted' },
          ],
          footer: { text: 'First pass: names and arrows only', tone: 'muted' },
        },
        caption: 'Underline nouns, then verbs',
      },
    },
    {
      title: 'Detail level',
      tag: 'tradeoff',
      heading: 'How much to draw: a sketch or the full signatures',
      eli5: 'For a quick chat in the toy shop you draw boxes with names and lines. For the factory you add every part and every button. Using the factory sheet for a chat just buries the point.',
      body: [
        'A **sketch** shows class names and arrows. It is quick and answers "how do the pieces fit". A **detailed** diagram adds attributes, signatures and multiplicity. It costs time and goes stale fast.',
        'Show only the members that the discussion needs. Skip getters and setters, constructors that do nothing special, and any class that is not part of the point you are making.',
      ],
      keyIdea: 'Draw the least detail that settles the question in front of you. Everything extra is noise and will rot.',
      metrics: { classes: '4', links: '3', msgs: '-', view: 'sketch' },
      scene: {
        nodes: [
          blk('sketch', 'Sketch', 'names and arrows', 'green', 'Boxes', at(-3.8, -1.6), { size: 0.85, status: 'ok', chips: [{ text: '2 minutes', tone: 'good' }] }),
          blk('full', 'Detailed', 'all members', 'amber', 'Table', at(3.8, -1.6), { size: 0.85, chips: [{ text: '20 minutes, goes stale', tone: 'warn' }] }),
          blk('reader', 'The reader', 'wants the point', 'gray', 'User', at(0, 3.6), { size: 0.72 }),
        ],
        links: [link('sketch', 'reader', 'fast'), link('full', 'reader', 'slow', { labelTone: 'warn' })],
        flows: [
          { path: ['sketch', 'reader'], tone: 'response', label: 'got it', duration: 1.4 },
          { path: ['full', 'reader'], tone: 'error', label: 'where is the point?', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'When to add detail',
          icon: 'Gauge',
          rows: [
            { text: 'Names and arrows', value: 'whiteboard, review', tone: 'good' },
            { text: '+ key methods', value: 'interface discussion' },
            { text: '+ multiplicity', value: 'data model questions' },
            { text: 'All members', value: 'rarely worth it', tone: 'warn' },
          ],
        },
        caption: 'More detail is not always more clarity',
      },
    },
    {
      title: 'Wrong arrow',
      tag: 'case',
      heading: 'Case: the extends arrow that lied',
      eli5: 'Someone draws "square toy" under "rectangle toy" because a square is a kind of rectangle. But when you stretch one side, the square toy breaks. The arrow promised something false.',
      body: [
        'A `Square` drawn under `Rectangle` looks natural. But `set_width(10)` then `set_height(5)` leaves a `Rectangle` with area 50 and a `Square` with area 25. A caller written for `Rectangle` now misbehaves.',
        'The fix on the diagram is to make both siblings under a `Shape` that only promises `area()`. A triangle must mean "can be used anywhere the parent is".',
      ],
      keyIdea: 'A wrong extends arrow is worse than none. If the child cannot stand in for the parent, draw siblings.',
      metrics: { classes: '3', links: '2', msgs: '-', view: 'class' },
      scene: {
        nodes: [
          blk('shape', 'Shape', 'abstract: area()', 'blue', 'Layers', at(0, -3.8)),
          blk('rect', 'Rectangle', 'concrete class', 'green', 'Package', at(-3.6, 3.8), { size: 0.72 }),
          blk('square', 'Square', 'sibling, not child', 'green', 'Package', at(3.6, 3.8), { size: 0.72 }),
        ],
        links: [link('rect', 'shape', 'extends'), link('square', 'shape', 'extends')],
        flows: [
          { path: ['rect', 'shape'], tone: 'handshake', label: 'area()', duration: 1.4 },
          { path: ['square', 'shape'], tone: 'handshake', label: 'area()', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Why Square under Rectangle breaks',
          icon: 'Bug',
          code: 'def stretch(r: Rectangle):\n    r.set_width(10)\n    r.set_height(5)\n    assert r.area() == 50\n\n# Square: area is 25, assert fails',
          footer: { text: 'Siblings under Shape keep the promise', tone: 'good' },
        },
        caption: 'The arrow should never promise more than the code keeps',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: the class box and six arrows',
      eli5: 'A toy shop keeps a blueprint sheet with boxes and lines. The boxes name each toy and its parts. The lines say which toy is a kind of another, which keeps one, and which only touches one.',
      body: [
        'A **class diagram** shows boxes with a name, attributes, methods and visibility marks. Interfaces, abstract classes and concrete classes each get their own mark.',
        'Six arrows join them: extends, implements, association, composition, aggregation and dependency (with creates). Pick the weakest one that is true, and draw only the detail the question needs.',
      ],
      keyIdea: 'Boxes for what exists, the weakest true arrow between them, and the least detail that settles the question.',
      metrics: { classes: '4', links: '3', msgs: '-', view: 'class' },
      scene: {
        nodes: [{ ...checkout, status: 'ok' }, { ...gateway, status: 'ok' }, { ...stripe, status: 'ok' }, { ...fake, status: 'ok' }],
        links: [link('checkout', 'gateway', 'has-a'), link('stripe', 'gateway', 'implements', { style: 'dashed' }), link('fake', 'gateway', 'implements', { style: 'dashed' })],
        flows: [{ path: ['checkout', 'gateway'], tone: 'request', label: 'charge()', duration: 1.4 }],
        panel: {
          title: 'Checklist',
          icon: 'List',
          rows: [
            { text: 'Three compartments, visibility marks', value: 'class box' },
            { text: 'is-a, implements', value: 'triangles' },
            { text: 'has-a, owns', value: 'line, diamond' },
            { text: 'uses, creates', value: 'dashed arrow' },
          ],
          footer: { text: 'Next: the sequence diagram', tone: 'muted' },
        },
        caption: 'Structure of one small design',
      },
      quiz: {
        question: 'A `PaymentService` has a field `self.gateway` that holds a `PaymentGateway`, and the gateway outlives the service. `StripeGateway` implements `PaymentGateway`. Which drawing is right?',
        options: [
          'Service to gateway: solid line with arrow (association). Stripe to gateway: dashed line with hollow triangle.',
          'Service to gateway: dashed arrow (dependency). Stripe to gateway: solid line with hollow triangle.',
          'Service to gateway: filled diamond (composition). Stripe to gateway: solid line with hollow triangle.',
          'Service to gateway: hollow triangle. Stripe to gateway: dashed arrow.',
        ],
        answer: 0,
        explain: 'A stored field is an association. The gateway outlives the service, so there is no filled diamond. Implementing an interface is a dashed line with a hollow triangle.',
      },
    },
  ],
};
