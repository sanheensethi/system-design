import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });

const web: SceneNode = { id: 'web', kind: 'block', at: at(0, 3.4), label: 'Web app', sub: 'external system', icon: 'Laptop', tint: 'gray' };
const user: SceneNode = { id: 'user', kind: 'block', at: at(3.8, 0), label: 'User', sub: 'concrete class', icon: 'User', tint: 'green' };
const post: SceneNode = { id: 'post', kind: 'block', at: at(0, -3.4), label: 'Post', sub: 'abstract class', icon: 'FileText', tint: 'blue' };
const question: SceneNode = { id: 'question', kind: 'block', at: at(-3.8, 0), label: 'Question', sub: 'extends Post', icon: 'Search', tint: 'green' };
const answer: SceneNode = { id: 'answer', kind: 'block', at: at(3.8, 0), label: 'Answer', sub: 'extends Post', icon: 'Mail', tint: 'green' };
const comment: SceneNode = { id: 'comment', kind: 'block', at: at(0, 3.4), label: 'Comment', sub: 'concrete class', icon: 'List', tint: 'green' };
const vote: SceneNode = { id: 'vote', kind: 'block', at: at(-3.8, 3.4), label: 'Vote', sub: '+1 or -1', icon: 'Star', tint: 'green' };
const tag: SceneNode = { id: 'tag', kind: 'block', at: at(3.8, 3.4), label: 'Tag', sub: 'a topic name', icon: 'Hash', tint: 'green' };
const voting: SceneNode = { id: 'voting', kind: 'block', at: at(0, -3.4), label: 'VotingService', sub: 'concrete class', icon: 'Scale', tint: 'green' };
const repIf: SceneNode = { id: 'repIf', kind: 'block', at: at(0, 0), label: 'ReputationStrategy', sub: 'interface', icon: 'Scale', tint: 'violet' };
const defRep: SceneNode = { id: 'defRep', kind: 'block', at: at(-3.8, 3.4), label: 'DefaultReputation', sub: 'concrete class', icon: 'Star', tint: 'green' };
const hiRep: SceneNode = { id: 'hiRep', kind: 'block', at: at(3.8, 3.4), label: 'HighStakes', sub: 'concrete class', icon: 'TrendingUp', tint: 'green' };
const qa: SceneNode = { id: 'qa', kind: 'block', at: at(0, -3.4), label: 'QAService', sub: 'concrete class', icon: 'Workflow', tint: 'green' };
const bus: SceneNode = { id: 'bus', kind: 'block', at: at(0, 0), label: 'EventBus', sub: 'subject', icon: 'Share2', tint: 'blue' };
const emailer: SceneNode = { id: 'emailer', kind: 'block', at: at(-3.8, 3.4), label: 'EmailNotifier', sub: 'observer', icon: 'Mail', tint: 'green' };
const badger: SceneNode = { id: 'badger', kind: 'block', at: at(3.8, 3.4), label: 'BadgeAwarder', sub: 'observer', icon: 'Star', tint: 'green' };
const stateIf: SceneNode = { id: 'stateIf', kind: 'block', at: at(0, 0), label: 'QuestionState', sub: 'interface', icon: 'Repeat', tint: 'violet' };
const openS: SceneNode = { id: 'openS', kind: 'block', at: at(-5.4, 3.4), label: 'OpenState', sub: 'concrete class', icon: 'Key', tint: 'green' };
const closedS: SceneNode = { id: 'closedS', kind: 'block', at: at(0, 3.4), label: 'ClosedState', sub: 'concrete class', icon: 'Shield', tint: 'green' };
const dupS: SceneNode = { id: 'dupS', kind: 'block', at: at(5.4, 3.4), label: 'DuplicateState', sub: 'concrete class', icon: 'Copy', tint: 'green' };

