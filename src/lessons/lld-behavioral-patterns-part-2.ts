import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

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

// Slots: top row A B C, bottom row D E F, center M, and a row of five R1..R5
const A = at(-3.8, -3.8);
const B = at(0, -3.8);
const C = at(3.8, -3.8);
const D = at(-3.6, 3.8);
const E = at(0, 3.8);
const F = at(3.6, 3.8);
const M = at(0, 0);
const R1 = at(-7.2, 0);
const R2 = at(-3.6, 0);
const R3 = at(0, 0);
const R4 = at(3.6, 0);
const R5 = at(7.2, 0);

// Colors by role: violet = interface, blue = abstract class, green = concrete class, gray = external system
const client = (extra: Partial<SceneNode> = {}) => blk('client', A, 'Client', 'sends request', 'gray', 'User', extra);
const auth = (extra: Partial<SceneNode> = {}) => blk('auth', B, 'Auth', 'middleware', 'green', 'Key', extra);
const rate = (extra: Partial<SceneNode> = {}) => blk('rate', C, 'RateLimit', 'middleware', 'green', 'Gauge', extra);
const logging = (extra: Partial<SceneNode> = {}) => blk('logging', F, 'Logging', 'middleware', 'green', 'FileText', extra);
const handler = (extra: Partial<SceneNode> = {}) => blk('handler', E, 'business_logic', 'final handler', 'blue', 'Boxes', extra);

const field = (extra: Partial<SceneNode> = {}) => blk('field', A, 'DateField', 'widget', 'green', 'Clock', extra);
const label = (extra: Partial<SceneNode> = {}) => blk('label', C, 'ErrorLabel', 'widget', 'green', 'FileText', extra);
const button = (extra: Partial<SceneNode> = {}) => blk('button', D, 'SubmitButton', 'widget', 'green', 'Zap', extra);
const calendar = (extra: Partial<SceneNode> = {}) => blk('calendar', F, 'CalendarPopup', 'widget', 'green', 'Table', extra);

const editor = (extra: Partial<SceneNode> = {}) => blk('editor', A, 'Editor', 'originator', 'green', 'FileCode', extra);

const evaluator = (extra: Partial<SceneNode> = {}) => blk('evaluator', A, 'Evaluator', 'visitor', 'green', 'Binary', extra);
const nodeI = (extra: Partial<SceneNode> = {}) => blk('node', B, 'Node', 'interface', 'violet', 'Plug', extra);
const num = (extra: Partial<SceneNode> = {}) => blk('num', D, 'Num', 'concrete', 'green', 'Package', extra);
const add = (extra: Partial<SceneNode> = {}) => blk('add', E, 'Add', 'concrete', 'green', 'Package', extra);
const mul = (extra: Partial<SceneNode> = {}) => blk('mul', F, 'Mul', 'concrete', 'green', 'Package', extra);

// The five patterns of this part as a row
const five = (status?: 'ok'): SceneNode[] => [
  blk('p-chain', R1, 'Chain', 'pass it along', 'blue', 'Cable', { status }),
  blk('p-mediator', R2, 'Mediator', 'one switchboard', 'amber', 'Share2', { status }),
  blk('p-memento', R3, 'Memento', 'snapshot, restore', 'teal', 'Copy', { status }),
  blk('p-visitor', R4, 'Visitor', 'new operation', 'violet', 'Binary', { status }),
  blk('p-iterator', R5, 'Iterator', 'one at a time', 'green', 'List', { status }),
];

