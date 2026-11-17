import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];

const services: SceneNode = { id: 'services', kind: 'service', at: p(-8, 0), label: 'services', sub: 'orders, billing, ads' };
const api: SceneNode = { id: 'api', kind: 'server', at: p(-4.5, 0), label: 'notification svc', sub: 'validate, enqueue' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(-5, -6.6), label: 'user DB', sub: 'contacts, prefs' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: p(7.5, 0), label: 'user devices' };

// One lane per channel: queue, then workers.
const qPush: SceneNode = { id: 'qPush', kind: 'queue', at: p(-0.5, -6), label: 'push queue' };
const qSms: SceneNode = { id: 'qSms', kind: 'queue', at: p(-0.5, 0), label: 'SMS queue' };
const qEmail: SceneNode = { id: 'qEmail', kind: 'queue', at: p(-0.5, 6), label: 'email queue' };
const wPush: SceneNode = { id: 'wPush', kind: 'worker', at: p(3.5, -6), label: 'push workers', sub: 'APNs, FCM' };
const wSms: SceneNode = { id: 'wSms', kind: 'worker', at: p(3.5, 0), label: 'SMS workers' };
const wEmail: SceneNode = { id: 'wEmail', kind: 'worker', at: p(3.5, 6), label: 'email workers' };

// The simple design calls providers directly.
const provPush: SceneNode = { id: 'provPush', kind: 'internet', at: p(3.5, -6), label: 'APNs / FCM' };
const provSms: SceneNode = { id: 'provSms', kind: 'internet', at: p(3.5, 0), label: 'SMS provider' };
const provEmail: SceneNode = { id: 'provEmail', kind: 'internet', at: p(3.5, 6), label: 'email provider' };

// Priority lanes.
const limiter: SceneNode = { id: 'limiter', kind: 'limiter', at: p(-5, -6.6), label: 'per-user caps', sub: '3 marketing/day' };
const qUrgent: SceneNode = { id: 'qUrgent', kind: 'queue', at: p(-0.5, -3), label: 'urgent queue', sub: 'codes, alerts' };
const qBulk: SceneNode = { id: 'qBulk', kind: 'queue', at: p(-0.5, 3), label: 'bulk queue', sub: 'marketing' };
const wUrgent: SceneNode = { id: 'wUrgent', kind: 'worker', at: p(3.5, -3), label: 'urgent workers' };
const wBulk: SceneNode = { id: 'wBulk', kind: 'worker', at: p(3.5, 3), label: 'bulk workers', sub: 'paced 5K/s' };

// Dedup, tracking and outage steps.
const dedup: SceneNode = { id: 'dedup', kind: 'cache', at: p(7.5, -5), label: 'done set', sub: 'Redis, 7 days' };
const events: SceneNode = { id: 'events', kind: 'queue', at: p(3.5, 0), label: 'event stream' };
const warehouse: SceneNode = { id: 'warehouse', kind: 'warehouse', at: p(7.5, 6), label: 'analytics' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: p(-4.5, 6.5), label: 'queue monitor' };
const smsA: SceneNode = { id: 'smsA', kind: 'internet', at: p(7.5, -4), label: 'SMS provider A' };
const smsB: SceneNode = { id: 'smsB', kind: 'internet', at: p(7.5, 4), label: 'SMS provider B' };

const laneLinks: SceneLink[] = [
  { from: 'services', to: 'api' },
  { from: 'api', to: 'db', style: 'faint' },
  { from: 'api', to: 'qPush' },
  { from: 'api', to: 'qSms' },
  { from: 'api', to: 'qEmail' },
  { from: 'qPush', to: 'wPush' },
  { from: 'qSms', to: 'wSms' },
  { from: 'qEmail', to: 'wEmail' },
];

