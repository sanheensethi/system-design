import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const sender: SceneNode = { id: 'sender', kind: 'client', at: at(-7, 0), label: 'sender', sub: 'alice@a.com' };
const reader: SceneNode = { id: 'reader', kind: 'phone', at: at(7.5, 0), label: 'reader', sub: 'bob@b.com' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: at(-3.5, -4), label: 'DNS', sub: 'MX records' };
const mtaIn: SceneNode = { id: 'mtaIn', kind: 'server', at: at(-3.5, 0), label: 'inbound MTA', sub: 'SMTP port 25' };
const mtaOut: SceneNode = { id: 'mtaOut', kind: 'server', at: at(-3.5, 4), label: 'outbound MTA', sub: 'queue and retry' };
const spam: SceneNode = { id: 'spam', kind: 'limiter', at: at(0, -3.5), label: 'spam filter', sub: 'score each mail' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(0, 3.5), label: 'mail queue', sub: 'durable' };
const meta: SceneNode = { id: 'meta', kind: 'db', at: at(3.5, 0), label: 'mailbox DB', sub: 'headers, labels' };
const blob: SceneNode = { id: 'blob', kind: 'storage', at: at(7.5, 4), label: 'blob store', sub: 'bodies, files' };
const search: SceneNode = { id: 'search', kind: 'search', at: at(7.5, -4), label: 'search index', sub: 'per user' };
const monolith: SceneNode = { id: 'mono', kind: 'server', at: at(0, 0), label: 'mail server', sub: 'SMTP + IMAP + disk' };
const sync: SceneNode = { id: 'sync', kind: 'service', at: at(3.5, -4), label: 'sync service', sub: 'push + IMAP' };

const metrics = (m: Record<string, string>) => m;