export const lldBehavioralPatternsPart2: Lesson = {
  id: 'lld-behavioral-patterns-part-2',
  title: 'Behavioral patterns (part 2)',
  tagline: 'Chain of responsibility, mediator, memento, visitor and iterator, then how to choose among all ten and combine them.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Chain of responsibility: middleware, short-circuiting and the ways a chain breaks',
    'Mediator: turning N squared object links into a hub, and the god mediator trap',
    'Memento: undo by snapshot without breaking encapsulation, and what snapshots cost',
    'Visitor: double dispatch, new operations without editing the classes, and its price',
    'Iterator: lazy generators, one-shot traps, async streams, and how to pick and combine patterns',
  ],
  metrics: [
    { key: 'edits', label: 'Files per change', icon: 'FileCode' },
    { key: 'knows', label: 'Classes each knows', icon: 'Network' },
    { key: 'cost', label: 'Cost', icon: 'Gauge' },
    { key: 'pattern', label: 'Pattern', icon: 'Layers' },
  ],
  steps: [
    // 1
    {
      title: 'Giant handler',
      tag: 'problem',
      heading: 'One handler does auth, limits, logging and the real work',
      eli5: 'One kid at the door checks your pass, counts your visits, writes your name in a book and also teaches the lesson. Adding one more check means rewriting everything that kid does.',
      body: [
        'A web handler grew by accretion. It checks the auth header (401), rate limits the user (429), logs the call, checks a CSRF token, decides whether to compress, and only then runs the business logic, 400 lines later.',
        'A new cross-cutting concern means editing this monster. The checks cannot be reordered, reused on another route or tested alone.',
      ],
      keyIdea: 'A request that must pass several independent checks should not be one function that knows all of them.',
      metrics: { edits: '1 big file', knows: '5 concerns', cost: '400 lines', pattern: 'none' },
      metricTones: { edits: 'bad', knows: 'bad', cost: 'bad' },
      scene: {
        nodes: [client(), blk('mono', B, 'handle_request', '5 concerns inline', 'green', 'FileCode', { status: 'hot', badge: '400 lines' }), blk('logic', C, 'Business logic', 'finally runs', 'blue', 'Boxes')],
        links: [link('client', 'mono', { label: 'request' }), link('mono', 'logic', { label: 'after 5 checks', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'mono'], tone: 'request', label: 'POST /pay', duration: 1.3 },
          { path: ['mono', 'logic'], tone: 'request', label: 'req, user', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Inside handle_request',
          icon: 'Code',
          code: 'if not token: return Response(401)\nuser = decode_jwt(token)\nif limiter.exceeded(user.id): return Response(429)\nlog.info(user.id, req.path)\nif post and not valid_csrf(req): return Response(403)\nresp = business_logic(req, user)',
          footer: { text: 'Every new concern edits this function', tone: 'bad' },
        },
        caption: 'Five concerns share one function',
      },
    },
    // 2
    {
      title: 'Chain',
      tag: 'concept',
      heading: 'Chain of responsibility: each handler decides to pass the request on',
      eli5: 'A note goes down a row of kids. Each one does their small job and hands it to the next kid. That row is a **chain**, and the note never needs to know which kid will finish it.',
      body: [
        'Each check becomes a `Middleware` with `handle(req, next_)`. A handler does its work, then calls `next_(req)` to pass the request on. The sender only knows the first link and never which handler responds.',
        '`build_chain` links them with closures, and the last link is the real handler. Reordering or adding a concern is editing a list. This is how Express `app.use()`, Django middleware and Servlet filters work.',
      ],
      keyIdea: 'Chain of responsibility replaces one function that knows every check with a list of small handlers, each calling the next.',
      metrics: { edits: '1 new class', knows: '1 (next_)', cost: '+1 call per link', pattern: 'Chain' },
      metricTones: { edits: 'good', knows: 'good' },
      scene: {
        nodes: [client(), auth({ status: 'active' }), rate(), logging(), handler()],
        links: [
          link('client', 'auth', { label: 'pipeline(req)' }),
          link('auth', 'rate', { label: 'next_(req)' }),
          link('rate', 'logging', { label: 'next_(req)' }),
          link('logging', 'handler', { label: 'next_(req)' }),
        ],
        flows: [
          { path: ['client', 'auth', 'rate', 'logging', 'handler'], tone: 'request', label: 'req', duration: 3.2 },
          { path: ['handler', 'logging', 'rate', 'auth', 'client'], tone: 'response', label: 'Response(200)', duration: 3.2, delay: 3.4 },
        ],
        panel: {
          title: 'Order of the chain',
          icon: 'List',
          rows: [
            { text: '1  AuthMiddleware', value: 'sets req.user' },
            { text: '2  RateLimitMiddleware', value: 'needs req.user' },
            { text: '3  LoggingMiddleware', value: 'logs req.user.id' },
            { text: '4  business_logic', value: 'final handler' },
          ],
          footer: { text: 'The response unwinds back up the chain', tone: 'muted' },
        },
        caption: 'Each link calls the next one',
      },
      code: {
        language: 'python',
        title: 'Middleware chain with closures',
        source: `from abc import ABC, abstractmethod
from typing import Callable

class Middleware(ABC):
    @abstractmethod
    def handle(self, req, next_: Callable): ...

class AuthMiddleware(Middleware):
    def handle(self, req, next_):
        token = req.headers.get("Authorization")
        if not token: return Response(401)
        req.user = decode_jwt(token)
        return next_(req)

class RateLimitMiddleware(Middleware):
    def handle(self, req, next_):
        if rate_limiter.exceeded(req.user.id): return Response(429)
        return next_(req)

class LoggingMiddleware(Middleware):
    def handle(self, req, next_):
        log.info(f"{req.user.id} {req.method} {req.path}")
        return next_(req)

def build_chain(middlewares, final_handler):
    def chain(req, i=0):
        if i == len(middlewares): return final_handler(req)
        return middlewares[i].handle(req, lambda r: chain(r, i + 1))
    return chain

pipeline = build_chain(
    [AuthMiddleware(), RateLimitMiddleware(), LoggingMiddleware()],
    business_logic,
)`,
        highlight: [6, 13, 18, 22, 27, 28],
      },
    },
    // 3
    {
      title: 'Short-circuit',
      tag: 'concept',
      heading: 'A handler can stop the chain by not calling next',
      eli5: 'If your pass is missing, the first kid sends you home right there. The rest of the row never even sees you.',
      body: [
        'A handler may answer by itself. `AuthMiddleware` returns `Response(401)` when there is no token and never calls `next_`. Rate limiting, logging and the business logic never run.',
        'On the happy path the response unwinds back up through each handler in reverse. Each one can still look at or change it on the way out.',
      ],
      keyIdea: 'Not calling next is how a handler short-circuits the chain, and returning the result is how the answer unwinds.',
      metrics: { edits: '1 new class', knows: '1 (next_)', cost: '0 calls skipped work', pattern: 'Chain' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [client({ chips: [{ text: 'no Authorization', tone: 'warn' }] }), auth({ status: 'active', badge: '401' }), rate({ status: 'dim' }), logging({ status: 'dim' }), handler({ status: 'dim' })],
        links: [
          link('client', 'auth', { label: 'pipeline(req)' }),
          link('auth', 'rate', { label: 'next_ never called', style: 'faint' }),
          link('rate', 'logging', { style: 'faint' }),
          link('logging', 'handler', { style: 'faint' }),
        ],
        flows: [
          { path: ['client', 'auth'], tone: 'request', label: 'POST /pay', duration: 1.3 },
          { path: ['auth', 'client'], tone: 'error', label: '401', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Two paths',
          icon: 'Route',
          rows: [
            { text: 'Token missing', value: 'stops at Auth', tone: 'warn' },
            { text: 'Handlers that ran', value: '1 of 4', tone: 'warn' },
            { text: 'Token valid', value: 'all 4 run', tone: 'good' },
            { text: 'Result', value: 'Response(200) unwinds' },
          ],
        },
        caption: 'A handler that answers ends the chain',
      },
      code: {
        language: 'python',
        title: 'Short-circuit versus full path',
        source: `bad_req = Request(method="POST", path="/pay", headers={})
resp = pipeline(bad_req)
# Auth: token is None, returns Response(401) immediately
# next_ is never called, so rate limit and logging never run

good_req = Request(method="POST", path="/pay",
                   headers={"Authorization": "Bearer valid.jwt.token"})
resp = pipeline(good_req)
# Auth sets req.user, RateLimit checks the quota, Logging logs,
# business_logic runs, and Response(200) unwinds back up the chain`,
        highlight: [3, 4],
      },
    },
    // 4
    {
      title: 'Chain pitfalls',
      tag: 'tradeoff',
      heading: 'How a chain breaks: forgotten next, wrong order, silent errors',
      eli5: 'A kid who forgets to pass the note on stops the whole row and nobody knows who dropped it. Put an adult at the very start to catch anything that falls.',
      body: [
        'Common failures: a handler forgets to `return next_(req)` and the chain returns `None`. One calls `next_` twice and the business logic runs twice. Order matters too, because Logging placed before Auth sees no `req.user`.',
        'An exception in the middle needs an outer `ErrorHandlerMiddleware` that wraps `next_` and returns 500. Skip the pattern if exactly one handler is always right, since that is a lookup. Log at each step, because "who ate my request?" is hard to debug.',
      ],
      keyIdea: 'A chain makes control flow implicit. Enforce next, order and error handling in one place, and log each hop.',
      metrics: { edits: '1 new class', knows: '1 (next_)', cost: 'hidden flow', pattern: 'Chain' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [blk('errh', A, 'ErrorHandler', 'outermost', 'green', 'Shield', { status: 'ok', badge: 'returns 500' }), rate({ at: B, status: 'down', badge: 'raised' }), handler({ at: C, status: 'dim' })],
        links: [link('errh', 'rate', { label: 'try next_(req)' }), link('rate', 'handler', { label: 'never reached', style: 'faint' })],
        flows: [
          { path: ['errh', 'rate'], tone: 'request', label: 'next_(req)', duration: 1.3 },
          { path: ['rate', 'errh'], tone: 'error', label: 'RuntimeError', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Wrap everything once',
          icon: 'Code',
          code: 'class ErrorHandlerMiddleware(Middleware):\n    def handle(self, req, next_):\n        try:\n            return next_(req)\n        except Exception:\n            log.exception("request failed")\n            return Response(500)',
          footer: { text: 'Put it first so it sees every exception', tone: 'good' },
        },
        caption: 'One outer handler catches what the others miss',
      },
    },
    // 5
    {
      title: 'N squared',
      tag: 'case',
      heading: 'Case: a form where every widget holds every other widget',
      eli5: 'At recess every kid shouts straight at every other kid. With 4 kids that is 12 shouting lines, and moving one kid to a new spot means telling all the rest.',
      body: [
        'A date field, an error label, a submit button and a calendar popup all react to each other. `DateField.on_change` holds references to the other three and calls them directly: validate, show an error, disable the button, highlight a day.',
        'Every widget knows every other widget. Four widgets make 12 directed links, and the number grows with the square of the count. A new widget means editing all the existing ones.',
      ],
      keyIdea: 'When every object references every other, coupling grows as N squared and no widget can be reused alone.',
      metrics: { edits: '4 widgets', knows: '3 each', cost: '12 links', pattern: 'none' },
      metricTones: { edits: 'bad', knows: 'bad', cost: 'bad' },
      scene: {
        nodes: [field({ status: 'hot', badge: 'knows 3' }), label(), button(), calendar()],
        links: [
          link('field', 'label', { arrow: 'both', style: 'faint' }),
          link('field', 'button', { arrow: 'both', style: 'faint' }),
          link('field', 'calendar', { arrow: 'both', style: 'faint' }),
          link('label', 'button', { arrow: 'both', style: 'faint' }),
          link('label', 'calendar', { arrow: 'both', style: 'faint' }),
          link('button', 'calendar', { arrow: 'both', style: 'faint' }),
        ],
        flows: [
          { path: ['field', 'label'], tone: 'request', label: 'show_error()', duration: 1.2 },
          { path: ['field', 'button'], tone: 'request', label: 'disable()', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Links grow with N squared',
          icon: 'Table',
          rows: [
            { text: '2 widgets', value: '2 links' },
            { text: '4 widgets', value: '12 links', tone: 'warn' },
            { text: '8 widgets', value: '56 links', tone: 'bad' },
          ],
          footer: { text: 'N times N minus 1 directed links', tone: 'muted' },
        },
        caption: 'Everyone knows everyone',
      },
    },
    // 6
    {
      title: 'Mediator',
      tag: 'concept',
      heading: 'Mediator: widgets talk to one hub, never to each other',
      eli5: 'At recess the kids only talk to the teacher. She decides who needs to hear what. A kid can move or leave and nobody else changes. The teacher is the **mediator**.',
      body: [
        'A `DialogMediator` receives `notify(sender, event)` from each widget. It holds the coordination logic and calls the other widgets. A widget keeps one reference, to its mediator.',
        'Links drop from N squared to N, a hub and spokes. Changing the workflow is editing one file. Chat rooms, wizards and game lobbies fit this shape.',
      ],
      keyIdea: 'Mediator centralizes coordination so objects depend on the hub instead of on each other.',
      metrics: { edits: '1 (the mediator)', knows: '1 each', cost: '4 links', pattern: 'Mediator' },
      metricTones: { edits: 'good', knows: 'good', cost: 'good' },
      scene: {
        nodes: [field({ status: 'active' }), label(), button(), calendar(), blk('mediator', M, 'DialogMediator', 'notify(sender, event)', 'amber', 'Share2', { status: 'active' })],
        links: [
          link('field', 'mediator', { label: 'notify' }),
          link('mediator', 'label', { label: 'clear()' }),
          link('mediator', 'button', { label: 'enable()' }),
          link('mediator', 'calendar', { label: 'set_selected()' }),
        ],
        flows: [
          { path: ['field', 'mediator'], tone: 'request', label: 'notify(field, "change")', duration: 1.5 },
          { path: ['mediator', 'label'], tone: 'request', label: 'clear()', duration: 1.2, delay: 1.6 },
          { path: ['mediator', 'button'], tone: 'request', label: 'enable()', duration: 1.2, delay: 1.9 },
          { path: ['mediator', 'calendar'], tone: 'request', label: 'set_selected()', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Links before and after',
          icon: 'Table',
          rows: [
            { text: 'Before, 4 widgets', value: '12 links', tone: 'bad' },
            { text: 'After, hub and spokes', value: '4 links', tone: 'good' },
            { text: 'Widget knows', value: 'its mediator' },
          ],
          footer: { text: 'Workflow lives in one place', tone: 'good' },
        },
        caption: 'One hub, four spokes',
      },
      code: {
        language: 'python',
        title: 'Mediator for a dialog',
        source: `class DialogMediator:
    def __init__(self):
        self.date_field = None
        self.label = None
        self.button = None
        self.calendar = None

    def notify(self, sender, event):
        if sender is self.date_field and event == "change":
            if valid_date(self.date_field.value):
                self.label.clear()
                self.button.enable()
                self.calendar.set_selected(self.date_field.value)
            else:
                self.label.show_error("bad date")
                self.button.disable()

class DateField:
    def __init__(self, mediator):
        self.mediator = mediator
        self.value = ""

    def set_value(self, v):
        self.value = v
        self.mediator.notify(self, "change")   # nothing else`,
        highlight: [8, 9, 10, 11, 12, 13, 20, 25],
      },
    },
    // 7
    {
      title: 'God mediator',
      tag: 'tradeoff',
      heading: 'The mediator can become the new tangle',
      eli5: 'If the teacher must decide everything for the whole school, she becomes the busiest person in the building. Give each small group its own helper.',
      body: [
        'The risks: `notify()` grows to 500 lines of `if/elif` (a **god object**), a mediator that sets a widget can fire `on_change` again and loop, and an unwired widget is still `None` so `notify` raises `AttributeError`.',
        'Split by workflow, guard against cycles by suppressing events during programmatic updates, and pass collaborators in explicitly. When one mediator handles dozens of unrelated events, move to an event bus (Mediator plus Observer). A Redux store plays this role in many front ends.',
      ],
      keyIdea: 'A mediator removes coupling between peers by concentrating it in one object. Keep that object small, or it becomes the tangle.',
      metrics: { edits: '1 (the mediator)', knows: '1 each', cost: '500 line notify()', pattern: 'Mediator' },
      metricTones: { cost: 'bad' },
      scene: {
        nodes: [
          blk('god', B, 'DialogMediator', 'one notify() for all', 'amber', 'Share2', { status: 'hot', load: 92, chips: [{ text: '500 lines of if/elif', tone: 'bad' }] }),
          blk('datemed', D, 'DateMediator', 'one workflow', 'green', 'Clock', { status: 'ok' }),
          blk('paymed', F, 'PaymentMediator', 'one workflow', 'green', 'Receipt', { status: 'ok' }),
        ],
        links: [link('god', 'datemed', { label: 'split into', labelTone: 'good' }), link('god', 'paymed', { label: 'split into', labelTone: 'good' })],
        flows: [
          { path: ['god', 'datemed'], tone: 'event', label: 'date events', duration: 1.3 },
          { path: ['god', 'paymed'], tone: 'event', label: 'payment events', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'How a mediator fails',
          icon: 'Bug',
          rows: [
            { text: 'God mediator', value: 'split by workflow', tone: 'warn' },
            { text: 'Circular notify loop', value: 'cycle guard', tone: 'warn' },
            { text: 'Unwired widget is None', value: 'validate in init', tone: 'warn' },
            { text: 'Init order dance', value: 'two-phase init', tone: 'warn' },
          ],
        },
        caption: 'Keep each mediator small',
      },
    },
    // 8
    {
      title: 'Undo peeks',
      tag: 'case',
      heading: 'Case: undo that copies fields by hand',
      eli5: 'You build a Lego tower and keep a note of which bricks you moved. Add a new kind of brick and you forget to write it down, so undo quietly breaks.',
      body: [
        'An editor pushes `(list(self._buffer), self._cursor)` onto its own undo stack before each edit, and `undo()` pops it back. The undo code lists every private field by hand.',
        'Later someone adds `_selection`. Nobody updates the tuple, so undo restores the text but leaves a stale selection. It fails silently, and undo logic now lives inside the editor.',
      ],
      keyIdea: 'Hand-copying fields for undo couples the undo code to every field and breaks quietly when a field is added.',
      metrics: { edits: '2 places per field', knows: 'every field', cost: 'silent bug', pattern: 'none' },
      metricTones: { edits: 'warn', cost: 'bad' },
      scene: {
        nodes: [
          blk('user', A, 'User', 'presses Ctrl+Z', 'gray', 'User'),
          editor({ at: B, status: 'hot', badge: '_selection forgotten' }),
          blk('stack', C, '_undo_stack', 'tuples of fields', 'gray', 'List'),
        ],
        links: [link('user', 'editor', { label: 'undo()' }), link('editor', 'stack', { label: 'push (buf, cursor)', labelTone: 'warn' })],
        flows: [
          { path: ['editor', 'stack'], tone: 'request', label: 'copy fields', duration: 1.3 },
          { path: ['user', 'editor'], tone: 'request', label: 'undo()', duration: 1.3, delay: 1.4 },
          { path: ['stack', 'editor'], tone: 'error', label: 'selection stale', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Fields copied by hand',
          icon: 'Table',
          rows: [
            { text: '_buffer', value: 'copied', tone: 'good' },
            { text: '_cursor', value: 'copied', tone: 'good' },
            { text: '_selection', value: 'forgotten', tone: 'bad' },
          ],
          footer: { text: 'New field, silent corruption', tone: 'bad' },
        },
        caption: 'Undo lists every private field by hand',
      },
      code: {
        language: 'python',
        title: 'Hand-rolled undo inside Editor',
        source: `class Editor:
    def __init__(self):
        self._buffer = []
        self._cursor = 0
        self._selection = None
        self._undo_stack = []

    def type(self, ch):
        self._undo_stack.append((list(self._buffer), self._cursor))
        self._buffer.insert(self._cursor, ch)
        self._cursor += 1

    def undo(self):
        self._buffer, self._cursor = self._undo_stack.pop()`,
        highlight: [5, 9, 14],
      },
    },
    // 9
    {
      title: 'Memento',
      tag: 'concept',
      heading: 'Memento: the object makes its own sealed snapshot',
      eli5: 'Take a photo of your tower before you try something. If it falls, you rebuild from the photo. A friend can keep the photos in a box but cannot change them. The photo is the **memento**.',
      body: [
        'The `Editor` (originator) creates an `EditorMemento` that holds a deep copy of its state. A `History` (caretaker) stores mementos on a stack and never looks inside them.',
        '`restore()` is the only place that reads a memento. Add a field and undo still works, because the snapshot copies `__dict__` whole. `frozen=True` stops the caretaker from tampering.',
      ],
      keyIdea: 'Memento saves and restores state without exposing it: only the originator can read its own snapshots.',
      metrics: { edits: '0 (new field just works)', knows: '1 (History)', cost: 'full copy per save', pattern: 'Memento' },
      metricTones: { edits: 'good', knows: 'good' },
      scene: {
        nodes: [editor({ status: 'active' }), blk('caller', B, 'Client', 'save, undo', 'gray', 'User'), blk('history', C, 'History', 'caretaker', 'green', 'Layers'), blk('memento', E, 'EditorMemento', 'frozen snapshot', 'blue', 'Copy')],
        links: [
          link('caller', 'history', { label: 'save / undo' }),
          link('history', 'editor', { label: 'snapshot / restore' }),
          link('editor', 'memento', { label: 'creates' }),
          link('history', 'memento', { label: 'holds, never reads', style: 'dashed' }),
        ],
        flows: [
          { path: ['caller', 'history', 'editor'], tone: 'request', label: 'save(ed)', duration: 2.0 },
          { path: ['editor', 'memento'], tone: 'data', label: 'deepcopy(state)', duration: 1.4, delay: 2.1 },
          { path: ['history', 'editor'], tone: 'request', label: 'restore(m)', duration: 1.4, delay: 3.6 },
        ],
        panel: {
          title: 'Who may read what',
          icon: 'Shield',
          rows: [
            { text: 'Editor (originator)', value: 'writes and reads', tone: 'good' },
            { text: 'History (caretaker)', value: 'stores only' },
            { text: 'EditorMemento', value: 'frozen, opaque' },
          ],
          footer: { text: 'Encapsulation survives undo', tone: 'good' },
        },
        caption: 'Snapshot out, restore back in',
      },
      code: {
        language: 'python',
        title: 'Memento for undo',
        source: `from copy import deepcopy
from dataclasses import dataclass

@dataclass(frozen=True)
class EditorMemento:
    state: dict

class Editor:
    def __init__(self):
        self._buffer = []
        self._cursor = 0
        self._selection = None
    def type(self, ch):
        self._buffer.insert(self._cursor, ch); self._cursor += 1
    def snapshot(self) -> EditorMemento:
        return EditorMemento(state=deepcopy(self.__dict__))
    def restore(self, m: EditorMemento):
        self.__dict__.clear()
        self.__dict__.update(deepcopy(m.state))

class History:
    def __init__(self): self._stack = []
    def save(self, editor): self._stack.append(editor.snapshot())
    def undo(self, editor):
        if self._stack: editor.restore(self._stack.pop())

ed, hist = Editor(), History()
hist.save(ed); ed.type("h"); ed.type("i"); hist.undo(ed)   # back to empty`,
        highlight: [4, 15, 16, 17, 18, 19, 23, 25],
      },
    },
    // 10
    {
      title: 'Snapshot cost',
      tag: 'tradeoff',
      heading: 'Snapshots cost memory, so cap them or store deltas',
      eli5: 'A photo of the whole tower each time is heavy. If you take a hundred, your toy box fills up. Writing down only what changed is lighter, but harder to rewind in any order.',
      body: [
        'N snapshots of size B cost N times B. A 1 MB document with 100 undo levels is about 100 MB. Fix it by capping the stack depth or by storing deltas with the Command pattern.',
        'Pitfalls: a shallow `dict(self.__dict__)` copy shares nested lists, so undo does nothing. A file handle in the state breaks `deepcopy`, so exclude transient fields. Use `clear()` before `update()` on restore so stale fields vanish.',
      ],
      keyIdea: 'Memento is simple and safe for small state. For large state, cap the history or store deltas as commands.',
      metrics: { edits: '0 (new field just works)', knows: '1 (History)', cost: '100 MB for 100 undos', pattern: 'Memento' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [
          blk('stack', A, 'Memento stack', '100 full copies', 'blue', 'Copy', { status: 'hot', load: 88, chips: [{ text: '1 MB x 100', tone: 'warn' }] }),
          blk('cap', C, 'Capped history', 'last 20 only', 'green', 'Layers', { status: 'ok' }),
          blk('delta', F, 'Command deltas', 'store only changes', 'violet', 'Zap', { status: 'ok' }),
        ],
        links: [link('stack', 'cap', { label: 'cap depth', labelTone: 'good' }), link('stack', 'delta', { label: 'or store deltas', labelTone: 'good' })],
        flows: [
          { path: ['stack', 'cap'], tone: 'data', label: 'drop oldest', duration: 1.3 },
          { path: ['stack', 'delta'], tone: 'data', label: 'keep diffs', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Memory for one document',
          icon: 'Gauge',
          rows: [
            { text: '1 MB, 100 snapshots', value: '100 MB', tone: 'bad' },
            { text: '1 MB, capped at 20', value: '20 MB', tone: 'good' },
            { text: 'Deltas, about 1 KB each', value: '100 KB', tone: 'good' },
          ],
          footer: { text: 'Deltas are cheap but harder to restore out of order', tone: 'muted' },
        },
        caption: 'Full copies scale with history depth',
      },
      quiz: {
        question: 'An undo history stores a full deep copy of a 1 MB document on every edit and the process runs out of memory. What is the best fix?',
        options: [
          'Switch to shallow copies so each snapshot is smaller',
          'Cap the history depth or store deltas (command objects) instead of full copies',
          'Let the History class read the memento fields to compress them',
          'Move the snapshot into the Editor constructor',
        ],
        answer: 1,
        explain: 'Full snapshots cost N times the state size. Cap the depth or store deltas. A shallow copy would share nested lists and break undo, and History must not read memento internals.',
      },
    },
    // 11
    {
      title: 'Operations pile',
      tag: 'case',
      heading: 'Case: every new operation touches every node class',
      eli5: 'A nurse, a dentist and a barber each want to do something to every kid in class. If every kid must learn each visitor job, the kids need new lessons whenever someone new visits.',
      body: [
        'An expression tree has node classes `Num`, `Add` and `Mul`. Each needs `evaluate`, `pretty_print`, `to_ir` and `serialize`. That is 4 operations times 3 classes, all in the node files.',
        'A fifth operation means editing every node class. The classes carry code unrelated to being a node, and an operation is spread across many files.',
      ],
      keyIdea: 'When operations keep growing on a stable class hierarchy, putting them in the classes spreads each operation across every file.',
      metrics: { edits: '3 per new operation', knows: '4 operations', cost: '12 methods', pattern: 'none' },
      metricTones: { edits: 'bad', cost: 'bad' },
      scene: {
        nodes: [
          blk('num', A, 'Num', 'node', 'green', 'Package', { status: 'hot', chips: ['evaluate()', 'pretty_print()', 'to_ir()', 'serialize()'] }),
          blk('add', B, 'Add', 'node', 'green', 'Package', { status: 'hot', chips: ['evaluate()', 'pretty_print()', 'to_ir()', 'serialize()'] }),
          blk('mul', C, 'Mul', 'node', 'green', 'Package', { status: 'hot', chips: ['evaluate()', 'pretty_print()', 'to_ir()', 'serialize()'] }),
        ],
        panel: {
          title: 'Adding count_ops()',
          icon: 'FileCode',
          code: 'class Num:\n    def count_ops(self): return 0\nclass Add:\n    def count_ops(self): ...\nclass Mul:\n    def count_ops(self): ...',
          footer: { text: 'One new operation, three classes edited', tone: 'bad' },
        },
        caption: 'Every operation is copied into every class',
      },
    },
    // 12
    {
      title: 'Visitor',
      tag: 'concept',
      heading: 'Visitor: nodes accept a visitor, operations live in visitors',
      eli5: 'Each kid only knows how to say "come in, visitor" and tell the visitor what kind of kid they are. The nurse and the dentist each bring their own checklist. The visitor is the **visitor**.',
      body: [
        'Each node has one method, `accept(visitor)`, that calls the matching `visit_x` on the visitor. An operation becomes one class, `Evaluator`, with `visit_num`, `visit_add` and `visit_mul`.',
        'A new operation is a new visitor class and the node classes are not touched. This is the visitor of Python `ast.NodeVisitor`, which linters and formatters are built on.',
      ],
      keyIdea: 'Visitor moves operations out of the classes into one class per operation, reached through accept.',
      metrics: { edits: '1 new visitor', knows: '1 accept()', cost: '+1 call per node', pattern: 'Visitor' },
      metricTones: { edits: 'good', knows: 'good' },
      scene: {
        nodes: [evaluator({ status: 'active' }), nodeI(), num(), add({ status: 'active' }), mul()],
        links: [
          link('evaluator', 'node', { label: 'accept(ev)' }),
          link('num', 'node', { label: 'implements', style: 'faint' }),
          link('add', 'node', { label: 'implements', style: 'faint' }),
          link('mul', 'node', { label: 'implements', style: 'faint' }),
        ],
        flows: [
          { path: ['evaluator', 'node', 'add'], tone: 'request', label: 'tree.accept(ev)', duration: 1.8 },
          { path: ['add', 'evaluator'], tone: 'response', label: 'ev.visit_add(self)', duration: 1.6, delay: 1.9 },
        ],
        panel: {
          title: 'Dispatch table',
          icon: 'Table',
          rows: [
            { text: 'Num.accept(v)', value: 'v.visit_num(self)' },
            { text: 'Add.accept(v)', value: 'v.visit_add(self)' },
            { text: 'Mul.accept(v)', value: 'v.visit_mul(self)' },
          ],
          footer: { text: 'Each node picks its visit method', tone: 'muted' },
        },
        caption: 'The node calls back into the visitor',
      },
      code: {
        language: 'python',
        title: 'Visitor: Evaluator',
        source: `from abc import ABC, abstractmethod

class Node(ABC):
    @abstractmethod
    def accept(self, visitor): ...

class Num(Node):
    def __init__(self, n): self.n = n
    def accept(self, v): return v.visit_num(self)

class Add(Node):
    def __init__(self, l, r): self.l, self.r = l, r
    def accept(self, v): return v.visit_add(self)

class Mul(Node):
    def __init__(self, l, r): self.l, self.r = l, r
    def accept(self, v): return v.visit_mul(self)

class Evaluator:
    def visit_num(self, n): return n.n
    def visit_add(self, n): return n.l.accept(self) + n.r.accept(self)
    def visit_mul(self, n): return n.l.accept(self) * n.r.accept(self)`,
        highlight: [5, 9, 13, 17, 21],
      },
    },
    // 13
    {
      title: 'Double dispatch',
      tag: 'concept',
      heading: 'Double dispatch: the node type and the visitor type both pick the code',
      eli5: 'Two questions pick the exact job: what kind of kid is this, and what kind of visitor is here? The kid answers the first and the visitor answers the second. A new visitor needs no new kid lessons.',
      body: [
        'Python picks a method by the type of `self` only. Visitor bounces the call: `tree.accept(ev)` picks the node type, then `visit_add` on `ev` picks the visitor type. Two hops select one of node types times visitor types.',
        'For `Add(1, Mul(2, 3))`, `Evaluator` gives 7, `PrettyPrinter` gives `(1 + (2 * 3))` and `NodeCounter` gives 5. All three were added without editing a node class.',
      ],
      keyIdea: 'Two method calls (accept, then visit) pick code by two types, so each operation lives in one class.',
      metrics: { edits: '1 new visitor', knows: '1 accept()', cost: '+1 call per node', pattern: 'Visitor' },
      metricTones: { edits: 'good' },
      scene: {
        nodes: [evaluator({ sub: 'visitor, returns 7' }), blk('tree', B, 'Tree', 'Add(1, Mul(2, 3))', 'blue', 'Network', { status: 'active' }), blk('printer', C, 'PrettyPrinter', 'visitor', 'green', 'FileText'), blk('counter', F, 'NodeCounter', 'visitor', 'green', 'Binary')],
        links: [link('evaluator', 'tree', { label: 'accept' }), link('printer', 'tree', { label: 'accept' }), link('counter', 'tree', { label: 'accept' })],
        flows: [
          { path: ['evaluator', 'tree'], tone: 'request', label: 'accept(ev)', duration: 1.3 },
          { path: ['tree', 'evaluator'], tone: 'response', label: 'visit_add: 7', duration: 1.3, delay: 1.4 },
          { path: ['printer', 'tree'], tone: 'request', label: 'accept(pp)', duration: 1.3, delay: 2.9 },
        ],
        panel: {
          title: 'Same tree, three results',
          icon: 'Table',
          rows: [
            { text: 'Evaluator', value: '7', tone: 'good' },
            { text: 'PrettyPrinter', value: '(1 + (2 * 3))', tone: 'good' },
            { text: 'NodeCounter', value: '5', tone: 'good' },
          ],
          footer: { text: 'No node class was edited', tone: 'good' },
        },
        caption: 'New operations, same nodes',
      },
      code: {
        language: 'python',
        title: 'Two more visitors',
        source: `class PrettyPrinter:
    def visit_num(self, n): return str(n.n)
    def visit_add(self, n): return f"({n.l.accept(self)} + {n.r.accept(self)})"
    def visit_mul(self, n): return f"({n.l.accept(self)} * {n.r.accept(self)})"

class NodeCounter:
    def __init__(self): self.count = 0
    def visit_num(self, n): self.count += 1
    def visit_add(self, n): self.count += 1; n.l.accept(self); n.r.accept(self)
    def visit_mul(self, n): self.count += 1; n.l.accept(self); n.r.accept(self)

tree = Add(Num(1), Mul(Num(2), Num(3)))
print(tree.accept(Evaluator()))      # 7
print(tree.accept(PrettyPrinter()))  # (1 + (2 * 3))
counter = NodeCounter(); tree.accept(counter)
print(counter.count)                 # 5`,
        highlight: [1, 6, 13, 14, 16],
      },
    },
    // 14
    {
      title: 'Visitor price',
      tag: 'tradeoff',
      heading: 'The price of Visitor: a new node class breaks every visitor',
      eli5: 'A new kind of kid joins the class, and now every visitor needs a new checklist line for that kid. Visitors are great when kids rarely change and visitors come often, and poor the other way around.',
      body: [
        'Visitor flips the cost. Adding an operation is cheap. Adding a node class like `Sub` is expensive, because every visitor needs `visit_sub` or it raises `AttributeError` at runtime. A base `Visitor` with a `visit_unknown` gives a clear error.',
        'Other traps: a visitor that keeps state (`NodeCounter`) accumulates across trees, so use a fresh one each time. Visitors also reach into node fields, so expose read-only properties. Use it for stable hierarchies, such as compilers, linters and serializers.',
      ],
      keyIdea: 'Visitor suits a stable class hierarchy with many operations. If the hierarchy changes often, every change touches every visitor.',
      metrics: { edits: '1 per visitor per new node', knows: '1 accept()', cost: 'runtime AttributeError', pattern: 'Visitor' },
      metricTones: { edits: 'warn', cost: 'warn' },
      scene: {
        nodes: [evaluator({ status: 'down', badge: 'no visit_sub' }), blk('sub', B, 'Sub', 'new node class', 'amber', 'Package', { status: 'active' }), blk('printer', C, 'PrettyPrinter', 'visitor', 'green', 'FileText', { status: 'down', badge: 'no visit_sub' })],
        links: [link('sub', 'evaluator', { label: 'visit_sub?', labelTone: 'bad' }), link('sub', 'printer', { label: 'visit_sub?', labelTone: 'bad' })],
        flows: [
          { path: ['sub', 'evaluator'], tone: 'error', label: 'AttributeError', duration: 1.3 },
          { path: ['sub', 'printer'], tone: 'error', label: 'AttributeError', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Fail with a clear message',
          icon: 'Code',
          code: 'class Visitor:\n    def visit_unknown(self, n):\n        raise NotImplementedError(\n            f"{type(self).__name__} cannot visit {type(n).__name__}")\n\n# in each accept():\nhandler = getattr(v, "visit_sub", v.visit_unknown)',
          footer: { text: 'Add a node: touch every visitor', tone: 'warn' },
        },
        caption: 'A new node class reaches every visitor',
      },
    },
    // 15
    {
      title: 'Billion rows',
      tag: 'case',
      heading: 'Case: looping over a table by loading it all first',
      eli5: 'You want to hand a sticker to every kid in the school. Asking every kid to stand in the hall at once will not fit. You only need to see one kid at a time.',
      body: [
        '`all_users()` runs `SELECT * FROM users` and calls `fetchall()`, then builds a list of `User` objects. With 1 billion rows that is about 80 GB, and the process runs out of memory before `notify()` runs for the first user.',
        'The caller only needs the next user, one at a time. The code is making the caller pay for the whole collection up front.',
      ],
      keyIdea: 'If the consumer reads one element at a time, materializing the whole collection costs memory it never needed.',
      metrics: { edits: '-', knows: '1 list', cost: '80 GB at once', pattern: 'none' },
      metricTones: { cost: 'bad' },
      scene: {
        nodes: [
          blk('loop', A, 'for u in users', 'notify(u)', 'green', 'Repeat', { status: 'dim' }),
          blk('list', B, 'list of User', '1B objects', 'blue', 'List', { status: 'hot', load: 100, badge: '80 GB' }),
          { id: 'db', kind: 'db', at: C, label: 'users', sub: '1B rows' },
        ],
        links: [link('loop', 'list', { label: 'iterate', style: 'faint' }), link('db', 'list', { label: 'fetchall()', labelTone: 'bad' })],
        flows: [{ path: ['db', 'list'], tone: 'data', label: '1B rows', duration: 2.0 }],
        panel: {
          title: 'Loading everything',
          icon: 'Code',
          code: 'def all_users():\n    rows = db.execute("SELECT * FROM users").fetchall()\n    return [User(**r) for r in rows]\n\nfor u in all_users():   # never reached\n    notify(u)',
          footer: { text: 'Out of memory before the first user', tone: 'bad' },
        },
        caption: 'The loop never starts',
      },
    },
    // 16
    {
      title: 'Iterator',
      tag: 'concept',
      heading: 'Iterator: hand out one element at a time, lazily',
      eli5: 'Kids line up at the water fountain and you meet one at a time. You never need the whole school in the room. When the line ends, you are done. The line is the **iterator**.',
      body: [
        'An **iterator** gives the next element on demand and signals the end (`StopIteration`). In Python a generator makes one for you: `yield` pauses the function and resumes on the next request.',
        '`all_users()` fetches 1000 rows, yields them one by one, then fetches the next 1000. Memory stays near 80 KB instead of 80 GB. A `finally` closes the cursor even if the loop stops early.',
      ],
      keyIdea: 'An iterator lets the caller walk a collection without seeing its internals or holding it all in memory.',
      metrics: { edits: '-', knows: '1 loop', cost: '80 KB at a time', pattern: 'Iterator' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [blk('loop', A, 'for u in users', 'notify(u)', 'green', 'Repeat', { status: 'active' }), blk('gen', B, 'all_users()', 'generator', 'violet', 'Rss', { status: 'active', load: 8 }), { id: 'db', kind: 'db', at: C, label: 'users', sub: '1B rows' }],
        links: [link('loop', 'gen', { label: 'next()' }), link('gen', 'db', { label: 'fetchmany(1000)' })],
        flows: [
          { path: ['loop', 'gen'], tone: 'request', label: 'next()', duration: 1.2 },
          { path: ['gen', 'db'], tone: 'request', label: 'fetchmany(1000)', duration: 1.3, delay: 1.3 },
          { path: ['db', 'gen', 'loop'], tone: 'response', label: 'one User', duration: 1.8, delay: 2.7 },
        ],
        panel: {
          title: 'Memory, 1B rows',
          icon: 'Gauge',
          rows: [
            { text: 'fetchall() into a list', value: '80 GB', tone: 'bad' },
            { text: 'Generator, batch of 1000', value: '80 KB', tone: 'good' },
            { text: 'First user available', value: 'after 1 batch', tone: 'good' },
          ],
          footer: { text: 'Work starts before the data finishes loading', tone: 'good' },
        },
        caption: 'The generator pauses at each yield',
      },
      code: {
        language: 'python',
        title: 'Generator as an iterator',
        source: `def all_users():
    cursor = db.execute("SELECT * FROM users")
    try:
        while True:
            batch = cursor.fetchmany(1000)
            if not batch:
                return
            for row in batch:
                yield User(**row)       # one User at a time
    finally:
        cursor.close()

for u in all_users():
    notify(u)`,
        highlight: [5, 9, 10, 11],
      },
    },
    // 17
    {
      title: 'One-shot traps',
      tag: 'tradeoff',
      heading: 'Generators are one-shot, and async streams need back-pressure',
      eli5: 'A line at the fountain only goes by once. You cannot ask how many kids are in it, jump to the fifth kid, or watch it again. And if kids join faster than they drink, the line grows without end.',
      body: [
        'A generator supports forward iteration once. `len()`, indexing and a second pass all fail, and a second pass is silently empty. Call the function again for a new one. A long-held cursor can also time out, so prefer keyset pagination for slow consumers.',
        '`async for` streams events without blocking the loop, but nothing bounds the buffer. If a Kafka consumer is faster than `handle`, lag grows. Put a bounded `asyncio.Queue(maxsize=N)` between them. Skip iterators when data fits in memory and you need random access.',
      ],
      keyIdea: 'Iterators trade random access and re-reading for constant memory. For async streams, add a bounded queue for back-pressure.',
      metrics: { edits: '-', knows: '1 loop', cost: 'one pass only', pattern: 'Iterator' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [blk('source', A, 'Kafka topic', '10k events/s', 'gray', 'Rss'), blk('queue', B, 'asyncio.Queue', 'maxsize=100', 'green', 'Inbox', { status: 'active', chips: [{ text: 'put() waits when full', tone: 'good' }] }), blk('handle', C, 'handle(ev)', 'slower consumer', 'green', 'Cpu', { load: 70 })],
        links: [link('source', 'queue', { label: 'async for' }), link('queue', 'handle', { label: 'get()' })],
        flows: [
          { path: ['source', 'queue'], tone: 'event', label: 'event', count: 2, duration: 1.4 },
          { path: ['queue', 'handle'], tone: 'event', label: 'event', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Where iterators bite',
          icon: 'Bug',
          rows: [
            { text: 'Consume twice', value: 'second pass empty', tone: 'warn' },
            { text: 'len(), indexing', value: 'not supported', tone: 'warn' },
            { text: 'Exception mid-loop', value: 'use try/finally', tone: 'warn' },
            { text: 'Async, no bound', value: 'lag grows', tone: 'bad' },
          ],
        },
        caption: 'A bounded queue limits how far the source runs ahead',
      },
      code: {
        language: 'python',
        title: 'Async stream with back-pressure',
        source: `import asyncio

async def all_events():
    async for msg in kafka_consumer:
        yield parse_event(msg)

async def main():
    queue = asyncio.Queue(maxsize=100)    # back-pressure
    async def reader():
        async for ev in all_events():
            await queue.put(ev)           # waits when full
    task = asyncio.create_task(reader())
    while True:
        await handle(await queue.get())`,
        highlight: [8, 10, 11],
      },
      quiz: {
        question: 'You call `users = all_users()` for a generator, print `len(users)`, then loop over it twice. What happens?',
        options: [
          'It works: generators can be reused and measured',
          '`len()` fails because generators have no length, and the second loop sees nothing',
          'The first loop sees nothing and the second sees all rows',
          'Both loops see all rows but `len()` returns 0',
        ],
        answer: 1,
        explain: 'A generator is one-shot and has no length. After the first pass it is exhausted, so the second loop yields nothing. Call the function again or materialize a list if the data fits in memory.',
      },
    },
    // 18
    {
      title: 'Pain map',
      tag: 'concept',
      heading: 'Choosing among the five: read the symptom',
      eli5: 'When the playground goes wrong, look at what kind of mess it is. A row of checks, kids shouting at each other, a tower that needs a photo, many visitors, or a long line: each one has its own helper.',
      body: [
        'Chain of responsibility handles a sequence of checks that may stop early. Mediator handles N objects coordinating one workflow. Memento handles undo by snapshot. Visitor handles many operations on a stable hierarchy. Iterator handles walking a collection without exposing it.',
        'Part 1 gave the other five: Strategy for a long `if/elif` on type, Observer for one event with many listeners, State for mode-dependent behavior, Command for undo and queues, Template Method for a shared skeleton.',
      ],
      keyIdea: 'Each pattern is named after a symptom you can see in the code. Match the symptom, not the name.',
      metrics: { edits: '-', knows: '-', cost: '-', pattern: 'five more' },
      scene: {
        nodes: five(),
        panel: {
          title: 'Symptom to pattern',
          icon: 'List',
          rows: [
            { text: 'Validators that may stop early', value: 'Chain' },
            { text: 'N widgets knowing each other', value: 'Mediator' },
            { text: 'Undo by snapshot', value: 'Memento' },
            { text: 'Many ops, stable classes', value: 'Visitor' },
            { text: 'Walk a collection lazily', value: 'Iterator' },
          ],
          footer: { text: 'Part 1 covered the other five', tone: 'muted' },
        },
        caption: 'Five more symptoms, five more patterns',
      },
    },
    // 19
    {
      title: 'Combos',
      tag: 'case',
      heading: 'Real systems combine patterns',
      eli5: 'A good classroom uses several helpers together: a teacher who relays messages and a bell that everyone hears. Put them together and you get an announcement board.',
      body: [
        'Patterns rarely appear alone. Mediator plus Observer gives an in-process event bus. Chain of responsibility plus Decorator gives a request middleware stack. Observer plus Command is the foundation of event sourcing.',
        'Naming the combination is a shorthand. It tells a teammate how the pieces fit without describing the whole design.',
      ],
      keyIdea: 'Behavioral patterns combine: a hub that fans out events is Mediator plus Observer, and a middleware stack is Chain plus Decorator.',
      metrics: { edits: '-', knows: '-', cost: '-', pattern: 'combined' },
      scene: {
        nodes: [blk('c-mediator', A, 'Mediator', 'one hub', 'amber', 'Share2'), blk('c-observer', C, 'Observer', 'fan out', 'amber', 'Rss'), blk('c-bus', E, 'Event bus', 'combined', 'green', 'Webhook', { status: 'ok' })],
        links: [link('c-mediator', 'c-bus', { label: 'plus' }), link('c-observer', 'c-bus', { label: 'gives' })],
        panel: {
          title: 'Common pairs',
          icon: 'Table',
          rows: [
            { text: 'Mediator + Observer', value: 'event bus' },
            { text: 'Chain + Decorator', value: 'middleware stack' },
            { text: 'Observer + Command', value: 'event sourcing base' },
            { text: 'State + Memento', value: 'undo on a machine' },
            { text: 'Composite + Visitor', value: 'AST tooling' },
            { text: 'Pipeline + Strategy', value: 'swappable stages' },
          ],
        },
        caption: 'Two patterns often make one design',
      },
    },
    // 20
    {
      title: 'Start with pain',
      tag: 'tradeoff',
      heading: 'The meta-rule: no pain, no pattern',
      eli5: 'Do not buy a toolbox full of helpers before anything is broken. Wait until a mess shows up, then pick the one helper that fits. Using eleven at once just makes a new mess.',
      body: [
        'Every pattern started as a pain someone felt many times. Writing one before the pain exists is speculative, and you pay complexity for flexibility you may never use. YAGNI still applies to patterns.',
        'In interviews, naming two or three that fit and explaining the trade-offs is strong. Naming eleven reads as a memorized list. A pattern is shorthand for experienced developers.',
      ],
      keyIdea: 'Recognize the pain first. A pattern added without pain is complexity you pay for nothing.',
      metrics: { edits: '-', knows: '-', cost: 'complexity', pattern: 'YAGNI' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [blk('pain', A, 'Pain felt', 'repeated, real', 'gray', 'Bug', { status: 'active' }), blk('fit', B, 'Fitting pattern', '2 or 3 named', 'green', 'Layers', { status: 'ok' }), blk('spec', C, 'Speculative', '11 named', 'red', 'Boxes', { status: 'dim' })],
        links: [link('pain', 'fit', { label: 'pick', labelTone: 'good' }), link('fit', 'spec', { label: 'too many', labelTone: 'warn', style: 'faint' })],
        flows: [{ path: ['pain', 'fit'], tone: 'request', label: 'match symptom', duration: 1.4 }],
        panel: {
          title: 'Two ways to use patterns',
          icon: 'Scale',
          rows: [
            { text: 'Pain first, then the pattern', value: 'good', tone: 'good' },
            { text: 'Name 2 or 3 that fit', value: 'good', tone: 'good' },
            { text: 'Pattern first, pain later', value: 'speculative', tone: 'warn' },
            { text: 'Name 11 patterns', value: 'red flag', tone: 'bad' },
          ],
        },
        caption: 'Start from the pain',
      },
    },
    // 21
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: five more patterns and how to choose',
      eli5: 'Five more classroom helpers: a row of kids passing a note, a teacher at recess, a photo of the tower, visiting nurses and a line at the fountain. Pick the one that matches the mess.',
      body: [
        '**Chain of responsibility** passes a request along handlers that may stop it. **Mediator** puts coordination in a hub. **Memento** snapshots state for undo. **Visitor** adds operations without editing classes. **Iterator** walks a collection lazily.',
        'Each has a price: hidden flow, a god mediator, snapshot memory, a brittle hierarchy, one-shot reads. Start from the pain, name two or three that fit, and skip the rest.',
      ],
      keyIdea: 'All ten behavioral patterns answer a symptom. Match the symptom, accept the price, and skip the pattern when there is no pain.',
      metrics: { edits: '1 new class', knows: '1 each', cost: 'known', pattern: 'ten' },
      metricTones: { edits: 'good', knows: 'good' },
      scene: {
        nodes: five('ok'),
        panel: {
          title: 'Pattern and its price',
          icon: 'Scale',
          rows: [
            { text: 'Chain', value: 'hidden control flow' },
            { text: 'Mediator', value: 'god object risk' },
            { text: 'Memento', value: 'memory per snapshot' },
            { text: 'Visitor', value: 'new node breaks visitors' },
            { text: 'Iterator', value: 'one pass, no length' },
          ],
          footer: { text: 'Every pattern has a price', tone: 'muted' },
        },
        caption: 'Ten behavioral patterns, ten prices',
      },
      quiz: {
        question: 'You have a stable expression tree with 6 node classes and you keep adding new operations (evaluate, print, optimize, count). Which pattern fits, and what is its main risk?',
        options: [
          'Mediator, with the risk of a god object',
          'Chain of responsibility, with the risk of a forgotten next call',
          'Visitor, with the risk that a new node class forces a change in every visitor',
          'Memento, with the risk of high memory use',
        ],
        answer: 2,
        explain: 'Many operations on a stable hierarchy is the Visitor case. Its price is that adding a node class means adding a visit method to every visitor.',
      },
    },
  ],
};
