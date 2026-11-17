import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const reader: SceneNode = { id: 'reader', kind: 'user', at: at(-4, -2.2), label: 'new teammate', sub: 'day one' };
const proc: SceneNode = { id: 'proc', kind: 'block', at: at(0, 2.2), label: 'process()', sub: '212 lines', icon: 'Braces', tint: 'gray' };
const clean: SceneNode = { id: 'clean', kind: 'block', at: at(0, 2.2), label: 'total_with_tax()', sub: '6 lines', icon: 'Braces', tint: 'green' };
const review: SceneNode = { id: 'review', kind: 'block', at: at(4, -2.2), label: 'code review', sub: 'a second pair of eyes', icon: 'Search', tint: 'violet' };

export const lldCleanCode: Lesson = {
  id: 'lld-clean-code',
  title: 'Clean code basics',
  tagline: 'Names, small functions, flat logic and consistency: the habits that make code easy to read, change and review.',
  minutes: 15,
  level: 'Beginner',
  learn: [
    'Names that show intent, and the naming mistakes that mislead readers',
    'Small functions with one job, few parameters and guard clauses',
    'Constants, comments, side effects and errors handled in plain view',
    'KISS, DRY and consistency: one way to do each thing, written once',
    'Class smells, review red flags and how to comment on a pull request',
  ],
  metrics: [
    { key: 'lines', label: 'Longest function', icon: 'Code' },
    { key: 'depth', label: 'Nesting depth', icon: 'Layers' },
    { key: 'params', label: 'Parameters', icon: 'List' },
    { key: 'flags', label: 'Review flags', icon: 'Bug' },
  ],
  steps: [
    {
      title: 'Unreadable',
      tag: 'problem',
      heading: 'It works, and nobody dares touch it',
      eli5: 'A kitchen has jars marked "x", "tmp2" and "stuff". The soup tastes fine, but a new cook has to open every jar to find the salt, and nobody wants to cook there.',
      body: [
        'A teammate joins and opens `process()`. It is 212 lines long, nests six levels deep, takes nine parameters and names its variables `d`, `f` and `t`. The code runs in production and nobody can say why.',
        'Every change takes a day of reading first. Fear grows, tests get skipped and the function grows by one more `if`.',
      ],
      keyIdea: 'Code is read far more often than it is written. Unreadable code makes every future change slower and riskier.',
      metrics: { lines: '212', depth: '6', params: '9', flags: '11' },
      metricTones: { lines: 'bad', depth: 'bad', params: 'bad', flags: 'bad' },
      scene: {
        nodes: [reader, { ...proc, status: 'hot', chips: [{ text: 'd, f, t=0', tone: 'warn' }, { text: '6 levels deep', tone: 'bad' }] }],
        links: [link('reader', 'proc', { label: 'tries to read', labelTone: 'warn' })],
        flows: [
          { path: ['reader', 'proc'], tone: 'request', label: 'what is d?', duration: 1.4 },
          { path: ['proc', 'reader'], tone: 'error', label: '???', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'A real excerpt',
          icon: 'FileCode',
          code: 'def proc(d, f, t=0):\n    if f:\n        for x in d:\n            if x[2] > 86400:\n                t += x[1] * 0.08\n    return t',
          footer: { text: 'It runs. Nobody can say what it means.', tone: 'bad' },
        },
        caption: 'Working code that cannot be read',
      },
    },
    {
      title: 'Intent names',
      tag: 'concept',
      heading: 'A name should answer why this thing exists',
      eli5: 'A jar labeled "x" tells you nothing. A jar labeled "salt" tells the cook what is inside before anyone opens the lid.',
      body: [
        'A good **name** says what a thing is or does in the domain, so the reader needs no comment. `d` could be days, dollars or a dict. `elapsed_days` can only be one of them.',
        'Ask a name three questions: why does it exist, what does it do, how is it used. If a comment has to explain a variable, rename the variable instead.',
      ],
      keyIdea: 'Choose names that reveal intent. A rename costs seconds and saves every later reader a guess.',
      metrics: { lines: '212', depth: '6', params: '9', flags: '10' },
      scene: {
        nodes: [
          { id: 'old', kind: 'block', at: at(-4, -2.2), label: 'd', sub: 'unclear', icon: 'Hash', tint: 'gray', status: 'hot' },
          { id: 'new', kind: 'block', at: at(0, 0.5), label: 'elapsed_days', sub: 'intent is in the name', icon: 'Clock', tint: 'green', status: 'ok' },
          { ...reader, at: at(4, -2.2) },
        ],
        links: [link('old', 'new', { label: 'rename' }), link('new', 'reader', { label: 'reads it' })],
        flows: [{ path: ['old', 'new', 'reader'], tone: 'response', label: 'elapsed_days', duration: 2.2 }],
        panel: {
          title: 'Same line, two names',
          icon: 'Code',
          code: 'if d > 30:            # d?\n    fee += 5\n\nif elapsed_days > GRACE_DAYS:\n    fee += LATE_FEE',
          footer: { text: 'The second version needs no comment', tone: 'good' },
        },
        caption: 'The name carries the meaning',
      },
    },
    {
      title: 'Naming rules',
      tag: 'concept',
      heading: 'Nouns for things, verbs for actions, questions for booleans',
      eli5: 'Jars get noun labels like "sugar". Recipe cards get action labels like "whisk the eggs". A yes or no tag reads like a question: "is the oven hot?".',
      body: [
        'Classes and variables are **nouns**: `Invoice`, `retry_count`. Functions are **verbs**: `send_receipt`, `parse_date`. Booleans read as questions: `is_paid`, `has_stock`, `can_retry`.',
        'Skip abbreviations and type prefixes, and avoid `Manager`, `Helper` and `Utils`, which mean the class has no single purpose. Longer scope earns a longer name: `i` in a three-line loop is fine.',
      ],
      keyIdea: 'Nouns name things, verbs name actions, booleans ask questions, and the name length follows the scope.',
      metrics: { lines: '212', depth: '6', params: '9', flags: '9' },
      scene: {
        nodes: [
          { id: 'cls', kind: 'block', at: at(-4, -2.2), label: 'Invoice', sub: 'noun', icon: 'Receipt', tint: 'green' },
          { id: 'fn', kind: 'block', at: at(0, 0.5), label: 'send_receipt()', sub: 'verb', icon: 'Mail', tint: 'green' },
          { id: 'flag', kind: 'block', at: at(4, -2.2), label: 'is_paid', sub: 'a question', icon: 'Scale', tint: 'green' },
        ],
        links: [link('cls', 'fn', { label: 'has' }), link('fn', 'flag', { label: 'checks' })],
        flows: [{ path: ['cls', 'fn', 'flag'], tone: 'request', label: 'send_receipt()', duration: 2.2 }],
        panel: {
          title: 'Naming cheat sheet',
          icon: 'List',
          rows: [
            { text: 'Class or variable', value: 'noun: Invoice' },
            { text: 'Function', value: 'verb: send_receipt' },
            { text: 'Boolean', value: 'is_paid, has_stock' },
            { text: 'Avoid', value: 'Manager, Utils, tmp2', tone: 'bad' },
          ],
          footer: { text: 'Scope sets length: i in a loop, full words in a module', tone: 'muted' },
        },
        caption: 'Three shapes cover most names',
      },
    },
    {
      title: 'Names that lie',
      tag: 'case',
      heading: 'Case: names that mislead are worse than short ones',
      eli5: 'A jar labeled "sugar" that holds salt is worse than an unlabeled jar. The cook trusts the label and ruins the cake.',
      body: [
        'A name can lie. `user_list` that holds a dict, `get_user()` that also creates one, `data2` next to `data` with no hint how they differ. Readers trust names, so the bug hides.',
        'Noise words add nothing: `UserInfo` versus `UserData` versus `User`. Pick one word per concept and make the difference between two names visible.',
      ],
      keyIdea: 'A misleading name is a bug waiting for a reader. If a name needs a footnote, change it.',
      metrics: { lines: '212', depth: '6', params: '9', flags: '8' },
      scene: {
        nodes: [
          { id: 'lie1', kind: 'block', at: at(-4, -2.2), label: 'user_list', sub: 'actually a dict', icon: 'List', tint: 'red', status: 'hot' },
          { id: 'lie2', kind: 'block', at: at(0, 0.5), label: 'get_user()', sub: 'also creates one', icon: 'User', tint: 'red', status: 'hot' },
          { id: 'fix', kind: 'block', at: at(4, -2.2), label: 'users_by_id', sub: 'says what it is', icon: 'Users', tint: 'green', status: 'ok' },
        ],
        links: [link('lie1', 'lie2', { label: 'used by' }), link('lie2', 'fix', { label: 'rename to' })],
        flows: [{ path: ['lie1', 'lie2', 'fix'], tone: 'error', label: 'misread', duration: 2.2 }],
        panel: {
          title: 'Name versus behavior',
          icon: 'Search',
          rows: [
            { text: 'user_list', value: 'is a dict', tone: 'bad' },
            { text: 'get_user()', value: 'also writes', tone: 'bad' },
            { text: 'data and data2', value: 'no difference shown', tone: 'warn' },
            { text: 'users_by_id', value: 'matches', tone: 'good' },
          ],
          footer: { text: 'One word per concept, everywhere', tone: 'muted' },
        },
        caption: 'The label and the contents disagree',
      },
    },
    {
      title: 'One job',
      tag: 'concept',
      heading: 'A function does one thing, at one level of detail',
      eli5: 'A recipe card says "whisk the eggs", not "shop, cook, plate and wash up". Short cards are easy to follow, swap or reuse in a different dish.',
      body: [
        'A **small function** has one job you can name in a sentence, with no "and" in it. It also stays at one level of detail: `place_order()` calls `validate()` and `charge()`, it does not parse strings inline.',
        'The book gives a rule of thumb: a method past about 50 lines is doing too much. Shorter is usually better, because a good name replaces a paragraph of code.',
      ],
      keyIdea: 'One job per function, named by that job. Past about 50 lines, look for the seam to split on.',
      metrics: { lines: '212', depth: '6', params: '9', flags: '7' },
      scene: {
        nodes: [
          { id: 'place', kind: 'block', at: at(-4, 0), label: 'place_order()', sub: 'the story', icon: 'Workflow', tint: 'green', status: 'active' },
          { id: 'validate', kind: 'block', at: at(0, -3.2), label: 'validate()', sub: 'one job', icon: 'Shield', tint: 'green' },
          { id: 'charge', kind: 'block', at: at(0, 3.2), label: 'charge()', sub: 'one job', icon: 'Receipt', tint: 'green' },
          { id: 'notify', kind: 'block', at: at(4, 0), label: 'notify()', sub: 'one job', icon: 'Mail', tint: 'green' },
        ],
        links: [link('place', 'validate', { label: 'calls' }), link('place', 'charge', { label: 'calls' }), link('place', 'notify', { label: 'calls' })],
        flows: [
          { path: ['place', 'validate'], tone: 'request', label: 'validate(order)', duration: 1.2 },
          { path: ['place', 'charge'], tone: 'request', label: 'charge(order)', duration: 1.2, delay: 1.3 },
          { path: ['place', 'notify'], tone: 'request', label: 'notify(order)', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Reads like the steps',
          icon: 'Code',
          code: 'def place_order(order):\n    validate(order)\n    charge(order)\n    notify(order)',
          footer: { text: 'The caller reads as a list of steps', tone: 'good' },
        },
        caption: 'A function that tells the story',
      },
    },
    {
      title: 'Extract it',
      tag: 'case',
      heading: 'Case: pulling a block out into a named function',
      eli5: 'The big card says "make dinner" and hides ten tiny steps. You pull the "check the oven" part onto its own small card and give it a clear name.',
      body: [
        'The 212-line `process()` has a validation block in the middle. Move that block to `validate_order()`, with the same behavior, and call it. That takes about 60 lines out, and tests still pass.',
        'Each extraction replaces a comment with a name. The long function shrinks to a readable outline, and the new piece can be tested alone.',
      ],
      keyIdea: 'Extract a block, name it for what it does, keep behavior identical. The outline becomes the documentation.',
      metrics: { lines: '150', depth: '5', params: '9', flags: '6' },
      metricTones: { lines: 'warn' },
      scene: {
        nodes: [
          { ...proc, at: at(-4, -2.2), label: 'process()', sub: '150 lines left', status: 'active' },
          { id: 'validate', kind: 'block', at: at(0, 2.2), label: 'validate_order()', sub: 'extracted', icon: 'Shield', tint: 'green', status: 'ok' },
          { id: 'tests', kind: 'block', at: at(4, -2.2), label: 'tests', sub: 'still green', icon: 'Bug', tint: 'gray' },
        ],
        links: [link('proc', 'validate', { label: 'extract' }), link('validate', 'tests', { label: 'tested alone' })],
        flows: [
          { path: ['proc', 'validate'], tone: 'request', label: 'validate_order(order)', duration: 1.6 },
          { path: ['validate', 'tests'], tone: 'response', label: 'pass', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'After the extraction',
          icon: 'FileCode',
          code: 'def process(order):\n    validate_order(order)\n    total = price(order)\n    charge(order, total)\n    return receipt(order)',
          footer: { text: 'Behavior unchanged, outline readable', tone: 'good' },
        },
        caption: 'Same behavior, clearer shape',
      },
      code: {
        language: 'python',
        title: 'Before and after an extraction',
        source: `# before: the check is buried inside the flow
def process(order):
    if not order.items:
        raise ValueError("order is empty")
    if order.total_cents <= 0:
        raise ValueError("total must be positive")
    charge(order)

# after: the check has a name and can be tested alone
def validate_order(order):
    if not order.items:
        raise ValueError("order is empty")
    if order.total_cents <= 0:
        raise ValueError("total must be positive")

def process(order):
    validate_order(order)
    charge(order)`,
        highlight: [9, 16, 17],
      },
    },
    {
      title: 'Few parameters',
      tag: 'concept',
      heading: 'More than five parameters means an object is missing',
      eli5: 'Handing the cook nine separate ingredients at the door is a mess. Put them in one labeled basket and the cook takes a single thing.',
      body: [
        'Each parameter is something every caller must know and order correctly. `process(1, c, None, True, False, 0.08, "", "EU", 3)` cannot be read and is easy to get wrong.',
        'Past about five, group the related values into a **request object** with named fields. `process()` goes from nine parameters to one, and a new field no longer touches every call site.',
      ],
      keyIdea: 'Long parameter lists hide a concept. Give the group a name and pass it as one object.',
      metrics: { lines: '150', depth: '5', params: '1', flags: '5' },
      metricTones: { params: 'good' },
      scene: {
        nodes: [
          { id: 'many', kind: 'block', at: at(-4, -2.2), label: 'process()', sub: '9 parameters', icon: 'List', tint: 'red', status: 'hot' },
          { id: 'req', kind: 'block', at: at(0, 0.5), label: 'ProcessRequest', sub: '9 named fields', icon: 'Package', tint: 'green', status: 'ok' },
          { id: 'one', kind: 'block', at: at(4, -2.2), label: 'process()', sub: '1 parameter', icon: 'User', tint: 'green' },
        ],
        links: [link('many', 'req', { label: 'group into' }), link('req', 'one', { label: 'passed to' })],
        flows: [{ path: ['many', 'req', 'one'], tone: 'request', label: 'NewUserRequest', duration: 2.2 }],
        panel: {
          title: 'The call, before and after',
          icon: 'Code',
          code: 'process(1, c, None, True, False,\n        0.08, "", "EU", 3)\n\nprocess(ProcessRequest(\n    order_id=1, customer=c, coupon=None,\n    express=True, gift=False, tax_rate=0.08,\n    note="", region="EU", retries=3))',
          footer: { text: 'Named fields replace positional guesses', tone: 'good' },
        },
        caption: 'Nine values become one object',
      },
    },
    {
      title: 'Guard clauses',
      tag: 'concept',
      heading: 'Handle the bad cases first and return early',
      eli5: 'A cook checks at the door: no apron, no entry. The kitchen inside stays calm because the bad cases were turned away before anything started.',
      body: [
        'A **guard clause** checks a failing case at the top and returns or raises at once. The main path then runs flat, without an `else` carrying the whole function.',
        'Nesting past three levels is the warning sign. Each level makes the reader hold one more condition in their head.',
      ],
      keyIdea: 'Reject bad input at the top with an early return. The happy path then reads straight down.',
      metrics: { lines: '150', depth: '5', params: '1', flags: '5' },
      scene: {
        nodes: [
          { id: 'input', kind: 'block', at: at(-4, -2.2), label: 'order', sub: 'incoming', icon: 'Package', tint: 'gray' },
          { id: 'guard', kind: 'block', at: at(0, 0.5), label: 'guards', sub: 'reject early', icon: 'Shield', tint: 'amber', status: 'active' },
          { id: 'happy', kind: 'block', at: at(4, -2.2), label: 'happy path', sub: 'flat, no else', icon: 'Route', tint: 'green' },
        ],
        links: [link('input', 'guard'), link('guard', 'happy', { label: 'only good cases' })],
        flows: [
          { path: ['input', 'guard'], tone: 'request', label: 'order', duration: 1.2 },
          { path: ['guard', 'input'], tone: 'error', label: 'raise early', duration: 1.2, delay: 1.3 },
          { path: ['guard', 'happy'], tone: 'response', label: 'valid', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Guards on top',
          icon: 'Code',
          code: 'def ship(order):\n    if order is None:\n        raise ValueError("no order")\n    if not order.paid:\n        raise PaymentRequired()\n    return dispatch(order)',
          footer: { text: 'Nesting depth 1 instead of 3', tone: 'good' },
        },
        caption: 'Bad cases leave at the door',
      },
      quiz: {
        question: 'A function takes eight parameters and has an if inside an if inside an if. Which fix addresses both smells?',
        options: [
          'Add a comment above each branch',
          'Group parameters into a request object and use guard clauses to flatten the nesting',
          'Rename every parameter to a single letter',
          'Split the file into two files without changing the function',
        ],
        answer: 1,
        explain: 'A request object removes the long parameter list, and guard clauses return early on the bad cases so the main path is flat. Comments and shorter names hide the problem without fixing it.',
      },
    },
    {
      title: 'Flatten it',
      tag: 'case',
      heading: 'Case: from four levels of if to a flat function',
      eli5: 'A recipe says "if the oven is on, then if the tray is in, then if the timer is set, then bake". Rewrite it: stop if any of those is missing, then bake.',
      body: [
        'The refund path of `process()` nests four conditions before it does any work. The real action sits at the bottom of the indentation, far from the checks that gate it. Failing any rule raises the same `ValueError` in both versions.',
        'Invert each condition into a guard. The same rules now read as a list of reasons to stop, each with its own message, and the work comes last at the left margin.',
      ],
      keyIdea: 'Invert each nested condition into an early exit. The rules and the failure type stay the same and the depth drops to one.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '4' },
      metricTones: { depth: 'good' },
      scene: {
        nodes: [
          { id: 'deep', kind: 'block', at: at(-4, -2.2), label: 'process() v1', sub: '4 levels deep', icon: 'Layers', tint: 'red', status: 'hot' },
          { id: 'flat', kind: 'block', at: at(0, 2.2), label: 'process() v2', sub: '1 level', icon: 'Layers', tint: 'green', status: 'ok' },
          { id: 'rules', kind: 'block', at: at(4, -2.2), label: 'same rules', sub: 'same error type', icon: 'Scale', tint: 'gray' },
        ],
        links: [link('deep', 'flat', { label: 'invert conditions' }), link('flat', 'rules', { label: 'keeps' })],
        flows: [{ path: ['deep', 'flat', 'rules'], tone: 'response', label: 'refactor', duration: 2.2 }],
        panel: {
          title: 'Nesting depth',
          icon: 'Gauge',
          rows: [
            { text: 'process() v1', value: '4 levels', tone: 'bad' },
            { text: 'process() v2', value: '1 level', tone: 'good' },
            { text: 'Rules and error type', value: 'same' },
          ],
          footer: { text: 'The work is at the left margin', tone: 'good' },
        },
        caption: 'Same rules, flatter shape',
      },
      code: {
        language: 'python',
        title: 'Nested conditions to guard clauses',
        source: `# before: the work is buried four levels deep
def process(order, amount):
    if order.paid:
        if not order.refunded:
            if amount <= order.total_cents:
                if order.within_window():
                    return gateway.refund(order.id, amount)
    raise ValueError("refund not allowed")

# after: each rule is a reason to stop
def process(order, amount):
    if not order.paid:
        raise ValueError("order is not paid")
    if order.refunded:
        raise ValueError("already refunded")
    if amount > order.total_cents:
        raise ValueError("amount too large")
    if not order.within_window():
        raise ValueError("refund window closed")
    return gateway.refund(order.id, amount)`,
        highlight: [13, 15, 17, 19, 20],
      },
    },
    {
      title: 'Magic values',
      tag: 'concept',
      heading: 'Give every number and string a name',
      eli5: 'A card that says "add 86400 of it" means nothing. A card that says "add one day of it" makes sense, and changing it later means fixing one jar label.',
      body: [
        'A bare `86400` or `0.08` in the middle of logic is a **magic number**. The reader must guess what it means, and a change means hunting every copy. Name it: `SECONDS_PER_DAY`, `TAX_RATE`.',
        'Values that differ per environment, such as a URL, timeout or limit, belong in configuration. A hardcoded timeout is a bug waiting for the first slow day.',
      ],
      keyIdea: 'Name constants, and move values that vary by environment into config. One fact lives in one place.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '3' },
      scene: {
        nodes: [
          { id: 'logic', kind: 'block', at: at(-4, -2.2), label: 'pricing logic', sub: 'reads names', icon: 'Braces', tint: 'green' },
          { id: 'const', kind: 'block', at: at(0, 0.5), label: 'TAX_RATE', sub: 'one named value', icon: 'Hash', tint: 'green', status: 'ok' },
          { id: 'cfg', kind: 'block', at: at(4, -2.2), label: 'config', sub: 'per environment', icon: 'Key', tint: 'blue' },
        ],
        links: [link('logic', 'const', { label: 'uses' }), link('cfg', 'const', { label: 'can set' })],
        flows: [{ path: ['logic', 'const', 'logic'], tone: 'request', label: 'TAX_RATE', duration: 2 }],
        panel: {
          title: 'Magic versus named',
          icon: 'Code',
          code: 'total += x[1] * 0.08\nif age > 86400:\n\nTAX_RATE = 0.08\nSECONDS_PER_DAY = 86_400\nif age > SECONDS_PER_DAY:',
          footer: { text: 'Hardcoded URLs and timeouts go in config', tone: 'muted' },
        },
        caption: 'Names beat bare numbers',
      },
    },
    {
      title: 'Comments',
      tag: 'concept',
      heading: 'Comments explain why, the code explains what',
      eli5: 'The recipe card says "whisk". A sticky note on it says "whisk slowly, the old bowl cracks". The note holds the reason that the card cannot show.',
      body: [
        'A comment that repeats the code (`i += 1  # add one`) is noise, and it drifts out of date. Write the code so the **what** is obvious, then use a comment for the **why**: a business rule, a workaround, a trap.',
        'A `TODO` needs a ticket link, or it goes dark and nobody owns it. Commented-out code goes too: version control remembers it.',
      ],
      keyIdea: 'Let names say what the code does. Spend comments on why, and delete the stale ones.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '3' },
      scene: {
        nodes: [
          { id: 'what', kind: 'block', at: at(-4, -2.2), label: 'what', sub: 'the code says it', icon: 'Code', tint: 'green' },
          { id: 'why', kind: 'block', at: at(0, 0.5), label: 'why', sub: 'a comment says it', icon: 'FileText', tint: 'violet', status: 'active' },
          { id: 'stale', kind: 'block', at: at(4, -2.2), label: 'stale note', sub: 'delete it', icon: 'Bug', tint: 'red', status: 'dim' },
        ],
        links: [link('what', 'why', { label: 'leaves room for' }), link('why', 'stale', { label: 'avoid' })],
        flows: [{ path: ['what', 'why'], tone: 'response', label: 'explain the why', duration: 1.8 }],
        panel: {
          title: 'Useful and useless',
          icon: 'FileText',
          rows: [
            { text: 'i += 1  # add one', value: 'noise', tone: 'bad' },
            { text: '# gateway rounds up, keep cents', value: 'why', tone: 'good' },
            { text: '# TODO fix later', value: 'no owner', tone: 'bad' },
            { text: '# TODO(PAY-412): remove', value: 'tracked', tone: 'good' },
          ],
          footer: { text: 'Old code lives in version control', tone: 'muted' },
        },
        caption: 'A comment earns its place',
      },
    },
    {
      title: 'No surprises',
      tag: 'concept',
      heading: 'A function should not change what you pass in',
      eli5: 'You hand the cook your plate and ask how many peas are on it. A cook who eats half the peas while counting is a surprise nobody asked for.',
      body: [
        'A function that quietly **mutates its arguments** surprises the caller. `normalize(order)` that edits `order` in place changes data that other code still holds.',
        'Return a new value instead. If a function must write somewhere, say so in its name: `save_order` and `mark_shipped` announce a side effect, `total` and `is_valid` do not.',
      ],
      keyIdea: 'Return new values rather than editing inputs, and let the name warn about any side effect.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '2' },
      scene: {
        nodes: [
          { id: 'order', kind: 'block', at: at(-4, -2.2), label: 'order', sub: 'shared object', icon: 'Package', tint: 'green' },
          { id: 'normalize', kind: 'block', at: at(0, 0.5), label: 'normalize()', sub: 'returns a copy', icon: 'Copy', tint: 'green', status: 'ok' },
          { id: 'other', kind: 'block', at: at(4, -2.2), label: 'other code', sub: 'still holds order', icon: 'FileCode', tint: 'gray' },
        ],
        links: [link('order', 'normalize', { label: 'passed in' }), link('normalize', 'other', { label: 'new copy back' })],
        flows: [
          { path: ['order', 'normalize'], tone: 'request', label: 'normalize(order)', duration: 1.4 },
          { path: ['normalize', 'other'], tone: 'response', label: 'new Order', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Mutate versus return',
          icon: 'Code',
          code: 'def normalize(order):\n    order.email = order.email.lower()\n\ndef normalized(order):\n    return replace(order,\n        email=order.email.lower())',
          footer: { text: 'The original order is untouched', tone: 'good' },
        },
        caption: 'No hidden edits to your data',
      },
    },
    {
      title: 'Errors',
      tag: 'concept',
      heading: 'Fail loudly with a narrow exception',
      eli5: 'If the oven breaks, say "the oven broke" out loud. A cook who hides it and serves a raw dish makes everything worse later.',
      body: [
        'A bare `except Exception:` that logs and carries on swallows real bugs. Catch the specific error you can handle, such as `TimeoutError`, and let the rest rise.',
        'If you catch only to re-raise, let it pass. Return values like `None` or `-1` as errors push the check onto every caller, who will forget it once.',
      ],
      keyIdea: 'Catch the narrowest error you can handle, never hide failures, and raise rather than return a magic value.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '2' },
      scene: {
        nodes: [
          { id: 'call', kind: 'block', at: at(-4, -2.2), label: 'fetch_price()', sub: 'calls a service', icon: 'Braces', tint: 'green' },
          { id: 'ext', kind: 'block', at: at(0, 2.2), label: 'pricing API', sub: 'external', icon: 'Globe', tint: 'gray', status: 'down' },
          { id: 'handler', kind: 'block', at: at(4, -2.2), label: 'TimeoutError', sub: 'caught on purpose', icon: 'Shield', tint: 'amber', status: 'active' },
        ],
        links: [link('call', 'ext', { label: 'uses' }), link('ext', 'handler', { label: 'raises', labelTone: 'warn' })],
        flows: [
          { path: ['call', 'ext'], tone: 'request', label: 'get_price()', duration: 1.4 },
          { path: ['ext', 'handler'], tone: 'error', label: 'TimeoutError', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Too broad, then narrow',
          icon: 'Code',
          code: 'try:\n    return fetch(sku)\nexcept Exception:\n    return None\n\nexcept TimeoutError:\n    return cached_price(sku)',
          footer: { text: 'Handle what you know, raise the rest', tone: 'good' },
        },
        caption: 'Catch the one error you can fix',
      },
    },
    {
      title: 'Keep it simple',
      tag: 'concept',
      heading: 'KISS: the simplest thing that works usually wins',
      eli5: 'A cook who builds a gadget to crack one egg is clever, but the next cook cannot use it. A cook who cracks it on the bowl edge is understood by everyone.',
      body: [
        '**KISS** means picking the plainest design that does the job. A one-line trick with bit shifts and type checks looks smart and costs every later reader a minute.',
        'Build for today. A formatter registry with plugins for one report type is a bet on a future that may not come. Add the second case when it arrives.',
      ],
      keyIdea: 'Clever code is paid for by every reader. Prefer the plain version until a real second case shows up.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '2' },
      scene: {
        nodes: [
          { id: 'clever', kind: 'block', at: at(-4, -2.2), label: 'clever', sub: 'bit tricks, plugins', icon: 'Zap', tint: 'red', status: 'hot' },
          { id: 'plain', kind: 'block', at: at(0, 2.2), label: 'plain', sub: 'n % 2 == 0', icon: 'Code', tint: 'green', status: 'ok' },
          { id: 'next', kind: 'block', at: at(4, -2.2), label: 'next reader', sub: 'understands it', icon: 'Users', tint: 'blue' },
        ],
        links: [link('clever', 'plain', { label: 'simplify' }), link('plain', 'next', { label: 'read in seconds' })],
        flows: [{ path: ['clever', 'plain', 'next'], tone: 'response', label: 'plain code', duration: 2.2 }],
        panel: {
          title: 'Two versions of is_even',
          icon: 'Code',
          code: 'def is_even(n):\n    return not bool(n & 1) if isinstance(n, int) else None\n\ndef is_even(n: int) -> bool:\n    return n % 2 == 0',
          footer: { text: 'Same answer, one is obvious', tone: 'good' },
        },
        caption: 'Clever costs every reader',
      },
    },
    {
      title: 'Do not repeat',
      tag: 'concept',
      heading: 'DRY: write each piece of logic once',
      eli5: 'Three cooks each copy the same sauce recipe onto their own card. When the recipe is fixed, two cards still say the old thing. One shared card means one fix.',
      body: [
        '**DRY** means one piece of knowledge lives in one place. Copied logic means a bug fixed in one copy and missed in the other two. Once a block shows up about three times, extract a helper and call it.',
        'Wait for the third copy, because two look-alikes may differ for a reason. Do not merge code that only looks alike but changes for different reasons. A wrong shared helper costs more than a little repetition.',
      ],
      keyIdea: 'Extract a shared helper when the same logic appears about three times. Leave code that only looks alike apart.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '2' },
      scene: {
        nodes: [
          { id: 'copies', kind: 'block', at: at(-4, -2.2), label: 'pasted 3 times', sub: 'fix one, miss two', icon: 'Copy', tint: 'red', status: 'hot' },
          { id: 'helper', kind: 'block', at: at(0, 2.2), label: 'format_price()', sub: 'written once', icon: 'Code', tint: 'green', status: 'ok' },
          { id: 'callers', kind: 'block', at: at(4, -2.2), label: 'three callers', sub: 'one-line calls', icon: 'Users', tint: 'blue' },
        ],
        links: [link('copies', 'helper', { label: 'extract' }), link('helper', 'callers', { label: 'called by' })],
        flows: [{ path: ['copies', 'helper', 'callers'], tone: 'response', label: 'one helper', duration: 2.2 }],
        panel: {
          title: 'Copied versus shared',
          icon: 'Code',
          code: '# three copies\nprice = f"${cents / 100:.2f}"\n\n# one helper\ndef format_price(cents):\n    return f"${cents / 100:.2f}"',
          footer: { text: 'Only merge code that changes for the same reason', tone: 'muted' },
        },
        caption: 'A fix lands in one place',
      },
    },
    {
      title: 'Consistency',
      tag: 'concept',
      heading: 'Do the same thing the same way everywhere',
      eli5: 'If every cook labels jars a different way, nobody finds anything. One labeling rule for the whole kitchen lets any cook walk in and work.',
      body: [
        '**Consistency** means one name per concept (`fetch` everywhere, not `get`, `load` and `retrieve`), one style for formatting, one pattern for each recurring job.',
        'When the code looks the same everywhere, a reader learns the shape once. Formatters and linters enforce the cheap parts so reviews can focus on design.',
      ],
      keyIdea: 'One word per concept and one way per job. A predictable codebase is cheap to read.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '2' },
      scene: {
        nodes: [
          { id: 'mixed', kind: 'block', at: at(-4, -2.2), label: 'get, load, retrieve', sub: 'same idea, 3 words', icon: 'Split', tint: 'red', status: 'hot' },
          { id: 'rule', kind: 'block', at: at(0, 0.5), label: 'style guide', sub: 'one word: fetch', icon: 'List', tint: 'violet', status: 'active' },
          { id: 'lint', kind: 'block', at: at(4, -2.2), label: 'linter', sub: 'checks it for you', icon: 'Search', tint: 'gray' },
        ],
        links: [link('mixed', 'rule', { label: 'agree on' }), link('rule', 'lint', { label: 'enforced by' })],
        flows: [{ path: ['mixed', 'rule', 'lint'], tone: 'handshake', label: 'one rule', duration: 2.2 }],
        panel: {
          title: 'Pick one',
          icon: 'List',
          rows: [
            { text: 'get_user, load_order, retrieve_item', value: 'mixed', tone: 'bad' },
            { text: 'fetch_user, fetch_order, fetch_item', value: 'one word', tone: 'good' },
            { text: 'Formatting and imports', value: 'tool decides' },
          ],
          footer: { text: 'Let tools settle the style debates', tone: 'muted' },
        },
        caption: 'One convention for the whole codebase',
      },
    },
    {
      title: 'Three retries',
      tag: 'case',
      heading: 'Case: three services, three different retry loops',
      eli5: 'Three kitchens each boil an egg a different way, and one never stops boiling. Write one shared card for "boil an egg" and every kitchen follows it.',
      body: [
        'Service A sleeps one second and tries three times. Service B nests two `try` blocks. Service C loops forever and once masked a six-hour outage. Each was written alone and each is wrong in its own way.',
        'Pull the logic into one shared `with_retry` decorator with backoff and jitter. A fix in one place now reaches every service, and callers read as one line.',
      ],
      keyIdea: 'When the same job is written many ways, replace them with one shared tool. Consistency also fixes bugs once.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '1' },
      metricTones: { flags: 'good' },
      scene: {
        nodes: [
          { id: 'a', kind: 'block', at: at(-4, -2.2), label: 'Service A', sub: 'uses with_retry', icon: 'Server', tint: 'green' },
          { id: 'retry', kind: 'block', at: at(0, -2), label: 'with_retry', sub: 'backoff + jitter', icon: 'Repeat', tint: 'violet', status: 'active' },
          { id: 'b', kind: 'block', at: at(4, -2.2), label: 'Service B', sub: 'uses with_retry', icon: 'Server', tint: 'green' },
          { id: 'c', kind: 'block', at: at(0, 4.4), label: 'Service C', sub: 'uses with_retry', icon: 'Server', tint: 'green' },
        ],
        links: [link('a', 'retry', { label: 'decorated by' }), link('b', 'retry', { label: 'decorated by' }), link('c', 'retry', { label: 'decorated by' })],
        flows: [
          { path: ['a', 'retry'], tone: 'request', label: 'call()', duration: 1.2 },
          { path: ['b', 'retry'], tone: 'request', label: 'call()', duration: 1.2, delay: 0.5 },
          { path: ['c', 'retry'], tone: 'request', label: 'call()', duration: 1.2, delay: 1.0 },
        ],
        panel: {
          title: 'One policy, three callers',
          icon: 'Repeat',
          rows: [
            { text: 'Attempts', value: '3, then raise' },
            { text: 'Wait', value: '0.5 s doubling + jitter' },
            { text: 'Retries on', value: 'TransientError only' },
            { text: 'Infinite loops', value: 'none', tone: 'good' },
          ],
          footer: { text: 'Change the policy once, all services follow', tone: 'good' },
        },
        caption: 'One shared retry for every service',
      },
      code: {
        language: 'python',
        title: 'A shared retry decorator',
        source: `import functools, random, time

def with_retry(attempts=3, backoff=0.5, jitter=0.2, on=(TransientError,)):
    def deco(fn):
        @functools.wraps(fn)
        def wrapped(*args, **kwargs):
            for i in range(attempts):
                try:
                    return fn(*args, **kwargs)
                except on:
                    if i == attempts - 1:
                        raise
                    time.sleep(backoff * (2 ** i) + random.uniform(0, jitter))
        return wrapped
    return deco

@with_retry(attempts=5)
def fetch_inventory(product_id): ...`,
        highlight: [10, 11, 12, 13, 18],
      },
      quiz: {
        question: 'Three services each write their own retry loop, and one retries forever. What is the clean fix?',
        options: [
          'Add a comment to each loop explaining it',
          'Rename the variables in each loop to be clearer',
          'Replace them with one shared retry helper with a bounded attempt count and backoff',
          'Leave them, since each one works for its own service',
        ],
        answer: 2,
        explain: 'The same job done three ways is a consistency problem. One shared helper gives one policy, bounded attempts and a single place to fix bugs. Renames and comments leave the divergence in place.',
      },
    },
    {
      title: 'Class smells',
      tag: 'concept',
      heading: 'Spot a class that does too much',
      eli5: 'A drawer called "stuff" holds forks, batteries and tape. A drawer marked for one thing is easy to use, and a drawer for everything is where things get lost.',
      body: [
        'Names are the first clue. A class called `OrderManager` or `Helper` is a junk drawer: low **cohesion**, many unrelated jobs. A file past 500 lines or a class doing three or more unrelated things points the same way.',
        'Split by job. `OrderManager` becomes `OrderPricing`, `OrderNotifier` and `OrderRepository`, each small enough to understand in five minutes.',
      ],
      keyIdea: 'A Manager or Utils class, a 500-line file or a class doing three or more unrelated things all mean one thing: split it by job.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '1' },
      scene: {
        nodes: [
          { id: 'god', kind: 'block', at: at(-4, -2.2), label: 'OrderManager', sub: '800 lines, 4 jobs', icon: 'Boxes', tint: 'red', status: 'hot' },
          { id: 'pricing', kind: 'block', at: at(0, -2), label: 'OrderPricing', sub: 'one job', icon: 'Receipt', tint: 'green' },
          { id: 'notifier', kind: 'block', at: at(4, -2.2), label: 'OrderNotifier', sub: 'one job', icon: 'Mail', tint: 'green' },
          { id: 'repo', kind: 'block', at: at(0, 4.4), label: 'OrderRepository', sub: 'one job', icon: 'Database', tint: 'green' },
        ],
        links: [link('god', 'pricing', { label: 'split into' }), link('god', 'notifier', { label: 'split into' }), link('god', 'repo', { label: 'split into' })],
        flows: [{ path: ['god', 'pricing'], tone: 'request', label: 'price()', duration: 1.2 }, { path: ['god', 'notifier'], tone: 'request', label: 'notify()', duration: 1.2, delay: 1.3 }],
        panel: {
          title: 'Warning signs',
          icon: 'Bug',
          rows: [
            { text: 'Name ends in Manager, Helper, Utils', tone: 'warn' },
            { text: 'File over 500 lines', tone: 'warn' },
            { text: 'Three or more unrelated jobs', tone: 'bad' },
          ],
          footer: { text: 'Split by job, not by size alone', tone: 'muted' },
        },
        caption: 'A junk drawer becomes three tidy ones',
      },
    },
    {
      title: 'Hide fields',
      tag: 'concept',
      heading: 'Do not leave mutable fields open to everyone',
      eli5: 'Anyone can reach into the cookie jar and swap cookies for stones. Put a lid on it and let people ask the keeper, who checks the cookies first.',
      body: [
        'A public mutable field lets any code set a broken value, such as a negative balance, and you cannot add a check later without touching every caller. **Encapsulate** it behind a method that validates.',
        'Keep the data private by convention (`_balance` in Python) and expose behavior: `deposit()`, `withdraw()`. The class then protects its own rules.',
      ],
      keyIdea: 'Expose behavior, not raw fields. The class that owns the data enforces its rules.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '1' },
      scene: {
        nodes: [
          { id: 'any', kind: 'block', at: at(-4, -2.2), label: 'any code', sub: 'sets fields freely', icon: 'FileCode', tint: 'gray' },
          { id: 'acct', kind: 'block', at: at(0, 0.5), label: 'Account', sub: '_balance is private', icon: 'Shield', tint: 'green', status: 'ok' },
          { id: 'bad', kind: 'block', at: at(4, -2.2), label: 'balance = -50', sub: 'rejected', icon: 'Bug', tint: 'red', status: 'dim' },
        ],
        links: [link('any', 'acct', { label: 'deposit(), withdraw()' }), link('acct', 'bad', { label: 'blocks', labelTone: 'warn' })],
        flows: [
          { path: ['any', 'acct'], tone: 'request', label: 'withdraw(500)', duration: 1.4 },
          { path: ['acct', 'any'], tone: 'error', label: 'insufficient funds', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The class guards itself',
          icon: 'Code',
          code: 'class Account:\n    def __init__(self):\n        self._balance = 0\n    def withdraw(self, amount):\n        if amount > self._balance:\n            raise ValueError("insufficient funds")\n        self._balance -= amount',
          footer: { text: 'No outside code can break the invariant', tone: 'good' },
        },
        caption: 'The owner of the data enforces the rules',
      },
    },
    {
      title: 'Do not overdo',
      tag: 'tradeoff',
      heading: 'Clean code has a cost, so spend it where it pays',
      eli5: 'Labeling every spoon and splitting every recipe into one-line cards takes longer than cooking. Tidy what the cooks keep tripping over, not everything at once.',
      body: [
        'Over-cleaning is real. A 2,000-line PR titled "refactor everything" is hard to review and risky to merge. Abstractions added before a second use case are a guess, which is the YAGNI trap.',
        'Refactor in small steps next to real work: one method per week, never during a crunch, and never in a colleague\'s module while they are away. Tidy where the code hurts.',
      ],
      keyIdea: 'Refactor in small, reviewable steps where the pain is. Cleaning everything at once adds risk without payoff.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '1' },
      scene: {
        nodes: [
          { id: 'big', kind: 'block', at: at(-4, -2.2), label: 'refactor all', sub: '2,000-line PR', icon: 'Boxes', tint: 'red', status: 'hot' },
          { id: 'small', kind: 'block', at: at(0, 0.5), label: 'one method a week', sub: 'small, reviewable', icon: 'Package', tint: 'green', status: 'ok' },
          { ...review, at: at(4, -2.2) },
        ],
        links: [link('big', 'small', { label: 'prefer', labelTone: 'warn' }), link('small', 'review', { label: 'easy to review' })],
        flows: [{ path: ['small', 'review'], tone: 'response', label: 'small PR', duration: 1.6 }],
        panel: {
          title: 'When to tidy',
          icon: 'Scale',
          rows: [
            { text: 'Next to a real change', value: 'yes', tone: 'good' },
            { text: 'One method at a time', value: 'yes', tone: 'good' },
            { text: 'During a crunch sprint', value: 'no', tone: 'bad' },
            { text: 'Rewriting a colleague\'s module', value: 'no', tone: 'bad' },
          ],
          footer: { text: 'Pain decides what gets cleaned first', tone: 'muted' },
        },
        caption: 'Small steps, steady gains',
      },
    },
    {
      title: 'Review flags',
      tag: 'concept',
      heading: 'The checklist your eyes should run on every diff',
      eli5: 'A cook checking a tray before it leaves runs the same checks each time: clean plate, right dish, nothing spilled. A fixed list catches the problems fast.',
      body: [
        'Most of your influence on quality comes through **code review**. Run the same checks automatically: a method past 50 lines, more than five parameters, nesting past three levels, a block copied in three places.',
        'Also look for public mutable fields, a broad `except Exception:` that swallows the error (narrow the type, as in the Errors step), hardcoded URLs or timeouts, inputs that get mutated, and a `TODO` with no ticket.',
      ],
      keyIdea: 'A fixed checklist turns review from taste into a repeatable habit. Each flag maps to a fix you already know.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '1' },
      scene: {
        nodes: [
          { id: 'diff', kind: 'block', at: at(-4, -2.2), label: 'the diff', sub: 'a new PR', icon: 'FileCode', tint: 'gray' },
          { ...review, at: at(0, 0.5), label: 'checklist', sub: 'same checks each time', status: 'active' },
          { id: 'fixes', kind: 'block', at: at(4, -2.2), label: 'known fixes', sub: 'each flag has one', icon: 'Shield', tint: 'green' },
        ],
        links: [link('diff', 'review', { label: 'reviewed with' }), link('review', 'fixes', { label: 'maps to' })],
        flows: [{ path: ['diff', 'review', 'fixes'], tone: 'request', label: 'flags found', duration: 2.2 }],
        panel: {
          title: 'Red flag, likely fix',
          icon: 'Bug',
          rows: [
            { text: 'Method over 50 lines', value: 'extract' },
            { text: 'More than 5 parameters', value: 'request object' },
            { text: 'Nesting over 3 levels', value: 'guard clauses' },
            { text: 'Block copied 3 times', value: 'shared helper' },
            { text: 'Hardcoded URL or timeout', value: 'config' },
            { text: 'TODO with no ticket', value: 'link one' },
          ],
        },
        caption: 'Each flag points to a fix',
      },
    },
    {
      title: 'Review wording',
      tag: 'concept',
      heading: 'Ask questions in a review, do not issue verdicts',
      eli5: 'Telling a cook "this dish is bad" starts a fight. Asking "could a pinch less salt help?" gets the same fix, and the cook feels like a partner.',
      body: [
        'The author usually senses something is off already. A question gives them room to find the fix: "I see X and Y here, would splitting them help testing?" beats "this violates SRP".',
        'Skip the textbook names in comments. "When we add Z next month this if ladder will grow, want to extract a handler?" is concrete, and nobody has to look anything up.',
      ],
      keyIdea: 'Ask what a change would cost or help. Questions get the fix without making the author defensive.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '1' },
      scene: {
        nodes: [
          { ...review, at: at(-4, -2.2), label: 'reviewer', sub: 'asks a question', status: 'active' },
          { id: 'author', kind: 'user', at: at(4, -2.2), label: 'author', sub: 'owns the code' },
          { id: 'fix', kind: 'block', at: at(0, 2.2), label: 'better code', sub: 'author finds the fix', icon: 'Star', tint: 'green', status: 'ok' },
        ],
        links: [link('review', 'author', { label: 'comment' }), link('author', 'fix', { label: 'improves' })],
        flows: [
          { path: ['review', 'author'], tone: 'request', label: 'would splitting help?', duration: 1.6 },
          { path: ['author', 'fix'], tone: 'response', label: 'extracts it', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Instead of, say',
          icon: 'FileText',
          rows: [
            { text: '"This violates SRP."', value: 'splitting X and Y?', tone: 'warn' },
            { text: '"Bad code."', value: 'a simpler shape?', tone: 'warn' },
            { text: '"Don\'t use Singleton."', value: 'inject it for tests?', tone: 'warn' },
          ],
          footer: { text: 'Ask, do not prescribe', tone: 'good' },
        },
        caption: 'The same point, said as a question',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Clean code in one page',
      eli5: 'A good kitchen has clear labels, short recipe cards, calm steps and the same rules for every cook. Anyone can walk in and make dinner without guessing.',
      body: [
        'Names show intent. Functions do one job, take few parameters and return early on bad input. Constants are named, comments give the why, inputs stay unchanged and errors are specific.',
        'Stay simple and consistent, split classes that do too much, and review with a checklist and questions. Refactor in small steps where the code hurts.',
      ],
      keyIdea: 'Write for the next reader. Small, named, flat, consistent code is cheap to change.',
      metrics: { lines: '150', depth: '1', params: '1', flags: '0' },
      metricTones: { lines: 'warn', depth: 'good', params: 'good', flags: 'good' },
      scene: {
        nodes: [
          { ...reader, at: at(-4, -2.2), status: 'ok', label: 'new teammate', sub: 'reads it in minutes' },
          { ...clean, at: at(0, 2.2), status: 'ok' },
          { ...review, at: at(4, -2.2), status: 'ok', sub: 'asks, does not accuse' },
        ],
        links: [link('reader', 'clean', { label: 'reads' }), link('clean', 'review', { label: 'reviewed' })],
        flows: [
          { path: ['reader', 'clean'], tone: 'request', label: 'what is this?', duration: 1.4 },
          { path: ['clean', 'reader'], tone: 'response', label: 'clear from names', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The habits',
          icon: 'List',
          rows: [
            { text: 'Names', value: 'show intent' },
            { text: 'Functions', value: 'one job, few params' },
            { text: 'Logic', value: 'flat, guard clauses' },
            { text: 'Values', value: 'named, in config' },
            { text: 'Codebase', value: 'one way per job' },
            { text: 'Review', value: 'checklist, questions' },
          ],
        },
        caption: 'Code a stranger can read',
      },
      quiz: {
        question: 'Which change gives the biggest readability gain for the least risk in an old 200-line function?',
        options: [
          'Rewrite the whole module in a new style in one PR',
          'Extract named functions and guard clauses one block at a time, with tests passing at each step',
          'Add a long comment at the top describing every branch',
          'Rename all variables to single letters to shorten lines',
        ],
        answer: 1,
        explain: 'Small extractions keep behavior identical and each step is easy to review. A big rewrite adds risk, a long comment goes stale, and single-letter names make the code harder to read.',
      },
    },
  ],
};
