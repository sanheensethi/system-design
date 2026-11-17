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

// Slots: top row, middle row, bottom row
const TL = at(-3.8, -3.8);
const TM = at(0, -3.8);
const TR = at(3.8, -3.8);
const MM = at(0, 0);
const BL = at(-3.6, 3.8);
const BM = at(0, 3.8);
const BR = at(3.6, 3.8);

// Colors: violet = interface, blue = abstract, green = concrete, gray = external, red = trouble
const god = blk('god', TM, 'OrderManager', 'does everything', 'red', 'Boxes');
const stripe = blk('stripe', at(-3.8, 3.8), 'Stripe API', 'external', 'gray', 'Globe');
const mysql = blk('mysql', at(0, 3.8), 'MySQL', 'external', 'gray', 'Database');
const smtp = blk('smtp', at(3.8, 3.8), 'SMTP', 'external', 'gray', 'Mail');
const cart = blk('cart', TL, 'Cart', 'holds items', 'green', 'ShoppingBag');
const checkout = blk('checkout', TM, 'Checkout', 'places orders', 'green', 'Receipt');
const gateway = blk('gateway', MM, 'PaymentGateway', 'interface', 'violet', 'Plug');
const stripeGw = blk('stripe-gw', BL, 'StripeGateway', 'implements', 'green', 'Package');
const fakeGw = blk('fake-gw', BR, 'FakeGateway', 'implements', 'green', 'Package');

