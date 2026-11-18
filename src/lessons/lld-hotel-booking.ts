import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });

// Code structure: interfaces violet, abstract blue, concrete green, external gray.
const svc: SceneNode = { id: 'svc', kind: 'block', at: at(-4, -3.2), label: 'BookingService', sub: 'reserve()', icon: 'Workflow', tint: 'green' };
const room: SceneNode = { id: 'room', kind: 'block', at: at(3.8, 0.8), label: 'Room', sub: 'number, base_rate', icon: 'Key', tint: 'green' };
const guest: SceneNode = { id: 'guest', kind: 'block', at: at(-3.8, 0.8), label: 'Guest', sub: 'name, email', icon: 'User', tint: 'green' };
const res: SceneNode = { id: 'res', kind: 'block', at: at(0, -3.2), label: 'Reservation', sub: 'dates, state, total', icon: 'Receipt', tint: 'green' };
const pricingIf: SceneNode = { id: 'pricing', kind: 'block', at: at(0, -3.2), label: 'PricingStrategy', sub: 'interface', icon: 'Scale', tint: 'violet' };
const weekday: SceneNode = { id: 'weekday', kind: 'block', at: at(-3.8, 1.2), label: 'WeekdayRate', sub: 'base rate', icon: 'Scale', tint: 'green' };
const weekend: SceneNode = { id: 'weekend', kind: 'block', at: at(3.8, 1.2), label: 'WeekendRate', sub: 'x1.4 Sat, Sun', icon: 'Scale', tint: 'green' };
const seasonal: SceneNode = { id: 'seasonal', kind: 'block', at: at(0, 3.6), label: 'SeasonalRate', sub: 'x1.25 Jul, Aug', icon: 'Scale', tint: 'green' };
const composite: SceneNode = { id: 'composite', kind: 'block', at: at(0, 3.6), label: 'CompositePricing', sub: 'takes the max', icon: 'Layers', tint: 'green' };
const stateIf: SceneNode = { id: 'state', kind: 'block', at: at(0, -3.2), label: 'ReservationState', sub: 'interface', icon: 'Workflow', tint: 'violet' };
const pending: SceneNode = { id: 'pending', kind: 'block', size: 0.85, at: at(-4.6, 0.2), label: 'Pending', sub: 'PendingState', icon: 'Clock', tint: 'green' };
const confirmed: SceneNode = { id: 'confirmed', kind: 'block', size: 0.85, at: at(-1.5, 0.2), label: 'Confirmed', sub: 'ConfirmedState', icon: 'Shield', tint: 'green' };
const checkedIn: SceneNode = { id: 'checkedin', kind: 'block', size: 0.85, at: at(1.6, 0.2), label: 'CheckedIn', sub: 'CheckedInState', icon: 'Key', tint: 'green' };
const cancelled: SceneNode = { id: 'cancelled', kind: 'block', size: 0.85, at: at(-3.1, 6.2), label: 'Cancelled', sub: 'CancelledState', icon: 'Bug', tint: 'green' };
const ledger: SceneNode = { id: 'ledger', kind: 'block', at: at(3.8, 0), label: 'Ledger', sub: 'room 204 stays', icon: 'List', tint: 'amber' };
const thA: SceneNode = { id: 'thA', kind: 'worker', at: at(-4, -2.4), label: 'Thread A', sub: 'web request' };
const thB: SceneNode = { id: 'thB', kind: 'worker', at: at(-4, 2.4), label: 'Thread B', sub: 'web request' };
const lock204: SceneNode = { id: 'lock204', kind: 'vault', at: at(0, 0), label: 'Lock 204', sub: 'one per room' };
const payment: SceneNode = { id: 'payment', kind: 'block', at: at(4, 1.2), label: 'PaymentService', sub: 'external, gray', icon: 'Receipt', tint: 'gray' };
const saga: SceneNode = { id: 'saga', kind: 'block', at: at(0, -3.2), label: 'Saga', sub: 'execute(ctx)', icon: 'Route', tint: 'blue' };
const sagaStep: SceneNode = { id: 'sagastep', kind: 'block', at: at(-3.8, 1.4), label: 'SagaStep', sub: 'action + compensate', icon: 'Repeat', tint: 'green' };

