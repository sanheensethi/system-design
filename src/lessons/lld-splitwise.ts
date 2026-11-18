import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const blk = (id: string, label: string, sub: string, icon: string, tint: Tint, d: number, s: number, size = 0.8): SceneNode => ({
  id,
  kind: 'block',
  at: at(d, s),
  label,
  sub,
  icon,
  tint,
  size,
});
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const asha = blk('asha', 'Asha', 'user', 'User', 'blue', -4.5, -3);
const ben = blk('ben', 'Ben', 'user', 'User', 'blue', 0, -3);
const chen = blk('chen', 'Chen', 'user', 'User', 'blue', 4.5, -3);
const dee = blk('dee', 'Dee', 'user', 'User', 'blue', 0, 3.5);

export const lldSplitwise: Lesson = {
  id: 'lld-splitwise',
  title: 'Splitwise',
  tagline: 'Design the object model of a shared-expense app: balances, debt simplification, split types and notifications.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why a list of IOUs and a balance matrix both fall short',
    'Net balances and a greedy pass that settles a group in few transfers',
    'The Strategy pattern for equal, exact, percent and share splits',
    'Money as integer cents, and who gets the extra cent',
    'The Observer pattern for push and email notifications',
    'The core classes: User, Group, Expense, SplitStrategy, DebtSimplifier',
  ],
  metrics: [
    { key: 'cost', label: 'Balance query', icon: 'Gauge' },
    { key: 'transfers', label: 'Transfers to settle', icon: 'ArrowLeftRight' },
    { key: 'types', label: 'Split types', icon: 'Split' },
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'Shared tab',
      tag: 'problem',
      heading: 'Four roommates, one dinner, nobody sure who owes what',
      eli5: 'At the school lunch table, kids buy snacks for each other all week. By Friday nobody remembers who paid for whom, so the **notebook** at the end of the table is a mess.',
      body: [
        'Asha pays for dinner. Ben covers the taxi. Chen buys groceries. Dee pays for nothing and owes a bit to everyone.',
        'An app like **Splitwise** records each expense and answers two questions: what does each person owe, and what is the smallest set of payments that settles the group?',
      ],
      keyIdea: 'The hard part is not storing expenses. It is keeping balances correct and settling them with few payments.',
      metrics: { cost: '?', transfers: '?', types: '1', classes: '0' },
      metricTones: { transfers: 'bad' },
      scene: {
        nodes: [asha, ben, chen, { ...blk('book', 'Notebook', 'who owes who?', 'FileText', 'gray', 0, 3.5), status: 'hot', badge: 'out of date' }],
        links: [link('asha', 'book'), link('ben', 'book'), link('chen', 'book')],
        flows: [
          { path: ['asha', 'book'], tone: 'request', label: 'paid 90', duration: 1.3 },
          { path: ['ben', 'book'], tone: 'request', label: 'paid 24', duration: 1.3, delay: 1.0 },
          { path: ['chen', 'book'], tone: 'request', label: 'paid 45', duration: 1.3, delay: 2.0 },
        ],
        panel: {
          title: 'One week of expenses',
          icon: 'Receipt',
          rows: [
            { text: 'Dinner, paid by Asha', value: '90.00' },
            { text: 'Taxi, paid by Ben', value: '24.00' },
            { text: 'Groceries, paid by Chen', value: '45.00' },
          ],
          footer: { text: 'Who pays whom to get even?', tone: 'warn' },
        },
        caption: 'Every expense changes what everyone owes',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What the system must do, and the first classes',
      eli5: 'The lunch table needs a few jobs: a list of kids, a **group** for the table, a slip for each snack bought, and someone who works out who should hand over coins.',
      body: [
        'Users join groups. Anyone in a group adds an **expense**: who paid, how much, who shared it, and how to split it (equal, exact, percent, shares).',
        'The app shows each person their balance, suggests a short list of settlement payments, and notifies people when an expense touches them.',
      ],
      keyIdea: 'Name the nouns first: User, Group, Expense. Behavior such as splitting and settling gets its own classes later.',
      metrics: { cost: '?', transfers: '?', types: '4', classes: '3' },
      scene: {
        nodes: [
          blk('sw', 'Splitwise', 'entry point', 'Receipt', 'green', 0, -3.2),
          blk('group', 'Group', 'members + expenses', 'Users', 'green', -4.5, 2.5),
          blk('expense', 'Expense', 'payer, amount, shares', 'FileText', 'green', 0, 3.5),
          blk('user', 'User', 'name', 'User', 'green', 4.5, 2.5),
        ],
        links: [
          link('sw', 'group', { label: 'has-a' }),
          link('group', 'expense', { label: 'has-a' }),
          link('group', 'user', { label: 'has-a' }),
        ],
        panel: {
          title: 'Features to support',
          icon: 'List',
          rows: [
            { text: 'Add expense to a group', value: 'payer + split' },
            { text: 'Show balance per user' },
            { text: 'Suggest settlement payments' },
            { text: 'Four split types' },
            { text: 'Notify people involved' },
          ],
        },
        caption: 'Start with the nouns',
      },
    },
    {
      title: 'IOU list',
      tag: 'concept',
      heading: 'Version 1: keep a list of IOUs',
      eli5: 'The first notebook just gets a new line every time: "Ben owes Asha 30 cents". Easy to write. To find out what Ben owes, you read every line.',
      body: [
        'The simplest design stores one tuple per debt: `(debtor, creditor, cents)`. Adding an expense appends one tuple for each person who shared it, except the payer.',
        'A user\'s balance is a sum over the whole list.',
      ],
      keyIdea: 'An append-only IOU list is trivial to write and trivial to get right. Reads pay for that simplicity.',
      metrics: { cost: 'O(all IOUs)', transfers: '?', types: '1', classes: '1' },
      scene: {
        nodes: [
          asha,
          blk('sw', 'Splitwise', 'v1', 'Receipt', 'green', 0, 0),
          blk('ious', 'ious[]', 'list of tuples', 'List', 'gray', 4.5, 3),
        ],
        links: [link('asha', 'sw', { label: 'uses' }), link('sw', 'ious', { label: 'has-a' })],
        flows: [
          { path: ['asha', 'sw'], tone: 'request', label: 'add(...)', duration: 1.4 },
          { path: ['sw', 'ious'], tone: 'data', label: 'append', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Splitwise v1',
          icon: 'Code',
          code: 'def add(self, payer, people, cents):\n    each = cents // len(people)\n    for p in people:\n        if p != payer:\n            self.ious.append((p, payer, each))',
        },
        caption: 'One tuple per debt',
      },
      code: {
        language: 'python',
        title: 'v1: a list of IOUs',
        source: `class Splitwise:
    def __init__(self):
        self.ious = []  # (debtor, creditor, cents)

    def add(self, payer, people, cents):
        each = cents // len(people)
        for p in people:
            if p != payer:
                self.ious.append((p, payer, each))

    def net(self, user):
        owed = sum(c for d, cr, c in self.ious if cr == user)
        owes = sum(c for d, cr, c in self.ious if d == user)
        return owed - owes`,
        highlight: [1, 3, 11, 12, 13],
      },
    },
    {
      title: 'Scan cost',
      tag: 'case',
      heading: 'Case: 1,000 people and 50,000 expenses',
      eli5: 'After a year the notebook has thousands of lines. To find out what Ben owes, you read all of them. And if Asha owes Ben, Ben owes Chen and Chen owes Asha, nobody crosses anything out.',
      body: [
        'Every `net(user)` call scans every IOU. With 50,000 expenses that is hundreds of thousands of tuples per question.',
        'The list also never cancels. If A owes B 10, B owes C 10 and C owes A 10, the list holds three debts that should be zero.',
      ],
      keyIdea: 'Reading is O(n) in all history, and the list cannot cancel debts that go in a circle.',
      metrics: { cost: '~300K tuples', transfers: '3', types: '1', classes: '1' },
      metricTones: { cost: 'bad', transfers: 'bad' },
      scene: {
        nodes: [
          { ...blk('sw', 'Splitwise', 'v1', 'Receipt', 'green', -4, 0), status: 'hot', load: 92 },
          { ...blk('ious', 'ious[]', 'list of tuples', 'List', 'gray', 4, 0), status: 'hot', chips: [{ text: '300,000 tuples', tone: 'bad' }] },
          { ...asha, at: at(0, -3.5) },
        ],
        links: [link('asha', 'sw'), link('sw', 'ious', { label: 'scans every tuple', labelTone: 'warn' })],
        flows: [
          { path: ['asha', 'sw'], tone: 'request', label: 'net("asha")', duration: 1.2 },
          { path: ['sw', 'ious', 'sw'], tone: 'request', label: 'scan all', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'A loop that never cancels',
          icon: 'Repeat',
          rows: [
            { text: 'Asha owes Ben', value: '10', tone: 'warn' },
            { text: 'Ben owes Chen', value: '10', tone: 'warn' },
            { text: 'Chen owes Asha', value: '10', tone: 'warn' },
          ],
          footer: { text: '3 payments, but everyone is even', tone: 'bad' },
        },
        caption: 'Slow reads and debts that should vanish',
      },
    },
    {
      title: 'Balance matrix',
      tag: 'concept',
      heading: 'Version 2: one running balance per pair',
      eli5: 'Instead of a long list, the notebook gets one small box for each pair of kids. A box says how much Ben owes Asha right now. Fast to look up, and boxes can cancel each other.',
      body: [
        'Keep `owes[a][b]`: what `a` owes `b` right now. A new expense bumps one cell, then nets against the reverse cell so only one direction stays positive.',
        'Looking up one pair is O(1). A full balance for one user is O(people), no matter how many expenses happened.',
      ],
      keyIdea: 'Store the running state, not the history. Netting a pair at write time keeps reads cheap.',
      metrics: { cost: 'O(people)', transfers: '3', types: '1', classes: '1' },
      metricTones: { cost: 'good', transfers: 'bad' },
      scene: {
        nodes: [
          asha,
          blk('sw', 'Splitwise', 'v2', 'Receipt', 'green', 0, 0),
          { ...blk('matrix', 'owes[a][b]', 'pair balances', 'Table', 'blue', 4.5, 3), status: 'active' },
        ],
        links: [link('asha', 'sw', { label: 'uses' }), link('sw', 'matrix', { label: 'has-a' })],
        flows: [
          { path: ['asha', 'sw'], tone: 'request', label: 'add(...)', duration: 1.3 },
          { path: ['sw', 'matrix'], tone: 'data', label: 'owes[p][payer] += each', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Netting one pair',
          icon: 'Scale',
          rows: [
            { text: 'Ben owes Asha', value: '30' },
            { text: 'Asha owes Ben', value: '10' },
            { text: 'After netting: Ben owes Asha', value: '20', tone: 'good' },
          ],
        },
        caption: 'One cell per pair, netted on write',
      },
      code: {
        language: 'python',
        title: 'v2: a balance matrix',
        source: `from collections import defaultdict

class Splitwise:
    def __init__(self):
        self.owes = defaultdict(lambda: defaultdict(int))  # owes[a][b]

    def add(self, payer, people, cents):
        each = cents // len(people)
        for p in people:
            if p == payer:
                continue
            self.owes[p][payer] += each
            back = min(self.owes[p][payer], self.owes[payer][p])
            self.owes[p][payer] -= back
            self.owes[payer][p] -= back`,
        highlight: [5, 12, 13, 14, 15],
      },
    },
    {
      title: 'Circular debts',
      tag: 'case',
      heading: 'Case: a triangle of debts the matrix cannot see',
      eli5: 'Asha owes Ben, Ben owes Chen, Chen owes Asha, all the same amount. Every pair has one box with a number in it. No two boxes cancel, but passing the coins around once would make everyone even.',
      body: [
        'Netting works on pairs. A loop of three people has no pair that cancels, so the matrix keeps three non-zero cells.',
        'Settling would cost three transfers where zero are needed. Groups of friends hit this all the time.',
      ],
      keyIdea: 'Pairwise netting cannot see cycles. The fix is to look at each person once, not each pair.',
      metrics: { cost: 'O(people)', transfers: '3 (0 needed)', types: '1', classes: '1' },
      metricTones: { transfers: 'bad' },
      scene: {
        nodes: [
          { ...blk('asha', 'Asha', 'user', 'User', 'blue', -4, -2.5), status: 'hot' },
          { ...blk('ben', 'Ben', 'user', 'User', 'blue', 4, -2.5), status: 'hot' },
          { ...blk('chen', 'Chen', 'user', 'User', 'blue', 0, 3.5), status: 'hot' },
        ],
        links: [
          link('asha', 'ben', { label: 'owes 10', labelTone: 'warn' }),
          link('ben', 'chen', { label: 'owes 10', labelTone: 'warn' }),
          link('chen', 'asha', { label: 'owes 10', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['asha', 'ben'], tone: 'error', label: '10', duration: 1.2 },
          { path: ['ben', 'chen'], tone: 'error', label: '10', duration: 1.2, delay: 1.0 },
          { path: ['chen', 'asha'], tone: 'error', label: '10', duration: 1.2, delay: 2.0 },
        ],
        panel: {
          title: 'Matrix after three expenses',
          icon: 'Table',
          rows: [
            { text: 'owes[asha][ben]', value: '10', tone: 'warn' },
            { text: 'owes[ben][chen]', value: '10', tone: 'warn' },
            { text: 'owes[chen][asha]', value: '10', tone: 'warn' },
          ],
          footer: { text: 'No pair cancels, yet the loop sums to zero', tone: 'bad' },
        },
        caption: 'A cycle hides inside the pairs',
      },
    },
    {
      title: 'Net balance',
      tag: 'concept',
      heading: 'Version 3: one number per person',
      eli5: 'Forget who owes whom. For each kid, count the coins they put in the pot and the coins they took out. A kid with extra coins in is owed money. A kid who took more than they put in owes.',
      body: [
        'For each person, **net balance** = total they paid minus total of their shares. Positive means the group owes them. Negative means they owe the group.',
        'In the roommates\' week the shares are not equal: Asha paid 90 and her share was 40, Ben paid 24 for a share of 14, Chen paid 45 for a share of 85, and Dee paid nothing for a share of 20. That gives the nets on the right.',
        'All nets sum to zero. Cycles disappear on their own, because everyone in a loop paid exactly what they owed, so each has a net of zero.',
      ],
      keyIdea: 'A net balance per person erases the question of who owes whom. Only the totals matter.',
      metrics: { cost: 'O(people)', transfers: '?', types: '1', classes: '2' },
      scene: {
        nodes: [
          { ...asha, badge: '+50', status: 'ok' },
          { ...ben, badge: '+10', status: 'ok' },
          { ...chen, badge: '-40', status: 'hot' },
          { ...dee, badge: '-20', status: 'hot' },
        ],
        links: [],
        panel: {
          title: 'net = paid - shares',
          icon: 'Scale',
          rows: [
            { text: 'Asha: paid 90, share 40', value: '+50.00', tone: 'good' },
            { text: 'Ben: paid 24, share 14', value: '+10.00', tone: 'good' },
            { text: 'Chen: paid 45, share 85', value: '-40.00', tone: 'bad' },
            { text: 'Dee: paid 0, share 20', value: '-20.00', tone: 'bad' },
            { text: 'Asha, Ben, Chen loop: 0, 0, 0', value: 'cycle gone', tone: 'good' },
          ],
          footer: { text: 'Sum is 0', tone: 'muted' },
        },
        caption: 'Creditors on top, debtors below',
      },
      code: {
        language: 'python',
        title: 'Net balance per person',
        source: `from collections import defaultdict

def net_balances(expenses):
    net = defaultdict(int)  # cents, positive = owed money
    for e in expenses:
        net[e.payer] += e.cents
        for user, share in e.shares.items():
            net[user] -= share
    return net`,
        highlight: [5, 7],
      },
    },
    {
      title: 'Greedy settle',
      tag: 'concept',
      heading: 'DebtSimplifier: match the biggest debtor with the biggest creditor',
      eli5: 'The grown-up at the table takes the kid owed the most and the kid who owes the most, and has one hand coins to the other. Then she repeats with whoever still has something left.',
      body: [
        'Put creditors in one max-heap and debtors in another. Pop the largest of each, transfer `min(credit, debt)`, and push back whoever has a remainder.',
        'Each transfer fully clears at least one person, so a group of n people needs at most n - 1 transfers.',
      ],
      keyIdea: 'Greedy matching never needs more than n - 1 payments. Finding the true minimum is NP-hard, so most apps stop here.',
      metrics: { cost: 'O(n log n)', transfers: '<= n - 1', types: '1', classes: '2' },
      metricTones: { transfers: 'good' },
      scene: {
        nodes: [
          blk('give', 'creditors', 'max-heap', 'TrendingUp', 'blue', -4.5, -3),
          blk('take', 'debtors', 'max-heap', 'TrendingUp', 'blue', 4.5, -3),
          { ...blk('simp', 'DebtSimplifier', 'simplify(net)', 'Workflow', 'green', 0, -0.2), status: 'active' },
          blk('out', 'settlements', 'list of payments', 'List', 'gray', 0, 4.8),
        ],
        links: [
          link('give', 'simp', { label: 'pop' }),
          link('take', 'simp', { label: 'pop' }),
          link('simp', 'out', { label: 'creates' }),
        ],
        flows: [
          { path: ['give', 'simp'], tone: 'request', label: 'Asha 50', duration: 1.2 },
          { path: ['take', 'simp'], tone: 'request', label: 'Chen 40', duration: 1.2, delay: 0.3 },
          { path: ['simp', 'out'], tone: 'data', label: 'Chen→Asha 40', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'One loop iteration',
          icon: 'Repeat',
          code: 'pay = min(credit, debt)\nsettle(debtor, creditor, pay)\npush back the remainder',
        },
        caption: 'Pop two, settle, push the remainder back',
      },
      code: {
        language: 'python',
        title: 'Greedy debt simplification',
        source: `import heapq

def simplify(net):  # net[user] = cents, positive = owed money
    give = [(-v, u) for u, v in net.items() if v > 0]
    take = [(v, u) for u, v in net.items() if v < 0]
    heapq.heapify(give)
    heapq.heapify(take)
    out = []
    while give and take:
        gv, gu = heapq.heappop(give)  # -amount owed
        tv, tu = heapq.heappop(take)  # -amount owing
        pay = min(-gv, -tv)
        out.append((tu, gu, pay))
        if -gv > pay:
            heapq.heappush(give, (gv + pay, gu))
        if -tv > pay:
            heapq.heappush(take, (tv + pay, tu))
    return out`,
        highlight: [10, 11, 12, 13, 14, 15, 16],
      },
    },
    {
      title: 'Walkthrough',
      tag: 'case',
      heading: 'Case: settling the four roommates in three payments',
      eli5: 'Chen hands Asha 40 coins. Asha is still owed 10, so Dee hands her 10. Dee has 10 left to give, so Ben gets that. Three handovers and the table is even.',
      body: [
        'Nets: Asha +50, Ben +10, Chen -40, Dee -20. Largest creditor is Asha and largest debtor is Chen, so Chen pays Asha 40.',
        'Asha still needs 10. Dee pays Asha 10, then Dee pays the last 10 to Ben. Three payments, and the same loop of three that cost 3 before now costs 0.',
      ],
      keyIdea: 'The greedy pass turns four net balances into three payments, and a pure cycle into none.',
      metrics: { cost: 'O(n log n)', transfers: '3', types: '1', classes: '2' },
      metricTones: { transfers: 'good' },
      scene: {
        nodes: [
          { ...asha, badge: '+50 → 0', status: 'ok' },
          { ...ben, badge: '+10 → 0', status: 'ok' },
          { ...chen, badge: '-40 → 0', status: 'ok' },
          { ...dee, badge: '-20 → 0', status: 'ok' },
        ],
        links: [
          link('chen', 'asha', { label: 'pays 40', labelTone: 'good' }),
          link('dee', 'asha', { label: 'pays 10', labelTone: 'good' }),
          link('dee', 'ben', { label: 'pays 10', labelTone: 'good' }),
        ],
        flows: [
          { path: ['chen', 'asha'], tone: 'response', label: '40', duration: 1.3 },
          { path: ['dee', 'asha'], tone: 'response', label: '10', duration: 1.3, delay: 1.2 },
          { path: ['dee', 'ben'], tone: 'response', label: '10', duration: 1.3, delay: 2.4 },
        ],
        panel: {
          title: 'Greedy trace',
          icon: 'List',
          rows: [
            { text: '1. Chen → Asha', value: '40.00' },
            { text: '2. Dee → Asha', value: '10.00' },
            { text: '3. Dee → Ben', value: '10.00' },
          ],
          footer: { text: 'All nets are now zero', tone: 'good' },
        },
        caption: 'Three payments settle everyone',
      },
      quiz: {
        question: 'Seven people have non-zero net balances. What is the most payments the greedy simplifier can produce?',
        options: ['1', '6', '7', '21'],
        answer: 1,
        explain: 'Each payment fully settles at least one person, and the last payment settles two. So n people need at most n - 1 payments: 6.',
      },
    },
    {
      title: 'More splits',
      tag: 'problem',
      heading: 'Real groups do not split everything equally',
      eli5: 'Some snacks are shared evenly. Some are "I only had the juice, so I pay 2 coins". Some are "I get double because I am hungry." One rule for everything does not fit.',
      body: [
        'So far `add` divides by `len(people)`. But rent is 60/40, a taxi is exact amounts, a gift is by percent and groceries are by shares (2 roommates plus 1 kid is 2, 2, 1).',
        'Adding an `if` chain to `add` for each rule makes it grow forever and touches working code each time.',
      ],
      keyIdea: 'The way a total is divided changes more often than anything else. Pull it out of the expense logic.',
      metrics: { cost: 'O(people)', transfers: '3', types: '1 (need 4)', classes: '2' },
      metricTones: { types: 'bad' },
      scene: {
        nodes: [
          { ...blk('sw', 'Splitwise', 'only divides equally', 'Receipt', 'green', 0, -0.5), status: 'hot' },
          { ...asha, at: at(-4.5, -3), chips: [{ text: 'rent 60 / 40', tone: 'warn' }] },
          { ...ben, at: at(4.5, -3), chips: [{ text: 'gift by %', tone: 'warn' }] },
          { ...chen, at: at(4, 4.8), chips: [{ text: 'groceries 2:2:1', tone: 'warn' }] },
        ],
        links: [link('asha', 'sw'), link('ben', 'sw'), link('chen', 'sw')],
        flows: [
          { path: ['asha', 'sw'], tone: 'error', label: 'rent 60/40?', duration: 1.3 },
          { path: ['ben', 'sw'], tone: 'error', label: 'by %?', duration: 1.3, delay: 1.0 },
          { path: ['chen', 'sw'], tone: 'error', label: '2:2:1?', duration: 1.3, delay: 2.0 },
        ],
        panel: {
          title: 'Split types',
          icon: 'Split',
          rows: [
            { text: 'Equal', value: 'total / n' },
            { text: 'Exact', value: 'a number each' },
            { text: 'Percent', value: 'sums to 100' },
            { text: 'Share', value: 'units, like 2:2:1' },
          ],
        },
        caption: 'One divide-by-n does not cover it',
      },
    },
    {
      title: 'Strategy',
      tag: 'concept',
      heading: 'SplitStrategy: one interface, one class per rule',
      eli5: 'Give the table a stack of rule cards: "split evenly", "everyone says their own number", "by percent". For each snack the grown-up picks one card and follows it. Adding a card changes nobody else.',
      body: [
        'The **Strategy pattern** hides each algorithm behind one interface. `SplitStrategy.split(cents, people, meta)` returns `{user: share}`. The group holds a strategy and calls it.',
        'Adding a new split rule is a new class. `Group` and the existing strategies stay untouched.',
      ],
      keyIdea: 'Strategy turns an if-chain into an interface plus one class per case, so new rules need no edits to old code.',
      metrics: { cost: 'O(people)', transfers: '3', types: '1', classes: '4' },
      scene: {
        nodes: [
          blk('group', 'Group', 'add_expense()', 'Users', 'green', -5, 0),
          blk('strategy', 'SplitStrategy', 'interface: split()', 'Split', 'violet', 0, 0),
          blk('equal', 'EqualSplit', 'cents / n', 'Scale', 'green', 4.5, 3),
        ],
        links: [link('group', 'strategy', { label: 'uses' }), link('equal', 'strategy', { label: 'implements' })],
        flows: [
          { path: ['group', 'strategy'], tone: 'request', label: 'split(9000, ...)', duration: 1.4 },
          { path: ['strategy', 'equal'], tone: 'request', label: 'dispatch', duration: 1.2, delay: 1.5 },
          { path: ['equal', 'group'], tone: 'response', label: '{3000, 3000, 3000}', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'The interface',
          icon: 'Braces',
          code: 'class SplitStrategy(ABC):\n    @abstractmethod\n    def split(self, cents, people, meta):\n        """Return {user: cents owed}"""',
        },
        caption: 'The group depends on the interface only',
      },
      code: {
        language: 'python',
        title: 'The interface and the first strategy',
        source: `from abc import ABC, abstractmethod

class SplitStrategy(ABC):
    @abstractmethod
    def split(self, cents, people, meta):
        """Return {user: cents owed}. The shares must add up to cents."""

class EqualSplit(SplitStrategy):
    def split(self, cents, people, meta):
        return spread(cents, {p: 1 for p in people})`,
        highlight: [3, 4, 5, 8, 10],
      },
    },
    {
      title: 'Extra cent',
      tag: 'case',
      heading: 'Case: 1.00 split three ways',
      eli5: 'Three kids share one 100-cent snack. Each gets 33 and there is one coin left on the table. Somebody has to take it, or the notebook is off by a cent forever.',
      body: [
        'Money is stored as integer **cents**, never floats. `0.1 + 0.2` is not `0.3` in floating point, and tiny errors pile up across thousands of expenses.',
        '100 // 3 is 33 for each person and 1 cent is left. `spread` hands the leftover cents out one at a time to people in sorted name order, so the result is the same on every run and shares always add up to the total.',
      ],
      keyIdea: 'Shares must sum to the total exactly. Use integer cents and hand the remainder out deliberately.',
      metrics: { cost: 'O(people)', transfers: '3', types: '1', classes: '4' },
      scene: {
        nodes: [
          blk('spread', 'spread()', 'weights → cents', 'Split', 'green', 0, -3, 0.85),
          { ...blk('a', 'Asha', '34 cents', 'User', 'blue', -4.5, 3), badge: '34', status: 'ok' },
          { ...blk('b', 'Ben', '33 cents', 'User', 'blue', 0, 3.5), badge: '33', status: 'ok' },
          { ...blk('c', 'Chen', '33 cents', 'User', 'blue', 4.5, 3), badge: '33', status: 'ok' },
        ],
        links: [link('spread', 'a'), link('spread', 'b'), link('spread', 'c')],
        flows: [
          { path: ['spread', 'a'], tone: 'data', label: '33 + 1', duration: 1.3 },
          { path: ['spread', 'b'], tone: 'data', label: '33', duration: 1.3, delay: 0.5 },
          { path: ['spread', 'c'], tone: 'data', label: '33', duration: 1.3, delay: 1.0 },
        ],
        panel: {
          title: 'spread(100, equal weights)',
          icon: 'Scale',
          rows: [
            { text: '100 // 3 each', value: '33' },
            { text: 'Left after rounding down', value: '1 cent', tone: 'warn' },
            { text: 'First name in sorted order takes it', value: '34 + 33 + 33', tone: 'good' },
          ],
          footer: { text: 'Sum is exactly 100', tone: 'good' },
        },
        caption: 'The leftover cent has an owner',
      },
      code: {
        language: 'python',
        title: 'Weighted split with a remainder rule',
        source: `def spread(cents, weights):
    """Split cents by integer weights. Shares sum to cents exactly."""
    total = sum(weights.values())
    out = {u: cents * w // total for u, w in weights.items()}
    left = cents - sum(out.values())  # fewer than len(weights) cents
    for u in sorted(weights)[:left]:  # deterministic: same winner every run
        out[u] += 1
    return out`,
        highlight: [4, 5, 6, 7],
      },
    },
    {
      title: 'Four strategies',
      tag: 'concept',
      heading: 'Exact, percent and share, all behind the same interface',
      eli5: 'Each rule card has its own little instruction. "Exact" checks that everyone\'s numbers add up to the bill. "Percent" checks they add to 100. "Share" just uses the ratios.',
      body: [
        '`ExactSplit` takes the amounts as given and rejects them if they do not add up to the total. `PercentSplit` checks percents add to 100. `ShareSplit` accepts any unit weights.',
        'Percent and share both reuse `spread`, so remainders are handled in one place.',
      ],
      keyIdea: 'Each strategy validates its own input and returns shares that sum to the total.',
      metrics: { cost: 'O(people)', transfers: '3', types: '4', classes: '7' },
      metricTones: { types: 'good' },
      scene: {
        nodes: [
          blk('strategy', 'SplitStrategy', 'interface', 'Split', 'violet', 0, -3.5),
          blk('equal', 'Equal', 'cents / n', 'Scale', 'green', -5.4, 3, 0.7),
          blk('exact', 'Exact', 'sum == total', 'Scale', 'green', -1.8, 3, 0.7),
          blk('pct', 'Percent', 'sum == 100', 'Scale', 'green', 1.8, 3, 0.7),
          blk('share', 'Share', '2:2:1', 'Scale', 'green', 5.4, 3, 0.7),
        ],
        links: [
          link('equal', 'strategy', { label: 'implements' }),
          link('exact', 'strategy'),
          link('pct', 'strategy'),
          link('share', 'strategy'),
        ],
        panel: {
          title: 'Same call, four answers',
          icon: 'Table',
          rows: [
            { text: 'Equal, 9000', value: '3000 each' },
            { text: 'Exact {a: 5000, b: 4000}', value: 'as given' },
            { text: 'Percent {a: 60, b: 40}', value: '5400 / 3600' },
            { text: 'Share {a: 2, b: 2, c: 1}', value: '3600 / 3600 / 1800' },
          ],
        },
        caption: 'New rule, new class',
      },
      code: {
        language: 'python',
        title: 'The other three strategies',
        source: `def check(meta, people):
    if set(meta) != set(people):
        raise ValueError("meta must cover exactly the people in the split")

class ExactSplit(SplitStrategy):
    def split(self, cents, people, meta):
        check(meta, people)
        if sum(meta.values()) != cents:
            raise ValueError("exact amounts must add up to the total")
        return dict(meta)

class PercentSplit(SplitStrategy):
    def split(self, cents, people, meta):
        check(meta, people)
        if sum(meta.values()) != 100:
            raise ValueError("percents must add up to 100")
        return spread(cents, meta)

class ShareSplit(SplitStrategy):
    def split(self, cents, people, meta):
        check(meta, people)
        return spread(cents, meta)  # meta[p] = units, e.g. 2, 2, 1`,
        highlight: [1, 2, 8, 9, 15, 16, 22],
      },
      quiz: {
        question: 'The product team wants a new split type: "by income". Which change keeps the existing code untouched?',
        options: [
          'Add an elif branch to Group.add_expense',
          'Add an IncomeSplit class that implements SplitStrategy',
          'Add a flag to ExactSplit',
          'Copy PercentSplit and edit Group to import it',
        ],
        answer: 1,
        explain: 'Strategy exists so that a new rule is a new class. Group already talks to the SplitStrategy interface, so IncomeSplit slots in with no edits to old classes.',
      },
    },
    {
      title: 'Domain model',
      tag: 'concept',
      heading: 'Expense, Group and what each one owns',
      eli5: 'Each snack gets a slip: who paid and who owes how much. The table\'s folder holds all the slips. Add up the slips and you know each kid\'s total.',
      body: [
        '`Expense` is a record: payer, total cents, and a `shares` dict already computed by a strategy. It never recalculates, so history cannot change by accident.',
        '`Group` owns the members, the expense log, a running `net` dict and the observers. Each new expense updates `net` in O(people), and `net` goes straight to `DebtSimplifier`. The log stays as the audit trail and can rebuild `net` to verify it.',
      ],
      keyIdea: 'Expense is an immutable record. Group keeps a running net per person plus the log. Strategy, simplifier and observers do the work.',
      metrics: { cost: 'O(people)', transfers: '3', types: '4', classes: '8' },
      scene: {
        nodes: [
          blk('group', 'Group', 'members, expenses', 'Users', 'green', 0, -3.5),
          blk('expense', 'Expense', 'payer, cents, shares', 'FileText', 'green', -5, 2.5),
          blk('user', 'User', 'id, name', 'User', 'green', 0, 4),
          blk('simp', 'DebtSimplifier', 'simplify(net)', 'Workflow', 'green', 5, 2.5),
        ],
        links: [
          link('group', 'expense', { label: 'has-a' }),
          link('group', 'user', { label: 'has-a' }),
          link('group', 'simp', { label: 'uses' }),
        ],
        panel: {
          title: 'Who owns what',
          icon: 'Boxes',
          rows: [
            { text: 'Expense', value: 'one record' },
            { text: 'Group.expenses', value: 'audit log' },
            { text: 'Group.net', value: 'running dict, O(people)' },
            { text: 'settle_plan()', value: 'simplify(net)' },
          ],
        },
        caption: 'A record, a coordinator and a calculator',
      },
      code: {
        language: 'python',
        title: 'Expense and Group',
        source: `from collections import defaultdict
from dataclasses import dataclass

@dataclass(frozen=True)
class Expense:
    payer: str
    cents: int
    shares: dict  # user -> cents owed for this expense
    title: str = ""

class Group:
    def __init__(self, members):
        self.members = sorted(members)
        self.expenses = []  # audit log
        self.net = defaultdict(int)  # running balance per person
        self.observers = []

    def recompute_net(self):
        return net_balances(self.expenses)  # verify against self.net

    def settle_plan(self):
        return simplify(self.net)`,
        highlight: [4, 5, 11, 13, 14, 17, 18, 20, 21],
      },
    },
    {
      title: 'Add expense',
      tag: 'case',
      heading: 'Following one add_expense call',
      eli5: 'Asha tells the table "I paid for pizza, split it evenly". The grown-up picks the rule card, works out each kid\'s share, writes a new slip and files it in the folder.',
      body: [
        'The caller hands `Group` a payer, an amount and a strategy. `Group` asks the strategy for the shares, builds an `Expense`, appends it and tells the observers.',
        'It also bumps the running `net` dict: the payer gains the total and each sharer loses their share. That is O(people) per expense, and the expense list stays as the audit log.',
      ],
      keyIdea: 'add_expense is a short coordinator: split, record, update net, notify. It holds no split math of its own.',
      metrics: { cost: 'O(people)', transfers: '3', types: '4', classes: '8' },
      scene: {
        nodes: [
          { ...asha, at: at(-5, -1.5) },
          { ...blk('group', 'Group', 'add_expense()', 'Users', 'green', 0, -1.5), status: 'active' },
          blk('strategy', 'EqualSplit', 'split()', 'Scale', 'green', 5, -1.5),
          blk('expense', 'Expense', 'shares frozen', 'FileText', 'green', 0, 3.8),
        ],
        links: [
          link('asha', 'group', { label: 'uses' }),
          link('group', 'strategy', { label: 'uses' }),
          link('group', 'expense', { label: 'creates' }),
        ],
        flows: [
          { path: ['asha', 'group'], tone: 'request', label: 'add_expense', duration: 1.2 },
          { path: ['group', 'strategy'], tone: 'request', label: 'split()', duration: 1.2, delay: 1.3 },
          { path: ['strategy', 'group'], tone: 'response', label: 'shares', duration: 1.2, delay: 2.6 },
          { path: ['group', 'expense'], tone: 'data', label: 'Expense(...)', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'add_expense',
          icon: 'Code',
          code: 'shares = strategy.split(cents, people, meta)\ne = Expense(payer, cents, shares)\nself.expenses.append(e)\nself.net[payer] += cents\nfor u, s in shares.items():\n    self.net[u] -= s\nself._notify(e)',
        },
        caption: 'Split, record, notify',
      },
      code: {
        language: 'python',
        title: 'Group.add_expense',
        source: `    def add_expense(self, payer, cents, strategy, people=None, meta=None, title=""):
        people = sorted(people or self.members)  # stable order
        if not set(people) <= set(self.members) or payer not in self.members:
            raise ValueError("everyone must be a member of the group")
        if cents <= 0:
            raise ValueError("amount must be positive")
        shares = strategy.split(cents, people, meta or {})
        e = Expense(payer, cents, shares, title)
        self.expenses.append(e)
        self.net[payer] += cents
        for u, s in shares.items():
            self.net[u] -= s
        self._notify(e)
        return e`,
        highlight: [7, 8, 9, 10, 11, 12],
      },
    },
    {
      title: 'Observer',
      tag: 'concept',
      heading: 'ExpenseObserver: tell people without coupling to how',
      eli5: 'When a slip goes in the folder, a little bell rings. A kid with a bell tells their friends right away. Another kid writes a daily note. The folder does not care who listens.',
      body: [
        'The **Observer pattern**: `Group` keeps a list of `ExpenseObserver` objects and calls `on_expense(e)` on each. `PushNotifier` sends an instant message. `EmailDigest` buffers expenses and sends one email a day.',
        'Add SMS later by adding a class. `Group` does not change.',
      ],
      keyIdea: 'Observers let new reactions plug in without the expense code knowing they exist.',
      metrics: { cost: 'O(people)', transfers: '3', types: '4', classes: '11' },
      scene: {
        nodes: [
          blk('group', 'Group', 'add_expense()', 'Users', 'green', -5.5, 0),
          blk('obs', 'ExpenseObserver', 'interface: on_expense()', 'Webhook', 'violet', -1, 0),
          blk('push', 'PushNotifier', 'instant', 'Zap', 'green', 3.5, -3, 0.7),
          blk('email', 'EmailDigest', 'daily buffer', 'Mail', 'green', 3.5, 3, 0.7),
          blk('svc', 'Push service', 'external', 'Network', 'gray', 6.5, -3, 0.6),
        ],
        links: [
          link('group', 'obs', { label: 'notifies' }),
          link('push', 'obs', { label: 'implements' }),
          link('email', 'obs', { label: 'implements' }),
          link('push', 'svc', { label: 'uses' }),
        ],
        flows: [
          { path: ['group', 'obs'], tone: 'event', label: 'on_expense(e)', duration: 1.3 },
          { path: ['obs', 'push'], tone: 'event', label: 'send', duration: 1.2, delay: 1.4 },
          { path: ['obs', 'email'], tone: 'event', label: 'buffer', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Two listeners, one call',
          icon: 'Webhook',
          rows: [
            { text: 'PushNotifier', value: 'now', tone: 'good' },
            { text: 'EmailDigest', value: 'once a day' },
          ],
          footer: { text: 'Group never names them', tone: 'muted' },
        },
        caption: 'Add a listener, change nothing else',
      },
      code: {
        language: 'python',
        title: 'Observers',
        source: `class ExpenseObserver(ABC):
    @abstractmethod
    def on_expense(self, e): ...

class PushNotifier(ExpenseObserver):
    def on_expense(self, e):
        for user in e.shares:
            push.send(user, f"{e.payer} added {e.title}: {e.cents / 100:.2f}")

class EmailDigest(ExpenseObserver):
    def __init__(self):
        self.buffer = []

    def on_expense(self, e):
        self.buffer.append(e)

    def flush_daily(self):
        ...  # one email per user with today's expenses`,
        highlight: [1, 2, 5, 6, 12],
      },
    },
    {
      title: 'Settle up',
      tag: 'case',
      heading: 'Case: recording a payment and the edge cases around it',
      eli5: 'When Chen actually hands Asha 40 coins, the grown-up writes a slip for that too, so the folder shows the debt is paid. And a slip that makes no sense gets refused at the door.',
      body: [
        'A real payment is just an expense: payer Chen, one share of 4000 owed by Asha. The nets move and the plan shrinks. No special balance code.',
        'Guard the edges: payer outside the group, zero amounts, shares that do not add up, and a failing observer. A broken email service must not stop an expense being saved.',
      ],
      keyIdea: 'Model a payment as an expense, validate every input, and never let a listener break the write.',
      metrics: { cost: 'O(people)', transfers: '2', types: '4', classes: '11' },
      metricTones: { transfers: 'good' },
      scene: {
        nodes: [
          { ...chen, at: at(-5, -1.5) },
          { ...blk('group', 'Group', 'settle_up()', 'Users', 'green', 0, -1.5), status: 'active' },
          { ...blk('expense', 'Expense', 'payer Chen, share Asha 4000', 'FileText', 'green', 0, 3.8) },
          { ...asha, at: at(5, -1.5), badge: '+10 left' },
        ],
        links: [
          link('chen', 'group', { label: 'uses' }),
          link('group', 'expense', { label: 'creates' }),
          link('group', 'asha', { style: 'faint', arrow: 'none' }),
        ],
        flows: [
          { path: ['chen', 'group'], tone: 'request', label: 'settle_up(Asha, 4000)', duration: 1.4 },
          { path: ['group', 'expense'], tone: 'data', label: 'Expense', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Checks before saving',
          icon: 'Shield',
          rows: [
            { text: 'Payer is a member', value: 'required' },
            { text: 'Amount above zero', value: 'required' },
            { text: 'Shares sum to total', value: 'strategy checks' },
            { text: 'Observer raises', value: 'log, keep going', tone: 'warn' },
          ],
        },
        caption: 'A payment is one more expense',
      },
      code: {
        language: 'python',
        title: 'Settling and safe notification',
        source: `    def settle_up(self, payer, receiver, cents):
        # payer hands cash to receiver: one share, owed by receiver
        return self.add_expense(payer, cents, ExactSplit(),
                                people={receiver}, meta={receiver: cents},
                                title="settlement")

    def _notify(self, e):
        for o in self.observers:
            try:
                o.on_expense(e)
            except Exception:
                log.exception("observer failed")  # never lose the expense`,
        highlight: [3, 4, 9, 10, 11],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The Splitwise object model on one page',
      eli5: 'The table has kids, a folder of slips, rule cards for splitting, a bell that tells friends, and a grown-up who works out the fewest handovers. Each does one job.',
      body: [
        'Keep the expense log, maintain a running net balance per person, and let `DebtSimplifier` turn nets into at most n - 1 payments. Hide split math behind `SplitStrategy` and notifications behind `ExpenseObserver`.',
        'Keep money in integer cents, validate every input, and treat a payment as one more expense.',
      ],
      keyIdea: 'A running net per person answers queries fast, and the expense log keeps it auditable. Strategy, simplifier and observers hang off Group through interfaces.',
      metrics: { cost: 'O(people)', transfers: '<= n - 1', types: '4', classes: '11' },
      metricTones: { transfers: 'good', types: 'good' },
      scene: {
        nodes: [
          blk('group', 'Group', 'coordinator', 'Users', 'green', 0, -3.5),
          blk('strategy', 'SplitStrategy', 'interface', 'Split', 'violet', -5, 2.5),
          blk('simp', 'DebtSimplifier', 'greedy heaps', 'Workflow', 'green', 0, 4),
          blk('obs', 'ExpenseObserver', 'interface', 'Webhook', 'violet', 5, 2.5),
        ],
        links: [
          link('group', 'strategy', { label: 'uses' }),
          link('group', 'simp', { label: 'uses' }),
          link('group', 'obs', { label: 'notifies' }),
        ],
        panel: {
          title: 'Design choices',
          icon: 'List',
          rows: [
            { text: 'IOU list → net balances', value: 'cycles vanish', tone: 'good' },
            { text: 'Greedy simplify', value: '<= n - 1 payments', tone: 'good' },
            { text: 'Strategy', value: '4 split types' },
            { text: 'Observer', value: 'push, email' },
            { text: 'Integer cents', value: 'no drift' },
          ],
        },
        caption: 'Interfaces on the edges, a record in the middle',
      },
      quiz: {
        question: 'Why does the design keep a running net per person plus an expense log, instead of a pair matrix?',
        options: [
          'A matrix cannot hold more than 1,000 people',
          'Net per person updates in O(people), erases cycles that pair cells cannot see, and the log can verify it',
          'The greedy simplifier needs a matrix as input',
          'Strategies can only write to a list',
        ],
        answer: 1,
        explain: 'A pairwise matrix cannot see a debt cycle. A running net per person is cheap to update and read, cycles vanish, and the expense log can rebuild the nets to verify them.',
      },
    },
  ],
};
