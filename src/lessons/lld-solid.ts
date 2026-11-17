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

// Reused nodes (violet = interface, blue = abstract, green = concrete, gray = external)
const user = (extra: Partial<SceneNode> = {}) => blk('user', B, 'User', 'name, email', 'green', 'User', extra);
const checkout = blk('checkout', A, 'Checkout', 'caller', 'green', 'ShoppingBag');
const policy = blk('policy', B, 'DiscountPolicy', 'interface', 'violet', 'Plug');
const premium = blk('premium', D, 'Premium', 'concrete', 'green', 'Package');
const vip = blk('vip', E, 'VIP', 'concrete', 'green', 'Package');
const rect = (extra: Partial<SceneNode> = {}) => blk('rect', B, 'Rectangle', 'w, h', 'green', 'Package', extra);
const service = blk('service', A, 'OrderService', 'high-level', 'green', 'ShoppingBag');
const database = blk('database', B, 'Database', 'interface', 'violet', 'Plug');

// The five principles as a row of blocks
const letters = (status?: 'ok'): SceneNode[] => [
  blk('s', at(-7.2, 0), 'SRP', 'one reason to change', 'teal', 'Shield', { status }),
  blk('o', at(-3.6, 0), 'OCP', 'add, do not edit', 'blue', 'Layers', { status }),
  blk('l', at(0, 0), 'LSP', 'keep parent promises', 'amber', 'Repeat', { status }),
  blk('i', at(3.6, 0), 'ISP', 'small interfaces', 'violet', 'Split', { status }),
  blk('d', at(7.2, 0), 'DIP', 'depend on interfaces', 'green', 'Plug', { status }),
];