export const lldStackOverflow: Lesson = {
  id: 'lld-stack-overflow',
  title: 'Stack Overflow',
  tagline: 'Model the question and answer loop, then add Strategy for reputation, Observer for notifications and State for the question lifecycle.',
  minutes: 22,
  level: 'Intermediate',
  learn: [
    'Which entities a Q&A site needs, and why Question and Answer both extend a Post',
    'A Strategy for reputation so the point rules can change without touching voting',
    'An Observer event bus so emails and badges stay out of the answer code',
    'A State pattern that makes illegal question transitions impossible',
    'Voting guards, accepting an answer, a tag index and a lock for concurrent votes',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'patterns', label: 'Patterns', icon: 'Layers' },
    { key: 'rep', label: 'Reputation rules', icon: 'Scale' },
    { key: 'listeners', label: 'Listeners', icon: 'Mail' },
  ],
  steps: [
    {
      title: 'The board',
      tag: 'problem',
      heading: 'Design Stack Overflow: many entities, many relations',
      eli5: 'Picture a classroom **question board**. A kid pins a question, classmates pin answers, and everyone hands out gold stars. We must decide what each piece of paper is and who owns it.',
      body: [
        'A Q&A site has users who ask questions, answer them, comment, vote and earn reputation. It has many entities and many relationships, which makes it a favorite object design problem.',
        'We will not model the whole product. We build the core Q&A loop and let each pain pick a pattern.',
      ],
      keyIdea: 'Many entities and relations: start with the core loop and let pain pick the patterns.',
      metrics: { classes: '0', patterns: '0', rep: '-', listeners: '0' },
      scene: {
        nodes: [
          { ...question, status: 'active', chips: ['title', 'body', 'tags'] },
          { ...answer, chips: ['body', 'accepted'] },
          { ...user, at: at(0, -3.4), chips: ['username', 'reputation'] },
          { ...web },
        ],
        links: [link('web', 'question', 'uses'), link('answer', 'question', 'belongs to'), link('question', 'user', 'asked by')],
        flows: [{ path: ['web', 'question'], tone: 'request', label: 'ask()', duration: 1.8 }],
        panel: {
          title: 'The loop to model',
          icon: 'List',
          rows: [
            { text: 'Ask', value: 'a question with tags' },
            { text: 'Answer', value: 'many per question' },
            { text: 'Vote', value: 'up or down, moves reputation' },
            { text: 'Accept', value: 'the asker picks one answer' },
            { text: 'Notify', value: 'asker hears about answers', tone: 'warn' },
          ],
        },
        caption: 'One web app asks the model for a new question',
      },
    },
    {
      title: 'Scope',
      tag: 'concept',
      heading: 'Pick the slice: the core Q&A loop',
      eli5: 'We do not build the whole school. We build the board, the notes and the stars. Bake sales and field trips can wait.',
      body: [
        'In scope: ask, answer, comment, vote, accept, tags, reputation, badges, closing a question. These are the nouns the interviewer expects.',
        'Out of scope: search ranking, bounties, chat, moderation queues and payments. Naming what you skip is part of a good answer.',
      ],
      keyIdea: 'State what is in and out of scope before drawing classes.',
      metrics: { classes: '0', patterns: '0', rep: '-', listeners: '0' },
      scene: {
        nodes: [
          { ...question, status: 'active' },
          { ...answer, at: at(0, -3.4), status: 'active' },
          { ...vote, at: at(3.8, 0), status: 'active' },
          { ...user, at: at(0, 3.4), status: 'active' },
        ],
        links: [link('answer', 'question', 'answers'), link('vote', 'answer', 'scores'), link('answer', 'user', 'earns for')],
        flows: [{ path: ['question', 'answer', 'vote'], tone: 'request', label: 'the loop', duration: 2.2 }],
        panel: {
          title: 'In and out',
          icon: 'Table',
          rows: [
            { text: 'In', value: 'ask, answer, comment, vote', tone: 'good' },
            { text: 'In', value: 'accept, tags, badges, close', tone: 'good' },
            { text: 'Out', value: 'search ranking, bounties', tone: 'muted' },
            { text: 'Out', value: 'chat, moderation queues', tone: 'muted' },
          ],
        },
        caption: 'Only the core loop is on the board',
      },
    },
    {
      title: 'Core entities',
      tag: 'concept',
      heading: 'Entities: User, Question, Answer, Comment',
      eli5: 'Every piece of paper on the board gets a card shape. A **user** card has a name and a star jar. A question card, an answer card and a comment card each have their own fields.',
      body: [
        'A **User** holds a username, a reputation that starts at 1 and a list of badges. A **Question** has a title, a body, tags and a list of answers.',
        'An **Answer** knows its question. A **Comment** is a short note with an author and a body. A **Badge** is a small value object, just a name and an award date.',
      ],
      keyIdea: 'Each noun in the requirements becomes a class that owns its own data.',
      metrics: { classes: '5', patterns: '0', rep: '-', listeners: '0' },
      scene: {
        nodes: [
          { ...question, at: at(-3.8, 0) },
          { ...answer, at: at(3.8, 0) },
          { ...user, at: at(0, -3.4), chips: ['reputation = 1', 'badges'] },
          { ...comment },
        ],
        links: [link('question', 'answer', 'has-a many'), link('question', 'user', 'author'), link('answer', 'comment', 'has-a many')],
        flows: [{ path: ['user', 'question', 'answer'], tone: 'data', label: 'author link', duration: 2 }],
        panel: {
          title: 'Fields at a glance',
          icon: 'Table',
          rows: [
            { text: 'User', value: 'username, reputation, badges' },
            { text: 'Question', value: 'title, body, tags, answers' },
            { text: 'Answer', value: 'body, question, accepted' },
            { text: 'Comment', value: 'author, body' },
            { text: 'Badge', value: 'name, awarded_at' },
          ],
        },
        caption: 'Four cards, linked by has-a',
      },
      code: {
        language: 'python',
        title: 'User, Comment and Badge',
        source: `class User:
    def __init__(self, username):
        self.username = username
        self.reputation = 1
        self.badges = []          # list of Badge

class Comment:
    def __init__(self, author, body):
        self.author = author
        self.body = body

class Badge:
    def __init__(self, name):
        self.name = name
        self.awarded_at = datetime.utcnow()`,
        highlight: [4],
      },
    },
    {
      title: 'Post base',
      tag: 'concept',
      heading: 'Question and Answer share a Post parent',
      eli5: 'Questions and answers are both notes on the board. Both can get stars and both can get little comment stickers. So we draw one **post** note shape and let both copy it.',
      body: [
        'Both questions and answers have an author, a body, votes and comments. Put that shared data in an abstract **Post** and let Question and Answer extend it.',
        'Voting code then works on any Post. It never asks which kind it got, except when reputation depends on the kind.',
      ],
      keyIdea: 'Shared fields go in a base class, so voting and commenting are written once.',
      metrics: { classes: '6', patterns: '0', rep: '-', listeners: '0' },
      scene: {
        nodes: [
          { ...post, chips: ['author', 'body', 'votes', 'comments'] },
          { ...question, status: 'active' },
          { ...answer, status: 'active' },
        ],
        links: [link('question', 'post', 'extends'), link('answer', 'post', 'extends')],
        flows: [{ path: ['question', 'post'], tone: 'data', label: 'inherits', duration: 1.8 }],
        panel: {
          title: 'Who adds what',
          icon: 'Table',
          rows: [
            { text: 'Post', value: 'author, body, votes, comments' },
            { text: 'Question adds', value: 'title, tags, answers, status' },
            { text: 'Answer adds', value: 'question, accepted' },
          ],
        },
        caption: 'One parent, two children',
      },
      code: {
        language: 'python',
        title: 'Post, Question, Answer',
        source: `class Post:
    def __init__(self, author, body):
        self.author, self.body = author, body
        self.votes, self.comments = [], []

    def add_comment(self, author, body):
        self.comments.append(Comment(author, body))

class Question(Post):
    def __init__(self, author, title, body, tags):
        super().__init__(author, body)
        self.title, self.tags = title, tags
        self.answers = []

    def add_answer(self, author, body):
        a = Answer(author, body, self); self.answers.append(a); return a

class Answer(Post):
    def __init__(self, author, body, question):
        super().__init__(author, body)
        self.question, self.accepted = question, False`,
        highlight: [1, 9, 18],
      },
    },
    {
      title: 'Votes and score',
      tag: 'concept',
      heading: 'A Vote is a small object, the score is derived',
      eli5: 'Each gold star or thumbs-down is its own little sticker with the name of the kid who gave it. The note adds its stickers up to show how well liked it is.',
      body: [
        'A **Vote** stores who voted, a value of +1 or -1 and a timestamp. A Post keeps its list of Vote objects.',
        'The score is never stored. `score()` sums the list, so it cannot drift out of sync with the votes. You also keep who voted, which the rules later need.',
      ],
      keyIdea: 'Store the facts (votes) and derive the number (score).',
      metrics: { classes: '7', patterns: '0', rep: '-', listeners: '0' },
      scene: {
        nodes: [
          { ...post, chips: ['votes', 'score()'] },
          { ...vote, at: at(-3.8, 0), chips: ['user', 'value', 'at'] },
          { ...user, at: at(3.8, 0) },
        ],
        links: [link('post', 'vote', 'has-a many'), link('vote', 'user', 'cast by')],
        flows: [{ path: ['user', 'vote', 'post'], tone: 'request', label: 'vote(+1)', duration: 2 }],
        panel: {
          title: 'Derived score',
          icon: 'Code',
          code: 'votes = [+1, +1, -1, +1]\nscore() = sum(v.value)\n       = 2',
          footer: { text: 'Nothing to keep in sync', tone: 'good' },
        },
        caption: 'Votes are the data, score is the sum',
      },
      code: {
        language: 'python',
        title: 'Vote and Post.score',
        source: `class Vote:
    def __init__(self, user, value):    # +1 or -1
        self.user = user
        self.value = value
        self.at = datetime.utcnow()

class Post:
    def score(self):
        return sum(v.value for v in self.votes)`,
        highlight: [9],
      },
    },
    {
      title: 'Tags and status',
      tag: 'concept',
      heading: 'Tags, a status enum and the accepted answer',
      eli5: 'Each question note gets colored stickers saying what it is about (tags). It also carries a small label showing if it is open for answers, closed, a copy, or taken down.',
      body: [
        'A **Tag** is just a name. A question holds a list of them. `QuestionStatus` is an enum: OPEN, CLOSED, DUPLICATE, DELETED.',
        'The question also keeps `accepted_answer`, which is None until the asker picks one. This is the first version of the lifecycle, and it will cause trouble later.',
      ],
      keyIdea: 'An enum is the quick way to model status. Remember it, we will outgrow it.',
      metrics: { classes: '9', patterns: '0', rep: '-', listeners: '0' },
      scene: {
        nodes: [
          { ...question, at: at(0, -3.4), chips: ['tags', 'status', 'accepted_answer'] },
          { ...tag, at: at(-3.8, 0) },
          { id: 'statusEnum', kind: 'block', at: at(3.8, 0), label: 'QuestionStatus', sub: 'enum', icon: 'List', tint: 'amber' },
        ],
        links: [link('question', 'tag', 'has-a many'), link('question', 'statusEnum', 'uses')],
        flows: [{ path: ['question', 'statusEnum'], tone: 'data', label: 'status = OPEN', duration: 1.8 }],
        panel: {
          title: 'QuestionStatus values',
          icon: 'List',
          rows: [
            { text: 'OPEN', value: 'takes answers and votes', tone: 'good' },
            { text: 'CLOSED', value: 'read only' },
            { text: 'DUPLICATE', value: 'sets duplicate_of, added with State' },
            { text: 'DELETED', value: 'hidden', tone: 'bad' },
          ],
        },
        caption: 'Four flags on one field',
      },
      code: {
        language: 'python',
        title: 'Tag and QuestionStatus',
        source: `class QuestionStatus(Enum):
    OPEN = "open"
    CLOSED = "closed"
    DUPLICATE = "duplicate"
    DELETED = "deleted"

class Tag:
    def __init__(self, name):
        self.name = name

# in Question.__init__:
#   self.status = QuestionStatus.OPEN
#   self.accepted_answer = None
# duplicate_of is added later, with the State pattern`,
        highlight: [1, 7],
      },
    },
    {
      title: 'Hardcoded rep',
      tag: 'problem',
      heading: 'Pain: reputation rules baked into voting',
      eli5: 'Right now the kid who counts stars also decides how many points each star is worth. If the teacher wants new point rules, the counting rules must be torn apart.',
      body: [
        'First try: `upvote` appends a Vote and adds 10 points to the author if it is an Answer, 5 if a Question. Downvotes subtract 2. Accepting adds 15.',
        'It works until product wants bigger swings, or an experiment with different numbers. Every change edits voting code, and testing a rule means testing voting too.',
      ],
      keyIdea: 'Point rules change often. They should not live inside the voting logic.',
      metrics: { classes: '10', patterns: '0', rep: 'hardcoded', listeners: '0' },
      metricTones: { rep: 'bad' },
      scene: {
        nodes: [
          { ...voting, status: 'hot', load: 78, chips: ['upvote()', 'downvote()', 'accept()'] },
          { ...post, at: at(-3.8, 0), size: 0.9 },
          { ...user, at: at(3.8, 0), size: 0.9 },
        ],
        links: [link('voting', 'post', 'uses'), link('voting', 'user', 'edits reputation', { labelTone: 'warn' })],
        flows: [{ path: ['voting', 'user'], tone: 'error', label: 'reputation += 10', duration: 1.8 }],
        panel: {
          title: 'v1 voting',
          icon: 'Code',
          code: 'def upvote(self, voter, post):\n    post.votes.append(Vote(voter, +1))\n    if isinstance(post, Answer):\n        post.author.reputation += 10\n    else:\n        post.author.reputation += 5',
          footer: { text: 'Numbers and voting are tangled', tone: 'bad' },
        },
        caption: 'Every rule change edits the voting code',
      },
    },
    {
      title: 'Strategy',
      tag: 'concept',
      heading: 'Strategy: pull the rules behind an interface',
      eli5: 'We write the point rules on a separate rule card. The star counter just reads the card. Swap the card and the same counting gives different points.',
      body: [
        '`ReputationStrategy` is an interface with `on_upvote`, `on_downvote_receiver` and `on_accept`. Each returns a number of points.',
        '`VotingService` keeps one strategy and asks it for points. It never says 10 or 5 itself. That is the **Strategy** pattern: one family of interchangeable rules behind one interface.',
      ],
      keyIdea: 'Strategy puts a changing rule behind an interface so the caller stays untouched.',
      metrics: { classes: '11', patterns: '1', rep: 'pluggable', listeners: '0' },
      metricTones: { patterns: 'good', rep: 'good' },
      scene: {
        nodes: [
          { ...voting, at: at(-3.8, -3.4) },
          { ...repIf, at: at(3.8, -3.4), chips: ['on_upvote', 'on_accept'] },
          { ...defRep, at: at(-3.8, 3.4), size: 0.9 },
          { ...hiRep, at: at(3.8, 3.4), size: 0.9 },
        ],
        links: [link('voting', 'repIf', 'has-a'), link('defRep', 'repIf', 'implements'), link('hiRep', 'repIf', 'implements')],
        flows: [{ path: ['voting', 'repIf'], tone: 'request', label: 'on_upvote(post)', duration: 1.8 }],
        panel: {
          title: 'The interface',
          icon: 'Code',
          code: 'class ReputationStrategy(ABC):\n    @abstractmethod\n    def on_upvote(self, post) -> int: ...\n    @abstractmethod\n    def on_downvote_receiver(self, post) -> int: ...\n    @abstractmethod\n    def on_accept(self, answer) -> int: ...',
          footer: { text: 'Three questions, three integers', tone: 'muted' },
        },
        caption: 'Voting asks, the strategy answers',
      },
    },
    {
      title: 'Two policies',
      tag: 'tradeoff',
      heading: 'DefaultReputation and HighStakesReputation',
      eli5: 'One rule card gives a few points for each star. A second card gives big points for each star but also takes big points for a frown. The counter works with both.',
      body: [
        '`DefaultReputation` gives 10 for an upvoted answer, 5 for a question, -2 for a downvote and 15 for an accepted answer.',
        '`HighStakesReputation` is an experiment: 25, 10, -10 and 50. Bigger swings reward quality and punish noise. It plugs in with one constructor argument and zero edits to voting.',
      ],
      keyIdea: 'A new policy is a new class, not an edit to old ones (open for extension).',
      metrics: { classes: '13', patterns: '1', rep: '2 policies', listeners: '0' },
      metricTones: { patterns: 'good', rep: 'good' },
      scene: {
        nodes: [
          { ...voting, at: at(-3.8, -3.4) },
          { ...repIf, at: at(3.8, -3.4), size: 0.9 },
          { ...defRep, at: at(-3.8, 3.4), status: 'active', badge: '+10 / +15' },
          { ...hiRep, at: at(3.8, 3.4), status: 'active', badge: '+25 / +50' },
        ],
        links: [link('voting', 'repIf', 'has-a'), link('defRep', 'repIf', 'implements'), link('hiRep', 'repIf', 'implements')],
        flows: [
          { path: ['voting', 'defRep'], tone: 'request', label: 'on_upvote', duration: 1.6 },
          { path: ['voting', 'hiRep'], tone: 'request', label: 'on_upvote', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Points per event',
          icon: 'Table',
          rows: [
            { text: 'Event', value: 'Default / HighStakes' },
            { text: 'Answer upvoted', value: '+10 / +25' },
            { text: 'Question upvoted', value: '+5 / +10' },
            { text: 'Downvote received', value: '-2 / -10', tone: 'warn' },
            { text: 'Answer accepted', value: '+15 / +50', tone: 'good' },
          ],
        },
        caption: 'Same voting code, two sets of numbers',
      },
      quiz: {
        question: 'A product manager wants an A/B test of new reputation numbers. What is the smallest code change in this design?',
        options: [
          'Edit the if statements inside VotingService.upvote',
          'Write a new ReputationStrategy class and pass it to VotingService',
          'Add a reputation field to Vote',
          'Subclass User for each policy',
        ],
        answer: 1,
        explain: 'The numbers live in a strategy. A new class plugs in through the constructor, and VotingService, Post and User stay as they are.',
      },
    },
    {
      title: 'Voting rules',
      tag: 'concept',
      heading: 'VotingService applies the strategy and guards the rules',
      eli5: 'The star counter follows house rules. You cannot give yourself a star, and you get one star per note. Only after the checks does the counter ask the rule card for points.',
      body: [
        'The service checks first: no voting on your own post, and one vote per user per post. Then it appends the Vote and adds the strategy points to the author.',
        'Reputation never drops below 1, as on the real site. A second vote from the same user is rejected with "already voted". Changing a vote is left out of scope. `downvote` mirrors `upvote` and pays `on_downvote_receiver` (-2 by default).',
      ],
      keyIdea: 'Guard the invariants first, then change state, then ask the strategy for numbers.',
      metrics: { classes: '13', patterns: '1', rep: '2 policies', listeners: '0' },
      metricTones: { patterns: 'good', rep: 'good' },
      scene: {
        nodes: [
          { ...voting, at: at(0, -3.4), status: 'active' },
          { ...post, at: at(-3.8, 0), size: 0.9, chips: ['votes'] },
          { ...repIf, at: at(3.8, 0), size: 0.9 },
          { ...user, at: at(0, 3.4), size: 0.9, chips: ['reputation'] },
        ],
        links: [link('voting', 'post', 'checks'), link('voting', 'repIf', 'asks'), link('voting', 'user', 'edits')],
        flows: [
          { path: ['voting', 'post'], tone: 'request', label: 'already voted?', duration: 1.4 },
          { path: ['voting', 'repIf'], tone: 'request', label: 'on_upvote()', duration: 1.4, delay: 1.5 },
          { path: ['voting', 'user'], tone: 'data', label: 'reputation += n', duration: 1.4, delay: 3 },
        ],
        caption: 'Check, change, then pay out',
      },
      code: {
        language: 'python',
        title: 'VotingService',
        source: `class VotingService:
    def __init__(self, rep_strategy):
        self.rep = rep_strategy

    def upvote(self, voter, post):
        self._guard(voter, post)
        post.votes.append(Vote(voter, +1))
        self._pay(post.author, self.rep.on_upvote(post))

    def downvote(self, voter, post):
        self._guard(voter, post)
        post.votes.append(Vote(voter, -1))
        self._pay(post.author, self.rep.on_downvote_receiver(post))

    def _guard(self, voter, post):
        if voter is post.author:
            raise ValueError("cannot vote on your own post")
        if any(v.user is voter for v in post.votes):
            raise ValueError("already voted")

    def _pay(self, user, points):
        user.reputation = max(1, user.reputation + points)`,
        highlight: [6, 10, 14, 19, 22],
      },
    },
    {
      title: 'Accept answer',
      tag: 'concept',
      heading: 'Accepting an answer',
      eli5: 'The kid who asked the question may put one green check on the best answer. Moving the check to a better answer takes the old one off.',
      body: [
        'Only the asker can accept. The question is read from `answer.question`, so an answer can only be accepted on the question it belongs to. Accepting the same answer again returns early, so nobody can farm points.',
        'A question has at most one accepted answer, so accepting a new one clears the old flag. The strategy decides the bonus (`on_accept`, 15 by default) and the same floor of 1 applies. Reputation for the old answer is not taken back in this version. That is a product decision you can state out loud.',
      ],
      keyIdea: 'Accept is a rule on the question: one winner, chosen by its author.',
      metrics: { classes: '13', patterns: '1', rep: '2 policies', listeners: '0' },
      metricTones: { patterns: 'good', rep: 'good' },
      scene: {
        nodes: [
          { ...question, at: at(-3.8, 0), chips: ['accepted_answer'] },
          { ...answer, at: at(3.8, 0), status: 'ok', badge: 'accepted' },
          { ...user, at: at(0, -3.4), label: 'Asker', sub: 'question author' },
          { ...repIf, at: at(0, 3.4), size: 0.9 },
        ],
        links: [link('user', 'question', 'owns'), link('question', 'answer', 'accepts'), link('answer', 'repIf', 'on_accept')],
        flows: [
          { path: ['user', 'question'], tone: 'request', label: 'accept(a)', duration: 1.4 },
          { path: ['question', 'answer'], tone: 'data', label: 'accepted = True', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Guards',
          icon: 'List',
          rows: [
            { text: 'Caller is the asker', tone: 'good' },
            { text: 'answer.question is the owner', tone: 'good' },
            { text: 'Already accepted: return early', tone: 'good' },
            { text: 'Clear the old flag', tone: 'good' },
            { text: 'Pay on_accept() to the answerer' },
          ],
        },
        caption: 'One check mark, owned by the asker',
      },
      code: {
        language: 'python',
        title: 'Accepting',
        source: `def accept(self, asker, answer):
    q = answer.question        # ownership check
    if asker is not q.author:
        raise PermissionError("only the asker can accept")
    if q.accepted_answer is answer:
        return                 # no second payout
    if q.accepted_answer:
        q.accepted_answer.accepted = False
    answer.accepted = True
    q.accepted_answer = answer
    gain = self.rep.on_accept(answer)
    answer.author.reputation = max(1, answer.author.reputation + gain)`,
        highlight: [3, 5, 12],
      },
    },
    {
      title: 'Fat method',
      tag: 'problem',
      heading: 'Pain: posting an answer does everything',
      eli5: 'When a kid pins an answer, the board helper also runs to tell the asker and checks whether anybody earned a sticker. Every new chore makes the helper busier.',
      body: [
        '`post_answer` saves the answer. Product then wants an email to the asker, then a badge check, then a feed update, then an audit log. Each is a new line in the same method.',
        'Now the answer code knows about email, badges and feeds. Testing it needs all of them, and a slow email provider slows the answer.',
      ],
      keyIdea: 'Side effects stacked inside the main method couple everything together.',
      metrics: { classes: '14', patterns: '1', rep: '2 policies', listeners: '0' },
      metricTones: { listeners: 'bad' },
      scene: {
        nodes: [
          { ...qa, status: 'hot', load: 82, chips: ['save answer', 'send email', 'check badges'] },
          { id: 'mail', kind: 'block', at: at(-3.8, 0), label: 'Email provider', sub: 'external system', icon: 'Mail', tint: 'gray' },
          { id: 'badgeSvc', kind: 'block', at: at(3.8, 0), label: 'Badge rules', sub: 'concrete class', icon: 'Star', tint: 'green' },
        ],
        links: [link('qa', 'mail', 'calls', { labelTone: 'warn' }), link('qa', 'badgeSvc', 'calls', { labelTone: 'warn' })],
        flows: [
          { path: ['qa', 'mail'], tone: 'error', label: 'send_email()', duration: 1.6 },
          { path: ['qa', 'badgeSvc'], tone: 'error', label: 'check_badges()', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'post_answer today',
          icon: 'Code',
          code: 'def post_answer(self, q, author, body):\n    a = q.add_answer(author, body)\n    self.mailer.send(q.author.email, ...)\n    self.badges.check(author)\n    self.feed.add(a)\n    self.audit.log(a)',
          footer: { text: 'One method, four extra jobs', tone: 'bad' },
        },
        caption: 'Every new chore lands in the same method',
      },
    },
    {
      title: 'Event bus',
      tag: 'concept',
      heading: 'Observer: publish an event, let others listen',
      eli5: 'Instead of running around, the helper rings a bell and says "an answer was pinned". Anyone who cares has already told the helper to listen for that bell.',
      body: [
        'An **Event** has a kind and a payload. The **EventBus** keeps a list of handlers per kind. `subscribe` adds one and `publish` calls each in turn.',
        'The service now does its own job and then publishes `answer_posted`. It does not know who listens. This is the **Observer** pattern.',
      ],
      keyIdea: 'Observer lets the code that causes an event stay ignorant of who reacts to it.',
      metrics: { classes: '16', patterns: '2', rep: '2 policies', listeners: '0' },
      metricTones: { patterns: 'good' },
      scene: {
        nodes: [
          { ...qa, at: at(-3.8, -3.4), status: 'active' },
          { ...bus, at: at(3.8, -3.4), chips: ['subscribe()', 'publish()'] },
          { id: 'event', kind: 'block', at: at(3.8, 3.4), label: 'Event', sub: 'kind + payload', icon: 'Inbox', tint: 'green' },
        ],
        links: [link('qa', 'bus', 'uses'), link('bus', 'event', 'delivers')],
        flows: [
          { path: ['qa', 'bus'], tone: 'event', label: 'publish(answer_posted)', duration: 2 },
          { path: ['bus', 'event'], tone: 'event', label: 'handlers', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'EventBus',
          icon: 'Code',
          code: 'class EventBus:\n    def __init__(self):\n        self.listeners = defaultdict(list)\n    def subscribe(self, kind, handler):\n        self.listeners[kind].append(handler)\n    def publish(self, event):\n        for h in self.listeners[event.kind]:\n            h(event)',
        },
        caption: 'The service rings a bell and moves on',
      },
    },
    {
      title: 'Listeners',
      tag: 'concept',
      heading: 'EmailNotifier and BadgeAwarder listen',
      eli5: 'One listener is the mail kid: when the answer bell rings, they write a note to the asker. Another is the sticker kid, who hands out a sticker once a note has 100 stars.',
      body: [
        '`EmailNotifier` handles `answer_posted` and emails the question author. `BadgeAwarder` handles `question_upvoted` and gives the GreatQuestion badge at a score of 100, once.',
        'Adding a feed or audit log is a new class and one `subscribe` line. `QAService` and `VotingService` do not change.',
      ],
      keyIdea: 'New reactions are new observers, wired in one place.',
      metrics: { classes: '18', patterns: '2', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good', listeners: 'good' },
      scene: {
        nodes: [
          { ...bus, at: at(0, -3.4), status: 'active' },
          { ...emailer, at: at(-3.8, 0), chips: ['answer_posted'] },
          { ...badger, at: at(3.8, 0), chips: ['question_upvoted'] },
          { id: 'smtp', kind: 'block', at: at(-7.6, 3.4), label: 'Mail server', sub: 'external system', icon: 'Server', tint: 'gray' },
        ],
        links: [link('bus', 'emailer', 'notifies'), link('bus', 'badger', 'notifies'), link('emailer', 'smtp', 'uses')],
        flows: [
          { path: ['bus', 'emailer', 'smtp'], tone: 'event', label: 'send()', duration: 2.2 },
          { path: ['bus', 'badger'], tone: 'event', label: 'score >= 100?', duration: 1.6, delay: 0.6 },
        ],
        caption: 'Two listeners, one bell',
      },
      code: {
        language: 'python',
        title: 'Observers',
        source: `class EmailNotifier:
    def __call__(self, event):
        q = event.payload["question"]
        self.send(q.author.email, f"New answer on '{q.title}'")

class BadgeAwarder:
    def __call__(self, event):
        q = event.payload["question"]
        if q.score() >= 100 and not self._has(q.author, "GreatQuestion"):
            q.author.badges.append(Badge("GreatQuestion"))

bus.subscribe("answer_posted", EmailNotifier())
bus.subscribe("question_upvoted", BadgeAwarder())`,
        highlight: [9, 12, 13],
      },
    },
    {
      title: 'Observer limits',
      tag: 'tradeoff',
      heading: 'What a synchronous bus costs you',
      eli5: 'If the mail kid is very slow, the bell-ringer waits. If the mail kid trips, the sticker kid never hears the bell. A mailbox for slow chores fixes both.',
      body: [
        'This bus calls handlers in order on the same thread. One slow handler delays the request, and one exception stops every handler after it.',
        'Wrap each call in try/except and log failures. For slow work such as email, publish to a queue and let a worker consume it. Handlers should also be idempotent, because retries happen.',
      ],
      keyIdea: 'Observers decouple code, not timing. Isolate failures and queue slow work.',
      metrics: { classes: '18', patterns: '2', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good', listeners: 'warn' },
      scene: {
        nodes: [
          { ...bus, at: at(0, -3.4), status: 'hot', load: 70 },
          { ...emailer, at: at(-3.8, 0), status: 'down', badge: 'raises' },
          { ...badger, at: at(3.8, 0), status: 'dim', badge: 'never runs' },
          { id: 'queue', kind: 'queue', at: at(0, 3.4), label: 'Job queue', sub: 'for slow work' },
        ],
        links: [link('bus', 'emailer', 'calls', { labelTone: 'bad' }), link('bus', 'badger', 'calls'), link('emailer', 'queue', 'move to')],
        flows: [
          { path: ['bus', 'emailer'], tone: 'error', label: 'exception', duration: 1.6 },
          { path: ['emailer', 'queue'], tone: 'event', label: 'enqueue', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Hardening',
          icon: 'Shield',
          rows: [
            { text: 'try/except per handler', value: 'isolate', tone: 'good' },
            { text: 'Slow handlers', value: 'queue + worker', tone: 'good' },
            { text: 'Handlers', value: 'idempotent', tone: 'good' },
            { text: 'Unbounded fan-out', value: 'slows requests', tone: 'warn' },
          ],
        },
        caption: 'One failing handler can starve the rest',
      },
      quiz: {
        question: 'Which problem does the Observer pattern fix in post_answer?',
        options: [
          'Answers load too slowly from the database',
          'The method knows about email, badges and feeds directly',
          'Two users can vote at the same moment',
          'A question can be closed twice',
        ],
        answer: 1,
        explain: 'Observer removes the direct knowledge of who reacts. It does not fix timing, concurrency or lifecycle rules, which need a queue, a lock and State.',
      },
    },
    {
      title: 'Status flags',
      tag: 'problem',
      heading: 'Pain: the status enum leaks into every method',
      eli5: 'Each question note has a small label. Every helper has to look at that label before doing anything, and each one remembers the rules a little differently.',
      body: [
        'Closing a question, answering it, voting on it and reopening it all start with `if q.status == ...`. The same checks are copied into several classes.',
        'Miss one and a closed question accepts an answer, or a duplicate is closed again. The enum records the state but enforces nothing.',
      ],
      keyIdea: 'An enum names the state. It does not own the rules for moving between states.',
      metrics: { classes: '18', patterns: '2', rep: '2 policies', listeners: '2' },
      metricTones: { classes: 'warn' },
      scene: {
        nodes: [
          { ...question, at: at(0, -3.4), status: 'hot', chips: ['status == OPEN?'] },
          { ...qa, at: at(-3.8, 0), id: 'qa2', chips: ['if status...'], status: 'hot', size: 0.9 },
          { ...voting, at: at(3.8, 0), chips: ['if status...'], status: 'hot', size: 0.9 },
        ],
        links: [link('qa2', 'question', 'reads status'), link('voting', 'question', 'reads status')],
        flows: [{ path: ['qa2', 'question'], tone: 'error', label: 'closed? duplicate?', duration: 1.8 }],
        panel: {
          title: 'Copied checks',
          icon: 'Code',
          code: 'def close(self, q, reason):\n    if q.status == QuestionStatus.CLOSED:\n        raise RuntimeError("already closed")\n    if q.status == QuestionStatus.DUPLICATE:\n        raise RuntimeError("locked")\n    ...',
          footer: { text: 'Repeated in answer, vote, reopen', tone: 'bad' },
        },
        caption: 'Every caller re-implements the lifecycle',
      },
    },
    {
      title: 'State',
      tag: 'concept',
      heading: 'State: each status becomes an object',
      eli5: 'Each label gets its own rule sheet that says what you may do while the note has it. The note just holds up the current sheet and does what the sheet says.',
      body: [
        '`QuestionState` is an interface with `close`, `reopen` and `mark_duplicate`. The Question holds one state object and forwards calls to it.',
        'Each concrete state knows which calls are legal and which state comes next. This is the **State** pattern: behavior changes with the current object, with no if-chains.',
      ],
      keyIdea: 'State moves the rules of each status into its own class.',
      metrics: { classes: '19', patterns: '3', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good' },
      scene: {
        nodes: [
          { ...question, at: at(-3.8, -3.4), chips: ['state'] },
          { ...stateIf, at: at(3.8, -3.4), chips: ['close()', 'reopen()', 'mark_duplicate()'] },
          { ...openS, at: at(-3.8, 3.4), size: 0.9 },
          { ...closedS, at: at(3.8, 3.4), size: 0.9 },
        ],
        links: [link('question', 'stateIf', 'has-a'), link('openS', 'stateIf', 'implements'), link('closedS', 'stateIf', 'implements')],
        flows: [{ path: ['question', 'stateIf'], tone: 'request', label: 'close(reason)', duration: 1.8 }],
        panel: {
          title: 'The interface',
          icon: 'Code',
          code: 'class QuestionState(ABC):\n    @abstractmethod\n    def close(self, question, reason): ...\n    @abstractmethod\n    def reopen(self, question): ...\n    @abstractmethod\n    def mark_duplicate(self, question, of): ...',
        },
        caption: 'The question forwards to its current state',
      },
    },
    {
      title: 'Three states',
      tag: 'concept',
      heading: 'Open, Closed and Duplicate, with their legal moves',
      eli5: 'The Open sheet says you may close the note or mark it as a copy. The Closed sheet says you may reopen it or mark it as a copy. The Duplicate sheet can be reopened or pointed at a different original.',
      body: [
        'From Open: close gives Closed, mark_duplicate gives Duplicate, reopen is an error. From Closed: reopen gives Open, mark_duplicate gives Duplicate, close is an error.',
        'From Duplicate: reopen gives Open and clears `duplicate_of`. Closing a duplicate raises, and marking again just updates the original it points to.',
      ],
      keyIdea: 'A transition table, written as three small classes, is the whole lifecycle.',
      metrics: { classes: '22', patterns: '3', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good' },
      scene: {
        nodes: [
          { ...stateIf, at: at(0, -3.4), size: 0.9 },
          { ...openS, at: at(-5.4, 0), status: 'active' },
          { ...closedS, at: at(0, 3.4) },
          { ...dupS, at: at(5.4, 0) },
        ],
        links: [link('openS', 'stateIf', 'implements'), link('dupS', 'stateIf', 'implements'), link('openS', 'closedS', 'close()'), link('closedS', 'dupS', 'mark_duplicate()')],
        flows: [
          { path: ['openS', 'closedS'], tone: 'request', label: 'close()', duration: 1.6 },
          { path: ['closedS', 'openS'], tone: 'response', label: 'reopen()', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Transitions',
          icon: 'Table',
          rows: [
            { text: 'Open', value: 'close, mark_duplicate', tone: 'good' },
            { text: 'Closed', value: 'reopen, mark_duplicate' },
            { text: 'Duplicate', value: 'reopen, re-point' },
            { text: 'Everything else', value: 'raises', tone: 'bad' },
          ],
        },
        caption: 'Legal moves only',
      },
    },
    {
      title: 'Illegal moves',
      tag: 'concept',
      heading: 'Illegal transitions cannot happen',
      eli5: 'If you try to close a note that is already closed, the Closed sheet simply says "no". Nobody needs to remember the rule, because the sheet holds it.',
      body: [
        'Closing a closed question raises in `ClosedState.close`. Reopening an open one raises in `OpenState.reopen`. The rule sits next to the state it belongs to.',
        'Adding DELETED later means one new class. Existing states change only where they gain a legal move into it.',
      ],
      keyIdea: 'The caller never checks the status. The state either allows the call or refuses it.',
      metrics: { classes: '22', patterns: '3', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good' },
      scene: {
        nodes: [
          { ...question, at: at(0, -3.4), chips: ['close() twice'] },
          { ...closedS, at: at(-3.8, 0), status: 'down', badge: 'raises' },
          { ...openS, at: at(3.8, 0), status: 'ok' },
        ],
        links: [link('question', 'closedS', 'state', { labelTone: 'bad' }), link('closedS', 'openS', 'reopen')],
        flows: [
          { path: ['question', 'closedS'], tone: 'error', label: 'close() again', duration: 1.6 },
          { path: ['closedS', 'openS'], tone: 'response', label: 'reopen()', duration: 1.6, delay: 1.7 },
        ],
        caption: 'The closed state refuses a second close',
      },
      code: {
        language: 'python',
        title: 'Concrete states',
        source: `class OpenState(QuestionState):
    def close(self, q, reason):
        q.state = ClosedState(); q.close_reason = reason
    def reopen(self, q):
        raise RuntimeError("already open")
    def mark_duplicate(self, q, of):
        q.state = DuplicateState(); q.duplicate_of = of

class ClosedState(QuestionState):
    def close(self, q, reason): raise RuntimeError("already closed")
    def reopen(self, q): q.state = OpenState()
    def mark_duplicate(self, q, of): q.state = DuplicateState(); q.duplicate_of = of`,
        highlight: [5, 10],
      },
    },
    {
      title: 'Gate actions',
      tag: 'concept',
      heading: 'The state also decides who may answer and vote',
      eli5: 'The same rule sheet says if new answers and stars are welcome. A closed or taken-down note refuses them, so no helper has to look at the label.',
      body: [
        'Add `accepts_answers`, `accepts_votes` and `delete` to the interface. Open returns True for the first two. Closed, Duplicate and a new Deleted state return False.',
        '`post_answer` and `upvote` ask `q.state` once. The DELETED enum value from earlier becomes a `DeletedState` whose methods all refuse. Moderators call `delete()`, and Open, Closed and Duplicate each move to DeletedState on it, which finishes the lifecycle.',
      ],
      keyIdea: 'Put every question about "what is allowed now" on the state object.',
      metrics: { classes: '23', patterns: '3', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good' },
      scene: {
        nodes: [
          { ...qa, at: at(-3.8, 0), size: 0.9 },
          { ...question, at: at(0, -3.4), chips: ['state'] },
          { ...stateIf, at: at(3.8, 0), size: 0.9, chips: ['accepts_answers'] },
          { id: 'delS', kind: 'block', at: at(0, 3.4), label: 'DeletedState', sub: 'concrete class', icon: 'Shield', tint: 'red', status: 'down' },
        ],
        links: [link('qa', 'question', 'asks'), link('question', 'stateIf', 'has-a'), link('delS', 'stateIf', 'implements')],
        flows: [
          { path: ['qa', 'question', 'stateIf'], tone: 'request', label: 'accepts_answers()', duration: 2.2 },
          { path: ['stateIf', 'qa'], tone: 'error', label: 'False', duration: 1.6, delay: 2.3 },
        ],
        panel: {
          title: 'What each state allows',
          icon: 'Table',
          rows: [
            { text: 'Open', value: 'answers, votes, close', tone: 'good' },
            { text: 'Closed', value: 'reopen, mark_duplicate' },
            { text: 'Duplicate', value: 'reopen, re-point' },
            { text: 'Deleted', value: 'nothing', tone: 'bad' },
            { text: 'delete()', value: 'Open, Closed, Duplicate to Deleted', tone: 'warn' },
          ],
        },
        caption: 'One question to the state, no scattered ifs',
      },
    },
    {
      title: 'Whole flow',
      tag: 'case',
      heading: 'One upvote, all three patterns',
      eli5: 'A kid gives a gold star. The counter checks the rules, the rule card says how many points, the bell rings, and the sticker kid sees a note just passed 100 stars.',
      body: [
        'Upvote on a question: the question state says votes are allowed, VotingService adds the Vote, the strategy returns points, and the service publishes `question_upvoted` on the bus it now receives in its constructor.',
        'BadgeAwarder hears it and checks the score. Three patterns cooperate, each with one job, and none knows the others exist.',
      ],
      keyIdea: 'Strategy answers how many points, State answers is it allowed, Observer answers who reacts.',
      metrics: { classes: '23', patterns: '3', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good', listeners: 'good' },
      scene: {
        nodes: [
          { ...voting, at: at(-3.8, 0), status: 'active' },
          { ...repIf, at: at(0, -3.4), size: 0.9 },
          { ...bus, at: at(3.8, 0), size: 0.9 },
          { ...badger, at: at(0, 3.4), size: 0.9 },
        ],
        links: [link('voting', 'repIf', 'uses'), link('voting', 'bus', 'publishes to'), link('bus', 'badger', 'notifies')],
        flows: [
          { path: ['voting', 'repIf'], tone: 'request', label: 'on_upvote()', duration: 1.4 },
          { path: ['voting', 'bus'], tone: 'event', label: 'question_upvoted', duration: 1.4, delay: 1.5 },
          { path: ['bus', 'badger'], tone: 'event', label: 'handle()', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'The sequence',
          icon: 'List',
          rows: [
            { text: '1. state.accepts_votes()', value: 'State' },
            { text: '2. guards pass, Vote added' },
            { text: '3. rep.on_upvote(post)', value: 'Strategy' },
            { text: '4. bus.publish(event)', value: 'Observer' },
            { text: '5. BadgeAwarder checks score', value: 'Observer' },
          ],
        },
        caption: 'A single call touches all three',
      },
      code: {
        language: 'python',
        title: 'VotingService with state and bus',
        source: `class VotingService:
    def __init__(self, rep_strategy, bus):
        self.rep, self.bus = rep_strategy, bus

    def upvote(self, voter, post):
        q = post if isinstance(post, Question) else post.question
        if not q.state.accepts_votes():
            raise RuntimeError("voting is closed")
        self._guard(voter, post)
        post.votes.append(Vote(voter, +1))
        self._pay(post.author, self.rep.on_upvote(post))
        if post is q:
            self.bus.publish(Event("question_upvoted", {"question": q}))`,
        highlight: [2, 7, 11, 13],
      },
    },
    {
      title: 'Tag search',
      tag: 'concept',
      heading: 'Finding questions by tag',
      eli5: 'Each colored sticker gets its own folder. To find all the "python" notes, open the python folder instead of reading every note on the board.',
      body: [
        'Scanning every question for a tag is O(n). Keep a dict from tag name to a set of questions, and update it when a question is posted.',
        'A lookup becomes O(1) plus the result size. Keep the index in its own class so the Question stays unaware of how search works.',
      ],
      keyIdea: 'A secondary index turns a scan into a lookup. Keep it out of the entity.',
      metrics: { classes: '24', patterns: '3', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good' },
      scene: {
        nodes: [
          { id: 'index', kind: 'block', at: at(-3.8, 0), label: 'TagIndex', sub: 'concrete class', icon: 'Search', tint: 'green', status: 'active' },
          { ...tag, at: at(3.8, 0) },
          { ...question, at: at(0, 3.4), size: 0.9 },
        ],
        links: [link('index', 'tag', 'keys by'), link('index', 'question', 'has-a many')],
        flows: [
          { path: ['tag', 'index'], tone: 'request', label: 'find("python")', duration: 1.6 },
          { path: ['index', 'question'], tone: 'response', label: 'questions', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'TagIndex',
          icon: 'Code',
          code: 'class TagIndex:\n    def __init__(self):\n        self.by_tag = defaultdict(set)\n    def add(self, q):\n        for t in q.tags:\n            self.by_tag[t.name].add(q)\n    def find(self, name):\n        return self.by_tag.get(name, set())',
        },
        caption: 'A folder per tag',
      },
    },
    {
      title: 'Concurrent votes',
      tag: 'tradeoff',
      heading: 'Two voters at once need a lock',
      eli5: 'Two kids reach to add a star at the same moment and both read "5 stars". Both write "6". One star is lost. A little key on the note lets only one kid in at a time.',
      body: [
        'Check-then-append is two steps. Two threads can both pass the already-voted check, or both write the same reputation total, and one update is lost.',
        'Use one lock per post (not one global lock, which would serialize the whole site). Hold it around the check, the append and the reputation change.',
      ],
      keyIdea: 'A check followed by a write is a race. Lock the smallest shared thing.',
      metrics: { classes: '24', patterns: '3', rep: '2 policies', listeners: '2' },
      metricTones: { patterns: 'good' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: at(-5.4, 0), label: 'Thread 1', sub: 'upvote', status: 'hot', load: 72 },
          { id: 't2', kind: 'worker', at: at(5.4, 0), label: 'Thread 2', sub: 'upvote', status: 'hot', load: 70 },
          { ...post, at: at(0, -1.7), size: 0.9, chips: ['votes', 'score'], status: 'hot' },
          { id: 'lock', kind: 'vault', at: at(0, 3.4), label: 'post.lock', sub: 'one per post' },
        ],
        links: [link('t1', 'post', 'writes'), link('t2', 'post', 'writes'), link('post', 'lock', 'guarded by')],
        flows: [
          { path: ['t1', 'post'], tone: 'request', label: 'upvote()', duration: 1.6 },
          { path: ['t2', 'post'], tone: 'request', label: 'upvote()', duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Lock per post',
          icon: 'Code',
          code: 'def upvote(self, voter, post):\n    with post.lock:\n        if any(v.user is voter for v in post.votes):\n            raise ValueError("already voted")\n        post.votes.append(Vote(voter, +1))\n    # reputation: lock the author too,\n    # or use an atomic add',
          footer: { text: 'Per-post locks keep unrelated votes parallel', tone: 'good' },
        },
        caption: 'Two threads, one post, one key',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Entities first, then one pattern per pain',
      eli5: 'We built a board with note shapes, a swappable rule card for stars, a bell for chores, and a rule sheet for each label, plus a folder per sticker and a key for busy notes.',
      body: [
        'Entities: User, Post, Question, Answer, Comment, Vote, Tag, Badge. Strategy for reputation, Observer for emails and badges, State for the question lifecycle.',
        'Extras: voting guards, accept rule, tag index, a lock per post. Each pattern appeared only after its pain did.',
      ],
      keyIdea: 'Lifecycle state machines stop illegal transitions in one place, at runtime, by refusing the call. Each pattern earns its place by a pain.',
      metrics: { classes: '24', patterns: '3', rep: 'swappable', listeners: '2' },
      metricTones: { patterns: 'good', rep: 'good', listeners: 'good' },
      scene: {
        nodes: [
          { ...question, at: at(0, -3.4), status: 'ok' },
          { ...repIf, at: at(-3.8, 0), size: 0.8, status: 'ok' },
          { ...bus, at: at(3.8, 0), size: 0.8, status: 'ok' },
          { ...stateIf, at: at(0, 3.4), size: 0.8, status: 'ok' },
        ],
        links: [link('question', 'repIf', 'scored by'), link('question', 'bus', 'publishes'), link('question', 'stateIf', 'has-a')],
        flows: [{ path: ['question', 'stateIf'], tone: 'request', label: 'close()', duration: 1.6 }],
        panel: {
          title: 'Pain to pattern',
          icon: 'Table',
          rows: [
            { text: 'Reputation rules change', value: 'Strategy' },
            { text: 'Side effects pile up', value: 'Observer' },
            { text: 'Illegal status moves', value: 'State' },
            { text: 'Two votes at once', value: 'Lock per post' },
          ],
        },
        caption: 'Every pattern answered one pain',
      },
      quiz: {
        question: 'A closed question must refuse new answers, and the rule should live in exactly one place. Which design fits?',
        options: [
          'An if on the status enum in every method that touches a question',
          'A state object per status whose accepts_answers method the service asks',
          'An observer that deletes answers posted to closed questions',
          'A strategy that returns a different reputation for closed questions',
        ],
        answer: 1,
        explain: 'State puts what is allowed now on the current state object, so the rule exists once. An observer reacts after the fact and a strategy changes numbers, not permissions.',
      },
    },
  ],
};
