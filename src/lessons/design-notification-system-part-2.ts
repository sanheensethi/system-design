import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s0: number): [number, number] => {
  const s = s0 * 1.6;
  return [(s + d) / 2, (s - d) / 2];
};
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Eli5 world: the same post office as part 1. Bins are queues, carriers are workers, the phone, text and mail
// companies are the providers, the ledger is the notification log.

const services: SceneNode = { id: 'services', kind: 'block', at: at(-7, 0), label: 'services', sub: 'orders, billing, ads', icon: 'Boxes', tint: 'blue' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-3.5, 0), label: 'notification svc', sub: 'validate, enqueue', icon: 'Workflow', tint: 'violet' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(7.5, 0), label: 'user devices' };
const qPush: SceneNode = { id: 'qPush', kind: 'queue', at: at(0, -4), label: 'push queue' };
const qSms: SceneNode = { id: 'qSms', kind: 'queue', at: at(0, 0), label: 'SMS queue' };
const wPush: SceneNode = { id: 'wPush', kind: 'worker', at: at(3.8, -4), label: 'push workers', sub: 'APNs, FCM' };
const wSms: SceneNode = { id: 'wSms', kind: 'worker', at: at(3.8, 0), label: 'SMS workers' };
const provPush: SceneNode = { id: 'provPush', kind: 'block', at: at(7.5, -4), label: 'APNs / FCM', sub: 'push providers', icon: 'Smartphone', tint: 'teal' };
const dedup: SceneNode = { id: 'dedup', kind: 'cache', at: at(7.5, -4), label: 'done set', sub: 'Redis, 7 days' };
const smsA: SceneNode = { id: 'smsA', kind: 'block', at: at(7.5, -3), label: 'SMS provider A', sub: 'main', icon: 'Signal', tint: 'teal' };
const smsB: SceneNode = { id: 'smsB', kind: 'block', at: at(7.5, 3), label: 'SMS provider B', sub: 'backup', icon: 'Signal', tint: 'violet' };
const events: SceneNode = { id: 'events', kind: 'queue', at: at(3.8, 4), label: 'event stream' };
const warehouse: SceneNode = { id: 'warehouse', kind: 'warehouse', at: at(7.5, 4), label: 'analytics' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: at(-3.5, 4), label: 'queue monitor' };

