import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const laptop: SceneNode = { id: 'laptop', kind: 'client', at: at(-6, 3), label: 'laptop', sub: 'Paris' };
const resolver: SceneNode = { id: 'resolver', kind: 'block', at: at(-2, 3), label: 'resolver', sub: 'at your ISP', icon: 'Search', tint: 'blue' };
const root: SceneNode = { id: 'root', kind: 'block', at: at(-6, -3.5), label: 'root', sub: 'the top', icon: 'Globe', tint: 'violet' };
const tld: SceneNode = { id: 'tld', kind: 'block', at: at(-2, -3.5), label: '.example', sub: 'TLD', icon: 'Network', tint: 'teal' };
const auth: SceneNode = { id: 'auth', kind: 'block', at: at(2, -3.5), label: 'authoritative', sub: 'ns1.shop.example', icon: 'Database', tint: 'amber' };
const oldSrv: SceneNode = { id: 'srvA', kind: 'server', at: at(2, 3), label: 'old server', sub: '203.0.113.10' };
const newSrv: SceneNode = { id: 'srvB', kind: 'server', at: at(6, 3), label: 'new server', sub: '198.51.100.20' };
const euSrv: SceneNode = { ...oldSrv, label: 'EU server' };
const usSrv: SceneNode = { ...newSrv, label: 'US server' };

