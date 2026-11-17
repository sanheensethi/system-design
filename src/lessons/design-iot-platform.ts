import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const dev: SceneNode = { id: 'dev', kind: 'block', at: at(-5, -2), label: 'devices', sub: '100M sensors', icon: 'Cpu', tint: 'teal' };
const broker: SceneNode = { id: 'broker', kind: 'block', at: at(-1.5, -2), label: 'MQTT brokers', sub: 'long-lived links', icon: 'Router', tint: 'violet' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(2, -2), label: 'ingest log', sub: 'partitioned' };
const rules: SceneNode = { id: 'rules', kind: 'block', size: 0.8, at: at(5, -2), label: 'rules engine', icon: 'Workflow', tint: 'amber' };
const tsdb: SceneNode = { id: 'tsdb', kind: 'db', at: at(-1.5, 2.5), label: 'time-series DB', sub: '90 days hot' };
const cold: SceneNode = { id: 'cold', kind: 'storage', at: at(2, 2.5), label: 'cold storage', sub: '2 years' };
const shadow: SceneNode = { id: 'shadow', kind: 'block', size: 0.8, at: at(5, 2.5), label: 'shadow svc', icon: 'FileJson', tint: 'blue' };
const app: SceneNode = { id: 'app', kind: 'phone', at: at(-5, 2.5), label: 'owner app', sub: 'sets thermostat' };

