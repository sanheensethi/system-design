import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const phones: SceneNode = { id: 'phones', kind: 'phone', at: at(-6.8, 0), label: 'phones', sub: '50,000 clicks/s' };
const tunnel: SceneNode = { id: 'tunnel', kind: 'phone', at: at(-6.8, -6), label: 'phone in tunnel', sub: 'offline 2 min' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: at(-3.4, 0), label: 'clicks topic', sub: 'Kafka, 32 partitions' };
const filter: SceneNode = { id: 'filter', kind: 'block', at: at(0, 0), label: 'filter', sub: 'drop bots, dupes', icon: 'Shield', tint: 'blue' };
const counter: SceneNode = { id: 'counter', kind: 'block', at: at(3.4, 0), label: 'windowed count', sub: 'keyBy ad_id, 1 min', icon: 'Hash', tint: 'violet' };
const dash: SceneNode = { id: 'dash', kind: 'db', at: at(6.8, 0), label: 'dashboard DB', sub: 'per-minute counts' };
const ckpt: SceneNode = { id: 'ckpt', kind: 'storage', at: at(3.4, 6), label: 'checkpoints', sub: 'S3, every 30 s' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const pipe: SceneLink[] = [link('phones', 'kafka'), link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash')];

export const streamProcessingPart2: Lesson = {
  id: 'stream-processing-part-2',
  title: 'Stream processing (part 2)',
  tagline: 'Get the right answer when events arrive late, twice or out of order, then join streams and pick an engine.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Event time, processing time, watermarks and late data',
    'What exactly-once means in practice, and where it stops',
    'Joining a stream with a table and with another stream',
    'Reprocessing history, and where Flink and Kafka Streams fit',
  ],
  metrics: [
    { key: 'lag', label: 'Dashboard lag', icon: 'Timer' },
    { key: 'rate', label: 'Clicks/s', icon: 'Zap' },
    { key: 'state', label: 'Job state', icon: 'Database' },
    { key: 'late', label: 'Late clicks', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Two clocks',
      tag: 'problem',
      heading: 'When it happened is not when it arrived',
      eli5: 'A letter postmarked Monday can reach the sorting belt on Wednesday. The postmark says when it was sent. The belt only knows when it showed up.',
      body: [
        'Each click has two times. **Event time** is when the user tapped, stamped by the phone. **Processing time** is when the job sees it.',
        'Usually they are a second apart. A phone in a tunnel taps at 10:00:58 and only reaches the network at 10:03:10.',
      ],
      keyIdea: 'Every event has an event time and a processing time, and they can be minutes apart.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '-' },
      scene: {
        nodes: [
          { ...tunnel, status: 'hot', badge: 'tapped 10:00:58' },
          { ...kafka, badge: 'now 10:03:10' },
          { ...filter, status: 'dim' },
          { ...counter, status: 'active' },
        ],
        links: [link('tunnel', 'kafka', { style: 'dashed', label: 'offline 2 min', labelTone: 'warn' }), link('kafka', 'filter'), link('filter', 'counter')],
        flows: [{ path: ['tunnel', 'kafka', 'filter', 'counter'], tone: 'event', label: 'event_time 10:00:58', duration: 2.6 }],
        panel: {
          title: 'One click, two times',
          icon: 'Clock',
          rows: [
            { text: 'Event time', value: '10:00:58' },
            { text: 'Processing time', value: '10:03:10', tone: 'warn' },
            { text: 'Gap', value: '2 min 12 s', tone: 'bad' },
          ],
        },
        caption: 'The tap and the arrival are minutes apart',
      },
    },
    {
      title: 'Wrong minute',
      tag: 'case',
      heading: 'Case: processing time puts the click in the wrong minute',
      eli5: 'If the clerk counts a letter by the day it reached the belt, a Monday letter lands on Wednesday\'s sheet. Monday\'s total is short and Wednesday\'s is too long.',
      body: [
        'Windows by processing time are simple and always on time, but they put the tunnel click in the 10:03 minute. The per-minute spend is wrong, which can trigger a wrong budget decision.',
        'Replays break too. Rerun yesterday\'s data and everything is "processed" today, so the answers differ from the first run.',
      ],
      keyIdea: 'Processing-time windows are easy but give wrong minutes and results that change on replay.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '-' },
      metricTones: { late: 'bad' },
      scene: {
        nodes: [
          { ...tunnel, status: 'active', badge: 'tapped 10:00:58' },
          { ...kafka },
          { ...counter, label: 'count by arrival', sub: 'processing time', status: 'hot', badge: 'puts it in 10:03' },
          { ...dash, status: 'hot', badge: '10:00 short by 1' },
        ],
        links: [link('tunnel', 'kafka', { style: 'dashed' }), link('kafka', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['tunnel', 'kafka', 'counter'], tone: 'error', label: 'counted at 10:03', duration: 2.4 },
          { path: ['counter', 'dash'], tone: 'data', label: '10:03 +1', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Where the click lands',
          icon: 'Table',
          rows: [
            { text: 'Real minute', value: '10:00' },
            { text: 'Counted in', value: '10:03', tone: 'bad' },
            { text: 'Replay tomorrow', value: 'another answer', tone: 'bad' },
          ],
        },
        caption: 'The count is on time and in the wrong place',
      },
    },
    {
      title: 'Event-time windows',
      tag: 'concept',
      heading: 'Window on event time for correct, repeatable results',
      eli5: 'The clerk reads the postmark, not the day the letter reached the belt. A Monday letter goes on Monday\'s sheet, however late it shows up.',
      body: [
        'Windows by **event time** put the click in the right minute and give the same answer on every replay.',
        'The price is that events arrive out of order. The job can never be quite sure a minute is finished, because some clicks for 10:00 may still be on their way.',
      ],
      keyIdea: 'Event time gives correct, repeatable windows, and the cost is not knowing when a window is complete.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '-' },
      scene: {
        nodes: [
          { ...tunnel, status: 'active' },
          { ...kafka },
          { ...counter, label: 'count by postmark', sub: 'event time', status: 'ok', badge: 'puts it in 10:00' },
          { ...dash, status: 'ok', badge: '10:00 window open' },
        ],
        links: [link('tunnel', 'kafka', { style: 'dashed' }), link('kafka', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['tunnel', 'kafka', 'counter'], tone: 'event', label: 'event_time 10:00:58', duration: 2.4 },
          { path: ['counter', 'dash'], tone: 'data', label: '10:00 +1', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Event time vs processing time',
          icon: 'Table',
          rows: [
            { text: 'Minute is right', value: 'yes', tone: 'good' },
            { text: 'Replay gives same answer', value: 'yes', tone: 'good' },
            { text: 'Knows a window is done', value: 'no', tone: 'warn' },
          ],
        },
        caption: 'The click belongs to 10:00, though it arrives at 10:03',
      },
    },
    {
      title: 'Watermarks',
      tag: 'concept',
      heading: 'A watermark says "nothing older is coming"',
      eli5: 'The post office puts a card on the belt saying "all letters postmarked before 10:01 are now in". When the clerk sees the card, she closes the 10:00 sheet and sends the total.',
      body: [
        'A **watermark** is a marker flowing with the events that says no more events with an event time earlier than T are expected.',
        'When the watermark passes 10:01, the window 10:00 to 10:01 fires and its count goes to the sink.',
      ],
      keyIdea: 'A watermark is the job\'s guess that everything before time T has arrived.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '-' },
      scene: {
        nodes: [
          { ...kafka },
          { ...filter, status: 'dim' },
          { ...counter, status: 'active', badge: 'watermark 10:01:00' },
          { ...dash, status: 'ok', badge: '10:00 window fired' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 1.6 },
          { path: ['kafka', 'filter', 'counter'], tone: 'handshake', label: 'watermark 10:01', duration: 1.6, delay: 1.8 },
          { path: ['counter', 'dash'], tone: 'data', label: '10:00 counts', duration: 1.2, delay: 3.5 },
        ],
        panel: {
          title: 'The 10:00 window',
          icon: 'Clock',
          rows: [
            { text: 'Window', value: '10:00 to 10:01' },
            { text: 'Watermark reaches', value: '10:01:00', tone: 'good' },
            { text: 'Result', value: 'fires to the sink', tone: 'good' },
          ],
        },
        caption: 'The watermark passes 10:01, so the 10:00 window closes',
      },
    },
    {
      title: 'Watermark delay',
      tag: 'tradeoff',
      heading: 'The delay trades speed against completeness',
      eli5: 'The post office waits a little after the minute ends before sending the "all in" card. A longer wait catches more slow letters but makes everyone wait longer for their total.',
      body: [
        'The common rule is "largest event time seen, minus a fixed delay". With 10 seconds, the job waits until it sees an event stamped 10:01:10 before closing 10:00.',
        'A longer delay catches more stragglers and makes every result later. That delay is most of the 15-second dashboard lag.',
      ],
      keyIdea: 'A longer watermark delay means fewer late events and a slower dashboard.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '0.2%' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          { ...kafka, badge: 'max event time 10:01:10' },
          { ...counter, status: 'active', badge: 'watermark 10:01:00' },
          { ...dash, status: 'ok', badge: '10:00 fired at 10:01:10' },
        ],
        links: [link('kafka', 'counter', { label: 'watermark = max time - 10 s' }), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'counter'], tone: 'handshake', label: 'watermark 10:01', duration: 1.8 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'Choosing the delay',
          icon: 'Gauge',
          rows: [
            { text: '2 s delay', value: 'fast, 2% late', tone: 'warn' },
            { text: '10 s delay', value: '~15 s lag, 0.2% late', tone: 'good' },
            { text: '2 min delay', value: 'slow, 0.01% late', tone: 'warn' },
          ],
          footer: { text: 'Illustrative numbers for this job', tone: 'muted' },
        },
        caption: 'Waiting longer is the price of seeing more',
      },
      code: {
        language: 'sql',
        title: 'Event time and a 10-second watermark on the Kafka source',
        source: `CREATE TABLE clicks (
  click_id   STRING,
  ad_id      BIGINT,
  user_id    BIGINT,
  event_time TIMESTAMP(3),                               -- stamped by the phone
  WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'clicks',
  'properties.bootstrap.servers' = 'kafka:9092',
  'properties.group.id' = 'ad-counts',
  'scan.startup.mode' = 'group-offsets',
  'format' = 'json'
);

-- A partition with no events for 30 s stops holding back the watermark.
SET 'table.exec.source.idle-timeout' = '30 s';`,
        highlight: [5, 6, 17],
      },
    },
    {
      title: 'Idle partition',
      tag: 'concept',
      heading: 'The slowest partition holds every window',
      eli5: 'Every belt lane sends its own "all in" card, and the clerk waits for the slowest lane. If one lane is empty and never sends a card, no sheet ever closes.',
      body: [
        'Each Kafka partition produces its own watermark, and an operator moves at the pace of its **slowest** input.',
        'One partition with no traffic stops every window from closing. Set an **idle timeout** so quiet partitions are ignored after, say, 30 seconds.',
      ],
      keyIdea: 'An operator\'s watermark is the minimum of its inputs, so one idle partition can freeze the job unless you set an idle timeout.',
      metrics: { lag: '~15 s → stuck', rate: '50,000/s', state: '2.4 GB', late: '0.2%' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...kafka, status: 'hot', badge: 'p7 idle' },
          { ...counter, status: 'hot', badge: 'watermark stuck at 10:00' },
          { ...dash, status: 'dim', badge: 'no results' },
        ],
        links: [link('kafka', 'counter', { label: 'min over 32 partitions', labelTone: 'warn' }), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'counter'], tone: 'event', count: 3, duration: 1.8 },
          { path: ['kafka', 'counter'], tone: 'error', label: 'p7: nothing', duration: 1.8, delay: 1 },
        ],
        panel: {
          title: 'Per-partition watermarks',
          icon: 'List',
          rows: [
            { text: 'Partition 0', value: '10:01:10' },
            { text: 'Partition 1', value: '10:01:12' },
            { text: 'Partition 7 (idle)', value: '10:00:02', tone: 'bad' },
            { text: 'Operator watermark', value: '10:00:02', tone: 'bad' },
          ],
        },
        caption: 'One quiet partition pins the whole job',
      },
      quiz: {
        question: 'Partition 7 of a Kafka topic receives no events for an hour. What happens to a Flink job that has no idle timeout?',
        options: [
          'Partition 7 is skipped automatically',
          'The job crashes with a timeout error',
          'The watermark stops advancing, so no event-time window closes',
          'Late events are counted twice',
        ],
        answer: 2,
        explain: 'The operator watermark is the minimum over all inputs. A silent partition never advances, so windows never fire. An idle timeout tells the job to ignore a partition that has been quiet.',
      },
    },
    {
      title: 'Late click',
      tag: 'case',
      heading: 'Case: the click that missed its window',
      eli5: 'The tunnel letter arrives after the 10:00 sheet was already closed and sent. The total is now one letter short.',
      body: [
        'The tunnel click, stamped 10:00:58, arrives at 10:03:10. The watermark passed 10:01 two minutes ago and the 10:00 window has already fired.',
        'In this job about 0.2% of clicks arrive behind the watermark. For a large advertiser that is real money in misreported spend.',
      ],
      keyIdea: 'Some events always arrive after the watermark, and at scale a small share is a lot of money.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '0.2%' },
      metricTones: { late: 'bad' },
      scene: {
        nodes: [
          { ...tunnel, status: 'active', badge: 'arrives 10:03:10' },
          { ...kafka },
          { ...counter, status: 'hot', badge: 'window 10:00 closed' },
          { ...dash, status: 'hot', badge: 'ad 311 @ 10:00: 812' },
        ],
        links: [link('tunnel', 'kafka', { style: 'dashed' }), link('kafka', 'counter'), link('counter', 'dash')],
        flows: [{ path: ['tunnel', 'kafka', 'counter'], tone: 'error', label: 'late: 10:00:58', duration: 2.4 }],
        panel: {
          title: 'What 0.2% means',
          icon: 'Receipt',
          rows: [
            { text: 'Clicks per minute', value: '3,000,000' },
            { text: 'Arrive late', value: '~6,000', tone: 'warn' },
            { text: 'Misreported spend', value: 'wrong budget decision', tone: 'bad' },
          ],
        },
        caption: 'The window closed two minutes ago',
      },
    },
    {
      title: 'Drop and count',
      tag: 'tradeoff',
      heading: 'Option 1: drop late events, but count them',
      eli5: 'The clerk puts a late letter in a "too late" box and keeps a tally of how many are in it. Nobody is surprised later because everybody can see how many there were.',
      body: [
        'The simplest choice is to **drop** events behind the watermark. It is cheap and the dashboard stays simple.',
        'Always count the drops in a metric, or the loss is invisible. Late data silently dropped shows up later as an invoice that does not match the advertiser\'s own logs.',
      ],
      keyIdea: 'Dropping late data is fine if you measure how much you drop.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '0.2% dropped' },
      metricTones: { late: 'warn' },
      scene: {
        nodes: [
          { ...kafka },
          { ...counter, status: 'active', badge: '10:00 closed' },
          { id: 'late', kind: 'block', at: at(3.4, 7.5), label: 'late counter', sub: 'metric: late_clicks', icon: 'Activity', tint: 'amber', status: 'active', chips: [{ text: 'late: 6,012', tone: 'warn' }] },
          { ...dash, status: 'ok' },
        ],
        links: [link('kafka', 'counter'), link('counter', 'dash'), link('counter', 'late', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'counter'], tone: 'event', count: 3, duration: 1.4 },
          { path: ['counter', 'late'], tone: 'error', label: 'dropped', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Drop policy',
          icon: 'List',
          rows: [
            { text: 'Late event', value: 'not counted', tone: 'warn' },
            { text: 'Late events counted', value: 'in a metric', tone: 'good' },
            { text: 'Complexity', value: 'lowest', tone: 'good' },
          ],
        },
        caption: 'Dropped, but not forgotten',
      },
    },
    {
      title: 'Allowed lateness',
      tag: 'concept',
      heading: 'Option 2: keep the window open and send a correction',
      eli5: 'The clerk keeps the 10:00 sheet in a drawer for ten more minutes. If a late letter turns up she adds it and sends a corrected total.',
      body: [
        '**Allowed lateness** keeps a window\'s state for an extra period, say 10 minutes. When a late event lands, the job re-fires the window with a corrected count.',
        'The sink must accept an update to a row it already has, and the state for old windows costs memory (about 0.5 GB more here).',
      ],
      keyIdea: 'Allowed lateness turns a lost click into a correction, if the sink can take updates and you can pay for the extra state.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2% corrected' },
      metricTones: { late: 'good' },
      scene: {
        nodes: [
          { ...tunnel, status: 'active', badge: 'arrives 10:03:10' },
          { ...kafka },
          { ...counter, status: 'active', badge: '10:00 kept 10 min' },
          { ...dash, status: 'active', badge: 'ad 311: 812 → 813' },
        ],
        links: [link('tunnel', 'kafka', { style: 'dashed' }), link('kafka', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['tunnel', 'kafka', 'counter'], tone: 'event', label: 'late: 10:00:58', duration: 2.4 },
          { path: ['counter', 'dash'], tone: 'data', label: 'corrected count', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Window 10:00, ad 311',
          icon: 'Clock',
          rows: [
            { text: '10:01:10', value: 'fires 812' },
            { text: '10:03:10', value: 'late click, fires 813', tone: 'good' },
            { text: '10:11:00', value: 'state dropped', tone: 'muted' },
          ],
        },
        caption: 'Allowed lateness turns a lost click into a correction',
      },
    },
    {
      title: 'Reconcile',
      tag: 'tradeoff',
      heading: 'Option 3: let a nightly batch settle the numbers',
      eli5: 'The clerk\'s running tally is used for the notice board. At night the accountant recounts every letter, including the very late ones, and that count is the one that gets billed.',
      body: [
        'A nightly batch over all raw events, late or not, produces the billing numbers. The stream serves the fast, nearly right dashboard.',
        'Most real systems combine the options: drop what is very late, correct for 10 minutes, and reconcile every night.',
      ],
      keyIdea: 'Choose the late-data policy on purpose, and pair a fast stream with a slow exact check.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2% reconciled' },
      scene: {
        nodes: [
          { ...kafka, badge: 'all raw events' },
          { ...counter, status: 'active' },
          { id: 'batch', kind: 'block', at: at(3.4, 6), label: 'nightly batch', sub: 'includes late events', icon: 'Timer', tint: 'amber', status: 'active' },
          { ...dash, status: 'ok', badge: 'fast, nearly right' },
          { id: 'bill', kind: 'warehouse', at: at(6.8, 6), label: 'billing table', sub: 'exact', status: 'ok' },
        ],
        links: [link('kafka', 'counter'), link('counter', 'dash'), link('kafka', 'batch', { style: 'dashed' }), link('batch', 'bill')],
        flows: [
          { path: ['kafka', 'counter', 'dash'], tone: 'event', count: 3, duration: 1.8 },
          { path: ['kafka', 'batch', 'bill'], tone: 'data', label: 'recount all', duration: 2.4, delay: 1 },
        ],
        panel: {
          title: 'Late-data policy',
          icon: 'Table',
          rows: [
            { text: 'Past 10 min late', value: 'drop and count' },
            { text: 'Within 10 min', value: 'correct the row' },
            { text: 'Every night', value: 'batch settles billing', tone: 'good' },
          ],
        },
        caption: 'The stream is fast, the batch is exact',
      },
    },
    {
      title: 'Delivery',
      tag: 'concept',
      heading: 'At-most-once, at-least-once, exactly-once',
      eli5: 'A letter can be delivered at most one time (maybe lost), at least one time (maybe twice) or exactly once. Posties promise the last one by keeping careful records and redoing anything unsure.',
      body: [
        '**At-most-once** never repeats work but can lose events. **At-least-once** never loses events but can repeat them. **Exactly-once** is the one engines advertise.',
        'What they promise is exactly-once **state**: after a crash and restore, each event affects the operators\' state once. Events after the last checkpoint are still read and processed again.',
      ],
      keyIdea: 'Exactly-once means state is right after recovery. It does not mean each event is processed only once.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          { ...kafka, badge: 'replayable' },
          { ...counter, status: 'active', badge: 'state: exactly-once' },
          { ...ckpt, status: 'active', badge: 'checkpoint 4,112' },
        ],
        links: [link('kafka', 'counter'), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'counter'], tone: 'event', count: 4, duration: 1.6 },
          { path: ['counter', 'ckpt'], tone: 'data', label: 'state + offsets', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Three guarantees',
          icon: 'Table',
          rows: [
            { text: 'At-most-once', value: 'may lose', tone: 'bad' },
            { text: 'At-least-once', value: 'may repeat', tone: 'warn' },
            { text: 'Exactly-once state', value: 'right after restore', tone: 'good' },
          ],
        },
        caption: 'State is exact. Processing may repeat.',
      },
    },
    {
      title: 'Replayed output',
      tag: 'case',
      heading: 'Case: a crash writes the same result twice',
      eli5: 'The clerk posts the 10:00 total on the notice board, then her desk burns. She is rewound and counts again, and posts the total a second time. The board now shows it twice.',
      body: [
        'If the job wrote a window result to the sink and then crashed, the replay writes it again. State was rewound but the sink was not.',
        'A sink that adds `clicks + n` to a row now double counts. The output is a separate problem from the state.',
      ],
      keyIdea: 'Checkpoints rewind the job, not the outside world, so output written before a crash is written again.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      metricTones: { state: 'warn' },
      scene: {
        nodes: [
          { ...kafka, badge: 'rewind to checkpoint' },
          { ...counter, status: 'down', badge: 'crashed, restoring' },
          { ...dash, status: 'hot', badge: 'ad 311: 812 + 812' },
          { ...ckpt, status: 'active', badge: 'checkpoint 4,112' },
        ],
        links: [link('kafka', 'counter'), link('counter', 'dash', { label: 'append clicks + n', labelTone: 'warn' }), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['ckpt', 'counter'], tone: 'data', label: 'restore state', duration: 1.4 },
          { path: ['kafka', 'counter'], tone: 'event', label: 'replay 30 s', count: 3, duration: 1.8, delay: 1.5 },
          { path: ['counter', 'dash'], tone: 'error', label: '812 again', duration: 1.2, delay: 3.5 },
        ],
        panel: {
          title: 'The row for ad 311, 10:00',
          icon: 'Receipt',
          rows: [
            { text: 'First write', value: '812' },
            { text: 'Replay writes again', value: '+ 812', tone: 'bad' },
            { text: 'Row shows', value: '1,624', tone: 'bad' },
          ],
        },
        caption: 'The sink has no way to know it was a repeat',
      },
    },
    {
      title: 'Transactional sink',
      tag: 'concept',
      heading: 'Fix 1: commit output with the checkpoint',
      eli5: 'The clerk writes the total on a card and keeps it in her pocket. She only pins it to the board once her sheet is safely in the safe. If her desk burns first, nothing was posted.',
      body: [
        'A **transactional sink** writes inside a transaction that commits only when the checkpoint completes, as Kafka transactions allow.',
        'Replays then never leave a duplicate behind. The catch is that readers see results only after each checkpoint, so output lags by up to 30 seconds.',
      ],
      keyIdea: 'A transactional sink commits output with the checkpoint, so it is exactly-once at the cost of delay.',
      metrics: { lag: '15 s → up to 45 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          { ...counter, status: 'active', badge: 'pre-commit' },
          { id: 'sink', kind: 'block', at: at(6.8, 0), label: 'transactional sink', sub: 'open transaction', icon: 'Receipt', tint: 'teal', status: 'active' },
          { ...ckpt, status: 'active', badge: 'checkpoint 4,113 done' },
        ],
        links: [link('counter', 'sink', { label: 'write in transaction' }), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['counter', 'sink'], tone: 'data', label: 'results, not visible yet', duration: 1.6 },
          { path: ['counter', 'ckpt'], tone: 'data', label: 'checkpoint', duration: 1.6, delay: 1.8 },
          { path: ['ckpt', 'sink'], tone: 'handshake', label: 'commit', duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'Two-step output',
          icon: 'Receipt',
          rows: [
            { text: '1. Write', value: 'inside a transaction' },
            { text: '2. Checkpoint completes', value: 'commit', tone: 'good' },
            { text: 'Crash before commit', value: 'transaction aborts', tone: 'good' },
            { text: 'Cost', value: 'up to 30 s later', tone: 'warn' },
          ],
        },
        caption: 'Visible only after the checkpoint is safe',
      },
    },
    {
      title: 'Idempotent sink',
      tag: 'concept',
      heading: 'Fix 2: write results so a repeat changes nothing',
      eli5: 'Instead of adding to the notice board, the clerk writes "ad 311 at 10:00: 812" on a fixed spot. Writing the same line twice leaves the same board.',
      body: [
        'An **idempotent sink** writes each result keyed by `(ad_id, window_start)` as an upsert. A repeat overwrites the same row with the same value.',
        'It also handles late corrections, since a later count simply replaces the earlier one. No transaction delay, but the sink must support upserts.',
      ],
      keyIdea: 'Set the value, never add to it, and replays and corrections both become harmless.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          { ...counter, status: 'active' },
          { ...dash, status: 'ok', badge: 'upsert, same row' },
          { ...ckpt, status: 'dim' },
        ],
        links: [link('counter', 'dash', { label: 'upsert by key' }), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['counter', 'dash'], tone: 'data', label: '812', duration: 1.4 },
          { path: ['counter', 'dash'], tone: 'data', label: '812 again', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Row (311, 10:00)',
          icon: 'Receipt',
          rows: [
            { text: 'First write', value: '812' },
            { text: 'Replay writes', value: '812' },
            { text: 'Late correction', value: '813' },
            { text: 'Row shows', value: '813, one row', tone: 'good' },
          ],
        },
        caption: 'The sink absorbs the repeat',
      },
      code: {
        language: 'sql',
        title: 'An idempotent sink: replays overwrite, never add',
        source: `CREATE TABLE ad_clicks_per_minute (
  ad_id        bigint      NOT NULL,
  window_start timestamptz NOT NULL,
  clicks       bigint      NOT NULL,
  PRIMARY KEY (ad_id, window_start)
);

-- The job writes each window result like this. Writing it twice,
-- or writing a later correction, leaves one correct row.
INSERT INTO ad_clicks_per_minute (ad_id, window_start, clicks)
VALUES (:ad_id, :window_start, :clicks)
ON CONFLICT (ad_id, window_start)
DO UPDATE SET clicks = EXCLUDED.clicks;   -- set the value, never clicks + 1`,
        highlight: [5, 12, 13],
      },
      quiz: {
        question: 'A Flink job with exactly-once checkpoints crashes and restarts. The sink appends `clicks + n` to a database row for every window result. What can go wrong?',
        options: [
          'Nothing, exactly-once covers the whole pipeline',
          'Results written after the last checkpoint are written again on replay, so some counts are added twice',
          'Late events are lost',
          'The watermark resets to zero',
        ],
        answer: 1,
        explain: 'Exactly-once applies to the job\'s state. Output already written before the crash is produced again during replay. An upsert keyed by (ad_id, window_start) or a transactional sink makes the repeat harmless.',
      },
    },
    {
      title: 'Source, dedup',
      tag: 'concept',
      heading: 'Two more conditions: replayable input, deduped input',
      eli5: 'The belt must be winding back to replay. And if a sender posts the same letter twice, the clerk sees two letters. A number on each letter lets her spot the copy.',
      body: [
        'The source must be replayable from an offset, which Kafka is. A source that forgets events cannot be rewound.',
        'Duplicates created before the job, such as a phone retrying a click upload, are new events to the engine. Remove them with a `click_id` and a dedup step that remembers recent ids.',
      ],
      keyIdea: 'End-to-end exactly-once needs a replayable source, a safe sink, and dedup of upstream retries.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '3.1 GB', late: '0.2%' },
      scene: {
        nodes: [
          { ...phones, chips: [{ text: 'retry: click 8f2a', tone: 'warn' }] },
          { ...kafka, badge: 'replayable' },
          { ...filter, status: 'active', label: 'dedup', sub: 'by click_id', icon: 'Copy', chips: ['seen 8f2a: drop'] },
          { ...counter, status: 'ok' },
        ],
        links: [link('phones', 'kafka', { label: 'retries on bad signal', labelTone: 'warn' }), link('kafka', 'filter'), link('filter', 'counter')],
        flows: [
          { path: ['phones', 'kafka', 'filter'], tone: 'event', label: 'click 8f2a', count: 2, duration: 2 },
          { path: ['filter', 'counter'], tone: 'event', label: 'once', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Exactly-once end to end',
          icon: 'List',
          rows: [
            { text: 'Replayable source', value: 'Kafka offsets', tone: 'good' },
            { text: 'Safe sink', value: 'transaction or upsert', tone: 'good' },
            { text: 'Upstream duplicates', value: 'dedup by click_id', tone: 'warn' },
          ],
        },
        caption: 'The duplicate is dropped before it is counted',
      },
    },
    {
      title: 'Enrichment join',
      tag: 'concept',
      heading: 'Joining a stream with a table',
      eli5: 'Each letter says only "ad 311". The clerk keeps a phone book on her desk that says ad 311 belongs to Pizza Place, and writes the name on the tally.',
      body: [
        'A click has only an `ad_id`, but the dashboard wants the advertiser name and campaign. A **stream-table join** looks up each click in a table of ads.',
        'The table is loaded into local state and kept fresh by a change stream from the ads database, so there is no remote call per click.',
      ],
      keyIdea: 'Enrich events by joining them with a table held in local state and updated from a change stream.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '3.3 GB', late: '0.2%' },
      scene: {
        nodes: [
          { ...kafka },
          { id: 'enrich', kind: 'block', at: at(3.4, 0), label: 'enrich', sub: 'local copy of ads', icon: 'Layers', tint: 'teal', status: 'active', chips: ['ad 311 → Pizza Place'] },
          { id: 'ads', kind: 'db', at: at(3.4, 6), label: 'ads DB', sub: 'campaigns' },
          { ...dash, status: 'ok' },
        ],
        links: [link('kafka', 'enrich'), link('ads', 'enrich', { label: 'change stream', style: 'dashed' }), link('enrich', 'dash')],
        flows: [
          { path: ['ads', 'enrich'], tone: 'data', label: 'ad 311 renamed', duration: 1.6 },
          { path: ['kafka', 'enrich'], tone: 'event', label: 'click, ad 311', count: 2, duration: 1.6, delay: 1.4 },
          { path: ['enrich', 'dash'], tone: 'data', label: 'Pizza Place +1', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'One lookup',
          icon: 'Table',
          rows: [
            { text: 'Click', value: 'ad_id 311' },
            { text: 'Local table', value: '311 = Pizza Place' },
            { text: 'Output', value: 'Pizza Place, 311' },
          ],
          footer: { text: 'No call to the ads DB per click', tone: 'good' },
        },
        caption: 'The lookup table lives next to the operator',
      },
    },
    {
      title: 'Stream join',
      tag: 'concept',
      heading: 'Joining two streams within a time window',
      eli5: 'A letter of complaint must be matched with the order it is about. The clerk keeps unmatched orders for a while, and puts each complaint beside its order when it turns up.',
      body: [
        'To match each click with the **impression** (the ad being shown) that caused it, join two streams on `impression_id`. Each side is buffered in state until its partner arrives.',
        'Buffering forever would fill memory, so the join has a time bound: match only clicks within 30 minutes of the impression, and expire state after that.',
      ],
      keyIdea: 'A stream-stream join holds both sides in state, so bound it by time or the state never stops growing.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '4.6 GB', late: '0.2%' },
      metricTones: { state: 'warn' },
      scene: {
        nodes: [
          { id: 'imps', kind: 'queue', at: at(-3.4, -6), label: 'impressions', sub: 'ad was shown' },
          { ...kafka, at: at(-3.4, 6), label: 'clicks topic', sub: 'ad was clicked' },
          { id: 'join', kind: 'block', at: at(3.4, 0), label: 'join', sub: 'impression_id, 30 min', icon: 'Share2', tint: 'violet', status: 'active', badge: 'buffers both sides' },
          { ...dash, status: 'ok', badge: 'click-through rate' },
        ],
        links: [link('imps', 'join'), link('kafka', 'join'), link('join', 'dash')],
        flows: [
          { path: ['imps', 'join'], tone: 'event', label: 'imp 77', duration: 1.6 },
          { path: ['kafka', 'join'], tone: 'event', label: 'click on imp 77', duration: 1.6, delay: 1.2 },
          { path: ['join', 'dash'], tone: 'data', label: 'matched', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Join state',
          icon: 'Database',
          rows: [
            { text: 'Impressions kept', value: '30 min' },
            { text: 'Unmatched, past 30 min', value: 'expired', tone: 'good' },
            { text: 'No time bound', value: 'state grows forever', tone: 'bad' },
          ],
        },
        caption: 'Match within a window, forget after it',
      },
    },
    {
      title: 'Reprocessing',
      tag: 'concept',
      heading: 'Fixing a bug by replaying history',
      eli5: 'The clerk finds she counted wrongly all week. The post office keeps the old letters, so she rewinds the belt and counts the week again with the fixed rule.',
      body: [
        'A job has a bug, or you add a new metric. Kafka keeps events for days, so start a new job version from an old offset, or from a saved **savepoint** (a checkpoint you keep on purpose), and let it catch up.',
        'Event-time windows make the replay give the same answers as live. Running one stream job for fresh data and for history is the **kappa architecture**, an alternative to keeping a separate batch path.',
      ],
      keyIdea: 'Keep the raw events and the replay path, and a bug fix is a rerun, not a rebuild.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          { ...kafka, badge: 'retention: 7 days' },
          { id: 'v1', kind: 'block', at: at(3.4, -4.5), label: 'job v1', sub: 'live, has a bug', icon: 'Workflow', tint: 'gray', status: 'dim' },
          { id: 'v2', kind: 'block', at: at(3.4, 4.5), label: 'job v2', sub: 'fixed, from offset', icon: 'Workflow', tint: 'violet', status: 'active', load: 80, badge: 'catching up' },
          { id: 'newdb', kind: 'db', at: at(6.8, 4.5), label: 'new table', sub: 'corrected counts' },
        ],
        links: [link('kafka', 'v1', { style: 'faint' }), link('kafka', 'v2', { label: 'replay 3 days' }), link('v2', 'newdb')],
        flows: [
          { path: ['kafka', 'v2'], tone: 'event', label: 'old events', count: 5, duration: 1.4 },
          { path: ['v2', 'newdb'], tone: 'data', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Replay steps',
          icon: 'Repeat',
          rows: [
            { text: '1. Start v2', value: 'from offset or savepoint' },
            { text: '2. Catch up', value: 'faster than live' },
            { text: '3. Swap', value: 'point readers at v2', tone: 'good' },
          ],
        },
        caption: 'The log is the source of truth, so history can be replayed',
      },
    },
    {
      title: 'Flink',
      tag: 'tradeoff',
      heading: 'Apache Flink: a cluster that runs your jobs',
      eli5: 'A big post office has its own sorting hall with many clerks, for mail from everywhere. It handles huge volumes, but someone has to run the building.',
      body: [
        '**Apache Flink** reads from and writes to many systems (Kafka, files, databases, change streams), handles very large state, and has strong event-time support, windows and SQL.',
        'The cost is a platform to run: a cluster, deployments, checkpoint storage and upgrades. It suits a shared streaming platform and jobs like this one.',
      ],
      keyIdea: 'Flink is a platform for many sources, large state and rich event-time features, at the price of running a cluster.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          { ...kafka },
          { id: 'flink', kind: 'block', at: at(0, 0), label: 'Flink cluster', sub: 'job manager + workers', icon: 'Boxes', tint: 'violet', status: 'active' },
          { ...ckpt, at: at(0, 6) },
          { ...dash, at: at(3.4, 0), sub: 'DB, files, Kafka' },
        ],
        links: [link('kafka', 'flink'), link('flink', 'dash'), link('flink', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'flink'], tone: 'event', count: 3, duration: 1.4 },
          { path: ['flink', 'dash'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['flink', 'ckpt'], tone: 'data', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Flink at a glance',
          icon: 'Boxes',
          rows: [
            { text: 'Sources and sinks', value: 'many', tone: 'good' },
            { text: 'State size', value: 'very large', tone: 'good' },
            { text: 'Event time, SQL', value: 'strong', tone: 'good' },
            { text: 'To operate', value: 'a cluster', tone: 'warn' },
          ],
        },
        caption: 'A shared platform for streaming jobs',
      },
    },
    {
      title: 'Kafka Streams',
      tag: 'tradeoff',
      heading: 'Kafka Streams: a library inside your service',
      eli5: 'A small shop has one clerk at the counter who sorts only the shop\'s own mail. No sorting hall to run, but she only handles mail from this one belt.',
      body: [
        '**Kafka Streams** is a Java library inside your own service. It reads from Kafka and writes to Kafka, keeps state in local RocksDB backed up to Kafka changelog topics, and scales by running more copies of your app, up to the partition count.',
        'Exactly-once comes from Kafka transactions. It suits one team building a Kafka-in, Kafka-out service without a cluster to operate.',
      ],
      keyIdea: 'Kafka Streams is a library for Kafka-to-Kafka services. Scaling is more copies of your app.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          { ...kafka, badge: 'in' },
          { id: 'app', kind: 'block', at: at(0, 0), label: 'your service', sub: 'Kafka Streams library', icon: 'Server', tint: 'blue', status: 'active', badge: 'x4 copies' },
          { id: 'out', kind: 'queue', at: at(3.4, 0), label: 'results topic', sub: 'Kafka', status: 'ok' },
          { id: 'chlog', kind: 'queue', at: at(0, 6), label: 'changelog topic', sub: 'state backup' },
        ],
        links: [link('kafka', 'app'), link('app', 'out'), link('app', 'chlog', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'app'], tone: 'event', count: 3, duration: 1.4 },
          { path: ['app', 'out'], tone: 'event', duration: 1.2, delay: 1.5 },
          { path: ['app', 'chlog'], tone: 'data', label: 'state changes', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Kafka Streams at a glance',
          icon: 'Package',
          rows: [
            { text: 'Runs as', value: 'a library in your app', tone: 'good' },
            { text: 'Reads and writes', value: 'Kafka only', tone: 'warn' },
            { text: 'State backup', value: 'changelog topic' },
            { text: 'Scale limit', value: 'partition count' },
          ],
        },
        caption: 'The same operators, embedded in an app',
      },
    },
    {
      title: 'Other engines',
      tag: 'tradeoff',
      heading: 'Spark, ksqlDB and when you need none of them',
      eli5: 'Some post offices sort in small batches every few seconds instead of letter by letter. Before hiring any clerk at all, ask whether counting once a minute at the front desk is good enough.',
      body: [
        '**Spark Structured Streaming** works in small micro-batches and fits teams already on Spark. **ksqlDB** and **Materialize** offer SQL on top of streams, and **Apache Beam** is an abstraction that runs on several engines.',
        'Before choosing any of them, ask whether you need a stream at all. If numbers a few minutes old are fine, a query every minute against a database may be the simplest correct answer.',
      ],
      keyIdea: 'Neither engine beats a simple scheduled query when minutes of lag are fine.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          { id: 'spark', kind: 'block', at: at(-3.4, -6), label: 'Spark streaming', sub: 'micro-batches', icon: 'Layers', tint: 'amber' },
          { id: 'ksql', kind: 'block', at: at(3.4, -6), label: 'ksqlDB', sub: 'SQL on Kafka', icon: 'Database', tint: 'teal' },
          { id: 'query', kind: 'block', at: at(0, 3), label: 'plain query', sub: 'every minute', icon: 'Timer', tint: 'green', status: 'ok', badge: 'often enough' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Which tool',
          icon: 'Table',
          rows: [
            { text: 'Already on Spark', value: 'Structured Streaming' },
            { text: 'SQL people, Kafka data', value: 'ksqlDB, Materialize' },
            { text: 'Run on any engine', value: 'Beam' },
            { text: 'Minutes of lag is fine', value: 'a scheduled query', tone: 'good' },
          ],
        },
        caption: 'The simplest tool that meets the freshness need',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Fresh answers from data that never stops',
      eli5: 'Clerks tally by postmark, close a sheet when the "all in" card passes, fix totals for late letters, post totals on a fixed spot, and rewind the belt to recount when they find a mistake.',
      body: [
        'Window on event time, close windows with watermarks, and decide on purpose what happens to late events: drop and count, correct, or reconcile.',
        'Exactly-once covers state. For outputs, add a transactional or idempotent sink and dedup upstream retries. Join with tables in local state, bound stream joins by time, and replay Kafka to fix bugs. Choose Flink for a platform, Kafka Streams for a Kafka-native service, and a plain query when minutes of lag are fine.',
      ],
      keyIdea: 'Stream processing trades the certainty of a finished batch for fresh answers, and watermarks, state and idempotent sinks win most of that certainty back.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      metricTones: { lag: 'good', rate: 'good' },
      scene: {
        nodes: [phones, kafka, { ...filter, status: 'ok' }, { ...counter, status: 'ok' }, { ...dash, status: 'ok' }],
        links: pipe,
        flows: [
          { path: ['phones', 'kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 2 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1.2, delay: 2.1 },
        ],
        panel: {
          title: 'Part 2 in one table',
          icon: 'List',
          rows: [
            { text: 'Time', value: 'event time + watermark' },
            { text: 'Late data', value: 'drop, correct, reconcile' },
            { text: 'Output', value: 'transaction or upsert' },
            { text: 'Fix a bug', value: 'replay from Kafka' },
          ],
        },
        caption: 'A fresh count you can trust',
      },
      quiz: {
        question: 'A window\'s watermark delay is raised from 10 seconds to 2 minutes. What changes?',
        options: [
          'Fewer events are late, and every window result arrives about 2 minutes later',
          'More events are late, but results are faster',
          'Nothing, the delay only affects checkpoints',
          'Windows start counting by processing time',
        ],
        answer: 0,
        explain: 'The watermark trails the largest event time by the delay. A longer delay waits for more stragglers, so fewer events miss their window, and every result fires later by the same amount.',
      },
    },
  ],
};
