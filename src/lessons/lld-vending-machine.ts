import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Colors by role: violet = interface, blue = abstract class, green = concrete class, gray = external system
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

const TL = at(-3.8, -3.8);
const TM = at(0, -3.8);
const TR = at(3.8, -3.8);
const BL = at(-3.6, 3.8);
const BM = at(0, 3.8);
const BR = at(3.6, 3.8);

const customer = (extra: Partial<SceneNode> = {}): SceneNode => ({ id: 'customer', kind: 'user', at: TL, label: 'customer', sub: 'at the machine', ...extra });
const machine = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('machine', pos, 'VendingMachine', 'context', 'green', 'Package', extra);
const inventory = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('inventory', pos, 'Inventory', 'slot to count', 'green', 'Boxes', extra);
const motor = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('motor', pos, 'Motor', 'hardware', 'gray', 'Cpu', extra);
const stateI = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('state', pos, 'State', 'interface', 'violet', 'Plug', extra);
const idle = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('idle', pos, 'Idle', 'concrete', 'green', 'Workflow', extra);
const hasMoney = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('hasMoney', pos, 'HasMoney', 'concrete', 'green', 'Workflow', extra);
const dispensing = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('dispensing', pos, 'Dispensing', 'concrete', 'green', 'Workflow', extra);
const soldOut = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('soldOut', pos, 'SoldOut', 'concrete', 'green', 'Workflow', extra);
const payI = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('pay', pos, 'PaymentStrategy', 'interface', 'violet', 'Plug', extra);
const cash = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('cash', pos, 'Cash', 'concrete', 'green', 'Receipt', extra);
const card = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('card', pos, 'Card', 'concrete', 'green', 'Receipt', extra);
const upi = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('upi', pos, 'UPI', 'concrete', 'green', 'Receipt', extra);
const gateway = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('gateway', pos, 'Gateway', 'bank or UPI app', 'gray', 'Webhook', extra);
const saga = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('saga', pos, 'DispenseSaga', 'steps + undos', 'green', 'Route', extra);

