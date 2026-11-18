import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });

const rider: SceneNode = { id: 'rider', kind: 'block', at: at(-4, -3), label: 'Rider', sub: 'external', icon: 'User', tint: 'gray' };
const hall: SceneNode = { id: 'hall', kind: 'block', at: at(-4, -3.5), label: 'HallPanel', sub: 'concrete class', icon: 'Signal', tint: 'green' };
const dispatcher: SceneNode = { id: 'disp', kind: 'block', at: at(0, -3.5), label: 'Dispatcher', sub: 'concrete class', icon: 'Route', tint: 'green' };
const car: SceneNode = { id: 'car', kind: 'block', at: at(-4, -3), label: 'Elevator', sub: 'concrete class', icon: 'Layers', tint: 'green' };
const state: SceneNode = { id: 'state', kind: 'block', at: at(0, -3), label: 'ElevatorState', sub: 'interface', icon: 'Braces', tint: 'violet' };
const idle: SceneNode = { id: 'idle', kind: 'block', at: at(-4, 4), label: 'Idle', sub: 'concrete state', icon: 'Clock', tint: 'green' };
const up: SceneNode = { id: 'up', kind: 'block', at: at(0, 4), label: 'GoingUp', sub: 'concrete state', icon: 'TrendingUp', tint: 'green' };
const down: SceneNode = { id: 'down', kind: 'block', at: at(4, 4), label: 'GoingDown', sub: 'concrete state', icon: 'Download', tint: 'green' };
const observer: SceneNode = { id: 'obs', kind: 'block', at: at(0, -3), label: 'ElevatorObserver', sub: 'interface', icon: 'Rss', tint: 'violet' };

const carA: SceneNode = { id: 'carA', kind: 'block', size: 0.8, at: at(-4, 3.5), label: 'Car A', sub: 'floor 2, down', icon: 'Layers', tint: 'green' };
const carB: SceneNode = { id: 'carB', kind: 'block', size: 0.8, at: at(0, 3.5), label: 'Car B', sub: 'floor 6, up', icon: 'Layers', tint: 'green' };
const carC: SceneNode = { id: 'carC', kind: 'block', size: 0.8, at: at(4, 3.5), label: 'Car C', sub: 'floor 12, idle', icon: 'Layers', tint: 'green' };

