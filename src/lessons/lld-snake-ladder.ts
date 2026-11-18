import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Colors by role: violet = interface, blue = abstract class, green = concrete class, teal = enum, gray = plain data or outside code
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

const script = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('script', pos, 'script', 'one while loop', 'gray', 'FileCode', extra);
const diceRaw = (pos: [number, number] = TL, extra: Partial<SceneNode> = {}) => blk('diceRaw', pos, 'randint', 'fixed 1 to 6', 'gray', 'Zap', extra);
const snakesDict = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('snakesDict', pos, 'snakes', 'dict {17: 7}', 'gray', 'Braces', extra);
const laddersDict = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('laddersDict', pos, 'ladders', 'dict {3: 22}', 'gray', 'Braces', extra);

const game = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('game', pos, 'Game', 'the referee', 'green', 'Workflow', extra);
const board = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('board', pos, 'Board', '100 cells', 'green', 'Table', extra);
const cell = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('cell', pos, 'Cell', 'one square', 'green', 'Hash', extra);
const player = (pos: [number, number] = TL, extra: Partial<SceneNode> = {}) => blk('player', pos, 'Player', 'name, position', 'green', 'User', extra);
const jumperI = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('jumperI', pos, 'Jumper', 'abstract', 'blue', 'Route', extra);
const snake = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('snake', pos, 'Snake', 'end < start', 'green', 'Bug', extra);
const ladder = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('ladder', pos, 'Ladder', 'end > start', 'green', 'TrendingUp', extra);
const teleporter = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('teleporter', pos, 'Teleporter', 'any direction', 'green', 'Zap', extra);
const mystery = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('mystery', pos, 'MysteryBox', 'random end', 'green', 'Package', extra);
const diceI = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('diceI', pos, 'DiceStrategy', 'interface', 'violet', 'Plug', extra);
const fair = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('fair', pos, 'FairDice', 'one d6', 'green', 'Zap', extra);
const crooked = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('crooked', pos, 'CrookedDice', 'rolls 4 to 6', 'green', 'TrendingUp', extra);
const multi = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('multi', pos, 'MultipleDice', 'sum of n', 'green', 'Layers', extra);
const scripted = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('scripted', pos, 'ScriptedDice', 'for tests', 'green', 'List', extra);
const state = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('state', pos, 'GameState', 'enum', 'teal', 'Gauge', extra);
const turns = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('turns', pos, 'TurnManager', 'deque of players', 'green', 'Repeat', extra);
const result = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('result', pos, 'TurnResult', 'dataclass', 'green', 'Receipt', extra);
const caller = (pos: [number, number] = TL, extra: Partial<SceneNode> = {}) => blk('caller', pos, 'caller', 'main or a UI', 'gray', 'Laptop', extra);

