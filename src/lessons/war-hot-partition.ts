import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const viewers: SceneNode = { id: 'viewers', kind: 'phone', at: at(-3.8, -3.8), label: 'viewers', sub: 'send hearts' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3.8), label: 'reactions API', sub: 'write path', icon: 'Zap', tint: 'violet' };
const p1: SceneNode = { id: 'p1', kind: 'shard', at: at(-3.6, 3.8), label: 'partition A', sub: '1000 WCU max' };
const p2: SceneNode = { id: 'p2', kind: 'shard', at: at(0, 3.8), label: 'partition B', sub: '1000 WCU max' };
const p3: SceneNode = { id: 'p3', kind: 'shard', at: at(3.6, 3.8), label: 'partition C', sub: '1000 WCU max' };
const mon: SceneNode = { id: 'mon', kind: 'monitor', at: at(-3.8, -3.8), label: 'dashboards', sub: 'CloudWatch' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const fan = (extra: Partial<SceneLink> = {}) => [link('api', 'p1', extra), link('api', 'p2', extra), link('api', 'p3', extra)];

export const warHotPartition: Lesson = {
  id: 'war-hot-partition',
  title: 'Hot partition',
  tagline: 'A livestream goes viral, one key melts one partition, and 80% of the table sits idle. An incident, start to finish.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'Why a partitioned table throttles at 20% of its provisioned capacity',
    'Why raising capacity does nothing for a single hot key',
    'How to find the hot key from metrics and logs',
    'Write sharding: spread one key over N keys, then sum on read',
    'Prevention: virality scores, on-demand mode, load tests with one hot key',
  ],
  metrics: [
    { key: 'err', label: 'Error rate', icon: 'Bug' },
    { key: 'p99', label: 'p99 write', icon: 'Timer' },
    { key: 'sat', label: 'Hot partition', icon: 'Gauge' },
    { key: 'wcu', label: 'Table WCU used', icon: 'Activity' },
  ],
  steps: [
    {
      title: 'Normal state',
      tag: 'problem',
      heading: 'A healthy table with a flaw nobody can see',
      eli5: 'A school lunch hall has many serving **counters**. Kids spread out, every line is short, and the lunch ladies are happy.',
      body: [
        'A live video app stores hearts and emoji in a `live-reactions` table. The partition key is `streamId`, the sort key is a timestamp plus user id. Capacity is **50,000 WCU** (write units per second).',
        'On a normal evening the table uses about 6,000 WCU, error rate is near zero and p99 write latency is 12 ms. Nothing looks wrong.',
      ],
      keyIdea: 'Every dashboard is green, because the flaw only shows when one key gets very busy.',
      metrics: { err: '0.01%', p99: '12 ms', sat: '8%', wcu: '6k / 50k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          viewers,
          api,
          { ...p1, load: 8, status: 'ok' },
          { ...p2, load: 9, status: 'ok' },
          { ...p3, load: 7, status: 'ok' },
        ],
        links: [link('viewers', 'api'), ...fan()],
        flows: [
          { path: ['viewers', 'api', 'p1'], tone: 'request', duration: 1.4 },
          { path: ['viewers', 'api', 'p2'], tone: 'request', duration: 1.4, delay: 0.5 },
          { path: ['viewers', 'api', 'p3'], tone: 'request', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'live-reactions, 20:30 UTC',
          icon: 'Table',
          rows: [
            { text: 'Partition key', value: 'streamId' },
            { text: 'Sort key', value: 'timestamp#userId' },
            { text: 'Provisioned', value: '50,000 WCU' },
            { text: 'Consumed', value: '6,000 WCU', tone: 'good' },
          ],
          footer: { text: 'Thousands of streams, small each', tone: 'good' },
        },
        caption: 'Writes spread over thousands of streams',
      },
    },
    {
      title: 'Partitions',
      tag: 'concept',
      heading: 'Capacity belongs to partitions, not to the table',
      eli5: 'The lunch hall has 50 **counters** and each one serves at most 1,000 kids a minute. Adding more kids to the hall does not make one counter faster.',
      body: [
        'The store hashes the partition key to pick a **physical partition**. Each partition serves a bounded rate, about **1,000 WCU** and 3,000 RCU historically.',
        'The 50k you buy is the sum over partitions. It only helps if the traffic is spread across them. One key can never use more than its one partition delivers.',
      ],
      keyIdea: 'Total capacity is a sum over partitions. Per-key capacity is what one partition can serve.',
      metrics: { err: '0.01%', p99: '12 ms', sat: '8%', wcu: '6k / 50k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { ...api, label: 'hash(streamId)', sub: 'picks a partition', icon: 'Hash', tint: 'blue' },
          { ...p1, chips: ['sx_01a4', 'sx_77c0'], load: 8, status: 'ok' },
          { ...p2, chips: ['sx_9f22', 'sx_31de'], load: 9, status: 'ok' },
          { ...p3, chips: ['sx_5b10', 'sx_c2f8'], load: 7, status: 'ok' },
        ],
        links: fan(),
        flows: [
          { path: ['api', 'p1'], tone: 'request', label: 'sx_01a4', duration: 1.2 },
          { path: ['api', 'p2'], tone: 'request', label: 'sx_9f22', duration: 1.2, delay: 0.4 },
          { path: ['api', 'p3'], tone: 'request', label: 'sx_5b10', duration: 1.2, delay: 0.8 },
        ],
        panel: {
          title: 'Where a key lives',
          icon: 'Split',
          rows: [
            { text: 'One key maps to', value: '1 partition' },
            { text: 'One partition serves', value: '~1,000 WCU', tone: 'warn' },
            { text: 'Table total', value: 'sum of partitions' },
          ],
          footer: { text: 'The same key always lands on the same partition', tone: 'muted' },
        },
        caption: 'A key is pinned to one partition',
      },
    },
    {
      title: 'Trigger',
      tag: 'case',
      heading: '20:45 UTC: a celebrity goes live',
      eli5: 'A famous singer visits the school and everyone wants the same ice cream, which only **counter B** sells.',
      body: [
        'A creator with a huge following starts a stream, `sx_9f22`. Viewers pile in and each one taps hearts. Viewer count passes **5 million** within minutes.',
        'Every heart is a write with partition key `sx_9f22`. All of them hash to the same place.',
      ],
      keyIdea: 'The trigger is a normal product event. Nothing was deployed and nothing broke.',
      metrics: { err: '0.02%', p99: '15 ms', sat: '45%', wcu: '9k / 50k' },
      metricTones: { err: 'good', p99: 'good', sat: 'warn', wcu: 'good' },
      scene: {
        nodes: [
          { ...viewers, chips: [{ text: '5M viewers', tone: 'warn' }] },
          api,
          { ...p1, status: 'dim', load: 6 },
          { ...p2, status: 'active', load: 45, chips: [{ text: 'sx_9f22', tone: 'warn' }] },
          { ...p3, status: 'dim', load: 5 },
        ],
        links: [link('viewers', 'api'), ...fan()],
        flows: [{ path: ['viewers', 'api', 'p2'], tone: 'request', label: 'heart, sx_9f22', count: 4, duration: 1.6 }],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: '20:45', value: 'creator goes live' },
            { text: '20:50', value: 'viewers pass 5M', tone: 'warn' },
            { text: 'Partition key', value: 'sx_9f22 for all' },
          ],
          footer: { text: 'Partition B is climbing, the others are idle', tone: 'warn' },
        },
        caption: 'One stream, one key, one partition',
      },
    },
    {
      title: 'Throttling',
      tag: 'case',
      heading: '20:58: the first throttles, and retries hide them',
      eli5: '**Counter B** runs out of scoops. The server says "wait a moment" and the kids try again a second later, which keeps the line long.',
      body: [
        'Partition B passes its limit and the store starts rejecting writes with `ProvisionedThroughputExceededException`.',
        'The SDK retries with backoff, so most users still see their heart go through, just slower. That absorbs the first minutes of the incident and delays the page.',
      ],
      keyIdea: 'Retries mask early throttling, and every retry is extra load on the partition that is already full.',
      metrics: { err: '1.8%', p99: '240 ms', sat: '92%', wcu: '10k / 50k' },
      metricTones: { err: 'warn', p99: 'warn', sat: 'bad', wcu: 'good' },
      scene: {
        nodes: [
          viewers,
          { ...api, status: 'active', chips: [{ text: 'retry x3', tone: 'warn' }] },
          { ...p1, status: 'dim', load: 6 },
          { ...p2, status: 'hot', load: 92, chips: [{ text: 'throttled', tone: 'bad' }] },
          { ...p3, status: 'dim', load: 5 },
        ],
        links: [link('viewers', 'api'), ...fan()],
        flows: [
          { path: ['viewers', 'api', 'p2'], tone: 'request', label: 'heart', count: 3, duration: 1.3 },
          { path: ['p2', 'api'], tone: 'error', label: 'throttled', duration: 1.2, delay: 1.4 },
          { path: ['api', 'p2'], tone: 'request', label: 'retry', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'API write results, 20:58',
          icon: 'Table',
          rows: [
            { text: 'OK first try', value: '81%', tone: 'good' },
            { text: 'OK after retry', value: '17%', tone: 'warn' },
            { text: 'Failed', value: '1.8%', tone: 'bad' },
          ],
          footer: { text: 'Retries add load to the hot partition', tone: 'warn' },
        },
        caption: 'Backoff buys time and burns capacity',
      },
    },
    {
      title: 'Retry guard rails',
      tag: 'concept',
      heading: 'Retries need backoff, jitter, a cap and a breaker',
      eli5: 'If every kid whose scoop ran out comes back at the same second, the line never shrinks. Each kid waits a random, growing time and gives up after a few tries.',
      body: [
        'Use exponential backoff with **jitter** so clients do not retry in lockstep, and cap attempts at about three. Add a circuit breaker that stops sending to a key that keeps failing.',
        'Without these, every failed write becomes two or three more and the hot partition never recovers.',
      ],
      keyIdea: 'Backoff, jitter, a retry cap and a breaker keep retries from becoming the outage.',
      metrics: { err: '1.8%', p99: '240 ms', sat: '92%', wcu: '10k / 50k' },
      metricTones: { err: 'warn', p99: 'warn', sat: 'bad', wcu: 'good' },
      scene: {
        nodes: [
          viewers,
          { ...api, label: 'retry policy', sub: 'backoff + jitter', icon: 'Repeat', tint: 'amber', status: 'active', chips: [{ text: 'max 3 tries', tone: 'good' }] },
          { ...p2, status: 'hot', load: 92, chips: [{ text: 'throttled', tone: 'bad' }] },
        ],
        links: [link('viewers', 'api'), link('api', 'p2')],
        flows: [
          { path: ['api', 'p2'], tone: 'request', label: 'try 1', duration: 1.1 },
          { path: ['api', 'p2'], tone: 'request', label: 'try 2, 0.4s', duration: 1.1, delay: 1.8 },
          { path: ['api', 'p2'], tone: 'request', label: 'try 3, 1.1s', duration: 1.1, delay: 3.4 },
        ],
        panel: {
          title: 'Retry policy',
          icon: 'List',
          rows: [
            { text: 'Delay', value: 'base x 2^n, random jitter' },
            { text: 'Attempts', value: 'capped at 3', tone: 'good' },
            { text: 'Circuit breaker', value: 'opens on repeated throttles', tone: 'good' },
          ],
          footer: { text: 'Without a cap, retries multiply the load', tone: 'warn' },
        },
        caption: 'Spread retries out and stop after a few',
      },
    },
    {
      title: 'Peak',
      tag: 'case',
      heading: '21:03: 14M viewers, 60k reactions a second',
      eli5: 'Fourteen million kids line up at **counter B** and almost nobody gets served. Every other counter stands empty.',
      body: [
        'Viewers hit **14 million** and reactions reach about **60,000 per second**, all keyed on `sx_9f22`. One partition allows about 1,000 WCU, so roughly 59,000 of those writes a second are rejected. The other 10k WCU of traffic on the table is mostly healthy, which gives an overall error rate near 84% and a table that consumes only 11k WCU.',
        'The alert fires: throttling spikes on `live-reactions`. Other streams on partition B are collateral damage.',
      ],
      keyIdea: 'The hot key takes its own partition down, and every other key that shares that partition goes down with it.',
      metrics: { err: '84%', p99: '2.4 s', sat: '100%', wcu: '11k / 50k' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', wcu: 'good' },
      scene: {
        nodes: [
          { ...viewers, chips: [{ text: '14M viewers', tone: 'bad' }] },
          { ...api, status: 'hot', load: 88 },
          { ...p1, status: 'dim', load: 7 },
          { ...p2, status: 'down', load: 100, chips: [{ text: '60k writes/s', tone: 'bad' }, { text: 'limit ~1,000', tone: 'warn' }] },
          { ...p3, status: 'dim', load: 6 },
        ],
        links: [link('viewers', 'api'), ...fan()],
        flows: [
          { path: ['viewers', 'api', 'p2'], tone: 'request', label: '60k/s', count: 5, duration: 1.2 },
          { path: ['p2', 'api', 'viewers'], tone: 'error', label: 'Throttled', count: 3, duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'ALERT 21:03 UTC',
          icon: 'Bug',
          code: 'ProvisionedThroughputExceeded\ntable:     live-reactions\nprovision: 50,000 WCU\nconsumed:  11,000 WCU\nthrottled: yes',
          footer: { text: 'Throttled at 22% of provisioned capacity', tone: 'bad' },
        },
        caption: 'Throttled while 78% of the capacity is unused',
      },
    },
    {
      title: 'The puzzle',
      tag: 'case',
      heading: 'The aggregate graph says everything is fine',
      eli5: 'The principal counts all the kids in the whole hall and says there is plenty of room. Meanwhile one counter has a line out the door.',
      body: [
        'The first question in the war room: "We are throttled at 20% of capacity. How?" The table-level graph shows consumed WCU far under provisioned.',
        'Averages hide skew. The table is a sum of partitions, and one partition at 100% barely moves a sum over a hundred.',
      ],
      keyIdea: 'A throttled table with low aggregate usage points at skew. The sum is fine and one part is not.',
      metrics: { err: '84%', p99: '2.4 s', sat: '100%', wcu: '11k / 50k' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', wcu: 'good' },
      scene: {
        nodes: [
          { ...mon, status: 'active' },
          { ...api, id: 'table', label: 'live-reactions', sub: 'table total', icon: 'Table', tint: 'green', status: 'ok', badge: '22% used' },
          { ...p2, status: 'down', load: 100, badge: 'one partition' },
        ],
        links: [link('mon', 'table'), link('table', 'p2', { label: 'a sum hides this', labelTone: 'warn' })],
        flows: [{ path: ['mon', 'table'], tone: 'request', label: 'consumed WCU', duration: 1.4 }],
        panel: {
          title: 'What each view says',
          icon: 'Gauge',
          rows: [
            { text: 'Table consumed', value: '11k / 50k', tone: 'good' },
            { text: 'Table throttled', value: 'yes', tone: 'bad' },
            { text: 'Partition B', value: '100% of limit', tone: 'bad' },
          ],
          footer: { text: 'Both statements are true at once', tone: 'warn' },
        },
        caption: 'The sum looks healthy, one part is dead',
      },
    },
    {
      title: 'Wrong guess',
      tag: 'tradeoff',
      heading: 'First hypothesis: we are under-provisioned',
      eli5: 'Someone hires 150 more lunch ladies for the hall. They all go stand at empty counters. **Counter B** still has one cook.',
      body: [
        'The reflex is to buy capacity. The team raises the table from **50k to 200k WCU**.',
        'It has zero effect. Capacity is split across physical partitions, and one key can only consume what its own partition delivers. Adaptive capacity helps with moderate skew, but it cannot rescue a truly single-key hotspot.',
      ],
      keyIdea: 'If the limit is per key, buying table capacity is the wrong lever.',
      metrics: { err: '84%', p99: '2.4 s', sat: '100%', wcu: '11k / 200k' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad' },
      scene: {
        nodes: [
          { ...api, id: 'table', label: 'live-reactions', sub: '50k to 200k WCU', icon: 'Table', tint: 'green', badge: 'x4 capacity' },
          { ...p1, status: 'dim', load: 2 },
          { ...p2, status: 'down', load: 100, chips: [{ text: 'still ~1,000 WCU', tone: 'bad' }] },
          { ...p3, status: 'dim', load: 2 },
        ],
        links: [link('table', 'p1', { style: 'faint' }), link('table', 'p2'), link('table', 'p3', { style: 'faint' })],
        flows: [
          { path: ['table', 'p2'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['p2', 'table'], tone: 'error', label: 'Throttled', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'After the bump',
          icon: 'Table',
          rows: [
            { text: 'Provisioned', value: '200,000 WCU' },
            { text: 'Consumed', value: '11,000 WCU', tone: 'good' },
            { text: 'Throttled writes', value: 'unchanged', tone: 'bad' },
          ],
          footer: { text: 'Lost minutes, and the page is still red', tone: 'bad' },
        },
        caption: 'More total capacity, same one partition',
      },
      quiz: {
        question: 'A table is provisioned at 50k WCU, consumes 11k, and throttles. What is the most likely cause?',
        options: [
          'The table needs more provisioned capacity',
          'One partition key is hotter than a single partition can serve',
          'The SDK retry setting is too low',
          'Reads are crowding out writes',
        ],
        answer: 1,
        explain: 'Low aggregate usage with throttling means the load is skewed. A single key is capped by its one partition, so adding table capacity does not help.',
      },
    },
    {
      title: 'Find the key',
      tag: 'case',
      heading: 'Investigation: which key is it?',
      eli5: 'The principal walks the hall and counts the kids at each counter. One counter has 400 kids and the rest have a handful.',
      body: [
        'Per-key visibility settles it. Enable **CloudWatch Contributor Insights** on the table. It ranks partition keys by access and throttle count with no code change.',
        'A log grep is only a fallback. It needs the app to log `streamId`, and `aws logs start-query` is asynchronous, so you then call `get-query-results` with the `queryId`.',
        'One key dominates: `sx_9f22`. The data engineer confirms it in the war room: all reactions for that stream hit one physical partition.',
      ],
      keyIdea: 'Aggregate graphs say that something is wrong. Per-key metrics say which key.',
      metrics: { err: '84%', p99: '2.4 s', sat: '100%', wcu: '11k / 50k' },
      metricTones: { err: 'bad', p99: 'bad', sat: 'bad', wcu: 'good' },
      scene: {
        nodes: [
          { ...mon, status: 'active', badge: 'per-key view' },
          { ...p2, status: 'hot', load: 100, chips: [{ text: 'sx_9f22', tone: 'bad' }] },
          { ...p1, status: 'dim', load: 2 },
        ],
        links: [link('mon', 'p2')],
        flows: [{ path: ['mon', 'p2', 'mon'], tone: 'request', label: 'top keys?', duration: 1.8 }],
        panel: {
          title: 'Top throttled keys, 21:05',
          icon: 'List',
          rows: [
            { text: 'sx_9f22', value: '98.7% of throttles', tone: 'bad' },
            { text: 'sx_31de', value: '0.6%', tone: 'warn' },
            { text: 'sx_5b10', value: '0.1%', tone: 'muted' },
          ],
          footer: { text: 'One key, one partition', tone: 'bad' },
        },
        caption: 'The hot key shows up on top',
      },
      code: {
        language: 'bash',
        title: 'Find the throttled key with Contributor Insights',
        source: `# 1. turn on Contributor Insights for the table
aws dynamodb update-contributor-insights \\
  --table-name live-reactions \\
  --contributor-insights-action ENABLE

# 2. top throttled partition keys, last 5 minutes
aws cloudwatch get-insight-rule-report \\
  --rule-name DynamoDBContributorInsights-PKT-live-reactions \\
  --start-time $(date -u -d '-5 min' +%FT%TZ) --end-time $(date -u +%FT%TZ) \\
  --period 60 --max-contributor-count 5`,
        highlight: [7, 8],
      },
    },
    {
      title: 'Mitigation',
      tag: 'concept',
      heading: '21:06: shard the write key',
      eli5: 'Instead of one **counter** selling the ice cream, the hall opens 100 small counters that all sell it. Each kid walks to a random one.',
      body: [
        'The fix is **write sharding**. Append a random suffix to the hot key: `sx_9f22#0` through `sx_9f22#99`. Each variant hashes to a different place, so one stream now fans over many partitions.',
        'Each shard holds one counter item, and a heart is an atomic `ADD` on it. At 60k writes/s over 100 shards, each counter takes about 600 writes/s, under the ~1,000 limit.',
        'The write path deploys the new key shape and the load spreads out.',
      ],
      keyIdea: 'If one key is too hot, make it many keys. The sort key and data stay the same.',
      metrics: { err: '22%', p99: '900 ms', sat: '70%', wcu: '40k / 200k' },
      metricTones: { err: 'bad', p99: 'warn', sat: 'warn', wcu: 'good' },
      scene: {
        nodes: [
          { ...viewers, chips: ['pick rand(0..99)'] },
          { ...api, label: 'reactions API', sub: 'sharded writes', status: 'active' },
          { ...p1, load: 70, status: 'active', chips: ['sx_9f22#17'] },
          { ...p2, load: 68, status: 'active', chips: ['sx_9f22#42'] },
          { ...p3, load: 71, status: 'active', chips: ['sx_9f22#88'] },
        ],
        links: [link('viewers', 'api'), ...fan()],
        flows: [
          { path: ['viewers', 'api', 'p1'], tone: 'request', label: '#17', duration: 1.4 },
          { path: ['viewers', 'api', 'p2'], tone: 'request', label: '#42', duration: 1.4, delay: 0.5 },
          { path: ['viewers', 'api', 'p3'], tone: 'request', label: '#88', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'Write path change',
          icon: 'Code',
          code: 'before: pk = "sx_9f22"\nafter:  pk = "sx_9f22#" + rand(0, 99)\n        ADD hearts 1 (one counter per shard)',
          footer: { text: 'Deployed 21:06 UTC', tone: 'muted' },
        },
        caption: 'One hot key becomes a hundred warm keys',
      },
      code: {
        language: 'typescript',
        title: 'Write path: one atomic counter per shard',
        source: `const SHARDS = 100;

async function addReaction(streamId: string) {
  const shard = Math.floor(Math.random() * SHARDS);
  await ddb.update({
    TableName: 'live-reactions',
    Key: { PartitionKey: \`\${streamId}#\${shard}\`, SortKey: 'count' },
    UpdateExpression: 'ADD hearts :one',
    ExpressionAttributeValues: { ':one': 1 },
  });
}`,
        highlight: [4, 8],
      },
    },
    {
      title: 'Read path',
      tag: 'concept',
      heading: 'Reads now ask every shard and add up',
      eli5: 'To count the scoops sold, the principal now asks all 100 small **counters** and adds the numbers together.',
      body: [
        'Writes were one key, so reads were one query. Now the data for a stream is in 100 keys. The read path reads the 100 counter items with one `BatchGetItem` call (its maximum is 100 keys) and sums them.',
        'Counts written to the old unsharded key before the deploy are not lost. Read that item with a `GetItem` and add it to the sum, or fold it into shard 0 once.',
        'This is the price of sharding: cheap writes for a wider read. Ordered timelines would need a merge by sort key.',
      ],
      keyIdea: 'Write sharding moves the cost to the read side, which now fans out to N queries.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { id: 'reader', kind: 'client', at: at(-3.8, -3.8), label: 'dashboard', sub: 'reaction count' },
          { ...api, label: 'read path', sub: 'scatter and sum', icon: 'Share2', tint: 'blue' },
          { ...p1, load: 55 },
          { ...p2, load: 55 },
          { ...p3, load: 54 },
        ],
        links: [link('reader', 'api'), ...fan()],
        flows: [
          { path: ['reader', 'api'], tone: 'request', label: 'count sx_9f22', duration: 1 },
          { path: ['api', 'p1'], tone: 'request', label: 'Get #0', duration: 1, delay: 1.1 },
          { path: ['api', 'p2'], tone: 'request', label: 'Get #1', duration: 1, delay: 1.1 },
          { path: ['api', 'p3'], tone: 'request', label: 'Get #99', duration: 1, delay: 1.1 },
          { path: ['p2', 'api', 'reader'], tone: 'response', label: 'sum = 41M', duration: 1.8, delay: 2.3 },
        ],
        panel: {
          title: 'Read fan-out',
          icon: 'Share2',
          rows: [
            { text: 'Items per read', value: '100 in one BatchGetItem' },
            { text: 'Merge', value: 'sum counts', tone: 'good' },
            { text: 'Latency', value: 'slowest shard', tone: 'warn' },
          ],
          footer: { text: 'Read p99 is the slowest of 100 items', tone: 'warn' },
        },
        caption: 'Scatter the read, gather the sum',
      },
      code: {
        language: 'typescript',
        title: 'Read path: batch-get every counter and sum',
        source: `async function reactionCount(streamId: string): Promise<number> {
  const keys = Array.from({ length: SHARDS }, (_, shard) => ({
    PartitionKey: \`\${streamId}#\${shard}\`,
    SortKey: 'count',
  }));
  const res = await ddb.batchGet({ RequestItems: { 'live-reactions': { Keys: keys } } });
  const rows = res.Responses?.['live-reactions'] ?? [];
  // retry UnprocessedKeys in prod. Query+COUNT on raw rows is partial per 1 MB page
  return rows.reduce((sum, r) => sum + (r.hearts ?? 0), 0);
}`,
        highlight: [2, 6, 9],
      },
    },
    {
      title: 'Sizing N',
      tag: 'concept',
      heading: 'How many shards is enough?',
      eli5: 'If one **counter** serves 1,000 kids a minute and 60,000 kids arrive, you need many more counters than you think. Pick the number from the math.',
      body: [
        'Size N from the peak: shards must cover `peak writes per second / per-partition limit`, plus margin. Worked example: 60,000 / 1,000 = **60 shards minimum**. We add margin and pick **N = 100**, about 600 writes/s per shard.',
        'Random suffixes also spread unevenly, so leave headroom. Make N a config value you can raise, and drive readers from that same value.',
      ],
      keyIdea: 'N is a capacity calculation. A guess that is too small just moves the hot spot.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { ...api, label: 'shard count N', sub: 'config value', icon: 'Scale', tint: 'amber' },
          { ...p1, load: 55 },
          { ...p2, load: 61 },
          { ...p3, load: 48 },
        ],
        links: fan(),
        flows: [{ path: ['api', 'p2'], tone: 'request', count: 3, duration: 1.3 }],
        panel: {
          title: 'Sizing rule',
          icon: 'Scale',
          rows: [
            { text: 'Peak writes', value: '60k / s' },
            { text: 'Per-partition limit', value: '~1,000 WCU' },
            { text: 'Minimum N', value: '60k / 1,000 = 60', tone: 'warn' },
            { text: 'Chosen N', value: '100 (about 600 per shard)', tone: 'good' },
            { text: 'Add margin for', value: 'uneven random spread', tone: 'muted' },
          ],
          footer: { text: 'Raise N as the stream grows', tone: 'muted' },
        },
        caption: 'N comes from the peak write rate',
      },
    },
    {
      title: 'Recovery',
      tag: 'case',
      heading: '21:09: throttling stops',
      eli5: 'The long line melts. Kids spread across the small **counters** and everybody gets their ice cream.',
      body: [
        'Within about three minutes of the deploy, throttling drops to zero. Error rate falls, p99 returns near normal and the hot partition cools.',
        'The incident ran 21:03 to 21:09 at peak, with a slow start from 20:58. Time to resolution was dominated by the wrong first guess.',
      ],
      keyIdea: 'The fix took minutes to deploy. Finding the cause took longest.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          viewers,
          { ...api, status: 'ok', load: 60 },
          { ...p1, status: 'ok', load: 59 },
          { ...p2, status: 'ok', load: 62 },
          { ...p3, status: 'ok', load: 60 },
        ],
        links: [link('viewers', 'api'), ...fan()],
        flows: [
          { path: ['viewers', 'api', 'p1'], tone: 'request', duration: 1.2 },
          { path: ['viewers', 'api', 'p2'], tone: 'request', duration: 1.2, delay: 0.4 },
          { path: ['viewers', 'api', 'p3'], tone: 'request', duration: 1.2, delay: 0.8 },
          { path: ['p3', 'api', 'viewers'], tone: 'response', label: 'ok', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Incident timeline (UTC)',
          icon: 'Clock',
          rows: [
            { text: '20:45', value: 'celebrity goes live' },
            { text: '20:58', value: 'throttling starts', tone: 'warn' },
            { text: '21:03', value: '14M viewers, alert', tone: 'bad' },
            { text: '21:06', value: 'sharded writes deployed' },
            { text: '21:09', value: 'throttling stops', tone: 'good' },
          ],
        },
        caption: 'Load is flat across partitions again',
      },
      quiz: {
        question: 'Why did the first fix, raising the table from 50k to 200k WCU, change nothing?',
        options: [
          'The new capacity takes an hour to apply',
          'Capacity is split across partitions and the hot key was limited by its one partition',
          'The SDK ignores new capacity settings',
          'The extra capacity only applies to reads',
        ],
        answer: 1,
        explain: 'A single key lives on a single partition, which serves a bounded rate. Total provisioned capacity does not raise that per-partition ceiling.',
      },
    },
    {
      title: 'Root cause',
      tag: 'concept',
      heading: 'Root cause: the key choice assumed an even world',
      eli5: 'The hall assigned one **counter** per flavor. That works until one flavor becomes the only flavor anyone wants.',
      body: [
        'The schema used `streamId` as the partition key. For 99% of streams that is fine. For the rare viral stream it creates a single-partition hotspot that no capacity setting can fix.',
        'This is a property of hash-partitioned stores, not a bug in one product. Kafka partition keys, Cassandra rows and Redis Cluster slots hit the same wall.',
      ],
      keyIdea: 'In a partitioned store, per-key capacity is the real limit.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { ...api, label: 'schema', sub: 'pk = streamId', icon: 'Table', tint: 'red', status: 'active' },
          { ...p1, status: 'ok', load: 3, chips: ['99% of streams'] },
          { ...p2, status: 'hot', load: 100, chips: [{ text: 'viral stream', tone: 'bad' }] },
        ],
        links: [link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['api', 'p1'], tone: 'request', duration: 1.2 },
          { path: ['api', 'p2'], tone: 'request', count: 4, duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Same schema, two outcomes',
          icon: 'Table',
          rows: [
            { text: 'Typical stream', value: '~10 writes/s', tone: 'good' },
            { text: 'Viral stream', value: '60k writes/s', tone: 'bad' },
            { text: 'Limit per key', value: '~1,000 WCU', tone: 'warn' },
          ],
          footer: { text: 'The tail decides the design', tone: 'warn' },
        },
        caption: 'The key was fine for the average stream',
      },
    },
    {
      title: 'Virality score',
      tag: 'concept',
      heading: 'Follow-up 1: shard only the streams that need it',
      eli5: 'The hall opens extra **counters** only on days a famous visitor is coming, instead of keeping 100 open every day.',
      body: [
        'Sharding everything wastes reads, since each normal stream would need N queries. Instead, keep a **virality score** per stream, such as viewers and heart rate.',
        'Above a threshold, the write path switches that stream to a sharded key. Below it, the stream stays on one key.',
      ],
      keyIdea: 'Pay the read fan-out only for the streams that need the write spread.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { ...viewers, id: 'signals', kind: 'monitor', label: 'virality score', sub: 'viewers, rate' },
          { ...api, label: 'write router', sub: 'picks key shape', icon: 'Route', tint: 'violet' },
          { ...p1, chips: ['sx_01a4 (1 key)'], load: 5 },
          { ...p2, chips: ['sx_9f22#0..99'], load: 42 },
        ],
        links: [link('signals', 'api'), link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['signals', 'api'], tone: 'event', label: 'score 91', duration: 1.2 },
          { path: ['api', 'p1'], tone: 'request', duration: 1.2, delay: 1.3 },
          { path: ['api', 'p2'], tone: 'request', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Key shape by score',
          icon: 'Gauge',
          rows: [
            { text: 'score under 50', value: 'pk = streamId', tone: 'good' },
            { text: 'score 50 and over', value: 'pk = streamId#rand', tone: 'warn' },
            { text: 'Readers', value: 'read both shapes', tone: 'muted' },
          ],
        },
        caption: 'Hot streams get a wider key space',
      },
    },
    {
      title: 'On-demand mode',
      tag: 'tradeoff',
      heading: 'Follow-up 2: adaptive capacity and on-demand mode',
      eli5: 'The hall can move helpers toward busy **counters** on its own. It helps a lot in a rush, and not at all when one cook is the whole counter.',
      body: [
        'Use **adaptive capacity** and **on-demand** mode for tables whose hotness is unpredictable. They absorb moderate skew and spikes without you guessing capacity.',
        'They do not remove the per-key ceiling. A truly single-key spike still needs the schema to spread it.',
      ],
      keyIdea: 'Platform features handle moderate skew. A single hot key still needs a schema fix.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { ...api, label: 'on-demand', sub: 'adaptive capacity', icon: 'Gauge', tint: 'teal' },
          { ...p1, status: 'ok', load: 30, chips: [{ text: 'moderate skew', tone: 'good' }] },
          { ...p2, status: 'hot', load: 95, chips: [{ text: 'single hot key', tone: 'bad' }] },
        ],
        links: [link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['api', 'p1'], tone: 'request', duration: 1.2 },
          { path: ['api', 'p2'], tone: 'request', count: 4, duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'What each tool covers',
          icon: 'Table',
          rows: [
            { text: 'Adaptive capacity', value: 'moderate skew', tone: 'good' },
            { text: 'On-demand mode', value: 'unpredictable load', tone: 'good' },
            { text: 'One key above its limit', value: 'not covered', tone: 'bad' },
          ],
          footer: { text: 'Fix the schema, then let the platform help', tone: 'muted' },
        },
        caption: 'Helpers soften skew, they do not erase it',
      },
    },
    {
      title: 'Plan for N',
      tag: 'concept',
      heading: 'Follow-up 3: readers always assume N shards',
      eli5: 'Even on a quiet day, the principal asks "how many counters are open?" instead of assuming one. Then opening more never breaks the count.',
      body: [
        'Write the read path for N shards even when N is 1 today. Then raising N later is a config change, not a rewrite.',
        'Retrofitting is the painful way: a deploy of readers that must handle both the old single key and new sharded keys while data is mid-migration.',
      ],
      keyIdea: 'Design the read path for N shards on day one, even if N is 1.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { ...api, label: 'read path', sub: 'loops over N', icon: 'Repeat', tint: 'blue' },
          { ...p1, load: 40, chips: ['N = 1 today'] },
          { ...p2, load: 40, chips: ['N = 100 later'] },
        ],
        links: [link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['api', 'p1', 'api'], tone: 'request', duration: 1.6 },
          { path: ['api', 'p2', 'api'], tone: 'request', duration: 1.6, delay: 0.6 },
        ],
        panel: {
          title: 'Read path contract',
          icon: 'Code',
          code: 'for shard in 0 .. N-1:\n  query(pk = id#shard)\nsum or merge the results\n// N comes from config',
          footer: { text: 'N = 1 behaves like today', tone: 'muted' },
        },
        caption: 'One code path for any N',
      },
    },
    {
      title: 'Load test',
      tag: 'case',
      heading: 'Follow-up 4: test with all traffic on one key',
      eli5: 'Before the school fair, the principal sends the whole class to one **counter** on purpose to see if the plan holds.',
      body: [
        'Average-looking load tests never find this bug. Add a synthetic profile that sends **all traffic to a single key**, and assert that the system degrades the way you planned.',
        'Run it on a staging table. Alert early on per-key skew and throttles, not only on table-level usage.',
      ],
      keyIdea: 'Test the worst key, not the average key.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { id: 'load', kind: 'worker', at: at(-3.8, -3.8), label: 'load test', sub: 'one key only' },
          { ...api, label: 'staging API', sub: 'sharded writes', status: 'active' },
          { ...p1, status: 'ok', load: 52 },
          { ...p2, status: 'ok', load: 49 },
        ],
        links: [link('load', 'api'), link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['load', 'api'], tone: 'request', label: 'all sx_test', count: 4, duration: 1.2 },
          { path: ['api', 'p1'], tone: 'request', duration: 1.2, delay: 1.3 },
          { path: ['api', 'p2'], tone: 'request', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Skew test checklist',
          icon: 'List',
          rows: [
            { text: 'All writes, one key', value: 'run weekly' },
            { text: 'Throttles', value: 'expect 0', tone: 'good' },
            { text: 'Per-key alert', value: 'fires early', tone: 'good' },
          ],
        },
        caption: 'Make the worst case a routine test',
      },
    },
    {
      title: 'Costs',
      tag: 'tradeoff',
      heading: 'What write sharding costs you',
      eli5: 'Many small **counters** sell faster, but counting the scoops takes longer, and the receipts are no longer in one pile in order.',
      body: [
        'Reads fan out to N queries and take as long as the slowest. Ordering inside one stream is gone unless you merge by sort key. Strong uniqueness across shards needs extra care.',
        'Good fits: counters, likes, event logs. Poor fits: anything needing one ordered list of rows per key.',
      ],
      keyIdea: 'Sharding trades read simplicity and global order for write capacity.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          { ...api, label: 'sharded key', sub: 'id#0..N-1', icon: 'Split', tint: 'amber' },
          { ...p1, load: 40, chips: [{ text: 'fast writes', tone: 'good' }] },
          { ...p2, load: 40, chips: [{ text: 'N reads', tone: 'warn' }, { text: 'no global order', tone: 'warn' }] },
        ],
        links: [link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['api', 'p1'], tone: 'request', duration: 1.2 },
          { path: ['api', 'p2'], tone: 'request', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Fit check',
          icon: 'Scale',
          rows: [
            { text: 'Counters, likes', value: 'good fit', tone: 'good' },
            { text: 'Event logs', value: 'good fit', tone: 'good' },
            { text: 'One ordered list per key', value: 'poor fit', tone: 'bad' },
          ],
          footer: { text: 'Merge cost lands on readers', tone: 'warn' },
        },
        caption: 'Write capacity bought with read work',
      },
    },
    {
      title: 'Other remedies',
      tag: 'tradeoff',
      heading: 'Alternatives and add-ons to random suffixes',
      eli5: 'Instead of opening more **counters**, a helper at the door collects 100 orders on one slip and hands the counter a single total.',
      body: [
        '**Aggregate, then flush.** Batch hearts in the API, a queue or a stream, or `INCR` in Redis, then flush the total every second. One write stands for thousands of hearts.',
        '**Calculated suffix.** Hash `userId` to pick the shard and point reads work. A random suffix spreads best but every read fans out.',
      ],
      keyIdea: 'Cut the write rate first, then spread what remains. Cache hot reads too.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          viewers,
          { ...api, label: 'aggregator', sub: 'batch, flush per second', icon: 'Layers', tint: 'teal', status: 'active' },
          { ...p1, load: 20, chips: [{ text: '1 write per flush', tone: 'good' }] },
          { ...p2, load: 20 },
        ],
        links: [link('viewers', 'api'), link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['viewers', 'api'], tone: 'request', label: 'hearts', count: 4, duration: 1.2 },
          { path: ['api', 'p1'], tone: 'request', label: 'total', duration: 1.2, delay: 1.4 },
          { path: ['api', 'p2'], tone: 'request', label: 'total', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Remedies compared',
          icon: 'Scale',
          rows: [
            { text: 'Aggregate then flush', value: 'fewest writes', tone: 'good' },
            { text: 'Random suffix', value: 'best spread, wide reads', tone: 'warn' },
            { text: 'Calculated suffix', value: 'point reads work', tone: 'good' },
            { text: 'Cache hot reads', value: 'short TTL on the count', tone: 'good' },
          ],
          footer: { text: 'Combine them for a viral key', tone: 'muted' },
        },
        caption: 'Fewer writes beat wider writes',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Per-key capacity is a design question',
      eli5: 'Do not count only how many helpers the hall has. Ask how many kids one **counter** can serve, and plan for the day everyone wants the same ice cream.',
      body: [
        'Throttled at 20% of capacity means skew. Find the key with per-key metrics, shard the write key, and sum on read.',
        'Bake in the long tail: viral content, mega customers, flash sales. "How much can one key handle?" is a design question, not an operational one.',
      ],
      keyIdea: 'Design for the hottest key, not the average key.',
      metrics: { err: '0.02%', p99: '18 ms', sat: '60%', wcu: '70k / 200k' },
      metricTones: { err: 'good', p99: 'good', sat: 'good', wcu: 'good' },
      scene: {
        nodes: [
          viewers,
          { ...api, status: 'ok', load: 60 },
          { ...p1, status: 'ok', load: 59 },
          { ...p2, status: 'ok', load: 62 },
          { ...p3, status: 'ok', load: 60 },
        ],
        links: [link('viewers', 'api'), ...fan()],
        flows: [
          { path: ['viewers', 'api', 'p1'], tone: 'request', duration: 1.2 },
          { path: ['viewers', 'api', 'p3'], tone: 'request', duration: 1.2, delay: 0.5 },
        ],
        panel: {
          title: 'Hot partition checklist',
          icon: 'List',
          rows: [
            { text: 'Throttled, low usage', value: 'suspect skew', tone: 'warn' },
            { text: 'Find it', value: 'per-key metrics', tone: 'good' },
            { text: 'Fix', value: 'write sharding', tone: 'good' },
            { text: 'Prevent', value: 'score, N reads, load test', tone: 'good' },
          ],
        },
        caption: 'Spread the hot key, sum on read',
      },
      quiz: {
        question: 'A viral key is throttling a partitioned table. What fixes it fastest?',
        options: [
          'Raise the table capacity 4x',
          'Spread that key over N suffixed keys and sum on read',
          'Add more retries in the client',
          'Move the table to a larger region',
        ],
        answer: 1,
        explain: 'The limit is per partition. Write sharding turns one hot key into many keys on many partitions, so no single partition is the bottleneck.',
      },
    },
  ],
};
