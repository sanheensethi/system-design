import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });

const lib: SceneNode = { id: 'lib', kind: 'block', at: at(0, -3.4), label: 'Library', sub: 'concrete class', icon: 'Warehouse', tint: 'green' };
const book: SceneNode = { id: 'book', kind: 'block', at: at(-3.8, 0), label: 'Book', sub: 'a title', icon: 'FileText', tint: 'green' };
const copy: SceneNode = { id: 'copy', kind: 'block', at: at(3.8, 0), label: 'Copy', sub: 'one physical copy', icon: 'Copy', tint: 'green' };
const member: SceneNode = { id: 'member', kind: 'block', at: at(-3.8, 3.4), label: 'Member', sub: 'concrete class', icon: 'User', tint: 'green' };
const txn: SceneNode = { id: 'txn', kind: 'block', at: at(3.8, 3.4), label: 'Transaction', sub: 'one loan record', icon: 'Receipt', tint: 'green' };
const base: SceneNode = { id: 'base', kind: 'block', at: at(0, -3.4), label: 'BookBase', sub: 'abstract class', icon: 'FileText', tint: 'blue' };
const observer: SceneNode = { id: 'observer', kind: 'block', at: at(0, -3.4), label: 'OverdueObserver', sub: 'interface', icon: 'Mail', tint: 'violet' };
const fineIf: SceneNode = { id: 'fineIf', kind: 'block', at: at(0, -3.4), label: 'FineStrategy', sub: 'interface', icon: 'Scale', tint: 'violet' };
const scanner: SceneNode = { id: 'scanner', kind: 'block', at: at(0, 3.4), label: 'OverdueScanner', sub: 'concrete class', icon: 'Clock', tint: 'green' };

