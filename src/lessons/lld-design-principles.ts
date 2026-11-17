import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

/** A class, interface or object as a block. Tint by role: violet interface, blue abstract, green concrete, gray external. */
const blk = (id: string, d: number, s: number, label: string, sub: string, tint: Tint, icon: string, extra: Partial<SceneNode> = {}): SceneNode => ({
  id,
  kind: 'block',
  at: at(d, s),
  label,
  sub,
  tint,
  icon,
  ...extra,
});

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Tax story
const taxRule = blk('tax', 0, -3.8, 'TaxRule', 'the real rule: 8%', 'gray', 'Scale');
const cart = blk('cart', -3.6, 3.8, 'CartTotal', 'concrete class', 'green', 'ShoppingBag');
const invoice = blk('invoice', 0, 3.8, 'InvoiceTotal', 'concrete class', 'green', 'Receipt');
const price = blk('price', 3.6, 3.8, 'PriceWithTax', 'concrete class', 'green', 'Package');

// Notifier story
const notifier = blk('notifier', 0, -3.8, 'Notifier', 'abstract base', 'blue', 'Layers');
const email = blk('email', -3.6, 3.8, 'EmailNotifier', 'extends', 'green', 'Mail');
const sms = blk('sms', 3.6, 3.8, 'SMSNotifier', 'extends', 'green', 'Cable');
const channel = blk('channel', 0, -3.8, 'Channel', 'interface', 'violet', 'Plug');
const emailCh = blk('emailch', -3.6, 3.8, 'EmailChannel', 'implements', 'green', 'Mail');
const smsCh = blk('smsch', 3.6, 3.8, 'SmsChannel', 'implements', 'green', 'Cable');
const alert = blk('alert', -3.8, -3.8, 'AlertService', 'concrete class', 'green', 'Zap');

