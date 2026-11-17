import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const blk = (id: string, label: string, sub: string, tint: Tint, icon: string, pos: [number, number], extra: Partial<SceneNode> = {}): SceneNode => ({
  id,
  kind: 'block',
  at: pos,
  label,
  sub,
  tint,
  icon,
  ...extra,
});
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...(label ? { label } : {}), ...extra });

// Class diagram cast. Interfaces are violet, abstract classes blue, concrete classes green, outside systems gray.
const checkout = blk('checkout', 'Checkout', 'concrete class', 'green', 'ShoppingBag', at(-3.8, -3.8));
const gateway = blk('gateway', 'PaymentGateway', 'interface', 'violet', 'Plug', at(0, -3.8));
const stripe = blk('stripe', 'StripeGateway', 'concrete class', 'green', 'Server', at(-3.6, 3.8), { size: 0.72 });
const fake = blk('fake', 'FakeGateway', 'concrete class', 'green', 'Bug', at(3.6, 3.8), { size: 0.72 });

// Sequence cast, laid out as a row so time reads left to right.
const row = (i: number): [number, number] => at(-5.1 + i * 3.4, 0);

export const lldUmlPart2: Lesson = {
  id: 'lld-uml-part-2',
  title: 'UML class and sequence diagrams (part 2)',
  tagline: 'Part 2: the sequence diagram. Lifelines, messages, creation and branches, and keeping both diagrams honest.',
  minutes: 8,
  level: 'Beginner',
  learn: [
    'Sequence diagrams: participants, lifelines and messages in order',
    'Calls, returns, async sends and activation bars',
    'Self calls, creation, and alt, opt and loop frames',
    'Polymorphism on a sequence diagram',
    'Keeping class and sequence diagrams consistent, and the whiteboard workflow',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'links', label: 'Relationships', icon: 'Share2' },
    { key: 'msgs', label: 'Messages', icon: 'Repeat' },
    { key: 'view', label: 'View', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'Order missing',
      tag: 'problem',
      heading: 'The class diagram cannot say what happens first',
      eli5: 'The blueprint sheet shows every toy part and how they plug together. It cannot tell you which button the clerk presses first, or what happens when the cashier machine says no.',
      body: [
        'Your class diagram shows `Checkout` holding a `PaymentGateway`. It does not show that `pay()` calls `charge()` first, then builds a `Receipt`, and that a decline skips the receipt.',
        'Behavior needs order and branches. A **sequence diagram** adds exactly that for one scenario at a time.',
      ],
      keyIdea: 'Structure says who may talk. Only a sequence diagram says who talks, in what order, and when.',
      metrics: { classes: '4', links: '3', msgs: '?', view: 'class' },
      metricTones: { msgs: 'bad' },
      scene: {
        nodes: [
          { ...checkout, chips: [{ text: 'pay() then what?', tone: 'warn' }] },
          { ...gateway, status: 'hot', badge: 'order unknown' },
          blk('receipt', 'Receipt', 'concrete class', 'green', 'FileText', at(-3.6, 3.8), { size: 0.72, status: 'dim' }),
        ],
        links: [link('checkout', 'gateway', 'has-a'), link('checkout', 'receipt', 'creates', { style: 'dashed' })],
        flows: [
          { path: ['checkout', 'gateway'], tone: 'error', label: 'first?', duration: 1.4 },
          { path: ['checkout', 'receipt'], tone: 'error', label: 'or first?', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What the class diagram leaves out',
          icon: 'Clock',
          rows: [
            { text: 'Which call comes first', value: 'unknown', tone: 'warn' },
            { text: 'What returns what', value: 'unknown', tone: 'warn' },
            { text: 'What happens on a decline', value: 'unknown', tone: 'bad' },
          ],
        },
        caption: 'Arrows show links and no sequence',
      },
    },
    {
      title: 'Sequence basics',
      tag: 'concept',
      heading: 'A sequence diagram: objects across the top, time down the page',
      eli5: 'A comic strip for the toy shop. Each character stands in a column, and the speech balloons go down the page in the order they were said.',
      body: [
        'Each box across the top is a **participant**, usually an object, labeled `name:Class`. A dashed line falls from it: its **lifeline**. Time runs downward.',
        'A horizontal arrow between two lifelines is one **message**. The order down the page is the order in time. A diagram shows one scenario, such as "pay for an order", not every possible run.',
      ],
      keyIdea: 'Participants sit across the top, time runs down, and every arrow is one message in order.',
      metrics: { classes: '-', links: '-', msgs: '3', view: 'sequence' },
      scene: {
        nodes: [
          blk('app', 'app', 'caller', 'gray', 'Code', row(0), { size: 0.72 }),
          { ...checkout, id: 'checkout', label: ':Checkout', sub: 'participant', at: row(1), size: 0.72 },
          { ...stripe, label: ':StripeGateway', sub: 'participant', at: row(2), size: 0.72 },
          blk('api', 'Stripe API', 'external system', 'gray', 'Globe', row(3), { size: 0.72 }),
        ],
        links: [
          link('app', 'checkout', undefined, { route: 'straight', style: 'faint' }),
          link('checkout', 'stripe', undefined, { route: 'straight', style: 'faint' }),
          link('stripe', 'api', undefined, { route: 'straight', style: 'faint' }),
        ],
        flows: [
          { path: ['app', 'checkout'], tone: 'request', label: 'pay(order)', duration: 1, delay: 0 },
          { path: ['checkout', 'stripe'], tone: 'request', label: 'charge()', duration: 1, delay: 1.1 },
          { path: ['stripe', 'api'], tone: 'request', label: 'POST /charges', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'The lifeline layout',
          icon: 'Workflow',
          code: ' app     :Checkout   :StripeGateway\n  |  pay()    |             |\n  |---------->|  charge()   |\n  |           |------------>|\n  |           |             |\n  v time      v             v',
        },
        caption: 'Left to right who, top to bottom when',
      },
    },
    {
      title: 'Messages',
      tag: 'concept',
      heading: 'Messages: calls, returns, async sends and activation bars',
      eli5: 'In the comic strip a solid arrow means "do this and I will wait". A dotted arrow back means "here is your answer". A thin-headed arrow means "I dropped a note and walked away".',
      body: [
        'A **synchronous call** is a solid line with a filled head: the sender waits. A **return** is a dashed line back. An **asynchronous message** has an open head: the sender carries on without waiting.',
        'A thin rectangle on a lifeline, the **activation bar**, shows when that object is busy running a method. Put the method name and arguments on the arrow, such as `charge(1000, tok)`.',
      ],
      keyIdea: 'Solid and filled means wait for the answer, dashed means the answer, an open head means do not wait.',
      metrics: { classes: '-', links: '-', msgs: '3', view: 'sequence' },
      scene: {
        nodes: [
          blk('caller', ':Checkout', 'sender', 'green', 'ShoppingBag', at(-4.8, 0), { size: 0.72 }),
          { ...gateway, id: 'receiver', label: ':Gateway', sub: 'receiver', tint: 'green', at: at(0.4, 0), size: 0.72 },
          blk('bus', 'Event bus', 'async target', 'gray', 'Rss', at(5.2, 0), { size: 0.72 }),
        ],
        links: [link('caller', 'receiver', undefined, { route: 'straight', style: 'faint' }), link('receiver', 'bus', undefined, { route: 'straight', style: 'faint' })],
        flows: [
          { path: ['caller', 'receiver'], tone: 'request', label: 'charge(1000)', duration: 1.1 },
          { path: ['receiver', 'caller'], tone: 'response', label: 'txn_id', duration: 1.1, delay: 1.3 },
          { path: ['receiver', 'bus'], tone: 'event', label: 'PaymentTaken', duration: 1.1, delay: 2.6 },
        ],
        panel: {
          title: 'Arrow vocabulary',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Solid, filled head', value: 'sync call, waits' },
            { text: 'Dashed, open head', value: 'return value' },
            { text: 'Solid, open head', value: 'async, no wait' },
            { text: 'Thin bar on a lifeline', value: 'object is running' },
          ],
        },
        caption: 'Three arrow styles, three meanings',
      },
    },
    {
      title: 'Walk a run',
      tag: 'case',
      heading: 'Case: one payment, traced end to end',
      eli5: 'Follow one toy order through the shop. The clerk asks the cashier machine to take money, the machine rings the bank, the bank answers, and the clerk hands over a receipt.',
      body: [
        'The app calls `pay(order)`. `Checkout` calls `charge` on its gateway, the gateway calls the Stripe API, and the transaction id returns up the chain. `Checkout` wraps it in a `Receipt`.',
        'Read the diagram top to bottom and you can write `pay()` straight from it. Each arrow into `Checkout` is a method on `Checkout`.',
      ],
      keyIdea: 'A sequence diagram is a script for one scenario. You can read the method bodies straight off it.',
      metrics: { classes: '-', links: '-', msgs: '6', view: 'sequence' },
      scene: {
        nodes: [
          blk('app', 'app', 'caller', 'gray', 'Code', row(0), { size: 0.72 }),
          { ...checkout, label: ':Checkout', sub: 'participant', at: row(1), size: 0.72 },
          { ...stripe, label: ':StripeGateway', sub: 'participant', at: row(2), size: 0.72 },
          blk('api', 'Stripe API', 'external system', 'gray', 'Globe', row(3), { size: 0.72 }),
        ],
        links: [
          link('app', 'checkout', undefined, { route: 'straight', style: 'faint' }),
          link('checkout', 'stripe', undefined, { route: 'straight', style: 'faint' }),
          link('stripe', 'api', undefined, { route: 'straight', style: 'faint' }),
        ],
        flows: [
          { path: ['app', 'checkout'], tone: 'request', label: '1 pay(order)', duration: 0.9, delay: 0 },
          { path: ['checkout', 'stripe'], tone: 'request', label: '2 charge()', duration: 0.9, delay: 1 },
          { path: ['stripe', 'api'], tone: 'request', label: '3 POST', duration: 0.9, delay: 2 },
          { path: ['api', 'stripe'], tone: 'response', label: '4 200', duration: 0.9, delay: 3 },
          { path: ['stripe', 'checkout'], tone: 'response', label: '5 txn_id', duration: 0.9, delay: 4 },
          { path: ['checkout', 'app'], tone: 'response', label: '6 Receipt', duration: 0.9, delay: 5 },
        ],
        panel: {
          title: 'The six messages',
          icon: 'List',
          rows: [
            { text: '1. app to Checkout', value: 'pay(order)' },
            { text: '2. Checkout to Gateway', value: 'charge(amt, tok)' },
            { text: '3. Gateway to Stripe API', value: 'POST /charges' },
            { text: '4 to 6. returns', value: '200, txn_id, Receipt', tone: 'muted' },
          ],
        },
        caption: 'Calls go right, returns come back left',
      },
      code: {
        language: 'python',
        title: 'The sequence, as code',
        source: `class Checkout:
    def pay(self, order: Order) -> Receipt:
        txn_id = self._gateway.charge(order.total_cents(), order.token)  # 2, 5
        return Receipt(order.id, txn_id)                                 # 6

# in the app (message 1):
receipt = checkout.pay(order)`,
        highlight: [3, 4],
      },
      quiz: {
        question: 'In the diagram, a solid arrow with a filled head goes from `Checkout` to the gateway, and a dashed arrow comes back. What does that pair mean?',
        options: [
          'Checkout makes a call and waits for the return value',
          'Checkout sends an async event and carries on',
          'The gateway extends Checkout',
          'Checkout creates the gateway',
        ],
        answer: 0,
        explain: 'Solid with a filled head is a synchronous call, and the dashed arrow back is its return. An async send has an open head and no matching return.',
      },
    },
    {
      title: 'Create, self',
      tag: 'concept',
      heading: 'Self calls and object creation',
      eli5: 'Sometimes the clerk talks to themselves ("is this order empty?"). Sometimes a new toy is built partway through the story, so its column only starts then.',
      body: [
        'A **self call** is an arrow that loops back to the same lifeline, such as `_validate(order)` inside `pay`. It shows work done by one object with no outside help.',
        'A **create** message points at the box of a new participant, drawn lower than the rest: `Receipt` appears only when `pay` builds it.',
      ],
      keyIdea: 'Loop arrows are self calls. A box that starts partway down the page is an object created mid-run.',
      metrics: { classes: '-', links: '-', msgs: '2', view: 'sequence' },
      scene: {
        nodes: [
          { ...checkout, label: ':Checkout', sub: 'runs pay()', at: at(-4.2, -3.6), size: 0.72, status: 'active', chips: [{ text: '_validate(order)', tone: 'good' }] },
          blk('receipt', ':Receipt', 'created mid-run', 'green', 'FileText', at(3.4, 3.8), { size: 0.72 }),
        ],
        links: [link('checkout', 'receipt', undefined, { route: 'elbow', style: 'faint' })],
        flows: [
          { path: ['checkout', 'checkout'], tone: 'request', label: '1 _validate(order)', duration: 1.2 },
          { path: ['checkout', 'receipt'], tone: 'data', label: '2 <<create>> Receipt(txn)', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Special lifeline marks',
          icon: 'Workflow',
          rows: [
            { text: 'Loop arrow on one lifeline', value: 'self call' },
            { text: 'Arrow to a lowered box', value: 'create' },
          ],
        },
        caption: 'Creation starts a lifeline mid-page',
      },
    },
    {
      title: 'Destroy',
      tag: 'concept',
      heading: 'The end of a lifeline: the destroy mark',
      eli5: 'When a toy is thrown away, its column in the comic strip stops with a big cross. Nothing can be sent to it after that.',
      body: [
        'An **X** at the bottom of a lifeline marks destruction: the object is gone and no message may arrive after it. In garbage-collected languages you rarely draw it. Use it for things with an explicit end, such as a closed connection or a deleted `Order`.',
        'Most lifelines simply run to the bottom of the page and stop without an X. That means the diagram ends, not that the object died.',
      ],
      keyIdea: 'An X means the object is destroyed. A lifeline that just stops has not been destroyed.',
      metrics: { classes: '-', links: '-', msgs: '1', view: 'sequence' },
      scene: {
        nodes: [
          { ...checkout, label: ':Checkout', sub: 'caller', at: at(-3.6, 0), size: 0.72 },
          blk('conn', ':Connection', 'closed at the end', 'gray', 'Plug', at(3.6, 0), { size: 0.72, status: 'hot', chips: [{ text: 'X destroyed', tone: 'bad' }] }),
        ],
        links: [link('checkout', 'conn', undefined, { route: 'straight', style: 'faint' })],
        flows: [{ path: ['checkout', 'conn'], tone: 'error', label: 'close()', duration: 1.4 }],
        panel: {
          title: 'When to draw the X',
          icon: 'Workflow',
          rows: [
            { text: 'Explicit close or delete', value: 'draw X', tone: 'good' },
            { text: 'Garbage collected object', value: 'skip it', tone: 'muted' },
          ],
        },
        caption: 'An X ends the lifeline',
      },
    },
    {
      title: 'Frames',
      tag: 'concept',
      heading: 'Alt, opt and loop: showing branches on one diagram',
      eli5: 'The comic strip has boxes for choices. "If the cashier says yes, hand over the toy. Otherwise, put it back." and "for each toy in the basket, scan it."',
      body: [
        'A labeled box around some messages is a **combined fragment**. `alt` has a guard in square brackets and an `else` part: only one branch runs. Here a decline makes the gateway raise `CardDeclined`, so the else branch runs. `opt` is a single optional branch, such as sending the email only if the user has an address. `loop` repeats its messages while the guard holds, such as charging each item.',
        'Use frames sparingly. If a diagram needs four nested frames, split it into two scenarios.',
      ],
      keyIdea: 'alt picks one branch, opt may skip, loop repeats. Keep each diagram to one scenario with at most one or two frames.',
      metrics: { classes: '-', links: '-', msgs: '3', view: 'sequence' },
      scene: {
        nodes: [
          { ...checkout, at: at(0, -3.8), size: 0.72 },
          { ...stripe, at: at(-5, 3.6), size: 0.72, sub: 'raises CardDeclined' },
          blk('mailer', 'Mailer', '[charge ok] sync call', 'gray', 'Mail', at(0, 3.6), { size: 0.72 }),
          blk('order', 'Order', '[declined]', 'green', 'Receipt', at(5, 3.6), { size: 0.72, status: 'hot' }),
        ],
        links: [
          link('checkout', 'stripe', undefined, { route: 'elbow', style: 'faint' }),
          link('checkout', 'mailer', undefined, { route: 'straight', style: 'faint' }),
          link('checkout', 'order', undefined, { route: 'elbow', style: 'faint' }),
        ],
        flows: [
          { path: ['checkout', 'stripe'], tone: 'request', label: 'charge()', duration: 1, delay: 0 },
          { path: ['checkout', 'mailer'], tone: 'request', label: 'ok: send(receipt)', duration: 1.2, delay: 1.2 },
          { path: ['checkout', 'order'], tone: 'error', label: 'declined: mark_failed()', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'The three frames, in text',
          icon: 'Code',
          code: 'alt [charge ok]\n  Checkout -> Mailer: send(receipt)\nelse [CardDeclined]\n  Checkout -> Order: mark_failed()\nopt [user has email] send(receipt)\nloop [each item] charge(item)',
        },
        caption: 'One box, two possible branches',
      },
      code: {
        language: 'python',
        title: 'The alt frame as code',
        source: `def pay(self, order: Order) -> Receipt:
    try:
        txn_id = self._gateway.charge(order.total_cents(), order.token)
    except CardDeclined:                      # [declined]
        order.mark_failed()
        raise
    receipt = Receipt(order.id, txn_id)       # [charge ok]
    if order.user.email:                      # opt [user has email]
        self._mailer.send(receipt)            # sync call
    return receipt`,
        highlight: [4, 5, 6, 7, 8, 9],
      },
    },
    {
      title: 'Same call',
      tag: 'concept',
      heading: 'Polymorphism on a sequence diagram',
      eli5: 'The clerk says "take payment" to whatever cashier machine is on the counter. In the real shop that is the real machine. In the practice shop it is a toy machine. The clerk says the same words.',
      body: [
        'On a sequence diagram the participant is an **object**, so it shows the concrete class: `:StripeGateway` in production, `:FakeGateway` in a test. The message name, `charge`, is the same.',
        'The class diagram promises the interface. The sequence diagram shows which implementation runs this time. Label the lifeline `:PaymentGateway` when the scenario does not care which one.',
      ],
      keyIdea: 'Class diagrams name the interface. Sequence diagrams name the object that actually answers.',
      metrics: { classes: '4', links: '3', msgs: '2', view: 'both' },
      scene: {
        nodes: [{ ...checkout, at: at(-4, -3.8), size: 0.85 }, { ...gateway, at: at(2.2, -3.8), size: 0.72 }, { ...stripe, at: at(-3.6, 3.8) }, { ...fake, at: at(3.6, 3.8) }],
        links: [link('checkout', 'gateway', 'has-a', { route: 'straight' }), link('stripe', 'gateway', 'implements', { style: 'dashed' }), link('fake', 'gateway', 'implements', { style: 'dashed' })],
        flows: [
          { path: ['checkout', 'stripe'], tone: 'request', label: 'prod: charge()', duration: 1.4 },
          { path: ['checkout', 'fake'], tone: 'event', label: 'test: charge()', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Same message, different lifeline',
          icon: 'Split',
          rows: [
            { text: 'Production run', value: ':StripeGateway', tone: 'good' },
            { text: 'Unit test run', value: ':FakeGateway', tone: 'good' },
            { text: 'Message on both', value: 'charge(amt, tok)' },
            { text: 'Class box they share', value: '<<interface>>' },
          ],
        },
        caption: 'One call, two possible receivers',
      },
    },
    {
      title: 'Keep in sync',
      tag: 'tradeoff',
      heading: 'The two diagrams must agree with each other and the code',
      eli5: 'The blueprint sheet says the clerk has a "take payment" button. If the comic strip shows the clerk pressing a button that is not on the sheet, one of the two papers is wrong.',
      body: [
        'Check each message arrow against the class diagram. The receiving class must have a **method** with that name. The sender must have a **path** to the receiver: an association, a parameter, or a created object.',
        'When they disagree, the code decides. Diagrams drift. Redraw only the part you are discussing, and keep a diagram as text so a code review can diff it.',
      ],
      keyIdea: 'Every message is a method on the receiver. Every sender needs a link to it. Fix the diagram, not the code, when they disagree.',
      metrics: { classes: '4', links: '3', msgs: '6', view: 'both' },
      scene: {
        nodes: [
          blk('seq', 'Sequence diagram', 'message: charge()', 'blue', 'Repeat', at(-3.8, -2), { size: 0.85 }),
          blk('cls', 'Class diagram', 'method: charge()', 'violet', 'Boxes', at(3.8, -2), { size: 0.85 }),
          blk('src', 'The code', 'def charge(...)', 'green', 'FileCode', at(0, 3.8), { size: 0.85 }),
        ],
        links: [link('seq', 'cls', 'must match', { route: 'straight', arrow: 'both' }), link('seq', 'src', 'reflects'), link('cls', 'src', 'reflects')],
        flows: [
          { path: ['seq', 'cls'], tone: 'handshake', label: 'charge() exists?', duration: 1.5 },
          { path: ['cls', 'src'], tone: 'handshake', label: 'matches code?', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Consistency checks',
          icon: 'Shield',
          rows: [
            { text: 'Message name', value: 'a method on the receiver' },
            { text: 'Sender to receiver', value: 'a field, param or create' },
            { text: 'Interface message', value: 'implemented by each class' },
            { text: 'Disagreement', value: 'trust the code', tone: 'warn' },
          ],
        },
        caption: 'Each arrow needs a method behind it',
      },
    },
    {
      title: 'On the board',
      tag: 'case',
      heading: 'Whiteboard workflow and text-based diagrams',
      eli5: 'When you explain a new toy, first draw the parts and their lines. Then act out one story with them. Keep the drawings as words so a friend can fix a typo.',
      body: [
        'Order matters in an interview or a design review: restate the requirements, list the nouns, draw the **class diagram** (names and arrows), then draw a **sequence diagram** for the one or two scenarios that matter most.',
        'Write diagrams as text with a tool such as Mermaid or PlantUML. The text sits next to the code, is diffed in review, and cannot go stale in a slide deck.',
      ],
      keyIdea: 'Requirements, nouns, class diagram, one sequence per key scenario. Keep the source as text beside the code.',
      metrics: { classes: '4', links: '3', msgs: '6', view: 'workflow' },
      scene: {
        nodes: [
          blk('req', 'Requirements', 'what it must do', 'gray', 'FileText', at(-5.1, 0), { size: 0.72 }),
          blk('classd', 'Class diagram', 'names, arrows', 'violet', 'Boxes', at(-1.7, 0), { size: 0.72 }),
          blk('seqd', 'Sequence', 'key scenarios', 'blue', 'Repeat', at(1.7, 0), { size: 0.72 }),
          blk('impl', 'Code', 'then implement', 'green', 'FileCode', at(5.1, 0), { size: 0.72 }),
        ],
        links: [link('req', 'classd', undefined, { route: 'straight' }), link('classd', 'seqd', undefined, { route: 'straight' }), link('seqd', 'impl', undefined, { route: 'straight' })],
        flows: [{ path: ['req', 'classd', 'seqd', 'impl'], tone: 'request', label: 'left to right', duration: 3.2 }],
        panel: {
          title: 'Mermaid, as plain text',
          icon: 'Code',
          code: 'classDiagram\n  PaymentGateway <|.. StripeGateway\n  PaymentGateway <|.. FakeGateway\n  Checkout --> PaymentGateway\n  Checkout ..> Receipt',
        },
        caption: 'Boxes first, then one story at a time',
      },
      code: {
        language: 'yaml',
        title: 'Mermaid sequence source (plain text, highlighted as yaml)',
        source: `sequenceDiagram
  participant App
  participant C as Checkout
  participant G as StripeGateway
  App->>C: pay(order)
  C->>G: charge(amount, token)
  G-->>C: txn_id
  C-->>App: Receipt`,
        highlight: [5, 6, 7, 8],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: lifelines, messages and consistency',
      eli5: 'The comic strip shows each toy in its own column and the speech balloons going down the page in order. Every balloon must match a button that exists on the blueprint sheet.',
      body: [
        'A **sequence diagram** shows participants, lifelines and messages in time order: calls, returns, async sends, creates, self calls and alt, opt and loop frames. One diagram covers one scenario.',
        'Every message is a method on the receiver, and the sender needs a link to it on the class diagram. Draw class boxes first, then one sequence per key scenario, and keep both as text beside the code.',
      ],
      keyIdea: 'Class diagram for structure, one sequence per scenario, and every arrow backed by a method in the code.',
      metrics: { classes: '4', links: '3', msgs: '6', view: 'both' },
      scene: {
        nodes: [{ ...checkout, status: 'ok' }, { ...gateway, status: 'ok' }, { ...stripe, status: 'ok' }, { ...fake, status: 'ok' }],
        links: [link('checkout', 'gateway', 'has-a'), link('stripe', 'gateway', 'implements', { style: 'dashed' }), link('fake', 'gateway', 'implements', { style: 'dashed' })],
        flows: [
          { path: ['checkout', 'gateway'], tone: 'request', label: 'charge()', duration: 1.3 },
          { path: ['gateway', 'checkout'], tone: 'response', label: 'txn_id', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Checklist',
          icon: 'List',
          rows: [
            { text: 'Lifelines, time down the page', value: 'participants' },
            { text: 'Solid call, dashed return, open async', value: 'messages' },
            { text: 'alt, opt, loop', value: 'frames' },
            { text: 'Message equals a method', value: 'consistency', tone: 'good' },
          ],
          footer: { text: 'The code has the last word', tone: 'muted' },
        },
        caption: 'Structure and behavior of one small design',
      },
      quiz: {
        question: 'In a sequence diagram, the message `charge(amount, token)` goes from `:Checkout` to `:StripeGateway`, but no class in the class diagram has a `charge` method. What should you do?',
        options: [
          'Nothing, sequence diagrams are free to invent methods',
          'Fix whichever diagram disagrees with the code, since every message must be a method on the receiver',
          'Remove the message and keep the class diagram',
          'Change the arrow to a dashed line',
        ],
        answer: 1,
        explain: 'Each message needs a matching method on the receiver, and the code decides which diagram is wrong. Arrow style does not change that.',
      },
    },
  ],
};