export const lldLibrary: Lesson = {
  id: 'lld-library',
  title: 'Library management',
  tagline: 'Grow a dict of books into entities, type rules, overdue alerts and fine policies, one pain at a time.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Why a dict of counts cannot answer who has what, and how Book, Copy, Member and Transaction split the job',
    'Inheritance plus a Factory for lending rules that differ by book type',
    'The Observer pattern for overdue alerts over email, SMS and more',
    'The Strategy pattern for fine rules, and a Decorator for member tiers',
    'Loan limits, a lock for the last copy, and a catalog index for search',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'rules', label: 'Lending rules', icon: 'Key' },
    { key: 'fines', label: 'Fine policy', icon: 'Scale' },
    { key: 'alerts', label: 'Alerts', icon: 'Mail' },
  ],
  steps: [
    {
      title: 'The library',
      tag: 'problem',
      heading: 'Design a library: simple until someone is late',
      eli5: 'A **library** lends books to kids from a school. The librarian must remember who has which book, when it is due, and what to do when it comes back late.',
      body: [
        'A school wants software for its library: 20,000 books, 3,000 members, several copies of popular titles. Members borrow, return and pay fines.',
        'We start with something ugly that works, feel where it hurts, and fix one pain at a time. Each version is a checkpoint, from v1 to v5.',
      ],
      keyIdea: 'Start from a working version and let each pain choose the next design move.',
      metrics: { classes: '1', rules: '-', fines: '-', alerts: '-' },
      scene: {
        nodes: [
          { ...lib, status: 'active', chips: ['borrow()', 'return_book()'] },
          { id: 'desk', kind: 'block', at: at(-3.8, 3.4), label: 'Desk app', sub: 'external system', icon: 'Laptop', tint: 'gray' },
          { id: 'req', kind: 'block', at: at(3.8, 3.4), label: 'Requirements', sub: 'what it must do', icon: 'List', tint: 'amber' },
        ],
        links: [link('desk', 'lib', 'uses'), link('req', 'lib', 'shapes')],
        flows: [{ path: ['desk', 'lib'], tone: 'request', label: 'borrow(isbn)', duration: 1.6 }],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Books', value: '20,000 titles and copies' },
            { text: 'Members', value: '3,000' },
            { text: 'Borrow', value: 'due date per book type' },
            { text: 'Return', value: 'fine if late' },
            { text: 'Overdue', value: 'remind by email or SMS', tone: 'warn' },
          ],
        },
        caption: 'One desk app asks one library to lend a book',
      },
    },
    {
      title: 'v1 dict',
      tag: 'concept',
      heading: 'v1: a dict from ISBN to a count',
      eli5: 'The librarian keeps one sticky note per title with a number on it. Borrow a book and the number drops by one. The note never says who took it.',
      body: [
        'Brute force: `books` maps an ISBN to how many copies are on the shelf. `borrow` subtracts one, `add` adds one.',
        'It answers "is a copy free?" and nothing else. Who has it? When is it due? What do we charge? The data to answer is not stored anywhere.',
      ],
      keyIdea: 'A count of copies cannot answer questions about people and time.',
      metrics: { classes: '1', rules: 'none', fines: 'none', alerts: 'none' },
      metricTones: { rules: 'bad', fines: 'bad', alerts: 'bad' },
      scene: {
        nodes: [
          { ...lib, status: 'hot', badge: 'a dict' },
          { id: 'dict', kind: 'block', at: at(-3.8, 3.4), label: 'books', sub: 'isbn to count', icon: 'Table', tint: 'gray' },
          { id: 'who', kind: 'block', at: at(3.8, 3.4), label: 'Who? When?', sub: 'not stored', icon: 'Search', tint: 'red', status: 'down' },
        ],
        links: [link('lib', 'dict', 'has-a'), link('lib', 'who', 'cannot answer', { style: 'dashed', labelTone: 'bad' })],
        flows: [{ path: ['lib', 'dict'], tone: 'request', label: 'count - 1', duration: 1.6 }],
        panel: {
          title: 'v1 in a few lines',
          icon: 'Code',
          code: 'class Library:\n    def __init__(self):\n        self.books = {}  # isbn -> count\n    def borrow(self, isbn):\n        if self.books.get(isbn, 0) > 0:\n            self.books[isbn] -= 1\n            return True\n        return False',
          footer: { text: 'No borrower, no due date, no fine', tone: 'bad' },
        },
        caption: 'A number per title and no memory of people',
      },
    },
    {
      title: 'Book and Copy',
      tag: 'concept',
      heading: 'v2: split the title from the physical copy',
      eli5: 'The story is one thing. The three paper books on the shelf are three separate things. You borrow a paper book, and each one needs its own name tag.',
      body: [
        'A **Book** is a title: ISBN, name, author. A **Copy** is one physical item with its own id. The library owns 4 copies of one Book.',
        'The split matters because lending happens to a copy. Copy 2 can be out while copies 1, 3 and 4 sit on the shelf.',
      ],
      keyIdea: 'Model the title and the physical item as separate classes. Lending acts on the item.',
      metrics: { classes: '3', rules: 'none', fines: 'none', alerts: 'none' },
      scene: {
        nodes: [{ ...lib }, { ...book, chips: ['isbn', 'title'] }, { ...copy, chips: ['id', 'borrower', 'due'] }],
        links: [link('lib', 'book', 'has-a catalog'), link('book', 'copy', 'has-a many')],
        flows: [{ path: ['lib', 'book', 'copy'], tone: 'request', label: 'find free copy', duration: 2 }],
        panel: {
          title: 'Book and Copy',
          icon: 'Code',
          code: 'class Book:\n    isbn, title, author\n    copies = []   # list of Copy\n\nclass Copy:\n    id, book\n    borrower = None\n    due = None',
          footer: { text: 'One Book, many Copy objects', tone: 'good' },
        },
        caption: 'The title owns its copies',
      },
      code: {
        language: 'python',
        title: 'Book and Copy',
        source: `class Book:
    def __init__(self, isbn, title, author):
        self.isbn, self.title, self.author = isbn, title, author
        self.copies = []          # list of Copy

class Copy:
    def __init__(self, id, book):
        self.id, self.book = id, book
        self.borrower = None      # the Member holding it, or None
        self.due = None           # a datetime while it is out`,
        highlight: [4, 9, 10],
      },
    },
    {
      title: 'Member and loan',
      tag: 'concept',
      heading: 'Members, and a Transaction for every loan',
      eli5: 'Every kid gets a library card. When a book goes home, the librarian writes one slip: whose card, which book, the day it left and the day it is due.',
      body: [
        'A **Member** holds an id, a name and their open loans. A **Transaction** is the record of one loan: member, copy, borrowed date, due date and a returned date that starts empty.',
        'The Transaction is the history. Fines, reports and overdue checks all read from it, so none of them need to ask a Copy about the past.',
      ],
      keyIdea: 'A loan is its own object. History lives in Transaction, not in Copy.',
      metrics: { classes: '5', rules: 'none', fines: 'none', alerts: 'none' },
      scene: {
        nodes: [{ ...copy, at: at(0, -3.4) }, { ...member, chips: ['id', 'name', 'loans'] }, { ...txn, chips: ['borrowed', 'due', 'returned'] }],
        links: [link('txn', 'member', 'has-a'), link('txn', 'copy', 'has-a', { route: 'straight' })],
        flows: [{ path: ['member', 'txn', 'copy'], tone: 'data', label: 'loan record', duration: 2 }],
        panel: {
          title: 'Member and Transaction',
          icon: 'Code',
          code: 'class Member:\n    id, name\n    loans = []\n\nclass Transaction:\n    member, copy\n    borrowed, due\n    returned = None',
          footer: { text: 'returned is None while the book is out', tone: 'muted' },
        },
        caption: 'A slip per loan: who, what, when',
      },
      code: {
        language: 'python',
        title: 'Member and Transaction',
        source: `class Member:
    def __init__(self, id, name):
        self.id, self.name = id, name
        self.loans = []

class Transaction:
    def __init__(self, member, copy, borrowed, due):
        self.member, self.copy = member, copy
        self.borrowed, self.due = borrowed, due
        self.returned = None   # filled in on return`,
        highlight: [10],
      },
    },
    {
      title: 'Borrow',
      tag: 'concept',
      heading: 'Borrow: find a free copy and write the slip',
      eli5: 'A kid asks for a story. The librarian looks for a copy still on the shelf, stamps a due date in it, writes the slip and hands it over.',
      body: [
        '`Library.borrow(member, isbn)` looks up the Book, walks its copies for one with no borrower, sets the borrower and a due date 14 days out, and creates a Transaction.',
        'No free copy means it returns `None`. The scan is O(copies of one title), which is small, not O(all books) like a flat list.',
      ],
      keyIdea: 'Borrow is a short sequence across four objects: Library, Book, Copy and Transaction.',
      metrics: { classes: '5', rules: 'one for all', fines: 'none', alerts: 'none' },
      scene: {
        nodes: [{ ...lib, status: 'active' }, { ...book }, { ...copy, status: 'ok', chips: [{ text: 'due +14 days', tone: 'good' }] }, { ...txn, at: at(0, 3.4) }],
        links: [link('lib', 'book', 'uses'), link('book', 'copy', 'has-a'), link('lib', 'txn', 'creates')],
        flows: [
          { path: ['lib', 'book'], tone: 'request', label: 'copies', duration: 1 },
          { path: ['book', 'copy'], tone: 'request', label: 'borrower is None?', duration: 1.1, delay: 1.1 },
          { path: ['lib', 'txn'], tone: 'data', label: 'Transaction()', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Library.borrow',
          icon: 'Code',
          code: 'for c in book.copies:\n    if c.borrower is None:\n        c.borrower = member\n        c.due = now() + days(14)\n        t = Transaction(member, c, now(), c.due)\n        self.transactions.append(t)  # init: = []\n        member.loans.append(t)\n        return t',
        },
        caption: 'Four objects, one short sequence',
      },
    },
    {
      title: 'Return',
      tag: 'concept',
      heading: 'Return: close the slip and free the copy',
      eli5: 'The kid brings the book back. The librarian finds the slip, writes today\'s date on it, and puts the book back on the shelf for the next kid.',
      body: [
        'To return, find the open Transaction for that copy, set `returned` to now, and clear the copy\'s borrower. The slip stays forever as history.',
        'Finding the open loan by scanning every transaction is O(n). Instead `borrow` also records `self.open_by_copy[c.id] = t`, a dict from copy id to its open Transaction, so return is one lookup. Return removes the entry with `pop`.',
      ],
      keyIdea: 'Return closes the record and frees the copy. It deletes nothing.',
      metrics: { classes: '5', rules: 'one for all', fines: 'none', alerts: 'none' },
      scene: {
        nodes: [{ ...lib, status: 'active' }, { ...copy, chips: ['borrower = None'] }, { ...txn, at: at(0, 3.4), status: 'ok', chips: [{ text: 'returned = now', tone: 'good' }] }],
        links: [link('lib', 'txn', 'uses'), link('txn', 'copy', 'has-a')],
        flows: [
          { path: ['lib', 'txn'], tone: 'request', label: 'find open loan', duration: 1.2 },
          { path: ['lib', 'copy'], tone: 'response', label: 'borrower = None', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Library.return_book',
          icon: 'Code',
          code: '# in borrow: self.open_by_copy[c.id] = t\ndef return_book(self, copy_id):\n    t = self.open_by_copy.pop(copy_id)   # O(1)\n    t.returned = now()\n    t.copy.borrower = None\n    return t',
          footer: { text: 'open_by_copy makes return O(1). The Transaction stays as history', tone: 'muted' },
        },
        caption: 'Close the slip, free the copy',
      },
    },
    {
      title: 'Rules differ',
      tag: 'tradeoff',
      heading: 'Pain: not every item lends the same way',
      eli5: 'Story books go home for two weeks. Magazines for one week. The big dictionary never leaves the room. One rule for everything gets silly fast.',
      body: [
        'The library holds novels, textbooks, reference books and magazines. Loan lengths are 14, 30, 0 and 7 days, and reference books cannot leave at all.',
        'Hardcoding this in `borrow` means an `if kind == ...` chain that grows with every new type. Each new type edits the same method.',
      ],
      keyIdea: 'Rules that vary by type belong to the type, not to an if-chain in the caller.',
      metrics: { classes: '5', rules: 'if-chain', fines: 'none', alerts: 'none' },
      metricTones: { rules: 'warn' },
      scene: {
        nodes: [
          { ...lib, status: 'hot', badge: 'if kind == ...' },
          { ...book, at: at(-3.8, 3.4), chips: ['novel', 'textbook', 'reference', 'magazine'] },
          { id: 'rule', kind: 'block', at: at(3.8, 3.4), label: 'Lending rule', sub: 'differs per type', icon: 'Key', tint: 'amber' },
        ],
        links: [link('lib', 'book', 'asks type'), link('book', 'rule', 'decides')],
        flows: [{ path: ['lib', 'book', 'rule'], tone: 'request', label: 'which rule?', duration: 2 }],
        panel: {
          title: 'Lending rules by type',
          icon: 'Table',
          rows: [
            { text: 'Novel', value: '14 days' },
            { text: 'Textbook', value: '30 days' },
            { text: 'Magazine', value: '7 days' },
            { text: 'Reference', value: 'in library only', tone: 'warn' },
          ],
        },
        caption: 'Four types, four rules',
      },
    },
    {
      title: 'BookBase',
      tag: 'concept',
      heading: 'v3: an abstract BookBase with one subclass per type',
      eli5: 'Every kind of book follows the same short card: "how many days can it go home?" and "can it go home at all?". Each kind fills in its own answers.',
      body: [
        '`BookBase` is an abstract class with two methods: `loan_period_days()` and `is_lendable()`. Its `__init__` keeps the ISBN, title, author and the list of copies, so `BookBase` replaces the plain `Book` class from v2.',
        '`Novel`, `Textbook`, `Reference` and `Magazine` extend it and answer for themselves. `Library.borrow` now just asks the book, with no type check.',
      ],
      keyIdea: 'Put the varying rule behind an abstract method. Callers ask, subclasses answer.',
      metrics: { classes: '9', rules: 'polymorphic', fines: 'none', alerts: 'none' },
      metricTones: { rules: 'good' },
      scene: {
        nodes: [
          { ...base },
          { id: 'novel', kind: 'block', size: 0.8, at: at(-3.8, 0), label: 'Novel', sub: '14 days', icon: 'FileText', tint: 'green' },
          { id: 'ref', kind: 'block', size: 0.8, at: at(3.8, 0), label: 'Reference', sub: 'not lendable', icon: 'FileText', tint: 'green' },
          { id: 'mag', kind: 'block', size: 0.8, at: at(0, 3.4), label: 'Magazine', sub: '7 days', icon: 'FileText', tint: 'green' },
        ],
        links: [link('novel', 'base', 'extends'), link('ref', 'base', 'extends'), link('mag', 'base', 'extends')],
        flows: [{ path: ['base', 'novel'], tone: 'request', label: 'loan_period_days()', duration: 1.6 }],
        panel: {
          title: 'BookBase',
          icon: 'Code',
          code: 'class BookBase(ABC):\n    def loan_period_days(self) -> int\n    def is_lendable(self) -> bool\n\nclass Novel(BookBase):\n    loan_period_days -> 14\n    is_lendable -> True',
          footer: { text: 'Textbook returns 30, Magazine 7', tone: 'muted' },
        },
        caption: 'Each type answers for itself',
      },
      code: {
        language: 'python',
        title: 'Abstract base and subclasses',
        source: `from abc import ABC, abstractmethod
import threading

class BookBase(ABC):
    def __init__(self, isbn, title, author):
        self.isbn, self.title, self.author = isbn, title, author
        self.copies = []
        self.lock = threading.Lock()   # used in the last copy step

    @abstractmethod
    def loan_period_days(self) -> int: ...
    @abstractmethod
    def is_lendable(self) -> bool: ...

class Novel(BookBase):
    def loan_period_days(self): return 14
    def is_lendable(self): return True

class Reference(BookBase):
    def loan_period_days(self): return 0
    def is_lendable(self): return False  # read in the library only`,
        highlight: [10, 12, 16, 17, 20, 21],
      },
    },
    {
      title: 'Factory',
      tag: 'concept',
      heading: 'A BookFactory so nobody picks subclasses by hand',
      eli5: 'A helper at the door hears "textbook" and hands over the right kind of book card. Nobody else needs to know how to make one.',
      body: [
        'Data enters as strings from a spreadsheet: `"novel"`, `"reference"`. Something must turn a string into the right subclass.',
        '`BookFactory.create(kind, **fields)` holds one dict from name to class. Adding `Comic` is one new class and one dict entry. The rest of the code never sees the dict.',
      ],
      keyIdea: 'A factory keeps the "which class?" decision in one place.',
      metrics: { classes: '10', rules: 'polymorphic', fines: 'none', alerts: 'none' },
      scene: {
        nodes: [
          { id: 'factory', kind: 'block', at: at(-3.8, -3.4), label: 'BookFactory', sub: 'concrete class', icon: 'Package', tint: 'green' },
          { ...base, at: at(0, 0) },
          { id: 'novel', kind: 'block', size: 0.8, at: at(3.8, 3.4), label: 'Textbook', sub: '30 days', icon: 'FileText', tint: 'green', status: 'active' },
          { id: 'csv', kind: 'block', at: at(-3.8, 3.4), label: 'Catalog file', sub: 'external system', icon: 'Table', tint: 'gray' },
        ],
        links: [link('csv', 'factory', 'uses'), link('factory', 'novel', 'creates'), link('novel', 'base', 'extends')],
        flows: [
          { path: ['csv', 'factory'], tone: 'request', label: 'create("textbook")', duration: 1.4 },
          { path: ['factory', 'novel'], tone: 'data', label: 'Textbook()', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'BookFactory',
          icon: 'Code',
          code: 'class BookFactory:\n    @staticmethod\n    def create(kind, **kwargs):\n        cls = {"novel": Novel,\n               "textbook": Textbook,\n               "reference": Reference,\n               "magazine": Magazine}[kind]\n        return cls(**kwargs)',
        },
        caption: 'A name goes in, the right subclass comes out',
      },
      quiz: {
        question: 'A new book type "comic" arrives with a 10 day loan. What is the smallest correct change?',
        options: [
          'Add an if branch for "comic" inside Library.borrow',
          'Add a Comic subclass of BookBase and one entry in the BookFactory dict',
          'Add a loan_days field to Copy and set it by hand',
          'Copy Novel into the Library class and edit it',
        ],
        answer: 1,
        explain: 'The rule lives in the subclass, and the factory maps the name to it. Borrow, return and everything else stay untouched.',
      },
    },
    {
      title: 'Use the rule',
      tag: 'concept',
      heading: 'Borrow now asks the book, and refuses reference items',
      eli5: 'At the desk the librarian looks at the book card. If it says "stays in the room", the answer is no. If it says "7 days", she stamps a date one week away.',
      body: [
        '`borrow` checks `is_lendable()` first and raises a clear error for reference books. Then it sets the due date from `loan_period_days()`.',
        'The method no longer mentions Novel, Textbook or Magazine. That is the open-closed idea in practice: new types extend, old code stays shut.',
      ],
      keyIdea: 'Borrow depends on the BookBase interface, never on a concrete type.',
      metrics: { classes: '10', rules: 'polymorphic', fines: 'none', alerts: 'none' },
      scene: {
        nodes: [{ ...lib, status: 'active' }, { ...base, at: at(-3.8, 3.4), status: 'active' }, { ...copy, at: at(3.8, 3.4), chips: [{ text: 'due +7 days', tone: 'good' }] }],
        links: [link('lib', 'base', 'uses'), link('lib', 'copy', 'sets due')],
        flows: [
          { path: ['lib', 'base'], tone: 'request', label: 'is_lendable()', duration: 1.2 },
          { path: ['base', 'lib'], tone: 'response', label: 'True', duration: 1, delay: 1.3 },
          { path: ['lib', 'copy'], tone: 'data', label: 'due = now + 7', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'borrow with rules',
          icon: 'Code',
          code: 'if not book.is_lendable(): raise ValueError()\nfor c in book.copies:\n    if c.borrower is None:\n        c.borrower = member\n        c.due = now() + days(book.loan_period_days())\n        t = Transaction(member, c, now(), c.due)\n        self.transactions.append(t); member.loans.append(t)\n        return t',
        },
        caption: 'The method asks, the subclass answers',
      },
    },
    {
      title: 'Overdue pain',
      tag: 'tradeoff',
      heading: 'Pain: who tells a member their book is late?',
      eli5: 'A book is a week late. The librarian could call, write a note, or tell the teacher. Today it is a note. Next month the school wants a text message too.',
      body: [
        'A nightly job finds open loans past their due date and sends a reminder. First it was email. Then SMS. Then a push notification.',
        'If the scan calls `send_email` directly, every new channel edits the scan, and the scan can no longer be tested without a mail server.',
      ],
      keyIdea: 'The thing that detects overdue loans should not know how people are notified.',
      metrics: { classes: '10', rules: 'polymorphic', fines: 'none', alerts: 'hard-wired' },
      metricTones: { alerts: 'bad' },
      scene: {
        nodes: [
          { ...txn, at: at(-3.8, -3.4), status: 'hot', chips: [{ text: 'due 3 days ago', tone: 'bad' }] },
          { ...scanner, at: at(0, 0), status: 'hot', badge: 'sends email itself' },
          { id: 'mail', kind: 'block', at: at(3.8, 3.4), label: 'Email server', sub: 'external system', icon: 'Mail', tint: 'gray' },
        ],
        links: [link('scanner', 'txn', 'uses'), link('scanner', 'mail', 'uses', { labelTone: 'warn' })],
        flows: [{ path: ['scanner', 'txn', 'scanner', 'mail'], tone: 'event', label: 'send_email()', duration: 2.4 }],
        panel: {
          title: 'Channels over time',
          icon: 'Table',
          rows: [
            { text: 'Year 1', value: 'email' },
            { text: 'Year 2', value: '+ SMS', tone: 'warn' },
            { text: 'Year 3', value: '+ push', tone: 'warn' },
          ],
          footer: { text: 'Each one edits the scanner', tone: 'bad' },
        },
        caption: 'Detecting and notifying are tangled together',
      },
    },
    {
      title: 'Observer',
      tag: 'concept',
      heading: 'v4: observers subscribe to the overdue event',
      eli5: 'The scanner shouts "this book is late!" into the room. Anyone who signed up to listen, the mail desk, the phone desk, does their own job when they hear it.',
      body: [
        'Define an interface `OverdueObserver` with one method, `on_overdue(transaction)`. The scanner holds a list of observers and calls each one for every late loan.',
        'This is the **Observer pattern**: one subject, many listeners, and the subject knows only the interface.',
      ],
      keyIdea: 'The scanner publishes an event. Observers decide what to do with it.',
      metrics: { classes: '12', rules: 'polymorphic', fines: 'none', alerts: 'pluggable' },
      metricTones: { alerts: 'good' },
      scene: {
        nodes: [
          { ...observer },
          { ...scanner, at: at(-3.8, 3.4), status: 'active' },
          { id: 'email', kind: 'block', size: 0.8, at: at(3.8, 3.4), label: 'EmailReminder', sub: 'concrete class', icon: 'Mail', tint: 'green' },
        ],
        links: [link('scanner', 'observer', 'has-a list'), link('email', 'observer', 'implements')],
        flows: [
          { path: ['scanner', 'observer'], tone: 'event', label: 'on_overdue(t)', duration: 1.4 },
          { path: ['observer', 'email'], tone: 'event', label: 'on_overdue(t)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class OverdueObserver(ABC):\n    @abstractmethod\n    def on_overdue(self, transaction): ...',
          footer: { text: 'One method is the whole contract', tone: 'muted' },
        },
        caption: 'Subject calls the interface, listeners react',
      },
    },
    {
      title: 'Scanner',
      tag: 'concept',
      heading: 'Email and SMS observers, and the scanner loop',
      eli5: 'The mail desk writes a letter. The phone desk sends a text. Both listen for the same shout and the scanner never learns which one is which.',
      body: [
        '`EmailReminder` and `SMSReminder` each implement `on_overdue`. The scanner walks open transactions where `now > due` and notifies every observer.',
        'Adding push is one new class passed into the constructor. The scanner does not change, and a test can pass a fake observer that records calls.',
      ],
      keyIdea: 'A new channel is a new class, not an edit to the scanner.',
      metrics: { classes: '14', rules: 'polymorphic', fines: 'none', alerts: 'email + SMS' },
      metricTones: { alerts: 'good' },
      scene: {
        nodes: [
          { ...scanner, at: at(-3.8, -3.4), status: 'active' },
          { ...observer, at: at(0, 0), size: 0.8 },
          { id: 'email', kind: 'block', size: 0.8, at: at(-3.8, 3.4), label: 'EmailReminder', sub: 'concrete class', icon: 'Mail', tint: 'green' },
          { id: 'sms', kind: 'block', size: 0.8, at: at(3.8, 3.4), label: 'SMSReminder', sub: 'concrete class', icon: 'Signal', tint: 'green' },
        ],
        links: [link('scanner', 'observer', 'uses'), link('email', 'observer', 'implements'), link('sms', 'observer', 'implements')],
        flows: [
          { path: ['scanner', 'observer', 'email'], tone: 'event', label: 'on_overdue', duration: 1.8 },
          { path: ['scanner', 'observer', 'sms'], tone: 'event', label: 'on_overdue', duration: 1.8, delay: 0.5 },
        ],
        panel: {
          title: 'OverdueScanner.scan',
          icon: 'Code',
          code: 'def scan(self):\n    now = datetime.now()\n    for t in self.lib.transactions:\n        if t.returned is None and now > t.due:\n            for o in self.observers:\n                o.on_overdue(t)',
        },
        caption: 'One scan, every channel',
      },
      code: {
        language: 'python',
        title: 'Observers and the scanner',
        source: `class EmailReminder(OverdueObserver):
    def on_overdue(self, t):
        email.send(t.member.email, f"'{t.copy.book.title}' is overdue")

class SMSReminder(OverdueObserver):
    def on_overdue(self, t):
        sms.send(t.member.phone, f"Please return '{t.copy.book.title}'")

class OverdueScanner:
    def __init__(self, library, observers):
        self.lib, self.observers = library, observers

    def scan(self):
        now = datetime.now()
        for t in self.lib.transactions:
            if t.returned is None and now > t.due:
                for o in self.observers: o.on_overdue(t)`,
        highlight: [10, 16, 17],
      },
    },
    {
      title: 'Fine pain',
      tag: 'tradeoff',
      heading: 'Pain: the fine rules keep changing',
      eli5: 'Being late costs a few coins. The principal says "a coin a day". Next term: "more coins the later you are". Then: "teacher\'s helpers pay less". The rule keeps moving.',
      body: [
        'Return time needs a fine. The simplest rule is a flat amount per day late. Then the board asks for tiers, then a discount for premium members.',
        'If the amount is computed inside `return_book`, each policy change edits the method that also frees the copy and closes the slip.',
      ],
      keyIdea: 'A rule that changes often should live behind its own interface.',
      metrics: { classes: '14', rules: 'polymorphic', fines: 'in return_book', alerts: 'email + SMS' },
      metricTones: { fines: 'bad' },
      scene: {
        nodes: [
          { ...lib, status: 'hot', badge: 'fine math inside' },
          { ...txn, at: at(-3.8, 3.4), chips: [{ text: '10 days late', tone: 'bad' }] },
          { id: 'policy', kind: 'block', at: at(3.8, 3.4), label: 'Fine policy', sub: 'changes each term', icon: 'Scale', tint: 'amber' },
        ],
        links: [link('lib', 'txn', 'reads'), link('lib', 'policy', 'hardcodes', { labelTone: 'warn' })],
        flows: [{ path: ['lib', 'txn', 'lib', 'policy'], tone: 'request', label: 'days x rate', duration: 2.4 }],
        panel: {
          title: 'Policies asked for',
          icon: 'Table',
          rows: [
            { text: 'Flat', value: '$1 per day' },
            { text: 'Tiered', value: '$1, then $2, then $5', tone: 'warn' },
            { text: 'Premium member', value: 'grace days, half rate', tone: 'warn' },
          ],
        },
        caption: 'Return logic tangled with money rules',
      },
    },
    {
      title: 'FineStrategy',
      tag: 'concept',
      heading: 'v5: a FineStrategy interface',
      eli5: 'The librarian keeps a rule card in a slot. Today the card says "a coin a day". Swap the card and the same librarian charges differently.',
      body: [
        '`FineStrategy` has one method: `calculate(transaction, returned_at)`. `FlatDailyFine` multiplies days late by a rate.',
        'The Library receives a strategy in its constructor and calls it on return. This is the **Strategy pattern**: an interchangeable algorithm behind an interface.',
      ],
      keyIdea: 'Strategy makes the policy an object you can swap, without touching the caller.',
      metrics: { classes: '16', rules: 'polymorphic', fines: 'swappable', alerts: 'email + SMS' },
      metricTones: { fines: 'good' },
      scene: {
        nodes: [
          { ...fineIf },
          { ...lib, at: at(-3.8, 3.4), status: 'active' },
          { id: 'flat', kind: 'block', size: 0.8, at: at(3.8, 3.4), label: 'FlatDailyFine', sub: 'concrete class', icon: 'Scale', tint: 'green' },
        ],
        links: [link('lib', 'fineIf', 'has-a'), link('flat', 'fineIf', 'implements')],
        flows: [
          { path: ['lib', 'fineIf'], tone: 'request', label: 'calculate(t, now)', duration: 1.4 },
          { path: ['fineIf', 'flat'], tone: 'request', label: 'days x per_day', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'FlatDailyFine',
          icon: 'Code',
          code: 'class FineStrategy(ABC):\n    @abstractmethod\n    def calculate(self, t, returned_at) -> float: ...\n\nclass FlatDailyFine(FineStrategy):\n    def __init__(self, per_day): self.per_day = per_day\n    def calculate(self, t, ret):\n        return max(0, (ret - t.due).days) * self.per_day',
        },
        caption: 'The policy is a plug-in',
      },
    },
    {
      title: 'Tiered fine',
      tag: 'case',
      heading: 'Tiered fines are a second strategy, not a new if',
      eli5: 'A second rule card says: the first week costs one coin a day, the second week two coins, after that five. Slot it in and nothing else changes.',
      body: [
        '`TieredFine` charges $1 per day for days 1 to 7, $2 per day for days 8 to 14 and $5 per day after that. It walks the tiers and spends the late days across them.',
        'A loan 10 days late costs 7 x $1 + 3 x $2 = **$13**. Flat at $1 would be $10. The Library did not change a line.',
      ],
      keyIdea: 'A new policy is a new class. The caller is untouched.',
      metrics: { classes: '17', rules: 'polymorphic', fines: 'tiered', alerts: 'email + SMS' },
      metricTones: { fines: 'good' },
      scene: {
        nodes: [
          { ...fineIf },
          { id: 'flat', kind: 'block', size: 0.8, at: at(-3.8, 3.4), label: 'FlatDailyFine', sub: 'dimmed', icon: 'Scale', tint: 'green', status: 'dim' },
          { id: 'tiered', kind: 'block', size: 0.8, at: at(3.8, 3.4), label: 'TieredFine', sub: 'concrete class', icon: 'Scale', tint: 'green', status: 'active', chips: [{ text: '10 days = $13', tone: 'warn' }] },
        ],
        links: [link('flat', 'fineIf', 'implements'), link('tiered', 'fineIf', 'implements')],
        flows: [{ path: ['fineIf', 'tiered'], tone: 'request', label: 'calculate()', duration: 1.6 }],
        panel: {
          title: '10 days late, tiered',
          icon: 'Table',
          rows: [
            { text: 'Days 1 to 7', value: '7 x $1 = $7' },
            { text: 'Days 8 to 14', value: '3 x $2 = $6' },
            { text: 'Days 15 and up', value: '$5 per day' },
          ],
          footer: { text: 'Total: $13', tone: 'good' },
        },
        caption: 'Same interface, different arithmetic',
      },
      code: {
        language: 'python',
        title: 'TieredFine',
        source: `class TieredFine(FineStrategy):
    """Days 1-7: $1/day, 8-14: $2/day, 15+: $5/day."""
    def calculate(self, t, ret):
        remaining = max(0, (ret - t.due).days)
        fine = 0
        for limit, rate in [(7, 1), (7, 2), (float("inf"), 5)]:
            used = min(remaining, limit)
            fine += used * rate
            remaining -= used
            if remaining <= 0:
                break
        return fine`,
        highlight: [6, 7, 8],
      },
    },
    {
      title: 'Member tier',
      tag: 'concept',
      heading: 'Premium members: wrap a strategy in a Decorator',
      eli5: 'Teacher\'s helpers get a kinder rule: three free days, then half price. We do not write a new card. We clip a small note on top of the old one.',
      body: [
        'Premium members get a grace window. Within 3 days of the due date the fine is $0. Past that, the whole fine is halved, so 10 days late is $13 / 2 = $6.50. `Member.tier` is a new field, "standard" or "premium". Rewriting both strategies for this would copy code.',
        '`MembershipTierFine` is a **Decorator**: it is a FineStrategy that holds another FineStrategy, asks it for the base fine, then adjusts. For a premium member 10 days late, the $13 becomes $6.50.',
      ],
      keyIdea: 'A decorator adds a rule on top of any strategy without changing it.',
      metrics: { classes: '18', rules: 'polymorphic', fines: 'tiered + tier discount', alerts: 'email + SMS' },
      metricTones: { fines: 'good' },
      scene: {
        nodes: [
          { ...fineIf },
          { id: 'tier', kind: 'block', size: 0.8, at: at(-3.8, 3.4), label: 'MembershipTierFine', sub: 'decorator', icon: 'Users', tint: 'green', status: 'active' },
          { id: 'tiered', kind: 'block', size: 0.8, at: at(3.8, 3.4), label: 'TieredFine', sub: 'wrapped base', icon: 'Scale', tint: 'green' },
        ],
        links: [link('tier', 'fineIf', 'implements'), link('tier', 'tiered', 'has-a'), link('tiered', 'fineIf', 'implements')],
        flows: [
          { path: ['tier', 'tiered'], tone: 'request', label: 'base.calculate()', duration: 1.4 },
          { path: ['tiered', 'tier'], tone: 'response', label: '$13', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'MembershipTierFine',
          icon: 'Code',
          code: 'class MembershipTierFine(FineStrategy):\n    def __init__(self, base): self.base = base\n    def calculate(self, t, ret):\n        raw = self.base.calculate(t, ret)\n        if t.member.tier == "premium":\n            if ret <= t.due + timedelta(days=3): return 0\n            return raw / 2\n        return raw',
        },
        caption: 'A strategy that wraps a strategy',
      },
    },
    {
      title: 'Wire it up',
      tag: 'concept',
      heading: 'The Library takes its collaborators from outside',
      eli5: 'The librarian does not choose the rule card herself. The principal hands her one each term, and she just follows the card.',
      body: [
        '`Library(fine_strategy)` receives the policy and the scanner receives its observers. Neither creates what it needs. This is **dependency injection**.',
        'The composition happens in one place at startup: `Library(MembershipTierFine(TieredFine()))`. Tests build the same Library with a fake strategy.',
      ],
      keyIdea: 'Build the object graph in one place. Classes receive what they need.',
      metrics: { classes: '18', rules: 'polymorphic', fines: 'injected', alerts: 'injected' },
      metricTones: { fines: 'good', alerts: 'good' },
      scene: {
        nodes: [
          { ...lib, at: at(0, -3.4), status: 'active' },
          { ...fineIf, at: at(-3.8, 0), size: 0.8 },
          { ...scanner, at: at(3.8, 0), size: 0.8 },
          { id: 'main', kind: 'block', at: at(0, 3.4), label: 'main()', sub: 'composition root', icon: 'Code', tint: 'amber' },
        ],
        links: [link('lib', 'fineIf', 'has-a'), link('scanner', 'lib', 'uses'), link('main', 'lib', 'creates')],
        flows: [
          { path: ['main', 'lib'], tone: 'data', label: 'inject strategy', duration: 1.4 },
          { path: ['lib', 'fineIf'], tone: 'request', label: 'calculate()', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Library.return_book',
          icon: 'Code',
          code: 'def return_book(self, copy_id):\n    t = self._find_transaction(copy_id)\n    t.returned = datetime.now()\n    fine = self.fine_strategy.calculate(t, t.returned)\n    t.member.fines_owed += fine   # a pay() call lowers it\n    t.copy.borrower = None\n    return fine',
          footer: { text: 'No fine rule appears in this method', tone: 'good' },
        },
        caption: 'main() decides, the Library obeys',
      },
      quiz: {
        question: 'The school wants a fine of $2 per day plus a $5 flat fee when a book is more than 30 days late. Which change fits the design?',
        options: [
          'Edit return_book and add the arithmetic',
          'Add a new FineStrategy class and pass it in when building the Library',
          'Store the fee on every Copy',
          'Subclass Library for each fee rule',
        ],
        answer: 1,
        explain: 'Fine rules live behind FineStrategy. A new class plugs in at startup and return_book, the scanner and the entities stay as they are.',
      },
    },
    {
      title: 'Loan limits',
      tag: 'case',
      heading: 'Case: limits on how many books a member can hold',
      eli5: 'Each kid may carry home five books at once, and not if they still owe coins. The librarian checks the card before she stamps anything.',
      body: [
        'A member may hold at most 5 open loans, and cannot borrow while an unpaid fine remains. `Member` holds its loans and a `fines_owed` total. Return adds each fine to it, and a payment call reduces it.',
        'Keep the check in the borrow path before any state changes. A refused request should leave every object exactly as it was.',
      ],
      keyIdea: 'Validate first, mutate second. A refused borrow changes nothing.',
      metrics: { classes: '18', rules: 'polymorphic', fines: 'injected', alerts: 'injected' },
      scene: {
        nodes: [
          { ...lib, status: 'active' },
          { ...member, at: at(-3.8, 3.4), chips: [{ text: '5 open loans', tone: 'warn' }, { text: 'fine owed $3', tone: 'bad' }] },
          { ...txn, at: at(3.8, 3.4), status: 'dim' },
        ],
        links: [link('lib', 'member', 'checks'), link('lib', 'txn', 'creates', { style: 'dashed' })],
        flows: [
          { path: ['lib', 'member'], tone: 'request', label: 'can_borrow()', duration: 1.4 },
          { path: ['member', 'lib'], tone: 'error', label: 'refused', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Checks before borrow',
          icon: 'Code',
          code: 'def open_loans(self):\n    return [t for t in self.loans if t.returned is None]\ndef can_borrow(self):\n    return len(self.open_loans()) < 5 \\\n        and self.fines_owed == 0\n# Library.borrow, first line:\nif not member.can_borrow(): raise ValueError()',
        },
        caption: 'The card is checked before the stamp',
      },
    },
    {
      title: 'Last copy',
      tag: 'case',
      heading: 'Case: two members grab the last copy at once',
      eli5: 'Two kids reach for the very last copy at the same moment. Both see it on the shelf. Only one should walk away with it.',
      body: [
        'Two desk threads run `borrow` for the same title. Both see a copy with no borrower, both set themselves as borrower. One loan silently overwrites the other.',
        'Check and set must happen as one step. Guard the title\'s copy list with a lock. Per-title locks keep different titles from waiting on each other.',
      ],
      keyIdea: 'Check-then-set on shared state needs a lock, and the smaller the lock the better.',
      metrics: { classes: '18', rules: 'polymorphic', fines: 'injected', alerts: 'injected' },
      scene: {
        nodes: [
          { id: 'ta', kind: 'worker', at: at(-3.8, -4), label: 'Desk A', sub: 'borrow()', status: 'hot', load: 70 },
          { id: 'tb', kind: 'worker', at: at(3.8, -4), label: 'Desk B', sub: 'borrow()', status: 'hot', load: 70 },
          { id: 'lock', kind: 'vault', at: at(0, -0.9), label: 'Title lock', sub: 'one holder' },
          { ...copy, at: at(3.6, 5), status: 'active', chips: [{ text: 'last copy', tone: 'warn' }] },
        ],
        links: [link('ta', 'lock', 'acquire'), link('tb', 'lock', 'waits', { labelTone: 'warn' }), link('lock', 'copy', 'guards')],
        flows: [
          { path: ['ta', 'lock', 'copy'], tone: 'request', label: 'borrower = A', duration: 2 },
          { path: ['tb', 'lock'], tone: 'error', label: 'blocked', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Per-title lock',
          icon: 'Code',
          code: 'def borrow(self, member, isbn):\n    book = self.catalog[isbn]\n    with book.lock:          # one per title\n        for c in book.copies:\n            if c.borrower is None:\n                c.borrower = member\n                ...\n                return t',
          footer: { text: 'Different titles never wait on each other', tone: 'good' },
        },
        caption: 'Check and set become one step',
      },
    },
    {
      title: 'Search',
      tag: 'concept',
      heading: 'Finding books fast with a catalog index',
      eli5: 'Instead of reading every spine on every shelf, the librarian keeps a card index. Look up "dinosaurs" and it points to the right shelf at once.',
      body: [
        'Members search by title, author or ISBN. Scanning 20,000 books is O(n). A `Catalog` keeps dicts: ISBN to Book, and lowercase author or title word to a set of ISBNs.',
        '`add(book)` fills both dicts once, when a book enters the library. After that `search` is one dict lookup per word.',
      ],
      keyIdea: 'Index the lookups you do often. A dict turns a scan into a single step.',
      metrics: { classes: '19', rules: 'polymorphic', fines: 'injected', alerts: 'injected' },
      scene: {
        nodes: [
          { ...lib, status: 'active' },
          { id: 'catalog', kind: 'block', at: at(-3.8, 3.4), label: 'Catalog', sub: 'indexes', icon: 'Search', tint: 'green', chips: ['by isbn', 'by author', 'by title word'] },
          { ...book, at: at(3.8, 3.4) },
        ],
        links: [link('lib', 'catalog', 'has-a'), link('catalog', 'book', 'finds')],
        flows: [
          { path: ['lib', 'catalog'], tone: 'request', label: 'search("dino")', duration: 1.4 },
          { path: ['catalog', 'book'], tone: 'response', label: 'isbns', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Catalog indexes',
          icon: 'Code',
          code: 'class Catalog:  # by_isbn, by_word = {}, {}\n    def add(self, book):\n        self.by_isbn[book.isbn] = book\n        for w in (book.title + " " + book.author).lower().split():\n            self.by_word.setdefault(w, set()).add(book.isbn)\n    def search(self, word):\n        return [self.by_isbn[i] for i in\n                self.by_word.get(word.lower(), ())]',
          footer: { text: 'Search is a dict lookup, not a scan', tone: 'good' },
        },
        caption: 'A card index instead of a shelf walk',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Five versions, five pains, five small moves',
      eli5: 'We started with one sticky note and ended with a tidy library: cards for books and kids, a rule card for fines, helpers for reminders, and an index so nobody reads every spine.',
      body: [
        'v1 dict, v2 entities (Book, Copy, Member, Transaction), v3 inheritance with a Factory, v4 Observer for alerts, v5 Strategy and Decorator for fines.',
        'Extras: loan limits checked before any change, a lock around check-then-set, and indexes for search and return.',
      ],
      keyIdea: 'Each pattern answered one concrete pain. Without the pain, the pattern is just extra code.',
      metrics: { classes: '19', rules: 'polymorphic', fines: 'tiered + tier discount', alerts: 'email + SMS' },
      metricTones: { rules: 'good', fines: 'good', alerts: 'good' },
      scene: {
        nodes: [
          { ...lib, status: 'ok' },
          { ...base, at: at(-3.8, 0), size: 0.8, status: 'ok' },
          { ...observer, at: at(3.8, 0), size: 0.8, status: 'ok' },
          { ...fineIf, at: at(0, 3.4), size: 0.8, status: 'ok' },
        ],
        links: [link('lib', 'base', 'uses'), link('lib', 'observer', 'notifies'), link('lib', 'fineIf', 'has-a')],
        flows: [{ path: ['lib', 'fineIf'], tone: 'request', label: 'calculate()', duration: 1.6 }],
        panel: {
          title: 'Version to pattern',
          icon: 'Table',
          rows: [
            { text: 'v2 Entities', value: 'who and when' },
            { text: 'v3 Factory', value: 'type rules' },
            { text: 'v4 Observer', value: 'overdue alerts' },
            { text: 'v5 Strategy + Decorator', value: 'fines' },
          ],
        },
        caption: 'Every pattern earned its place',
      },
      quiz: {
        question: 'Which pairing of pain and pattern is correct for this design?',
        options: [
          'Many alert channels: Strategy',
          'Fine rules that vary by member tier: Observer',
          'Lending rules that differ by book type: inheritance plus a Factory',
          'Two desks taking the last copy: Decorator',
        ],
        answer: 2,
        explain: 'Type-specific rules go in subclasses created by a factory. Alerts are Observer, fine policies are Strategy with a Decorator for tiers, and the last-copy race needs a lock.',
      },
    },
  ],
};
