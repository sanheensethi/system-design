import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const clients: SceneNode = { id: 'clients', kind: 'client', at: at(-4, -3), label: 'clients', sub: 'browsers, apps' };
const resolver: SceneNode = { id: 'resolver', kind: 'dns', at: at(0, -3), label: 'resolvers', sub: 'ISPs, public DNS' };
const oldNs: SceneNode = { id: 'old', kind: 'dns', at: at(4, -4), label: 'old DNS', sub: 'provider A' };
const newNs: SceneNode = { id: 'new', kind: 'dns', at: at(4, 3.5), label: 'new DNS', sub: 'provider B' };
const origin: SceneNode = { id: 'origin', kind: 'server', at: at(-4, 3.5), label: 'app servers', sub: '203.0.113.10' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const warDnsTtlOutage: Lesson = {
  id: 'war-dns-ttl-outage',
  title: 'DNS TTL outage',
  tagline: 'A weekend DNS migration, a 48 hour TTL nobody remembered, and an old provider about to be switched off with 77% of users still on it.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'How a resolver caches a record and why the TTL is a promise you cannot take back',
    'Why a shorter TTL published now does nothing for resolvers that already cached the old one',
    'How to read the real TTL with dig and spot a migration that is not finished',
    'The mitigation: keep the old nameservers alive and forward to the new backend',
    'The safe order: lower the TTL, wait twice the old TTL, migrate, restore',
    'Prevention: a runbook rule, a TTL alert and a 300 second default in Terraform',
  ],
  metrics: [
    { key: 'new', label: 'Traffic on new DNS', icon: 'TrendingUp' },
    { key: 'err', label: 'Error rate', icon: 'Bug' },
    { key: 'p99', label: 'p99 lookup', icon: 'Timer' },
    { key: 'sat', label: 'Old DNS load', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Normal state',
      tag: 'problem',
      heading: 'A quiet weekend, a plan to change DNS providers',
      eli5: 'In a small town, families ask the **neighbor on the corner** where the bakery is. The neighbor checks the town hall list once, then writes the answer on a sticky note.',
      body: [
        'Your product has used DNS provider A for years. Clients ask **resolvers** (their ISP or a public DNS) where the `shop.example` nameservers are, and the resolvers ask provider A.',
        'This weekend you move the zone to provider B. The plan is simple: publish the change on Saturday, switch provider A off at midnight on Sunday night. Today everything is green.',
      ],
      keyIdea: 'DNS looks like a phone book, but every answer is copied and kept by thousands of resolvers you do not run.',
      metrics: { new: '0%', err: '0.1%', p99: '24 ms', sat: '40%' },
      metricTones: { err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          clients,
          resolver,
          { ...oldNs, status: 'ok', load: 40 },
        ],
        links: [link('clients', 'resolver', { label: 'where is shop.example?' }), link('resolver', 'old', { label: 'authoritative' })],
        flows: [
          { path: ['clients', 'resolver', 'old'], tone: 'request', label: 'lookup', duration: 1.8 },
          { path: ['old', 'resolver', 'clients'], tone: 'response', label: 'answer', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Saturday, before the change',
          icon: 'Network',
          rows: [
            { text: 'Zone served by', value: 'provider A', tone: 'good' },
            { text: 'Provider B', value: 'ready, zone copied' },
            { text: 'Provider A shutdown', value: 'Mon 00:00', tone: 'warn' },
          ],
          footer: { text: 'The plan has no step about TTLs', tone: 'warn' },
        },
        caption: 'Clients reach provider A through resolvers',
      },
    },
    {
      title: 'What is TTL',
      tag: 'concept',
      heading: 'A TTL is how long a resolver may keep an answer',
      eli5: 'The neighbor writes the answer on a **sticky note** with a date: "good until Tuesday". Until that date, the neighbor will not walk to the town hall again.',
      body: [
        'Every DNS record carries a **TTL** (time to live) in seconds. A resolver that fetches the record keeps it, counts the TTL down, and answers from its cache until it reaches zero.',
        'That is why DNS scales. It is also why you cannot edit an answer once it is out. The authoritative side has no way to reach into a resolver and delete a cached record.',
      ],
      keyIdea: 'The TTL is set by you and enforced by strangers. A resolver is allowed to ignore your later edits until its own copy expires.',
      metrics: { new: '0%', err: '0.1%', p99: '24 ms', sat: '40%' },
      metricTones: { err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          clients,
          { ...resolver, status: 'active', chips: [{ text: 'NS: provider A', tone: 'default' }, { text: 'TTL left 47h 59m', tone: 'warn' }] },
          { ...oldNs, status: 'ok', load: 40 },
        ],
        links: [link('clients', 'resolver'), link('resolver', 'old', { label: 'asked once, then cached' })],
        flows: [
          { path: ['clients', 'resolver', 'clients'], tone: 'request', label: 'cache hit', duration: 1.6 },
        ],
        panel: {
          title: 'One cached record',
          icon: 'Clock',
          rows: [
            { text: 'Record', value: 'NS shop.example' },
            { text: 'Value', value: 'ns1.providerA.net' },
            { text: 'TTL when fetched', value: '172800 s' },
            { text: 'Counts down to', value: '0, then refetch', tone: 'muted' },
          ],
          footer: { text: 'Until then the cache never asks again', tone: 'muted' },
        },
        caption: 'A cached answer is served without asking the authority',
      },
    },
    {
      title: 'The plan',
      tag: 'concept',
      heading: 'Saturday 17:00: the NS records point at provider B',
      eli5: 'The town moves its list to a **new town hall**. The mayor pins a notice on the old one. But every neighbor who already wrote a sticky note keeps using it.',
      body: [
        'Geoff publishes new **NS records** that name provider B as authoritative. Provider B is correct and complete. A fresh resolver asking now gets provider B.',
        'The runbook says clients pick up the change quickly, so provider A is scheduled to be decommissioned at midnight on Sunday. Nobody reads the TTL on the NS record. It was set to 48 hours years ago.',
      ],
      keyIdea: 'Publishing the new value is instant. Everyone seeing it is not, and the gap is exactly as long as the old TTL.',
      metrics: { new: '0%', err: '0.1%', p99: '24 ms', sat: '40%' },
      metricTones: { err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          resolver,
          { ...oldNs, status: 'ok', load: 40, chips: [{ text: 'shut down Sun 00:00', tone: 'warn' }] },
          { ...newNs, status: 'active', chips: [{ text: 'NS published Sat 17:00', tone: 'good' }] },
        ],
        links: [link('resolver', 'old', { label: 'cached NS' }), link('resolver', 'new', { style: 'dashed', label: 'only after expiry' })],
        flows: [
          { path: ['resolver', 'old', 'resolver'], tone: 'request', duration: 1.6 },
          { path: ['resolver', 'new'], tone: 'handshake', label: 'fresh lookups only', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Migration timeline',
          icon: 'List',
          rows: [
            { text: 'Sat 17:00', value: 'publish NS to B' },
            { text: 'Sun 23:08', value: 'check traffic' },
            { text: 'Mon 00:00', value: 'switch A off (planned)', tone: 'warn' },
          ],
          footer: { text: 'Written assuming a fast pickup', tone: 'warn' },
        },
        caption: 'The record changed, the caches have not',
      },
    },
    {
      title: 'The trigger',
      tag: 'case',
      heading: 'Sunday 23:08: only 23% of clients are on provider B',
      eli5: 'An hour before the old town hall closes, someone counts who is using the new one. Most families are still walking to the old one.',
      body: [
        'Nita, the SRE, is watching query volume per provider. Provider B serves 23% of production lookups. Provider A still serves **77%**, and on-call has a hand over the shutdown switch.',
        'She pings Geoff: cut A at midnight and three quarters of users lose the ability to find the site. The clock reads 52 minutes.',
      ],
      keyIdea: 'A migration is done when the old side is idle, not when the new side is configured.',
      metrics: { new: '23%', err: '0.1%', p99: '26 ms', sat: '77%' },
      metricTones: { new: 'bad', err: 'good', sat: 'warn' },
      scene: {
        nodes: [
          { ...resolver, status: 'active' },
          { ...oldNs, status: 'hot', load: 77, chips: [{ text: '77% of lookups', tone: 'bad' }] },
          { ...newNs, status: 'ok', load: 23, chips: [{ text: '23% of lookups', tone: 'warn' }] },
        ],
        links: [link('resolver', 'old', { label: 'most still go here', labelTone: 'warn' }), link('resolver', 'new')],
        flows: [
          { path: ['resolver', 'old'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['resolver', 'new'], tone: 'request', count: 1, duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Lookups per provider, 23:08',
          icon: 'Gauge',
          rows: [
            { text: 'Provider B (new)', value: '23%', tone: 'warn' },
            { text: 'Provider A (old)', value: '77%', tone: 'bad' },
            { text: 'Switch-off in', value: '52 min', tone: 'bad' },
          ],
          footer: { text: 'Nobody has been hurt yet', tone: 'muted' },
        },
        caption: 'The new provider is correct but mostly unused',
      },
    },
    {
      title: 'Cut A',
      tag: 'case',
      heading: 'What midnight would do to three quarters of users',
      eli5: 'If the old town hall locks its doors, every family holding an old sticky note walks there, finds a locked door, and cannot learn the bakery moved.',
      body: [
        'Resolvers holding the cached provider A nameservers keep sending queries to A. Once A is off, those queries time out. Resolvers retry, wait, and return **SERVFAIL** to clients.',
        'The site is up and healthy. Nobody can find it. Error rate would jump to roughly the share still on A, with every lookup stalling for seconds first.',
      ],
      keyIdea: 'The failure is invisible from inside your own network. Your servers look fine while users cannot resolve the name.',
      metrics: { new: '23%', err: '~77%', p99: '3 s timeouts', sat: 'down' },
      metricTones: { new: 'bad', err: 'bad', p99: 'bad', sat: 'bad' },
      scene: {
        nodes: [
          clients,
          { ...resolver, status: 'hot', chips: [{ text: 'SERVFAIL', tone: 'bad' }] },
          { ...oldNs, status: 'down', badge: 'switched off' },
        ],
        links: [link('clients', 'resolver'), link('resolver', 'old', { label: 'timeout', labelTone: 'bad' })],
        flows: [
          { path: ['clients', 'resolver', 'old'], tone: 'request', duration: 1.6 },
          { path: ['resolver', 'clients'], tone: 'error', label: 'SERVFAIL', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Projected at 00:00',
          icon: 'Bug',
          rows: [
            { text: 'Clients on cached A', value: '~77%', tone: 'bad' },
            { text: 'Lookup outcome', value: 'timeout, SERVFAIL', tone: 'bad' },
            { text: 'Origin servers', value: 'healthy, unreachable', tone: 'warn' },
          ],
          footer: { text: 'A projection, not live data', tone: 'muted' },
        },
        caption: 'Projected failure if provider A goes dark',
      },
    },
    {
      title: 'Read the TTL',
      tag: 'case',
      heading: 'Investigation: ask the authority what TTL it handed out',
      eli5: 'Geoff reads the date written on the sticky note. It says "good for 48 hours", and the note was written 30 hours ago.',
      body: [
        'Geoff queries the new authoritative server and a resolver for the same record. The authority shows the TTL as configured: **172800 s**, which is 48 hours.',
        'The resolver shows a smaller number. That is the time left on its cached copy, **64800 s**. Both lines point at the same fact: the old answer is trusted for 18 more hours.',
        'One caveat: resolvers take the delegation from the parent (TLD), where the registrar sets the binding NS TTL. Here the zone NS TTL matches it.',
      ],
      keyIdea: 'dig against the authority gives the configured TTL. dig against a resolver gives the time left in its cache.',
      metrics: { new: '23%', err: '0.1%', p99: '26 ms', sat: '77%' },
      metricTones: { new: 'bad', sat: 'warn' },
      scene: {
        nodes: [
          { ...resolver, status: 'active', chips: [{ text: 'cached, 64800 s left', tone: 'warn' }] },
          { ...newNs, status: 'active', chips: [{ text: 'TTL 172800', tone: 'bad' }] },
        ],
        links: [link('resolver', 'new', { label: 'dig NS shop.example', route: 'straight' })],
        flows: [
          { path: ['resolver', 'new'], tone: 'request', label: 'NS?', duration: 1.4 },
          { path: ['new', 'resolver'], tone: 'response', label: 'ns1.providerB 172800', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'TTL: authority vs cache',
          icon: 'Clock',
          rows: [
            { text: 'Configured on B', value: '172800 s = 48 h', tone: 'bad' },
            { text: 'Elapsed since publish', value: '30 h' },
            { text: 'Left in cache', value: '64800 s = 18 h', tone: 'warn' },
          ],
          footer: { text: 'Caches expire on their own clocks', tone: 'muted' },
        },
        caption: 'The record carries the number that explains the traffic',
      },
      code: {
        language: 'bash',
        title: 'Two queries, two different TTL numbers',
        source: `# ask the parent (TLD) servers: the delegation TTL resolvers obey
$ dig NS shop.example @a.gtld-servers.net +noall +authority
shop.example.  172800  IN  NS  ns1.providerb.net.

# ask the new authoritative server: its own copy of the NS TTL
$ dig NS shop.example @ns1.providerb.net +noall +answer
shop.example.  172800  IN  NS  ns1.providerb.net.

# ask a resolver that has it cached: the time left
$ dig NS shop.example @203.0.113.53 +noall +answer
shop.example.  64800  IN  NS  ns1.providera.net.`,
        highlight: [3, 7, 11],
      },
    },
    {
      title: 'Eighteen hours',
      tag: 'concept',
      heading: 'Why pickup is slow and uneven',
      eli5: 'Every neighbor wrote their sticky note on a different day, so the notes run out on different days. Some neighbors already switched. Most have not.',
      body: [
        'Each resolver cached the record at its own moment, so each one expires on its own clock. After 30 hours of a 48 hour TTL, a minority have refetched. That is the 23%.',
        'The remaining 18 hours is a hard floor for full pickup. Nothing you change at the authority shortens it. Some resolvers also run past the TTL, which pushes a small tail even later.',
      ],
      keyIdea: 'The old TTL sets the migration window. It starts when the last resolver cached the old value, not when you pressed publish.',
      metrics: { new: '23%', err: '0.1%', p99: '26 ms', sat: '77%' },
      metricTones: { new: 'bad', sat: 'warn' },
      scene: {
        nodes: [
          { ...resolver, status: 'active', chips: [{ text: 'cached Sat 17:00', tone: 'warn' }, { text: 'expires Mon 17:00', tone: 'warn' }] },
          { ...oldNs, status: 'hot', load: 77 },
          { ...newNs, status: 'ok', load: 23 },
        ],
        links: [link('resolver', 'old', { labelTone: 'warn', label: 'until expiry' }), link('resolver', 'new')],
        flows: [
          { path: ['resolver', 'old'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['resolver', 'new'], tone: 'request', duration: 1.4, delay: 0.5 },
        ],
        panel: {
          title: 'The window',
          icon: 'Timer',
          rows: [
            { text: 'Old TTL', value: '48 h' },
            { text: 'Elapsed', value: '30 h' },
            { text: 'Remaining', value: '18 h', tone: 'warn' },
            { text: 'Switch-off planned in', value: '52 min', tone: 'bad' },
          ],
          footer: { text: '18 h needed, 52 min planned', tone: 'bad' },
        },
        caption: 'Each resolver is on its own countdown',
      },
    },
    {
      title: 'Wrong path',
      tag: 'tradeoff',
      heading: 'The tempting fix: publish a shorter TTL now',
      eli5: 'Writing "good for 5 minutes" on the town hall list does not change the sticky notes already in every neighbor kitchen. Those say 48 hours, and the neighbors trust them.',
      body: [
        'The first idea is to push a **300 second** TTL on the record. It is not harmful, and it matters later. It does nothing for the 77% right now.',
        'Those resolvers are not asking, so they never see the new TTL. You can shorten future promises. The one you already made to the internet stays in force.',
      ],
      keyIdea: 'Lowering a TTL only affects resolvers that fetch after you lower it. The old long TTL is already in their caches.',
      metrics: { new: '23%', err: '0.1%', p99: '26 ms', sat: '77%' },
      metricTones: { new: 'bad', sat: 'warn' },
      scene: {
        nodes: [
          { ...resolver, status: 'active', chips: [{ text: 'still holds 48 h note', tone: 'bad' }] },
          { ...oldNs, status: 'hot', load: 77 },
          { ...newNs, status: 'active', chips: [{ text: 'TTL now 300', tone: 'good' }] },
        ],
        links: [link('resolver', 'old', { label: 'no refetch yet', labelTone: 'warn' }), link('resolver', 'new', { style: 'dashed' })],
        flows: [
          { path: ['resolver', 'old'], tone: 'request', count: 3, duration: 1.4 },
        ],
        panel: {
          title: 'Does a shorter TTL help now?',
          icon: 'Clock',
          rows: [
            { text: 'Resolvers that refetch after the change', value: 'learn 300 s', tone: 'good' },
            { text: 'Resolvers that already cached 172800', value: 'unchanged', tone: 'bad' },
          ],
          footer: { text: 'No help for the 77% in the next hour', tone: 'bad' },
        },
        caption: 'A new TTL cannot reach caches that are not asking',
      },
      quiz: {
        question: 'Provider A holds 77% of traffic and a resolver has the old NS cached for 18 more hours. What does lowering the TTL to 300 seconds do right now?',
        options: [
          'It makes every resolver drop its cached NS at once',
          'It only applies to resolvers that fetch the record after the change',
          'It forces provider A to forward lookups to provider B',
          'It shortens the remaining 18 hours to 5 minutes',
        ],
        answer: 1,
        explain: 'A resolver keeps the old answer and its old countdown until it expires. Only fetches made after the change see the 300 second TTL.',
      },
    },
    {
      title: 'Keep A alive',
      tag: 'concept',
      heading: 'Mitigation: do not turn provider A off',
      eli5: 'Keep the old town hall open a few more days. Families with old sticky notes still get a real answer while their notes slowly expire.',
      body: [
        'The only safe move is to extend provider A until the full TTL window has passed. Geoff cancels the midnight shutdown.',
        'It costs money. The team pays provider A for an **extra month** so the contract does not end at the cliff. A month of fees is far cheaper than an outage.',
      ],
      keyIdea: 'Decommission windows are cheap to extend and expensive to compress. Buy the time.',
      metrics: { new: '23%', err: '0.1%', p99: '26 ms', sat: '77%' },
      metricTones: { new: 'warn', err: 'good', sat: 'warn' },
      scene: {
        nodes: [
          { ...resolver },
          { ...oldNs, status: 'active', load: 77, chips: [{ text: 'shutdown cancelled', tone: 'good' }, { text: '+1 month contract', tone: 'warn' }] },
          { ...newNs, status: 'ok', load: 23 },
        ],
        links: [link('resolver', 'old'), link('resolver', 'new')],
        flows: [
          { path: ['resolver', 'old', 'resolver'], tone: 'request', count: 2, duration: 1.6 },
        ],
        panel: {
          title: 'Decision at 23:20',
          icon: 'Scale',
          rows: [
            { text: 'Cut A at midnight', value: '~77% outage', tone: 'bad' },
            { text: 'Keep A for the TTL window', value: '1 month of fees', tone: 'good' },
          ],
          footer: { text: 'Cost is known and small', tone: 'good' },
        },
        caption: 'Provider A stays on',
      },
    },
    {
      title: 'Forward to B',
      tag: 'concept',
      heading: 'Make provider A return the same records as B',
      eli5: 'The old town hall keeps a clerk at the desk who reads from the new list. Families who still go there get the same answer as everyone else.',
      body: [
        'Provider A must not serve stale data. Geoff configures A to return the same records as B. A does not carry user traffic. DNS only returns an address, and clients then connect to the app servers directly.',
        'Both providers now agree on the record. A resolver that still trusts A and one that already switched to B hand clients the same address.',
      ],
      keyIdea: 'During the overlap both providers must return the same answers, or the migration splits users across two worlds.',
      metrics: { new: '24%', err: '0.1%', p99: '27 ms', sat: '76%' },
      metricTones: { new: 'warn', err: 'good', sat: 'warn' },
      scene: {
        nodes: [
          clients,
          { ...resolver },
          { ...oldNs, status: 'active', load: 76, chips: [{ text: 'same records as B', tone: 'good' }] },
          { ...newNs, status: 'ok', load: 24 },
          { ...origin, at: at(0, 4.5) },
        ],
        links: [link('resolver', 'old'), link('old', 'new', { label: 'same records' }), link('new', 'origin', { style: 'dashed', label: 'A record 203.0.113.10' }), link('clients', 'origin', { label: 'traffic goes direct' })],
        flows: [
          { path: ['resolver', 'old', 'new'], tone: 'request', label: 'same answer', duration: 2.0 },
          { path: ['clients', 'origin'], tone: 'response', label: 'user traffic', duration: 1.8, delay: 2.1 },
        ],
        panel: {
          title: 'Same answer from both providers',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'A: shop.example A', value: '203.0.113.10', tone: 'good' },
            { text: 'B: shop.example A', value: '203.0.113.10', tone: 'good' },
          ],
          footer: { text: 'No split between caches', tone: 'good' },
        },
        caption: 'Both providers return the same address',
      },
    },
    {
      title: 'Cut TTL now',
      tag: 'concept',
      heading: 'Set the NS TTL to 300 seconds immediately',
      eli5: 'The mayor pins a new rule on the town hall: every new note is good for only 5 minutes. As old notes run out, families get the short kind.',
      body: [
        'The shorter TTL still pays off, just later. Every resolver that refetches over the next 18 hours caches the record for 300 seconds and picks up future changes within five minutes.',
        'After the old window closes, nearly every resolver holds a 300 second record. At that point the cutover can finish safely and any rollback would be fast.',
      ],
      keyIdea: 'Lower the TTL as soon as you know it was wrong. Each resolver that refreshes joins the short-TTL group.',
      metrics: { new: '23%', err: '0.1%', p99: '26 ms', sat: '77%' },
      metricTones: { new: 'warn', err: 'good', sat: 'warn' },
      scene: {
        nodes: [
          { ...resolver, chips: [{ text: 'refetched: TTL 300', tone: 'good' }] },
          { ...oldNs, status: 'active', load: 77 },
          { ...newNs, status: 'ok', load: 23, chips: [{ text: 'NS TTL 300', tone: 'good' }] },
        ],
        links: [link('resolver', 'old'), link('resolver', 'new', { label: 'refetch, then every 5 min' })],
        flows: [
          { path: ['resolver', 'old'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['resolver', 'new'], tone: 'request', count: 2, duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'The tail shrinks over time',
          icon: 'TrendingUp',
          rows: [
            { text: 'Sunday 23:30', value: '23% on B', tone: 'bad' },
            { text: 'Monday 06:00', value: 'about 70% on B', tone: 'warn' },
            { text: 'Monday 17:00', value: 'about 95% on B', tone: 'good' },
          ],
          footer: { text: 'Illustrative curve, not a measurement', tone: 'muted' },
        },
        caption: 'Each expiring cache joins the short-TTL group',
      },
    },
    {
      title: 'Recovery',
      tag: 'case',
      heading: 'Monday 23:30: 98% on provider B, A retired',
      eli5: 'By Monday night almost every sticky note has expired and been replaced. The old town hall closes and nobody notices.',
      body: [
        'Across the window, traffic drifts from A to B with no error spike. Late Monday, provider B serves **98%** of lookups and A is near idle.',
        'Only then does the team retire provider A. There was no user-visible impact, and the migration finished about a day later than planned.',
      ],
      keyIdea: 'The quiet outcome was the goal. A late migration beats an on-time outage.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { ...resolver },
          { ...oldNs, status: 'dim', load: 2, badge: 'retired' },
          { ...newNs, status: 'ok', load: 70, chips: [{ text: '98% of lookups', tone: 'good' }] },
        ],
        links: [link('resolver', 'old', { style: 'faint' }), link('resolver', 'new')],
        flows: [
          { path: ['resolver', 'new', 'resolver'], tone: 'response', count: 3, duration: 1.6 },
        ],
        panel: {
          title: 'Monday 23:30',
          icon: 'Activity',
          rows: [
            { text: 'Provider B', value: '98%', tone: 'good' },
            { text: 'Provider A', value: '2%, decommissioned', tone: 'good' },
            { text: 'User impact', value: 'none', tone: 'good' },
          ],
          footer: { text: 'Cutover completed on the TTL schedule', tone: 'good' },
        },
        caption: 'The old provider can finally go',
      },
    },
    {
      title: 'Root cause',
      tag: 'concept',
      heading: 'A runbook that skipped the TTL step',
      eli5: 'Nobody checked how long the sticky notes were good for. They assumed families would simply notice the move.',
      body: [
        'The migration runbook assumed clients would pick up new nameservers quickly. It never checked the NS record TTL, which was set to 48 hours at first provisioning, years earlier.',
        'The safe order starts with lowering the TTL to 300 seconds, waiting out the old one, and only then moving. That step was skipped. The outage is a planning gap, not a DNS fault.',
      ],
      keyIdea: 'A default chosen years ago for a different reason is part of every future migration. Read it before you plan.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { id: 'runbook', kind: 'block', at: at(-3, -3), label: 'runbook', sub: 'no TTL step', icon: 'FileText', tint: 'amber' },
          { id: 'record', kind: 'block', at: at(3, -3), label: 'NS record', sub: 'TTL 172800', icon: 'Clock', tint: 'red', status: 'hot' },
          { id: 'outage', kind: 'block', at: at(0, 3), label: 'near miss', sub: '77% stuck on A', icon: 'Bug', tint: 'gray' },
        ],
        links: [link('runbook', 'outage', { label: 'assumes fast pickup' }), link('record', 'outage', { label: '48 h window' })],
        flows: [
          { path: ['runbook', 'outage'], tone: 'request', duration: 1.4 },
          { path: ['record', 'outage'], tone: 'error', duration: 1.4, delay: 0.7 },
        ],
        panel: {
          title: 'Contributing factors',
          icon: 'List',
          rows: [
            { text: 'NS TTL', value: '48 h, set years ago', tone: 'bad' },
            { text: 'Runbook TTL step', value: 'missing', tone: 'bad' },
            { text: 'Midnight shutdown', value: 'fixed date', tone: 'warn' },
          ],
          footer: { text: 'No single bug, a gap in the plan', tone: 'warn' },
        },
        caption: 'The plan assumed something nobody had checked',
      },
    },
    {
      title: 'Right order',
      tag: 'concept',
      heading: 'The safe order: lower, wait, migrate, restore',
      eli5: 'First shorten the date on new sticky notes. Wait until all the old long ones have run out. Only then move the town hall, and finally go back to longer notes.',
      body: [
        'Lower the NS TTL to 300 seconds. Then **wait at least as long as the old TTL**, preferably twice, so every cache holds the short value. Now the move takes about five minutes to be seen.',
        'Change the NS records, watch the old provider drain to idle, and only then switch it off. Raise the TTL again once things are stable.',
      ],
      keyIdea: 'Drop the TTL, wait two times the old TTL, migrate, then restore it. The waiting is the real work.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { id: 'lower', kind: 'block', at: at(-4, -3), label: '1 lower', sub: 'TTL 300', icon: 'Clock', tint: 'blue' },
          { id: 'wait', kind: 'block', at: at(0, -3), label: '2 wait', sub: '2 x old TTL', icon: 'Timer', tint: 'amber' },
          { id: 'move', kind: 'block', at: at(4, -3), label: '3 migrate', sub: 'change NS', icon: 'Route', tint: 'green' },
        ],
        links: [link('lower', 'wait'), link('wait', 'move')],
        flows: [
          { path: ['lower', 'wait', 'move'], tone: 'handshake', duration: 2.4 },
        ],
        panel: {
          title: 'Runbook for a 48 h TTL',
          icon: 'List',
          rows: [
            { text: 'Day 0: TTL to 300', value: 'now' },
            { text: 'Day 0 to 4: wait', value: '2 x 48 h', tone: 'warn' },
            { text: 'Day 4: change NS', value: 'migrate', tone: 'good' },
            { text: 'Later: restore TTL', value: 'when stable', tone: 'muted' },
          ],
          footer: { text: 'Start days to weeks ahead, by TTL', tone: 'muted' },
        },
        caption: 'Preparation takes longer than the change',
      },
      code: {
        language: 'bash',
        title: 'DNS migration checklist',
        source: `# 1. lower the TTL on the records you will change
set_ttl shop.example NS 300

# 2. wait at least 2 x the OLD ttl (48h -> 96h)
# 3. verify a resolver now shows a short TTL
dig NS shop.example @203.0.113.53 +noall +answer

# 4. change NS to provider B, watch provider A drain to idle
# 5. only then decommission A, and restore a longer TTL`,
        highlight: [2, 4, 6],
      },
      quiz: {
        question: 'A critical record has a 24 hour TTL and you want to migrate it. What is the safest first move?',
        options: [
          'Change the record, then lower the TTL',
          'Lower the TTL to 300 seconds, wait at least 24 hours, then change the record',
          'Switch off the old provider and rely on resolvers to retry',
          'Raise the TTL so resolvers ask less often',
        ],
        answer: 1,
        explain: 'Resolvers must first expire the long TTL and cache the short one. After that wait, a change spreads in about five minutes.',
      },
    },
    {
      title: 'Runbook rule',
      tag: 'concept',
      heading: 'Follow-up 1: a mandatory preparation period',
      eli5: 'The town writes a new rule: before any move, the town hall must shorten its notes and wait for the old ones to run out.',
      body: [
        'The team publishes a DNS runbook. **Any DNS migration** needs a preparation period of at least twice the current TTL, with TTLs dropped to 300 seconds, before the change.',
        'A migration plan that skips the period does not get approved. The runbook starts days to weeks ahead, depending on the TTL.',
      ],
      keyIdea: 'Put the lesson in the process. A rule in the runbook outlives the people who remember the incident.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { id: 'runbook', kind: 'block', at: at(-3, -3), label: 'runbook', sub: 'DNS migrations', icon: 'FileText', tint: 'green', status: 'ok' },
          { id: 'review', kind: 'block', at: at(3, -3), label: 'plan review', sub: 'checks prep period', icon: 'Shield', tint: 'blue' },
        ],
        links: [link('runbook', 'review', { label: 'required gate' })],
        flows: [
          { path: ['runbook', 'review'], tone: 'handshake', duration: 1.6 },
        ],
        panel: {
          title: 'New rule',
          icon: 'FileText',
          rows: [
            { text: 'Preparation before NS change', value: '>= 2 x TTL', tone: 'good' },
            { text: 'TTL during preparation', value: '300 s', tone: 'good' },
            { text: 'Old provider shutdown', value: 'after idle', tone: 'good' },
          ],
          footer: { text: 'Enforced at plan review', tone: 'good' },
        },
        caption: 'The rule is checked before any change starts',
      },
    },
    {
      title: 'TTL alert',
      tag: 'concept',
      heading: 'Follow-up 2: alert on long TTLs on critical records',
      eli5: 'A watchman walks the town and reports any sticky note that is good for longer than an hour, so nobody is surprised again.',
      body: [
        'The team adds monitoring for **authoritative TTLs**. A scheduled check reads every critical record from the authority and raises an alert if any TTL is above 1 hour.',
        'A long TTL on a critical record is a risk you carry silently. The alert makes it visible years before the next migration.',
      ],
      keyIdea: 'A risk that nobody can see will be rediscovered during an incident. Make it an alert.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { ...newNs, at: at(-3, -3), status: 'active' },
          { id: 'mon', kind: 'monitor', at: at(3, -3), label: 'TTL check', sub: 'every 15 min' },
        ],
        links: [link('mon', 'new', { label: 'reads each record' })],
        flows: [
          { path: ['mon', 'new', 'mon'], tone: 'request', duration: 1.8 },
        ],
        panel: {
          title: 'Alert on long TTLs',
          icon: 'Bug',
          rows: [
            { text: 'shop.example NS', value: '300 s', tone: 'good' },
            { text: 'api.example A', value: '60 s', tone: 'good' },
            { text: 'legacy.example NS', value: '172800 s', tone: 'bad' },
          ],
          footer: { text: 'Alert when TTL > 3600 s', tone: 'warn' },
        },
        caption: 'Long TTLs on critical records page someone',
      },
      code: {
        language: 'yaml',
        title: 'Alert rule (pseudo config)',
        source: `alert: CriticalRecordLongTTL
for: 1h
expr: |
  dns_record_ttl_seconds{critical="true"} > 3600
labels:
  severity: warn
annotations:
  summary: "{{ $labels.name }} has a TTL over 1 hour"`,
        highlight: [4],
      },
    },
    {
      title: 'Default 300',
      tag: 'concept',
      heading: 'Follow-up 3: new records default to 300 seconds',
      eli5: 'New sticky notes are made short by default. Anyone who wants a longer one has to ask for it and say why.',
      body: [
        'The Terraform modules that create DNS records now default every new record to a **300 second TTL**. Engineers never have to remember to lower it before a change.',
        'A longer TTL becomes a deliberate, reviewed choice. The long-lived default that caused this incident stops being the quiet path.',
      ],
      keyIdea: 'Make the safe value the default and the risky one a choice. Defaults decide what happens when nobody is paying attention.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { id: 'tf', kind: 'block', at: at(-3, -3), label: 'Terraform', sub: 'dns module', icon: 'FileCode', tint: 'violet' },
          { ...newNs, at: at(3, -3), status: 'ok', chips: [{ text: 'new records: TTL 300', tone: 'good' }] },
        ],
        links: [link('tf', 'new', { label: 'apply' })],
        flows: [
          { path: ['tf', 'new'], tone: 'request', label: 'ttl = 300', duration: 1.6 },
        ],
        panel: {
          title: 'Module default',
          icon: 'Code',
          code: 'variable "ttl" {\n  type    = number\n  default = 300\n}\n\nresource "dns_record" "this" {\n  ttl = var.ttl\n}',
          footer: { text: 'Overrides need review', tone: 'muted' },
        },
        caption: 'The module makes 300 s the quiet default',
      },
    },
    {
      title: 'Low TTL cost',
      tag: 'tradeoff',
      heading: 'Why not make every TTL tiny forever',
      eli5: 'If every sticky note is good for only a minute, neighbors keep walking to the town hall. The hall gets busy and the answers feel slower.',
      body: [
        'A short TTL means resolvers ask your authoritative servers far more often. A 300 second TTL means about one query per resolver per five minutes, against about one per two days at 48 hours.',
        'That adds query cost and load, and a little latency when the cache is cold. It also makes the authority a bigger dependency. Many teams keep long TTLs for records that never move and short ones for records that might.',
      ],
      keyIdea: 'A long TTL buys speed and fewer queries. A short TTL buys the ability to change fast. Choose per record.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { ...resolver, at: at(-3, -3) },
          { ...newNs, at: at(3, -3), status: 'active' },
        ],
        links: [link('resolver', 'new', { label: 'queries per 48 h' })],
        flows: [
          { path: ['resolver', 'new'], tone: 'request', count: 4, duration: 1.2 },
        ],
        panel: {
          title: 'Per resolver, per record',
          icon: 'Scale',
          rows: [
            { text: 'TTL 172800 s (48 h)', value: '~1 query / 2 days', tone: 'good' },
            { text: 'TTL 3600 s (1 h)', value: '~48 / 2 days', tone: 'default' },
            { text: 'TTL 300 s (5 min)', value: '~576 / 2 days', tone: 'warn' },
          ],
          footer: { text: 'Cost vs ability to change fast', tone: 'muted' },
        },
        caption: 'Shorter TTL, more queries to your authority',
      },
    },
    {
      title: 'Decom windows',
      tag: 'tradeoff',
      heading: 'Plan to keep the old system longer than you think',
      eli5: 'Closing the old town hall is easy to do later and painful to do too early. Leave the door open until the last family has stopped coming.',
      body: [
        'A decommission date is a promise to a finance team, not a fact about the network. Set it as "after provider A is idle for N days", not as a calendar date.',
        'Watch the old side drain, and only then switch it off. Extending the window costs money. Compressing it costs users.',
      ],
      keyIdea: 'Define done by traffic on the old system, not by a date. Cheap to extend, expensive to compress.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { ...oldNs, at: at(-3, -3), status: 'dim', load: 2, chips: [{ text: 'idle 7 days?', tone: 'warn' }] },
          { id: 'gate', kind: 'block', at: at(3, -3), label: 'exit gate', sub: 'idle for N days', icon: 'Shield', tint: 'green' },
        ],
        links: [link('old', 'gate', { label: 'drain check' })],
        flows: [
          { path: ['old', 'gate'], tone: 'handshake', duration: 1.6 },
        ],
        panel: {
          title: 'Switch-off gate',
          icon: 'List',
          rows: [
            { text: 'Old provider share', value: '< 1%', tone: 'good' },
            { text: 'Idle for', value: '7 days', tone: 'good' },
            { text: 'Rollback plan', value: 'recorded', tone: 'good' },
          ],
          footer: { text: 'Then switch off', tone: 'good' },
        },
        caption: 'Shut down on evidence, not on a date',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'DNS TTL outage: the whole incident',
      eli5: 'Sticky notes in the neighbor kitchens stay good until their date. Shorten the date first, wait, move the town hall, and only close the old one when nobody still visits it.',
      body: [
        'Normal state: provider A. Trigger: a migration with a 48 hour NS TTL. Detection: 23% on B at 23:08. Mitigation: keep A alive, forward to B, drop the TTL to 300 seconds.',
        'Fix: lower, wait two times the old TTL, migrate. Follow-ups: runbook rule, a TTL alert for anything over 1 hour, and a 300 second Terraform default.',
      ],
      keyIdea: 'A TTL is a promise to the internet. Lower it first, wait it out, then migrate.',
      metrics: { new: '98%', err: '0.1%', p99: '24 ms', sat: '2%' },
      metricTones: { new: 'good', err: 'good', p99: 'good', sat: 'good' },
      scene: {
        nodes: [
          { ...resolver, at: at(-3, -3) },
          { ...newNs, at: at(3, -3), status: 'ok', load: 70, chips: [{ text: 'NS TTL 300', tone: 'good' }] },
          { ...oldNs, at: at(0, 3), status: 'dim', badge: 'retired' },
        ],
        links: [link('resolver', 'new'), link('resolver', 'old', { style: 'faint' })],
        flows: [
          { path: ['resolver', 'new', 'resolver'], tone: 'response', duration: 1.8 },
        ],
        panel: {
          title: 'Incident summary',
          icon: 'List',
          rows: [
            { text: 'Cause', value: '48 h NS TTL, no prep', tone: 'bad' },
            { text: 'Mitigation', value: 'keep A, TTL 300', tone: 'good' },
            { text: 'Fix', value: 'lower, wait 2x, migrate', tone: 'good' },
            { text: 'Follow-ups', value: 'rule, alert, default', tone: 'good' },
          ],
          footer: { text: 'No user-visible impact', tone: 'good' },
        },
        caption: 'The migration finished on the TTL schedule',
      },
      quiz: {
        question: 'Which statement about DNS TTL and migrations is correct?',
        options: [
          'You can force resolvers to forget a cached record by publishing a new TTL',
          'The old TTL sets how long you must keep the old provider alive after publishing the change',
          'A migration is complete as soon as the new provider is configured',
          'Provider B serves all clients as soon as the NS records change',
        ],
        answer: 1,
        explain: 'Resolvers keep the old answer until its TTL runs out, so the old provider must stay available for the old TTL window.',
      },
    },
  ],
};