export const dns: Lesson = {
  id: 'dns',
  title: 'DNS in depth',
  tagline: 'How a name becomes an address, who remembers the answer and for how long, and how that memory can take a site down.',
  minutes: 16,
  level: 'Beginner',
  learn: [
    'The name tree and the lookup chain: resolver, root, TLD and authoritative servers',
    'The record types A, AAAA, CNAME, MX, TXT, NS, PTR, SRV, CAA and SOA',
    'TTLs, negative caching and the layers of caches that hold an answer',
    'How DNS spreads load, routes by region and fails over between servers',
    'DNS failures, spoofing, DNSSEC and encrypted DNS',
  ],
  metrics: [
    { key: 'lookup', label: 'Lookup time', icon: 'Timer' },
    { key: 'ttl', label: 'TTL', icon: 'Clock' },
    { key: 'answer', label: 'Answer', icon: 'Globe' },
    { key: 'switch', label: 'Worst-case switch', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Moving day',
      tag: 'problem',
      heading: 'We moved the site, and half the visitors went to the old address',
      eli5: "Your friend Maya moved to a new desk. The helper at the front office still has yesterday's note, so the **resolver** keeps sending kids to the **old server**, an empty desk.",
      body: [
        'On Friday the shop moves from an old server at `203.0.113.10` to a new one at `198.51.100.20`. The team updates DNS, sees the site load from the new machine, and switches the old one off.',
        'Within the hour the complaints arrive: "the site is down". Only for some people. Nothing is wrong with the new server. This lesson opens the DNS box to find out why.',
      ],
      keyIdea: 'A DNS change does not reach everyone at once. Old answers live on in caches until they expire.',
      metrics: { lookup: '0 ms (cached)', ttl: '86,400 s', answer: '203.0.113.10 (old)', switch: '24 hours' },
      metricTones: { answer: 'bad', switch: 'bad' },
      scene: {
        nodes: [
          { ...laptop, chips: ['shop.example'] },
          { ...resolver, status: 'hot', badge: 'cached: 203.0.113.10' },
          { ...oldSrv, status: 'down', badge: 'switched off' },
          { ...newSrv, status: 'ok', badge: 'ready, no visitors' },
        ],
        links: [link('laptop', 'resolver'), link('laptop', 'srvA', { style: 'faint' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'shop.example?', duration: 1 },
          { path: ['resolver', 'laptop'], tone: 'response', label: '203.0.113.10', duration: 1, delay: 1.1 },
          { path: ['laptop', 'srvA'], tone: 'error', label: 'no answer', duration: 1.8, delay: 2.3 },
        ],
        panel: {
          title: 'What happened on Friday',
          icon: 'List',
          rows: [
            { text: 'Record changed to the new IP', value: '09:00', tone: 'good' },
            { text: 'Old server switched off', value: '10:00' },
            { text: 'Resolver still answers', value: '203.0.113.10', tone: 'bad' },
            { text: 'Users affected', value: 'some', tone: 'warn' },
          ],
          footer: { text: 'The old answer is still valid in the cache', tone: 'bad' },
        },
        caption: 'A stale answer points at a dead machine',
      },
    },
    {
      title: 'Name tree',
      tag: 'concept',
      heading: 'Names are a tree, read from right to left',
      eli5: "To find Maya you ask the principal's office which building has grade 4, then the grade office which room is 4B, then the teacher. The **root**, the **TLD** and the **authoritative** server are those three stops.",
      body: [
        'No single machine knows every name on the internet. DNS splits the job into a tree, and a name is a path through it, read from right to left.',
        'Take `www.shop.example`. At the top is the **root**, then the **TLD** servers for `.example`, then the **authoritative** server for `shop.example`. Each level only knows the next one down, so the owner of `shop.example` can add `api.shop.example` without telling anyone above.',
      ],
      keyIdea: 'DNS is a hierarchy: root knows the TLDs, a TLD knows the domains under it, and the authoritative server knows the actual records.',
      metrics: { lookup: '-', ttl: '86,400 s', answer: '-', switch: '24 hours' },
      scene: {
        nodes: [{ ...root, status: 'active' }, { ...tld, status: 'active' }, { ...auth, status: 'active' }],
        links: [link('root', 'tld', { label: 'points to' }), link('tld', 'auth', { label: 'points to' })],
        flows: [{ path: ['root', 'tld', 'auth'], tone: 'data', label: 'www.shop.example', duration: 2.6 }],
        panel: {
          title: 'Read right to left',
          icon: 'Network',
          rows: [
            { text: 'root', value: 'knows who runs .example' },
            { text: '.example', value: 'knows who runs shop' },
            { text: 'shop.example', value: 'knows the records', tone: 'good' },
          ],
        },
        caption: 'Each level knows only the next one down',
      },
    },
    {
      title: 'Root, TLD',
      tag: 'concept',
      heading: 'The two top levels: root and TLD',
      eli5: "The principal's office has a few front doors, and a copy of the same list sits at each one. The grade offices are run by the school board, one per grade.",
      body: [
        'The **root** is 13 named server addresses, `a.root-servers.net` to `m.root-servers.net`. Behind each one are many machines in many cities, reached through **anycast**: the same address is announced from all of them and the network sends you to the nearest.',
        'A **TLD** (top-level domain) is the ending: `.com`, `.org`, `.io`, or a country code such as `.fr`. Each TLD is run by a registry that knows the name servers of every domain under it.',
      ],
      keyIdea: 'The root has 13 addresses but hundreds of machines. TLD registries know who is authoritative for each domain.',
      metrics: { lookup: '-', ttl: '86,400 s', answer: '-', switch: '24 hours' },
      scene: {
        nodes: [{ ...root, status: 'active', chips: ['13 names, a to m', 'anycast'] }, { ...tld, status: 'active', chips: ['.com .org .io .fr'] }, { ...auth, status: 'dim' }],
        links: [link('root', 'tld', { label: 'delegates' }), link('tld', 'auth', { style: 'faint' })],
        flows: [{ path: ['root', 'tld'], tone: 'data', label: 'who runs .example?', duration: 1.8 }],
        panel: {
          title: 'Who runs what',
          icon: 'Table',
          rows: [
            { text: 'Root', value: 'a few operators, 13 addresses' },
            { text: '.com, .org, .io', value: 'registries' },
            { text: '.fr, .de, .jp', value: 'country registries' },
          ],
        },
        caption: 'Two small, very busy levels at the top',
      },
    },
    {
      title: 'Authoritative',
      tag: 'concept',
      heading: 'The authoritative server holds the truth',
      eli5: 'The teacher keeps the real class list. When you rent a desk you tell the grade office who your teacher is, so it can send visitors your way.',
      body: [
        'The **authoritative** server for `shop.example` holds the real records and is the source of truth. It is usually your DNS provider. Your **registrar** (where you bought the domain) passes its names up to the TLD. Secondary name servers copy the zone from the primary with a **zone transfer**, so one edit reaches every server.',
        'A name server such as `ns1.shop.example` sits inside its own domain, so asking for its address would loop. The TLD stores a **glue record**, its IP, to break that.',
      ],
      keyIdea: 'Authoritative servers answer from their own data. The TLD knows where they are because the registrar told it.',
      metrics: { lookup: '-', ttl: '86,400 s', answer: '-', switch: '24 hours' },
      scene: {
        nodes: [
          { id: 'registrar', kind: 'block', at: at(-6, -3.5), label: 'registrar', sub: 'where you bought it', icon: 'Receipt', tint: 'gray' },
          { ...tld, status: 'active', chips: ['NS ns1.shop.example', 'glue 192.0.2.53'] },
          { ...auth, status: 'active', badge: 'source of truth' },
        ],
        links: [link('registrar', 'tld', { label: 'registers NS' }), link('tld', 'auth', { label: 'points to' })],
        flows: [
          { path: ['registrar', 'tld'], tone: 'data', label: 'ns1, ns2', duration: 1.6 },
          { path: ['tld', 'auth'], tone: 'handshake', label: 'glue IP', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Stored at the TLD',
          icon: 'Code',
          code: 'shop.example.      NS  ns1.shop.example.\nshop.example.      NS  ns2.shop.example.\nns1.shop.example.  A   192.0.2.53   (glue)',
          footer: { text: 'Glue stops the ns1 lookup from looping', tone: 'muted' },
        },
        caption: 'The registrar tells the TLD who is authoritative',
      },
    },
    {
      title: 'Two resolvers',
      tag: 'concept',
      heading: 'Your laptop asks one helper, who does the legwork',
      eli5: 'You do not walk to three offices yourself. You ask the helper at the front desk, the **resolver**, and the helper does the walking and brings back the desk number.',
      body: [
        'Your laptop runs a tiny **stub resolver**. It sends one question to a **recursive resolver**, set by your network or chosen by you, such as `1.1.1.1` or `8.8.8.8`. This is a **recursive** query: "get me the final answer".',
        'The recursive resolver then makes **iterative** queries. Root, TLD and authoritative servers each reply with either the answer or a referral: "I do not know, ask them".',
      ],
      keyIdea: 'The client asks recursively and gets a final answer. The resolver asks iteratively and follows referrals.',
      metrics: { lookup: '-', ttl: '86,400 s', answer: '-', switch: '24 hours' },
      scene: {
        nodes: [{ ...laptop, chips: ['stub resolver'] }, { ...resolver, status: 'active', chips: ['recursive'] }, { ...root, chips: ['referral only'] }],
        links: [link('laptop', 'resolver', { arrow: 'both', label: 'one question' }), link('resolver', 'root', { style: 'dashed', arrow: 'both', label: 'follow referrals' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'recursive: full answer?', duration: 1.4 },
          { path: ['resolver', 'root', 'resolver'], tone: 'handshake', label: 'iterative: ask .example', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Two kinds of query',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Recursive', value: 'client to resolver' },
            { text: 'Iterative', value: 'resolver to the tree' },
          ],
          footer: { text: 'Authoritative servers never do the walking', tone: 'muted' },
        },
        caption: 'One question in, a chain of referrals out',
      },
    },
    {
      title: 'The lookup',
      tag: 'concept',
      heading: 'The resolver walks the tree: root, TLD, authoritative',
      eli5: 'The helper asks the principal, then the grade office, then the teacher, and carries the desk number back to you.',
      body: [
        'With an empty cache the resolver asks root ("ask the `.example` servers"), then the TLD ("ask `ns1.shop.example`"), then the authoritative server, which replies with the address. Three questions at about 25 ms each plus the hop from your laptop: a cold lookup takes around **80 ms**.',
        'The resolver caches every reply, so it already knows where the `.example` servers are for the next name. The root is rarely asked at all.',
      ],
      keyIdea: 'A client asks one resolver. The resolver asks root, then TLD, then authoritative, and remembers every answer on the way.',
      metrics: { lookup: '80 ms (cold)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      scene: {
        nodes: [laptop, { ...resolver, status: 'active' }, root, tld, { ...auth, chips: ['A 203.0.113.10'] }],
        links: [
          link('laptop', 'resolver'),
          link('resolver', 'root', { style: 'dashed' }),
          link('resolver', 'tld', { style: 'dashed' }),
          link('resolver', 'auth', { style: 'dashed' }),
        ],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'www.shop.example?', duration: 0.9 },
          { path: ['resolver', 'root', 'resolver'], tone: 'handshake', label: '1: ask .example', duration: 1.6, delay: 1 },
          { path: ['resolver', 'tld', 'resolver'], tone: 'handshake', label: '2: ask ns1', duration: 1.6, delay: 2.7 },
          { path: ['resolver', 'auth', 'resolver'], tone: 'handshake', label: '3: the address', duration: 1.6, delay: 4.4 },
          { path: ['resolver', 'laptop'], tone: 'response', label: '203.0.113.10', duration: 0.9, delay: 6.1 },
        ],
        panel: {
          title: 'Where 80 ms goes',
          icon: 'Timer',
          rows: [
            { text: 'Laptop to resolver', value: '5 ms' },
            { text: 'Root, TLD, authoritative', value: '3 x 25 ms' },
          ],
          footer: { text: 'About 80 ms, paid once per cold name', tone: 'warn' },
        },
        caption: 'One question in, three questions out',
      },
      code: {
        language: 'bash',
        title: 'Walk the tree yourself (output trimmed)',
        source: `$ dig +trace www.shop.example

.                  518400  IN  NS     a.root-servers.net.    # root: who runs .example?
example.           172800  IN  NS     a.nic.example.         # TLD: who runs shop.example?
shop.example.      86400   IN  NS     ns1.shop.example.      # the authoritative server
www.shop.example.  86400   IN  A      203.0.113.10           # the answer, cacheable for a day

$ dig +short www.shop.example @1.1.1.1                       # ask one public resolver
203.0.113.10`,
        highlight: [3, 4, 5, 6],
      },
    },
    {
      title: 'A, AAAA',
      tag: 'concept',
      heading: 'A and AAAA records give addresses',
      eli5: 'The teacher\'s book lists desk numbers in two styles, the short old style and the long new style. The **authoritative** server keeps a line for each.',
      body: [
        'The authoritative server stores **records**. Each has a name, a type, a value and a TTL. An **A** record maps a name to an IPv4 address. An **AAAA** record maps it to an IPv6 address.',
        'The question names the type, and the answer matches it. A client that speaks both asks for both.',
      ],
      keyIdea: 'A is IPv4 and AAAA is IPv6. Every record carries its own TTL.',
      metrics: { lookup: '80 ms (cold)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      scene: {
        nodes: [laptop, { ...resolver, status: 'active' }, { ...auth, status: 'active' }],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'dashed' })],
        flows: [
          { path: ['resolver', 'auth'], tone: 'request', label: 'A shop.example?', duration: 1.4 },
          { path: ['auth', 'resolver'], tone: 'response', label: '203.0.113.10', duration: 1.4, delay: 1.5 },
          { path: ['resolver', 'auth'], tone: 'request', label: 'AAAA shop.example?', duration: 1.4, delay: 3.2 },
          { path: ['auth', 'resolver'], tone: 'response', label: '2001:db8::10', duration: 1.4, delay: 4.7 },
        ],
        panel: {
          title: 'Name, TTL, type, value',
          icon: 'Table',
          code: 'shop.example.  86400  A     203.0.113.10\nshop.example.  86400  AAAA  2001:db8::10',
        },
        caption: 'The question names a type, the answer matches it',
      },
    },
    {
      title: 'CNAME',
      tag: 'concept',
      heading: 'CNAME: an alias that sends you to another name',
      eli5: 'Maya has a nickname. The teacher\'s book says "Mia, see Maya", so the helper looks up Maya instead.',
      body: [
        'A **CNAME** says "this name is an alias for that other name, look that one up instead". It is how `www.shop.example` can follow `shop.example`, or how a name can point at a CDN.',
        'A CNAME cannot share a name with other records, so it cannot sit on the bare domain `shop.example` itself. Many DNS providers offer an `ALIAS` record that behaves like a CNAME at the bare domain.',
      ],
      keyIdea: 'A CNAME is an alias that costs up to one more lookup. It cannot live on the bare domain next to other records.',
      metrics: { lookup: '80 ms (cold)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      scene: {
        nodes: [{ ...resolver, status: 'active', chips: ['www.shop.example'] }, { ...auth, status: 'active' }],
        links: [link('resolver', 'auth', { style: 'dashed', arrow: 'both' })],
        flows: [
          { path: ['resolver', 'auth'], tone: 'request', label: 'www.shop.example?', duration: 1.2 },
          { path: ['auth', 'resolver'], tone: 'response', label: 'CNAME shop.example', duration: 1.2, delay: 1.3 },
          { path: ['resolver', 'auth'], tone: 'request', label: 'shop.example?', duration: 1.2, delay: 2.7 },
          { path: ['auth', 'resolver'], tone: 'response', label: 'A 203.0.113.10', duration: 1.2, delay: 4.0 },
        ],
        panel: {
          title: 'Alias rules',
          icon: 'Route',
          code: 'www.shop.example.  86400  CNAME  shop.example.\nshop.example.      86400  A      203.0.113.10\n; no CNAME on shop.example itself',
          footer: { text: 'Providers offer ALIAS for the bare domain', tone: 'muted' },
        },
        caption: 'An alias adds up to one more lookup',
      },
    },
    {
      title: 'MX, TXT, NS',
      tag: 'concept',
      heading: 'MX routes mail, TXT carries text, NS names the servers',
      eli5: 'The book also says where to drop letters, has notes pinned to the board, and lists who the teachers are. Each is one more line in the **authoritative** server\'s book.',
      body: [
        'An **MX** record names the mail servers for the domain, with a priority number where lower is tried first.',
        'A **TXT** record holds free text, used to prove you own a domain and to publish which servers may send email for it. **NS** records name the authoritative servers themselves.',
      ],
      keyIdea: 'MX routes email, TXT carries verification text, NS says who is authoritative.',
      metrics: { lookup: '80 ms (cold)', ttl: '3,600 s', answer: '10 mail.shop.example', switch: '1 hour' },
      scene: {
        nodes: [{ ...resolver, status: 'active' }, { ...auth, status: 'active', badge: 'MX, TXT, NS' }, { id: 'mail', kind: 'block', at: at(6, -3.5), label: 'mail', sub: 'mail.shop.example', icon: 'Mail', tint: 'green' }],
        links: [link('resolver', 'auth', { style: 'dashed' }), link('auth', 'mail', { style: 'faint' })],
        flows: [
          { path: ['resolver', 'auth'], tone: 'request', label: 'MX shop.example?', duration: 1.4 },
          { path: ['auth', 'resolver'], tone: 'response', label: '10 mail.shop.example', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'More lines in the book',
          icon: 'Code',
          rows: [
            { text: 'MX 10 mail.shop.example.', value: 'lower number tried first' },
            { text: 'TXT "v=spf1 mx -all"', value: 'SPF: who may send mail' },
            { text: 'NS ns1, ns2', value: 'who is authoritative' },
          ],
        },
        caption: 'Mail goes to the MX host, not the web server',
      },
      code: {
        language: 'bash',
        title: 'The records for shop.example (name, TTL, type, value)',
        source: `shop.example.        86400  A      203.0.113.10
mail.shop.example.   3600   A      192.0.2.25
ns1.shop.example.    86400  A      192.0.2.53
shop.example.        86400  AAAA   2001:db8::10
www.shop.example.    86400  CNAME  shop.example.
shop.example.        3600   MX     10 mail.shop.example.
shop.example.        3600   TXT    "v=spf1 mx -all"
shop.example.        86400  NS     ns1.shop.example.
shop.example.        86400  NS     ns2.shop.example.`,
        highlight: [6, 7, 8, 9],
      },
    },
    {
      title: 'More records',
      tag: 'concept',
      heading: 'PTR, SRV, CAA and SOA fill the gaps',
      eli5: 'A few more lines sit in the book: who lives at this desk number, which door a club uses, who may print badges, and the book\'s own cover page.',
      body: [
        '**PTR** goes from an address to a name, for example so mail servers can check a caller. Reverse records live under `in-addr.arpa` and are set by the IP owner or ISP. **SRV** names the host and port of a service. **CAA** lists which certificate authorities may issue certificates for the domain.',
        '**SOA** is the zone\'s cover page: the primary server, a rising serial, refresh timers (how secondary servers copy the zone), and the negative TTL.',
      ],
      keyIdea: 'Beyond addresses, DNS also stores reverse lookups, service locations, certificate rules and zone metadata.',
      metrics: { lookup: '80 ms (cold)', ttl: '3,600 s', answer: '-', switch: '1 hour' },
      scene: {
        nodes: [{ ...resolver, status: 'active' }, { id: 'rev', kind: 'block', at: at(2, -3.5), label: 'reverse zone', sub: 'in-addr.arpa, ISP', icon: 'Database', tint: 'amber', status: 'active' }],
        links: [link('resolver', 'rev', { style: 'dashed' })],
        flows: [
          { path: ['resolver', 'rev', 'resolver'], tone: 'request', label: 'PTR 10.113.0.203.in-addr.arpa?', duration: 2 },
        ],
        panel: {
          title: 'One line of each',
          icon: 'Code',
          code: '10.113.0.203.in-addr.arpa. PTR mail.shop.example.\n_sip._tcp.shop.example. SRV 10 60 5060 sip.shop.example.\nshop.example. CAA 0 issue "letsencrypt.org"\nshop.example. SOA ns1.shop.example. admin.shop.example.\n  2024051701 7200 3600 1209600 300\n; serial, refresh, retry, expire, negative TTL',
        },
        caption: 'Same book, more kinds of line',
      },
    },
    {
      title: 'TTL',
      tag: 'concept',
      heading: 'Every answer carries a timer',
      eli5: 'The helper writes the desk number on a sticky note marked "good until lunch". Until lunch, the **resolver** reads the note and never asks the teacher again.',
      body: [
        'Each record has a **TTL** (time to live) in seconds. It tells anyone who receives the answer how long they may reuse it before asking again.',
        'Each cache counts the TTL down and only asks upstream when it reaches zero.',
      ],
      keyIdea: 'TTL is a promise the domain owner makes: "you may reuse this answer for this long". Every cache on the path takes that promise literally.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      scene: {
        nodes: [{ ...resolver, status: 'ok', badge: 'cached, 86,212 s left' }, { ...auth, status: 'dim' }, { ...laptop, status: 'ok' }],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'faint' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'www.shop.example?', duration: 0.9 },
          { path: ['resolver', 'laptop'], tone: 'response', label: 'from cache, 10 ms', duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'A cached record',
          icon: 'Clock',
          code: 'www.shop.example.  86212  IN  A  203.0.113.10\n;                  ^ seconds left, counts down to 0',
        },
        caption: 'The timer counts down, then the resolver asks again',
      },
    },
    {
      title: 'Cache layers',
      tag: 'concept',
      heading: 'Many caches keep the answer, so DNS feels free',
      eli5: 'Your laptop keeps its own sticky note, and the helper keeps one too. A visit usually ends at the nearest note.',
      body: [
        'The answer is cached in layers: the **browser**, the **operating system**, and the **resolver**, which one may serve a whole city of users. Each layer counts the TTL down on its own.',
        'A repeat visit costs 0 ms. A first visit to a popular site costs about 10 ms, because someone else filled the resolver\'s cache. Only a name nobody nearby asked for recently pays 80 ms. Two resolvers can hold different copies for a while, so DNS is eventually consistent: it favors availability over agreement.',
      ],
      keyIdea: 'Caching makes DNS fast and also makes it slow to change. Different caches can disagree until their timers run out.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      metricTones: { lookup: 'good' },
      scene: {
        nodes: [{ ...laptop, status: 'ok', chips: ['browser: 0 ms', 'OS: 0 ms'] }, { ...resolver, status: 'ok', chips: ['shared: 10 ms'] }, { ...auth, status: 'dim', chips: ['cold: 80 ms'] }],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'faint' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', duration: 0.9 },
          { path: ['resolver', 'laptop'], tone: 'response', label: 'from cache', duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'Who answers, and how fast',
          icon: 'Layers',
          rows: [
            { text: 'Browser or OS cache', value: '0 ms', tone: 'good' },
            { text: 'Resolver cache', value: '10 ms', tone: 'good' },
            { text: 'Full walk', value: '80 ms', tone: 'warn' },
          ],
        },
        caption: 'Most lookups never leave the resolver',
      },
      quiz: {
        question: 'A record has a TTL of 3,600 s. A resolver cached it 10 minutes ago. You change the record now. For how long might users of that resolver still get the old answer?',
        options: ['Not at all, DNS changes are instant', 'Up to 10 minutes', 'Up to 50 minutes', 'Up to 24 hours'],
        answer: 2,
        explain: 'The resolver may reuse the answer for 3,600 s (60 minutes) from when it fetched it. Ten minutes have passed, so it can keep serving the old value for up to 50 more. The authoritative server has no way to tell caches about the change.',
      },
    },
    {
      title: 'Pick a TTL',
      tag: 'tradeoff',
      heading: 'Long TTL or short TTL?',
      eli5: 'A note good all year means the helper rarely bothers the teacher, but a desk change goes unnoticed. A note good for five minutes keeps the **resolver** fresh and the teacher busy.',
      body: [
        'A **long TTL**, such as 86,400 s (one day), means few lookups, fast page loads, and protection if your authoritative servers have a bad hour, because caches keep answering. The cost: a change takes up to a day to reach everyone.',
        'A **short TTL**, such as 300 s, means a change reaches everyone within five minutes. The cost: resolvers come back 288 times more often than with a one-day TTL, and an outage at your DNS provider hurts within minutes.',
      ],
      keyIdea: 'TTL trades speed and resilience against how quickly you can change your mind.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: '203.0.113.10', switch: '5 minutes' },
      metricTones: { ttl: 'warn', switch: 'good' },
      scene: {
        nodes: [{ ...resolver, status: 'active', badge: 'asks again every 300 s' }, { ...auth, status: 'active', badge: '288x more questions', load: 72 }, laptop],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'dashed' })],
        flows: [
          { path: ['resolver', 'auth'], tone: 'request', label: 'still 203.0.113.10?', count: 3, duration: 1.4 },
          { path: ['auth', 'resolver'], tone: 'response', label: 'yes, TTL 300', count: 3, duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'One day versus five minutes',
          icon: 'Scale',
          rows: [
            { text: 'Change reaches everyone', value: '24 h vs 5 min' },
            { text: 'Questions to authoritative', value: '1x vs 288x' },
            { text: 'Survives a DNS outage', value: 'a day vs minutes', tone: 'warn' },
          ],
        },
        caption: 'Short TTL: fresher answers, more questions',
      },
    },
    {
      title: 'Per record',
      tag: 'tradeoff',
      heading: 'Choose the TTL per record',
      eli5: 'Desk numbers that change often get a short note. The school address on the front gate never changes, so its note can last all year.',
      body: [
        'A common middle ground is a few minutes for records that might need to move, such as the addresses of your servers, and hours or a day for those that rarely change, such as `MX` and `NS`.',
        'Before a planned move, lower the TTL well ahead of time. The next steps show why. Moving DNS providers waits on the NS TTL held at the TLD, often 48 h, so run both providers during the move.',
      ],
      keyIdea: 'Match each record\'s TTL to how fast it may need to move.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s (A), 86,400 s (NS)', answer: '203.0.113.10', switch: '5 minutes' },
      scene: {
        nodes: [{ ...auth, status: 'active' }, { ...resolver, status: 'ok' }, { ...laptop }],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'dashed' })],
        flows: [{ path: ['resolver', 'auth', 'resolver'], tone: 'request', label: 'A: 300 s, NS: 86,400 s', duration: 2 }],
        panel: {
          title: 'A sensible mix',
          icon: 'Table',
          rows: [
            { text: 'A, AAAA (may move)', value: '300 s', tone: 'good' },
            { text: 'CNAME to a CDN', value: '300 s', tone: 'good' },
            { text: 'MX, TXT', value: '3,600 s' },
            { text: 'NS', value: '86,400 s' },
          ],
        },
        caption: 'Fast-moving records get short timers',
      },
    },
    {
      title: 'Negative cache',
      tag: 'concept',
      heading: 'Even "no such name" gets cached',
      eli5: 'If a kid asks for a desk that does not exist yet, the helper writes "no such desk" on a note too. When the desk appears, that kid is still told no for a while.',
      body: [
        'If someone looks up `api.shop.example` before the record exists, the "no such name" answer (`NXDOMAIN`) is cached too. The zone\'s `SOA` record says for how long, often minutes.',
        'You add the record, it works for you and still fails for them. Create records before you announce them.',
      ],
      keyIdea: 'Negative answers are cached like positive ones. A record added late stays invisible until the negative TTL ends.',
      metrics: { lookup: '0 ms (cached)', ttl: '300 s', answer: 'NXDOMAIN (cached)', switch: '5 minutes' },
      metricTones: { answer: 'bad' },
      scene: {
        nodes: [{ ...laptop, chips: [{ text: 'api.shop.example', tone: 'warn' }] }, { ...resolver, status: 'hot', badge: 'cached: no such name' }, { ...auth, status: 'ok', badge: 'record exists now' }],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'faint' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'api.shop.example?', duration: 1 },
          { path: ['resolver', 'laptop'], tone: 'error', label: 'NXDOMAIN', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'The timeline',
          icon: 'Clock',
          rows: [
            { text: '10:00 someone looks it up', value: 'NXDOMAIN' },
            { text: '10:01 you add the record', value: 'works for you', tone: 'good' },
            { text: '10:02 they look again', value: 'still NXDOMAIN', tone: 'bad' },
          ],
          footer: { text: 'Negative TTL comes from the SOA record', tone: 'muted' },
        },
        caption: 'The cached "no" outlives the fix',
      },
    },
    {
      title: 'Round robin',
      tag: 'concept',
      heading: 'DNS as a load balancer: round robin and weights',
      eli5: 'Maya\'s class now has two rooms. The teacher lists both and swaps the order each time, so about half the kids go to each room.',
      body: [
        'A name can have several A records. The authoritative server returns them all and rotates the order, and most clients use the first. This **round-robin DNS** spreads users across servers with no extra hardware.',
        '**Weighted** records are a separate feature that skews the split, for example 90% to the current server and 10% to a new one under test. Each resolver caches the list, so all its users go to the same server first and the split is only even across many resolvers.',
      ],
      keyIdea: 'Several records for one name spread users across servers. It costs nothing and knows nothing about load or health.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: 'rotates', switch: '5 minutes' },
      scene: {
        nodes: [{ ...resolver, status: 'active' }, { ...auth, status: 'active', badge: 'rotates the order' }, { ...oldSrv, label: 'server 1', sub: 'current', status: 'ok', chips: ['90%'] }, { ...newSrv, label: 'server 2', sub: 'new, under test', status: 'ok', chips: ['10%'] }],
        links: [link('resolver', 'auth', { style: 'dashed' }), link('resolver', 'srvA'), link('resolver', 'srvB')],
        flows: [
          { path: ['resolver', 'auth', 'resolver'], tone: 'request', label: 'A: .10, .20', duration: 1.8 },
          { path: ['resolver', 'srvA'], tone: 'request', count: 9, duration: 1.8, delay: 2 },
          { path: ['resolver', 'srvB'], tone: 'request', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Weighted answers',
          icon: 'Split',
          rows: [
            { text: '203.0.113.10', value: 'weight 90', tone: 'good' },
            { text: '198.51.100.20', value: 'weight 10' },
          ],
          footer: { text: 'Plain round robin is 50 / 50', tone: 'muted' },
        },
        caption: 'Same name, several answers',
      },
    },
    {
      title: 'Geo routing',
      tag: 'concept',
      heading: 'Geo routing: a different answer per region',
      eli5: 'The teacher sends east-wing kids to the east room and west-wing kids to the west room, whichever is nearest.',
      body: [
        'Managed DNS answers with the closest region. It sees the resolver\'s IP, not the laptop\'s, unless the resolver forwards the client subnet (**ECS**), so a Paris user on a faraway public resolver can be sent to the wrong region.',
        'It is a blunt tool. DNS does not know how busy a server is, and one resolver\'s cached answer serves thousands of people, so traffic arrives in lumps. DNS picks a region or a front door. A real load balancer behind it does the fine-grained work.',
      ],
      keyIdea: 'By giving different answers to different askers, DNS can steer users to a region. It is coarse, cached and blind to load.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: 'depends on who asks', switch: '5 minutes' },
      scene: {
        nodes: [
          { ...laptop, at: at(-6, 0.5), badge: 'gets 203.0.113.10' },
          { ...resolver, at: at(-2, 0.5), status: 'active', sub: 'in Europe' },
          { ...auth, at: at(2, -3.5), status: 'active', badge: 'answers by resolver region' },
          { ...euSrv, at: at(2, 3), status: 'ok' },
          { ...usSrv, at: at(6, 3), status: 'ok' },
        ],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'dashed' }), link('resolver', 'srvA', { style: 'faint' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'shop.example?', duration: 1.2 },
          { path: ['resolver', 'auth'], tone: 'request', label: 'from an EU resolver', duration: 1.4, delay: 1.3 },
          { path: ['auth', 'resolver', 'laptop'], tone: 'response', label: 'EU address', duration: 1.8, delay: 2.8 },
          { path: ['laptop', 'srvA'], tone: 'request', duration: 1.8, delay: 4.7 },
        ],
        panel: {
          title: 'Geo policy',
          icon: 'Table',
          rows: [
            { text: 'EU resolvers', value: '203.0.113.10', tone: 'good' },
            { text: 'Others', value: '198.51.100.20' },
          ],
          footer: { text: 'Decided by the resolver, not the laptop', tone: 'muted' },
        },
        caption: 'Same name, a different answer per region',
      },
    },
    {
      title: 'Failover',
      tag: 'concept',
      heading: 'DNS failover: stop handing out a dead address',
      eli5: 'The east room floods. The teacher crosses it out and sends everyone to the west room. Kids holding an old sticky note still walk to the flooded room until their note runs out.',
      body: [
        'Managed DNS can run **health checks**: it pings each server every 10 seconds or so. After three failed checks it stops including that address in answers. New lookups only get healthy servers.',
        'The Europe server dies. Detection takes about 30 seconds. Then every cache must expire, which takes up to one TTL. With a 60 s TTL the worst case is about **90 seconds** before Paris is sent to the US server. With a one-day TTL it would be a day.',
      ],
      keyIdea: 'DNS failover time is detection time plus TTL. It works in minutes, never in milliseconds.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '60 s', answer: '198.51.100.20 (US)', switch: 'about 90 s' },
      metricTones: { switch: 'warn' },
      scene: {
        nodes: [{ ...auth, at: at(2, -5), status: 'active', badge: 'EU failed 3 checks' }, { ...euSrv, status: 'down', badge: 'removed from answers' }, { ...usSrv, status: 'ok', badge: 'takes Paris too' }, { ...laptop, badge: 'now gets 198.51.100.20' }],
        links: [
          link('auth', 'srvA', { style: 'faint', label: 'health check' }),
          link('auth', 'srvB', { style: 'faint', label: 'health check' }),
          link('laptop', 'srvB', { style: 'faint' }),
        ],
        flows: [
          { path: ['auth', 'srvA'], tone: 'error', label: 'check failed', duration: 1.2 },
          { path: ['auth', 'srvB', 'auth'], tone: 'handshake', label: 'check ok', duration: 1.6, delay: 0.2 },
          { path: ['laptop', 'srvB'], tone: 'request', duration: 1.8, delay: 2.5 },
        ],
        panel: {
          title: 'Worst-case switch',
          icon: 'Timer',
          rows: [
            { text: '3 failed checks', value: '30 s' },
            { text: 'Caches expire (TTL)', value: '60 s' },
            { text: 'Total', value: 'about 90 s', tone: 'warn' },
          ],
          footer: { text: 'A one-day TTL would make it a day', tone: 'bad' },
        },
        caption: 'The dead address drops out of the answers',
      },
    },
    {
      title: 'Stubborn caches',
      tag: 'concept',
      heading: 'Treat 90 seconds as a floor',
      eli5: 'Some helpers keep a sticky note after it runs out, and some kids stay in the room they already know. The teacher cannot reach them.',
      body: [
        'Some resolvers and some apps hold answers longer than the TTL says, and a browser with an open connection keeps trying the address it has.',
        'DNS failover is good for moving traffic between regions in minutes. For failing over in a second or two, put a load balancer with a stable address in front of the servers.',
      ],
      keyIdea: 'Real failover is slower than TTL plus detection. Use a load balancer for fast failover.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '60 s', answer: '198.51.100.20 (US)', switch: '90 s or more' },
      metricTones: { switch: 'bad' },
      scene: {
        nodes: [{ ...laptop, chips: [{ text: 'open connection', tone: 'warn' }] }, { ...euSrv, status: 'down' }, { ...usSrv, status: 'ok' }],
        links: [link('laptop', 'srvA', { label: 'still trying', labelTone: 'warn' }), link('laptop', 'srvB', { style: 'faint' })],
        flows: [{ path: ['laptop', 'srvA'], tone: 'error', label: 'old address', duration: 1.8 }],
        panel: {
          title: 'Why it runs long',
          icon: 'Bug',
          rows: [
            { text: 'Resolver ignores the TTL', value: 'minutes more', tone: 'warn' },
            { text: 'App caches the IP', value: 'until restart', tone: 'bad' },
            { text: 'Open connection', value: 'keeps old IP', tone: 'warn' },
          ],
          footer: { text: 'Fast failover needs a load balancer', tone: 'muted' },
        },
        caption: 'Some clients never look again',
      },
      quiz: {
        question: 'Health checks take 30 s to mark a server dead, and the record TTL is 60 s. In the worst case, how long until well-behaved resolvers stop sending users to the dead server?',
        options: ['About 1 second', 'About 30 seconds', 'About 90 seconds', 'About 24 hours'],
        answer: 2,
        explain: 'Detection (30 s) plus one full TTL (60 s) gives about 90 s in the worst case. Stubborn caches and open connections can add more.',
      },
    },
    {
      title: 'Friday, fixed',
      tag: 'case',
      heading: 'Case: how the Friday move should have gone',
      eli5: 'Before Maya moves desks, the teacher tells the helper "from now on your notes are only good for five minutes". On moving day every **resolver** learns the new desk almost at once.',
      body: [
        'The A record had a TTL of 86,400 s. Any resolver that looked the name up on Friday morning could keep answering `203.0.113.10` until Saturday morning. The team\'s own laptops showed the new server only because their caches happened to refresh.',
        'The safe sequence: **days before**, lower the TTL to 300 s and wait one full old TTL (24 hours). **On the day**, change the address. **After**, keep the old server running until its traffic drains, then raise the TTL again.',
      ],
      keyIdea: 'The TTL that matters during a change is the one caches already hold, which is the old one. Lower it one full old-TTL early.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: '198.51.100.20 (new)', switch: '5 minutes' },
      metricTones: { switch: 'good', answer: 'good' },
      scene: {
        nodes: [{ ...resolver, status: 'ok', badge: 'refreshed in under 300 s' }, { ...auth, at: at(2, -5), status: 'active', badge: 'A 198.51.100.20' }, { ...oldSrv, badge: 'kept on until drained', chips: ['stragglers'] }, { ...newSrv, status: 'ok', chips: ['traffic arriving'] }],
        links: [link('resolver', 'auth', { style: 'dashed' }), link('resolver', 'srvA', { style: 'faint' }), link('resolver', 'srvB')],
        flows: [
          { path: ['resolver', 'auth', 'resolver'], tone: 'handshake', label: 'TTL ran out, ask again', duration: 1.8 },
          { path: ['resolver', 'srvB'], tone: 'request', count: 3, duration: 1.8, delay: 2 },
          { path: ['resolver', 'srvA'], tone: 'request', label: 'last stragglers', duration: 1.8, delay: 2.4 },
        ],
        panel: {
          title: 'Move plan',
          icon: 'List',
          rows: [
            { text: 'Day -1: TTL to 300 s', value: 'wait 24 h' },
            { text: 'Day 0: change the IP', value: '5 min to spread', tone: 'good' },
            { text: 'Day 1: old server idle?', value: 'then switch off' },
            { text: 'Afterwards: raise TTL', value: '86,400 s' },
          ],
        },
        caption: 'Short TTL first, then move, then wait',
      },
      quiz: {
        question: 'Your A record has a TTL of 86,400 s. You must move to a new IP next Tuesday with as little disruption as possible. What do you do first?',
        options: [
          'Change the IP on Tuesday and switch the old server off right away',
          'Lower the TTL to 300 s at least a day before, then change the IP on Tuesday and keep the old server up until its traffic drains',
          'Lower the TTL to 300 s on Tuesday at the same moment you change the IP',
          'Raise the TTL so the change is cached for longer',
        ],
        answer: 1,
        explain: 'Caches already hold the record with the old 24-hour TTL. Lowering the TTL only helps once those copies have expired, so it must happen at least a day ahead. Lowering it at the same moment as the change leaves old answers alive for up to 24 hours.',
      },
    },
    {
      title: 'DNS is down',
      tag: 'case',
      heading: 'Case: healthy servers that nobody can find',
      eli5: 'If the teacher is away and the sticky notes run out, nobody can find Maya even though she is sitting right there. When the **authoritative** server is down, a healthy **server** becomes unreachable.',
      body: [
        'If your **authoritative DNS provider goes down**, your servers stay fine but the site vanishes as cached answers expire. Short TTLs make this faster. DDoS floods and **amplification** (small queries, big replies) cause such outages, as at Dyn in 2016.',
        'The defense is two name servers on separate networks, and for large sites two DNS providers. Add a check that resolves your own names from outside. It also catches deleted records and expired domains.',
      ],
      keyIdea: 'If DNS cannot answer, nothing behind it matters. Give it redundancy and monitoring like any other part of the system.',
      metrics: { lookup: 'fails', ttl: '300 s', answer: 'none (SERVFAIL)', switch: '-' },
      metricTones: { lookup: 'bad', answer: 'bad' },
      scene: {
        nodes: [{ ...laptop, status: 'hot', badge: 'cannot find the site' }, { ...resolver, status: 'hot', badge: 'cache expired' }, { ...auth, status: 'down', badge: 'provider outage' }, { ...newSrv, status: 'ok', badge: 'healthy, idle' }],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'dashed', label: 'no reply', labelTone: 'warn' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'shop.example?', duration: 1 },
          { path: ['resolver', 'auth'], tone: 'error', label: 'no reply', duration: 1.6, delay: 1.1 },
          { path: ['resolver', 'laptop'], tone: 'error', label: 'SERVFAIL', duration: 1, delay: 2.9 },
        ],
        panel: {
          title: 'The defenses',
          icon: 'Shield',
          rows: [
            { text: 'Two name servers, separate networks', value: 'minimum', tone: 'good' },
            { text: 'Two DNS providers', value: 'large sites', tone: 'good' },
            { text: 'Outside check on your names', value: 'alert on change', tone: 'good' },
          ],
        },
        caption: 'The server is fine. The name is gone.',
      },
    },
    {
      title: 'Spoofing, DNSSEC',
      tag: 'concept',
      heading: 'Plain DNS can be lied to, and DNSSEC signs the answers',
      eli5: 'Anyone could slip the helper a fake note saying "Maya is in room 9". With **DNSSEC** every note carries the teacher\'s signature, so the helper can check it.',
      body: [
        'Classic DNS cannot prove who sent an answer. An attacker who races the real reply can plant a false record in a resolver\'s cache: **cache poisoning**.',
        '**DNSSEC** signs records with keys (**DNSKEY**, **RRSIG** signatures, **DS** links between levels). Each level vouches for the key below it, from the root down, so a resolver can reject a forgery. It proves the answer is genuine. It does not hide the question. Random ports and query IDs also make forgeries harder.',
      ],
      keyIdea: 'DNSSEC proves an answer is genuine by signing it. It adds integrity, not privacy.',
      metrics: { lookup: '-', ttl: '300 s', answer: 'signed', switch: '5 minutes' },
      scene: {
        nodes: [{ ...resolver, status: 'active', chips: [{ text: 'checks signature', tone: 'good' }] }, { id: 'fake', kind: 'block', at: at(-6, -3.5), label: 'attacker', sub: 'forged reply', icon: 'Bug', tint: 'red' }, { ...auth, status: 'ok', chips: ['signed A record'] }],
        links: [link('resolver', 'auth', { style: 'dashed' }), link('fake', 'resolver', { style: 'faint', label: 'fake answer', labelTone: 'warn' })],
        flows: [
          { path: ['fake', 'resolver'], tone: 'error', label: 'forged', duration: 1.4 },
          { path: ['auth', 'resolver'], tone: 'response', label: 'A + signature', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Chain of trust',
          icon: 'KeyRound',
          rows: [
            { text: 'Root', value: 'DS for .example', tone: 'good' },
            { text: '.example', value: 'DS for shop.example', tone: 'good' },
            { text: 'shop.example', value: 'RRSIG on each record', tone: 'good' },
          ],
          footer: { text: 'Forged answers fail the check', tone: 'good' },
        },
        caption: 'Signed answers beat forged ones',
      },
    },
    {
      title: 'On the wire',
      tag: 'concept',
      heading: 'Plain DNS is small, fast and readable by anyone',
      eli5: 'The helper shouts the question across the hall. It is quick, but everyone nearby can hear it. **DoH** and **DoT** put the question in a sealed envelope.',
      body: [
        'DNS runs on **UDP port 53**: one small packet out, one back, with no handshake. It falls back to **TCP** when an answer is too big, such as signed DNSSEC data. Anyone on the path can read the questions.',
        '**DoT** (DNS over TLS) and **DoH** (DNS over HTTPS) encrypt the hop between your laptop and the resolver. That hides which names you look up from the network. The resolver still sees them.',
      ],
      keyIdea: 'Plain DNS uses UDP 53 and is readable on the path. DoT and DoH encrypt the laptop-to-resolver hop.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: '198.51.100.20', switch: '5 minutes' },
      scene: {
        nodes: [{ ...laptop, chips: ['DoH on'] }, { ...resolver, status: 'ok', chips: ['sees the names'] }, { ...auth, status: 'dim' }],
        links: [link('laptop', 'resolver', { label: 'encrypted · HTTPS 443', arrow: 'both' }), link('resolver', 'auth', { style: 'dashed', label: 'UDP 53', arrow: 'both' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'handshake', label: 'sealed question', duration: 1.4 },
          { path: ['resolver', 'laptop'], tone: 'response', label: 'sealed answer', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Transports',
          icon: 'Cable',
          rows: [
            { text: 'UDP 53', value: 'default, readable' },
            { text: 'TCP 53', value: 'big answers' },
            { text: 'DoT, port 853', value: 'TLS', tone: 'good' },
            { text: 'DoH, port 443', value: 'HTTPS', tone: 'good' },
          ],
        },
        caption: 'Encryption hides the question from the network',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A cached, hierarchical phone book with a timer on every entry',
      eli5: 'The helper asks the principal, the grade office and the teacher, then keeps a sticky note until it runs out. The **resolver** is the helper, and the **authoritative** server is the teacher with the real list.',
      body: [
        'A **resolver** walks **root**, **TLD** and **authoritative** servers, about 80 ms cold, and caches each reply for its **TTL**. Most lookups then cost 0 to 10 ms. Records come in types: **A**, **AAAA**, **CNAME**, **MX**, **TXT**.',
        'Most DNS trouble is cache trouble. Lower TTLs before a change, keep old targets alive until they drain, run two name servers, and watch your names from outside. DNS can spread load and fail over, in minutes at best.',
      ],
      keyIdea: 'DNS is fast because everyone caches it and slow to change for the same reason. The TTL is the dial between the two.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: '198.51.100.20', switch: '5 minutes' },
      metricTones: { lookup: 'good', switch: 'good' },
      scene: {
        nodes: [laptop, { ...resolver, status: 'ok' }, { ...auth, status: 'ok' }, { ...newSrv, label: 'server', status: 'ok' }],
        links: [link('laptop', 'resolver'), link('resolver', 'auth', { style: 'dashed' }), link('laptop', 'srvB', { style: 'faint' })],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', duration: 0.9 },
          { path: ['resolver', 'laptop'], tone: 'response', label: 'cached answer', duration: 0.9, delay: 1 },
          { path: ['laptop', 'srvB'], tone: 'request', count: 2, duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Keep these',
          icon: 'Star',
          rows: [
            { text: 'Cold lookup', value: '80 ms' },
            { text: 'Cached lookup', value: '0 to 10 ms', tone: 'good' },
            { text: 'Before a move', value: 'lower the TTL a day early', tone: 'good' },
          ],
        },
        caption: 'Ask once, remember, connect',
      },
      quiz: {
        question: 'A resolver caches "no such name" for api.shop.example. You then create the record. Why might some users still fail?',
        options: ['The record needs a reboot to take effect', 'The negative answer is cached until its negative TTL ends', 'DNS records only work after 24 hours', 'The root servers must be updated'],
        answer: 1,
        explain: 'NXDOMAIN answers are cached like any other, for the time given in the SOA record. Create records before you announce them.',
      },
    },
  ],
};
