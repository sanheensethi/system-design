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

const player = (pos: [number, number] = TL, extra: Partial<SceneNode> = {}) => blk('player', pos, 'Player', 'plays a mark', 'green', 'User', extra);
const game = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('game', pos, 'Game', 'the referee', 'green', 'Workflow', extra);
const board = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('board', pos, 'Board', 'the chalk grid', 'green', 'Table', extra);
const playerI = (pos: [number, number] = TM, extra: Partial<SceneNode> = {}) => blk('playerI', pos, 'Player', 'abstract', 'blue', 'User', extra);
const human = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('human', pos, 'Human', 'concrete', 'green', 'User', extra);
const randomAI = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('randomAI', pos, 'RandomAI', 'concrete', 'green', 'Zap', extra);
const minimax = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('minimax', pos, 'MinimaxAI', 'concrete', 'green', 'Binary', extra);
const observerI = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('observerI', pos, 'Observer', 'interface', 'violet', 'Plug', extra);
const view = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('view', pos, 'ConsoleView', 'concrete', 'green', 'Code', extra);
const score = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('score', pos, 'Scoreboard', 'concrete', 'green', 'Star', extra);
const cmd = (pos: [number, number] = BL, extra: Partial<SceneNode> = {}) => blk('cmd', pos, 'MoveCommand', 'concrete', 'green', 'Receipt', extra);
const history = (pos: [number, number] = BR, extra: Partial<SceneNode> = {}) => blk('history', pos, 'history', 'stack of commands', 'green', 'List', extra);
const memento = (pos: [number, number] = BM, extra: Partial<SceneNode> = {}) => blk('memento', pos, 'Snapshot', 'saved counters', 'green', 'Copy', extra);

