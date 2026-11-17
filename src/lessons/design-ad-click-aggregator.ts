import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const phones: SceneNode = { id: 'phones', kind: 'phone', at: at(-7, 0), label: 'phones', sub: 'ad clicks' };
const gateway: SceneNode = { id: 'gateway', kind: 'block', at: at(-3.5, 0), label: 'Click gateway', sub: 'stamps and logs', icon: 'Route', tint: 'blue' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: at(0, 0), label: 'clicks topic', sub: 'Kafka, replication 3' };
const flink: SceneNode = { id: 'flink', kind: 'worker', at: at(3.5, 0), label: 'stream job', sub: '1-min windows' };
const store: SceneNode = { id: 'store', kind: 'warehouse', at: at(7, 0), label: 'rollup store', sub: 'Druid or ClickHouse' };
const s3: SceneNode = { id: 's3', kind: 'storage', at: at(0, 4), label: 'raw click log', sub: 'S3, 45 TB a day' };
const spark: SceneNode = { id: 'spark', kind: 'worker', at: at(3.5, 4), label: 'nightly batch', sub: 'Spark, exact' };
const dash: SceneNode = { id: 'dash', kind: 'client', at: at(7, 4), label: 'dashboard', sub: 'advertisers' };
const bill: SceneNode = { id: 'bill', kind: 'block', size: 0.8, at: at(7, 4), label: 'Billing', icon: 'Receipt', tint: 'amber' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(0, 0), label: 'one SQL table', sub: 'a row per click' };

