import type { Lesson, SceneNode } from '../engine/types';

const laptop: SceneNode = { id: 'laptop', kind: 'client', at: [-3.3, 4.3], label: 'laptop', sub: 'Paris' };
const laptop2: SceneNode = { id: 'laptop2', kind: 'client', at: [-6.6, 1], label: 'laptop', sub: 'Texas' };
const resolver: SceneNode = { id: 'resolver', kind: 'dns', at: [-2.3, 2.3], label: 'resolver', sub: 'at your ISP' };
const root: SceneNode = { id: 'root', kind: 'dns', at: [-2.9, -1.1], label: 'root' };
const tld: SceneNode = { id: 'tld', kind: 'dns', at: [-0.6, -1.4], label: '.example TLD' };
const auth: SceneNode = { id: 'auth', kind: 'dns', at: [1.8, -1.8], label: 'authoritative', sub: 'ns1.shop.example' };
const oldSrv: SceneNode = { id: 'srvA', kind: 'server', at: [1.5, -5.1], label: 'old server', sub: '203.0.113.10' };
const newSrv: SceneNode = { id: 'srvB', kind: 'server', at: [5.1, -1.5], label: 'new server', sub: '198.51.100.20' };
const euSrv: SceneNode = { ...oldSrv, label: 'EU server' };
const usSrv: SceneNode = { ...newSrv, label: 'US server' };

const walkLinks = [
  { from: 'laptop', to: 'resolver' },
  { from: 'resolver', to: 'root', style: 'dashed' as const },
  { from: 'resolver', to: 'tld', style: 'dashed' as const },
  { from: 'resolver', to: 'auth', style: 'dashed' as const },
];

const regionZones = [
  { id: 'eu', from: [0.6, -6] as [number, number], to: [2.4, -4.2] as [number, number], label: 'Europe', tone: 'blue' as const },
  { id: 'us', from: [4.2, -2.4] as [number, number], to: [6, -0.6] as [number, number], label: 'US', tone: 'green' as const },
];

