import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s0: number): [number, number] => {
  const s = s0 * 1.6;
  return [(s + d) / 2, (s - d) / 2];
};
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Eli5 world: a post office. Services are shops that hand in notes, the notification service is the counter clerk,
// queues are bins, workers are mail carriers, providers are the phone, text and mail companies, the phone is the home.

const services: SceneNode = { id: 'services', kind: 'block', at: at(-7, 0), label: 'services', sub: 'orders, billing, ads', icon: 'Boxes', tint: 'blue' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-3.5, 0), label: 'notification svc', sub: 'validate, enqueue', icon: 'Workflow', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(-3.5, -4), label: 'user DB', sub: 'contacts, prefs' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(-3.5, 4), label: 'cache', sub: 'prefs, templates' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(7.5, 0), label: 'user devices' };

const qPush: SceneNode = { id: 'qPush', kind: 'queue', at: at(0, -4), label: 'push queue' };
const qSms: SceneNode = { id: 'qSms', kind: 'queue', at: at(0, 0), label: 'SMS queue' };
const qEmail: SceneNode = { id: 'qEmail', kind: 'queue', at: at(0, 4), label: 'email queue' };
const wPush: SceneNode = { id: 'wPush', kind: 'worker', at: at(3.8, -4), label: 'push workers', sub: 'APNs, FCM' };
const wSms: SceneNode = { id: 'wSms', kind: 'worker', at: at(3.8, 0), label: 'SMS workers' };

const provPush: SceneNode = { id: 'provPush', kind: 'block', at: at(3.8, -4), label: 'APNs / FCM', sub: 'push providers', icon: 'Smartphone', tint: 'teal' };
const provSms: SceneNode = { id: 'provSms', kind: 'block', at: at(3.8, 0), label: 'SMS provider', sub: 'paid per text', icon: 'Signal', tint: 'teal' };
const provEmail: SceneNode = { id: 'provEmail', kind: 'block', at: at(3.8, 4), label: 'email provider', sub: 'paid per mail', icon: 'Mail', tint: 'teal' };

const limiter: SceneNode = { id: 'limiter', kind: 'limiter', at: at(-3.5, -4), label: 'per-user caps', sub: '3 marketing/day' };
const qUrgent: SceneNode = { id: 'qUrgent', kind: 'queue', at: at(0, -2.5), label: 'urgent queue', sub: 'codes, alerts' };
const qBulk: SceneNode = { id: 'qBulk', kind: 'queue', at: at(0, 2.5), label: 'bulk queue', sub: 'marketing' };
const wUrgent: SceneNode = { id: 'wUrgent', kind: 'worker', at: at(3.8, -2.5), label: 'urgent workers' };
const wBulk: SceneNode = { id: 'wBulk', kind: 'worker', at: at(3.8, 2.5), label: 'bulk workers', sub: 'paced 5K/s' };