export const designAdClickAggregator: Lesson = {
  id: 'design-ad-click-aggregator',
  title: 'Design an ad click aggregator',
  tagline: 'Count 100 billion ad clicks a day, accurately enough to bill and fast enough for a live dashboard.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Requirements and the napkin math: 1.15M clicks/s on average, about 5M/s at peak',
    'A click API and a data model for raw events and per-minute rollups',
    'Why one database fails, and how a log, windows and a rollup store fix it',
    'Deduplication, late events, fraud filtering and approximate unique counts',
    'The Lambda design: a fast speed layer plus an exact nightly batch layer, and how it survives crashes and spikes',
  ],
  metrics: [
    { key: 'rate', label: 'Clicks per second', icon: 'Zap' },
    { key: 'lag', label: 'Dashboard lag', icon: 'Timer' },
    { key: 'err', label: 'Count error', icon: 'Gauge' },
    { key: 'raw', label: 'Raw data', icon: 'HardDrive' },
  ],
  steps: [
    {
      title: 'Count the money',
      tag: 'problem',
      heading: 'Every click is money, and there are 100 billion a day',
      eli5: 'At a school fair, every kid who visits a prize booth drops a ticket in a chute. The booth owner pays the fair for each ticket, so every ticket has to be counted once, fast and right.',
      body: [
        'An ad network gets paid per click. Advertisers watch a **live dashboard** to see how a campaign performs, and they are **billed** from the same counts.',
        'At 100 billion clicks a day, a click counter that is slow, wrong or easy to fool costs real money, and an advertiser will notice.',
      ],
      keyIdea: 'The same stream of clicks feeds a live dashboard and an invoice, and the two have very different accuracy needs.',
      metrics: { rate: '1.15M/s', lag: '?', err: '?', raw: '?' },
      metricTones: { err: 'bad' },
      scene: {
        nodes: [
          { ...phones, chips: [{ text: 'click ad_77', tone: 'good' }] },
          { ...gateway, status: 'active' },
          { ...bill, at: at(3.5, 0), sub: 'pay per click' },
        ],
        links: [link('phones', 'gateway'), link('gateway', 'bill')],
        flows: [
          { path: ['phones', 'gateway'], tone: 'request', label: 'click', count: 3, duration: 1.2 },
          { path: ['gateway', 'bill'], tone: 'data', label: '+1 click', duration: 1.3, delay: 1.3 },
        ],
        panel: {
          title: 'Who reads the count',
          icon: 'Users',
          rows: [
            { text: 'Advertiser dashboard', value: 'live, a few seconds old' },
            { text: 'Invoice', value: 'exact, next day', tone: 'good' },
            { text: 'Fraud team', value: 'drops fake clicks', tone: 'warn' },
          ],
        },
        caption: 'One stream of clicks, three readers',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'Pin down what the system must do',
      eli5: 'Before the fair opens, the teacher writes the rules on the wall: count every ticket once, show the scoreboard quickly, and throw out fake tickets. Now everybody builds for the same rules.',
      body: [
        '**Functional:** record each click, return click counts per ad, campaign and advertiser by minute, hour and day, and filter fraudulent clicks out of billing.',
        '**Non-functional:** survive 5M clicks/s at peak, show dashboards within about a minute, bill within ±0.01% of the truth within 24 hours, and never lose an accepted click.',
      ],
      keyIdea: 'Two accuracy targets drive everything: seconds-fresh and approximate for dashboards, exact within a day for billing.',
      metrics: { rate: '5M/s peak', lag: '< 1 min', err: '±0.01%', raw: '?' },
      scene: {
        nodes: [
          { ...gateway, at: at(-3.5, 0), status: 'active' },
          { ...dash, id: 'dash', at: at(0, 0), sub: 'live view' },
          { ...bill, at: at(3.5, 0) },
        ],
        links: [link('gateway', 'dash', { style: 'dashed' }), link('dash', 'bill', { style: 'dashed' })],
        panel: {
          title: 'Targets',
          icon: 'Gauge',
          rows: [
            { text: 'Peak ingest', value: '5M clicks/s' },
            { text: 'Dashboard freshness', value: '< 1 min' },
            { text: 'Dashboard query', value: '< 200 ms', tone: 'good' },
            { text: 'Billing accuracy', value: '±0.01% in 24 h', tone: 'good' },
            { text: 'Fraud shed', value: 'about 30%', tone: 'warn' },
            { text: 'Durability', value: 'no accepted click lost', tone: 'good' },
          ],
        },
        caption: 'The rules the design is judged against',
      },
    },
    {
      title: 'Scale math',
      tag: 'concept',
      heading: 'Napkin math: 1.15M clicks a second',
      eli5: 'If a million kids drop tickets every second, you cannot keep every ticket in a pocket. You first work out how big the pile gets, so you know what kind of bins to buy.',
      body: [
        '100 billion clicks a day is 100B / 86,400 s, about **1.15M clicks/s** on average. Peaks reach roughly **5M/s**.',
        'A click event (user, ad, campaign, timestamp, geo, device, referrer) averages about 450 bytes. At 1.15M a second that is about **500 MB/s** of ingress, and 100B x 450 B is roughly **45 TB a day** of raw data. Peak ingress is about 2.3 GB/s. Dashboards add about 50k read queries a second.',
      ],
      keyIdea: 'Raw writes are huge, but the answers (counts per ad per minute) are tiny. The design is about turning one into the other.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: '±0.01%', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...phones, at: at(-3.5, 0), chips: ['1.15M/s avg', { text: '5M/s peak', tone: 'warn' }] },
          { ...gateway, at: at(0, 0), badge: '500 MB/s' },
          { ...s3, at: at(3.5, 0), status: 'hot' },
        ],
        links: [link('phones', 'gateway'), link('gateway', 's3')],
        flows: [{ path: ['phones', 'gateway', 's3'], tone: 'data', label: '450 B', count: 4, duration: 2 }],
        panel: {
          title: 'The numbers',
          icon: 'Table',
          rows: [
            { text: 'Clicks per day', value: '100B' },
            { text: 'Average rate', value: '1.15M/s' },
            { text: 'Peak rate', value: '~5M/s', tone: 'warn' },
            { text: 'Event size', value: '~450 B avg' },
            { text: 'Raw per day', value: '~45 TB', tone: 'bad' },
            { text: 'Peak ingress', value: '~2.3 GB/s', tone: 'warn' },
          ],
        },
        caption: 'Small events, enormous volume',
      },
    },
    {
      title: 'The API',
      tag: 'concept',
      heading: 'Two APIs: record a click, read the counts',
      eli5: 'The fair has two windows. One is a chute where kids drop tickets, and it always says thanks fast. The other is a counter where booth owners ask how many tickets they got.',
      body: [
        'The **write path** is a redirect: the ad links to `/r?ad=...&sig=...`, the gateway records the click, then answers `302` to the advertiser. The `sig` is signed so clicks cannot be forged by editing a URL. SDKs may also `POST /v1/clicks`.',
        'The **read path** is `GET /v1/ads/{id}/clicks` with a time range and a granularity. The write must reply fast. The read can take a little longer.',
      ],
      keyIdea: 'The write API must be tiny and quick, and it must not depend on the counting system being healthy.',
      metrics: { rate: '1.15M/s', lag: '-', err: '-', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...phones, at: at(-3.5, 0), chips: ['GET /r?ad=ad_77'] },
          { ...gateway, at: at(0, 0), status: 'active', chips: [{ text: '302 to advertiser', tone: 'good' }] },
          { ...dash, at: at(3.5, 0), chips: ['GET /v1/ads/ad_77/clicks'] },
        ],
        links: [link('phones', 'gateway', { label: 'write' }), link('dash', 'gateway', { label: 'read', arrow: 'end' })],
        flows: [
          { path: ['phones', 'gateway'], tone: 'request', label: 'click', duration: 1.2 },
          { path: ['gateway', 'phones'], tone: 'response', label: '302', duration: 1.2, delay: 1.3 },
          { path: ['dash', 'gateway'], tone: 'request', label: 'counts?', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'Code',
          rows: [
            { text: 'GET /r?ad&sig', value: '302, logs click', tone: 'good' },
            { text: 'POST /v1/clicks', value: '202 Accepted' },
            { text: 'GET /v1/ads/{id}/clicks', value: 'counts, JSON' },
            { text: 'Query params', value: 'from, to, granularity' },
          ],
        },
        caption: 'A fast write, a flexible read',
      },
      code: {
        language: 'bash',
        title: 'Both APIs in four calls',
        source: `# 1. the user taps the ad: record the click, then redirect
curl -i "https://clk.example/r?ad=ad_77&cmp=cmp_9&sig=9f2a1c"
# HTTP/1.1 302 Found
# Location: https://shop.example/landing

# 2. an SDK reports a click and may retry; click_id makes retries safe
curl -X POST https://clk.example/v1/clicks \\
     -d '{"click_id": "7b1e-...", "ad_id": "ad_77", "ts": 1767225600}'

# 3. the dashboard asks for per-minute counts
curl "https://api.example/v1/ads/ad_77/clicks?from=2026-01-01T00:00Z&to=2026-01-01T01:00Z&granularity=minute"`,
        highlight: [2, 8, 11],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Two shapes of data: raw events and rollups',
      eli5: 'Every ticket is kept in a big box in the closet, so we can always recount. A small scoreboard on the wall only holds one number per booth per minute.',
      body: [
        'The **raw event** is append-only and never updated: `click_id`, `ad_id`, `campaign_id`, `advertiser_id`, `user_id`, `ts`, `geo`, `device`, `referrer`.',
        'The **rollup** is the answer people read: one row per (ad, minute) holding a count and a unique-user sketch. Rollups are small and fast. Raw events are the only source of truth for recounting.',
      ],
      keyIdea: 'Keep raw events for truth and recounts. Serve small pre-aggregated rows for reads.',
      metrics: { rate: '1.15M/s', lag: '-', err: '-', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...s3, at: at(-3.5, 0), chips: ['click_raw'] },
          { id: 'agg', kind: 'db', at: at(0, 0), label: 'rollups', sub: 'ad, minute, count', chips: ['click_agg_minute'] },
          { ...dash, at: at(3.5, 0) },
        ],
        links: [link('s3', 'agg', { label: 'aggregate' }), link('agg', 'dash')],
        flows: [
          { path: ['s3', 'agg'], tone: 'data', label: 'count', duration: 1.6 },
          { path: ['agg', 'dash'], tone: 'response', label: '41,208', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Rows',
          icon: 'Table',
          rows: [
            { text: 'click_raw', value: '~450 B each' },
            { text: 'click_agg_minute', value: '~30 B each', tone: 'good' },
            { text: 'Key', value: '(ad_id, minute)' },
            { text: 'Unique users', value: 'a sketch, not a list' },
          ],
        },
        caption: 'Truth in raw events, answers in rollups',
      },
      code: {
        language: 'sql',
        title: 'The two tables',
        source: `-- append-only truth, about 450 bytes a row
CREATE TABLE click_raw (
  click_id UUID PRIMARY KEY,   -- made by the client, used for dedupe
  ad_id TEXT, campaign_id TEXT, advertiser_id TEXT,
  user_id TEXT, ts TIMESTAMP, geo TEXT, device TEXT, referrer TEXT
);

-- what dashboards read
CREATE TABLE click_agg_minute (
  ad_id TEXT, minute_ts TIMESTAMP, clicks BIGINT, uniques BYTEA,
  PRIMARY KEY (ad_id, minute_ts)
);`,
        highlight: [3, 10, 11],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple design: insert a row, run a GROUP BY',
      eli5: 'The simplest fair has one helper with one notebook. A kid hands over a ticket, the helper writes a line, and at any time the helper can count the lines for a booth.',
      body: [
        'The gateway inserts one row per click into a SQL table. The dashboard runs `SELECT count(*) ... GROUP BY ad_id, minute`. Counts are exact and always fresh.',
        'At a few thousand clicks a second this is fine, and it is the right way to start. Nothing in it is wrong yet. It simply was not sized for 1.15M a second.',
      ],
      keyIdea: 'A single table with a GROUP BY is correct and simple. Scale is the only thing wrong with it.',
      metrics: { rate: '2k/s', lag: '0 s', err: 'exact', raw: '~80 GB/day' },
      metricTones: { lag: 'good', err: 'good' },
      scene: {
        nodes: [
          { ...phones, at: at(-3.5, 0) },
          { ...gateway, at: at(0, 0) },
          { ...db, at: at(3.5, 0), status: 'ok', chips: ['INSERT click'] },
          { ...dash, at: at(0, 7), chips: ['GROUP BY ad, minute'] },
        ],
        links: [link('phones', 'gateway'), link('gateway', 'db'), link('dash', 'db')],
        flows: [
          { path: ['phones', 'gateway', 'db'], tone: 'request', label: 'INSERT', duration: 2 },
          { path: ['dash', 'db', 'dash'], tone: 'response', label: 'count(*)', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Version 1',
          icon: 'Database',
          rows: [
            { text: 'Write', value: 'INSERT per click' },
            { text: 'Read', value: 'GROUP BY on the fly' },
            { text: 'Accuracy', value: 'exact', tone: 'good' },
            { text: 'Fits up to', value: 'a few thousand/s', tone: 'warn' },
          ],
        },
        caption: 'Correct, simple, small',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'problem',
      heading: 'One database cannot take 5M writes a second',
      eli5: 'Now a million kids line up at the one helper with the one notebook. The line goes out the door, the helper cannot write fast enough, and nobody can ask for a count either.',
      body: [
        'A single SQL primary handles tens of thousands of writes a second, not 5 million. Even sharded (see the sharding lesson), 100 billion rows a day is 45 TB of new storage every day.',
        'The read side breaks too. A `GROUP BY` scanning a day of clicks touches up to 100 billion rows, and 50k dashboard queries a second would repeat it.',
      ],
      keyIdea: 'Writing one row per click and aggregating on read fails at both ends: ingest is too hot and reads scan too much.',
      metrics: { rate: '5M/s', lag: 'minutes', err: 'drops', raw: '45 TB/day' },
      metricTones: { rate: 'warn', lag: 'bad', err: 'bad' },
      scene: {
        nodes: [
          { ...phones, at: at(-3.5, 0), status: 'hot', badge: '5M/s' },
          { ...gateway, at: at(0, 0), status: 'hot' },
          { ...db, at: at(3.5, 0), status: 'hot', load: 100, chips: [{ text: 'queue full', tone: 'bad' }, { text: 'timeouts', tone: 'bad' }] },
        ],
        links: [link('phones', 'gateway', { label: '5M/s', labelTone: 'warn' }), link('gateway', 'db')],
        flows: [
          { path: ['phones', 'gateway', 'db'], tone: 'request', count: 5, duration: 1, label: 'INSERT' },
          { path: ['db', 'gateway'], tone: 'error', duration: 1.2, delay: 1.2, label: 'timeout' },
        ],
        panel: {
          title: 'Why it falls over',
          icon: 'Bug',
          rows: [
            { text: 'Peak writes', value: '5M/s', tone: 'bad' },
            { text: 'One primary', value: 'tens of thousands/s', tone: 'warn' },
            { text: 'Rows scanned per day', value: '100B', tone: 'bad' },
            { text: 'Dashboard queries', value: '50k/s', tone: 'warn' },
          ],
          footer: { text: 'Clicks get dropped, so revenue is lost', tone: 'bad' },
        },
        caption: 'The write path is the first thing to give',
      },
    },
    {
      title: 'Log in front',
      tag: 'concept',
      heading: 'Fix 1: put a replicated log in front and aggregate off it',
      eli5: 'Put a long conveyor belt between the chute and the helpers. Tickets ride the belt in baskets, so a rush just makes the belt longer, and nobody drops a ticket.',
      body: [
        'The gateway appends the click to a **Kafka topic** (3 replicas, 72 hours kept) and replies `302` or `202` only after all in-sync replicas acknowledge it (`acks=all`). That is what accepted means.',
        'If Kafka is unreachable, the gateway buffers to local disk or retries, and still redirects the user. Partition by `ad_id`. A spike only makes the log longer.',
      ],
      keyIdea: 'A durable log decouples accepting clicks from counting them. A spike becomes lag, not data loss.',
      metrics: { rate: '5M/s', lag: 'a few s', err: '-', raw: '45 TB/day' },
      metricTones: { lag: 'good' },
      quiz: {
        question: 'Why does the click gateway write to a log such as Kafka instead of straight to the counting database?',
        options: [
          'The log makes counts exact without any further work',
          'It absorbs bursts, so a slow counter shows up as lag instead of dropped clicks',
          'Kafka stores clicks in a smaller format than a database',
          'It removes the need to deduplicate clicks',
        ],
        answer: 1,
        explain: 'A replicated log accepts writes at full speed and keeps them for hours. Consumers catch up when they can, so a spike costs freshness, not data. It does nothing for exactness or duplicates by itself.',
      },
      scene: {
        nodes: [
          { ...phones, at: at(-3.5, 0) },
          { ...gateway, at: at(0, 0), load: 40 },
          { ...kafka, at: at(3.5, 0), status: 'active', chips: ['key = ad_id', 'acks=all'] },
        ],
        links: [link('phones', 'gateway'), link('gateway', 'kafka', { label: 'append' })],
        flows: [
          { path: ['phones', 'gateway', 'kafka'], tone: 'event', label: 'click', count: 4, duration: 1.8 },
        ],
        panel: {
          title: 'Topic: clicks',
          icon: 'Rss',
          rows: [
            { text: 'Partition key', value: 'ad_id' },
            { text: 'Replication', value: '3 copies', tone: 'good' },
            { text: 'Retention', value: '72 hours' },
            { text: 'Reply after', value: 'acks=all', tone: 'good' },
            { text: 'Kafka down', value: 'disk buffer or retry', tone: 'warn' },
          ],
        },
        caption: 'Accept fast, count later',
      },
    },
    {
      title: 'Windowed counts',
      tag: 'concept',
      heading: 'Fix 2: count in one-minute windows as clicks stream by',
      eli5: 'Helpers stand beside the belt with one tally sheet per booth. Every minute, they write the total for each booth on the scoreboard and start a clean sheet.',
      body: [
        'A **stream job** (Flink) reads the topic, keys by `ad_id`, and counts clicks in **tumbling one-minute windows**. When a window closes, it writes one row, (ad, minute, count), to the store.',
        'That turns 1.15M events a second into a few small rows. The stream processing lesson covers windows, watermarks and state in detail.',
      ],
      keyIdea: 'Aggregate before storing: billions of events become one small row per ad per minute.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: 'approx', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...kafka, at: at(-3.5, 0) },
          { ...flink, at: at(0, 0), status: 'active', chips: [{ text: '12:01 ad_77 = 41,208', tone: 'good' }] },
          { ...store, at: at(3.5, 0) },
        ],
        links: [link('kafka', 'flink', { label: 'read' }), link('flink', 'store', { label: '1 row/ad/min' })],
        flows: [
          { path: ['kafka', 'flink'], tone: 'event', label: 'clicks', count: 4, duration: 1.6 },
          { path: ['flink', 'store'], tone: 'data', label: '(ad_77, 12:01, 41,208)', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Tumbling windows',
          icon: 'Clock',
          rows: [
            { text: '12:00 to 12:01', value: 'ad_77: 40,911' },
            { text: '12:01 to 12:02', value: 'ad_77: 41,208' },
            { text: '12:02 to 12:03', value: 'open, counting', tone: 'muted' },
          ],
          footer: { text: 'One row per ad per window', tone: 'good' },
        },
        caption: 'Many events in, one row out',
      },
      code: {
        language: 'typescript',
        title: 'The counting job, in pseudo-Flink',
        source: `clicks                          // Kafka source, one task per partition
  .keyBy((c) => c.adId)         // all clicks for an ad go to one task
  .window(Tumbling.of(minutes(1)))
  .aggregate(new CountClicks()) // keeps one counter per ad per window
  .sinkTo(rollupStore);         // (ad_id, window_start) is the row key`,
        highlight: [2, 3, 5],
      },
    },
    {
      title: 'Hot ads',
      tag: 'case',
      heading: 'Case: one huge ad overloads one partition',
      eli5: 'One booth is the most popular at the fair. Every ticket for it goes to the same helper, who gets buried while the others stand around. So we split that booth across several helpers.',
      body: [
        'Keying by `ad_id` sends every click for one ad to one task. A viral ad such as ad_99 can carry 3M clicks a minute, so its partition and task run hot while the neighbors idle.',
        'The fix is **key salting**. After the source reads, rebalance, add a random suffix 0 to 7, and count `(ad_id, salt)` in stage 1. Then sum the 8 partials in stage 2. Dedupe stays before the salt, so retries still meet.',
      ],
      keyIdea: 'A skewed key breaks parallelism. Salt it, count partials, then merge.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: 'approx', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...kafka, at: at(-5, 0), chips: ['ad_99: 3M clicks/min'] },
          { id: 'w1', kind: 'worker', at: at(-1.5, -3.5), label: 'partial A', sub: 'ad_99#0..3', load: 55, status: 'ok' },
          { id: 'w2', kind: 'worker', at: at(-1.5, 3.5), label: 'partial B', sub: 'ad_99#4..7', load: 55, status: 'ok' },
          { ...flink, id: 'merge', at: at(2, 0), label: 'merge', sub: 'sum partials' },
          { ...store, at: at(5.5, 0) },
        ],
        links: [link('kafka', 'w1'), link('kafka', 'w2'), link('w1', 'merge'), link('w2', 'merge'), link('merge', 'store')],
        flows: [
          { path: ['kafka', 'w1', 'merge', 'store'], tone: 'event', label: 'salted', duration: 2.2 },
          { path: ['kafka', 'w2', 'merge', 'store'], tone: 'event', duration: 2.2, delay: 0.3 },
        ],
        panel: {
          title: 'Two-stage count',
          icon: 'Split',
          code: 'key  = adId + "#" + rand(0..7)\nstage 1: count per (key, minute)\nstage 2: strip "#n", sum partials\n\nad_99: 375k + 374k + ... = 3.0M',
          footer: { text: 'Same total, spread across tasks', tone: 'good' },
        },
        caption: 'Spread the hot key, then merge',
      },
    },
    {
      title: 'Serving store',
      tag: 'concept',
      heading: 'Fix 3: serve dashboards from a column store, not the log',
      eli5: 'The scoreboard on the wall is built for quick glances. Nobody walks to the belt to count tickets when they want to know who is winning.',
      body: [
        'Dashboards read from **Druid or ClickHouse**: columnar, partitioned by time, built for roll-ups. A query like "top 10 campaigns by clicks in the last hour" scans only the right time shards and returns in under 200 ms, even over billions of rows.',
        'The time series lesson and the data warehouse lessons explain why column layouts scan so fast.',
      ],
      keyIdea: 'Pick the read store for the read pattern: time-partitioned, columnar and pre-aggregated.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: 'approx', raw: '45 TB/day' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          { ...flink, at: at(-3.5, 0) },
          { ...store, at: at(0, 0), status: 'active', chips: ['50k queries/s'] },
          { ...dash, at: at(3.5, 0), chips: [{ text: 'top 10 campaigns, 1 h', tone: 'good' }] },
        ],
        links: [link('flink', 'store', { label: 'write rollups' }), link('dash', 'store', { label: '< 200 ms', labelTone: 'good' })],
        flows: [
          { path: ['flink', 'store'], tone: 'data', label: 'rows', duration: 1.4 },
          { path: ['dash', 'store', 'dash'], tone: 'request', label: 'query', duration: 2, delay: 1.6 },
        ],
        panel: {
          title: 'Why this store',
          icon: 'Warehouse',
          rows: [
            { text: 'Layout', value: 'columnar' },
            { text: 'Partitioning', value: 'by time' },
            { text: 'Rollups at ingest', value: 'yes', tone: 'good' },
            { text: 'Top-10 over a day', value: '< 200 ms', tone: 'good' },
          ],
        },
        caption: 'A read store shaped like the questions',
      },
    },
    {
      title: 'Rollup levels',
      tag: 'tradeoff',
      heading: 'Tradeoff: pre-compute three granularities',
      eli5: 'The scoreboard keeps three charts: tickets by minute, by hour and by day. A day chart is quick to read, but it cannot tell you what happened at 2:13 pm.',
      body: [
        'Pre-aggregate the questions you know people ask: **(ad, minute)** for live charts, **(campaign, hour)** for reports and **(advertiser, day)** for billing views. Coarser rows come from finer ones, and each answers in milliseconds.',
        'The cost is flexibility. A new question, such as clicks by device, needs a new dimension. That is why the raw log stays in object storage: you can always recompute.',
      ],
      keyIdea: 'Rollups trade flexibility for speed. Keep raw events so a new question is a recompute, not a lost cause.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: 'approx', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...flink, at: at(-5, 0) },
          { id: 'rmin', kind: 'warehouse', at: at(-1.5, -3.5), label: 'per minute', sub: 'ad', tint: 'teal' },
          { id: 'rhour', kind: 'warehouse', at: at(-1.5, 3.5), label: 'per hour', sub: 'campaign', tint: 'blue' },
          { id: 'rday', kind: 'warehouse', at: at(3.5, 0), label: 'per day', sub: 'advertiser', tint: 'amber' },
        ],
        links: [link('flink', 'rmin'), link('flink', 'rhour'), link('rhour', 'rday')],
        flows: [
          { path: ['flink', 'rmin'], tone: 'data', duration: 1.4 },
          { path: ['flink', 'rhour', 'rday'], tone: 'data', duration: 2, delay: 0.3 },
        ],
        panel: {
          title: 'Granularities',
          icon: 'Layers',
          rows: [
            { text: '(ad, minute)', value: 'live charts' },
            { text: '(campaign, hour)', value: 'reports' },
            { text: '(advertiser, day)', value: 'billing view' },
            { text: 'New dimension', value: 'recompute from raw', tone: 'warn' },
          ],
        },
        caption: 'Fast for known questions, raw for new ones',
      },
    },
    {
      title: 'Duplicates',
      tag: 'concept',
      heading: 'Fix 4: the same click arrives 2 to 5 times',
      eli5: 'A kid is not sure the chute heard the ticket, so they hand over another copy. If each ticket has a number stamped on it, the helper can spot a repeat and count it only once.',
      body: [
        'Ad SDKs retry on network hiccups, so one real click can arrive 2 to 5 times. The client generates a `click_id` (a UUID) per click, and every retry carries the same id.',
        'The stream job keeps a **Bloom filter per partition** that covers the last 10 minutes of ids. A click whose id is already in it is dropped. The probabilistic structures lesson explains why a Bloom filter is cheap here.',
      ],
      keyIdea: 'Idempotency comes from a client-made id. Dedupe on that id inside a time window.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: 'approx', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...phones, at: at(-5, 0), chips: [{ text: 'click_id 7b1e (retry)', tone: 'warn' }] },
          { ...kafka, at: at(-1.5, 0) },
          { id: 'dedupe', kind: 'limiter', at: at(2, 0), label: 'dedupe', sub: 'Bloom, 10 min', status: 'active' },
          { ...flink, at: at(5.5, 0), label: 'count' },
        ],
        links: [link('phones', 'kafka'), link('kafka', 'dedupe'), link('dedupe', 'flink')],
        flows: [
          { path: ['phones', 'kafka', 'dedupe', 'flink'], tone: 'event', label: '7b1e, first', duration: 2.4 },
          { path: ['phones', 'kafka', 'dedupe'], tone: 'error', label: '7b1e, again: dropped', duration: 2, delay: 2.5 },
        ],
        panel: {
          title: 'Dedupe check',
          icon: 'Copy',
          code: 'if bloom.contains(click.id):\n    drop(click)          # seen in 10 min\nelse:\n    bloom.add(click.id)\n    count(click)',
          footer: { text: 'Rare false positives drop a real click', tone: 'warn' },
        },
        caption: 'Same id, counted once',
      },
      code: {
        language: 'python',
        title: 'Windowed dedupe, per partition',
        source: `class Dedupe:
    def __init__(self):
        self.window = [BloomFilter(capacity=50_000_000)  # one filter per
                       for _ in range(2)]                # 5-minute slice

    def keep(self, click) -> bool:
        if any(f.contains(click.id) for f in self.window):
            return False              # already counted
        self.window[-1].add(click.id)
        return True

    def rotate(self):                 # every 5 minutes: drop the oldest
        self.window = [self.window[-1], BloomFilter(capacity=50_000_000)]`,
        highlight: [6, 7, 8, 12],
      },
    },
    {
      title: 'Late events',
      tag: 'case',
      heading: 'Case: a click that arrives after its window closed',
      eli5: 'A kid drops a ticket in the chute at 12:01, but the belt was stuck, so it reaches the helper at 12:04. The 12:01 sheet is already filed. The helper must decide what to do with it.',
      body: [
        'Clicks carry an **event time** (when the tap happened), but they reach the job at a later **processing time**. A phone in a tunnel can send its clicks minutes late.',
        'A **watermark** says how far event time has advanced. Allow 2 minutes of lateness. Later clicks go to a **late side output**. Raw is partitioned by event time, so the batch, run after a 3 hour cutoff, counts them. Clicks past the cutoff go to a correction run.',
      ],
      keyIdea: 'The speed layer allows a little lateness and gives up on the rest. The batch layer picks up what it dropped.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: 'small undercount', raw: '45 TB/day' },
      metricTones: { err: 'warn' },
      scene: {
        nodes: [
          { id: 'tunnel', kind: 'phone', at: at(-5, 0), label: 'phone in tunnel', sub: 'offline 4 min', status: 'dim' },
          { ...kafka, at: at(-1.5, 0) },
          { ...flink, at: at(2, 0), chips: [{ text: 'watermark 12:03', tone: 'good' }], status: 'active' },
          { ...s3, id: 'late', at: at(5.5, 0), label: 'late side output', sub: 'goes to batch' },
        ],
        links: [link('tunnel', 'kafka'), link('kafka', 'flink'), link('flink', 'late', { style: 'dashed' })],
        flows: [
          { path: ['tunnel', 'kafka', 'flink'], tone: 'event', label: 'ts 12:01, arrives 12:05', duration: 2.4 },
          { path: ['flink', 'late'], tone: 'error', label: 'too late', duration: 1.4, delay: 2.5 },
        ],
        panel: {
          title: 'Event time vs processing time',
          icon: 'Clock',
          rows: [
            { text: 'Event time', value: '12:01' },
            { text: 'Arrives at', value: '12:05', tone: 'warn' },
            { text: 'Allowed lateness', value: '2 min' },
            { text: 'Result', value: 'late side output', tone: 'bad' },
            { text: 'Batch runs', value: 'D+1, 03:00 cutoff' },
            { text: 'Past the cutoff', value: 'correction run', tone: 'warn' },
          ],
          footer: { text: 'Batch layer recounts it overnight', tone: 'muted' },
        },
        caption: 'Late data is parked, not lost',
      },
    },
    {
      title: 'Only approximate',
      tag: 'tradeoff',
      heading: 'The speed layer is fast but only approximately right',
      eli5: 'The wall scoreboard is for cheering. It can be off by a few tickets because of repeats, late arrivals and mix-ups. The prize money is paid from the careful count, not the scoreboard.',
      body: [
        'Every shortcut above has a cost: a Bloom filter has false positives, late clicks are skipped, and a restarted job may replay a little. Each is tiny, and together they leave a small error.',
        'That is fine for a chart. It is not fine for an invoice, where the target is ±0.01%. Billing needs a second, exact path built from the raw log.',
      ],
      keyIdea: 'Fast and exact do not come from the same pipeline at this scale. Use a fast approximate one and a slow exact one.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: '~0.5% off', raw: '45 TB/day' },
      metricTones: { err: 'bad', lag: 'good' },
      scene: {
        nodes: [
          { ...flink, at: at(-3.5, 0) },
          { ...store, at: at(0, 0), chips: [{ text: 'ad_77: 41,208', tone: 'warn' }] },
          { ...bill, at: at(3.5, 0), status: 'hot', badge: 'needs ±0.01%' },
        ],
        links: [link('flink', 'store'), link('store', 'bill', { style: 'dashed', label: 'not accurate enough', labelTone: 'bad' })],
        flows: [{ path: ['flink', 'store'], tone: 'data', duration: 1.4 }],
        panel: {
          title: 'Where error creeps in',
          icon: 'Bug',
          rows: [
            { text: 'Bloom false positives', value: 'drops real clicks', tone: 'warn' },
            { text: 'Late events', value: 'skipped', tone: 'warn' },
            { text: 'Restart replays', value: 'a few extra', tone: 'warn' },
            { text: 'Billing target', value: '±0.01%', tone: 'good' },
          ],
        },
        caption: 'Good for dashboards, not for invoices',
      },
    },
    {
      title: 'Lambda design',
      tag: 'concept',
      heading: 'Fix 5: Lambda, a speed layer plus a batch layer',
      eli5: 'Two counters share the fair. The quick one tallies tickets as they arrive and updates the scoreboard. A careful one counts every ticket from the closet again tonight, and prizes follow the careful count.',
      body: [
        'The **speed layer** (Kafka, Flink, rollup store) answers in seconds. The **batch layer** writes every click to S3 and a nightly **Spark** job recomputes exact counts, which become the billing numbers at T+1 day.',
        'Dashboards show the speed layer now and are corrected when the batch result lands. This is the textbook Lambda pattern, and it remains the right default at 100B events a day.',
      ],
      keyIdea: 'Lambda gives fresh answers in seconds from one path and the truth tomorrow from another.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: '±0.01% (T+1d)', raw: '45 TB/day' },
      metricTones: { lag: 'good', err: 'good' },
      quiz: {
        question: 'In the Lambda design, which layer produces the numbers used for billing, and why?',
        options: [
          'The speed layer, because it is the freshest',
          'The batch layer, because it recomputes exact counts from the full raw log',
          'Whichever layer finished first',
          'The rollup store, because it is columnar',
        ],
        answer: 1,
        explain: 'The batch layer reads every raw click, removes duplicates and fraud, and picks up late events, so it reaches the exact count. The speed layer is fresh but approximate, so it only drives the live dashboard.',
      },
      scene: {
        nodes: [
          { ...kafka, at: at(-3.5, 0) },
          { ...flink, at: at(0, -3), label: 'speed layer', sub: 'Flink, seconds' },
          { ...s3, at: at(0, 3.5) },
          { ...spark, at: at(3.5, 3.5) },
          { ...store, at: at(3.5, -3), label: 'serve', sub: 'dashboard + billing' },
        ],
        links: [link('kafka', 'flink'), link('kafka', 's3'), link('s3', 'spark'), link('flink', 'store'), link('spark', 'store', { label: 'T+1 day' })],
        flows: [
          { path: ['kafka', 'flink', 'store'], tone: 'event', label: 'fast', duration: 2 },
          { path: ['kafka', 's3', 'spark', 'store'], tone: 'data', label: 'exact', duration: 2.8, delay: 0.5 },
        ],
        panel: {
          title: 'Two layers',
          icon: 'Layers',
          rows: [
            { text: 'Speed layer', value: 'seconds, approximate' },
            { text: 'Batch layer', value: 'next day, exact', tone: 'good' },
            { text: 'Dashboards', value: 'speed now, fixed at T+1d' },
            { text: 'Billing', value: 'batch only', tone: 'good' },
          ],
        },
        caption: 'Both paths read the same log',
      },
    },
    {
      title: 'Batch job',
      tag: 'concept',
      heading: 'The nightly batch job: exact counts and billing',
      eli5: 'At night, the careful counter empties the whole closet onto a big table. She removes repeats and fake tickets, counts each booth once, and writes the final numbers on the prize list.',
      body: [
        'Spark reads the day\'s raw files plus the day before, so duplicates that straddle midnight are caught, then runs `dropDuplicates(click_id)`. That is a big shuffle over about 100B rows, so it runs on a cluster overnight.',
        'It **rescores** every raw click with the current fraud rule, since the raw log is written before the fraud filter, and drops scores above 0.9. It groups by advertiser and ad and overwrites that day\'s partition, so a rerun is safe.',
      ],
      keyIdea: 'The batch job is exact because it sees all the data at once, and it is safe to rerun because it overwrites.',
      metrics: { rate: '1.15M/s', lag: 'T+1 day', err: '±0.01%', raw: '45 TB/day' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...s3, at: at(-3.5, 0), chips: ['dt and dt-1'] },
          { ...spark, at: at(0, 0), status: 'active', chips: ['dropDuplicates', 'rescore fraud'] },
          { ...bill, at: at(3.5, 0), chips: [{ text: 'ad_77: 41,196', tone: 'good' }] },
        ],
        links: [link('s3', 'spark', { label: 'read day' }), link('spark', 'bill', { label: 'overwrite' })],
        flows: [
          { path: ['s3', 'spark'], tone: 'data', label: '100B rows', duration: 2 },
          { path: ['spark', 'bill'], tone: 'response', label: 'final counts', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Batch steps',
          icon: 'Workflow',
          rows: [
            { text: '1. Read', value: 'day and day before' },
            { text: '2. Dedupe', value: 'click_id, big shuffle' },
            { text: '3. Rescore fraud', value: 'rule v1, drop > 0.9' },
            { text: '4. Count', value: 'by ad and advertiser' },
            { text: '5. Write', value: 'overwrite the partition', tone: 'good' },
          ],
        },
        caption: 'See everything, then count once',
      },
      code: {
        language: 'python',
        title: 'The nightly Spark job',
        source: `raw = spark.read.parquet(
    "s3://clicks/raw/dt=2025-12-31",         # day before: midnight duplicates
    "s3://clicks/raw/dt=2026-01-01")

scored = rescore(raw, rule_version="v1")     # the batch computes fraud_score

clean = (scored
    .dropDuplicates(["click_id"])            # a big shuffle, runs on a cluster
    .filter("fraud_score <= 0.9")            # quarantined clicks are not billed
    .filter("to_date(ts) = '2026-01-01'"))   # bill only this event day

daily = clean.groupBy("advertiser_id", "ad_id").count()

(daily.write.mode("overwrite")               # rerun-safe: same input, same output
      .parquet("s3://clicks/billing/dt=2026-01-01"))`,
        highlight: [5, 8, 9, 14],
      },
    },
    {
      title: 'Unique users',
      tag: 'concept',
      heading: 'Unique clickers per ad with HyperLogLog',
      eli5: 'A booth owner asks how many different kids visited. Writing down every name would take pages. A tiny tally card gives a close guess, and two cards can be merged into one.',
      body: [
        'Dashboards also want "unique users who clicked this ad in the last hour". An exact distinct count over 100M users needs a set. **HyperLogLog** gives about ±2% error in 12 KB.',
        'Each element is hashed. A register keeps the rarest hash pattern it has seen. Two sketches **merge** by taking the maximum of each register, so minute sketches roll up into hour and day.',
      ],
      keyIdea: 'A mergeable sketch answers "how many distinct" in a few KB, with a small known error.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: '±2% uniques', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...flink, at: at(-3.5, 0), chips: ['HLL per ad per min'] },
          { id: 'hll', kind: 'db', at: at(0, 0), label: 'sketches', sub: '12 KB each', chips: [{ text: '~38,900 unique', tone: 'good' }] },
          { ...store, at: at(3.5, 0), label: 'per hour', sub: 'merged by max' },
        ],
        links: [link('flink', 'hll'), link('hll', 'store', { label: 'merge' })],
        flows: [
          { path: ['flink', 'hll', 'store'], tone: 'data', label: 'union', duration: 2.2 },
        ],
        panel: {
          title: 'HyperLogLog',
          icon: 'Hash',
          rows: [
            { text: 'Size', value: '12 KB' },
            { text: 'Error', value: '~±2%', tone: 'warn' },
            { text: 'Merge', value: 'max per register', tone: 'good' },
            { text: 'Exact set of 100M ids', value: 'GBs', tone: 'bad' },
          ],
        },
        caption: 'Count distinct without storing the set',
      },
      code: {
        language: 'python',
        title: 'HyperLogLog, in outline',
        source: `P = 14                                   # 2**14 registers, about 12 KB

def add(regs, item):
    h = hash64(item)
    bucket = h & ((1 << P) - 1)              # low bits pick a register
    rank = leading_zeros(h >> P) + 1         # how rare this hash is
    regs[bucket] = max(regs[bucket], rank)

def merge(a, b):                             # minute sketches into an hour
    return [max(x, y) for x, y in zip(a, b)]`,
        highlight: [5, 6, 7, 10],
      },
    },
    {
      title: 'Fraud filter',
      tag: 'concept',
      heading: 'Shedding fraud: bots, impossible trips and a model',
      eli5: 'Some kids print fake tickets, or one kid runs back to the chute a thousand times. A guard checks each ticket for tricks, and suspicious ones go in a separate box for the teacher to look at.',
      body: [
        'About 30% of raw clicks are not worth billing. Cheap rules run first: too many clicks per IP, or a suspicious user agent. **Geo impossibility** flags a user clicking from New York and Tokyo 30 seconds apart.',
        'A **model** (gradient-boosted trees on 50+ features) scores each click. Above 0.9, the click is **quarantined**, not billed. A sudden 10x click rate on one publisher triggers a review.',
      ],
      keyIdea: 'Filter fraud with cheap rules first, then a model. Quarantine suspicious clicks instead of deleting them.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: 'approx', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...kafka, at: at(-5, 0) },
          { id: 'fraud', kind: 'limiter', at: at(-1.5, 0), label: 'fraud filter', sub: 'rules + model', status: 'active', chips: ['score > 0.9'] },
          { ...flink, at: at(2, -3), label: 'count', sub: 'clean clicks' },
          { id: 'quar', kind: 'storage', at: at(2, 3.5), label: 'quarantine', sub: 'kept for review', status: 'dim' },
        ],
        links: [link('kafka', 'fraud'), link('fraud', 'flink'), link('fraud', 'quar', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'fraud', 'flink'], tone: 'event', label: 'clean 70%', duration: 2 },
          { path: ['fraud', 'quar'], tone: 'error', label: 'fraud 30%', duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Checks',
          icon: 'Shield',
          rows: [
            { text: 'Clicks per IP too high', value: 'bot rule', tone: 'warn' },
            { text: 'NY then Tokyo in 30 s', value: 'geo impossible', tone: 'warn' },
            { text: 'Model score > 0.9', value: 'quarantine', tone: 'bad' },
            { text: 'Publisher rate 10x', value: 'manual review' },
          ],
        },
        caption: 'Bad clicks never reach the invoice',
      },
    },
    {
      title: 'Kappa instead',
      tag: 'tradeoff',
      heading: 'Tradeoff: Lambda or one streaming path (Kappa)?',
      eli5: 'Two counters mean two sets of rules to keep in step. If the quick counter and the careful one use different rules, they will give different totals, and the families will argue.',
      body: [
        'Lambda has a real cost: two code paths, the speed layer and the batch layer, that must return **compatible answers**. Each fix is written twice, and the two drift apart.',
        '**Kappa** runs one streaming job and replays the log to recompute. It is simpler, but it needs a log that keeps history and a stream engine that can do exact, large reprocessing. At this volume, many teams still keep the batch layer for billing.',
      ],
      keyIdea: 'Lambda is safer for billing but costs two code paths. Kappa has one path, and it asks more of the log and the engine.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: '±0.01% (T+1d)', raw: '45 TB/day' },
      scene: {
        nodes: [
          { ...kafka, at: at(-3.5, 0), chips: ['replay from offset 0'] },
          { ...flink, at: at(0, 0), label: 'one stream job', status: 'active' },
          { ...store, at: at(3.5, 0), label: 'serving store' },
        ],
        links: [link('kafka', 'flink'), link('flink', 'store')],
        flows: [{ path: ['kafka', 'flink', 'store'], tone: 'event', label: 'replay', count: 3, duration: 2 }],
        panel: {
          title: 'Lambda vs Kappa',
          icon: 'Scale',
          rows: [
            { text: 'Lambda: code paths', value: '2, must agree', tone: 'warn' },
            { text: 'Lambda: billing', value: 'exact, proven', tone: 'good' },
            { text: 'Kappa: code paths', value: '1', tone: 'good' },
            { text: 'Kappa: needs', value: 'long log retention', tone: 'warn' },
          ],
        },
        caption: 'One path is simpler, two is safer for billing',
      },
    },
    {
      title: 'Job crash',
      tag: 'case',
      heading: 'Failure: the stream job crashes mid-window',
      eli5: 'A helper faints at the tally table, and the half-finished sheet is lost. A new helper takes the last saved sheet and asks the belt to replay tickets from that spot, so nothing is missed or counted twice.',
      body: [
        'The job takes a **checkpoint** (for example every 30 seconds): its state plus the Kafka offsets it had read, saved to S3. After a crash, a new instance restores the checkpoint and resumes from those offsets.',
        'Replay will redo some work, so the sink must be **idempotent**. The rollup row key is `(ad_id, window_start)`, so rewriting the same window overwrites it. The effect is exactly-once counting.',
      ],
      keyIdea: 'Checkpoints give a restart point, and an idempotent sink makes the replay safe.',
      metrics: { rate: '1.15M/s', lag: '+40 s then back', err: 'unchanged', raw: '45 TB/day' },
      metricTones: { lag: 'warn', err: 'good' },
      scene: {
        nodes: [
          { ...kafka, at: at(-3.5, 0), chips: ['offset 9,310,442'] },
          { ...flink, at: at(0, 0), status: 'down', badge: 'crashed 12:01:20' },
          { id: 'ckpt', kind: 'storage', at: at(-1.75, 7), label: 'checkpoint', sub: 'offsets + state, S3' },
          { ...store, at: at(3.5, 0), chips: [{ text: 'upsert by (ad, window)', tone: 'good' }] },
        ],
        links: [link('kafka', 'flink'), link('flink', 'store'), link('ckpt', 'flink', { label: 'restore' })],
        flows: [
          { path: ['ckpt', 'flink'], tone: 'handshake', label: 'restore state', duration: 1.6 },
          { path: ['kafka', 'flink', 'store'], tone: 'event', label: 'replay', duration: 2, delay: 1.8 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Repeat',
          rows: [
            { text: 'Checkpoint', value: 'every 30 s' },
            { text: 'Restore', value: 'state + offsets', tone: 'good' },
            { text: 'Replay', value: 'up to 30 s of clicks' },
            { text: 'Sink', value: 'idempotent upsert', tone: 'good' },
          ],
        },
        caption: 'Restart, replay, overwrite',
      },
    },
    {
      title: 'Traffic spike',
      tag: 'case',
      heading: 'Failure: a 5M clicks/s spike',
      eli5: 'A famous prize opens and a crowd rushes in. The belt gets long, which is fine. The helpers work as fast as they can, and the teacher brings more helpers before the belt reaches the end of the room.',
      body: [
        'At peak, the gateway scales out and the log absorbs the burst, so consumers fall behind by a few seconds of **lag**. See the back-pressure lesson for why a buffer beats dropping work.',
        'Add stream workers when lag grows, but remember that parallelism is capped by the partition count. Provision partitions for peak (for example 2,000) so more workers can actually help.',
      ],
      keyIdea: 'Spikes turn into consumer lag. Autoscale workers, and plan partitions for the peak, not the average.',
      metrics: { rate: '5M/s', lag: '40 s, recovering', err: 'unchanged', raw: '45 TB/day' },
      metricTones: { rate: 'warn', lag: 'warn', err: 'good' },
      scene: {
        nodes: [
          { ...gateway, at: at(-5, 0), load: 70, status: 'hot' },
          { ...kafka, at: at(-1.5, 0), badge: 'lag 40 s', chips: [{ text: '2,000 partitions', tone: 'good' }] },
          { id: 'w1', kind: 'worker', at: at(2, -3), label: 'workers x 400', sub: 'autoscaled', load: 88, status: 'hot' },
          { id: 'w2', kind: 'worker', at: at(2, 3.5), label: 'new workers', sub: '+ 600 joining', load: 30, status: 'ok' },
        ],
        links: [link('gateway', 'kafka', { label: '5M/s', labelTone: 'warn' }), link('kafka', 'w1'), link('kafka', 'w2')],
        flows: [
          { path: ['gateway', 'kafka'], tone: 'event', count: 5, duration: 1.2, label: 'burst' },
          { path: ['kafka', 'w1'], tone: 'event', duration: 1.6, delay: 0.8 },
          { path: ['kafka', 'w2'], tone: 'event', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'Absorbing the peak',
          icon: 'TrendingUp',
          rows: [
            { text: 'Ingest', value: '5M/s' },
            { text: 'Log buffers it', value: 'lag 40 s', tone: 'warn' },
            { text: 'Workers', value: 'scale out', tone: 'good' },
            { text: 'Parallelism cap', value: 'partition count', tone: 'warn' },
          ],
          footer: { text: 'No clicks dropped', tone: 'good' },
        },
        caption: 'The log is the shock absorber',
      },
    },
    {
      title: 'Recount',
      tag: 'case',
      heading: 'Failure: a bug is found, so recompute from raw',
      eli5: 'The teacher finds that the fake-ticket rule was wrong last week. Because every ticket is still in the closet, the careful counter can count last week again with the fixed rule and replace the old numbers.',
      body: [
        'A bad fraud rule shipped for three days and billed some fake clicks. Fixing the rule alone does not fix history. The raw log in S3 does.',
        'Rerun the Spark job over those three days. It rescores every raw click with the corrected rule, so history changes, and it overwrites each day. Issue credits or adjustments to the affected advertisers. A system without raw events cannot recover.',
      ],
      keyIdea: 'Raw events are the insurance policy. Any wrong aggregate can be recomputed from them.',
      metrics: { rate: '1.15M/s', lag: 'T+1 day', err: 'fixed', raw: '45 TB/day' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...s3, at: at(-3.5, 0), chips: ['3 days kept'] },
          { ...spark, at: at(0, 0), status: 'active', chips: ['fraud rule v2'] },
          { ...bill, at: at(3.5, 0), chips: [{ text: 'credit issued', tone: 'good' }] },
        ],
        links: [link('s3', 'spark', { label: 'rerun 3 days' }), link('spark', 'bill', { label: 'overwrite' })],
        flows: [
          { path: ['s3', 'spark'], tone: 'data', label: 'raw', duration: 2 },
          { path: ['spark', 'bill'], tone: 'response', label: 'corrected', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Recount steps',
          icon: 'Repeat',
          rows: [
            { text: 'Ship the fixed rule', value: 'fraud v2' },
            { text: 'Rerun batch', value: 'for 3 days' },
            { text: 'Partitions overwritten', value: 'same keys', tone: 'good' },
            { text: 'Advertisers', value: 'credited', tone: 'good' },
          ],
        },
        caption: 'History can be rewritten because raw is kept',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole ad click aggregator',
      eli5: 'Tickets ride a belt, helpers tally them minute by minute for the quick scoreboard, and every ticket is kept in the closet. At night, a careful counter recounts it all, and the prizes follow that count.',
      body: [
        'Clicks enter through a thin gateway into a replicated log. A stream job dedupes, filters fraud and counts one-minute windows into a rollup store that dashboards query in under 200 ms.',
        'Every click also lands in S3, and a nightly Spark job produces the exact billing numbers within ±0.01%. Checkpoints, idempotent sinks and the raw log cover crashes, spikes and bugs.',
      ],
      keyIdea: 'Log first, aggregate by window, serve from a column store, and keep raw events so the exact answer can always be recomputed.',
      metrics: { rate: '1.15M/s', lag: '< 1 min', err: '±0.01% (T+1d)', raw: '45 TB/day' },
      metricTones: { lag: 'good', err: 'good', rate: 'good' },
      quiz: {
        question: 'A deploy bug miscounted clicks for two days. What lets you produce correct billing numbers afterwards?',
        options: [
          'Edit the rollup rows by hand',
          'Wait for the stream job to correct itself',
          'Rerun the batch job over the raw click log for those days and overwrite the results',
          'Reduce the window size to one second',
        ],
        answer: 2,
        explain: 'Raw events are the source of truth. Rerunning the idempotent batch job over the affected days recomputes exact counts and overwrites the bad aggregates.',
      },
      scene: {
        nodes: [
          { ...phones, at: at(-7, 0) },
          { ...kafka, at: at(-3.5, 0) },
          { ...flink, at: at(0, -3), label: 'dedupe, fraud, count', sub: '1-min windows' },
          { ...store, at: at(3.5, -3), label: 'dashboard store' },
          { ...s3, at: at(0, 4), sub: 'nightly Spark, billing' },
        ],
        links: [link('phones', 'kafka'), link('kafka', 'flink'), link('flink', 'store'), link('kafka', 's3')],
        flows: [
          { path: ['phones', 'kafka', 'flink', 'store'], tone: 'event', label: 'click', duration: 3 },
          { path: ['kafka', 's3'], tone: 'data', duration: 2, delay: 0.6 },
        ],
        panel: {
          title: 'Decisions to remember',
          icon: 'List',
          rows: [
            { text: 'Gateway', value: 'append to a log, return' },
            { text: 'Speed layer', value: 'windows, dedupe, fraud' },
            { text: 'Batch layer', value: 'exact, rerunnable', tone: 'good' },
            { text: 'Serving', value: 'columnar rollups' },
            { text: 'Safety nets', value: 'checkpoints + raw log', tone: 'good' },
          ],
        },
        caption: 'Fast answers now, exact answers tomorrow',
      },
    },
  ],
};
