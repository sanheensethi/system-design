import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Role colors: interfaces violet, abstract classes blue, concrete classes green, external systems gray.
// Value objects are teal and DTOs amber so the two new ideas stand out.
const ctrl: SceneNode = { id: 'ctrl', kind: 'block', at: at(-4, -2), label: 'OrderController', sub: 'HTTP edge', icon: 'Network', tint: 'green' };
const svc: SceneNode = { id: 'svc', kind: 'block', at: at(0, -2), label: 'CheckoutService', sub: 'use case', icon: 'Workflow', tint: 'green' };
const order: SceneNode = { id: 'order', kind: 'block', at: at(4, -2), label: 'Order', sub: 'aggregate root', icon: 'Package', tint: 'green' };
const money: SceneNode = { id: 'money', kind: 'block', size: 0.8, at: at(4, 2.4), label: 'Money', sub: 'value object', icon: 'Scale', tint: 'teal' };
const repo: SceneNode = { id: 'repo', kind: 'block', at: at(0, 2), label: 'OrderRepository', sub: 'interface', icon: 'Plug', tint: 'violet' };
const sqlRepo: SceneNode = { id: 'sqlrepo', kind: 'block', at: at(-4, 2), label: 'SqlOrderRepo', sub: 'implements', icon: 'Database', tint: 'green' };
const memRepo: SceneNode = { id: 'memrepo', kind: 'block', at: at(4, 2), label: 'InMemoryRepo', sub: 'implements', icon: 'Boxes', tint: 'green' };
const db: SceneNode = { id: 'db', kind: 'block', at: at(-4, 6.4), label: 'Postgres', sub: 'orders, order_lines', icon: 'Database', tint: 'gray' };
const uow: SceneNode = { id: 'uow', kind: 'block', at: at(0, 2), label: 'UnitOfWork', sub: 'abstract', icon: 'Layers', tint: 'blue' };
const dto: SceneNode = { id: 'dto', kind: 'block', at: at(4, 2.4), label: 'OrderDto', sub: 'flat data', icon: 'FileJson', tint: 'amber' };

