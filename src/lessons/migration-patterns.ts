import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'phone', at: at(-9, 0), label: 'shoppers' };
const facade: SceneNode = { id: 'facade', kind: 'block', at: at(-6, 0), label: 'facade', sub: 'routing proxy', icon: 'Split', tint: 'violet' };
const legacy: SceneNode = { id: 'legacy', kind: 'server', at: at(-2.5, -4), label: 'old monolith', sub: '12 years old' };
const legacyDb: SceneNode = { id: 'legacyDb', kind: 'db', at: at(3.5, -4), label: 'old database', sub: 'ORD_HDR, CUST_MSTR' };
const orders: SceneNode = { id: 'orders', kind: 'block', size: 0.85, at: at(0.5, 4), label: 'orders service', sub: 'new', icon: 'ShoppingBag', tint: 'amber' };
const newDb: SceneNode = { id: 'newDb', kind: 'db', at: at(3.5, 4), label: 'orders DB', sub: 'new schema' };
const acl: SceneNode = { id: 'acl', kind: 'block', size: 0.8, at: at(3.5, 0), label: 'translator', sub: 'anti-corruption layer', icon: 'ArrowLeftRight', tint: 'teal' };
const rewrite: SceneNode = { id: 'rewrite', kind: 'block', size: 0.85, at: at(0.5, 4), label: 'the rewrite', sub: 'month 18 of 12', icon: 'Boxes', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const migrationPatterns: Lesson = {
  id: 'migration-patterns',
  title: 'Migration: strangler fig, anti-corruption layer (part 1)',
  tagline: 'Replace an old system one slice at a time while it keeps serving customers, instead of betting everything on one cutover day.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'Why big-bang rewrites so often run late or fail at cutover',
    'The strangler fig: a facade that routes one slice at a time to the new system',
    'How to pick a slice, route by rule, and cut inside the monolith when no network seam exists',
    'An anti-corruption layer that keeps the old model out of the new code',
    'Why each slice should own its own database',
    'What the facade costs, how sessions carry over, and what breaks when tables are split',
  ],
  metrics: [
    { key: 'share', label: 'Traffic on new', icon: 'Split' },
    { key: 'blast', label: 'Blast radius', icon: 'Zap' },
    { key: 'systems', label: 'Systems running', icon: 'Server' },
    { key: 'diff', label: 'Mismatches', icon: 'Scale' },
  ],
  steps: [
    {
      title: 'Big bang',
      tag: 'problem',
      heading: 'The rewrite that never ships',
      eli5: 'A bakery decides to build a brand new shop and move everything in one night. The new shop takes years, the old one keeps changing, and moving night is terrifying.',
      body: [
        'The shop runs on a 12-year-old monolith. Changes are slow and scary, so the team plans a full rewrite: build the new system on the side, then switch everything over one weekend.',
        'Nothing reaches customers until that weekend. All the value and all the risk wait for one day.',
      ],
      keyIdea: 'A big-bang rewrite delivers no value until the last day and puts all the risk in one switch.',
      metrics: { share: '0%', blast: 'everything', systems: '2', diff: 'unknown' },
      metricTones: { share: 'bad', blast: 'bad', diff: 'bad' },
      scene: {
        nodes: [users, { ...legacy, status: 'active', badge: 'still changing' }, { ...rewrite, status: 'hot', badge: 'not ready' }],
        links: [link('users', 'legacy'), link('users', 'rewrite', { style: 'faint', label: 'switch day?', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'legacy'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['users', 'rewrite'], tone: 'error', label: 'all at once', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'The plan on paper',
          icon: 'Clock',
          rows: [
            { text: 'Planned length', value: '12 months' },
            { text: 'Where we are', value: 'month 18', tone: 'bad' },
            { text: 'Customers served by new code', value: '0', tone: 'bad' },
          ],
        },
        caption: 'All traffic still on the old system, all risk saved for one day',
      },
    },
    {
      title: 'Moving target',
      tag: 'case',
      heading: 'Case: month 18 of a 12-month plan',
      eli5: 'While the new bakery is being built, the old one keeps inventing new cakes. The builders must copy every new cake too, and nobody wrote down the old recipes.',
      body: [
        'The old system kept getting features, because the business could not wait. The rewrite chases a moving target.',
        'Nobody has written down all the odd rules buried in 12 years of code. The new system only finds them in production, on the day it is already too late to be calm.',
      ],
      keyIdea: 'The old system is the only complete spec, and it keeps changing while you copy it.',
      metrics: { share: '0%', blast: 'everything', systems: '2', diff: 'unknown' },
      metricTones: { diff: 'bad' },
      scene: {
        nodes: [{ ...legacy, status: 'active', chips: ['+ loyalty points', '+ gift wrap'] }, legacyDb, { ...rewrite, status: 'hot', chips: [{ text: 'missing rules', tone: 'bad' }] }],
        links: [link('legacy', 'legacyDb'), link('legacy', 'rewrite', { style: 'dashed', label: 'chasing', labelTone: 'warn' })],
        flows: [{ path: ['legacy', 'rewrite'], tone: 'error', label: 'new rule?', duration: 1.8 }],
        panel: {
          title: 'Rules found only in production',
          icon: 'Bug',
          rows: [
            { text: 'Round totals half-up per line', value: 'unwritten', tone: 'warn' },
            { text: 'Tax-free items for staff', value: 'unwritten', tone: 'warn' },
            { text: 'Orders older than 2019 use old codes', value: 'unwritten', tone: 'warn' },
          ],
        },
        caption: 'The target moves while the rewrite runs',
      },
    },
    {
      title: 'Cutover day',
      tag: 'problem',
      heading: 'Cutover is one switch for everything',
      eli5: 'Moving night means every cake, every customer and every recipe go to the new shop at once. If the new oven is broken, the whole town goes hungry.',
      body: [
        'Cutover day moves all traffic and all data at once. If anything is wrong, every customer sees it together.',
        'Rolling back after new orders have landed in the new database is its own project, because the old database never saw those orders.',
      ],
      keyIdea: 'One switch for all traffic and data means one failure hits everyone, and the way back is already closed.',
      metrics: { share: '0% then 100%', blast: 'everything', systems: '2', diff: 'unknown' },
      metricTones: { blast: 'bad' },
      scene: {
        nodes: [users, { ...legacy, status: 'dim' }, { ...rewrite, status: 'hot', load: 96 }],
        links: [link('users', 'legacy', { style: 'faint' }), link('users', 'rewrite', { label: '100% on switch day', labelTone: 'warn' })],
        flows: [{ path: ['users', 'rewrite'], tone: 'error', count: 6, label: 'every customer', duration: 1.6 }],
        panel: {
          title: 'After the switch',
          icon: 'Zap',
          rows: [
            { text: 'Customers affected by a bug', value: '100%', tone: 'bad' },
            { text: 'Rollback', value: 'new orders lost', tone: 'bad' },
          ],
        },
        caption: 'No gradual path, no easy way back',
      },
    },
    {
      title: 'Facade',
      tag: 'concept',
      heading: 'Put a facade in front of the old system',
      eli5: 'The bakery puts a greeter at the front door. Every customer talks to the greeter, who walks them to the right counter. The greeter is the **facade**.',
      body: [
        'The **strangler fig** pattern is named after a vine that grows around a tree until it can stand on its own. The first move changes nothing for customers: put a **facade** (a reverse proxy or API gateway) in front of the monolith.',
        'At first it forwards 100% of requests to the old system. That is the point: one place you control.',
      ],
      keyIdea: 'A facade in front of the old system gives you one switchboard where traffic can move slice by slice.',
      metrics: { share: '0%', blast: 'none yet', systems: '1 + facade', diff: '-' },
      metricTones: { blast: 'good' },
      scene: {
        nodes: [users, { ...facade, status: 'active', badge: '100% to old' }, legacy, legacyDb],
        links: [link('users', 'facade'), link('facade', 'legacy'), link('legacy', 'legacyDb')],
        flows: [
          { path: ['users', 'facade', 'legacy'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['legacy', 'facade', 'users'], tone: 'response', count: 2, duration: 1.8, delay: 2 },
        ],
        caption: 'Same behavior, but now every request passes one switchboard',
      },
    },
    {
      title: 'Routing rules',
      tag: 'concept',
      heading: 'The facade can route by many rules',
      eli5: 'The greeter can sort families by what they want, by who they are, or just by counting every hundredth family. Any sorting rule works.',
      body: [
        'Once every request passes the facade, a config change can move any URL, any header value, any customer group or any percentage to a new home.',
        'Hash a stable key such as the user id into a bucket, so one customer always lands on the same side. A user bouncing between old and new sees data jump around.',
      ],
      keyIdea: 'Route by path, header, cohort or percentage, and hash a stable key so each user stays on one side.',
      metrics: { share: '0%', blast: 'none yet', systems: '1 + facade', diff: '-' },
      scene: {
        nodes: [users, { ...facade, status: 'active', chips: ['GET /orders', 'x-beta: 1', 'uid % 100 < 1'] }, legacy, orders],
        links: [link('users', 'facade'), link('facade', 'legacy'), link('facade', 'orders', { style: 'faint' })],
        flows: [{ path: ['users', 'facade', 'legacy'], tone: 'request', count: 3, duration: 1.8 }],
        panel: {
          title: 'Routing keys',
          icon: 'Route',
          rows: [
            { text: 'Path', value: '/orders' },
            { text: 'Header', value: 'x-beta: 1' },
            { text: 'Cohort', value: 'staff accounts' },
            { text: 'Percentage', value: 'hash(uid) < 1%' },
          ],
        },
        caption: 'One switchboard, many ways to dial it',
      },
    },
    {
      title: 'Facade risks',
      tag: 'tradeoff',
      heading: 'The facade is a hop and a single point of failure',
      eli5: 'The greeter at the door is one more stop for every customer. If the greeter faints, nobody gets in, so the bakery needs two greeters who only point and never bake.',
      body: [
        'The **facade** adds a network hop to every request, often a millisecond or two. It is also a single point of failure: run at least two copies behind a load balancer, and give it its own dashboard for errors and latency.',
        'Keep it dumb. Routing and little else. Business logic in the facade becomes a second monolith that nobody owns.',
      ],
      keyIdea: 'The facade costs latency and is a single point of failure, so run it redundant, monitor it and keep logic out of it.',
      metrics: { share: '0%', blast: 'every request', systems: '1 + facade', diff: '-' },
      metricTones: { blast: 'warn' },
      scene: {
        nodes: [users, { ...facade, status: 'active', badge: '2 copies', chips: [{ text: '+2 ms', tone: 'warn' }] }, legacy],
        links: [link('users', 'facade'), link('facade', 'legacy')],
        flows: [{ path: ['users', 'facade', 'legacy'], tone: 'request', count: 3, duration: 1.8 }],
        panel: {
          title: 'Facade checklist',
          icon: 'Shield',
          rows: [
            { text: 'Added latency', value: '1 to 2 ms', tone: 'warn' },
            { text: 'Single point of failure', value: 'run 2+ copies', tone: 'warn' },
            { text: 'Own monitoring', value: 'errors, p99', tone: 'good' },
            { text: 'Business logic inside', value: 'none', tone: 'good' },
          ],
        },
        caption: 'One switchboard that must never be the outage',
      },
    },
    {
      title: 'Pick a slice',
      tag: 'concept',
      heading: 'Pick the first slice by its seams',
      eli5: 'Start with the cake counter, which has its own door and its own fridge. Do not start with the kitchen where everything touches everything.',
      body: [
        'Pick a part with clear edges, real business value and few dependencies. Order history is a good candidate. Payments, deeply tangled with everything, is not.',
        'A good first slice is read-heavy and easy to compare. Leave the tangled core for last, once the team has practiced.',
      ],
      keyIdea: 'Start where the seams are clean and the value is visible, and leave the tangled core for later.',
      metrics: { share: '0%', blast: 'none yet', systems: '1 + facade', diff: '-' },
      scene: {
        nodes: [{ ...legacy, status: 'active' }, { ...orders, status: 'ok', badge: 'candidate' }, legacyDb, newDb],
        links: [link('legacy', 'legacyDb'), link('orders', 'newDb')],
        panel: {
          title: 'Candidate slices',
          icon: 'List',
          rows: [
            { text: 'Order history', value: 'clear edges', tone: 'good' },
            { text: 'Product search', value: 'read-only', tone: 'good' },
            { text: 'Checkout and payments', value: 'tangled', tone: 'bad' },
            { text: 'Inventory', value: 'shared tables', tone: 'warn' },
          ],
          footer: { text: 'Start with order history', tone: 'good' },
        },
        caption: 'Choose a slice with edges you can cut',
      },
    },
    {
      title: 'First slice',
      tag: 'concept',
      heading: 'Route one slice to the new service',
      eli5: 'The bakery opens a shiny new cake counter. The greeter sends cake buyers there and everyone else to the old counters, which keep working as before.',
      body: [
        'The team builds the new **orders service** for one job: showing order history. The facade sends `GET /orders` to it, and every other method and path, such as `POST /orders`, to the monolith.',
        'Start with staff accounts only, picked by a header. Customers stay at 0% until the new database is filled and checked (part 2). Then 1%, raised only when errors and latency match the old path.',
      ],
      keyIdea: 'Each slice is small enough to ship in weeks and to start with a tiny share of traffic.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      metricTones: { share: 'good' },
      scene: {
        nodes: [{ ...facade, status: 'active', badge: '/orders: staff only' }, legacy, { ...orders, status: 'ok', chips: ['GET /orders'] }, newDb],
        links: [link('facade', 'legacy'), link('facade', 'orders'), link('orders', 'newDb')],
        flows: [
          { path: ['facade', 'legacy'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['facade', 'orders'], tone: 'request', label: 'GET /orders', duration: 1.2, delay: 0.4 },
        ],
        caption: 'One slice to the new service, the rest unchanged',
      },
      code: {
        language: 'bash',
        title: 'nginx facade: staff first, customers after the data is ready',
        source: `upstream orders_new { server orders.internal:8080; }
upstream monolith   { server monolith.internal:8080; }

# staff header only for now. Later: split_clients on the uid cookie,
# falling back to $remote_addr when the cookie is missing
map $http_x_staff $orders_backend {
    1        orders_new;
    default  monolith;
}

server {
    listen 443 ssl;

    location = /orders {                      # exact path, not /orders-admin
        limit_except GET { proxy_pass http://monolith; }
        proxy_pass http://$orders_backend;    # the slice being moved
    }

    location / {
        proxy_pass http://monolith;           # everything else, unchanged
    }
}`,
        highlight: [6, 14, 15, 16],
      },
    },
    {
      title: 'Auth and sessions',
      tag: 'concept',
      heading: 'Shoppers must stay logged in on both sides',
      eli5: 'A customer shows a stamp on their hand at the front door. Both counters must recognize the same stamp, or the customer is asked to sign in again.',
      body: [
        'The facade sends one shopper to either backend, so login has to work on both. Use one session store, or a signed token such as a JWT that both systems can verify with the same key.',
        'Keep the cookie name, domain and expiry unchanged. Otherwise staff, and later the first customers, look logged out on the new service. Logout must end the session on both.',
      ],
      keyIdea: 'Share one session or token across old and new backends, or the split shows up as surprise logouts.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      scene: {
        nodes: [users, { ...facade, status: 'active', chips: ['cookie: sid'] }, legacy, { ...orders, status: 'ok' }],
        links: [link('users', 'facade'), link('facade', 'legacy'), link('facade', 'orders')],
        flows: [
          { path: ['users', 'facade', 'legacy'], tone: 'request', label: 'sid', duration: 1.4 },
          { path: ['users', 'facade', 'orders'], tone: 'request', label: 'same sid', duration: 1.4, delay: 0.5 },
        ],
        panel: {
          title: 'Session continuity',
          icon: 'Shield',
          rows: [
            { text: 'Cookie name, domain', value: 'unchanged', tone: 'good' },
            { text: 'Token verification', value: 'same key on both', tone: 'good' },
            { text: 'Logout', value: 'ends both', tone: 'warn' },
          ],
        },
        caption: 'One login, two backends',
      },
    },
    {
      title: 'Rollback',
      tag: 'concept',
      heading: 'Rollback is one config line',
      eli5: 'If the new cake counter burns the cakes, the greeter just stops sending people there. The old counters never closed.',
      body: [
        'If the new service misbehaves, the fix is one config line that sends the slice back. That rollback takes seconds, and every other page never noticed.',
        'That is trivial while the slice only reads. Once a service owns writes, rolling back needs the reverse sync from Flip the sync (part 2), or the new rows are lost.',
      ],
      keyIdea: 'A slice-level switch makes rollback a seconds-long config change for reads. After writes move, it also needs the reverse sync.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      metricTones: { blast: 'good' },
      scene: {
        nodes: [{ ...facade, status: 'active', badge: '/orders: all old' }, legacy, { ...orders, status: 'down', badge: 'errors up' }],
        links: [link('facade', 'legacy', { label: 'all traffic back' }), link('facade', 'orders', { style: 'faint' })],
        flows: [{ path: ['facade', 'legacy'], tone: 'request', count: 4, duration: 1.4 }],
        panel: {
          title: 'The rollback',
          icon: 'Repeat',
          code: 'map $http_x_staff $orders_backend {\n    1        monolith;   # was orders_new\n    default  monolith;\n}',
          footer: { text: 'Seconds for reads. After writes move, reverse the sync', tone: 'good' },
        },
        caption: 'The slice goes home, nothing else notices',
      },
    },
    {
      title: 'Inside the monolith',
      tag: 'concept',
      heading: 'No network seam? Branch by abstraction',
      eli5: 'Sometimes the cake counter and the kitchen share one big table. First put a divider on the table, then slide the new counter in behind it.',
      body: [
        'A facade works when the slice has its own URL. When the code you want to replace is deep inside the monolith, add an interface in front of it first. The old code becomes one implementation of that interface.',
        'Write the new implementation behind the same interface, switch callers with a flag, then delete the old one. This is **branch by abstraction**.',
      ],
      keyIdea: 'Branch by abstraction creates a seam inside the code, so a slice can be swapped when no URL exists to route.',
      metrics: { share: '0%', blast: 'one call site', systems: '1', diff: '-' },
      scene: {
        nodes: [
          { ...legacy, status: 'active', sub: 'interface PriceCalc' },
          { id: 'oldImpl', kind: 'block', size: 0.8, at: at(-3.5, 3.8), label: 'old calc', sub: 'implementation A', icon: 'Code', tint: 'gray' },
          { id: 'newImpl', kind: 'block', size: 0.8, at: at(3.5, 3.8), label: 'new calc', sub: 'implementation B', icon: 'Code', tint: 'green' },
        ],
        links: [link('legacy', 'oldImpl'), link('legacy', 'newImpl', { style: 'dashed', label: 'flag', labelTone: 'warn' })],
        flows: [{ path: ['legacy', 'oldImpl'], tone: 'request', label: 'flag off', duration: 1.4 }],
        panel: {
          title: 'The abstraction',
          icon: 'Braces',
          code: 'interface PriceCalc {\n  price(cart): Money\n}\n\nuse = flag("new-calc")\n  ? new NewCalc()\n  : new OldCalc()',
        },
        caption: 'A seam inside the code, switched by a flag',
      },
    },
    {
      title: 'Translator',
      tag: 'concept',
      heading: 'An anti-corruption layer guards the new model',
      eli5: 'The old counters write orders in a strange code nobody likes. The new counter hires a translator, so its own order book stays clean and simple. That translator is the **anti-corruption layer**.',
      body: [
        'The new orders service still needs customer data, and that lives in the monolith as `CUST_MSTR` rows with fields like `CST_STAT_CD = \'A\'` and dates stored as text. If the new code reads those shapes directly, the old model leaks in.',
        'An **anti-corruption layer** (ACL) is a thin translator between the two. All knowledge of the old model lives in one place.',
      ],
      keyIdea: 'Translate at the border so the old system\'s model never spreads into the new code.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      scene: {
        nodes: [{ ...legacy, status: 'active' }, { ...acl, status: 'ok', chips: [{ text: 'CST_STAT_CD A', tone: 'warn' }, { text: 'active', tone: 'good' }] }, { ...orders, status: 'active' }],
        links: [link('orders', 'acl'), link('acl', 'legacy')],
        flows: [
          { path: ['orders', 'acl'], tone: 'request', label: 'getCustomer(42)', duration: 1 },
          { path: ['acl', 'legacy'], tone: 'request', label: 'old API', duration: 1, delay: 1.1 },
          { path: ['legacy', 'acl'], tone: 'response', label: 'CUST_MSTR row', duration: 1, delay: 2.2 },
          { path: ['acl', 'orders'], tone: 'response', label: 'Customer', duration: 1, delay: 3.3 },
        ],
        caption: 'Old shapes stop at the translator',
      },
    },
    {
      title: 'ACL in code',
      tag: 'concept',
      heading: 'What the translator looks like',
      eli5: 'The translator reads the strange code on the old page and writes a clear sentence in the new order book.',
      body: [
        'The new service asks for a `Customer` in its own terms. The ACL calls the old system, maps codes to clear values, fixes formats, and hands back the clean object.',
        'When the customer slice later moves to its own new service, you change the ACL and nothing else. Once the old system is gone, the ACL is deleted too.',
      ],
      keyIdea: 'The ACL is small, lives at one border, and is deleted with the old system.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      scene: {
        nodes: [{ ...acl, status: 'active' }, orders, legacy],
        links: [link('orders', 'acl'), link('acl', 'legacy')],
        flows: [{ path: ['acl', 'orders'], tone: 'response', label: 'Customer', duration: 1.4 }],
        panel: {
          title: 'Old to new',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'CST_STAT_CD = "A"', value: 'active: true' },
            { text: 'CST_OPN_DT = "2014-03-02 00:00"', value: 'date(2014, 3, 2)' },
            { text: 'CST_FNM + CST_LNM, padded', value: 'name, trimmed' },
          ],
        },
        caption: 'Codes and formats are fixed in one place',
      },
      code: {
        language: 'python',
        title: 'The anti-corruption layer for customers',
        source: `from dataclasses import dataclass
from datetime import date

@dataclass
class Customer:              # the new service's own model
    id: int
    name: str
    active: bool
    joined: date

STATUS = {"A": True, "S": False, "X": False}   # active, suspended, closed

def get_customer(customer_id: int) -> Customer:
    row = legacy_client.get(f"/cust_mstr/{customer_id}")
    return Customer(
        id=int(row["CST_NO"]),
        name=f'{row["CST_FNM"].strip()} {row["CST_LNM"].strip()}',
        active=STATUS[row["CST_STAT_CD"]],
        joined=date.fromisoformat(row["CST_OPN_DT"][:10]),
    )`,
        highlight: [5, 11, 14, 18],
      },
      quiz: {
        question: 'Why put an anti-corruption layer between the new orders service and the old monolith?',
        options: [
          'To make calls to the monolith faster',
          'To keep the old data model and its quirks from spreading into the new code',
          'To encrypt traffic between the two systems',
          'To replace the facade',
        ],
        answer: 1,
        explain: 'The ACL translates old shapes into the new model at one border. Without it, old codes and formats leak into the new service, which then has to be untangled again later.',
      },
    },
    {
      title: 'Own database',
      tag: 'concept',
      heading: 'Give the new service its own database',
      eli5: 'The new counter keeps its own order book. If it kept scribbling in the old book, the old counters could never throw that book away.',
      body: [
        'A new service that reads and writes the monolith\'s tables stays welded to it. Any schema change in the old system breaks the new one, and the old database can never be retired.',
        'Give the slice its own database with its own schema, and fill it from the old one with the data pipeline described next.',
      ],
      keyIdea: 'A shared database is the tightest coupling there is. Each slice owns its data.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      metricTones: { blast: 'good' },
      scene: {
        nodes: [{ ...legacy, status: 'dim' }, { ...legacyDb, status: 'dim' }, { ...orders, status: 'ok' }, { ...newDb, status: 'ok', badge: 'own schema' }],
        links: [link('legacy', 'legacyDb'), link('orders', 'legacyDb', { style: 'faint', label: 'shared tables', labelTone: 'warn' }), link('orders', 'newDb')],
        flows: [{ path: ['orders', 'newDb'], tone: 'request', duration: 1.4 }],
        panel: {
          title: 'Shared vs own',
          icon: 'Database',
          rows: [
            { text: 'Shared tables', value: 'welded together', tone: 'bad' },
            { text: 'Own schema', value: 'free to change', tone: 'good' },
            { text: 'Old DB can be retired', value: 'only with own', tone: 'good' },
          ],
        },
        caption: 'One owner per table',
      },
    },
    {
      title: 'Split tables',
      tag: 'tradeoff',
      heading: 'What breaks when tables move apart',
      eli5: 'When the order book moves to a new counter, the old trick of looking up the customer in the same book stops working. The counters must ask each other or keep a note.',
      body: [
        'Tables that lived together now sit in two databases. A SQL join between orders and `CUST_MSTR` no longer works, a foreign key cannot span databases, and one transaction cannot cover both.',
        'The usual fixes: call the owning service\'s API, keep a replicated read model of the few fields you need, or store a denormalized copy such as the customer name on the order. Pick per query.',
      ],
      keyIdea: 'Splitting a database breaks joins, foreign keys and transactions, so each one needs an API call, a replicated copy or a denormalized field.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      metricTones: { blast: 'warn' },
      scene: {
        nodes: [{ ...orders, status: 'active', chips: [{ text: 'JOIN customers', tone: 'bad' }] }, newDb, { ...acl, at: at(7, 0), status: 'ok' }, legacyDb],
        links: [link('orders', 'newDb'), link('orders', 'acl', { label: 'API call' }), link('acl', 'legacyDb')],
        flows: [{ path: ['orders', 'acl', 'legacyDb'], tone: 'request', label: 'customer name', duration: 1.8 }],
        panel: {
          title: 'What breaks, what fixes it',
          icon: 'Table',
          rows: [
            { text: 'JOIN across tables', value: 'API or read model', tone: 'warn' },
            { text: 'Foreign key', value: 'check in code', tone: 'warn' },
            { text: 'One transaction', value: 'outbox or saga', tone: 'warn' },
            { text: 'Customer name on order', value: 'denormalized copy', tone: 'good' },
          ],
        },
        caption: 'Rules the database enforced now live in code',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'So far: a facade, a slice and a translator',
      eli5: 'So far the bakery has a greeter at the door, one new cake counter, and a translator for the old recipe codes. Next comes copying the order book.',
      body: [
        'A big-bang rewrite stores all value and all risk for one day. The **strangler fig** puts a **facade** in front of the old system and moves one slice at a time, each one small enough to roll back with a config line.',
        'Pick slices by their seams, use **branch by abstraction** when no URL exists, and let an **anti-corruption layer** keep the old model out of the new code. Each slice owns its data. Part 2 moves that data and finishes the job.',
      ],
      keyIdea: 'Route one small slice through a facade, keep the old model behind a translator, and give the slice its own data.',
      metrics: { share: '0% (staff only)', blast: 'order history', systems: '2 + facade', diff: '-' },
      metricTones: { blast: 'good' },
      scene: {
        nodes: [users, { ...facade, status: 'ok' }, legacy, { ...orders, status: 'ok' }, { ...acl, size: 0.7 }],
        links: [link('users', 'facade'), link('facade', 'legacy'), link('facade', 'orders'), link('orders', 'acl', { style: 'faint' })],
        flows: [
          { path: ['users', 'facade', 'orders'], tone: 'request', label: '/orders', duration: 1.6 },
          { path: ['users', 'facade', 'legacy'], tone: 'request', label: 'everything else', duration: 1.6, delay: 0.4 },
        ],
      },
      quiz: {
        question: 'A team wants to replace code buried deep inside the monolith, with no URL of its own to route. What is the first move?',
        options: [
          'Put a facade in front and route the URL',
          'Add an interface around the code (branch by abstraction), then write the new implementation behind it and switch with a flag',
          'Rewrite the whole monolith first',
          'Share the old database with the new code',
        ],
        answer: 1,
        explain: 'Branch by abstraction creates a seam inside the code so the old and new implementations can coexist and be switched with a flag, without needing a network boundary.',
      },
    },
  ],
};