export const designNotificationSystem: Lesson = {
  id: 'design-notification-system',
  title: 'Design a notification system (part 1)',
  tagline: 'Send 125M pushes, texts and emails a day through outside providers: scope, contacts, queues, templates, preferences and priority lanes.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Requirements, channels, scale and soft real time',
    'How push, SMS and email providers work, and why providers must be pluggable',
    'Device tokens, contact info, the send API and the notification log',
    'Why one server fails, and a queue and worker pool per channel',
    'Templates, opt-outs, caching, per-user caps and quiet hours',
    'Campaigns: expanding a segment into batched sends',
    'Priority lanes so a campaign cannot bury a login code',
  ],
  metrics: [
    { key: 'daily', label: 'Per day', icon: 'Mail' },
    { key: 'peak', label: 'Peak rate', icon: 'Gauge' },
    { key: 'p99', label: 'Urgent p99', icon: 'Timer' },
    { key: 'lost', label: 'Lost', icon: 'Shield' },
    { key: 'dupes', label: 'Duplicates', icon: 'Copy' },
  ],
  steps: [
    {
      title: 'Many senders',
      tag: 'problem',
      heading: 'A dozen services all need to reach people',
      eli5: 'The bakery, the bank and the toy shop all want to send notes to people in town. If each hires its own mail carriers, the town gets chaos. They need one shared post office counter, the **notification service**.',
      body: [
        'A shop with **50M daily users** has a dozen services that must reach people: orders ("your parcel ships tomorrow"), billing, security codes and marketing. If each calls Apple, Google and an SMS company itself, the shop gets a dozen copies of the same retry and opt-out bugs.',
        'We build one **notification system** for all of them.',
      ],
      keyIdea: 'Send notifications from one shared system, so retries, opt-outs and provider quirks are solved once.',
      metrics: { daily: '?', peak: '?', p99: '?', lost: '?', dupes: '?' },
      scene: {
        nodes: [
          { ...services, status: 'hot', badge: '12 teams', chips: [{ text: 'own retry code', tone: 'warn' }, { text: 'own opt-out code', tone: 'warn' }] },
          { ...phone, status: 'hot', badge: '4 copies of one push' },
          { id: 'ext', kind: 'block', at: at(0, 0), label: 'Apple, Google, SMS', sub: 'called by everyone', icon: 'Globe', tint: 'gray' },
        ],
        links: [link('services', 'ext', { label: '12 integrations', labelTone: 'warn' }), link('ext', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['services', 'ext'], tone: 'request', label: 'each team sends', count: 3, duration: 1.4 },
          { path: ['ext', 'phone'], tone: 'event', label: 'dupes, no opt-out', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Without a shared system',
          icon: 'List',
          rows: [
            { text: 'Retry logic', value: '12 versions', tone: 'bad' },
            { text: 'Opt-out checks', value: '12 versions', tone: 'bad' },
            { text: 'Provider keys', value: 'in 12 repos', tone: 'warn' },
          ],
          footer: { text: 'Fix a bug once, ship it 12 times', tone: 'bad' },
        },
        caption: 'Every team reinvents sending',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'Three channels, soft real time, never lose one',
      eli5: 'The post office takes phone buzzes, text messages and letters. A birthday card can wait a little, but a secret door code must come quickly. And the clerk never throws a note away.',
      body: [
        'Channels: mobile **push**, **SMS** and **email**, to iOS, Android and desktop. A service or a schedule can trigger them, and users can opt out per category and channel.',
        'Delivery is **soft real time**: a login code within seconds, a sale email within minutes, and a slight delay is fine under load. Never silently lose a notification, and keep duplicates rare.',
      ],
      keyIdea: 'Late is acceptable, lost is not. Urgent messages get seconds, and everything else gets minutes.',
      metrics: { daily: '?', peak: '?', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [
          services,
          { ...api, sub: 'to design', status: 'active' },
          { ...phone, badge: 'iOS, Android, desktop' },
        ],
        links: [link('services', 'api'), link('api', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['services', 'api'], tone: 'request', label: 'notify user 7', count: 2, duration: 1.2 },
          { path: ['api', 'phone'], tone: 'event', label: 'push, SMS, email', count: 3, duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Channels', value: 'push, SMS, email' },
            { text: 'Triggers', value: 'service or schedule' },
            { text: 'Opt out', value: 'per category, channel' },
            { text: 'Login code', value: '< 5 s p99', tone: 'good' },
            { text: 'Sale email', value: 'minutes ok', tone: 'muted' },
            { text: 'Lost', value: 'never', tone: 'good' },
          ],
        },
        caption: 'Pin down what may be late and what may not',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: '125M a day, and 15K a second at the peak',
      eli5: 'Spread over the whole day it is a steady trickle of mail. But when the toy shop sends every flyer at 9 AM, the counter sees a flood. We build for the flood, not the trickle.',
      body: [
        'Per day: **100M push, 5M SMS, 20M email**, 125M in all. That averages about **1,450 per second**.',
        'Campaigns and evening peaks push it to about **15K/s**, ten times the average. Size the queues and workers for the peak, and aim to hand urgent messages to the provider within **5 s** at p99.',
      ],
      keyIdea: 'Average load hides the peak. Design for 15K/s, not 1,450/s.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      metricTones: { peak: 'warn' },
      scene: {
        nodes: [
          { ...api, at: at(-7, 0), status: 'active', badge: '15K/s peak' },
          { id: 'cPush', kind: 'block', at: at(-3.5, -4), label: 'push', sub: '100M/day', icon: 'Smartphone', tint: 'green' },
          { id: 'cSms', kind: 'block', at: at(0, 0), label: 'SMS', sub: '5M/day, costs most', icon: 'Signal', tint: 'amber' },
          { id: 'cEmail', kind: 'block', at: at(3.5, 4), label: 'email', sub: '20M/day', icon: 'Mail', tint: 'blue' },
        ],
        links: [link('api', 'cPush'), link('api', 'cSms'), link('api', 'cEmail')],
        flows: [
          { path: ['api', 'cPush'], tone: 'event', count: 4, duration: 1.2 },
          { path: ['api', 'cSms'], tone: 'event', duration: 1.2, delay: 0.3 },
          { path: ['api', 'cEmail'], tone: 'event', count: 2, duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'Daily volume',
          icon: 'Table',
          rows: [
            { text: 'Push', value: '100M' },
            { text: 'SMS', value: '5M' },
            { text: 'Email', value: '20M' },
            { text: 'Average', value: '1,450/s' },
            { text: 'Peak', value: '15K/s', tone: 'warn' },
          ],
          footer: { text: 'Peak is about 10x the average', tone: 'warn' },
        },
        caption: 'Push dominates, SMS costs the most per message',
      },
    },
    {
      title: 'Push providers',
      tag: 'concept',
      heading: 'A push goes through Apple or Google, never straight to the phone',
      eli5: 'We cannot walk into a house ourselves. We give the note and the house number to the phone company, **APNs** for Apple houses and **FCM** for Android houses, and they carry it the last mile.',
      body: [
        'To push, our side sends a request with a **device token** (the address Apple or Google issued for one app install) and a JSON **payload** to **APNs** for iPhones or **FCM** for Android. They hold the live connection to the device. Desktop browsers use web push the same way.',
        'We cannot reach a phone any other way, so these providers sit in every design.',
      ],
      keyIdea: 'A push is a token plus a payload handed to APNs or FCM. They own the last hop to the device.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      scene: {
        nodes: [
          { ...api, status: 'active', label: 'push sender', sub: 'builds the request' },
          { ...provPush, at: at(0, 0), status: 'active', chips: ['token + payload'] },
          { ...phone, at: at(3.5, 0), badge: 'Sam: new order' },
        ],
        links: [link('api', 'provPush', { label: 'HTTPS' }), link('provPush', 'phone', { style: 'dashed', label: 'held connection' })],
        flows: [
          { path: ['api', 'provPush'], tone: 'request', label: 'token + JSON', duration: 1.4 },
          { path: ['provPush', 'phone'], tone: 'event', label: 'push', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What we send to APNs',
          icon: 'FileJson',
          code: '{\n  "token": "9f3a...c1",\n  "payload": {\n    "title": "Order shipped",\n    "body": "Arrives tomorrow"\n  }\n}',
          footer: { text: 'The token is the address of one install', tone: 'muted' },
        },
        caption: 'Token plus payload to the provider',
      },
    },
    {
      title: 'SMS and email',
      tag: 'concept',
      heading: 'SMS and email also go through paid providers',
      eli5: 'Texts and letters need their own companies too. The text company charges for every single text, and the mail company makes sure letters do not end up in the junk pile.',
      body: [
        '**SMS** goes through a paid provider that has the carrier deals. It bills per message, so it is the costliest channel.',
        '**Email** could run on our own servers, but a paid provider gives better deliverability (mail lands in the inbox, not spam) plus bounce and open reports. Both return a delivery receipt later by webhook.',
      ],
      keyIdea: 'SMS and email buy reach and reputation from providers. They cost per message and report back asynchronously.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      scene: {
        nodes: [
          { ...api, at: at(-3.5, 0), status: 'active', label: 'sender' },
          { ...provSms, at: at(0, -2.5), chips: ['$ per text'] },
          { ...provEmail, at: at(0, 2.5), chips: ['inbox, not spam'] },
          { ...phone, at: at(3.8, 0) },
        ],
        links: [link('api', 'provSms'), link('api', 'provEmail'), link('provSms', 'phone', { style: 'dashed' }), link('provEmail', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['api', 'provSms'], tone: 'request', label: 'send text', duration: 1.3 },
          { path: ['api', 'provEmail'], tone: 'request', label: 'send mail', duration: 1.3, delay: 0.3 },
          { path: ['provSms', 'phone'], tone: 'event', duration: 1.3, delay: 1.7 },
          { path: ['provEmail', 'phone'], tone: 'event', duration: 1.3, delay: 2 },
        ],
        panel: {
          title: 'Provider trade-offs',
          icon: 'Table',
          rows: [
            { text: 'SMS cost', value: 'per message', tone: 'warn' },
            { text: 'Email cost', value: 'tiny per mail' },
            { text: 'Email gain', value: 'deliverability', tone: 'good' },
            { text: 'Result', value: 'webhook later' },
          ],
        },
        caption: 'Buying reach and reputation',
      },
    },
    {
      title: 'Pluggable providers',
      tag: 'tradeoff',
      heading: 'Treat every provider as a plug-in',
      eli5: 'Some towns do not have our usual phone company. So the clerk uses one standard form for every company, and swapping one for another only changes the last page of the form.',
      body: [
        'Providers change. FCM is unavailable in China, so Android pushes there go through local services. A provider can raise prices, lower limits or disappear from a market.',
        'Hide each one behind a small interface (`send(message) -> result`) with its own adapter. Workers call the interface, config picks the adapter per channel and region, and adding a provider touches no other code.',
      ],
      keyIdea: 'Wrap each provider in an adapter behind one interface, so swapping or adding one is a config change.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      scene: {
        nodes: [
          { ...api, at: at(-7, 0), label: 'push sender', sub: 'one interface' },
          { id: 'adapter', kind: 'block', at: at(-3.5, 0), label: 'adapter', sub: 'one per provider', icon: 'Code', tint: 'amber', status: 'active' },
          { ...provPush, at: at(0.5, -2.5), label: 'FCM', sub: 'default' },
          { id: 'provLocal', kind: 'block', at: at(0.5, 2.5), label: 'local push', sub: 'Android in China', icon: 'Smartphone', tint: 'violet' },
        ],
        links: [link('api', 'adapter'), link('adapter', 'provPush', { label: 'region = US' }), link('adapter', 'provLocal', { label: 'region = CN' })],
        flows: [
          { path: ['api', 'adapter'], tone: 'request', label: 'send(msg)', duration: 1.2 },
          { path: ['adapter', 'provPush'], tone: 'request', label: 'FCM call', duration: 1.4, delay: 1.3 },
          { path: ['adapter', 'provLocal'], tone: 'request', label: 'local call', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'The adapter contract',
          icon: 'Code',
          code: 'interface Provider {\n  send(msg): Result\n  // ok, retryable,\n  // invalid_token, bounced\n}\n\nroute(channel, region)\n  -> adapter',
          footer: { text: 'Workers never see vendor details', tone: 'muted' },
        },
        caption: 'Swap a provider without touching workers',
      },
    },
    {
      title: 'Contact info',
      tag: 'concept',
      heading: 'Collect addresses as users arrive',
      eli5: 'Before we can send anything, the post office needs an address book. Sam gives the clerk a home address when moving in. If Sam gets a new phone, the old number is thrown away.',
      body: [
        'Signup stores the email and phone number. Each time the app starts it registers its **device token** with `PUT /v1/devices`. One user often has several devices, and tokens change when an app is reinstalled.',
        'A push goes to every device of the user, so one request becomes one message per device. Each message gets its own **delivery id**: notification id, channel and device.',
      ],
      keyIdea: 'Addresses live in our database. One user has many devices, so one notification fans out to many messages.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      scene: {
        nodes: [
          { ...phone, at: at(-7, 0), badge: 'new token' },
          { ...api, status: 'active' },
          { ...db, at: at(0, 0), status: 'active', badge: 'tokens, prefs' },
        ],
        links: [link('phone', 'api', { style: 'dashed', label: 'on app start' }), link('api', 'db')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'PUT /devices', duration: 1.4 },
          { path: ['api', 'db'], tone: 'data', label: 'save token', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'One user, many devices',
          icon: 'Table',
          rows: [
            { text: 'user 7, email', value: 'sam@...' },
            { text: 'user 7, phone', value: '+1 555 ...' },
            { text: 'device 1, iOS', value: 'token 9f3a' },
            { text: 'device 2, Android', value: 'token 4be0' },
            { text: 'delivery id', value: 'n-81, push, 9f3a' },
          ],
          footer: { text: 'One request, one delivery per device', tone: 'muted' },
        },
        caption: 'The app registers its token on every start',
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
      title: 'Send API',
      tag: 'concept',
      heading: 'Callers send intent, and get 202 back at once',
      eli5: 'A shop hands in a slip saying "birthday card for Sam". The clerk stamps it received and gives back a ticket number straight away. Posting the card happens later.',
      body: [
        'One internal endpoint: `POST /v1/notifications` with `user_id`, a `template` name, its `params`, a `category` such as `security` or `marketing`, and an `idempotency_key`. It answers `202 Accepted` with a notification id and sends later.',
        'Only authenticated internal services may call it, so nobody can spam users through it. Callers never send raw message text.',
      ],
      keyIdea: 'The API takes intent (user, template, category) and replies 202. The service owns addresses, text and timing.',
      metrics: { daily: '125M', peak: '15K/s', p99: '< 5 s target', lost: '0 target', dupes: 'rare' },
      scene: {
        nodes: [services, { ...api, status: 'active', chips: [{ text: 'internal callers only', tone: 'good' }] }],
        links: [link('services', 'api', { label: 'POST /v1/notifications' })],
        flows: [
          { path: ['services', 'api'], tone: 'request', label: 'user 7, order_shipped', duration: 1.3 },
          { path: ['api', 'services'], tone: 'response', label: '202 + n-81', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'The request body',
          icon: 'FileJson',
          code: '{\n  "user_id": 7,\n  "template": "order_shipped",\n  "params": {"eta": "Tue"},\n  "category": "orders",\n  "idempotency_key": "ord-9001"\n}',
          footer: { text: 'Answer: 202 Accepted + id', tone: 'good' },
        },
        caption: 'Accept the intent, send later',
      },
    },
    {
      title: 'Simple design',
      tag: 'case',
      heading: 'Version one: the server calls the providers itself',
      eli5: 'One clerk takes each note, walks it to the phone company, and waits there until they say "got it". Only then does he come back for the next note.',
      body: [
        'The notification server reads the user and devices from the database, renders the message and calls the provider inside the request. A provider call takes 100 ms to 2 s, and the thread waits for it.',
        'A few hundred threads move about **2K notifications/s**. The peak is 15K/s.',
      ],
      keyIdea: 'Calling slow outside providers inside the request caps throughput at the thread count.',
      metrics: { daily: '125M', peak: '2K/s max', p99: '40 s', lost: 'on crash', dupes: '-' },
      metricTones: { peak: 'bad', p99: 'bad', lost: 'bad' },
      scene: {
        nodes: [
          services,
          { ...api, label: 'notification server', sub: 'calls providers', status: 'hot', load: 96, chips: [{ text: 'wait SMS 2 s', tone: 'warn' }] },
          { ...provSms, at: at(0.5, 0) },
          { ...phone, at: at(4, 0) },
        ],
        links: [link('services', 'api'), link('api', 'provSms'), link('provSms', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 5, duration: 1 },
          { path: ['api', 'provSms'], tone: 'request', label: 'send, then wait', count: 2, duration: 3, delay: 1 },
          { path: ['provSms', 'phone'], tone: 'event', duration: 1.2, delay: 4 },
        ],
        panel: {
          title: 'Why 2K/s tops out',
          icon: 'Gauge',
          rows: [
            { text: 'Threads', value: '400' },
            { text: 'Provider call', value: '200 ms to 2 s' },
            { text: 'Throughput', value: '~2K/s', tone: 'bad' },
            { text: 'Peak needed', value: '15K/s', tone: 'warn' },
          ],
        },
        caption: 'Threads sit waiting on the provider',
      },
    },
    {
      title: 'Three problems',
      tag: 'case',
      heading: 'One slow provider stalls every channel, and a crash loses work',
      eli5: 'The text company gets slow, so the one clerk is stuck waiting there while phone buzzes and letters pile up unanswered. If the clerk faints, every note in his hands is gone.',
      body: [
        'Three problems. **Single point of failure**: a crash drops every notification in flight, and nothing was written down, so nothing is retried. **Bottleneck**: when the SMS provider slows to 2 s, its calls hold every thread and push and email stall too.',
        '**Hard to scale**: lookups, rendering and sending cannot be scaled separately.',
      ],
      keyIdea: 'One server is a single point of failure, a bottleneck, and impossible to scale piece by piece.',
      metrics: { daily: '125M', peak: '2K/s max', p99: '40 s', lost: 'on crash', dupes: '-' },
      metricTones: { p99: 'bad', lost: 'bad' },
      scene: {
        nodes: [
          services,
          { ...api, label: 'notification server', sub: 'calls providers', status: 'hot', load: 98, badge: 'threads full' },
          { ...provPush, at: at(3.8, -5), status: 'dim', badge: 'waiting' },
          { ...provSms, at: at(3.8, 0), status: 'hot', badge: 'slow: 2 s' },
          { ...provEmail, at: at(3.8, 5), status: 'dim', badge: 'waiting' },
        ],
        links: [link('services', 'api'), link('api', 'provPush', { style: 'faint' }), link('api', 'provSms', { label: '2 s per call', labelTone: 'warn' }), link('api', 'provEmail', { style: 'faint' })],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 5, duration: 1 },
          { path: ['api', 'provSms'], tone: 'request', label: 'send SMS', count: 3, duration: 3, delay: 1 },
          { path: ['api', 'services'], tone: 'error', label: 'timeout', duration: 1, delay: 4 },
        ],
        panel: {
          title: 'The three problems',
          icon: 'Bug',
          rows: [
            { text: 'Single point of failure', value: 'crash drops all', tone: 'bad' },
            { text: 'Bottleneck', value: 'slow SMS stalls push', tone: 'bad' },
            { text: 'Scaling', value: 'all or nothing', tone: 'warn' },
          ],
        },
        caption: 'One slow provider stalls every channel',
      },
    },
    {
      title: 'Queue per channel',
      tag: 'concept',
      heading: 'Accept fast, send later: a queue per channel',
      eli5: 'Now the clerk only drops each note into a bin: one bin for phone buzzes, one for texts, one for email. He is free again in a moment, and the notes wait safely in the bins.',
      body: [
        'Split accepting from sending. The **notification service** validates the request, looks up contacts, renders the message and publishes one message per device or address to that channel\'s **queue**. It returns in a few milliseconds.',
        'The queue is a buffer: bursts pile up in it instead of knocking over the senders, as in the message queues lesson.',
      ],
      keyIdea: 'Put a queue between accepting and sending. The request returns in milliseconds and bursts wait safely.',
      metrics: { daily: '125M', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      metricTones: { p99: 'good', lost: 'good' },
      scene: {
        nodes: [
          services,
          { ...api, status: 'active', chips: ['validate, render'] },
          { ...qPush, badge: '12K/s' },
          { ...qSms, badge: '0.6K/s' },
          { ...qEmail, badge: '2.4K/s' },
        ],
        links: [link('services', 'api'), link('api', 'qPush'), link('api', 'qSms'), link('api', 'qEmail')],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 3, duration: 1 },
          { path: ['api', 'services'], tone: 'response', label: '202', duration: 1, delay: 1.1 },
          { path: ['api', 'qPush'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['api', 'qSms'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['api', 'qEmail'], tone: 'event', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Service work per request',
          icon: 'List',
          rows: [
            { text: 'Validate input', value: '1 ms' },
            { text: 'Look up contacts', value: '2 ms' },
            { text: 'Publish to queue', value: '2 ms' },
            { text: 'Reply 202', value: '~5 ms total', tone: 'good' },
          ],
        },
        caption: 'The request is done before anything is sent',
      },
    },
    {
      title: 'Worker pools',
      tag: 'concept',
      heading: 'Each queue gets its own workers and its own provider',
      eli5: 'Each bin has its own carriers who empty only that bin. When the text company is slow, only the text bin fills up. Phone buzzes and letters keep going out.',
      body: [
        'Worker pools pull from their own queue and call their own provider: SMS workers call the SMS provider, push workers call APNs and FCM. A slow SMS provider now grows only the SMS backlog. Each pool scales on its queue depth.',
        'A message stays in its queue until a worker acks it, so a crashed worker causes a redelivery and nothing is lost.',
      ],
      keyIdea: 'One queue and one worker pool per channel keeps a provider\'s trouble inside its own lane.',
      metrics: { daily: '125M', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [
          { ...qSms, at: at(-3.5, 0), status: 'hot', badge: 'backlog 40K' },
          { ...wSms, at: at(0.5, 0), status: 'hot', load: 92, badge: 'provider slow' },
          { ...provSms, at: at(4.5, 0), status: 'hot', badge: '2 s per call' },
          { ...wPush, at: at(0.5, -5.5), status: 'ok', badge: '12K/s' },
          { ...provPush, at: at(4.5, -5.5) },
        ],
        links: [link('qSms', 'wSms'), link('wSms', 'provSms', { label: '2 s per call', labelTone: 'warn' }), link('wPush', 'provPush')],
        flows: [
          { path: ['wPush', 'provPush'], tone: 'event', count: 3, duration: 1.6 },
          { path: ['qSms', 'wSms', 'provSms'], tone: 'event', duration: 2.6, delay: 0.5 },
        ],
        panel: {
          title: 'Isolation at work',
          icon: 'Table',
          rows: [
            { text: 'Push lane', value: '12K/s, healthy', tone: 'good' },
            { text: 'SMS provider', value: '2 s per call', tone: 'warn' },
            { text: 'SMS lane', value: 'backlog 40K', tone: 'warn' },
          ],
          footer: { text: 'Only SMS waits', tone: 'warn' },
        },
        caption: 'The SMS backlog grows, push keeps moving',
      },
    },
    {
      title: 'Stateless service',
      tag: 'concept',
      heading: 'Scale the service wide and move state out of it',
      eli5: 'Because the clerk keeps nothing in his pockets, the post office can open more counters. Any counter can serve any shop, and the address book sits in the back room for everyone.',
      body: [
        'The service keeps no state. The database and the **cache** sit outside it, and a load balancer spreads requests over many copies. Autoscaling adds copies at peak.',
        'This removes the single point of failure: lose one copy and the rest carry on.',
      ],
      keyIdea: 'A stateless service behind a load balancer scales horizontally and survives a copy dying.',
      metrics: { daily: '125M', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          services,
          { ...api, at: at(-3.5, -2), label: 'service copy 1', sub: 'stateless', status: 'ok', load: 45 },
          { ...api, id: 'api2', at: at(-1, 2.5), label: 'service copy 2', sub: 'stateless', status: 'ok', load: 47 },
          { ...db, at: at(2.5, -4), label: 'user DB' },
          { ...cache, at: at(2.5, 4), label: 'cache' },
        ],
        links: [link('services', 'api'), link('services', 'api2'), link('api', 'db', { style: 'faint' }), link('api2', 'cache', { style: 'faint' })],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 2, duration: 1.2 },
          { path: ['services', 'api2'], tone: 'request', count: 2, duration: 1.2, delay: 0.4 },
          { path: ['api2', 'cache', 'api2'], tone: 'request', label: 'user 7?', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Copies and load',
          icon: 'Server',
          rows: [
            { text: 'Copies at average', value: '4' },
            { text: 'Copies at peak', value: '12', tone: 'good' },
            { text: 'State in the service', value: 'none', tone: 'good' },
          ],
        },
        caption: 'Any copy can serve any request',
      },
    },
    {
      title: 'Notification log',
      tag: 'concept',
      heading: 'Write it down before sending: the notification log',
      eli5: 'The clerk writes every note in a big ledger before it goes in a bin: waiting, out with a carrier, delivered. If a bin burns down, the ledger says what was left.',
      body: [
        'The service writes one `queued` row per delivery (notification, channel and device) before it publishes: status, attempts and timestamps. The queue is replicated, and a message stays in it until a worker acks.',
        'The log write and the publish are two writes, so a crash between them leaves a `queued` row that was never published. A **sweeper** republishes rows still `queued` after 30 s.',
      ],
      keyIdea: 'Persist every delivery in a log before sending, and sweep rows that never got published. That pair makes zero loss provable.',
      metrics: { daily: '125M', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { id: 'log', kind: 'db', at: at(0, -3.5), label: 'notification log', sub: 'status, attempts', status: 'active' },
          { ...qPush, at: at(0, 3.5), badge: 'published' },
          { ...phone, at: at(4, 0) },
        ],
        links: [link('api', 'log'), link('api', 'qPush'), link('qPush', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['api', 'log'], tone: 'data', label: 'queued', duration: 1.2 },
          { path: ['api', 'qPush'], tone: 'event', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One log row',
          icon: 'Table',
          rows: [
            { text: 'delivery id', value: 'n-81, push, 9f3a' },
            { text: 'user', value: '7' },
            { text: 'status', value: 'queued' },
            { text: 'attempts', value: '0' },
            { text: 'queued_at', value: '09:00:01' },
            { text: 'still queued at +30 s', value: 'sweeper republishes', tone: 'good' },
          ],
        },
        caption: 'Write first, publish second',
      },
    },
    {
      title: 'Templates',
      tag: 'concept',
      heading: 'Callers send data, templates make the text',
      eli5: 'The post office keeps ready-made cards with blanks to fill in, like "Hi ___, your parcel comes on ___". Shops only give the names and dates, so every card looks right.',
      body: [
        '**Templates** live in a versioned store, one per message and channel: `order_shipped` has a push version, an SMS version and an HTML email, with slots like `{{item}}` and `{{eta}}`, translated per language.',
        'Copy changes need no deploy, and nobody can typo a message going to five million people.',
      ],
      keyIdea: 'Store versioned templates per message, channel and language. Callers send only the data.',
      metrics: { daily: '125M', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          services,
          { ...api, status: 'active', chips: ['render'] },
          { id: 'tpl', kind: 'block', at: at(0, -3.5), label: 'templates', sub: 'versioned', icon: 'FileText', tint: 'amber', status: 'active' },
          { ...qPush, at: at(0, 3.5), badge: 'rendered' },
        ],
        links: [link('services', 'api'), link('api', 'tpl'), link('api', 'qPush')],
        flows: [
          { path: ['services', 'api'], tone: 'request', label: 'eta: Tue', duration: 1.2 },
          { path: ['api', 'tpl', 'api'], tone: 'request', label: 'order_shipped', duration: 1.6, delay: 1.3 },
          { path: ['api', 'qPush'], tone: 'event', label: 'Arrives Tue', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'order_shipped',
          icon: 'FileText',
          rows: [
            { text: 'push (en)', value: 'Shipped, due {{eta}}' },
            { text: 'SMS (en)', value: 'Parcel due {{eta}}' },
            { text: 'email (en)', value: 'HTML + logo' },
            { text: 'push (es)', value: 'Llega {{eta}}' },
          ],
          footer: { text: 'Edit copy without a deploy', tone: 'good' },
        },
        caption: 'Data in, finished message out',
      },
    },
    {
      title: 'Preferences',
      tag: 'concept',
      heading: 'Check preferences before spending money',
      eli5: 'Before a note goes in a bin, the clerk checks the **do-not-send list**. Sam said "no sale flyers by text", so that flyer is dropped. A secret door code still goes through.',
      body: [
        'Before enqueueing, check **preferences**: is this user opted in to this category on this channel? Marketing is opt-in, and every email carries an unsubscribe link, which the law requires in many places.',
        'Security messages such as login codes ignore the marketing opt-out. About **8%** of requests stop here.',
      ],
      keyIdea: 'Respect the user first: check category and channel preferences, then render, then enqueue.',
      metrics: { daily: '115M sent', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...api, status: 'active', badge: 'check prefs' },
          { ...db, at: at(-3.5, -5.5), sub: 'prefs', status: 'active' },
          { ...qPush, status: 'ok', badge: 'push: allowed' },
          { ...qSms, status: 'dim', badge: 'opted out' },
        ],
        links: [link('api', 'db'), link('api', 'qPush'), link('api', 'qSms', { style: 'faint' })],
        flows: [
          { path: ['api', 'db', 'api'], tone: 'request', label: 'opted in?', duration: 1.6 },
          { path: ['api', 'qPush'], tone: 'event', label: 'push ok', duration: 1.2, delay: 1.8 },
          { path: ['api', 'qSms'], tone: 'error', label: 'dropped', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Sam, sale announcement',
          icon: 'Table',
          rows: [
            { text: 'marketing, push', value: 'opt in', tone: 'good' },
            { text: 'marketing, SMS', value: 'opt out', tone: 'bad' },
            { text: 'marketing, email', value: 'opt in', tone: 'good' },
            { text: 'security, SMS', value: 'always on', tone: 'muted' },
          ],
        },
        caption: 'Opted-out channels never reach a queue',
      },
      quiz: {
        question: 'A user opted out of marketing SMS. Which of these may still be sent by SMS?',
        options: [
          'A spring sale offer',
          'A weekly digest of new products',
          'A login code requested seconds ago',
          'A reminder about a coupon expiring',
        ],
        answer: 2,
        explain: 'The opt-out covers the marketing category. Security messages such as login codes are requested by the user and are not marketing, so they still go out.',
      },
    },
    {
      title: 'Caching',
      tag: 'concept',
      heading: 'Cache preferences and templates, and invalidate on change',
      eli5: 'The clerk would wear out walking to the back room for the address book on every note. So a copy of the busy pages sits at the counter. If Sam changes a rule, the copy is torn up at once.',
      body: [
        'Preferences and templates are read on every send, 15K times a second at peak. Keep them in a **cache** in front of the database.',
        'When a user opts out, delete their cached entry at once, so the very next send sees the change.',
      ],
      keyIdea: 'Cache what every send reads, and delete the cached entry the moment a preference changes.',
      metrics: { daily: '115M sent', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...api, at: at(-3.5, 0), status: 'active' },
          { ...cache, at: at(0, -3.5), status: 'ok', badge: '97% hit' },
          { ...db, at: at(0, 3.5), label: 'user DB', sub: '3% of reads' },
        ],
        links: [link('api', 'cache'), link('api', 'db', { style: 'faint' })],
        flows: [
          { path: ['api', 'cache', 'api'], tone: 'request', label: 'prefs 7: hit', duration: 1.6 },
          { path: ['api', 'db'], tone: 'request', label: 'opt-out: delete cache', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Read path at 15K/s',
          icon: 'Gauge',
          rows: [
            { text: 'Cache hits', value: '14.5K/s', tone: 'good' },
            { text: 'DB reads', value: '450/s' },
            { text: 'On opt-out', value: 'delete entry', tone: 'good' },
          ],
        },
        caption: 'The database sees only the misses',
      },
    },
    {
      title: 'Campaigns',
      tag: 'concept',
      heading: 'A campaign is a segment, not 30M API calls',
      eli5: 'The toy shop does not hand in thirty million slips one by one. It hands in one flyer and a rule, "every kid in town". A helper walks the list in small stacks and drops each stack in the bin.',
      body: [
        'The send API takes one `user_id`, so it serves per-user triggers such as "order shipped". A **campaign** is a template plus a segment, for example everyone who bought this year. A **campaign service** expands the segment in batches of about 10K users.',
        'Each batch gets the same preference and cap checks, then goes straight to the push queue, not through the API. Progress is saved per batch, so a crash resumes where it stopped.',
      ],
      keyIdea: 'Triggers go through the API one user at a time. Campaigns expand a segment in batches and publish to the queue directly.',
      metrics: { daily: '125M', peak: '15K/s', p99: '3 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...services, label: 'marketing', sub: 'spring sale' },
          { id: 'campaign', kind: 'block', at: at(-3.5, 0), label: 'campaign svc', sub: 'expands segments', icon: 'Users', tint: 'violet', status: 'active' },
          { ...db, at: at(0, -3.5), sub: 'segment: 30M users', status: 'active' },
          { ...qPush, at: at(0, 3.5), badge: 'batches of 10K' },
        ],
        links: [link('services', 'campaign', { label: 'segment + template' }), link('campaign', 'db'), link('campaign', 'qPush')],
        flows: [
          { path: ['services', 'campaign'], tone: 'request', label: 'spring sale', duration: 1.3 },
          { path: ['campaign', 'db', 'campaign'], tone: 'request', label: 'next 10K users', duration: 1.6, delay: 1.4 },
          { path: ['campaign', 'qPush'], tone: 'event', label: 'batch 1', count: 3, duration: 1.3, delay: 3.2 },
        ],
        panel: {
          title: 'Two ways in',
          icon: 'Table',
          rows: [
            { text: 'One user, a trigger', value: 'send API' },
            { text: 'A segment, a campaign', value: 'campaign service', tone: 'good' },
            { text: 'Batch size', value: '10K users' },
            { text: 'Progress', value: 'saved per batch' },
          ],
          footer: { text: '30M users = 3,000 batches', tone: 'muted' },
        },
        caption: 'The audience is expanded in batches',
      },
    },
    {
      title: 'Blast',
      tag: 'case',
      heading: 'Case: a 30M push campaign buries the login codes',
      eli5: 'The toy shop drops thirty million flyers in the phone-buzz bin at 9 AM. A kid\'s secret door code lands behind all of them and arrives an hour late. That pile-up is **head-of-line blocking**.',
      body: [
        'At 9:00 marketing launches a spring sale push to **30M users**, and the campaign service fills the push queue. Workers drain about **10K/s** of spare capacity, so the backlog takes 50 minutes to clear. A login code queued at 9:01 waits behind 29 million sale pushes.',
        'One first-in, first-out queue per channel treats a code and an ad as equals.',
      ],
      keyIdea: 'A shared queue lets bulk traffic delay urgent traffic. The design must know which is which.',
      metrics: { daily: '145M', peak: '30M in 1 blast', p99: '50 min', lost: '0', dupes: 'possible' },
      metricTones: { p99: 'bad', peak: 'bad' },
      scene: {
        nodes: [
          { ...services, label: 'marketing', sub: 'spring sale', status: 'hot' },
          { ...qPush, at: at(-2, 0), status: 'hot', badge: 'backlog 30M', chips: [{ text: 'sale x 29M', tone: 'warn' }, { text: 'login code', tone: 'bad' }] },
          { ...wPush, at: at(1.8, 0), status: 'hot', load: 100, badge: 'max 10K/s' },
          { ...phone, at: at(5.6, 0), status: 'hot', badge: 'code 50 min late' },
        ],
        links: [link('services', 'qPush'), link('qPush', 'wPush'), link('wPush', 'phone', { label: '10K/s ceiling', labelTone: 'warn' })],
        flows: [
          { path: ['services', 'qPush'], tone: 'event', label: '30M sale pushes', count: 6, duration: 1.6 },
          { path: ['qPush', 'wPush'], tone: 'event', count: 3, duration: 1.2, delay: 1.7 },
          { path: ['wPush', 'phone'], tone: 'error', label: 'login code waits', duration: 3, delay: 3 },
        ],
        panel: {
          title: 'The arithmetic',
          icon: 'Timer',
          rows: [
            { text: 'Campaign', value: '30M pushes' },
            { text: 'Drain rate', value: '10K/s' },
            { text: 'Backlog clears in', value: '50 min', tone: 'bad' },
            { text: 'Code sent at 9:01', value: 'arrives 9:50', tone: 'bad' },
          ],
        },
        caption: 'A login code is stuck behind 29 million ads',
      },
    },
    {
      title: 'Priority lanes',
      tag: 'concept',
      heading: 'Give urgent traffic its own queue and workers',
      eli5: 'Each delivery type now has a small red bin for urgent notes and a big bin for flyers. Some carriers only empty the red bin, and the flyer carriers walk at a steady pace.',
      body: [
        'Give each channel two queues: **urgent** (login codes, fraud alerts, order updates) and **bulk** (marketing, digests). Urgent workers serve only the urgent queue.',
        'Bulk workers are **paced** to a fixed rate, here 5K/s for push, so a campaign spreads over a couple of hours. The service maps category to lane. Callers never pick "urgent", or every team soon would.',
      ],
      keyIdea: 'Separate urgent from bulk with their own queues and workers, and pace the bulk lane.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active', at: at(-4.5, 0) },
          { ...qUrgent, at: at(-0.5, -2.5), status: 'ok', badge: 'empty' },
          { ...qBulk, at: at(-0.5, 2.5), badge: '30M, paced' },
          { ...wUrgent, at: at(3.5, -2.5), status: 'ok' },
          { ...wBulk, at: at(3.5, 2.5), status: 'active', load: 55 },
        ],
        links: [link('api', 'qUrgent'), link('api', 'qBulk'), link('qUrgent', 'wUrgent'), link('qBulk', 'wBulk')],
        flows: [
          { path: ['api', 'qBulk'], tone: 'event', label: 'sale', count: 4, duration: 1 },
          { path: ['api', 'qUrgent'], tone: 'event', label: 'login code', duration: 1, delay: 0.4 },
          { path: ['qUrgent', 'wUrgent'], tone: 'event', duration: 1.2, delay: 1.5 },
          { path: ['qBulk', 'wBulk'], tone: 'event', duration: 2.6, delay: 1.5 },
        ],
        panel: {
          title: 'Category to lane',
          icon: 'Table',
          rows: [
            { text: 'login code', value: 'urgent', tone: 'good' },
            { text: 'fraud alert', value: 'urgent', tone: 'good' },
            { text: 'order update', value: 'urgent' },
            { text: 'marketing', value: 'bulk, 5K/s', tone: 'muted' },
          ],
          footer: { text: 'Login codes back to about 2 s', tone: 'good' },
        },
        caption: 'Urgent lane drains first, bulk lane is paced',
      },
    },
    {
      title: 'Caps',
      tag: 'concept',
      heading: 'Cap what any one user receives',
      eli5: 'Four shops each send Sam a flyer on the same morning. A **frequency cap** at the counter says "no more than three flyers a day". The extras are dropped or saved for tomorrow.',
      body: [
        'Add a **per-user rate limit** in the service, using the counters from the rate limiting lesson: at most 3 marketing pushes per user per day.',
        'Over the cap, the notification is dropped or folded into a daily digest. Urgent categories skip the cap. Users who get too many switch notifications off for the whole app, which costs more than one skipped sale.',
      ],
      keyIdea: 'Cap marketing per user. Over-notifying makes users turn everything off.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...services, label: 'marketing', sub: '4 teams, 4 pushes' },
          { ...api, status: 'active' },
          { ...limiter, at: at(0, -3.5), status: 'active', chips: [{ text: 'sent today: 3 of 3', tone: 'warn' }], badge: '4th: drop' },
          { ...qBulk, at: at(0, 3.5), badge: 'allowed' },
        ],
        links: [link('services', 'api'), link('api', 'limiter'), link('api', 'qBulk')],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 4, duration: 1 },
          { path: ['api', 'limiter', 'api'], tone: 'request', label: 'under cap?', duration: 1.6, delay: 1.1 },
          { path: ['api', 'qBulk'], tone: 'event', label: 'push 1 to 3', count: 3, duration: 1.2, delay: 2.9 },
          { path: ['api', 'limiter'], tone: 'error', label: 'push 4: drop', duration: 1.2, delay: 4.3 },
        ],
        panel: {
          title: 'Marketing cap per user',
          icon: 'Shield',
          rows: [
            { text: 'Daily cap', value: '3 pushes' },
            { text: 'Over the cap', value: 'drop or digest', tone: 'warn' },
            { text: 'Urgent categories', value: 'skip the cap', tone: 'good' },
          ],
        },
        caption: 'The fourth marketing push is dropped',
      },
    },
    {
      title: 'Quiet hours',
      tag: 'concept',
      heading: 'Hold marketing while the user sleeps',
      eli5: 'Sam goes to bed at ten. The clerk keeps the flyers in a drawer until morning, so no buzz wakes Sam up.',
      body: [
        '**Quiet hours** are a per-user window, here 22:00 to 08:00 in the user\'s own time zone. A marketing message that arrives inside it is not dropped. It is held in a delayed queue and released when the window ends.',
        'Urgent categories such as login codes ignore quiet hours. Users can change their window in settings.',
      ],
      keyIdea: 'Check the user\'s local time before sending marketing, and hold the message until morning.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...api, at: at(-4.5, 0), status: 'active' },
          { id: 'quiet', kind: 'block', at: at(-0.5, -3.5), label: 'quiet hours', sub: '22:00 to 08:00 local', icon: 'Clock', tint: 'amber', status: 'active' },
          { id: 'qHold', kind: 'queue', at: at(-0.5, 3.5), label: 'held queue', sub: 'delayed', badge: 'release 08:00' },
          { ...qBulk, at: at(3.5, 0), badge: 'sent at 08:00' },
        ],
        links: [link('api', 'quiet'), link('api', 'qHold'), link('qHold', 'qBulk', { style: 'dashed', label: 'at 08:00' })],
        flows: [
          { path: ['api', 'quiet', 'api'], tone: 'request', label: 'local time 23:10', duration: 1.6 },
          { path: ['api', 'qHold'], tone: 'event', label: 'sale: hold', duration: 1.3, delay: 1.8 },
          { path: ['qHold', 'qBulk'], tone: 'event', label: 'released', duration: 1.4, delay: 3.4 },
        ],
        panel: {
          title: 'Quiet hours rules',
          icon: 'Clock',
          rows: [
            { text: 'Window', value: '22:00 to 08:00 local' },
            { text: 'Marketing inside it', value: 'held, not dropped', tone: 'good' },
            { text: 'Urgent categories', value: 'ignore it', tone: 'good' },
          ],
        },
        caption: 'The sale push waits until morning',
      },
    },
    {
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Accept fast, check the user, keep lanes apart',
      eli5: 'The counter takes the note, checks the do-not-send list, fills a card and drops it in the right bin. Red bins are for urgent notes. In part 2 we see what happens when a carrier fails.',
      body: [
        'Services call one API and get `202` at once. The service checks preferences and per-user caps, renders a template, logs the notification and publishes it to a **queue per channel and priority**. Workers call APNs, FCM and the SMS and email providers.',
        'That carries 125M a day and 15K/s, with urgent messages out in about 2 s. Part 2 covers retries, duplicates, tracking and outages.',
      ],
      keyIdea: 'Isolation does the work: separate lanes, a log of every message, and checks before anything is sent.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      metricTones: { p99: 'good', lost: 'good' },
      scene: {
        nodes: [services, api, { ...qPush, status: 'ok' }, { ...qSms, status: 'ok' }, { ...qEmail, status: 'ok' }],
        links: [link('services', 'api'), link('api', 'qPush'), link('api', 'qSms'), link('api', 'qEmail')],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 2, duration: 1 },
          { path: ['api', 'qPush'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['api', 'qSms'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['api', 'qEmail'], tone: 'event', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Part 1 design',
          icon: 'Workflow',
          rows: [
            { text: 'Gate', value: 'prefs, caps', tone: 'good' },
            { text: 'Lanes', value: 'channel x priority' },
            { text: 'Record', value: 'notification log' },
            { text: 'Urgent p99', value: '2 s', tone: 'good' },
          ],
        },
        caption: 'The send path is isolated and recorded',
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