export const lldCohesionCoupling: Lesson = {
  id: 'lld-cohesion-coupling',
  title: 'Cohesion vs coupling',
  tagline: 'The two measures behind every class design rule: how focused a class is, and how tightly classes hold on to each other.',
  minutes: 15,
  level: 'Beginner',
  learn: [
    'Cohesion: how focused a class is, and how to measure it',
    'Coupling: how much a change in one class forces a change in another',
    'The smells: junk drawers, god classes, shotgun surgery and rigid classes',
    'The three ways coupling hides: concrete imports, reaching inside objects and shared state',
    'The fixes: single-purpose classes and narrow interfaces, and where over-splitting goes wrong',
    'How SOLID, safe refactors and the three laws of design all serve these two measures',
  ],
  metrics: [
    { key: 'files', label: 'Files per change', icon: 'FileCode' },
    { key: 'methods', label: 'Public methods', icon: 'List' },
    { key: 'concrete', label: 'Concrete imports', icon: 'Cable' },
    { key: 'tests', label: 'Test setup', icon: 'Bug' },
  ],
  steps: [
    // 1
    {
      title: 'The tangle',
      tag: 'problem',
      heading: 'One class that touches everything',
      eli5: 'Imagine one giant toy box where the blocks, the crayons and the dolls are all knotted together with string, and the string runs into the next room too. Pull one toy and everything moves.',
      body: [
        'A shop checkout starts as one `OrderManager`. It adds items, totals them, charges the card through the Stripe API, writes rows to MySQL and sends the receipt over SMTP.',
        'It works. Then Stripe renames a field, and you open the same file you opened for the tax change. Every detail of the outside world is welded into one class.',
      ],
      keyIdea: 'A class that knows every detail of the system makes every change land in the same place.',
      metrics: { files: '1 (but it is all of it)', methods: '27', concrete: '3', tests: 'needs a real DB' },
      metricTones: { methods: 'bad', concrete: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          { ...god, status: 'hot', badge: '900 lines' },
          stripe,
          mysql,
          smtp,
        ],
        links: [link('god', 'stripe', { label: 'uses' }), link('god', 'mysql', { label: 'uses' }), link('god', 'smtp', { label: 'uses' })],
        flows: [
          { path: ['god', 'stripe'], tone: 'request', label: 'charge()', duration: 1.2 },
          { path: ['god', 'mysql'], tone: 'request', label: 'INSERT', duration: 1.2, delay: 1.3 },
          { path: ['god', 'smtp'], tone: 'event', label: 'send()', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'What changes OrderManager',
          icon: 'List',
          rows: [
            { text: 'Tax rule changes', value: 'edit', tone: 'warn' },
            { text: 'Stripe renames a field', value: 'edit', tone: 'warn' },
            { text: 'New receipt template', value: 'edit', tone: 'warn' },
            { text: 'Switch MySQL to Postgres', value: 'edit', tone: 'warn' },
          ],
          footer: { text: 'Four reasons to change, one class', tone: 'bad' },
        },
        caption: 'One class, four outside systems',
      },
      code: {
        language: 'python',
        title: 'The class that grew',
        source: `class OrderManager:
    def add_item(self, sku, qty): ...
    def total(self): ...
    def charge(self, card):
        stripe.Charge.create(amount=self.total(), source=card)
    def save(self):
        mysql.execute("INSERT INTO orders ...", self.items)
    def send_receipt(self, email):
        smtplib.SMTP("mail.shop.example").sendmail(...)`,
        highlight: [5, 7, 9],
      },
    },
    // 2
    {
      title: 'Cohesion',
      tag: 'concept',
      heading: 'Cohesion: how focused is this class?',
      eli5: 'A **cohesive** toy box holds only building blocks. Everything in it has the same job, so you always know where to look.',
      body: [
        'A class is **cohesive** when its methods and fields all work toward one purpose. A `Cart` that adds items, removes items and totals them is cohesive: every method works on the same list.',
        'High cohesion is a property of one class. You can read the class name, guess what is inside, and be right.',
      ],
      keyIdea: 'High cohesion means everything in the class belongs together and serves one purpose.',
      metrics: { files: '-', methods: '4', concrete: '0', tests: 'no setup' },
      metricTones: { methods: 'good', concrete: 'good', tests: 'good' },
      scene: {
        nodes: [
          { ...cart, status: 'ok', chips: ['add_item()', 'remove_item()', 'total()'] },
          blk('item', BM, 'LineItem', 'sku, qty, price', 'green', 'Package'),
        ],
        links: [link('cart', 'item', { label: 'has-a (many)' })],
        flows: [{ path: ['cart', 'item', 'cart'], tone: 'request', label: 'price * qty', duration: 1.8 }],
        panel: {
          title: 'Every method uses the same data',
          icon: 'Table',
          rows: [
            { text: 'add_item()', value: 'self.items', tone: 'good' },
            { text: 'remove_item()', value: 'self.items', tone: 'good' },
            { text: 'total()', value: 'self.items', tone: 'good' },
          ],
          footer: { text: 'One purpose, one set of fields', tone: 'good' },
        },
        caption: 'A class that has one job',
      },
      code: {
        language: 'python',
        title: 'A cohesive Cart',
        source: `class Cart:
    def __init__(self):
        self.items: list[LineItem] = []

    def add_item(self, item: LineItem) -> None:
        self.items.append(item)

    def remove_item(self, sku: str) -> None:
        self.items = [i for i in self.items if i.sku != sku]

    def total(self) -> int:
        return sum(i.price * i.qty for i in self.items)`,
        highlight: [3, 6, 9, 12],
      },
    },
    // 3
    {
      title: 'Junk drawer',
      tag: 'case',
      heading: 'Low cohesion: the Utils and Manager classes',
      eli5: 'A junk drawer holds batteries, a spoon, a stamp and one sock. Nothing in it belongs with anything else, so nobody can find anything.',
      body: [
        'Low cohesion looks like a class called `Utils`, `Helper` or `Manager` that does fifteen unrelated things. Date formatting, password hashing and tax math all live in one file because nobody knew where else to put them.',
        'The name is the smell. If you cannot name the class without the word "and", or you reach for a vague word, it has no single purpose.',
      ],
      keyIdea: 'A vague name such as Utils or Manager usually means the class has no single purpose.',
      metrics: { files: '6 callers touched', methods: '27', concrete: '3', tests: 'hard' },
      metricTones: { methods: 'bad', files: 'warn' },
      scene: {
        nodes: [
          { ...blk('utils', TM, 'OrderUtils', 'junk drawer', 'red', 'Boxes'), status: 'hot', chips: ['format_date()', 'hash_password()', 'calc_tax()', 'send_email()'] },
          blk('login', at(-3.8, 3.8), 'LoginPage', 'wants hashing', 'green', 'KeyRound'),
          blk('invoice', at(3.8, 3.8), 'InvoicePage', 'wants tax', 'green', 'FileText'),
        ],
        links: [link('login', 'utils', { label: 'uses' }), link('invoice', 'utils', { label: 'uses' })],
        flows: [
          { path: ['login', 'utils'], tone: 'request', label: 'hash_password()', duration: 1.3 },
          { path: ['invoice', 'utils'], tone: 'request', label: 'calc_tax()', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Why callers suffer',
          icon: 'Bug',
          rows: [
            { text: 'Login needs one method', value: 'imports all', tone: 'warn' },
            { text: 'Tax edit', value: 'retest login', tone: 'bad' },
            { text: 'Name tells you', value: 'nothing', tone: 'bad' },
          ],
          footer: { text: 'Unrelated code shares a file', tone: 'bad' },
        },
        caption: 'Unrelated methods in one class',
      },
    },
    // 4
    {
      title: 'Measure it',
      tag: 'concept',
      heading: 'A quick test for cohesion: who uses which field?',
      eli5: 'Peek in the box and ask which toys get played with together. If the blocks are always used as a set and the sock never is, the sock does not belong.',
      body: [
        'List the fields of the class, then mark which methods touch each field. In a cohesive class most methods use most fields.',
        'If the table splits into two islands, with some methods using only `tax_rate` and `rules` and others using only `template` and `smtp_host`, you are looking at two classes in one file.',
        'This idea has a name: lack of cohesion of methods, or LCOM. Search for it if you want tools that compute it for you.',
      ],
      keyIdea: 'If the methods split into groups that share no fields, the class is really two or more classes.',
      metrics: { files: '-', methods: '27', concrete: '3', tests: 'hard' },
      scene: {
        nodes: [
          blk('one-class', TM, 'OrderUtils', 'one file, two classes', 'red', 'Boxes', { status: 'hot' }),
          { ...blk('group-a', BL, 'Pricing half', 'tax_rate, rules', 'amber', 'Receipt'), status: 'active' },
          { ...blk('group-b', BR, 'Mail half', 'template, smtp_host', 'blue', 'Mail'), status: 'active' },
        ],
        links: [link('one-class', 'group-a', { label: 'tax_rate' }), link('one-class', 'group-b', { label: 'smtp_host' })],
        flows: [
          { path: ['one-class', 'group-a'], tone: 'data', label: 'tax_rate', duration: 1.4 },
          { path: ['one-class', 'group-b'], tone: 'data', label: 'smtp_host', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Field usage matrix',
          icon: 'Table',
          rows: [
            { text: 'calc_tax()', value: 'tax_rate, rules', tone: 'warn' },
            { text: 'apply_discount()', value: 'tax_rate, rules', tone: 'warn' },
            { text: 'send_email()', value: 'template, smtp_host', tone: 'default' },
            { text: 'render_receipt()', value: 'template', tone: 'default' },
          ],
          footer: { text: 'Two islands, almost no shared field', tone: 'bad' },
        },
        caption: 'Two classes hiding in one',
      },
    },
    // 5
    {
      title: 'Split it',
      tag: 'concept',
      heading: 'The fix for low cohesion: single-purpose classes',
      eli5: 'Give each kind of toy its own labeled box. Blocks here, crayons there. Now each box has one job and each label tells the truth.',
      body: [
        'Split by reason to change. Pricing rules move to `PriceCalculator`, mail goes to `ReceiptMailer`, and `Checkout` only coordinates them.',
        'Each new class has a name you can say in one breath, and the table of fields no longer has islands. `Checkout` now has-a calculator and has-a mailer.',
      ],
      keyIdea: 'Split a low-cohesion class along its reasons to change, one purpose per class.',
      metrics: { files: '1 per reason', methods: '4 to 6 each', concrete: '3', tests: 'easier' },
      metricTones: { methods: 'good', tests: 'good' },
      scene: {
        nodes: [
          checkout,
          blk('pricing', at(-3.8, 3.8), 'PriceCalculator', 'tax, discounts', 'green', 'Receipt', { status: 'ok' }),
          blk('mailer', at(0, 3.8), 'ReceiptMailer', 'sends receipts', 'green', 'Mail', { status: 'ok' }),
          blk('repo', at(3.8, 3.8), 'OrderRepository', 'saves orders', 'green', 'Database', { status: 'ok' }),
        ],
        links: [link('checkout', 'pricing', { label: 'has-a' }), link('checkout', 'mailer', { label: 'has-a' }), link('checkout', 'repo', { label: 'has-a' })],
        flows: [
          { path: ['checkout', 'pricing', 'checkout'], tone: 'request', label: 'total()', duration: 1.4 },
          { path: ['checkout', 'repo'], tone: 'request', label: 'save()', duration: 1.2, delay: 1.5 },
          { path: ['checkout', 'mailer'], tone: 'event', label: 'send()', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'One reason to change each',
          icon: 'Split',
          rows: [
            { text: 'PriceCalculator', value: 'tax rules', tone: 'good' },
            { text: 'ReceiptMailer', value: 'email wording', tone: 'good' },
            { text: 'OrderRepository', value: 'storage', tone: 'good' },
            { text: 'Checkout', value: 'order of steps', tone: 'good' },
          ],
        },
        caption: 'Same behavior, four focused classes',
      },
      code: {
        language: 'python',
        title: 'Checkout only coordinates',
        source: `class Checkout:
    def __init__(self, pricing, repo, mailer):
        self.pricing = pricing
        self.repo = repo
        self.mailer = mailer

    def place(self, cart, email):
        order = self.pricing.price(cart)
        self.repo.save(order)
        self.mailer.send(email, order)
        return order`,
        highlight: [2, 8, 9, 10],
      },
    },
    // 6
    {
      title: 'Coupling',
      tag: 'concept',
      heading: 'Coupling: how entangled are these two classes?',
      eli5: 'Two toys are **coupled** when they are tied together by a string. Move one, and the other gets yanked along whether it wanted to move or not.',
      body: [
        'Two classes are **tightly coupled** when a change in one forces a change in the other. Cohesion looks inside a class. Coupling looks at the lines between classes.',
        'Take `Checkout` and `Cart`. If `Cart` renames `items` to `lines`, `Checkout` must change too. Some coupling is needed, because classes must work together. The goal is the least coupling that still lets them talk.',
      ],
      keyIdea: 'Coupling is the cost one class pays when another one changes.',
      metrics: { files: '2 per change', methods: '-', concrete: '-', tests: 'build both' },
      metricTones: { files: 'warn', tests: 'warn' },
      scene: {
        nodes: [
          { ...checkout, at: TL, status: 'hot' },
          { ...cart, at: BR, status: 'active', sub: 'renames a field' },
        ],
        links: [link('checkout', 'cart', { label: 'uses cart.items', labelTone: 'warn' })],
        flows: [
          { path: ['cart', 'checkout'], tone: 'error', label: 'items is now lines', duration: 1.5 },
          { path: ['checkout', 'cart'], tone: 'request', label: 'cart.items', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'What a change forces',
          icon: 'Table',
          rows: [
            { text: 'Cart renames a field', value: 'Checkout edit', tone: 'warn' },
            { text: 'Cart changes a return type', value: 'Checkout edit', tone: 'warn' },
            { text: 'Cart internals change, API same', value: 'no edit', tone: 'good' },
          ],
          footer: { text: 'The edits that spread show the coupling', tone: 'bad' },
        },
        caption: 'A change on one side forces an edit on the other',
      },
    },
    // 7
    {
      title: 'Concrete import',
      tag: 'case',
      heading: 'Tight coupling: business logic that imports the client',
      eli5: 'If the toy car is glued to one brand of track, you cannot play on any other track. You also cannot test the car without hauling out that whole track.',
      body: [
        'The most common tight coupling is a concrete import. `Checkout` calls `stripe.Charge.create` directly, so the checkout rules and the Stripe SDK share one fate.',
        'Tests now need a network or a patch. Switching to PayPal means editing the class that holds your business rules. The Stripe detail has leaked upward.',
      ],
      keyIdea: 'Importing a concrete client into business logic welds your rules to one vendor.',
      metrics: { files: '2 per change', methods: '-', concrete: '1', tests: 'patch Stripe' },
      metricTones: { concrete: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          { ...checkout, status: 'hot', chips: [{ text: 'import stripe', tone: 'bad' }] },
          stripe,
          blk('paypal', BR, 'PayPal API', 'cannot swap in', 'gray', 'Globe', { status: 'dim' }),
        ],
        links: [link('checkout', 'stripe', { label: 'uses (concrete)', labelTone: 'warn' }), link('checkout', 'paypal', { style: 'dashed', label: 'blocked' })],
        flows: [{ path: ['checkout', 'stripe'], tone: 'request', label: 'Charge.create()', duration: 1.5 }],
        panel: {
          title: 'Leaky abstraction',
          icon: 'Code',
          code: 'import stripe\n\nclass Checkout:\n    def pay(self, total, card):\n        stripe.Charge.create(\n            amount=total, source=card)',
          footer: { text: 'Rules know the vendor', tone: 'bad' },
        },
        caption: 'Business logic reaches out to a vendor',
      },
    },
    // 8
    {
      title: 'Narrow interface',
      tag: 'concept',
      heading: 'The fix for coupling: a narrow interface in the middle',
      eli5: 'Put a standard plug between the car and the track. Any track with that plug works, and the car does not care which one it is.',
      body: [
        'Define a `PaymentGateway` interface with the one method `Checkout` needs: `charge(amount, token)`. `Checkout` depends on that, and gets the real gateway **injected**.',
        'Now `StripeGateway` and `FakeGateway` both implement it. A test passes the fake, production passes Stripe, and Checkout has not changed.',
      ],
      keyIdea: 'Depend on a small interface and inject the concrete class. The vendor can change without touching your rules.',
      metrics: { files: '1 per change', methods: '1 in the interface', concrete: '0 in Checkout', tests: 'inject fake' },
      metricTones: { files: 'good', concrete: 'good', tests: 'good' },
      scene: {
        nodes: [
          { ...checkout, at: TL, status: 'ok' },
          { ...gateway, at: MM },
          stripeGw,
          fakeGw,
        ],
        links: [
          link('checkout', 'gateway', { label: 'uses' }),
          link('stripe-gw', 'gateway', { label: 'implements' }),
          link('fake-gw', 'gateway', { label: 'implements' }),
        ],
        flows: [
          { path: ['checkout', 'gateway', 'stripe-gw'], tone: 'request', label: 'charge()', duration: 2 },
          { path: ['stripe-gw', 'gateway', 'checkout'], tone: 'response', label: 'receipt', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'The port',
          icon: 'Plug',
          code: 'class PaymentGateway(Protocol):\n    def charge(self, amount: int, token: str) -> str: ...\n\nclass Checkout:\n    def __init__(self, gateway: PaymentGateway):\n        self.gateway = gateway',
          footer: { text: 'Checkout never names Stripe', tone: 'good' },
        },
        caption: 'Checkout depends on the plug, not the vendor',
      },
      code: {
        language: 'python',
        title: 'Inject the port',
        source: `from typing import Protocol

class PaymentGateway(Protocol):
    def charge(self, amount: int, token: str) -> str: ...

class StripeGateway:
    def charge(self, amount: int, token: str) -> str:
        return stripe.Charge.create(amount=amount, source=token).id

class FakeGateway:
    def charge(self, amount: int, token: str) -> str:
        return "fake_txn_1"

checkout = Checkout(gateway=StripeGateway())   # production
test_checkout = Checkout(gateway=FakeGateway())  # test`,
        highlight: [3, 4, 6, 10, 14, 15],
      },
      quiz: {
        question: 'Checkout imports the Stripe SDK directly. What is the most direct fix that lowers coupling?',
        options: [
          'Move the stripe import to the top of the file',
          'Split Checkout into two files that both import stripe',
          'Make Checkout depend on a PaymentGateway interface and inject a StripeGateway',
          'Copy the Stripe code into every method that needs it',
        ],
        answer: 2,
        explain: 'An interface gives Checkout a narrow, stable thing to depend on. The Stripe detail moves into one implementing class, so a vendor change touches one file and tests can inject a fake.',
      },
    },
    // 9
    {
      title: 'Reaching in',
      tag: 'case',
      heading: 'Coupling hides in long chains of calls',
      eli5: 'Instead of asking a friend "what city do you live in?", you open their bag, find their address book, open it and read it yourself. Now you know too much about their bag.',
      body: [
        'A report calls `order.customer.address.city`. It now knows that an order has a customer, that a customer has an address and that an address has a city. Move any of those and the report breaks.',
        'Ask the object that owns the data instead: `order.shipping_city()`. The report depends on one method, and the chain stays private.',
      ],
      keyIdea: 'Tell an object what you need and let it find the answer, instead of walking through its internals.',
      metrics: { files: '3 per change', methods: '-', concrete: '3 classes known', tests: 'build 3 objects' },
      metricTones: { files: 'warn', concrete: 'warn', tests: 'warn' },
      scene: {
        nodes: [
          { ...blk('report', TL, 'ShippingReport', 'knows the chain', 'green', 'FileText'), status: 'hot' },
          blk('order', TR, 'Order', 'has a customer', 'green', 'Receipt'),
          blk('customer', BR, 'Customer', 'has an address', 'green', 'User'),
          blk('address', BL, 'Address', 'has a city', 'green', 'Globe'),
        ],
        links: [
          link('report', 'order', { label: 'uses' }),
          link('report', 'customer', { style: 'dashed', label: 'reaches in', labelTone: 'warn' }),
          link('report', 'address', { style: 'dashed', label: 'reaches in', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['report', 'order'], tone: 'request', label: '.customer', duration: 1.2 },
          { path: ['report', 'customer'], tone: 'request', label: '.address', duration: 1.2, delay: 1.3 },
          { path: ['report', 'address'], tone: 'request', label: '.city', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Ask, do not dig',
          icon: 'Code',
          code: '# tightly coupled\ncity = order.customer.address.city\n\n# one narrow call\ncity = order.shipping_city()',
          footer: { text: 'Hide the chain behind one method', tone: 'good' },
        },
        caption: 'The report knows three classes, not one',
      },
    },
    // 10
    {
      title: 'Shared state',
      tag: 'case',
      heading: 'Coupling hides in shared mutable state',
      eli5: 'Three kids all draw on the same whiteboard with no turns. Each one rubs out what another drew, and nobody can say who did it.',
      body: [
        'Two classes that read and write the same global or singleton are coupled with no line in the code. `Pricing` sets `CONFIG["currency"]`, and `Mailer` quietly reads it.',
        'Change the order of calls, or run two tests together, and results change. Pass the value in as an argument instead, so the dependency is visible and local.',
      ],
      keyIdea: 'A shared global is coupling you cannot see. Pass values in so each dependency is explicit.',
      metrics: { files: 'unknown', methods: '-', concrete: '1 global', tests: 'order matters' },
      metricTones: { files: 'bad', concrete: 'warn', tests: 'bad' },
      scene: {
        nodes: [
          { ...blk('globals', MM, 'CONFIG', 'global dict', 'amber', 'Boxes'), status: 'hot' },
          blk('pricing', TL, 'Pricing', 'writes currency', 'green', 'Receipt'),
          blk('mailer', TR, 'Mailer', 'reads currency', 'green', 'Mail'),
          blk('reports', BR, 'Reports', 'reads currency', 'green', 'FileText'),
        ],
        links: [
          link('pricing', 'globals', { label: 'writes', labelTone: 'warn' }),
          link('mailer', 'globals', { label: 'reads' }),
          link('reports', 'globals', { label: 'reads' }),
        ],
        flows: [
          { path: ['pricing', 'globals'], tone: 'request', label: 'currency = "EUR"', duration: 1.3 },
          { path: ['globals', 'mailer'], tone: 'data', label: 'EUR', duration: 1.2, delay: 1.4 },
          { path: ['globals', 'reports'], tone: 'data', label: 'EUR', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Hidden link versus visible one',
          icon: 'Code',
          code: '# hidden: who set this, and when?\nsymbol = CONFIG["currency"]\n\n# visible: the caller decides\ndef render(order, currency): ...',
          footer: { text: 'No import shows the coupling', tone: 'warn' },
        },
        caption: 'Three classes tied through one global',
      },
    },
    // 11
    {
      title: 'Smell table',
      tag: 'concept',
      heading: 'Four smells that point at these two measures',
      eli5: 'You can tell a messy toy room without counting. If the box says "Stuff", or moving one toy moves three others, you already know where to tidy.',
      body: [
        'You do not need a tool to spot trouble. Four everyday smells each hit one or both measures, and each has a standard first fix: junk drawer, god class, shotgun surgery and rigid class.',
        'Treat them as questions to ask in review, not as hard rules. A class with 22 methods may still be fine if all 22 serve one purpose.',
      ],
      keyIdea: 'Each smell names a symptom, a cause (cohesion or coupling) and a first fix.',
      metrics: { files: '-', methods: '20+ is a flag', concrete: '-', tests: '-' },
      scene: {
        nodes: [
          blk('smell-name', TL, 'Junk drawer', 'XxxManager', 'red', 'Boxes'),
          blk('smell-god', TR, 'God class', '20+ methods', 'red', 'List'),
          blk('smell-ripple', BL, 'Shotgun surgery', 'one change, many files', 'red', 'Share2'),
          blk('smell-rigid', BR, 'Rigid class', 'new case edits it', 'red', 'Split'),
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Smell, cause, fix',
          icon: 'Table',
          rows: [
            { text: 'Junk drawer: XxxManager', value: 'low cohesion, split by purpose', tone: 'warn' },
            { text: 'God class: 20+ methods or 500+ lines', value: 'low cohesion plus many dependents, extract class', tone: 'warn' },
            { text: 'Shotgun surgery: one change edits many files', value: 'scattered idea, gather it', tone: 'warn' },
            { text: 'Rigid class: new case edits the class', value: 'concrete coupling, interface', tone: 'warn' },
          ],
          footer: { text: 'First two hit cohesion, last two hit coupling', tone: 'muted' },
        },
        caption: 'Four quick signs to look for',
      },
    },
    // 12
    {
      title: 'Three laws',
      tag: 'concept',
      heading: 'The three laws of design',
      eli5: 'Put toys that you always play with at the same time in the same box. Put toys you play with on different days in different boxes. And plug boxes together with a standard plug.',
      body: [
        'Law one: change together, keep together. Law two: change apart, keep apart. These are cohesion and decoupling in one line each. A discount rule and a coupon rule move as a pair. The email template moves on its own schedule.',
        'Law three: depend on abstractions, not concretions. This is the `PaymentGateway` step again: `Checkout` depends on the interface, so the vendor can change without touching it.',
      ],
      keyIdea: 'Group code by reason to change, and let modules meet through abstractions.',
      metrics: { files: '1 per reason', methods: '-', concrete: '-', tests: '-' },
      metricTones: { files: 'good' },
      scene: {
        nodes: [
          { ...blk('discount', TL, 'DiscountRule', 'changes with promos', 'green', 'Star'), status: 'ok' },
          { ...blk('coupon', TM, 'CouponRule', 'changes with promos', 'green', 'Star'), status: 'ok' },
          blk('template', BR, 'EmailTemplate', 'changes with marketing', 'blue', 'Mail', { status: 'active' }),
        ],
        links: [link('discount', 'coupon', { label: 'same reason', labelTone: 'good', arrow: 'none' })],
        zones: [
          { id: 'z-promo', from: [-4.6, -2.8], to: [-0.8, 1], label: 'promo module', tone: 'green' },
        ],
        flows: [{ path: ['discount', 'coupon'], tone: 'data', label: 'promo change', duration: 1.4 }],
        panel: {
          title: 'Law, and what it serves',
          icon: 'Scale',
          rows: [
            { text: 'Change together, keep together', value: 'cohesion', tone: 'good' },
            { text: 'Change apart, keep apart', value: 'decoupling', tone: 'good' },
            { text: 'Depend on abstractions', value: 'DI', tone: 'good' },
          ],
        },
        caption: 'Modules follow reasons to change',
      },
    },
    // 13
    {
      title: 'God class',
      tag: 'case',
      heading: 'Smell one: the god class',
      eli5: 'One toy box that holds every toy in the house and a rule that nobody else may keep any. Everyone has to ask the box for everything.',
      body: [
        'A **god class** knows everything and everyone calls it. It is the low-cohesion extreme: tax, mail and storage in one place, and every other class depends on it.',
        'Because so much depends on it, it is scary to change, so it grows. It is also hard to test, since any test must build all of it.',
      ],
      keyIdea: 'A god class is low cohesion with a crowd of dependents, which is why it keeps growing.',
      metrics: { files: 'every change', methods: '60+', concrete: '8', tests: 'needs everything' },
      metricTones: { files: 'bad', methods: 'bad', concrete: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          { ...blk('god2', MM, 'AppManager', 'knows everything', 'red', 'Boxes'), status: 'hot', badge: '3,400 lines', load: 95 },
          blk('web', TL, 'WebUI', 'calls it', 'green', 'Laptop'),
          blk('jobs', TR, 'NightlyJobs', 'calls it', 'green', 'Clock'),
          blk('api2', BR, 'PublicAPI', 'calls it', 'green', 'Network'),
        ],
        links: [link('web', 'god2', { label: 'uses' }), link('jobs', 'god2', { label: 'uses' }), link('api2', 'god2', { label: 'uses' })],
        flows: [
          { path: ['web', 'god2'], tone: 'request', label: 'everything()', duration: 1.2 },
          { path: ['jobs', 'god2'], tone: 'request', label: 'everything()', duration: 1.2, delay: 0.6 },
          { path: ['api2', 'god2'], tone: 'request', label: 'everything()', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Warning signs',
          icon: 'Bug',
          rows: [
            { text: 'Everyone imports it', value: 'high fan-in', tone: 'warn' },
            { text: 'Merge conflicts weekly', value: 'one hot file', tone: 'bad' },
            { text: 'Tests need all of it', value: 'slow', tone: 'bad' },
          ],
          footer: { text: 'Split by reason to change', tone: 'muted' },
        },
        caption: 'Everything flows through one class',
      },
    },
    // 14
    {
      title: 'Shotgun surgery',
      tag: 'case',
      heading: 'Smell two: shotgun surgery',
      eli5: 'To change one toy rule you have to visit six boxes in six rooms. The rule was spread so thin that nobody owns it.',
      body: [
        'The opposite of a god class is a rule scattered across many files. Adding Apple Pay means editing the checkout, the refund code and the reports, each with its own `if method == "card"` check.',
        'The cause is low cohesion in the other direction: one concept is cut into pieces that live apart. Gather it into one class so the next change is one edit.',
      ],
      keyIdea: 'If one small change edits many files, one idea has been scattered. Pull it back into one place.',
      metrics: { files: '3 for Apple Pay', methods: '-', concrete: '-', tests: '3 suites' },
      metricTones: { files: 'bad', tests: 'warn' },
      scene: {
        nodes: [
          blk('ask', TM, 'Add Apple Pay', 'one small ask', 'gray', 'Zap'),
          { ...blk('f1', BL, 'Checkout', 'edit', 'amber', 'Receipt'), status: 'hot' },
          { ...blk('f2', BM, 'Refunds', 'edit', 'amber', 'ArrowLeftRight'), status: 'hot' },
          { ...blk('f3', BR, 'Reports', 'edit', 'amber', 'FileText'), status: 'hot' },
        ],
        links: [link('ask', 'f1', { label: 'edit', labelTone: 'warn' }), link('ask', 'f2', { label: 'edit', labelTone: 'warn' }), link('ask', 'f3', { label: 'edit', labelTone: 'warn' })],
        flows: [
          { path: ['ask', 'f1'], tone: 'error', label: 'if card...', duration: 1.2 },
          { path: ['ask', 'f2'], tone: 'error', label: 'if card...', duration: 1.2, delay: 0.5 },
          { path: ['ask', 'f3'], tone: 'error', label: 'if card...', duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'Scattered, then gathered',
          icon: 'Code',
          code: '# scattered: three files\n# checkout.py: if method == "card"\n# refunds.py:  if method == "card"\n# reports.py:  if method == "card"\n\n# gathered: one place\nclass ApplePay(PaymentMethod): ...',
          footer: { text: 'One idea, one home', tone: 'good' },
        },
        caption: 'One feature, many edits',
      },
    },
    // 15
    {
      title: 'Rigid class',
      tag: 'case',
      heading: 'Smell three: the rigid class',
      eli5: 'A toy that can only do its trick on one exact track. To teach it a second trick you have to take the toy apart.',
      body: [
        'A **rigid class** cannot be extended without being modified, because it is welded to concrete types. A new payment type means a new `elif` inside a method that is already long.',
        'It is tight coupling to concrete code, and it breaks the open/closed idea: open for extension, closed for modification. The fix is the interface from step 8. Pull each branch out behind it and you get the Strategy pattern: one class per payment type, and a new type is a new class, not an edit.',
      ],
      keyIdea: 'A rigid class forces edits for every extension. Extract each branch behind an interface (Strategy) so new behavior arrives as a new class.',
      metrics: { files: '1 edit per type', methods: '-', concrete: '3 inside', tests: 'retest all' },
      metricTones: { files: 'warn', concrete: 'warn', tests: 'warn' },
      scene: {
        nodes: [
          { ...blk('rigid', TM, 'PaymentService', 'if / elif ladder', 'red', 'Split'), status: 'hot' },
          blk('c1', BL, 'Card branch', 'inside the method', 'gray', 'Package'),
          blk('c2', BM, 'PayPal branch', 'inside the method', 'gray', 'Package'),
          blk('c3', BR, 'UPI branch', 'to be added', 'gray', 'Package', { status: 'dim' }),
        ],
        links: [link('rigid', 'c1', { label: 'branch' }), link('rigid', 'c2', { label: 'branch' }), link('rigid', 'c3', { style: 'dashed', label: 'edit needed', labelTone: 'warn' })],
        flows: [{ path: ['rigid', 'c1', 'rigid'], tone: 'request', label: 'if card', duration: 1.6 }],
        panel: {
          title: 'Edit versus extend',
          icon: 'Code',
          code: '# rigid: edit the ladder\nif kind == "card": ...\nelif kind == "upi": ...  # new edit\n\n# extend: add a class\nclass UpiPayment:\n    def pay(self, amount): ...\nMETHODS["upi"] = UpiPayment()',
          footer: { text: 'Extend by adding, not by editing', tone: 'good' },
        },
        caption: 'New behavior means editing the class',
      },
    },
    // 16
    {
      title: 'Over-splitting',
      tag: 'tradeoff',
      heading: 'The two measures pull against each other',
      eli5: 'If you give every single block its own tiny box, you need fifty boxes and a map. You made each box neat but nobody can play.',
      body: [
        'You can push cohesion too far. Four classes for one calculation, and in a real codebase forty tiny classes with one method each, have perfect cohesion and a chain of calls between them, so coupling goes up and the code is harder to follow.',
        'Aim for classes that are **deep and narrow**: they do one important thing and expose a small surface. Stop splitting when the next class would only forward calls.',
      ],
      keyIdea: 'Split by reason to change, not by method count. Tiny classes that call each other trade cohesion for coupling.',
      metrics: { files: '4 classes, one calculation', methods: '1 each', concrete: '-', tests: 'many mocks' },
      metricTones: { files: 'warn', tests: 'warn' },
      scene: {
        nodes: [
          blk('t1', TL, 'TaxInput', '1 method', 'amber', 'Package'),
          blk('t2', TR, 'TaxRateReader', '1 method', 'amber', 'Package'),
          blk('t3', BR, 'TaxMath', '1 method', 'amber', 'Package'),
          blk('t4', BL, 'TaxFormatter', '1 method', 'amber', 'Package'),
        ],
        links: [
          link('t1', 't2', { label: 'uses', labelTone: 'warn' }),
          link('t2', 't3', { label: 'uses', labelTone: 'warn' }),
          link('t3', 't4', { label: 'uses', labelTone: 'warn' }),
        ],
        flows: [{ path: ['t1', 't2', 't3', 't4'], tone: 'request', label: 'forward()', duration: 3 }],
        panel: {
          title: 'Too far',
          icon: 'Scale',
          rows: [
            { text: 'Cohesion of each class', value: 'perfect', tone: 'good' },
            { text: 'Calls between classes', value: 'many', tone: 'bad' },
            { text: 'To understand tax', value: 'open 4 files', tone: 'bad' },
          ],
          footer: { text: 'One purpose, not one method', tone: 'muted' },
        },
        caption: 'Neat classes, tangled web',
      },
      quiz: {
        question: 'A team splits one 500-line class into 40 classes with one method each, all calling each other. What most likely happened?',
        options: [
          'Cohesion and coupling both improved',
          'Each class is cohesive, but coupling between classes rose',
          'Coupling dropped because classes are smaller',
          'Nothing changed, because the code does the same thing',
        ],
        answer: 1,
        explain: 'Small classes can each be focused while the web of calls between them grows. Split by reason to change, and stop when a new class would only forward calls.',
      },
    },
    // 17
    {
      title: 'SOLID link',
      tag: 'concept',
      heading: 'SOLID is these two measures in checklist form',
      eli5: 'The house rules for the toy room, like "one kind of toy per box" and "use the standard plug", are all just ways of keeping the room neat and the strings short.',
      body: [
        'The **Single Responsibility Principle** is a cohesion rule: one reason to change per class. The **Open/Closed** and **Dependency Inversion** principles are coupling rules: depend on abstractions, and extend by adding.',
        'The other two support the interface in the middle. Interface Segregation narrows the surface, which lowers coupling. Liskov Substitution makes substitutes safe, so the interface can be trusted. Ask which measure a rule improves to know whether to split a class or put an interface between two.',
      ],
      keyIdea: 'SRP raises cohesion. OCP and DIP lower coupling, with ISP and LSP keeping the interface narrow and trustworthy.',
      metrics: { files: '-', methods: '-', concrete: '-', tests: '-' },
      scene: {
        nodes: [
          blk('srp', TL, 'SRP', 'one reason to change', 'green', 'Split'),
          blk('ocp', TR, 'OCP', 'extend by adding', 'violet', 'Plug'),
          blk('dip', BR, 'DIP', 'depend on abstractions', 'violet', 'Plug'),
          blk('measure-c', BL, 'Cohesion', 'inside a class', 'green', 'Gauge'),
          blk('measure-k', MM, 'Coupling', 'between classes', 'blue', 'Cable'),
        ],
        links: [
          link('srp', 'measure-c', { label: 'raises', labelTone: 'good' }),
          link('ocp', 'measure-k', { label: 'lowers', labelTone: 'good' }),
          link('dip', 'measure-k', { label: 'lowers', labelTone: 'good' }),
        ],
        flows: [],
        panel: {
          title: 'Which measure does it serve?',
          icon: 'Table',
          rows: [
            { text: 'S: single responsibility', value: 'cohesion', tone: 'good' },
            { text: 'O: open / closed', value: 'coupling', tone: 'good' },
            { text: 'L: Liskov substitution', value: 'keeps substitutes safe', tone: 'good' },
            { text: 'I: interface segregation', value: 'narrows coupling', tone: 'good' },
            { text: 'D: dependency inversion', value: 'coupling', tone: 'good' },
          ],
          footer: { text: 'Both measures, five rules', tone: 'muted' },
        },
        caption: 'One checklist, two measures',
      },
    },
    // 18
    {
      title: 'Safe refactor',
      tag: 'case',
      heading: 'Getting there: tests first, one responsibility at a time',
      eli5: 'Tidy the toy room one box at a time, and take a photo first so you can check nothing went missing. Do not empty the whole room onto the floor.',
      body: [
        '**Start with tests.** Nobody argues against adding tests, and adding them forces you to decouple. The seams you need for a test are the seams where an interface belongs.',
        '**Extract one responsibility at a time.** A PR that moves one class out is reviewable. A rewrite of the module is not. Show a before and after in the description.',
      ],
      keyIdea: 'Pin behavior with a test, then pull out one responsibility per change. Small steps get approved.',
      metrics: { files: '2 per PR', methods: '-', concrete: '2 left', tests: 'fake injected' },
      metricTones: { files: 'good', tests: 'good' },
      scene: {
        nodes: [
          blk('test', TL, 'Characterization test', 'pins behavior', 'violet', 'Bug', { status: 'ok' }),
          { ...checkout, at: TR, status: 'active' },
          blk('extracted', BM, 'PriceCalculator', 'extracted in PR 1', 'green', 'Receipt', { status: 'ok' }),
        ],
        links: [link('test', 'checkout', { label: 'guards' }), link('checkout', 'extracted', { label: 'creates (PR 1)' })],
        flows: [
          { path: ['test', 'checkout'], tone: 'request', label: 'place(cart)', duration: 1.4 },
          { path: ['checkout', 'extracted'], tone: 'request', label: 'price(cart)', duration: 1.4, delay: 1.5 },
          { path: ['extracted', 'checkout', 'test'], tone: 'response', label: 'same total', duration: 2, delay: 3 },
        ],
        panel: {
          title: 'The order of work',
          icon: 'List',
          rows: [
            { text: '1. Write a test that pins today', value: 'green', tone: 'good' },
            { text: '2. Extract one class', value: 'still green', tone: 'good' },
            { text: '3. Inject it, remove import', value: 'still green', tone: 'good' },
            { text: '4. Repeat for the next one', value: 'new PR', tone: 'muted' },
          ],
        },
        caption: 'Small, tested steps',
      },
    },
    // 19
    {
      title: 'Cascade',
      tag: 'case',
      heading: 'Why it matters in production: tight coupling spreads failures',
      eli5: 'If the toy truck is tied to the toy train, then when the train gets stuck, the truck is dragged to a stop too, even though nothing was wrong with it.',
      body: [
        'Many production incidents are design problems in disguise. This is runtime coupling: a slow email provider stalls `Checkout` because a synchronous call to it sits inside the order path with no timeout.',
        'A narrow seam gives you one place to add a timeout, a queue or a circuit breaker. Loose coupling lets a small failure stay small.',
      ],
      keyIdea: 'Tight coupling lets one slow dependency stall unrelated work. A narrow seam gives you a place to contain it.',
      metrics: { files: '-', methods: '-', concrete: '1 in order path', tests: '-' },
      metricTones: { concrete: 'bad' },
      scene: {
        nodes: [
          { ...checkout, status: 'hot', load: 92, chips: [{ text: 'waiting on mail', tone: 'bad' }] },
          { ...smtp, at: BM, status: 'down', label: 'Email provider', sub: 'slow, 30 s' },
          blk('payments', TR, 'PaymentGateway', 'healthy, waiting', 'violet', 'Plug', { status: 'dim' }),
        ],
        links: [link('checkout', 'smtp', { label: 'uses (no timeout)', labelTone: 'bad' }), link('checkout', 'payments', { label: 'uses' })],
        flows: [
          { path: ['checkout', 'smtp'], tone: 'request', label: 'send()', duration: 1.4 },
          { path: ['smtp', 'checkout'], tone: 'error', label: 'still waiting at 30 s', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Blast radius',
          icon: 'Activity',
          rows: [
            { text: 'Email slow', value: '30 s', tone: 'bad' },
            { text: 'Checkout threads stuck', value: '92% busy', tone: 'bad' },
            { text: 'Payments healthy, but no free threads', value: 'starved', tone: 'warn' },
          ],
          footer: { text: 'A side feature stops the sale', tone: 'bad' },
        },
        caption: 'One slow side call takes the order path down',
      },
    },
    // 20
    {
      title: 'Three questions',
      tag: 'concept',
      heading: 'Three questions before you write the class',
      eli5: 'Before you tidy a toy room, ask which toys change often, which never do, and which one is the next toy the kids will ask for.',
      body: [
        '**What changes?** Put it behind an interface. **What does not change?** Keep it concrete and simple. **What is the next likely change?** Prepare only that seam.',
        'The third question protects you from over-engineering. An interface for a change nobody will ask for is coupling you pay for with no return.',
      ],
      keyIdea: 'Abstract what changes, keep the rest plain, and prepare only the seam you expect to use next.',
      metrics: { files: '1 per change', methods: 'small surface', concrete: 'only stable ones', tests: 'inject fakes' },
      metricTones: { files: 'good', methods: 'good', concrete: 'good', tests: 'good' },
      scene: {
        nodes: [
          blk('q1', TL, 'What changes?', 'payment vendor', 'violet', 'Plug', { status: 'active' }),
          blk('q2', TR, 'What does not?', 'order total math', 'green', 'Receipt', { status: 'ok' }),
          blk('q3', BM, 'Next change?', 'Apple Pay', 'amber', 'Zap', { status: 'active' }),
        ],
        links: [
          link('q1', 'q3', { label: 'seam here' }),
        ],
        flows: [{ path: ['q1', 'q3'], tone: 'event', label: 'add one class', duration: 1.6 }],
        panel: {
          title: 'Before you code',
          icon: 'List',
          rows: [
            { text: 'What changes?', value: 'interface', tone: 'good' },
            { text: 'What does not?', value: 'concrete', tone: 'good' },
            { text: 'Next likely change?', value: 'only that seam', tone: 'good' },
          ],
          footer: { text: 'No interface for imagined futures', tone: 'muted' },
        },
        caption: 'Spend abstraction where change is likely',
      },
    },
    // 21
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'High cohesion, low coupling',
      eli5: 'Each box holds one kind of toy and has a clear label. The boxes touch each other through a standard plug, so you can swap or move one without yanking the rest.',
      body: [
        '**Cohesion** is how focused one class is. **Coupling** is how much one class depends on another. Aim for classes that are deep and narrow, joined through small, stable interfaces.',
        'Watch for the junk drawer, the god class, shotgun surgery and the rigid class. Fix them one reason to change at a time, and stop before the classes only forward calls.',
      ],
      keyIdea: 'Make each class do one thing well, and make each link between classes as thin as you can.',
      metrics: { files: '1 per change', methods: 'small', concrete: '0 in logic', tests: 'inject fakes' },
      metricTones: { files: 'good', methods: 'good', concrete: 'good', tests: 'good' },
      scene: {
        nodes: [
          { ...checkout, at: TL, status: 'ok' },
          { ...gateway, at: MM },
          blk('pricing2', BL, 'PriceCalculator', 'one purpose', 'green', 'Receipt', { status: 'ok' }),
          { ...stripeGw, at: BR },
        ],
        links: [
          link('checkout', 'gateway', { label: 'uses' }),
          link('checkout', 'pricing2', { label: 'has-a' }),
          link('stripe-gw', 'gateway', { label: 'implements' }),
        ],
        flows: [
          { path: ['checkout', 'pricing2', 'checkout'], tone: 'request', label: 'price()', duration: 1.5 },
          { path: ['checkout', 'gateway', 'stripe-gw'], tone: 'request', label: 'charge()', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'The checklist',
          icon: 'Scale',
          rows: [
            { text: 'Can I name it without "and"?', value: 'cohesion', tone: 'good' },
            { text: 'Does one change touch one file?', value: 'coupling', tone: 'good' },
            { text: 'Is there a concrete import in logic?', value: 'inject it', tone: 'warn' },
            { text: 'Would a new class only forward?', value: 'stop', tone: 'muted' },
          ],
        },
        caption: 'Focused classes, thin links',
      },
      quiz: {
        question: 'Adding a new payment method means editing five files, each with the same if-chain. Which smell is this, and what is the fix?',
        options: [
          'God class, so merge the files into one',
          'Shotgun surgery, so gather the idea into one class or behind one interface',
          'Over-splitting, so delete some of the classes',
          'Low coupling, so no change is needed',
        ],
        answer: 1,
        explain: 'One idea (payment method) is scattered across many files, so a single change edits them all. Put it behind one interface so a new method is one new class.',
      },
    },
  ],
};
