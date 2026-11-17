import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Eli5 world: a big post office. Producers drop letters at the counter, the sorting room is the broker,
// shelves are partitions, a bookmark on a shelf is an offset, a team of mail carriers is a consumer group.
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const prod: SceneNode = { id: 'prod', kind: 'service', at: at(-5.4, 0), label: 'producers', sub: 'apps and services' };
const p0: SceneNode = { id: 'p0', kind: 'queue', at: at(-1.4, -4.4), label: 'partition 0', sub: 'broker 1' };
const p1: SceneNode = { id: 'p1', kind: 'queue', at: at(2.2, 0), label: 'partition 1', sub: 'broker 2' };
const p2: SceneNode = { id: 'p2', kind: 'queue', at: at(5.8, 4.4), label: 'partition 2', sub: 'broker 3' };

export const designMessageQueuePart2: Lesson = {
  id: 'design-message-queue-part-2',
  title: 'Design a distributed message queue (part 2)',
  tagline: 'Consumer groups, delivery guarantees, the control plane, broker and zone failures, hot partitions and growth.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Consumer groups, pull-based fetch and offset commits',
    'At-most-once, at-least-once and exactly-once delivery',
    'Rebalancing, retries and dead letter topics',
    'The controller, metadata and leader election after a failure',
    'Unclean election, zone loss, hot partitions and consumer lag',
    'Back pressure, quotas and adding brokers',
  ],
  metrics: [
    { key: 'lag', label: 'Consumer lag', icon: 'Clock' },
    { key: 'delivery', label: 'Delivery', icon: 'Repeat' },
    { key: 'avail', label: 'Availability', icon: 'Activity' },
    { key: 'brokers', label: 'Brokers', icon: 'Server' },
  ],
  steps: [
    {
      title: 'Slow reader',
      tag: 'problem',
      heading: 'The write path is safe. Now who reads, and how fast?',
      eli5: 'The post office now takes in a million letters a second, but one tired carrier is trying to deliver from all 200 shelves. The shelves fill up while he walks.',
      body: [
        'Part 1 built a log that takes 1 GB/s and keeps three copies. A single consumer on a topic that size reads one message at a time, falls behind, and the gap keeps growing.',
        'Several consumers must share the topic without two of them handling the same message by accident, and each must know where it stopped if it restarts.',
      ],
      keyIdea: 'Storing messages is half the job. Splitting the reading work, remembering positions and handling failures is the other half.',
      metrics: { lag: '48M msgs', delivery: '?', avail: '99.95%', brokers: '30' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...p0, chips: [{ text: 'end: 9.1M', tone: 'warn' }] },
          { ...p1, chips: [{ text: 'end: 9.0M', tone: 'warn' }] },
          { id: 'cons', kind: 'worker', at: at(5.8, -4.4), label: 'one consumer', sub: 'reads all 200', status: 'hot', load: 96, chips: [{ text: 'at: 2.4M', tone: 'bad' }] },
        ],
        links: [link('p0', 'cons'), link('p1', 'cons')],
        flows: [
          { path: ['p0', 'cons'], tone: 'event', duration: 2.2 },
          { path: ['p1', 'cons'], tone: 'event', duration: 2.2, delay: 0.4 },
        ],
        panel: {
          title: 'A consumer that cannot keep up',
          icon: 'Clock',
          rows: [
            { text: 'Arrival rate', value: '1M/s' },
            { text: 'One consumer handles', value: '20k/s', tone: 'bad' },
            { text: 'Lag growth', value: '980k/s', tone: 'bad' },
          ],
          footer: { text: 'Lag = log end offset minus committed offset', tone: 'muted' },
        },
        caption: 'One reader, a growing gap',
      },
    },
    {
      title: 'Consumer groups',
      tag: 'concept',
      heading: 'Consumer groups: share the work, keep the topic shared',
      eli5: 'A **consumer group** is a team of mail carriers. Each shelf is handled by exactly one carrier on the team, and a second team can read the same shelves for a different job.',
      body: [
        'Consumers join a **group**. Each partition is assigned to exactly one consumer in the group, so no message is processed twice by the group, and order inside a partition holds.',
        'A second group, say analytics, reads the same partitions at its own pace with its own offsets. More consumers than partitions leaves the extra ones idle, so partitions cap parallelism.',
      ],
      keyIdea: 'Within a group, a partition has one reader. Across groups, every group sees every message.',
      metrics: { lag: '48M, draining', delivery: '?', avail: '99.95%', brokers: '30' },
      scene: {
        nodes: [
          { ...p0, at: at(-5.4, -3.4), label: 'partition 0' },
          { ...p1, at: at(-5.4, 3.4), label: 'partition 1' },
          { id: 'c1', kind: 'worker', at: at(0, -3.4), label: 'billing 1', sub: 'group: billing', status: 'ok' },
          { id: 'c2', kind: 'worker', at: at(0, 3.4), label: 'billing 2', sub: 'group: billing', status: 'ok' },
          { id: 'a1', kind: 'worker', at: at(5.4, 0), label: 'analytics 1', sub: 'group: analytics', status: 'active' },
        ],
        links: [link('p0', 'c1'), link('p1', 'c2'), link('p0', 'a1', { style: 'faint' }), link('p1', 'a1', { style: 'faint' })],
        flows: [
          { path: ['p0', 'c1'], tone: 'event', duration: 1.6 },
          { path: ['p1', 'c2'], tone: 'event', duration: 1.6, delay: 0.3 },
          { path: ['p0', 'a1'], tone: 'event', duration: 2, delay: 0.6 },
          { path: ['p1', 'a1'], tone: 'event', duration: 2, delay: 0.9 },
        ],
        panel: {
          title: 'Assignment table',
          icon: 'Table',
          rows: [
            { text: 'billing: p0', value: 'billing 1' },
            { text: 'billing: p1', value: 'billing 2' },
            { text: 'analytics: p0 and p1', value: 'analytics 1' },
            { text: 'billing 3 joins', value: 'idle, no partition', tone: 'warn' },
          ],
          footer: { text: 'Max useful consumers = partitions (200)', tone: 'muted' },
        },
        caption: 'One owner per partition per group',
      },
    },
    {
      title: 'Pull, offsets',
      tag: 'concept',
      heading: 'Consumers pull, and offsets say where they stopped',
      eli5: 'Each carrier asks the sorting room for a tray of letters starting at his bookmark, and walks the bookmark forward after delivering. The room never pushes letters at a carrier who is busy.',
      body: [
        'A consumer **pulls**: `fetch(partition, offset)`. If nothing is new the broker holds the call open for up to 500 ms (**long poll**), then answers. A slow consumer just fetches less often, so it cannot be overloaded.',
        'After processing it **commits** the next offset. Commits go to a compacted internal topic, one key per group and partition, so offsets survive a consumer or broker restart.',
      ],
      keyIdea: 'The consumer owns its position. The broker stores a bookmark but never tracks delivery per message.',
      metrics: { lag: '48M, draining', delivery: '?', avail: '99.95%', brokers: '30' },
      scene: {
        nodes: [
          { id: 'cons', kind: 'worker', at: at(-5.4, 0), label: 'consumer', sub: 'group: billing', chips: [{ text: 'next: 4822', tone: 'good' }] },
          { id: 'part', kind: 'queue', at: at(-1.8, 0), label: 'partition 1', sub: 'end: 4900', status: 'active' },
          { id: 'offs', kind: 'db', at: at(3, -2.4), label: 'offsets topic', sub: 'compacted', chips: ['billing/p1 = 4822'] },
        ],
        links: [link('cons', 'part', { arrow: 'both', label: 'fetch, long poll' }), link('cons', 'offs', { label: 'commit' })],
        flows: [
          { path: ['cons', 'part'], tone: 'request', label: 'fetch 4822', duration: 1.2 },
          { path: ['part', 'cons'], tone: 'response', label: '78 records', duration: 1.2, delay: 1.3 },
          { path: ['cons', 'offs'], tone: 'event', label: 'commit 4900', duration: 1.4, delay: 2.7 },
        ],
        panel: {
          title: 'Fetch and commit',
          icon: 'Code',
          code: 'fetch(orders, p1, offset=4822,\n      maxBytes=1MB, maxWait=500ms)\n  -> records 4822..4899\ncommit(billing, p1, 4900)\n  -> stored under key billing/p1',
          footer: { text: 'The back pressure lesson explains why pull helps', tone: 'muted' },
        },
        caption: 'Fetch from a bookmark, then move it',
      },
    },
    {
      title: 'Delivery',
      tag: 'tradeoff',
      heading: 'When you commit decides what a crash costs',
      eli5: 'A carrier can move his bookmark before delivering a letter or after. Before: a trip that fails loses the letter. After: a trip that fails means he delivers it again next time.',
      body: [
        'Commit **before** processing and a crash loses messages: **at-most-once**. Commit **after** processing and a crash repeats the last batch: **at-least-once**. Most systems pick at-least-once and make handlers safe to repeat.',
        'Message order of the two steps is the whole difference. Process and commit cannot be one atomic action across a broker and an external system, so something has to give.',
      ],
      keyIdea: 'Process then commit gives at-least-once. Duplicates are the price of never losing a message.',
      metrics: { lag: '48M, draining', delivery: 'at least once', avail: '99.95%', brokers: '30' },
      scene: {
        nodes: [
          { id: 'cons', kind: 'worker', at: at(-5.4, 0), label: 'consumer', sub: 'billing', status: 'down', badge: 'crash' },
          { id: 'part', kind: 'queue', at: at(-1.8, 0), label: 'partition 1', sub: 'committed: 4822' },
          { id: 'sink', kind: 'db', at: at(3, 0), label: 'billing DB', sub: 'charged 4822..4850', chips: [{ text: 'handled once, seen twice', tone: 'warn' }] },
        ],
        links: [link('cons', 'part', { arrow: 'both' }), link('cons', 'sink')],
        flows: [
          { path: ['cons', 'sink'], tone: 'request', label: 'charge 4850', duration: 1.4 },
          { path: ['part', 'cons'], tone: 'event', label: 'replay from 4822', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Where the commit sits',
          icon: 'Repeat',
          rows: [
            { text: 'Commit, then process', value: 'at-most-once: may lose', tone: 'bad' },
            { text: 'Process, then commit', value: 'at-least-once: may repeat', tone: 'warn' },
            { text: 'Repeat-safe handler', value: 'looks exactly-once', tone: 'good' },
          ],
          footer: { text: 'Pick at-least-once, then dedupe', tone: 'good' },
        },
        caption: 'A crash between two steps decides it',
      },
      code: {
        language: 'typescript',
        title: 'At-least-once consumer loop',
        source: `while (true) {
  const batch = await consumer.poll();
  for (const m of batch.records) {
    await handle(m);                         // side effect first
  }
  await consumer.commit(batch.lastOffset + 1); // then save the position
}`,
        highlight: [4, 6],
      },
    },
    {
      title: 'Exactly once',
      tag: 'concept',
      heading: 'Exactly-once, built from idempotence',
      eli5: 'Every letter gets a stamped number. If the sorting room sees the same number twice it throws the copy away, and a carrier checks his log before delivering a number he already delivered.',
      body: [
        'A lost ack makes the producer resend. An **idempotent producer** sends a producer id and a per-partition sequence number, and the leader drops repeats. This holds per session and partition: a restarted producer gets a new id and can duplicate.',
        'The consumer needs a dedupe key checked in the same database transaction as the effect. Broker transactions only cover read-process-write inside the broker.',
      ],
      keyIdea: 'Exactly-once is at-least-once plus deduplication at both ends. The transport never delivers a message only once.',
      metrics: { lag: '12M, draining', delivery: 'effectively once', avail: '99.95%', brokers: '30' },
      metricTones: { delivery: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: ['pid=7 seq=41', { text: 'retry: seq=41', tone: 'warn' }] },
          { id: 'lead', kind: 'queue', at: at(0, 0), label: 'partition 1', sub: 'leader', status: 'active', chips: [{ text: 'seq 41 kept, repeat dropped', tone: 'good' }] },
          { id: 'cons', kind: 'worker', at: at(5.4, 0), label: 'consumer', sub: 'dedupe by id', chips: ['processed: 4821'] },
        ],
        links: [link('prod', 'lead'), link('lead', 'cons')],
        flows: [
          { path: ['prod', 'lead'], tone: 'request', label: 'seq 41', duration: 1.2 },
          { path: ['prod', 'lead'], tone: 'request', label: 'retry seq 41', duration: 1.2, delay: 1.4 },
          { path: ['lead', 'cons'], tone: 'event', label: 'one copy', duration: 1.4, delay: 2.9 },
        ],
        panel: {
          title: 'Two dedupe points',
          icon: 'Copy',
          rows: [
            { text: 'Producer to broker', value: 'pid + sequence, per session', tone: 'good' },
            { text: 'Broker to effect', value: 'dedupe key in one txn', tone: 'good' },
            { text: 'Cost', value: 'a little state each side' },
          ],
          footer: { text: 'The API design lesson covers idempotency keys', tone: 'muted' },
        },
        caption: 'Sequence numbers at the door, dedupe keys at the end',
      },
    },
    {
      title: 'Rebalance',
      tag: 'case',
      heading: 'Case: a consumer dies and the group rebalances',
      eli5: 'One carrier goes home sick. The head of the team notices he stopped checking in, and hands his shelves to the others, while everyone pauses for a moment to hear the new plan.',
      body: [
        'Consumers heartbeat to a **group coordinator** broker, every 3 s. After a 10 s silence the coordinator declares one dead and starts a **rebalance**: partitions are reassigned and the new owner resumes from the last committed offset.',
        'A classic rebalance pauses the whole group. **Cooperative** rebalancing moves only the affected partitions. The **session timeout** (10 s, background heartbeat) catches a dead process. The **max poll interval** (5 min) catches a stuck handler.',
      ],
      keyIdea: 'A group survives a consumer death by reassigning partitions and resuming from committed offsets.',
      metrics: { lag: '12M, +2M during pause', delivery: 'at least once', avail: '99.95%', brokers: '30' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          { id: 'coord', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'coordinator', sub: 'a broker', icon: 'Users', tint: 'amber' },
          { id: 'c1', kind: 'worker', at: at(0, -4), label: 'billing 1', sub: 'owns p0, p2', status: 'ok', chips: [{ text: 'gained p2', tone: 'good' }] },
          { id: 'c2', kind: 'worker', at: at(0, 4), label: 'billing 2', sub: 'was p1, p2', status: 'down', badge: 'no heartbeat 10 s' },
          { id: 'c3', kind: 'worker', at: at(5.4, 0), label: 'billing 3', sub: 'takes p1', status: 'active', chips: [{ text: 'gained p1', tone: 'good' }] },
        ],
        links: [link('c1', 'coord', { label: 'heartbeat' }), link('c2', 'coord', { style: 'dashed' }), link('coord', 'c3', { label: 'new plan' })],
        flows: [
          { path: ['c1', 'coord'], tone: 'event', label: 'ok', duration: 1.4 },
          { path: ['coord', 'c3'], tone: 'handshake', label: 'you own p1', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Rebalance timers',
          icon: 'Timer',
          rows: [
            { text: 'Heartbeat every', value: '3 s' },
            { text: 'Session timeout', value: '10 s, process death' },
            { text: 'Max poll interval', value: '5 min, stuck handler' },
            { text: 'Paused partitions (classic)', value: 'all', tone: 'warn' },
            { text: 'Paused (cooperative)', value: 'only moved ones', tone: 'good' },
          ],
          footer: { text: 'New owner resumes at the committed offset', tone: 'good' },
        },
        caption: 'Detect, reassign, resume',
      },
    },
    {
      title: 'Retries, DLQ',
      tag: 'case',
      heading: 'Case: one poison message blocks a partition',
      eli5: 'One letter has an address nobody can read, and the carrier keeps trying it, so the whole shelf stops. Move it to a "later" tray, then to a "problem" tray, and keep the shelf moving.',
      body: [
        'A partition is strictly ordered, so a message that always fails blocks everything behind it. The handler republishes the failure to a **retry topic** with a delay (1 min, 5 min, 30 min) and commits past it.',
        'After the last retry it goes to a **dead letter topic** with the error attached. Moving a message aside gives up per-key order for it. A delay tier works because its consumer pauses until the record timestamp plus the delay. The message queues lesson covers dead letters in detail.',
      ],
      keyIdea: 'Never retry in place. Move a failing message aside so one bad record cannot stop its partition.',
      metrics: { lag: '2M, draining', delivery: 'at least once', avail: '99.95%', brokers: '30' },
      scene: {
        nodes: [
          { ...p1, at: at(-5.4, -3.4), chips: [{ text: 'offset 42 fails', tone: 'bad' }] },
          { id: 'cons', kind: 'worker', at: at(-0.2, 0), label: 'consumer', sub: 'billing', status: 'active' },
          { id: 'retry', kind: 'queue', at: at(5.6, -2.4), label: 'orders.retry.1m', sub: 'delay tier' },
          { id: 'dlq', kind: 'queue', at: at(5.6, 3.6), label: 'orders.dlq', sub: 'for humans', tint: 'red' },
        ],
        links: [link('p1', 'cons'), link('cons', 'retry', { label: 'first failure' }), link('cons', 'dlq', { label: 'after 3 tries', labelTone: 'warn' })],
        flows: [
          { path: ['p1', 'cons'], tone: 'event', label: 'offset 42', duration: 1.4 },
          { path: ['cons', 'retry'], tone: 'error', label: 'fail, move aside', duration: 1.4, delay: 1.5 },
          { path: ['cons', 'dlq'], tone: 'error', label: 'give up', duration: 1.6, delay: 3.2 },
        ],
        panel: {
          title: 'Retry ladder',
          icon: 'Repeat',
          rows: [
            { text: 'Try 1 fails', value: 'orders.retry.1m' },
            { text: 'Try 2 fails', value: 'orders.retry.5m' },
            { text: 'Try 3 fails', value: 'orders.retry.30m' },
            { text: 'Try 4 fails', value: 'orders.dlq', tone: 'bad' },
          ],
          footer: { text: 'Main partition keeps moving the whole time', tone: 'good' },
        },
        caption: 'Move it aside, keep the shelf flowing',
      },
      code: {
        language: 'typescript',
        title: 'Route a failed message to a retry tier',
        source: `async function onFailure(m: QueueRecord, err: Error) {
  const tries = Number(m.headers['tries'] ?? 0);
  if (tries >= 3) {
    return producer.send({ ...m, topic: 'orders.dlq', headers: { ...m.headers, error: err.message } });
  }
  const topic = ['orders.retry.1m', 'orders.retry.5m', 'orders.retry.30m'][tries];
  return producer.send({ ...m, topic, headers: { ...m.headers, tries: String(tries + 1) } });
}`,
        highlight: [3, 6],
      },
      quiz: {
        question: 'A consumer commits its offset after processing each batch. It crashes after handling a batch but before committing. What does the restarted consumer do?',
        options: [
          'Skips the batch, so those messages are lost',
          'Reads the batch again, so handlers must tolerate duplicates',
          'Waits for the broker to resend only the failed messages',
          'Asks the producer to publish the batch again',
        ],
        answer: 1,
        explain: 'It resumes from the last committed offset, which is before the batch. That is at-least-once delivery: nothing is lost, and some messages may be seen twice, so handlers need idempotence.',
      },
    },
    {
      title: 'Control plane',
      tag: 'concept',
      heading: 'The controller keeps the cluster map',
      eli5: 'The post office has a head office with the master map: which building holds which shelf, and which copy is the main one. Every clerk and carrier asks the head office where to go.',
      body: [
        'Metadata says which partitions exist, which broker leads each, and who is in the ISR. A **controller** quorum (3 or 5 nodes running Raft, see the consensus lesson) stores it, and one active controller makes the decisions.',
        'Brokers register and heartbeat to the controller. Clients ask any broker for metadata, cache it, and refresh it when they get a "not leader" error. Metadata is tiny and rarely changes, so it stays off the data path.',
      ],
      keyIdea: 'Keep the cluster map in a small consensus-backed store. Data flows broker to client directly.',
      metrics: { lag: '2M, draining', delivery: 'at least once', avail: '99.95%', brokers: '30' },
      scene: {
        nodes: [
          { id: 'ctl', kind: 'block', size: 0.8, at: at(0, -4), label: 'controller', sub: 'Raft quorum of 3', icon: 'Network', tint: 'amber' },
          { id: 'b1', kind: 'server', at: at(-4.4, 1), label: 'broker 1', sub: 'leads p0' },
          { id: 'b2', kind: 'server', at: at(4.4, 1), label: 'broker 2', sub: 'leads p1' },
          { ...prod, at: at(0, 4.4), label: 'client', sub: 'caches metadata' },
        ],
        links: [link('b1', 'ctl', { label: 'heartbeat' }), link('b2', 'ctl'), link('prod', 'b1', { style: 'faint' }), link('prod', 'b2', { style: 'faint' })],
        flows: [
          { path: ['b1', 'ctl'], tone: 'event', label: 'alive', duration: 1.4 },
          { path: ['b2', 'ctl'], tone: 'event', label: 'alive', duration: 1.4, delay: 0.3 },
          { path: ['prod', 'b2'], tone: 'request', label: 'produce p1', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Cluster metadata',
          icon: 'Table',
          rows: [
            { text: 'p0', value: 'leader b1, ISR b1 b5 b9' },
            { text: 'p1', value: 'leader b2, ISR b2 b6 b8' },
            { text: 'p2', value: 'leader b3, ISR b3 b7 b4' },
            { text: 'Brokers alive', value: '30 of 30', tone: 'good' },
          ],
          footer: { text: 'Service discovery for brokers, kept small', tone: 'muted' },
        },
        caption: 'Small map, strong consistency, off the data path',
      },
    },
    {
      title: 'Broker dies',
      tag: 'case',
      heading: 'Case: a broker dies and its leaders move',
      eli5: 'A whole building loses power. The head office sees it went silent, picks a building that holds a fresh photocopy of each affected shelf, and tells everyone the new address.',
      body: [
        'Broker 1 stops heartbeating. After the session timeout (6 s here) the controller marks it dead and, for each partition it led, elects a new leader **from the ISR**. Those followers already hold every acknowledged record.',
        'It publishes the new metadata. Producers get "not leader", refresh and retry. Affected partitions are unwritable for about 7 s (6 s to detect, about 1 s to elect and refresh), and no acknowledged message is lost. The failover lesson covers the pattern.',
      ],
      keyIdea: 'Electing only from the ISR is why acks=all survives a leader failure with no loss.',
      metrics: { lag: '2M, +400k', delivery: 'at least once', avail: '~7 s gap on 7 partitions', brokers: '29' },
      metricTones: { avail: 'warn', brokers: 'warn' },
      scene: {
        nodes: [
          { id: 'ctl', kind: 'block', size: 0.8, at: at(0, -4), label: 'controller', sub: 'elects leaders', icon: 'Network', tint: 'amber', status: 'active' },
          { id: 'b1', kind: 'server', at: at(-4.4, 1), label: 'broker 1', sub: 'was leader of p0', status: 'down' },
          { id: 'b5', kind: 'server', at: at(4.4, 1), label: 'broker 5', sub: 'now leads p0', status: 'ok', chips: [{ text: 'in ISR, caught up', tone: 'good' }] },
          { ...prod, at: at(0, 4.4), label: 'producer' },
        ],
        links: [link('ctl', 'b1', { style: 'dashed' }), link('ctl', 'b5', { label: 'you lead p0' }), link('prod', 'b5')],
        flows: [
          { path: ['ctl', 'b5'], tone: 'handshake', label: 'become leader', duration: 1.4 },
          { path: ['prod', 'b5'], tone: 'request', label: 'retry produce', duration: 1.4, delay: 1.6 },
          { path: ['b5', 'prod'], tone: 'response', label: 'ack', duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Failover timeline',
          icon: 'Clock',
          rows: [
            { text: '0 s', value: 'broker 1 stops' },
            { text: '6 s', value: 'controller marks it dead', tone: 'warn' },
            { text: '6.2 s', value: 'new leaders from ISR', tone: 'good' },
            { text: '7 s', value: 'clients refreshed, writing', tone: 'good' },
          ],
          footer: { text: 'No acknowledged record lost', tone: 'good' },
        },
        caption: 'Detect, elect from the ISR, redirect',
      },
    },
    {
      title: 'Unclean election',
      tag: 'tradeoff',
      heading: 'Tradeoff: stay available or stay correct when the ISR is empty',
      eli5: 'Every up-to-date photocopy is gone. Either the shelf stays closed until a good copy returns, or the office opens an old copy now and some recent letters are missing.',
      body: [
        'If the leader dies and every other ISR member is also down, only a lagging replica is left. **Unclean leader election** promotes it: the partition is available again, but the records it never copied are lost.',
        'Turning it off keeps the partition offline until an ISR member returns. That is the CAP tradeoff in a broker setting: payments choose consistency, while a metrics firehose may choose availability.',
      ],
      keyIdea: 'Availability or durability, per topic. Decide it for each data type before the incident, not during it.',
      metrics: { lag: '2M, draining', delivery: 'at least once', avail: 'topic offline', brokers: '28' },
      metricTones: { avail: 'bad' },
      scene: {
        nodes: [
          { id: 'b1', kind: 'server', at: at(-5.4, 0), label: 'old leader', sub: 'down', status: 'down' },
          { id: 'b2', kind: 'server', at: at(0, 0), label: 'ISR member', sub: 'down', status: 'down' },
          { id: 'b3', kind: 'replica', at: at(5.4, 0), label: 'lagging replica', sub: 'missing 3,100 records', status: 'dim', chips: [{ text: 'only copy left', tone: 'warn' }] },
        ],
        links: [link('b1', 'b3', { style: 'dashed', arrow: 'none' }), link('b2', 'b3', { style: 'dashed', arrow: 'none' })],
        panel: {
          title: 'Unclean election setting',
          icon: 'Scale',
          rows: [
            { text: 'false: wait for the ISR', value: 'offline, no loss', tone: 'good' },
            { text: 'true: promote lagging copy', value: 'online, loses 3,100', tone: 'bad' },
            { text: 'Payments, orders', value: 'false' },
            { text: 'Logs, clicks', value: 'true is fine' },
          ],
          footer: { text: 'The CAP and PACELC lesson names this tradeoff', tone: 'muted' },
        },
        caption: 'Wait for a good copy, or promote a stale one',
      },
    },
    {
      title: 'Zone loss',
      tag: 'case',
      heading: 'Case: a whole availability zone goes dark',
      eli5: 'A flood closes one entire district. Because each shelf keeps one photocopy in each of three districts, every shelf still has two copies somewhere dry.',
      body: [
        'The controller places the three replicas of a partition in three **zones**, using each broker\'s rack label. Losing a zone removes one replica of every partition, never two.',
        'With min ISR 2, writes keep flowing through the other two zones. Leaders in the lost zone move within seconds. Capacity must cover it: the survivors must carry 100% of the load on two thirds of the brokers.',
      ],
      keyIdea: 'Spread replicas across zones and size the cluster so two zones can carry full traffic.',
      metrics: { lag: '2M, +1M', delivery: 'at least once', avail: 'writes continue', brokers: '20 of 30' },
      metricTones: { brokers: 'warn', avail: 'good' },
      scene: {
        nodes: [
          { id: 'za', kind: 'replica', at: at(-5.4, 0), label: 'replica', sub: 'zone a', status: 'down', badge: 'zone lost' },
          { id: 'zb', kind: 'queue', at: at(0, 0), label: 'leader p1', sub: 'zone b, moved here', status: 'active', load: 72 },
          { id: 'zc', kind: 'replica', at: at(5.4, 0), label: 'replica', sub: 'zone c', status: 'ok', load: 66 },
        ],
        links: [link('za', 'zb', { style: 'dashed' }), link('zb', 'zc', { label: 'copy' })],
        flows: [
          { path: ['zb', 'zc'], tone: 'data', label: 'offset 4822', duration: 1.6 },
        ],
        panel: {
          title: 'Capacity after losing a zone',
          icon: 'Gauge',
          rows: [
            { text: 'Brokers left', value: '20 of 30' },
            { text: 'Load per broker before', value: '45%', tone: 'good' },
            { text: 'Load per broker after', value: '68%', tone: 'warn' },
            { text: 'min.insync.replicas = 2', value: 'writes OK', tone: 'good' },
          ],
          footer: { text: 'Plan to run under 70% busy', tone: 'muted' },
        },
        caption: 'One replica per zone, two zones carry the load',
      },
    },
    {
      title: 'Hot partition',
      tag: 'case',
      heading: 'Case: one hot key overloads one partition',
      eli5: 'One famous shop sends four times what a shelf is built to take, and all of it goes to one shelf. That shelf and its one clerk are swamped while the other 199 shelves sit nearly empty.',
      body: [
        'A key such as a big seller or a viral user sends far more than one partition should take: 40 MB/s against a 10 MB/s target, while the others take 5 MB/s. Its leader hits its disk and network limit while others idle. Adding consumers or brokers does not help, since one partition has one writer and one reader.',
        'Fixes: add a salt to the key (`seller-9#3`) so the load spreads and accept weaker order for that key, give the hot entity its own topic, or key on a finer field like order id.',
      ],
      keyIdea: 'Partitions only scale when traffic spreads evenly. Watch per-partition rate, not just the cluster total.',
      metrics: { lag: '30M on p0', delivery: 'at least once', avail: '99.95%', brokers: '30' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: [{ text: 'key=seller-9: 40 MB/s', tone: 'warn' }] },
          { ...p0, status: 'hot', load: 98, chips: [{ text: '40 MB/s, target 10', tone: 'bad' }] },
          { ...p1, chips: [{ text: '5 MB/s', tone: 'good' }] },
          { ...p2, chips: [{ text: '5 MB/s', tone: 'good' }] },
        ],
        links: [link('prod', 'p0', { labelTone: 'warn', label: 'most traffic' }), link('prod', 'p1', { style: 'faint' }), link('prod', 'p2', { style: 'faint' })],
        flows: [
          { path: ['prod', 'p0'], tone: 'error', label: 'seller-9', count: 4, duration: 1.4 },
          { path: ['prod', 'p1'], tone: 'event', duration: 1.8, delay: 1 },
        ],
        panel: {
          title: 'Ways to spread a hot key',
          icon: 'Split',
          rows: [
            { text: 'Salt: seller-9#0..9', value: 'even, order lost' },
            { text: 'Own topic for the hot key', value: 'isolated', tone: 'good' },
            { text: 'Finer key: order id', value: 'even', tone: 'good' },
          ],
          footer: { text: 'Same problem as hot shards in the sharding lesson', tone: 'muted' },
        },
        caption: 'One partition cannot be split by adding machines',
      },
    },
    {
      title: 'Lag',
      tag: 'concept',
      heading: 'Watch consumer lag as time, not only count',
      eli5: 'The post office counts how many letters are waiting on each shelf, and rings an alarm when the oldest letter has waited too long.',
      body: [
        '**Consumer lag** (log end offset minus committed offset) is the key health number. At 1M msgs/s, a lag of 5.4M messages is only about 5 s of data, while 90M would be 90 s. Count alone hides that, so alert on the age of the oldest unread message.',
        'Page when the age passes 5 minutes. Scale consumers up to the partition count, and fix a slow handler if lag keeps growing anyway.',
      ],
      keyIdea: 'Measure lag as time, not only count. Age tells you whether consumers are keeping up.',
      metrics: { lag: '5 s oldest', delivery: 'at least once', avail: '99.95%', brokers: '30' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          { id: 'broker', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'brokers', sub: 'log end moves ahead', icon: 'Inbox', tint: 'violet' },
          { id: 'cons', kind: 'worker', at: at(-0.6, 0), label: 'consumers', sub: 'billing', chips: [{ text: 'lag 5 s', tone: 'good' }] },
          { id: 'mon', kind: 'monitor', at: at(5.4, 0), label: 'lag alert', sub: 'page at 5 min' },
        ],
        links: [link('broker', 'cons'), link('cons', 'mon', { label: 'lag metric' })],
        flows: [
          { path: ['broker', 'cons'], tone: 'event', count: 2, duration: 1.6 },
          { path: ['cons', 'mon'], tone: 'event', label: 'lag metric', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Signals to watch',
          icon: 'Activity',
          rows: [
            { text: 'Lag in messages', value: '5.4M' },
            { text: 'Age of oldest unread', value: '~5 s', tone: 'good' },
            { text: 'Alert threshold', value: '5 min' },
            { text: 'Under-replicated partitions', value: '0', tone: 'good' },
          ],
          footer: { text: 'See the observability lesson for alert design', tone: 'muted' },
        },
        caption: 'Lag in time tells you who is behind',
      },
    },
    {
      title: 'Quotas',
      tag: 'concept',
      heading: 'Quotas: push back on greedy producers',
      eli5: 'The post office limits how fast any one company may drop off mail, so one company cannot flood the counter and slow everyone else.',
      body: [
        '**Quotas** throttle each client id to a byte rate, say 50 MB/s, by delaying its responses. A runaway producer slows down while other clients see no change.',
        'The producer feels back pressure as slower acks and a full send buffer. The back pressure lesson explains why bounding the input matters.',
      ],
      keyIdea: 'Cap each client so one tenant cannot hurt the others. Delay is gentler than rejecting.',
      metrics: { lag: '< 5 s', delivery: 'at least once', avail: '99.95%', brokers: '30' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: [{ text: 'wants 120 MB/s', tone: 'warn' }, { text: 'quota 50 MB/s', tone: 'warn' }] },
          { id: 'broker', kind: 'block', size: 0.8, at: at(0, 0), label: 'brokers', sub: 'throttle by delay', icon: 'Inbox', tint: 'violet' },
          { id: 'other', kind: 'service', at: at(5.4, 0), label: 'other clients', sub: 'unaffected', status: 'ok' },
        ],
        links: [link('prod', 'broker', { label: 'throttled', labelTone: 'warn' }), link('other', 'broker', { style: 'faint' })],
        flows: [
          { path: ['prod', 'broker'], tone: 'request', label: 'send', count: 2, duration: 1.6 },
          { path: ['broker', 'prod'], tone: 'response', label: 'ack, delayed', duration: 1.6, delay: 1.8 },
          { path: ['other', 'broker'], tone: 'event', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Quota in action',
          icon: 'Gauge',
          rows: [
            { text: 'Producer demand', value: '120 MB/s' },
            { text: 'Quota', value: '50 MB/s', tone: 'warn' },
            { text: 'Method', value: 'delay responses' },
            { text: 'Throttled clients', value: '1', tone: 'warn' },
          ],
          footer: { text: 'One tenant cannot starve the rest', tone: 'good' },
        },
        caption: 'Quotas stop the flood',
      },
    },
    {
      title: 'Scale out',
      tag: 'concept',
      heading: 'Add brokers and move partitions, slowly',
      eli5: 'A new building opens. The head office moves some shelves there by copying their letters over, but only a few at a time, so the trucks are not blocked and mail keeps moving.',
      body: [
        'A new broker starts empty. The controller reassigns some replicas to it: the new replica joins as a follower, copies the log, joins the ISR, and the old one is dropped. Copies are **throttled**, say 50 MB/s, so live traffic is not starved.',
        'Adding partitions to a topic changes `hash(key) % N`, so keys move and per-key order breaks across the change. That is why we over-provisioned 200 partitions. The consistent hashing lesson shows the alternative.',
      ],
      keyIdea: 'Capacity grows by moving whole replicas under a throttle. Overprovision partitions, since changing their count remaps keys.',
      metrics: { lag: '2M, draining', delivery: 'at least once', avail: '99.95%', brokers: '30 to 36' },
      metricTones: { brokers: 'good' },
      scene: {
        nodes: [
          { id: 'b1', kind: 'server', at: at(-5.4, 0), label: 'broker 1', sub: '26 TB, 78% full', status: 'hot', load: 82 },
          { id: 'ctl', kind: 'block', size: 0.8, at: at(0, -4), label: 'controller', sub: 'plans the move', icon: 'Network', tint: 'amber' },
          { id: 'b31', kind: 'server', at: at(5.4, 0), label: 'broker 31', sub: 'new, empty', status: 'active', chips: [{ text: 'copying p0', tone: 'good' }] },
        ],
        links: [link('ctl', 'b1', { label: 'drop replica later', style: 'faint' }), link('ctl', 'b31', { label: 'add replica' }), link('b1', 'b31', { label: 'throttled copy', route: 'straight' })],
        flows: [
          { path: ['ctl', 'b31'], tone: 'handshake', label: 'new follower', duration: 1.4 },
          { path: ['b1', 'b31'], tone: 'data', label: '50 MB/s', count: 3, duration: 2.2, delay: 1.5 },
        ],
        panel: {
          title: 'Moving one replica',
          icon: 'Copy',
          rows: [
            { text: '1. Add broker 31 as follower', value: 'copy starts' },
            { text: '2. Wait until it is in the ISR', value: 'caught up' },
            { text: '3. Drop the old replica', value: 'space freed', tone: 'good' },
            { text: 'Copy throttle', value: '50 MB/s' },
          ],
          footer: { text: 'Never change the partition count of a keyed topic casually', tone: 'warn' },
        },
        caption: 'Join as follower, catch up, then switch',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole queue, from write to failure',
      eli5: 'The post office has numbered shelves, three photocopies in three districts, teams of carriers with bookmarks, a "later" tray and a "problem" tray, a head office with the map, and alarms when any pile gets old.',
      body: [
        'Producers write keyed batches with `acks=all` to partition leaders. Followers copy them, and the ISR decides what is safe. **Consumer groups** pull with committed offsets, **at-least-once** with dedupe, and retry tiers plus a dead letter topic handle bad messages.',
        'A **controller** quorum holds metadata and elects leaders from the ISR after a failure. Replicas spread across zones, quotas and lag alerts protect the cluster, and growth means moving replicas under a throttle.',
      ],
      keyIdea: 'A distributed queue is a partitioned, replicated log with consumer-owned positions and a small consensus store for the map.',
      metrics: { lag: '< 5 s', delivery: 'effectively once', avail: '99.95%', brokers: '36' },
      metricTones: { lag: 'good', delivery: 'good', avail: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: ['batch, acks=all'] },
          { id: 'cluster', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'brokers', sub: '36, 3 zones', icon: 'Inbox', tint: 'violet' },
          { id: 'ctl', kind: 'block', size: 0.8, at: at(1.8, -4), label: 'controller', sub: 'Raft quorum', icon: 'Network', tint: 'amber' },
          { id: 'cons', kind: 'worker', at: at(5.4, 0), label: 'consumer groups', sub: 'commit offsets' },
        ],
        links: [link('prod', 'cluster'), link('cluster', 'cons'), link('ctl', 'cluster', { style: 'faint' })],
        flows: [
          { path: ['prod', 'cluster', 'cons'], tone: 'event', label: 'message', count: 2, duration: 2.6 },
        ],
        panel: {
          title: 'Design summary',
          icon: 'List',
          rows: [
            { text: 'Storage', value: 'segmented log', tone: 'good' },
            { text: 'Scale', value: '200 partitions', tone: 'good' },
            { text: 'Durability', value: 'RF 3, acks=all', tone: 'good' },
            { text: 'Delivery', value: 'at least once + dedupe', tone: 'good' },
            { text: 'Failure', value: 'ISR election, zones', tone: 'good' },
          ],
        },
        caption: 'Partitioned, replicated, consumer-positioned',
      },
      quiz: {
        question: 'A topic has 200 partitions and its consumer group has 300 consumers. What is the effect of the extra 100 consumers?',
        options: [
          'They speed up the group by sharing partitions',
          'They sit idle, because a partition has one reader per group',
          'They read the same partitions and cause duplicates',
          'The broker rejects them with an error',
        ],
        answer: 1,
        explain: 'Within a group each partition is assigned to exactly one consumer, so parallelism is capped at the partition count. The extra consumers wait as standbys in case another one dies.',
      },
    },
  ],
};