export const dns: Lesson = {
  id: 'dns',
  title: 'DNS in depth',
  tagline: 'How a name becomes an address, who remembers the answer and for how long, and how that memory can take a site down.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'The lookup chain: resolver, root, TLD and authoritative servers',
    'The record types A, AAAA, CNAME, MX and TXT',
    'TTLs and the layers of caches that hold an answer',
    'How DNS spreads load and fails over between servers',
    'The common DNS failures and how to avoid them',
  ],
  metrics: [
    { key: 'lookup', label: 'Lookup time' },
    { key: 'ttl', label: 'TTL' },
    { key: 'answer', label: 'Answer' },
    { key: 'switch', label: 'Worst-case switch' },
  ],
  steps: [
    {
      title: 'Moving day',
      tag: 'problem',
      heading: 'We moved the site, and half the visitors went to the old address',
      eli5: 'Your friend Maya moved to a new desk. The helper at the front office still has yesterday\'s note, so the **resolver** keeps sending kids to the **old server**, an empty desk.',
      body: [
        'On Friday the shop moves from an old server at `203.0.113.10` to a new one at `198.51.100.20`. The team updates DNS, sees the site load from the new machine, and switches the old one off.',
        'For the next day, complaints arrive: "the site is down". It is down only for some people. Others see it fine. Nothing is wrong with the new server.',
        'An earlier lesson said DNS turns a name into an address and that the answer is cached. This lesson opens that box. Once you know who caches an answer and for how long, this outage is easy to explain and easy to prevent.',
      ],
      keyIdea: 'A DNS change does not reach everyone at once. Old answers live on in caches until they expire.',
      metrics: { lookup: '0 ms (cached)', ttl: '86,400 s', answer: '203.0.113.10 (old)', switch: '24 hours' },
      scene: {
        nodes: [
          laptop,
          { ...resolver, status: 'hot', badge: 'cached: 203.0.113.10' },
          { ...oldSrv, status: 'down', badge: 'switched off' },
          { ...newSrv, status: 'ok', badge: 'ready, no visitors' },
        ],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'laptop', to: 'srvA', style: 'faint' },
        ],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'shop.example?', duration: 1 },
          { path: ['resolver', 'laptop'], tone: 'response', label: '203.0.113.10', duration: 1, delay: 1.1 },
          { path: ['laptop', 'srvA'], tone: 'error', label: 'no answer', duration: 1.8, delay: 2.3 },
        ],
        caption: 'A stale answer points at a dead machine',
      },
    },
    {
      title: 'Name tree',
      tag: 'concept',
      heading: 'Names are a tree, read from right to left',
      eli5: 'To find Maya you ask the principal\'s office which building has grade 4, then the grade office which room is 4B, then the teacher. The **root**, the **TLD** and the **authoritative** server are those three stops.',
      body: [
        'No single machine knows every name on the internet. DNS splits the job into a tree, and a name is a path through it, read from right to left.',
        'Take `www.shop.example`. At the top are the **root** servers, which know who runs each ending. Next come the **TLD** (top-level domain) servers for `.example`, which know who runs each name under it. Real TLDs are `.com`, `.org`, `.io` and so on. Last is the **authoritative** server for `shop.example`. It holds the real records and is the source of truth.',
        'Each level only knows the next level down. That is what lets the system grow: the owner of `shop.example` can add `api.shop.example` without telling anyone above.',
      ],
      keyIdea: 'DNS is a hierarchy: root knows the TLDs, a TLD knows the domains under it, and the authoritative server knows the actual records.',
      metrics: { lookup: '-', ttl: '86,400 s', answer: '-', switch: '24 hours' },
      scene: {
        nodes: [
          { ...root, status: 'active', badge: 'knows: who runs .example' },
          { ...tld, status: 'active', badge: 'knows: who runs shop' },
          { ...auth, status: 'active', badge: 'knows: the records' },
        ],
        links: [
          { from: 'root', to: 'tld', label: 'points to' },
          { from: 'tld', to: 'auth', label: 'points to' },
        ],
        flows: [{ path: ['root', 'tld', 'auth'], tone: 'data', label: 'www.shop.example', duration: 2.6 }],
        caption: 'Each level knows only the next one down',
      },
    },
    {
      title: 'The lookup',
      tag: 'concept',
      heading: 'The resolver walks the tree for you',
      eli5: 'You do not walk to three offices yourself. You ask the helper at the front desk, the **resolver**, and the helper goes to the root, the TLD and the authoritative teacher, then brings back the desk number.',
      body: [
        'Your laptop does not query the tree itself. It sends one question to a **recursive resolver**, usually run by your internet provider or a public service. The resolver does the legwork.',
        'With an empty cache it asks a root server, which replies "ask the `.example` servers". It asks one of those, which replies "ask `ns1.shop.example`". It asks that authoritative server, which replies with the address. The resolver hands the answer to your laptop.',
        'Three questions at about 25 ms each, plus the hop from your laptop: a cold lookup takes around **80 ms**. The resolver then caches every reply. It already knows where the `.example` servers are for the next name, so the root is rarely asked at all.',
      ],
      keyIdea: 'A client asks one resolver. The resolver asks root, then TLD, then authoritative, and remembers every answer on the way.',
      metrics: { lookup: '80 ms (cold)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      scene: {
        nodes: [laptop, { ...resolver, status: 'active' }, root, tld, { ...auth, badge: 'A 203.0.113.10' }],
        links: walkLinks,
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'www.shop.example?', duration: 0.9 },
          { path: ['resolver', 'root', 'resolver'], tone: 'handshake', label: '1: ask .example', duration: 1.6, delay: 1 },
          { path: ['resolver', 'tld', 'resolver'], tone: 'handshake', label: '2: ask ns1', duration: 1.6, delay: 2.7 },
          { path: ['resolver', 'auth', 'resolver'], tone: 'handshake', label: '3: the address', duration: 1.6, delay: 4.4 },
          { path: ['resolver', 'laptop'], tone: 'response', label: '203.0.113.10', duration: 0.9, delay: 6.1 },
        ],
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
      title: 'Record types',
      tag: 'concept',
      heading: 'One name, several kinds of record',
      eli5: 'The teacher\'s book has more than desk numbers. It also lists nicknames, where to drop letters, and notes pinned to the board. The **authoritative** server keeps a line for each kind.',
      body: [
        'The authoritative server stores **records**. Each has a name, a type, a value and a TTL. An **A** record maps a name to an IPv4 address. An **AAAA** record maps it to an IPv6 address.',
        'A **CNAME** says "this name is an alias for that other name, look that one up instead". It is how `www.shop.example` can follow `shop.example`, or how a name can point at a CDN. A CNAME cannot share a name with other records, so it cannot sit on the bare domain `shop.example` itself.',
        'An **MX** record names the mail servers for the domain, with a priority number where lower is tried first. A **TXT** record holds free text, used to prove you own a domain and to publish which servers may send email for it. **NS** records name the authoritative servers themselves.',
      ],
      keyIdea: 'A and AAAA give addresses, CNAME gives an alias, MX routes email, TXT carries verification text, NS says who is authoritative.',
      metrics: { lookup: '80 ms (cold)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      scene: {
        nodes: [laptop, resolver, { ...auth, status: 'active', badge: 'A, AAAA, CNAME, MX, TXT' }],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'resolver', to: 'auth', style: 'dashed' },
        ],
        flows: [
          { path: ['resolver', 'auth'], tone: 'request', label: 'MX shop.example?', duration: 1.4 },
          { path: ['auth', 'resolver'], tone: 'response', label: '10 mail.shop.example', duration: 1.4, delay: 1.6 },
          { path: ['resolver', 'auth'], tone: 'request', label: 'A www.shop.example?', duration: 1.4, delay: 3.4 },
          { path: ['auth', 'resolver'], tone: 'response', label: 'CNAME shop.example', duration: 1.4, delay: 5 },
        ],
        caption: 'The question names a type, the answer matches it',
      },
      code: {
        language: 'bash',
        title: 'The records for shop.example (name, TTL, type, value)',
        source: `shop.example.        86400  A      203.0.113.10
shop.example.        86400  AAAA   2001:db8::10
www.shop.example.    86400  CNAME  shop.example.
shop.example.        3600   MX     10 mail.shop.example.
shop.example.        3600   TXT    "v=spf1 mx -all"
shop.example.        86400  NS     ns1.shop.example.
shop.example.        86400  NS     ns2.shop.example.`,
        highlight: [1, 3, 4],
      },
    },
    {
      title: 'TTL, caches',
      tag: 'concept',
      heading: 'Every answer carries a timer, and many caches keep it',
      eli5: 'The helper writes the desk number on a sticky note marked "good until lunch". Until lunch, the **resolver** reads the note and never asks the teacher again. Your laptop keeps its own note too.',
      body: [
        'Each record has a **TTL** (time to live) in seconds. It tells anyone who receives the answer how long they may reuse it before asking again.',
        'The answer is cached in layers. The **browser** keeps it. The **operating system** keeps it. The **resolver** keeps it, and one resolver may serve a whole city of users. Each layer counts the TTL down and only asks upstream when it reaches zero.',
        'This is why DNS feels free. A repeat visit costs 0 ms from the local cache. A first visit to a popular site costs about 10 ms, because someone else already filled the resolver\'s cache. Only a name nobody nearby has asked for recently pays the full 80 ms.',
      ],
      keyIdea: 'TTL is a promise the domain owner makes: "you may reuse this answer for this long". Every cache on the path takes that promise literally.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '86,400 s', answer: '203.0.113.10', switch: '24 hours' },
      scene: {
        nodes: [
          { ...laptop, status: 'ok', badge: 'browser + OS cache' },
          { ...resolver, status: 'ok', badge: 'cached, 86,212 s left' },
          { ...auth, status: 'dim' },
        ],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'resolver', to: 'auth', style: 'faint' },
        ],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'www.shop.example?', duration: 0.9 },
          { path: ['resolver', 'laptop'], tone: 'response', label: 'from cache, 10 ms', duration: 0.9, delay: 1 },
        ],
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
      eli5: 'A note that is good all year means the helper rarely bothers the teacher, but a desk change goes unnoticed for ages. A note good for five minutes keeps the **resolver** up to date and the teacher busy.',
      body: [
        'A **long TTL**, such as 86,400 s (one day), means few lookups, fast page loads, and protection if your authoritative servers have a bad hour, because caches keep answering. The cost: any change takes up to a day to reach everyone.',
        'A **short TTL**, such as 300 s (five minutes), means a change reaches everyone within five minutes. The cost: resolvers come back 288 times more often than with a one-day TTL, more visits pay for a lookup, and an outage at your DNS provider hurts within minutes.',
        'A common middle ground is a few minutes for records that might need to move (the addresses of your servers) and hours or a day for those that rarely change (`MX`, `NS`). And before a planned move, lower the TTL well ahead of time.',
      ],
      keyIdea: 'TTL trades speed and resilience against how quickly you can change your mind. Choose it per record, by how fast that record may need to move.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: '203.0.113.10', switch: '5 minutes' },
      scene: {
        nodes: [
          laptop,
          { ...resolver, status: 'active', badge: 'asks again every 300 s' },
          { ...auth, status: 'active', badge: '288x more questions' },
        ],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'resolver', to: 'auth', style: 'dashed' },
        ],
        flows: [
          { path: ['resolver', 'auth'], tone: 'request', label: 'still 203.0.113.10?', count: 3, duration: 1.4 },
          { path: ['auth', 'resolver'], tone: 'response', label: 'yes, TTL 300', count: 3, duration: 1.4, delay: 1.6 },
        ],
        caption: 'Short TTL: fresher answers, more questions',
      },
    },
    {
      title: 'Spread load',
      tag: 'concept',
      heading: 'DNS as a load balancer',
      eli5: 'Maya\'s class now has two rooms. When a kid from the east wing asks, the teacher names the east room. For the west wing, the west room. The **authoritative** server picks the nearest **server** the same way.',
      body: [
        'A name can have several A records. The authoritative server returns them all and rotates the order, and most clients use the first. This **round-robin DNS** spreads users across servers with no extra hardware. **Weighted** records skew the split, for example 90% to one server and 10% to a new one under test.',
        'Managed DNS services go further with **geo routing**: they look at where the question comes from and answer with the closest region. A user in Paris gets the Europe address and a user in Texas gets the US one. CDNs and multi-region systems, covered later, start from this trick.',
        'It is a blunt tool. DNS does not know how busy a server is. And since one resolver\'s cached answer serves thousands of people, traffic arrives in uneven lumps. DNS picks a region or a front door. A real load balancer behind it does the fine-grained work.',
      ],
      keyIdea: 'By giving different answers to different askers, DNS can steer users to a server or a region. It is coarse, cached and blind to load.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: 'depends on who asks', switch: '5 minutes' },
      scene: {
        nodes: [
          { ...laptop, badge: 'gets 203.0.113.10' },
          { ...laptop2, badge: 'gets 198.51.100.20' },
          resolver,
          { ...auth, status: 'active', badge: 'answers by region' },
          { ...euSrv, status: 'ok' },
          { ...usSrv, status: 'ok' },
        ],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'resolver', to: 'auth', style: 'dashed' },
          { from: 'laptop', to: 'srvA', style: 'faint' },
          { from: 'laptop2', to: 'srvB', style: 'faint' },
        ],
        zones: regionZones,
        flows: [
          { path: ['laptop', 'resolver', 'auth'], tone: 'request', label: 'from Paris', duration: 1.8 },
          { path: ['auth', 'resolver', 'laptop'], tone: 'response', label: 'EU address', duration: 1.8, delay: 2 },
          { path: ['laptop', 'srvA'], tone: 'request', duration: 1.6, delay: 4 },
          { path: ['laptop2', 'srvB'], tone: 'request', label: 'Texas goes to US', duration: 1.6, delay: 4 },
        ],
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
        'The Europe server dies. Detection takes about 30 seconds. Then every cache must expire, which takes up to one TTL. With a 60 s TTL, the worst case is about **90 seconds** before Paris is sent to the US server. With a one-day TTL it would be a day.',
        'Treat that number as a floor. Some resolvers and some apps hold answers longer than the TTL says, and a browser with an open connection keeps trying the address it has. DNS failover is good for moving traffic between regions in minutes. For failing over in a second or two, put a load balancer with a stable address in front of the servers.',
      ],
      keyIdea: 'DNS failover time is detection time plus TTL, plus whatever stubborn caches add. It works in minutes, never in milliseconds.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '60 s', answer: '198.51.100.20 (US)', switch: 'about 90 s' },
      scene: {
        nodes: [
          { ...laptop, badge: 'now gets 198.51.100.20' },
          resolver,
          { ...auth, status: 'active', badge: 'EU failed 3 checks' },
          { ...euSrv, status: 'down', badge: 'removed from answers' },
          { ...usSrv, status: 'ok', badge: 'takes Paris too' },
        ],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'resolver', to: 'auth', style: 'dashed' },
          { from: 'auth', to: 'srvA', style: 'faint', label: 'health check' },
          { from: 'auth', to: 'srvB', style: 'faint', label: 'health check' },
          { from: 'laptop', to: 'srvB', style: 'faint' },
        ],
        zones: regionZones,
        flows: [
          { path: ['auth', 'srvA'], tone: 'error', label: 'check failed', duration: 1.2 },
          { path: ['auth', 'srvB', 'auth'], tone: 'handshake', label: 'check ok', duration: 1.6, delay: 0.2 },
          { path: ['auth', 'resolver', 'laptop'], tone: 'response', label: 'US address', duration: 1.8, delay: 2 },
          { path: ['laptop', 'srvB'], tone: 'request', duration: 1.8, delay: 4 },
        ],
        caption: 'The dead address drops out of the answers',
      },
    },
    {
      title: 'Friday, fixed',
      tag: 'case',
      heading: 'Case: how the Friday move should have gone',
      eli5: 'Before Maya moves desks, the teacher tells the helper "from now on your notes are only good for five minutes". On moving day every **resolver** learns the new desk almost at once.',
      body: [
        'Back to the outage. The A record had a TTL of 86,400 s. Any resolver that looked the name up on Friday morning was allowed to keep answering `203.0.113.10` until Saturday morning. The team\'s own laptops showed the new server only because their caches happened to refresh. Then they switched the old server off.',
        'The safe sequence takes three moves. **Days before**: lower the TTL to 300 s, then wait at least one full old TTL (24 hours) so every cache holds the short one. **On the day**: change the address. Within five minutes nearly everyone follows.',
        '**After**: keep the old server running and watch its traffic fall to zero before switching it off. Then raise the TTL again. The rule underneath: the TTL that matters during a change is the one caches already hold, which is the old one.',
      ],
      keyIdea: 'Lower the TTL one full old-TTL before a change, keep the old target alive until its traffic drains, then raise the TTL again.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: '198.51.100.20 (new)', switch: '5 minutes' },
      scene: {
        nodes: [
          laptop,
          { ...resolver, status: 'ok', badge: 'refreshed in under 300 s' },
          { ...auth, status: 'active', badge: 'A 198.51.100.20' },
          { ...oldSrv, badge: 'kept on until drained' },
          { ...newSrv, status: 'ok', badge: 'traffic arriving' },
        ],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'resolver', to: 'auth', style: 'dashed' },
          { from: 'laptop', to: 'srvA', style: 'faint' },
          { from: 'laptop', to: 'srvB' },
        ],
        flows: [
          { path: ['resolver', 'auth', 'resolver'], tone: 'handshake', label: 'TTL ran out, ask again', duration: 1.8 },
          { path: ['resolver', 'laptop'], tone: 'response', label: '198.51.100.20', duration: 0.9, delay: 2 },
          { path: ['laptop', 'srvB'], tone: 'request', count: 3, duration: 1.8, delay: 3 },
          { path: ['laptop', 'srvA'], tone: 'request', label: 'last stragglers', duration: 1.8, delay: 3.4 },
        ],
        caption: 'Short TTL first, then move, then wait',
      },
    },
    {
      title: 'DNS is down',
      tag: 'case',
      heading: 'Case: healthy servers that nobody can find',
      eli5: 'If the teacher is away and the sticky notes run out, nobody can find Maya even though she is sitting right there. When the **authoritative** server is down, a healthy **server** becomes unreachable.',
      body: [
        'DNS sits in front of everything, so its failures look like total outages. The worst one: your **authoritative DNS provider goes down**. Your servers are fine. As cached answers expire, resolvers get no reply and the site disappears, a few more users every minute. Short TTLs make this faster. The defense is at least two name servers on separate networks, and for large sites two DNS providers.',
        'A quieter one is **negative caching**. If someone looks up `api.shop.example` before the record exists, the "no such name" answer is cached too, often for minutes. You add the record, it works for you and still fails for them.',
        'And the plain mistakes: a typo in an address, a deleted record, or a domain registration that expired because the renewal email went to someone who left. All of them are cheap to prevent with a check that resolves your own names from outside and alerts when the answer changes.',
      ],
      keyIdea: 'If DNS cannot answer, nothing behind it matters. Give it redundancy and monitoring like any other part of the system.',
      metrics: { lookup: 'fails', ttl: '300 s', answer: 'none (SERVFAIL)', switch: '-' },
      scene: {
        nodes: [
          { ...laptop, status: 'hot', badge: 'cannot find the site' },
          { ...resolver, status: 'hot', badge: 'cache expired' },
          { ...auth, status: 'down', badge: 'provider outage' },
          { ...newSrv, status: 'ok', badge: 'healthy, idle' },
        ],
        links: [
          { from: 'laptop', to: 'resolver' },
          { from: 'resolver', to: 'auth', style: 'dashed' },
        ],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', label: 'shop.example?', duration: 1 },
          { path: ['resolver', 'auth'], tone: 'error', label: 'no reply', duration: 1.6, delay: 1.1 },
          { path: ['resolver', 'laptop'], tone: 'error', label: 'SERVFAIL', duration: 1, delay: 2.9 },
        ],
        caption: 'The server is fine. The name is gone.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A cached, hierarchical phone book with a timer on every entry',
      eli5: 'The helper asks the principal, the grade office and the teacher, then keeps a sticky note until it runs out. The **resolver** is the helper, and the **authoritative** server is the teacher with the real list.',
      body: [
        'A client asks a **resolver**. The resolver walks **root**, **TLD** and **authoritative** servers, about 80 ms cold, and caches each reply for its **TTL**. Browser, operating system and resolver caches make most lookups cost 0 to 10 ms.',
        'Records come in types: **A** and **AAAA** for addresses, **CNAME** for aliases, **MX** for mail, **TXT** for verification. By answering differently per asker, DNS can spread load, route by region and fail over, in minutes at best.',
        'Most DNS trouble is cache trouble. Lower TTLs before a change, keep old targets alive until they drain, run more than one name server, and watch your own names from outside.',
      ],
      keyIdea: 'DNS is fast because everyone caches it and slow to change for the same reason. The TTL is the dial between the two.',
      metrics: { lookup: '0 to 10 ms (cached)', ttl: '300 s', answer: '198.51.100.20', switch: '5 minutes' },
      scene: {
        nodes: [laptop, { ...resolver, status: 'ok' }, root, tld, { ...auth, status: 'ok' }, { ...newSrv, label: 'server', status: 'ok' }],
        links: [...walkLinks, { from: 'laptop', to: 'srvB', style: 'faint' as const }],
        flows: [
          { path: ['laptop', 'resolver'], tone: 'request', duration: 0.9 },
          { path: ['resolver', 'laptop'], tone: 'response', label: 'cached answer', duration: 0.9, delay: 1 },
          { path: ['laptop', 'srvB'], tone: 'request', count: 2, duration: 2, delay: 2.1 },
        ],
        caption: 'Ask once, remember, connect',
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
  ],
};