export const lldDesignPrinciples: Lesson = {
  id: 'lld-design-principles',
  title: 'DRY, YAGNI, composition over inheritance',
  tagline: 'Short rules that keep code easy to change: one fact in one place, build only what you need, and assemble objects instead of inheriting.',
  minutes: 17,
  level: 'Beginner',
  learn: [
    'DRY as one piece of knowledge in one place, and why identical-looking code is not always a duplicate',
    'When to extract (the rule of three) and how the wrong abstraction costs more than a copy',
    'KISS and YAGNI: the simplest code that works, and no seams for changes nobody has planned',
    'Why inheritance is the most over-used pillar, and how composition (has-a) replaces it',
    'The Law of Demeter: talk to your friends, not to strangers, and how to keep that sane',
  ],
  metrics: [
    { key: 'places', label: 'Places to edit', icon: 'FileCode' },
    { key: 'types', label: 'Classes', icon: 'Boxes' },
    { key: 'tests', label: 'Test setup', icon: 'Bug' },
    { key: 'risk', label: 'Change risk', icon: 'Gauge' },
  ],
  steps: [
    // 1
    {
      title: 'Change hurts',
      tag: 'problem',
      heading: 'The tax rate lives in four places',
      eli5: 'A pizza stand writes the price on four menu boards. When the price changes, the owner fixes three boards and forgets the fourth, so customers see two prices.',
      body: [
        'A shop computes tax with `price * 1.08` in the cart, in the invoice and in a price helper. A fourth copy hides in a report script.',
        'The law changes to 9%. Someone edits three of the four. The cart says $109, the invoice says $108, and support spends a week finding out why.',
      ],
      keyIdea: 'When one fact is written in many places, every change is a hunt, and one miss is a bug.',
      metrics: { places: '4', types: '3', tests: 'Easy', risk: 'High' },
      metricTones: { places: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...taxRule, status: 'active', badge: '8% to 9%' },
          { ...cart, chips: [{ text: 'p * 1.08', tone: 'warn' }] },
          { ...invoice, chips: [{ text: 'p * 1.08', tone: 'warn' }] },
          { ...price, chips: [{ text: 'p * 1.08', tone: 'warn' }] },
        ],
        links: [link('tax', 'cart', { label: 'copied' }), link('tax', 'invoice', { label: 'copied' }), link('tax', 'price', { label: 'copied' })],
        flows: [{ path: ['tax', 'invoice'], tone: 'error', label: 'rate changed', duration: 1.6 }],
        panel: {
          title: 'After the 9% change',
          icon: 'Receipt',
          rows: [
            { text: 'CartTotal', value: '109.00', tone: 'good' },
            { text: 'PriceWithTax', value: '109.00', tone: 'good' },
            { text: 'InvoiceTotal', value: '108.00', tone: 'bad' },
            { text: 'Report script', value: '108.00', tone: 'bad' },
          ],
          footer: { text: 'Two prices for one order', tone: 'bad' },
        },
        caption: 'The rule is one fact, the code holds four copies',
      },
    },
    // 2
    {
      title: 'DRY',
      tag: 'concept',
      heading: 'DRY: every piece of knowledge has one home',
      eli5: 'Write the price on one big board and point every stand at it. Now the owner changes one board and everybody sees the new price.',
      body: [
        '**DRY** (Don\'t Repeat Yourself) says every piece of knowledge has a single, unambiguous representation in the system. The tax rate is knowledge, so it lives in one constant and one function.',
        'Callers use the function. Nobody else knows the number.',
      ],
      keyIdea: 'DRY is about knowledge. Put each fact in one place and let everything else ask for it.',
      metrics: { places: '1', types: '4', tests: 'Easy', risk: 'Low' },
      metricTones: { places: 'good', risk: 'good' },
      scene: {
        nodes: [{ ...taxRule, label: 'Tax', sub: 'with_tax()', tint: 'green', icon: 'Scale', status: 'active', badge: 'TAX_RATE' }, cart, invoice, price],
        links: [link('cart', 'tax', { label: 'uses' }), link('invoice', 'tax', { label: 'uses' }), link('price', 'tax', { label: 'uses' })],
        flows: [
          { path: ['cart', 'tax'], tone: 'request', label: 'with_tax(100)', duration: 1.4 },
          { path: ['tax', 'cart'], tone: 'response', label: '108', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'One home for the rate',
          icon: 'Code',
          code: 'TAX_RATE = 0.08\n\ndef with_tax(amount):\n    return amount * (1 + TAX_RATE)',
          footer: { text: 'Callers never see 0.08', tone: 'muted' },
        },
        caption: 'Callers ask, one function knows',
      },
      code: {
        language: 'python',
        title: 'Before and after',
        source: `# before: the same fact, three times
def price_with_tax_us(p):   return p * 1.08
def cart_total(items):      return sum(i.price * 1.08 for i in items)
def invoice_total(lines):   return sum(l.amount * 1.08 for l in lines)

# after: one fact, one place
TAX_RATE = 0.08

def with_tax(amount):
    return amount * (1 + TAX_RATE)

def cart_total(items):      return sum(with_tax(i.price) for i in items)
def invoice_total(lines):   return sum(with_tax(l.amount) for l in lines)`,
        highlight: [7, 9, 10, 12, 13],
      },
    },
    // 3
    {
      title: 'One edit',
      tag: 'case',
      heading: 'Case: the 9% change is now one line',
      eli5: 'The price changes. The owner crosses out one number on the big board, and every stand is right at once.',
      body: [
        'Law changes the rate. The developer edits `TAX_RATE = 0.09` and runs the tests. Cart, invoice and price helper all pick it up, because none of them knew the number.',
        'The test also lives in one place now: one test of `with_tax` covers the rule for every caller.',
      ],
      keyIdea: 'The payoff of DRY is a change that touches one line and cannot be half done.',
      metrics: { places: '1', types: '4', tests: 'One test', risk: 'Low' },
      metricTones: { places: 'good', tests: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...taxRule, label: 'Tax', sub: 'with_tax()', tint: 'green', icon: 'Scale', status: 'active', badge: 'TAX_RATE = 0.09' },
          { ...cart, status: 'ok', chips: ['$109'] },
          { ...invoice, status: 'ok', chips: ['$109'] },
          { ...price, status: 'ok', chips: ['$109'] },
        ],
        links: [link('cart', 'tax', { label: 'uses' }), link('invoice', 'tax', { label: 'uses' }), link('price', 'tax', { label: 'uses' })],
        flows: [
          { path: ['cart', 'tax', 'cart'], tone: 'request', label: 'with_tax(100)', duration: 1.8 },
          { path: ['invoice', 'tax', 'invoice'], tone: 'request', label: 'with_tax(100)', duration: 1.8, delay: 1.0 },
        ],
        panel: {
          title: 'Diff for the change',
          icon: 'FileCode',
          code: '- TAX_RATE = 0.08\n+ TAX_RATE = 0.09\n\n1 file changed, 1 line',
          footer: { text: 'Every total agrees', tone: 'good' },
        },
        caption: 'One line, four callers fixed',
      },
    },
    // 4
    {
      title: 'False twins',
      tag: 'tradeoff',
      heading: 'DRY is not copy detection',
      eli5: 'Two stands both charge 8 coins, one for pizza and one for a parking ticket. They match by luck. If the parking fee changes, pizza must not change with it.',
      body: [
        'Two lines can look the same and mean different things. Sales tax is 8%. A late fee is also 8% this year. They are **different knowledge** that happens to share a number.',
        'Merge them into one `RATE` and a change to the late fee silently changes tax. Keep them apart.',
      ],
      keyIdea: 'Merge code that must change together. Leave alone code that only looks alike.',
      metrics: { places: '2', types: '3', tests: 'Easy', risk: 'Low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          blk('sales', -3.6, 3.8, 'SalesTax', 'law sets 8%', 'green', 'Scale', { chips: ['SALES_TAX = 0.08'] }),
          blk('late', 3.6, 3.8, 'LateFee', 'policy sets 8%', 'green', 'Clock', { chips: ['LATE_FEE = 0.08'] }),
          blk('merged', 0, -3.8, 'RATE', 'wrongly merged', 'amber', 'Copy', { status: 'hot', badge: '0.08' }),
        ],
        links: [link('sales', 'merged', { label: 'uses', style: 'dashed', labelTone: 'warn' }), link('late', 'merged', { label: 'uses', style: 'dashed', labelTone: 'warn' })],
        flows: [{ path: ['late', 'merged', 'sales'], tone: 'error', label: 'fee to 9%, tax moves too', duration: 2.2 }],
        panel: {
          title: 'Same number, different knowledge',
          icon: 'Split',
          rows: [
            { text: 'SalesTax changes when', value: 'the law does' },
            { text: 'LateFee changes when', value: 'finance says so' },
            { text: 'Shared RATE changes when', value: 'either does', tone: 'bad' },
          ],
          footer: { text: 'Two reasons to change, so two homes', tone: 'warn' },
        },
        caption: 'Matching characters are not matching knowledge',
      },
      quiz: {
        question: 'Two functions both multiply by 0.08. One is for sales tax, the other for a late fee. What does DRY say?',
        options: [
          'Merge them into one RATE constant',
          'Keep them separate: they are different knowledge that changes for different reasons',
          'Delete one and call the other',
          'Add a flag so one helper serves both',
        ],
        answer: 1,
        explain: 'DRY is about knowledge, not characters. Tax and fees change for different reasons, so merging them couples two rules. A flag would only hide the mistake.',
      },
    },
    // 5
    {
      title: 'Rule of three',
      tag: 'concept',
      heading: 'Wait for the third copy',
      eli5: 'Seeing two stands with the same sign is a coincidence. When a third stand wants it too, the owner makes one shared sign.',
      body: [
        'A common rule of thumb is the **rule of three**: copy once, notice the second, and extract on the third. By then you know what really varies between the copies.',
        'Extract too early and you guess the shape of the shared code from one example.',
      ],
      keyIdea: 'Duplication is cheap to fix later. A wrong abstraction is expensive to undo.',
      metrics: { places: '3 copies', types: '3', tests: 'Easy', risk: 'Medium' },
      metricTones: { risk: 'warn' },
      scene: {
        nodes: [
          blk('c1', -3.6, -3.8, 'Parser A', 'copy 1', 'green', 'FileCode', { status: 'dim' }),
          blk('c2', 0, -3.8, 'Parser B', 'copy 2, noted', 'green', 'FileCode', { status: 'active' }),
          blk('c3', 3.6, -3.8, 'Parser C', 'copy 3', 'green', 'FileCode', { status: 'active' }),
          blk('helper', 0, 3.8, 'parse()', 'extract now', 'blue', 'Layers'),
        ],
        links: [link('c1', 'helper', { label: 'noted', style: 'dashed' }), link('c2', 'helper', { label: 'extract' }), link('c3', 'helper', { label: 'extract' })],
        flows: [{ path: ['c3', 'helper'], tone: 'data', label: 'same 10 lines', duration: 1.6 }],
        panel: {
          title: 'Before and after',
          icon: 'Code',
          code: '# before: three near-identical parsers\ndef parse_csv(s):  return s.split(",")\ndef parse_tsv(s):  return s.split("\\t")\ndef parse_pipe(s): return s.split("|")\n\n# after: extracted on the third copy\ndef parse(source, delimiter):\n    return source.split(delimiter)',
          footer: { text: 'Now we know the delimiter is what varies', tone: 'good' },
        },
        caption: 'Three real examples show what really varies',
      },
    },
    // 6
    {
      title: 'Wrong abstraction',
      tag: 'tradeoff',
      heading: 'A bad shared helper costs more than a copy',
      eli5: 'Three stands share one giant sign with switches for pizza, parking and tea. Every stand flips switches, and nobody knows what the sign says now.',
      body: [
        'A helper shared by callers that differ grows flags. `render(x, short=True, legacy=False, mode=None)` is the sign of it. Each flag serves one caller and confuses the rest.',
        'When callers need different behavior, inline the helper back into each one and let them diverge.',
      ],
      keyIdea: 'If a shared function needs a flag per caller, the callers were never the same thing.',
      metrics: { places: '1', types: '4', tests: 'Hard', risk: 'High' },
      metricTones: { tests: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          blk('shared', 0, -3.8, 'render()', 'one helper, 6 flags', 'amber', 'Layers', { status: 'hot' }),
          blk('ui', -3.6, 3.8, 'UiLabel', 'short=True', 'green', 'Star'),
          blk('exp', 0, 3.8, 'Export', 'legacy=True', 'green', 'Download'),
          blk('mail', 3.6, 3.8, 'EmailBody', 'mode="html"', 'green', 'Mail'),
        ],
        links: [link('ui', 'shared', { label: 'uses' }), link('exp', 'shared', { label: 'uses' }), link('mail', 'shared', { label: 'uses' })],
        flows: [{ path: ['exp', 'shared', 'exp'], tone: 'request', label: 'render(x, legacy=True)', duration: 2 }],
        panel: {
          title: 'The helper after a year',
          icon: 'Code',
          code: 'def render(x, short=False, legacy=False,\n           mode=None, pad=0, trim=True,\n           utc=True):\n    if legacy and short: ...\n    elif mode == "html": ...',
          footer: { text: 'Every change breaks someone else', tone: 'bad' },
        },
        caption: 'Flags are the smell of a wrong abstraction',
      },
    },
    // 7
    {
      title: 'DRY for behavior',
      tag: 'case',
      heading: 'Case: one retry policy, wrapped around many calls',
      eli5: 'Every stand needs to retry a dropped order. Instead of teaching each cook, the owner hands everyone the same helper who says try again, a little slower each time.',
      body: [
        'Ten services call a flaky API and each wrote its own retry loop. One retried through a six-hour outage and hid the real problem. Nobody could add backoff in one place.',
        'DRY applies to behavior too. A **decorator** wraps any gateway with one retry policy, and the policy is changed once.',
        'Retry only idempotent calls. A retried payment can charge twice unless `charge()` sends an idempotency key.',
      ],
      keyIdea: 'Repeated behavior around calls (retry, timing, logging) belongs in one wrapper, not in every caller.',
      metrics: { places: '1', types: '5', tests: 'Easy', risk: 'Low' },
      metricTones: { places: 'good', risk: 'good' },
      scene: {
        nodes: [
          blk('client', -5.4, 0, 'Checkout', 'caller', 'green', 'ShoppingBag'),
          blk('retry', -1.8, 0, 'with_retry', 'decorator', 'green', 'Repeat', { status: 'active' }),
          blk('gw', 1.8, 0, 'Gateway', 'interface', 'violet', 'Plug'),
          blk('stripe', 5.4, 0, 'Stripe', 'external', 'gray', 'Network'),
        ],
        links: [link('client', 'retry', { label: 'calls' }), link('retry', 'gw', { label: 'has-a' }), link('gw', 'stripe', { label: 'uses' })],
        flows: [
          { path: ['client', 'retry', 'gw', 'stripe'], tone: 'request', label: 'charge()', duration: 2.4 },
          { path: ['stripe', 'gw', 'retry'], tone: 'error', label: 'timeout', duration: 1.6, delay: 2.5 },
          { path: ['retry', 'gw', 'stripe'], tone: 'request', label: 'retry 2', duration: 1.6, delay: 4.2 },
        ],
        panel: {
          title: 'Wrap once, reuse everywhere',
          icon: 'Code',
          code: '@with_retry(attempts=5,\n            on=(TransientError,))\ndef fetch_inventory(pid):\n    ...\n\n# backoff + jitter live in one place',
          footer: { text: 'Retry only idempotent calls, or send an idempotency key', tone: 'warn' },
        },
        caption: 'The policy is written once',
      },
      code: {
        language: 'python',
        title: 'A retry decorator',
        source: `import functools, random, time

class TransientError(Exception): pass

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
                    time.sleep(backoff * 2 ** i + random.uniform(0, jitter))
        return wrapped
    return deco`,
        highlight: [5, 12, 15],
      },
    },
    // 8
    {
      title: 'KISS',
      tag: 'concept',
      heading: 'KISS: the simplest thing that works',
      eli5: 'A cook can make a sandwich in two steps or in twelve fancy ones. Both give a sandwich. The two-step cook can be replaced by anyone on a busy day.',
      body: [
        '**KISS** (Keep It Simple) says the simplest code that does the job is usually right. Clever code saves you ten seconds once and costs each later reader a minute.',
        'Simple does not mean short. It means a reader sees what happens without decoding it.',
      ],
      keyIdea: 'Code is read far more often than written. Optimize for the next reader.',
      metrics: { places: '1', types: '1', tests: 'Easy', risk: 'Low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          blk('clever', -3.6, 3.8, 'Clever', 'bit tricks', 'amber', 'Braces', { status: 'hot', badge: '1 min to read' }),
          blk('simple', 3.6, 3.8, 'Simple', 'n % 2 == 0', 'green', 'Code', { status: 'ok', badge: '2 s to read' }),
          blk('reader', 0, -3.8, 'Next dev', 'reads it at 2 a.m.', 'teal', 'User'),
        ],
        links: [link('reader', 'clever', { label: 'reads', labelTone: 'warn' }), link('reader', 'simple', { label: 'reads' })],
        flows: [
          { path: ['reader', 'clever'], tone: 'error', label: 'what does this do?', duration: 1.8 },
          { path: ['reader', 'simple'], tone: 'response', label: 'got it', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Same result',
          icon: 'Code',
          code: '# clever\ndef is_even(n):\n    return not bool(n & 1) if isinstance(n, int) else None\n\n# simple\ndef is_even(n: int) -> bool:\n    return n % 2 == 0',
        },
        caption: 'Same behavior, very different reading cost',
      },
      quiz: {
        question: 'A reviewer sees two working versions of is_even. Which should they prefer, and why?',
        options: [
          'The bit-trick version, because it is shorter and faster',
          'n % 2 == 0, because the next reader sees what it does without decoding it',
          'The bit-trick version, because clever code shows skill',
          'Neither: wrap it in an EvenChecker class',
        ],
        answer: 1,
        explain: 'KISS favors the version a reader understands at a glance. Both give the same result, so the extra cleverness only adds reading cost.',
      },
    },
    // 9
    {
      title: 'YAGNI',
      tag: 'concept',
      heading: 'YAGNI: do not build for a future that may not come',
      eli5: 'A stand sells one pizza a day. Building a huge oven with ten trays "in case" costs money now, and next year the stand may sell tea instead.',
      body: [
        '**YAGNI** (You Aren\'t Gonna Need It) says do not build a feature or seam because you might need it. The extension you imagine often never comes, or arrives in a shape you did not predict.',
        'Every speculative abstraction is a bet against reality, and you pay for it in every read and every change.',
      ],
      keyIdea: 'Build for the requirement you have. Refactor when the second one actually shows up.',
      metrics: { places: '1', types: '1', tests: 'Easy', risk: 'Low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          blk('need', -3.6, 3.8, 'Needed today', 'one report type', 'green', 'FileText', { status: 'ok' }),
          blk('maybe', 3.6, 3.8, 'Maybe someday', 'plugins, hooks', 'gray', 'Boxes', { status: 'dim', badge: 'guess' }),
          blk('team', 0, -3.8, 'Team', 'time and attention', 'teal', 'Users', { status: 'active' }),
        ],
        links: [link('team', 'need', { label: 'builds' }), link('team', 'maybe', { label: 'wastes time', style: 'dashed', labelTone: 'warn' })],
        flows: [{ path: ['team', 'need'], tone: 'request', label: 'generate_pdf()', duration: 1.6 }],
        panel: {
          title: 'What speculation costs',
          icon: 'Scale',
          rows: [
            { text: 'Build it now', value: 'days', tone: 'warn' },
            { text: 'Read and maintain it', value: 'forever', tone: 'warn' },
            { text: 'Chance it fits the real need', value: 'low', tone: 'bad' },
          ],
          footer: { text: 'Prepare only for changes planned this quarter', tone: 'muted' },
        },
        caption: 'Real requirements beat imagined ones',
      },
    },
    // 10
    {
      title: 'One report',
      tag: 'case',
      heading: 'Case: the report engine nobody asked for',
      eli5: 'The stand needed one oven. Someone built a factory with conveyor belts and ten stations, and now a simple pizza needs a manual to bake.',
      body: [
        'The task: print one PDF report. The engine version has formatters, middlewares and plugins, and runs to 300 lines.',
        'The simple version is one function. When HTML is needed next year, that is the moment to extract a second formatter, with a real example in hand.',
      ],
      keyIdea: 'Write the function. Turn it into an engine when the second report type arrives.',
      metrics: { places: '1', types: '1', tests: 'Easy', risk: 'Low' },
      metricTones: { types: 'good', risk: 'good' },
      scene: {
        nodes: [
          blk('engine', -3.6, 3.8, 'ReportEngine', '300 lines, 1 user', 'amber', 'Boxes', { status: 'hot', load: 70 }),
          blk('func', 3.6, 3.8, 'generate_pdf', 'one function', 'green', 'FileText', { status: 'ok' }),
          blk('app', 0, -3.8, 'App', 'needs one PDF', 'green', 'Server'),
        ],
        links: [link('app', 'engine', { label: 'uses', style: 'dashed', labelTone: 'warn' }), link('app', 'func', { label: 'uses' })],
        flows: [{ path: ['app', 'func', 'app'], tone: 'request', label: 'generate_pdf(r)', duration: 2 }],
        panel: {
          title: 'Two ways to print one PDF',
          icon: 'Code',
          code: '# YAGNI violated\nclass ReportEngine:\n    formatters = {}\n    middlewares = []\n    plugins = []\n\n# YAGNI respected\ndef generate_pdf(report): ...',
          footer: { text: 'HTML next year? Refactor then', tone: 'muted' },
        },
        caption: 'One report, one function',
      },
    },
    // 11
    {
      title: 'Ghost patterns',
      tag: 'tradeoff',
      heading: 'Ghost patterns: an interface with one implementation',
      eli5: 'The shop hired a head chef, a deputy chef and a chef of chefs for a kitchen with one cook. Every order now goes through three desks.',
      body: [
        'A **ghost pattern** is a pattern applied before the pain. A `Strategy` with one strategy, a DI framework for a 200-line script, an observer where a direct call would do.',
        'The interface exists because someone imagined a second provider. Two years later there is still one, and every change touches two files.',
      ],
      keyIdea: 'Do not apply a pattern until you have felt the pain without it.',
      metrics: { places: '2', types: '3', tests: 'Easy', risk: 'Medium' },
      metricTones: { places: 'warn', risk: 'warn' },
      scene: {
        nodes: [
          blk('svc', -3.8, -3.8, 'OrderService', 'caller', 'green', 'ShoppingBag'),
          blk('iface', 0, 0, 'PaymentStrategy', 'interface, 1 impl', 'violet', 'Plug', { status: 'dim', badge: 'ghost' }),
          blk('only', 3.8, 3.8, 'StripePayment', 'only impl', 'green', 'Package'),
        ],
        links: [link('svc', 'iface', { label: 'uses' }), link('only', 'iface', { label: 'implements' })],
        flows: [{ path: ['svc', 'iface', 'only'], tone: 'request', label: 'pay()', duration: 2 }],
        panel: {
          title: 'Hall of shame',
          icon: 'List',
          rows: [
            { text: 'Strategy with one strategy', value: 'ghost', tone: 'bad' },
            { text: 'DI framework for a script', value: 'ghost', tone: 'bad' },
            { text: '5-level class tree, 10 lines of logic', value: 'ghost', tone: 'bad' },
            { text: 'Observer for one direct call', value: 'ghost', tone: 'bad' },
          ],
        },
        caption: 'An interface with no second implementation',
      },
    },
    // 12
    {
      title: 'Seams that pay',
      tag: 'tradeoff',
      heading: 'YAGNI is not a ban on design',
      eli5: 'If the shop already knows tea is arriving next month, it is fine to leave a spot on the counter. It is silly to leave spots for every drink in the world.',
      body: [
        'Prepare a seam when the change is **actively planned this quarter**. If Apple Pay is on the roadmap, a `PaymentMethod` interface is cheap insurance.',
        'A crude check is the scaffolding ratio: if interfaces, factories and adapters outnumber the business lines they wrap, you over-built. Aim for at least 3 lines of logic per line of scaffolding in a small module.',
      ],
      keyIdea: 'Seams for planned changes are design. Seams for imagined changes are waste.',
      metrics: { places: '1', types: '3', tests: 'Easy', risk: 'Low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          blk('pm', 0, -3.8, 'PaymentMethod', 'interface', 'violet', 'Plug', { badge: 'planned Q3' }),
          blk('card2', -3.6, 3.8, 'CardPayment', 'concrete', 'green', 'Package', { status: 'ok' }),
          blk('apple', 3.6, 3.8, 'ApplePay', 'on roadmap', 'green', 'Package', { status: 'active' }),
        ],
        links: [link('card2', 'pm', { label: 'implements' }), link('apple', 'pm', { label: 'implements' })],
        flows: [{ path: ['pm', 'apple'], tone: 'event', label: 'pay()', duration: 1.6 }],
        panel: {
          title: 'Should I add the seam?',
          icon: 'Scale',
          rows: [
            { text: 'Second case is planned this quarter', value: 'add it', tone: 'good' },
            { text: 'Second case is a guess', value: 'wait', tone: 'warn' },
            { text: 'Scaffolding lines > logic lines', value: 'over-built', tone: 'bad' },
            { text: 'Logic : scaffolding is 3 : 1 or better', value: 'fine', tone: 'good' },
          ],
        },
        caption: 'Plan for what is on the roadmap',
      },
    },
    // 13
    {
      title: 'Is-a trap',
      tag: 'concept',
      heading: 'Inheritance feels like free reuse',
      eli5: 'Every cook in the shop copies the head chef and inherits his apron, knives and bad habits. It is quick, until one cook needs different knives.',
      body: [
        '**Inheritance** says class B is a specialized kind of class A and gets its code for free. Two notifiers share a greeting, so a `Notifier` base holds `format_header` and both extend it.',
        'That is fine while the relationship is a true "is a kind of". The trouble starts when it is only a way to share code.',
      ],
      keyIdea: 'Inheritance is the most over-used pillar. Use it for a real is-a, not for convenience.',
      metrics: { places: '1', types: '3', tests: 'Easy', risk: 'Low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [{ ...notifier, status: 'active' }, email, sms],
        links: [link('email', 'notifier', { label: 'extends' }), link('sms', 'notifier', { label: 'extends' })],
        flows: [
          { path: ['email', 'notifier'], tone: 'request', label: 'format_header()', duration: 1.6 },
          { path: ['sms', 'notifier'], tone: 'request', label: 'format_header()', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Shared greeting in the base',
          icon: 'Code',
          code: 'class Notifier:\n    def format_header(self, user):\n        return f"Hi {user.name}, Acme here."\n\nclass EmailNotifier(Notifier): ...\nclass SMSNotifier(Notifier): ...',
          footer: { text: 'Works while it is a true is-a', tone: 'good' },
        },
        caption: 'Two subclasses share one base method',
      },
    },
    // 14
    {
      title: 'Class explosion',
      tag: 'case',
      heading: 'Case: new needs multiply the subclasses',
      eli5: 'Now customers want pizza that is spicy, gluten-free, or both. The shop trains a new kind of cook for every mix, and the training books pile up.',
      body: [
        'Product asks for retry on email, retry on SMS, and logging on both. Each combination becomes a subclass: `RetryEmail`, `RetrySMS`, `LoggedRetryEmail`.',
        'With 2 channels and 2 extras you need 8 classes, and a fix in the base ripples into all of them. The tree is **fragile**: a base change surprises subclasses it never knew about.',
      ],
      keyIdea: 'Inheritance fixes the combination in the source before the program runs, so every new mix needs a new class.',
      metrics: { places: '8', types: '8', tests: 'Hard', risk: 'High' },
      metricTones: { types: 'bad', tests: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...notifier, status: 'hot' },
          { ...email, at: at(-5.4, 0) },
          blk('retryemail', -1.8, 3.8, 'RetryEmail', 'extends', 'green', 'Repeat'),
          blk('logretry', 1.8, 3.8, 'LoggedRetryEmail', 'extends', 'green', 'List'),
          blk('retrysms', 5.4, 0, 'RetrySMS', 'extends', 'green', 'Repeat'),
        ],
        links: [
          link('email', 'notifier', { label: 'extends' }),
          link('retryemail', 'email', { label: 'extends' }),
          link('logretry', 'retryemail', { label: 'extends' }),
          link('retrysms', 'notifier', { label: 'extends' }),
        ],
        flows: [{ path: ['notifier', 'retryemail'], tone: 'error', label: 'base change breaks it', duration: 2 }],
        panel: {
          title: 'Channels x extras',
          icon: 'Table',
          rows: [
            { text: '2 channels, no extras', value: '2 classes' },
            { text: '+ retry', value: '4 classes', tone: 'warn' },
            { text: '+ logging', value: '8 classes', tone: 'bad' },
            { text: '+ a third channel', value: '12 classes', tone: 'bad' },
          ],
        },
        caption: 'Every combination is a new subclass',
      },
    },
    // 15
    {
      title: 'Composition',
      tag: 'concept',
      heading: 'Composition: hold the behavior, do not inherit it',
      eli5: 'Instead of training a new cook for every mix, give one cook a toolbox. Swap the spicy sauce or the gluten-free dough in the box whenever you need.',
      body: [
        '**Composition** means an object has-a collaborator and delegates to it. `AlertService` holds a `Channel` and calls `send()`. Email, SMS and a retry wrapper all implement `Channel`.',
        'Combinations are now built at runtime from small parts: `Retry(Email())`. No new subclass for each mix.',
      ],
      keyIdea: 'Favor composition over inheritance: assemble behavior from small objects behind an interface.',
      metrics: { places: '1', types: '4', tests: 'Easy', risk: 'Low' },
      metricTones: { types: 'good', risk: 'good' },
      scene: {
        nodes: [alert, { ...channel, at: at(0, 0) }, { ...emailCh, at: at(3.6, 3.8) }, { ...smsCh, at: at(-3.6, 3.8) }],
        links: [
          link('alert', 'channel', { label: 'has-a' }),
          link('emailch', 'channel', { label: 'implements' }),
          link('smsch', 'channel', { label: 'implements' }),
        ],
        flows: [
          { path: ['alert', 'channel', 'emailch'], tone: 'request', label: 'send(msg)', duration: 2 },
        ],
        panel: {
          title: 'Is-a becomes has-a',
          icon: 'Plug',
          rows: [
            { text: 'Inheritance', value: 'AlertService is a Notifier', tone: 'warn' },
            { text: 'Composition', value: 'AlertService has a Channel', tone: 'good' },
            { text: 'New behavior', value: 'new Channel, no new subtype' },
          ],
        },
        caption: 'The service holds a channel and delegates',
      },
    },
    // 16
    {
      title: 'Compose it',
      tag: 'case',
      heading: 'Case: retry and logging as plug-in channels',
      eli5: 'The cook now grabs a dough, a sauce and a topping from the toolbox, and any mix works without a new kind of cook.',
      body: [
        '`Retry` and `Logged` are channels that wrap another channel. `AlertService` neither knows nor cares which stack it was given. Order matters: `Retry(Logged(x))` logs every attempt, `Logged(Retry(x))` logs once.',
        'Two channels plus two wrappers need 4 classes, not 8, and a third channel adds one class, not four.',
      ],
      keyIdea: 'Wrappers that implement the same interface stack in any order, and the order decides what each one sees.',
      metrics: { places: '1', types: '4', tests: 'Easy', risk: 'Low' },
      metricTones: { types: 'good', tests: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...alert, at: at(-5.4, 0) },
          blk('retryw', -1.8, 0, 'Retry', 'wraps a Channel', 'green', 'Repeat', { status: 'active' }),
          blk('loggedw', 1.8, 0, 'Logged', 'wraps a Channel', 'green', 'List'),
          blk('emailc2', 5.4, 0, 'EmailChannel', 'implements', 'green', 'Mail'),
        ],
        links: [
          link('alert', 'retryw', { label: 'has-a' }),
          link('retryw', 'loggedw', { label: 'has-a' }),
          link('loggedw', 'emailc2', { label: 'has-a' }),
        ],
        flows: [{ path: ['alert', 'retryw', 'loggedw', 'emailc2'], tone: 'request', label: 'send(msg)', duration: 2.6 }],
        panel: {
          title: 'Stack built at runtime',
          icon: 'Code',
          code: 'svc = AlertService(\n    Retry(Logged(EmailChannel()))\n)\nsvc.notify(user, "disk full")',
          footer: { text: 'Change the mix by changing the line', tone: 'muted' },
        },
        caption: 'Retry(Logged(Email()))',
      },
      code: {
        language: 'python',
        title: 'Notifier by composition',
        source: `from typing import Protocol

class Channel(Protocol):
    def send(self, user, body: str) -> None: ...

class EmailChannel:
    def send(self, user, body): print("[email]", user.name, body)

class SmsChannel:
    def send(self, user, body): print("[sms]", user.name, body)

class Retry:
    def __init__(self, inner: Channel, attempts=3):
        self.inner, self.attempts = inner, attempts
    def send(self, user, body):
        for i in range(self.attempts):
            try:
                return self.inner.send(user, body)
            except ConnectionError:
                if i == self.attempts - 1:
                    raise

class Logged:
    def __init__(self, inner: Channel):
        self.inner = inner
    def send(self, user, body):
        print("sending", body)
        self.inner.send(user, body)
        print("sent", body)

class AlertService:
    def __init__(self, channel: Channel):
        self.channel = channel
    def notify(self, user, body):
        self.channel.send(user, body)`,
        highlight: [3, 12, 13, 23, 24, 31, 32],
      },
      quiz: {
        question: 'You need retry and logging on both email and SMS. Which design keeps the class count lowest as channels grow?',
        options: [
          'A subclass for every channel and extra combination',
          'One Notifier base class with flags for retry and logging',
          'A Channel interface with Retry and Logged wrappers composed around each channel',
          'Copy the retry loop into each channel',
        ],
        answer: 2,
        explain: 'Wrappers implementing the same interface stack freely, so each new channel or extra adds one class. Subclasses multiply, flags grow a wrong abstraction, and copies break DRY.',
      },
    },
    // 17
    {
      title: 'Swap and test',
      tag: 'case',
      heading: 'Case: swap channels at runtime and in tests',
      eli5: 'On a quiet day the owner tests a new recipe with a pretend customer. Because the cook only asks for "a dough", a play dough works just fine.',
      body: [
        'A composed object takes its collaborator from outside, so a test can pass a `FakeChannel` that records messages. No SMTP server, no network.',
        'Production can also switch at runtime: use SMS when email bounces. An inherited class cannot change its parent after it is created.',
      ],
      keyIdea: 'Composition makes parts swappable and testable. Inheritance welds them at definition time.',
      metrics: { places: '1', types: '4', tests: 'No network', risk: 'Low' },
      metricTones: { tests: 'good', risk: 'good' },
      scene: {
        nodes: [
          alert,
          { ...channel, at: at(0, 0) },
          blk('fake', 3.6, 3.8, 'FakeChannel', 'records calls', 'green', 'Bug', { status: 'ok' }),
          blk('realch', -3.6, 3.8, 'EmailChannel', 'real SMTP', 'green', 'Mail', { status: 'dim' }),
        ],
        links: [link('alert', 'channel', { label: 'has-a' }), link('fake', 'channel', { label: 'implements' }), link('realch', 'channel', { label: 'implements', style: 'faint' })],
        flows: [{ path: ['alert', 'channel', 'fake'], tone: 'request', label: 'send(msg)', duration: 2 }],
        panel: {
          title: 'A unit test',
          icon: 'Code',
          code: 'fake = FakeChannel()\nsvc = AlertService(fake)\nsvc.notify(user, "hi")\nassert fake.sent == [(user, "hi")]',
          footer: { text: 'No SMTP, no network', tone: 'good' },
        },
        caption: 'Inject a fake in tests, a real one in production',
      },
    },
    // 18
    {
      title: 'Inherit well',
      tag: 'tradeoff',
      heading: 'When inheritance is still the right tool',
      eli5: 'A pizza cook really is a kind of cook. Sharing the cook rules with a new pizza cook makes sense. Sharing them with the dishwasher does not.',
      body: [
        'Inherit for a true, shallow is-a where the base is built to be extended. The test is the **Liskov substitution principle**: a subclass must work wherever its parent does. `Square(Rectangle)` fails it, because `set_width` also moves the height.',
        'Mixins suit small stateless behavior and get risky when they share state. If the parent part might need swapping at runtime, compose.',
      ],
      keyIdea: 'Inheritance is for stable, shallow is-a. Composition is for behavior that varies.',
      metrics: { places: '1', types: '3', tests: 'Easy', risk: 'Low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          blk('shape', 0, -3.8, 'Shape', 'abstract base', 'blue', 'Layers', { status: 'active' }),
          blk('circle', -3.6, 3.8, 'Circle', 'extends', 'green', 'Package', { status: 'ok' }),
          blk('square', 3.6, 3.8, 'Square', 'extends', 'green', 'Package', { status: 'ok' }),
        ],
        links: [link('circle', 'shape', { label: 'extends' }), link('square', 'shape', { label: 'extends' })],
        flows: [{ path: ['shape', 'circle'], tone: 'request', label: 'area()', duration: 1.6 }],
        panel: {
          title: 'An LSP violation',
          icon: 'Code',
          code: 'class Rectangle:\n    def set_width(self, w): self.w = w\n\nclass Square(Rectangle):\n    def set_width(self, w):\n        self.w = self.h = w  # surprise',
          footer: { text: 'Caller sets width, height changes too', tone: 'bad' },
        },
        caption: 'A circle really is a shape',
      },
    },
    // 19
    {
      title: 'Demeter',
      tag: 'concept',
      heading: 'Law of Demeter: talk only to your friends',
      eli5: 'A customer asks the waiter for a pizza. The customer does not walk into the kitchen, open the fridge and take the cheese out.',
      body: [
        'The **Law of Demeter** says a method should call only its own object, its parameters, objects it creates and its direct parts. A chain like `order.customer.address.city` reaches through strangers.',
        'Chains tie the caller to the whole structure. If `address` changes shape, every caller breaks.',
      ],
      keyIdea: 'Do not reach through an object to its parts. Ask the object to do the job.',
      metrics: { places: '5', types: '4', tests: 'Hard', risk: 'High' },
      metricTones: { places: 'bad', tests: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          blk('ship', -5.4, 0, 'Shipping', 'caller', 'green', 'Package', { status: 'active' }),
          blk('order', -1.8, 0, 'Order', 'friend', 'green', 'Receipt'),
          blk('cust', 1.8, 0, 'Customer', 'stranger', 'green', 'User', { status: 'dim' }),
          blk('addr', 5.4, 0, 'Address', 'stranger', 'green', 'Network', { status: 'dim' }),
        ],
        links: [link('ship', 'order', { label: 'has' }), link('order', 'cust', { label: 'has-a' }), link('cust', 'addr', { label: 'has-a' })],
        flows: [{ path: ['ship', 'order', 'cust', 'addr'], tone: 'error', label: 'order.customer.address.city', duration: 3 }],
        panel: {
          title: 'A train wreck',
          icon: 'Code',
          code: 'city = order.customer.address.city\nzone = lookup(city)\n\n# Shipping now knows\n# Order, Customer and Address',
          footer: { text: 'Three classes to change in one rename', tone: 'bad' },
        },
        caption: 'Shipping reaches through two strangers',
      },
    },
    // 20
    {
      title: 'Hide it',
      tag: 'case',
      heading: 'Case: hide the delegate where the data lives',
      eli5: 'The customer tells the waiter "pizza please" and the waiter handles the kitchen. If the kitchen moves, the customer never notices.',
      body: [
        'Give `Order` a `shipping_city()` that asks its own customer. `Shipping` calls one method on a friend.',
        'This is the **hide delegate** refactor: callers stop knowing the chain. `Order` only calls `customer.city()`, so when `Address` changes, only `Customer`, which owns it, changes. `Order` and `Shipping` never notice.',
      ],
      keyIdea: 'Put the question on the object that has the answer, so callers depend on one thing.',
      metrics: { places: '1', types: '4', tests: 'Easy', risk: 'Low' },
      metricTones: { places: 'good', tests: 'good', risk: 'good' },
      scene: {
        nodes: [
          blk('ship', -5.4, 0, 'Shipping', 'caller', 'green', 'Package', { status: 'ok' }),
          blk('order', -1.8, 0, 'Order', 'friend', 'green', 'Receipt', { status: 'active' }),
          blk('cust', 1.8, 0, 'Customer', 'hidden', 'green', 'User', { status: 'dim' }),
        ],
        links: [link('ship', 'order', { label: 'uses' }), link('order', 'cust', { label: 'has-a' })],
        flows: [
          { path: ['ship', 'order'], tone: 'request', label: 'shipping_city()', duration: 1.6 },
          { path: ['order', 'cust'], tone: 'request', label: 'city()', duration: 1.4, delay: 1.7 },
          { path: ['cust', 'order', 'ship'], tone: 'response', label: '"Austin"', duration: 2, delay: 3.2 },
        ],
        panel: {
          title: 'The fix',
          icon: 'Code',
          code: 'class Order:\n    def shipping_city(self):\n        return self._customer.city()\n\n# caller\ncity = order.shipping_city()',
          footer: { text: 'Callers know one friend', tone: 'good' },
        },
        caption: 'Shipping talks to Order only',
      },
    },
    // 21
    {
      title: 'Judgment',
      tag: 'tradeoff',
      heading: 'Principles pull against each other',
      eli5: 'The shop owner wants one price board (DRY), a small kitchen (YAGNI), simple recipes (KISS) and a cook who is not stuck in one job (composition). Sometimes these fight, and the owner has to choose.',
      body: [
        'Demeter taken too far buries a class under wrapper methods. A plain data object or a fluent builder is fine to chain, such as `Query().where(x).limit(5)`, because each call returns the same object. DRY pushes you to extract, YAGNI says wait, and KISS says keep it readable.',
        'Introduce changes without a fight: add tests first, extract one responsibility per PR, show the before and after, and let a real bug argue for the refactor.',
      ],
      keyIdea: 'Principles are tools for judgment. When two disagree, choose the simpler code that survives the next change.',
      metrics: { places: '-', types: '-', tests: 'First', risk: 'Managed' },
      scene: {
        nodes: [
          blk('dry', -5.4, 0, 'DRY', 'one home', 'blue', 'Copy'),
          blk('yagni', -1.8, 0, 'YAGNI', 'wait for need', 'amber', 'Clock'),
          blk('kiss', 1.8, 0, 'KISS', 'stay readable', 'green', 'Code'),
          blk('comp', 5.4, 0, 'Composition', 'assemble', 'violet', 'Plug'),
        ],
        links: [link('dry', 'yagni', { label: 'tension', style: 'dashed', arrow: 'both' }), link('kiss', 'comp', { label: 'tension', style: 'dashed', arrow: 'both' })],
        flows: [{ path: ['dry', 'yagni', 'kiss', 'comp'], tone: 'event', label: 'judgment', duration: 3 }],
        panel: {
          title: 'When they collide',
          icon: 'Scale',
          rows: [
            { text: 'DRY says extract', value: 'YAGNI says wait', tone: 'warn' },
            { text: 'Composition adds classes', value: 'KISS says few', tone: 'warn' },
            { text: 'Demeter adds wrappers', value: 'chain plain data', tone: 'warn' },
          ],
          footer: { text: 'Tests first, one extraction per PR', tone: 'muted' },
        },
        caption: 'The tie-breaker is the next change',
      },
    },
    // 22
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Five rules, one aim: cheap change',
      eli5: 'Keep one price board, build only the oven you need, keep recipes simple, give cooks a toolbox, and ask the waiter instead of the fridge.',
      body: [
        '**DRY**: one fact in one place, but only for knowledge that changes together. Extract on the third copy.',
        '**KISS** and **YAGNI**: the simplest code now, seams only for planned changes. **Composition** beats inheritance for varying behavior. **Demeter**: hide the delegate so callers talk to one friend.',
      ],
      keyIdea: 'Each rule keeps the cost of the next change low. Use judgment when they disagree.',
      metrics: { places: '1', types: 'few', tests: 'Easy', risk: 'Low' },
      metricTones: { places: 'good', tests: 'good', risk: 'good' },
      scene: {
        nodes: [
          blk('r-dry', -5.4, 0, 'DRY', 'one home', 'blue', 'Copy', { status: 'ok' }),
          blk('r-yag', -1.8, 0, 'YAGNI', 'only what is needed', 'amber', 'Clock', { status: 'ok' }),
          blk('r-comp', 1.8, 0, 'Composition', 'has-a, not is-a', 'violet', 'Plug', { status: 'ok' }),
          blk('r-dem', 5.4, 0, 'Demeter', 'hide the chain', 'green', 'Shield', { status: 'ok' }),
        ],
        links: [link('r-dry', 'r-yag'), link('r-yag', 'r-comp'), link('r-comp', 'r-dem')],
        flows: [{ path: ['r-dry', 'r-yag', 'r-comp', 'r-dem'], tone: 'response', label: 'cheap change', duration: 3 }],
        panel: {
          title: 'Cheat sheet',
          icon: 'List',
          rows: [
            { text: 'Same knowledge repeated', value: 'DRY', tone: 'good' },
            { text: 'Imagined future need', value: 'YAGNI', tone: 'good' },
            { text: 'Combinations multiplying', value: 'compose', tone: 'good' },
            { text: 'a.b.c.d chains', value: 'Demeter', tone: 'good' },
          ],
        },
        caption: 'Principles for cheap change',
      },
      quiz: {
        question: 'A subclass for every channel and extra keeps multiplying, and callers write order.customer.address.city. Which pair of fixes applies?',
        options: [
          'Add more subclasses and add a flag to the helper',
          'Compose channels from wrappers, and add a method on Order that hides the chain',
          'Merge everything into one big class',
          'Add a plugin framework for future channels',
        ],
        answer: 1,
        explain: 'Composition stops subclass growth because parts stack at runtime. A method on Order follows the Law of Demeter, so callers talk to one friend. The other options add flags, bulk or speculation.',
      },
    },
  ],
};