export const designIotPlatform: Lesson = {
  id: 'design-iot-platform',
  title: 'Design an IoT platform',
  tagline: 'Connect 100 million devices, take 333,000 messages a second, keep their state, and update their firmware without bricking them.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Requirements and napkin math: 100M devices, 20M live connections, 333K msg/s, 520 TB hot',
    'MQTT versus HTTP, topics, QoS levels and per-device certificates',
    'Broker fleets, connection handling and the ingest log that absorbs peaks',
    'The rules engine and the time-series store with hot and cold tiers',
    'Device shadows, staged OTA rollouts, edge compute, and how the platform survives reconnect storms',
  ],
  metrics: [
    { key: 'devices', label: 'Devices', icon: 'Cpu' },
    { key: 'conns', label: 'Connections', icon: 'Plug' },
    { key: 'rate', label: 'Messages', icon: 'Activity' },
    { key: 'store', label: 'Hot storage', icon: 'HardDrive' },
  ],
  steps: [
    {
      title: 'One by one',
      tag: 'problem',
      heading: 'A thermostat company hits 100 million devices',
      eli5: 'A school gets 100 million kids, each with a walkie-talkie. One teacher cannot hear them all, and the kids who go home still want their messages waiting.',
      body: [
        'A company sells thermostats, trackers and farm sensors. Each device reports a reading every minute and expects commands back, such as "set 70 degrees".',
        'The first backend was one web server that every device polled over HTTPS. That worked at 10,000 devices. At 100 million it cannot hold the connections, the writes, or the history.',
      ],
      keyIdea: 'An IoT platform is a write-heavy system with millions of long-lived connections and devices that are often offline.',
      metrics: { devices: '100M', conns: '?', rate: '?', store: '?' },
      metricTones: { conns: 'bad', rate: 'bad' },
      scene: {
        nodes: [
          { ...dev, status: 'hot', badge: '100M devices' },
          { id: 'one', kind: 'server', at: at(0, -2), label: 'one server', sub: 'polled over HTTPS', status: 'hot', load: 100 },
          { id: 'db1', kind: 'db', at: at(4, -2), label: 'database', sub: 'one box' },
        ],
        links: [link('dev', 'one', { label: 'HTTPS poll', labelTone: 'warn' }), link('one', 'db1')],
        flows: [
          { path: ['dev', 'one'], tone: 'request', label: 'GET /cmd', count: 3, duration: 1.2 },
          { path: ['one', 'db1'], tone: 'data', label: 'INSERT', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What the old design faces',
          icon: 'Table',
          rows: [
            { text: 'Registered devices', value: '100M' },
            { text: 'Reports per device', value: '1 per minute' },
            { text: 'Commands', value: 'any time', tone: 'warn' },
            { text: 'Devices online', value: 'often not', tone: 'warn' },
          ],
          footer: { text: 'One server cannot hold this', tone: 'bad' },
        },
        caption: 'Polling does not scale to a fleet',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What the platform must do',
      eli5: 'The playground needs a gate teacher who hears every kid, a notebook of what each kid said, a helper who sorts the messages, and a way to hand out new uniforms safely.',
      body: [
        '**Functional:** devices connect over MQTT, HTTPS or WebSocket. Each device authenticates on its own. Telemetry is ingested and stored. A **device shadow** keeps last-known and wanted state. A **rules engine** routes messages. **OTA** updates roll out in stages. Some logic runs at the **edge**.',
        '**Non-functional:** millions of long-lived connections, bursts at peak, offline devices, and a compromised device must not hurt the fleet.',
      ],
      keyIdea: 'Write the requirements down first. Each later step answers one of them.',
      metrics: { devices: '100M', conns: '?', rate: '?', store: '?' },
      scene: {
        nodes: [{ ...dev, status: 'active' }, { ...broker, tint: 'gray' }, { ...shadow, at: at(1.5, 2.5), tint: 'gray' }, { ...rules, tint: 'gray' }],
        links: [link('dev', 'broker'), link('broker', 'shadow'), link('broker', 'rules')],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Connect: MQTT, HTTPS, WebSocket' },
            { text: 'Auth per device (X.509 or JWT)' },
            { text: 'Telemetry ingest and storage' },
            { text: 'Device shadow for offline devices' },
            { text: 'Rules engine and routing' },
            { text: 'OTA rollout and edge compute' },
          ],
        },
        caption: 'Seven jobs, one platform',
      },
    },
    {
      title: 'Napkin math',
      tag: 'concept',
      heading: 'The numbers that shape everything',
      eli5: 'If every kid says one sentence a minute and the playground has 100 million kids, the notebook fills with a mountain of sentences. Count first, then pick the tools.',
      body: [
        'Of 100M registered devices, only about 20M are connected at any moment. Offline devices cannot publish, so the rate comes from the connected ones: 20M x 1 message a minute is about **333K msg/s** steady, with peaks near 2M msg/s when fleets reconnect and flush buffered readings. At 200 bytes each, that is **67 MB/s**, about 0.5 Gbps.',
        'Keeping 90 days hot: 20M x 1,440 points a day x 90 x 200 bytes is about **520 TB**. Older data moves to cold storage for 2 years.',
      ],
      keyIdea: 'Connections, write rate and retention each break a different component. Size them separately.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      metricTones: { conns: 'warn', rate: 'warn', store: 'warn' },
      scene: {
        nodes: [
          { ...dev, at: at(-5.5, -2), badge: '100M' },
          { ...broker, at: at(-2, -2), chips: ['20M connected'] },
          { ...queue, at: at(1.5, -2) },
          { ...tsdb, at: at(5, -2), chips: ['520 TB hot'] },
        ],
        links: [link('dev', 'broker', { label: '333K msg/s' }), link('broker', 'queue'), link('queue', 'tsdb', { label: '67 MB/s' })],
        flows: [
          { path: ['dev', 'broker'], tone: 'data', count: 4, duration: 1.2 },
          { path: ['broker', 'queue', 'tsdb'], tone: 'data', count: 4, duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Napkin math',
          icon: 'Gauge',
          rows: [
            { text: 'Steady rate', value: '333K msg/s' },
            { text: 'Peak rate', value: '2M msg/s', tone: 'warn' },
            { text: 'Bandwidth', value: '67 MB/s' },
            { text: 'Live connections', value: '20M', tone: 'warn' },
            { text: 'Hot storage, 90 days', value: '520 TB', tone: 'warn' },
          ],
        },
        caption: 'Size connections, writes and storage separately',
      },
    },
    {
      title: 'MQTT',
      tag: 'tradeoff',
      heading: 'Why devices speak MQTT, not plain HTTP',
      eli5: 'Instead of every kid running to the teacher each minute to ask "anything for me?", each kid keeps the walkie-talkie on, and the teacher speaks only when there is news.',
      body: [
        '**MQTT** keeps one long-lived TCP connection per device and pushes messages both ways with tiny headers. Devices **publish** to topics and **subscribe** to topics. HTTP polling pays a handshake every time.',
        'Three **QoS** levels: 0 at most once, 1 at least once, 2 exactly once. Some firewalls block ports 1883 and 8883, so keep HTTPS and WebSocket as fallbacks. For tiny battery devices, **CoAP** over UDP is the constrained alternative.',
      ],
      keyIdea: 'MQTT trades firewall friendliness for low overhead, push delivery and delivery guarantees.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [{ ...dev, chips: ['PUBLISH temp'] }, { ...broker, status: 'active', chips: ['SUBSCRIBE cmd'] }, { id: 'web', kind: 'server', at: at(2.5, -2), label: 'HTTPS API', sub: 'fallback' }],
        links: [link('dev', 'broker', { label: 'MQTT over TLS, 1 connection' }), link('broker', 'web', { style: 'dashed' })],
        flows: [
          { path: ['dev', 'broker'], tone: 'request', label: 'PUBLISH', duration: 1.2 },
          { path: ['broker', 'dev'], tone: 'response', label: 'PUBACK', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'QoS levels',
          icon: 'Signal',
          rows: [
            { text: 'QoS 0', value: 'at most once' },
            { text: 'QoS 1', value: 'at least once', tone: 'good' },
            { text: 'QoS 2', value: 'exactly once' },
            { text: 'Ports 1883 / 8883', value: 'may be blocked', tone: 'warn' },
          ],
          footer: { text: 'Telemetry usually uses QoS 1', tone: 'muted' },
        },
        caption: 'One connection, push both ways',
      },
    },
    {
      title: 'Topics and API',
      tag: 'concept',
      heading: 'The API is a topic tree plus a few REST calls',
      eli5: 'Each kid has a mailbox label on the gate: "kid 42 says" and "tell kid 42". Anyone who wants to hear kid 42 listens to that one label.',
      body: [
        'Devices publish to `devices/{id}/telemetry` and subscribe to `devices/{id}/cmd`. The broker forbids a device from touching any other id.',
        'Apps use REST for the control plane: register a device, read or set a shadow, start a rollout. Telemetry never goes through REST.',
      ],
      keyIdea: 'Data plane over MQTT topics, control plane over REST.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [{ ...dev, chips: ['devices/42/telemetry'] }, { ...broker, status: 'active' }, { ...app, chips: ['PUT /devices/42/shadow'] }],
        links: [link('dev', 'broker'), link('app', 'broker')],
        flows: [
          { path: ['dev', 'broker'], tone: 'data', label: '{"temp":72}', duration: 1.3 },
          { path: ['app', 'broker', 'dev'], tone: 'request', label: 'cmd', duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Surface',
          icon: 'Code',
          code: 'MQTT  devices/{id}/telemetry  pub\nMQTT  devices/{id}/cmd        sub\nMQTT  devices/{id}/shadow/#   both\nPOST  /devices            register\nGET   /devices/{id}/shadow\nPOST  /rollouts           start OTA',
        },
        caption: 'A device only sees its own topics',
      },
      code: {
        language: 'bash',
        title: 'A device and an app, in MQTT and REST',
        source: `# device: report a reading with QoS 1
mosquitto_pub -h iot.example -p 8883 --cert dev42.crt --key dev42.key \\
  -t devices/42/telemetry -q 1 -m '{"temp":72,"ts":1767225600}'

# device: wait for commands
mosquitto_sub -h iot.example -p 8883 --cert dev42.crt --key dev42.key \\
  -t devices/42/cmd -q 1

# app: change the wanted state
curl -X PUT https://api.iot.example/devices/42/shadow \\
  -d '{"desired":{"temp":70}}'`,
        highlight: [3, 7, 10],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Three kinds of data, three kinds of store',
      eli5: 'The school keeps a roster of every kid, a diary of what kids said over time, and one sticky note per kid with what they are doing right now. Each lives in a different place.',
      body: [
        'The **registry** holds who a device is: id, certificate fingerprint, owner, model, firmware. It is small and relational. **Telemetry** is append-only points keyed by device and time. The **shadow** is one JSON document per device, looked up by id.',
        'Different access patterns, so different stores: a relational table, a time-series database, and a key-value store.',
      ],
      keyIdea: 'Pick the store from the access pattern: point lookup, append by time, or relational lookup.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { id: 'reg', kind: 'db', at: at(-4, 0), label: 'registry', sub: 'who is who' },
          { ...tsdb, at: at(0, 0), sub: 'points by time' },
          { ...shadow, at: at(4, 0), sub: 'key-value by id' },
        ],
        panel: {
          title: 'Three shapes',
          icon: 'Table',
          rows: [
            { text: 'Registry', value: 'device_id, cert, owner' },
            { text: 'Telemetry', value: '(device_id, ts, value)' },
            { text: 'Shadow', value: 'JSON, version' },
          ],
          footer: { text: 'See the data modeling and time-series lessons', tone: 'muted' },
        },
        caption: 'One store per access pattern',
      },
      code: {
        language: 'sql',
        title: 'Registry and telemetry',
        source: `CREATE TABLE devices (
  device_id   BIGINT PRIMARY KEY,
  cert_sha256 TEXT NOT NULL,
  owner_id    BIGINT NOT NULL,
  model       TEXT,
  fw_version  TEXT
);

CREATE TABLE telemetry (        -- time-series store
  device_id BIGINT,
  ts        TIMESTAMP,
  metric    TEXT,
  value     DOUBLE PRECISION
);`,
        highlight: [3, 10, 11],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple design: one broker, one database',
      eli5: 'Start small: one teacher at the gate with one notebook. Every kid talks to that teacher, and the teacher writes it all down.',
      body: [
        'Devices connect to one MQTT broker. A small consumer reads each message and inserts a row into one database. Commands go back down the same connection.',
        'It is correct, and it is a fine design for 5,000 devices: 90 days of points is only about 130 GB (5,000 x 1,440 x 90 x 200 B), far below the 520 TB at full scale. Next we see where 100 million breaks it.',
      ],
      keyIdea: 'Build the simple version first so each later fix has a visible reason.',
      metrics: { devices: '5K', conns: '5K', rate: '83/s', store: '130 GB' },
      metricTones: { conns: 'good', rate: 'good' },
      scene: {
        nodes: [{ ...dev, sub: '5,000 sensors' }, { ...broker, sub: 'one broker', status: 'ok' }, { id: 'db1', kind: 'db', at: at(2, -2), label: 'database', sub: 'one box', status: 'ok' }],
        links: [link('dev', 'broker', { label: 'MQTT' }), link('broker', 'db1')],
        flows: [
          { path: ['dev', 'broker', 'db1'], tone: 'data', label: 'telemetry', duration: 1.8 },
          { path: ['broker', 'dev'], tone: 'request', label: 'cmd', duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'Small fleet math',
          icon: 'Gauge',
          rows: [
            { text: '5,000 devices x 1/min', value: '83 msg/s', tone: 'good' },
            { text: 'Connections', value: '5,000', tone: 'good' },
            { text: '90 days of points', value: '130 GB', tone: 'good' },
          ],
        },
        caption: 'Fine at 5,000 devices',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'problem',
      heading: 'Twenty million connections do not fit on one box',
      eli5: 'One teacher cannot keep 20 million walkie-talkies on at once. Even if each kid is quiet, holding the line open for every kid is too much.',
      body: [
        'Idle connections still cost memory and a file descriptor each. 20M of them need far more than one machine. The single broker is also one failure away from silencing the whole fleet.',
        'The single database fails too: 333K inserts a second and a 520 TB history. The connection layer and the storage layer must scale on their own.',
      ],
      keyIdea: 'Hold connections in one tier, store data in another, and scale each separately.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      metricTones: { conns: 'bad', rate: 'bad', store: 'bad' },
      scene: {
        nodes: [{ ...dev, status: 'hot' }, { ...broker, sub: 'one broker', status: 'down', load: 100 }, { id: 'db1', kind: 'db', at: at(2, -2), label: 'database', sub: 'one box', status: 'hot', load: 100 }],
        links: [link('dev', 'broker', { label: '20M connections', labelTone: 'bad' }), link('broker', 'db1', { label: '333K inserts/s', labelTone: 'bad' })],
        flows: [{ path: ['dev', 'broker'], tone: 'error', label: 'refused', count: 3, duration: 1.2 }],
        panel: {
          title: 'Limits hit',
          icon: 'Bug',
          rows: [
            { text: 'File descriptors', value: 'exhausted', tone: 'bad' },
            { text: 'Connection memory', value: '20M x 10 KB = 200 GB', tone: 'bad' },
            { text: 'Insert rate', value: '333K/s', tone: 'bad' },
            { text: 'Single point of failure', value: 'yes', tone: 'bad' },
          ],
        },
        caption: 'Both tiers fall over',
      },
    },
    {
      title: 'Broker fleet',
      tag: 'concept',
      heading: 'A fleet of brokers built for C10M',
      eli5: 'Hire 2,000 gate teachers. Each one keeps a light list of about 10,000 kids, using an efficient way of listening that costs almost nothing for quiet kids.',
      body: [
        'Brokers use **epoll**-style event loops, no thread per connection, and about 10 KB of state per connection. A tuned node can hold over 1M connections.',
        'We size conservatively: **2,000 brokers x 10,000 connections = 20M**, with headroom. A load balancer spreads new connections, and a device reconnects to any broker.',
      ],
      keyIdea: 'Connection handling is its own tier: event loops, tiny per-connection state, and many nodes.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      metricTones: { conns: 'good' },
      scene: {
        nodes: [
          { ...dev, at: at(-6.5, -2) },
          { id: 'lb', kind: 'lb', at: at(-2.5, -2), label: 'load balancer', sub: 'layer 4' },
          { ...broker, at: at(1.5, -2), label: 'MQTT brokers', sub: '2,000 x 10K conns', status: 'ok', chips: ['10K conns each'] },
        ],
        links: [link('dev', 'lb'), link('lb', 'broker')],
        flows: [{ path: ['dev', 'lb', 'broker'], tone: 'handshake', label: 'CONNECT', count: 2, duration: 1.8 }],
        panel: {
          title: 'Connection budget',
          icon: 'Plug',
          rows: [
            { text: 'State per connection', value: '~10 KB' },
            { text: 'Brokers', value: '2,000' },
            { text: 'Connections each', value: '10,000', tone: 'good' },
            { text: 'Total', value: '20M', tone: 'good' },
          ],
          footer: { text: 'See the load balancing lesson', tone: 'muted' },
        },
        caption: 'Many small brokers, no thread per device',
      },
      quiz: {
        question: 'Why can one tuned broker node hold a million idle connections?',
        options: [
          'It stores no state for them',
          'An event loop with tiny per-connection state, instead of a thread per connection',
          'Devices share a single TCP connection',
          'It drops idle devices after a second',
        ],
        answer: 1,
        explain: 'Idle connections cost only a small state record and a file descriptor when one event loop watches them all. A thread per connection would exhaust memory long before a million.',
      },
    },
    {
      title: 'Fan-out',
      tag: 'concept',
      heading: 'Delivering a command to the right broker',
      eli5: 'Kid 42 stands at gate teacher 1,337, but the parent calls teacher 5. Teacher 5 needs a phone book that says which teacher has kid 42.',
      body: [
        'An app sends a command for device 42. Device 42 is connected to one specific broker out of 2,000. The cluster needs a shared **topic and session registry** so any broker can forward to the right one.',
        'Keep that registry in a gossip mesh or a Raft-backed store, or look up the owner with the **consistent hashing** lesson idea. Connecting is easy. Fan-out across the cluster is the hard part.',
      ],
      keyIdea: 'The cluster must know which broker holds which device, or commands go nowhere.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { ...app, at: at(-5, -2), chips: ['cmd for 42'] },
          { id: 'b5', kind: 'block', size: 0.8, at: at(-1.5, -2), label: 'broker 5', icon: 'Router', tint: 'violet' },
          { id: 'reg', kind: 'db', at: at(-1.5, 2.5), label: 'session registry', sub: '42 -> broker 1337' },
          { id: 'b1337', kind: 'block', size: 0.8, at: at(2, -2), label: 'broker 1337', icon: 'Router', tint: 'violet', status: 'active' },
          { ...dev, at: at(5.5, -2), label: 'device 42', sub: 'online' },
        ],
        links: [link('app', 'b5'), link('b5', 'reg', { arrow: 'both' }), link('b5', 'b1337', { label: 'forward' }), link('b1337', 'dev')],
        flows: [
          { path: ['app', 'b5', 'reg', 'b5'], tone: 'request', label: 'where is 42?', duration: 2, count: 1 },
          { path: ['b5', 'b1337', 'dev'], tone: 'request', label: 'cmd', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Registry entry',
          icon: 'Table',
          rows: [
            { text: 'device 42', value: 'broker 1337' },
            { text: 'session', value: 'clean=false' },
            { text: 'subscriptions', value: 'devices/42/cmd' },
          ],
        },
        caption: 'Look up the owner, then forward',
      },
    },
    {
      title: 'Device auth',
      tag: 'concept',
      heading: 'Every device proves who it is with its own certificate',
      eli5: 'Each kid gets a special badge at the factory that only they have. The gate teacher checks the badge before letting anyone speak, and can cancel a lost badge.',
      body: [
        'Each device holds a private key and an **X.509 certificate** (or a JWT) and connects with **mutual TLS**. The broker checks the certificate against the registry, then applies topic rules: device 42 may only use `devices/42/#`.',
        'Certificates can be **revoked** and rotated. The cost is operational: keys must be provisioned at manufacturing time. See the encryption and HTTP and TLS lessons.',
      ],
      keyIdea: 'Per-device identity makes one stolen device revocable without touching the other 99,999,999.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { ...dev, chips: [{ text: 'cert: dev42', tone: 'good' }] },
          { ...broker, at: at(-1.5, -2) },
          { id: 'ca', kind: 'vault', at: at(2, -2), label: 'device CA', sub: 'issues and revokes' },
        ],
        links: [link('dev', 'broker', { label: 'mutual TLS' }), link('broker', 'ca', { style: 'dashed', label: 'revocation list' })],
        flows: [
          { path: ['dev', 'broker'], tone: 'handshake', label: 'client cert', duration: 1.4 },
          { path: ['broker', 'dev'], tone: 'handshake', label: 'server cert', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Auth choices',
          icon: 'Key',
          rows: [
            { text: 'Per-device cert', value: 'revocable', tone: 'good' },
            { text: 'Shared fleet key', value: 'one leak ruins all', tone: 'bad' },
            { text: 'Provisioning', value: 'at the factory', tone: 'warn' },
          ],
        },
        caption: 'The broker checks the badge first',
      },
    },
    {
      title: 'Ingest log',
      tag: 'concept',
      heading: 'A log between the brokers and everything else',
      eli5: 'Teachers drop every note into a big sorted mail chute instead of handing it to the helper. The helpers pick notes up at their own speed, even when a rush of kids all talk at once.',
      body: [
        'Brokers publish each message to a partitioned **ingest log**, keyed by device id. Peaks of 2M msg/s pile up in the log instead of crushing the database.',
        'Consumers (rules, storage, alerts) read at their own pace and can replay. This is the **message queue** and **back-pressure** lessons applied to telemetry.',
      ],
      keyIdea: 'A log decouples a bursty producer fleet from slower consumers.',
      metrics: { devices: '100M', conns: '20M', rate: '2M/s peak', store: '520 TB' },
      metricTones: { rate: 'warn' },
      scene: {
        nodes: [{ ...broker, at: at(-5, -2) }, { ...queue, at: at(-0.5, -2), status: 'active', chips: ['partition = hash(device_id)'] }, { ...rules, at: at(4, -2), size: 0.8 }],
        links: [link('broker', 'queue', { label: '2M msg/s peak' }), link('queue', 'rules')],
        flows: [
          { path: ['broker', 'queue'], tone: 'event', count: 4, duration: 1.1 },
          { path: ['queue', 'rules'], tone: 'event', count: 2, duration: 1.6, delay: 1.2 },
        ],
        panel: {
          title: 'Peak absorbed',
          icon: 'Inbox',
          rows: [
            { text: 'Steady in', value: '333K/s' },
            { text: 'Peak in', value: '2M/s', tone: 'warn' },
            { text: 'Consumers', value: 'replay on failure', tone: 'good' },
          ],
        },
        caption: 'Peaks queue up instead of failing',
      },
      quiz: {
        question: 'Why put an ingest log between the brokers and the consumers?',
        options: [
          'It makes devices connect faster',
          'It absorbs peaks of 2M msg/s so consumers can read at their own pace',
          'It encrypts telemetry',
          'It removes the need for a time-series database',
        ],
        answer: 1,
        explain: 'Bursts pile up in the log instead of overloading storage and rules. Consumers keep their own position and can replay after a failure.',
      },
    },
    {
      title: 'Rules engine',
      tag: 'concept',
      heading: 'A rules engine routes messages with SQL',
      eli5: 'A sorting helper reads each note and follows a simple rule: "if a kid says it is hot, call the nurse; otherwise put the note in the diary."',
      body: [
        'Customers write rules as SQL over the stream, run by a stream processor: `SELECT * FROM telemetry WHERE temp > 90`. A match triggers an action: call a function or write to object storage.',
        'Rules are one consumer of the ingest log. A separate storage consumer writes every row to the time-series store, so a slow or broken rule never delays storage. See the stream processing lesson.',
      ],
      keyIdea: 'Routing is configuration, not code in the broker. Rules and storage read the same log independently.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { ...queue, at: at(-4, -2) },
          { ...rules, at: at(-0.5, -2), size: 1, status: 'active' },
          { id: 'fn', kind: 'worker', at: at(3, -2), label: 'alert function', sub: 'temp > 90' },
          { id: 'sink', kind: 'worker', at: at(-1.5, 4.5), label: 'storage consumer', sub: 'every row' },
          { ...tsdb, at: at(3.5, 4.5) },
        ],
        links: [link('queue', 'rules'), link('rules', 'fn', { label: 'matches' }), link('queue', 'sink'), link('sink', 'tsdb', { label: 'all rows' })],
        flows: [
          { path: ['queue', 'rules'], tone: 'event', count: 3, duration: 1.2 },
          { path: ['rules', 'fn'], tone: 'request', label: 'temp 95', duration: 1.3, delay: 1.3 },
          { path: ['queue', 'sink', 'tsdb'], tone: 'data', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Rule',
          icon: 'Workflow',
          code: "SELECT device_id, temp\nFROM telemetry\nWHERE temp > 90\n-- action: invoke alert-fn\n-- storage is a separate consumer",
        },
        caption: 'SQL over the stream decides where data goes',
      },
    },
    {
      title: 'Time-series store',
      tag: 'concept',
      heading: 'Hot and cold tiers for 520 TB of points',
      eli5: 'The diary for this term stays on the teacher desk where it is quick to read. Older diaries go to the basement shelf, cheaper and slower.',
      body: [
        'A **time-series database** (Timestream, InfluxDB, TimescaleDB) partitions by time and device and compresses well. Keep **90 days hot** (520 TB) for dashboards and queries.',
        'After that, move data to cold object storage for 2 years, often downsampled to hourly values. Queries almost always ask for one device over a time range, which the layout serves directly.',
      ],
      keyIdea: 'Recent data is queried constantly, old data rarely. Tier by age and pay for each accordingly.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [{ id: 'sink', kind: 'worker', at: at(-4, -2), label: 'storage consumer', sub: 'reads the log' }, { ...tsdb, at: at(-0.5, -2), status: 'active', chips: ['90 days'] }, { ...cold, at: at(3, -2), chips: ['2 years'] }],
        links: [link('sink', 'tsdb', { label: 'append' }), link('tsdb', 'cold', { label: 'age out, downsample' })],
        flows: [
          { path: ['sink', 'tsdb'], tone: 'data', count: 3, duration: 1.2 },
          { path: ['tsdb', 'cold'], tone: 'data', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Retention',
          icon: 'HardDrive',
          rows: [
            { text: 'Hot, 90 days', value: '520 TB' },
            { text: 'Cold, 2 years', value: 'object storage', tone: 'good' },
            { text: 'Query shape', value: 'device + time range' },
          ],
          footer: { text: 'See the time-series database lesson', tone: 'muted' },
        },
        caption: 'Hot for dashboards, cold for history',
      },
      quiz: {
        question: 'Why move data older than 90 days to cold storage and downsample it?',
        options: [
          'Old data is queried rarely, so cheap storage and hourly values cut cost with little loss',
          'Cold storage is faster for dashboards',
          'The time-series database cannot store old timestamps',
          'It removes the need for per-device certificates',
        ],
        answer: 0,
        explain: 'Recent data is read constantly and old data rarely. Cheap object storage and coarser values keep history affordable while the hot tier stays small and fast.',
      },
    },
    {
      title: 'Device shadow',
      tag: 'concept',
      heading: 'A device shadow is the twin that is always online',
      eli5: 'Each kid has a sticky note at the gate. It says what the kid last told us and what the grown-up wants them to do. The note is always there, even when the kid is not.',
      body: [
        'The **shadow** is a JSON document per device with `reported` (what the device last said), `desired` (what the app wants) and a `version`. It lives in a key-value store keyed by device id.',
        'Apps talk to the shadow, never to the device. That decouples the app from whether the device is connected right now.',
      ],
      keyIdea: 'The shadow decouples app and device lifecycles. It is the defining feature of an IoT platform.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [{ ...app, at: at(-4, -2) }, { ...shadow, at: at(-0.5, -2), size: 1, status: 'active' }, { ...dev, at: at(3.5, -2), sub: 'online' }],
        links: [link('app', 'shadow', { label: 'REST' }), link('shadow', 'dev', { label: 'MQTT' })],
        flows: [
          { path: ['app', 'shadow'], tone: 'request', label: 'desired 70', duration: 1.3 },
          { path: ['shadow', 'dev'], tone: 'request', label: 'delta', duration: 1.3, delay: 1.4 },
          { path: ['dev', 'shadow'], tone: 'response', label: 'reported 70', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Shadow document',
          icon: 'FileJson',
          code: '{\n  "state": {\n    "reported": { "temp": 72 },\n    "desired":  { "temp": 70 }\n  },\n  "version": 42\n}',
        },
        caption: 'Apps write desired, devices write reported',
      },
    },
    {
      title: 'Presence',
      tag: 'concept',
      heading: 'How the platform knows a device is online',
      eli5: 'Each kid taps the teacher on the shoulder every minute. If the taps stop, the teacher writes "gone" on the sticky note. A kid can also leave a note that says "if I vanish, write gone".',
      body: [
        'MQTT has presence built in. The device sets a **keep-alive** interval, such as 60 seconds, and pings the broker. If the broker hears nothing for about 1.5 times that interval, it drops the session.',
        'At connect time the device registers a **last will and testament**: a message the broker publishes if the device vanishes without a clean disconnect. The will sets `status = offline`, and a **retained message** on the status topic holds the latest value so any new subscriber sees it at once.',
      ],
      keyIdea: 'Keep-alive detects silence, the last will announces it, and a retained message stores the last state.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { ...dev, at: at(-4, -2), chips: ['keep-alive 60s'] },
          { ...broker, at: at(-0.5, -2), status: 'active', chips: ['will: offline'] },
          { ...shadow, at: at(3.5, -2), chips: ['status retained'] },
        ],
        links: [link('dev', 'broker', { label: 'PINGREQ' }), link('broker', 'shadow', { label: 'will fires' })],
        flows: [
          { path: ['dev', 'broker'], tone: 'request', label: 'ping', duration: 1.2 },
          { path: ['broker', 'shadow'], tone: 'event', label: 'offline', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Presence tools',
          icon: 'Signal',
          rows: [
            { text: 'Keep-alive', value: 'detects silence' },
            { text: 'Last will', value: 'publishes offline', tone: 'good' },
            { text: 'Retained message', value: 'last state for new subscribers', tone: 'good' },
          ],
          footer: { text: 'Connect publishes online, the will publishes offline', tone: 'muted' },
        },
        caption: 'Silence becomes an offline status',
      },
    },
    {
      title: 'Offline devices',
      tag: 'case',
      heading: 'Case: the app changes a device that is offline',
      eli5: 'Kid 42 is home sick. The grown-up writes "wear the red hat" on the sticky note. When the kid comes back, the teacher reads out only what is different.',
      body: [
        'The app sets `desired.temp = 70` while the thermostat is offline. The shadow stores it and the app gets an immediate success.',
        'When the device reconnects, the broker sends the **delta** between `reported` and `desired`. The device applies it and updates `reported`, and the delta disappears.',
      ],
      keyIdea: 'Write the intent now, deliver the delta on reconnect.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [{ ...app, at: at(-4, -2) }, { ...shadow, at: at(-0.5, -2) }, { ...dev, at: at(3.5, -2), sub: 'offline', status: 'down' }],
        links: [link('app', 'shadow'), link('shadow', 'dev', { style: 'dashed' })],
        flows: [{ path: ['app', 'shadow'], tone: 'request', label: 'desired 70', duration: 1.3 }],
        panel: {
          title: 'While offline',
          icon: 'Table',
          rows: [
            { text: 'reported.temp', value: '72' },
            { text: 'desired.temp', value: '70', tone: 'warn' },
            { text: 'delta', value: 'temp: 70', tone: 'warn' },
          ],
          footer: { text: 'Delivered when the device reconnects', tone: 'muted' },
        },
        caption: 'The shadow holds the wish until the device is back',
      },
      code: {
        language: 'json',
        title: 'Delta sent on reconnect',
        source: `{
  "state": {
    "reported": { "temp": 72, "fw": "1.2.3" },
    "desired":  { "temp": 70, "fw": "1.2.3" }
  },
  "delta": { "temp": 70 },
  "version": 43
}`,
        highlight: [5, 6],
      },
    },
    {
      title: 'Shadow conflicts',
      tag: 'tradeoff',
      heading: 'Who wins when two writers disagree',
      eli5: 'Two grown-ups write different wishes on the same sticky note. The teacher keeps a counter on each note so a late, outdated wish can be turned away.',
      body: [
        'A phone and a wall panel both write `desired` at once. Each shadow carries a `version`, and a write says which version it read. A stale write is rejected and the client re-reads, or per-field timestamps decide.',
        'The benefit is that apps work offline. The cost is consistency headaches. See the consistency models and clocks lessons.',
      ],
      keyIdea: 'Version every shadow write so a stale writer fails loudly instead of overwriting silently.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [{ ...app, at: at(-4, -2), label: 'phone app' }, { ...shadow, at: at(-0.5, -2), chips: ['version 42'] }, { id: 'panel', kind: 'client', at: at(3.5, -2), label: 'wall panel' }],
        links: [link('app', 'shadow'), link('panel', 'shadow')],
        flows: [
          { path: ['app', 'shadow'], tone: 'request', label: 'v42 -> 70', duration: 1.3 },
          { path: ['panel', 'shadow'], tone: 'error', label: 'v42 -> 68 stale', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Optimistic write',
          icon: 'Code',
          code: 'PUT /devices/42/shadow\n{ "desired": { "temp": 70 },\n  "expectedVersion": 42 }\n\n-> 200 version 43\n-> 409 if version moved',
        },
        caption: 'The second write sees version 43 and retries',
      },
    },
    {
      title: 'OTA rollout',
      tag: 'concept',
      heading: 'Roll firmware out in cohorts, never to everyone',
      eli5: 'A new school uniform goes to 1 class first. If nobody trips on it, the next day more classes get it, and finally the whole school.',
      body: [
        'A buggy firmware can brick millions of devices in minutes. So the OTA service targets a **cohort**: bucket by `hash(rolloutId + deviceId)`. Within one rollout a device keeps its bucket, so the 1% cohort stays inside the 5% cohort. The rolloutId rotates who goes first next time.',
        'Expand in waves: 1%, 5%, 25%, 100% over days. The device gets a message with a firmware URL, downloads from a CDN, checks the **signature**, and reports its version.',
      ],
      keyIdea: 'Stage every rollout. The blast radius of a bad build is the size of the current wave.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { id: 'ota', kind: 'block', at: at(-4, -2), label: 'OTA service', sub: 'version registry', icon: 'Download', tint: 'green' },
          { ...broker, at: at(-0.5, -2), tint: 'violet' },
          { ...dev, at: at(3.5, -2), label: 'cohort 1%', sub: '1M devices', status: 'active' },
        ],
        links: [link('ota', 'broker', { label: 'target cohort' }), link('broker', 'dev')],
        flows: [{ path: ['ota', 'broker', 'dev'], tone: 'event', label: 'fw 1.2.4 url', duration: 2 }],
        panel: {
          title: 'Rollout waves',
          icon: 'TrendingUp',
          rows: [
            { text: 'Wave 1', value: '1%', tone: 'good' },
            { text: 'Wave 2', value: '5%' },
            { text: 'Wave 3', value: '25%' },
            { text: 'Wave 4', value: '100%' },
          ],
          footer: { text: 'bucket = hash(rolloutId:deviceId) mod 100, waves nest within a rollout', tone: 'muted' },
        },
        caption: 'Within a rollout each wave contains the last',
      },
      quiz: {
        question: 'Why bucket devices by hash(rolloutId + deviceId) for rollout waves?',
        options: [
          'It encrypts the firmware',
          'Waves nest inside one rollout, and a new rollout picks different early devices',
          'It lets the broker skip authentication',
          'It makes the download faster',
        ],
        answer: 1,
        explain: 'A hash is deterministic, so within one rollout the 1% cohort stays inside the 5% cohort. Adding the rolloutId reshuffles who goes first each time, so the same devices do not always carry the risk.',
      },
      code: {
        language: 'typescript',
        title: 'Cohort bucketing',
        source: `function inWave(deviceId: string, rolloutId: string, percent: number): boolean {
  // hash both so each rollout picks a different 1%
  const bucket = hash32(rolloutId + ':' + deviceId) % 100;
  return bucket < percent;
}

// wave 1: inWave(id, 'fw-1.2.4', 1)
// wave 2: inWave(id, 'fw-1.2.4', 5)`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Health gate',
      tag: 'concept',
      heading: 'A health gate halts the next wave, A/B slots undo the bad one',
      eli5: 'After the first class tries the uniform, a teacher counts the trips. Too many trips, and the next class waits. Each kid who tripped also swaps back to the old uniform from their own bag.',
      body: [
        'Between waves the OTA service waits N hours and reads the error rate from telemetry. Above the threshold it **auto-halts** the next wave. It does not reach into devices.',
        'Each device keeps the old image in an **A/B partition**. If the new image fails to boot, the device flips its own boot flag back to the old slot and reports the failure. The halt protects the rest of the fleet, and the A/B slot protects the device.',
      ],
      keyIdea: 'The service stops the spread. The device rolls itself back.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      metricTones: { devices: 'good' },
      scene: {
        nodes: [
          { id: 'ota', kind: 'block', at: at(-4, -2), label: 'OTA service', sub: 'next wave halted', icon: 'Download', tint: 'red', status: 'hot' },
          { ...tsdb, at: at(-0.5, -2), sub: 'error rate', chips: [{ text: 'errors 4.2%', tone: 'bad' }] },
          { ...dev, at: at(3.5, -2), label: 'cohort 1%', sub: 'booted slot A again', status: 'ok', chips: [{ text: 'boot failed: flip to A', tone: 'warn' }] },
        ],
        links: [link('dev', 'tsdb', { label: 'failure reports' }), link('tsdb', 'ota', { label: 'above 1%: halt' })],
        flows: [
          { path: ['dev', 'tsdb'], tone: 'error', label: 'boot failed', duration: 1.4 },
          { path: ['tsdb', 'ota'], tone: 'error', label: 'threshold hit', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Safety controls',
          icon: 'Shield',
          rows: [
            { text: 'Health gate', value: 'halts the next wave', tone: 'good' },
            { text: 'A/B partition', value: 'device flips its own boot flag', tone: 'good' },
            { text: 'Blast radius', value: 'current wave only', tone: 'good' },
          ],
        },
        caption: 'A bad build stops at 1%',
      },
      quiz: {
        question: 'A new firmware fails to boot on a device. Who restores the old image?',
        options: [
          'The OTA service sends a rollback command',
          'The device itself, by flipping its boot flag to the old A/B slot',
          'The load balancer',
          'The time-series database',
        ],
        answer: 1,
        explain: 'A device that cannot boot cannot receive commands. It must roll back on its own, while the OTA service only halts later waves.',
      },
    },
    {
      title: 'Edge compute',
      tag: 'concept',
      heading: 'Run some logic on the device or a nearby gateway',
      eli5: 'A hall monitor in each classroom handles easy jobs on the spot, like turning off the light, and only calls the office for the big stuff.',
      body: [
        '**Edge compute** (such as AWS Greengrass or Azure IoT Edge) runs rules and filters on a local gateway. It keeps working when the link to the cloud is down and cuts upstream traffic.',
        'The edge sends summaries, such as a 1-minute average, instead of every raw reading. Rules and code are deployed through the same OTA path.',
      ],
      keyIdea: 'Filter and decide near the device. Send the cloud what only the cloud can use.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { ...dev, at: at(-4, -2), label: 'sensors', sub: '10 per gateway' },
          { id: 'edge', kind: 'block', at: at(-0.5, -2), label: 'edge gateway', sub: 'local rules', icon: 'Cpu', tint: 'teal', status: 'active' },
          { ...broker, at: at(3.5, -2) },
        ],
        links: [link('dev', 'edge', { label: 'raw, 1 per second' }), link('edge', 'broker', { label: 'summary, 1 per minute' })],
        flows: [
          { path: ['dev', 'edge'], tone: 'data', count: 4, duration: 1.1 },
          { path: ['edge', 'broker'], tone: 'data', label: 'avg 71.8', duration: 1.5, delay: 1.3 },
        ],
        panel: {
          title: 'At the edge',
          icon: 'Router',
          rows: [
            { text: 'Works offline', value: 'yes', tone: 'good' },
            { text: 'Upstream traffic', value: '60x less', tone: 'good' },
            { text: 'Code updates', value: 'via OTA' },
          ],
        },
        caption: 'Summarize locally, send less',
      },
    },
    {
      title: 'Reconnect storm',
      tag: 'case',
      heading: 'Failure: a broker dies and 10,000 devices come back at once',
      eli5: 'Teacher 1,337 gets sick and all 10,000 of their kids run to other teachers at the same instant. If they spread out their arrival, nobody is crushed.',
      body: [
        'When a broker fails its devices reconnect together and can overload the next brokers and the auth path. Devices must use **exponential backoff with jitter**, and the load balancer should spread them.',
        'Sessions with `clean=false` can queue QoS 1 commands, but those queues survive a broker crash only if session state is replicated or stored outside the broker. The shadow delta is the dependable path after a failure: the device reconnects and gets whatever it missed. See the timeouts and retries lesson.',
      ],
      keyIdea: 'Reconnects are a thundering herd. Jittered backoff turns a spike into a ramp.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      metricTones: { conns: 'warn' },
      scene: {
        nodes: [
          { ...dev, at: at(-5, -2), label: '10K devices' },
          { id: 'bdown', kind: 'block', size: 0.8, at: at(-1.5, -2), label: 'broker 1337', icon: 'Router', tint: 'red', status: 'down' },
          { id: 'bnext', kind: 'block', size: 0.8, at: at(2.5, -2), label: 'other brokers', sub: 'headroom', icon: 'Router', tint: 'violet', status: 'ok', load: 70 },
        ],
        links: [link('dev', 'bdown', { style: 'dashed' }), link('dev', 'bnext', { label: 'backoff + jitter' })],
        flows: [{ path: ['dev', 'bnext'], tone: 'handshake', label: 'CONNECT', count: 3, duration: 2 }],
        panel: {
          title: 'Retry delay',
          icon: 'Timer',
          code: 'delay = min(60, 2^attempt)\ndelay = random(0, delay)\nwait(delay)\nreconnect()',
          footer: { text: 'Spread 10K devices over about a minute', tone: 'good' },
        },
        caption: 'Devices spread out their return',
      },
    },
    {
      title: 'Bad device',
      tag: 'case',
      heading: 'Failure: one noisy or hijacked device',
      eli5: 'One kid shouts into the walkie-talkie all day, or someone steals a badge. The teacher mutes that kid and cancels that badge, and the others keep talking.',
      body: [
        'A buggy device publishes 1,000 messages a second. A **per-device quota** at the broker throttles it before it fills the log, using the rate limiting lesson.',
        'A hijacked device gets its certificate revoked, so only that device is cut off. This is why each device has its own identity.',
      ],
      keyIdea: 'Limit and revoke per device so one bad actor cannot take down the fleet.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      scene: {
        nodes: [
          { ...dev, at: at(-5, -2), label: 'device 7', sub: '1,000 msg/s', status: 'hot' },
          { ...broker, at: at(-1.5, -2), chips: [{ text: 'quota: 10 msg/s', tone: 'warn' }] },
          { ...queue, at: at(2, -2), status: 'ok' },
        ],
        links: [link('dev', 'broker', { label: 'throttled', labelTone: 'warn' }), link('broker', 'queue')],
        flows: [
          { path: ['dev', 'broker'], tone: 'request', count: 4, duration: 1.0 },
          { path: ['broker', 'dev'], tone: 'error', label: 'disconnect, revoked', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'Blast radius',
          icon: 'Shield',
          rows: [
            { text: 'Device quota', value: '10 msg/s', tone: 'good' },
            { text: 'Revoke one cert', value: '1 device cut off', tone: 'good' },
            { text: 'Rest of the fleet', value: 'unaffected', tone: 'good' },
          ],
        },
        caption: 'Contain the problem to one device',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole platform in one picture',
      eli5: 'The playground now has many gate teachers, a mail chute, a sorting helper, a diary with a basement shelf, sticky notes, and safe uniform handouts.',
      body: [
        'Devices hold one MQTT connection to a **broker fleet** (2,000 x 10K = 20M). An **ingest log** absorbs 2M msg/s peaks. A **storage consumer** reads the log into a **time-series store** (90 days hot, 2 years cold), while the **rules engine** reads the same log for matches.',
        'The **shadow** serves offline devices, keep-alive and last will track presence, **OTA** rolls out in waves with health gates, signed images and A/B rollback, and per-device certificates and quotas contain failures.',
      ],
      keyIdea: 'Separate connections, ingest, storage and control, then protect each with a bound on the damage.',
      metrics: { devices: '100M', conns: '20M', rate: '333K/s', store: '520 TB' },
      metricTones: { devices: 'good', conns: 'good', rate: 'good', store: 'good' },
      scene: {
        nodes: [{ ...dev, at: at(-5, -2), status: 'ok' }, { ...broker, at: at(-1.5, -2), status: 'ok' }, { ...queue, at: at(1.5, -2), status: 'ok' }, { ...tsdb, at: at(4.5, 4), status: 'ok' }, { ...shadow, at: at(-3.25, 4), status: 'ok' }],
        links: [link('dev', 'broker'), link('broker', 'queue'), link('queue', 'tsdb', { label: 'storage consumer' }), link('broker', 'shadow')],
        flows: [
          { path: ['dev', 'broker', 'queue', 'tsdb'], tone: 'data', duration: 2.4 },
          { path: ['broker', 'shadow'], tone: 'request', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'Final numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Devices', value: '100M' },
            { text: 'Live connections', value: '20M' },
            { text: 'Telemetry', value: '333K msg/s' },
            { text: 'Hot storage', value: '520 TB' },
          ],
        },
        caption: 'Each tier scales on its own',
      },
      quiz: {
        question: 'A user sets a new target temperature while the thermostat is offline. What makes it work?',
        options: [
          'The app retries until the device is online',
          'The shadow stores desired state and the device receives the delta on reconnect',
          'The broker holds the HTTP request open',
          'The time-series database applies the change',
        ],
        answer: 1,
        explain: 'The shadow decouples the app from the device. The wish is stored, the app gets success at once, and the delta is delivered when the device reconnects.',
      },
    },
  ],
};