export const lldTicTacToe: Lesson = {
  id: 'lld-tic-tac-toe',
  title: 'Tic-tac-toe',
  tagline: 'A tiny game that teaches how a design grows: a faster win check, a bigger board, pluggable players, observers and undo.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Pull the objects and the rules out of a vague prompt',
    'The simple version: a 2D array and a full scan of every line, and why it costs O(n²) a move',
    'Running counters that check a win in O(1)',
    'Generalizing to N by N, many players and k in a row',
    'Invalid moves, wins and draws as clear results',
    'Strategy for human, random and minimax players, Observer for views and scores, Command and Memento for undo',
  ],
  metrics: [
    { key: 'cost', label: 'Win check cost', icon: 'Timer' },
    { key: 'size', label: 'Board', icon: 'Table' },
    { key: 'players', label: 'Players', icon: 'Users' },
    { key: 'undo', label: 'Undo', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'The rules',
      tag: 'problem',
      heading: 'Looks trivial, so what is there to design?',
      eli5: 'Two kids draw a **grid** on the playground with chalk and take turns. Someone has to say whose turn it is, whether a square is taken and who won.',
      body: [
        'Tic-tac-toe has 5 rules: a 3 by 3 board, two players who alternate, a mark goes only on an empty cell, three in a row wins, and a full board with no winner is a draw.',
        'The interview is never about the rules. It is about what happens when the interviewer asks "now make it N by N", "add a computer player" or "add undo". A good first design survives those follow-ups.',
      ],
      keyIdea: 'The game is small on purpose. The follow-up questions are the real test of the design.',
      metrics: { cost: '?', size: '3 x 3', players: '2', undo: 'no' },
      scene: {
        nodes: [player(TL, { label: 'X and O', chips: ['move(1, 1)'] }), game(TM), board(BM)],
        links: [link('player', 'game', { label: 'move' }), link('game', 'board', { label: 'place' })],
        flows: [
          { path: ['player', 'game'], tone: 'request', label: 'move(1, 1)', duration: 1.2 },
          { path: ['game', 'board'], tone: 'request', label: 'place(X)', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The 5 rules',
          icon: 'List',
          rows: [
            { text: '3 x 3 board' },
            { text: 'Two players take turns' },
            { text: 'Mark only on an empty cell' },
            { text: '3 in a row wins' },
            { text: 'Full board, no winner', value: 'draw' },
          ],
        },
        caption: 'Small rules, big follow-ups',
      },
    },
    {
      title: 'The objects',
      tag: 'concept',
      heading: 'Nouns in the prompt become classes',
      eli5: 'The **game** is the kid who keeps the rules. The **board** is the chalk grid. The **players** are the kids who choose a square.',
      body: [
        'Underline the nouns. **Game** owns the turn order and the result. **Board** owns the cells. **Player** owns a mark such as `X` or `O` and decides where to play next.',
        'A `Move` is just a row and a column, so a tuple is enough. Do not invent a class for every noun. Add one when it carries behavior.',
      ],
      keyIdea: 'Game owns the rules, Board owns the cells, Player owns the choice. Keep each job in one place.',
      metrics: { cost: '?', size: '3 x 3', players: '2', undo: 'no' },
      scene: {
        nodes: [player(TL, { chips: ['mark: X'] }), game(TM, { status: 'active' }), board(BM, { chips: ['cells[3][3]'] })],
        links: [link('game', 'player', { label: 'has-a' }), link('game', 'board', { label: 'has-a' })],
        flows: [
          { path: ['game', 'player'], tone: 'request', label: 'next_move()', duration: 1.2 },
          { path: ['player', 'game'], tone: 'response', label: '(1, 1)', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Who owns what',
          icon: 'Table',
          rows: [
            { text: 'Game', value: 'turns, result' },
            { text: 'Board', value: 'cells' },
            { text: 'Player', value: 'mark, choice' },
            { text: 'Move', value: '(row, col)' },
          ],
        },
        caption: 'One job per class',
      },
    },
    {
      title: 'First version',
      tag: 'concept',
      heading: 'v1: a 2D array and a scan of every line',
      eli5: 'After each turn the referee kid walks along every row, column and diagonal of the chalk grid to see if three marks match.',
      body: [
        'Store the board as a 2D list. After every move, build the 8 lines (3 rows, 3 columns, 2 diagonals) and check whether one is all the same non-empty mark.',
        'It works and it is easy to read. Start here in an interview, then say out loud what you would improve.',
      ],
      keyIdea: 'Always get a correct, simple version on the whiteboard first. Improve it with a reason.',
      metrics: { cost: 'scan all lines', size: '3 x 3', players: '2', undo: 'no' },
      scene: {
        nodes: [game(TL, { status: 'active', chips: ['move(r, c)'] }), board(BM, { chips: ['b[r][c] = X'] }), player(TR, { chips: ['mark: X'] })],
        links: [link('player', 'game', { label: 'move' }), link('game', 'board', { label: 'writes' })],
        flows: [
          { path: ['player', 'game'], tone: 'request', label: 'move(1, 1)', duration: 1.2 },
          { path: ['game', 'board', 'game'], tone: 'request', label: '_winner()', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: '8 lines to check',
          icon: 'Table',
          rows: [
            { text: '3 rows' },
            { text: '3 columns' },
            { text: '2 diagonals' },
            { text: 'Checks per move', value: 'about N² reads', tone: 'warn' },
          ],
        },
        caption: 'Correct first, fast later',
      },
      code: {
        language: 'python',
        title: 'v1: rescan the whole board',
        source: `class TicTacToe:
    def __init__(self):
        self.b = [[" "] * 3 for _ in range(3)]
        self.turn = "X"

    def move(self, r, c):
        if self.b[r][c] != " ":
            return None            # cell taken
        self.b[r][c] = self.turn
        winner = self._winner()
        self.turn = "O" if self.turn == "X" else "X"
        return winner

    def _winner(self):
        lines = self.b + [list(col) for col in zip(*self.b)]
        lines.append([self.b[i][i] for i in range(3)])
        lines.append([self.b[i][2 - i] for i in range(3)])
        for line in lines:
            if line[0] != " " and all(x == line[0] for x in line):
                return line[0]
        return None`,
        highlight: [10, 15, 16, 17, 18],
      },
    },
    {
      title: 'The pain',
      tag: 'tradeoff',
      heading: 'v1 pain: every move rescans the board',
      eli5: 'On a tiny grid the referee walks fast. On a giant chalk grid covering the whole playground, walking every line after every turn takes all day.',
      body: [
        'Each move touches one cell, yet the check reads every cell. On an N by N board that is about N² cells read per move, and N² moves in a game, so a full game costs O(N⁴).',
        'For 3 by 3 nobody notices. For 100 by 100, 10,000 cells are read per move. The fix starts with a question: which lines can this one move possibly complete?',
      ],
      keyIdea: 'A move can only change the lines that pass through its own cell. Checking the rest is wasted work.',
      metrics: { cost: 'O(n²) per move', size: '100 x 100', players: '2', undo: 'no' },
      metricTones: { cost: 'bad' },
      scene: {
        nodes: [game(TL, { status: 'hot', load: 88, badge: '10,000 reads' }), board(BM, { chips: [{ text: '100 x 100', tone: 'warn' }] }), player(TR)],
        links: [link('player', 'game', { label: 'move' }), link('game', 'board', { label: 'reads all', labelTone: 'warn' })],
        flows: [
          { path: ['player', 'game'], tone: 'request', label: 'move', duration: 1 },
          { path: ['game', 'board', 'game'], tone: 'error', label: 'read every cell', count: 3, duration: 1.8, delay: 1.1 },
        ],
        panel: {
          title: 'Cost per move',
          icon: 'Timer',
          rows: [
            { text: '3 x 3', value: '9 reads', tone: 'good' },
            { text: '19 x 19', value: '361 reads', tone: 'warn' },
            { text: '100 x 100', value: '10,000 reads', tone: 'bad' },
          ],
          footer: { text: 'One move changes one cell', tone: 'muted' },
        },
        caption: 'Reading everything to learn about one cell',
      },
    },
    {
      title: 'Counters',
      tag: 'concept',
      heading: 'v2: keep a running count per line',
      eli5: 'Each row, column and diagonal gets a little tally sheet. When a kid draws an X in a square, the referee adds one to the tally of the lines that square sits on.',
      body: [
        'Keep a counter for each row, each column and the 2 diagonals. A move at `(r, c)` updates row `r`, column `c`, the main diagonal if `r == c`, and the anti-diagonal if `r + c == n - 1`. That is 2 to 4 counters.',
        'Count `+1` for X and `-1` for O. A line is won when its counter reaches `+n` or `-n`. No board scan at all.',
      ],
      keyIdea: 'Update only the lines the move touches, and a win check becomes a handful of integer compares.',
      metrics: { cost: 'O(1) per move', size: '3 x 3', players: '2', undo: 'no' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [game(TL, { status: 'active' }), blk('counters', BM, 'Counters', 'rows, cols, diags', 'green', 'Gauge', { status: 'active', chips: [{ text: 'rows[1] = +2', tone: 'warn' }] }), player(TR)],
        links: [link('player', 'game', { label: 'move' }), link('game', 'counters', { label: 'updates' })],
        flows: [
          { path: ['player', 'game'], tone: 'request', label: 'move(1, 1)', duration: 1.1 },
          { path: ['game', 'counters'], tone: 'request', label: 'rows[1] += 1', duration: 1.2, delay: 1.2 },
          { path: ['counters', 'game'], tone: 'response', label: '|count| == n ?', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Move at (1, 1)',
          icon: 'Gauge',
          rows: [
            { text: 'rows[1]', value: '+1' },
            { text: 'cols[1]', value: '+1' },
            { text: 'diag (r == c)', value: '+1' },
            { text: 'anti (r + c == 2)', value: '+1' },
          ],
          footer: { text: '4 counters touched, no scan', tone: 'good' },
        },
        caption: 'Four counters instead of eight lines',
      },
    },
    {
      title: 'Counters code',
      tag: 'concept',
      heading: 'v2 in code: the whole win check is four compares',
      eli5: 'The referee glances at four tally sheets after each turn. If one says all three squares are the same kid, the game is over.',
      body: [
        'The win check no longer reads the board. The board array stays only to reject a move on a taken cell, which is the guard at the top of `move`.',
        'The sign trick `+1` and `-1` needs exactly 2 players. That is the first assumption to remove.',
      ],
      keyIdea: 'Trade a little extra state for a much cheaper check. The state must be updated on every move.',
      metrics: { cost: 'O(1) per move', size: '3 x 3', players: '2', undo: 'no' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [game(TL, { status: 'active', chips: ['turn = +1'] }), blk('counters', BM, 'Counters', 'rows, cols, diags', 'green', 'Gauge', { chips: ['diag = +3'] }), player(TR, { status: 'ok', badge: 'X wins' })],
        links: [link('game', 'counters', { label: 'abs(c) == n' }), link('game', 'player', { label: 'winner' })],
        flows: [{ path: ['counters', 'game', 'player'], tone: 'response', label: 'X wins', duration: 1.8 }],
        panel: {
          title: 'Win check',
          icon: 'Code',
          code: 'won = n in (abs(rows[r]),\n           abs(cols[c]),\n           abs(diag),\n           abs(anti))',
          footer: { text: 'Cost is the same for any n', tone: 'good' },
        },
        caption: 'The sign carries the player',
      },
      code: {
        language: 'python',
        title: 'v2: running counters',
        source: `class TicTacToe:
    def __init__(self, n=3):
        self.n = n
        self.board = [[None] * n for _ in range(n)]
        self.rows = [0] * n       # +1 for X, -1 for O
        self.cols = [0] * n
        self.diag = 0
        self.anti = 0
        self.turn = 1             # 1 = X, -1 = O

    def move(self, r, c):
        if self.board[r][c] is not None:
            return None           # cell taken
        s = self.turn
        self.board[r][c] = s
        self.rows[r] += s
        self.cols[c] += s
        if r == c:
            self.diag += s
        if r + c == self.n - 1:
            self.anti += s
        won = self.n in (abs(self.rows[r]), abs(self.cols[c]),
                         abs(self.diag), abs(self.anti))
        winner = ("X" if s == 1 else "O") if won else None
        self.turn = -s
        return winner`,
        highlight: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      },
    },
    {
      title: 'Hardcoded',
      tag: 'tradeoff',
      heading: 'v2 pain: it only knows X, O and two players',
      eli5: 'The tally sheets only have room for two kids. A third kid wants to join the game and there is no column for them.',
      body: [
        'The sign trick fixes the player count at 2. A third player has no sign. The marks `"X"` and `"O"` are baked into the code, and a draw is never detected.',
        'The interviewer says "3 players on a 5 by 5 board". The next version stores counts per player.',
      ],
      keyIdea: 'A trick that depends on a hidden assumption, here exactly 2 players, breaks as soon as the assumption does.',
      metrics: { cost: 'O(1) per move', size: '3 x 3 only', players: '2 only', undo: 'no' },
      metricTones: { size: 'warn', players: 'bad' },
      scene: {
        nodes: [
          game(TL, { status: 'active' }),
          blk('counters', BM, 'Counters', '+1 / -1 only', 'gray', 'Gauge', { status: 'hot', chips: [{ text: 'player 3 = ?', tone: 'bad' }] }),
          player(TR, { chips: ['mark: Z'] }),
        ],
        links: [link('player', 'game', { label: 'move' }), link('game', 'counters', { label: 'no sign for Z', labelTone: 'bad' })],
        flows: [
          { path: ['player', 'game'], tone: 'request', label: 'move', duration: 1 },
          { path: ['game', 'counters'], tone: 'error', label: '+1 or -1?', duration: 1.3, delay: 1.1 },
        ],
        panel: {
          title: 'Baked in',
          icon: 'Bug',
          rows: [
            { text: 'Players', value: 'exactly 2', tone: 'bad' },
            { text: 'Marks', value: '"X", "O" literals', tone: 'warn' },
            { text: 'Draw detection', value: 'missing', tone: 'warn' },
          ],
        },
        caption: 'The trick stops at two players',
      },
    },
    {
      title: 'Any size',
      tag: 'concept',
      heading: 'v3: counts per player, any board size',
      eli5: 'Give every line one tally sheet per kid, so each kid has their own count. Now any number of kids can play on a grid of any size.',
      body: [
        'Each row, column and diagonal keeps a dict `{player: count}`. A win is a count that reaches `n`. The board size and the player list come in through the constructor, so nothing is hardcoded.',
        'A move is rejected if the cell is taken or out of range. The board array stays, since it answers "who is in this cell?".',
      ],
      keyIdea: 'Replace the sign trick with a count per player. The cost per move stays O(1).',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'no' },
      metricTones: { cost: 'good', size: 'good', players: 'good' },
      scene: {
        nodes: [game(TL, { status: 'active', chips: ['n = 5', 'players = 3'] }), blk('counters', BM, 'Counters', '{player: count}', 'green', 'Gauge', { chips: ['rows[2] = {A: 2, B: 1}'] }), board(TR)],
        links: [link('game', 'counters', { label: 'bump(player)' }), link('game', 'board', { label: 'has-a' })],
        flows: [
          { path: ['game', 'counters'], tone: 'request', label: 'bump(A)', duration: 1.2 },
          { path: ['counters', 'game'], tone: 'response', label: 'count >= n ?', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Per-player counts',
          icon: 'Table',
          rows: [
            { text: 'rows[r]', value: '{A: 2, B: 1}' },
            { text: 'cols[c]', value: '{A: 1}' },
            { text: 'diag', value: '{B: 1}' },
            { text: 'anti', value: '{}' },
          ],
        },
        caption: 'One count per player per line',
      },
      code: {
        language: 'python',
        title: 'v3: N by N, any players',
        source: `class NInARow:
    def __init__(self, n):
        self.n = n
        self.board = [[None] * n for _ in range(n)]
        self.rows = [{} for _ in range(n)]
        self.cols = [{} for _ in range(n)]
        self.diag, self.anti = {}, {}

    def move(self, player, r, c):
        if not (0 <= r < self.n and 0 <= c < self.n):
            return "invalid"
        if self.board[r][c] is not None:
            return "invalid"
        self.board[r][c] = player
        lines = [self.rows[r], self.cols[c]]
        if r == c:
            lines.append(self.diag)
        if r + c == self.n - 1:
            lines.append(self.anti)
        for line in lines:
            line[player] = line.get(player, 0) + 1
        if any(line[player] == self.n for line in lines):
            return f"{player} wins"
        return "continue"`,
        highlight: [10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      },
      quiz: {
        question: 'Why does the counter design check a win in O(1) instead of scanning the board?',
        options: [
          'It caches the previous board and compares the two',
          'A move only changes the lines through its own cell, so only those counters are updated and checked',
          'It stops checking after the first row',
          'It checks wins only every third move',
        ],
        answer: 1,
        explain: 'One move touches 1 row, 1 column and at most 2 diagonals. Updating those counters and comparing them to n takes constant time, whatever the board size.',
      },
    },
    {
      title: 'Target k',
      tag: 'tradeoff',
      heading: 'When the target is smaller than the board',
      eli5: 'Now kids need only 4 in a row on a big grid, and the four squares can start anywhere along a line. A tally for the whole line no longer tells you the squares touch.',
      body: [
        'Counters only work when the target equals the board size `n`, because a full line is the win. With "4 in a row on 15 by 15", marks can be scattered along a line and a count of 4 proves nothing.',
        'Instead, scan outward from the cell just played in 4 directions (row, column, 2 diagonals), counting same marks on both sides. That costs O(k), still tiny and independent of the board.',
      ],
      keyIdea: 'Counters need target == n. For k in a row, scan outward from the last move: O(k) per move.',
      metrics: { cost: 'O(k) per move', size: '15 x 15', players: 'any', undo: 'no' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [game(TL, { status: 'active', chips: ['k = 4'] }), board(BM, { chips: [{ text: '15 x 15', tone: 'warn' }] }), blk('scan', TR, 'Scan', 'from last move', 'green', 'Search', { status: 'active' })],
        links: [link('game', 'scan', { label: 'uses' }), link('scan', 'board', { label: 'reads 4 lines' })],
        flows: [
          { path: ['game', 'scan'], tone: 'request', label: 'count_from(r, c)', duration: 1.2 },
          { path: ['scan', 'board', 'scan'], tone: 'request', label: 'walk both ways', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Scan one direction',
          icon: 'Code',
          code: 'n = 1\nfor s in (1, -1):\n    i, j = r + s*dr, c + s*dc\n    while same(i, j):\n        n += 1\n        i += s*dr\n        j += s*dc\nreturn n',
        },
        caption: 'Walk outward, both ways, 4 directions',
      },
      code: {
        language: 'python',
        title: 'k in a row: scan from the last move',
        source: `DIRS = [(0, 1), (1, 0), (1, 1), (1, -1)]

def is_win(board, n, k, r, c):
    p = board[r][c]
    for dr, dc in DIRS:
        count = 1
        for sign in (1, -1):
            i, j = r + sign * dr, c + sign * dc
            while 0 <= i < n and 0 <= j < n and board[i][j] == p:
                count += 1
                i, j = i + sign * dr, j + sign * dc
        if count >= k:
            return True
    return False`,
        highlight: [5, 6, 7, 8, 9, 10, 11],
      },
    },
    {
      title: 'Move results',
      tag: 'concept',
      heading: 'Invalid, win, draw: make every result explicit',
      eli5: 'After every turn the referee calls one of four things out loud: "taken, try again", "keep playing", "we have a winner" or "the grid is full, nobody wins".',
      body: [
        'Returning `None` or a raw string is vague. Use an enum: `INVALID`, `CONTINUE`, `WIN`, `DRAW`. An invalid move must not change the board or pass the turn.',
        'A draw needs no scan. Count the moves, and when the count hits `n * n` with no winner, the game is a draw.',
      ],
      keyIdea: 'Name every outcome. An invalid move changes nothing, and a draw is just a move counter.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'no' },
      scene: {
        nodes: [game(TL, { status: 'active', chips: ['moves = 9'] }), board(BM, { chips: [{ text: 'full', tone: 'warn' }] }), player(TR, { chips: ['move(0, 0)'] })],
        links: [link('player', 'game', { label: 'move' }), link('game', 'board', { label: 'place' })],
        flows: [
          { path: ['player', 'game'], tone: 'request', label: 'move(0, 0)', duration: 1.1 },
          { path: ['game', 'player'], tone: 'error', label: 'INVALID', duration: 1.1, delay: 1.2 },
        ],
        panel: {
          title: 'MoveResult',
          icon: 'List',
          rows: [
            { text: 'INVALID', value: 'taken or off board', tone: 'bad' },
            { text: 'CONTINUE', value: 'next player' },
            { text: 'WIN', value: 'count reached n', tone: 'good' },
            { text: 'DRAW', value: 'moves == n * n', tone: 'warn' },
          ],
        },
        caption: 'Four outcomes, no ambiguity',
      },
      code: {
        language: 'python',
        title: 'Results as an enum',
        source: `from enum import Enum

class Result(Enum):
    INVALID = "invalid"
    CONTINUE = "continue"
    WIN = "win"
    DRAW = "draw"

# inside Game.move, after a valid placement:
self.moves += 1
if won:
    return Result.WIN
if self.moves == self.n * self.n:
    return Result.DRAW
return Result.CONTINUE`,
        highlight: [3, 4, 5, 6, 7, 12, 13, 14, 15],
      },
    },
    {
      title: 'Only humans',
      tag: 'tradeoff',
      heading: 'Pain: every player types at a terminal',
      eli5: 'Every kid in the game must be a real kid who shouts their square. Nobody can send a robot friend, because the referee only listens to shouting.',
      body: [
        'Today the game reads `input()` for every turn. To add a computer opponent you would put an `if player.is_ai` branch in the game loop, then another for a smarter AI.',
        'The game does not care how a move is chosen. It only needs "give me a row and a column". That is a job to hand off to an object.',
      ],
      keyIdea: 'When one part of the code varies, such as how a move is chosen, pull it out behind an interface.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'humans only', undo: 'no' },
      metricTones: { players: 'bad' },
      scene: {
        nodes: [game(TL, { status: 'hot', chips: [{ text: 'if is_ai: ...', tone: 'bad' }] }), blk('terminal', BM, 'input()', 'keyboard', 'gray', 'Code', { chips: ['"1 1"'] }), player(TR)],
        links: [link('game', 'terminal', { label: 'reads' }), link('game', 'player', { label: 'asks' })],
        flows: [
          { path: ['game', 'terminal'], tone: 'request', label: 'input()', duration: 1.2 },
          { path: ['terminal', 'game'], tone: 'response', label: '"1 1"', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The game loop today',
          icon: 'Code',
          code: 'while not over:\n    r, c = map(int, input().split())\n    game.move(r, c)\n    # add AI here?\n    # add network here?',
          footer: { text: 'Each new kind of player edits Game', tone: 'warn' },
        },
        caption: 'The game knows too much about its players',
      },
    },
    {
      title: 'Strategy: Player',
      tag: 'concept',
      heading: 'Strategy: Player is an interface, moves come from subclasses',
      eli5: 'The referee asks "what is your move?" and does not care who answers. A kid, a toy robot or a dice roller can all answer the same question.',
      body: [
        'Make `Player` an abstract class with one method, `next_move(game)`. `Human` reads the keyboard, `RandomAI` picks any empty cell. The game loop calls `player.next_move(game)` and never asks which kind it is.',
        'This is the **Strategy** pattern: one family of interchangeable algorithms behind one interface. A new kind of player is a new class, and `Game` stays untouched.',
      ],
      keyIdea: 'Strategy: the game depends on the Player interface, so adding a player type adds a class and edits nothing.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'human, random', undo: 'no' },
      metricTones: { players: 'good' },
      scene: {
        nodes: [playerI(TM, { status: 'active' }), human(BL), randomAI(BR)],
        links: [link('human', 'playerI', { label: 'extends' }), link('randomAI', 'playerI', { label: 'extends' })],
        flows: [
          { path: ['playerI', 'human'], tone: 'request', label: 'next_move()', duration: 1.2 },
          { path: ['playerI', 'randomAI'], tone: 'request', label: 'next_move()', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One interface, many players',
          icon: 'Plug',
          rows: [
            { text: 'Human', value: 'reads input()' },
            { text: 'RandomAI', value: 'random empty cell' },
            { text: 'Game', value: 'calls next_move()', tone: 'good' },
          ],
        },
        caption: 'Same call, different brain',
      },
      code: {
        language: 'python',
        title: 'Player strategy',
        source: `from abc import ABC, abstractmethod
import random

class Player(ABC):
    def __init__(self, mark):
        self.mark = mark

    @abstractmethod
    def next_move(self, game): ...

class Human(Player):
    def next_move(self, game):
        r, c = map(int, input("row col: ").split())
        return r, c

class RandomAI(Player):
    def next_move(self, game):
        empty = [(r, c) for r in range(game.n) for c in range(game.n)
                 if game.board[r][c] is None]
        return random.choice(empty)`,
        highlight: [4, 9, 10, 11, 12, 13, 16, 17],
      },
    },
    {
      title: 'Minimax',
      tag: 'case',
      heading: 'A smart player is one more class',
      eli5: 'A clever robot kid thinks "if I play here, what will you play, and then what will I play?" and picks the square that never loses.',
      body: [
        '**Minimax** tries every move, then every reply, down to a finished game, and scores a win `+1`, a draw `0` and a loss `-1`. It picks the move with the best worst case.',
        '`place` and `erase` reuse the counter update and its inverse, so `winner_is` stays O(1).',
        'On 3 by 3 the whole game tree is under 550,000 positions, so it plays perfectly in about a second in plain Python, faster with alpha-beta pruning. It cannot be beaten, only tied.',
      ],
      keyIdea: 'Plugging in a perfect player took one new class and zero changes to Game. That is the payoff of the interface.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'human, random, minimax', undo: 'no' },
      metricTones: { players: 'good' },
      scene: {
        nodes: [playerI(TM), human(BL), randomAI(BM), minimax(BR, { status: 'active', badge: 'never loses' })],
        links: [link('human', 'playerI', { label: 'extends' }), link('randomAI', 'playerI', { label: 'extends' }), link('minimax', 'playerI', { label: 'extends' })],
        flows: [{ path: ['playerI', 'minimax', 'playerI'], tone: 'request', label: 'best move', duration: 1.8 }],
        panel: {
          title: 'Minimax scores',
          icon: 'Binary',
          rows: [
            { text: 'Win', value: '+1', tone: 'good' },
            { text: 'Draw', value: '0' },
            { text: 'Loss', value: '-1', tone: 'bad' },
          ],
          footer: { text: 'Tries every line to the end of the game', tone: 'muted' },
        },
        caption: 'Best move assuming the best reply',
      },
      code: {
        language: 'python',
        title: 'MinimaxAI (3 by 3)',
        source: `class MinimaxAI(Player):
    def next_move(self, game):
        return self._best(game, self.mark)[1]

    def _best(self, game, mark):
        best = (-2, None)
        for r, c in game.empty_cells():
            game.place(mark, r, c)              # try it
            if game.winner_is(mark):
                score = 1
            elif game.is_full():
                score = 0
            else:
                score = -self._best(game, game.other(mark))[0]
            game.erase(r, c)                    # take it back
            if score > best[0]:
                best = (score, (r, c))
        return best`,
        highlight: [6, 7, 8, 13, 14, 15, 16],
      },
    },
    {
      title: 'Tangled output',
      tag: 'tradeoff',
      heading: 'Pain: printing and scoring live inside the game logic',
      eli5: 'The referee also has to draw on the chalk, keep the score on a notepad and cheer. Every new job for the referee makes the referee slower to change.',
      body: [
        'The game prints the board, updates a win counter and later must also send the move to a web page. Each new reaction means editing `Game.move`. Game logic and output are now tangled.',
        'Flip the dependency. The game should announce "a move happened" and "the game ended", and anyone who cares listens.',
      ],
      keyIdea: 'Game rules and reactions to them change for different reasons. They belong in different classes.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'no' },
      scene: {
        nodes: [game(TM, { status: 'hot', chips: [{ text: 'print(board)', tone: 'warn' }, { text: 'wins[w] += 1', tone: 'warn' }, { text: 'send_to_ui()', tone: 'warn' }] }), view(BL, { status: 'dim' }), score(BR, { status: 'dim' })],
        links: [link('game', 'view', { label: 'hardwired', labelTone: 'warn' }), link('game', 'score', { label: 'hardwired', labelTone: 'warn' })],
        flows: [
          { path: ['game', 'view'], tone: 'error', label: 'print', duration: 1.2 },
          { path: ['game', 'score'], tone: 'error', label: 'count', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Game.move today',
          icon: 'Code',
          code: 'def move(self, r, c):\n    ...\n    print(self.board)\n    self.wins[w] += 1\n    self.ui.push(r, c)\n    # one more reaction?',
          footer: { text: 'Every reaction edits the rules', tone: 'warn' },
        },
        caption: 'The referee does everyone\'s job',
      },
    },
    {
      title: 'Observer',
      tag: 'concept',
      heading: 'Observer: the game announces, listeners react',
      eli5: 'The referee shouts "X played the middle!" and anyone who wants to listen does their own job: one kid redraws the chalk, another keeps the score.',
      body: [
        'Define an `Observer` interface with `on_move` and `on_end`. `Game` keeps a list of observers and calls each one after a move. It never knows what they do.',
        'A `ConsoleView` prints. A `Scoreboard` counts wins. A web view could be added later. This is the **Observer** pattern: one publisher, any number of subscribers.',
      ],
      keyIdea: 'Observer: the game publishes events and subscribers react. New reactions never touch the game logic.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'no' },
      scene: {
        nodes: [game(TM, { status: 'active', chips: ['observers = 2'] }), observerI(BM), view(BL), score(BR)],
        links: [link('game', 'observerI', { label: 'notifies' }), link('view', 'observerI', { label: 'implements' }), link('score', 'observerI', { label: 'implements' })],
        flows: [
          { path: ['game', 'observerI'], tone: 'event', label: 'on_move(p, r, c)', duration: 1.2 },
          { path: ['observerI', 'view'], tone: 'event', label: 'print', duration: 1.1, delay: 1.3 },
          { path: ['observerI', 'score'], tone: 'event', label: 'count', duration: 1.1, delay: 1.3 },
        ],
        panel: {
          title: 'Observer interface',
          icon: 'Plug',
          code: 'class Observer(ABC):\n    @abstractmethod\n    def on_move(self, p, r, c): ...\n    @abstractmethod\n    def on_end(self, winner): ...',
        },
        caption: 'One announcement, many listeners',
      },
      code: {
        language: 'python',
        title: 'Observers and the game',
        source: `class ConsoleView(Observer):
    def on_move(self, p, r, c):
        print(f"{p.mark} -> ({r},{c})")
    def on_end(self, winner):
        print(f"RESULT: {winner or 'draw'}")

class Scoreboard(Observer):
    def __init__(self):
        self.wins = {}
    def on_move(self, p, r, c):
        pass
    def on_end(self, winner):
        if winner:
            self.wins[winner] = self.wins.get(winner, 0) + 1

class Game:
    def subscribe(self, o):
        self.observers.append(o)
    def _notify_move(self, p, r, c):
        for o in self.observers:
            o.on_move(p, r, c)`,
        highlight: [1, 2, 7, 8, 15, 16, 17, 18, 19],
      },
      quiz: {
        question: 'What problem does the Observer pattern solve in this game?',
        options: [
          'It makes the win check faster',
          'It lets any number of views and scoreboards react to moves without the game knowing about them',
          'It picks the best move for the AI',
          'It stores the board in a database',
        ],
        answer: 1,
        explain: 'Game only calls on_move and on_end on whatever observers subscribed. Adding a web view means adding a class and one subscribe call, with no edit to Game.',
      },
    },
    {
      title: 'No undo',
      tag: 'tradeoff',
      heading: 'Pain: a mistake cannot be taken back',
      eli5: 'A kid taps the wrong square and the chalk is permanent. Everyone wants an eraser, and the eraser must also fix the tally sheets.',
      body: [
        'A player misclicks, and there is no way back. Undo is harder than clearing one cell, because a move also changed the counters, the turn and the move count.',
        'The design needs each move as an object that knows how to apply itself and how to reverse itself, plus a stack of the moves played.',
      ],
      keyIdea: 'Undo is hard when a move changes many things. Treat the move as an object that can reverse itself.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'missing' },
      metricTones: { undo: 'bad' },
      scene: {
        nodes: [player(TL, { chips: [{ text: 'undo()', tone: 'bad' }] }), game(TR, { status: 'hot' }), board(BM, { chips: ['cell, counters, turn'] })],
        links: [link('player', 'game', { label: 'undo?', labelTone: 'bad' }), link('game', 'board', { label: 'changed 4 things' })],
        flows: [{ path: ['player', 'game'], tone: 'error', label: 'undo()', duration: 1.2 }],
        panel: {
          title: 'One move changes',
          icon: 'List',
          rows: [
            { text: 'The board cell', value: 'X at (1, 1)' },
            { text: 'Counters', value: 'row, col, diags' },
            { text: 'Whose turn', value: 'flipped' },
            { text: 'Move count', value: '+1' },
          ],
          footer: { text: 'All four must come back', tone: 'warn' },
        },
        caption: 'Undoing one cell is not enough',
      },
    },
    {
      title: 'Command',
      tag: 'concept',
      heading: 'Command: each move is an object with execute and undo',
      eli5: 'Every move gets written on its own little card. To undo, the referee takes the top card off the pile and reverses exactly what it says.',
      body: [
        'A `MoveCommand` holds the player and the cell. `execute()` applies the move. `undo()` reverses it. The game keeps a stack of executed commands, and undo pops the top one.',
        'This is the **Command** pattern: a request turned into an object, so it can be stored, replayed or reversed.',
      ],
      keyIdea: 'Command: wrap an action as an object with execute and undo, and keep a history stack.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'stack of commands' },
      metricTones: { undo: 'good' },
      scene: {
        nodes: [game(TM, { status: 'active' }), cmd(BL, { status: 'active', chips: ['execute()', 'undo()'] }), history(BR, { chips: ['top: (1, 1)'] })],
        links: [link('game', 'cmd', { label: 'creates' }), link('game', 'history', { label: 'has-a' })],
        flows: [
          { path: ['game', 'cmd'], tone: 'request', label: 'execute()', duration: 1.1 },
          { path: ['cmd', 'game', 'history'], tone: 'data', label: 'push', duration: 1.5, delay: 1.2 },
          { path: ['history', 'game', 'cmd'], tone: 'request', label: 'pop, undo()', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'History stack',
          icon: 'List',
          rows: [
            { text: 'push', value: 'after execute()' },
            { text: 'pop', value: 'then undo()' },
            { text: 'Empty stack', value: 'nothing to undo', tone: 'muted' },
          ],
        },
        caption: 'Each move can reverse itself',
      },
      code: {
        language: 'python',
        title: 'MoveCommand and history',
        source: `class MoveCommand:
    def __init__(self, game, player, r, c):
        self.game, self.player, self.r, self.c = game, player, r, c
        self.before = None

    def execute(self):
        self.before = self.game.snapshot()      # state before the move
        self.game._apply(self.player, self.r, self.c)

    def undo(self):
        self.game.restore(self.before)

class Game:
    def play(self, player, r, c):
        cmd = MoveCommand(self, player, r, c)
        cmd.execute()
        self.history.append(cmd)

    def undo(self):
        if self.history:
            self.history.pop().undo()`,
        highlight: [6, 7, 10, 11, 16, 17, 20, 21],
      },
    },
    {
      title: 'Memento',
      tag: 'concept',
      heading: 'Memento: save the state before the move, restore it on undo',
      eli5: 'Before each turn the referee takes a photo of the whole chalk grid and the tally sheets. Undo means putting the photo back.',
      body: [
        'Reversing a move by hand is easy to get wrong. A **Memento** is a snapshot of the state taken before the move: the board, the counters, the turn and the move count. Undo restores it in one step.',
        'The snapshot is opaque. Only `Game` knows how to read it, so the command never reaches into the game internals.',
      ],
      keyIdea: 'Memento: capture the state before a change, restore it to undo. Simple and hard to get wrong.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'snapshot restore' },
      metricTones: { undo: 'good' },
      scene: {
        nodes: [game(TM, { status: 'active' }), cmd(BL), memento(BM, { chips: ['board + counters + turn'] }), history(BR)],
        links: [link('cmd', 'game', { label: 'asks snapshot' }), link('game', 'memento', { label: 'creates' }), link('cmd', 'memento', { label: 'holds' })],
        flows: [
          { path: ['cmd', 'game'], tone: 'request', label: 'snapshot()', duration: 1.1 },
          { path: ['game', 'memento'], tone: 'data', label: 'copy state', duration: 1.2, delay: 1.2 },
          { path: ['cmd', 'game'], tone: 'request', label: 'restore(m)', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'What a snapshot holds',
          icon: 'Copy',
          rows: [
            { text: 'board cells' },
            { text: 'rows, cols, diag, anti' },
            { text: 'whose turn' },
            { text: 'move count' },
          ],
        },
        caption: 'A photo before every move',
      },
      code: {
        language: 'python',
        title: 'Snapshot and restore',
        source: `import copy

class Game:
    def snapshot(self):
        return copy.deepcopy(
            (self.board, self.rows, self.cols,
             self.diag, self.anti, self.turn, self.moves))

    def restore(self, snap):
        (self.board, self.rows, self.cols,
         self.diag, self.anti, self.turn, self.moves) = snap`,
        highlight: [4, 5, 6, 7, 9, 10, 11],
      },
    },
    {
      title: 'Undo cost',
      tag: 'tradeoff',
      heading: 'Snapshot or inverse: what undo costs',
      eli5: 'Taking a photo of the whole grid every turn is easy but uses lots of film on a giant grid. Writing only "what changed" on each card uses less film but needs more care.',
      body: [
        'A full deep copy costs O(n²) time and memory per move, which brings back the cost we removed. For 3 by 3 it is nothing. For 100 by 100 it is 10,000 cells per move.',
        'Instead the command can store only what it changed: the cell and the player. `undo()` clears that cell and decrements the same counters. That is O(1) per move and O(moves) in total. Redo is a second stack.',
      ],
      keyIdea: 'Snapshots are simple. Storing only the change is cheaper. Pick by board size, and keep redo as a second stack.',
      metrics: { cost: 'O(1) per move', size: '100 x 100', players: 'any', undo: 'O(1) inverse' },
      metricTones: { undo: 'good' },
      scene: {
        nodes: [memento(TL, { status: 'hot', chips: [{ text: '10,000 cells', tone: 'bad' }] }), cmd(BM, { status: 'ok', chips: [{ text: 'r, c, player', tone: 'good' }] }), game(TR)],
        links: [link('game', 'memento', { label: 'full copy', labelTone: 'warn' }), link('game', 'cmd', { label: 'small delta', labelTone: 'good' })],
        flows: [
          { path: ['game', 'memento'], tone: 'error', label: 'deepcopy', count: 3, duration: 1.4 },
          { path: ['game', 'cmd'], tone: 'response', label: 'r, c, player', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Two ways to undo',
          icon: 'Scale',
          rows: [
            { text: 'Snapshot', value: 'O(n²) per move', tone: 'warn' },
            { text: 'Inverse (store the delta)', value: 'O(1) per move', tone: 'good' },
            { text: 'Redo', value: 'second stack' },
          ],
        },
        caption: 'Small boards copy, big boards store deltas',
      },
      code: {
        language: 'python',
        title: 'Undo by inverse',
        source: `def undo(self):
    r, c, p = self.r, self.c, self.player
    g = self.game
    g.board[r][c] = None
    g.rows[r][p] -= 1
    g.cols[c][p] -= 1
    if r == c:
        g.diag[p] -= 1
    if r + c == g.n - 1:
        g.anti[p] -= 1
    g.moves -= 1
    g.turn = p                  # it is that player's turn again`,
        highlight: [4, 5, 6, 7, 8, 9, 10, 11],
      },
    },
    {
      title: 'End to end',
      tag: 'case',
      heading: 'Case: one move through every object',
      eli5: 'A kid says a square, the referee checks it, marks the grid, updates the tallies, shouts the news to the listeners and drops a card on the pile.',
      body: [
        '`Game.play` asks the current `Player` for a move, rejects it if invalid, wraps it in a `MoveCommand`, executes it, pushes it on the history and notifies observers. If the result is a win or a draw, `on_end` fires.',
        'Each pattern sits at one seam: Strategy for who chooses, Command for what a move is, Observer for who reacts. The core rules stay small.',
        'Undo needs the same care: observers need an `on_undo` hook (or the view redraws from state) so views stay in sync after a move is taken back.',
      ],
      keyIdea: 'Each pattern guards one seam. The game loop reads like a story and each class stays small.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'any', undo: 'O(1) inverse' },
      metricTones: { cost: 'good', undo: 'good' },
      scene: {
        nodes: [game(TM, { status: 'active' }), playerI(TL, { size: 0.8 }), cmd(BL, { size: 0.8 }), observerI(BR, { size: 0.8 })],
        links: [link('game', 'playerI', { label: 'asks' }), link('game', 'cmd', { label: 'creates' }), link('game', 'observerI', { label: 'notifies' })],
        flows: [
          { path: ['game', 'playerI', 'game'], tone: 'request', label: '1 next_move()', duration: 1.4 },
          { path: ['game', 'cmd'], tone: 'request', label: '2 execute()', duration: 1.1, delay: 1.5 },
          { path: ['game', 'observerI'], tone: 'event', label: '3 on_move()', duration: 1.1, delay: 2.7 },
        ],
        panel: {
          title: 'Game.play order',
          icon: 'Workflow',
          rows: [
            { text: '1. player.next_move()' },
            { text: '2. validate the cell' },
            { text: '3. command.execute()' },
            { text: '4. history.push()' },
            { text: '5. observers.on_move()' },
            { text: '6. on_end() if over', tone: 'good' },
          ],
        },
        caption: 'Three patterns, three seams',
      },
      code: {
        language: 'python',
        title: 'The game loop',
        source: `def play(self):
    while self.result in (None, Result.CONTINUE):
        p = self.players[self.turn_index]
        r, c = p.next_move(self)
        if not self.is_valid(r, c):
            continue                       # INVALID: same player again
        cmd = MoveCommand(self, p, r, c)
        res = cmd.execute()
        self.history.append(cmd)
        self._notify_move(p, r, c)
        if res in (Result.WIN, Result.DRAW):
            self.result = res
            break
    self._notify_end(self.winner)`,
        highlight: [4, 5, 7, 8, 9, 10, 11, 12, 13],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Six pains, six fixes',
      eli5: 'The chalk game grew by fixing one annoying thing at a time: a faster referee, any size grid, robot friends, listeners and an eraser.',
      body: [
        'You did not memorize patterns. You felt a pain and reached for the fix: counters for the slow scan, per-player counts for N players, the k-in-a-row scan for any target, Strategy for pluggable players, Observer for reactions, Command and Memento for undo.',
        'In the interview, name the pain before the pattern, and keep each version running before you improve it.',
      ],
      keyIdea: 'Start simple, say what hurts, then add one pattern for that one pain.',
      metrics: { cost: 'O(1) per move', size: 'n x n', players: 'human, AI', undo: 'yes' },
      metricTones: { cost: 'good', size: 'good', players: 'good', undo: 'good' },
      scene: {
        nodes: [game(TM, { status: 'ok' }), playerI(TL, { size: 0.8 }), observerI(TR, { size: 0.8 }), cmd(BM, { size: 0.8 })],
        links: [link('game', 'playerI', { label: 'Strategy' }), link('game', 'observerI', { label: 'Observer' }), link('game', 'cmd', { label: 'Command' })],
        flows: [
          { path: ['game', 'playerI'], tone: 'request', label: 'next_move()', duration: 1.1 },
          { path: ['game', 'observerI'], tone: 'event', label: 'on_move()', duration: 1.1, delay: 0.4 },
          { path: ['game', 'cmd'], tone: 'request', label: 'execute()', duration: 1.1, delay: 0.8 },
        ],
        panel: {
          title: 'Pain and fix',
          icon: 'Table',
          rows: [
            { text: 'v1 full scan', value: 'O(n²) per move' },
            { text: 'v2 sign counters', value: 'exactly 2 players' },
            { text: 'v3 per-player counts', value: 'only target == n' },
            { text: 'Strategy', value: 'humans only' },
            { text: 'Observer', value: 'tangled output' },
            { text: 'Command + Memento', value: 'no undo' },
          ],
        },
        caption: 'Each pattern answers one pain',
      },
      quiz: {
        question: 'The interviewer says "add a computer player". Which change keeps Game untouched?',
        options: [
          'Add an `if player.is_ai` branch to the game loop',
          'Add a new subclass of Player and plug it in',
          'Copy Game into a new class for AI matches',
          'Pass a flag to Board',
        ],
        answer: 1,
        explain: 'Game calls player.next_move(game) on the Player interface. A new subclass implements that method, so the existing Game code never changes.',
      },
    },
  ],
};
