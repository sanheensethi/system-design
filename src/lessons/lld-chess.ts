import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const blk = (id: string, label: string, sub: string, icon: string, tint: SceneNode['tint'], d: number, s: number, extra: Partial<SceneNode> = {}): SceneNode => ({
  id,
  kind: 'block',
  at: at(d, s),
  label,
  sub,
  icon,
  tint,
  size: 0.8,
  ...extra,
});
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const player = blk('player', 'Player', 'the caller', 'User', 'gray', -4, -3);
const game = blk('game', 'Game', 'turns + history', 'Workflow', 'green', 0, -3);
const board = blk('board', 'Board', '8x8 grid', 'Table', 'green', 4, -3);
const piece = blk('piece', 'Piece', 'abstract', 'Layers', 'blue', -4, 3);
const rook = blk('rook', 'Rook', 'slides', 'Code', 'green', 0, 3);
const knight = blk('knight', 'Knight', 'jumps', 'Code', 'green', 4, 3);
const move = blk('move', 'Move', 'from, to, piece', 'Route', 'amber', 4, 3);
const rule = blk('rule', 'MoveRule', 'interface', 'Braces', 'violet', 0, -3);
const observer = blk('observer', 'MoveObserver', 'interface', 'Braces', 'violet', 0, 3);

export const lldChess: Lesson = {
  id: 'lld-chess',
  title: 'Chess',
  tagline: 'Design a chess engine in six versions: pieces, board, special rules, check, and undo, one pattern at a time.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Why a grid of characters collapses, and how a Piece hierarchy fixes movement',
    'Board, Move and Game: who owns state, who owns rules',
    'Castling, en passant and promotion as Strategy objects (MoveRule)',
    'Legal versus pseudo-legal moves, and check, checkmate and stalemate through an Observer',
    'Draw rules, undo with Memento, and variants that add classes instead of edits',
  ],
  metrics: [
    { key: 'where', label: 'Rules live in', icon: 'Code' },
    { key: 'edits', label: 'New rule costs', icon: 'Repeat' },
    { key: 'test', label: 'Test setup', icon: 'Bug' },
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'Grid of chars',
      tag: 'problem',
      heading: 'The first version: an 8x8 grid of characters',
      eli5: 'A **board** where every kid at the game club is just a letter on a card. Nobody knows how their own letter is allowed to walk, so one grumpy referee checks everything.',
      body: [
        'The quick way to model chess is a list of lists: `r` for a black rook, `P` for a white pawn, `.` for empty. A single `move(board, frm, to)` function decides what is legal.',
        'It works for the first piece. Then comes the second, the third, and castling.',
      ],
      keyIdea: 'A grid of characters has no place for behavior, so every rule lands in one function.',
      metrics: { where: 'one move()', edits: 'edit move()', test: 'full board', classes: '0' },
      metricTones: { where: 'bad', edits: 'bad', test: 'bad' },
      scene: {
        nodes: [
          player,
          blk('move', 'move()', 'one function', 'FileCode', 'red', 0, -3, { status: 'hot', badge: '400 lines' }),
          blk('grid', 'grid', 'list of chars', 'Table', 'gray', 4, -3, { chips: ["'P'", "'r'", "'.'"] }),
        ],
        links: [link('player', 'move', { label: 'calls' }), link('move', 'grid', { label: 'reads, writes' })],
        flows: [
          { path: ['player', 'move'], tone: 'request', label: 'move(b, frm, to)', duration: 1.4 },
          { path: ['move', 'grid'], tone: 'data', label: 'grid[r][c]', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'v1: move() on characters',
          icon: 'Code',
          code: "def move(board, frm, to):\n    p = board[frm[0]][frm[1]]\n    if p.lower() == 'p':\n        ...  # 40 lines of pawn rules\n    elif p.lower() == 'r':\n        ...  # 20 lines of rook rules\n    board[to[0]][to[1]] = p",
          footer: { text: 'Color is hidden in upper or lower case', tone: 'bad' },
        },
        caption: 'One function knows every rule',
      },
      code: {
        language: 'python',
        title: 'v1: a character grid and one big function',
        source: `board = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['.']*8, ['.']*8, ['.']*8, ['.']*8,
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R'],
]

def move(board, frm, to):
    piece = board[frm[0]][frm[1]]
    if piece.lower() == 'p':
        ...  # 40 lines of pawn rules
    elif piece.lower() == 'r':
        ...  # 20 lines of rook rules
    # ... and so on for every piece
    board[to[0]][to[1]] = piece
    board[frm[0]][frm[1]] = '.'`,
        highlight: [10, 12, 14],
      },
    },
    {
      title: 'What to model',
      tag: 'concept',
      heading: 'Chess has a long list of rules',
      eli5: 'Before building anything, the club writes down everything a referee must watch: how each kid walks, special tricks, when the king is in danger, and when the game ends.',
      body: [
        'Beyond six piece types, a real engine handles **castling**, **en passant**, **promotion**, **check**, **checkmate**, **stalemate**, **threefold repetition** and **undo**.',
        'Many of these depend on history, not just the current board. That is why a flat design collapses.',
      ],
      keyIdea: 'List the rules first. Several depend on game history, so a board alone cannot answer them.',
      metrics: { where: 'one move()', edits: 'edit move()', test: 'full board', classes: '0' },
      scene: {
        nodes: [
          blk('pieces', 'Pieces', '6 kinds, 2 colors', 'Layers', 'blue', -4, -3),
          blk('special', 'Special moves', 'castle, en passant', 'Star', 'amber', 0, -3),
          blk('state', 'Game state', 'check, mate, draw', 'Shield', 'red', 4, -3),
          blk('undo', 'Undo', 'take a move back', 'Repeat', 'violet', 0, 3),
        ],
        links: [link('pieces', 'special', { arrow: 'none' }), link('special', 'state', { arrow: 'none' }), link('special', 'undo', { arrow: 'none' })],
        panel: {
          title: 'Rules that need history',
          icon: 'List',
          rows: [
            { text: 'Castling', value: 'has the king moved?', tone: 'warn' },
            { text: 'En passant', value: 'what was the last move?', tone: 'warn' },
            { text: 'Threefold repetition', value: 'every past position', tone: 'warn' },
            { text: 'Rook movement', value: 'board only', tone: 'good' },
          ],
        },
        caption: 'Rules the design has to hold',
      },
    },
    {
      title: 'Why it fails',
      tag: 'case',
      heading: 'Case: what goes wrong with one big function',
      eli5: 'Every time the club invents a new trick, the grumpy referee has to rewrite his whole rulebook, and to test one kid he has to set up a full game.',
      body: [
        '`move` grows past 400 lines. Each new rule edits the same function, which breaks the **Open/Closed principle**: code should be open to extension, closed to modification.',
        'To test one rook you must build a full board. And `P` versus `p` as the color is a hack.',
      ],
      keyIdea: 'Behavior belongs with the thing that has it. Here it lives in one function that everything depends on.',
      metrics: { where: 'one move()', edits: 'edit move()', test: 'full board', classes: '0' },
      metricTones: { where: 'bad', edits: 'bad', test: 'bad' },
      scene: {
        nodes: [
          blk('move', 'move()', 'one function', 'FileCode', 'red', -4, -3, { status: 'hot', badge: '400 lines' }),
          blk('castle', 'castling', 'new rule', 'Star', 'amber', 0, -3),
          blk('promo', 'promotion', 'new rule', 'Star', 'amber', 4, -3),
        ],
        links: [link('castle', 'move', { label: 'edits', labelTone: 'warn' }), link('promo', 'move', { label: 'edits', labelTone: 'warn', route: 'straight' })],
        flows: [
          { path: ['castle', 'move'], tone: 'error', label: 'edit', duration: 1.4 },
          { path: ['promo', 'move'], tone: 'error', label: 'edit', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Four pains',
          icon: 'Bug',
          rows: [
            { text: 'Every rule edits move()', value: 'Open/Closed broken', tone: 'bad' },
            { text: 'Test one rook', value: 'needs a full board', tone: 'bad' },
            { text: 'Color', value: "'P' vs 'p' hack", tone: 'bad' },
            { text: 'Merge conflicts', value: 'everyone touches it', tone: 'warn' },
          ],
        },
        caption: 'Every new rule edits the same function',
      },
    },
    {
      title: 'Piece classes',
      tag: 'concept',
      heading: 'v2: each piece owns its movement',
      eli5: 'Instead of one referee knowing everything, each kid in costume knows how their own piece walks. The **piece** answers "where can I go?" for itself.',
      body: [
        'An abstract `Piece` holds the `color` and a `has_moved` flag, and declares `valid_moves(board, pos)`. Each subclass implements it.',
        'Adding a Bishop touches no Rook code. Color becomes an `enum`, not a letter case.',
      ],
      keyIdea: 'Polymorphism: the caller asks any piece for its moves and never branches on type.',
      metrics: { where: 'one class each', edits: 'new class', test: 'one piece + board', classes: '4' },
      metricTones: { where: 'good', edits: 'good' },
      scene: {
        nodes: [
          blk('color', 'Color', 'enum', 'Hash', 'teal', -4, -3),
          { ...piece, at: at(0, -3), sub: 'abstract class' },
          { ...rook, at: at(-2, 3), status: 'active' },
          { ...knight, at: at(2, 3) },
        ],
        links: [link('piece', 'color', { label: 'has-a' }), link('rook', 'piece', { label: 'extends' }), link('knight', 'piece', { label: 'extends' })],
        flows: [{ path: ['rook', 'piece'], tone: 'request', label: 'valid_moves()', duration: 1.4 }],
        panel: {
          title: 'Piece contract',
          icon: 'Code',
          code: 'class Piece(ABC):\n    def __init__(self, color):\n        self.color = color\n        self.has_moved = False\n\n    @abstractmethod\n    def valid_moves(self, board, pos): ...',
        },
        caption: 'Each piece answers for itself',
      },
      code: {
        language: 'python',
        title: 'v2: Piece with a Rook',
        source: `from abc import ABC, abstractmethod
from enum import Enum

class Color(Enum):
    WHITE = "white"
    BLACK = "black"

    def opposite(self):
        return Color.BLACK if self is Color.WHITE else Color.WHITE

class Piece(ABC):
    def __init__(self, color: Color):
        self.color = color
        self.has_moved = False

    @abstractmethod
    def valid_moves(self, board, pos):
        """Destinations by this piece's own movement rules."""

    def attacks(self, board, pos):
        return self.valid_moves(board, pos)`,
        highlight: [14, 15, 16, 18, 19, 20, 21],
      },
    },
    {
      title: 'Share walking',
      tag: 'concept',
      heading: 'Rook, Bishop and Queen walk the same way',
      eli5: 'Rook, bishop and queen kids all slide until something blocks them. They share one "keep sliding" lesson and only differ in which directions they point.',
      body: [
        'Writing the ray walk three times is duplication. A `SlidingPiece` holds one loop over `directions`. Rook, Bishop and Queen only declare a direction list.',
        'Knight and King take one fixed step, so a `StepPiece` loops over `offsets`. Only the pawn needs its own code.',
      ],
      keyIdea: 'Put what pieces share in an intermediate class and let subclasses supply only the data that differs.',
      metrics: { where: 'data lists', edits: 'new class', test: 'one piece + board', classes: '9' },
      metricTones: { where: 'good', edits: 'good' },
      scene: {
        nodes: [
          { ...piece, at: at(0, -4) },
          blk('sliding', 'SlidingPiece', 'abstract, rays', 'Layers', 'blue', -4, 0.5),
          blk('stepper', 'StepPiece', 'abstract, jumps', 'Layers', 'blue', 4, 0.5),
          { ...rook, at: at(-4, 6), sub: 'extends sliding' },
          { ...knight, at: at(4, 6), sub: 'extends step' },
        ],
        links: [link('sliding', 'piece', { label: 'extends' }), link('stepper', 'piece', { label: 'extends' }), link('rook', 'sliding'), link('knight', 'stepper')],
        panel: {
          title: 'Only data differs',
          icon: 'Table',
          rows: [
            { text: 'Rook', value: '4 straight directions' },
            { text: 'Bishop', value: '4 diagonals' },
            { text: 'Queen', value: 'all 8, slides' },
            { text: 'Knight', value: '8 L-jumps, one step' },
            { text: 'King', value: '8 neighbors, one step' },
          ],
        },
        caption: 'One loop, different direction lists',
      },
      code: {
        language: 'python',
        title: 'Sliding and stepping pieces',
        source: `ORTHOGONAL = [(1, 0), (-1, 0), (0, 1), (0, -1)]
DIAGONAL = [(1, 1), (1, -1), (-1, 1), (-1, -1)]

class SlidingPiece(Piece):
    directions = []

    def valid_moves(self, board, pos):
        moves = []
        for dr, dc in self.directions:
            r, c = pos[0] + dr, pos[1] + dc
            while board.in_bounds((r, c)):
                target = board.piece_at((r, c))
                if target is None:
                    moves.append((r, c))
                else:
                    if target.color != self.color:
                        moves.append((r, c))  # capture, then stop
                    break
                r, c = r + dr, c + dc
        return moves

class Rook(SlidingPiece):   directions = ORTHOGONAL
class Bishop(SlidingPiece): directions = DIAGONAL
class Queen(SlidingPiece):  directions = ORTHOGONAL + DIAGONAL

class StepPiece(Piece):
    offsets = []

    def valid_moves(self, board, pos):
        out = []
        for dr, dc in self.offsets:
            to = (pos[0] + dr, pos[1] + dc)
            if board.in_bounds(to):
                t = board.piece_at(to)
                if t is None or t.color != self.color:
                    out.append(to)
        return out

class Knight(StepPiece):
    offsets = [(2, 1), (2, -1), (-2, 1), (-2, -1), (1, 2), (1, -2), (-1, 2), (-1, -2)]

class King(StepPiece):
    offsets = ORTHOGONAL + DIAGONAL`,
        highlight: [4, 5, 11, 15, 22, 23, 24, 26],
      },
    },
    {
      title: 'The pawn',
      tag: 'case',
      heading: 'Case: the pawn is the odd one out',
      eli5: 'The pawn kid walks forward but grabs sideways. Because it is odd, the club gives it its own lesson, and also remembers that "where I can grab" differs from "where I can walk".',
      body: [
        'A pawn moves forward one square (two on its first move), only onto an empty square, and captures one square diagonally, only onto an enemy. Direction depends on color.',
        'So `attacks()` differs from `valid_moves()`: a pawn attacks both forward diagonals even when empty. Check detection later needs `attacks`.',
      ],
      keyIdea: 'Where a piece can move and which squares it attacks are different questions. Keep both.',
      metrics: { where: 'one class each', edits: 'new class', test: 'one piece + board', classes: '10' },
      scene: {
        nodes: [
          { ...piece, at: at(0, -3) },
          blk('pawn', 'Pawn', 'own rules', 'Code', 'green', -2, 3, { status: 'active' }),
          blk('empty', 'empty square', 'diagonal', 'Table', 'gray', 4, 3),
        ],
        links: [link('pawn', 'piece', { label: 'extends' }), link('pawn', 'empty', { label: 'attacks, cannot move', labelTone: 'warn' })],
        panel: {
          title: 'Pawn rules',
          icon: 'Table',
          rows: [
            { text: 'Forward 1', value: 'empty square only' },
            { text: 'Forward 2', value: 'first move, both empty' },
            { text: 'Diagonal 1', value: 'enemy only (capture)' },
            { text: 'attacks()', value: 'both diagonals', tone: 'warn' },
          ],
        },
        caption: 'Move and attack are different sets',
      },
      code: {
        language: 'python',
        title: 'Pawn',
        source: `class Pawn(Piece):
    def _dir(self):
        return -1 if self.color is Color.WHITE else 1

    def valid_moves(self, board, pos):
        r, c = pos
        d = self._dir()
        out = []
        if board.is_empty((r + d, c)):
            out.append((r + d, c))
            if not self.has_moved and board.is_empty((r + 2 * d, c)):
                out.append((r + 2 * d, c))
        for dc in (-1, 1):
            if board.is_enemy((r + d, c + dc), self.color):
                out.append((r + d, c + dc))
        return out

    def attacks(self, board, pos):
        d = self._dir()
        return [(pos[0] + d, pos[1] + dc) for dc in (-1, 1)
                if board.in_bounds((pos[0] + d, pos[1] + dc))]`,
        highlight: [9, 10, 11, 12, 13, 18, 19, 20],
      },
    },
    {
      title: 'Board owns grid',
      tag: 'concept',
      heading: 'v3: the Board owns the grid',
      eli5: 'The game table holds the pieces. Kids ask the **board** "who is on this square?" instead of keeping their own map of the room.',
      body: [
        '`Board` owns the 8x8 grid and the questions about it: `piece_at`, `in_bounds`, `is_empty`, `is_enemy`. Pieces get the board as an argument and only read it.',
        'It also builds the starting position, so setup lives in one place.',
      ],
      keyIdea: 'One class owns the grid. Pieces use it (read-only), and nothing else touches the array.',
      metrics: { where: 'Piece + Board', edits: 'new class', test: 'empty Board + 1 piece', classes: '11' },
      metricTones: { test: 'good' },
      scene: {
        nodes: [
          { ...piece, at: at(-4, -3) },
          { ...board, at: at(0, -3), status: 'active' },
          blk('grid', 'grid', '8x8 of Piece or None', 'Table', 'gray', 4, -3),
        ],
        links: [link('piece', 'board', { label: 'uses' }), link('board', 'grid', { label: 'has-a' })],
        flows: [
          { path: ['piece', 'board'], tone: 'request', label: 'piece_at(pos)', duration: 1.4 },
          { path: ['board', 'piece'], tone: 'response', label: 'Rook or None', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Board questions',
          icon: 'List',
          rows: [
            { text: 'in_bounds(p)', value: 'inside 8x8?' },
            { text: 'piece_at(p)', value: 'Piece or None' },
            { text: 'is_empty(p)', value: 'free square?' },
            { text: 'is_enemy(p, color)', value: 'capturable?' },
          ],
        },
        caption: 'Pieces ask the board',
      },
      code: {
        language: 'python',
        title: 'Board',
        source: `import copy

class Board:
    def __init__(self):
        self.grid = [[None] * 8 for _ in range(8)]

    @classmethod
    def standard(cls):
        b = cls()
        back = [Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook]
        for c, kind in enumerate(back):
            b.grid[0][c] = kind(Color.BLACK)
            b.grid[7][c] = kind(Color.WHITE)
        for c in range(8):
            b.grid[1][c] = Pawn(Color.BLACK)
            b.grid[6][c] = Pawn(Color.WHITE)
        return b

    def in_bounds(self, p):
        return 0 <= p[0] < 8 and 0 <= p[1] < 8

    def piece_at(self, p):
        return self.grid[p[0]][p[1]]

    def place(self, piece, p):
        self.grid[p[0]][p[1]] = piece

    def is_empty(self, p):
        return self.in_bounds(p) and self.piece_at(p) is None

    def is_enemy(self, p, color):
        return self.in_bounds(p) and self.piece_at(p) is not None and self.piece_at(p).color is not color

    def apply(self, move):
        piece = self.piece_at(move.frm)
        self.grid[move.to[0]][move.to[1]] = piece
        self.grid[move.frm[0]][move.frm[1]] = None
        piece.has_moved = True

    def copy(self):
        return copy.deepcopy(self)`,
        highlight: [7, 8, 22, 28, 31, 40],
      },
    },
    {
      title: 'Move object',
      tag: 'concept',
      heading: 'A Move is a value object',
      eli5: 'Each turn the kid writes a small note: who moved, from where, to where, and what was grabbed. The note can be filed, replayed or checked later.',
      body: [
        'A `Move` records `frm`, `to`, the `piece`, what it `captured`, and a `promotion` if any. It has no behavior, only the facts of one turn.',
        'History, undo, en passant and notation all need these facts, so passing positions around as loose tuples would not scale.',
      ],
      keyIdea: 'A move is data. Making it an object gives history, undo and special rules something to share.',
      metrics: { where: 'Piece + Board', edits: 'new class', test: 'empty Board + 1 piece', classes: '12' },
      scene: {
        nodes: [
          { ...piece, at: at(-4, -3) },
          { ...board, at: at(0, -3) },
          { ...move, at: at(4, 3), status: 'active', chips: ['frm=(6,4)', 'to=(4,4)', 'captured=None'] },
        ],
        links: [link('board', 'move', { label: 'creates' }), link('move', 'piece', { label: 'has-a', route: 'straight' })],
        panel: {
          title: 'Move',
          icon: 'Code',
          code: '@dataclass\nclass Move:\n    frm: tuple\n    to: tuple\n    piece: Piece\n    captured: Piece = None\n    promotion: type = None\n    gives_check: bool = False',
        },
        caption: 'The facts of one turn',
      },
      code: {
        language: 'python',
        title: 'Move',
        source: `from dataclasses import dataclass

@dataclass
class Move:
    frm: tuple
    to: tuple
    piece: Piece
    captured: Piece = None
    promotion: type = None   # Queen, Rook, Bishop or Knight
    rule: object = None      # the MoveRule that built it (next section)
    gives_check: bool = False`,
        highlight: [4, 7, 8],
      },
    },
    {
      title: 'Game',
      tag: 'concept',
      heading: 'Game coordinates turns, Board holds state',
      eli5: 'The **referee** says whose turn it is, asks the kid "can you go there?", tells the board to move, and writes the note in the logbook. He does not know how any piece walks.',
      body: [
        '`Game` owns the `Board`, whose `turn` it is, and the `history` list. `play(frm, to)` checks the piece is yours, asks it for moves, applies one, records it and flips the turn.',
        'Three jobs, three owners: pieces know movement, the board knows squares, the game knows turns.',
      ],
      keyIdea: 'Split by responsibility: Piece for movement, Board for squares, Game for turns and history.',
      metrics: { where: 'Piece + Board + Game', edits: 'new class', test: 'empty Board + 1 piece', classes: '13' },
      metricTones: { where: 'good', test: 'good' },
      scene: {
        nodes: [player, { ...game, status: 'active' }, { ...piece, at: at(0, 3) }, { ...board, at: at(4, 3) }],
        links: [link('player', 'game'), link('game', 'piece', { label: 'uses' }), link('game', 'board', { label: 'has-a' })],
        flows: [
          { path: ['player', 'game'], tone: 'request', label: 'play(frm, to)', duration: 1.3 },
          { path: ['game', 'piece'], tone: 'request', label: 'valid_moves()', duration: 1.3, delay: 1.4 },
          { path: ['game', 'board'], tone: 'data', label: 'apply(move)', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'play() in order',
          icon: 'List',
          rows: [
            { text: '1. piece is yours?', value: 'turn check' },
            { text: '2. destination allowed?', value: 'valid_moves' },
            { text: '3. board.apply(move)', value: 'mutate' },
            { text: '4. history.append', value: 'record' },
            { text: '5. flip turn', value: 'other color' },
          ],
        },
        caption: 'The game sequences the steps',
      },
      code: {
        language: 'python',
        title: 'v3: Game.play (first version)',
        source: `class Game:
    def __init__(self):
        self.board = Board.standard()
        self.turn = Color.WHITE
        self.history = []

    def play(self, frm, to):
        piece = self.board.piece_at(frm)
        if piece is None or piece.color is not self.turn:
            raise ValueError("not your piece")
        if to not in piece.valid_moves(self.board, frm):
            raise ValueError("illegal move")
        move = Move(frm, to, piece, captured=self.board.piece_at(to))
        self.board.apply(move)
        self.history.append(move)
        self.turn = self.turn.opposite()`,
        highlight: [8, 9, 11, 12, 13, 14, 15, 16],
      },
      quiz: {
        question: 'Why does a Rook receive the board as an argument to valid_moves instead of storing its own map of the squares?',
        options: [
          'Pieces would otherwise copy the grid and drift out of sync with it',
          'Python cannot store a list inside an object',
          'Only the Rook needs to know where other pieces are',
          'It makes valid_moves run faster than a lookup table',
        ],
        answer: 0,
        explain: 'One class owns the squares (Board). Pieces read it when asked, so there is a single source of truth and nothing to keep in sync.',
      },
    },
    {
      title: 'Special moves',
      tag: 'problem',
      heading: 'Castling, en passant and promotion do not fit valid_moves',
      eli5: 'Some tricks need the logbook, not just the table. "Did the king already move?" and "what did the other kid just do?" are things one kid on their own cannot know.',
      body: [
        '`valid_moves(board, pos)` sees only the board. **Castling** needs `has_moved` flags and attacked squares. **En passant** needs the last move. **Promotion** replaces the piece.',
        'Stuffing these into `Pawn` or `King` forces them to know about `Game`. Stuffing them into `Game.play` brings back the big branch.',
      ],
      keyIdea: 'Rules that depend on game state need a home that can see the game, but not inside play().',
      metrics: { where: 'Piece + Board + Game', edits: 'where?', test: 'empty Board + 1 piece', classes: '13' },
      metricTones: { edits: 'warn' },
      scene: {
        nodes: [
          { ...piece, at: at(-4, -3), sub: 'sees the board only' },
          { ...game, at: at(0, -3), status: 'hot', badge: 'if castling...' },
          blk('rules', 'Special rules', 'need game state', 'Star', 'amber', 4, -3),
        ],
        links: [link('rules', 'piece', { label: 'does not fit', labelTone: 'warn', route: 'straight' }), link('rules', 'game', { label: 'bloats play()', labelTone: 'warn' })],
        panel: {
          title: 'What each rule needs',
          icon: 'Table',
          rows: [
            { text: 'Castling', value: 'has_moved, attacked squares', tone: 'warn' },
            { text: 'En passant', value: 'last move in history', tone: 'warn' },
            { text: 'Promotion', value: 'swap the pawn', tone: 'warn' },
            { text: 'Normal move', value: 'piece + board', tone: 'good' },
          ],
        },
        caption: 'Where do state-dependent rules live?',
      },
    },
    {
      title: 'MoveRule',
      tag: 'concept',
      heading: 'v4: each special move is a Strategy',
      eli5: 'The club keeps a **rule card** for each trick. The referee flips through the cards and asks each one "does your trick work here?" New trick, new card, no rulebook edit.',
      body: [
        '`MoveRule` is an interface. `moves(game, frm)` returns the moves this rule allows for the piece at `frm` (empty when it does not apply). `execute(board, move)` carries one out.',
        'Even ordinary moves become a `NormalRule` wrapping `valid_moves`. `Game` asks every rule and never branches on move type.',
      ],
      keyIdea: 'Strategy: a family of rule objects behind one interface. Adding a rule means adding a class.',
      metrics: { where: 'one MoveRule each', edits: 'new class', test: 'one rule + game', classes: '15' },
      metricTones: { where: 'good', edits: 'good' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3) },
          { ...rule, at: at(0, -3), status: 'active' },
          blk('normal', 'NormalRule', 'valid_moves', 'Code', 'green', -2, 3),
          blk('castling', 'CastlingRule', 'king + rook', 'Code', 'green', 2, 3),
        ],
        links: [link('game', 'rule', { label: 'uses' }), link('normal', 'rule', { label: 'implements' }), link('castling', 'rule', { label: 'implements' })],
        flows: [
          { path: ['game', 'rule'], tone: 'request', label: 'moves(game, frm)', duration: 1.4 },
          { path: ['rule', 'game'], tone: 'response', label: '[Move, ...]', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'MoveRule contract',
          icon: 'Braces',
          code: 'class MoveRule(ABC):\n    @abstractmethod\n    def moves(self, game, frm):\n        """Moves this rule allows."""\n\n    @abstractmethod\n    def execute(self, board, move): ...',
        },
        caption: 'Game asks every rule',
      },
      code: {
        language: 'python',
        title: 'MoveRule and NormalRule',
        source: `class MoveRule(ABC):
    @abstractmethod
    def moves(self, game, frm):
        """Return Move objects this rule allows for the piece at frm."""

    @abstractmethod
    def execute(self, board, move):
        """Apply the move, including side effects."""

class NormalRule(MoveRule):
    def moves(self, game, frm):
        piece = game.board.piece_at(frm)
        out = []
        for to in piece.valid_moves(game.board, frm):
            if isinstance(piece, Pawn) and to[0] in (0, 7):
                continue  # PromotionRule owns these
            out.append(Move(frm, to, piece, game.board.piece_at(to), rule=self))
        return out

    def execute(self, board, move):
        board.apply(move)`,
        highlight: [1, 7, 11, 16, 17],
      },
    },
    {
      title: 'Castling',
      tag: 'case',
      heading: 'Case: castling',
      eli5: 'The king and a rook swap places in one move, but only if neither has ever moved, nothing is in between, and the king never crosses a square where he could be grabbed.',
      body: [
        'Castling needs: king and rook unmoved, empty squares between them, the king not in check, and no square the king crosses attacked.',
        '`execute` moves the king two squares, then the rook to the other side of it. Both moves happen in one turn.',
      ],
      keyIdea: 'All castling conditions live in one class, so you can read and test them together.',
      metrics: { where: 'one MoveRule each', edits: 'new class', test: 'one rule + game', classes: '16' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3) },
          blk('castling', 'CastlingRule', 'implements MoveRule', 'Code', 'green', 0, -3, { status: 'active' }),
          blk('king', 'King', 'has_moved?', 'Code', 'green', 4, -3),
          blk('rookc', 'Rook', 'has_moved?', 'Code', 'green', 0, 3),
        ],
        links: [link('game', 'castling', { label: 'asks' }), link('castling', 'king', { label: 'reads' }), link('castling', 'rookc', { label: 'reads' })],
        panel: {
          title: 'Castling checklist',
          icon: 'List',
          rows: [
            { text: 'King never moved', value: 'has_moved' },
            { text: 'Rook never moved', value: 'has_moved' },
            { text: 'Squares between empty', value: 'board' },
            { text: 'King not in check', value: 'is_attacked' },
            { text: 'Crossed squares safe', value: 'is_attacked' },
          ],
        },
        caption: 'Five conditions, one class',
      },
      code: {
        language: 'python',
        title: 'CastlingRule',
        source: `class CastlingRule(MoveRule):
    def moves(self, game, frm):
        b = game.board
        king = b.piece_at(frm)
        if not isinstance(king, King) or king.has_moved:
            return []
        enemy, r, out = king.color.opposite(), frm[0], []
        if b.is_attacked(frm, enemy):
            return []                              # cannot castle out of check
        for rook_col, step in ((7, 1), (0, -1)):
            rook = b.piece_at((r, rook_col))
            if not isinstance(rook, Rook) or rook.has_moved:
                continue
            between = range(min(4, rook_col) + 1, max(4, rook_col))
            if any(b.piece_at((r, c)) for c in between):
                continue
            crossed = [(r, 4 + step), (r, 4 + 2 * step)]
            if any(b.is_attacked(sq, enemy) for sq in crossed):
                continue
            out.append(Move(frm, (r, 4 + 2 * step), king, rule=self))
        return out

    def execute(self, board, move):
        board.apply(move)
        r, c = move.to
        rook_from, rook_to = (r, 7 if c == 6 else 0), (r, 5 if c == 6 else 3)
        board.apply(Move(rook_from, rook_to, board.piece_at(rook_from)))`,
        highlight: [5, 8, 13, 16, 22, 23, 24, 25],
      },
    },
    {
      title: 'En passant',
      tag: 'case',
      heading: 'Case: en passant needs the history',
      eli5: 'If the kid next to you just took a double step past you, you may grab him as if he had stepped only once. But only right now. Next turn the chance is gone.',
      body: [
        'En passant is legal only if the **last move** was an enemy pawn advancing two squares and landing beside your pawn. Only `game.history[-1]` can tell you.',
        'The capture lands on the empty square behind that pawn, so `execute` must also remove a pawn that is not on the destination square.',
      ],
      keyIdea: 'A rule that reads history gets the whole game as input, which is why it is a Strategy and not a Piece method.',
      metrics: { where: 'one MoveRule each', edits: 'new class', test: 'one rule + game', classes: '17' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3), chips: ['history[-1]'] },
          blk('enpassant', 'EnPassantRule', 'implements MoveRule', 'Code', 'green', 0, -3, { status: 'active' }),
          blk('lastmove', 'Move', 'enemy pawn, 2 squares', 'Route', 'amber', 4, -3),
        ],
        links: [link('game', 'enpassant', { label: 'asks' }), link('enpassant', 'lastmove', { label: 'reads' })],
        flows: [{ path: ['enpassant', 'lastmove'], tone: 'request', label: 'last move?', duration: 1.4 }],
        panel: {
          title: 'En passant conditions',
          icon: 'List',
          rows: [
            { text: 'Last move', value: 'pawn, 2 squares' },
            { text: 'Landed', value: 'same row, next column' },
            { text: 'Destination', value: 'square behind it' },
            { text: 'Capture removes', value: 'a pawn off the target', tone: 'warn' },
          ],
        },
        caption: 'The last move decides',
      },
      code: {
        language: 'python',
        title: 'EnPassantRule',
        source: `class EnPassantRule(MoveRule):
    def moves(self, game, frm):
        pawn = game.board.piece_at(frm)
        if not isinstance(pawn, Pawn) or not game.history:
            return []
        last = game.history[-1]
        if not (isinstance(last.piece, Pawn) and abs(last.to[0] - last.frm[0]) == 2):
            return []
        if last.to[0] != frm[0] or abs(last.to[1] - frm[1]) != 1:
            return []
        to = (frm[0] + pawn._dir(), last.to[1])
        return [Move(frm, to, pawn, captured=last.piece, rule=self)]

    def execute(self, board, move):
        board.grid[move.frm[0]][move.to[1]] = None   # the captured pawn
        board.apply(move)`,
        highlight: [6, 7, 9, 14],
      },
    },
    {
      title: 'Promotion',
      tag: 'case',
      heading: 'Case: promotion replaces the piece',
      eli5: 'When a pawn kid reaches the far wall, he trades his costume for a bigger one. The player picks which, and the club swaps the card on that square.',
      body: [
        'A pawn that reaches the last row must become a Queen, Rook, Bishop or Knight. `PromotionRule` offers one move per choice, so the caller picks with `promotion=Queen`.',
        '`execute` moves the pawn, then puts a new piece of the same color on the square. `NormalRule` skips these moves so they are never legal as plain pawn steps.',
      ],
      keyIdea: 'A choice is part of the move. Offering one Move per option keeps play() free of special cases.',
      metrics: { where: 'one MoveRule each', edits: 'new class', test: 'one rule + game', classes: '18' },
      scene: {
        nodes: [
          blk('pawn', 'Pawn', 'on last row', 'Code', 'green', -4, -3),
          blk('promo', 'PromotionRule', 'implements MoveRule', 'Code', 'green', 0, -3, { status: 'active' }),
          { ...move, at: at(4, -3), sub: 'promotion=Queen' },
          blk('queen', 'Queen', 'new piece', 'Star', 'green', 0, 3),
        ],
        links: [link('promo', 'pawn', { label: 'reads' }), link('promo', 'move', { label: 'creates' }), link('promo', 'queen', { label: 'creates' })],
        panel: {
          title: 'One Move per choice',
          icon: 'Table',
          rows: [
            { text: 'Move(..., promotion=Queen)', value: 'offered' },
            { text: 'Move(..., promotion=Rook)', value: 'offered' },
            { text: 'Move(..., promotion=Bishop)', value: 'offered' },
            { text: 'Move(..., promotion=Knight)', value: 'offered' },
          ],
        },
        caption: 'The new piece comes from the move',
      },
      code: {
        language: 'python',
        title: 'PromotionRule',
        source: `class PromotionRule(MoveRule):
    CHOICES = (Queen, Rook, Bishop, Knight)

    def moves(self, game, frm):
        pawn = game.board.piece_at(frm)
        if not isinstance(pawn, Pawn):
            return []
        return [
            Move(frm, to, pawn, game.board.piece_at(to), promotion=kind, rule=self)
            for to in pawn.valid_moves(game.board, frm) if to[0] in (0, 7)
            for kind in self.CHOICES
        ]

    def execute(self, board, move):
        board.apply(move)
        board.place(move.promotion(move.piece.color), move.to)`,
        highlight: [2, 8, 9, 10, 15],
      },
    },
    {
      title: 'Legal moves',
      tag: 'concept',
      heading: 'Pseudo-legal versus legal moves',
      eli5: 'A kid may know a step is allowed for his piece, but the referee still says no if that step leaves the king in danger. Try the step on a spare table first and see.',
      body: [
        'Rules give **pseudo-legal** moves: legal for the piece, ignoring the king. A move is **legal** only if your own king is not attacked afterwards. This covers pinned pieces and a king stepping into check.',
        '`Game.legal_moves` tries each move on a `board.copy()` and keeps it only when the king is safe. The real board is never touched.',
      ],
      keyIdea: 'Generate pseudo-legal moves from rules, then filter by simulating each one on a copy.',
      metrics: { where: 'rules + Game filter', edits: 'new class', test: 'one rule + game', classes: '18' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3), status: 'active' },
          blk('rules', 'MoveRules', 'pseudo-legal', 'Braces', 'violet', 0, -3),
          { ...board, at: at(4, -3), label: 'Board copy', sub: 'trial only', status: 'dim' },
        ],
        links: [link('game', 'rules', { label: 'asks' }), link('game', 'board', { label: 'tries move on', route: 'straight' })],
        flows: [
          { path: ['game', 'rules'], tone: 'request', label: 'moves()', duration: 1.3 },
          { path: ['game', 'board'], tone: 'data', label: 'execute(copy)', duration: 1.3, delay: 1.4 },
          { path: ['board', 'game'], tone: 'response', label: 'king safe?', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Filtered out',
          icon: 'Shield',
          rows: [
            { text: 'Pinned piece moves away', value: 'king exposed', tone: 'bad' },
            { text: 'King steps next to a rook', value: 'king attacked', tone: 'bad' },
            { text: 'Block or capture the checker', value: 'king safe', tone: 'good' },
          ],
        },
        caption: 'Simulate, then decide',
      },
      code: {
        language: 'python',
        title: 'Board.is_attacked and Game.legal_moves',
        source: `# on Board
def find_king(self, color):
    for r in range(8):
        for c in range(8):
            p = self.grid[r][c]
            if isinstance(p, King) and p.color is color:
                return (r, c)

def is_attacked(self, sq, by_color):
    for r in range(8):
        for c in range(8):
            p = self.grid[r][c]
            if p and p.color is by_color and sq in p.attacks(self, (r, c)):
                return True
    return False

# on Game
def legal_moves(self, frm):
    piece = self.board.piece_at(frm)
    if piece is None or piece.color is not self.turn:
        return []
    legal = []
    for rule in self.rules:
        for m in rule.moves(self, frm):
            trial = self.board.copy()
            m.rule.execute(trial, m)
            if not trial.is_attacked(trial.find_king(self.turn), self.turn.opposite()):
                legal.append(m)
    return legal`,
        highlight: [9, 13, 24, 25, 26, 27],
      },
    },
    {
      title: 'Check observer',
      tag: 'concept',
      heading: 'v5: check is announced by an Observer',
      eli5: 'After every move, a watcher kid looks at the board and shouts "check!" if a king is in danger. The referee does not do the watching, he only rings the bell.',
      body: [
        'After each move `Game` calls `on_move(game, move)` on every registered `MoveObserver`. `CheckDetector` looks at the opponent king and sets `game.status`.',
        'Play logic stays small, and new watchers (repetition, clocks, logging) plug in without editing `Game`.',
      ],
      keyIdea: 'Observer: Game announces what happened and does not know who is listening.',
      metrics: { where: 'rules + observers', edits: 'new class', test: 'one observer + game', classes: '20' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3), status: 'active' },
          { ...observer, at: at(0, -3) },
          blk('checkdet', 'CheckDetector', 'implements', 'Shield', 'green', 4, -3),
        ],
        links: [link('game', 'observer', { label: 'notifies' }), link('checkdet', 'observer', { label: 'implements', route: 'straight' })],
        flows: [
          { path: ['game', 'observer', 'checkdet'], tone: 'event', label: 'on_move(game, move)', duration: 1.8 },
          { path: ['checkdet', 'game'], tone: 'response', label: 'status = CHECK', duration: 1.6, delay: 1.9 },
        ],
        panel: {
          title: 'After each move',
          icon: 'List',
          rows: [
            { text: 'Game flips the turn', value: 'first' },
            { text: 'Game calls observers', value: 'in order' },
            { text: 'CheckDetector', value: 'sets status' },
            { text: 'Move.gives_check', value: 'recorded' },
          ],
        },
        caption: 'Game announces, observers react',
      },
      code: {
        language: 'python',
        title: 'Game.play and CheckDetector',
        source: `class Status(Enum):
    ACTIVE = 1
    CHECK = 2
    CHECKMATE = 3
    STALEMATE = 4
    DRAW = 5

    @property
    def is_over(self):
        return self in (Status.CHECKMATE, Status.STALEMATE, Status.DRAW)

class CheckDetector:
    def on_move(self, game, move):
        mover = move.piece.color
        king = game.board.find_king(mover.opposite())
        if game.board.is_attacked(king, mover):
            game.status = Status.CHECK
            move.gives_check = True
        else:
            game.status = Status.ACTIVE`,
        highlight: [11, 12, 14, 15, 16],
      },
    },
    {
      title: 'Mate and stalemate',
      tag: 'concept',
      heading: 'Checkmate and stalemate: no legal moves',
      eli5: 'If the player to move has no allowed step at all, the game stops. If the king is in danger, the watcher shouts "mate". If not, it is a stalemate, a tie.',
      body: [
        'Both outcomes mean the side to move has **no legal move**. In check it is **checkmate** and the mover wins. Not in check it is **stalemate**, a draw.',
        'Because `legal_moves` already filters out king-exposing moves, the old "loop over everything" mate test shrinks to one `any()`.',
      ],
      keyIdea: 'One question decides both: does the side to move have any legal move, and is the king attacked?',
      metrics: { where: 'rules + observers', edits: 'new class', test: 'one observer + game', classes: '20' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3) },
          blk('checkdet', 'CheckDetector', 'observer', 'Shield', 'green', 0, -3, { status: 'active' }),
          blk('over', 'Status', 'enum', 'Hash', 'teal', 4, -3, { chips: [{ text: 'CHECKMATE', tone: 'bad' }, { text: 'STALEMATE', tone: 'warn' }] }),
        ],
        links: [link('game', 'checkdet', { label: 'notifies' }), link('checkdet', 'over', { label: 'sets' })],
        panel: {
          title: 'No legal move',
          icon: 'Table',
          rows: [
            { text: 'King attacked', value: 'CHECKMATE', tone: 'bad' },
            { text: 'King not attacked', value: 'STALEMATE', tone: 'warn' },
            { text: 'Has a legal move', value: 'game continues', tone: 'good' },
          ],
        },
        caption: 'The same test, two outcomes',
      },
      code: {
        language: 'python',
        title: 'CheckDetector with mate and stalemate',
        source: `class CheckDetector:
    def on_move(self, game, move):
        mover = move.piece.color
        king = game.board.find_king(mover.opposite())
        in_check = game.board.is_attacked(king, mover)
        move.gives_check = in_check
        if game.has_legal_move():
            game.status = Status.CHECK if in_check else Status.ACTIVE
        else:
            game.status = Status.CHECKMATE if in_check else Status.STALEMATE

# on Game
def has_legal_move(self):
    return any(self.legal_moves((r, c))
               for r in range(8) for c in range(8))`,
        highlight: [7, 8, 10, 14, 15],
      },
      quiz: {
        question: 'The side to move has no legal moves and its king is not attacked. What is the result?',
        options: ['Checkmate, the other side wins', 'Stalemate, the game is drawn', 'The game continues with a pass', 'Check, and the king must flee'],
        answer: 1,
        explain: 'No legal move plus a safe king is stalemate, a draw. Checkmate needs the king to be attacked as well.',
      },
    },
    {
      title: 'Draw rules',
      tag: 'concept',
      heading: 'Draws are just more observers',
      eli5: 'More watcher kids join: one counts how often the same picture of the table appears, another counts quiet turns. Each rings the bell on its own rule.',
      body: [
        '**Threefold repetition**: the same position three times. A counter keyed by a position tuple does it.',
        'The **fifty-move rule** keeps a half-move counter that resets on a capture or pawn move and draws at 100. **Insufficient material** draws when no mate is possible: K vs K, K+B vs K, K+N vs K.',
        'The key is piece type and color per square, the turn, castling rights and the en passant target.',
      ],
      keyIdea: 'Each end condition is its own observer, so none of them touches Game or the others.',
      metrics: { where: 'rules + observers', edits: 'new class', test: 'one observer + game', classes: '23' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3) },
          { ...observer, at: at(0, -3) },
          blk('repeat', 'RepetitionObserver', 'threefold', 'Repeat', 'green', 4, -3, { status: 'active' }),
          blk('fifty', 'FiftyMoveObserver', '100 half-moves', 'Clock', 'green', 0, 3),
        ],
        links: [link('game', 'observer', { label: 'notifies' }), link('repeat', 'observer', { label: 'implements', route: 'straight' }), link('fifty', 'observer', { label: 'implements' })],
        panel: {
          title: 'Draw conditions',
          icon: 'List',
          rows: [
            { text: 'Stalemate', value: 'no legal move, no check' },
            { text: 'Threefold repetition', value: 'same position x3' },
            { text: 'Fifty-move rule', value: '100 half-moves' },
            { text: 'Insufficient material', value: 'K vs K, K+B/N vs K' },
          ],
        },
        caption: 'One observer per condition',
      },
      code: {
        language: 'python',
        title: 'RepetitionObserver',
        source: `class RepetitionObserver:
    def on_move(self, game, move):
        if game.status.is_over:
            return
        key = self._key(game)
        game.position_counts[key] = game.position_counts.get(key, 0) + 1
        if game.position_counts[key] >= 3:
            game.status = Status.DRAW

    def _key(self, game):
        cells = tuple(
            (type(p).__name__, p.color) if p else None
            for row in game.board.grid for p in row
        )
        return (cells, game.turn, game.castling_rights(), game.en_passant_target())


class FiftyMoveObserver:
    def on_move(self, game, move):
        if move.captured or isinstance(move.piece, Pawn):
            game.halfmoves = 0
        else:
            game.halfmoves += 1
        if game.halfmoves >= 100:
            game.status = Status.DRAW`,
        highlight: [3, 5, 6, 7, 10, 11, 17, 18, 19, 20, 21, 22, 23],
      },
    },
    {
      title: 'Undo problem',
      tag: 'problem',
      heading: 'Undo: more state than the grid',
      eli5: 'A kid says "take it back!" The club must restore the table exactly: not just who stood where, but who had already moved, whose turn it was, and what the logbook said.',
      body: [
        'Putting the piece back is not enough. A move also changed `has_moved` flags (castling rights), the turn, the history, the status, and the repetition counts.',
        'Reversing each side effect by hand is easy to get wrong, especially for castling and en passant.',
      ],
      keyIdea: 'Undo has to restore everything a move touched. Missing one field gives a board that looks right and plays wrong.',
      metrics: { where: 'rules + observers', edits: 'new class', test: 'one observer + game', classes: '23' },
      metricTones: { edits: 'warn' },
      scene: {
        nodes: [
          { ...player, label: 'Player', sub: 'asks undo()' },
          { ...game, status: 'hot', badge: 'what changed?' },
          { ...board, chips: [{ text: 'has_moved', tone: 'warn' }, 'grid'] },
        ],
        links: [link('player', 'game', { label: 'undo()' }), link('game', 'board', { label: 'restore?', labelTone: 'warn' })],
        panel: {
          title: 'One move changes',
          icon: 'Table',
          rows: [
            { text: 'grid squares', value: '2 (castling: 4)' },
            { text: 'has_moved flags', value: 'king, rook', tone: 'warn' },
            { text: 'turn, status, history', value: 'game fields', tone: 'warn' },
            { text: 'position counts', value: 'observer state', tone: 'warn' },
          ],
        },
        caption: 'Many fields change per move',
      },
    },
    {
      title: 'Memento',
      tag: 'concept',
      heading: 'v6: undo with a Memento',
      eli5: 'Before every move a photographer takes a **photo** of the table and the logbook. To undo, the club just puts the photo back. Nobody has to remember what changed.',
      body: [
        'A `Snapshot` (the **Memento**) saves a deep copy of the grid plus `turn`, `status`, `history` length and position counts. `Game` is the **caretaker** and only stores them on a stack.',
        '`undo()` pops one and restores. If a move fails halfway, the same snapshot rolls the game back.',
      ],
      keyIdea: 'Memento: save the whole state before a change, restore it to undo. Nothing needs to know what a move touched.',
      metrics: { where: 'rules + observers', edits: 'new class', test: 'one observer + game', classes: '24' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3), status: 'active' },
          blk('snapshot', 'Snapshot', 'memento', 'Copy', 'amber', 0, -3, { chips: ['grid', 'turn', 'status'] }),
          blk('stack', 'undo_stack', 'list of Snapshot', 'List', 'gray', 4, -3),
        ],
        links: [link('game', 'snapshot', { label: 'creates' }), link('snapshot', 'stack', { label: 'pushed on' })],
        flows: [
          { path: ['game', 'snapshot'], tone: 'data', label: 'Snapshot(game)', duration: 1.3 },
          { path: ['snapshot', 'stack'], tone: 'data', label: 'push', duration: 1.3, delay: 1.4 },
          { path: ['stack', 'game'], tone: 'response', label: 'undo(): restore', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Snapshot holds',
          icon: 'Copy',
          rows: [
            { text: 'grid (deep copy)', value: 'includes has_moved' },
            { text: 'turn and status', value: 'copied' },
            { text: 'history length', value: 'trim on restore' },
            { text: 'position counts', value: 'copied' },
          ],
        },
        caption: 'Photo before, photo back',
      },
      code: {
        language: 'python',
        title: 'Snapshot and Game.undo',
        source: `class Snapshot:
    def __init__(self, game):
        self.grid = copy.deepcopy(game.board.grid)
        self.turn = game.turn
        self.status = game.status
        self.history_len = len(game.history)
        self.counts = dict(game.position_counts)

    def restore(self, game):
        game.board.grid = self.grid
        game.turn, game.status = self.turn, self.status
        del game.history[self.history_len:]
        game.position_counts = self.counts

# on Game
def undo(self):
    if not self.undo_stack:
        raise ValueError("nothing to undo")
    self.undo_stack.pop().restore(self)`,
        highlight: [3, 4, 5, 6, 7, 10, 18],
      },
    },
    {
      title: 'Snapshot tradeoff',
      tag: 'tradeoff',
      heading: 'Snapshot or reverse the move?',
      eli5: 'Taking a photo of the whole table is simple but a bit wasteful. Writing down how to un-do each trick is neat but easy to get wrong. A small table can afford photos.',
      body: [
        'A snapshot copies 64 squares per move. That is trivial for a game, and it is correct by construction. Reversing moves stores less but needs per-rule undo logic.',
        'A search engine that explores millions of positions per second uses make/unmake instead, and pays for it in careful code.',
      ],
      keyIdea: 'Use snapshots for a game, where simplicity beats speed. Reverse moves only when profiling demands it.',
      metrics: { where: 'rules + observers', edits: 'new class', test: 'one observer + game', classes: '24' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3) },
          blk('memento', 'Snapshot', 'copy everything', 'Copy', 'amber', 0, -3, { status: 'ok' }),
          blk('reverse', 'Reverse move', 'undo per rule', 'Repeat', 'gray', 4, -3, { status: 'dim' }),
        ],
        links: [link('game', 'memento', { label: 'default' }), link('game', 'reverse', { label: 'for engines', route: 'straight' })],
        panel: {
          title: 'Two ways to undo',
          icon: 'Scale',
          rows: [
            { text: 'Snapshot', value: 'simple, 64 squares per move', tone: 'good' },
            { text: 'Snapshot', value: 'memory grows with moves', tone: 'warn' },
            { text: 'Reverse move', value: 'tiny memory, fast', tone: 'good' },
            { text: 'Reverse move', value: 'each rule needs an inverse', tone: 'bad' },
          ],
        },
        caption: 'Simplicity against speed',
      },
      code: {
        language: 'python',
        title: 'Game.play with rules, observers and rollback',
        source: `def __init__(self, rules, observers, board=None):
    self.board = board or Board.standard()
    self.rules, self.observers = rules, observers
    self.turn, self.status = Color.WHITE, Status.ACTIVE
    self.history, self.undo_stack, self.position_counts = [], [], {}

def play(self, frm, to, promotion=None):
    if self.status.is_over:
        raise ValueError("game is over")
    move = next((m for m in self.legal_moves(frm)
                 if m.to == to and m.promotion == promotion), None)
    if move is None:
        raise ValueError("illegal move")
    snap = Snapshot(self)
    try:
        move.rule.execute(self.board, move)
        self.history.append(move)
        self.turn = self.turn.opposite()
        for obs in self.observers:
            obs.on_move(self, move)
    except Exception:
        snap.restore(self)   # board is back as it was
        raise
    self.undo_stack.append(snap)`,
        highlight: [10, 14, 15, 19, 20, 21],
      },
    },
    {
      title: 'New variant',
      tag: 'case',
      heading: 'Case: a variant adds classes, not edits',
      eli5: 'The club invents "three checks and you win". They hire one new watcher kid with a counter. The referee and the rule cards stay exactly as they were.',
      body: [
        'In **three-check chess** the third check wins. `ThreeCheckObserver` counts `gives_check` flags in `history`, so undo trims the count for free.',
        '**Fischer Random** changes the start: a different `Board` factory and a `CastlingRule` that reads the real rook columns. Same `Game`.',
      ],
      keyIdea: 'Keep observer state derived from history or inside the snapshot, and a variant is a new class.',
      metrics: { where: 'new class only', edits: 'new class', test: 'one observer + game', classes: '26' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3) },
          { ...observer, at: at(0, -3) },
          blk('three', 'ThreeCheckObserver', 'new class', 'Star', 'green', 4, -3, { status: 'active' }),
          blk('f960', 'Chess960Board', 'new start', 'Table', 'green', 0, 3),
        ],
        links: [link('game', 'observer', { label: 'notifies' }), link('three', 'observer', { label: 'implements', route: 'straight' })],
        panel: {
          title: 'Files edited',
          icon: 'FileCode',
          rows: [
            { text: 'Game', value: '0 edits', tone: 'good' },
            { text: 'Piece classes', value: '0 edits', tone: 'good' },
            { text: 'ThreeCheckObserver', value: 'new file', tone: 'good' },
          ],
        },
        caption: 'Extend by adding',
      },
      code: {
        language: 'python',
        title: 'ThreeCheckObserver',
        source: `class ThreeCheckObserver:
    def on_move(self, game, move):
        if game.status.is_over or not move.gives_check:
            return
        color = move.piece.color
        checks = sum(1 for m in game.history
                     if m.piece.color is color and m.gives_check)
        if checks >= 3:
            game.status = Status.CHECKMATE

game = Game(rules=[NormalRule(), CastlingRule(), EnPassantRule(), PromotionRule()],
            observers=[CheckDetector(), ThreeCheckObserver()])`,
        highlight: [2, 5, 6, 10, 11],
      },
    },
    {
      title: 'Testing',
      tag: 'concept',
      heading: 'Small classes are easy to test',
      eli5: 'To test one kid, put just that kid and a few blockers on an empty table. No full game, no referee. That is why every piece and rule card got its own class.',
      body: [
        'A rook test needs an empty `Board`, a rook and a blocker. A castling test needs a `Game` and three pieces. None needs the 32-piece start position.',
        'The v1 design needed a full board for every test. This one tests each behavior where it lives.',
      ],
      keyIdea: 'Separate classes mean each rule is tested alone on a tiny position.',
      metrics: { where: 'one class each', edits: 'new class', test: 'one piece + board', classes: '26' },
      metricTones: { test: 'good' },
      scene: {
        nodes: [
          blk('test', 'Test', 'pytest', 'Bug', 'gray', -4, -3),
          { ...rook, at: at(0, -3), status: 'active' },
          { ...board, at: at(4, -3), label: 'Board()', sub: 'empty' },
        ],
        links: [link('test', 'rook', { label: 'calls' }), link('test', 'board', { label: 'builds', style: 'faint' })],
        flows: [{ path: ['test', 'rook'], tone: 'request', label: 'valid_moves()', duration: 1.4 }],
        panel: {
          title: 'Before and after',
          icon: 'Table',
          rows: [
            { text: 'v1: test one rook', value: 'full board', tone: 'bad' },
            { text: 'v2+: test one rook', value: '3 pieces', tone: 'good' },
            { text: 'Test castling', value: 'Game + 3 pieces', tone: 'good' },
            { text: 'Test a new variant', value: 'one observer', tone: 'good' },
          ],
        },
        caption: 'A tiny position per test',
      },
      code: {
        language: 'python',
        title: 'Testing a Rook',
        source: `def test_rook_stops_at_own_piece_and_captures_enemy():
    b = Board()
    rook = Rook(Color.WHITE)
    b.place(rook, (4, 4))
    b.place(Pawn(Color.WHITE), (4, 6))   # own piece blocks
    b.place(Pawn(Color.BLACK), (2, 4))   # enemy can be captured
    moves = rook.valid_moves(b, (4, 4))
    assert (4, 5) in moves and (4, 6) not in moves
    assert (2, 4) in moves and (1, 4) not in moves`,
        highlight: [5, 6, 8, 9],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Six versions, four patterns',
      eli5: 'The club ended with kids who know their own walks, a table, a referee, rule cards, watchers and a photographer. Each has one job, so new tricks mean new kids, not a new rulebook.',
      body: [
        'Polymorphism gave each piece its movement. Board, Move and Game split state, facts and turns. **Strategy** (MoveRule) holds the special moves, **Observer** reports check and draws, **Memento** powers undo.',
        'A new rule is a new class instead of an edit to existing code.',
      ],
      keyIdea: 'When rules multiply, give each rule an object. Open for extension, closed for modification.',
      metrics: { where: 'one class each', edits: 'new class', test: 'one piece + board', classes: '26' },
      metricTones: { where: 'good', edits: 'good', test: 'good' },
      scene: {
        nodes: [
          { ...game, at: at(-4, -3), status: 'ok' },
          blk('strategy', 'Strategy', 'MoveRule', 'Braces', 'violet', 0, -3),
          blk('obs', 'Observer', 'MoveObserver', 'Braces', 'violet', 4, -3),
          blk('mem', 'Memento', 'Snapshot', 'Copy', 'amber', 0, 3),
        ],
        links: [link('game', 'strategy', { label: 'uses' }), link('game', 'obs', { label: 'notifies', route: 'straight' }), link('game', 'mem', { label: 'creates' })],
        panel: {
          title: 'Pattern map',
          icon: 'Table',
          rows: [
            { text: 'Polymorphism', value: 'Piece subclasses' },
            { text: 'Strategy', value: 'castling, en passant, promotion' },
            { text: 'Observer', value: 'check, mate, draws' },
            { text: 'Memento', value: 'undo' },
          ],
        },
        caption: 'Rules as objects',
      },
      quiz: {
        question: 'You want to add a new rule, such as a variant where a piece can jump once per game. Where does the change go?',
        options: [
          'A new MoveRule class registered with Game',
          'A new branch inside Game.play',
          'A new if inside Board.apply',
          'Copy Rook and change its directions',
        ],
        answer: 0,
        explain: 'Special moves are Strategy objects. Registering a new MoveRule extends the engine without editing Game, Board or the existing rules.',
      },
    },
  ],
};
