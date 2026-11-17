import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });

const lot: SceneNode = { id: 'lot', kind: 'block', at: at(0, -3.4), label: 'ParkingLot', sub: 'concrete class', icon: 'Warehouse', tint: 'green' };
const vehicle: SceneNode = { id: 'vehicle', kind: 'block', at: at(-3.8, 0), label: 'Vehicle', sub: 'abstract class', icon: 'Car', tint: 'blue' };
const spot: SceneNode = { id: 'spot', kind: 'block', at: at(3.8, 0), label: 'Spot', sub: 'concrete class', icon: 'SquareParking', tint: 'green' };
const floor: SceneNode = { id: 'floor', kind: 'block', at: at(0, 3.4), label: 'Floor', sub: 'concrete class', icon: 'Layers', tint: 'green' };
const pricing: SceneNode = { id: 'pricing', kind: 'block', at: at(-3.8, 0), label: 'PricingStrategy', sub: 'interface', icon: 'Tag', tint: 'violet' };

export const lldParkingLot: Lesson = {
  id: 'lld-parking-lot',
  title: 'Parking lot',
  tagline: 'Start with one ugly class and fix one pain at a time: types, size matching, fast lookup, locks and pricing.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why one class holding everything breaks, and how to split it into Vehicle, Spot, Floor and ParkingLot',
    'Inheritance plus an enum to match vehicle size to spot size',
    'A free-spot index by size that turns an O(n) scan into O(1)',
    'A lock that stops two threads taking the same spot, and how small to keep it',
    'The Strategy pattern for pricing rules that change every month',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'find', label: 'Find a spot', icon: 'Timer' },
    { key: 'safe', label: 'Thread safe', icon: 'Lock' },
    { key: 'pricing', label: 'Pricing', icon: 'Tag' },
  ],
  steps: [
    {
      title: 'The mall lot',
      tag: 'problem',
      heading: 'Design a parking lot: where most candidates freeze',
      eli5: 'A **parking lot** is a toy garage with little numbered slots. Kids keep adding rules (big trucks, fees, many doors) and the garage must not fall apart.',
      body: [
        'A mall wants software for its lot: 5,000 spots over 5 floors, bikes, cars and trucks, tickets at the gate and a fee when you leave. The classic interview question is "design a parking lot".',
        'The trap is to draw ten patterns at once. We do the opposite. Write something ugly that works, feel the pain, then fix one pain at a time. Each version below is a checkpoint.',
      ],
      keyIdea: 'Do not start from patterns. Start from a working version and let each pain pick the next design move.',
      metrics: { classes: '1', find: '-', safe: '-', pricing: '-' },
      scene: {
        nodes: [
          { ...lot, status: 'active', chips: ['park(vehicle)', 'leave(spot)'] },
          { id: 'ext', kind: 'block', at: at(-3.8, 3.4), label: 'Gate', sub: 'external system', icon: 'DoorOpen', tint: 'gray' },
          { id: 'req', kind: 'block', at: at(3.8, 3.4), label: 'Requirements', sub: 'what it must do', icon: 'ListChecks', tint: 'amber' },
        ],
        links: [link('ext', 'lot', 'uses'), link('req', 'lot', 'shapes')],
        flows: [{ path: ['ext', 'lot'], tone: 'request', label: 'park(car)', duration: 1.6 }],
        panel: {
          title: 'Requirements',
          icon: 'ListChecks',
          rows: [
            { text: 'Spots', value: '5,000 over 5 floors' },
            { text: 'Vehicles', value: 'bike, car, truck' },
            { text: 'Entry', value: 'ticket at the gate' },
            { text: 'Exit', value: 'pay by hours parked' },
            { text: 'Rush hour', value: 'many cars at once', tone: 'warn' },
          ],
        },
        caption: 'One gate asks one lot to park a car',
      },
    },
    {
      title: 'v1 one class',
      tag: 'concept',
      heading: 'v1: everything in one class',
      eli5: 'The toy garage is one big box with numbered holes. A toy goes in the first empty hole. Nobody knows if it is a car or a truck, it is just a name tag.',
      body: [
        'Brute force first. One class, a flat list of spots, and the vehicle is just a plate string. `park` walks the list and takes the first `None`.',
        'It works for a demo. It has no vehicle type, no floors, no prices and no owner of any rule. Everything is a string, so every new feature edits the same class.',
      ],
      keyIdea: 'A god class works on day one and gets more expensive with every feature.',
      metrics: { classes: '1', find: 'O(n)', safe: 'no', pricing: 'none' },
      metricTones: { find: 'warn', safe: 'bad' },
      scene: {
        nodes: [
          { ...lot, status: 'hot', badge: 'does everything' },
          { id: 'plates', kind: 'block', at: at(-3.8, 3.4), label: 'list[str]', sub: 'plates or None', icon: 'List', tint: 'gray' },
        ],
        links: [link('lot', 'plates', 'has-a')],
        flows: [
          { path: ['lot', 'plates'], tone: 'request', label: 'scan for None', duration: 1.5 },
          { path: ['plates', 'lot'], tone: 'response', label: 'index 3', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'v1 ParkingLot',
          icon: 'Code',
          code: 'class ParkingLot:\n  def __init__(self, n):\n    self.spots = [None] * n\n  def park(self, plate):\n    for i, s in enumerate(self.spots):\n      if s is None:\n        self.spots[i] = plate\n        return i',
        },
        caption: 'One class, one list, no concepts',
      },
      code: {
        language: 'python',
        title: 'v1: everything in one class',
        source: `class ParkingLot:
    def __init__(self, n):
        self.spots = [None] * n  # None = empty, else "CAR-123"

    def park(self, plate):
        for i, s in enumerate(self.spots):
            if s is None:
                self.spots[i] = plate
                return i
        return -1

    def leave(self, i):
        self.spots[i] = None`,
        highlight: [2, 5, 6, 7, 8],
      },
    },
    {
      title: 'Split nouns',
      tag: 'concept',
      heading: 'v2: give each noun its own class',
      eli5: 'Instead of one box, the garage now has floors, each floor has slots, and each toy is a real toy with its own name tag.',
      body: [
        'The nouns in the requirements become classes. A `Vehicle` has a plate. A `Spot` has an id and may hold a vehicle. A `Floor` owns spots. The `ParkingLot` owns floors.',
        'This is **has-a** composition: a lot has floors, a floor has spots, a spot has a vehicle. Each class now has one reason to change.',
      ],
      keyIdea: 'Turn the nouns in the problem statement into classes and connect them with has-a links.',
      metrics: { classes: '4', find: 'O(n)', safe: 'no', pricing: 'none' },
      metricTones: { classes: 'good', find: 'warn', safe: 'bad' },
      scene: {
        nodes: [lot, floor, spot, { ...vehicle, sub: 'plate' }],
        links: [link('lot', 'floor', 'has-a'), link('floor', 'spot', 'has-a'), link('spot', 'vehicle', 'has-a')],
        flows: [{ path: ['lot', 'floor', 'spot'], tone: 'request', label: 'park(v)', duration: 2 }],
        panel: {
          title: 'v2 classes',
          icon: 'Code',
          code: '@dataclass\nclass Vehicle:\n  plate: str\n\n@dataclass\nclass Spot:\n  id: int\n  vehicle: Vehicle | None = None',
        },
        caption: 'Lot has floors, floor has spots',
      },
      code: {
        language: 'python',
        title: 'v2: Vehicle, Spot, Floor, ParkingLot',
        source: `from dataclasses import dataclass

@dataclass
class Vehicle:
    plate: str

@dataclass
class Spot:
    id: int
    vehicle: Vehicle | None = None

class Floor:
    def __init__(self, level, n):
        self.level = level
        self.spots = [Spot(i) for i in range(n)]

class ParkingLot:
    def __init__(self, floors):
        self.floors = floors

    def park(self, v: Vehicle):
        for f in self.floors:
            for s in f.spots:
                if s.vehicle is None:
                    s.vehicle = v
                    return (f.level, s.id)
        return None`,
        highlight: [14, 15, 19, 20],
      },
    },
    {
      title: 'Wrong size',
      tag: 'case',
      heading: 'Pain: every vehicle looks the same',
      eli5: 'A big toy truck gets pushed into a tiny bike slot because the garage only asks "is this slot empty?" and never asks "does it fit?".',
      body: [
        '`park` checks `s.vehicle is None` and nothing else. A truck can take a bike spot, and a bike can take the only truck spot left.',
        'The lot needs to know how big a vehicle is and how big a spot is. That knowledge belongs in the types, not in an `if` inside `park`.',
      ],
      keyIdea: 'If the code treats different things the same, the model is missing a concept. Here the missing concept is size.',
      metrics: { classes: '4', find: 'O(n)', safe: 'no', pricing: 'none' },
      metricTones: { find: 'warn', safe: 'bad' },
      scene: {
        nodes: [
          { id: 'truck', kind: 'block', at: at(-3.8, 0), label: 'Truck', sub: 'needs a large spot', icon: 'Truck', tint: 'blue', status: 'hot' },
          { ...spot, id: 'bikeSpot', label: 'Spot 7', sub: 'bike size', status: 'down', badge: 'too small' },
          { ...lot, status: 'active' },
        ],
        links: [link('lot', 'truck', 'uses'), link('lot', 'bikeSpot', 'assigns', { labelTone: 'warn' })],
        flows: [{ path: ['lot', 'bikeSpot'], tone: 'error', label: 'park(truck)', duration: 1.6 }],
        panel: {
          title: 'The missing check',
          icon: 'CircleAlert',
          rows: [
            { text: 'spot.vehicle is None', value: 'checked', tone: 'good' },
            { text: 'spot size >= vehicle size', value: 'never checked', tone: 'bad' },
          ],
          footer: { text: 'A truck takes a bike spot', tone: 'bad' },
        },
        caption: 'park() only asks if the spot is empty',
      },
    },
    {
      title: 'Size and types',
      tag: 'concept',
      heading: 'v3: an enum for size, inheritance for vehicle types',
      eli5: 'Every toy gets a size sticker: small, medium or large. Bikes, cars and trucks are all toys, they just wear different stickers.',
      body: [
        'A `Size` enum holds `SMALL`, `MEDIUM` and `LARGE` with numeric values so sizes can be compared. `Vehicle` becomes a base class that stores a size.',
        '`Bike`, `Car` and `Truck` **extend** it and fix the size in their constructors. Code that parks a vehicle only talks to `Vehicle`.',
      ],
      keyIdea: 'Put the varying fact (size) into the type, so the lot never has to ask "what kind is this?".',
      metrics: { classes: '7', find: 'O(n)', safe: 'no', pricing: 'none' },
      metricTones: { classes: 'good', find: 'warn', safe: 'bad' },
      scene: {
        nodes: [
          { ...vehicle, at: at(0, -3.4) },
          { id: 'bike', kind: 'block', size: 0.72, at: at(-3.8, 3.4), label: 'Bike', sub: 'SMALL', icon: 'Bike', tint: 'green' },
          { id: 'car', kind: 'block', size: 0.72, at: at(0, 3.4), label: 'Car', sub: 'MEDIUM', icon: 'Car', tint: 'green' },
          { id: 'truck', kind: 'block', size: 0.72, at: at(3.8, 3.4), label: 'Truck', sub: 'LARGE', icon: 'Truck', tint: 'green' },
        ],
        links: [link('bike', 'vehicle', 'extends'), link('car', 'vehicle', 'extends'), link('truck', 'vehicle', 'extends')],
        panel: {
          title: 'Size enum',
          icon: 'Code',
          code: 'class Size(Enum):\n  SMALL = 1\n  MEDIUM = 2\n  LARGE = 3\n\nclass Car(Vehicle):\n  def __init__(self, plate):\n    super().__init__(plate, Size.MEDIUM)',
        },
        caption: 'Three subclasses, one base type',
      },
      code: {
        language: 'python',
        title: 'v3: Size enum and Vehicle subclasses',
        source: `from enum import Enum

class Size(Enum):
    SMALL = 1
    MEDIUM = 2
    LARGE = 3

class Vehicle:
    def __init__(self, plate, size):
        self.plate, self.size = plate, size

class Bike(Vehicle):
    def __init__(self, plate): super().__init__(plate, Size.SMALL)

class Car(Vehicle):
    def __init__(self, plate): super().__init__(plate, Size.MEDIUM)

class Truck(Vehicle):
    def __init__(self, plate): super().__init__(plate, Size.LARGE)`,
        highlight: [3, 4, 5, 6, 8, 13, 16, 19],
      },
    },
    {
      title: 'Spot fits',
      tag: 'concept',
      heading: 'Let the spot answer "do you fit?"',
      eli5: 'Each slot knows its own size and can say "yes, this toy fits me". The garage just asks the slot, it does not measure anything itself.',
      body: [
        '`Spot` gets a size and a `fits(v)` method: it is empty and its size is at least the vehicle size. A car may use a medium or a large spot. A truck needs a large one.',
        'The rule lives next to the data it uses. The lot calls `spot.fits(v)` and never compares sizes itself. Later rules, such as EV charging, change only `Spot`.',
      ],
      keyIdea: 'Put a rule on the class that owns the data. Callers ask, they do not peek.',
      metrics: { classes: '7', find: 'O(n)', safe: 'no', pricing: 'none' },
      metricTones: { find: 'warn', safe: 'bad' },
      scene: {
        nodes: [
          { ...lot },
          { ...spot, status: 'active', sub: 'size + fits()', chips: [{ text: 'LARGE', tone: 'good' }] },
          { ...vehicle, label: 'Truck', sub: 'LARGE', tint: 'green' },
        ],
        links: [link('lot', 'spot', 'uses'), link('spot', 'vehicle', 'uses')],
        flows: [
          { path: ['lot', 'spot'], tone: 'request', label: 'fits(truck)?', duration: 1.5 },
          { path: ['spot', 'lot'], tone: 'response', label: 'True', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Spot.fits',
          icon: 'Code',
          code: 'class Spot:\n  def __init__(self, id, size):\n    self.id, self.size = id, size\n    self.vehicle = None\n\n  def fits(self, v):\n    return (self.vehicle is None\n      and self.size.value >= v.size.value)',
        },
        caption: 'The spot decides, the lot just asks',
      },
    },
    {
      title: 'Scan cost',
      tag: 'case',
      heading: 'Pain: park() scans thousands of spots',
      eli5: 'On a busy Saturday every toy walks past every slot to find an empty one. A line forms at the garage door.',
      body: [
        '`park` still loops floors and spots until `fits` says yes. With 5,000 spots, a full lot means up to 5,000 checks per car, and the first free spot is usually at the far end.',
        'At 200 entries per minute that is a million checks a minute just to find a seat. A queue forms at the gate.',
      ],
      keyIdea: 'A linear scan is fine for tens of items. At thousands per request, keep an index of what is free.',
      metrics: { classes: '7', find: '5,000 checks', safe: 'no', pricing: 'none' },
      metricTones: { find: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { id: 'gate', kind: 'block', at: at(-3.8, -3.4), label: 'Gate', sub: '200 cars/min', icon: 'DoorOpen', tint: 'gray', chips: [{ text: 'queue: 40 cars', tone: 'bad' }] },
          { ...lot, status: 'hot', load: 92 },
          { ...floor, label: 'Floors', sub: '5 x 1,000 spots', status: 'hot' },
        ],
        links: [link('gate', 'lot', 'uses'), link('lot', 'floor', 'scans')],
        flows: [
          { path: ['gate', 'lot', 'floor'], tone: 'request', label: 'park(car)', duration: 1.6 },
          { path: ['floor', 'lot', 'gate'], tone: 'error', label: 'slow...', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Cost per park()',
          icon: 'Timer',
          rows: [
            { text: 'Empty lot', value: '1 check', tone: 'good' },
            { text: 'Half full', value: '~2,500 checks', tone: 'warn' },
            { text: 'Nearly full', value: '~5,000 checks', tone: 'bad' },
          ],
        },
        caption: 'Every arrival walks the whole lot',
      },
    },
    {
      title: 'Free index',
      tag: 'concept',
      heading: 'v4: keep free spots in a map by size',
      eli5: 'The garage keeps three small baskets of keys: one for small slots, one for medium, one for large. A toy just grabs a key from the right basket.',
      body: [
        'Index the free spots: `free[size]` is a set of spot ids. `park` looks at its own size first, then bigger ones, and pops an id. A set pop and a dict lookup are O(1).',
        '`leave` puts the id back into the right set. The lot now has a `spots` map from id to `Spot`, so no loop is needed at all.',
      ],
      keyIdea: 'Trade a little memory for speed: index free spots by size and a park becomes a few dictionary operations.',
      metrics: { classes: '7', find: 'O(1)', safe: 'no', pricing: 'none' },
      metricTones: { find: 'good', safe: 'bad' },
      scene: {
        nodes: [
          { ...lot, status: 'active' },
          { id: 'free', kind: 'block', at: at(-3.8, 3.4), label: 'free[size]', sub: 'dict of sets', icon: 'Database', tint: 'green', chips: ['SMALL: {4, 9}', 'MEDIUM: {2, 7, 8}', 'LARGE: {5}'] },
          { id: 'spots', kind: 'block', at: at(3.8, 3.4), label: 'spots', sub: 'id to Spot', icon: 'Table', tint: 'green' },
        ],
        links: [link('lot', 'free', 'has-a'), link('lot', 'spots', 'has-a')],
        flows: [
          { path: ['lot', 'free'], tone: 'request', label: 'pop(MEDIUM)', duration: 1.4 },
          { path: ['free', 'lot'], tone: 'response', label: 'spot 2', duration: 1.4, delay: 1.5 },
          { path: ['lot', 'spots'], tone: 'request', label: 'spots[2]', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'v4 park',
          icon: 'Code',
          code: 'def park(self, v):\n  for size in Size:\n    if size.value < v.size.value:\n      continue\n    if self.free[size]:\n      sid = self.free[size].pop()\n      self.spots[sid].vehicle = v\n      return sid',
        },
        caption: 'Pick the right basket, take a key',
      },
      code: {
        language: 'python',
        title: 'v4: free spots indexed by size',
        source: `from collections import defaultdict

class ParkingLot:
    def __init__(self):
        self.free = defaultdict(set)  # size -> free spot ids
        self.spots = {}               # id -> Spot

    def add_spot(self, spot):
        self.spots[spot.id] = spot
        self.free[spot.size].add(spot.id)

    def park(self, v):
        for size in Size:             # same size first, then bigger
            if size.value < v.size.value:
                continue
            if self.free[size]:
                sid = self.free[size].pop()
                self.spots[sid].vehicle = v
                return sid
        return None

    def leave(self, sid):
        s = self.spots[sid]
        s.vehicle = None
        self.free[s.size].add(sid)`,
        highlight: [5, 6, 13, 14, 16, 17, 18, 24],
      },
      quiz: {
        question: 'A car arrives and the MEDIUM set is empty but the LARGE set has free spots. What should v4 do?',
        options: ['Reject the car', 'Give it a LARGE spot, since size.value is at least the car size', 'Scan every floor again', 'Wait until a MEDIUM spot frees up'],
        answer: 1,
        explain: 'The loop skips sizes smaller than the vehicle and tries the rest in order. A larger spot is a valid fallback, at the cost of wasting space.',
      },
    },
    {
      title: 'Same spot twice',
      tag: 'case',
      heading: 'Pain: two cars, one spot',
      eli5: 'Two toys reach into the large basket at the same moment and both grab the same key. Now two toys sit in one slot and one gets squashed.',
      body: [
        'Two gate threads call `park` together. Both read `free[LARGE]`, both see spot 5, and both write their vehicle into it. One car is silently overwritten.',
        'The steps "check free" and "take it" are separate. Another thread can run between them. This is a **race condition**, and it only shows up under load, which is when it hurts.',
      ],
      keyIdea: 'Check-then-act on shared state is unsafe unless the whole sequence runs as one unit.',
      metrics: { classes: '7', find: 'O(1)', safe: 'no', pricing: 'none' },
      metricTones: { find: 'good', safe: 'bad' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: at(-3.8, -3.4), label: 'Thread A', sub: 'gate 1', status: 'hot' },
          { id: 't2', kind: 'worker', at: at(3.8, -3.4), label: 'Thread B', sub: 'gate 2', status: 'hot' },
          { id: 'free', kind: 'block', at: at(0, 3.4), label: 'free[LARGE]', sub: 'shared state', icon: 'Database', tint: 'red', status: 'hot', chips: [{ text: '{5}', tone: 'bad' }], load: 95 },
        ],
        links: [link('t1', 'free', 'reads 5', { labelTone: 'warn' }), link('t2', 'free', 'reads 5', { labelTone: 'warn' })],
        flows: [
          { path: ['t1', 'free'], tone: 'error', label: 'take 5', duration: 1.6 },
          { path: ['t2', 'free'], tone: 'error', label: 'take 5', duration: 1.6 },
        ],
        panel: {
          title: 'Interleaving',
          icon: 'GitCompare',
          rows: [
            { text: 'A: sees free {5}', value: 't=1' },
            { text: 'B: sees free {5}', value: 't=2', tone: 'warn' },
            { text: 'A: spot 5 = carA', value: 't=3' },
            { text: 'B: spot 5 = carB', value: 't=4', tone: 'bad' },
          ],
          footer: { text: 'Car A vanished', tone: 'bad' },
        },
        caption: 'Both threads got spot 5',
      },
    },
    {
      title: 'v5 lock',
      tag: 'concept',
      heading: 'v5: a lock around check-and-take',
      eli5: 'Only one toy may stand at the basket at a time. A little guard holds the basket door, so the next toy waits until the first one has taken its key.',
      body: [
        'Add a `threading.Lock` to the lot and run the check and the take inside `with self.lock`. Only one thread is in that block at once, so two cars can never get the same id.',
        'The lock must also guard `leave`, because it writes to the same sets. A lock only protects code that actually takes it.',
      ],
      keyIdea: 'Make the check and the take one atomic step, and guard every path that touches the same data with the same lock.',
      metrics: { classes: '7', find: 'O(1)', safe: 'yes', pricing: 'none' },
      metricTones: { find: 'good', safe: 'good' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: at(-3.8, -3.4), label: 'Thread A', sub: 'holds lock', status: 'active' },
          { id: 't2', kind: 'worker', at: at(3.8, -3.4), label: 'Thread B', sub: 'waits', status: 'dim' },
          { id: 'lock', kind: 'vault', at: at(0, -0.6), label: 'Lock', sub: 'one at a time', status: 'ok' },
          { id: 'free', kind: 'block', at: at(3.8, 4.6), label: 'free[LARGE]', sub: 'shared state: {5}', icon: 'Database', tint: 'green' },
        ],
        links: [link('t1', 'lock', 'acquire'), link('t2', 'lock', 'blocked', { style: 'dashed', labelTone: 'warn' }), link('lock', 'free', 'guards')],
        flows: [
          { path: ['t1', 'lock', 'free'], tone: 'request', label: 'take 5', duration: 2 },
          { path: ['t2', 'lock'], tone: 'error', label: 'wait', duration: 1.4, delay: 2.1 },
        ],
        panel: {
          title: 'v5 park',
          icon: 'Code',
          code: 'def park(self, v):\n  with self.lock:\n    for size in Size:\n      if size.value < v.size.value:\n        continue\n      if self.free[size]:\n        sid = self.free[size].pop()\n        return sid',
        },
        caption: 'One thread at a time through the block',
      },
      code: {
        language: 'python',
        title: 'v5: park and leave under one lock',
        source: `import threading

class ParkingLot:
    def __init__(self):
        self.free = defaultdict(set)
        self.spots = {}
        self.lock = threading.Lock()

    def park(self, v):
        with self.lock:
            for size in Size:
                if size.value < v.size.value:
                    continue
                if self.free[size]:
                    sid = self.free[size].pop()
                    self.spots[sid].vehicle = v
                    return sid
            return None

    def leave(self, sid):
        with self.lock:
            s = self.spots[sid]
            s.vehicle = None
            self.free[s.size].add(sid)`,
        highlight: [8, 10, 20, 21],
      },
    },
    {
      title: 'Lock cost',
      tag: 'tradeoff',
      heading: 'How big should the lock be?',
      eli5: 'One guard for all three baskets is simple but makes every toy line up. One guard per basket lets small, medium and large toys move at the same time, but guards must not fight.',
      body: [
        'A single lock is simple and correct. It serializes every park and leave, which is fine here: each critical section is a few dictionary operations, so a car holds the lock for microseconds.',
        'You could use one lock per size. That adds a deadlock risk when a car falls back to a bigger size and needs two locks. Start coarse, measure, and split only if the lock shows up as the bottleneck.',
      ],
      keyIdea: 'Keep the locked section short and start with one lock. Finer locks buy parallelism and cost simplicity.',
      metrics: { classes: '7', find: 'O(1)', safe: 'yes', pricing: 'none' },
      metricTones: { find: 'good', safe: 'good' },
      scene: {
        nodes: [
          { id: 'one', kind: 'block', at: at(-3.8, -3.4), label: 'One lock', sub: 'simple, correct', icon: 'Lock', tint: 'green', status: 'ok' },
          { id: 'many', kind: 'block', at: at(3.8, -3.4), label: 'Lock per size', sub: 'more parallel', icon: 'Lock', tint: 'amber' },
          { id: 'dead', kind: 'block', at: at(3.8, 3.4), label: 'Deadlock risk', sub: 'two locks at once', icon: 'TriangleAlert', tint: 'red', status: 'hot' },
        ],
        links: [link('many', 'dead', 'can cause', { labelTone: 'warn' })],
        panel: {
          title: 'Choosing',
          icon: 'Scale',
          rows: [
            { text: 'One lock', value: 'simple', tone: 'good' },
            { text: 'Lock held', value: 'microseconds', tone: 'good' },
            { text: 'Lock per size', value: 'faster, riskier', tone: 'warn' },
            { text: 'Fallback to bigger size', value: 'needs 2 locks', tone: 'bad' },
          ],
          footer: { text: 'Measure before you split the lock', tone: 'muted' },
        },
        caption: 'Correct first, parallel later',
      },
    },
    {
      title: 'Pricing pain',
      tag: 'case',
      heading: 'Pain: pricing is hardcoded in the lot',
      eli5: 'The garage guard keeps the fee rules in his head. Now the owner wants a weekend price, a cheaper price for electric toys and a monthly pass, and the guard keeps getting confused.',
      body: [
        'The first fee is flat per hour, written inside the lot. Then the business asks for a weekend surge, an EV discount and monthly passes. Each one adds an `if` to the same method.',
        'Pricing changes monthly. Parking logic changes rarely. They should not live in the same class or be edited together.',
      ],
      keyIdea: 'When one part of the system changes much more often than the rest, pull it out behind an interface.',
      metrics: { classes: '7', find: 'O(1)', safe: 'yes', pricing: 'hardcoded' },
      metricTones: { pricing: 'bad' },
      scene: {
        nodes: [
          { ...lot, status: 'hot', chips: [{ text: 'if weekend', tone: 'warn' }, { text: 'if EV', tone: 'warn' }, { text: 'if monthly pass', tone: 'warn' }] },
          { id: 'biz', kind: 'block', at: at(-3.8, 3.4), label: 'Business', sub: 'new rule every month', icon: 'Briefcase', tint: 'gray' },
        ],
        links: [link('biz', 'lot', 'edits', { labelTone: 'warn' })],
        flows: [{ path: ['biz', 'lot'], tone: 'request', label: 'add rule', duration: 1.6 }],
        panel: {
          title: 'Rules asked for',
          icon: 'ListChecks',
          rows: [
            { text: 'Weekday flat rate', value: 'done' },
            { text: 'Weekend surge', value: 'x1.5', tone: 'warn' },
            { text: 'EV discount', value: '-20%', tone: 'warn' },
            { text: 'Monthly pass', value: 'free', tone: 'warn' },
          ],
        },
        caption: 'Every new rule edits the lot',
      },
    },
    {
      title: 'Strategy',
      tag: 'concept',
      heading: 'v6: Strategy pattern for pricing',
      eli5: 'The guard no longer remembers prices. He holds a card that says how to charge, and the owner can swap the card without touching the guard.',
      body: [
        '`PricingStrategy` is an **interface** with one method, `price(vehicle, entry, exit)`. `FlatHourly` and `WeekendSurge` **implement** it. The lot **has-a** strategy and calls it at checkout.',
        'A new rule is a new class, and the lot code does not change. That is the open/closed idea: open to new pricing, closed to edits.',
      ],
      keyIdea: 'Strategy puts one family of interchangeable rules behind an interface, so the caller never knows which one it uses.',
      metrics: { classes: '10', find: 'O(1)', safe: 'yes', pricing: 'pluggable' },
      metricTones: { classes: 'good', pricing: 'good' },
      scene: {
        nodes: [
          { ...lot, at: at(3.8, -3.4) },
          { ...pricing, at: at(-3.8, -3.4) },
          { id: 'flat', kind: 'block', size: 0.72, at: at(-5.4, 3.4), label: 'FlatHourly', sub: 'concrete', icon: 'Clock', tint: 'green' },
          { id: 'surge', kind: 'block', size: 0.72, at: at(-1.6, 3.4), label: 'WeekendSurge', sub: 'concrete', icon: 'CalendarDays', tint: 'green' },
        ],
        links: [link('lot', 'pricing', 'has-a'), link('flat', 'pricing', 'implements'), link('surge', 'pricing', 'implements')],
        flows: [{ path: ['lot', 'pricing'], tone: 'request', label: 'price(v, in, out)', duration: 1.8 }],
        panel: {
          title: 'PricingStrategy',
          icon: 'Code',
          code: 'class PricingStrategy(ABC):\n  @abstractmethod\n  def price(self, v, entry, exit): ...\n\nclass FlatHourly(PricingStrategy):\n  def __init__(self, rate):\n    self.rate = rate',
        },
        caption: 'Same call, interchangeable rules',
      },
      code: {
        language: 'python',
        title: 'v6: pricing behind an interface',
        source: `from abc import ABC, abstractmethod
from math import ceil

class PricingStrategy(ABC):
    @abstractmethod
    def price(self, vehicle, entry, exit): ...

def hours(entry, exit):
    return max(1, ceil((exit - entry).total_seconds() / 3600))

class FlatHourly(PricingStrategy):
    def __init__(self, rate): self.rate = rate
    def price(self, v, entry, exit):
        return hours(entry, exit) * self.rate

class WeekendSurge(PricingStrategy):
    def price(self, v, entry, exit):
        base = 50 if v.size == Size.LARGE else 30
        if entry.weekday() >= 5:
            base *= 1.5
        return hours(entry, exit) * base`,
        highlight: [4, 5, 6, 12, 16],
      },
    },
    {
      title: 'Ticket',
      tag: 'concept',
      heading: 'Ticket: the record that ties entry to exit',
      eli5: 'At the door each toy gets a paper ticket with the time it went in. When it leaves, the guard reads the ticket to work out the fee.',
      body: [
        'Pricing needs the entry time and the vehicle. A `Ticket` stores the vehicle, the spot id and the entry time. `park` creates it and the lot keeps it by spot id.',
        '`checkout(sid, exit_time)` removes the ticket, frees the spot and returns the price from the strategy. Creating a ticket is the only place that reads the clock for entry.',
      ],
      keyIdea: 'A small record object carries the facts that two later steps need, so neither has to look anything up.',
      metrics: { classes: '11', find: 'O(1)', safe: 'yes', pricing: 'pluggable' },
      metricTones: { safe: 'good', pricing: 'good' },
      scene: {
        nodes: [
          { ...lot, at: at(0, -3.4) },
          { id: 'ticket', kind: 'block', at: at(-3.8, 0.4), label: 'Ticket', sub: 'vehicle, spot, entry', icon: 'Ticket', tint: 'green' },
          { ...pricing, at: at(3.8, 0.4) },
        ],
        links: [link('lot', 'ticket', 'creates'), link('lot', 'pricing', 'uses')],
        flows: [
          { path: ['lot', 'ticket'], tone: 'request', label: 'Ticket(v, sid, now)', duration: 1.5 },
          { path: ['lot', 'pricing'], tone: 'request', label: 'price(v, in, out)', duration: 1.5, delay: 1.6 },
          { path: ['pricing', 'lot'], tone: 'response', label: '90.0', duration: 1.5, delay: 3.2 },
        ],
        panel: {
          title: 'checkout',
          icon: 'Code',
          code: 'def checkout(self, sid, out):\n  with self.lock:\n    t = self.tickets.pop(sid)\n    s = self.spots[sid]\n    s.vehicle = None\n    self.free[s.size].add(sid)\n  return self.pricing.price(\n    t.vehicle, t.entry, out)',
        },
        caption: 'Entry time rides on the ticket',
      },
      code: {
        language: 'python',
        title: 'Ticket and checkout',
        source: `from dataclasses import dataclass
from datetime import datetime

@dataclass
class Ticket:
    vehicle: Vehicle
    spot_id: int
    entry: datetime

class ParkingLot:
    def __init__(self, pricing: PricingStrategy):
        self.pricing = pricing
        self.tickets = {}        # spot id -> Ticket
        # free, spots and lock as in v5

    def checkout(self, sid, out: datetime):
        with self.lock:
            t = self.tickets.pop(sid)
            s = self.spots[sid]
            s.vehicle = None
            self.free[s.size].add(sid)
        return self.pricing.price(t.vehicle, t.entry, out)`,
        highlight: [11, 12, 16, 17, 21],
      },
    },
    {
      title: 'Full lifecycle',
      tag: 'case',
      heading: 'Case: one car from gate to gate',
      eli5: 'A car toy comes in, gets a slot and a ticket, plays for a while, then hands the ticket back and pays. Each helper does only its own small job.',
      body: [
        'Gate calls `park(car)`. The lot picks a spot under the lock, creates a `Ticket`, and returns the spot id. Hours later the gate calls `checkout(sid, now)`.',
        'The lot frees the spot, asks the strategy for the price, and returns it. Every class touched has exactly one job, which is the point of the split.',
      ],
      keyIdea: 'In a good design a request is a short chain of calls, and each object does one clearly named job.',
      metrics: { classes: '11', find: 'O(1)', safe: 'yes', pricing: 'pluggable' },
      metricTones: { find: 'good', safe: 'good', pricing: 'good' },
      scene: {
        nodes: [
          { id: 'gate', kind: 'block', size: 0.72, at: at(-4.2, -3.4), label: 'Gate', sub: 'external system', icon: 'DoorOpen', tint: 'gray' },
          { ...lot, at: at(0, -3.4) },
          { ...spot, size: 0.72, at: at(4.2, -3.4), sub: 'id 2, MEDIUM' },
          { id: 'ticket', kind: 'block', size: 0.72, at: at(-2.1, 3.4), label: 'Ticket', sub: 'entry 09:00', icon: 'Ticket', tint: 'green' },
          { ...pricing, size: 0.72, at: at(2.1, 3.4) },
        ],
        links: [link('gate', 'lot', 'uses'), link('lot', 'spot', 'uses'), link('lot', 'ticket', 'creates'), link('lot', 'pricing', 'uses')],
        flows: [
          { path: ['gate', 'lot', 'spot'], tone: 'request', label: 'park(car)', duration: 1.8 },
          { path: ['lot', 'ticket'], tone: 'request', label: 'Ticket()', duration: 1.2, delay: 1.9 },
          { path: ['gate', 'lot', 'pricing'], tone: 'event', label: 'checkout(2)', duration: 1.8, delay: 3.2 },
        ],
        panel: {
          title: 'Sequence',
          icon: 'ListOrdered',
          rows: [
            { text: '1. park(car)', value: 'spot 2' },
            { text: '2. Ticket(car, 2, 09:00)', value: 'stored' },
            { text: '3. checkout(2, 12:00)', value: 'frees spot' },
            { text: '4. price(...)', value: '3 h x 30 = 90', tone: 'good' },
          ],
        },
        caption: 'Park, ticket, checkout, price',
      },
    },
    {
      title: 'Edge cases',
      tag: 'tradeoff',
      heading: 'Edge cases and extensions',
      eli5: 'What if the garage is full, or a toy hands back a ticket for a slot that is empty? A good garage answers clearly instead of crashing, and new kinds of slots should be easy to add.',
      body: [
        'Decide what `park` returns when the lot is full: `None`, or a `LotFullError`. Make `leave` and `checkout` reject an unknown spot id instead of corrupting the sets.',
        'Extensions each map to one class. EV charging is a new `Spot` subtype. Many gates are more threads, which the lock already covers. Per-floor display counts read the free sets.',
      ],
      keyIdea: 'Handle full, unknown and duplicate input on purpose, and check that each new feature lands in one class.',
      metrics: { classes: '12', find: 'O(1)', safe: 'yes', pricing: 'pluggable' },
      metricTones: { classes: 'good', find: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...lot },
          { id: 'ev', kind: 'block', at: at(3.8, -3.4), label: 'EVSpot', sub: 'extends Spot', icon: 'Zap', tint: 'green' },
          { ...spot, at: at(3.8, 3.4) },
          { id: 'err', kind: 'block', at: at(-3.8, 3.4), label: 'LotFullError', sub: 'raised when full', icon: 'CircleAlert', tint: 'red' },
        ],
        links: [link('ev', 'spot', 'extends'), link('lot', 'err', 'raises', { labelTone: 'warn' })],
        panel: {
          title: 'Where each change lands',
          icon: 'ListChecks',
          rows: [
            { text: 'Lot is full', value: 'LotFullError', tone: 'warn' },
            { text: 'Unknown spot id', value: 'KeyError', tone: 'warn' },
            { text: 'EV charging', value: 'new Spot subtype' },
            { text: 'New pricing rule', value: 'new Strategy' },
            { text: 'More gates', value: 'lock covers it', tone: 'good' },
          ],
        },
        caption: 'Each extension touches one class',
      },
    },
    {
      title: 'Pain to pattern',
      tag: 'tradeoff',
      heading: 'Each pain picked exactly one technique',
      eli5: 'We never added a rule until something went wrong. Each time a toy got stuck, we added one small helper to fix it and nothing more.',
      body: [
        'Every version fixed the pain of the last one and added nothing else. In an interview, say the pain out loud before you add the class. That shows why the design is shaped the way it is.',
        'Over-engineering is the opposite failure: a factory, a builder and a visitor before any pain exists. Patterns are answers, and you need the question first.',
      ],
      keyIdea: 'Name the pain, then pick the smallest technique that removes it.',
      metrics: { classes: '12', find: 'O(1)', safe: 'yes', pricing: 'pluggable' },
      metricTones: { classes: 'good', find: 'good', safe: 'good', pricing: 'good' },
      scene: {
        nodes: [
          { id: 'p', kind: 'block', at: at(-3.8, -3.4), label: 'Pain', sub: 'what broke', icon: 'CircleAlert', tint: 'red' },
          { id: 't', kind: 'block', at: at(3.8, -3.4), label: 'Technique', sub: 'smallest fix', icon: 'Wrench', tint: 'green' },
          { ...lot, at: at(0, 3.4), status: 'ok' },
        ],
        links: [link('p', 't', 'picks'), link('t', 'lot', 'shapes')],
        flows: [{ path: ['p', 't', 'lot'], tone: 'request', label: 'refactor', duration: 2 }],
        panel: {
          title: 'Pain and fix',
          icon: 'Table',
          rows: [
            { text: 'God class', value: 'split into classes' },
            { text: 'No size match', value: 'enum + inheritance' },
            { text: 'O(n) scan', value: 'hash map by size' },
            { text: 'Race condition', value: 'mutex lock' },
            { text: 'Pricing churn', value: 'Strategy' },
          ],
        },
        caption: 'One pain, one technique',
      },
      quiz: {
        question: 'Which pain is solved by the Strategy pattern in this lesson?',
        options: ['Two threads taking one spot', 'Pricing rules that change every month', 'A truck in a bike spot', 'Scanning 5,000 spots'],
        answer: 1,
        explain: 'Strategy hides interchangeable pricing rules behind one interface. The lock fixes the race, the enum fixes size matching, and the map fixes the scan.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: parking lot in six versions',
      eli5: 'The garage grew from one box into floors, slots, size stickers, key baskets, a guard and a fee card. Each part was added only when something went wrong.',
      body: [
        'Split nouns into classes, put size in the type, index free spots by size, lock the check-and-take, and put pricing behind an interface.',
        'A `Ticket` carries entry data to checkout. Handle full and unknown ids on purpose, and add features as new classes instead of new `if` branches.',
      ],
      keyIdea: 'Good low level design is a trail of small fixes, each one justified by a pain you can name.',
      metrics: { classes: '12', find: 'O(1)', safe: 'yes', pricing: 'pluggable' },
      metricTones: { classes: 'good', find: 'good', safe: 'good', pricing: 'good' },
      scene: {
        nodes: [
          { ...lot, status: 'ok' },
          { ...pricing, at: at(-3.8, 0) },
          { ...spot, at: at(3.8, 0) },
          { ...floor, at: at(0, 3.4) },
        ],
        links: [link('lot', 'floor', 'has-a'), link('floor', 'spot', 'has-a'), link('lot', 'pricing', 'has-a')],
        flows: [{ path: ['lot', 'floor', 'spot'], tone: 'request', label: 'park(v)', duration: 2 }],
        panel: {
          title: 'Final shape',
          icon: 'Boxes',
          rows: [
            { text: 'Vehicle + Bike, Car, Truck', value: 'size in type' },
            { text: 'Spot.fits()', value: 'rule on owner' },
            { text: 'free[size] map', value: 'O(1) find' },
            { text: 'Lock', value: 'no double take' },
            { text: 'PricingStrategy', value: 'swap rules' },
          ],
        },
        caption: 'Small classes, each with one job',
      },
      quiz: {
        question: 'Two gate threads both park a truck at the same instant and both get spot 5. What is the minimal fix?',
        options: ['Add more floors', 'Scan the spots again after parking', 'Run the check and the take under one lock', 'Make Spot a subclass of Vehicle'],
        answer: 2,
        explain: 'The bug is check-then-act on shared state. Putting both inside one lock makes them one atomic unit, and leave must take the same lock.',
      },
    },
  ],
};
