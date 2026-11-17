import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const phones: SceneNode = { id: 'phones', kind: 'phone', at: at(-6.8, 0), label: 'phones', sub: '50,000 clicks/s' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: at(-3.4, 0), label: 'clicks topic', sub: 'Kafka, 32 partitions' };
const filter: SceneNode = { id: 'filter', kind: 'block', at: at(0, 0), label: 'filter', sub: 'drop bots, dupes', icon: 'Shield', tint: 'blue' };
const counter: SceneNode = { id: 'counter', kind: 'block', at: at(3.4, 0), label: 'count per ad', sub: 'keyBy ad_id', icon: 'Hash', tint: 'violet' };
const dash: SceneNode = { id: 'dash', kind: 'db', at: at(6.8, 0), label: 'dashboard DB', sub: 'per-minute counts' };
const ckpt: SceneNode = { id: 'ckpt', kind: 'storage', at: at(3.4, 6), label: 'checkpoints', sub: 'S3, every 30 s' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const pipe: SceneLink[] = [link('phones', 'kafka'), link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash')];

export const streamProcessing: Lesson = {
  id: 'stream-processing',
  title: 'Stream processing (part 1)',
  tagline: 'Count ad clicks per minute as they happen: operators, keys, state, checkpoints and windows.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Batch and stream processing, and when results need to be fresh',
    'A streaming job as a graph of operators, partitioned by key',
    'Hot keys, pre-aggregation and back pressure',
    'Stateful aggregation with local state and checkpoints',
    'Tumbling, sliding and session windows',
  ],
  metrics: [
    { key: 'lag', label: 'Dashboard lag', icon: 'Timer' },
    { key: 'rate', label: 'Clicks/s', icon: 'Zap' },
    { key: 'state', label: 'Job state', icon: 'Database' },
    { key: 'ckpt', label: 'Checkpoint', icon: 'Copy' },
  ],
  steps: [
    {
      title: 'Hourly batch',
      tag: 'problem',
      heading: 'Advertisers see their spend an hour late',
      eli5: 'The post office counts letters only once an hour, by emptying the whole sack on a table. By the time the count is done, it is already old.',
      body: [
        'An ad platform charges per click and shows advertisers their spend. Click events land in hourly files on S3. A batch job starts five minutes after each hour and takes about 20 minutes to count the 180 million clicks in it.',
        'The dashboard is between **25 and 85 minutes** behind.',
      ],
      keyIdea: 'A batch job only answers after the data has stopped coming, so its answer is always old.',
      metrics: { lag: '25 to 85 min', rate: '50,000/s', state: '-', ckpt: '-' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          phones,
          { ...kafka, sub: 'Kafka' },
          { id: 'files', kind: 'storage', at: at(0, 0), label: 'hourly files', sub: 'S3', status: 'active', badge: '10:00 to 11:00' },
          { id: 'batch', kind: 'block', at: at(3.4, 0), label: 'batch job', sub: 'runs at :05', icon: 'Timer', tint: 'amber', status: 'hot', load: 92, badge: 'running 20 min' },
          { ...dash, status: 'hot', badge: 'data from 10:00' },
        ],
        links: [link('phones', 'kafka'), link('kafka', 'files', { label: 'dump hourly' }), link('files', 'batch'), link('batch', 'dash')],
        flows: [
          { path: ['phones', 'kafka', 'files'], tone: 'event', count: 6, duration: 1.6 },
          { path: ['files', 'batch'], tone: 'data', label: 'read 180 M rows', duration: 2.2, delay: 1.8 },
          { path: ['batch', 'dash'], tone: 'data', label: 'hour totals', duration: 1.2, delay: 4.2 },
        ],
        panel: {
          title: 'One hourly cycle',
          icon: 'Clock',
          rows: [
            { text: 'Clicks per hourly file', value: '180 M' },
            { text: 'Batch starts', value: ':05 past' },
            { text: 'Batch runtime', value: '20 min', tone: 'warn' },
            { text: 'Dashboard age', value: '25 to 85 min', tone: 'bad' },
          ],
        },
        caption: 'The count for 10:00 arrives after 11:00',
      },
    },
    {
      title: 'Overspend',
      tag: 'case',
      heading: 'Case: the budget that ran out at 10:07',
      eli5: 'A family has a $1,000 allowance at the sweet shop. The shop only counts spending once an hour, so the family keeps taking sweets long after the money is gone.',
      body: [
        'A campaign has a $1,000 daily budget and spends it by 10:07. The ad server only learns this at 11:25, when the count for the 10:00 hour lands.',
        'For **78 minutes** the ad keeps showing, and the clicks are ones the advertiser will not pay for. The platform eats the overspend.',
      ],
      keyIdea: 'Lag has a price: every minute of delay is a minute of free clicks.',
      metrics: { lag: '25 to 85 min', rate: '50,000/s', state: '-', ckpt: '-' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          phones,
          { id: 'adserver', kind: 'block', at: at(0, 0), label: 'ad server', sub: 'picks ads to show', icon: 'Server', tint: 'amber', status: 'hot', chips: [{ text: 'ad 311 still served', tone: 'bad' }] },
          { ...dash, status: 'hot', badge: 'spend: 10:00 data' },
        ],
        links: [link('phones', 'adserver', { label: 'clicks on ad 311' }), link('dash', 'adserver', { label: 'budget news at 11:25', labelTone: 'warn' })],
        flows: [
          { path: ['phones', 'adserver'], tone: 'event', label: 'click, free', count: 4, duration: 1.6 },
          { path: ['dash', 'adserver'], tone: 'error', label: 'budget gone', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Campaign 311, budget $1,000',
          icon: 'Receipt',
          rows: [
            { text: 'Budget spent', value: '10:07', tone: 'warn' },
            { text: 'Ad server learns', value: '11:25', tone: 'bad' },
            { text: 'Unpaid clicks', value: '78 min', tone: 'bad' },
          ],
          footer: { text: 'The platform pays the difference', tone: 'bad' },
        },
        caption: 'Nobody told the ad server to stop',
      },
    },
    {
      title: 'Every minute?',
      tag: 'tradeoff',
      heading: 'Running the batch every minute does not fix it',
      eli5: 'Emptying the sack every minute instead of every hour means the clerk spends the whole day carrying the sack to the table and back, and still starts each count from scratch.',
      body: [
        'Each run reads files, starts up and shuts down. That fixed cost stays the same while the data per run shrinks from 180 million rows to about 3 million. Sixty runs an hour cost far more than one.',
        'Batch was built for big, finished inputs. For fresh answers you want a job that never stops and just keeps its numbers up to date.',
      ],
      keyIdea: 'Shrinking the batch shrinks the data but not the overhead. Freshness needs a different model.',
      metrics: { lag: 'minutes', rate: '50,000/s', state: '-', ckpt: '-' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          kafka,
          { id: 'files', kind: 'storage', at: at(0, 0), label: 'tiny files', sub: 'S3, 60 per hour' },
          { id: 'batch', kind: 'block', at: at(3.4, 0), label: 'batch job', sub: 'every minute', icon: 'Timer', tint: 'amber', status: 'hot', load: 95, badge: 'start, read, stop' },
          dash,
        ],
        links: [link('kafka', 'files'), link('files', 'batch'), link('batch', 'dash')],
        flows: [
          { path: ['kafka', 'files'], tone: 'event', count: 3, duration: 1.2 },
          { path: ['files', 'batch'], tone: 'data', label: 'reread 3 M rows', duration: 1.4, delay: 1.3 },
          { path: ['batch', 'dash'], tone: 'data', duration: 1, delay: 2.9 },
        ],
        panel: {
          title: 'Hourly vs every minute',
          icon: 'Table',
          rows: [
            { text: 'Runs per hour', value: '1 → 60', tone: 'warn' },
            { text: 'Rows per run', value: '180 M → 3 M' },
            { text: 'Startup and reread', value: 'paid 60 times', tone: 'bad' },
          ],
        },
        caption: 'The overhead repeats on every run',
      },
    },
    {
      title: 'Unbounded',
      tag: 'concept',
      heading: 'Bounded data stops, unbounded data does not',
      eli5: 'A sack of letters has an end: you empty it and you are done. A conveyor belt never ends, so the clerk keeps a running tally instead of waiting for the last letter.',
      body: [
        '**Batch processing** runs over a bounded input, such as a day of files or a table snapshot. It reads everything, computes, writes a result and stops.',
        '**Stream processing** runs over an unbounded input that never ends. The job runs forever, reads each event moments after it is produced, and keeps its results up to date.',
      ],
      keyIdea: 'A batch job answers a question about data that has stopped. A stream job keeps answering while data keeps coming.',
      metrics: { lag: '-', rate: '50,000/s', state: '-', ckpt: '-' },
      scene: {
        nodes: [
          { id: 'files', kind: 'storage', at: at(-3.4, -4.4), label: 'a day of files', sub: 'bounded: has an end', status: 'dim' },
          { ...kafka, at: at(-3.4, 4.4), sub: 'unbounded: no end', status: 'active' },
          { id: 'job', kind: 'block', at: at(3.4, 0), label: 'the job', sub: 'reads, computes', icon: 'Workflow', tint: 'violet', status: 'active' },
        ],
        links: [link('files', 'job', { style: 'dashed' }), link('kafka', 'job')],
        flows: [
          { path: ['files', 'job'], tone: 'data', label: 'done', duration: 1.6 },
          { path: ['kafka', 'job'], tone: 'event', count: 4, duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Two shapes of input',
          icon: 'Table',
          rows: [
            { text: 'Batch', value: 'ends, then answers' },
            { text: 'Stream', value: 'never ends', tone: 'good' },
            { text: 'Stream result', value: 'always updating', tone: 'good' },
          ],
        },
        caption: 'One input ends, the other keeps flowing',
      },
    },
    {
      title: 'Stream job',
      tag: 'concept',
      heading: 'Process each event as it arrives',
      eli5: 'Instead of emptying the sack once an hour, a clerk stands at the belt and adds one to a tally as each letter goes past. The tally is always nearly up to date.',
      body: [
        'The clicks are already in a Kafka topic. A stream job reads it directly and updates the count for each ad within seconds. The dashboard lag drops from about an hour to **about 15 seconds**.',
        'Most of those 15 seconds are spent waiting for slow events, as we will see in part 2.',
      ],
      keyIdea: 'Reading the topic directly turns an hourly answer into one that is seconds old.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', ckpt: '-' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [phones, kafka, { ...filter, status: 'active' }, { ...counter, status: 'active', badge: 'ad 311: 4,820' }, { ...dash, status: 'ok', badge: '15 s old' }],
        links: pipe,
        flows: [
          { path: ['phones', 'kafka'], tone: 'event', count: 4, duration: 1 },
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 4, duration: 1.6, delay: 0.8 },
          { path: ['counter', 'dash'], tone: 'data', label: 'ad 311 +1', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Dashboard lag',
          icon: 'Timer',
          rows: [
            { text: 'Hourly batch', value: '25 to 85 min', tone: 'bad' },
            { text: 'Stream job', value: '~15 s', tone: 'good' },
          ],
        },
        caption: 'Every click updates a running count',
      },
    },
    {
      title: 'Keep batch',
      tag: 'tradeoff',
      heading: 'Batch is still useful next to a stream',
      eli5: 'The clerk\'s running tally is quick but sometimes a little off. At night, the accountant recounts every letter slowly and exactly, and that count is the one the bills use.',
      body: [
        'Batch is simpler, easy to rerun over a whole day, and fine for reports where an hour is enough. Many teams run both: a stream for fresh numbers and a nightly batch over the raw events as the billing record.',
        'This two-path design is called the **lambda architecture**. Its cost is two code paths that must agree.',
      ],
      keyIdea: 'Use the stream for speed and a batch over raw events for the number you bill from.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', ckpt: '-' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          kafka,
          { id: 'stream', kind: 'block', at: at(1.7, -3.6), label: 'stream job', sub: 'fast, nearly right', icon: 'Workflow', tint: 'violet', status: 'active' },
          { id: 'batch', kind: 'block', at: at(1.7, 3.6), label: 'nightly batch', sub: 'slow, exact', icon: 'Timer', tint: 'amber' },
          { id: 'dash', kind: 'db', at: at(6.8, -3.6), label: 'dashboard', sub: 'live counts', status: 'ok' },
          { id: 'bill', kind: 'warehouse', at: at(6.8, 3.6), label: 'billing table', sub: 'the record', status: 'ok' },
        ],
        links: [link('kafka', 'stream'), link('kafka', 'batch'), link('stream', 'dash'), link('batch', 'bill')],
        flows: [
          { path: ['kafka', 'stream', 'dash'], tone: 'event', count: 3, duration: 1.8 },
          { path: ['kafka', 'batch', 'bill'], tone: 'data', label: 'all raw events', duration: 2.4, delay: 1 },
        ],
        panel: {
          title: 'Two paths, two jobs',
          icon: 'Split',
          rows: [
            { text: 'Stream', value: 'seconds, nearly right', tone: 'good' },
            { text: 'Batch', value: 'a day, exact', tone: 'warn' },
          ],
          footer: { text: 'The stream is checked against the batch', tone: 'muted' },
        },
        caption: 'Fast path for the screen, exact path for the invoice',
      },
    },
    {
      title: 'Operators',
      tag: 'concept',
      heading: 'A job is a graph of operators',
      eli5: 'The belt passes several clerks. The first reads the letters off the belt. The next throws out junk mail. Another counts. The last one posts the tally on the notice board.',
      body: [
        'A stream job is a graph of **operators**: a source that reads Kafka, a filter that drops bot clicks, an aggregation that counts, and a sink that writes results.',
        'Each operator runs as many parallel instances, here 32, one per Kafka partition.',
      ],
      keyIdea: 'A job is a graph of operators, and each operator runs as many parallel copies.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', ckpt: '-' },
      scene: {
        nodes: [
          phones,
          { ...kafka, badge: 'source' },
          { ...filter, status: 'active', badge: 'x32' },
          { ...counter, status: 'active', badge: 'x32' },
          { ...dash, badge: 'sink' },
        ],
        links: pipe,
        flows: [
          { path: ['phones', 'kafka'], tone: 'event', count: 3, duration: 1 },
          { path: ['kafka', 'filter'], tone: 'event', count: 4, duration: 1, delay: 0.8 },
          { path: ['filter', 'counter'], tone: 'event', count: 3, duration: 1.2, delay: 1.8 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1, delay: 3 },
        ],
        panel: {
          title: 'The four operators',
          icon: 'Workflow',
          rows: [
            { text: 'Source', value: 'reads Kafka' },
            { text: 'Filter', value: 'drops bot clicks' },
            { text: 'Aggregate', value: 'counts per ad' },
            { text: 'Sink', value: 'writes to the DB' },
          ],
          footer: { text: '32 copies of each, one per partition', tone: 'muted' },
        },
        caption: 'Source, filter, count, sink',
      },
    },
    {
      title: 'keyBy',
      tag: 'concept',
      heading: 'keyBy sends every click for an ad to one place',
      eli5: 'Each clerk looks after certain streets. The sorting belt sends every letter for Oak Street to the Oak Street clerk, so one clerk holds the whole Oak Street tally.',
      body: [
        'Counting per ad needs every click for an ad to reach the same instance. A **keyBy** on `ad_id` hashes the key and sends each event over the network to the instance that owns it.',
        'This **shuffle** is the most expensive part of most jobs, so filter and shrink events before it.',
      ],
      keyIdea: 'Partitioning by key puts all events for one key on one instance, which makes per-key counts possible.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', ckpt: '-' },
      scene: {
        nodes: [
          { ...kafka, badge: 'any partition' },
          { ...filter, status: 'active' },
          { ...counter, status: 'active', chips: ['ad 311 → here'] },
          dash,
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter', { label: 'shuffle by ad_id', labelTone: 'warn' }), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'filter'], tone: 'event', count: 4, duration: 1 },
          { path: ['filter', 'counter'], tone: 'event', label: 'ad 311', count: 3, duration: 1.4, delay: 1 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Same key, same instance',
          icon: 'Hash',
          rows: [
            { text: 'ad 311 from partition 3', value: 'instance A' },
            { text: 'ad 312 from partition 3', value: 'instance B' },
            { text: 'ad 311 from partition 9', value: 'instance A', tone: 'good' },
          ],
          footer: { text: 'The shuffle crosses the network', tone: 'warn' },
        },
        caption: 'The key decides where each click goes',
      },
    },
    {
      title: 'Stateless, stateful',
      tag: 'concept',
      heading: 'Stateless operators forget, stateful ones remember',
      eli5: 'Throwing out junk mail needs no memory: each letter is judged alone. Keeping a tally needs a sheet of paper that remembers every letter so far.',
      body: [
        'The filter is **stateless**: each event is handled alone, so it is easy to scale and restart. The counter is **stateful**: its answer depends on everything it has seen.',
        'Stateful operators are where the hard problems live: where the state sits, how it survives a crash, and how it is sized.',
      ],
      keyIdea: 'Stateless operators are easy to scale. Every hard streaming problem comes from state.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', ckpt: '-' },
      scene: {
        nodes: [
          kafka,
          { ...filter, status: 'ok', chips: [{ text: 'bot click: drop', tone: 'warn' }, 'human click: pass'] },
          { ...counter, status: 'active', chips: ['ad 311: 4,820', 'ad 312: 977'] },
          dash,
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'filter'], tone: 'event', count: 4, duration: 1 },
          { path: ['filter', 'counter'], tone: 'event', count: 3, duration: 1.2, delay: 1 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'What each one remembers',
          icon: 'Table',
          rows: [
            { text: 'Filter', value: 'nothing', tone: 'good' },
            { text: 'Counter', value: 'every ad count', tone: 'warn' },
            { text: 'After a crash: filter', value: 'restart', tone: 'good' },
            { text: 'After a crash: counter', value: 'needs its counts back', tone: 'bad' },
          ],
        },
        caption: 'Only the counter has something to lose',
      },
      quiz: {
        question: 'A job counts clicks per ad on 32 parallel instances. Why does it need a keyBy on ad_id before the counter?',
        options: [
          'To sort the events by time',
          'So every click for one ad reaches the same instance, which holds that ad\'s count',
          'To make the filter run faster',
          'To spread clicks perfectly evenly over the instances',
        ],
        answer: 1,
        explain: 'The count for an ad lives on one instance, so all its clicks must go there. KeyBy does not spread load evenly: a popular ad makes one instance busier, which is the next problem.',
      },
    },
    {
      title: 'Hot key',
      tag: 'case',
      heading: 'Case: one viral ad overloads one instance',
      eli5: 'One street suddenly gets most of the town\'s mail. Its clerk is buried while the other clerks stand around with nothing to do.',
      body: [
        '50,000 clicks a second over 32 instances is about 1,560 each. Then ad 311 goes viral and gets 10,000 clicks a second. All of them go to the single instance that owns ad 311.',
        'That instance runs at 98% load while the others idle. This is **key skew**, and adding more instances does not help.',
      ],
      keyIdea: 'KeyBy ties one key to one instance, so a single popular key can saturate it however many instances you add.',
      metrics: { lag: '~15 s → 40 s', rate: '50,000/s', state: '-', ckpt: '-' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...filter, at: at(-3.4, 0) },
          { id: 'c1', kind: 'block', at: at(2, -7), label: 'counter 1', sub: 'owns ad 311', icon: 'Hash', tint: 'violet', status: 'hot', load: 98, chips: [{ text: 'ad 311: 10,000/s', tone: 'bad' }] },
          { id: 'c2', kind: 'block', at: at(2, 0), label: 'counter 2', sub: 'other ads', icon: 'Hash', tint: 'violet', load: 20 },
          { id: 'c3', kind: 'block', at: at(2, 7), label: 'counter 3', sub: 'other ads', icon: 'Hash', tint: 'violet', load: 18 },
        ],
        links: [link('filter', 'c1', { label: 'ad 311', labelTone: 'warn' }), link('filter', 'c2'), link('filter', 'c3')],
        flows: [
          { path: ['filter', 'c1'], tone: 'event', count: 6, duration: 1.4 },
          { path: ['filter', 'c2'], tone: 'event', count: 1, duration: 1.8, delay: 0.4 },
          { path: ['filter', 'c3'], tone: 'event', count: 1, duration: 1.8, delay: 0.8 },
        ],
        panel: {
          title: 'Load per instance',
          icon: 'Gauge',
          rows: [
            { text: 'Average instance', value: '~1,560/s' },
            { text: 'Instance owning ad 311', value: '10,000+/s', tone: 'bad' },
          ],
          footer: { text: 'More instances do not split one key', tone: 'bad' },
        },
        caption: 'One key, one instance, one bottleneck',
      },
    },
    {
      title: 'Pre-aggregate',
      tag: 'concept',
      heading: 'Count locally first, then merge',
      eli5: 'Before sending letters to the Oak Street clerk, each sorting clerk makes a note: "I saw 312 Oak Street letters this second." One note replaces 312 letters.',
      body: [
        'Add a **pre-aggregation** step before the shuffle. Each of the 32 instances counts its own clicks for ad 311 for one second, then sends one partial count. The final counter gets 32 small rows a second instead of 10,000 clicks.',
        'The other fix is **salting**: add a random 0 to 7 to the key so a hot ad spreads over 8 instances, then merge those 8 counts.',
      ],
      keyIdea: 'Combine events before the shuffle so a hot key sends a few partial counts instead of thousands of events.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', ckpt: '-' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          filter,
          { id: 'pre', kind: 'block', at: at(3.4, 0), label: 'pre-count', sub: 'per instance, 1 s', icon: 'Layers', tint: 'teal', status: 'active', load: 35, chips: ['312 clicks → 1 row'] },
          { id: 'final', kind: 'block', at: at(6.8, 0), label: 'merge counts', sub: 'per ad', icon: 'Hash', tint: 'violet', status: 'ok', load: 30, chips: ['32 rows/s for ad 311'] },
        ],
        links: [link('filter', 'pre'), link('pre', 'final', { label: 'shuffle by ad_id' })],
        flows: [
          { path: ['filter', 'pre'], tone: 'event', count: 6, duration: 1.2 },
          { path: ['pre', 'final'], tone: 'data', label: 'ad 311: +312', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Ad 311, one second',
          icon: 'Table',
          rows: [
            { text: 'Clicks in', value: '10,000' },
            { text: 'Partial counts out', value: '32', tone: 'good' },
            { text: 'Final counter load', value: '98% → 30%', tone: 'good' },
          ],
        },
        caption: 'Combine first, shuffle second',
      },
    },
    {
      title: 'Back pressure',
      tag: 'concept',
      heading: 'When the sink slows down, the whole job slows',
      eli5: 'The notice board clerk gets slow. The counting clerk\'s out-tray fills up, so she stops taking letters, and soon the letters wait on the belt instead of piling up on her desk.',
      body: [
        'The dashboard DB slows to 20,000 writes a second. The counter emits an updated count for every click, so the sink is asked for about 50,000 writes a second. Buffers fill from the sink backward. Each operator waits for room, and the source reads Kafka more slowly. This is **back pressure**.',
        'Nothing crashes. Kafka keeps the unread events, and the lag grows by 30,000 events a second, or 1.8 million a minute, until you fix the sink or add capacity.',
      ],
      keyIdea: 'Back pressure pushes slowness upstream to the durable log, so a slow sink shows up as growing lag, not lost data.',
      metrics: { lag: '15 s → growing', rate: '20,000/s read', state: '-', ckpt: '-' },
      metricTones: { lag: 'bad', rate: 'warn' },
      scene: {
        nodes: [
          { ...kafka, status: 'hot', badge: 'unread: +1.8 M/min' },
          { ...filter, status: 'dim' },
          { ...counter, status: 'hot', load: 88 },
          { ...dash, status: 'hot', badge: '20,000 writes/s' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash', { label: 'buffers full', labelTone: 'warn' })],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 2, duration: 2.4 },
          { path: ['counter', 'dash'], tone: 'data', label: 'slow', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Where the slowness goes',
          icon: 'Activity',
          rows: [
            { text: 'Sink capacity', value: '20,000/s', tone: 'bad' },
            { text: 'Updates wanted', value: '50,000/s' },
            { text: 'Backlog growth', value: '30,000/s', tone: 'bad' },
          ],
          footer: { text: 'Kafka holds the backlog, nothing is lost', tone: 'muted' },
        },
        caption: 'Slow sink, slow source, growing lag',
      },
    },
    {
      title: 'Local state',
      tag: 'concept',
      heading: 'Where the running counts live',
      eli5: 'Each clerk keeps her tally sheet on her own desk, so she never walks to the office to add one. Writing to a far-away office for every letter would take all day.',
      body: [
        'With 2 million active ads, the counter holds millions of small counters, about 2 GB in total. A remote database write for every click would mean 50,000 network writes a second.',
        'Instead each instance keeps **local state** for the keys it owns, in memory or in an embedded store such as RocksDB on local disk. An update is a local read and write.',
      ],
      keyIdea: 'Keep state next to the operator that updates it, so each click costs a local write, not a network call.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2 GB', ckpt: '-' },
      scene: {
        nodes: [
          kafka,
          { ...filter, status: 'dim' },
          { ...counter, status: 'active', badge: 'RocksDB, 2 GB' },
          { id: 'remote', kind: 'db', at: at(3.4, 6), label: 'remote DB', sub: 'the slow way', status: 'dim' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'remote', { style: 'dashed', label: '50,000 writes/s', labelTone: 'warn' })],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 4, duration: 1.8 },
        ],
        panel: {
          title: 'Counting state',
          icon: 'Database',
          rows: [
            { text: 'Active ads', value: '2 million' },
            { text: 'State size', value: '~2 GB' },
            { text: 'Local update', value: 'memory or disk', tone: 'good' },
            { text: 'Remote update', value: 'network per click', tone: 'bad' },
          ],
        },
        caption: 'The count sits on the worker that owns the ad',
      },
    },
    {
      title: 'Checkpoints',
      tag: 'concept',
      heading: 'A checkpoint saves state and position together',
      eli5: 'Every half minute each clerk photocopies her tally sheet and writes down which letter she was on, then puts both in a safe. If her desk burns, nothing is lost.',
      body: [
        'Local state dies with the machine, so the job takes a **checkpoint** every 30 seconds. It is a snapshot of every operator\'s state plus the Kafka offsets read so far, written to S3.',
        'State and offsets are saved as one unit. That pairing is what makes a restart correct.',
      ],
      keyIdea: 'Save state and input offsets together, so they always describe the same moment.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2 GB', ckpt: 'every 30 s' },
      scene: {
        nodes: [
          { ...kafka, badge: 'offsets saved' },
          { ...filter, status: 'dim' },
          { ...counter, status: 'active', badge: 'RocksDB, 2 GB' },
          { ...ckpt, status: 'active', badge: 'checkpoint 4,112' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 4, duration: 1.6 },
          { path: ['counter', 'ckpt'], tone: 'data', label: 'state + offsets', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Checkpoint 4,112 holds',
          icon: 'Copy',
          rows: [
            { text: 'Counter state', value: '2 GB' },
            { text: 'Kafka offsets', value: '32 partitions' },
            { text: 'Stored in', value: 'S3' },
            { text: 'Taken every', value: '30 s' },
          ],
        },
        caption: 'State stays on the worker. A copy goes to S3 every 30 seconds.',
      },
    },
    {
      title: 'Barriers',
      tag: 'concept',
      heading: 'How a consistent snapshot is taken while running',
      eli5: 'Instead of stopping the belt, the post office sends a red card down it. Each clerk copies her sheet the moment the card reaches her, then passes it on. The belt never stops.',
      body: [
        'Instead of pausing the job, it injects a **barrier** marker at the sources. Each operator snapshots its state when the barrier reaches it, then forwards it.',
        'An operator with several inputs, like the counter after the shuffle, waits for the barrier on all of them (**alignment**) before it snapshots. Under back pressure that wait grows.',
        'When every operator has reported, the checkpoint is complete. Events before the barrier are in the snapshot, events after it are not.',
      ],
      keyIdea: 'Barriers flow with the events, so each operator snapshots at one consistent point without stopping the job.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2 GB', ckpt: '4,112 in flight' },
      scene: {
        nodes: [
          { ...kafka, badge: 'saves offsets' },
          { ...filter, status: 'active', badge: 'forwards' },
          { ...counter, status: 'active', badge: 'snapshots state' },
          { ...ckpt, badge: 'checkpoint 4,112' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 2 },
          { path: ['kafka', 'filter', 'counter'], tone: 'handshake', label: 'barrier 4,112', duration: 2, delay: 1 },
          { path: ['counter', 'ckpt'], tone: 'data', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Barrier 4,112 passes',
          icon: 'Route',
          rows: [
            { text: 'Source', value: 'saves offsets' },
            { text: 'Filter', value: 'nothing to save' },
            { text: 'Counter', value: 'waits for all inputs, then writes' },
            { text: 'Snapshot size', value: 'incremental RocksDB, not a full 2 GB' },
            { text: 'All three done', value: 'checkpoint complete', tone: 'good' },
          ],
        },
        caption: 'A marker travels with the events',
      },
    },
    {
      title: 'Restore',
      tag: 'concept',
      heading: 'After a crash, rewind state and input together',
      eli5: 'The desk burns. The clerk takes the photocopy from the safe and the belt is wound back to the letter she was on. She recounts a few letters, and her tally ends up right.',
      body: [
        'When an instance crashes, the job restores all operators from the last checkpoint and rewinds Kafka to the saved offsets.',
        'Up to 30 seconds of clicks are read again. Because state was rewound to the same point, each one is counted once.',
      ],
      keyIdea: 'State and offsets rewind together, so replayed events do not double count.',
      metrics: { lag: '~15 s → 45 s', rate: '50,000/s', state: '2 GB', ckpt: 'restored 4,112' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          { ...kafka, status: 'active', badge: 'rewind to 4,112' },
          { ...filter, status: 'dim' },
          { ...counter, status: 'down', badge: 'crashed, restoring' },
          { ...ckpt, status: 'active', badge: 'checkpoint 4,112' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['ckpt', 'counter'], tone: 'data', label: 'restore state', duration: 1.4 },
          { path: ['kafka', 'filter', 'counter'], tone: 'event', label: 'replay 30 s', count: 3, duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Recovery steps',
          icon: 'Repeat',
          rows: [
            { text: '1. Restore state', value: 'from S3' },
            { text: '2. Rewind Kafka', value: 'to saved offsets' },
            { text: '3. Replay', value: 'up to 30 s of clicks' },
            { text: 'Result', value: 'each click counted once', tone: 'good' },
          ],
        },
        caption: 'State and input rewind to the same moment',
      },
      quiz: {
        question: 'Why does a checkpoint store the Kafka offsets together with the operator state?',
        options: [
          'It makes Kafka faster',
          'After a restore, the state and the input position match, so replayed events are counted once',
          'So the sink can skip writes',
          'To make the state smaller',
        ],
        answer: 1,
        explain: 'If state came from 10:00:30 but Kafka resumed from 10:00:50, clicks would be lost. If it resumed from 10:00:10, they would be counted twice. One snapshot of both keeps them aligned.',
      },
    },
    {
      title: 'Rescaling',
      tag: 'concept',
      heading: 'Changing parallelism and capping state',
      eli5: 'The post office hires more clerks. Every tally sheet is cut into labeled strips, so the strips can be handed to the new clerks without losing any count. Old customers who stopped writing get their strips thrown away after a while.',
      body: [
        'To change the parallelism of a stateful job, take a **savepoint**, then start the job with the new parallelism. State is split into **key groups**, and on restore the groups are redistributed across the new instances. The source cannot go past the Kafka partition count, 32 here.',
        'State also needs a cap. Keys that go idle, such as ads with no clicks for days, stay in state forever unless you set a **state TTL** that expires them.',
      ],
      keyIdea: 'Rescale through a savepoint, since state moves as key groups. Add a TTL so idle keys do not grow state without limit.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2 GB', ckpt: 'savepoint taken' },
      scene: {
        nodes: [
          { ...kafka, badge: '32 partitions, max source parallelism' },
          { ...counter, label: 'counter x8', sub: 'was x4', status: 'active', badge: 'key groups moved' },
          { ...ckpt, label: 'savepoint', sub: 'state in S3', status: 'active' },
        ],
        links: [link('kafka', 'counter'), link('counter', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['counter', 'ckpt'], tone: 'data', label: 'savepoint', duration: 1.4 },
          { path: ['ckpt', 'counter'], tone: 'data', label: 'key groups', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Rescale steps',
          icon: 'Layers',
          rows: [
            { text: '1. Savepoint', value: 'stop with state saved' },
            { text: '2. Restart', value: 'new parallelism' },
            { text: 'Source limit', value: '32 partitions', tone: 'warn' },
            { text: 'Idle keys', value: 'expire with state TTL', tone: 'good' },
          ],
        },
        caption: 'State moves in key groups, so the job can grow or shrink',
      },
    },
    {
      title: 'Tumbling',
      tag: 'concept',
      heading: 'Tumbling windows: fixed size, no overlap',
      eli5: 'The clerk starts a fresh tally sheet at the start of every minute and closes the old one. Each letter goes on exactly one sheet.',
      body: [
        'A count over an endless stream needs edges. A **window** groups events by time. A **tumbling** window has a fixed size and no overlap: clicks per ad for 10:00 to 10:01, then 10:01 to 10:02.',
        'Each click lands in exactly one window. The per-minute result drives the dashboard and the spend cutoff. The invoice comes from the nightly batch. Windows here use the time the click happened (event time), defined with a watermark in part 2.',
      ],
      keyIdea: 'Tumbling windows give one total per period, so each event is counted once.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', ckpt: 'every 30 s' },
      scene: {
        nodes: [
          kafka,
          { ...filter, status: 'dim' },
          { ...counter, label: 'windowed count', sub: 'tumbling, 1 min', status: 'active', badge: '10:00 to 10:01 closing' },
          { ...dash, status: 'ok', badge: 'ad 311 @ 10:00 = 812' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 5, duration: 1.6 },
          { path: ['counter', 'dash'], tone: 'data', label: 'window result', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Ad 311, one click each',
          icon: 'Clock',
          code: '10:00 to 10:01   812\n10:01 to 10:02   790\n10:02 to 10:03   845\n\neach click is in 1 window',
          footer: { text: 'One result per window when it closes', tone: 'muted' },
        },
        caption: 'One result per ad per window',
      },
    },
    {
      title: 'Sliding',
      tag: 'concept',
      heading: 'Sliding windows: a moving view of recent data',
      eli5: 'The clerk keeps a sheet for "the last five minutes" and refreshes it every minute. A letter shows up on five different sheets before it falls off the oldest.',
      body: [
        'A **sliding** (hopping) window has a size and a smaller step: the last 5 minutes, updated every minute. Windows overlap, so each click counts in 5 of them.',
        'It suits "trending ads right now". The cost is state that grows with the overlap: 5 windows open per ad instead of 1.',
      ],
      keyIdea: 'Use a sliding window for recent trends. Overlap means each event is counted in several windows.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', ckpt: 'every 30 s' },
      scene: {
        nodes: [
          kafka,
          { ...filter, status: 'dim' },
          { ...counter, label: 'windowed count', sub: 'sliding, 5 min by 1', status: 'active', badge: '5 windows open' },
          { ...dash, status: 'ok', badge: 'trending: ad 311' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 5, duration: 1.6 },
          { path: ['counter', 'dash'], tone: 'data', label: 'last 5 min', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'A click at 10:03:20',
          icon: 'Layers',
          code: '09:59 to 10:04   counted\n10:00 to 10:05   counted\n10:01 to 10:06   counted\n10:02 to 10:07   counted\n10:03 to 10:08   counted',
          footer: { text: 'In 5 windows at once', tone: 'warn' },
        },
        caption: 'Each click is counted in five overlapping windows',
      },
      quiz: {
        question: 'A sliding window is 5 minutes long and advances every 1 minute. In how many windows is a single click counted?',
        options: ['1', '2', '5', '60'],
        answer: 2,
        explain: 'Windows start every minute and each lasts 5 minutes, so any moment is covered by 5 overlapping windows. That also means 5 times the state of a tumbling window.',
      },
    },
    {
      title: 'Session',
      tag: 'concept',
      heading: 'Session windows: closed by silence',
      eli5: 'The clerk keeps one sheet per customer and closes it when that customer has sent no letters for half an hour. A busy customer gets a long sheet, a quiet one a short sheet.',
      body: [
        'A **session** window has no fixed size. It is per key and closes after a gap with no events, say 30 minutes without a click from that user. It fits "what did a user do in one visit".',
        'Session windows can merge when a late event bridges two sessions, which makes them the most expensive kind.',
      ],
      keyIdea: 'Sessions are per key and end on inactivity. Pick the window from the question: totals, trends or bursts.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', ckpt: 'every 30 s' },
      scene: {
        nodes: [
          kafka,
          { ...filter, status: 'dim' },
          { ...counter, label: 'session count', sub: 'gap 30 min, per user', status: 'active', badge: 'user 9: 3 clicks' },
          { ...dash, status: 'ok', badge: 'session closed' },
        ],
        links: [link('kafka', 'filter'), link('filter', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 1.8 },
          { path: ['counter', 'dash'], tone: 'data', label: 'session: 3 clicks', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'User 9, 30 minute gap',
          icon: 'Users',
          rows: [
            { text: '10:00, 10:12, 10:25', value: 'session 1' },
            { text: '30 min of silence', value: 'session 1 closes', tone: 'warn' },
            { text: '11:10', value: 'session 2 starts' },
          ],
        },
        caption: 'The window length follows the user',
      },
    },
    {
      title: 'Windows in SQL',
      tag: 'concept',
      heading: 'The three windows in Flink SQL',
      eli5: 'Each kind of tally sheet has its own instruction card. The card says how long a sheet lasts and when to start the next one, and the clerk just follows it.',
      body: [
        'The same stream, three questions, three window functions. Pick `TUMBLE` for totals, `HOP` for trends and `SESSION` for bursts per key.',
        'The query names the window size and the time column. The engine keeps the state and fires each result.',
      ],
      keyIdea: 'Each window kind is one function call in the query. The choice belongs to the question.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', ckpt: 'every 30 s' },
      scene: {
        nodes: [
          { ...kafka, badge: 'table: clicks' },
          { id: 'sql', kind: 'block', at: at(0, 0), label: 'SQL query', sub: 'TUMBLE, HOP, SESSION', icon: 'Code', tint: 'blue', status: 'active' },
          { ...counter, id: 'counter', label: 'windowed count', status: 'active' },
          dash,
        ],
        links: [link('kafka', 'sql'), link('sql', 'counter'), link('counter', 'dash')],
        flows: [
          { path: ['kafka', 'sql', 'counter'], tone: 'event', count: 3, duration: 1.6 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'Which window for what',
          icon: 'Table',
          rows: [
            { text: 'TUMBLE', value: 'per-minute totals' },
            { text: 'HOP', value: 'trending now' },
            { text: 'SESSION', value: 'a visit' },
          ],
        },
        caption: 'One function per window kind',
      },
      code: {
        language: 'sql',
        title: 'The three windows in Flink SQL',
        source: `-- Tumbling: clicks per ad per minute (spend and dashboard)
-- clicks and its event_time watermark are defined in part 2
SELECT ad_id, window_start, COUNT(*) AS clicks
FROM TABLE(TUMBLE(TABLE clicks, DESCRIPTOR(event_time), INTERVAL '1' MINUTE))
GROUP BY ad_id, window_start, window_end;

-- Sliding: last 5 minutes, refreshed every minute (trending)
SELECT ad_id, window_end, COUNT(*) AS clicks
FROM TABLE(HOP(TABLE clicks, DESCRIPTOR(event_time),
               INTERVAL '1' MINUTE, INTERVAL '5' MINUTE))
GROUP BY ad_id, window_start, window_end;

-- Session: one window per user, closed by 30 minutes of silence
SELECT user_id, window_start, window_end, COUNT(*) AS clicks
FROM TABLE(SESSION(TABLE clicks PARTITION BY user_id,
                   DESCRIPTOR(event_time), INTERVAL '30' MINUTE))
GROUP BY user_id, window_start, window_end;`,
        highlight: [3, 8, 9, 14, 15],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1: a job that counts as the clicks arrive',
      eli5: 'Clerks at the belt throw out junk, pass each letter to its street\'s clerk, keep tallies on their own desks, copy them into a safe, and close a sheet every minute. Part 2 is about late letters.',
      body: [
        'A stream job is a graph of operators reading an unbounded source. KeyBy sends each key to one instance, pre-aggregation tames hot keys, and back pressure pushes slowness to Kafka.',
        'Local state is checkpointed with the input offsets, and windows (tumbling, sliding, session) turn an endless stream into finished answers. Part 2 covers event time, watermarks, late data, exactly-once, joins and engines.',
      ],
      keyIdea: 'Operators, keys, local state and checkpoints give a job that counts fast and survives crashes. Windows give it edges.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', ckpt: 'every 30 s' },
      metricTones: { lag: 'good', rate: 'good' },
      scene: {
        nodes: [phones, kafka, { ...filter, status: 'ok' }, { ...counter, status: 'ok' }, { ...dash, status: 'ok' }],
        links: pipe,
        flows: [
          { path: ['phones', 'kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 2 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1.2, delay: 2.1 },
        ],
        panel: {
          title: 'Part 1 in one table',
          icon: 'List',
          rows: [
            { text: 'Partition', value: 'keyBy, pre-aggregate' },
            { text: 'Remember', value: 'local state' },
            { text: 'Survive', value: 'checkpoints + offsets' },
            { text: 'Group', value: 'windows' },
          ],
        },
        caption: 'Fresh counts, with part 2 still to come',
      },
      quiz: {
        question: 'Ad 311 gets 10,000 clicks a second and its counter instance sits at 98% load while the others idle. What helps most?',
        options: [
          'Add 32 more counter instances',
          'Pre-aggregate before the shuffle so the final counter gets partial counts',
          'Take checkpoints more often',
          'Switch from tumbling to session windows',
        ],
        answer: 1,
        explain: 'More instances do not help because one key still lives on one instance. Pre-aggregating (or salting the key) shrinks 10,000 events a second to a few dozen partial counts.',
      },
    },
  ],
};