export const lldHotelBooking: Lesson = {
  id: 'lld-hotel-booking',
  title: 'Hotel booking',
  tagline: 'Price with Strategy, track the lifecycle with State, stop double booking with a lock per room, and undo a half-finished booking with a Saga.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'The entities: Room, Guest, Reservation and a RoomType enum',
    'Pricing as a Strategy: weekday, weekend, seasonal, and a composite that takes the max',
    'Money as Decimal and nights as a half-open date range',
    'The reservation lifecycle as a State pattern with idempotent and illegal transitions',
    'Check-then-act races, interval overlap, and one lock per room (lock striping)',
    'A Saga that pairs hold, charge and confirm, with compensations and idempotent refunds',
  ],
  metrics: [
    { key: 'rooms', label: 'Rooms', icon: 'Key' },
    { key: 'rules', label: 'Price rules', icon: 'Scale' },
    { key: 'clash', label: 'Double bookings', icon: 'Bug' },
    { key: 'stuck', label: 'Paid, no room', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'Double booked',
      tag: 'problem',
      heading: 'Two guests, one room, one night',
      eli5: "Grandma runs a guesthouse. Two families phone at the same moment and both ask for the blue room. Grandma says yes to both, and now two families stand at one door.",
      body: [
        'A 500-room hotel takes bookings from a website. At peak, **40 bookings per second** arrive on separate threads. Two guests ask for room 204 for the same night in the same millisecond.',
        'Both requests look at the booking list, both see it free, and both write a reservation. That is a **double booking**. It is the hardest part of this problem, so we build up to it.',
      ],
      keyIdea: 'Hotel booking looks like CRUD, but two requests racing for one room is what makes it a hard design problem.',
      metrics: { rooms: '500', rules: '3 (hardcoded)', clash: '1', stuck: '0' },
      metricTones: { clash: 'bad' },
      scene: {
        nodes: [
          { ...thA, at: at(-5.5, -2), chips: ['reserve(204)'] },
          { ...thB, at: at(-1.5, 2.8), chips: ['reserve(204)'] },
          { ...room, at: at(4.5, -0.5), label: 'Room 204', status: 'hot', badge: 'booked twice' },
        ],
        links: [link('thA', 'room'), link('thB', 'room')],
        flows: [
          { path: ['thA', 'room'], tone: 'request', label: 'reserve', duration: 1.6 },
          { path: ['thB', 'room'], tone: 'request', label: 'reserve', duration: 1.6 },
        ],
        panel: {
          title: 'Friday night, room 204',
          icon: 'Table',
          rows: [
            { text: 'Thread A: is it free?', value: 'yes' },
            { text: 'Thread B: is it free?', value: 'yes' },
            { text: 'Thread A books', value: 'ok', tone: 'good' },
            { text: 'Thread B books', value: 'ok', tone: 'bad' },
          ],
          footer: { text: 'Two guests, one bed', tone: 'bad' },
        },
        caption: 'Both threads saw the room as free',
      },
    },
    {
      title: 'Entities',
      tag: 'concept',
      heading: 'Start with the nouns: Room, Guest, Reservation',
      eli5: "Grandma keeps three things: a list of rooms, a list of guests, and a card for each stay that says who sleeps where and when.",
      body: [
        'A **Room** has a number, a `RoomType` (standard, deluxe, suite) and a `base_rate`. A **Guest** has a name and an email. A **Reservation** ties one guest to one room for a range of dates.',
        'The reservation also carries a `state` (its lifecycle), a `total` and a `payment_id`. Prices use `Decimal`, never a float.',
      ],
      keyIdea: 'Reservation is the object that joins a guest, a room and a date range, and it owns the lifecycle and the price.',
      metrics: { rooms: '500', rules: '-', clash: '-', stuck: '-' },
      scene: {
        nodes: [
          res,
          { ...guest, at: at(-3.8, 0.4) },
          { ...room, at: at(3.8, 0.4) },
          { id: 'rtype', kind: 'block', size: 0.8, at: at(0, 4.6), label: 'RoomType', sub: 'enum', icon: 'List', tint: 'green' },
        ],
        links: [link('res', 'guest', 'has-a'), link('res', 'room', 'has-a'), link('room', 'rtype', 'has-a')],
        flows: [{ path: ['guest', 'res', 'room'], tone: 'data', label: 'Reservation(g, r, in, out)', duration: 2.2 }],
        panel: {
          title: 'Fields of Reservation',
          icon: 'Table',
          rows: [
            { text: 'guest, room', value: 'who, where' },
            { text: 'check_in, check_out', value: 'date range' },
            { text: 'state', value: 'PendingState' },
            { text: 'total', value: 'Decimal' },
            { text: 'payment_id', value: 'set on confirm' },
          ],
        },
        caption: 'Four small classes hold the data',
      },
      code: {
        language: 'python',
        title: 'The entities',
        source: `class RoomType(Enum):
    STANDARD = "standard"
    DELUXE = "deluxe"
    SUITE = "suite"

class Room:
    def __init__(self, number, room_type, base_rate):
        self.number = number
        self.room_type = room_type
        self.base_rate = Decimal(str(base_rate))

class Reservation:
    def __init__(self, guest, room, check_in, check_out):
        self.id = uuid.uuid4()
        self.guest, self.room = guest, room
        self.check_in, self.check_out = check_in, check_out
        self.state = PendingState()
        self.total = None
        self.payment_id = None`,
        highlight: [10, 17],
      },
    },
    {
      title: 'Pricing ifs',
      tag: 'case',
      heading: 'Case: price rules pile up inside reserve()',
      eli5: "Grandma writes prices on a chalkboard, but every new rule gets scribbled in the margin: weekend, summer, holiday. Soon nobody can read it.",
      body: [
        'The first version prices a stay inside `reserve()`: if it is a weekend, multiply by 1.4. If it is August, multiply by 1.25. A new rule means editing the same method again.',
        'The service now knows every pricing rule and has to be retested after each change. That is the signal for a pattern.',
      ],
      keyIdea: 'When one method grows an if for every new rule, the rules want their own classes.',
      metrics: { rooms: '500', rules: '3 (hardcoded)', clash: '1', stuck: '0' },
      metricTones: { rules: 'warn' },
      scene: {
        nodes: [
          { ...svc, status: 'hot', chips: [{ text: 'if weekend', tone: 'warn' }, { text: 'if august', tone: 'warn' }, { text: 'if holiday', tone: 'warn' }] },
          { ...room, at: at(3.8, -3.2) },
          { ...guest, at: at(-0.2, 3) },
        ],
        links: [link('svc', 'room', 'uses'), link('svc', 'guest', 'uses')],
        flows: [{ path: ['guest', 'svc'], tone: 'request', label: 'reserve(...)', duration: 1.6 }],
        panel: {
          title: 'The method that never stops growing',
          icon: 'Code',
          code: 'def reserve(self, ...):\n    price = room.base_rate\n    if night.weekday() >= 5:\n        price *= Decimal(\"1.4\")\n    if night.month == 8:\n        price *= Decimal(\"1.25\")\n    # next: holiday? loyalty?',
          footer: { text: 'Every rule edits reserve()', tone: 'warn' },
        },
        caption: 'Pricing logic lives in the wrong place',
      },
    },
    {
      title: 'Strategy',
      tag: 'concept',
      heading: 'Strategy: one interface, many pricing rules',
      eli5: "Grandma hands the pricing job to helpers. Each helper knows one way to write the price, and Grandma just asks whichever **strategy** helper is on duty.",
      body: [
        'Define a `PricingStrategy` interface with one method: `price_for_night(room, night)`. Each rule becomes a small class that implements it.',
        '`BookingService` holds a strategy and calls the interface. It never learns which rule runs, so swapping or adding a rule does not touch the service.',
      ],
      keyIdea: 'Strategy puts each rule behind one interface, so the caller never changes when the rules do.',
      metrics: { rooms: '500', rules: '2 classes', clash: '1', stuck: '0' },
      scene: {
        nodes: [{ ...svc, at: at(-5.2, -3.2) }, { ...pricingIf, at: at(0, -3.2) }, { ...weekday, at: at(-3.2, 3.8) }, { ...weekend, at: at(3.2, 3.8) }],
        links: [link('svc', 'pricing', 'uses'), link('weekday', 'pricing', 'implements'), link('weekend', 'pricing', 'implements')],
        flows: [{ path: ['svc', 'pricing', 'weekend'], tone: 'request', label: 'price_for_night', duration: 1.8 }],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class PricingStrategy(ABC):\n    @abstractmethod\n    def price_for_night(\n        self, room, night\n    ) -> Decimal: ...',
          footer: { text: 'One method, many implementations', tone: 'good' },
        },
        caption: 'The service depends on the interface only',
      },
    },
    {
      title: 'Concrete rates',
      tag: 'concept',
      heading: 'WeekendRate and SeasonalRate',
      eli5: "One helper says \"Saturday costs more\". Another says \"summer costs more\". Each helper only thinks about its own rule.",
      body: [
        '`WeekdayRate` returns the base rate. `WeekendRate` multiplies by 1.4 when `night.weekday() >= 5`. `SeasonalRate` takes a set of months and a multiplier, and applies it in those months.',
        'Each class is a few lines and tests on its own. A holiday rule is a new class, not an edit.',
      ],
      keyIdea: 'Every rule is a tiny class with one reason to change.',
      metrics: { rooms: '500', rules: '3 classes', clash: '1', stuck: '0' },
      metricTones: { rules: 'good' },
      scene: {
        nodes: [{ ...weekend, at: at(-3.8, -1.5), status: 'active' }, { ...seasonal, at: at(3.8, -1.5) }, { ...room, at: at(0, 3), sub: 'base 100.00' }],
        links: [link('weekend', 'room', 'uses'), link('seasonal', 'room', 'uses')],
        flows: [
          { path: ['weekend', 'room'], tone: 'request', label: 'base_rate', duration: 1.4 },
          { path: ['room', 'weekend'], tone: 'response', label: '140.00 (Sat)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Room 204, base 100.00',
          icon: 'Table',
          rows: [
            { text: 'Mon, WeekendRate', value: '100.00' },
            { text: 'Sat, WeekendRate', value: '140.00', tone: 'warn' },
            { text: 'August, SeasonalRate', value: '125.00', tone: 'warn' },
          ],
        },
        caption: 'Each rule reads the room and a date',
      },
      code: {
        language: 'python',
        title: 'Two concrete strategies',
        source: `class WeekendRate(PricingStrategy):
    def price_for_night(self, room, night):
        if night.weekday() >= 5:  # Sat, Sun
            return room.base_rate * Decimal("1.4")
        return room.base_rate

class SeasonalRate(PricingStrategy):
    def __init__(self, high_season_months, multiplier):
        self.months = set(high_season_months)
        self.multiplier = Decimal(str(multiplier))

    def price_for_night(self, room, night):
        if night.month in self.months:
            return room.base_rate * self.multiplier
        return room.base_rate`,
        highlight: [3, 4, 13, 14],
      },
    },
    {
      title: 'Composite',
      tag: 'concept',
      heading: 'CompositePricing: combine rules behind the same interface',
      eli5: "Grandma asks all the helpers for a price and takes the biggest one. To the guest it still looks like one helper answered.",
      body: [
        'A Saturday in August matches two rules. `CompositePricing` holds a list of strategies, asks each, and returns the **max** (a hotel that picks the highest price).',
        'It also implements `PricingStrategy`, so `BookingService` cannot tell a single rule from a group of them. Swap `max` for `sum` and you have stacked surcharges.',
      ],
      keyIdea: 'A composite that implements the same interface lets you combine rules without changing any caller.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...pricingIf, at: at(-3.5, -3.4) },
          { ...composite, at: at(3.2, -0.6), status: 'active' },
          { ...weekend, at: at(-4.2, 3.8) },
          { ...seasonal, at: at(3.6, 6.2) },
        ],
        links: [link('composite', 'pricing', 'implements'), link('composite', 'weekend', 'has-a'), link('composite', 'seasonal', 'has-a')],
        flows: [
          { path: ['composite', 'weekend'], tone: 'request', label: 'Sat Aug', duration: 1.2 },
          { path: ['composite', 'seasonal'], tone: 'request', label: 'Sat Aug', duration: 1.2 },
          { path: ['weekend', 'composite'], tone: 'response', label: '140.00', duration: 1.2, delay: 1.3 },
          { path: ['seasonal', 'composite'], tone: 'response', label: '125.00', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'A Saturday in August',
          icon: 'Table',
          rows: [
            { text: 'WeekendRate', value: '140.00' },
            { text: 'SeasonalRate', value: '125.00' },
            { text: 'max(...)', value: '140.00', tone: 'good' },
          ],
        },
        caption: 'The composite is itself a strategy',
      },
      code: {
        language: 'python',
        title: 'CompositePricing',
        source: `class CompositePricing(PricingStrategy):
    """Apply several strategies and take the max."""
    def __init__(self, strategies):
        self.strategies = strategies

    def price_for_night(self, room, night):
        return max(
            s.price_for_night(room, night)
            for s in self.strategies
        )`,
        highlight: [6, 7, 8, 9],
      },
      quiz: {
        question: 'A holiday surcharge arrives next month. What is the smallest change to the pricing design?',
        options: [
          'Add another if to reserve() in BookingService',
          'Write a HolidayRate class that implements PricingStrategy and add it to the composite',
          'Subclass Room and override base_rate',
          'Store the surcharge in the Guest',
        ],
        answer: 1,
        explain: 'Strategy means a new rule is a new class behind the same interface. The service and the other rules stay untouched.',
      },
    },
    {
      title: 'Total price',
      tag: 'concept',
      heading: 'Pricing a stay: add up the nights',
      eli5: "Grandma counts the nights a family sleeps over, not the morning they leave. Three sleeps, three prices, one bill.",
      body: [
        '`total_price` walks from `check_in` up to but not including `check_out` and adds each night. A stay is a **half-open range**: Fri, Sat and Sun nights are three nights, and Monday morning is checkout.',
        'The same half-open idea returns when we test two stays for overlap.',
      ],
      keyIdea: 'A stay covers the nights from check-in up to, but not including, check-out.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...svc, at: at(-5.2, -2.5) },
          { ...composite, at: at(1, -3.5) },
          { ...room, at: at(-1, 3.2), sub: 'base 100.00' },
          { ...res, id: 'res', at: at(5.5, 2), label: 'Reservation', sub: 'total 380.00', status: 'ok' },
        ],
        links: [link('svc', 'composite', 'uses'), link('composite', 'room', 'uses'), link('svc', 'res', 'creates')],
        flows: [
          { path: ['svc', 'composite'], tone: 'request', label: 'per night', count: 3, duration: 1.6 },
          { path: ['composite', 'svc'], tone: 'response', label: 'Decimal', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Fri to Mon, base 100.00',
          icon: 'Table',
          rows: [
            { text: 'Fri night', value: '100.00' },
            { text: 'Sat night', value: '140.00', tone: 'warn' },
            { text: 'Sun night', value: '140.00', tone: 'warn' },
            { text: 'Mon (checkout)', value: 'not charged', tone: 'muted' },
            { text: 'Total', value: '380.00', tone: 'good' },
          ],
        },
        caption: 'Loop while cur < check_out',
      },
      code: {
        language: 'python',
        title: 'total_price',
        source: `def total_price(room, check_in, check_out, pricing):
    total = Decimal(0)
    cur = check_in
    while cur < check_out:
        total += pricing.price_for_night(room, cur)
        cur += timedelta(days=1)
    return total.quantize(Decimal("0.01"), ROUND_HALF_UP)`,
        highlight: [4, 5, 6, 7],
      },
    },
    {
      title: 'Decimal money',
      tag: 'tradeoff',
      heading: 'Why money is Decimal, not float',
      eli5: "If Grandma adds pennies on a wobbly calculator, a tiny error sneaks in every time. A **Decimal** is a calculator that counts pennies exactly.",
      body: [
        'Floats store binary fractions, so `0.1 + 0.2` is `0.30000000000000004`. Over thousands of nights and refunds those crumbs make totals that do not match the card charge.',
        '`Decimal` stores base-10 digits exactly. Build it from a string (`Decimal("1.4")`), because `Decimal(1.4)` copies the float error. Round each total to cents with `quantize`.',
      ],
      keyIdea: 'Use Decimal for money and build it from strings, so the stored total matches the charge to the cent.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...room, at: at(-3.8, -1), sub: 'Decimal base_rate' },
          { ...composite, at: at(0, 3), status: 'active' },
          { ...res, at: at(3.8, -1), sub: 'Decimal total', status: 'ok' },
        ],
        links: [link('room', 'composite', 'uses'), link('composite', 'res', 'creates')],
        flows: [{ path: ['room', 'composite', 'res'], tone: 'data', label: 'Decimal("380.00")', duration: 2 }],
        panel: {
          title: 'Same sum, two types',
          icon: 'Table',
          rows: [
            { text: 'float 0.1 + 0.2', value: '0.30000000000000004', tone: 'bad' },
            { text: 'Decimal("0.1") + Decimal("0.2")', value: '0.3', tone: 'good' },
            { text: 'Decimal(1.4)', value: '1.399999...', tone: 'warn' },
            { text: '99.99 x 1.25 quantized', value: '124.99', tone: 'good' },
          ],
        },
        caption: 'Exact cents from the first number',
      },
      quiz: {
        question: 'Why does Decimal(1.4) differ from Decimal("1.4")?',
        options: [
          'Decimal(1.4) rounds to cents automatically',
          'Decimal(1.4) copies the float binary error, while the string form is exact',
          'They are identical, only the printing differs',
          'The string form is slower but less precise',
        ],
        answer: 1,
        explain: 'The float 1.4 is already slightly off before Decimal sees it. A string carries the exact digits.',
      },
    },
    {
      title: 'Lifecycle ifs',
      tag: 'case',
      heading: 'Case: a status string and ifs everywhere',
      eli5: "Grandma keeps a sticky note on each stay card saying waiting, booked, or here. Every helper must remember what each note allows, and one forgets.",
      body: [
        'A reservation moves through **pending, confirmed, checked in and cancelled**. With a `status` string, every method checks it: `if status == "cancelled": raise`.',
        'The rules for "can I cancel?" end up spread over the service, and one missed check lets a guest cancel after check-in.',
      ],
      keyIdea: 'A status string pushes the lifecycle rules into every caller, and one missed check breaks an invariant.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...res, status: 'hot', chips: [{ text: 'status = "confirmed"', tone: 'warn' }] },
          { ...svc, at: at(-4, 1.6) },
          { ...guest, at: at(4, 1.6) },
        ],
        links: [link('svc', 'res', 'uses'), link('guest', 'res', 'uses')],
        flows: [{ path: ['guest', 'res'], tone: 'error', label: 'cancel() after check-in', duration: 1.8 }],
        panel: {
          title: 'Checks scattered in callers',
          icon: 'Code',
          code: 'if r.status == "cancelled":\n    raise ...\nif r.status != "confirmed":\n    raise ...\nif r.status == "checked_in":\n    # forgot this one in cancel()',
          footer: { text: 'The guard lives in the caller', tone: 'bad' },
        },
        caption: 'Who owns the rule for each transition?',
      },
    },
    {
      title: 'State pattern',
      tag: 'concept',
      heading: 'State: one class per lifecycle stage',
      eli5: "Instead of a sticky note, each stay card gets a **state** stamp that knows what it allows. A BOOKED stamp knows it may become HERE or CANCELLED, and nothing else.",
      body: [
        'Make a `ReservationState` interface with `confirm`, `cancel` and `check_in`. Each stage (`PendingState`, `ConfirmedState` and so on) implements it and decides what each call does.',
        'The reservation holds a `state` object and delegates. A transition is the state assigning `r.state` to the next one.',
      ],
      keyIdea: 'State moves the rules for each stage into that stage, so an illegal move has nowhere to hide.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...res, at: at(-5, -3) },
          { ...stateIf, at: at(0.5, -3.5) },
          { ...pending, at: at(-3.5, 4), size: 1 },
          { ...confirmed, at: at(4.5, 3.5), size: 1 },
        ],
        links: [link('res', 'state', 'has-a'), link('pending', 'state', 'implements'), link('confirmed', 'state', 'implements')],
        flows: [{ path: ['res', 'state', 'pending'], tone: 'request', label: 'state.confirm(r)', duration: 1.8 }],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class ReservationState(ABC):\n    @abstractmethod\n    def confirm(self, r): ...\n    @abstractmethod\n    def cancel(self, r): ...\n    @abstractmethod\n    def check_in(self, r): ...',
        },
        caption: 'The reservation delegates to its state',
      },
    },
    {
      title: 'Transitions',
      tag: 'concept',
      heading: 'The legal moves between states',
      eli5: "A stay can go from waiting to booked, from booked to here, and from waiting or booked to cancelled. Nothing else is allowed, like a board game with set paths.",
      body: [
        'Pending can `confirm` or `cancel`. Confirmed can `check_in` or `cancel`. Checked in and cancelled are dead ends for these three actions.',
        'Each legal move is one line: `r.state = ConfirmedState()`. The picture of the transitions is the same as the code.',
      ],
      keyIdea: 'The state diagram on paper maps one to one onto the state classes in code.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [pending, confirmed, checkedIn, cancelled],
        links: [
          link('pending', 'confirmed', 'confirm'),
          link('confirmed', 'checkedin', 'check_in'),
          link('pending', 'cancelled', 'cancel'),
          link('confirmed', 'cancelled', 'cancel'),
        ],
        flows: [
          { path: ['pending', 'confirmed'], tone: 'request', label: 'confirm()', duration: 1.4 },
          { path: ['confirmed', 'checkedin'], tone: 'request', label: 'check_in()', duration: 1.4, delay: 1.5 },
          { path: ['confirmed', 'cancelled'], tone: 'error', label: 'cancel()', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Allowed moves',
          icon: 'Table',
          rows: [
            { text: 'Pending', value: 'confirm, cancel' },
            { text: 'Confirmed', value: 'check_in, cancel' },
            { text: 'CheckedIn', value: 'none', tone: 'muted' },
            { text: 'Cancelled', value: 'none', tone: 'muted' },
          ],
        },
        caption: 'Four stages, four legal arrows',
      },
      code: {
        language: 'python',
        title: 'Two of the four states',
        source: `class PendingState(ReservationState):
    def confirm(self, r): r.state = ConfirmedState()
    def cancel(self, r):  r.state = CancelledState()
    def check_in(self, r): raise RuntimeError("not confirmed")

class ConfirmedState(ReservationState):
    def confirm(self, r): pass  # idempotent
    def cancel(self, r):  r.state = CancelledState()
    def check_in(self, r): r.state = CheckedInState()`,
        highlight: [2, 3, 7, 8, 9],
      },
    },
    {
      title: 'Illegal moves',
      tag: 'case',
      heading: 'Illegal moves fail loudly in the state',
      eli5: "If a family is already sleeping in the room and someone says \"cancel\", the stamp says no and tells them why: check out instead.",
      body: [
        '`CheckedInState.cancel` raises `"check out instead"`. `CancelledState.confirm` raises `"cancelled"`. The caller needs no `if`: it calls `r.state.cancel(r)` and the state decides.',
        'The error names the broken rule, so a bug shows up in a test, not as a guest with a cancelled room and a key.',
      ],
      keyIdea: 'Each state rejects the moves it does not allow, so callers need no guard clauses.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...guest, at: at(-4, -2.4), label: 'Caller', sub: 'cancel()' },
          { ...res, at: at(0, 0.4), status: 'active' },
          { ...checkedIn, at: at(4, 3.2), size: 1, status: 'hot' },
        ],
        links: [link('guest', 'res', 'uses'), link('res', 'checkedin', 'has-a')],
        flows: [
          { path: ['guest', 'res', 'checkedin'], tone: 'request', label: 'cancel()', duration: 1.6 },
          { path: ['checkedin', 'res', 'guest'], tone: 'error', label: 'RuntimeError', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'CheckedInState',
          icon: 'Code',
          code: 'class CheckedInState(ReservationState):\n    def confirm(self, r):\n        raise RuntimeError("already here")\n    def cancel(self, r):\n        raise RuntimeError("check out instead")\n    def check_in(self, r):\n        raise RuntimeError("already in")',
        },
        caption: 'The state refuses the call',
      },
    },
    {
      title: 'Idempotent confirm',
      tag: 'tradeoff',
      heading: 'Some repeats are safe: confirm is idempotent',
      eli5: "If Grandma stamps BOOKED on an already booked card, nothing changes. A repeated stamp is harmless, which helps when a message gets sent twice.",
      body: [
        '`ConfirmedState.confirm` does nothing, and `CancelledState.cancel` does nothing. Repeating the call leaves the same result, so a retry after a timeout is safe.',
        'Compare `CheckedInState.confirm`, which raises, because confirming a guest who is already in the room is a real mistake. The saga later relies on safe retries.',
      ],
      keyIdea: 'Make a repeated call a no-op when the end state is already reached, and raise only when the call is a genuine mistake.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2.4), sub: 'retries confirm()' },
          { ...confirmed, at: at(0.5, 0.6), size: 1, status: 'ok', badge: 'no change' },
        ],
        links: [link('svc', 'confirmed', 'uses')],
        flows: [
          { path: ['svc', 'confirmed'], tone: 'request', label: 'confirm()', duration: 1.4 },
          { path: ['svc', 'confirmed'], tone: 'request', label: 'confirm() again', duration: 1.4, delay: 1.6 },
          { path: ['confirmed', 'svc'], tone: 'response', label: 'ok, same state', duration: 1.4, delay: 3.2 },
        ],
        panel: {
          title: 'Repeat behavior',
          icon: 'Table',
          rows: [
            { text: 'Confirmed.confirm()', value: 'no-op', tone: 'good' },
            { text: 'Cancelled.cancel()', value: 'no-op', tone: 'good' },
            { text: 'CheckedIn.confirm()', value: 'raises', tone: 'bad' },
          ],
        },
        caption: 'Repeating is harmless, mistakes are not',
      },
    },
    {
      title: 'The race',
      tag: 'problem',
      heading: 'Check, then act: the window where two threads win',
      eli5: "Two families peek at Grandma's notebook, see the blue room is free, and both write their name. The notebook was true when they looked and false by the time they wrote.",
      body: [
        '`reserve()` does three things: read the ledger for overlaps, build the reservation, append the dates. Between the read and the append there is a gap.',
        'Thread A reads, thread B reads, both see no overlap, both append. This is a **check-then-act race**. Unit tests on one thread never catch it.',
      ],
      keyIdea: 'A check and the action that depends on it must happen as one unit, or another thread slips between them.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      metricTones: { clash: 'bad' },
      scene: {
        nodes: [{ ...thA, at: at(-5.5, -2) }, { ...thB, at: at(-1.5, 3) }, { ...ledger, at: at(4.5, -0.5), status: 'hot', badge: '2 entries, same dates' }],
        links: [link('thA', 'ledger', 'reads, then writes'), link('thB', 'ledger', 'reads, then writes')],
        flows: [
          { path: ['thA', 'ledger'], tone: 'request', label: 'overlaps? no', duration: 1.2 },
          { path: ['thB', 'ledger'], tone: 'request', label: 'overlaps? no', duration: 1.2, delay: 0.2 },
          { path: ['thA', 'ledger'], tone: 'data', label: 'append', duration: 1.2, delay: 1.5 },
          { path: ['thB', 'ledger'], tone: 'data', label: 'append', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'Interleaving',
          icon: 'Table',
          rows: [
            { text: '1. A checks overlaps', value: 'none' },
            { text: '2. B checks overlaps', value: 'none' },
            { text: '3. A appends', value: 'ok' },
            { text: '4. B appends', value: 'clash', tone: 'bad' },
          ],
          footer: { text: 'The gap between 1 and 3 is the bug', tone: 'bad' },
        },
        caption: 'Both checks ran before either write',
      },
    },
    {
      title: 'Overlap test',
      tag: 'concept',
      heading: 'Do two stays overlap? One comparison',
      eli5: "Two sleepovers clash if each one starts before the other ends. A family leaving in the morning does not clash with one arriving that afternoon.",
      body: [
        'A new stay `[ci, co)` and an existing one `[i, o)` overlap exactly when `ci < o` and `i < co`. Because ranges are half-open, a guest leaving on the 12th and one arriving on the 12th are fine.',
        '`_overlaps` loops over the room ledger with this test. The lock only has to cover that the list for one room.',
      ],
      keyIdea: 'Two half-open ranges overlap when each starts before the other ends.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '1', stuck: '0' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2.2), sub: '_overlaps()' },
          { ...ledger, at: at(2, 0.4), sub: 'Jun 10 to 12' },
          { id: 'conflict', kind: 'block', size: 0.85, at: at(5.8, 4.2), label: 'ConflictError', sub: 'raised on clash', icon: 'Bug', tint: 'red' },
        ],
        links: [link('svc', 'ledger', 'uses'), link('ledger', 'conflict', 'creates')],
        flows: [
          { path: ['svc', 'ledger'], tone: 'request', label: 'Jun 11 to 13', duration: 1.5 },
          { path: ['ledger', 'conflict'], tone: 'error', label: 'overlap', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Ledger has Jun 10 to 12',
          icon: 'Table',
          rows: [
            { text: 'Jun 12 to 14', value: 'free', tone: 'good' },
            { text: 'Jun 11 to 13', value: 'clash', tone: 'bad' },
            { text: 'Jun 8 to 10', value: 'free', tone: 'good' },
            { text: 'Rule', value: 'ci < o and i < co', tone: 'muted' },
          ],
        },
        caption: 'Back-to-back stays are allowed',
      },
      code: {
        language: 'python',
        title: '_overlaps',
        source: `def _overlaps(self, room_no, ci, co):
    return any(
        ci < o and i < co
        for _, i, o in self._ledger[room_no]
    )`,
        highlight: [3],
      },
    },
    {
      title: 'Room lock',
      tag: 'concept',
      heading: 'Fix: a lock around check and write',
      eli5: "Grandma gives each room one pencil. Whoever holds it can look and write. The other family waits for the pencil, then sees the room is taken.",
      body: [
        'Wrap the overlap check and the append in `with lock:`. Only one thread holds the lock, so the second one waits, runs its check afterwards, sees the first stay, and raises `ConflictError`.',
        'The lock covers the check **and** the write. Locking only the check would leave the same gap.',
      ],
      keyIdea: 'Make check-then-act atomic with a lock held across both the check and the write.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '0' },
      metricTones: { clash: 'good' },
      scene: {
        nodes: [
          { ...thA, at: at(-6, -2), chips: ['holds the lock'] },
          { ...thB, at: at(-2.5, 3), status: 'dim', chips: [{ text: 'waiting', tone: 'warn' }] },
          { ...lock204, at: at(1.5, -1), status: 'active' },
          { ...ledger, at: at(5.5, 2) },
        ],
        links: [link('thA', 'lock204', 'acquire'), link('thB', 'lock204', 'blocked', { labelTone: 'warn' }), link('lock204', 'ledger', 'guards')],
        flows: [
          { path: ['thA', 'lock204', 'ledger'], tone: 'request', label: 'check, append', duration: 2 },
          { path: ['thB', 'lock204'], tone: 'error', label: 'wait', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'reserve() under the lock',
          icon: 'Code',
          code: 'with self._locks[room.number]:\n    if self._overlaps(num, ci, co):\n        raise ConflictError(...)\n    res = Reservation(...)\n    res.total = total_price(...)\n    self._ledger[num].append((res.id, ci, co))\n    return res',
        },
        caption: 'One thread in the critical section',
      },
      quiz: {
        question: 'Thread A locks only the _overlaps() call and releases the lock before appending to the ledger. What happens?',
        options: [
          'Nothing, the check is the dangerous part',
          'Two threads can still both pass the check and both append, so double bookings remain',
          'The lock deadlocks',
          'Reads become slower but writes are safe',
        ],
        answer: 1,
        explain: 'The race lives in the gap between the check and the write. The lock has to stay held across both.',
      },
    },
    {
      title: 'Global lock',
      tag: 'tradeoff',
      heading: 'One lock for the whole hotel does not scale',
      eli5: "If the whole guesthouse shares one pencil, a family booking the red room waits for a family booking the blue room, though they never touch.",
      body: [
        'A single global lock is correct and simple. It is fine for a 10-room B&B. Whether it hurts depends on how long the lock is held. It bites once the critical section includes slow work (a DB call, a pricing lookup, a payment hold) or the rate grows by orders of magnitude.',
        'At 40 bookings per second with a quick in-memory scan it would barely contend. This is a scaling concern: requests for different rooms have no reason to wait for each other.',
      ],
      keyIdea: 'A global lock is correct but serializes work that never conflicts.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '0' },
      scene: {
        nodes: [
          { ...thA, at: at(-6, -3.5), chips: ['room 204'] },
          { ...thB, at: at(-2.2, 0.5), chips: ['room 310'], status: 'dim' },
          { id: 'thC', kind: 'worker', at: at(-6, 4.5), label: 'Thread C', sub: 'room 415', status: 'dim' },
          { ...lock204, id: 'glock', label: 'Global lock', sub: 'whole hotel', at: at(3.5, 0.5), status: 'hot', load: 96 },
        ],
        links: [link('thA', 'glock', 'holds'), link('thB', 'glock', 'queued', { labelTone: 'warn' }), link('thC', 'glock', 'queued', { labelTone: 'warn' })],
        flows: [
          { path: ['thA', 'glock'], tone: 'request', label: 'reserve', duration: 1.5 },
          { path: ['thB', 'glock'], tone: 'error', label: 'wait', duration: 1.5, delay: 0.3 },
          { path: ['thC', 'glock'], tone: 'error', label: 'wait', duration: 1.5, delay: 0.6 },
        ],
        panel: {
          title: 'Different rooms, one queue',
          icon: 'Table',
          rows: [
            { text: 'Thread A, room 204', value: 'running', tone: 'good' },
            { text: 'Thread B, room 310', value: 'waiting', tone: 'warn' },
            { text: 'Thread C, room 415', value: 'waiting', tone: 'warn' },
          ],
          footer: { text: 'Fine while the lock is short, a limit as it grows', tone: 'warn' },
        },
        caption: 'Unrelated bookings queue up',
      },
    },
    {
      title: 'Lock striping',
      tag: 'concept',
      heading: 'One lock per room: lock striping',
      eli5: "Give every room its own pencil. The red-room family and the blue-room family write at once. Only two families after the same room share a pencil.",
      body: [
        '`BookingService` builds `{room.number: threading.Lock()}` once. `reserve()` takes the lock for the room it needs. Bookings for different rooms run in parallel, and bookings for the same room queue.',
        'This is **lock striping**: many small locks, each guarding one slice of the data. Per-room locks only work inside one process. With several app servers you need a database row lock, a unique or exclusion constraint on (room, date range), or a distributed lock.',
      ],
      keyIdea: 'Split one global lock into many, one per independent resource, so only real conflicts wait.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '0' },
      metricTones: { clash: 'good' },
      scene: {
        nodes: [
          { ...thA, at: at(-6, -2.5), chips: ['room 204'] },
          { ...thB, at: at(-2.2, 2), chips: ['room 310'] },
          { ...lock204, at: at(1.5, -2.5), sub: 'room 204' },
          { ...lock204, id: 'lock310', label: 'Lock 310', sub: 'room 310', at: at(5.2, 2) },
        ],
        links: [link('thA', 'lock204', 'acquire'), link('thB', 'lock310', 'acquire')],
        flows: [
          { path: ['thA', 'lock204'], tone: 'request', label: 'reserve 204', duration: 1.6 },
          { path: ['thB', 'lock310'], tone: 'request', label: 'reserve 310', duration: 1.6 },
        ],
        panel: {
          title: 'Locks per room',
          icon: 'Code',
          code: 'self._locks = {\n    r.number: threading.Lock()\n    for r in rooms\n}\nself._ledger = defaultdict(list)',
          footer: { text: 'One process only: servers need a DB lock or constraint', tone: 'warn' },
        },
        caption: 'Two rooms, two locks, no waiting',
      },
    },
    {
      title: 'Two systems',
      tag: 'problem',
      heading: 'Reserving and charging are two separate systems',
      eli5: "Grandma holds a room, then walks to the bank next door to take the money. If the bank says no, the room stays held. If Grandma trips on the way, money is taken and no room is written.",
      body: [
        'Booking a room and charging a card touch two systems. The ledger and the payment service share no transaction, so one can succeed while the other fails.',
        'Charge fails after the hold: the room stays blocked for nothing. The process crashes after the charge: the guest paid and has no booking.',
      ],
      keyIdea: 'Two systems with no shared transaction can end up half done, and the code has to plan for that.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '1' },
      metricTones: { stuck: 'bad' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2.4), status: 'hot' },
          { ...res, at: at(0, 1.2), sub: 'held, not paid' },
          { ...payment, at: at(4.2, -2.4), status: 'down' },
        ],
        links: [link('svc', 'res', 'creates'), link('svc', 'payment', 'uses')],
        flows: [
          { path: ['svc', 'res'], tone: 'request', label: 'reserve()', duration: 1.4 },
          { path: ['svc', 'payment'], tone: 'request', label: 'charge()', duration: 1.4, delay: 1.5 },
          { path: ['payment', 'svc'], tone: 'error', label: 'declined', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Two ways to end half done',
          icon: 'Table',
          rows: [
            { text: 'Held, charge fails', value: 'room blocked', tone: 'bad' },
            { text: 'Charged, crash before confirm', value: 'paid, no booking', tone: 'bad' },
            { text: 'Fix for crashes', value: 'saga log + recovery job', tone: 'good' },
          ],
        },
        caption: 'No shared transaction between the two',
      },
    },
    {
      title: 'Saga',
      tag: 'concept',
      heading: 'Saga: every step carries its own undo',
      eli5: "Grandma writes each job and its undo on a list: hold the room (undo: free it), take the money (undo: give it back). If a job fails, she works back up the list.",
      body: [
        'A **Saga** is an ordered list of `SagaStep`s. Each step has an `action` and a `compensate`. Run the actions in order and remember which finished.',
        'On a failure, run the compensations of the completed steps in **reverse** order, then re-raise the error. A failed compensation is logged so the rest still run. A real saga persists the status of each step (a saga log) and retries failed compensations from a queue.',
      ],
      keyIdea: 'A saga replaces one big transaction with small steps, each paired with a compensation that undoes it.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '1' },
      scene: {
        nodes: [saga, { ...sagaStep, at: at(0, 3.4) }, { id: 'ctx', kind: 'block', size: 0.8, at: at(4, 0.4), label: 'context', sub: 'dict of results', icon: 'Braces', tint: 'amber' }],
        links: [link('saga', 'sagastep', 'has-a'), link('saga', 'ctx', 'uses')],
        flows: [
          { path: ['saga', 'sagastep'], tone: 'request', label: 'action(ctx)', duration: 1.5 },
          { path: ['sagastep', 'saga'], tone: 'error', label: 'compensate(ctx)', duration: 1.5, delay: 1.7 },
        ],
        panel: {
          title: 'Saga.execute',
          icon: 'Code',
          code: 'for step in self.steps:\n    step.action(context)\n    completed.append(step)\n# on error:\nfor step in reversed(completed):\n    step.compensate(context)\nraise',
        },
        caption: 'Run forward, undo backward',
      },
      code: {
        language: 'python',
        title: 'Saga and SagaStep',
        source: `class SagaStep:
    def __init__(self, name, action, compensate):
        self.name, self.action, self.compensate = name, action, compensate

class Saga:
    def __init__(self, steps):
        self.steps = steps

    def execute(self, context):
        completed = []
        try:
            for step in self.steps:
                step.action(context)
                completed.append(step)
            return context
        except Exception:
            for step in reversed(completed):
                try:
                    step.compensate(context)
                except Exception as err:
                    logger.error(f"undo {step.name} failed: {err}")
            raise`,
        highlight: [12, 13, 16, 17],
      },
    },
    {
      title: 'Booking saga',
      tag: 'case',
      heading: 'The booking saga: hold, charge, confirm',
      eli5: "Grandma's list has three jobs in order: put a name on the room, take the money at the bank, then stamp BOOKED. Each job has its undo ready.",
      body: [
        '`hold_room` calls `reserve()` and saves the reservation in the context. `charge_card` charges the total. `confirm` moves the state to confirmed and stores the `payment_id`.',
        '`confirm` is last, so it needs no compensation. Undos: `release_room` cancels the reservation, `refund_card` refunds the payment.',
      ],
      keyIdea: 'Order the steps so the last one cannot fail the others, and give every earlier step a compensation.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '0' },
      metricTones: { stuck: 'good' },
      scene: {
        nodes: [{ ...svc, at: at(-4, -2.4) }, { ...res, at: at(0, 1.2), status: 'ok' }, { ...payment, at: at(4.2, -2.4) }],
        links: [link('svc', 'res', 'creates'), link('svc', 'payment', 'uses')],
        flows: [
          { path: ['svc', 'res'], tone: 'request', label: '1 hold_room', duration: 1.3 },
          { path: ['svc', 'payment'], tone: 'request', label: '2 charge_card', duration: 1.3, delay: 1.4 },
          { path: ['payment', 'svc'], tone: 'response', label: 'payment id', duration: 1.3, delay: 2.8 },
          { path: ['svc', 'res'], tone: 'response', label: '3 confirm', duration: 1.3, delay: 4.2 },
        ],
        panel: {
          title: 'Steps and their undo',
          icon: 'Table',
          rows: [
            { text: 'hold_room', value: 'release_room' },
            { text: 'charge_card', value: 'refund_card' },
            { text: 'confirm', value: 'none (last step)', tone: 'muted' },
          ],
        },
        caption: 'Happy path: all three succeed',
      },
      code: {
        language: 'python',
        title: 'Wiring the booking saga',
        source: `def book_with_payment(guest, room, ci, co, card, booking, payments):
    ctx = {"guest": guest, "room": room, "ci": ci, "co": co, "card": card}

    def hold_room(c):
        c["res"] = booking.reserve(c["guest"], c["room"], c["ci"], c["co"])
    def release_room(c):
        if "res" in c: booking.cancel(c["res"].id)
    def charge_card(c):
        c["payment"] = payments.charge(c["card"], c["res"].total)
    def refund_card(c):
        if "payment" in c: payments.refund(c["payment"].id)
    def confirm(c):
        c["res"].state.confirm(c["res"])
        c["res"].payment_id = c["payment"].id

    return Saga([
        SagaStep("hold_room", hold_room, release_room),
        SagaStep("charge_card", charge_card, refund_card),
        SagaStep("confirm", confirm, lambda c: None),
    ]).execute(ctx)`,
        highlight: [18, 19, 20],
      },
    },
    {
      title: 'Card declined',
      tag: 'case',
      heading: 'Failure: the card is declined, the room is released',
      eli5: "The bank says no. Grandma looks at her list, sees she already put a name on the room, and rubs it off so the next family can have it.",
      body: [
        '`charge_card` raises. The saga has one completed step, `hold_room`, so it runs `release_room`, which cancels the reservation, then re-raises the error to the caller.',
        'The cancel must also free the dates in the ledger, or the room stays blocked even though the reservation is cancelled.',
      ],
      keyIdea: 'On failure the saga undoes only what finished, in reverse, so the system ends where it started.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '0' },
      scene: {
        nodes: [{ ...svc, at: at(-4, -2.4), status: 'active' }, { ...res, at: at(0, 1.2), status: 'dim', sub: 'cancelled' }, { ...payment, at: at(4.2, -2.4), status: 'down' }],
        links: [link('svc', 'res', 'uses'), link('svc', 'payment', 'uses')],
        flows: [
          { path: ['svc', 'payment'], tone: 'request', label: 'charge_card', duration: 1.3 },
          { path: ['payment', 'svc'], tone: 'error', label: 'CardDeclined', duration: 1.3, delay: 1.4 },
          { path: ['svc', 'res'], tone: 'event', label: 'release_room', duration: 1.3, delay: 2.9 },
        ],
        panel: {
          title: 'What ran',
          icon: 'Table',
          rows: [
            { text: 'hold_room', value: 'done', tone: 'good' },
            { text: 'charge_card', value: 'failed', tone: 'bad' },
            { text: 'release_room', value: 'undo ran', tone: 'good' },
            { text: 'confirm', value: 'never ran', tone: 'muted' },
          ],
          footer: { text: 'Error re-raised, room free again', tone: 'good' },
        },
        caption: 'Compensation runs in reverse',
      },
      code: {
        language: 'python',
        title: 'cancel frees the ledger',
        source: `def cancel(self, res):
    with self._locks[res.room.number]:
        res.state.cancel(res)
        self._ledger[res.room.number] = [
            e for e in self._ledger[res.room.number]
            if e[0] != res.id
        ]`,
        highlight: [2, 3, 4, 5, 6],
      },
    },
    {
      title: 'Timeout',
      tag: 'tradeoff',
      heading: 'Failure: the charge times out and nobody knows the result',
      eli5: "Grandma phones the bank, the line goes quiet. Did the money move? She cannot tell, so she must be able to ask again without taking the money twice.",
      body: [
        'A timeout does not say whether the charge happened. A refund guarded by `"payment" in ctx` would miss a charge that went through but never replied.',
        'Use an **idempotency key** per operation: `charge-` plus the reservation id, and `refund-` plus it. Look the payment up by the charge key. Pending holds should expire, and a recovery job resumes unfinished sagas.',
      ],
      keyIdea: 'Compensations must be idempotent, so a retry after a timeout is always safe.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '0' },
      metricTones: { stuck: 'good' },
      scene: {
        nodes: [
          { ...svc, at: at(-4, -2.4), chips: ['charge-/refund- keys'] },
          { ...payment, at: at(4.2, -2.4), status: 'hot', chips: [{ text: 'timeout', tone: 'warn' }] },
          { id: 'idem', kind: 'block', size: 0.85, at: at(0, 2.4), label: 'Idempotency key', sub: 'dedupes retries', icon: 'KeyRound', tint: 'amber' },
        ],
        links: [link('svc', 'payment', 'uses'), link('payment', 'idem', 'uses')],
        flows: [
          { path: ['svc', 'payment'], tone: 'request', label: 'charge(key)', duration: 1.3 },
          { path: ['svc', 'payment'], tone: 'request', label: 'retry refund(key)', duration: 1.3, delay: 2 },
          { path: ['payment', 'svc'], tone: 'response', label: 'already done', duration: 1.3, delay: 3.5 },
        ],
        panel: {
          title: 'Retry-safe calls',
          icon: 'Code',
          code: 'payments.charge(card, total,\n    idempotency_key=\"charge-\"+res.id)\n\ndef refund_card(c):\n    p = payments.find_by_key(\n        \"charge-\"+c[\"res\"].id)\n    if p: payments.refund(p.id,\n        idempotency_key=\"refund-\"+c[\"res\"].id)',
          footer: { text: 'Same key, applied once', tone: 'good' },
        },
        caption: 'Unknown outcomes need safe retries',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Four patterns, one booking',
      eli5: "Grandma's guesthouse works because helpers price the stay, a stamp says what each card allows, one pencil per room stops clashes, and a list of undos fixes half-finished jobs.",
      body: [
        '**Strategy** prices a stay and **Composite** combines rules. **State** guards the lifecycle. A **lock per room** stops double booking without a global queue. A **Saga** keeps booking and payment consistent for failures the process survives. Crashes need a saga log and a recovery job.',
        'The shape repeats: start simple, hit a problem, add the pattern that solves it. Money is `Decimal`, stays are half-open ranges, and retries must be safe.',
      ],
      keyIdea: 'Concurrency and transaction boundaries are the hard part of this design. The patterns around them keep the rest small.',
      metrics: { rooms: '500', rules: '3 classes + composite', clash: '0', stuck: '0' },
      metricTones: { clash: 'good', stuck: 'good' },
      scene: {
        nodes: [
          { ...pricingIf, at: at(-5.5, -3), sub: 'Strategy', status: 'ok' },
          { ...stateIf, at: at(0, -3.5), sub: 'State', status: 'ok' },
          { ...lock204, at: at(5.5, -3), sub: 'lock per room', status: 'ok' },
          { ...saga, at: at(0, 4.5), sub: 'Saga', status: 'ok' },
        ],
        links: [link('pricing', 'state', 'prices'), link('state', 'lock204', 'guarded by'), link('state', 'saga', 'paid by')],
        flows: [{ path: ['pricing', 'state', 'saga'], tone: 'data', label: 'one booking', duration: 2.2 }],
        panel: {
          title: 'Problem to pattern',
          icon: 'Table',
          rows: [
            { text: 'Many price rules', value: 'Strategy, Composite' },
            { text: 'Lifecycle', value: 'State' },
            { text: 'Double booking', value: 'Lock per room' },
            { text: 'Booking plus payment', value: 'Saga' },
          ],
        },
        caption: 'Each pattern answers one force',
      },
      quiz: {
        question: 'A charge call times out and you do not know if the card was billed. What makes the saga safe to retry?',
        options: [
          'Skip the refund and hope the charge failed',
          'Use a global lock around the saga',
          'Send an idempotency key so repeated charge or refund calls apply once',
          'Roll back the database transaction',
        ],
        answer: 2,
        explain: 'There is no shared transaction across the ledger and the payment service. An idempotency key makes the retry apply at most once, so the compensation is safe to repeat.',
      },
    },
  ],
};