export const lldSolid: Lesson = {
  id: 'lld-solid',
  title: 'SOLID principles (part 1)',
  tagline: 'Five principles that say what a well-designed class looks like, each one shown as a violation first and then fixed.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Single responsibility: one reason to change, and how to size a class',
    'Open/closed: adding behavior by adding classes, and where to stop',
    'Liskov substitution: why a square is not a rectangle, and what a subtype must promise',
    'Interface segregation: small interfaces and the small test fakes they allow',
    'Dependency inversion: depending on an interface, injecting the concrete, and wiring it in one place',
  ],
  metrics: [
    { key: 'edits', label: 'Files per change', icon: 'FileCode' },
    { key: 'reasons', label: 'Reasons to change', icon: 'Split' },
    { key: 'tests', label: 'Test setup', icon: 'Bug' },
    { key: 'principle', label: 'Principle', icon: 'Scale' },
  ],
  steps: [
    // 1
    {
      title: 'Shared fate',
      tag: 'problem',
      heading: 'A column rename stops the welcome emails',
      eli5: 'One kid has the plant job, the pencil job and the board job all at once. When the plant job changes, the pencils stop being handed out too. That kid is the **class** with too many jobs.',
      body: [
        'A `User` class saves itself to the database, sends its own welcome email and turns itself into JSON. It works, and it ships.',
        'Then a DBA renames a column. The fix is merged into the same file as an email template edit, the deploy rolls back, and welcome emails fail in production. Unrelated concerns share one fate.',
      ],
      keyIdea: 'When unrelated concerns live in one class, a change to one can break the others.',
      metrics: { edits: '1 file', reasons: '3', tests: 'DB and SMTP', principle: '-' },
      metricTones: { reasons: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          blk('dba', A, 'DBA team', 'renames a column', 'gray', 'Database'),
          user({ sub: 'one file, 3 jobs', status: 'hot', badge: 'merge conflict' }),
          blk('smtp', E, 'Welcome email', 'breaks in prod', 'gray', 'Mail', { status: 'down' }),
        ],
        links: [link('dba', 'user', { label: 'edits' }), link('user', 'smtp', { label: 'send_welcome_email()', labelTone: 'warn' })],
        flows: [
          { path: ['dba', 'user'], tone: 'request', label: 'rename column', duration: 1.4 },
          { path: ['user', 'smtp'], tone: 'error', label: 'rollback, mail fails', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What lives in User',
          icon: 'FileCode',
          code: 'class User:\n    name, email\n    save_to_db()\n    send_welcome_email()\n    to_json()',
          footer: { text: 'Three concerns, one file', tone: 'bad' },
        },
        caption: 'Unrelated concerns share a fate',
      },
      code: {
        language: 'python',
        title: 'User does three jobs',
        source: `class User:
    def __init__(self, name, email):
        self.name = name
        self.email = email

    def save_to_db(self):
        print("INSERT INTO users ...")

    def send_welcome_email(self):
        print(f"Sending mail to {self.email}")

    def to_json(self):
        return {"name": self.name, "email": self.email}`,
        highlight: [6, 9, 12],
      },
    },
    // 2
    {
      title: 'Five principles',
      tag: 'concept',
      heading: 'SOLID: five checks for a well-designed class',
      eli5: 'A class job chart has five simple rules: one job per kid, new jobs without rewriting the chart, substitutes do what the regular kid did, small job cards, and ask for a role. Together they spell **SOLID**.',
      body: [
        '**SOLID** is five principles: **S**ingle responsibility, **O**pen/closed, **L**iskov substitution, **I**nterface segregation and **D**ependency inversion.',
        'Memorizing the acronym is not the point. Recognizing a violation in your own code is. Each principle comes next as a violation, then a fix.',
      ],
      keyIdea: 'SOLID is a checklist for spotting classes that will hurt when requirements change.',
      metrics: { edits: '-', reasons: '-', tests: '-', principle: 'SOLID' },
      scene: {
        nodes: letters(),
        panel: {
          title: 'One line each',
          icon: 'List',
          rows: [
            { text: 'S', value: 'one reason to change' },
            { text: 'O', value: 'extend, do not edit' },
            { text: 'L', value: 'subtypes keep promises' },
            { text: 'I', value: 'no unused methods' },
            { text: 'D', value: 'depend on interfaces' },
          ],
          footer: { text: 'Next: S, then O, L, I, D', tone: 'muted' },
        },
        caption: 'Five principles, one lens',
      },
    },
    // 3
    {
      title: 'One reason',
      tag: 'concept',
      heading: 'S: a class has one reason to change',
      eli5: 'A good job card has one job on it. If the plant card also says "hand out pencils", two different teachers keep rewriting the same card. That card has two **reasons to change**.',
      body: [
        '**Single responsibility**: a class should have one, and only one, reason to change.',
        '`User` has three. The database schema changes, the email template changes, the JSON format changes. Three teams edit the same file, and each edit risks the other two jobs.',
      ],
      keyIdea: 'Count who could force an edit. More than one reason means more than one responsibility.',
      metrics: { edits: '1 file', reasons: '3', tests: '-', principle: 'SRP' },
      metricTones: { reasons: 'bad' },
      scene: {
        nodes: [
          blk('schema', A, 'DB schema', 'DBA team', 'gray', 'Database'),
          blk('template', B, 'Email text', 'marketing', 'gray', 'Mail'),
          blk('format', C, 'JSON shape', 'API team', 'gray', 'FileJson'),
          user({ at: at(0, 5), status: 'hot', chips: ['save_to_db()', 'send_welcome_email()', 'to_json()'] }),
        ],
        links: [link('schema', 'user', { label: 'change' }), link('template', 'user', { label: 'change' }), link('format', 'user', { label: 'change' })],
        flows: [
          { path: ['schema', 'user'], tone: 'request', label: 'edit', duration: 1.4 },
          { path: ['template', 'user'], tone: 'request', label: 'edit', duration: 1.4, delay: 0.5 },
          { path: ['format', 'user'], tone: 'request', label: 'edit', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'Reasons to change User',
          icon: 'Split',
          rows: [
            { text: 'Schema moves', value: 'DBA', tone: 'bad' },
            { text: 'Email wording', value: 'marketing', tone: 'bad' },
            { text: 'JSON fields', value: 'API team', tone: 'bad' },
          ],
          footer: { text: '3 reasons, 1 class', tone: 'bad' },
        },
        caption: 'Three teams, one file',
      },
    },
    // 4
    {
      title: 'Split it',
      tag: 'concept',
      heading: 'Fix: one class per reason to change',
      eli5: 'Give each job its own kid: one waters plants, one hands out pencils, one wipes the board. Each kid is a small **class**, and nobody trips over anyone else.',
      body: [
        '`User` keeps only the data. A `UserRepository` owns the database, a `WelcomeMailer` owns the email and a `UserSerializer` owns the JSON format.',
        'Now a column rename touches only the repository. The mailer and serializer are not even in the diff.',
      ],
      keyIdea: 'Split along reasons to change, and each change lands in exactly one class.',
      metrics: { edits: '1 file', reasons: '1 each', tests: '-', principle: 'SRP' },
      metricTones: { edits: 'good', reasons: 'good' },
      scene: {
        nodes: [
          user({ sub: 'data only', status: 'ok' }),
          blk('repo', D, 'UserRepository', 'database', 'green', 'Database'),
          blk('mailer', E, 'WelcomeMailer', 'email', 'green', 'Mail'),
          blk('ser', F, 'UserSerializer', 'JSON', 'green', 'FileJson'),
        ],
        links: [link('repo', 'user', { label: 'uses' }), link('mailer', 'user', { label: 'uses' }), link('ser', 'user', { label: 'uses' })],
        flows: [
          { path: ['repo', 'user'], tone: 'request', label: 'save(user)', duration: 1.4 },
          { path: ['mailer', 'user'], tone: 'request', label: 'send(user)', duration: 1.4, delay: 0.5 },
          { path: ['ser', 'user'], tone: 'request', label: 'to_json(user)', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'A column rename now',
          icon: 'FileCode',
          rows: [
            { text: 'UserRepository', value: 'edited', tone: 'warn' },
            { text: 'WelcomeMailer', value: 'untouched', tone: 'good' },
            { text: 'UserSerializer', value: 'untouched', tone: 'good' },
          ],
          footer: { text: 'One reason, one class', tone: 'good' },
        },
        caption: 'Each reason gets its own class',
      },
      code: {
        language: 'python',
        title: 'Split by reason to change',
        source: `class User:
    def __init__(self, name, email):
        self.name = name
        self.email = email

class UserRepository:
    def save(self, user: User):
        print(f"INSERT INTO users VALUES ({user.name!r}, {user.email!r})")

class WelcomeMailer:
    def send(self, user: User):
        print(f"Sending welcome mail to {user.email}")

class UserSerializer:
    def to_json(self, user: User):
        return {"name": user.name, "email": user.email}`,
        highlight: [6, 10, 14],
      },
    },
    // 5
    {
      title: 'Right size',
      tag: 'tradeoff',
      heading: 'One reason to change is not one method',
      eli5: 'Do not give every single wipe of the board its own kid either. And a kid whose job is "everything else" is a junk drawer. Aim for one **reason** a teacher might change the job.',
      body: [
        'Splitting too far is its own mess. Things that always change together belong together, even if they have several methods.',
        'Spot too much in one class by its name (`XxxManager`, `XxxHelper`) or by 20 or more public methods. Spot too little by a change that always needs the same three classes edited.',
      ],
      keyIdea: 'Size a class by reasons to change, not by method count or line count.',
      metrics: { edits: '-', reasons: '1 per class', tests: '-', principle: 'SRP' },
      scene: {
        nodes: [
          blk('manager', A, 'UserManager', 'junk drawer', 'red', 'Boxes', { status: 'hot', badge: '20+ methods' }),
          blk('right', B, 'Split by reason', 'a few classes', 'green', 'Layers', { status: 'ok' }),
          blk('over', C, 'One per line', 'over-split', 'amber', 'Copy', { chips: [{ text: '7 classes to edit', tone: 'warn' }] }),
        ],
        panel: {
          title: 'Sizing signals',
          icon: 'Scale',
          rows: [
            { text: 'Name ends in Manager', value: 'too much', tone: 'bad' },
            { text: '20+ public methods', value: 'too much', tone: 'bad' },
            { text: 'Always edited together', value: 'too little', tone: 'warn' },
            { text: 'One team asks for changes', value: 'about right', tone: 'good' },
          ],
          footer: { text: 'Ask who requests the change', tone: 'muted' },
        },
        caption: 'Too much, too little, about right',
      },
    },
    // 6
    {
      title: 'If ladder',
      tag: 'case',
      heading: 'O: every new tier edits the same function',
      eli5: 'The snack helper has a long list: if Monday give apples, else if Tuesday give pears. Every new day means rewriting the **list**, and a typo can spoil Monday.',
      body: [
        'A `DiscountCalculator` picks a rate with an `if/elif` ladder on customer type: regular 5%, premium 10%, VIP 20%.',
        'Marketing wants a student tier, then a corporate tier. Each one means editing this class and retesting every tier, including ones nobody touched.',
      ],
      keyIdea: 'A ladder you must edit for every new case is a class closed to extension.',
      metrics: { edits: '2 per tier', reasons: '1 + each new tier', tests: 'retest all', principle: 'OCP' },
      metricTones: { edits: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          checkout,
          blk('calc', B, 'DiscountCalculator', 'if / elif ladder', 'gray', 'Receipt', { status: 'hot', badge: '3 branches' }),
          blk('mkt', E, 'Marketing', 'wants "student"', 'gray', 'Star'),
        ],
        links: [link('checkout', 'calc', { label: 'uses' }), link('mkt', 'calc', { label: 'asks for an edit', labelTone: 'warn' })],
        flows: [
          { path: ['checkout', 'calc'], tone: 'request', label: 'discount("vip", 100)', duration: 1.4 },
          { path: ['mkt', 'calc'], tone: 'error', label: 'add "student"', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The ladder',
          icon: 'Code',
          code: 'if type == "regular":  5%\nelif type == "premium": 10%\nelif type == "vip":     20%\n# student? edit here\n# corporate? edit again',
          footer: { text: 'Regression risk grows per tier', tone: 'bad' },
        },
        caption: 'Closed to extension',
      },
      code: {
        language: 'python',
        title: 'Violation: edit for every tier',
        source: `class DiscountCalculator:
    def discount(self, customer_type, amount):
        if customer_type == "regular":
            return amount * 0.05
        elif customer_type == "premium":
            return amount * 0.10
        elif customer_type == "vip":
            return amount * 0.20
        # student tier? edit here. corporate tier? edit again.
        return 0`,
        highlight: [3, 5, 7],
      },
    },
    // 7
    {
      title: 'Add, not edit',
      tag: 'concept',
      heading: 'Fix: a policy interface, one class per tier',
      eli5: 'Make one snack card per day and hand the helper whichever card is today\'s. A new day is a new card, and the helper never rewrites anything. The card is the **interface**.',
      body: [
        '**Open/closed**: software entities should be open for extension and closed for modification.',
        'Define a `DiscountPolicy` interface with one method. Each tier is its own class. The caller works with the interface, so it never learns which tier it holds.',
      ],
      keyIdea: 'Put the part that varies behind an interface, and variation becomes new classes, not edits.',
      metrics: { edits: '1 new file', reasons: '1 each', tests: 'new tier only', principle: 'OCP' },
      metricTones: { edits: 'good', tests: 'good' },
      scene: {
        nodes: [
          { ...checkout, sub: 'closed' },
          { ...policy, chips: ['discount(amount)'] },
          blk('regular', D, 'Regular', 'concrete', 'green', 'Package'),
          { ...premium, at: E },
          { ...vip, at: F },
        ],
        links: [
          link('checkout', 'policy', { label: 'has-a' }),
          link('regular', 'policy', { label: 'implements' }),
          link('premium', 'policy', { label: 'implements' }),
          link('vip', 'policy', { label: 'implements' }),
        ],
        flows: [{ path: ['checkout', 'policy', 'vip'], tone: 'request', label: 'discount(100)', duration: 1.8 }],
        panel: {
          title: 'The seam',
          icon: 'Plug',
          code: 'class DiscountPolicy(ABC):\n    def discount(self, amount): ...\n\napply(policy, amount)',
          footer: { text: 'Checkout never names a tier', tone: 'good' },
        },
        caption: 'Callers depend on the interface',
      },
      code: {
        language: 'python',
        title: 'One class per tier',
        source: `from abc import ABC, abstractmethod

class DiscountPolicy(ABC):
    @abstractmethod
    def discount(self, amount: float) -> float: ...

class RegularDiscount(DiscountPolicy):
    def discount(self, amount): return amount * 0.05

class PremiumDiscount(DiscountPolicy):
    def discount(self, amount): return amount * 0.10

class VIPDiscount(DiscountPolicy):
    def discount(self, amount): return amount * 0.20

def apply(policy: DiscountPolicy, amount):
    return amount - policy.discount(amount)`,
        highlight: [3, 5, 16, 17],
      },
    },
    // 8
    {
      title: 'New tier',
      tag: 'case',
      heading: 'The student tier is one new file',
      eli5: 'A new kid joins on Friday. We write one new snack card and the helper uses it. Monday\'s card is untouched, so Monday still works. That is **open for extension**.',
      body: [
        'Marketing asks for a student tier at 15%. Write `StudentDiscount`. Nothing in `Checkout`, `apply` or the other tiers changes.',
        'Only the new class needs a new test. The existing tiers keep their old tests, so the risk of breaking VIP is gone.',
      ],
      keyIdea: 'Extension means a new file with its own test. Existing, tested code stays frozen.',
      metrics: { edits: '1 new file', reasons: '1 each', tests: '1 new test', principle: 'OCP' },
      metricTones: { edits: 'good', tests: 'good' },
      scene: {
        nodes: [
          { ...checkout, sub: 'unchanged' },
          { ...policy, chips: ['discount(amount)'] },
          { ...premium, status: 'dim' },
          { ...vip, status: 'dim' },
          blk('student', F, 'Student', 'new class', 'green', 'Package', { status: 'active', badge: 'new file' }),
        ],
        links: [
          link('checkout', 'policy', { label: 'has-a' }),
          link('premium', 'policy', { label: 'implements' }),
          link('vip', 'policy', { label: 'implements' }),
          link('student', 'policy', { label: 'implements' }),
        ],
        flows: [{ path: ['checkout', 'policy', 'student'], tone: 'request', label: 'discount(200)', duration: 1.8 }],
        panel: {
          title: 'What changed',
          icon: 'Table',
          rows: [
            { text: 'Checkout', value: 'untouched', tone: 'good' },
            { text: 'apply()', value: 'untouched', tone: 'good' },
            { text: 'Premium, VIP', value: 'untouched', tone: 'good' },
            { text: 'StudentDiscount', value: 'new file', tone: 'warn' },
          ],
          footer: { text: '200 with 15% off = 170', tone: 'muted' },
        },
        caption: 'Adding, not editing',
      },
      code: {
        language: 'python',
        title: 'The whole change',
        source: `class StudentDiscount(DiscountPolicy):   # new tier: new class, no edits
    def discount(self, amount): return amount * 0.15

# the only new test
assert apply(StudentDiscount(), 200) == 170`,
        highlight: [1, 5],
      },
      quiz: {
        question: 'Marketing adds a corporate tier. In the OCP design, what changes?',
        options: [
          'The if/elif ladder in DiscountCalculator gets one more branch',
          'Checkout gets a new parameter for the tier name',
          'One new class implements DiscountPolicy, and nothing else is edited',
          'Every existing tier class is edited to know about the new one',
        ],
        answer: 2,
        explain: 'Checkout and apply() only know the DiscountPolicy interface. A new tier is a new implementation, so existing code and its tests stay as they are.',
      },
    },
    // 9
    {
      title: 'Closed to what',
      tag: 'tradeoff',
      heading: 'Closed against the changes that actually happen',
      eli5: 'You cannot make the class chart ready for every possible change. Leave alone what never changes and add cards only where changes keep coming. Be **closed** where it counts.',
      body: [
        'No class can be closed against every change. Closing it means choosing an axis, and a wrong guess is a speculative abstraction that nobody uses.',
        'Wait for the change to show up, then close that axis. The first `if` is fine. When the second case arrives, you now know the real axis, so extract the interface.',
      ],
      keyIdea: 'Close a class against the change you have seen twice, not the one you can imagine.',
      metrics: { edits: '-', reasons: '-', tests: '-', principle: 'OCP' },
      scene: {
        nodes: [
          blk('axis', A, 'Tiers', 'keep growing', 'green', 'TrendingUp', { status: 'ok', badge: 'close it' }),
          blk('stable', B, 'Rounding', 'never changes', 'gray', 'Scale', { chips: ['edit if needed'] }),
          blk('early', C, 'Plugin framework', 'no 2nd plugin', 'amber', 'Boxes', { status: 'hot', badge: 'too early' }),
        ],
        panel: {
          title: 'When to extract',
          icon: 'List',
          rows: [
            { text: '1st case', value: 'plain if', tone: 'good' },
            { text: '2nd case', value: 'extract the seam', tone: 'good' },
            { text: 'Never seen a 2nd', value: 'do not guess', tone: 'warn' },
            { text: 'Speculative interface', value: 'a bet against reality', tone: 'bad' },
          ],
          footer: { text: 'Let real change pick the seam', tone: 'muted' },
        },
        caption: 'Pick the axis that really moves',
      },
    },
    // 10
    {
      title: 'Square trap',
      tag: 'concept',
      heading: 'L: a square is a rectangle in geometry only',
      eli5: 'A square is a rectangle in math class. But a sticker that stays square when you stretch one side is not a stretchy rectangle sticker. Being a **subtype** takes more than a matching name.',
      body: [
        '**Liskov substitution**: a subtype must be usable wherever its parent is expected, without surprising the caller.',
        'Geometry says a square is a rectangle, so `Square` extends `Rectangle`. To keep its sides equal, `Square` overrides both setters to change width and height together.',
      ],
      keyIdea: 'Inheriting the data is easy. The hard part is keeping the parent\'s behavior promises.',
      metrics: { edits: '-', reasons: '-', tests: '-', principle: 'LSP' },
      scene: {
        nodes: [
          blk('stretch', A, 'stretch()', 'caller', 'green', 'Code'),
          rect({ chips: ['set_width()', 'set_height()', 'area()'] }),
          blk('square', E, 'Square', 'keeps w == h', 'green', 'Package', { status: 'active' }),
        ],
        links: [link('stretch', 'rect', { label: 'uses' }), link('square', 'rect', { label: 'extends' })],
        flows: [{ path: ['stretch', 'rect'], tone: 'request', label: 'a Rectangle, surely', duration: 1.6 }],
        panel: {
          title: 'Square overrides both',
          icon: 'Code',
          code: 'class Square(Rectangle):\n    def set_width(self, w):\n        self.w = w\n        self.h = w\n    def set_height(self, h):\n        self.w = h\n        self.h = h',
          footer: { text: 'Looks fine until someone stretches it', tone: 'warn' },
        },
        caption: 'Square extends Rectangle',
      },
      code: {
        language: 'python',
        title: 'Square extends Rectangle',
        source: `class Rectangle:
    def __init__(self, w, h):
        self.w = w
        self.h = h
    def set_width(self, w):  self.w = w
    def set_height(self, h): self.h = h
    def area(self): return self.w * self.h

class Square(Rectangle):
    def set_width(self, w):
        self.w = w
        self.h = w
    def set_height(self, h):
        self.w = h
        self.h = h`,
        highlight: [9, 10, 13],
      },
    },
    // 11
    {
      title: 'The trace',
      tag: 'case',
      heading: 'Stretch a square and the assert fails',
      eli5: 'Ask the sticker to be 10 wide, then 5 tall, and you expect 50 squares of space. The square sticker grows both ways and gives 25. The helper expected a **promise** and got a surprise.',
      body: [
        '`stretch(r)` is written for a `Rectangle`: set width 10, set height 5, expect area 50. A real rectangle passes.',
        'Hand it a `Square` and `set_height(5)` also resets the width to 5. Area is 25. The bug shows up in `stretch`, far from the subclass that caused it.',
      ],
      keyIdea: 'If generic code breaks on a subclass, the subclass broke the parent\'s contract.',
      metrics: { edits: '-', reasons: '-', tests: 'assert fails', principle: 'LSP' },
      metricTones: { tests: 'bad' },
      scene: {
        nodes: [
          blk('stretch', A, 'stretch()', 'expects 50', 'green', 'Code', { status: 'hot' }),
          rect({ status: 'dim' }),
          blk('square', E, 'Square', 'w == h', 'green', 'Package', { status: 'hot', badge: 'area = 25' }),
        ],
        links: [link('stretch', 'rect', { label: 'expects' }), link('square', 'rect', { label: 'extends' })],
        flows: [
          { path: ['stretch', 'rect', 'square'], tone: 'request', label: 'set_width(10)', duration: 1.4 },
          { path: ['stretch', 'rect', 'square'], tone: 'request', label: 'set_height(5)', duration: 1.4, delay: 1.5 },
          { path: ['square', 'rect', 'stretch'], tone: 'error', label: 'area() = 25', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'State after each call',
          icon: 'Table',
          rows: [
            { text: 'Square(4, 4)', value: 'w=4 h=4' },
            { text: 'set_width(10)', value: 'w=10 h=10', tone: 'warn' },
            { text: 'set_height(5)', value: 'w=5 h=5', tone: 'bad' },
            { text: 'area()', value: '25, expected 50', tone: 'bad' },
          ],
          footer: { text: 'Square is not substitutable', tone: 'bad' },
        },
        caption: 'The bug appears far from the cause',
      },
      code: {
        language: 'python',
        title: 'Generic code, specific failure',
        source: `def stretch(r: Rectangle):
    r.set_width(10)
    r.set_height(5)
    assert r.area() == 50

stretch(Rectangle(2, 3))   # passes
stretch(Square(4, 4))      # AssertionError: area is 25`,
        highlight: [4, 7],
      },
    },
    // 12
    {
      title: 'Siblings',
      tag: 'concept',
      heading: 'Fix: do not force is-a when behavior differs',
      eli5: 'Make rectangle and square two kinds of shape instead. Each tells its own area, and nobody expects a square to stretch. They are **siblings**, not parent and child.',
      body: [
        'Pull out what both really share: they have an area. A `Shape` interface declares `area()`. `Rectangle` and `Square` each implement it as siblings.',
        'The mutating setters stay on `Rectangle` only, where they are safe. Code that needs a shape asks for a `Shape` and gets honest behavior from every kind.',
      ],
      keyIdea: 'Model what the types promise, not what they resemble in the real world.',
      metrics: { edits: '-', reasons: '-', tests: 'assert passes', principle: 'LSP' },
      metricTones: { tests: 'good' },
      scene: {
        nodes: [
          blk('report', A, 'print_area()', 'caller', 'green', 'Code'),
          blk('shape', B, 'Shape', 'abstract', 'blue', 'Layers', { chips: ['area()'] }),
          blk('rect', D, 'Rectangle', 'w, h', 'green', 'Package'),
          blk('square', F, 'Square', 'side', 'green', 'Package', { status: 'ok' }),
        ],
        links: [link('report', 'shape', { label: 'uses' }), link('rect', 'shape', { label: 'extends' }), link('square', 'shape', { label: 'extends' })],
        flows: [
          { path: ['report', 'shape', 'square'], tone: 'request', label: 'area()', duration: 1.6 },
          { path: ['square', 'shape', 'report'], tone: 'response', label: '16', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Who promises what',
          icon: 'Scale',
          rows: [
            { text: 'Shape', value: 'has an area', tone: 'good' },
            { text: 'Rectangle', value: 'area = w * h', tone: 'good' },
            { text: 'Square', value: 'area = side ** 2', tone: 'good' },
            { text: 'Square is a Rectangle?', value: 'no promise made', tone: 'muted' },
          ],
          footer: { text: 'Siblings, not parent and child', tone: 'good' },
        },
        caption: 'Share the promise, not the setters',
      },
      code: {
        language: 'python',
        title: 'Siblings under Shape',
        source: `from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Rectangle(Shape):
    def __init__(self, w, h): self.w, self.h = w, h
    def area(self): return self.w * self.h

class Square(Shape):         # sibling, not child
    def __init__(self, side): self.side = side
    def area(self): return self.side ** 2

def print_area(shape: Shape):
    print(shape.area())`,
        highlight: [3, 11, 15],
      },
    },
    // 13
    {
      title: 'Parent promises',
      tag: 'concept',
      heading: 'What a subtype must keep',
      eli5: 'A substitute teacher must do what the regular teacher promised: take attendance, no new surprises. A substitute who locks the classroom door breaks the **promise**.',
      body: [
        'A subtype may accept more and promise more. It may not demand more, deliver less, or raise errors the parent never raised.',
        'Two smells give it away: an `isinstance` check in the caller, and an override that just raises `NotImplementedError` or a new exception.',
      ],
      keyIdea: 'A subtype can strengthen what it gives and relax what it needs, never the reverse.',
      metrics: { edits: '-', reasons: '-', tests: '-', principle: 'LSP' },
      scene: {
        nodes: [
          blk('payroll', A, 'run_payroll()', 'caller', 'green', 'Code', { status: 'hot' }),
          blk('account', B, 'Account', 'withdraw(amount)', 'blue', 'Layers'),
          blk('savings', D, 'Savings', 'keeps promise', 'green', 'Package', { status: 'ok' }),
          blk('fixed', F, 'FixedDeposit', 'raises Locked', 'green', 'Package', { status: 'hot', chips: [{ text: 'PermissionError', tone: 'bad' }] }),
        ],
        links: [link('payroll', 'account', { label: 'uses' }), link('savings', 'account', { label: 'extends' }), link('fixed', 'account', { label: 'extends' })],
        flows: [{ path: ['payroll', 'account', 'fixed'], tone: 'error', label: 'withdraw(50)', duration: 1.8 }],
        panel: {
          title: 'The subtype rules',
          icon: 'Scale',
          rows: [
            { text: 'Inputs', value: 'accept the same or more', tone: 'good' },
            { text: 'Results', value: 'promise the same or more', tone: 'good' },
            { text: 'Errors', value: 'no new surprises', tone: 'warn' },
            { text: 'Invariants', value: 'keep the parent\'s', tone: 'good' },
          ],
          footer: { text: 'Smell: isinstance or NotImplementedError', tone: 'warn' },
        },
        caption: 'The parent\'s contract binds every child',
      },
      code: {
        language: 'python',
        title: 'A child that adds a rule',
        source: `class Account:
    def withdraw(self, amount):
        """Takes amount from the balance. Works for any amount up to the balance."""
        self.balance -= amount

class FixedDepositAccount(Account):
    def withdraw(self, amount):
        raise PermissionError("locked until maturity")   # a rule the caller never saw

def run_payroll(account: Account, pay):
    account.withdraw(pay)       # blows up for a fixed deposit`,
        highlight: [3, 8, 11],
      },
    },
    // 14
    {
      title: 'Fat interface',
      tag: 'case',
      heading: 'I: a printer forced to implement scan and fax',
      eli5: 'The class gets one giant job card with print, scan and fax on it. The kid who only prints must sign for scan and fax and then say "I can\'t". That is a **fat card**.',
      body: [
        '**Interface segregation**: clients should not be forced to depend on methods they do not use.',
        '`MultiFunctionDevice` declares `print`, `scan` and `fax`. A `SimplePrinter` has to implement all three, so it fills two with `raise NotImplementedError`. Callers cannot tell which methods are real.',
      ],
      keyIdea: 'A method an implementer can only stub out does not belong on that interface.',
      metrics: { edits: '-', reasons: '-', tests: 'fake all 3', principle: 'ISP' },
      metricTones: { tests: 'bad' },
      scene: {
        nodes: [
          blk('job', A, 'Report job', 'only prints', 'green', 'FileText'),
          blk('device', B, 'MultiFunctionDevice', 'interface', 'violet', 'Plug', { chips: ['print()', 'scan()', 'fax()'] }),
          blk('simple', E, 'SimplePrinter', 'prints only', 'green', 'Package', { status: 'hot', chips: [{ text: 'scan() raises', tone: 'bad' }, { text: 'fax() raises', tone: 'bad' }] }),
        ],
        links: [link('job', 'device', { label: 'uses' }), link('simple', 'device', { label: 'implements' })],
        flows: [
          { path: ['job', 'device'], tone: 'request', label: 'print(doc)', duration: 1.4 },
          { path: ['device', 'simple'], tone: 'error', label: 'scan(doc)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Forced to implement',
          icon: 'Bug',
          rows: [
            { text: 'print()', value: 'real', tone: 'good' },
            { text: 'scan()', value: 'NotImplementedError', tone: 'bad' },
            { text: 'fax()', value: 'NotImplementedError', tone: 'bad' },
          ],
          footer: { text: 'Also a Liskov violation', tone: 'warn' },
        },
        caption: 'One fat interface for every device',
      },
      code: {
        language: 'python',
        title: 'Violation: SimplePrinter stubs two methods',
        source: `from abc import ABC, abstractmethod

class MultiFunctionDevice(ABC):
    @abstractmethod
    def print(self, doc): ...
    @abstractmethod
    def scan(self, doc): ...
    @abstractmethod
    def fax(self, doc): ...

class SimplePrinter(MultiFunctionDevice):
    def print(self, doc): print("printing", doc)
    def scan(self, doc): raise NotImplementedError
    def fax(self, doc):  raise NotImplementedError`,
        highlight: [7, 9, 13, 14],
      },
    },
    // 15
    {
      title: 'Small interfaces',
      tag: 'concept',
      heading: 'Fix: many small interfaces, composed when needed',
      eli5: 'Cut the big card into three small ones: print, scan, fax. A kid signs only the cards they can do, and a super kid signs all three. Small cards are **segregated**.',
      body: [
        'Split the fat interface by capability: `Printer`, `Scanner`, `Fax`. A `SimplePrinter` implements only `Printer`.',
        'An `OfficeMFP` implements all three. Combining small interfaces is easy. Taking methods out of a fat one breaks every implementer.',
      ],
      keyIdea: 'Design interfaces around what a client needs, and let one class implement several.',
      metrics: { edits: '-', reasons: '-', tests: '1 per interface', principle: 'ISP' },
      metricTones: { tests: 'good' },
      scene: {
        nodes: [
          blk('printer', A, 'Printer', 'interface', 'violet', 'Plug', { chips: ['print()'] }),
          blk('scanner', B, 'Scanner', 'interface', 'violet', 'Plug', { chips: ['scan()'] }),
          blk('fax', C, 'Fax', 'interface', 'violet', 'Plug', { chips: ['fax()'] }),
          blk('simple', at(-1.8, 3.8), 'SimplePrinter', 'Printer only', 'green', 'Package', { status: 'ok' }),
          blk('office', at(1.8, 3.8), 'OfficeMFP', 'all three', 'green', 'Package'),
        ],
        links: [
          link('simple', 'printer', { label: 'implements' }),
          link('office', 'printer', { label: 'implements' }),
          link('office', 'scanner', { label: 'implements' }),
          link('office', 'fax', { label: 'implements' }),
        ],
        flows: [{ path: ['office', 'scanner'], tone: 'response', label: 'scan(doc)', duration: 1.6 }],
        panel: {
          title: 'Who implements what',
          icon: 'Table',
          rows: [
            { text: 'SimplePrinter', value: 'Printer', tone: 'good' },
            { text: 'OfficeMFP', value: 'Printer, Scanner, Fax', tone: 'good' },
            { text: 'Stubbed methods', value: '0', tone: 'good' },
          ],
          footer: { text: 'No NotImplementedError left', tone: 'good' },
        },
        caption: 'Capabilities as small interfaces',
      },
      code: {
        language: 'python',
        title: 'Split by capability',
        source: `from abc import ABC, abstractmethod

class Printer(ABC):
    @abstractmethod
    def print(self, doc): ...

class Scanner(ABC):
    @abstractmethod
    def scan(self, doc): ...

class Fax(ABC):
    @abstractmethod
    def fax(self, doc): ...

class SimplePrinter(Printer):
    def print(self, doc): print("printing", doc)

class OfficeMFP(Printer, Scanner, Fax):
    def print(self, doc): ...
    def scan(self, doc): ...
    def fax(self, doc): ...`,
        highlight: [15, 18],
      },
    },
    // 16
    {
      title: 'Small fakes',
      tag: 'concept',
      heading: 'Small interfaces make small test fakes',
      eli5: 'The scan helper only needs the scan card. In a rehearsal a pretend kid signs one tiny card, not three. Small cards mean easy pretend kids, called **fakes**.',
      body: [
        'A client depends on exactly the interface it uses. `ScanToEmail` asks for a `Scanner`, so it does not care about printing or fax.',
        'A test fake implements one method. Under the fat interface it would implement three. Mocks get small, and a change to `Fax` cannot break `ScanToEmail`.',
      ],
      keyIdea: 'The smaller the interface a client depends on, the smaller its fakes and the fewer reasons it has to change.',
      metrics: { edits: '-', reasons: '1', tests: '1 method', principle: 'ISP' },
      metricTones: { reasons: 'good', tests: 'good' },
      scene: {
        nodes: [
          blk('scan-job', A, 'ScanToEmail', 'client', 'green', 'Mail'),
          blk('scanner', B, 'Scanner', 'interface', 'violet', 'Plug', { chips: ['scan(doc)'] }),
          blk('fake', D, 'FakeScanner', 'test double', 'green', 'Bug', { status: 'active', badge: '1 method' }),
          blk('office', F, 'OfficeMFP', 'real device', 'green', 'Package'),
        ],
        links: [
          link('scan-job', 'scanner', { label: 'has-a' }),
          link('fake', 'scanner', { label: 'implements' }),
          link('office', 'scanner', { label: 'implements' }),
        ],
        flows: [
          { path: ['scan-job', 'scanner', 'fake'], tone: 'request', label: 'scan("page")', duration: 1.6 },
          { path: ['fake', 'scanner', 'scan-job'], tone: 'response', label: '"scan:page"', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'What a test must fake',
          icon: 'Scale',
          rows: [
            { text: 'Fat interface', value: '3 methods', tone: 'bad' },
            { text: 'Scanner only', value: '1 method', tone: 'good' },
            { text: 'Fax change breaks ScanToEmail', value: 'no', tone: 'good' },
          ],
          footer: { text: 'Depend on what you use', tone: 'good' },
        },
        caption: 'Small interface, small fake',
      },
      code: {
        language: 'python',
        title: 'A one-method fake',
        source: `class ScanToEmail:
    def __init__(self, scanner: Scanner):
        self.scanner = scanner
    def run(self, mailbox):
        mailbox.append(self.scanner.scan("page"))

class FakeScanner(Scanner):          # one method to fake, not three
    def scan(self, doc): return "scan:" + doc

box = []
ScanToEmail(FakeScanner()).run(box)
assert box == ["scan:page"]`,
        highlight: [2, 7, 8],
      },
      quiz: {
        question: 'SimplePrinter implements MultiFunctionDevice and raises NotImplementedError in scan(). Which principles does that break?',
        options: [
          'Only single responsibility',
          'Interface segregation, because it must implement a method it does not use, and Liskov, because callers cannot trust scan()',
          'Only open/closed, because the device cannot be extended',
          'None, raising an error is a normal way to say "not supported"',
        ],
        answer: 1,
        explain: 'The interface is too fat (ISP), and a subtype that refuses a method its parent promised cannot stand in for the parent (LSP). Splitting the interface fixes both.',
      },
    },
    // 17
    {
      title: 'Hard-wired',
      tag: 'case',
      heading: 'D: the service creates its own database',
      eli5: 'The snack helper walks to one particular shop and buys from it. If that shop closes, or you want to rehearse without a shop, the helper is stuck. The shop is **hard-wired**.',
      body: [
        '`OrderService` builds a `MySQLDatabase` in its own constructor. The business logic now names a vendor.',
        'Migrating to Postgres means editing every class like it. Unit testing is impossible, because there is a real MySQL connection inside.',
      ],
      keyIdea: 'A class that creates its own dependency cannot be tested or moved without editing it.',
      metrics: { edits: 'every service', reasons: '2', tests: 'real MySQL', principle: 'DIP' },
      metricTones: { edits: 'bad', tests: 'bad' },
      scene: {
        nodes: [
          blk('test', A, 'Unit test', 'wants no server', 'gray', 'Bug'),
          { ...service, at: B, status: 'hot', sub: 'imports MySQL' },
          blk('mysql', E, 'MySQLDatabase', 'concrete', 'gray', 'Database'),
        ],
        links: [link('test', 'service', { label: 'calls' }), link('service', 'mysql', { label: 'creates', labelTone: 'warn' })],
        flows: [
          { path: ['test', 'service'], tone: 'request', label: 'place_order()', duration: 1.4 },
          { path: ['service', 'mysql'], tone: 'error', label: 'query(INSERT ...)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Cost of the new',
          icon: 'Code',
          code: 'class OrderService:\n    def __init__(self):\n        self.db = MySQLDatabase()\n\n# Postgres? edit this.\n# Test? needs real MySQL.',
          footer: { text: 'High-level code names a low-level vendor', tone: 'bad' },
        },
        caption: 'The service owns its dependency',
      },
      code: {
        language: 'python',
        title: 'Violation: hard-coded dependency',
        source: `class MySQLDatabase:
    def query(self, sql): print("mysql:", sql)

class OrderService:
    def __init__(self):
        self.db = MySQLDatabase()   # hard-coded dependency

    def place_order(self, order):
        self.db.query("INSERT INTO orders ...")`,
        highlight: [6, 9],
      },
    },
    // 18
    {
      title: 'Flip it',
      tag: 'concept',
      heading: 'Fix: depend on an interface, inject the concrete',
      eli5: 'Tell the helper "get snacks from any shop that follows the shop rules" and let the teacher say which one. The helper now depends on the rules, not a shop. That is **dependency inversion**.',
      body: [
        '**Dependency inversion**: high-level modules should not depend on low-level modules. Both should depend on abstractions.',
        '`OrderService` takes a `Database` interface in its constructor. `MySQLDatabase` and `PostgresDatabase` implement it. The arrow from the service to the vendor is gone, and the vendor now points at the interface.',
      ],
      keyIdea: 'Business logic depends on an interface, and the vendor class depends on it too.',
      metrics: { edits: '1 new file', reasons: '1', tests: 'no server', principle: 'DIP' },
      metricTones: { edits: 'good', tests: 'good' },
      scene: {
        nodes: [
          { ...service, sub: 'depends on Database' },
          { ...database, chips: ['query(sql)'] },
          blk('mysql', D, 'MySQL', 'implements', 'green', 'Database'),
          blk('postgres', F, 'Postgres', 'implements', 'green', 'Database'),
        ],
        links: [
          link('service', 'database', { label: 'has-a' }),
          link('mysql', 'database', { label: 'implements' }),
          link('postgres', 'database', { label: 'implements' }),
        ],
        flows: [{ path: ['service', 'database', 'postgres'], tone: 'request', label: 'query(sql)', duration: 1.8 }],
        panel: {
          title: 'Arrows before and after',
          icon: 'Route',
          rows: [
            { text: 'Before', value: 'Service -> MySQL', tone: 'bad' },
            { text: 'After', value: 'Service -> Database', tone: 'good' },
            { text: 'After', value: 'MySQL -> Database', tone: 'good' },
          ],
          footer: { text: 'The dependency points at the abstraction', tone: 'good' },
        },
        caption: 'Both sides depend on the interface',
      },
      code: {
        language: 'python',
        title: 'Inject an abstraction',
        source: `from abc import ABC, abstractmethod

class Database(ABC):
    @abstractmethod
    def query(self, sql): ...

class MySQLDatabase(Database):
    def query(self, sql): print("mysql:", sql)

class PostgresDatabase(Database):
    def query(self, sql): print("postgres:", sql)

class OrderService:
    def __init__(self, db: Database):
        self.db = db

    def place_order(self, order):
        self.db.query("INSERT INTO orders ...")`,
        highlight: [3, 13, 14],
      },
    },
    // 19
    {
      title: 'Swap in tests',
      tag: 'case',
      heading: 'Production gets Postgres, the test gets a list',
      eli5: 'On rehearsal day the teacher hands the helper a pretend shop with a notebook. On real days, a real shop. The helper never notices, and the notebook shows what it asked for. That is a **fake** shop.',
      body: [
        'An `InMemoryDatabase` implements the same interface and appends each statement to a list. No server, no setup, no cleanup.',
        'The same `OrderService` runs against Postgres in production and against the list in a unit test. A vendor swap is one line at the wiring point, not a three-month project.',
      ],
      keyIdea: 'Once the dependency is an interface, tests and vendor swaps need no edits to the business code.',
      metrics: { edits: '0', reasons: '1', tests: 'in-memory', principle: 'DIP' },
      metricTones: { edits: 'good', tests: 'good' },
      scene: {
        nodes: [
          blk('test', A, 'Unit test', 'no server', 'gray', 'Bug'),
          { ...service, at: B, sub: 'unchanged', status: 'ok' },
          { ...database, at: C },
          blk('memory', D, 'InMemory', 'test fake', 'green', 'List', { status: 'active', badge: 'log = []' }),
          blk('postgres', F, 'Postgres', 'production', 'green', 'Database', { status: 'dim' }),
        ],
        links: [
          link('test', 'service', { label: 'calls' }),
          link('service', 'database', { label: 'has-a' }),
          link('memory', 'database', { label: 'implements' }),
          link('postgres', 'database', { label: 'implements' }),
        ],
        flows: [
          { path: ['test', 'service'], tone: 'request', label: 'place_order()', duration: 1.3 },
          { path: ['service', 'database', 'memory'], tone: 'request', label: 'query(sql)', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Two wirings, one service',
          icon: 'Table',
          rows: [
            { text: 'Production', value: 'PostgresDatabase()', tone: 'good' },
            { text: 'Unit test', value: 'InMemoryDatabase()', tone: 'good' },
            { text: 'OrderService edits', value: '0', tone: 'good' },
          ],
          footer: { text: 'Assert on the log, not on a server', tone: 'muted' },
        },
        caption: 'Same service, different wiring',
      },
      code: {
        language: 'python',
        title: 'A fake database for tests',
        source: `class InMemoryDatabase(Database):
    def __init__(self): self.log = []
    def query(self, sql): self.log.append(sql)

# production wiring
OrderService(PostgresDatabase()).place_order({})

# test wiring
svc = OrderService(InMemoryDatabase())
svc.place_order({})
assert len(svc.db.log) == 1`,
        highlight: [1, 6, 9, 11],
      },
    },
    // 20
    {
      title: 'Who wires',
      tag: 'concept',
      heading: 'One place names the concrete classes',
      eli5: 'The teacher at the door picks the shop and hands it to the helper. The helper never goes shopping for a shop. That teacher is the **composition root**.',
      body: [
        'Dependency inversion is the design rule. **Dependency injection** is the technique: pass the dependency in. Someone still has to pick `PostgresDatabase`, and it should be one place near program start, often `main`.',
        'The interface sits with the code that uses it. `Database` serves `OrderService`, so the service sets the terms, not the vendor.',
      ],
      keyIdea: 'Keep new and concrete class names at the edge, and let everything inside depend on interfaces.',
      metrics: { edits: '1 line to swap', reasons: '1', tests: 'no server', principle: 'DIP' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [
          blk('main', A, 'main()', 'composition root', 'green', 'Cable', { status: 'active' }),
          { ...service, at: B, sub: 'sees only Database' },
          { ...database, at: E },
          blk('postgres', F, 'Postgres', 'the one concrete name', 'green', 'Database'),
        ],
        links: [
          link('main', 'service', { label: 'creates' }),
          link('main', 'postgres', { label: 'creates' }),
          link('service', 'database', { label: 'has-a' }),
          link('postgres', 'database', { label: 'implements' }),
        ],
        flows: [
          { path: ['main', 'postgres'], tone: 'request', label: 'PostgresDatabase()', duration: 1.4 },
          { path: ['main', 'service'], tone: 'request', label: 'OrderService(db)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What imports what',
          icon: 'List',
          rows: [
            { text: 'OrderService imports', value: 'Database', tone: 'good' },
            { text: 'PostgresDatabase imports', value: 'Database', tone: 'good' },
            { text: 'main() imports', value: 'both', tone: 'warn' },
          ],
          footer: { text: 'Concrete names live at the edge', tone: 'muted' },
        },
        caption: 'Wire once, near startup',
      },
      code: {
        language: 'python',
        title: 'The composition root',
        source: `def main():
    db = PostgresDatabase()          # the only place that names a concrete class
    service = OrderService(db)       # handed in, not created inside
    service.place_order({})

if __name__ == "__main__":
    main()`,
        highlight: [2, 3],
      },
    },
    // 21
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: five principles, one habit',
      eli5: 'One job per kid, new snack cards without rewriting the chart, substitutes who keep promises, small job cards, and asking for a role. Together they keep the **class chart** easy to change.',
      body: [
        '**S** gives each class one reason to change. **O** adds behavior as new classes behind an interface. **L** keeps subtypes honest to the parent\'s promises. **I** keeps interfaces small. **D** makes business code depend on interfaces and wires the concrete ones in one place.',
        'Use them as a lens on real pain. Part 2 covers the supporting ideas and how to know when to apply which.',
      ],
      keyIdea: 'Recognize the violation in your own code first, then pick the principle that removes it.',
      metrics: { edits: '1 file', reasons: '1', tests: 'no server', principle: 'SOLID' },
      metricTones: { edits: 'good', reasons: 'good', tests: 'good' },
      scene: {
        nodes: letters('ok'),
        panel: {
          title: 'What a violation feels like',
          icon: 'List',
          rows: [
            { text: 'S', value: 'every team edits one file' },
            { text: 'O', value: 'an if/elif ladder grows' },
            { text: 'L', value: 'isinstance in the caller' },
            { text: 'I', value: 'NotImplementedError stubs' },
            { text: 'D', value: 'tests need a real server' },
          ],
          footer: { text: 'Each one points at a fix', tone: 'good' },
        },
        caption: 'Five principles, five smells',
      },
      quiz: {
        question: 'A test for OrderService needs a running Postgres server. Which principle is being broken, and what is the fix?',
        options: [
          'Single responsibility: split OrderService into two classes',
          'Dependency inversion: depend on a Database interface and inject a fake in tests',
          'Liskov substitution: make Postgres extend MySQL',
          'Open/closed: add an if branch for the test environment',
        ],
        answer: 1,
        explain: 'The service creates or names a concrete database. Depending on an interface and passing the implementation in lets a test hand it an in-memory fake.',
      },
    },
  ],
};