export const designNotificationSystem: Lesson = {
  id: 'design-notification-system',
  title: 'Design a notification system',
  tagline: 'Send 125M pushes, texts and emails a day through outside providers, without losing them, doubling them or annoying people.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Requirements, channels and scale for a shared notification service',
    'Device tokens, contact info and the notification log',
    'A queue and worker pool per channel, so one slow provider stays contained',
    'Templates, opt-outs, per-user caps and priority lanes',
    'Retries with backoff, dead letters and deduplication',
    'Delivery tracking, analytics and surviving a provider outage',
  ],
  metrics: [
    { key: 'daily', label: 'Per day' },
    { key: 'peak', label: 'Peak rate' },
    { key: 'p99', label: 'Urgent p99' },
    { key: 'lost', label: 'Lost' },
    { key: 'dupes', label: 'Duplicates' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'One place to send every push, text and email',
      eli5: 'The bakery, the bank and the toy shop all want to send notes to people in town. Instead of each hiring its own mail carriers, they hand every note to one post office counter, the **notification service**.',
      body: [
        'A shop with **50M daily users** has a dozen services that need to reach people: orders ("your parcel ships tomorrow"), billing, security (login codes) and marketing. If each calls Apple, Google, an SMS company and an email company itself, the shop gets a dozen copies of the same retry and opt-out bugs. We build one **notification system** for all of them.',
        'Requirements: three channels (mobile push, SMS, email), triggered by services or by a schedule. Users can opt out per category and channel. Delivery is **soft real time**: a login code should arrive within seconds, a sale email can wait minutes. Never silently lose a notification, and keep duplicates rare.',
        'Scale per day: **100M push, 5M SMS, 20M email**, 125M in all. That averages about 1,450 per second, and campaigns and evening peaks push it to **15K/s**. Target: urgent notifications handed to the provider within **5 s** at p99.',
      ],
      keyIdea: 'Pin down the channels, the volume per channel and what may be late: 125M a day, 15K/s at peak, login codes in seconds.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      scene: {
        nodes: [services, { ...api, sub: 'to design', badge: '15K/s peak' }, phone],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'phone', style: 'dashed' },
        ],
        flows: [
          { path: ['services', 'api'], tone: 'request', label: 'notify user 7', count: 3, duration: 1.2 },
          { path: ['api', 'phone'], tone: 'event', label: 'push, SMS, email', count: 3, duration: 1.6, delay: 1.3 },
        ],
        caption: '100M push, 5M SMS and 20M email a day',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'API and data model: who, what, and where to reach them',
      eli5: 'Every note handed in says who it is for and which card to use, like "birthday card for Sam". The clerk looks Sam up in the **address book**: home address, phone number and email.',
      body: [
        'Callers use one internal endpoint: `POST /v1/notifications` with `user_id`, a `template` name, its `params`, a `category` such as `security` or `marketing`, and an `idempotency_key`. The service answers `202 Accepted` with a notification id right away. Sending happens later. Only authenticated internal services may call it, so nobody can spam users through it.',
        'Contact info is gathered as users go. Signup stores the email and phone number. Each time the app starts, it registers its **device token**, the address Apple or Google issued for that install, with `PUT /v1/devices`. One user often has several devices, and tokens change when an app is reinstalled.',
        'Besides users, devices and preferences, a **notification log** keeps one row per notification and channel: status, attempts and timestamps. Support uses it to answer "did we send it?", and retries use it to know what is left.',
      ],
      keyIdea: 'Callers send intent (user, template, category). The service owns the addresses, the preferences and the record of what happened.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      scene: {
        nodes: [services, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'tokens, prefs' }, { ...phone, badge: 'new token' }],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'phone', to: 'api', style: 'dashed' },
        ],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'PUT /devices', duration: 1.6 },
          { path: ['api', 'db'], tone: 'data', label: 'save token', duration: 1, delay: 1.7 },
          { path: ['services', 'api'], tone: 'request', label: 'POST /notifications', duration: 1.1, delay: 3 },
          { path: ['api', 'services'], tone: 'response', label: '202 + id', duration: 1.1, delay: 4.2 },
        ],
      },
      code: {
        language: 'sql',
        title: 'Where device tokens and preferences live',
        source: `CREATE TABLE devices (
  device_id   BIGINT PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  platform    TEXT NOT NULL,           -- 'ios', 'android', 'web'
  push_token  TEXT NOT NULL UNIQUE,    -- issued by APNs or FCM, can change
  last_seen   TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON devices (user_id);     -- one user, many devices

CREATE TABLE preferences (
  user_id   BIGINT NOT NULL,
  category  TEXT NOT NULL,             -- 'security', 'orders', 'marketing'
  channel   TEXT NOT NULL,             -- 'push', 'sms', 'email'
  opt_in    BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, category, channel)
);`,
        highlight: [5, 8, 15],
      },
    },
    {
      title: 'Simple design',
      tag: 'case',
      heading: 'The simple design: one server calls the providers',
      eli5: 'One clerk takes each note, walks it to the phone company, and waits there until they say "got it". Meanwhile the line at the counter grows out the door. That clerk is a **bottleneck**.',
      body: [
        'Version one: a notification server takes the request, reads the user and devices from the database, renders the message and calls the provider directly. **APNs** delivers to iPhones, **FCM** to Android phones, and paid SMS and email providers handle the rest.',
        'Provider calls take 100 ms to 2 s, and the request thread waits for each one. A few hundred threads move about **2K notifications/s** against a 15K/s peak. When the SMS provider slows down, its calls hold every thread, and push and email stall with it.',
        'There is also one server. A crash drops every notification in flight, and since nothing was written down before the call, nothing gets retried. Lookups, rendering and sending cannot be scaled separately either.',
      ],
      keyIdea: 'Calling slow outside providers inside the request couples every channel to the slowest one and loses work on a crash.',
      metrics: { daily: '125M', peak: '2K/s max', p99: '40 s', lost: 'on crash', dupes: '-' },
      scene: {
        nodes: [
          services,
          { ...api, label: 'notification server', sub: 'calls providers', status: 'hot', badge: 'threads full' },
          db,
          provPush,
          { ...provSms, status: 'hot', badge: 'slow: 2 s' },
          provEmail,
          phone,
        ],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'db', style: 'faint' },
          { from: 'api', to: 'provPush' },
          { from: 'api', to: 'provSms' },
          { from: 'api', to: 'provEmail' },
          { from: 'provPush', to: 'phone', style: 'dashed' },
          { from: 'provSms', to: 'phone', style: 'dashed' },
          { from: 'provEmail', to: 'phone', style: 'dashed' },
        ],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 5, duration: 1 },
          { path: ['api', 'provSms'], tone: 'request', label: 'send SMS', count: 3, duration: 3, delay: 1 },
          { path: ['api', 'provPush'], tone: 'request', duration: 1.2, delay: 2.5 },
          { path: ['api', 'services'], tone: 'error', label: 'timeout', duration: 1, delay: 4 },
        ],
        caption: 'One slow provider stalls every channel',
      },
    },
    {
      title: 'Queues',
      tag: 'concept',
      heading: 'Fix 1: a queue and a worker pool per channel',
      eli5: 'Now the clerk only drops each note into a bin: one bin for phone buzzes, one for texts, one for email. Carriers empty their own bin, so a slow text company only fills the text bin. Each bin is a **queue**.',
      body: [
        'Split accepting from sending. The **notification service** validates the request, looks up contacts (through a cache in front of the database), writes a `queued` row to the log and publishes one message per device or address to that channel\'s **queue**. It returns in a few milliseconds.',
        'Worker pools pull from their own queue and call their own provider. A slow SMS provider now grows only the SMS backlog. Each pool scales on its queue depth, and each queue soaks up bursts, as in the message queues lesson.',
        'The service is stateless, so many copies run behind a load balancer. A message stays in its queue until a worker acks it, so a crashed worker causes a redelivery and nothing is lost.',
      ],
      keyIdea: 'Accept fast, send later. One queue and one worker pool per channel keeps a provider\'s trouble inside its own lane.',
      metrics: { daily: '125M', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          services,
          { ...api, status: 'active' },
          db,
          { ...qPush, badge: '9K/s' },
          { ...qSms, status: 'hot', badge: 'backlog 40K' },
          { ...qEmail, badge: '3K/s' },
          { ...wPush, status: 'ok' },
          { ...wSms, status: 'hot', badge: 'provider slow' },
          { ...wEmail, status: 'ok' },
        ],
        links: laneLinks,
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 3, duration: 1 },
          { path: ['api', 'qPush'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['api', 'qSms'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['api', 'qEmail'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['qPush', 'wPush'], tone: 'event', count: 3, duration: 1, delay: 2.2 },
          { path: ['qSms', 'wSms'], tone: 'event', duration: 2.6, delay: 2.2 },
          { path: ['qEmail', 'wEmail'], tone: 'event', count: 2, duration: 1, delay: 2.2 },
          { path: ['api', 'services'], tone: 'response', label: '202', duration: 1, delay: 1.1 },
        ],
        caption: 'The SMS backlog grows, push and email keep moving',
      },
    },
    {
      title: 'Prefs, templates',
      tag: 'concept',
      heading: 'Fix 2: templates and preferences before the queue',
      eli5: 'Before a note goes in a bin, the clerk checks the **do-not-send list**. Sam said "no sale flyers by text", so that note is dropped. Notes are filled in from ready-made cards, so each one looks right.',
      body: [
        '**Templates** live in a versioned store, one per message and channel: `order_shipped` has a push version, an SMS version and an HTML email, with slots like `{{item}}` and `{{eta}}`, translated per language. Callers send data, never text. Copy changes need no deploy, and nobody can typo a message going to five million people.',
        'Before enqueueing, the service checks **preferences**: is this user opted in to this category on this channel? Marketing is opt-in and every email carries an unsubscribe link, which the law requires in many places. Security messages such as login codes ignore the marketing opt-out. About **8%** of requests stop here.',
        'Preferences and templates are read on every send, so cache them. When a user opts out, delete their cached entry at once, so the very next send sees the change.',
      ],
      keyIdea: 'Respect the user before spending money: check preferences first, then render from a template, then enqueue.',
      metrics: { daily: '115M sent', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          services,
          { ...api, status: 'active', badge: 'check prefs' },
          { ...db, sub: 'prefs, templates', status: 'active' },
          { ...qPush, status: 'ok', badge: 'rendered' },
          { ...qSms, status: 'dim' },
          { ...qEmail, status: 'ok' },
        ],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'api', to: 'qPush' },
          { from: 'api', to: 'qSms', style: 'faint' },
          { from: 'api', to: 'qEmail' },
        ],
        flows: [
          { path: ['services', 'api'], tone: 'request', label: 'sale, user 7', duration: 1 },
          { path: ['api', 'db', 'api'], tone: 'request', label: 'opted in?', duration: 1.6, delay: 1.1 },
          { path: ['api', 'services'], tone: 'error', label: 'SMS: opted out', duration: 1, delay: 2.8 },
          { path: ['api', 'qPush'], tone: 'event', label: 'push: allowed', duration: 1, delay: 2.8 },
          { path: ['api', 'qEmail'], tone: 'event', duration: 1, delay: 2.8 },
        ],
        caption: 'Opted-out channels never reach a queue',
      },
    },
    {
      title: 'Blast',
      tag: 'case',
      heading: 'Case: a 30M push campaign buries the login codes',
      eli5: 'The toy shop drops thirty million flyers in the phone-buzz bin at 9 AM. A kid\'s secret login code lands behind all of them and arrives an hour late. That pile-up is **head-of-line blocking**.',
      body: [
        'At 9:00 marketing sends a spring sale push to **30M users**. The push workers drain about **10K/s**, so the backlog takes 50 minutes to clear. A login code queued at 9:01 waits behind 29 million sale pushes. Users cannot sign in, and support tickets pile up.',
        'Some users also get four marketing pushes that morning from four different teams, and a share of them turn off notifications for the whole app. That costs more than a slow sale, because their next order update will not reach them either.',
        'One first-in, first-out queue per channel treats a login code and an ad as equals. The design needs to know which is which.',
      ],
      keyIdea: 'A shared queue lets bulk traffic delay urgent traffic, and unlimited sends teach users to switch you off.',
      metrics: { daily: '145M', peak: '30M in 1 blast', p99: '50 min', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...services, label: 'marketing', sub: 'spring sale', status: 'hot' },
          { ...api, status: 'active' },
          { ...qPush, status: 'hot', badge: 'backlog 30M' },
          { ...qSms, status: 'dim' },
          { ...qEmail, status: 'dim' },
          { ...wPush, status: 'hot', badge: 'max 10K/s' },
          { ...phone, status: 'hot', badge: 'code 50 min late' },
        ],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'qPush' },
          { from: 'api', to: 'qSms', style: 'faint' },
          { from: 'api', to: 'qEmail', style: 'faint' },
          { from: 'qPush', to: 'wPush' },
          { from: 'wPush', to: 'phone' },
        ],
        flows: [
          { path: ['services', 'api', 'qPush'], tone: 'event', label: '30M sale pushes', count: 6, duration: 1.6 },
          { path: ['qPush', 'wPush'], tone: 'event', count: 3, duration: 1.2, delay: 1.7 },
          { path: ['wPush', 'phone'], tone: 'error', label: 'login code waits', duration: 3, delay: 3 },
        ],
        caption: 'A login code is stuck behind 29 million ads',
      },
    },
    {
      title: 'Priority, caps',
      tag: 'concept',
      heading: 'Fix 3: priority lanes and per-user caps',
      eli5: 'Each delivery type now has a small red bin for urgent notes and a big bin for flyers, and some carriers only empty the red bin. A **frequency cap** also stops anyone getting more than three flyers a day.',
      body: [
        'Give each channel two queues: **urgent** (login codes, fraud alerts, order updates) and **bulk** (marketing, digests). Urgent workers serve only the urgent queue. Bulk workers are paced to a fixed rate, here 5K/s for push, so a campaign spreads over a couple of hours and never crowds the provider. Login codes are back to about 2 s.',
        'Add a **per-user rate limit** in the service, using the counters from the rate limiting lesson: for example at most 3 marketing pushes per user per day, and none during the user\'s quiet hours. Over the cap, the notification is dropped or folded into a daily digest. Urgent categories skip the cap.',
        'The service maps category to lane. Callers never pick "urgent" themselves, or every team soon would.',
      ],
      keyIdea: 'Separate urgent from bulk with their own queues and workers, pace the bulk lane, and cap what any one user receives.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...services, label: 'marketing', sub: 'spring sale' },
          { ...api, status: 'active' },
          { ...limiter, status: 'active', badge: 'over cap: drop' },
          { ...qUrgent, status: 'ok', badge: 'empty' },
          { ...qBulk, badge: '30M, paced' },
          { ...wUrgent, status: 'ok' },
          { ...wBulk, status: 'active' },
          { ...phone, status: 'ok', badge: 'code in 2 s' },
        ],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'limiter' },
          { from: 'api', to: 'qUrgent' },
          { from: 'api', to: 'qBulk' },
          { from: 'qUrgent', to: 'wUrgent' },
          { from: 'qBulk', to: 'wBulk' },
          { from: 'wUrgent', to: 'phone' },
          { from: 'wBulk', to: 'phone' },
        ],
        flows: [
          { path: ['services', 'api'], tone: 'request', label: 'sale', count: 4, duration: 1 },
          { path: ['api', 'limiter', 'api'], tone: 'request', label: 'under cap?', duration: 1.4, delay: 1.1 },
          { path: ['api', 'qBulk'], tone: 'event', count: 4, duration: 1, delay: 2.6 },
          { path: ['api', 'qUrgent'], tone: 'event', label: 'login code', duration: 1, delay: 2.6 },
          { path: ['qUrgent', 'wUrgent', 'phone'], tone: 'event', duration: 1.6, delay: 3.7 },
          { path: ['qBulk', 'wBulk', 'phone'], tone: 'event', duration: 3, delay: 3.7 },
        ],
        caption: 'Urgent lane drains first, bulk lane is paced',
      },
    },
    {
      title: 'Retries',
      tag: 'concept',
      heading: 'Fix 4: retry with backoff, and know what not to retry',
      eli5: 'If the phone company says "busy, try later", the carrier puts the note in a waiting tray and tries again, waiting longer each time. Notes that keep failing go to a **dead letter** box for a grown-up to check.',
      body: [
        'Providers fail all the time: timeouts, `429 Too Many Requests`, `503`. A failed send goes to a **retry queue** with exponential backoff and jitter, from the timeouts and retries lesson: about 1 s, 2 s, 4 s, up to 10 minutes, for at most 6 attempts. After that it moves to a **dead letter queue** and an alert fires.',
        'Some failures must never be retried. If APNs or FCM reports a token as no longer valid, the app was uninstalled, so delete the token. A hard email bounce marks the address as bad. Retrying those wastes money and, for email, hurts the sender reputation that decides whether mail lands in the inbox.',
        'Each attempt updates the notification log, so a stuck notification is visible and a growing retry backlog shows up on a dashboard before users notice.',
      ],
      keyIdea: 'Retry transient failures with backoff and a limit, drop permanent ones at once, and park the rest in a dead letter queue.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...api, status: 'dim' },
          { ...qPush, status: 'active', label: 'retry queue', sub: 'delayed', badge: 'attempt 3 in 4 s' },
          { ...qSms, label: 'push queue' },
          { ...qEmail, label: 'dead letters', status: 'hot', badge: '12 today' },
          { ...wSms, label: 'push workers', status: 'active' },
          { ...provPush, at: p(7.5, 0), status: 'hot', badge: '503' },
        ],
        links: [
          { from: 'api', to: 'qSms' },
          { from: 'qSms', to: 'wSms' },
          { from: 'wSms', to: 'provPush' },
          { from: 'wSms', to: 'qPush', style: 'dashed' },
          { from: 'qPush', to: 'qSms', style: 'dashed' },
          { from: 'wSms', to: 'qEmail', style: 'dashed' },
        ],
        flows: [
          { path: ['qSms', 'wSms'], tone: 'event', duration: 1 },
          { path: ['wSms', 'provPush'], tone: 'request', label: 'send', duration: 1, delay: 1.1 },
          { path: ['provPush', 'wSms'], tone: 'error', label: '503', duration: 1, delay: 2.2 },
          { path: ['wSms', 'qPush'], tone: 'event', label: 'retry later', duration: 1.2, delay: 3.3 },
          { path: ['qPush', 'qSms'], tone: 'event', label: 'after backoff', duration: 1.6, delay: 4.6 },
          { path: ['wSms', 'qEmail'], tone: 'error', label: 'attempt 7', duration: 1.4, delay: 6.3 },
        ],
        caption: 'Back off, try again, give up after 6 attempts',
      },
      code: {
        language: 'python',
        title: 'Push worker: retry the transient, drop the permanent',
        source: `RETRYABLE = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 6

def handle(msg) -> bool:
    try:
        provider.send(msg.token, msg.payload, timeout=3)
        log.mark(msg.id, "sent")
        return True
    except ProviderError as e:
        if e.token_invalid:                       # app uninstalled
            devices.delete_token(msg.token)       # never retry this one
            log.mark(msg.id, "invalid_token")
        elif e.status in RETRYABLE and msg.attempts < MAX_ATTEMPTS:
            delay = min(2 ** msg.attempts, 600) * random.uniform(0.5, 1.5)
            retry_queue.publish(msg.next_attempt(), delay_seconds=delay)
        else:
            dead_letters.publish(msg)             # a human looks at these
            log.mark(msg.id, "failed")
        return False`,
        highlight: [10, 11, 14, 15, 17],
      },
    },
    {
      title: 'Dedup',
      tag: 'tradeoff',
      heading: 'At-least-once means duplicates: dedupe by id',
      eli5: 'A carrier delivers a note but trips before ticking it off, so another carrier delivers it again. Now each note\'s number goes on a "done" list, and notes already on it are skipped. That is **deduplication**.',
      body: [
        'Queues deliver at least once. A worker that crashes after the provider accepted a message, but before it acked the queue, causes a redelivery, and the user gets two "your parcel shipped" pushes. Callers retry too: a timeout on `POST /v1/notifications` makes the order service send again.',
        'Two layers stop most of it. At the API, the `idempotency_key` maps to the first notification id, so a repeated call returns the same id, as in the API design lesson. In the worker, the notification id is checked against a **done set** in Redis before sending, and a short lock keeps two workers from sending the same copy at once.',
        'A small gap remains: a crash after the provider accepted and before the done mark was written. Exactly-once delivery to a phone is not possible here, so the goal is never losing a message and making duplicates rare.',
      ],
      keyIdea: 'Pick at-least-once, then dedupe by notification id at the API and in the worker. Duplicates become rare, losses stay at zero.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          services,
          api,
          { ...qPush, badge: 'redelivered' },
          { ...wPush, status: 'active' },
          { ...dedup, status: 'ok', badge: 'n-81 done' },
          { ...phone, status: 'ok', badge: '1 push' },
        ],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'qPush' },
          { from: 'qPush', to: 'wPush' },
          { from: 'wPush', to: 'dedup' },
          { from: 'wPush', to: 'phone' },
        ],
        flows: [
          { path: ['qPush', 'wPush'], tone: 'event', label: 'n-81', duration: 1 },
          { path: ['wPush', 'dedup'], tone: 'request', label: 'done?', duration: 1, delay: 1.1 },
          { path: ['dedup', 'wPush'], tone: 'response', label: 'no', duration: 1, delay: 2.2 },
          { path: ['wPush', 'phone'], tone: 'event', label: 'push', duration: 1.2, delay: 3.3 },
          { path: ['qPush', 'wPush'], tone: 'event', label: 'n-81 again', duration: 1, delay: 4.6 },
          { path: ['wPush', 'dedup', 'wPush'], tone: 'error', label: 'done: skip', duration: 1.6, delay: 5.7 },
        ],
        caption: 'The second copy of n-81 is dropped',
      },
      code: {
        language: 'python',
        title: 'Skip notifications that were already sent',
        source: `def handle_once(msg):
    done_key = f"sent:{msg.id}"
    if redis.exists(done_key):
        return                                    # a copy of a sent message: drop
    # short lock so two workers holding copies do not both send
    if not redis.set(f"lock:{msg.id}", worker_id, nx=True, ex=30):
        return
    try:
        if handle(msg):                           # True once the provider accepted
            redis.set(done_key, 1, ex=7 * 86400)  # remember for a week
    finally:
        redis.delete(f"lock:{msg.id}")`,
        highlight: [3, 6, 9, 10],
      },
      quiz: {
        question: 'A push worker sends a message, the provider accepts it, and the worker crashes before marking it done or acking the queue. What happens next?',
        options: [
          'The message is lost',
          'The queue redelivers it, and the user may get it twice',
          'The message goes to the dead letter queue',
          'The provider notices and cancels it',
        ],
        answer: 1,
        explain: 'Without an ack the queue hands the message to another worker. The done set has no entry for it, so it is sent again. That is the small gap at-least-once delivery leaves open.',
      },
    },
    {
      title: 'Tracking',
      tag: 'concept',
      heading: 'Delivery tracking, analytics and monitoring',
      eli5: 'Each note gets a ticket that is stamped at every stop: in the bin, out with the carrier, delivered, opened. Counting the stamps shows which notes people actually read. That counting is **analytics**.',
      body: [
        'Every stage emits an event with the notification id: `queued`, `sent`, `delivered`, `opened`, `clicked`, `failed`. Providers report deliveries and bounces through webhooks. Opens come from the app for push and from a tracking pixel for email, and clicks pass through a redirect link.',
        'Events flow through a stream into the notification log for per-message status, and into a **warehouse** for totals: delivery rate per provider, open rate per template, unsubscribes per campaign. A template that drives opt-outs gets rewritten or retired.',
        'For operations, watch queue depth and the age of the oldest message in each lane. Depth drives worker autoscaling. An urgent message older than 30 s pages the on-call engineer.',
      ],
      keyIdea: 'Track every notification through each stage by id. The same events power support, product analytics and alerts.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          api,
          { ...qPush, badge: 'depth 1.2K' },
          wPush,
          wEmail,
          { ...phone, badge: 'opened' },
          { ...events, status: 'active' },
          { ...warehouse, status: 'active', badge: 'open rate 7%' },
          { ...monitor, badge: 'oldest: 2 s' },
        ],
        links: [
          { from: 'api', to: 'qPush' },
          { from: 'qPush', to: 'wPush' },
          { from: 'wPush', to: 'phone' },
          { from: 'wPush', to: 'events', style: 'dashed' },
          { from: 'wEmail', to: 'events', style: 'dashed' },
          { from: 'phone', to: 'events', style: 'dashed' },
          { from: 'events', to: 'warehouse' },
          { from: 'monitor', to: 'qPush', style: 'faint' },
        ],
        flows: [
          { path: ['wPush', 'phone'], tone: 'event', label: 'push', duration: 1.2 },
          { path: ['wPush', 'events'], tone: 'event', label: 'sent', duration: 1, delay: 0.4 },
          { path: ['phone', 'events'], tone: 'event', label: 'opened', duration: 1.2, delay: 1.6 },
          { path: ['wEmail', 'events'], tone: 'event', label: 'bounced', duration: 1, delay: 1.2 },
          { path: ['events', 'warehouse'], tone: 'data', count: 3, duration: 1.2, delay: 3 },
          { path: ['monitor', 'qPush'], tone: 'request', label: 'depth?', duration: 1.6, delay: 0.5 },
        ],
        caption: 'One id, stamped at every stage',
      },
    },
    {
      title: 'Provider outage',
      tag: 'case',
      heading: 'Case: the SMS provider goes down for 30 minutes',
      eli5: 'The text company closes its door. The carriers notice after a few knocks, stop knocking, and take urgent texts to a second text company across the street. That stop-knocking switch is a **circuit breaker**.',
      body: [
        'At 14:00 the main SMS provider starts timing out. Without protection, SMS workers burn their time on 3 s timeouts, retries pile up, and login codes by text stop arriving. Push and email keep flowing, because they have their own queues and workers.',
        'Each provider client has a **circuit breaker**, as in the circuit breakers lesson. When about half the calls fail over 20 s, it opens, and urgent SMS switches to a **secondary provider** that was set up in advance with its own sender numbers. Login codes resume within a minute. A half-open probe tests the main provider and moves traffic back once it recovers.',
        'Bulk SMS does not fail over. It waits in its queue, because the backup costs more and has lower limits. Messages with an expiry, like a login code valid for 5 minutes, are dropped once they expire, since a stale code only confuses the user.',
      ],
      keyIdea: 'Assume every provider will fail. Breakers stop the bleeding, a pre-integrated backup carries urgent traffic, and queues hold the rest.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '45 s (failover)', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          services,
          api,
          { ...qPush, status: 'ok' },
          { ...qSms, status: 'hot', badge: 'bulk waits' },
          { ...wPush, status: 'ok' },
          { ...wSms, status: 'active', badge: 'breaker open' },
          { ...smsA, status: 'down', badge: 'timeouts' },
          { ...smsB, status: 'ok', badge: 'urgent only' },
        ],
        links: [
          { from: 'services', to: 'api' },
          { from: 'api', to: 'qPush' },
          { from: 'api', to: 'qSms' },
          { from: 'qPush', to: 'wPush' },
          { from: 'qSms', to: 'wSms' },
          { from: 'wSms', to: 'smsA', style: 'faint' },
          { from: 'wSms', to: 'smsB' },
        ],
        flows: [
          { path: ['wSms', 'smsA'], tone: 'error', label: 'timeout', duration: 1.2 },
          { path: ['qSms', 'wSms'], tone: 'event', label: 'login code', duration: 1, delay: 1.3 },
          { path: ['wSms', 'smsB'], tone: 'request', label: 'failover', duration: 1.2, delay: 2.4 },
          { path: ['qPush', 'wPush'], tone: 'event', count: 3, duration: 1 },
          { path: ['smsB', 'wSms'], tone: 'response', label: 'accepted', duration: 1.2, delay: 3.7 },
        ],
        caption: 'Push keeps flowing while SMS fails over',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Accept fast, send carefully, record everything',
      eli5: 'The counter checks the do-not-send list, drops notes into the right bin, and carriers deliver them, retrying when a company is busy. Every stop gets a stamp. That whole post office is the **notification system**.',
      body: [
        'Services call one API with a user, template and category, and get `202` back at once. The **notification service** checks preferences and per-user caps, renders a template, logs the notification and publishes it to a **queue per channel and priority**. Workers call APNs, FCM and the SMS and email providers. The design carries 125M a day and 15K/s at peak, with urgent messages out in about 2 s.',
        'Failures are expected. **Retries** with backoff handle blips, invalid tokens are deleted, and dead letters catch the rest. **Dedup** by id keeps duplicates rare under at-least-once delivery. **Tracking** events feed support, analytics and alerts, and **circuit breakers** with a backup provider ride out an outage.',
      ],
      keyIdea: 'A notification system is mostly about isolation and bookkeeping: separate lanes, a record of every message, and a plan for each kind of failure.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [services, api, db, qPush, qSms, qEmail, { ...wPush, status: 'ok' }, { ...wSms, status: 'ok' }, { ...wEmail, status: 'ok' }],
        links: laneLinks,
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 2, duration: 1 },
          { path: ['api', 'qPush', 'wPush'], tone: 'event', duration: 1.6, delay: 1.1 },
          { path: ['api', 'qSms', 'wSms'], tone: 'event', duration: 1.6, delay: 1.1 },
          { path: ['api', 'qEmail', 'wEmail'], tone: 'event', duration: 1.6, delay: 1.1 },
        ],
      },
      quiz: {
        question: 'Marketing queues 20M pushes and login codes start arriving 40 minutes late. Which change fixes the cause?',
        options: [
          'Add a second push provider',
          'Give urgent and bulk traffic separate queues and workers, and pace the bulk lane',
          'Raise the retry limit from 6 to 10',
          'Cache device tokens in Redis',
        ],
        answer: 1,
        explain: 'The codes are stuck behind the campaign in one shared queue. Separate lanes let urgent messages skip the backlog. A second provider or more retries would not change their place in line.',
      },
    },
  ],
};