export const lldElevator: Lesson = {
  id: 'lld-elevator',
  title: 'Elevator system',
  tagline: 'Design the classes behind a bank of elevators: a queue, SCAN scheduling, a dispatcher, states, doors, observers and safety.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'How to find the classes in the requirements: Building, Elevator, requests and Direction',
    'Why a FIFO queue zig-zags and how SCAN sweeps one direction at a time',
    'A Dispatcher that scores every car and picks the cheapest, with a swappable strategy',
    'The State pattern for Idle, GoingUp, GoingDown, DoorsOpen, Maintenance and Emergency',
    'Observers for displays and alarms, locks for concurrent button presses, and tick-driven tests',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'cars', label: 'Cars', icon: 'Layers' },
    { key: 'trip', label: 'Floors moved', icon: 'Route' },
    { key: 'safe', label: 'Safe', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Design an elevator system: what must it do?',
      eli5: 'A school has a tall building and a big **lift**. Kids press a button in the hall, the lift comes, and everybody argues about who goes first.',
      body: [
        'A 20 floor building has **4 elevators**. People press an **up** or **down** button in the hall, then pick a floor inside the car. Doors open, wait, and close.',
        'The code must decide which car answers each call, in what order a car visits floors, and what happens on an emergency stop or when a car is under maintenance.',
      ],
      keyIdea: 'List the behaviors first. The classes come from the nouns, the pain points from the verbs.',
      metrics: { classes: '0', cars: '4', trip: '?', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...rider, chips: ['press UP at floor 8'] },
          { id: 'buttons', kind: 'block', at: at(0, -3), label: 'Buttons', sub: 'hall and car', icon: 'Signal', tint: 'gray' },
          { id: 'cars', kind: 'block', at: at(4, -3), label: 'Elevators', sub: 'who answers?', icon: 'Layers', tint: 'gray', status: 'hot' },
        ],
        links: [link('rider', 'buttons', 'press'), link('buttons', 'cars', '?', { labelTone: 'warn' })],
        flows: [
          { path: ['rider', 'buttons'], tone: 'request', label: 'UP at 8', duration: 1.4 },
          { path: ['buttons', 'cars'], tone: 'request', label: 'who goes?', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Floors and cars', value: '20 and 4' },
            { text: 'Hall call', value: 'floor + up or down' },
            { text: 'Car call', value: 'floor inside the car' },
            { text: 'Doors', value: 'open, hold, close' },
            { text: 'Safety', value: 'emergency, maintenance', tone: 'warn' },
          ],
          footer: { text: 'Start with one car, add the rest as pain appears', tone: 'muted' },
        },
        caption: 'Who answers a call, and in what order?',
      },
    },
    {
      title: 'Find classes',
      tag: 'concept',
      heading: 'Nouns become classes, fixed choices become enums',
      eli5: 'Before building the lift, the class writes a list: the **building**, the lift, the little notes kids send, and the words up and down.',
      body: [
        'Read the requirements and underline nouns. A `Building` owns several `Elevator` objects. A button press is a **request** with a floor. Up and down are a fixed set, so they become a `Direction` enum.',
        'Start small: only `Elevator` and requests. Add `Building` and the rest when a real pain asks for them.',
      ],
      keyIdea: 'Nouns suggest classes. A value with a few fixed choices is an enum, not a string.',
      metrics: { classes: '4', cars: '1', trip: '-', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...car, at: at(0, -3.5), status: 'active' },
          { id: 'building', kind: 'block', at: at(-4, -3.5), label: 'Building', sub: 'concrete class', icon: 'Boxes', tint: 'green' },
          { id: 'req', kind: 'block', at: at(4, -3.5), label: 'Request', sub: 'data class', icon: 'Receipt', tint: 'green' },
          { id: 'dir', kind: 'block', at: at(4, 3.5), label: 'Direction', sub: 'enum', icon: 'Split', tint: 'amber' },
        ],
        links: [link('building', 'car', 'has-a'), link('car', 'req', 'handles'), link('req', 'dir', 'has-a')],
        panel: {
          title: 'Nouns to types',
          icon: 'Table',
          rows: [
            { text: 'Building, car', value: 'classes' },
            { text: 'Hall call, car call', value: 'data classes' },
            { text: 'Up, down', value: 'enum' },
          ],
          footer: { text: 'Add the rest only when needed', tone: 'muted' },
        },
        caption: 'The first sketch of the model',
      },
    },
    {
      title: 'v1 FIFO',
      tag: 'concept',
      heading: 'v1: one car, a queue of floors, first come first served',
      eli5: 'The lift keeps a list of floors in the order kids pressed. It always goes to the first one on the list, then the next.',
      body: [
        'The simplest `Elevator` holds a `floor` and a queue of requested floors. `request(f)` appends. `step()` moves one floor toward the head of the queue and pops it on arrival.',
        'Time is a `step()` call, one tick per floor. That keeps the logic easy to test, and we use the same idea in every later version.',
      ],
      keyIdea: 'Start with the dumbest thing that works, then let a measurable pain justify each new class.',
      metrics: { classes: '4', cars: '1', trip: '-', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...rider, chips: ['request(5)'] },
          { ...car, at: at(0, -3), status: 'active', label: 'Elevator', sub: 'floor 0' },
          { id: 'queue', kind: 'block', at: at(4, -3), label: 'queue', sub: 'deque of floors', icon: 'Inbox', tint: 'amber' },
        ],
        links: [link('rider', 'car', 'calls'), link('car', 'queue', 'has-a')],
        flows: [
          { path: ['rider', 'car'], tone: 'request', label: 'request(5)', duration: 1.4 },
          { path: ['car', 'queue'], tone: 'data', label: 'append', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'v1 behavior',
          icon: 'Workflow',
          rows: [
            { text: 'request(f)', value: 'append to queue' },
            { text: 'step()', value: 'move 1 floor to head' },
            { text: 'arrived', value: 'pop the head' },
          ],
        },
        caption: 'A queue and a floor counter',
      },
      code: {
        language: 'python',
        title: 'v1: FIFO elevator',
        source: `from collections import deque

class Elevator:
    def __init__(self):
        self.floor = 0
        self.queue = deque()

    def request(self, floor):
        self.queue.append(floor)

    def step(self):
        if not self.queue:
            return
        target = self.queue[0]
        if target == self.floor:
            self.queue.popleft()
            return
        self.floor += 1 if target > self.floor else -1`,
        highlight: [8, 9, 14, 18],
      },
    },
    {
      title: 'Zig-zag',
      tag: 'case',
      heading: 'Pain: first come first served zig-zags',
      eli5: 'Kids press floor 5, then 1, then 6. The lift runs up to 5, back down to 1, then up again, even though it passed floor 1 on the way.',
      body: [
        'Calls arrive as `[5, 1, 6]` and the car starts at floor 0. FIFO goes 0 to 5, 5 to 1, 1 to 6. That is **14 floors** of travel and riders at floor 1 wait while the car passes them.',
        'Visiting 1, then 5, then 6 covers the same stops in **6 floors**. The order of stops matters more than the speed of the motor.',
      ],
      keyIdea: 'The queue order is arrival order, but the cheapest order is geographic order.',
      metrics: { classes: '4', cars: '1', trip: '14 floors', safe: 'no' },
      metricTones: { trip: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...rider, chips: ['5', '1', '6'] },
          { ...car, at: at(0, -3), status: 'hot', load: 90, label: 'Elevator', sub: '0 to 5 to 1 to 6' },
          { id: 'queue', kind: 'block', at: at(4, -3), label: 'queue', sub: '[5, 1, 6]', icon: 'Inbox', tint: 'amber' },
        ],
        links: [link('rider', 'car', 'calls'), link('car', 'queue', 'has-a')],
        flows: [
          { path: ['car', 'queue', 'car'], tone: 'request', label: 'head = 5', duration: 1.8 },
          { path: ['car', 'queue', 'car'], tone: 'error', label: 'head = 1', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Same stops, two orders',
          icon: 'Route',
          rows: [
            { text: 'FIFO: 0, 5, 1, 6', value: '14 floors', tone: 'bad' },
            { text: 'Sorted: 0, 1, 5, 6', value: '6 floors', tone: 'good' },
          ],
          footer: { text: 'Passing a waiting rider is the worst case', tone: 'bad' },
        },
        caption: 'Arrival order is the wrong order',
      },
    },
    {
      title: 'SCAN',
      tag: 'concept',
      heading: 'v2: SCAN, sweep in one direction and serve stops on the way',
      eli5: 'A smart lift does not follow the list. It goes up and picks up everyone on the way, then turns around and comes down for the rest.',
      body: [
        '**SCAN** (the disk scheduling idea) keeps two sets of floors: `up` for stops above the car and `down` for stops below. The car keeps a `direction` and finishes its sweep before it reverses.',
        'Passing floor 1 on the way to 5 now serves floor 1. When the up set is empty, the car flips to down. When both are empty, it goes idle.',
      ],
      keyIdea: 'SCAN trades arrival order for fairness along a sweep, and it removes the zig-zag.',
      metrics: { classes: '4', cars: '1', trip: '6 floors', safe: 'no' },
      metricTones: { trip: 'good', safe: 'bad' },
      scene: {
        nodes: [
          { id: 'scan', kind: 'block', at: at(-4, -3.5), label: 'ScanElevator', sub: 'concrete class', icon: 'Layers', tint: 'green', status: 'active' },
          { id: 'upset', kind: 'block', at: at(0, -3.5), label: 'up set', sub: '{1, 5, 6}', icon: 'TrendingUp', tint: 'amber' },
          { id: 'downset', kind: 'block', at: at(4, -3.5), label: 'down set', sub: '{}', icon: 'Download', tint: 'amber', status: 'dim' },
          { id: 'dirn', kind: 'block', at: at(0, 3.5), label: 'direction', sub: '+1 up, -1 down, 0 idle', icon: 'Split', tint: 'amber' },
        ],
        links: [link('scan', 'upset', 'has-a'), link('scan', 'downset', 'has-a'), link('scan', 'dirn', 'has-a')],
        flows: [
          { path: ['scan', 'upset'], tone: 'request', label: 'stop at 1', duration: 1.2 },
          { path: ['scan', 'upset'], tone: 'request', label: 'stop at 5', duration: 1.2, delay: 1.3 },
          { path: ['scan', 'upset'], tone: 'request', label: 'stop at 6', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Sweep rules',
          icon: 'Route',
          rows: [
            { text: 'Floor above the car', value: 'up set' },
            { text: 'Floor below the car', value: 'down set' },
            { text: 'Sweep ends', value: 'reverse or idle' },
          ],
          footer: { text: '[5, 1, 6] now costs 6 floors', tone: 'good' },
        },
        caption: 'Two sets and a direction',
      },
    },
    {
      title: 'SCAN code',
      tag: 'case',
      heading: 'The SCAN car in 15 lines',
      eli5: 'Each tick the lift checks its two lists, picks a direction if it has none, moves one floor and crosses that floor off its list.',
      body: [
        '`request` routes a floor into the set on the correct side of the car. `step` picks a direction when idle, flips it when the current set is empty, then moves and discards the floor it reached.',
        'Notice the car has no door handling and one flag for direction. That small gap is where the next two pains come from.',
      ],
      keyIdea: 'Two sets and one direction replace a queue. The logic is a few lines, so test it before adding more.',
      metrics: { classes: '4', cars: '1', trip: '6 floors', safe: 'no' },
      metricTones: { trip: 'good', safe: 'bad' },
      scene: {
        nodes: [
          { id: 'scan', kind: 'block', at: at(-4, -3.5), label: 'ScanElevator', sub: 'floor 5, going up', icon: 'Layers', tint: 'green', status: 'active', badge: 'floor 5' },
          { id: 'upset', kind: 'block', at: at(0, -3.5), label: 'up set', sub: '{6}', icon: 'TrendingUp', tint: 'amber' },
          { id: 'downset', kind: 'block', at: at(4, -3.5), label: 'down set', sub: '{}', icon: 'Download', tint: 'amber', status: 'dim' },
        ],
        links: [link('scan', 'upset', 'discard on arrival'), link('scan', 'downset', 'has-a')],
        flows: [
          { path: ['scan', 'upset', 'scan'], tone: 'data', label: 'discard(5)', duration: 1.8 },
        ],
        panel: {
          title: 'Trace for [5, 1, 6]',
          icon: 'Table',
          rows: [
            { text: 'tick 1', value: 'floor 1, stop' },
            { text: 'tick 5', value: 'floor 5, stop' },
            { text: 'tick 6', value: 'floor 6, stop' },
            { text: 'tick 7', value: 'up set empty, direction 0, idle' },
          ],
        },
        caption: 'A floor leaves the set when the car reaches it',
      },
      code: {
        language: 'python',
        title: 'v2: SCAN elevator',
        source: `class ScanElevator:
    def __init__(self):
        self.floor = 0
        self.direction = 0        # 1 up, -1 down, 0 idle
        self.up, self.down = set(), set()

    def request(self, floor):
        if floor > self.floor:
            self.up.add(floor)
        elif floor < self.floor:
            self.down.add(floor)

    def step(self):
        if self.direction == 0:
            self.direction = 1 if self.up else (-1 if self.down else 0)
        if self.direction == 1 and not self.up:
            self.direction = -1 if self.down else 0
        elif self.direction == -1 and not self.down:
            self.direction = 1 if self.up else 0
        if self.direction == 0:
            return
        self.floor += self.direction
        (self.up if self.direction == 1 else self.down).discard(self.floor)`,
        highlight: [8, 9, 10, 11, 16, 17, 22, 23],
      },
    },
    {
      title: 'Dispatcher',
      tag: 'concept',
      heading: 'v3: four cars need a dispatcher',
      eli5: 'The school now has four lifts. A teacher stands in the hall, hears every button press and tells exactly one lift to go.',
      body: [
        'If every hall button calls all cars, all four stop and three trips are wasted. A `Dispatcher` receives each **hall call**, asks every car how expensive the call would be, and hands it to the cheapest.',
        'The Dispatcher has-a list of `Elevator` objects and calls `request(floor)` on the winner. Cars know nothing about each other.',
      ],
      keyIdea: 'One object owns the decision of who answers. Cars stay simple and never coordinate directly.',
      metrics: { classes: '5', cars: '4', trip: '6 floors', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [hall, { ...dispatcher, status: 'active' }, carA, carB, carC],
        links: [
          link('hall', 'disp', 'hall call'),
          link('disp', 'carA', 'has-a', { style: 'faint' }),
          link('disp', 'carB', 'has-a'),
          link('disp', 'carC', 'has-a', { style: 'faint' }),
        ],
        flows: [
          { path: ['hall', 'disp'], tone: 'request', label: 'assign(8, UP)', duration: 1.3 },
          { path: ['disp', 'carB'], tone: 'request', label: 'request(8)', duration: 1.5, delay: 1.4 },
        ],
        panel: {
          title: 'One call, one car',
          icon: 'Route',
          rows: [
            { text: 'Hall call', value: 'floor 8, UP' },
            { text: 'Asks every car', value: 'cost()' },
            { text: 'Winner', value: 'Car B', tone: 'good' },
          ],
        },
        caption: 'The dispatcher picks one car (3 of 4 cars drawn)',
      },
      code: {
        language: 'python',
        title: 'v3: the dispatcher',
        source: `class Dispatcher:
    def __init__(self, cars):
        self.cars = cars

    def assign(self, floor, direction):
        car = min(self.cars, key=lambda c: cost(c, floor, direction))
        car.request(floor)
        return car`,
        highlight: [6, 7],
      },
    },
    {
      title: 'Scoring',
      tag: 'concept',
      heading: 'The cost function: distance plus a penalty for wrong direction',
      eli5: 'The teacher asks each lift how long it would take. A lift already heading your way says "two floors". One heading the other way says "after I finish my trip".',
      body: [
        'Idle car: the cost is the distance. A car moving the same way with the floor still ahead: also the distance. A car moving the other way must finish its sweep first, so add 500. A car that already passed the floor needs a full lap, so add 1000.',
        'The big constants are a simple lexicographic order: any on-the-way car beats any other car.',
      ],
      keyIdea: 'Encode what you prefer as numbers. The Dispatcher stays a one-line min().',
      metrics: { classes: '5', cars: '4', trip: '6 floors', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...hall, chips: ['floor 8, UP'] },
          { ...dispatcher, status: 'active' },
          { ...carA, chips: [{ text: 'cost 506', tone: 'bad' }] },
          { ...carB, status: 'ok', chips: [{ text: 'cost 2', tone: 'good' }] },
          { ...carC, chips: [{ text: 'cost 4' }] },
        ],
        links: [
          link('hall', 'disp'),
          link('disp', 'carA', 'cost?', { style: 'faint' }),
          link('disp', 'carB', 'cost?'),
          link('disp', 'carC', 'cost?', { style: 'faint' }),
        ],
        flows: [
          { path: ['disp', 'carB', 'disp'], tone: 'request', label: 'cost(8, UP)', duration: 1.8 },
          { path: ['disp', 'carB'], tone: 'response', label: 'assigned', duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'Cost for a call at floor 8, UP',
          icon: 'Gauge',
          rows: [
            { text: 'Car A, going down', value: '500 + 6', tone: 'bad' },
            { text: 'Car B, up, ahead', value: '2', tone: 'good' },
            { text: 'Car C, idle', value: '4' },
          ],
          footer: { text: 'Lowest cost wins', tone: 'good' },
        },
        caption: 'Car B is on its way and 2 floors short (3 of 4 cars drawn)',
      },
      code: {
        language: 'python',
        title: 'The cost function',
        source: `def cost(car, floor, direction):
    dist = abs(car.floor - floor)
    if car.direction == 0:
        return dist                    # idle: just the distance
    ahead = (floor - car.floor) * car.direction >= 0
    if car.direction == direction and ahead:
        return dist                    # on its current sweep
    if car.direction != direction:
        return 500 + dist              # finish this sweep first
    return 1000 + dist                 # already passed it`,
        highlight: [3, 4, 6, 7, 8, 9, 10],
      },
      quiz: {
        question: 'A hall call for floor 8 going UP arrives. Car A is at floor 2 going DOWN. Why does the cost function charge it an extra 500?',
        options: [
          'Car A is the oldest car in the building',
          'Car A must finish its downward sweep before it can come up to floor 8',
          'Car A has the most passengers inside',
          'Going down always costs more than going up',
        ],
        answer: 1,
        explain: 'A SCAN car does not reverse mid-sweep. A car going the wrong way answers last, so the penalty makes any on-the-way or idle car win first.',
      },
    },
    {
      title: 'Two call types',
      tag: 'concept',
      heading: 'Hall calls go to the dispatcher, car calls go straight to the car',
      eli5: 'A button in the hall says "I am on floor 8 and want to go up", so the teacher picks a lift. A button inside the lift just says "floor 12", so that lift obeys.',
      body: [
        'A **hall call** has a floor and a direction. A **car call** has only a floor, and it belongs to the car the rider is standing in. Different data, different routing. SCAN here serves by floor only, so the direction of a hall call is used for scoring, and a real car would keep per-direction stop sets.',
        'Model them as two small immutable data classes and a `Direction` enum. The hall panel talks to the Dispatcher. The car panel talks only to its own car.',
      ],
      keyIdea: 'Two kinds of input get two types, so the compiler and the reader both know where each one goes.',
      metrics: { classes: '7', cars: '4', trip: '6 floors', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          hall,
          { ...dispatcher, at: at(0, -3.5) },
          { id: 'carpanel', kind: 'block', at: at(-4, 3.5), label: 'CarPanel', sub: 'concrete class', icon: 'Table', tint: 'green' },
          { ...car, at: at(4, 0), status: 'active', label: 'Elevator', sub: 'Car B' },
        ],
        links: [
          link('hall', 'disp', 'HallCall'),
          link('disp', 'car', 'request'),
          link('carpanel', 'car', 'CarCall', { route: 'straight' }),
        ],
        flows: [
          { path: ['hall', 'disp', 'car'], tone: 'request', label: 'HallCall(8, UP)', duration: 2 },
          { path: ['carpanel', 'car'], tone: 'request', label: 'CarCall(12)', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Routing',
          icon: 'Split',
          rows: [
            { text: 'Hall button', value: 'dispatcher.assign()' },
            { text: 'Car button', value: 'car.request()' },
            { text: 'Direction', value: 'enum UP or DOWN' },
          ],
        },
        caption: 'Same car, two ways in',
      },
      code: {
        language: 'python',
        title: 'Requests and Direction',
        source: `from dataclasses import dataclass
from enum import IntEnum

class Direction(IntEnum):
    UP = 1
    DOWN = -1

@dataclass(frozen=True)
class HallCall:
    floor: int
    direction: Direction

@dataclass(frozen=True)
class CarCall:
    car_id: int
    floor: int`,
        highlight: [4, 5, 6, 9, 10, 11, 14, 15],
      },
    },
    {
      title: 'Flag soup',
      tag: 'problem',
      heading: 'Pain: a pile of flags and one giant step()',
      eli5: 'The lift has to remember lots of little yes or no things: is the door open, is it broken, is there an alarm. The helper keeps tripping over them.',
      body: [
        'Doors, maintenance and emergency arrive as booleans next to `direction`. Now `step()` is a tree of nested `if` checks, and four flags give 24 combinations, most of them nonsense.',
        'Can a car be moving with doors open? The flags allow it. A new rule such as a fire mode means editing every branch, so a small change breaks something far away.',
      ],
      keyIdea: 'Booleans that must never combine in some ways are a missing state machine.',
      metrics: { classes: '7', cars: '4', trip: '6 floors', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...car, at: at(-3, -3), status: 'hot', load: 92, chips: ['door_open', 'maintenance', 'emergency'] },
          { id: 'stepfn', kind: 'block', at: at(3, -3), label: 'step()', sub: 'one huge method', icon: 'Bug', tint: 'red', status: 'hot' },
          { id: 'flags', kind: 'block', at: at(0, 3), label: 'Flags', sub: '4 booleans, 24 combos', icon: 'Signal', tint: 'amber' },
        ],
        links: [link('car', 'stepfn', 'step()'), link('car', 'flags', 'has-a'), link('stepfn', 'flags', 'reads', { labelTone: 'warn' })],
        flows: [{ path: ['car', 'stepfn', 'flags'], tone: 'error', label: 'if if if', duration: 2 }],
        panel: {
          title: 'step() today',
          icon: 'Code',
          code: 'def step(self):\n  if self.emergency: return\n  if self.maintenance: return\n  if self.door_open:\n    ...\n  elif self.direction == 1:\n    ...  # more ifs',
          footer: { text: 'Every new rule touches every branch', tone: 'bad' },
        },
        caption: 'Flags multiply, clarity drops',
      },
    },
    {
      title: 'State pattern',
      tag: 'concept',
      heading: 'v4: the State pattern, one class per state',
      eli5: 'Instead of a pile of yes or no switches, the lift wears one **mood** at a time: resting, going up, or going down. Each mood knows what to do next.',
      body: [
        'Define an `ElevatorState` interface with `step(car)`. `Idle`, `GoingUp` and `GoingDown` **implement** it. The `Elevator` has-a current state and delegates `step()` to it.',
        'Each state decides its own next state through `car.set_state(...)`. Illegal combinations are gone because a car has exactly one state.',
      ],
      keyIdea: 'Replace flags with objects. A state owns its behavior and its legal transitions.',
      metrics: { classes: '11', cars: '4', trip: '6 floors', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [{ ...car, status: 'active' }, state, idle, up, down],
        links: [
          link('car', 'state', 'has-a'),
          link('idle', 'state', 'implements', { route: 'straight' }),
          link('up', 'state', 'implements'),
          link('down', 'state', 'implements', { route: 'straight' }),
        ],
        flows: [
          { path: ['car', 'state'], tone: 'request', label: 'step(car)', duration: 1.3 },
          { path: ['state', 'car'], tone: 'response', label: 'set_state()', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Transitions',
          icon: 'Workflow',
          rows: [
            { text: 'Idle', value: 'GoingUp or GoingDown' },
            { text: 'GoingUp', value: 'GoingDown or Idle' },
            { text: 'GoingDown', value: 'GoingUp or Idle' },
          ],
          footer: { text: 'One state at a time', tone: 'good' },
        },
        caption: 'The car delegates to its current state',
      },
    },
    {
      title: 'States in code',
      tag: 'case',
      heading: 'Idle and GoingUp as classes',
      eli5: 'Each mood is a little page of instructions. "Resting" says look at the lists. "Going up" says move up one floor and open the door when you arrive.',
      body: [
        '`Idle.step` looks at the two sets and chooses a sweep. `GoingUp.step` moves one floor, and when the floor is a stop it removes it and enters `DoorsOpen`. `GoingDown` is the mirror image.',
        'The car no longer contains a single direction check. The `if` chain became polymorphism.',
      ],
      keyIdea: 'Polymorphism moves the conditional from every caller into a single object choice.',
      metrics: { classes: '11', cars: '4', trip: '6 floors', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [car, state, { ...idle, status: 'dim' }, { ...up, status: 'active', chips: ['floor += 1'] }, { ...down, status: 'dim' }],
        links: [
          link('car', 'state', 'has-a'),
          link('idle', 'state', 'implements', { route: 'straight' }),
          link('up', 'state', 'implements'),
          link('down', 'state', 'implements', { route: 'straight' }),
        ],
        flows: [
          { path: ['car', 'up'], tone: 'request', label: 'step(car)', duration: 1.4 },
          { path: ['up', 'car'], tone: 'response', label: 'floor 6', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'GoingUp.step',
          icon: 'Code',
          code: 'move up one floor\nif floor in up set:\n  remove it\n  open the doors\nif up set empty:\n  switch sweep or idle',
        },
        caption: 'GoingUp is active, the rest wait',
      },
      code: {
        language: 'python',
        title: 'v4: states',
        source: `class State(ABC):
    in_service = True
    @abstractmethod
    def step(self, car): ...

class Idle(State):
    def step(self, car):
        if car.up:
            car.set_state(GoingUp())
        elif car.down:
            car.set_state(GoingDown())

class GoingUp(State):
    def step(self, car):
        if not car.up:
            car.set_state(GoingDown() if car.down else Idle())
            return
        car.floor += 1
        if car.floor in car.up:
            car.up.remove(car.floor)
            car.set_state(DoorsOpen(after=GoingUp()))`,
        highlight: [6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 19, 20],
      },
    },
    {
      title: 'Doors',
      tag: 'concept',
      heading: 'Doors are a state too: open, hold, then resume',
      eli5: 'When the lift arrives, it opens its door and waits a little. If someone is in the way, it waits longer. Then it goes on with its trip.',
      body: [
        '`DoorsOpen` remembers the state to resume (`after`) and holds for 3 ticks. A door sensor that sees a blocked doorway restarts the timer. An overweight car keeps the doors open.',
        'Because moving and open doors are different states, a car can never move with the doors open by accident.',
      ],
      keyIdea: 'A state can wrap the next state, so a pause never loses the trip in progress.',
      metrics: { classes: '12', cars: '4', trip: '6 floors', safe: 'doors' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...up, at: at(-4, -3), status: 'dim' },
          { id: 'doors', kind: 'block', at: at(0, -3), label: 'DoorsOpen', sub: 'hold 3 ticks', icon: 'Timer', tint: 'green', status: 'active' },
          { id: 'sensor', kind: 'block', at: at(4, -3), label: 'DoorSensor', sub: 'external', icon: 'Wifi', tint: 'gray' },
          { ...car, at: at(0, 3.5) },
        ],
        links: [link('up', 'doors', 'creates'), link('sensor', 'doors', 'blocked?'), link('car', 'doors', 'has-a', { route: 'straight' })],
        flows: [
          { path: ['up', 'doors'], tone: 'request', label: 'arrive(5)', duration: 1.3 },
          { path: ['sensor', 'doors'], tone: 'error', label: 'blocked', duration: 1.3, delay: 1.4 },
          { path: ['doors', 'up'], tone: 'response', label: 'resume', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'DoorsOpen rules',
          icon: 'Timer',
          rows: [
            { text: 'Hold time', value: '3 ticks' },
            { text: 'Doorway blocked', value: 'restart timer', tone: 'warn' },
            { text: 'Over weight', value: 'stay open', tone: 'warn' },
            { text: 'Timer done', value: 'resume trip', tone: 'good' },
          ],
        },
        caption: 'The door state wraps the trip it paused',
      },
      code: {
        language: 'python',
        title: 'DoorsOpen',
        source: `class DoorsOpen(State):
    HOLD = 3                       # ticks the doors stay open

    def __init__(self, after):
        self.after, self.left = after, self.HOLD

    def step(self, car):
        if car.door_sensor.blocked() or car.overweight():
            self.left = self.HOLD  # restart the timer
            return
        self.left -= 1
        if self.left == 0:
            car.set_state(self.after)`,
        highlight: [5, 8, 9, 10, 11, 12, 13],
      },
    },
    {
      title: 'Observer',
      tag: 'problem',
      heading: 'v5: displays and alarms must not live inside the car',
      eli5: 'The sign above the door shows the floor and a bell rings when something is wrong. The lift does not own the sign. It just shouts, and whoever is listening reacts.',
      body: [
        'Floor displays, a movement log and an alarm pager all care about what a car does. If `Elevator` calls each of them, every new listener means editing the car.',
        'The **Observer** pattern flips it. The car keeps a list of `ElevatorObserver` objects and calls `on_event(car, event)`. It never knows who is listening.',
      ],
      keyIdea: 'The core publishes events. Displays, logs and alarms subscribe without touching the core.',
      metrics: { classes: '15', cars: '4', trip: '6 floors', safe: 'doors' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...car, status: 'active' },
          observer,
          { id: 'display', kind: 'block', at: at(-4, 4), label: 'FloorDisplay', sub: 'concrete class', icon: 'Gauge', tint: 'green' },
          { id: 'alarm', kind: 'block', at: at(0, 4), label: 'AlarmNotifier', sub: 'concrete class', icon: 'Bug', tint: 'green' },
          { id: 'pager', kind: 'block', at: at(4, 4), label: 'Pager', sub: 'external', icon: 'Mail', tint: 'gray' },
        ],
        links: [
          link('car', 'obs', 'has-a many'),
          link('display', 'obs', 'implements', { route: 'straight' }),
          link('alarm', 'obs', 'implements'),
          link('alarm', 'pager', 'uses', { route: 'straight' }),
        ],
        flows: [
          { path: ['car', 'obs', 'display'], tone: 'event', label: 'on_event(moved)', duration: 1.8 },
          { path: ['car', 'obs', 'alarm'], tone: 'event', label: 'on_event(Emergency)', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Who listens',
          icon: 'Rss',
          rows: [
            { text: 'FloorDisplay', value: 'shows floor' },
            { text: 'AlarmNotifier', value: 'pages on-call' },
            { text: 'Next listener', value: 'no car edit', tone: 'good' },
          ],
        },
        caption: 'One event, many listeners',
      },
    },
    {
      title: 'Observer code',
      tag: 'case',
      heading: 'The car emits, observers react',
      eli5: 'The lift has a little list of friends. Whenever something happens, it tells each friend. One friend shows the number. Another rings the bell.',
      body: [
        '`step()` wraps the state call and emits `"moved"` when the floor changed. `set_state()` emits the new state name, such as `"DoorsOpen"` or `"Emergency"`.',
        'Observers run on the car, so keep them fast. A slow pager call belongs on a queue, as in the logger lesson.',
      ],
      keyIdea: 'Emit small named events. Let each observer pick the ones it cares about.',
      metrics: { classes: '15', cars: '4', trip: '6 floors', safe: 'doors' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...car, status: 'active', chips: ['floor 5'] },
          observer,
          { id: 'display', kind: 'block', at: at(-4, 4), label: 'FloorDisplay', sub: 'shows "5"', icon: 'Gauge', tint: 'green', status: 'ok' },
          { id: 'alarm', kind: 'block', at: at(4, 4), label: 'AlarmNotifier', sub: 'ignores "moved"', icon: 'Bug', tint: 'green', status: 'dim' },
        ],
        links: [
          link('car', 'obs', 'has-a many'),
          link('display', 'obs', 'implements', { route: 'straight' }),
          link('alarm', 'obs', 'implements', { route: 'straight' }),
        ],
        flows: [
          { path: ['car', 'obs'], tone: 'event', label: '_emit("moved")', duration: 1.3 },
          { path: ['obs', 'display'], tone: 'event', label: 'on_event', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Events emitted',
          icon: 'List',
          rows: [
            { text: 'moved', value: 'floor changed' },
            { text: 'DoorsOpen', value: 'stop reached' },
            { text: 'Emergency', value: 'brakes on', tone: 'bad' },
          ],
        },
        caption: 'Each observer filters for its own events',
      },
      code: {
        language: 'python',
        title: 'v5: observers',
        source: `class ElevatorObserver(ABC):
    @abstractmethod
    def on_event(self, car, event): ...

class Elevator:
    def subscribe(self, obs):
        self.observers.append(obs)

    def _emit(self, event):
        for obs in self.observers:
            obs.on_event(self, event)

    def set_state(self, state):
        self.state = state
        self._emit(type(state).__name__)

    def step(self):
        before = self.floor
        self.state.step(self)
        if self.floor != before:
            self._emit("moved")`,
        highlight: [6, 7, 9, 10, 11, 14, 16, 17, 18, 19, 20],
      },
    },
    {
      title: 'Safety',
      tag: 'case',
      heading: 'Emergency and maintenance take a car out of service',
      eli5: 'If a lift is broken or being fixed, a sign says "closed". The teacher stops sending kids to it, and the kids already waiting get sent to another lift.',
      body: [
        '`Emergency` and `Maintenance` are states with `in_service = False` and a `step()` that does nothing. The car stays frozen and keeps its doors as they are.',
        'The Dispatcher filters out cars that are not in service. Calls already queued on that car are drained and assigned again, so nobody waits for a car that will not come.',
      ],
      keyIdea: 'Safety is a state, not an exception path. The rest of the system checks one property.',
      metrics: { classes: '17', cars: '4', trip: '6 floors', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...dispatcher, at: at(-4, -3.5), status: 'active' },
          { ...car, at: at(0, -3.5), status: 'down', sub: 'out of service' },
          { id: 'emerg', kind: 'block', at: at(4, 3.5), label: 'Emergency', sub: 'concrete state', icon: 'Shield', tint: 'green', status: 'hot' },
          { id: 'maint', kind: 'block', at: at(-2, 3.5), label: 'Maintenance', sub: 'concrete state', icon: 'Clock', tint: 'green' },
        ],
        links: [
          link('disp', 'car', 'skips', { style: 'dashed', labelTone: 'warn' }),
          link('car', 'emerg', 'has-a'),
          link('car', 'maint', 'or has-a', { style: 'faint' }),
        ],
        flows: [
          { path: ['car', 'disp'], tone: 'error', label: 'drain calls', duration: 1.5 },
          { path: ['disp', 'car'], tone: 'request', label: 'reassign', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Which states accept calls',
          icon: 'Shield',
          rows: [
            { text: 'Idle, GoingUp, GoingDown', value: 'yes', tone: 'good' },
            { text: 'DoorsOpen', value: 'yes', tone: 'good' },
            { text: 'Emergency', value: 'no', tone: 'bad' },
            { text: 'Maintenance', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'A frozen car drops out of dispatch',
      },
      code: {
        language: 'python',
        title: 'Out-of-service states',
        source: `class Emergency(State):
    in_service = False
    def step(self, car):
        pass                       # brakes on, nothing moves

class Maintenance(State):
    in_service = False
    def step(self, car):
        pass

# Dispatcher.assign
live = [c for c in self.cars if c.state.in_service]

# Elevator
def enter_emergency(self):
    self.set_state(Emergency())
    pending = self.up | self.down
    self.up.clear(); self.down.clear()
    for f in pending:
        self.dispatcher.assign(f, ...)`,
        highlight: [2, 7, 12, 14, 15, 16, 17, 18, 19],
      },
      quiz: {
        question: 'Why is Emergency modeled as a state instead of a boolean flag on the car?',
        options: [
          'Booleans are slower than objects',
          'A state makes illegal combinations impossible and gives the Dispatcher one property to check',
          'Flags cannot be changed after the car is built',
          'The Observer pattern requires states',
        ],
        answer: 1,
        explain: 'With flags, a car could be moving with the emergency flag set. A state means exactly one thing is true, and in_service is the only question the Dispatcher has to ask.',
      },
    },
    {
      title: 'Strategy',
      tag: 'tradeoff',
      heading: 'The dispatch policy is a Strategy',
      eli5: 'The teacher has a rule book for choosing a lift. Today the rule is "nearest first". For a busy morning the school can swap the book for "top floors use lifts 3 and 4".',
      body: [
        'Nearest car is one policy. Zoning is another: cars 0 and 1 serve floors 1 to 10, cars 2 and 3 serve 11 to 20. Put the choice behind `DispatchStrategy.pick()` and give the Dispatcher a strategy.',
        'Adding a policy is a new class. The Dispatcher never changes, which is the open-closed principle in practice.',
      ],
      keyIdea: 'When a decision has several valid answers, make it an interface and inject the choice.',
      metrics: { classes: '20', cars: '4', trip: '6 floors', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...dispatcher, at: at(-4, -3), status: 'active' },
          { id: 'strategy', kind: 'block', at: at(0, -3), label: 'DispatchStrategy', sub: 'interface', icon: 'Braces', tint: 'violet' },
          { id: 'nearest', kind: 'block', at: at(-2, 4), label: 'NearestCar', sub: 'concrete class', icon: 'Route', tint: 'green' },
          { id: 'zone', kind: 'block', at: at(3, 4), label: 'ZoneStrategy', sub: 'concrete class', icon: 'Layers', tint: 'green' },
        ],
        links: [
          link('disp', 'strategy', 'has-a'),
          link('nearest', 'strategy', 'implements'),
          link('zone', 'strategy', 'implements'),
        ],
        flows: [
          { path: ['disp', 'strategy'], tone: 'request', label: 'pick(cars, 8, UP)', duration: 1.5 },
          { path: ['strategy', 'disp'], tone: 'response', label: 'Car B', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Policies',
          icon: 'Scale',
          rows: [
            { text: 'NearestCar', value: 'min cost()' },
            { text: 'ZoneStrategy', value: 'floors 1-10 or 11-20' },
            { text: 'Next policy', value: 'one new class', tone: 'good' },
          ],
        },
        caption: 'The Dispatcher is closed, policies are open',
      },
      code: {
        language: 'python',
        title: 'Strategy for dispatch',
        source: `class DispatchStrategy(ABC):
    @abstractmethod
    def pick(self, cars, floor, direction): ...

class NearestCar(DispatchStrategy):
    def pick(self, cars, floor, direction):
        return min(cars, key=lambda c: cost(c, floor, direction))

class ZoneStrategy(DispatchStrategy):
    def pick(self, cars, floor, direction):
        zone = 0 if floor <= 10 else 1
        pool = [c for c in cars if c.zone == zone] or cars
        return min(pool, key=lambda c: cost(c, floor, direction))`,
        highlight: [3, 6, 7, 10, 11, 12, 13],
      },
    },
    {
      title: 'Concurrency',
      tag: 'case',
      heading: 'Many button presses and one car loop share the same sets',
      eli5: 'Lots of kids press buttons while the lift is moving. If two hands write on the lift\'s list at once, the writing gets smudged. One pen at a time fixes it.',
      body: [
        'Buttons are pressed on request threads. Each car runs its own loop calling `step()`. Both touch the `up` and `down` sets, so a `request` during a `step` can corrupt or lose a stop.',
        'Give each car one **lock** and hold it in `request` and `step`. Per-car locks keep four cars from blocking each other. Use `RLock`, since a state may call back into the car.',
      ],
      keyIdea: 'Shared mutable state needs one guard. Make it fine-grained: one lock per car, never one for the building.',
      metrics: { classes: '20', cars: '4', trip: '6 floors', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 'lock', kind: 'vault', at: at(0, -5), label: 'RLock', sub: 'one per car' },
          { id: 'btn', kind: 'worker', at: at(-4, -1), label: 'Button thread', sub: 'request(12)', load: 78, status: 'active' },
          { id: 'loop', kind: 'worker', at: at(4, -1), label: 'Car loop', sub: 'step() each tick', load: 64, status: 'active' },
          { id: 'sets', kind: 'block', at: at(0, 4), label: 'up and down sets', sub: 'shared state', icon: 'Database', tint: 'amber', status: 'hot' },
        ],
        links: [
          link('btn', 'lock', 'acquire'),
          link('loop', 'lock', 'acquire'),
          link('lock', 'sets', 'guards', { route: 'straight' }),
        ],
        flows: [
          { path: ['btn', 'lock', 'sets'], tone: 'request', label: 'request()', duration: 1.8 },
          { path: ['loop', 'lock', 'sets'], tone: 'request', label: 'step()', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Locking',
          icon: 'KeyRound',
          rows: [
            { text: 'Without lock', value: 'lost stop', tone: 'bad' },
            { text: 'One global lock', value: 'cars wait on cars', tone: 'warn' },
            { text: 'One lock per car', value: 'only same-car waits', tone: 'good' },
          ],
        },
        caption: 'Two threads, one guarded set',
      },
      code: {
        language: 'python',
        title: 'Per-car lock',
        source: `class Elevator:
    def __init__(self, car_id):
        self._lock = threading.RLock()
        self.id = car_id

    def request(self, floor):
        with self._lock:
            ...                    # add to up or down

    def step(self):
        with self._lock:
            before = self.floor
            self.state.step(self)
            if self.floor != before:
                self._emit("moved")`,
        highlight: [3, 7, 11],
      },
    },
    {
      title: 'Testing',
      tag: 'case',
      heading: 'Tick-driven design makes the elevator testable',
      eli5: 'To check the lift works, the teacher claps once per floor. No waiting in real time. After enough claps, we look where the lift stopped.',
      body: [
        'There is no `sleep` anywhere. A `step()` is one tick, so a test calls it in a loop and runs 30 ticks in a millisecond. A spy observer records which floors opened their doors.',
        'The same trick tests the Dispatcher: build three stub cars with set positions and assert which one `assign` picks.',
      ],
      keyIdea: 'Inject time as a tick and observers as spies, and the whole system runs deterministically in a unit test.',
      metrics: { classes: '20', cars: '4', trip: '6 floors', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 'test', kind: 'block', at: at(-4, -3), label: 'pytest', sub: 'drives ticks', icon: 'Bug', tint: 'gray' },
          { ...car, at: at(0, -3), status: 'active' },
          { id: 'spy', kind: 'block', at: at(4, -3), label: 'SpyObserver', sub: 'records stops', icon: 'Rss', tint: 'green' },
        ],
        links: [link('test', 'car', 'step() x 30'), link('car', 'spy', 'on_event')],
        flows: [
          { path: ['test', 'car'], tone: 'request', label: 'step()', count: 3, duration: 1.4 },
          { path: ['car', 'spy'], tone: 'event', label: 'DoorsOpen at 1', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Assertion',
          icon: 'Table',
          rows: [
            { text: 'Requests', value: '5, 1, 6' },
            { text: 'Ticks run', value: '30' },
            { text: 'Doors opened at', value: '1, 5, 6', tone: 'good' },
          ],
        },
        caption: 'No sleeps, no threads, same result every run',
      },
      code: {
        language: 'python',
        title: 'A SCAN test',
        source: `class SpyObserver(ElevatorObserver):
    def __init__(self):
        self.stops = []

    def on_event(self, car, event):
        if event == "DoorsOpen":
            self.stops.append(car.floor)

def test_scan_serves_stops_in_floor_order():
    car, spy = Elevator(car_id=0), SpyObserver()
    car.subscribe(spy)
    for f in (5, 1, 6):
        car.request(f)
    for _ in range(30):
        car.step()
    assert spy.stops == [1, 5, 6]`,
        highlight: [5, 6, 7, 14, 15, 16],
      },
    },
    {
      title: 'Full design',
      tag: 'concept',
      heading: 'The final class diagram',
      eli5: 'Now the whole school is set up: a teacher with a rule book, lifts that wear one mood at a time, and signs that listen to each lift.',
      body: [
        '`Building` owns the `Dispatcher` and the cars. The Dispatcher uses a `DispatchStrategy`. Each `Elevator` has one `ElevatorState` and many observers.',
        'Three interfaces give three extension points: new policies, new states and new listeners. Existing classes do not change.',
      ],
      keyIdea: 'Three small interfaces carry the design. Each one removes an if chain from a class that would otherwise keep growing.',
      metrics: { classes: '20', cars: '4', trip: '6 floors', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...dispatcher, at: at(-3, -4), sub: 'owned by Building' },
          { id: 'strategy', kind: 'block', at: at(2, -4), label: 'DispatchStrategy', sub: 'interface', icon: 'Braces', tint: 'violet' },
          { ...car, at: at(-1, 2), status: 'active' },
          { ...state, id: 'state', at: at(-5, 5) },
          { ...observer, at: at(5, 5) },
        ],
        links: [
          link('disp', 'strategy', 'uses'),
          link('disp', 'car', 'assigns'),
          link('car', 'state', 'has-a'),
          link('car', 'obs', 'notifies'),
        ],
        panel: {
          title: 'Extension points',
          icon: 'Layers',
          rows: [
            { text: 'DispatchStrategy', value: 'new policy' },
            { text: 'ElevatorState', value: 'new mode' },
            { text: 'ElevatorObserver', value: 'new listener' },
          ],
          footer: { text: 'Open for extension, closed for edits', tone: 'good' },
        },
        caption: 'Three interfaces, one stable core',
      },
    },
    {
      title: 'Limits',
      tag: 'tradeoff',
      heading: 'Where this design stops, and what real buildings add',
      eli5: 'A school lift is fine for one class. A giant tower at rush hour needs the riders to say their floor first, so the lifts can group them.',
      body: [
        '**Starvation**: nearest-car can ignore a far floor forever, while SCAN bounds the wait to one sweep. **Up-peak** in the morning sends everyone from the lobby, so cars should park there.',
        '**Destination dispatch** has riders enter their floor in the hall, and the dispatcher groups riders per car. It changes the request type, but the state and observer design stays.',
      ],
      keyIdea: 'Scheduling policy is the part that changes most. Keep it behind an interface and measure wait time, not just distance.',
      metrics: { classes: '20', cars: '4', trip: '6 floors', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...dispatcher, at: at(0, -3), status: 'active' },
          { id: 'dd', kind: 'block', at: at(-4, 3.5), label: 'Destination', sub: 'riders pick floor in hall', icon: 'Users', tint: 'amber' },
          { id: 'peak', kind: 'block', at: at(0, 3.5), label: 'Up-peak', sub: 'park cars at lobby', icon: 'TrendingUp', tint: 'amber' },
          { id: 'age', kind: 'block', at: at(4, 3.5), label: 'Aging', sub: 'raise priority with wait', icon: 'Clock', tint: 'amber' },
        ],
        links: [link('disp', 'dd', 'could use'), link('disp', 'peak', 'could use'), link('disp', 'age', 'could use')],
        panel: {
          title: 'Policy trade-offs',
          icon: 'Scale',
          rows: [
            { text: 'Nearest car', value: 'low wait, can starve', tone: 'warn' },
            { text: 'SCAN', value: 'fair, longer trips' },
            { text: 'Destination', value: 'best throughput', tone: 'good' },
            { text: 'Zoning', value: 'fewer stops per car' },
          ],
        },
        caption: 'The policy slot is where improvements land',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: one pain at a time, one pattern at a time',
      eli5: 'We built the school lift in steps. First a list, then a sweep, then a teacher for many lifts, then moods, signs and a rule book.',
      body: [
        'FIFO zig-zags, so SCAN sweeps. Many cars need a Dispatcher with a cost function. Flags became State classes, listeners became Observers and the policy became a Strategy.',
        'Per-car locks guard shared sets, and tick-driven steps keep tests fast and exact.',
      ],
      keyIdea: 'Start naive, name the pain, then add the smallest pattern that removes it.',
      metrics: { classes: '20', cars: '4', trip: '6 floors', safe: 'yes' },
      metricTones: { trip: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...dispatcher, at: at(-4, -3), status: 'ok' },
          { ...car, at: at(0, -3), status: 'ok' },
          { ...state, id: 'state', at: at(4, -3), status: 'ok' },
          { ...observer, at: at(0, 3.5), status: 'ok' },
        ],
        links: [link('disp', 'car', 'assigns'), link('car', 'state', 'has-a'), link('car', 'obs', 'notifies')],
        flows: [
          { path: ['disp', 'car'], tone: 'request', label: 'request(8)', duration: 1.3 },
          { path: ['car', 'state'], tone: 'request', label: 'step(car)', duration: 1.3, delay: 1.4 },
          { path: ['car', 'obs'], tone: 'event', label: 'moved', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Pain to fix',
          icon: 'Table',
          rows: [
            { text: 'Zig-zag', value: 'SCAN' },
            { text: 'Many cars', value: 'Dispatcher + cost' },
            { text: 'Flag soup', value: 'State' },
            { text: 'Coupled displays', value: 'Observer' },
            { text: 'Fixed policy', value: 'Strategy' },
          ],
        },
        caption: 'Each class exists because a pain asked for it',
      },
      quiz: {
        question: 'A new building wants a fire mode where every car returns to the lobby and ignores calls. Which change fits this design best?',
        options: [
          'Add a boolean fire_mode to Elevator and check it in every branch',
          'Add a FireRecall state with in_service = False and a step() that heads to the lobby',
          'Make the Dispatcher check the building alarm before every call',
          'Create a second Elevator class for fire mode',
        ],
        answer: 1,
        explain: 'A new State class adds the behavior without editing existing states. The Dispatcher already skips cars that are not in service, so nothing else changes.',
      },
    },
  ],
};