export const designNotificationSystemPart2: Lesson = {
  id: 'design-notification-system-part-2',
  title: 'Design a notification system (part 2)',
  tagline: 'Retries, dead letters, duplicates, scheduling, security, delivery tracking and surviving a provider outage.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Retries with backoff, permanent failures and dead letters',
    'At-least-once delivery, deduplication by delivery id and push collapse keys',
    'Scheduled notifications and push security',
    'Delivery tracking, analytics and queue monitoring',
    'Message expiry, circuit breakers, a backup provider and bulk waits',
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
      title: 'Providers fail',
      tag: 'problem',
      heading: 'Part 1 sends fine until a provider hiccups',
      eli5: 'The carriers are fast, but the phone company sometimes says "busy" or does not answer at all. Without a plan, those notes are simply lost on the doorstep.',
      body: [
        'Part 1 gave us isolated lanes, a log and 125M a day. Outside providers still fail all the time: timeouts, `429 Too Many Requests`, `503`, tokens that no longer exist.',
        'Every failure needs a decision: try again, give up quietly, or ask a human.',
      ],
      keyIdea: 'Provider failures are normal. Each kind of failure needs its own rule.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '? on failure', dupes: '?' },
      metricTones: { lost: 'warn' },
      scene: {
        nodes: [
          { ...qPush, at: at(-3.5, 0) },
          { ...wPush, at: at(0, 0), status: 'active' },
          { ...provPush, at: at(3.8, 0), status: 'hot', chips: [{ text: '503', tone: 'bad' }, { text: '429', tone: 'warn' }, { text: 'bad token', tone: 'bad' }] },
        ],
        links: [link('qPush', 'wPush'), link('wPush', 'provPush')],
        flows: [
          { path: ['qPush', 'wPush'], tone: 'event', duration: 1 },
          { path: ['wPush', 'provPush'], tone: 'request', label: 'send', duration: 1.2, delay: 1.1 },
          { path: ['provPush', 'wPush'], tone: 'error', label: 'failure', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Failures to decide on',
          icon: 'Bug',
          rows: [
            { text: 'Timeout, 503', value: 'try later', tone: 'warn' },
            { text: '429 slow down', value: 'try later', tone: 'warn' },
            { text: 'Token invalid', value: 'never retry', tone: 'bad' },
            { text: 'Keeps failing', value: 'ask a human' },
          ],
        },
        caption: 'Every failure needs a rule',
      },
    },
    {
      title: 'Backoff',
      tag: 'concept',
      heading: 'Retry transient failures with backoff and a limit',
      eli5: 'If the phone company says "busy, try later", the carrier puts the note in a waiting tray and tries again, waiting longer each time, so he does not knock a hundred times a second.',
      body: [
        'A failed send goes to a **retry queue** with exponential backoff and jitter, from the timeouts and retries lesson: 1, 2, 4, 8, 16 and 32 s, for at most 6 attempts. A `429` with a `Retry-After` header overrides the computed delay.',
        'Each attempt updates the notification log, so a stuck notification is visible.',
      ],
      keyIdea: 'Retry transient failures with growing, jittered delays and a hard attempt limit.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...qSms, at: at(-3.5, 0), label: 'push queue' },
          { ...wSms, at: at(0, 0), label: 'push workers', status: 'active' },
          { ...provPush, at: at(3.8, 0), status: 'hot', badge: '503' },
          { id: 'retry', kind: 'queue', at: at(0, 3.5), label: 'retry queue', sub: 'delayed', status: 'active', badge: 'attempt 3 in 4 s' },
        ],
        links: [link('qSms', 'wSms'), link('wSms', 'provPush'), link('wSms', 'retry', { style: 'dashed', label: 'on 503' }), link('retry', 'qSms', { style: 'dashed' })],
        flows: [
          { path: ['qSms', 'wSms'], tone: 'event', duration: 1 },
          { path: ['wSms', 'provPush'], tone: 'request', label: 'send', duration: 1, delay: 1.1 },
          { path: ['provPush', 'wSms'], tone: 'error', label: '503', duration: 1, delay: 2.2 },
          { path: ['wSms', 'retry'], tone: 'event', label: 'retry later', duration: 1.2, delay: 3.3 },
          { path: ['retry', 'qSms'], tone: 'event', label: 'after backoff', duration: 1.4, delay: 4.6 },
        ],
        panel: {
          title: 'Backoff schedule',
          icon: 'Timer',
          rows: [
            { text: 'Waits between tries', value: '1, 2, 4, 8, 16, 32 s' },
            { text: 'Max attempts', value: '6', tone: 'warn' },
            { text: '429 + Retry-After', value: 'use that delay', tone: 'good' },
            { text: 'Jitter', value: 'x 0.5 to 1.5' },
          ],
          footer: { text: 'Jitter spreads retries apart', tone: 'muted' },
        },
        caption: 'Back off, then try again',
      },
    },
    {
      title: 'Never retry',
      tag: 'concept',
      heading: 'Some failures must never be retried',
      eli5: 'If the phone company says "nobody lives at that address any more", the carrier crosses the address off the book. Knocking again wastes money and annoys the phone company.',
      body: [
        'If APNs or FCM reports a token as no longer valid, the app was uninstalled, so delete the token. A hard email bounce marks the address as bad.',
        'Retrying those wastes money and, for email, hurts the sender reputation that decides whether mail lands in the inbox.',
      ],
      keyIdea: 'Permanent failures end the attempt and clean up the address. Only transient ones get retried.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...wPush, at: at(-3.5, 0), status: 'active' },
          { ...provPush, at: at(0.5, -3), status: 'hot', badge: 'token invalid' },
          { id: 'db', kind: 'db', at: at(0.5, 3), label: 'device table', status: 'active', badge: 'token deleted' },
        ],
        links: [link('wPush', 'provPush'), link('wPush', 'db', { style: 'dashed' })],
        flows: [
          { path: ['wPush', 'provPush'], tone: 'request', label: 'send', duration: 1.2 },
          { path: ['provPush', 'wPush'], tone: 'error', label: 'invalid token', duration: 1.2, delay: 1.3 },
          { path: ['wPush', 'db'], tone: 'data', label: 'delete token', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Retry or not',
          icon: 'Table',
          rows: [
            { text: '429, 500, 502, 503, 504', value: 'retry', tone: 'good' },
            { text: 'Token invalid', value: 'delete token', tone: 'bad' },
            { text: 'Hard email bounce', value: 'mark address bad', tone: 'bad' },
          ],
        },
        caption: 'Uninstalled apps are crossed off',
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
            delay = e.retry_after or 2 ** msg.attempts * random.uniform(0.5, 1.5)  # 429: obey Retry-After
            retry_queue.publish(msg.next_attempt(), delay_seconds=delay)
        else:
            dead_letters.publish(msg)             # a human looks at these
            log.mark(msg.id, "failed")
        return False`,
        highlight: [10, 11, 14, 15, 17],
      },
    },
    {
      title: 'Dead letters',
      tag: 'concept',
      heading: 'Park what keeps failing in a dead letter queue',
      eli5: 'Notes that fail again and again go in a **dead letter** box. A grown-up looks inside each morning, fixes the cause and sends them again, or throws them away on purpose.',
      body: [
        'After the sixth attempt a message moves to a **dead letter queue** and an alert fires. Nothing is silently dropped, and the log row says `failed` with the reason. Rows stuck in `queued` are republished by the sweeper.',
        'A person (or a script) finds the cause, such as a bad template, then replays the messages once it is fixed.',
      ],
      keyIdea: 'Dead letters make the loss visible and replayable. A growing pile is a signal to look.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [
          { ...wPush, at: at(-3.5, 0), status: 'active', badge: 'attempt 7' },
          { id: 'dead', kind: 'queue', at: at(0.5, -3), label: 'dead letters', status: 'hot', badge: '12 today' },
          { ...monitor, at: at(0.5, 3), label: 'alerting', badge: 'page on-call' },
        ],
        links: [link('wPush', 'dead', { style: 'dashed' }), link('dead', 'monitor', { style: 'faint' })],
        flows: [
          { path: ['wPush', 'dead'], tone: 'error', label: 'gave up', duration: 1.3 },
          { path: ['dead', 'monitor'], tone: 'event', label: 'alert', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'In the dead letter box',
          icon: 'List',
          rows: [
            { text: 'n-9120, push', value: '6 timeouts' },
            { text: 'n-9133, email', value: 'template error', tone: 'bad' },
            { text: 'Total today', value: '12' },
            { text: 'Queued, never published', value: 'sweeper republishes', tone: 'good' },
          ],
          footer: { text: 'Fix the cause, then replay', tone: 'good' },
        },
        caption: 'A human looks at what retries could not fix',
      },
    },
    {
      title: 'Expiry',
      tag: 'concept',
      heading: 'Drop messages that are too late to be useful',
      eli5: 'A door code that is five minutes old no longer opens the door. The carrier checks the time on the note and throws away the stale ones instead of delivering them.',
      body: [
        'Messages carry an **expiry**. A login code valid for 5 minutes is dropped once it expires, even if it waited in a queue or a retry, since a stale code only confuses the user.',
        'The worker checks the expiry before each attempt and marks the log row `expired`. Expired messages are a normal outcome, so they do not go to the dead letter queue.',
      ],
      keyIdea: 'Give each message a deadline. Late can mean useless, and dropping it is the right outcome.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'possible' },
      scene: {
        nodes: [
          { ...qSms, at: at(-3.5, 0), badge: 'code, 6 min old' },
          { ...wSms, at: at(0.5, 0), status: 'active', chips: ['expired? yes'] },
          { id: 'trash', kind: 'block', at: at(4.5, 0), label: 'expired', sub: 'code older than 5 min', icon: 'Clock', tint: 'gray', status: 'dim' },
        ],
        links: [link('qSms', 'wSms'), link('wSms', 'trash', { style: 'faint' })],
        flows: [
          { path: ['qSms', 'wSms'], tone: 'event', label: 'login code', duration: 1.2 },
          { path: ['wSms', 'trash'], tone: 'error', label: 'stale: drop', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Time to live',
          icon: 'Timer',
          rows: [
            { text: 'Login code', value: '5 min', tone: 'warn' },
            { text: 'Order update', value: '24 h' },
            { text: 'Marketing', value: 'end of campaign' },
            { text: 'Log status', value: 'expired', tone: 'muted' },
          ],
        },
        caption: 'A stale code is dropped, not sent',
      },
    },
    {
      title: 'Duplicates',
      tag: 'tradeoff',
      heading: 'At-least-once delivery means duplicates',
      eli5: 'A carrier delivers a note but trips before ticking it off the list, so another carrier delivers it again. Sam now has two identical cards.',
      body: [
        'Queues deliver at least once. A worker that crashes after the provider accepted a message, but before it acked the queue, causes a redelivery, and the user gets two "your parcel shipped" pushes.',
        'Callers cause duplicates too: a timeout on `POST /v1/notifications` makes the order service send again.',
      ],
      keyIdea: 'Never losing a message means sometimes sending it twice. Duplicates must be cut down on purpose.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'common' },
      metricTones: { dupes: 'bad' },
      scene: {
        nodes: [
          { ...qPush, at: at(-3.5, 0), badge: 'redelivered' },
          { ...wPush, at: at(0.5, 0), status: 'active', chips: ['n-81'] },
          { ...phone, at: at(4.5, 0), status: 'hot', badge: '2 pushes' },
        ],
        links: [link('qPush', 'wPush'), link('wPush', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['qPush', 'wPush'], tone: 'event', label: 'n-81', duration: 1 },
          { path: ['wPush', 'phone'], tone: 'event', label: 'push', duration: 1.2, delay: 1.1 },
          { path: ['qPush', 'wPush'], tone: 'event', label: 'n-81 again', duration: 1, delay: 2.8 },
          { path: ['wPush', 'phone'], tone: 'error', label: 'push again', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'Where duplicates come from',
          icon: 'Copy',
          rows: [
            { text: 'Crash before the ack', value: 'queue redelivers', tone: 'warn' },
            { text: 'Caller times out', value: 'caller resends', tone: 'warn' },
            { text: 'Retry after slow success', value: 'second send', tone: 'warn' },
          ],
        },
        caption: 'The same push, delivered twice',
      },
    },
    {
      title: 'Dedup layers',
      tag: 'concept',
      heading: 'Dedupe at the API and again in the worker',
      eli5: 'Now each note\'s number goes on a "done" list. A carrier checks the list before walking out, and skips any note already on it. That is **deduplication**.',
      body: [
        'At the API, the `idempotency_key` maps to the first notification id, so a repeated call returns the same id, as in the API design lesson.',
        'In the worker, the **delivery id** (notification id, channel and device) is checked against a **done set** in Redis before sending, and a short lock keeps two workers from sending the same copy at once. A notification id alone would skip a user\'s second device.',
      ],
      keyIdea: 'Two layers cut duplicates: an idempotency key at the API and a done set keyed by delivery id in the worker.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      metricTones: { dupes: 'good' },
      scene: {
        nodes: [
          { ...qPush, at: at(-3.5, 0), badge: 'n-81 again' },
          { ...wPush, at: at(0.5, 0), status: 'active' },
          { ...dedup, at: at(4.5, -3), status: 'ok', badge: 'n-81/9f3a done' },
          { ...phone, at: at(4.5, 3), status: 'ok', badge: '1 push' },
        ],
        links: [link('qPush', 'wPush'), link('wPush', 'dedup'), link('wPush', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['wPush', 'dedup', 'wPush'], tone: 'request', label: 'done?', duration: 1.6 },
          { path: ['wPush', 'phone'], tone: 'event', label: 'push once', duration: 1.2, delay: 1.7 },
          { path: ['qPush', 'wPush', 'dedup', 'wPush'], tone: 'error', label: 'n-81 again: skip', duration: 2.4, delay: 3.2 },
        ],
        panel: {
          title: 'Two layers',
          icon: 'Shield',
          rows: [
            { text: 'API', value: 'idempotency_key', tone: 'good' },
            { text: 'Worker', value: 'done set + lock', tone: 'good' },
            { text: 'Key', value: 'delivery id, per device' },
            { text: 'Memory of done', value: '7 days' },
          ],
        },
        caption: 'The second copy of n-81 is dropped',
      },
      code: {
        language: 'python',
        title: 'Skip notifications that were already sent',
        source: `def handle_once(msg):
    # delivery_id = notification id + channel + device, so each device counts separately
    done_key = f"sent:{msg.delivery_id}"
    if redis.exists(done_key):
        return                                    # a copy of a sent message: drop
    # short lock so two workers holding copies do not both send
    if not redis.set(f"lock:{msg.delivery_id}", worker_id, nx=True, ex=30):
        return
    try:
        if handle(msg):                           # True once the provider accepted
            redis.set(done_key, 1, ex=86400)  # 24 h; 7 days is tens of GB
    finally:
        redis.delete(f"lock:{msg.delivery_id}")`,
        highlight: [2, 3, 7, 10, 11],
      },
    },
    {
      title: 'Collapse keys',
      tag: 'concept',
      heading: 'A third layer: let the provider collapse copies',
      eli5: 'The phone company can be told "if two notes carry the same sticker, show only the newest one". Even if a copy slips past our list, Sam sees one card.',
      body: [
        'Push providers can collapse duplicates themselves. Set `apns-collapse-id` for APNs or `collapse_key` for FCM to the notification id, and a second push with the same key replaces the first on the device instead of showing twice.',
        'The done set costs memory: about 125M x 7 days is 875M keys, tens of GB of Redis. A shorter TTL, such as 24 h, is the usual trade-off.',
      ],
      keyIdea: 'Collapse keys catch what the done set misses. Keep the done set short, since a day of memory is enough.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      metricTones: { dupes: 'good' },
      scene: {
        nodes: [
          { ...wPush, at: at(-3.5, 0), status: 'active', chips: ['n-81 twice'] },
          { ...provPush, at: at(0.5, 0), status: 'ok', chips: [{ text: 'collapse-id: n-81', tone: 'good' }] },
          { ...phone, at: at(4.5, 0), status: 'ok', badge: '1 card shown' },
        ],
        links: [link('wPush', 'provPush'), link('provPush', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['wPush', 'provPush'], tone: 'request', label: 'push, n-81', duration: 1.2 },
          { path: ['wPush', 'provPush'], tone: 'request', label: 'copy, n-81', duration: 1.2, delay: 1.0 },
          { path: ['provPush', 'phone'], tone: 'event', label: 'one push', duration: 1.3, delay: 2.4 },
        ],
        panel: {
          title: 'Three layers and their cost',
          icon: 'Shield',
          rows: [
            { text: 'API', value: 'idempotency_key' },
            { text: 'Worker', value: 'done set' },
            { text: 'Provider', value: 'collapse key', tone: 'good' },
            { text: 'Done set, 7 days', value: '875M keys, tens of GB', tone: 'warn' },
            { text: 'Done set, 24 h', value: 'about 125M keys', tone: 'good' },
          ],
        },
        caption: 'The provider shows one push',
      },
    },
    {
      title: 'The gap',
      tag: 'tradeoff',
      heading: 'A small gap stays: exactly-once is out of reach',
      eli5: 'One tiny hole remains. A carrier hands over the note, then faints before he ticks the list. The next carrier cannot know. We pick "maybe twice" over "maybe never".',
      body: [
        'A crash after the provider accepted and before the done mark was written still lets a copy through. Exactly-once delivery to a phone is not possible here.',
        'The goal is never losing a message and making duplicates rare. Collapse keys shrink the gap on the device. For payments you would add stronger guards.',
      ],
      keyIdea: 'Choose at-least-once with dedup. Zero loss and rare duplicates beat the impossible exactly-once.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          { ...wPush, at: at(-3.5, 0), status: 'down', badge: 'crash' },
          { ...provPush, at: at(0.5, -3), status: 'ok', badge: 'accepted' },
          { ...dedup, at: at(0.5, 3), status: 'dim', badge: 'not marked' },
        ],
        links: [link('wPush', 'provPush'), link('wPush', 'dedup', { style: 'faint' })],
        flows: [
          { path: ['wPush', 'provPush'], tone: 'request', label: 'send', duration: 1.3 },
          { path: ['provPush', 'wPush'], tone: 'response', label: 'accepted', duration: 1.3, delay: 1.4 },
          { path: ['wPush', 'dedup'], tone: 'error', label: 'mark lost', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'The two options',
          icon: 'Scale',
          rows: [
            { text: 'At-most-once', value: 'may lose', tone: 'bad' },
            { text: 'At-least-once', value: 'may repeat, rarely', tone: 'good' },
            { text: 'Exactly-once', value: 'not possible here', tone: 'warn' },
          ],
        },
        caption: 'The window between accept and mark',
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
      title: 'Scheduling',
      tag: 'concept',
      heading: 'Scheduled and triggered notifications',
      eli5: 'Some notes are not for now. "Remind Sam at 8 tomorrow morning." The clerk puts them in a drawer with a time on each, and a timer takes them out when the hour comes.',
      body: [
        'Besides client calls, a **scheduler** (a cron job or a delayed queue) fires notifications at a set time: a payment reminder, a 9 AM digest, a cart nudge two hours after the user left.',
        'Store the target time in the user\'s own time zone. A digest for everyone goes to the campaign service from part 1. At fire time each message takes the normal path, with preferences, caps and lanes applied.',
      ],
      keyIdea: 'A scheduler only decides when. The message then takes the same checked path as any other.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          { id: 'sched', kind: 'block', at: at(-7, 0), label: 'scheduler', sub: 'cron, delayed jobs', icon: 'Clock', tint: 'amber', status: 'active' },
          { ...api, status: 'active', badge: 'normal path' },
          { ...qPush, at: at(0, 0), badge: '9 AM digest' },
        ],
        links: [link('sched', 'api', { label: 'at 09:00 local' }), link('api', 'qPush')],
        flows: [
          { path: ['sched', 'api'], tone: 'request', label: 'digest, user 7', count: 2, duration: 1.4 },
          { path: ['api', 'qPush'], tone: 'event', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Scheduled sends',
          icon: 'Clock',
          rows: [
            { text: 'Payment reminder', value: 'due date - 2 days' },
            { text: 'Morning digest', value: '09:00 user time' },
            { text: 'Cart nudge', value: '2 h after exit' },
          ],
          footer: { text: 'Prefs and caps still apply', tone: 'good' },
        },
        caption: 'A timer, then the usual checks',
      },
    },
    {
      title: 'Push security',
      tag: 'concept',
      heading: 'Keep the doors locked',
      eli5: 'Only shops with a badge may hand in notes, and the clerk never writes secrets on a postcard anyone could read on the way, so the card only says "you have a new message".',
      body: [
        'The send API accepts only authenticated internal services or verified clients, with a key and secret per caller, so strangers cannot spam users. Provider credentials stay in a secrets store, not in code.',
        'A payload crosses outside networks and shows on a lock screen. Keep sensitive data out of it: send "new message" and let the app fetch the details after it opens.',
      ],
      keyIdea: 'Authenticate every caller, store provider keys in a vault, and never put secrets in a payload.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          { ...services, status: 'active', chips: ['app key + secret'] },
          { ...api, status: 'ok', chips: [{ text: 'verify caller', tone: 'good' }] },
          { id: 'vault', kind: 'vault', at: at(0, -3.5), label: 'secrets store', sub: 'provider keys', status: 'ok' },
          { id: 'rogue', kind: 'block', at: at(-7, 4.5), label: 'stranger', sub: 'no key', icon: 'Bug', tint: 'red', status: 'down' },
        ],
        links: [link('services', 'api'), link('rogue', 'api', { style: 'faint' }), link('api', 'vault', { style: 'dashed' })],
        flows: [
          { path: ['services', 'api'], tone: 'request', label: 'signed call', duration: 1.2 },
          { path: ['rogue', 'api'], tone: 'error', label: '401', duration: 1.4, delay: 1.4 },
          { path: ['api', 'vault'], tone: 'request', label: 'get key', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Payload on the lock screen',
          icon: 'Shield',
          rows: [
            { text: '"Your code is 482913"', value: 'visible to all', tone: 'bad' },
            { text: '"New message"', value: 'safe', tone: 'good' },
            { text: 'Provider keys', value: 'secrets store', tone: 'good' },
          ],
        },
        caption: 'Only badged callers get in',
      },
    },
    {
      title: 'Event tracking',
      tag: 'concept',
      heading: 'Stamp every stage with the notification id',
      eli5: 'Each note gets a ticket that is stamped at every stop: in the bin, out with the carrier, delivered, opened. The stamps tell us exactly where a note is.',
      body: [
        'Every stage emits an event with the notification id: `queued`, `sent`, `delivered`, `opened`, `clicked`, `failed`. Providers report deliveries and bounces by webhook.',
        'Opens come from the app for push and from a tracking pixel for email. Clicks pass through a redirect link.',
      ],
      keyIdea: 'One id, stamped at every stage, tells you exactly where any notification is.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          { ...wPush, at: at(-3.5, -3.5) },
          { ...phone, at: at(0.5, -3.5), badge: 'opened' },
          { ...events, at: at(0.5, 3), status: 'active', badge: '3K events/s' },
        ],
        links: [link('wPush', 'phone', { style: 'dashed' }), link('wPush', 'events', { style: 'dashed' }), link('phone', 'events', { style: 'dashed' })],
        flows: [
          { path: ['wPush', 'phone'], tone: 'event', label: 'push', duration: 1.2 },
          { path: ['wPush', 'events'], tone: 'event', label: 'sent', duration: 1.2, delay: 0.4 },
          { path: ['phone', 'events'], tone: 'event', label: 'opened', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Life of n-81',
          icon: 'List',
          rows: [
            { text: 'queued', value: '09:00:01' },
            { text: 'sent', value: '09:00:02' },
            { text: 'delivered', value: '09:00:03', tone: 'good' },
            { text: 'opened', value: '09:04:40', tone: 'good' },
          ],
        },
        caption: 'Every stage emits an event',
      },
    },
    {
      title: 'Analytics',
      tag: 'concept',
      heading: 'Events feed the log and the warehouse',
      eli5: 'Counting the stamps shows which notes people read. If nobody reads the toy shop\'s flyers and many ask to stop, the shop writes better ones. That counting is **analytics**.',
      body: [
        'Events flow through a stream into the notification log for per-message status, and into a **warehouse** for totals: delivery rate per provider, open rate per template, unsubscribes per campaign.',
        'A template that drives opt-outs gets rewritten or retired.',
      ],
      keyIdea: 'The same event stream powers support lookups and product analytics.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          { ...events, at: at(-3.5, 0), status: 'active' },
          { id: 'log', kind: 'db', at: at(0.5, -3.5), label: 'notification log', sub: 'per message' },
          { ...warehouse, at: at(0.5, 3.5), status: 'active', badge: 'open rate 7%' },
        ],
        links: [link('events', 'log'), link('events', 'warehouse')],
        flows: [
          { path: ['events', 'log'], tone: 'data', label: 'status', duration: 1.3 },
          { path: ['events', 'warehouse'], tone: 'data', label: 'totals', count: 3, duration: 1.3, delay: 0.5 },
        ],
        panel: {
          title: 'Questions answered',
          icon: 'TrendingUp',
          rows: [
            { text: 'Delivery rate by provider', value: '98.7%', tone: 'good' },
            { text: 'Open rate, push', value: '7%' },
            { text: 'Unsubscribes, sale email', value: '0.4%', tone: 'warn' },
          ],
        },
        caption: 'One stream, two readers',
      },
    },
    {
      title: 'Monitoring',
      tag: 'concept',
      heading: 'Watch queue depth and the age of the oldest message',
      eli5: 'A supervisor looks at each bin and asks two things: how many notes are in it, and how long has the oldest one waited? A very old urgent note rings a bell.',
      body: [
        'Per lane, watch queue depth and the age of the oldest message. Depth drives worker autoscaling.',
        'An urgent message older than 30 s pages the on-call engineer. A growing retry backlog shows up on the dashboard before users notice.',
      ],
      keyIdea: 'Alert on age, scale on depth. Age tells you users are waiting.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          { ...monitor, at: at(-3.5, 0), status: 'active' },
          { ...qPush, at: at(0.5, -3.5), badge: 'depth 1.2K', chips: [{ text: 'oldest 2 s', tone: 'good' }] },
          { id: 'qUrgent', kind: 'queue', at: at(0.5, 3.5), label: 'urgent queue', status: 'hot', badge: 'oldest 41 s', chips: [{ text: 'page on-call', tone: 'bad' }] },
        ],
        links: [link('monitor', 'qPush', { style: 'faint' }), link('monitor', 'qUrgent')],
        flows: [
          { path: ['monitor', 'qPush', 'monitor'], tone: 'request', label: 'depth?', duration: 1.6 },
          { path: ['monitor', 'qUrgent', 'monitor'], tone: 'request', label: 'age?', duration: 1.6, delay: 0.6 },
        ],
        panel: {
          title: 'Alert rules',
          icon: 'Activity',
          rows: [
            { text: 'Depth rising', value: 'add workers' },
            { text: 'Urgent oldest > 30 s', value: 'page', tone: 'bad' },
            { text: 'Dead letters growing', value: 'ticket', tone: 'warn' },
          ],
        },
        caption: 'Age is what users feel',
      },
    },
    {
      title: 'Provider outage',
      tag: 'case',
      heading: 'Case: the SMS provider goes down for 30 minutes',
      eli5: 'The text company closes its door. Carriers keep knocking, each wasting three seconds per knock, and the door codes by text stop arriving. Push and email carry on, since they use other bins.',
      body: [
        'At 14:00 the main SMS provider starts timing out. SMS workers burn their time on 3 s timeouts, retries pile up, and login codes by text stop arriving.',
        'Push and email keep flowing, because they have their own queues and workers.',
      ],
      keyIdea: 'Lane isolation contains the damage, but the broken lane still needs its own fix.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '3 min', lost: '0', dupes: 'rare' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...qSms, at: at(-3.5, 0), status: 'hot', badge: 'backlog growing' },
          { ...wSms, at: at(0.5, 0), status: 'hot', load: 95, badge: '3 s timeouts' },
          { ...smsA, at: at(4.5, 0), status: 'down', badge: 'timeouts' },
          { ...wPush, at: at(0.5, -5.5), status: 'ok' },
        ],
        links: [link('qSms', 'wSms'), link('wSms', 'smsA', { label: 'times out', labelTone: 'warn' })],
        flows: [
          { path: ['qSms', 'wSms'], tone: 'event', label: 'login code', duration: 1 },
          { path: ['wSms', 'smsA'], tone: 'request', duration: 1.2, delay: 1.1 },
          { path: ['smsA', 'wSms'], tone: 'error', label: 'timeout', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'At 14:05',
          icon: 'Bug',
          rows: [
            { text: 'SMS provider', value: 'down', tone: 'bad' },
            { text: 'SMS codes', value: 'not arriving', tone: 'bad' },
            { text: 'Push and email', value: 'healthy', tone: 'good' },
          ],
        },
        caption: 'Only the SMS lane is hurt',
      },
    },
    {
      title: 'Circuit breaker',
      tag: 'concept',
      heading: 'A circuit breaker stops the knocking',
      eli5: 'After a few unanswered knocks, the carrier stops knocking at the closed door. That stop-knocking switch is a **circuit breaker**. Every so often he tries once to see if the door has opened.',
      body: [
        'Each provider client has a **circuit breaker**, as in the circuit breakers lesson. When about half the calls fail over 20 s, it opens, and workers stop calling that provider at once instead of burning 3 s timeouts.',
        'A half-open probe sends a few calls to the provider and closes the breaker when they succeed.',
      ],
      keyIdea: 'A breaker fails fast once a provider is clearly down, and probes to find out when it is back.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '45 s (failover)', lost: '0', dupes: 'rare' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...wSms, at: at(-3.5, 0), status: 'active', badge: 'no 3 s waits' },
          { id: 'breaker', kind: 'block', at: at(0, 0), label: 'breaker', sub: 'open', icon: 'Zap', tint: 'red', status: 'active' },
          { ...smsA, at: at(4.5, 0), status: 'down', badge: 'timeouts' },
        ],
        links: [link('wSms', 'breaker'), link('breaker', 'smsA', { style: 'faint', label: 'probe: a few calls' })],
        flows: [
          { path: ['wSms', 'breaker'], tone: 'request', label: 'send', duration: 1.1 },
          { path: ['breaker', 'wSms'], tone: 'error', label: 'open: fail fast', duration: 1.1, delay: 1.2 },
          { path: ['breaker', 'smsA'], tone: 'request', label: 'probe', duration: 1.3, delay: 2.6 },
        ],
        panel: {
          title: 'Breaker rule',
          icon: 'Zap',
          rows: [
            { text: 'Opens when', value: '~50% fail in 20 s', tone: 'warn' },
            { text: 'While open', value: 'calls fail at once' },
            { text: 'Half-open probe', value: 'a few calls to A' },
            { text: 'On recovery', value: 'breaker closes', tone: 'good' },
          ],
        },
        caption: 'Stop calling a provider that is down',
      },
    },
    {
      title: 'Backup provider',
      tag: 'concept',
      heading: 'Urgent SMS fails over to a backup provider',
      eli5: 'While the door stays closed, urgent texts go to a second text company across the street, one the post office signed up with long before.',
      body: [
        'With the breaker open, urgent SMS switches to a **secondary provider** set up in advance with its own sender numbers. Login codes resume within a minute.',
        'The probe keeps testing the main provider, and traffic moves back to it when it recovers.',
      ],
      keyIdea: 'A pre-integrated backup carries urgent traffic until the main provider returns.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '45 s (failover)', lost: '0', dupes: 'rare' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...wSms, at: at(-3.5, 0), status: 'active', badge: 'breaker open' },
          { ...smsA, at: at(0.5, -3.5), status: 'down', badge: 'timeouts' },
          { ...smsB, at: at(0.5, 3.5), status: 'ok', badge: 'urgent only' },
          { ...phone, at: at(4.5, 3.5), status: 'ok', badge: 'code arrived' },
        ],
        links: [link('wSms', 'smsA', { style: 'faint' }), link('wSms', 'smsB', { label: 'failover' }), link('smsB', 'phone', { style: 'dashed' })],
        flows: [
          { path: ['wSms', 'smsA'], tone: 'error', label: 'skip: breaker open', duration: 1.2 },
          { path: ['wSms', 'smsB'], tone: 'request', label: 'login code', duration: 1.3, delay: 1.3 },
          { path: ['smsB', 'phone'], tone: 'event', label: 'SMS', duration: 1.3, delay: 2.7 },
        ],
        panel: {
          title: 'Failover',
          icon: 'Table',
          rows: [
            { text: 'Backup', value: 'provider B, own numbers' },
            { text: 'Switch time', value: 'under a minute', tone: 'good' },
            { text: 'Back to A', value: 'after a probe succeeds' },
          ],
        },
        caption: 'Login codes resume in under a minute',
      },
    },
    {
      title: 'Bulk waits',
      tag: 'tradeoff',
      heading: 'Bulk SMS waits instead of using the backup',
      eli5: 'Flyers do not get the pricey backup company. They wait in the bin until the main company opens again, because a late flyer costs nothing.',
      body: [
        'Bulk SMS does not fail over. It waits in its queue, because the backup costs more and has lower limits.',
        'Spend the backup on urgent traffic only. A sale text that arrives an hour late still works.',
      ],
      keyIdea: 'Spend the backup on urgent traffic only, and let bulk wait for the main provider.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '45 s (failover)', lost: '0', dupes: 'rare' },
      scene: {
        nodes: [
          { ...wSms, at: at(-3.5, 0), status: 'active' },
          { id: 'qBulk', kind: 'queue', at: at(0.5, -3.5), label: 'bulk SMS queue', status: 'hot', badge: 'waits for A' },
          { ...smsB, at: at(0.5, 3.5), status: 'ok', badge: 'urgent only' },
        ],
        links: [link('wSms', 'qBulk', { style: 'dashed' }), link('wSms', 'smsB')],
        flows: [
          { path: ['wSms', 'qBulk'], tone: 'event', label: 'hold sale SMS', duration: 1.3 },
          { path: ['wSms', 'smsB'], tone: 'request', label: 'fresh code', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Who uses the backup',
          icon: 'Table',
          rows: [
            { text: 'Login code', value: 'provider B', tone: 'good' },
            { text: 'Marketing SMS', value: 'waits for A', tone: 'muted' },
          ],
        },
        caption: 'Not every message deserves the backup',
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'Expect failure, record everything',
      eli5: 'The post office keeps a ledger and a done list, retries busy companies, boxes up hopeless notes for a grown-up, and switches to a second text company when the first closes. That is the whole **notification system**.',
      body: [
        '**Retries** with backoff handle blips, invalid tokens are deleted, and dead letters catch the rest. A sweeper republishes rows never published. **Dedup** by delivery id and collapse keys keeps duplicates rare. **Tracking** events feed support and alerts.',
        '**Circuit breakers** with a backup provider ride out an outage, bulk waits, and expired messages are dropped.',
      ],
      keyIdea: 'Plan for each kind of failure: retry, drop, park, dedupe, fail over. Then record all of it.',
      metrics: { daily: '120M sent', peak: '15K/s', p99: '2 s', lost: '0', dupes: 'rare' },
      metricTones: { lost: 'good', dupes: 'good', p99: 'good' },
      scene: {
        nodes: [services, api, { ...qSms, at: at(0, 0), status: 'ok' }, { ...wSms, at: at(3.8, 0), status: 'ok' }, { ...smsB, at: at(7.5, 0), label: 'providers', sub: 'main + backup', tint: 'teal' }],
        links: [link('services', 'api'), link('api', 'qSms'), link('qSms', 'wSms'), link('wSms', 'smsB')],
        flows: [
          { path: ['services', 'api'], tone: 'request', count: 2, duration: 1 },
          { path: ['api', 'qSms', 'wSms', 'smsB'], tone: 'event', duration: 2.4, delay: 1.1 },
        ],
        panel: {
          title: 'Failure plan',
          icon: 'Shield',
          rows: [
            { text: 'Blip', value: 'retry with backoff', tone: 'good' },
            { text: 'Bad token', value: 'delete', tone: 'good' },
            { text: 'Repeat copy', value: 'dedupe by delivery id', tone: 'good' },
            { text: 'Provider down', value: 'breaker + backup', tone: 'good' },
            { text: 'Never published', value: 'sweeper republishes', tone: 'good' },
          ],
        },
        caption: 'Every failure has a rule',
      },
      quiz: {
        question: 'A push worker gets "token no longer valid" from the provider. What should it do?',
        options: [
          'Retry six times with backoff',
          'Delete the token and mark the attempt finished',
          'Switch to the backup provider',
          'Move the message to a bulk queue',
        ],
        answer: 1,
        explain: 'An invalid token means the app was uninstalled. Retrying cannot help and costs money, so clean up the address and stop.',
      },
    },
  ],
};
