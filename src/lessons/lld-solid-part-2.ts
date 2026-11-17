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

// A row of three or four blocks across the middle
const ROW3 = [at(-5.4, 0), at(0, 0), at(5.4, 0)];
const ROW4 = [at(-7.2, 0), at(-2.4, 0), at(2.4, 0), at(7.2, 0)];

export const lldSolidPart2: Lesson = {
  id: 'lld-solid-part-2',
  title: 'SOLID principles (part 2)',
  tagline: 'The supporting ideas around SOLID: DRY, KISS, YAGNI, cohesion and coupling, and how smells point you to the right principle.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why applying SOLID everywhere makes code worse, not better',
    'DRY, KISS and YAGNI, and what DRY actually means (knowledge, not characters)',
    'Cohesion and coupling: the two measures most SOLID principles push toward',
    'Code smells (god class, shotgun surgery, rigid class) and the principle each one points to',
    'The four principles worth memorizing, and how patterns fall out of smells',
  ],
  metrics: [
    { key: 'files', label: 'Files to read', icon: 'FileCode' },
    { key: 'cohesion', label: 'Cohesion', icon: 'Layers' },
    { key: 'coupling', label: 'Coupling', icon: 'Network' },
    { key: 'rule', label: 'Rule', icon: 'Scale' },
  ],
  steps: [
    // 1
    {
      title: 'Over-applied',
      tag: 'problem',
      heading: 'Four classes to print one greeting',
      eli5: 'The class job chart got so fancy that to hand out one crayon you fill in a form, give it to a form checker, who finds the crayon helper. Rules should help, and **over-design** only adds steps.',
      body: [
        'A team learned SOLID and applied it to everything. A greeter has an interface, one implementation, a factory interface and one factory implementation.',
        'Reading one feature means reading four classes, and every interface has exactly one class behind it. Nothing was hurting before, and now everything is harder to read.',
      ],
      keyIdea: 'A principle applied without pain to relieve is ceremony. It costs reading time and buys nothing.',
      metrics: { files: '4 classes for one call', cohesion: '-', coupling: '-', rule: 'none, applied by reflex' },
      metricTones: { files: 'bad' },
      scene: {
        nodes: [
          blk('caller', A, 'Caller', 'wants "hello"', 'green', 'Code'),
          blk('ifactory', B, 'IGreeterFactory', 'interface, 1 impl', 'violet', 'Plug', { status: 'hot' }),
          blk('factory', C, 'GreeterFactoryImpl', 'the only factory', 'green', 'Package'),
          blk('greeter', F, 'GreeterImpl', 'the only greeter', 'green', 'Package'),
        ],
        links: [link('caller', 'ifactory', { label: 'uses' }), link('factory', 'ifactory', { label: 'implements' }), link('factory', 'greeter', { label: 'creates' })],
        flows: [{ path: ['caller', 'ifactory', 'factory', 'greeter'], tone: 'request', label: 'create().greet()', duration: 2.2 }],
        panel: {
          title: 'One feature, four classes',
          icon: 'FileCode',
          rows: [
            { text: 'IGreeter', value: '1 implementation', tone: 'warn' },
            { text: 'IGreeterFactory', value: '1 implementation', tone: 'warn' },
            { text: 'Second case in sight', value: 'none', tone: 'bad' },
            { text: 'Test pain today', value: 'none', tone: 'bad' },
          ],
          footer: { text: 'Every interface is a bet', tone: 'bad' },
        },
        caption: 'Principles used as decoration',
      },
      code: {
        language: 'python',
        title: 'Four classes for "hello"',
        source: `from abc import ABC, abstractmethod

class IGreeter(ABC):
    @abstractmethod
    def greet(self) -> str: ...

class GreeterImpl(IGreeter):
    def greet(self): return "hello"

class IGreeterFactory(ABC):
    @abstractmethod
    def create(self) -> IGreeter: ...

class GreeterFactoryImpl(IGreeterFactory):
    def create(self): return GreeterImpl()

# the whole feature:
print(GreeterFactoryImpl().create().greet())`,
        highlight: [3, 10, 14, 18],
      },
    },
    // 2
    {
      title: 'DRY broken',
      tag: 'case',
      heading: 'DRY: the tax rate lives in three places',
      eli5: 'Three kids each copied the snack price onto their own note. When the price changes, one kid forgets to fix their note. Copying a fact is how **DRY** gets broken.',
      body: [
        '**DRY** (don\'t repeat yourself): every piece of knowledge should have one unambiguous home in the system.',
        'Here the 8% tax rate is typed into a price function, a cart total and an invoice total. The government changes the rate. Two of three get fixed, and invoices are wrong for weeks.',
      ],
      keyIdea: 'Duplicated knowledge drifts. One copy always gets missed when it changes.',
      metrics: { files: '3', cohesion: '-', coupling: '-', rule: 'DRY' },
      metricTones: { files: 'bad' },
      scene: {
        nodes: [
          blk('price', A, 'price_with_tax', '* 1.08', 'green', 'Receipt'),
          blk('cart', B, 'cart_total', '* 1.08', 'green', 'ShoppingBag'),
          blk('invoice', C, 'invoice_total', '* 1.08', 'green', 'FileText', { status: 'hot', badge: 'missed it' }),
          blk('law', E, 'Rate change', '8% becomes 9%', 'gray', 'TrendingUp'),
        ],
        links: [link('law', 'price', { label: 'edit' }), link('law', 'cart', { label: 'edit' }), link('law', 'invoice', { label: 'edit', labelTone: 'warn' })],
        flows: [
          { path: ['law', 'price'], tone: 'response', label: 'fixed', duration: 1.4 },
          { path: ['law', 'cart'], tone: 'response', label: 'fixed', duration: 1.4, delay: 0.5 },
          { path: ['law', 'invoice'], tone: 'error', label: 'forgotten', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'One fact, three copies',
          icon: 'Table',
          rows: [
            { text: 'price_with_tax_us', value: 'p * 1.08' },
            { text: 'cart_total', value: 'price * 1.08' },
            { text: 'invoice_total', value: 'amount * 1.08', tone: 'bad' },
          ],
          footer: { text: 'One missed edit is a production bug', tone: 'bad' },
        },
        caption: 'The same knowledge copied three times',
      },
      code: {
        language: 'python',
        title: 'Bad: the rate is copied',
        source: `def price_with_tax_us(p):   return p * 1.08
def cart_total(items):      return sum(i.price * 1.08 for i in items)
def invoice_total(lines):   return sum(l.amount * 1.08 for l in lines)`,
        highlight: [1, 2, 3],
      },
    },
    // 3
    {
      title: 'One home',
      tag: 'concept',
      heading: 'Fix: give the fact one name and one place',
      eli5: 'Write the price on the board once and let everyone look at the board. The price changes in one spot. The board is the **single place** for that fact.',
      body: [
        'Put the rate in one constant and one function. Everything else calls `with_tax`.',
        'When the rate becomes 9%, one line changes and every caller is correct at once.',
      ],
      keyIdea: 'Give each piece of knowledge one name, then refer to it everywhere.',
      metrics: { files: '1', cohesion: '-', coupling: '-', rule: 'DRY' },
      metricTones: { files: 'good' },
      scene: {
        nodes: [
          blk('price', A, 'price_with_tax', 'calls with_tax', 'green', 'Receipt'),
          blk('cart', B, 'cart_total', 'calls with_tax', 'green', 'ShoppingBag'),
          blk('invoice', C, 'invoice_total', 'calls with_tax', 'green', 'FileText', { status: 'ok' }),
          blk('with-tax', E, 'with_tax()', 'the one rule', 'green', 'Scale', { status: 'active', chips: ['TAX_RATE = 0.08'] }),
        ],
        links: [link('price', 'with-tax', { label: 'calls' }), link('cart', 'with-tax', { label: 'calls' }), link('invoice', 'with-tax', { label: 'calls' })],
        flows: [
          { path: ['price', 'with-tax'], tone: 'request', label: 'with_tax(100)', duration: 1.4 },
          { path: ['cart', 'with-tax'], tone: 'request', label: 'with_tax(40)', duration: 1.4, delay: 0.5 },
          { path: ['invoice', 'with-tax'], tone: 'request', label: 'with_tax(60)', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'Rate goes to 9%',
          icon: 'Table',
          rows: [
            { text: 'Lines changed', value: '1', tone: 'good' },
            { text: 'Callers edited', value: '0', tone: 'good' },
            { text: 'Callers correct', value: '3 of 3', tone: 'good' },
          ],
          footer: { text: 'One fact, one home', tone: 'good' },
        },
        caption: 'Knowledge lives in one place',
      },
      code: {
        language: 'python',
        title: 'Good: one constant, one function',
        source: `TAX_RATE = 0.08
def with_tax(amount): return amount * (1 + TAX_RATE)

def cart_total(items):    return sum(with_tax(i.price) for i in items)
def invoice_total(lines): return sum(with_tax(l.amount) for l in lines)`,
        highlight: [1, 2],
      },
    },
    // 4
    {
      title: 'Not characters',
      tag: 'tradeoff',
      heading: 'DRY is about knowledge, not matching text',
      eli5: 'Two notes both say 8, but one is the bake-sale tax and the other is the late-book fine. If they share one number on the board, changing the tax also changes the fine. Same number, different **knowledge**.',
      body: [
        'Two lines that look identical but come from different rules should stay separate. A sales tax and a late fee can both be 0.08 today and move independently next year.',
        'Merging them into one `RATE` couples two unrelated decisions. Ask whether the two always change for the same reason. If not, the duplication is only apparent.',
      ],
      keyIdea: 'Merge copies of one fact. Never merge two facts that happen to share a value.',
      metrics: { files: '-', cohesion: '-', coupling: 'rises if merged', rule: 'DRY' },
      metricTones: { coupling: 'warn' },
      scene: {
        nodes: [
          blk('tax', A, 'Sales tax', 'changes with law', 'green', 'Receipt', { chips: ['0.08'] }),
          blk('fee', C, 'Late fee', 'changes with policy', 'green', 'Clock', { chips: ['0.08'] }),
          blk('rate', E, 'Shared RATE', 'wrong merge', 'red', 'Copy', { status: 'hot', badge: 'two reasons' }),
        ],
        links: [link('tax', 'rate', { label: 'uses', labelTone: 'warn' }), link('fee', 'rate', { label: 'uses', labelTone: 'warn' })],
        panel: {
          title: 'Same value, two facts',
          icon: 'Scale',
          rows: [
            { text: 'Sales tax 0.08', value: 'law sets it', tone: 'good' },
            { text: 'Late fee 0.08', value: 'policy sets it', tone: 'good' },
            { text: 'Shared RATE', value: 'both move together', tone: 'bad' },
          ],
          footer: { text: 'Do not merge by looks', tone: 'warn' },
        },
        caption: 'Look-alike lines can be different knowledge',
      },
      code: {
        language: 'python',
        title: 'Looks duplicated, is not',
        source: `# two different rules that happen to share a number
SALES_TAX_RATE = 0.08      # changes with the law
LATE_FEE_RATE  = 0.08      # changes with policy
# one shared RATE would tie two unrelated decisions together`,
        highlight: [2, 3],
      },
    },
    // 5
    {
      title: 'KISS',
      tag: 'concept',
      heading: 'KISS: the simplest thing that works',
      eli5: 'To tell if a number is even, look at the last digit. Do not build a fancy bit machine that confuses everybody. Keep it **simple**.',
      body: [
        '**KISS** (keep it simple, stupid): the simplest thing that could possibly work is usually right. Clever code is a cost the next reader pays.',
        'The clever `is_even` uses bit tricks and quietly returns `None` for non-integers. The simple one says what it means and fails loudly.',
      ],
      keyIdea: 'Clever is the enemy of maintainable. Write for the person reading it in six months.',
      metrics: { files: '-', cohesion: '-', coupling: '-', rule: 'KISS' },
      scene: {
        nodes: [
          blk('caller', A, 'Caller', 'needs is_even', 'green', 'Code'),
          blk('clever', C, 'Clever', 'bit tricks', 'amber', 'Binary', { status: 'hot', chips: [{ text: 'returns None', tone: 'warn' }] }),
          blk('simple', E, 'Simple', 'says what it means', 'green', 'Code', { status: 'ok', chips: [{ text: 'n % 2 == 0', tone: 'good' }] }),
        ],
        links: [link('caller', 'clever', { label: 'hard to read', labelTone: 'warn' }), link('caller', 'simple', { label: 'obvious', labelTone: 'good' })],
        panel: {
          title: 'Reading cost',
          icon: 'Scale',
          rows: [
            { text: 'Clever version', value: 'pause and decode', tone: 'warn' },
            { text: 'Simple version', value: 'read once', tone: 'good' },
            { text: 'Behavior for 7', value: 'same', tone: 'muted' },
          ],
          footer: { text: 'Same answer, less thinking', tone: 'good' },
        },
        caption: 'Same result, less to decode',
      },
      code: {
        language: 'python',
        title: 'Clever versus simple',
        source: `# "clever"
def is_even(n): return not bool(n & 1) if isinstance(n, int) else None

# simple
def is_even(n: int) -> bool:
    return n % 2 == 0`,
        highlight: [2, 5, 6],
      },
    },
    // 6
    {
      title: 'YAGNI',
      tag: 'concept',
      heading: 'YAGNI: do not build it until you need it',
      eli5: 'Do not build a giant toy shelf for toys you do not have yet. Build the shelf when the second toy shows up. That is **YAGNI**: you are not going to need it yet.',
      body: [
        '**YAGNI** (you aren\'t gonna need it): do not build the generalized plugin framework until you have the second plugin.',
        'A `ReportEngine` with registries, middleware and plugins takes 300 lines to print one PDF. A plain function does it today. When HTML arrives next year, refactor then, with a real second case to guide the shape.',
      ],
      keyIdea: 'Every speculative abstraction is a bet against reality, and reality usually wins.',
      metrics: { files: '1 function', cohesion: '-', coupling: '-', rule: 'YAGNI' },
      metricTones: { files: 'good' },
      scene: {
        nodes: [
          blk('engine', A, 'ReportEngine', '300 lines, built for infinity', 'red', 'Boxes', { status: 'hot', chips: [{ text: 'formatters', tone: 'warn' }, { text: 'middlewares', tone: 'warn' }, { text: 'plugins', tone: 'warn' }] }),
          blk('pdf', E, 'generate_pdf()', 'enough for today', 'green', 'FileText', { status: 'ok' }),
          blk('html', C, 'HTML report', 'maybe next year', 'gray', 'Globe', { status: 'dim' }),
        ],
        links: [link('pdf', 'html', { label: 'refactor then', style: 'dashed' })],
        panel: {
          title: 'Today versus a guess',
          icon: 'Table',
          rows: [
            { text: 'Report types today', value: '1 (PDF)', tone: 'good' },
            { text: 'Engine lines', value: '300', tone: 'bad' },
            { text: 'Function lines', value: 'a few', tone: 'good' },
            { text: 'Second type needed', value: 'not yet', tone: 'muted' },
          ],
          footer: { text: 'Abstract when the 2nd case arrives', tone: 'muted' },
        },
        caption: 'Build for today, refactor for tomorrow',
      },
      code: {
        language: 'python',
        title: 'Speculation versus enough',
        source: `# YAGNI violation: one report type, built for infinity
class ReportEngine:
    def __init__(self):
        self.formatters = {}
        self.middlewares = []
        self.plugins = []
    # 300 more lines to print a PDF

# YAGNI respected:
def generate_pdf(report): ...
# when you need HTML next year, refactor then.`,
        highlight: [2, 10],
      },
    },
    // 7
    {
      title: 'Cohesion',
      tag: 'concept',
      heading: 'Cohesion: how focused is this class?',
      eli5: 'A kid whose job is "everything" is a junk drawer. A kid who only handles the crayons knows their job well. A class where every member serves one purpose has high **cohesion**.',
      body: [
        'Most SOLID principles push toward two measures. **Cohesion** asks how focused a class is: do its members all work toward the same purpose?',
        'Low cohesion looks like `Utils` or `Manager` with fifteen unrelated jobs. High cohesion looks like `Cart`: add, remove, total.',
      ],
      keyIdea: 'A cohesive class is easy to name. If you cannot name it without "and" or "Manager", it is a junk drawer.',
      metrics: { files: '-', cohesion: 'high is the goal', coupling: '-', rule: 'cohesion' },
      metricTones: { cohesion: 'good' },
      scene: {
        nodes: [
          blk('utils', ROW3[0], 'Utils', 'junk drawer', 'red', 'Boxes', { status: 'hot', chips: ['resize_image()', 'send_sms()', 'parse_csv()', 'tax()'] }),
          blk('cart', ROW3[1], 'Cart', 'one purpose', 'green', 'ShoppingBag', { status: 'ok', chips: ['add()', 'remove()', 'total()'] }),
          blk('mgr', ROW3[2], 'UserManager', 'does 15 things', 'red', 'Boxes', { status: 'hot', badge: 'low cohesion' }),
        ],
        panel: {
          title: 'Cohesion check',
          icon: 'Layers',
          rows: [
            { text: 'Named Utils or Manager', value: 'low', tone: 'bad' },
            { text: 'Members share one purpose', value: 'high', tone: 'good' },
            { text: 'Cannot name it without "and"', value: 'low', tone: 'bad' },
          ],
          footer: { text: 'Deep and narrow beats wide', tone: 'muted' },
        },
        caption: 'Focused versus junk drawer',
      },
    },
    // 8
    {
      title: 'Coupling',
      tag: 'concept',
      heading: 'Coupling: how entangled are these two classes?',
      eli5: 'If moving one desk makes every other desk fall over, the desks are tied together with string. Fewer, thinner strings mean **low coupling**.',
      body: [
        'Two classes are **tightly coupled** when a change in one forces a change in the other. One mega-class that calls MySQL rows and the Stripe HTTP API directly is the extreme case.',
        'Change a column or a Stripe field and the mega-class must change. The details leak upward into everything that touches it.',
      ],
      keyIdea: 'Coupling is the cost of change flowing between classes. Thin, stable connections keep it low.',
      metrics: { files: '-', cohesion: 'low', coupling: 'high', rule: 'coupling' },
      metricTones: { cohesion: 'bad', coupling: 'bad' },
      scene: {
        nodes: [
          blk('mega', B, 'OrderCartUser', 'cart, user, payment, email', 'red', 'Boxes', { status: 'hot', badge: 'knows everything' }),
          blk('mysql', D, 'MySQL rows', 'external', 'gray', 'Database'),
          blk('stripe', F, 'Stripe HTTP API', 'external', 'gray', 'Globe'),
        ],
        links: [link('mega', 'mysql', { label: 'calls directly', labelTone: 'warn' }), link('mega', 'stripe', { label: 'calls directly', labelTone: 'warn' })],
        flows: [
          { path: ['mega', 'mysql'], tone: 'request', label: 'INSERT ...', duration: 1.4 },
          { path: ['mega', 'stripe'], tone: 'request', label: 'POST /charges', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Ripple of one change',
          icon: 'Network',
          rows: [
            { text: 'MySQL column renamed', value: 'edit mega-class', tone: 'bad' },
            { text: 'Stripe field renamed', value: 'edit mega-class', tone: 'bad' },
            { text: 'New email provider', value: 'edit mega-class', tone: 'bad' },
          ],
          footer: { text: 'Every detail leaks upward', tone: 'bad' },
        },
        caption: 'One class, every detail',
      },
    },
    // 9
    {
      title: 'The goal',
      tag: 'concept',
      heading: 'High cohesion, low coupling',
      eli5: 'The best chart has kids who each do one thing, joined by a few thin strings that go through a shared rule. Focused kids and thin strings are the **north star**.',
      body: [
        'Each class owns one job. Connections are thin and go through interfaces. `Order` talks to a `PaymentGateway` interface, so `StripeGateway` and `PayPalGateway` are swappable.',
        'Aim for classes that are deep and narrow: they do one important thing and show a small surface to the rest of the system.',
      ],
      keyIdea: 'SOLID is the means. High cohesion and low coupling are the ends.',
      metrics: { files: '-', cohesion: 'high', coupling: 'low', rule: 'north star' },
      metricTones: { cohesion: 'good', coupling: 'good' },
      scene: {
        nodes: [
          blk('cart', A, 'Cart', 'one job', 'green', 'ShoppingBag', { status: 'ok' }),
          blk('order', B, 'Order', 'one job', 'green', 'Receipt', { status: 'ok' }),
          blk('gateway', C, 'PaymentGateway', 'interface', 'violet', 'Plug'),
          blk('stripe', at(1.8, 3.8), 'Stripe', 'implements', 'green', 'Package'),
          blk('paypal', at(5.4, 3.8), 'PayPal', 'implements', 'green', 'Package'),
        ],
        links: [
          link('cart', 'order', { label: 'uses' }),
          link('order', 'gateway', { label: 'uses' }),
          link('stripe', 'gateway', { label: 'implements' }),
          link('paypal', 'gateway', { label: 'implements' }),
        ],
        flows: [{ path: ['order', 'gateway', 'stripe'], tone: 'request', label: 'charge(amount)', duration: 1.8 }],
        panel: {
          title: 'The target shape',
          icon: 'Scale',
          rows: [
            { text: 'Each class', value: 'one job', tone: 'good' },
            { text: 'Connections', value: 'thin, via interfaces', tone: 'good' },
            { text: 'Vendor swap', value: 'one new class', tone: 'good' },
          ],
          footer: { text: 'Deep and narrow classes', tone: 'good' },
        },
        caption: 'Focused classes, thin connections',
      },
      quiz: {
        question: 'Which situation is the clearest sign of tight coupling?',
        options: [
          'A class has one purpose and three public methods',
          'Changing class A always forces a change in class B',
          'Two classes implement the same interface',
          'A class keeps its fields private',
        ],
        answer: 1,
        explain: 'Coupling is the cost of change flowing between classes. If A cannot change without B changing, they are tightly coupled, and an interface between them is the usual fix.',
      },
    },
    // 10
    {
      title: 'Smells',
      tag: 'concept',
      heading: 'Smells point you to the principle',
      eli5: 'Your tummy aches before you can say why. A smell is that ache in code: "this job card is too big" or "these two kids always need each other". Each ache has a **fix**.',
      body: [
        'You rarely start from a principle. You start from something that feels wrong, then name it. Four common ones map straight onto the ideas so far.',
        'Each table row gives the smell, what it usually means and the fix. Use it as a lookup during code review.',
      ],
      keyIdea: 'Read the smell first, then pick the principle. Never the other way around.',
      metrics: { files: '-', cohesion: '-', coupling: '-', rule: 'smell, then principle' },
      scene: {
        nodes: [
          blk('smell', A, 'Smell', 'what you feel', 'red', 'Bug', { status: 'hot' }),
          blk('principle', B, 'Principle', 'what it means', 'blue', 'Scale'),
          blk('fix', C, 'Fix', 'what you do', 'green', 'Package', { status: 'ok' }),
        ],
        links: [link('smell', 'principle', { label: 'points to' }), link('principle', 'fix', { label: 'applies' })],
        flows: [{ path: ['smell', 'principle', 'fix'], tone: 'request', label: 'review', duration: 2 }],
        panel: {
          title: 'Smell, fix',
          icon: 'Table',
          rows: [
            { text: 'XxxManager or XxxHelper', value: 'low cohesion, split by reason (SRP)', tone: 'warn' },
            { text: 'Changing A always needs B', value: 'tight coupling, add an interface (OCP/DIP)', tone: 'warn' },
            { text: 'New case means editing a class', value: 'rigid, extend via interface (OCP)', tone: 'warn' },
            { text: 'Imports a concrete DB client', value: 'leaky abstraction, inject a port (DIP)', tone: 'warn' },
          ],
          footer: { text: 'Low cohesion or tight coupling', tone: 'muted' },
        },
        caption: 'A review lookup table',
      },
    },
    // 11
    {
      title: 'Three smells',
      tag: 'concept',
      heading: 'God class, shotgun surgery, rigid class',
      eli5: 'Three tummy aches to learn: one kid does everything (**god class**), one change means telling fourteen kids (shotgun surgery), and a kid must be rewritten to take on any new job (rigid class).',
      body: [
        'A **god class** is one 800-line class that imports everything. A **shotgun surgery** change, such as adding a currency, touches 14 files. A **rigid class** cannot take a new case without editing the class itself.',
        'You learn to feel these by writing bad code, hurting, and refactoring. The names help you say what hurts.',
      ],
      keyIdea: 'The three smells map to SRP, SRP plus OCP, and OCP. The feel comes first, the name second.',
      metrics: { files: '14 for a currency', cohesion: 'low', coupling: 'high', rule: 'smell' },
      metricTones: { files: 'bad', cohesion: 'bad', coupling: 'bad' },
      scene: {
        nodes: [
          blk('god', ROW3[0], 'God class', 'knows everything', 'red', 'Boxes', { status: 'hot', chips: [{ text: '800 lines', tone: 'bad' }] }),
          blk('shotgun', ROW3[1], 'Shotgun surgery', 'one idea, many files', 'red', 'Share2', { status: 'hot', chips: [{ text: '14 files', tone: 'bad' }] }),
          blk('rigid', ROW3[2], 'Rigid class', 'closed to new cases', 'red', 'Shield', { status: 'hot', chips: [{ text: 'edit to extend', tone: 'bad' }] }),
        ],
        panel: {
          title: 'What it feels like',
          icon: 'Bug',
          rows: [
            { text: 'God class', value: 'dread, tiny scroll bar', tone: 'bad' },
            { text: 'Shotgun surgery', value: 'you forget a file', tone: 'bad' },
            { text: 'Rigid class', value: '"I also had to change X, Y, Z"', tone: 'bad' },
          ],
          footer: { text: 'Principle comes next', tone: 'muted' },
        },
        caption: 'Three aches, three names',
      },
    },
    // 12
    {
      title: 'Patterns fall out',
      tag: 'concept',
      heading: 'Smell plus principle gives you the pattern',
      eli5: 'You do not start by picking a fancy name. You notice the ache, remember the rule, and the shape that falls out gets a name afterwards. The name is just a **label**.',
      body: [
        'You do not "apply the Strategy pattern". You notice a rigid class, recall OCP, and the shape that falls out of the refactor happens to be what textbooks call Strategy.',
        'The pattern name is a label you attach after the work, so teammates can follow. Designing from the pattern list gives tortured code. Juniors apply patterns first. Seniors wait for pain, then reach for them.',
      ],
      keyIdea: 'Patterns are what the refactor looks like. They are not a starting point.',
      metrics: { files: '-', cohesion: '-', coupling: '-', rule: 'smell + principle' },
      scene: {
        nodes: [
          blk('smell', A, 'Rigid class', 'smell', 'red', 'Bug', { status: 'hot' }),
          blk('principle', B, 'OCP', 'principle', 'blue', 'Layers'),
          blk('pattern', C, 'Strategy', 'pattern', 'green', 'Package', { status: 'ok', badge: 'a label' }),
        ],
        links: [link('smell', 'principle', { label: 'apply' }), link('principle', 'pattern', { label: 'falls out' })],
        flows: [{ path: ['smell', 'principle', 'pattern'], tone: 'request', label: 'refactor', duration: 2 }],
        panel: {
          title: 'Smell + principle = pattern',
          icon: 'Table',
          rows: [
            { text: 'God class + SRP', value: 'Extract class, Facade' },
            { text: 'Rigid class + OCP', value: 'Strategy, State, Template' },
            { text: 'Hard to test + DIP', value: 'Injection, Repository' },
            { text: 'Duplicate code + DRY', value: 'Template, Decorator, Mixin' },
            { text: 'Shotgun + SRP + OCP', value: 'Event bus, Observer' },
          ],
          footer: { text: 'The name comes after the work', tone: 'muted' },
        },
        caption: 'The pattern is the shape of the refactor',
      },
    },
    // 13
    {
      title: 'Four to keep',
      tag: 'concept',
      heading: 'The four to memorize',
      eli5: 'If you can only remember a few rules, remember these **four rules**: one job per kid, add cards without rewriting, ask for a role, write facts once. The other two tend to come along for free.',
      body: [
        'Four are worth holding in your head forever: **SRP**, **OCP**, **DIP** and **DRY**. You should spot their violations in a pull request within seconds.',
        'In daily work these four cover most reviews. LSP and ISP violations tend to disappear when you keep classes small and depend on interfaces, and two review checks catch the rest. An `isinstance` in a caller or a `NotImplementedError` override is the giveaway.',
      ],
      keyIdea: 'Four principles you can hold at once beat five that blur. Treat L and I as review checks.',
      metrics: { files: '-', cohesion: '-', coupling: '-', rule: 'SRP, OCP, DIP, DRY' },
      scene: {
        nodes: [
          blk('srp', ROW4[0], 'SRP', 'one reason', 'teal', 'Shield', { status: 'ok' }),
          blk('ocp', ROW4[1], 'OCP', 'add, not edit', 'blue', 'Layers', { status: 'ok' }),
          blk('dip', ROW4[2], 'DIP', 'depend on interfaces', 'green', 'Plug', { status: 'ok' }),
          blk('dry', ROW4[3], 'DRY', 'one fact, one home', 'amber', 'Copy', { status: 'ok' }),
        ],
        panel: {
          title: 'What violating it feels like',
          icon: 'List',
          rows: [
            { text: 'SRP', value: 'merge conflicts on every PR', tone: 'bad' },
            { text: 'OCP', value: 'an if/elif ladder keeps growing', tone: 'bad' },
            { text: 'DIP', value: 'no tests without Postgres', tone: 'bad' },
            { text: 'DRY', value: 'a bug fixed in 4 files, 1 missed', tone: 'bad' },
            { text: 'LSP and ISP', value: 'follow from the rest', tone: 'muted' },
          ],
          footer: { text: 'Check L and I in review', tone: 'muted' },
        },
        caption: 'Four to memorize',
      },
    },
    // 14
    {
      title: 'Lens only',
      tag: 'tradeoff',
      heading: 'A lens, not a religion',
      eli5: 'A rule book is for when something hurts. If the class chart works and is easy to change, leave it alone. Use the rules as a **lens**, not a religion.',
      body: [
        'Step 1 of this part showed the cost of applying principles by reflex. With one implementation, no second case in sight and no test pain, a concrete class is the right design.',
        'Apply a principle when a smell shows up. Extract at the second case. Reach for a pattern only when the refactor already looks like one.',
      ],
      keyIdea: 'Pain first, principle second, pattern last. No pain, no change.',
      metrics: { files: 'fewer', cohesion: '-', coupling: '-', rule: 'pain first' },
      metricTones: { files: 'good' },
      scene: {
        nodes: [
          blk('pain', A, 'Pain shows up', 'smell, 2nd case', 'red', 'Bug', { status: 'hot' }),
          blk('apply', B, 'Apply principle', 'refactor', 'green', 'Scale', { status: 'ok' }),
          blk('none', C, 'No pain', 'leave it alone', 'gray', 'Shield'),
        ],
        links: [link('pain', 'apply', { label: 'then' }), link('none', 'apply', { label: 'do not', style: 'dashed', labelTone: 'warn' })],
        flows: [{ path: ['pain', 'apply'], tone: 'response', label: 'extract', duration: 1.6 }],
        panel: {
          title: 'Rules of thumb',
          icon: 'List',
          rows: [
            { text: '1 implementation, no test pain', value: 'keep it concrete', tone: 'good' },
            { text: '2nd case arrives', value: 'extract the seam', tone: 'good' },
            { text: 'Refactor looks like a pattern', value: 'name it', tone: 'good' },
            { text: 'Pattern chosen first', value: 'tortured code', tone: 'bad' },
          ],
          footer: { text: 'Every abstraction is a bet', tone: 'muted' },
        },
        caption: 'Principles answer pain',
      },
    },
    // 15
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: aim for cohesion, low coupling and no waste',
      eli5: 'Keep each kid focused, keep the strings thin, write each fact once, keep it simple and wait for the second toy. That makes a class chart that is easy to change, which is the **goal**.',
      body: [
        '**DRY** keeps one fact in one place, judged by knowledge and not by matching text. **KISS** and **YAGNI** stop you from building more than today needs.',
        '**Cohesion** and **coupling** are what SOLID is a path toward. Smells tell you which principle to reach for, and the pattern name comes after the refactor.',
      ],
      keyIdea: 'Use principles as a lens on real pain, and keep the design as small as the problem.',
      metrics: { files: 'few', cohesion: 'high', coupling: 'low', rule: 'lens' },
      metricTones: { files: 'good', cohesion: 'good', coupling: 'good' },
      scene: {
        nodes: [
          blk('cohesion', A, 'High cohesion', 'focused classes', 'teal', 'Layers', { status: 'ok' }),
          blk('coupling', B, 'Low coupling', 'thin interfaces', 'blue', 'Network', { status: 'ok' }),
          blk('lean', C, 'No waste', 'DRY, KISS, YAGNI', 'amber', 'Scale', { status: 'ok' }),
        ],
        panel: {
          title: 'Keep this',
          icon: 'List',
          rows: [
            { text: 'Smell', value: 'then a principle' },
            { text: 'Same text, different rule', value: 'do not merge' },
            { text: 'One implementation', value: 'stay concrete' },
            { text: 'Second case', value: 'extract' },
          ],
          footer: { text: 'Small design, easy changes', tone: 'good' },
        },
        caption: 'Focused, thin, and no bigger than needed',
      },
      quiz: {
        question: 'A class has one implementation, no test pain and no second case in sight. What do KISS, YAGNI and the SOLID lens suggest?',
        options: [
          'Add an interface and a factory now, in case a second one appears',
          'Keep the concrete class, and extract an interface when a second case or test pain appears',
          'Split it into one class per method',
          'Make it inherit from a base class for future use',
        ],
        answer: 1,
        explain: 'Principles answer pain. Without a smell, a concrete class is the simplest design, and the second case will show the right shape of the interface.',
      },
    },
  ],
};