export const lldVendingMachine: Lesson = {
  id: 'lld-vending-machine',
  title: 'Vending machine',
  tagline: 'Design a snack machine as objects: the State pattern, Strategy for payment, a lock for two customers, and a saga when the motor jams.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Pull the requirements and the core objects out of a vague prompt',
    'Why an if/else ladder per method falls apart, and why an enum does not fix it',
    'The State pattern: one class per state, the machine delegates to it',
    'Adding a state (refund, maintenance) without touching the existing ones',
    'The Strategy pattern for cash, card and UPI payment',
    'A lock for concurrent customers, and a saga with compensation for partial failure',
  ],
  metrics: [
    { key: 'branches', label: 'If/elif branches', icon: 'Split' },
    { key: 'edits', label: 'Edits for a new state', icon: 'Code' },
    { key: 'pay', label: 'Payment types', icon: 'Receipt' },
    { key: 'safe', label: 'Safe', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'The prompt',
      tag: 'problem',
      heading: 'Design a vending machine',
      eli5: 'A **vending machine** is a tiny shop with no shopkeeper. It has to know what to do when you drop a coin, push a button, or the snacks run out.',
      body: [
        'The interview prompt is one line. You pin it down: take coins, let the user pick a slot, hand over the item, return change, refuse when the slot is empty, and let the user cancel for a refund.',
        'The hard part is the timing: the same button means different things at different moments.',
      ],
      keyIdea: 'A vending machine is a small system whose behavior depends on what happened before. That is the whole design problem.',
      metrics: { branches: '?', edits: '?', pay: '?', safe: '?' },
      scene: {
        nodes: [customer(), machine(TM, { status: 'active', chips: ['insert(50)', 'select("A3")'] }), inventory(), motor()],
        links: [link('customer', 'machine', { label: 'insert, select' }), link('machine', 'inventory', { label: 'has-a' }), link('machine', 'motor', { label: 'uses' })],
        flows: [
          { path: ['customer', 'machine'], tone: 'request', label: 'insert(50)', duration: 1.2 },
          { path: ['customer', 'machine'], tone: 'request', label: 'select("A3")', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Accept money', value: 'insert' },
            { text: 'Choose a slot', value: 'select' },
            { text: 'Hand over item', value: 'dispense' },
            { text: 'Give change', value: 'refund' },
            { text: 'Slot empty', value: 'sold out', tone: 'warn' },
            { text: 'User cancels', value: 'cancel' },
          ],
        },
        caption: 'One line of prompt, six behaviors',
      },
    },
    {
      title: 'Core objects',
      tag: 'concept',
      heading: 'Find the nouns first',
      eli5: 'Before building the shop, list what is in it: the **machine** itself, a shelf that counts snacks, and a little motor that pushes a snack out.',
      body: [
        'Nouns become classes. `VendingMachine` is the context that the customer talks to. `Inventory` maps a slot to a count. `Motor` is hardware behind a small interface, so tests can fake it.',
        'Prices live in a slot table. Money is stored as integers (cents or paise), never floats.',
      ],
      keyIdea: 'Name the objects and who owns what before writing any method. Hardware sits behind an interface.',
      metrics: { branches: '-', edits: '-', pay: '-', safe: '-' },
      scene: {
        nodes: [machine(TM, { status: 'active' }), inventory(BL), motor(BR)],
        links: [link('machine', 'inventory', { label: 'has-a' }), link('machine', 'motor', { label: 'uses' })],
        flows: [
          { path: ['machine', 'inventory'], tone: 'request', label: 'count("A3")', duration: 1.2 },
          { path: ['inventory', 'machine'], tone: 'response', label: '4', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Fields on the machine',
          icon: 'Code',
          code: 'inventory: Inventory\nprice:     dict[slot, int]\nbalance:   int  # cents\nselected:  slot | None\nmotor:     Motor',
        },
        caption: 'Context owns the data, hardware stays behind an interface',
      },
    },
    {
      title: 'If/else ladder',
      tag: 'concept',
      heading: 'Version 1: a state string and an if/elif ladder',
      eli5: 'The shopkeeper keeps one sticky note that says IDLE or HAS_MONEY. Every time anything happens, he reads the note and runs down a long list of "if the note says...".',
      body: [
        'The first attempt stores `self.state = "IDLE"` and every method checks it. `insert`, `select`, `dispense` and `cancel` each get one branch per state.',
        'It works for three states. It is the shape that goes wrong once the fourth arrives.',
      ],
      keyIdea: 'Every method re-asks the same question: what state am I in? The question is repeated, not answered once.',
      metrics: { branches: '12', edits: '4 methods', pay: '1', safe: '-' },
      metricTones: { branches: 'warn' },
      scene: {
        nodes: [customer(), machine(TM, { status: 'hot', badge: 'state = "IDLE"' }), inventory(BL)],
        links: [link('customer', 'machine', { label: 'insert, select' }), link('machine', 'inventory', { label: 'has-a' })],
        flows: [
          { path: ['customer', 'machine'], tone: 'request', label: 'insert(50)', duration: 1.2 },
          { path: ['machine', 'customer'], tone: 'error', label: '"wait"', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Branches per method',
          icon: 'Table',
          rows: [
            { text: 'insert', value: '3 branches' },
            { text: 'select', value: '3 branches' },
            { text: 'dispense', value: '3 branches' },
            { text: 'cancel', value: '3 branches' },
            { text: 'Total', value: '12', tone: 'warn' },
          ],
          footer: { text: '3 states times 4 methods', tone: 'warn' },
        },
        caption: 'Same ladder, copied into every method',
      },
      code: {
        language: 'python',
        title: 'v1: state strings and if/elif',
        source: `class VendingMachine:
    def __init__(self):
        self.state = "IDLE"
        self.balance = 0
        self.selected = None

    def insert(self, amt):
        if self.state == "IDLE":
            self.state = "HAS_MONEY"
            self.balance += amt
        elif self.state == "HAS_MONEY":
            self.balance += amt
        elif self.state == "DISPENSING":
            print("wait")

    def select(self, item):
        if self.state == "HAS_MONEY":
            if self.balance >= self.price[item]:
                self.state = "DISPENSING"
        elif self.state == "IDLE":
            print("pay first")
        # ... and so on for every state`,
        highlight: [8, 11, 13, 19, 22],
      },
    },
    {
      title: 'Add a state',
      tag: 'case',
      heading: 'Case: add a REFUND state and edit every method',
      eli5: 'The shopkeeper gets a new mood, "giving money back". Now he must walk through every page of his rulebook and add a line for that mood to each one.',
      body: [
        'Product asks for `REFUND`. In the ladder, that means a new `elif` in all four methods, so 4 states times 4 methods is 16 branches. Miss one and the machine takes coins in a state where it should not.',
        'The cost is states times methods, and every edit risks the states that already worked.',
      ],
      keyIdea: 'With if/elif, behavior is sliced by method. A new state cuts across all of them, so one feature touches everything.',
      metrics: { branches: '16', edits: '4 methods', pay: '1', safe: '-' },
      metricTones: { branches: 'bad', edits: 'bad' },
      scene: {
        nodes: [machine(TM, { status: 'hot', badge: '4 states' }), inventory(BL, { status: 'dim' }), motor(BR, { status: 'dim' })],
        links: [link('machine', 'inventory'), link('machine', 'motor')],
        panel: {
          title: 'States times methods',
          icon: 'Table',
          rows: [
            { text: 'IDLE', value: '4 branches' },
            { text: 'HAS_MONEY', value: '4 branches' },
            { text: 'DISPENSING', value: '4 branches' },
            { text: 'REFUND (new)', value: '4 new', tone: 'bad' },
            { text: 'Total', value: '16', tone: 'bad' },
          ],
        },
        caption: 'One new state, four methods to edit',
      },
    },
    {
      title: 'Enum states',
      tag: 'tradeoff',
      heading: 'Version 2: an enum names the states, the ladder stays',
      eli5: 'Writing the moods on colored cards instead of scribbles is tidier. The shopkeeper still reads a card and walks the same long list every time.',
      body: [
        'An `Enum` removes typos: `S.IDLE` instead of `"IDEL"`. It is a real gain and costs nothing.',
        'It does not fix the structure. Every method still has `if self.state == ...` for every state. Naming the states did not move the behavior to where the state lives.',
      ],
      keyIdea: 'An enum makes states safe to name. It does not make behavior easy to add.',
      metrics: { branches: '16', edits: '4 methods', pay: '1', safe: '-' },
      metricTones: { branches: 'bad' },
      scene: {
        nodes: [machine(TM, { status: 'hot', badge: 'S.HAS_MONEY' }), blk('enum', BM, 'S (Enum)', 'names only', 'gray', 'List')],
        links: [link('machine', 'enum', { label: 'reads' })],
        flows: [{ path: ['machine', 'enum'], tone: 'request', label: 'if state == ...', duration: 1.4 }],
        panel: {
          title: 'What improved',
          icon: 'Code',
          code: 'class S(Enum):\n    IDLE = auto()\n    HAS_MONEY = auto()\n    DISPENSING = auto()\n    REFUND = auto()',
          footer: { text: 'Same ladder in every method', tone: 'warn' },
        },
        caption: 'Better names, same branching',
      },
    },
    {
      title: 'State diagram',
      tag: 'concept',
      heading: 'Draw the states and the events that move between them',
      eli5: 'The machine is always in exactly one mood: waiting, holding your coins, giving the snack, or empty. Each thing you do moves it to the next mood.',
      body: [
        'Four states: `Idle`, `HasMoney`, `Dispensing`, `SoldOut`. Events are `insert`, `select`, `dispense`, `cancel` and an operator `restock`. `SoldOut` means every slot is empty. One empty slot only refuses that choice.',
        'This table is the real specification. The design question is where to keep it: in one ladder per method, or one class per state.',
      ],
      keyIdea: 'A state machine is a table of (state, event) to (action, next state). The pattern decides where that table lives in code.',
      metrics: { branches: '-', edits: '-', pay: '-', safe: '-' },
      scene: {
        nodes: [idle(TL), hasMoney(TM), dispensing(TR), soldOut(BM)],
        links: [
          link('idle', 'hasMoney', { label: 'insert' }),
          link('hasMoney', 'dispensing', { label: 'select' }),
          link('dispensing', 'soldOut', { label: 'all slots empty', style: 'dashed' }),
          link('soldOut', 'idle', { label: 'restock', style: 'dashed' }),
        ],
        flows: [
          { path: ['idle', 'hasMoney'], tone: 'request', label: 'insert', duration: 1.2 },
          { path: ['hasMoney', 'dispensing'], tone: 'request', label: 'select', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Transitions',
          icon: 'Table',
          rows: [
            { text: 'Idle + insert', value: 'HasMoney' },
            { text: 'Idle + select', value: 'stay Idle' },
            { text: 'HasMoney + select ok', value: 'Dispensing' },
            { text: 'HasMoney + empty or short', value: 'stay HasMoney', tone: 'warn' },
            { text: 'Dispensing + done', value: 'Idle, HasMoney, SoldOut' },
            { text: 'SoldOut + restock', value: 'Idle', tone: 'good' },
          ],
        },
        caption: 'Four states, cancel returns to Idle',
      },
    },
    {
      title: 'State interface',
      tag: 'concept',
      heading: 'Version 3: one class per state, one shared interface',
      eli5: 'Give the shopkeeper a different hat for each mood. Each hat comes with its own short rulebook that only covers that mood.',
      body: [
        'The **State pattern** puts each state in its own class. They all implement the same `State` interface, with one method per event: `insert`, `select`, `dispense`, `cancel`.',
        'The machine no longer asks which state it is in. It holds a state object and forwards every event to it.',
      ],
      keyIdea: 'State pattern: replace the question "which state am I in?" with an object that already knows.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      metricTones: { branches: 'good', edits: 'good' },
      scene: {
        nodes: [stateI(TM, { status: 'active' }), idle(BL), hasMoney(BM), dispensing(BR)],
        links: [link('idle', 'state', { label: 'implements' }), link('hasMoney', 'state', { label: 'implements' }), link('dispensing', 'state', { label: 'implements' })],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class State(ABC):\n    def insert(self, m, amt): ...\n    def select(self, m, item): ...\n    def dispense(self, m): ...\n    def cancel(self, m): ...',
          footer: { text: 'm is the machine (context)', tone: 'muted' },
        },
        caption: 'Same methods, different behavior per class',
      },
      code: {
        language: 'python',
        title: 'The State interface',
        source: `from abc import ABC, abstractmethod

class State(ABC):
    @abstractmethod
    def insert(self, m, amt): ...

    @abstractmethod
    def select(self, m, item): ...

    @abstractmethod
    def dispense(self, m): ...

    @abstractmethod
    def cancel(self, m): ...`,
        highlight: [3, 5, 8, 11, 14],
      },
    },
    {
      title: 'Idle, HasMoney',
      tag: 'concept',
      heading: 'Each state handles only its own events',
      eli5: 'In the **Idle** hat the shopkeeper only says "put a coin in first". In the **HasMoney** hat he checks if you can afford the snack.',
      body: [
        '`Idle.insert` adds the money and moves the machine to `HasMoney`. `Idle.select` just says "insert money first".',
        '`HasMoney.select` checks the slot and the price. An empty slot or a short balance prints a message and the machine stays in `HasMoney`, so the customer can pick again or `cancel` for a refund. Enough money means `Dispensing`.',
      ],
      keyIdea: 'A state class holds every rule for that state and changes the machine state when an event moves it on.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      metricTones: { branches: 'good' },
      scene: {
        nodes: [machine(TM), idle(BL, { status: 'active' }), hasMoney(BM)],
        links: [link('machine', 'idle', { label: 'state' }), link('idle', 'hasMoney', { label: 'set_state', labelTone: 'good' })],
        flows: [
          { path: ['machine', 'idle'], tone: 'request', label: 'insert(50)', duration: 1.2 },
          { path: ['idle', 'machine'], tone: 'response', label: 'set_state(HasMoney)', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Idle',
          icon: 'Code',
          code: 'class Idle(State):\n    def insert(self, m, amt):\n        m.balance += amt\n        m.set_state(HasMoney())\n    def select(self, m, item):\n        print("insert money first")',
        },
        caption: 'Idle accepts a coin and hands over to HasMoney',
      },
      code: {
        language: 'python',
        title: 'Idle and HasMoney',
        source: `class Idle(State):
    def insert(self, m, amt):
        m.balance += amt
        m.set_state(HasMoney())

    def select(self, m, item):
        print("insert money first")

    def dispense(self, m): print("nothing to dispense")
    def cancel(self, m): print("nothing to refund")

class HasMoney(State):
    def insert(self, m, amt):
        m.balance += amt

    def select(self, m, item):
        if m.inventory.count(item) == 0:
            print("slot empty, pick another")
        elif m.balance < m.price[item]:
            print("need", m.price[item] - m.balance, "more")
        else:
            m.selected = item
            m.set_state(Dispensing())
            m.dispense()

    def dispense(self, m): print("select an item")

    def cancel(self, m):
        m.refund_all()
        m.set_state(Idle())`,
        highlight: [3, 4, 17, 18, 19, 20, 24, 28, 29],
      },
    },
    {
      title: 'Busy and empty',
      tag: 'concept',
      heading: 'Busy and empty states refuse events on purpose',
      eli5: 'In the **Dispensing** hat the shopkeeper is handing you the snack, so he says "one moment" to everything else. In the **SoldOut** hat he points at an empty shelf.',
      body: [
        '`Dispensing` ignores `insert` and `select` (it returns extra coins). Only `dispense` does work: it drops the item, subtracts the price (cash only for now), then goes to `Idle`, to `HasMoney` if change is left, or to `SoldOut` when every slot is empty.',
        '`SoldOut` rejects everything and refunds until the operator calls `restock`. Illegal events are handled in one place per state.',
      ],
      keyIdea: 'A state that cannot accept an event says so in its own class. Illegal transitions have an owner.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      scene: {
        nodes: [machine(TM), dispensing(BL, { status: 'active' }), motor(BM, { status: 'active' }), soldOut(BR, { status: 'dim' })],
        links: [link('machine', 'dispensing', { label: 'state' }), link('dispensing', 'motor', { label: 'uses' })],
        flows: [
          { path: ['machine', 'dispensing'], tone: 'request', label: 'dispense()', duration: 1.2 },
          { path: ['dispensing', 'motor'], tone: 'request', label: 'push("A3")', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Dispensing.dispense',
          icon: 'Code',
          code: 'm.inventory.remove(m.selected)\nm.balance -= m.price[m.selected]\nm.motor.push(m.selected)\nif m.inventory.total() == 0:\n    m.set_state(SoldOut())\nelse:\n    m.set_state(Idle() if m.balance == 0\n                else HasMoney())',
        },
        caption: 'Dispense, charge, then pick the next state',
      },
      code: {
        language: 'python',
        title: 'Dispensing and SoldOut',
        source: `class Dispensing(State):
    def insert(self, m, amt): m.refund(amt)
    def select(self, m, item): print("busy")
    def cancel(self, m): print("busy")

    def dispense(self, m):
        m.inventory.remove(m.selected)
        m.balance -= m.price[m.selected]
        m.motor.push(m.selected)
        if m.inventory.total() == 0: m.set_state(SoldOut())
        else: m.set_state(Idle() if m.balance == 0 else HasMoney())

class SoldOut(State):
    def insert(self, m, amt): m.refund(amt)
    def select(self, m, item): print("sold out")
    def dispense(self, m): print("sold out")
    def cancel(self, m): m.refund_all()`,
        highlight: [2, 6, 7, 9, 10, 11, 15],
      },
    },
    {
      title: 'Context',
      tag: 'concept',
      heading: 'The machine is a thin context that forwards events',
      eli5: 'The machine is the cabinet and the shelf. When you press anything, it just passes your press to whichever hat the shopkeeper wears right now.',
      body: [
        '`VendingMachine` owns the data (`balance`, `inventory`, `price`) and one field, `state`. Its public methods have no `if`: `insert` calls `self.state.insert(self, amt)`.',
        '`set_state` is the only place a transition happens. States call it. Callers of the machine never see which state is active.',
      ],
      keyIdea: 'The context holds data and a current state. It delegates every event and never branches on the state.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      scene: {
        nodes: [customer(), machine(TM, { status: 'active' }), stateI(BM, { sub: 'current state' })],
        links: [link('customer', 'machine', { label: 'insert, select' }), link('machine', 'state', { label: 'has-a, delegates' })],
        flows: [
          { path: ['customer', 'machine'], tone: 'request', label: 'insert(50)', duration: 1.1 },
          { path: ['machine', 'state'], tone: 'request', label: 'state.insert(m, 50)', duration: 1.3, delay: 1.2 },
        ],
        panel: {
          title: 'Delegation',
          icon: 'Code',
          code: 'def insert(self, amt):\n    self.state.insert(self, amt)\n\ndef set_state(self, s):\n    self.state = s',
        },
        caption: 'No if statements in the context',
      },
      code: {
        language: 'python',
        title: 'The context class',
        source: `class VendingMachine:
    def __init__(self, inventory, price, motor):
        self.inventory = inventory
        self.price = price
        self.motor = motor
        self.balance = 0
        self.selected = None
        self.state = Idle()

    def set_state(self, s): self.state = s

    def insert(self, amt): self.state.insert(self, amt)
    def select(self, item): self.state.select(self, item)
    def dispense(self): self.state.dispense(self)
    def cancel(self): self.state.cancel(self)`,
        highlight: [8, 10, 12, 13],
      },
    },
    {
      title: 'Helpers',
      tag: 'concept',
      heading: 'Fill in the helpers the states call',
      eli5: 'The shopkeeper uses a few small tools: a shelf that counts snacks, a tray that gives coins back, and a bell for the operator. Here is what each one does.',
      body: [
        'The states call `inventory.count`, `remove` and `add`, plus `m.refund`, `m.refund_all` and `m.alert_operator`. `refund_all` is how change comes back after a purchase or a `cancel`.',
        'Coins leave through the motor coin return. `restock` is an operator action that refills a slot and sets `Idle`.',
      ],
      keyIdea: 'Every method a state calls must exist on the context or a collaborator. Money out always goes through one `refund` path.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      scene: {
        nodes: [machine(TM, { status: 'active' }), inventory(BL), motor(BR)],
        links: [link('machine', 'inventory', { label: 'count, remove, add' }), link('machine', 'motor', { label: 'return_coins' })],
        flows: [{ path: ['machine', 'motor'], tone: 'response', label: 'return_coins(25)', duration: 1.3 }],
        panel: {
          title: 'Inventory',
          icon: 'Code',
          code: 'class Inventory:\n    def count(self, slot): return self.stock.get(slot, 0)\n    def remove(self, slot): self.stock[slot] -= 1\n    def add(self, slot): self.stock[slot] += 1\n    def total(self): return sum(self.stock.values())',
        },
        caption: 'Stock in, coins out, one place each',
      },
      code: {
        language: 'python',
        title: 'Inventory and machine helpers',
        source: `class Inventory:
    def __init__(self, stock): self.stock = stock  # {"A3": 4}
    def count(self, slot): return self.stock.get(slot, 0)
    def remove(self, slot): self.stock[slot] -= 1
    def add(self, slot): self.stock[slot] += 1
    def total(self): return sum(self.stock.values())

# on VendingMachine
def refund(self, amt): self.motor.return_coins(amt)

def refund_all(self):
    self.refund(self.balance)
    self.balance = 0

def alert_operator(self, msg): print("ALERT", msg)

def restock(self, slot, n):  # operator, when SoldOut
    for _ in range(n): self.inventory.add(slot)
    self.set_state(Idle())`,
        highlight: [9, 11, 12, 13, 15, 17],
      },
    },
    {
      title: 'One purchase',
      tag: 'case',
      heading: 'Case: trace a purchase through the objects',
      eli5: 'You drop in a coin, the machine passes it to the Idle hat, which swaps to HasMoney. You press A3, the HasMoney hat swaps to Dispensing, and the snack drops.',
      body: [
        'The user inserts 100, then selects `A3` (price 75). `Idle` becomes `HasMoney`. `HasMoney.select` sees stock and enough money, so it switches to `Dispensing` and calls `dispense`.',
        '`Dispensing` removes the item, drops the balance to 25, runs the motor, and goes back to `HasMoney` with 25 left. `cancel` calls `refund_all`, which returns the 25 as change.',
      ],
      keyIdea: 'Each event is one call into the current state. The state does the work and picks what comes next.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      scene: {
        nodes: [customer(), machine(TM), hasMoney(BL, { status: 'active' }), dispensing(BM), motor(BR)],
        links: [
          link('customer', 'machine'),
          link('machine', 'hasMoney', { label: 'state' }),
          link('hasMoney', 'dispensing', { label: 'set_state' }),
          link('dispensing', 'motor', { label: 'uses' }),
        ],
        flows: [
          { path: ['customer', 'machine', 'hasMoney'], tone: 'request', label: 'select("A3")', duration: 1.8 },
          { path: ['hasMoney', 'dispensing'], tone: 'request', label: 'dispense()', duration: 1.2, delay: 1.9 },
          { path: ['dispensing', 'motor'], tone: 'request', label: 'push("A3")', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Balance and state',
          icon: 'Table',
          rows: [
            { text: 'insert(100)', value: 'HasMoney, 100' },
            { text: 'select A3 (75)', value: 'Dispensing' },
            { text: 'dispense', value: 'balance 25' },
            { text: 'Next state', value: 'HasMoney', tone: 'good' },
            { text: 'cancel', value: '25 back, Idle', tone: 'good' },
          ],
        },
        caption: 'Insert, select, dispense, back to HasMoney',
      },
    },
    {
      title: 'New state',
      tag: 'case',
      heading: 'Case: add a maintenance state with zero edits',
      eli5: 'A new mood, "closed for cleaning", just needs a new hat with its own little rulebook. No old rulebook gets touched.',
      body: [
        'Product wants an `OutOfService` state for when the operator opens the door. You write one class that implements `State` and refuses every customer event. Nothing else changes.',
        'The door sensor calls `m.set_state(OutOfService())`. This is the open/closed principle: open for extension, closed for edits.',
      ],
      keyIdea: 'A new state is a new class. The old states keep working because nobody edited them.',
      metrics: { branches: '0', edits: '1 new class', pay: '1', safe: '-' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [
          stateI(TM),
          idle(BL, { status: 'dim' }),
          hasMoney(BM, { status: 'dim' }),
          blk('oos', BR, 'OutOfService', 'new, concrete', 'green', 'Shield', { status: 'ok', badge: 'new' }),
        ],
        links: [link('idle', 'state', { label: 'implements' }), link('hasMoney', 'state', { label: 'implements' }), link('oos', 'state', { label: 'implements' })],
        panel: {
          title: 'Cost of the feature',
          icon: 'Table',
          rows: [
            { text: 'Old states edited', value: '0', tone: 'good' },
            { text: 'Machine edited', value: '0', tone: 'good' },
            { text: 'New classes', value: '1' },
          ],
          footer: { text: 'Open for extension, closed for edits', tone: 'good' },
        },
        caption: 'One new class, no ladder to edit',
      },
    },
    {
      title: 'Quiz: state',
      tag: 'tradeoff',
      heading: 'Check the State pattern',
      eli5: 'Before moving on, check you remember which hat belongs to which job.',
      body: ['The machine holds one state object and forwards events to it.'],
      keyIdea: 'Behavior that depends on state belongs in the state objects.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      scene: {
        nodes: [machine(TM, { status: 'active' }), stateI(BL, { sub: 'current' }), idle(BM), hasMoney(BR)],
        links: [link('machine', 'state', { label: 'has-a' }), link('idle', 'state', { label: 'implements' }), link('hasMoney', 'state', { label: 'implements' })],
        caption: 'One current state, many possible classes',
      },
      quiz: {
        question: 'What is the main gain of the State pattern over an enum plus if/elif in each method?',
        options: [
          'It makes the machine run faster',
          'A new state is one new class and old states are not edited',
          'It removes the need for a balance field',
          'It makes the code thread safe',
        ],
        answer: 1,
        explain: 'The pattern changes where behavior lives. Each state owns its rules, so adding one does not touch the others. It does not change speed or thread safety.',
      },
    },
    {
      title: 'Cash only',
      tag: 'problem',
      heading: 'Payment is hardcoded to coins',
      eli5: 'The shop only takes coins. Now people want to pay with a card or by phone, but the shopkeeper only knows how to count coins.',
      body: [
        'Right now `balance` means cash that went into a slot. Card and UPI do not work like that: the machine asks a bank or a payment app to charge an amount, then waits for a yes or a no.',
        'Putting `if method == "card"` inside `HasMoney` brings the ladder back, this time in the payment code.',
      ],
      keyIdea: 'Payment is a second thing that varies. Mixing it into the states repeats the old mistake.',
      metrics: { branches: '0', edits: '1 class', pay: '1', safe: '-' },
      metricTones: { pay: 'warn' },
      scene: {
        nodes: [customer({ chips: [{ text: 'scan QR', tone: 'warn' }] }), machine(TM, { status: 'hot', badge: 'cash only' }), gateway(BR)],
        links: [link('customer', 'machine', { label: 'pay by card?' }), link('machine', 'gateway', { label: 'no code path', labelTone: 'bad', style: 'dashed' })],
        flows: [{ path: ['customer', 'machine'], tone: 'error', label: 'scan QR', duration: 1.3 }],
        panel: {
          title: 'What each method needs',
          icon: 'Table',
          rows: [
            { text: 'Cash', value: 'count coins' },
            { text: 'Card', value: 'charge via gateway' },
            { text: 'UPI', value: 'QR, wait for webhook' },
          ],
          footer: { text: 'Three different protocols', tone: 'warn' },
        },
        caption: 'One payment path, three demands',
      },
    },
    {
      title: 'Strategy',
      tag: 'concept',
      heading: 'Version 4: a Strategy per payment method',
      eli5: 'The shop gets a little box that says "take payment". Coins, card and phone are three different boxes, but the shopkeeper only ever presses the same button.',
      body: [
        'The **Strategy pattern** hides a family of algorithms behind one interface. `PaymentStrategy` has `pay(amount) -> bool`. `Cash`, `Card` and `UPI` implement it.',
        'The machine and the states only know the interface. `Cash` owns the coin balance (`inserted`) and deducts on `pay`, so the machine keeps no balance of its own.',
      ],
      keyIdea: 'Strategy swaps how a job is done. State swaps what the object is doing. Both are interfaces with many classes behind them.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: '-' },
      metricTones: { pay: 'good' },
      scene: {
        nodes: [payI(TM, { status: 'active' }), cash(BL), card(BM), upi(BR)],
        links: [link('cash', 'pay', { label: 'implements' }), link('card', 'pay', { label: 'implements' }), link('upi', 'pay', { label: 'implements' })],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class PaymentStrategy(ABC):\n    def pay(self, amt) -> bool: ...\n    def refund(self, amt): ...\n    def refund_all(self): ...',
          footer: { text: 'Same call, different protocol', tone: 'muted' },
        },
        caption: 'One interface, three payment methods',
      },
      code: {
        language: 'python',
        title: 'Payment strategies',
        source: `class PaymentStrategy(ABC):
    @abstractmethod
    def pay(self, amt) -> bool: ...
    @abstractmethod
    def refund(self, amt): ...
    @abstractmethod
    def refund_all(self): ...

class Cash(PaymentStrategy):
    def __init__(self): self.inserted = 0
    def insert(self, amt): self.inserted += amt
    def pay(self, amt):
        if self.inserted < amt: return False
        self.inserted -= amt
        return True
    def refund(self, amt): self.inserted += amt
    def refund_all(self):
        out, self.inserted = self.inserted, 0
        return out

class Card(PaymentStrategy):
    def __init__(self, gateway): self.gw = gateway
    def pay(self, amt): return self.gw.charge(amt)
    def refund(self, amt): self.gw.reverse(amt)
    def refund_all(self): return 0  # nothing held

class UPI(PaymentStrategy):
    def __init__(self, client): self.client = client
    def pay(self, amt):
        return self.client.request(amt)  # QR, wait for webhook
    def refund(self, amt): self.client.reverse(amt)
    def refund_all(self): return 0`,
        highlight: [3, 11, 22, 28],
      },
    },
    {
      title: 'Wire it in',
      tag: 'concept',
      heading: 'Dispensing asks the strategy, never a concrete class',
      eli5: 'When the snack is ready to drop, the shopkeeper tells the payment box "take this much". He does not care whether it takes coins or a card.',
      body: [
        '`HasMoney.select` only checks the slot now. `Dispensing.dispense` calls `m.payment.pay(price)`, so `Cash` deducts once and there is one ledger. `m.refund_all()` returns what the strategy still holds.',
        'State picks the behavior for the moment, Strategy picks how money moves. No state names a payment class.',
      ],
      keyIdea: 'States depend on the PaymentStrategy interface, so adding a payment method touches no state.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: '-' },
      scene: {
        nodes: [machine(TM), dispensing(BL, { status: 'active' }), payI(BM), gateway(BR)],
        links: [
          link('machine', 'dispensing', { label: 'state' }),
          link('machine', 'pay', { label: 'has-a' }),
          link('pay', 'gateway', { label: 'uses' }),
        ],
        flows: [
          { path: ['dispensing', 'machine', 'pay'], tone: 'request', label: 'pay(75)', duration: 1.8 },
          { path: ['pay', 'gateway'], tone: 'request', label: 'charge(75)', duration: 1.2, delay: 1.9 },
          { path: ['gateway', 'pay'], tone: 'response', label: 'ok', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Dispensing.dispense',
          icon: 'Code',
          code: 'price = m.price[m.selected]\nif m.payment.pay(price):\n    m.inventory.remove(m.selected)\n    m.motor.push(m.selected)\nm.refund_all()  # change back\nm.set_state(Idle())',
        },
        caption: 'The state calls the interface',
      },
    },
    {
      title: 'Two customers',
      tag: 'problem',
      heading: 'Two threads, one machine, one last bag of chips',
      eli5: 'Two kids shout "I want the last chips!" at the same moment. The shopkeeper hears both and gives the same bag twice.',
      body: [
        'A networked machine can get a UPI webhook on one thread and a panel press on another. Both read `inventory.count("A3") == 1`, both pass the check, and both call `remove`.',
        'This is a **race condition** on shared state. The count goes to -1 and two customers think they paid for one item.',
      ],
      keyIdea: 'Anything two threads can read and then write needs protection. The check and the update must happen as one step.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: TL, label: 'thread 1', sub: 'panel press' },
          { id: 't2', kind: 'worker', at: TR, label: 'thread 2', sub: 'UPI webhook' },
          machine(BM, { sub: 'shared state', status: 'hot', load: 92, badge: 'count A3 = 1' }),
        ],
        links: [link('t1', 'machine', { label: 'select' }), link('t2', 'machine', { label: 'select' })],
        flows: [
          { path: ['t1', 'machine'], tone: 'request', label: 'count == 1', duration: 1.3 },
          { path: ['t2', 'machine'], tone: 'request', label: 'count == 1', duration: 1.3 },
          { path: ['t1', 'machine'], tone: 'error', label: 'remove', duration: 1.3, delay: 1.5 },
          { path: ['t2', 'machine'], tone: 'error', label: 'remove', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Check, then act',
          icon: 'Table',
          rows: [
            { text: 'T1 reads count', value: '1' },
            { text: 'T2 reads count', value: '1' },
            { text: 'T1 removes', value: '0' },
            { text: 'T2 removes', value: '-1', tone: 'bad' },
          ],
          footer: { text: 'Two sales of one bag', tone: 'bad' },
        },
        caption: 'Both threads passed the same check',
      },
    },
    {
      title: 'Add a lock',
      tag: 'concept',
      heading: 'Version 5: one lock around every event',
      eli5: 'The shopkeeper hangs a "one at a time" sign on the counter. The second kid waits until the first is fully served.',
      body: [
        'Give the machine one `threading.RLock`, a reentrant lock, so `select` can call `dispense` while holding it. Each public method takes it with `with self.lock:`. One event at a time touches `inventory` and `state`.',
        'The lock also covers the payment call, so a slow UPI wait blocks others. Give `pay` a timeout. Splitting into reserve, pay and commit avoids the wait but adds a state to track.',
      ],
      keyIdea: 'A lock makes check-then-act atomic. Use a reentrant lock when locked code calls other locked methods, and cap any slow call inside it.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: at(-5.4, -3.2), label: 'thread 1', sub: 'holds lock', status: 'active' },
          { id: 't2', kind: 'worker', at: at(-5.4, 3.2), label: 'thread 2', sub: 'waits', status: 'dim' },
          { id: 'lock', kind: 'vault', at: at(-0.8, 0), label: 'lock', sub: 'one holder' },
          machine(at(3.8, 0), { sub: 'shared state', status: 'ok', load: 40 }),
        ],
        links: [link('t1', 'lock', { label: 'acquire' }), link('t2', 'lock', { label: 'blocked', labelTone: 'warn' }), link('lock', 'machine', { label: 'guards' })],
        flows: [
          { path: ['t1', 'lock', 'machine'], tone: 'request', label: 'select', duration: 1.8 },
          { path: ['machine', 'lock', 't1'], tone: 'response', label: 'release', duration: 1.6, delay: 1.9 },
        ],
        panel: {
          title: 'RLock on every event',
          icon: 'Code',
          code: 'def insert(self, amt):\n    with self.lock: self.state.insert(self, amt)\ndef select(self, item):\n    with self.lock: self.state.select(self, item)\ndef dispense(self):\n    with self.lock: self.state.dispense(self)\ndef cancel(self):\n    with self.lock: self.state.cancel(self)',
          footer: { text: 'lock = threading.RLock()', tone: 'muted' },
        },
        caption: 'Second thread waits, no double sale',
      },
    },
    {
      title: 'Quiz: patterns',
      tag: 'tradeoff',
      heading: 'Check State, Strategy and the lock',
      eli5: 'Check which part of the shop does which job before the story gets harder.',
      body: ['Payment method is chosen by Strategy. The current mood of the machine is State. Two customers need a lock.'],
      keyIdea: 'Match each problem to the tool that solves it.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: 'yes' },
      scene: {
        nodes: [stateI(TL), payI(TR), { id: 'lock', kind: 'vault', at: BM, label: 'lock', sub: 'one holder' }],
        links: [link('state', 'lock', { label: 'guarded by' }), link('pay', 'lock', { label: 'guarded by' })],
        caption: 'Three tools, three problems',
      },
      quiz: {
        question: 'Where is the right place to add support for a new wallet payment method?',
        options: [
          'A new if branch in every State class',
          'A new class that implements PaymentStrategy',
          'A new field on VendingMachine with a flag',
          'A second lock around the machine',
        ],
        answer: 1,
        explain: 'Payment methods are interchangeable algorithms, so they implement PaymentStrategy. States call the interface and need no change.',
      },
    },
    {
      title: 'Paid, no snack',
      tag: 'problem',
      heading: 'Payment succeeds, then the motor jams',
      eli5: 'You paid and the shopkeeper took your money, then the snack got stuck on the shelf. Now you have no snack and no money.',
      body: [
        'Dispensing is two steps in the real world: charge, then push the item. Either can fail. If `pay` succeeds and `motor.push` fails, money is taken and nothing is delivered.',
        'A lock does not help here. This is **partial failure**: the first step cannot be undone by simply returning an error.',
      ],
      keyIdea: 'When a purchase has several steps and a later one fails, the earlier ones must be reversed.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: 'locked' },
      metricTones: { safe: 'warn' },
      scene: {
        nodes: [customer({ status: 'hot', badge: 'paid 75, got 0' }), machine(TM), motor(BR, { status: 'down', badge: 'jammed' }), gateway(BL, { sub: 'charged', status: 'ok' })],
        links: [link('customer', 'machine'), link('machine', 'motor', { label: 'push' }), link('machine', 'gateway', { label: 'charge' })],
        flows: [
          { path: ['machine', 'gateway'], tone: 'request', label: 'charge(75)', duration: 1.2 },
          { path: ['machine', 'motor'], tone: 'error', label: 'push fails', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Two steps, one fails',
          icon: 'Table',
          rows: [
            { text: '1. charge card', value: 'done', tone: 'good' },
            { text: '2. push item', value: 'jam', tone: 'bad' },
            { text: 'Customer', value: 'paid, no item', tone: 'bad' },
          ],
        },
        caption: 'Step one succeeded, step two did not',
      },
    },
    {
      title: 'Saga',
      tag: 'concept',
      heading: 'Version 6: a saga that undoes completed steps',
      eli5: 'The shopkeeper keeps a list of what he already did. If the snack gets stuck, he walks the list backward: put the snack count back and give the money back.',
      body: [
        'A **saga** runs the steps in order and records an undo for each one that succeeds. On failure it runs the undos in reverse and alerts the operator.',
        '`Dispensing.dispense` now calls `DispenseSaga().run(...)`. The saga is the only place that pays. Then the machine returns change or the refund and moves to `Idle`.',
      ],
      keyIdea: 'Compensation replaces rollback when steps cross systems: record how to undo each step, and replay them backward on failure.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          machine(TM),
          saga(BL, { status: 'active' }),
          motor(BM, { status: 'down' }),
          blk('operator', BR, 'Operator', 'alert', 'gray', 'Signal'),
        ],
        links: [link('machine', 'saga', { label: 'creates' }), link('saga', 'motor', { label: 'uses' }), link('saga', 'operator', { label: 'alerts' })],
        flows: [
          { path: ['saga', 'motor'], tone: 'error', label: 'push fails', duration: 1.2 },
          { path: ['saga', 'machine'], tone: 'response', label: 'refund + restock', duration: 1.3, delay: 1.4 },
          { path: ['saga', 'operator'], tone: 'event', label: 'alert(jam)', duration: 1.3, delay: 2.9 },
        ],
        panel: {
          title: 'Undo in reverse',
          icon: 'Table',
          rows: [
            { text: '1. pay', value: 'undo: refund' },
            { text: '2. remove from stock', value: 'undo: restock' },
            { text: '3. push item', value: 'fails', tone: 'bad' },
            { text: 'Unwind', value: 'restock, refund', tone: 'good' },
          ],
        },
        caption: 'Failure at step 3 runs the undos for 2 and 1',
      },
      code: {
        language: 'python',
        title: 'Saga with compensation',
        source: `class Dispensing(State):
    def dispense(self, m):
        DispenseSaga().run(m, m.selected, m.payment)
        m.refund_all()  # change, or the refunded money
        m.set_state(Idle())

class DispenseSaga:
    def run(self, m, item, payment):
        done = []
        try:
            if not payment.pay(m.price[item]):
                raise RuntimeError("payment failed")
            done.append(("refund", payment))
            m.inventory.remove(item)
            done.append(("restock", item))
            m.motor.push(item)  # may raise on a jam
            return True
        except Exception as e:
            for action, arg in reversed(done):
                if action == "refund": arg.refund(m.price[item])
                elif action == "restock": m.inventory.add(arg)
            m.alert_operator(str(e))
            return False`,
        highlight: [3, 11, 13, 16, 19, 20, 21, 22],
      },
    },
    {
      title: 'Tradeoffs',
      tag: 'tradeoff',
      heading: 'What State costs, and when it is worth it',
      eli5: 'Lots of small hats are easy to keep tidy but there are more hats to store. For a shop with only two moods, one sticky note is fine.',
      body: [
        'State trades a few big methods for many small classes. For two states, a plain `if` is simpler. Once a third or fourth appears, or states keep growing, classes win.',
        'States hold no data of their own, so one shared instance per state is enough. They are also easy to test: build a machine, set a state, call one event, check the next state.',
      ],
      keyIdea: 'Use State when behavior changes with mode and the mode count grows. Keep it simple when it does not.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: 'yes' },
      scene: {
        nodes: [machine(TM, { status: 'ok' }), stateI(BL), payI(BM), saga(BR, { sub: 'compensation' })],
        links: [link('machine', 'state', { label: 'has-a' }), link('machine', 'pay', { label: 'has-a' }), link('machine', 'saga', { label: 'creates' })],
        panel: {
          title: 'When to use what',
          icon: 'Table',
          rows: [
            { text: '2 modes', value: 'plain if' },
            { text: '3+ modes, growing', value: 'State', tone: 'good' },
            { text: 'Many ways to do one job', value: 'Strategy', tone: 'good' },
            { text: 'Multi-step, can fail', value: 'Saga', tone: 'good' },
          ],
        },
        caption: 'Pick the lightest tool that fits',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The design on one page',
      eli5: 'The shop has a shopkeeper with moods (State), a payment box that takes coins, cards or phones (Strategy), a counter sign that says one kid at a time (lock), and an undo list for when a snack sticks (saga).',
      body: [
        'Requirements gave the nouns. If/else and an enum did not scale. **State** put each mode in a class, **Strategy** isolated payment, a **lock** made events atomic, and a **saga** repaired a paid-but-jammed sale.',
        'Each step answered one pain from the one before. That is how the design grew.',
      ],
      keyIdea: 'Let the pain pick the pattern: State for modes, Strategy for interchangeable work, a lock for shared data, a saga for partial failure.',
      metrics: { branches: '0', edits: '1 class', pay: '3', safe: 'yes' },
      metricTones: { branches: 'good', edits: 'good', safe: 'good' },
      scene: {
        nodes: [machine(TM, { status: 'ok' }), stateI(BL), payI(BM), saga(BR, { sub: 'compensation' }), { id: 'lock', kind: 'vault', at: TR, label: 'lock', sub: 'one at a time' }],
        links: [
          link('machine', 'state', { label: 'has-a' }),
          link('machine', 'pay', { label: 'has-a' }),
          link('machine', 'saga', { label: 'creates' }),
          link('lock', 'machine', { label: 'guards' }),
        ],
        panel: {
          title: 'Pain and pattern',
          icon: 'Table',
          rows: [
            { text: 'If/else per method', value: 'State' },
            { text: 'Cash only', value: 'Strategy' },
            { text: 'Two customers', value: 'Lock' },
            { text: 'Paid, no snack', value: 'Saga' },
          ],
        },
        caption: 'Four pains, four tools',
      },
      quiz: {
        question: 'The motor jams after a successful card charge. Which piece of the design handles it?',
        options: [
          'The lock, by retrying the event',
          'The State pattern, by moving to Idle',
          'The saga, by running the recorded undos and alerting the operator',
          'The enum, by adding a JAMMED value',
        ],
        answer: 2,
        explain: 'The charge already left the system, so the machine must compensate. A saga records an undo for each completed step and runs them in reverse on failure.',
      },
    },
  ],
};
