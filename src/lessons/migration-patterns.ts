import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(row + col) / 2, (row - col) / 2];

const users: SceneNode = { id: 'users', kind: 'phone', at: p(-9.5, 0), label: 'shoppers' };
const facade: SceneNode = { id: 'facade', kind: 'gateway', at: p(-6.5, 0), label: 'facade', sub: 'routing proxy' };
const legacy: SceneNode = { id: 'legacy', kind: 'server', at: p(-2.5, -3.6), label: 'old monolith', sub: '12 years old' };
const legacyDb: SceneNode = { id: 'legacyDb', kind: 'db', at: p(4.5, -3.6), label: 'old database', sub: 'ORD_HDR, CUST_MSTR' };
const orders: SceneNode = { id: 'orders', kind: 'service', at: p(-2.5, 3.6), label: 'orders service', sub: 'new' };
const newDb: SceneNode = { id: 'newDb', kind: 'db', at: p(4.5, 3.6), label: 'orders DB', sub: 'new schema' };
const acl: SceneNode = { id: 'acl', kind: 'service', at: p(1.5, 0), label: 'translator', sub: 'anti-corruption layer' };
const backfill: SceneNode = { id: 'backfill', kind: 'worker', at: p(7.5, 0), label: 'backfill job', sub: 'copies history' };
const compare: SceneNode = { id: 'compare', kind: 'monitor', at: p(1.5, 0), label: 'comparator', sub: 'diffs answers' };
const rewrite: SceneNode = { id: 'rewrite', kind: 'server', at: p(-2.5, 3.6), label: 'the rewrite', sub: 'month 18 of 12' };