export const lldEnterprisePatterns: Lesson = {
  id: 'lld-enterprise-patterns',
  title: 'Enterprise patterns: repository, DTO, value object',
  tagline: 'The small objects that keep business rules, storage and the outside world from tangling together.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Entity versus value object: identity against value, and why value objects are frozen',
    'Aggregates: one root that guards the rules for a cluster of objects',
    'Repository: a collection-like interface that hides storage, with SQL and in-memory versions',
    'Mapper: translating between domain objects and rows, and where the ORM fits',
    'Specification: a business rule as an object you can combine and reuse',
    'Unit of Work: several saves that commit or roll back as one',
    'DTO: a flat, safe shape for crossing a boundary, and how it differs from an entity',
    'When these patterns are worth their cost, and when a plain CRUD app should skip them',
  ],
  metrics: [
    { key: 'sql', label: 'Files with SQL', icon: 'Database' },
    { key: 'test', label: 'Unit test run', icon: 'Timer' },
    { key: 'copies', label: 'Copies of a rule', icon: 'Copy' },
    { key: 'exposed', label: 'Fields exposed', icon: 'Braces' },
  ],
  steps: [
    {
      title: 'Tangled checkout',
      tag: 'problem',
      heading: 'A checkout function that knows SQL, prices and JSON',
      eli5: 'In the **toy shop**, the cashier also walks into the stockroom, digs through boxes and writes prices on stickers herself. Every sale takes forever, and nobody else can do her job.',
      body: [
        'The toy shop app has one `checkout()` function. It runs three `cursor.execute` calls, adds up prices as raw integers and builds the JSON reply by hand.',
        'The rule "free shipping over 50" is copied into three files. A unit test needs a live Postgres and takes 4 seconds. Changing a table name touches business code.',
      ],
      keyIdea: 'When business rules, storage and the outside format live in one function, every change is risky and every test is slow.',
      metrics: { sql: '9', test: '4 s', copies: '3', exposed: 'all columns' },
      metricTones: { sql: 'bad', test: 'bad', copies: 'bad', exposed: 'bad' },
      scene: {
        nodes: [
          { ...svc, label: 'checkout()', sub: 'one big function', tint: 'gray', status: 'hot', chips: [{ text: 'cursor.execute x3', tone: 'bad' }, { text: 'price * qty > 50', tone: 'warn' }] },
          { id: 'db', kind: 'block', at: at(4, -2), label: 'Postgres', sub: 'external', icon: 'Database', tint: 'gray' },
          { id: 'test', kind: 'block', size: 0.8, at: at(0, 5.4), label: 'unit test', sub: 'needs a live DB', icon: 'Bug', tint: 'gray', status: 'hot', badge: '4 s' },
        ],
        links: [link('svc', 'db', { label: 'raw SQL' }), link('test', 'svc', { label: 'runs', labelTone: 'warn' })],
        flows: [
          { path: ['svc', 'db'], tone: 'request', label: 'SELECT ... FOR UPDATE', duration: 1.4 },
          { path: ['db', 'svc'], tone: 'response', label: 'rows', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'One function, four jobs',
          icon: 'List',
          rows: [
            { text: 'Opens connections', value: 'storage', tone: 'warn' },
            { text: 'Totals prices as ints', value: 'rules', tone: 'warn' },
            { text: 'Checks the shipping rule', value: 'rules', tone: 'warn' },
            { text: 'Builds the JSON reply', value: 'format', tone: 'warn' },
            { text: 'SQL spread over 9 files', value: 'sql: 9', tone: 'bad' },
          ],
          footer: { text: 'Change any one and you retest all four', tone: 'bad' },
        },
        caption: 'Everything in one place, nothing reusable',
      },
      code: {
        language: 'python',
        title: 'checkout() before: SQL, rules and JSON in one body',
        source: `def checkout(conn, order_id):
    cur = conn.cursor()
    cur.execute("SELECT status FROM orders WHERE id=%s FOR UPDATE", (order_id,))
    cur.execute("SELECT sku, qty, price_cents FROM order_lines WHERE order_id=%s", (order_id,))
    total = sum(qty * price for _, qty, price in cur.fetchall())
    shipping = 0 if total > 5000 else 499          # rule copy 1 of 3
    cur.execute("UPDATE orders SET status='paid' WHERE id=%s", (order_id,))
    conn.commit()
    return {"id": order_id, "total": total + shipping, "status": "paid"}`,
        highlight: [3, 4, 6, 9],
      },
    },
    {
      title: 'Three layers',
      tag: 'concept',
      heading: 'Split by job and point every dependency inward',
      eli5: 'The **toy shop** gets three desks: the door desk talks to customers, the sales desk follows the shop rules, and the stockroom is a separate room. Each desk knows only the one next to it.',
      body: [
        'The fix starts with layers. The **edge** (controller) speaks HTTP. The **domain** holds the rules and knows nothing about HTTP or SQL. Storage sits at the far end.',
        'The dependency rule: source code points toward the domain. The domain never imports a database driver. The patterns in this lesson are the joints between those layers.',
      ],
      keyIdea: 'Business rules go in the domain. The domain imports nothing from the edge or from storage.',
      metrics: { sql: '9', test: '4 s', copies: '3', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...ctrl, status: 'active' },
          svc,
          { ...order, chips: ['total()', 'pay()'] },
          { ...db, at: at(2, 5.4), status: 'dim' },
        ],
        links: [link('ctrl', 'svc', { label: 'uses' }), link('svc', 'order', { label: 'uses' })],
        flows: [
          { path: ['ctrl', 'svc'], tone: 'request', label: 'pay(1001)', duration: 1.2 },
          { path: ['svc', 'order'], tone: 'request', label: 'order.pay()', duration: 1.2, delay: 1.3 },
          { path: ['order', 'svc', 'ctrl'], tone: 'response', label: 'result', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Who may import whom',
          icon: 'Layers',
          rows: [
            { text: 'Controller imports service', value: 'ok', tone: 'good' },
            { text: 'Service imports domain', value: 'ok', tone: 'good' },
            { text: 'Domain imports SQL driver', value: 'never', tone: 'bad' },
            { text: 'Domain imports controller', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Edge, use case, domain',
      },
    },
    {
      title: 'Entity or value',
      tag: 'concept',
      heading: 'Entity: identity. Value object: just its value',
      eli5: 'A teddy bear with a name tag is an **entity**: swap its ribbon and it is still the same bear. A plain Lego brick is a **value object**: any red 2x4 brick will do.',
      body: [
        'An **entity** has an identity that outlives its changes. Order 1001 is still order 1001 after its status moves from open to paid. Two entities are equal when their ids match.',
        'A **value object** has no identity. `Money(500, "USD")` equals any other `Money(500, "USD")`. Equality compares every field, and the object never changes after creation.',
      ],
      keyIdea: 'Ask whether two instances with the same data are the same thing. Entities say no, value objects say yes.',
      metrics: { sql: '9', test: '4 s', copies: '3', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...order, at: at(-4, 0), label: 'Order #1001', sub: 'entity', chips: [{ text: 'id = 1001', tone: 'good' }] },
          { id: 'm1', kind: 'block', size: 0.8, at: at(2, -2.4), label: 'Money', sub: 'value object', icon: 'Scale', tint: 'teal', chips: ['500 USD'] },
          { id: 'm2', kind: 'block', size: 0.8, at: at(2, 3.4), label: 'Money', sub: 'value object', icon: 'Scale', tint: 'teal', chips: ['500 USD'] },
        ],
        links: [link('order', 'm1', { label: 'has-a' }), link('m1', 'm2', { label: 'equal by value', labelTone: 'good', arrow: 'none', route: 'straight' })],
        flows: [{ path: ['m1', 'm2'], tone: 'data', label: '==  True', duration: 1.6 }],
        panel: {
          title: 'Entity against value object',
          icon: 'Table',
          rows: [
            { text: 'Entity equality', value: 'same id' },
            { text: 'Value object equality', value: 'same fields' },
            { text: 'Entity over time', value: 'changes', tone: 'warn' },
            { text: 'Value object over time', value: 'frozen', tone: 'good' },
          ],
        },
        caption: 'Identity or value',
      },
    },
    {
      title: 'Money class',
      tag: 'concept',
      heading: 'A value object in 15 lines: frozen, checked, replaceable',
      eli5: 'A Lego brick never changes shape. If you want a bigger piece, you click two bricks together and get a new piece. The old bricks stay exactly as they were.',
      body: [
        'In Python a **frozen dataclass** gives you a value object: fields cannot be reassigned, `==` compares all fields, and it can be a dict key. Operations return a **new** object.',
        'The constructor checks the rules once. A `Money` that exists is always valid, so no later code re-checks for negative cents.',
      ],
      keyIdea: 'A value object validates itself on creation and never changes. To "change" it, build a new one.',
      metrics: { sql: '9', test: '4 s', copies: '2', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...order, at: at(-4, 0), chips: ['total()'] },
          { ...money, at: at(2, -2), chips: [{ text: 'frozen=True', tone: 'good' }] },
          { id: 'money2', kind: 'block', size: 0.8, at: at(2, 5.4), label: 'Money', sub: 'new object', icon: 'Scale', tint: 'teal', chips: ['1250 USD'] },
        ],
        links: [link('order', 'money', { label: 'has-a' }), link('money', 'money2', { label: 'creates', route: 'straight' })],
        flows: [
          { path: ['order', 'money'], tone: 'request', label: 'add(Money(250))', duration: 1.3 },
          { path: ['money', 'money2'], tone: 'response', label: 'new Money', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Immutability in action',
          icon: 'Code',
          code: 'm = Money(1000)\nm.cents = 1\n# FrozenInstanceError\nm2 = m.add(Money(250))\nm.cents    # 1000\nm2.cents   # 1250',
          footer: { text: 'The original is never touched', tone: 'good' },
        },
        caption: 'Operations return new objects',
      },
      code: {
        language: 'python',
        title: 'Money as a value object',
        source: `from dataclasses import dataclass

@dataclass(frozen=True)
class Money:
    cents: int
    currency: str = "USD"

    def __post_init__(self):
        if self.cents < 0:
            raise ValueError("money cannot be negative")

    def add(self, other: "Money") -> "Money":
        if other.currency != self.currency:
            raise ValueError("currency mismatch")
        return Money(self.cents + other.cents, self.currency)

    def times(self, n: int) -> "Money":
        return Money(self.cents * n, self.currency)`,
        highlight: [3, 8, 9, 14],
      },
    },
    {
      title: 'Value rules',
      tag: 'concept',
      heading: 'Why wrap a plain string or int in a value object',
      eli5: 'Instead of handing the cashier loose coins of unknown countries, you hand her a labeled pouch. She can trust the pouch, so she never has to inspect every coin.',
      body: [
        'Passing raw `str` and `int` around is **primitive obsession**. `send(to: str, amount: int)` lets you swap the arguments and nothing complains. `Email` and `Money` make the mix-up a type error.',
        'Good candidates: `Email`, `Money`, `DateRange`, `Address`, `Sku`. Each carries its own validation and small behavior, such as `DateRange.overlaps(other)`.',
      ],
      keyIdea: 'Wrap a concept that has rules in a value object. The rule then lives in one place and bad values cannot exist.',
      metrics: { sql: '9', test: '4 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { id: 'cust', kind: 'block', at: at(-4, 0), label: 'Customer', sub: 'entity', icon: 'User', tint: 'green' },
          { id: 'email', kind: 'block', size: 0.8, at: at(2, -2.4), label: 'Email', sub: 'value object', icon: 'Mail', tint: 'teal', chips: [{ text: 'must contain @', tone: 'good' }] },
          { id: 'addr', kind: 'block', size: 0.8, at: at(2, 3.4), label: 'Address', sub: 'value object', icon: 'Globe', tint: 'teal', chips: ['street, city, zip'] },
        ],
        links: [link('cust', 'email', { label: 'has-a' }), link('cust', 'addr', { label: 'has-a' })],
        flows: [{ path: ['cust', 'email'], tone: 'request', label: 'Email("ana@toys.io")', duration: 1.5 }],
        panel: {
          title: 'Same call, two signatures',
          icon: 'Braces',
          rows: [
            { text: 'send(to: str, amount: int)', value: 'swap ok', tone: 'bad' },
            { text: 'send(to: Email, amount: Money)', value: 'type error', tone: 'good' },
            { text: 'Rule checks', value: '1 place', tone: 'good' },
          ],
        },
        caption: 'Name the concept, own its rule',
      },
    },
    {
      title: 'Aggregate',
      tag: 'concept',
      heading: 'An aggregate: one root guards a cluster of objects',
      eli5: 'A toy set comes in one box with a lid. You ask the shop for the box, never for a loose piece. Whoever holds the lid decides what goes in, so the set always stays complete.',
      body: [
        'An **aggregate** is a cluster of objects treated as one unit for changes. `Order` is the **root**, and its `OrderLine` objects live inside. Outside code talks only to the root.',
        'That is where invariants live: "an order has at most 10 lines" and "a paid order cannot gain lines" are checked in `Order.add_line`, so no caller can skip them.',
      ],
      keyIdea: 'Change an aggregate only through its root, so the rules inside always hold. One aggregate is loaded and saved as a whole.',
      metrics: { sql: '9', test: '4 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2) },
          { ...order, at: at(0, -2), status: 'active', chips: [{ text: 'max 10 lines', tone: 'good' }] },
          { id: 'line1', kind: 'block', size: 0.72, at: at(-1.8, 3), label: 'OrderLine', sub: 'inside', icon: 'Receipt', tint: 'green' },
          { id: 'line2', kind: 'block', size: 0.72, at: at(1.8, 3), label: 'OrderLine', sub: 'inside', icon: 'Receipt', tint: 'green' },
        ],
        links: [link('svc', 'order', { label: 'add_line()' }), link('order', 'line1', { label: 'has-a' }), link('order', 'line2', { label: 'has-a' })],
        flows: [
          { path: ['svc', 'order'], tone: 'request', label: 'add_line("robot", 2)', duration: 1.4 },
          { path: ['order', 'line2'], tone: 'data', label: 'creates', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Invariants held by the root',
          icon: 'Shield',
          rows: [
            { text: 'At most 10 lines', value: 'checked', tone: 'good' },
            { text: 'No lines after paid', value: 'checked', tone: 'good' },
            { text: 'Total = sum of lines', value: 'computed', tone: 'good' },
          ],
          footer: { text: 'Callers cannot reach OrderLine directly', tone: 'muted' },
        },
        caption: 'Outside code sees only the root',
      },
      code: {
        language: 'python',
        title: 'Order, the aggregate root',
        source: `class Order:
    MAX_LINES = 10

    def __init__(self, id: int, customer_id: int):
        self.id, self.customer_id = id, customer_id
        self.status = "open"
        self._lines: list[OrderLine] = []

    @property
    def lines(self) -> tuple["OrderLine", ...]:
        return tuple(self._lines)          # read-only view

    def add_line(self, sku: str, qty: int, price: Money) -> None:
        if self.status != "open":
            raise ValueError("order is closed")
        if len(self._lines) >= self.MAX_LINES:
            raise ValueError("too many lines")
        self._lines.append(OrderLine(sku, qty, price))

    def total(self) -> Money:
        total = Money(0)
        for line in self._lines:
            total = total.add(line.price.times(line.qty))
        return total

    def pay(self) -> None:
        self.status = "paid"`,
        highlight: [13, 14, 16, 17, 20],
      },
    },
    {
      title: 'Repository',
      tag: 'concept',
      heading: 'Repository: storage that looks like a collection',
      eli5: 'The **shopkeeper** at the front fetches any toy set you name. You never see the stockroom. You say "bring set 1001" and "put this one back", and she handles the shelves.',
      body: [
        'A **repository** gives the domain a collection-like view of one aggregate type: `get(id)`, `save(order)`, `find(spec)`. The service asks for objects and never writes a query.',
        'It returns **domain objects**, fully built. Where they come from (Postgres, a cache, a list in memory) is the repository\'s secret.',
      ],
      keyIdea: 'A repository hides storage behind collection-style methods and returns whole aggregates.',
      metrics: { sql: '9', test: '4 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2) },
          { ...repo, at: at(0, -2), status: 'active', chips: ['get(id)', 'save(order)', 'find(spec)'] },
          { ...db, at: at(4, -2), status: 'dim' },
        ],
        links: [link('svc', 'repo', { label: 'uses' }), link('repo', 'db', { label: 'talks to', style: 'dashed' })],
        flows: [
          { path: ['svc', 'repo'], tone: 'request', label: 'get(1001)', duration: 1.3 },
          { path: ['repo', 'db'], tone: 'request', label: 'SELECT', duration: 1.1, delay: 1.4 },
          { path: ['db', 'repo', 'svc'], tone: 'response', label: 'Order', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: 'What the service sees',
          icon: 'Code',
          code: 'order = orders.get(1001)\norder.add_line("robot", 2, price)\norders.save(order)\npaid = orders.find(IsPaid())',
          footer: { text: 'No SQL, no connection, no rows', tone: 'good' },
        },
        caption: 'Ask for objects, never for rows',
      },
    },
    {
      title: 'Interface first',
      tag: 'case',
      heading: 'One interface, an in-memory version for tests',
      eli5: 'The shopkeeper has a job description: fetch, put back, search. A real shopkeeper uses the stockroom. A pretend one for practice keeps three toys on the counter. Same job, same words.',
      body: [
        'Define `OrderRepository` as an **abstract interface**. The service depends on it only. Production plugs in `SqlOrderRepo`. Tests plug in `InMemoryRepo`, a dict.',
        'Now a rule test runs in milliseconds with no database. The in-memory version also proves the interface is honest: if it cannot be written with a dict, the interface leaks.',
      ],
      keyIdea: 'Depend on the repository interface. Swapping the implementation never touches business code.',
      metrics: { sql: '9', test: '0.02 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...svc, at: at(0, -5.6) },
          { ...repo, at: at(0, 1.4), status: 'active' },
          { ...sqlRepo, at: at(-4, 5.4) },
          { ...memRepo, at: at(4, 5.4) },
        ],
        links: [link('svc', 'repo', { label: 'uses' }), link('sqlrepo', 'repo', { label: 'implements', style: 'dashed' }), link('memrepo', 'repo', { label: 'implements', style: 'dashed' })],
        flows: [
          { path: ['svc', 'repo', 'memrepo'], tone: 'request', label: 'get(1001)', duration: 2 },
          { path: ['memrepo', 'repo', 'svc'], tone: 'response', label: 'Order', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Same service, two backends',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Production', value: 'SqlOrderRepo' },
            { text: 'Unit tests', value: 'InMemoryRepo', tone: 'good' },
            { text: 'Service code changed', value: '0 lines', tone: 'good' },
          ],
        },
        caption: 'The service never names a backend',
      },
      code: {
        language: 'python',
        title: 'The interface and its in-memory twin',
        source: `from abc import ABC, abstractmethod

class OrderRepository(ABC):
    @abstractmethod
    def get(self, order_id: int) -> Order: ...
    @abstractmethod
    def save(self, order: Order) -> None: ...
    @abstractmethod
    def find(self, spec: "Spec") -> list[Order]: ...

class InMemoryRepo(OrderRepository):
    def __init__(self):
        self._store: dict[int, Order] = {}
    def get(self, order_id):
        return self._store[order_id]
    def save(self, order):
        self._store[order.id] = order
    def find(self, spec):
        return [o for o in self._store.values() if spec.is_satisfied_by(o)]`,
        highlight: [3, 11, 14, 16],
      },
      quiz: {
        question: 'Why does the service depend on OrderRepository instead of SqlOrderRepo?',
        options: [
          'Interfaces run faster than classes',
          'The implementation can be swapped, for example for an in-memory version in tests, without changing business code',
          'Abstract classes prevent SQL injection',
          'It lets the domain import the database driver safely',
        ],
        answer: 1,
        explain: 'The service only knows the three methods. Any class that honors them works, so tests use a dict and production uses Postgres, and the rules code never changes.',
      },
    },
    {
      title: 'SQL repository',
      tag: 'case',
      heading: 'The SQL implementation does the dirty work in one file',
      eli5: 'The real shopkeeper knows which shelf holds what, how to pack a set back into its box and how to write the stockroom ledger. Only she needs to know any of it.',
      body: [
        '`SqlOrderRepo` holds the SQL. `get` reads the order row and its line rows, then hands them to a mapper that builds an `Order`. `save` turns the `Order` back into rows.',
        'All SQL for this aggregate now lives in one file. A schema change has one place to edit and the service never notices.',
      ],
      keyIdea: 'The SQL repository owns every query for its aggregate. Nothing else in the codebase imports a database driver.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: 'all columns' },
      metricTones: { sql: 'good' },
      scene: {
        nodes: [
          { ...repo, at: at(-4, -2) },
          { ...sqlRepo, at: at(0, -2), status: 'active' },
          { ...db, at: at(4, -2), label: 'Postgres', sub: 'orders, order_lines' },
        ],
        links: [link('sqlrepo', 'repo', { label: 'implements', style: 'dashed' }), link('sqlrepo', 'db', { label: 'SQL' })],
        flows: [
          { path: ['sqlrepo', 'db'], tone: 'request', label: 'SELECT orders', duration: 1.2 },
          { path: ['sqlrepo', 'db'], tone: 'request', label: 'SELECT lines', duration: 1.2, delay: 1.3 },
          { path: ['db', 'sqlrepo'], tone: 'response', label: 'rows', count: 2, duration: 1.5, delay: 2.6 },
        ],
        panel: {
          title: 'Where SQL is allowed',
          icon: 'Database',
          rows: [
            { text: 'SqlOrderRepo', value: 'yes', tone: 'good' },
            { text: 'Services', value: 'no', tone: 'bad' },
            { text: 'Domain classes', value: 'no', tone: 'bad' },
            { text: 'Controllers', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'One file speaks SQL',
      },
      code: {
        language: 'python',
        title: 'SqlOrderRepo.get and save',
        source: `class SqlOrderRepo(OrderRepository):
    def __init__(self, conn, mapper):
        self._conn, self._mapper = conn, mapper

    def get(self, order_id: int) -> Order:
        cur = self._conn.cursor()
        cur.execute("SELECT id, customer_id, status FROM orders WHERE id=%s", (order_id,))
        head = cur.fetchone()
        if head is None:
            raise KeyError(order_id)
        cur.execute("SELECT sku, qty, price_cents FROM order_lines WHERE order_id=%s", (order_id,))
        return self._mapper.to_domain(head, cur.fetchall())

    def save(self, order: Order) -> None:
        head, lines = self._mapper.to_rows(order)
        cur = self._conn.cursor()
        cur.execute("INSERT INTO orders VALUES (%s,%s,%s) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status", head)
        cur.execute("DELETE FROM order_lines WHERE order_id=%s", (order.id,))
        cur.executemany("INSERT INTO order_lines VALUES (%s,%s,%s,%s)", lines)

    def find(self, spec: "Spec") -> list[Order]:
        # stub: a real version pushes the spec into a WHERE clause
        raise NotImplementedError`,
        highlight: [7, 11, 17, 19],
      },
    },
    {
      title: 'Mapper',
      tag: 'concept',
      heading: 'A mapper translates between objects and rows',
      eli5: 'The stockroom packs toys flat in drawers. The shelf shows them built. A **mapper** is the packer who builds a set from drawer parts, and later folds it back into the drawers.',
      body: [
        'A row has columns and integers. An `Order` has `Money`, a status and a list of lines. A **data mapper** converts between them, so the domain class carries no table or column knowledge.',
        'The alternative, **active record**, makes the class itself the row and gives it `save()`. It is quick for plain CRUD. It couples rules to the schema, which is the tangle we are removing.',
      ],
      keyIdea: 'A mapper keeps the domain model free of table shapes. An ORM is a mapper generated from declarations.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { id: 'row', kind: 'block', size: 0.8, at: at(-4, -2), label: 'DB rows', sub: 'columns, ints', icon: 'Table', tint: 'gray' },
          { id: 'mapper', kind: 'block', at: at(0, -2), label: 'OrderMapper', sub: 'translator', icon: 'ArrowLeftRight', tint: 'green', status: 'active' },
          { ...order, at: at(4, -2), chips: ['Money', 'status', 'lines'] },
        ],
        links: [link('row', 'mapper', { label: 'reads' }), link('mapper', 'order', { label: 'creates' })],
        flows: [
          { path: ['row', 'mapper', 'order'], tone: 'request', label: 'to_domain(rows)', duration: 2 },
          { path: ['order', 'mapper', 'row'], tone: 'data', label: 'to_rows(order)', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Two ways to persist',
          icon: 'Scale',
          rows: [
            { text: 'Data mapper', value: 'class is pure', tone: 'good' },
            { text: 'Active record', value: 'class is the row', tone: 'warn' },
            { text: 'ORM (SQLAlchemy)', value: 'generates mapper', tone: 'muted' },
          ],
          footer: { text: 'Active record suits plain CRUD', tone: 'muted' },
        },
        caption: 'Rows on one side, objects on the other',
      },
      code: {
        language: 'python',
        title: 'OrderMapper',
        source: `class OrderMapper:
    def to_domain(self, head, line_rows) -> Order:
        order_id, customer_id, status = head
        order = Order(order_id, customer_id)
        for sku, qty, cents in line_rows:
            order.add_line(sku, qty, Money(cents))
        order.status = status
        return order

    def to_rows(self, order: Order):
        head = (order.id, order.customer_id, order.status)
        lines = [(order.id, l.sku, l.qty, l.price.cents) for l in order.lines]
        return head, lines`,
        highlight: [3, 6, 7, 12],
      },
    },
    {
      title: 'Specification',
      tag: 'concept',
      heading: 'Specification: a business question as a reusable object',
      eli5: 'The shopkeeper takes filter cards: "paid" and "over 50 dollars". You can stack two cards and she only brings sets that pass both. Cards are reused by every desk.',
      body: [
        'Queries like "paid orders over 50" get re-typed in the API, a cron job and an export. A **specification** is an object with one method, `is_satisfied_by(order)`.',
        'Specs combine with `&`, `|` and `~` into a tree. The repository takes one in `find(spec)`. The rule has a name, a test and a single home.',
      ],
      keyIdea: 'A specification turns a rule into an object you can name, combine and hand to a repository.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...repo, at: at(-4, -2), chips: ['find(spec)'] },
          { id: 'spec', kind: 'block', at: at(0, -2), label: 'Spec', sub: 'abstract', icon: 'Search', tint: 'blue' },
          { id: 'andspec', kind: 'block', size: 0.8, at: at(-2.4, 3.2), label: 'AndSpec', sub: 'extends Spec', icon: 'Split', tint: 'green' },
          { id: 'ispaid', kind: 'block', size: 0.8, at: at(2.4, 3.2), label: 'IsPaid', sub: 'extends Spec', icon: 'Receipt', tint: 'green' },
        ],
        links: [link('repo', 'spec', { label: 'uses' }), link('andspec', 'spec', { label: 'extends', style: 'dashed' }), link('ispaid', 'spec', { label: 'extends', style: 'dashed' })],
        flows: [{ path: ['repo', 'spec', 'ispaid'], tone: 'request', label: 'is_satisfied_by(o)', duration: 2 }],
        panel: {
          title: 'Rules that combine',
          icon: 'Code',
          code: 'big_paid = IsPaid() & TotalOver(Money(5000))\nunpaid = ~IsPaid()\norders.find(big_paid)',
          footer: { text: 'Wrap with parentheses when mixing & and |', tone: 'muted' },
        },
        caption: 'Rules as objects',
      },
      code: {
        language: 'python',
        title: 'A small Specification toolkit',
        source: `class Spec(ABC):
    @abstractmethod
    def is_satisfied_by(self, order: Order) -> bool: ...
    def __and__(self, other): return AndSpec(self, other)
    def __or__(self, other):  return OrSpec(self, other)
    def __invert__(self):     return NotSpec(self)

class AndSpec(Spec):
    def __init__(self, a, b): self.a, self.b = a, b
    def is_satisfied_by(self, o): return self.a.is_satisfied_by(o) and self.b.is_satisfied_by(o)

class OrSpec(Spec):
    def __init__(self, a, b): self.a, self.b = a, b
    def is_satisfied_by(self, o): return self.a.is_satisfied_by(o) or self.b.is_satisfied_by(o)

class NotSpec(Spec):
    def __init__(self, a): self.a = a
    def is_satisfied_by(self, o): return not self.a.is_satisfied_by(o)

class IsPaid(Spec):
    def is_satisfied_by(self, o): return o.status == "paid"

class TotalOver(Spec):
    def __init__(self, floor: Money): self.floor = floor
    def is_satisfied_by(self, o): return o.total().cents > self.floor.cents`,
        highlight: [4, 5, 9, 10, 21],
      },
    },
    {
      title: 'Repo pitfalls',
      tag: 'tradeoff',
      heading: 'Where repositories go wrong',
      eli5: 'If every time you ask for one toy set, the shopkeeper walks back to the stockroom once per piece, you wait all day. And if she hands you the stockroom key, she is no use anymore.',
      body: [
        '**N+1 queries**: loading 500 orders and then touching each order\'s customer fires 1 + 500 queries. Give the repository an explicit fetch method that joins in one trip.',
        '**Filtering in Python**: an in-memory spec over a SQL repo pulls every row. Translate specs to a `WHERE` clause, or add a purpose-built query method. **Leaks**: never return a session or query object.',
      ],
      keyIdea: 'A repository hides the query plan, so you must check what it runs. Never let storage types or lazy loading escape it.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: 'all columns' },
      metricTones: { test: 'good' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2), status: 'active' },
          { ...sqlRepo, at: at(0, -2), chips: [{ text: '501 queries', tone: 'bad' }] },
          { ...db, at: at(4, -2), status: 'hot', load: 91 },
        ],
        links: [link('svc', 'sqlrepo', { label: 'orders.all()' }), link('sqlrepo', 'db', { label: '1 + 500', labelTone: 'warn' })],
        flows: [
          { path: ['sqlrepo', 'db'], tone: 'request', label: 'SELECT customer', count: 4, duration: 1.0 },
          { path: ['db', 'sqlrepo'], tone: 'error', label: 'slow', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Fixes at a glance',
          icon: 'Bug',
          rows: [
            { text: 'N+1 lazy loading', value: 'join in one query', tone: 'warn' },
            { text: 'Filter 10M rows in Python', value: 'push spec to SQL', tone: 'warn' },
            { text: 'Return session or query', value: 'return objects', tone: 'bad' },
            { text: 'Generic repo for all', value: 'one per aggregate', tone: 'warn' },
          ],
        },
        caption: 'The abstraction hides cost, not removes it',
      },
    },
    {
      title: 'Unit of Work',
      tag: 'concept',
      heading: 'Unit of Work: save several things, all or nothing',
      eli5: 'At the toy shop a basket holds everything one customer buys. The cashier rings the basket as one sale: either every item is paid and handed over, or nothing leaves the shop.',
      body: [
        'Paying an order also adds loyalty points to the customer. Two saves, two aggregates. If the second one fails, the first must not stick. Spanning two aggregates in one transaction is a pragmatic choice here. The usual DDD rule is one aggregate per transaction, with loyalty points updated afterward through an event.',
        'A **Unit of Work** wraps one business operation in one transaction. It hands out the repositories, and commits when the block ends normally or rolls back on any exception.',
      ],
      keyIdea: 'A Unit of Work gives one operation one transaction, and the repositories it hands out all share it.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2) },
          { ...uow, at: at(0, -2), status: 'active', chips: ['one transaction'] },
          { id: 'orders', kind: 'block', size: 0.8, at: at(2.4, 3.2), label: 'orders', sub: 'OrderRepo', icon: 'Package', tint: 'green' },
          { id: 'customers', kind: 'block', size: 0.8, at: at(-2.4, 3.2), label: 'customers', sub: 'CustomerRepo', icon: 'Users', tint: 'green' },
        ],
        links: [link('svc', 'uow', { label: 'with' }), link('uow', 'orders', { label: 'has-a' }), link('uow', 'customers', { label: 'has-a' })],
        flows: [
          { path: ['svc', 'uow'], tone: 'request', label: '__enter__', duration: 1.2 },
          { path: ['uow', 'orders'], tone: 'request', label: 'save(order)', duration: 1.2, delay: 1.3 },
          { path: ['uow', 'customers'], tone: 'request', label: 'save(customer)', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'One operation, one transaction',
          icon: 'Layers',
          rows: [
            { text: 'Save order as paid', value: 'step 1' },
            { text: 'Add loyalty points', value: 'step 2' },
            { text: 'Both succeed', value: 'COMMIT', tone: 'good' },
            { text: 'Any one fails', value: 'ROLLBACK', tone: 'bad' },
          ],
        },
        caption: 'A basket for the whole operation',
      },
    },
    {
      title: 'UoW code',
      tag: 'concept',
      heading: 'A context manager makes commit and rollback automatic',
      eli5: 'The cashier opens the basket when you step up and closes it when you leave. If something falls and breaks, she puts everything back on the shelf automatically.',
      body: [
        'In Python the Unit of Work is a **context manager**. `__enter__` opens a connection and builds the repositories on it. `__exit__` commits if the block was clean and rolls back if it raised, then closes the connection.',
        'The service has no `commit()` call to forget. It reads: open the unit, load, change, save. It also turns its result into a DTO before the block ends, which a later step explains.',
      ],
      keyIdea: 'Wrap the operation in `with uow:`. Success commits, any exception rolls back, and the service stays free of transaction code.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2), chips: ['with uow:'] },
          { ...uow, at: at(0, -2), status: 'active' },
          { id: 'sqluow', kind: 'block', at: at(4, -2), label: 'SqlUnitOfWork', sub: 'extends', icon: 'Database', tint: 'green' },
          { ...db, at: at(4, 5.4), label: 'Postgres', sub: 'one transaction' },
        ],
        links: [link('svc', 'uow', { label: 'uses' }), link('sqluow', 'uow', { label: 'extends', style: 'dashed', route: 'straight' }), link('sqluow', 'db', { label: 'COMMIT' })],
        flows: [
          { path: ['svc', 'uow', 'sqluow'], tone: 'request', label: '__enter__', duration: 1.8 },
          { path: ['sqluow', 'db'], tone: 'response', label: 'COMMIT', duration: 1.2, delay: 2.0 },
        ],
        panel: {
          title: 'Exit decides the ending',
          icon: 'Code',
          rows: [
            { text: 'Block ends cleanly', value: 'commit()', tone: 'good' },
            { text: 'Block raises', value: 'rollback()', tone: 'bad' },
            { text: 'Connection', value: 'closed either way', tone: 'muted' },
          ],
        },
        caption: 'Enter opens, exit commits or rolls back',
      },
      code: {
        language: 'python',
        title: 'UnitOfWork and the service that uses it',
        source: `class UnitOfWork(ABC):
    orders: OrderRepository
    customers: "CustomerRepository"
    def __enter__(self): return self
    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type: self.rollback()
            else:        self.commit()
        finally:
            self.close()
    @abstractmethod
    def commit(self): ...
    @abstractmethod
    def rollback(self): ...
    @abstractmethod
    def close(self): ...

class SqlUnitOfWork(UnitOfWork):
    def __init__(self, connect): self._connect = connect
    def __enter__(self):
        self._conn = self._connect()
        self.orders = SqlOrderRepo(self._conn, OrderMapper())
        self.customers = SqlCustomerRepo(self._conn)
        return self
    def commit(self):   self._conn.commit()
    def rollback(self): self._conn.rollback()
    def close(self):    self._conn.close()

def pay_order(uow_factory, order_id: int) -> "OrderDto":
    with uow_factory() as uow:
        order = uow.orders.get(order_id)
        order.pay()
        uow.orders.save(order)
        customer = uow.customers.get(order.customer_id)
        customer.earn_points(order.total())
        uow.customers.save(customer)
        return OrderAssembler.to_dto(order)`,
        highlight: [5, 7, 8, 10, 30, 37],
      },
    },
    {
      title: 'Rollback',
      tag: 'case',
      heading: 'Case: loyalty fails, the paid status is undone',
      eli5: 'The basket is rung up, but the card machine for stickers jams. The cashier puts every toy back, and the shop is exactly as it was before you came to the counter.',
      body: [
        'Say `customer.earn_points` raises because the loyalty account is frozen. The order was already marked paid in memory and saved on the same connection.',
        '`__exit__` sees the exception and calls `rollback()`. Postgres discards both writes. No half-paid order, no cleanup code. Two rules: one unit per request, and never nest them.',
      ],
      keyIdea: 'Because both repositories share one connection, a failure anywhere undoes every write in the unit.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: 'all columns' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2), status: 'hot' },
          { ...uow, at: at(0, -2), chips: [{ text: 'ROLLBACK', tone: 'bad' }] },
          { id: 'customers', kind: 'block', size: 0.8, at: at(-2.4, 3.2), label: 'customers', sub: 'account frozen', icon: 'Users', tint: 'green', status: 'down' },
          { ...db, at: at(4, -2), label: 'Postgres', sub: 'unchanged', status: 'ok' },
        ],
        links: [link('svc', 'uow', { label: 'with' }), link('uow', 'customers', { label: 'has-a' }), link('uow', 'db', { label: 'ROLLBACK', labelTone: 'bad' })],
        flows: [
          { path: ['uow', 'customers'], tone: 'request', label: 'earn_points()', duration: 1.2 },
          { path: ['customers', 'uow'], tone: 'error', label: 'raises', duration: 1.2, delay: 1.3 },
          { path: ['uow', 'db'], tone: 'error', label: 'rollback()', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'State after the failure',
          icon: 'Table',
          rows: [
            { text: 'Order in Postgres', value: 'still open', tone: 'good' },
            { text: 'Customer points', value: 'unchanged', tone: 'good' },
            { text: 'Exception', value: 'reaches caller', tone: 'warn' },
          ],
        },
        caption: 'One failure undoes the whole unit',
      },
      quiz: {
        question: 'A service saves an order, then saving the customer raises an error inside the with block. What happens?',
        options: [
          'The order stays saved, the customer is not',
          'The Unit of Work rolls back both writes and the exception reaches the caller',
          'The Unit of Work retries the customer save until it works',
          'Nothing, because repositories commit by themselves',
        ],
        answer: 1,
        explain: '__exit__ sees the exception and calls rollback on the shared connection. Both writes vanish, and the error still propagates so the caller can respond.',
      },
    },
    {
      title: 'Leaky entity',
      tag: 'problem',
      heading: 'Returning the entity to the outside world leaks too much',
      eli5: 'A customer asks "what is in my gift box?" The shopkeeper hands over the whole shelf, price tags, stockroom codes and all. The customer sees too much and can reach in to change things.',
      body: [
        'The controller returns the `Order` straight as JSON. It exposes internals (`customer_id`, status flags). A later column becomes a public field by accident, and a client can read a hidden one.',
        'Worse, with an ORM the entity may lazy-load after its session closes and raise `DetachedInstanceError`. The shape of your API now depends on your tables.',
      ],
      keyIdea: 'An entity is shaped for rules and storage. Sending it across a boundary couples the outside world to both.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '14 fields' },
      metricTones: { exposed: 'bad' },
      scene: {
        nodes: [
          { ...ctrl, at: at(-4, -2) },
          { ...order, at: at(0, -2), status: 'hot', chips: [{ text: 'customer_id', tone: 'warn' }, { text: 'internal flags', tone: 'bad' }] },
          { id: 'client', kind: 'phone', at: at(4, -2), label: 'mobile app', sub: 'sees 14 fields' },
        ],
        links: [link('ctrl', 'order', { label: 'uses' }), link('ctrl', 'client', { label: 'JSON', labelTone: 'warn', route: 'straight' })],
        flows: [
          { path: ['order', 'ctrl', 'client'], tone: 'error', label: 'whole Order as JSON', duration: 2.2 },
        ],
        panel: {
          title: 'What leaks',
          icon: 'Bug',
          rows: [
            { text: 'Internal fields visible', value: '14 of 14', tone: 'bad' },
            { text: 'Lazy load after session', value: 'DetachedInstanceError', tone: 'bad' },
            { text: 'Table change breaks API', value: 'yes', tone: 'bad' },
          ],
        },
        caption: 'The API mirrors the storage',
      },
    },
    {
      title: 'DTO',
      tag: 'concept',
      heading: 'DTO: a flat, frozen shape built for the crossing',
      eli5: 'For the gift box slip, the shopkeeper writes only what the customer needs: toy names and one total. The slip is plain paper with no strings to the stockroom.',
      body: [
        'A **data transfer object** carries data across a boundary and has no behavior. Fields are plain (`str`, `int`, a tuple of other DTOs). It has no repository, no rules and no lazy loading.',
        'An **assembler** builds it from the aggregate. Do this inside the Unit of Work, before the session closes. The API now shows 4 fields chosen on purpose.',
      ],
      keyIdea: 'A DTO is a plain data envelope. You choose its fields, so storage changes never reach the client.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '4 fields' },
      metricTones: { exposed: 'good' },
      scene: {
        nodes: [
          { ...order, at: at(-4, -2) },
          { id: 'assembler', kind: 'block', at: at(0, -2), label: 'OrderAssembler', sub: 'builds DTOs', icon: 'Package', tint: 'green' },
          { ...dto, at: at(4, -2), status: 'ok', chips: ['id, status, total', 'lines'] },
        ],
        links: [link('order', 'assembler', { label: 'read by' }), link('assembler', 'dto', { label: 'creates' })],
        flows: [
          { path: ['order', 'assembler'], tone: 'request', label: 'to_dto(order)', duration: 1.4 },
          { path: ['assembler', 'dto'], tone: 'response', label: 'OrderDto', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Entity against DTO',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Order: methods and rules', value: 'inside', tone: 'good' },
            { text: 'OrderDto: plain fields', value: 'outside', tone: 'good' },
            { text: 'Fields exposed', value: '14 to 4', tone: 'good' },
          ],
        },
        caption: 'Data only, no behavior',
      },
      code: {
        language: 'python',
        title: 'OrderDto and its assembler',
        source: `@dataclass(frozen=True)
class OrderLineDto:
    sku: str
    qty: int
    subtotal: str

@dataclass(frozen=True)
class OrderDto:
    id: int
    status: str
    total: str
    lines: tuple[OrderLineDto, ...]

def fmt(m: Money) -> str:
    return f"{m.cents / 100:.2f} {m.currency}"

class OrderAssembler:
    @staticmethod
    def to_dto(order: Order) -> OrderDto:
        lines = tuple(OrderLineDto(l.sku, l.qty, fmt(l.price.times(l.qty))) for l in order.lines)
        return OrderDto(order.id, order.status, fmt(order.total()), lines)`,
        highlight: [7, 8, 9, 20, 21],
      },
    },
    {
      title: 'Which is which',
      tag: 'tradeoff',
      heading: 'Entity, value object and DTO side by side',
      eli5: 'The teddy bear has a name tag, the Lego brick is interchangeable, and the gift slip is a note you hand away. Three different things, so they get three different kinds of care.',
      body: [
        'A DTO and a value object are both frozen and compared by fields, so they look alike. The difference is purpose. A value object carries domain meaning and rules. A DTO only moves data and has none.',
        'DTOs also run inbound. A `PlaceOrderRequest` validates the shape of an incoming body at the edge, and the service turns it into domain objects.',
      ],
      keyIdea: 'Entity for identity and rules, value object for meaning and rules, DTO for moving data across a boundary.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '4 fields' },
      scene: {
        nodes: [
          { ...order, at: at(-4, -2), label: 'Order', sub: 'entity' },
          { ...money, at: at(0, -2) },
          { ...dto, at: at(4, -2), sub: 'DTO' },
        ],
        links: [link('order', 'money', { label: 'has-a' }), link('money', 'dto', { label: 'formatted into', style: 'dashed' })],
        flows: [{ path: ['order', 'money', 'dto'], tone: 'data', label: 'total() to "12.50 USD"', duration: 2.4 }],
        panel: {
          title: 'Three kinds of object',
          icon: 'Table',
          rows: [
            { text: 'Entity: has id, changes, holds rules', value: 'Order' },
            { text: 'Value object: no id, frozen, holds rules', value: 'Money', tone: 'good' },
            { text: 'DTO: no id needed, frozen, no rules', value: 'OrderDto', tone: 'good' },
            { text: 'Inbound DTO: checks shape only', value: 'PlaceOrderRequest', tone: 'muted' },
          ],
        },
        caption: 'Purpose tells them apart',
      },
    },
    {
      title: 'Full request',
      tag: 'case',
      heading: 'One request through every pattern',
      eli5: 'A grown-up asks the door desk to pay for set 1001. The sales desk opens a basket, the shopkeeper fetches the set, the cashier pays, and the customer leaves with a simple slip.',
      body: [
        'A `POST /orders/1001/pay` arrives. The controller calls `pay_order`. The Unit of Work opens a transaction. The repository returns an `Order`, built by the mapper from rows.',
        'The aggregate pays itself and `Money` does the math. The repositories save, and the assembler builds an `OrderDto` inside the block. The unit then commits on exit, and the controller serializes the DTO.',
      ],
      keyIdea: 'Each pattern owns one joint: repository for storage, mapper for shape, unit for transactions, DTO for the exit.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '4 fields' },
      scene: {
        nodes: [
          { ...ctrl, at: at(-5, -3.6) },
          { ...svc, at: at(-1, -3.6) },
          { ...uow, at: at(-1, 2.6), label: 'UnitOfWork', sub: 'with block' },
          { ...order, at: at(2.5, 2.6) },
          { ...dto, at: at(6, -3.6) },
        ],
        links: [link('ctrl', 'svc'), link('svc', 'uow', { label: 'with' }), link('uow', 'order', { label: 'loads' }), link('svc', 'dto', { label: 'returns' })],
        flows: [
          { path: ['ctrl', 'svc'], tone: 'request', label: 'pay_order(1001)', duration: 1 },
          { path: ['svc', 'uow', 'order'], tone: 'request', label: 'get, pay, save', duration: 1.6, delay: 1.1 },
          { path: ['order', 'uow', 'svc'], tone: 'response', label: 'saved', duration: 1.4, delay: 2.8 },
          { path: ['svc', 'dto'], tone: 'response', label: 'OrderDto', duration: 1.2, delay: 4.3 },
          { path: ['svc', 'uow'], tone: 'request', label: 'commit on exit', duration: 1.2, delay: 5.6 },
        ],
        panel: {
          title: 'The sequence',
          icon: 'Route',
          rows: [
            { text: '1. Controller calls the service', value: 'edge' },
            { text: '2. Unit opens a transaction', value: 'uow' },
            { text: '3. Repo + mapper build Order', value: 'storage' },
            { text: '4. Order pays, Money adds', value: 'domain' },
            { text: '5. DTO built, then commit on exit', value: 'exit', tone: 'good' },
          ],
        },
        caption: 'Edge, unit, repository, aggregate, DTO',
      },
    },
    {
      title: 'Rich or anemic',
      tag: 'tradeoff',
      heading: 'Keep the rules in the objects, not in the service',
      eli5: 'The cashier should know how to ring a sale herself. If the manager must stand over her and say every button to press, the cashier is just a till and the manager does all the thinking.',
      body: [
        'An **anemic** model has entities with only fields, and every rule sits in a big service. Rules scatter and any caller can skip them. A **rich** model puts behavior on `Order` and `Money`.',
        'The service stays thin: load, call a method, save, return a DTO. A rule change is then one edit in one class, and the service tests need only a fake repository.',
      ],
      keyIdea: 'Put behavior next to the data it guards. A service that orchestrates is healthier than one that decides.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '4 fields' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2), chips: [{ text: 'load, call, save', tone: 'good' }] },
          { ...order, at: at(0, -2), status: 'active', chips: ['pay()', 'add_line()', 'total()'] },
          { ...money, at: at(4, -2), chips: ['add()', 'times()'] },
        ],
        links: [link('svc', 'order', { label: 'uses' }), link('order', 'money', { label: 'has-a' })],
        flows: [{ path: ['svc', 'order', 'money'], tone: 'request', label: 'order.pay()', duration: 2 }],
        panel: {
          title: 'Where does the rule live?',
          icon: 'Scale',
          rows: [
            { text: 'Anemic: rule in service', value: 'skippable', tone: 'bad' },
            { text: 'Anemic: copies of the rule', value: '3', tone: 'bad' },
            { text: 'Rich: rule in Order', value: '1 place', tone: 'good' },
            { text: 'Rich: service size', value: '5 lines', tone: 'good' },
          ],
        },
        caption: 'Behavior beside the data',
      },
    },
    {
      title: 'When to skip',
      tag: 'tradeoff',
      heading: 'These patterns cost something',
      eli5: 'A lemonade stand with one cup does not need a stockroom, a basket and a shopkeeper. Extra desks only slow things down until the shop actually grows.',
      body: [
        'Each pattern adds files and indirection. An `IUserRepository` with exactly one implementation "for flexibility" usually pays nothing back. A CRUD admin screen where the logic is `SELECT *` does not need a domain layer.',
        'Reach for them when rules are complex, tests are slow, the database may change, or several callers share one rule. The ORM is already a Unit of Work and a mapper, so do not wrap it twice for no reason.',
      ],
      keyIdea: 'Use these patterns where there is real domain logic to protect. For plain CRUD, the ORM alone is enough.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '4 fields' },
      scene: {
        nodes: [
          { id: 'crud', kind: 'block', at: at(-4, -2), label: 'Admin CRUD', sub: 'SELECT, UPDATE', icon: 'Table', tint: 'gray', chips: [{ text: 'use the ORM', tone: 'good' }] },
          { ...order, at: at(1, -2), sub: 'real rules', chips: [{ text: 'use patterns', tone: 'good' }] },
          { ...db, at: at(4, 5.4), label: 'Postgres', sub: 'either way' },
        ],
        links: [link('crud', 'db', { label: 'ORM' }), link('order', 'db', { label: 'repository', style: 'dashed' })],
        flows: [{ path: ['crud', 'db'], tone: 'request', label: 'UPDATE', duration: 1.6 }],
        panel: {
          title: 'Worth it when',
          icon: 'Scale',
          rows: [
            { text: 'Rules span several objects', value: 'yes', tone: 'good' },
            { text: 'Tests need a live database', value: 'yes', tone: 'good' },
            { text: 'One implementation, no tests', value: 'skip', tone: 'warn' },
            { text: 'Logic is just SELECT and UPDATE', value: 'skip', tone: 'warn' },
          ],
        },
        caption: 'Match the weight to the problem',
      },
    },
    {
      title: 'Fast tests',
      tag: 'case',
      heading: 'The payoff: a rule test with no database',
      eli5: 'To practice the pay-for-a-toy routine, the cashier uses play money and a play stockroom with three toys. She learns all the steps in seconds with no real shop open.',
      body: [
        'A test builds a `FakeUnitOfWork` holding in-memory repos with order 1001 and its customer, calls `pay_order`, and checks the DTO and the stored order. No SQL, no server, 0.02 seconds.',
        'Add a test where the fake customer repo raises, and assert the order stays open. Keep a few slower integration tests against real Postgres to prove `SqlOrderRepo` and the mapper work.',
      ],
      keyIdea: 'Rules tested against fakes run in milliseconds. A handful of integration tests cover the SQL side.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '4 fields' },
      metricTones: { test: 'good', sql: 'good', copies: 'good', exposed: 'good' },
      scene: {
        nodes: [
          { id: 'test', kind: 'block', at: at(-4, -2), label: 'unit test', sub: 'pytest', icon: 'Bug', tint: 'gray', status: 'ok', badge: '0.02 s' },
          { id: 'fakeuow', kind: 'block', at: at(0, -2), label: 'FakeUnitOfWork', sub: 'extends', icon: 'Layers', tint: 'green' },
          { ...memRepo, at: at(4, -2) },
        ],
        links: [link('test', 'fakeuow', { label: 'calls' }), link('fakeuow', 'memrepo', { label: 'has-a' })],
        flows: [
          { path: ['test', 'fakeuow', 'memrepo'], tone: 'request', label: 'pay_order(1001)', duration: 1.8 },
          { path: ['memrepo', 'fakeuow', 'test'], tone: 'response', label: 'OrderDto: paid', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'A test with no database',
          icon: 'Code',
          code: 'uow = FakeUnitOfWork(orders=[order_1001], customers=[customer_7])\ndto = pay_order(lambda: uow, 1001)\nassert dto.status == "paid"\nassert uow.orders.get(1001).status == "paid"',
          footer: { text: 'No SQL, no server, no cleanup', tone: 'good' },
        },
        caption: 'Same service, fake backend',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Five small objects, each with one job',
      eli5: 'The toy shop runs smoothly: the shopkeeper fetches, the packer builds, the basket rings everything together, the Lego bricks never change, and customers get a simple slip.',
      body: [
        '**Value objects** are frozen and self-checking. **Aggregates** guard rules through one root. A **repository** hides storage, and a **mapper** translates. A **Unit of Work** commits or rolls back as one.',
        'A **DTO** is the plain envelope for crossing a boundary. Use all of it where domain rules are rich. Skip it for plain CRUD.',
      ],
      keyIdea: 'Keep rules in the domain, storage behind a repository, transactions in a Unit of Work, and outside shapes in DTOs.',
      metrics: { sql: '1', test: '0.02 s', copies: '1', exposed: '4 fields' },
      metricTones: { sql: 'good', test: 'good', copies: 'good', exposed: 'good' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2) },
          { ...order, at: at(0, -2), chips: ['rules'] },
          { ...repo, at: at(4, -2) },
          { ...dto, at: at(-2, 6) },
        ],
        links: [link('svc', 'order', { label: 'uses' }), link('svc', 'repo', { label: 'uses', route: 'straight' }), link('svc', 'dto', { label: 'returns' })],
        flows: [
          { path: ['svc', 'repo'], tone: 'request', label: 'get(id)', duration: 1.4 },
          { path: ['repo', 'svc'], tone: 'response', label: 'Order', duration: 1.4, delay: 1.5 },
          { path: ['svc', 'dto'], tone: 'response', label: 'OrderDto', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Pattern, job',
          icon: 'List',
          rows: [
            { text: 'Value object', value: 'frozen meaning' },
            { text: 'Aggregate root', value: 'guards rules' },
            { text: 'Repository + mapper', value: 'storage' },
            { text: 'Unit of Work', value: 'transaction' },
            { text: 'DTO', value: 'boundary shape' },
          ],
        },
        caption: 'One job per object',
      },
      quiz: {
        question: 'Which statement about these patterns is correct?',
        options: [
          'A DTO should hold business rules so the client can reuse them',
          'A value object is compared by identity and changed in place',
          'A repository returns domain objects, and the DTO is built from them before the Unit of Work ends',
          'Every CRUD app needs a repository, a mapper and a Unit of Work around the ORM',
        ],
        answer: 2,
        explain: 'The repository returns whole aggregates. The service then maps them to a plain DTO inside the unit so no lazy loading escapes. Value objects compare by value and never change, DTOs carry no rules, and plain CRUD can lean on the ORM.',
      },
    },
  ],
};