export const lldSnakeLadder: Lesson = {
  id: 'lld-snake-ladder',
  title: 'Snake and ladder',
  tagline: 'A dice game where a dict of jumps grows into a board of cells, polymorphic jumpers, a dice strategy, a game state machine and a turn manager.',
  minutes: 17,
  level: 'Intermediate',
  learn: [
    'The simple script and the four things that break it: players, dice, jump behavior and game state',
    'Board, Cell and Player as the core objects, with an optional jumper on each cell',
    'Snake and Ladder as subclasses of one Jumper, and new jumper kinds with no change to Board',
    'Dice as a Strategy: fair, crooked, multiple and scripted dice for tests',
    'A game state machine and a TurnManager with a rotating queue',
    'Rules that bite: overshooting 100, extra turn on a 6, a bad board, and returning a result instead of printing',
  ],
  metrics: [
    { key: 'players', label: 'Players', icon: 'Users' },
    { key: 'dice', label: 'Dice', icon: 'Zap' },
    { key: 'jumpers', label: 'Jump types', icon: 'Route' },
    { key: 'state', label: 'Game state', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'The script',
      tag: 'problem',
      heading: 'Roll, move, jump: twelve lines that work',
      eli5: 'Two kids play on a cardboard **board** on the floor. They roll a die, move a token, and if the token lands on a picture of a snake or a ladder they slide along it.',
      body: [
        'Snake and ladder looks trivial. Roll a die, move a token, and if the new square starts a snake or a ladder, jump to its end. Whoever reaches square 100 first wins.',
        'The first version is a loop and two dicts. Snakes map head to tail, ladders map foot to top. It plays a full game.',
      ],
      keyIdea: 'Start with the simplest thing that plays a correct game, then ask what a follow-up question would break.',
      metrics: { players: '2 (hardcoded)', dice: 'd6', jumpers: 'dict keys', state: 'none' },
      scene: {
        nodes: [script(TM, { status: 'active' }), diceRaw(TL), snakesDict(BL), laddersDict(BR)],
        links: [link('script', 'diceRaw', { label: 'roll' }), link('script', 'snakesDict', { label: 'lookup' }), link('script', 'laddersDict', { label: 'lookup' })],
        flows: [
          { path: ['script', 'diceRaw'], tone: 'request', label: 'randint(1, 6)', duration: 1.2 },
          { path: ['diceRaw', 'script'], tone: 'response', label: '5', duration: 1.2, delay: 1.3 },
          { path: ['script', 'snakesDict'], tone: 'request', label: '17 in snakes?', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'The 4 rules',
          icon: 'List',
          rows: [
            { text: 'Board of 100 squares' },
            { text: 'Players take turns rolling' },
            { text: 'Snake head: slide down', value: '17 to 7' },
            { text: 'Ladder foot: climb up', value: '3 to 22' },
          ],
          footer: { text: 'First token on 100 wins', tone: 'muted' },
        },
        caption: 'A loop, a die and two dicts',
      },
      code: {
        language: 'python',
        title: 'v1: everything in one place',
        source: `snakes = {17: 7, 54: 34, 62: 19, 98: 79}
ladders = {3: 22, 8: 30, 28: 84, 80: 99}

pos = [0, 0]  # two players
turn = 0
while max(pos) < 100:
    pos[turn] += random.randint(1, 6)
    pos[turn] = snakes.get(pos[turn], pos[turn])
    pos[turn] = ladders.get(pos[turn], pos[turn])
    turn = 1 - turn`,
        highlight: [1, 2, 5, 7],
      },
    },
    {
      title: 'Four pains',
      tag: 'problem',
      heading: 'Where the script breaks',
      eli5: 'The kids want a third friend to play, a loaded die for a prank, and a magic square that does something odd. The cardboard board has no room for any of that.',
      body: [
        'The follow-ups arrive fast. "Make it 3 players." "Use two dice." "Add a square that teleports you." "Tell me who won and when someone got bitten."',
        'Each one hits a different weak spot: two players baked into `1 - turn`, a dice call buried in the loop, jumps stored as plain dict entries with no behavior, and no record of the game state.',
      ],
      keyIdea: 'A design is judged by how it takes the next follow-up. Four follow-ups here need four different seams.',
      metrics: { players: '2 (hardcoded)', dice: 'd6 (fixed)', jumpers: 'dict keys', state: 'none' },
      metricTones: { players: 'bad', dice: 'bad', jumpers: 'bad', state: 'bad' },
      scene: {
        nodes: [script(TM, { status: 'hot', badge: '4 follow-ups' }), diceRaw(TL, { chips: [{ text: 'fixed d6', tone: 'bad' }] }), snakesDict(BL, { chips: [{ text: '17: 7', tone: 'warn' }] }), laddersDict(BR, { chips: [{ text: '3: 22', tone: 'warn' }] })],
        links: [link('script', 'diceRaw'), link('script', 'snakesDict'), link('script', 'laddersDict')],
        flows: [{ path: ['script', 'snakesDict'], tone: 'error', label: 'custom effect?', duration: 1.4 }],
        panel: {
          title: 'What breaks',
          icon: 'Bug',
          rows: [
            { text: '3 players', value: '1 - turn', tone: 'bad' },
            { text: 'Two dice', value: 'randint call', tone: 'bad' },
            { text: 'Teleport square', value: 'dict is data', tone: 'bad' },
            { text: 'Who won, who got bitten', value: 'no state', tone: 'bad' },
          ],
        },
        caption: 'Four follow-ups, four weak spots',
      },
    },
    {
      title: 'The nouns',
      tag: 'concept',
      heading: 'Nouns in the prompt become classes',
      eli5: 'Look at the floor game. There is a **board**, tokens that belong to kids, a die, pictures of snakes and ladders, and one grown-up keeping the rules. Each of those is a class.',
      body: [
        '**Game** owns turn order and the result. **Board** owns the squares. **Player** owns a name and a position. **Dice** produces a number. **Jumper** is the snake or ladder printed on a square.',
        'Keep behavior with the data it changes. A jump moves a player, so the jump knows how. Game never asks "is this a snake?".',
      ],
      keyIdea: 'Game owns the rules, Board owns the squares, Player owns a position. Dice and jumps are the parts that vary.',
      metrics: { players: 'any', dice: 'one die', jumpers: 'Jumper', state: 'none' },
      scene: {
        nodes: [player(TL, { chips: ['position: 0'] }), game(TM, { status: 'active' }), blk('dice', TR, 'Dice', 'rolls a number', 'green', 'Zap'), board(BM), jumperI(BR, { size: 0.9 })],
        links: [link('game', 'player', { label: 'has-a' }), link('game', 'dice', { label: 'has-a' }), link('game', 'board', { label: 'has-a' }), link('board', 'jumperI', { label: 'has-a' })],
        flows: [
          { path: ['game', 'dice'], tone: 'request', label: 'roll()', duration: 1.2 },
          { path: ['dice', 'game'], tone: 'response', label: '4', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Who owns what',
          icon: 'Table',
          rows: [
            { text: 'Game', value: 'turns, result' },
            { text: 'Board', value: 'squares, jumpers' },
            { text: 'Player', value: 'name, position' },
            { text: 'Dice', value: 'a number' },
            { text: 'Jumper', value: 'move on landing' },
          ],
        },
        caption: 'One job per class',
      },
    },
    {
      title: 'Board and cell',
      tag: 'concept',
      heading: 'v2: a Board of Cells, with an optional jumper on each',
      eli5: 'The cardboard **board** is made of numbered squares. Some squares have a picture printed on them and most are blank. A token standing on a square can look at that square and see what it holds.',
      body: [
        'The board holds `size + 1` cells. Index 0 is the start, off the board, and index 100 is the finish. Each **Cell** has a number and a `jumper` that is `None` for a plain square.',
        'Putting the jumper on the cell turns the dict lookup into a field read. A player lands on cell 17 and the cell itself says what happens.',
      ],
      keyIdea: 'A Cell that carries its own optional jumper replaces two global dicts with one place that knows the square.',
      metrics: { players: 'any', dice: 'one die', jumpers: 'on the cell', state: 'none' },
      scene: {
        nodes: [player(TL, { chips: ['position: 0'] }), board(TM, { chips: ['cells[0..100]'] }), cell(BM, { chips: ['number: 17', 'jumper: None'] })],
        links: [link('board', 'cell', { label: 'has-a 101' }), link('player', 'board', { label: 'uses', style: 'dashed' })],
        flows: [
          { path: ['player', 'board'], tone: 'request', label: 'cells[17]', duration: 1.4 },
          { path: ['board', 'cell'], tone: 'request', label: 'cell 17', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Index 0 and 100',
          icon: 'Table',
          rows: [
            { text: 'cells[0]', value: 'start, off board' },
            { text: 'cells[1..99]', value: 'plain or jumper' },
            { text: 'cells[100]', value: 'finish' },
          ],
          footer: { text: 'size + 1 cells, so number == index', tone: 'muted' },
        },
        caption: 'The square knows what it holds',
      },
      code: {
        language: 'python',
        title: 'Cell, Board and Player',
        source: `class Cell:
    def __init__(self, number):
        self.number = number
        self.jumper = None  # a Jumper, or None

class Board:
    def __init__(self, size=100):
        self.size = size
        self.cells = [Cell(i) for i in range(size + 1)]

class Player:
    def __init__(self, name):
        self.name = name
        self.position = 0`,
        highlight: [4, 9],
      },
    },
    {
      title: 'Landing',
      tag: 'concept',
      heading: 'Landing on a cell is one lookup, then a call',
      eli5: 'A kid moves a token to square 17. The square has a snake drawn on it, so the kid follows the snake down. If the square is blank, the kid just stays put.',
      body: [
        'After the move, Game reads `board.cells[position]`. If the cell has a jumper, Game calls `jumper.traverse(player)` and moves on. If not, nothing happens.',
        'Indexing a list is O(1), the same cost as the dict. The win is the shape: Game has no `if snake` or `if ladder` branch anywhere.',
      ],
      keyIdea: 'Game asks the cell for its jumper and tells it to traverse. It never checks which kind of jumper it holds.',
      metrics: { players: 'any', dice: 'one die', jumpers: 'on the cell', state: 'none' },
      scene: {
        nodes: [player(TL, { chips: ['position: 17'] }), board(TM), cell(BM, { status: 'active', chips: ['number: 17'] }), snake(BR, { chips: ['17 to 7'] })],
        links: [link('player', 'board', { style: 'dashed' }), link('board', 'cell', { label: 'has-a' }), link('cell', 'snake', { label: 'has-a' })],
        flows: [
          { path: ['board', 'cell'], tone: 'request', label: 'cells[17]', duration: 1.2 },
          { path: ['cell', 'snake'], tone: 'request', label: 'traverse(player)', duration: 1.4, delay: 1.3 },
          { path: ['snake', 'player'], tone: 'response', label: 'position = 7', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'After the move',
          icon: 'Code',
          code: 'cell = board.cells[player.position]\nif cell.jumper:\n    cell.jumper.traverse(player)',
          footer: { text: 'No branch on snake or ladder', tone: 'good' },
        },
        caption: 'Lookup, then traverse',
      },
    },
    {
      title: 'Jumper',
      tag: 'concept',
      heading: 'v3: an abstract Jumper with a start and an end',
      eli5: 'Every picture on the board does the same kind of thing: take the token from one square to another. Snakes and ladders are two kinds of that one idea.',
      body: [
        'A snake and a ladder share their shape: a `start`, an `end`, and a way to move a player from one to the other. That shared part becomes an abstract base class, **Jumper**.',
        'The one abstract method is `traverse(player)`. Each subclass decides what happens when a player lands on its start.',
      ],
      keyIdea: 'What snakes and ladders share goes in Jumper. What differs goes in the subclass.',
      metrics: { players: 'any', dice: 'one die', jumpers: '1 abstract', state: 'none' },
      scene: {
        nodes: [jumperI(TM, { status: 'active', chips: ['start', 'end'] }), snake(BL), ladder(BR)],
        links: [link('snake', 'jumperI', { label: 'extends' }), link('ladder', 'jumperI', { label: 'extends' })],
        flows: [
          { path: ['jumperI', 'snake'], tone: 'request', label: 'traverse(p)', duration: 1.3 },
          { path: ['jumperI', 'ladder'], tone: 'request', label: 'traverse(p)', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class Jumper(ABC):\n    def __init__(self, start, end):\n        self.start = start\n        self.end = end\n\n    @abstractmethod\n    def traverse(self, player): ...',
          footer: { text: 'Subclasses fill in traverse', tone: 'muted' },
        },
        caption: 'Snake and Ladder share one base',
      },
    },
    {
      title: 'Snake, Ladder',
      tag: 'concept',
      heading: 'Snake and Ladder reject a wrong direction',
      eli5: 'A snake only ever slides you down and a ladder only ever lifts you up. If someone draws a snake that goes uphill, the grown-up says that is not a snake.',
      body: [
        'Each subclass checks its own direction in the constructor. A snake needs `end < start`, a ladder needs `end > start`. A bad one fails when the board is built, not 40 turns into a game.',
        'Both `traverse` methods move the player to `end`. They are separate classes because the rules differ and because the next jumper may not behave the same.',
      ],
      keyIdea: 'Put each kind\'s own rule in its own class and fail early when someone builds it wrong.',
      metrics: { players: 'any', dice: 'one die', jumpers: '2 concrete', state: 'none' },
      scene: {
        nodes: [jumperI(TM), snake(BL, { chips: ['assert end < start'] }), ladder(BR, { chips: ['assert end > start'] }), player(TR, { chips: ['position: 3'] })],
        links: [link('snake', 'jumperI', { label: 'extends' }), link('ladder', 'jumperI', { label: 'extends' })],
        flows: [
          { path: ['player', 'ladder'], tone: 'request', label: 'lands on 3', duration: 1.4 },
          { path: ['ladder', 'player'], tone: 'response', label: 'position = 22', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Two kinds, one contract',
          icon: 'Table',
          rows: [
            { text: 'Snake(17, 7)', value: 'ok', tone: 'good' },
            { text: 'Ladder(3, 22)', value: 'ok', tone: 'good' },
            { text: 'Snake(7, 17)', value: 'AssertionError', tone: 'bad' },
            { text: 'Ladder(22, 3)', value: 'AssertionError', tone: 'bad' },
          ],
        },
        caption: 'Wrong direction fails at build time',
      },
      code: {
        language: 'python',
        title: 'Snake and Ladder',
        source: `class Snake(Jumper):
    def __init__(self, start, end):
        assert end < start, "snake goes down"
        super().__init__(start, end)

    def traverse(self, player):
        player.position = self.end

class Ladder(Jumper):
    def __init__(self, start, end):
        assert end > start, "ladder goes up"
        super().__init__(start, end)

    def traverse(self, player):
        player.position = self.end`,
        highlight: [3, 11],
      },
    },
    {
      title: 'New jumpers',
      tag: 'case',
      heading: 'Case: add a teleporter and a mystery box',
      eli5: 'A kid invents a magic square that sends you anywhere, and another that flips a coin to pick where you go. You draw two new kinds of picture. The board and the referee stay the same.',
      body: [
        'A **Teleporter** can go either direction, so it skips the direction check. A **MysteryBox** picks its end from a list at random when someone lands on it.',
        'Jumper exposes `all_ends()`, so `add_jumper` validates every possible end of a MysteryBox, not only the first. Neither one edits Board, Cell or Game. They extend Jumper, and Game still calls `traverse`. That is the open-closed principle at work: open for extension, closed for edits.',
      ],
      keyIdea: 'A new jump kind is a new subclass. Board, Cell and Game do not change.',
      metrics: { players: 'any', dice: 'one die', jumpers: '4 kinds', state: 'none' },
      scene: {
        nodes: [board(TL, { status: 'ok', badge: 'unchanged' }), jumperI(TM), teleporter(BL, { status: 'active' }), mystery(BR, { status: 'active' })],
        links: [link('board', 'jumperI', { label: 'has-a' }), link('teleporter', 'jumperI', { label: 'extends' }), link('mystery', 'jumperI', { label: 'extends' })],
        flows: [
          { path: ['board', 'jumperI'], tone: 'request', label: 'traverse(p)', duration: 1.3 },
          { path: ['jumperI', 'mystery'], tone: 'request', label: 'dispatch', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Two new subclasses',
          icon: 'Code',
          code: 'class MysteryBox(Jumper):\n    def __init__(self, start, ends):\n        super().__init__(start, ends[0]); self.ends = ends\n    def all_ends(self): return self.ends\n    def traverse(self, player):\n        player.position = random.choice(self.ends)',
          footer: { text: 'Teleporter skips the direction assert', tone: 'muted' },
        },
        caption: 'New behavior, no edits to Board',
      },
      quiz: {
        question: 'You add a Teleporter that can send a player forward or back. Which existing class has to change?',
        options: [
          'Board, so it knows a third jumper kind',
          'Game, so it branches on the jumper type',
          'None of them, because Teleporter extends Jumper and Game only calls traverse',
          'Cell, so it stores the type of its jumper',
        ],
        answer: 2,
        explain: 'Game and Board only know the Jumper contract. A new subclass plugs in through traverse, which is the point of replacing dict keys with polymorphic objects.',
      },
    },
    {
      title: 'Bad boards',
      tag: 'case',
      heading: 'Case: reject a board that cannot be played',
      eli5: 'Before the game starts, the grown-up checks the map. Two pictures on one square, or a ladder that lands on a snake, would make the game confusing, so those maps get sent back.',
      body: [
        'Setup code can build a nonsense board. `add_jumper` refuses a start or end off the board, a jumper on square 100 (it would block the win), and a second jumper on the same cell.',
        'A jump that ends on another jumper\'s start is refused too. The game never chains jumps, so this rule exists to keep every square unambiguous, not to prevent loops. It is checked in both orders, so a new start that equals an existing end is refused as well.',
      ],
      keyIdea: 'Validate the board once when it is built. A bad board should never reach a running game.',
      metrics: { players: 'any', dice: 'one die', jumpers: '4 kinds', state: 'none' },
      scene: {
        nodes: [caller(TL, { chips: ['add_jumper(...)'] }), board(TM, { status: 'active' }), cell(BM, { chips: ['jumper: Snake'] })],
        links: [link('caller', 'board', { label: 'builds' }), link('board', 'cell', { label: 'has-a' })],
        flows: [
          { path: ['caller', 'board'], tone: 'request', label: 'add_jumper(Snake)', duration: 1.3 },
          { path: ['board', 'caller'], tone: 'error', label: 'ValueError', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Rejected at setup',
          icon: 'Shield',
          rows: [
            { text: 'Start or end off the board', tone: 'bad' },
            { text: 'Jumper on square 100', tone: 'bad' },
            { text: 'Two jumpers on one cell', tone: 'bad' },
            { text: 'End lands on another start', tone: 'bad' },
          ],
          footer: { text: 'One jump per landing, no loops', tone: 'good' },
        },
        caption: 'A bad board never starts',
      },
      code: {
        language: 'python',
        title: 'Board.add_jumper',
        source: `def add_jumper(self, jumper):
    if not (1 <= jumper.start < self.size and 1 <= jumper.end <= self.size):
        raise ValueError("jumper is off the board")
    if self.cells[jumper.start].jumper:
        raise ValueError("cell already has a jumper")
    for end in jumper.all_ends():
        if not 1 <= end < self.size or self.cells[end].jumper:
            raise ValueError("end is off the board or on a jumper")
    if jumper.start in self.ends:
        raise ValueError("start is another jumper's end")
    self.ends.update(jumper.all_ends())
    self.cells[jumper.start].jumper = jumper`,
        highlight: [2, 4, 6, 8],
      },
    },
    {
      title: 'Dice strategy',
      tag: 'concept',
      heading: 'v4: dice is a Strategy',
      eli5: 'Sometimes the kids roll one die, sometimes two, sometimes they use a loaded die for a joke. The game does not care which. It just asks the die cup for a number.',
      body: [
        'Game needs one thing from dice: a number. Define a `DiceStrategy` interface with `roll()`. Game holds one and calls it, and never calls `random` itself.',
        'This is the **Strategy** pattern. Each rule for producing a number becomes its own class, picked when the game is built.',
      ],
      keyIdea: 'When one step of a process has several interchangeable versions, put the step behind an interface.',
      metrics: { players: 'any', dice: 'pluggable', jumpers: '4 kinds', state: 'none' },
      scene: {
        nodes: [game(TL, { chips: ['dice: DiceStrategy'] }), diceI(TM, { status: 'active' }), fair(BL), crooked(BM), multi(BR)],
        links: [link('game', 'diceI', { label: 'has-a' }), link('fair', 'diceI', { label: 'implements' }), link('crooked', 'diceI', { label: 'implements' }), link('multi', 'diceI', { label: 'implements' })],
        flows: [
          { path: ['game', 'diceI'], tone: 'request', label: 'roll()', duration: 1.2 },
          { path: ['diceI', 'game'], tone: 'response', label: '5', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The strategy',
          icon: 'Code',
          code: 'class DiceStrategy(ABC):\n    @abstractmethod\n    def roll(self) -> int: ...',
          footer: { text: 'Game never imports random', tone: 'good' },
        },
        caption: 'Game asks for a number, not a method',
      },
    },
    {
      title: 'Dice variants',
      tag: 'case',
      heading: 'Fair, crooked, multiple and scripted dice',
      eli5: 'A normal die, a loaded die that always lands high, two dice added together, and a pretend die that reads numbers off a list so we can test the game without luck.',
      body: [
        '`FairDice` rolls 1 to 6. `CrookedDice` rolls 4 to 6, for a rigged variant. `MultipleDice(count)` sums several dice, so a roll can reach 12.',
        'A `ScriptedDice` returns numbers from a list you give it. Tests use it to force a snake or a win on turn 3. Passing in the random source gives the same control for the fair die.',
      ],
      keyIdea: 'The Strategy also makes tests deterministic: swap the random die for a scripted one.',
      metrics: { players: 'any', dice: '4 strategies', jumpers: '4 kinds', state: 'none' },
      scene: {
        nodes: [diceI(TM), fair(TL, { chips: ['1 to 6'] }), crooked(BL, { chips: ['4 to 6'] }), multi(BM, { chips: ['2d6: 2 to 12'] }), scripted(BR, { status: 'active', chips: [{ text: '[6, 3, 6]', tone: 'good' }] })],
        links: [link('fair', 'diceI', { label: 'implements' }), link('crooked', 'diceI'), link('multi', 'diceI'), link('scripted', 'diceI')],
        flows: [{ path: ['scripted', 'diceI'], tone: 'response', label: '6', duration: 1.3 }],
        panel: {
          title: 'Same interface, different numbers',
          icon: 'Table',
          rows: [
            { text: 'FairDice', value: '1 to 6' },
            { text: 'CrookedDice', value: '4 to 6' },
            { text: 'MultipleDice(2)', value: '2 to 12' },
            { text: 'ScriptedDice', value: 'from a list', tone: 'good' },
          ],
        },
        caption: 'Four ways to make a number',
      },
      code: {
        language: 'python',
        title: 'Dice strategies',
        source: `class FairDice(DiceStrategy):
    def __init__(self, rng=None):
        self.rng = rng or random.Random()
    def roll(self): return self.rng.randint(1, 6)

class CrookedDice(DiceStrategy):
    def roll(self): return random.randint(4, 6)

class MultipleDice(DiceStrategy):
    def __init__(self, count=2): self.count = count
    def roll(self): return sum(random.randint(1, 6) for _ in range(self.count))

class ScriptedDice(DiceStrategy):
    def __init__(self, rolls): self.rolls = iter(rolls)
    def roll(self): return next(self.rolls)`,
        highlight: [7, 11, 15],
      },
    },
    {
      title: 'Game state',
      tag: 'concept',
      heading: 'v5: a state machine for the game',
      eli5: 'A board game is either set up but not begun, being played, or finished. The grown-up only lets you roll while it is being played.',
      body: [
        'A game has three states: `WAITING`, `IN_PROGRESS` and `FINISHED`. `WAITING` means built but not started, and `start()` is the only way out of it. Store the current one in an `Enum` field on Game, instead of guessing it from other values.',
        'The state answers questions that were hard in the script. Is the game over? Can I still roll? Who won? After `FINISHED`, the `winner` field is set. `Game` uses a `TurnManager` here, which is introduced two steps later.',
      ],
      keyIdea: 'Name the phases of the game with an enum. Every method can then say which phases it is allowed in.',
      metrics: { players: '2', dice: 'pluggable', jumpers: '4 kinds', state: 'WAITING' },
      scene: {
        nodes: [caller(TL, { chips: ['start()'] }), game(TM, { status: 'active', chips: ['winner: None'] }), state(BR, { chips: [{ text: 'WAITING', tone: 'warn' }, 'IN_PROGRESS', 'FINISHED'] })],
        links: [link('caller', 'game', { label: 'calls' }), link('game', 'state', { label: 'has-a' })],
        flows: [
          { path: ['caller', 'game'], tone: 'request', label: 'start()', duration: 1.3 },
          { path: ['game', 'state'], tone: 'event', label: 'IN_PROGRESS', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Transitions',
          icon: 'Workflow',
          rows: [
            { text: 'WAITING to IN_PROGRESS', value: 'start()' },
            { text: 'IN_PROGRESS to FINISHED', value: 'a token hits 100' },
            { text: 'FINISHED', value: 'winner is set', tone: 'good' },
          ],
        },
        caption: 'Three phases, one enum',
      },
      code: {
        language: 'python',
        title: 'GameState',
        source: `class GameState(Enum):
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"

class Game:
    def __init__(self, board, players, dice):
        self.board, self.dice = board, dice
        self.turns = TurnManager(players)
        self.state = GameState.WAITING
        self.winner = None`,
        highlight: [1, 10],
      },
    },
    {
      title: 'Guarded moves',
      tag: 'concept',
      heading: 'Methods refuse to run in the wrong state',
      eli5: 'If someone shouts "my turn!" before the game has begun, or after somebody won, the grown-up says no. Rolling only works in the middle of a game.',
      body: [
        '`start()` runs only from `WAITING`, and only with 2 or more players. `take_turn()` runs only in `IN_PROGRESS`. Anything else raises an error with a clear message.',
        'Without the guard, a caller could roll after a win and push a token past 100. One `if` at the top of each method keeps the game honest.',
      ],
      keyIdea: 'A state machine is useful because illegal moves are refused in one place, at the top of each method.',
      metrics: { players: '2', dice: 'pluggable', jumpers: '4 kinds', state: 'FINISHED' },
      metricTones: { state: 'warn' },
      scene: {
        nodes: [caller(TL, { chips: ['take_turn()'] }), game(TM, { status: 'hot' }), state(BM, { chips: [{ text: 'FINISHED', tone: 'bad' }] })],
        links: [link('caller', 'game', { label: 'calls' }), link('game', 'state', { label: 'checks' })],
        flows: [
          { path: ['caller', 'game'], tone: 'request', label: 'take_turn()', duration: 1.3 },
          { path: ['game', 'state'], tone: 'request', label: 'state?', duration: 1.2, delay: 1.4 },
          { path: ['game', 'caller'], tone: 'error', label: 'RuntimeError', duration: 1.3, delay: 2.7 },
        ],
        panel: {
          title: 'Allowed in which state',
          icon: 'Shield',
          rows: [
            { text: 'start()', value: 'WAITING only' },
            { text: 'take_turn()', value: 'IN_PROGRESS only' },
            { text: 'start() with 1 player', value: 'rejected', tone: 'bad' },
            { text: 'take_turn() after a win', value: 'rejected', tone: 'bad' },
          ],
        },
        caption: 'Wrong state, clear error',
      },
      code: {
        language: 'python',
        title: 'start() and the guard',
        source: `def start(self):
    if self.state is not GameState.WAITING:
        raise RuntimeError("already started")
    if len(self.turns) < 2:
        raise RuntimeError("need 2 or more players")
    self.state = GameState.IN_PROGRESS

def take_turn(self):
    if self.state is not GameState.IN_PROGRESS:
        raise RuntimeError("game is not active")`,
        highlight: [2, 4, 9],
      },
    },
    {
      title: 'Turn manager',
      tag: 'concept',
      heading: 'v6: a TurnManager with a rotating queue',
      eli5: 'The kids sit in a circle. The one holding the die plays, then hands the die to the next kid. When someone joins, the circle just gets one seat bigger.',
      body: [
        '`1 - turn` only works for two players. A `deque` of players works for any number: `current()` is the front, and `advance()` rotates the queue by one.',
        'Pulling this out of Game gives turn order one home. Game says "next", and TurnManager knows how.',
      ],
      keyIdea: 'A rotating queue gives fair turns for any player count. Game only calls current() and advance().',
      metrics: { players: 'n', dice: 'pluggable', jumpers: '4 kinds', state: 'IN_PROGRESS' },
      scene: {
        nodes: [game(TL), turns(TM, { status: 'active', chips: ['[Asha, Ben, Cy]'] }), player(BL, { label: 'Asha', sub: 'current', status: 'active' }), blk('player2', BR, 'Ben', 'waiting', 'green', 'User', { status: 'dim' })],
        links: [link('game', 'turns', { label: 'has-a' }), link('turns', 'player', { label: 'queue' }), link('turns', 'player2', { label: 'queue' })],
        flows: [
          { path: ['game', 'turns'], tone: 'request', label: 'current()', duration: 1.2 },
          { path: ['turns', 'player'], tone: 'response', label: 'Asha', duration: 1.2, delay: 1.3 },
          { path: ['game', 'turns'], tone: 'request', label: 'advance()', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'TurnManager',
          icon: 'Code',
          code: 'class TurnManager:\n    def __init__(self, players):\n        self.queue = deque(players)\n    def current(self): return self.queue[0]\n    def advance(self, extra_turn=False):\n        if not extra_turn:\n            self.queue.rotate(-1)\n    def __len__(self): return len(self.queue)',
        },
        caption: 'Front of the queue plays',
      },
    },
    {
      title: 'Extra turn',
      tag: 'case',
      heading: 'Case: a 6 gives another turn',
      eli5: 'A house rule: if you roll a six, you keep the die and roll again. The circle of kids does not move this time.',
      body: [
        'Many tables play that a 6 earns a second roll. `advance(extra_turn=True)` leaves the queue where it is, so the same player is `current()` again.',
        'Game decides when a turn is extra: `roll == 6`. TurnManager only knows how to hold or rotate. Changing the rule moves one line.',
        'That rule assumes one die. With `MultipleDice(2)` a sum of 6 would wrongly grant it, so use a double or a `grants_extra_turn(roll)` method on the dice strategy.',
      ],
      keyIdea: 'A rule variant should be one line in one class. Here it is one argument to advance().',
      metrics: { players: 'n', dice: 'pluggable', jumpers: '4 kinds', state: 'IN_PROGRESS' },
      scene: {
        nodes: [game(TL, { chips: ['extra = roll == 6'] }), diceI(TM, { badge: 'rolled 6' }), turns(BM, { status: 'active', chips: ['[Asha, Ben, Cy]'] })],
        links: [link('game', 'diceI', { label: 'uses' }), link('game', 'turns', { label: 'uses' })],
        flows: [
          { path: ['diceI', 'game'], tone: 'response', label: '6', duration: 1.2 },
          { path: ['game', 'turns'], tone: 'request', label: 'advance(extra_turn=True)', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'advance()',
          icon: 'Table',
          rows: [
            { text: 'roll 1 to 5', value: 'rotate queue' },
            { text: 'roll 6', value: 'same player again', tone: 'good' },
            { text: 'overshoot', value: 'rotate, no move' },
            { text: 'win', value: 'no advance' },
          ],
        },
        caption: 'A 6 holds the queue still',
      },
    },
    {
      title: 'Exact finish',
      tag: 'case',
      heading: 'Case: overshooting square 100',
      eli5: 'You are on square 97 and roll a 5. There is no square 102, so your token stays where it is and the die passes on. You need a 3 or smaller to finish.',
      body: [
        'The common rule says you must land exactly on 100. If `position + roll` is more than `size`, the player stays put and the turn passes.',
        'The check sits right after the roll and before the move, so no token ever leaves the board. Without it, the list index `cells[102]` would raise an `IndexError`.',
      ],
      keyIdea: 'Check the target before moving the token. A rule about the edge of the board belongs before the move, not after.',
      metrics: { players: 'n', dice: 'pluggable', jumpers: '4 kinds', state: 'IN_PROGRESS' },
      scene: {
        nodes: [player(TL, { chips: ['position: 97'] }), game(TM, { status: 'active', chips: ['roll: 5'] }), board(BM, { chips: ['size: 100'] })],
        links: [link('game', 'player', { label: 'moves' }), link('game', 'board', { label: 'checks size' })],
        flows: [
          { path: ['game', 'board'], tone: 'request', label: '97 + 5 > 100?', duration: 1.3 },
          { path: ['board', 'game'], tone: 'error', label: 'overshoot, stay', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'From square 97',
          icon: 'Table',
          rows: [
            { text: 'roll 1 or 2', value: 'moves to 98 or 99' },
            { text: 'roll 3', value: 'lands on 100, wins', tone: 'good' },
            { text: 'roll 4, 5 or 6', value: 'stays on 97', tone: 'warn' },
          ],
        },
        caption: 'Stay put if the roll is too big',
      },
      quiz: {
        question: 'A player on square 98 rolls a 6. With the exact-finish rule and the extra turn on 6, what happens?',
        options: [
          'The token moves to 104 and the player wins',
          'The token stays on 98, and the turn passes to the next player',
          'The token stays on 98, and the same player rolls again',
          'The token is sent back to square 0',
        ],
        answer: 1,
        explain: 'The overshoot check runs first and returns without moving. The extra-turn rule only applies to a move that happened, so the turn passes on.',
      },
    },
    {
      title: 'One turn',
      tag: 'concept',
      heading: 'One take_turn() from top to bottom',
      eli5: 'The grown-up looks at whose turn it is, hands over the die, watches the token move, checks the square for a picture, and then decides who plays next.',
      body: [
        'Read the whole method as a story. Check the state, ask TurnManager for the current player, roll, run the overshoot check, move, look at the cell, traverse if there is a jumper, check for a win.',
        'Every step calls a collaborator through its small interface. Game holds the order of events and none of the details.',
      ],
      keyIdea: 'take_turn() is an orchestrator. Each collaborator does its own job, and Game sequences them.',
      metrics: { players: 'n', dice: 'pluggable', jumpers: '4 kinds', state: 'IN_PROGRESS' },
      scene: {
        nodes: [game(TL, { status: 'active' }), diceI(TM, { size: 0.9 }), player(TR, { chips: ['position: 17'] }), board(BM), snake(BR, { chips: ['17 to 7'] })],
        links: [link('game', 'diceI', { label: 'roll' }), link('game', 'player', { label: 'move' }), link('game', 'board', { label: 'cell' }), link('board', 'snake', { label: 'has-a' })],
        flows: [
          { path: ['game', 'diceI'], tone: 'request', label: 'roll()', duration: 1.1 },
          { path: ['diceI', 'game'], tone: 'response', label: '4', duration: 1.1, delay: 1.2 },
          { path: ['game', 'board'], tone: 'request', label: 'cells[17]', duration: 1.1, delay: 2.4 },
          { path: ['board', 'snake'], tone: 'request', label: 'traverse(p)', duration: 1.1, delay: 3.6 },
        ],
        panel: {
          title: 'Who decides what',
          icon: 'Table',
          rows: [
            { text: 'TurnManager.current()', value: 'who plays' },
            { text: 'DiceStrategy.roll()', value: 'a number' },
            { text: 'Board.size', value: 'overshoot or not' },
            { text: 'Cell.jumper.traverse()', value: 'the final square' },
            { text: 'TurnManager.advance()', value: 'who plays next' },
          ],
        },
        caption: 'Game sequences, collaborators decide',
      },
      code: {
        language: 'python',
        title: 'Game.take_turn',
        source: `def take_turn(self):
    if self.state is not GameState.IN_PROGRESS:
        raise RuntimeError("game is not active")
    player = self.turns.current()
    roll = self.dice.roll()
    target = player.position + roll
    if target > self.board.size:
        self.turns.advance()
        return
    player.position = target
    jumper = self.board.cells[target].jumper
    if jumper:
        jumper.traverse(player)
    if player.position == self.board.size:
        self.state, self.winner = GameState.FINISHED, player
    else:
        self.turns.advance(extra_turn=(roll == 6))`,
        highlight: [7, 12, 14, 17],
      },
    },
    {
      title: 'Win check',
      tag: 'case',
      heading: 'Case: a ladder that ends on 100',
      eli5: 'A kid steps on the last ladder and it carries them straight to the finish square. They win right then, because the grown-up checks where the token ended up after the ladder.',
      body: [
        'The win check runs after the jump, on the final position. A ladder from 80 to 100 wins the game as its player lands on 80.',
        'Checking before the jump would miss this and let the game run on. It also explains why a jumper on 100 itself is rejected at setup: a snake there would take the win away.',
      ],
      keyIdea: 'Decide the win on the final position after every effect has run, not on the square the die brought you to.',
      metrics: { players: 'n', dice: 'pluggable', jumpers: '4 kinds', state: 'FINISHED' },
      metricTones: { state: 'good' },
      scene: {
        nodes: [player(TL, { status: 'ok', chips: ['position: 100'] }), ladder(TM, { chips: ['80 to 100'] }), game(BM, { status: 'ok', chips: [{ text: 'winner: Asha', tone: 'good' }] }), state(BR, { chips: [{ text: 'FINISHED', tone: 'good' }] })],
        links: [link('player', 'ladder', { label: 'lands on 80', style: 'dashed' }), link('game', 'state', { label: 'sets' })],
        flows: [
          { path: ['ladder', 'player'], tone: 'response', label: 'position = 100', duration: 1.3 },
          { path: ['player', 'game'], tone: 'request', label: 'position == size?', duration: 1.3, delay: 1.4 },
          { path: ['game', 'state'], tone: 'event', label: 'FINISHED', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Order matters',
          icon: 'Table',
          rows: [
            { text: 'Move to 80', value: 'not 100 yet' },
            { text: 'Ladder to 100', value: 'final position' },
            { text: 'Check position == size', value: 'win', tone: 'good' },
          ],
          footer: { text: 'Win check comes after traverse', tone: 'muted' },
        },
        caption: 'Check the end, not the landing',
      },
    },
    {
      title: 'Turn result',
      tag: 'tradeoff',
      heading: 'Return what happened, do not print it',
      eli5: 'The grown-up whispers "Asha rolled 4 and slid down the snake to 7" to a scorekeeper. Whether the scorekeeper shouts it, writes it or draws it is the scorekeeper\'s business.',
      body: [
        'A `print` inside `Snake.traverse` ties a game rule to a console. A GUI, a test or a replay cannot reuse it. Have `take_turn()` return a `TurnResult` and let the caller present it.',
        'The result holds the player, roll, start and end square, jumper kind, and whether it was a win. If many views want updates, an Observer on Game is the next step.',
      ],
      keyIdea: 'Models return facts. Views decide how to show them.',
      metrics: { players: 'n', dice: 'pluggable', jumpers: '4 kinds', state: 'IN_PROGRESS' },
      scene: {
        nodes: [game(TL, { status: 'active' }), result(TM, { chips: ['roll: 4', 'jumper: Snake'] }), caller(BM, { label: 'console view', sub: 'prints it' })],
        links: [link('game', 'result', { label: 'creates' }), link('caller', 'game', { label: 'calls' })],
        flows: [
          { path: ['caller', 'game'], tone: 'request', label: 'take_turn()', duration: 1.2 },
          { path: ['game', 'result'], tone: 'data', label: 'TurnResult', duration: 1.2, delay: 1.3 },
          { path: ['game', 'caller'], tone: 'response', label: 'result', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'TurnResult',
          icon: 'Receipt',
          code: '@dataclass\nclass TurnResult:\n    player: str\n    roll: int\n    start: int\n    end: int\n    jumper: str | None\n    won: bool',
        },
        caption: 'The game returns a fact',
      },
      code: {
        language: 'python',
        title: 'take_turn returns a TurnResult',
        source: `def take_turn(self):
    player = self.turns.current()
    roll = self.dice.roll()
    start, target = player.position, player.position + roll
    if target > self.board.size:
        self.turns.advance()
        return TurnResult(player.name, roll, start, start, None, False)
    player.position = target
    jumper = self.board.cells[target].jumper
    if jumper:
        jumper.traverse(player)
    won = player.position == self.board.size
    if won:
        self.state, self.winner = GameState.FINISHED, player
    else:
        self.turns.advance(extra_turn=(roll == 6))
    kind = type(jumper).__name__ if jumper else None
    return TurnResult(player.name, roll, start, player.position, kind, won)

# caller
print(game.take_turn())`,
        highlight: [7, 14, 17],
      },
    },
    {
      title: 'Wiring it',
      tag: 'concept',
      heading: 'Putting the parts together',
      eli5: 'Set up the board with its pictures, hand the grown-up a die and the kids, then say "start" and keep saying "next turn" until someone wins.',
      body: [
        'The wiring is where the choices show. Build the board and add its jumpers, pick a dice strategy, give Game the players, call `start()`, and loop until `state` is `FINISHED`.',
        'Swapping to three players, `MultipleDice(2)` or a scripted die changes only these few lines. The classes underneath stay the same.',
      ],
      keyIdea: 'Composition happens at the edge. The choices live in setup code, and the classes depend only on interfaces.',
      metrics: { players: '3', dice: 'MultipleDice(2)', jumpers: '4 kinds', state: 'FINISHED' },
      scene: {
        nodes: [caller(TL, { label: 'main', sub: 'setup code' }), game(TM, { status: 'active' }), board(BL, { chips: ['4 snakes', '4 ladders'] }), diceI(BM, { label: 'MultipleDice', sub: '2 dice', tint: 'green' })],
        links: [link('caller', 'game', { label: 'creates' }), link('game', 'board', { label: 'has-a' }), link('game', 'diceI', { label: 'has-a' })],
        flows: [
          { path: ['caller', 'game'], tone: 'request', label: 'start()', duration: 1.2 },
          { path: ['caller', 'game'], tone: 'request', label: 'take_turn()', duration: 1.2, delay: 1.4, count: 2 },
        ],
        panel: {
          title: 'Setup',
          icon: 'Code',
          code: 'board = Board(100)\nboard.add_jumper(Snake(17, 7))\nboard.add_jumper(Ladder(3, 22))\ngame = Game(board, players, MultipleDice(2))\ngame.start()\nwhile game.state is GameState.IN_PROGRESS:\n    game.take_turn()',
        },
        caption: 'Choices live in the setup code',
      },
    },
    {
      title: 'Trade-offs',
      tag: 'tradeoff',
      heading: 'What each seam costs, and when the dict is fine',
      eli5: 'Drawing a new picture class for every kind of square is more work than writing a number on a list. It is worth it when the kids keep inventing new kinds of square.',
      body: [
        'Polymorphic jumpers, a dice strategy and a state machine add classes. If the game will never change, the 12-line script is the right answer.',
        'The seams pay off when follow-ups arrive: new square types, other dice, more players. In an interview, build the simple version first, then name each pattern as a reaction to a follow-up.',
      ],
      keyIdea: 'Patterns are answers to change. Add each one when a real follow-up needs it, not before.',
      metrics: { players: 'n', dice: 'pluggable', jumpers: '4 kinds', state: 'enum' },
      scene: {
        nodes: [jumperI(TL, { label: 'Jumper', sub: 'polymorphism' }), diceI(TM, { sub: 'Strategy' }), state(TR, { sub: 'State' }), turns(BM, { sub: 'deque rotate' })],
        links: [link('jumperI', 'diceI', { style: 'faint', arrow: 'none' }), link('diceI', 'state', { style: 'faint', arrow: 'none' })],
        flows: [],
        panel: {
          title: 'Seam and what it buys',
          icon: 'Scale',
          rows: [
            { text: 'Jumper subclasses', value: 'new squares' },
            { text: 'DiceStrategy', value: 'new dice, tests' },
            { text: 'GameState enum', value: 'legal moves' },
            { text: 'TurnManager', value: 'any player count' },
            { text: 'Cost', value: 'more classes', tone: 'warn' },
          ],
        },
        caption: 'Each seam answers one follow-up',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Snake and ladder in one picture',
      eli5: 'The grown-up (**Game**) keeps the rules, the cardboard **board** holds the squares and pictures, the die cup gives numbers, and the circle of kids takes turns.',
      body: [
        'Start with the simple script. Then split on the follow-ups: Board and Cell for squares, Jumper subclasses for behavior, a DiceStrategy for numbers, a GameState enum for phases, and a TurnManager for order.',
        'Handle the edges in one place each: exact finish, extra turn on 6, board validation, and a returned result instead of a print.',
      ],
      keyIdea: 'Small game, real design skills: composition, polymorphism, Strategy and a state machine, each added for a reason.',
      metrics: { players: 'n', dice: 'pluggable', jumpers: 'open set', state: 'enum' },
      metricTones: { players: 'good', dice: 'good', jumpers: 'good', state: 'good' },
      scene: {
        nodes: [game(TM, { status: 'ok' }), board(BL, { status: 'ok' }), diceI(TR, { status: 'ok' }), turns(TL, { status: 'ok' }), jumperI(BR, { status: 'ok' })],
        links: [link('game', 'board', { label: 'has-a' }), link('game', 'diceI', { label: 'has-a' }), link('game', 'turns', { label: 'has-a' }), link('board', 'jumperI', { label: 'has-a' })],
        flows: [
          { path: ['game', 'diceI', 'game'], tone: 'request', label: 'roll()', duration: 1.5 },
          { path: ['game', 'board', 'jumperI'], tone: 'request', label: 'traverse()', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Design in one table',
          icon: 'Table',
          rows: [
            { text: 'Board, Cell', value: 'squares' },
            { text: 'Jumper', value: 'polymorphism' },
            { text: 'DiceStrategy', value: 'Strategy' },
            { text: 'GameState', value: 'State' },
            { text: 'TurnManager', value: 'turn order' },
          ],
        },
        caption: 'Five seams, one small game',
      },
      quiz: {
        question: 'The interviewer says "add a square that moves you back 3 and gives a free roll". What is the smallest change?',
        options: [
          'Add an `if cell.number == 40` branch in Game.take_turn',
          'Add a Jumper subclass for it and place it on the board',
          'Store special squares in a new dict next to the board',
          'Make Board subclass for each special square',
        ],
        answer: 1,
        explain: 'A new Jumper subclass plugs into traverse, and Game and Board stay untouched. The free-roll part would need a small way for a jumper to ask for an extra turn, which is still a local change.',
      },
    },
  ],
};