export const migrationPatterns: Lesson = {
  id: 'migration-patterns',
  title: 'Migration: strangler fig, anti-corruption layer',
  tagline: 'Replace an old system one slice at a time while it keeps serving customers, instead of betting everything on one cutover day.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Why big-bang rewrites so often run late or fail at cutover',
    'The strangler fig: a facade that routes one slice at a time to the new system',
    'An anti-corruption layer that keeps the old model out of the new code',
    'Moving data with dual writes, change capture and a backfill',
    'Shadow traffic, gradual cutover, and deleting the old path',
  ],
  metrics: [
    { key: 'share', label: 'Traffic on new' },
    { key: 'blast', label: 'Blast radius' },
    { key: 'systems', label: 'Systems running' },
    { key: 'diff', label: 'Mismatches' },
  ],
  steps: [
    {
      title: 'Big bang',
      tag: 'problem',
      heading: 'The rewrite that never ships',
      eli5: 'A bakery decides to build a brand new shop and move everything in one night. The new shop takes years, the old one keeps changing, and moving night is terrifying.',
      body: [
        'The shop runs on a 12-year-old monolith. Changes are slow and scary, so the team plans a full rewrite: build the new system on the side, then switch everything over one weekend.',
        'Month 18 of a 12-month plan. The old system kept getting features, because the business could not wait, so the rewrite chases a moving target. Nobody has written down all the odd rules buried in the old code, and the new system only finds them in production.',
        'Cutover day is one switch for all traffic and all data. If anything is wrong, every customer sees it at once, and rolling back after new orders have landed in the new database is its own project.',
      ],
      keyIdea: 'A big-bang rewrite delivers no value until the last day, chases a moving target, and puts all the risk in one switch.',
      metrics: { share: '0%', blast: 'everything', systems: '2', diff: 'unknown' },
      scene: {
        nodes: [users, { ...legacy, status: 'active', badge: 'still changing' }, legacyDb, { ...rewrite, status: 'hot', badge: 'not ready' }],
        links: [
          { from: 'users', to: 'legacy' },
          { from: 'legacy', to: 'legacyDb' },
          { from: 'users', to: 'rewrite', style: 'faint', label: 'switch day?' },
        ],
        flows: [
          { path: ['users', 'legacy', 'legacyDb'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['users', 'rewrite'], tone: 'error', label: 'all at once', duration: 1.6, delay: 2 },
        ],
        caption: 'All traffic still on the old system, all risk saved for one day',
      },
    },
    {
      title: 'Facade',
      tag: 'concept',
      heading: 'Put a facade in front of the old system',
      eli5: 'The bakery puts a greeter at the front door. Every customer talks to the greeter, who walks them to the right counter. The greeter is the **facade**.',
      body: [
        'The **strangler fig** pattern is named after a vine that grows around a tree until it can stand on its own. The first move changes nothing for customers: put a **facade** (a reverse proxy or API gateway) in front of the monolith and send all traffic through it.',
        'At first it forwards 100% of requests to the old system. That is the point. Once every request passes one place you control, you can move any URL, any customer group or any percentage to a new home with a config change.',
        'Pick the first slice carefully: a part of the system with clear edges, real business value and few dependencies. Order history is a good candidate. Payments, deeply tangled with everything, is not.',
      ],
      keyIdea: 'A facade in front of the old system gives you one switchboard where traffic can move slice by slice.',
      metrics: { share: '0%', blast: 'none yet', systems: '1 + facade', diff: '-' },
      scene: {
        nodes: [users, { ...facade, status: 'active', badge: '100% to old' }, legacy, legacyDb],
        links: [
          { from: 'users', to: 'facade' },
          { from: 'facade', to: 'legacy' },
          { from: 'legacy', to: 'legacyDb' },
        ],
        flows: [
          { path: ['users', 'facade', 'legacy'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['legacy', 'facade', 'users'], tone: 'response', count: 2, duration: 1.8, delay: 2 },
        ],
        caption: 'Same behavior, but now every request passes one switchboard',
      },
    },
    {
      title: 'First slice',
      tag: 'concept',
      heading: 'Route one slice to the new service',
      eli5: 'The bakery opens a shiny new cake counter. The greeter sends cake buyers there and everyone else to the old counters, which keep working as before.',
      body: [
        'The team builds the new **orders service** for one job: showing order history. The facade sends `GET /orders` to it and everything else to the monolith. Customers cannot tell which system answered.',
        'Start smaller than the whole slice. Send 1% of order-history requests, or only staff accounts, to the new service. Watch errors and latency. Raise the share only when the numbers match the old path.',
        'If the new service misbehaves, the fix is one config line that sends the slice back. That rollback takes seconds, and it only affects order history. Every other page never noticed.',
      ],
      keyIdea: 'Each slice is small enough to ship in weeks and to roll back with one config line.',
      metrics: { share: '1% of /orders', blast: 'order history', systems: '2 + facade', diff: '-' },
      scene: {
        nodes: [users, { ...facade, status: 'active', badge: '/orders: 1% new' }, legacy, legacyDb, { ...orders, status: 'ok' }, newDb],
        links: [
          { from: 'users', to: 'facade' },
          { from: 'facade', to: 'legacy' },
          { from: 'legacy', to: 'legacyDb' },
          { from: 'facade', to: 'orders' },
          { from: 'orders', to: 'newDb' },
        ],
        flows: [
          { path: ['users', 'facade'], tone: 'request', count: 4, duration: 1 },
          { path: ['facade', 'legacy'], tone: 'request', count: 4, duration: 1.2, delay: 1 },
          { path: ['facade', 'orders'], tone: 'request', label: 'GET /orders', duration: 1.2, delay: 1.4 },
        ],
        caption: 'One slice to the new service, the rest unchanged',
      },
      code: {
        language: 'bash',
        title: 'nginx facade: 1% of order history goes to the new service',
        source: `# hash each user into a bucket so a user stays on one side
split_clients "\${cookie_uid}" $orders_backend {
    1%      orders_new;
    *       monolith;
}

server {
    listen 443 ssl;

    location /orders {
        proxy_pass http://$orders_backend;   # the slice being moved
    }

    location / {
        proxy_pass http://monolith;          # everything else, unchanged
    }
}`,
        highlight: [2, 3, 11, 15],
      },
    },
    {
      title: 'Translator',
      tag: 'concept',
      heading: 'An anti-corruption layer guards the new model',
      eli5: 'The old counters write orders in a strange code nobody likes. The new counter hires a translator, so its own order book stays clean and simple. That translator is the **anti-corruption layer**.',
      body: [
        'The new orders service still needs customer data, and that lives in the monolith as `CUST_MSTR` rows with fields like `CST_STAT_CD = \'A\'` and dates stored as text. If the new code reads those shapes directly, the old model leaks in and the new service inherits the mess.',
        'An **anti-corruption layer** (ACL) is a thin translator between the two. The new service asks for a `Customer` in its own terms. The ACL calls the old system, maps codes to clear values, fixes formats, and hands back the clean object. All knowledge of the old model lives in one place.',
        'When the customer slice later moves to its own new service, you change the ACL and nothing else. Once the old system is gone, the ACL is deleted too.',
      ],
      keyIdea: 'Translate at the border so the old system\'s model never spreads into the new code.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '-' },
      scene: {
        nodes: [facade, legacy, legacyDb, { ...orders, status: 'active' }, newDb, { ...acl, status: 'ok', badge: 'CST_STAT_CD A → active' }],
        links: [
          { from: 'facade', to: 'legacy' },
          { from: 'legacy', to: 'legacyDb' },
          { from: 'facade', to: 'orders' },
          { from: 'orders', to: 'newDb' },
          { from: 'orders', to: 'acl' },
          { from: 'acl', to: 'legacy' },
        ],
        flows: [
          { path: ['orders', 'acl'], tone: 'request', label: 'getCustomer(42)', duration: 1 },
          { path: ['acl', 'legacy'], tone: 'request', label: 'old API', duration: 1, delay: 1.1 },
          { path: ['legacy', 'acl'], tone: 'response', label: 'CUST_MSTR row', duration: 1, delay: 2.2 },
          { path: ['acl', 'orders'], tone: 'response', label: 'Customer', duration: 1, delay: 3.3 },
        ],
        caption: 'Old shapes stop at the translator',
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
      title: 'Moving data',
      tag: 'concept',
      heading: 'Moving the data: capture changes, then backfill',
      eli5: 'The new counter needs its own copy of the order book. A helper copies every old page, and every new order written at the old counters gets copied over too.',
      body: [
        'Order history needs 8 years of orders in the new database, and it must stay current while the monolith keeps taking orders. Two jobs run together.',
        'A **backfill** copies the history in small batches, oldest first, through the same translation as the ACL. It is throttled so the old database keeps serving customers, and it is safe to stop and restart because it writes with upserts keyed on order id.',
        'New changes flow through **change data capture** (CDC): a connector reads the old database\'s change log and applies each insert and update to the new database within seconds. Start CDC before the backfill, so no change slips through the gap while history is being copied.',
      ],
      keyIdea: 'Stream new changes first, then copy history in throttled, restartable batches until both copies agree.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '0.4%' },
      scene: {
        nodes: [legacy, { ...legacyDb, status: 'active', badge: '8 years of orders' }, orders, { ...newDb, status: 'active', badge: '61% copied' }, { ...backfill, status: 'active', badge: '5,000 rows/batch' }],
        links: [
          { from: 'legacy', to: 'legacyDb' },
          { from: 'orders', to: 'newDb' },
          { from: 'legacyDb', to: 'backfill' },
          { from: 'backfill', to: 'newDb' },
          { from: 'legacyDb', to: 'newDb', style: 'dashed', label: 'CDC' },
        ],
        flows: [
          { path: ['legacyDb', 'newDb'], tone: 'event', label: 'new order', duration: 1.4 },
          { path: ['legacyDb', 'backfill', 'newDb'], tone: 'data', label: 'batch', count: 3, duration: 2.2, delay: 0.8 },
        ],
        caption: 'Live changes stream over while history is copied',
      },
      code: {
        language: 'sql',
        title: 'One restartable backfill batch',
        source: `-- run repeatedly; :last_id comes from the previous batch
INSERT INTO orders (id, customer_id, total_cents, status, placed_at)
SELECT h.ORD_NO,
       h.CST_NO,
       ROUND(h.ORD_AMT * 100),
       CASE h.ORD_STAT WHEN 'S' THEN 'shipped'
                       WHEN 'C' THEN 'cancelled'
                       ELSE 'open' END,
       h.ORD_DT
FROM   legacy.ORD_HDR h
WHERE  h.ORD_NO > :last_id
ORDER  BY h.ORD_NO
LIMIT  5000
ON CONFLICT (id) DO UPDATE                -- CDC may have written it already
SET    status = EXCLUDED.status;`,
        highlight: [11, 13, 14],
      },
    },
    {
      title: 'Dual writes',
      tag: 'case',
      heading: 'Case: the dual write that half happened',
      eli5: 'A clerk writes each new order in the old book and then in the new book. One day the phone rings between the two, and the new book never gets that order.',
      body: [
        'Before CDC, the team tried **dual writes**: the monolith wrote each order to the old database, then called the new service to write it again. Simple, and wrong in a subtle way.',
        'One night the new database was slow. The first write committed, the second timed out, and the monolith logged the error and moved on. **312 orders** existed only in the old database, and the new order history quietly showed them missing. No transaction spans two databases owned by two systems.',
        'The fixes: make one database the source of truth and copy from its log (CDC), or write an outbox row in the same transaction and let a relay deliver it with retries. Either way, run a **reconciliation** job that compares counts and checksums per day and repairs any gap.',
      ],
      keyIdea: 'Two independent writes will eventually disagree. Copy from one source of truth and reconcile on a schedule.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '312 orders' },
      scene: {
        nodes: [{ ...legacy, status: 'active', badge: 'write twice' }, { ...legacyDb, status: 'ok', badge: 'committed' }, orders, { ...newDb, status: 'hot', badge: 'timeout' }],
        links: [
          { from: 'legacy', to: 'legacyDb' },
          { from: 'legacy', to: 'orders' },
          { from: 'orders', to: 'newDb' },
        ],
        flows: [
          { path: ['legacy', 'legacyDb'], tone: 'request', label: 'INSERT order', duration: 1.2 },
          { path: ['legacy', 'orders', 'newDb'], tone: 'request', label: 'same order', duration: 1.8, delay: 1.3 },
          { path: ['newDb', 'orders', 'legacy'], tone: 'error', label: 'timed out', duration: 1.8, delay: 3.2 },
        ],
        caption: 'First write landed, second one did not',
      },
    },
    {
      title: 'Shadow traffic',
      tag: 'concept',
      heading: 'Shadow traffic: compare before you trust',
      eli5: 'For a week, every cake order is made at both counters. Customers only get the old counter\'s cake, and someone checks that the two cakes match.',
      body: [
        'Before raising the share past 10%, the facade **mirrors** order-history requests: the old system answers the customer as usual, and a copy of the same request goes to the new service. Its answer is not returned to anyone.',
        'A **comparator** diffs the two answers and records mismatches by type. The first day shows 0.4% different: order totals off by a cent, from a rounding rule nobody had written down. That is a hidden business rule, found without a single customer seeing it.',
        'Only mirror reads, or writes into a sandbox. Sending a duplicate `POST /checkout` to the new system would charge cards twice. Mirroring also doubles load on whatever both paths share, so watch the old database.',
      ],
      keyIdea: 'Shadow traffic tests the new system on real requests with zero customer impact, and it is where hidden rules surface.',
      metrics: { share: '10% + shadow', blast: 'none (shadow)', systems: '2 + facade', diff: '0.4% → 0.01%' },
      scene: {
        nodes: [users, { ...facade, status: 'active', badge: 'mirror reads' }, legacy, legacyDb, { ...orders, status: 'active', badge: 'answer discarded' }, newDb, { ...compare, status: 'ok', badge: '0.4% differ' }],
        links: [
          { from: 'users', to: 'facade' },
          { from: 'facade', to: 'legacy' },
          { from: 'legacy', to: 'legacyDb' },
          { from: 'facade', to: 'orders' },
          { from: 'orders', to: 'newDb' },
          { from: 'legacy', to: 'compare', style: 'dashed' },
          { from: 'orders', to: 'compare', style: 'dashed' },
        ],
        flows: [
          { path: ['users', 'facade'], tone: 'request', label: 'GET /orders', duration: 1 },
          { path: ['facade', 'legacy'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['facade', 'orders'], tone: 'request', label: 'mirror', duration: 1, delay: 1.1 },
          { path: ['legacy', 'facade', 'users'], tone: 'response', duration: 1.6, delay: 2.3 },
          { path: ['legacy', 'compare'], tone: 'data', duration: 1, delay: 2.3 },
          { path: ['orders', 'compare'], tone: 'data', duration: 1, delay: 2.3 },
        ],
        caption: 'Customers get the old answer, the comparator sees both',
      },
    },
    {
      title: 'Cutover',
      tag: 'concept',
      heading: 'Cut over gradually, keep the way back open',
      eli5: 'Once the cakes match, the greeter sends more and more cake buyers to the new counter, a few at a time, until every cake comes from there.',
      body: [
        'Mismatches are below 0.01% and explained. The facade raises the share: 10%, 25%, 50%, 100%, a few days at each step, watching error rate, latency and the reconciliation report.',
        'Reads are the easy part. When the new service starts taking writes for its slice, the direction of sync flips: the new database becomes the source of truth and CDC feeds the old one, so any old report or job still reading there keeps working, and moving back stays possible.',
        'Decide the rollback rule before each step, for example "error rate more than 0.5 points above the old path for 10 minutes". When the rule is written down in advance, rolling back is routine, not a debate during an incident.',
      ],
      keyIdea: 'Move traffic in steps with a written rollback rule, and flip the direction of data sync when the new system takes over writes.',
      metrics: { share: '100% of /orders', blast: 'order history', systems: '2 + facade', diff: '< 0.01%' },
      scene: {
        nodes: [users, { ...facade, status: 'active', badge: '/orders: 100% new' }, { ...legacy, status: 'dim' }, legacyDb, { ...orders, status: 'ok' }, { ...newDb, status: 'ok', badge: 'source of truth' }],
        links: [
          { from: 'users', to: 'facade' },
          { from: 'facade', to: 'legacy', style: 'faint' },
          { from: 'legacy', to: 'legacyDb' },
          { from: 'facade', to: 'orders' },
          { from: 'orders', to: 'newDb' },
          { from: 'newDb', to: 'legacyDb', style: 'dashed', label: 'sync back' },
        ],
        flows: [
          { path: ['users', 'facade', 'orders'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['orders', 'newDb'], tone: 'request', duration: 1, delay: 1.9 },
          { path: ['newDb', 'legacyDb'], tone: 'data', label: 'CDC', duration: 1.4, delay: 3 },
        ],
        caption: 'All order history on the new path, old copy still fed',
      },
    },
    {
      title: 'Finish line',
      tag: 'tradeoff',
      heading: 'Delete the old path, or pay for two systems forever',
      eli5: 'When nobody has used the old cake counter for a month, the bakery takes it out. If it stays, someone has to keep cleaning a counter nobody needs.',
      body: [
        'The last step is the one teams skip: remove the old code path, the sync back to the old database, the ACL pieces for this slice and the facade rule. Wait until logs show no traffic and no job reads the old tables. Until then you pay to run, patch and understand two systems.',
        'The strangler fig has real costs. Migrations by slice take longer on the calendar than the plan for a rewrite claims, the facade and sync jobs are extra moving parts, and the hardest slices (the tangled core) are always left for last. Many migrations stall at 80% and live with two systems for years.',
        'A big-bang switch can still be the right call when the system is small, the data is easy to copy, and a planned hour of downtime is acceptable. Strangling pays off when the system is large, must stay up, and keeps changing during the move.',
      ],
      keyIdea: 'A migration is done when the old path is deleted. Budget for the last 20%, which is where most of the work and most of the stalls live.',
      metrics: { share: '100% of /orders', blast: 'order history', systems: '1 + facade (this slice)', diff: '0' },
      scene: {
        nodes: [users, facade, { ...legacy, sub: 'orders code removed', status: 'dim' }, { ...legacyDb, status: 'dim', badge: 'tables archived' }, { ...orders, status: 'ok' }, { ...newDb, status: 'ok' }],
        links: [
          { from: 'users', to: 'facade' },
          { from: 'facade', to: 'legacy', style: 'faint' },
          { from: 'facade', to: 'orders' },
          { from: 'orders', to: 'newDb' },
        ],
        flows: [
          { path: ['users', 'facade', 'orders', 'newDb'], tone: 'request', count: 3, duration: 2.2 },
          { path: ['newDb', 'orders', 'facade', 'users'], tone: 'response', duration: 2.2, delay: 2.3 },
        ],
        caption: 'One slice fully moved. Repeat for the next one',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Replace the system one slice at a time',
      eli5: 'Put a greeter at the door, open new counters one at a time, translate the old codes, copy the order book, check the cakes match, then take out the old counter.',
      body: [
        'A big-bang rewrite stores all value and all risk for one day. The **strangler fig** puts a **facade** in front of the old system and moves one slice at a time, each one small enough to roll back with a config line.',
        'An **anti-corruption layer** keeps the old model out of the new code. Data moves with **change data capture** plus a throttled, restartable **backfill**, and not with naive dual writes. **Shadow traffic** finds hidden rules before customers do. Cut over in steps with a written rollback rule, then delete the old path.',
      ],
      keyIdea: 'Every step of a good migration is small, observable and reversible, and the last step is deleting what you replaced.',
      metrics: { share: '100% of /orders', blast: 'one slice', systems: '1 + facade (this slice)', diff: '0' },
      scene: {
        nodes: [users, { ...facade, status: 'ok' }, legacy, legacyDb, { ...orders, status: 'ok' }, newDb, acl],
        links: [
          { from: 'users', to: 'facade' },
          { from: 'facade', to: 'legacy' },
          { from: 'legacy', to: 'legacyDb' },
          { from: 'facade', to: 'orders' },
          { from: 'orders', to: 'newDb' },
          { from: 'orders', to: 'acl', style: 'faint' },
          { from: 'acl', to: 'legacy', style: 'faint' },
        ],
        flows: [
          { path: ['users', 'facade', 'orders'], tone: 'request', label: '/orders', duration: 1.6 },
          { path: ['users', 'facade', 'legacy'], tone: 'request', label: 'everything else', duration: 1.6, delay: 0.4 },
        ],
      },
      quiz: {
        question: 'The new orders service shows totals that differ from the monolith on 0.4% of shadowed requests. What should the team do?',
        options: [
          'Cut over to 100% anyway, since 99.6% match',
          'Find the cause of each mismatch type, fix or accept it explicitly, and keep shadowing until the rate is near zero',
          'Turn off the comparator, because shadow traffic doubles load',
          'Switch to dual writes',
        ],
        answer: 1,
        explain: 'Mismatches usually point to business rules nobody wrote down. Shadow traffic exists to find them while customers still get the old answer, so explain each one before moving real traffic.',
      },
    },
  ],
};