export const designEmailService: Lesson = {
  id: 'design-email-service',
  title: 'Design an email service',
  tagline: 'Receive, store, search and send 4 billion emails a day for 100M people, and stay out of the spam folder.',
  minutes: 22,
  level: 'Intermediate',
  learn: [
    'Requirements, scale numbers and the three protocols email speaks',
    'A data model for messages, labels, threads and attachments',
    'Inbound and outbound mail paths: MX records, SMTP, queues and retries',
    'Splitting metadata from bodies, and sharding mailboxes by user',
    'Search, spam filtering, SPF, DKIM, DMARC and sender reputation',
    'Client sync, quotas, bounces, and surviving shard, flood and region failures',
  ],
  metrics: [
    { key: 'users', label: 'Users', icon: 'Users' },
    { key: 'rate', label: 'Inbound rate', icon: 'Inbox' },
    { key: 'store', label: 'Storage', icon: 'HardDrive' },
    { key: 'deliver', label: 'Delivery p99', icon: 'Timer' },
    { key: 'lost', label: 'Mail lost', icon: 'Mail' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A mailbox that never loses a letter',
      eli5: 'Imagine a town where everyone has a **mailbox** at the post office. Letters come in from other towns, wait safely for you, and you can send letters out too. Our email service is that post office.',
      body: [
        'We run a webmail service for **100M users**. They send and receive mail with any other provider on the internet, read it in a browser or a phone app, search old mail, and attach files. Mail from other providers arrives over **SMTP**, the standard every email system speaks.',
        'Non-functional goals: **never lose accepted mail**, deliver within seconds, keep reads fast (inbox opens in under 200 ms), filter spam, and keep each user\'s mail private.',
      ],
      keyIdea: 'The product promise is durability and trust: once we accept a message, it must reach the mailbox, and spam must not drown it.',
      metrics: metrics({ users: '100M', rate: '?', store: '?', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...sender, badge: 'send' }, { ...monolith, label: 'our service', sub: 'to design', at: at(0, 0) }, reader],
        links: [link('sender', 'mono'), link('mono', 'reader', { style: 'dashed' })],
        flows: [
          { path: ['sender', 'mono'], tone: 'request', label: 'mail for bob', duration: 1.4 },
          { path: ['mono', 'reader'], tone: 'response', label: 'in inbox', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Send and receive over SMTP' },
            { text: 'Read on web and phone' },
            { text: 'Search, labels, attachments' },
            { text: 'Spam and virus filtering' },
            { text: 'Accepted mail is never lost', tone: 'good' },
          ],
        },
        caption: '100M users, any provider can mail them',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'Napkin math: 46K inbound emails a second',
      eli5: 'If every person in town gets 40 letters a day, the post office must sort a mountain of mail before breakfast. We count the mountain first so we build a big enough sorting room.',
      body: [
        'Assume each user receives 40 emails a day and sends 10. That is **4B received and 1B sent per day**. Inbound averages `4B / 86,400 = 46K/s`, and a Monday-morning peak is about 3x, so plan for **150K/s**. Sending is about 11.6K/s.',
        'An average message with attachments is about **50 KB**: 4B x 50 KB is **200 TB a day**, around 73 PB a year. Metadata (headers, flags, labels) is only about 1 KB each, so 4 TB a day. The bytes are in bodies and files, which shapes everything below.',
      ],
      keyIdea: 'Reads and writes are both high, but storage dominates: 200 TB a day means bodies and attachments need cheap bulk storage, not the database.',
      metrics: metrics({ users: '100M', rate: '46K/s avg, 150K/s peak', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      metricTones: { rate: 'warn', store: 'warn' },
      scene: {
        nodes: [{ ...mtaIn, status: 'active', chips: ['46K/s', '150K/s peak'] }, { ...meta, badge: '4 TB/day' }, { ...blob, badge: '196 TB/day' }],
        links: [link('mtaIn', 'meta'), link('mtaIn', 'blob', { style: 'dashed' })],
        flows: [
          { path: ['mtaIn', 'meta'], tone: 'data', label: '1 KB', duration: 1.2 },
          { path: ['mtaIn', 'blob'], tone: 'data', label: '50 KB', duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Per day',
          icon: 'Table',
          rows: [
            { text: 'Received', value: '4B (46K/s)' },
            { text: 'Sent', value: '1B (11.6K/s)' },
            { text: 'Average size', value: '50 KB' },
            { text: 'Raw storage', value: '200 TB' },
            { text: 'Per user quota', value: '15 GB' },
          ],
        },
      },
    },
    {
      title: 'Protocols and API',
      tag: 'concept',
      heading: 'Three ways in: SMTP, IMAP and our own API',
      eli5: 'Letters between post offices travel in sealed trucks with agreed rules (**SMTP**). You pick up your own letters at the counter with a different set of rules (**IMAP**).',
      body: [
        '**SMTP** moves mail between servers: `HELO`, `MAIL FROM`, `RCPT TO`, `DATA`. It is text, store and forward, and the sender keeps retrying until the receiver says `250 OK`. **IMAP** lets a client read a mailbox and keep it in sync. Our web and phone apps use a JSON HTTPS API instead, because it is easier to scale.',
        'Endpoints: `POST /messages/send`, `GET /messages?label=inbox&page=...`, `GET /messages/{id}`, `PATCH /messages/{id}` (read, star, move), `GET /search?q=`. Lists return headers only.',
      ],
      keyIdea: 'SMTP carries mail between providers. Our own clients talk to a normal HTTPS API that lists headers and fetches bodies on demand.',
      metrics: metrics({ users: '100M', rate: '46K/s avg, 150K/s peak', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...sender, label: 'other provider', sub: 'SMTP' }, { ...mtaIn, status: 'active' }, { ...reader, label: 'our app', sub: 'HTTPS API' }],
        links: [link('sender', 'mtaIn', { label: 'SMTP' }), link('reader', 'mtaIn', { label: 'HTTPS', style: 'dashed' })],
        flows: [
          { path: ['sender', 'mtaIn'], tone: 'request', label: 'RCPT TO bob', duration: 1.4 },
          { path: ['mtaIn', 'sender'], tone: 'response', label: '250 OK', duration: 1.2, delay: 1.5 },
          { path: ['reader', 'mtaIn'], tone: 'request', label: 'GET /messages', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'SMTP conversation',
          icon: 'Code',
          code: 'S: 220 mx.b.com ready\nC: MAIL FROM:<alice@a.com>\nS: 250 OK\nC: RCPT TO:<bob@b.com>\nS: 250 OK\nC: DATA ... message ...\nS: 250 queued as 8F3A',
        },
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Messages, labels and threads',
      eli5: 'Each letter gets a number and goes into its owner\'s box. Colored stickers (**labels**) say "bills" or "friends". Letters about the same topic are clipped together into a **thread**.',
      body: [
        'Two kinds of data. **Metadata**: one row per message per user (sender, subject, date, flags, `thread_id`). **Content**: raw body and attachments, immutable and addressed by hash.',
        'A label is a tag, not a folder, so one message sits under several labels with no copies. Time-ordered `message_id` gives newest-first scans on `(user_id, message_id)`. The `message_label (user_id, label, message_id)` key drives the inbox listing.',
      ],
      keyIdea: 'Metadata is small, mutable and queried constantly. Content is large, immutable and read once. Store them separately.',
      metrics: metrics({ users: '100M', rate: '46K/s avg, 150K/s peak', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...meta, status: 'active', badge: 'rows per message' }, { ...blob, badge: 'immutable' }, { ...reader, label: 'client', at: at(-3.5, 0) }],
        links: [link('reader', 'meta', { label: 'list headers' }), link('meta', 'blob', { label: 'body_ref', style: 'dashed' })],
        flows: [
          { path: ['reader', 'meta'], tone: 'request', label: 'inbox page 1', duration: 1.3 },
          { path: ['meta', 'reader'], tone: 'response', label: '50 headers', duration: 1.3, delay: 1.4 },
        ],
      },
      code: {
        language: 'sql',
        title: 'Mailbox tables (one user lives on one shard)',
        source: `CREATE TABLE message (
  user_id      BIGINT NOT NULL,
  message_id   BIGINT NOT NULL,          -- time-ordered id
  thread_id    BIGINT NOT NULL,
  from_addr    TEXT   NOT NULL,
  subject      TEXT,
  received_at  TIMESTAMPTZ NOT NULL,
  flags        INT    NOT NULL DEFAULT 0, -- read, starred
  body_ref     TEXT   NOT NULL,          -- sha256 of raw message in the blob store
  size_bytes   INT    NOT NULL,
  PRIMARY KEY (user_id, message_id)
);
CREATE TABLE message_label (user_id BIGINT, message_id BIGINT, label TEXT,
  PRIMARY KEY (user_id, label, message_id));
CREATE INDEX ON message (user_id, thread_id);`,
        highlight: [8, 9, 11],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple design: one mail server and one disk',
      eli5: 'At first the post office is one clerk with one big room. Letters arrive at the door, go straight into boxes on shelves, and people pick them up from the same clerk.',
      body: [
        'Start like a classic mail host: one server runs SMTP in, SMTP out and the web API, and keeps every mailbox on its own disk. A message arrives, the server checks the recipient exists, writes it to that user\'s folder and says `250 OK`.',
        'This works for thousands of users. The simplicity is real: one machine, one place to look, a backup script. Next we find the numbers where it stops working.',
      ],
      keyIdea: 'One server holding SMTP, the API and the disks is a fine start, and the right baseline to measure against.',
      metrics: metrics({ users: '10K', rate: '~5/s avg', store: '2 TB', deliver: '1 s', lost: '0' }),
      metricTones: { deliver: 'good', lost: 'good' },
      scene: {
        nodes: [{ ...sender, label: 'other providers' }, { ...monolith, status: 'active', load: 20 }, { ...reader, label: 'web app' }],
        links: [link('sender', 'mono', { label: 'SMTP' }), link('mono', 'reader', { label: 'HTTPS' })],
        flows: [
          { path: ['sender', 'mono'], tone: 'request', label: 'DATA', duration: 1.3 },
          { path: ['mono', 'reader'], tone: 'response', label: 'inbox', duration: 1.3, delay: 1.4 },
        ],
        panel: { title: 'Single host', icon: 'Server', rows: [{ text: 'Mailboxes' , value: 'local disk' }, { text: 'Spam check', value: 'inline' }, { text: 'Backup', value: 'nightly rsync' }] },
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'At 100M users the one box melts',
      eli5: 'Now the whole country mails through that one clerk. The door jams, the shelves are full, and if the clerk goes home sick nobody gets any letters.',
      body: [
        'Count what 150K/s peak does to one machine. **CPU**: spam scoring and TLS for every connection. **Disk**: 200 TB a day is more than any server holds. **Availability**: one host down means 100M people cannot read or receive mail.',
        'Slow SMTP peers also hold connections open for minutes, and a single noisy sender can starve everyone else. We need to split the work by job and the data by user.',
      ],
      keyIdea: 'One host fails on CPU, on disk and on availability at the same time. Split by job first, then by user.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '200 TB/day', deliver: 'timeouts', lost: 'at risk' }),
      metricTones: { rate: 'bad', store: 'bad', deliver: 'bad', lost: 'bad' },
      scene: {
        nodes: [{ ...sender, label: 'the internet' }, { ...monolith, status: 'hot', load: 99, badge: 'disk 100%', chips: [{ text: '150K conn/s', tone: 'bad' }] }, { ...reader, label: 'users', status: 'dim' }],
        links: [link('sender', 'mono', { label: 'SMTP' }), link('mono', 'reader', { label: 'timeouts', labelTone: 'warn' })],
        flows: [
          { path: ['sender', 'mono'], tone: 'request', count: 4, label: 'DATA', duration: 1.0 },
          { path: ['mono', 'sender'], tone: 'error', label: '452 try later', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'What gives out first',
          icon: 'Activity',
          rows: [
            { text: 'CPU (spam + TLS)', value: '99%', tone: 'bad' },
            { text: 'Disk', value: '200 TB/day', tone: 'bad' },
            { text: 'Single point of failure', value: 'yes', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Inbound path',
      tag: 'concept',
      heading: 'Inbound: MX records point the world at us',
      eli5: 'A sign on the town door tells other post offices which counters take parcels for our town (**MX records**). Many identical counters share the work, and each writes the letter down before saying "got it".',
      body: [
        'The sender looks up the **MX record** for `b.com` in DNS. We publish several MX hosts behind a load balancer, so inbound capacity is a fleet of **stateless MTAs**.',
        'The pipeline: connection checks, `DATA`, cheap inline spam scoring, durable queue write, then `250 OK`. After that the sender may delete its copy. Heavy scans and label verdicts run after the queue.',
      ],
      keyIdea: 'A fleet of stateless inbound MTAs behind MX records absorbs the traffic. Answer 250 only after the message is durably stored.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...sender, label: 'a.com server' }, { ...dns, at: at(-3.5, -3.5) }, { ...mtaIn, at: at(0, 0), status: 'active', chips: ['stateless x 200'] }, { ...queue, at: at(3.5, 3.5) }],
        links: [link('sender', 'dns', { style: 'dashed', label: 'MX b.com?' }), link('sender', 'mtaIn', { label: 'SMTP' }), link('mtaIn', 'queue')],
        flows: [
          { path: ['sender', 'dns', 'sender'], tone: 'request', label: 'MX lookup', duration: 1.6 },
          { path: ['sender', 'mtaIn'], tone: 'request', label: 'DATA', duration: 1.3, delay: 1.8 },
          { path: ['mtaIn', 'queue'], tone: 'event', label: 'stored', duration: 1.2, delay: 3.2 },
          { path: ['mtaIn', 'sender'], tone: 'response', label: '250 OK', duration: 1.2, delay: 4.5 },
        ],
        panel: { title: 'MX for b.com', icon: 'Route', rows: [{ text: 'mx1.b.com', value: 'priority 10' }, { text: 'mx2.b.com', value: 'priority 10' }, { text: 'mx3.b.com', value: 'priority 20 (backup)' }] },
      },
    },
    {
      title: 'Outbound path',
      tag: 'concept',
      heading: 'Outbound: queue first, deliver later',
      eli5: 'When you post a letter, the clerk drops it in the outgoing tray. A separate team takes trays to other towns, and if a town is closed they try again later.',
      body: [
        '`POST /messages/send` does three things and returns fast: store a copy in the sender\'s Sent label, write the message to the **outbound queue**, and answer `202`. The user never waits for a far-away server.',
        'Outbound MTAs pull from the queue, look up the recipient domain\'s MX, open an SMTP session and deliver. Delivery is **at least once**: a crash after delivery but before marking done sends it twice, so we set a `Message-ID` header that receivers can use to drop repeats.',
      ],
      keyIdea: 'Sending is asynchronous: store, enqueue, acknowledge, then deliver with retries. The queue absorbs slow or dead remote servers.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...sender, label: 'our user', sub: 'clicks send' }, queue, { ...mtaOut, status: 'active' }, { ...reader, label: 'b.com', sub: 'remote MX', kind: 'internet' }],
        links: [link('sender', 'queue', { label: '202 fast' }), link('queue', 'mtaOut'), link('mtaOut', 'reader', { label: 'SMTP' })],
        flows: [
          { path: ['sender', 'queue'], tone: 'request', label: 'send', duration: 1.2 },
          { path: ['queue', 'mtaOut'], tone: 'event', label: 'pull', duration: 1.2, delay: 1.3 },
          { path: ['mtaOut', 'reader'], tone: 'data', label: 'DATA', duration: 1.4, delay: 2.6 },
        ],
      },
    },
    {
      title: 'Split storage',
      tag: 'concept',
      heading: 'Bodies in object storage, metadata in the database',
      eli5: 'Heavy parcels go to the big warehouse out back. The shelf in front only holds a small card per letter saying where its parcel is. Opening the box stays quick.',
      body: [
        'The 196 TB a day is bodies and attachments, so they go to **object storage**, keyed by content hash. The MTA only enqueues. A delivery worker writes the body to blobs, then inserts the 1 KB row with a `body_ref`.',
        'Hashing gives free dedup: a newsletter sent to 1M users is stored **once**, with 1M small rows pointing to it.',
      ],
      keyIdea: 'Keep the hot, small, queryable part in the database and the cold, big, immutable part in object storage. Hashing dedups for free.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '4 TB/day DB, 196 TB blobs', deliver: '< 5 s target', lost: '0 target' }),
      metricTones: { store: 'good' },
      scene: {
        nodes: [{ ...mtaIn, at: at(-7, 0) }, { ...queue, at: at(-3, 0), status: 'active' }, { ...meta, at: at(1, -3.5), badge: '1 KB rows' }, { ...blob, at: at(1, 3.5), badge: 'sha256 keys', status: 'active' }, { ...reader, label: 'client', at: at(5.5, 0) }],
        links: [link('mtaIn', 'queue', { label: 'enqueue' }), link('queue', 'blob', { label: 'put body' }), link('queue', 'meta', { label: 'insert row' }), link('reader', 'meta', { style: 'dashed' })],
        flows: [
          { path: ['mtaIn', 'queue'], tone: 'event', label: 'mail', duration: 1.2 },
          { path: ['queue', 'blob'], tone: 'data', label: 'body + files', duration: 1.5, delay: 1.3 },
          { path: ['queue', 'meta'], tone: 'data', label: 'row + ref', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'One newsletter, 1M readers',
          icon: 'Copy',
          rows: [{ text: 'Body copies stored', value: '1', tone: 'good' }, { text: 'Metadata rows', value: '1,000,000' }, { text: 'Space saved', value: '~99.9%', tone: 'good' }],
        },
      },
    },
    {
      title: 'Shard mailboxes',
      tag: 'tradeoff',
      heading: 'Shard the mailbox DB by user',
      eli5: 'We build many post offices and give each family a fixed one by their house number. Everything for that family lives in one place, so finding their letters never means visiting two buildings.',
      body: [
        'One database cannot hold 100M mailboxes. We **shard by `user_id`** (see the sharding lesson), using consistent hashing so adding shards moves little data. Every query we run is about one user, so each stays on one shard and needs no cross-shard join.',
        'The tradeoff: a user\'s mail is on one shard and its replicas, so a huge mailbox or a user receiving millions of mails is a hot spot. A mapping service (`user_id` to shard) lets us move a hot user to a roomier shard without changing their address.',
      ],
      keyIdea: 'Shard by user: every common query touches one user, so one shard answers it. Keep a lookup table so heavy users can be moved.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '4 TB/day DB', deliver: '< 5 s target', lost: '0 target' }),
      quiz: {
        question: 'Why is user_id a good shard key for a mailbox database?',
        options: [
          'It spreads data evenly and nearly every query is about one user, so each query hits one shard',
          'It makes full-text search across all users cheap',
          'It removes the need for replication',
          'It keeps every mail of a thread on different shards for parallel reads',
        ],
        answer: 0,
        explain: 'Listing an inbox, opening a message, labeling and searching are all scoped to one user. With user_id as the key those queries stay on a single shard. Replication is still needed for durability, and cross-user search is not what the shard key serves.',
      },
      scene: {
        nodes: [
          { id: 'router', kind: 'gateway', at: at(-7, 0), label: 'shard router', sub: 'user to shard' },
          { id: 's1', kind: 'shard', at: at(-2.5, 0), label: 'shard 1', sub: 'hash 0 to 33%' },
          { id: 's2', kind: 'shard', at: at(1.5, 0), label: 'shard 2', sub: 'hash 33 to 66%', status: 'active' },
          { id: 's3', kind: 'shard', at: at(5.5, 0), label: 'shard 3', sub: 'hash 66 to 100%' },
        ],
        links: [link('router', 's1', { style: 'faint' }), link('router', 's2'), link('router', 's3', { style: 'faint' })],
        flows: [{ path: ['router', 's2'], tone: 'request', label: 'user 4417', duration: 1.4 }],
        panel: { title: 'Lookup', icon: 'Table', rows: [{ text: 'user 4417', value: 'shard 2' }, { text: 'consistent hash ring', value: 'hash(user_id)' }, { text: 'hot user', value: 'move to own shard', tone: 'warn' }] },
      },
    },
    {
      title: 'Threads',
      tag: 'concept',
      heading: 'Threads and labels: grouping at write time',
      eli5: 'When a reply comes in, the clerk checks which earlier letter it answers and clips them together, so you read the whole conversation in one pile.',
      body: [
        'Replies carry `In-Reply-To` and `References` headers naming earlier `Message-ID`s. We look those up in this user\'s mailbox. A match reuses its `thread_id`, otherwise we start a new thread.',
        'Doing this at write time keeps reads cheap: a conversation is one query on the `(user_id, thread_id)` index. Labels are applied at the same time, from user filters and the spam verdict.',
      ],
      keyIdea: 'Compute the thread and labels once at delivery, from reply headers, so listing a conversation is a plain indexed read.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '4 TB/day DB', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...mtaIn, label: 'delivery worker', sub: 'assign thread', status: 'active' }, { ...meta, badge: 'thread 91', status: 'active' }, { ...reader, label: 'inbox', sub: 'one row per thread' }],
        links: [link('mtaIn', 'meta', { label: 'lookup Message-ID' }), link('reader', 'meta', { style: 'dashed' })],
        flows: [
          { path: ['mtaIn', 'meta'], tone: 'request', label: 'In-Reply-To: <a1@x>', duration: 1.5 },
          { path: ['meta', 'mtaIn'], tone: 'response', label: 'thread 91', duration: 1.2, delay: 1.6 },
          { path: ['reader', 'meta'], tone: 'request', label: 'thread 91', duration: 1.3, delay: 3 },
        ],
        panel: {
          title: 'Reply headers',
          icon: 'FileText',
          code: 'Message-ID: <c3@b.com>\nIn-Reply-To: <b2@a.com>\nReferences: <a1@b.com> <b2@a.com>\nSubject: Re: Lunch Friday',
        },
      },
    },
    {
      title: 'Search',
      tag: 'concept',
      heading: 'Search: one index per user',
      eli5: 'Instead of reading every letter in your box to find "pizza", the clerk keeps a little index card: each word points to the letters that contain it.',
      body: [
        'Scanning a 15 GB mailbox per query is too slow, so we build an **inverted index** (see the search index lesson) of words in subject, sender and body. Indexing is asynchronous: delivery publishes an event, and an indexer updates the user\'s index within seconds.',
        'We partition the index by `user_id`, the same key as the mailbox, so a search hits only that user\'s partition and permission checks stay trivial. Index only text and small attachments. Searching deleted mail must also remove it from the index.',
      ],
      keyIdea: 'Index mail asynchronously, partitioned by user like the mailbox. Search stays fast and private, and a slow indexer never delays delivery.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '4 TB/day DB + index', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...meta, at: at(-7, 0), badge: 'new mail' }, { ...queue, label: 'index events', at: at(-2.5, 0) }, { ...search, at: at(2, 0), status: 'active' }, { ...reader, label: 'search box', sub: 'q=invoice', at: at(6.5, 0) }],
        links: [link('meta', 'queue', { style: 'dashed' }), link('queue', 'search'), link('reader', 'search', { label: 'GET /search', style: 'dashed' })],
        flows: [
          { path: ['meta', 'queue', 'search'], tone: 'event', label: 'index mail', duration: 2.4 },
          { path: ['reader', 'search'], tone: 'request', label: 'invoice', duration: 1.4, delay: 2.6 },
        ],
        panel: { title: 'Index partition user 4417', icon: 'Search', rows: [{ text: 'invoice', value: 'msgs 12, 88, 301' }, { text: 'lunch', value: 'msgs 7, 91' }, { text: 'Lag behind delivery', value: '< 5 s', tone: 'good' }] },
      },
    },
    {
      title: 'Spam filter',
      tag: 'concept',
      heading: 'Spam and virus filtering before storage',
      eli5: 'Before a letter goes into a box, a guard checks it. Known junk gets turned away at the door, odd-looking letters go to a "maybe junk" shelf, and good ones pass.',
      body: [
        'The 46K/s and 150K/s figures are **accepted** mail. As an assumption, spam attempts add roughly the same again at the edge, rejected before storage.',
        'Order: connection checks (IP blocklist, SPF), `DATA`, then cheap inline scoring. Sure spam gets `550` before the 250. The rest is queued and acknowledged. Malware scanning and the final spam or inbox label run after the queue.',
      ],
      keyIdea: 'Run the cheapest checks first and reject obvious spam before the 250. Rejected mail never costs storage, and heavy scans run after the queue.',
      metrics: metrics({ users: '100M', rate: '150K/s accepted peak', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...sender, label: 'unknown sender' }, { ...mtaIn, status: 'active' }, { ...spam, at: at(3.5, -3.5), status: 'active', sub: 'inline score' }, { ...queue, at: at(3.5, 3.5) }],
        links: [link('sender', 'mtaIn'), link('mtaIn', 'spam'), link('mtaIn', 'queue')],
        flows: [
          { path: ['sender', 'mtaIn'], tone: 'request', label: 'DATA', duration: 1.2 },
          { path: ['mtaIn', 'spam'], tone: 'request', label: 'score 9.1', duration: 1.2, delay: 1.3 },
          { path: ['spam', 'mtaIn', 'sender'], tone: 'error', label: '550 rejected', duration: 1.8, delay: 2.6 },
          { path: ['mtaIn', 'queue'], tone: 'data', label: 'score 0.3, enqueue', duration: 1.2, delay: 4.6 },
        ],
        panel: {
          title: 'Verdicts',
          icon: 'Shield',
          rows: [{ text: 'Inline score over 8', value: 'reject 550', tone: 'bad' }, { text: 'Later score 4 to 8', value: 'Spam label', tone: 'warn' }, { text: 'Later score under 4', value: 'Inbox', tone: 'good' }, { text: 'Malware (after queue)', value: 'drop + alert', tone: 'bad' }],
        },
      },
    },
    {
      title: 'SPF, DKIM, DMARC',
      tag: 'concept',
      heading: 'Proving a sender is who they claim',
      eli5: 'Anyone can write "from the bank" on an envelope. So the real bank publishes a list of its trucks (**SPF**), and signs each letter with a seal only it owns (**DKIM**). A third rule (**DMARC**) says what to do when the check fails.',
      body: [
        '**SPF** is a DNS record listing the IPs allowed to send for a domain. **DKIM** signs headers and body with a private key (see the encryption lesson), and the public key sits in DNS. **DMARC** says what receivers should do when both fail: `none`, `quarantine` or `reject`.',
        'We do this both ways. Inbound, we verify and feed the result into the spam score. Outbound, we sign every message and publish records for our domain, or our users\' mail lands in other providers\' spam folders.',
      ],
      keyIdea: 'SPF checks the sending IP, DKIM checks a signature, DMARC sets the policy. Verify them inbound, and publish and sign them outbound.',
      metrics: metrics({ users: '100M', rate: '150K/s accepted peak', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      code: {
        language: 'bash',
        title: 'DNS records for example.com',
        source: `$ dig +short TXT example.com
"v=spf1 ip4:203.0.113.0/24 include:_spf.mail.example.com -all"

$ dig +short TXT s1._domainkey.example.com
"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEB..."

$ dig +short TXT _dmarc.example.com
"v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"`,
        highlight: [2, 5, 8],
      },
      scene: {
        nodes: [{ ...sender, label: 'example.com', sub: 'signs with DKIM' }, { ...mtaIn, status: 'active', label: 'inbound MTA', sub: 'verify' }, { ...dns, at: at(3.5, -3.5) }],
        links: [link('sender', 'mtaIn', { label: 'DKIM-Signature' }), link('mtaIn', 'dns', { style: 'dashed', label: 'TXT lookup' })],
        flows: [
          { path: ['sender', 'mtaIn'], tone: 'request', label: 'signed mail', duration: 1.4 },
          { path: ['mtaIn', 'dns', 'mtaIn'], tone: 'handshake', label: 'SPF + key', duration: 2.0, delay: 1.5 },
        ],
        panel: { title: 'Checks', icon: 'KeyRound', rows: [{ text: 'SPF: IP allowed?', value: 'pass', tone: 'good' }, { text: 'DKIM: signature valid?', value: 'pass', tone: 'good' }, { text: 'DMARC policy', value: 'quarantine' }] },
      },
    },
    {
      title: 'Reputation',
      tag: 'tradeoff',
      heading: 'Sender reputation and deliverability',
      eli5: 'Other post offices keep a list of towns that send nice letters and towns that send junk. If one of our customers sends junk, every letter from our town gets looked at harder.',
      body: [
        'Receivers score our sending IPs and domain by their history: complaint rate, bounce rate, spam traps. One compromised account blasting spam can get a shared IP blocked, hurting everyone behind it. So we **rate limit** per account (see the rate limiting lesson), and watch outbound volume for spikes.',
        'We also keep IPs in pools by trust, **warm up** new IPs slowly, honor unsubscribe, and remove addresses that hard-bounce. Reputation is slow to earn and quick to lose, so we protect it with limits from day one.',
      ],
      keyIdea: 'Our outbound IPs carry a shared reputation. Limit and monitor senders so one bad account cannot get everyone blocked.',
      metrics: metrics({ users: '100M', rate: '11.6K/s sent', store: '200 TB/day', deliver: '< 5 s target', lost: '0 target' }),
      scene: {
        nodes: [{ ...sender, label: 'account 77', sub: '5K mails/min', status: 'hot', chips: [{ text: 'spike', tone: 'warn' }] }, { id: 'limit', kind: 'limiter', at: at(-3.5, 0), label: 'send limiter', sub: '500/day new accts', status: 'active' }, { ...mtaOut, at: at(0, 0), status: 'active' }, { ...reader, kind: 'internet', label: 'other providers', sub: 'score our IPs', at: at(4, 0) }],
        links: [link('sender', 'limit'), link('limit', 'mtaOut'), link('mtaOut', 'reader')],
        flows: [
          { path: ['sender', 'limit'], tone: 'request', count: 3, label: 'burst', duration: 1.1 },
          { path: ['limit', 'sender'], tone: 'error', label: '429 slow down', duration: 1.2, delay: 1.2 },
          { path: ['limit', 'mtaOut', 'reader'], tone: 'data', label: 'allowed', duration: 2.2, delay: 2.5 },
        ],
        panel: { title: 'Reputation signals', icon: 'Gauge', rows: [{ text: 'Complaint rate', value: '< 0.1%', tone: 'good' }, { text: 'Hard bounce rate', value: '< 2%' }, { text: 'IP warm-up', value: '50 to 50K/day over 4 weeks' }] },
      },
    },
    {
      title: 'Retries, bounces',
      tag: 'case',
      heading: 'Failure: the recipient server is down',
      eli5: 'If the other town\'s post office is closed, our truck does not throw the letters away. It comes back later, and keeps trying for days. If it never opens, we hand the letter back to you with a note.',
      body: [
        'Remote servers fail often. A `4xx` reply or a timeout is **temporary**: re-queue with **exponential backoff** (see the timeouts and retries lesson), for example 5 min, 30 min, 2 h, up to about 5 days. A `5xx` reply (mailbox does not exist) is **permanent**.',
        'On a permanent failure or when retries run out, we create a **bounce** (a delivery status notification) in the sender\'s inbox saying why. No letter vanishes silently: it is delivered, retried, or reported back.',
      ],
      keyIdea: 'Temporary failures retry with backoff for days. Permanent ones become a bounce message to the sender. Nothing disappears without a record.',
      metrics: metrics({ users: '100M', rate: '11.6K/s sent', store: '200 TB/day', deliver: 'retry up to 5 days', lost: '0' }),
      metricTones: { lost: 'good' },
      code: {
        language: 'typescript',
        title: 'Outbound retry decision',
        source: `const BACKOFF_MIN = [5, 30, 120, 360, 720, 1440]; // minutes
const MAX_AGE_DAYS = 5;

function onDeliveryResult(job: Job, code: number | 'timeout') {
  if (code === 250) return markDelivered(job);
  const permanent = typeof code === 'number' && code >= 500;
  const expired = ageDays(job.firstQueuedAt) > MAX_AGE_DAYS;
  if (permanent || expired) return bounce(job, code); // notify sender
  const wait = BACKOFF_MIN[Math.min(job.attempts, BACKOFF_MIN.length - 1)];
  requeue(job, { delayMinutes: wait, attempts: job.attempts + 1 });
}`,
        highlight: [5, 6, 7, 8, 9, 10],
      },
      scene: {
        nodes: [{ ...queue, status: 'active', badge: '12K waiting' }, { ...mtaOut, status: 'active' }, { ...reader, kind: 'internet', label: 'b.com', sub: 'down', status: 'down' }, { ...sender, label: 'sender inbox', sub: 'bounce notice' }],
        links: [link('queue', 'mtaOut'), link('mtaOut', 'reader', { label: '421 try later', labelTone: 'warn' }), link('mtaOut', 'sender', { style: 'dashed' })],
        flows: [
          { path: ['mtaOut', 'reader'], tone: 'request', label: 'DATA', duration: 1.2 },
          { path: ['reader', 'mtaOut'], tone: 'error', label: '421', duration: 1.2, delay: 1.3 },
          { path: ['mtaOut', 'queue'], tone: 'event', label: 'retry in 30 min', duration: 1.2, delay: 2.6 },
          { path: ['mtaOut', 'sender'], tone: 'response', label: 'bounce after 5 days', duration: 1.6, delay: 4 },
        ],
      },
      quiz: {
        question: 'A remote server answers 451 (try again later) to our outbound mail. What do we do?',
        options: [
          'Re-queue it with backoff and keep retrying for days, then bounce if it never succeeds',
          'Bounce it to the sender immediately',
          'Drop the message to protect the queue',
          'Retry in a tight loop until it works',
        ],
        answer: 0,
        explain: 'A 4xx code is temporary, so we retry with growing delays. Immediate bounces are for 5xx permanent errors. A tight loop would hammer a struggling server and hurt our reputation.',
      },
    },
    {
      title: 'Client sync',
      tag: 'concept',
      heading: 'Keeping phones and browsers in sync',
      eli5: 'You and your family all check the same box. When a new letter lands, a bell rings in each house (**push**). Each house also keeps a tally of the last letter it saw, so it only asks for newer ones.',
      body: [
        'New mail should appear in seconds without polling every device. After delivery, the **sync service** pushes a small "something changed" event over a long-lived connection (see the real-time delivery lesson): IMAP IDLE, WebSocket, or mobile push for a sleeping app.',
        'The client then asks for changes since its last position. Each mailbox has a monotonically increasing **change counter**, and a client sends `GET /changes?since=8841`. The reply lists new, moved and read messages.',
      ],
      keyIdea: 'Push a tiny change event, then let each client pull everything after its own change counter. Devices stay in sync without polling.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '200 TB/day', deliver: 'push in < 2 s', lost: '0' }),
      scene: {
        nodes: [{ ...meta, at: at(-7, 0), badge: 'change #8842' }, { ...sync, at: at(-2.5, 0), status: 'active' }, { ...reader, label: 'phone', sub: 'last seen #8841', at: at(2.5, -3.5) }, { ...sender, kind: 'client', label: 'laptop', sub: 'last seen #8841', at: at(2.5, 3.5) }],
        links: [link('meta', 'sync', { style: 'dashed' }), link('sync', 'reader'), link('sync', 'sender', { style: 'faint' })],
        flows: [
          { path: ['meta', 'sync'], tone: 'event', label: 'new mail', duration: 1.2 },
          { path: ['sync', 'reader'], tone: 'event', label: 'ping', duration: 1.4, delay: 1.3 },
          { path: ['reader', 'sync', 'meta'], tone: 'request', label: 'changes since 8841', duration: 1.8, delay: 2.8 },
        ],
      },
    },
    {
      title: 'Quotas, retention',
      tag: 'concept',
      heading: 'Quotas, deletes and retention',
      eli5: 'Each box has a size limit. When it is full, new letters are turned away politely. When you throw a letter out, it sits in a trash bin for a while before the bin is emptied for good.',
      body: [
        'Each user has a **quota** (say 15 GB). We keep `used_bytes` per user, updated with each delivery. At 100% we answer `552 mailbox full` and the sender gets a bounce, so we refuse mail instead of dropping it. Deduplicated bodies count fully against every recipient.',
        'Deleting moves a message to Trash for 30 days, then a background job removes the row. A blob is physically deleted only when its **reference count** reaches zero, and legal holds can pause the whole process.',
      ],
      keyIdea: 'Enforce quotas at delivery with a clear 552 reply. Delete in two phases, and garbage-collect shared blobs by reference count.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '200 TB/day, GC reclaims', deliver: '< 5 s target', lost: '0' }),
      scene: {
        nodes: [{ ...mtaIn, status: 'active' }, { ...meta, badge: '14.9 of 15 GB', status: 'hot' }, { ...blob, badge: 'refcount' }, { id: 'gc', kind: 'worker', at: at(7.5, -3.5), label: 'cleanup job', sub: 'trash after 30 d' }],
        links: [link('mtaIn', 'meta', { label: 'check quota' }), link('meta', 'blob', { style: 'dashed' }), link('gc', 'blob', { style: 'dashed' })],
        flows: [
          { path: ['mtaIn', 'meta'], tone: 'request', label: 'deliver 20 MB', duration: 1.3 },
          { path: ['meta', 'mtaIn'], tone: 'error', label: '552 full', duration: 1.3, delay: 1.4 },
          { path: ['gc', 'blob'], tone: 'data', label: 'refcount 0, delete', duration: 1.5, delay: 3 },
        ],
      },
    },
    {
      title: 'Shard failure',
      tag: 'case',
      heading: 'Failure: a mailbox shard dies',
      eli5: 'If one post office burns down, the letters are not gone, because each shelf has two matching shelves in other buildings. Meanwhile, new letters wait in the truck yard until a shelf is ready.',
      body: [
        'Each shard has a primary and two replicas in different zones (see the replication and failover lessons). Writes are acknowledged only after a replica has them, which is how "accepted mail is never lost" holds. If the primary dies, failure detection promotes a replica in seconds.',
        'During the gap, inbound mail for that shard\'s users waits in the durable delivery queue, and the SMTP answer stays `250` because the message is already safe. Reads fail over to replicas. Users on other shards notice nothing.',
      ],
      keyIdea: 'Synchronous replica writes protect accepted mail. The durable queue buffers deliveries while a replica is promoted.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '200 TB/day', deliver: '+ 10 s on that shard', lost: '0' }),
      metricTones: { deliver: 'warn', lost: 'good' },
      scene: {
        nodes: [{ ...queue, badge: 'buffering', status: 'active', at: at(-3.5, 0) }, { id: 'prim', kind: 'shard', at: at(0, -3.5), label: 'primary', sub: 'zone a', status: 'down' }, { id: 'rep', kind: 'replica', at: at(0, 3.5), label: 'replica', sub: 'zone b, promoted', status: 'ok' }, { ...reader, label: 'users on shard 2', at: at(4, 0) }],
        links: [link('queue', 'prim', { style: 'faint' }), link('prim', 'rep', { style: 'dashed', label: 'sync writes' }), link('queue', 'rep'), link('rep', 'reader')],
        flows: [
          { path: ['queue', 'rep'], tone: 'data', label: 'deliver', duration: 1.5, delay: 0.3 },
          { path: ['rep', 'reader'], tone: 'response', label: 'inbox', duration: 1.5, delay: 2 },
        ],
      },
    },
    {
      title: 'Flood',
      tag: 'case',
      heading: 'Failure: a spam flood or a viral blast',
      eli5: 'One morning a million letters arrive at once. The door staff cannot sort them that fast, so they tell the trucks "come back in a bit" and handle what they can without letting the room overflow.',
      body: [
        'A spam wave, a mail loop, or a company mailing 5M people can send 10x normal traffic. The defense is **back pressure** (see that lesson): inbound MTAs cap concurrent sessions per source IP and per recipient domain, and shed load with `421 try later`.',
        'Queues absorb what we do accept, and autoscaling adds filter workers when queue age rises. Priority lanes keep password resets ahead of bulk.',
      ],
      keyIdea: 'Defer with 421 instead of falling over. Honest senders retry later, queues absorb the rest, and priority lanes protect urgent mail.',
      metrics: metrics({ users: '100M', rate: '1.5M/s attempted', store: '200 TB/day', deliver: 'urgent < 5 s, bulk later', lost: '0' }),
      metricTones: { rate: 'bad', deliver: 'warn', lost: 'good' },
      scene: {
        nodes: [{ ...sender, label: 'bulk sender', status: 'hot', chips: [{ text: '5M mails', tone: 'warn' }] }, { ...mtaIn, status: 'hot', load: 90, chips: ['limit 20 per IP'] }, { ...queue, label: 'bulk lane', at: at(3.5, 3.5) }, { id: 'urgent', kind: 'queue', at: at(3.5, -3.5), label: 'urgent lane', sub: 'resets, receipts', status: 'ok' }],
        links: [link('sender', 'mtaIn'), link('mtaIn', 'queue'), link('mtaIn', 'urgent')],
        flows: [
          { path: ['sender', 'mtaIn'], tone: 'request', count: 4, label: 'burst', duration: 1.0 },
          { path: ['mtaIn', 'sender'], tone: 'error', label: '421 later', duration: 1.2, delay: 1.1 },
          { path: ['mtaIn', 'urgent'], tone: 'event', label: 'priority', duration: 1.3, delay: 2.4 },
          { path: ['mtaIn', 'queue'], tone: 'event', label: 'paced', duration: 1.5, delay: 2.6 },
        ],
      },
    },
    {
      title: 'Region outage',
      tag: 'case',
      heading: 'Failure: a whole region goes dark',
      eli5: 'If a whole town loses power, the sign on the door sends other post offices to our second town. Our shelves were copied there already, so people read their letters from the new place.',
      body: [
        'We run in several regions (see the multi-region lesson). Each user has a **home region** holding their mailbox primary, and blobs replicate across regions. MX records list hosts in two regions, so senders fall back on their own.',
        'If the home region is lost, we promote the other region\'s copy. Replication across regions is usually async, so a few seconds of recent mail may be missing until the region returns. We call that window the **RPO** (about 5 s) and say so openly.',
      ],
      keyIdea: 'Multi-region MX, cross-region replicas and a home-region promotion keep mail flowing. Async replication leaves a small, known data-loss window.',
      metrics: metrics({ users: '100M', rate: '150K/s peak', store: '200 TB/day x 2 regions', deliver: 'fail over in 2 min', lost: 'RPO ~5 s' }),
      metricTones: { deliver: 'warn', lost: 'warn' },
      scene: {
        nodes: [{ id: 'regA', kind: 'db', at: at(-3.5, -3.5), label: 'region A', sub: 'home, down', status: 'down' }, { id: 'regB', kind: 'db', at: at(-3.5, 3.5), label: 'region B', sub: 'promoted', status: 'ok' }, { ...dns, at: at(0, 0), label: 'MX records', sub: 'two regions' }, { ...sender, label: 'other providers', at: at(4, 0) }],
        links: [link('regA', 'regB', { style: 'dashed', label: 'async copy' }), link('sender', 'dns', { style: 'dashed' }), link('sender', 'regB', { route: 'straight' })],
        flows: [
          { path: ['sender', 'dns'], tone: 'request', label: 'MX?', duration: 1.2 },
          { path: ['sender', 'regB'], tone: 'request', label: 'DATA', duration: 1.8, delay: 1.4 },
        ],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole mail system on one page',
      eli5: 'Letters arrive at many identical counters, get checked by a guard, and the card goes in a family\'s box while the heavy parcel goes to the warehouse. Letters going out wait in a tray, and trucks keep trying until they arrive.',
      body: [
        '**Inbound**: MX records, stateless MTAs, inline spam score, durable queue, then 250, then workers store the row and body. **Outbound**: queue, backoff retries, DKIM, rate limits. **Storage**: metadata sharded by user, bodies in object storage by hash. **Experience**: threads at write time, a per-user search index, push plus change counters.',
        'Failure handling: replicas for shards, 421 and queues for floods, multi-region MX for outages, bounces for dead recipients.',
      ],
      keyIdea: 'Acknowledge only after durable storage, split metadata from bodies, shard by user, and make every failure a delay or a bounce, never a silent loss.',
      metrics: metrics({ users: '100M', rate: '46K/s avg, 150K/s peak', store: '200 TB/day', deliver: '< 5 s p99', lost: '0 accepted' }),
      metricTones: { deliver: 'good', lost: 'good' },
      quiz: {
        question: 'When should an inbound MTA reply 250 OK to the sending server?',
        options: [
          'Only after the message is durably stored, because the sender may delete its copy',
          'As soon as the connection opens, to keep sessions short',
          'After the recipient reads the mail',
          'After the spam filter, but before writing to disk',
        ],
        answer: 0,
        explain: 'A 250 transfers responsibility to us. If we answer before the message is safely stored and then crash, the message is gone and nobody will retry. Storing first is how we keep the promise that accepted mail is never lost.',
      },
      scene: {
        nodes: [{ ...mtaIn, at: at(-7, 0), status: 'ok' }, { ...spam, at: at(-3.5, -3.5), status: 'ok', sub: 'inline score' }, { ...queue, at: at(0, 0), status: 'ok' }, { ...meta, at: at(4.5, -3.5), status: 'ok' }, { ...blob, at: at(4.5, 3.5), status: 'ok' }],
        links: [link('mtaIn', 'spam'), link('spam', 'queue'), link('queue', 'meta'), link('queue', 'blob', { style: 'dashed' })],
        flows: [
          { path: ['mtaIn', 'spam', 'queue'], tone: 'request', label: 'mail, then 250', duration: 2.2 },
          { path: ['queue', 'meta'], tone: 'data', label: 'row', duration: 1.4, delay: 2.4 },
          { path: ['queue', 'blob'], tone: 'data', label: 'body', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Decisions',
          icon: 'Table',
          rows: [
            { text: 'ACK after durable write', tone: 'good' },
            { text: 'Metadata sharded by user' },
            { text: 'Bodies by hash in blobs' },
            { text: 'Async index and sync' },
            { text: 'Backoff retries, bounces' },
          ],
        },
      },
    },
  ],
};
