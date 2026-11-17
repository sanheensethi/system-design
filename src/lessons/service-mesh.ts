import type { Lesson, SceneNode, SceneZone } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y), so spacing on screen is easy to reason about. */
const p = (col: number, row: number): [number, number] => [(row + col) / 2, (row - col) / 2];

const client: SceneNode = { id: 'client', kind: 'phone', at: p(-9, 0.8), label: 'shopper' };
const edge: SceneNode = { id: 'edge', kind: 'gateway', at: p(-6.5, 0.8), label: 'API gateway', sub: 'the front door' };
const orders: SceneNode = { id: 'orders', kind: 'service', at: p(-4, 0.8), label: 'orders', sub: 'Go' };
const opx: SceneNode = { id: 'opx', kind: 'gateway', at: p(-1.5, 0.8), label: 'sidecar', sub: 'orders proxy' };
const ppx: SceneNode = { id: 'ppx', kind: 'gateway', at: p(1.5, -2.5), label: 'sidecar', sub: 'payments proxy' };
const pay: SceneNode = { id: 'pay', kind: 'service', at: p(4, -2.5), label: 'payments', sub: 'Java' };
const spx: SceneNode = { id: 'spx', kind: 'gateway', at: p(1.5, 4.1), label: 'sidecar', sub: 'stock proxy' };
const stock: SceneNode = { id: 'stock', kind: 'service', at: p(4, 4.1), label: 'stock', sub: 'Python' };
const cp: SceneNode = { id: 'cp', kind: 'server', at: p(-1.5, -5.8), label: 'control plane', sub: 'config and certs' };
const metrics: SceneNode = { id: 'metrics', kind: 'monitor', at: p(6.5, 0.8), label: 'metrics' };

// Canary pod reuses the lower-right slot.
const px2: SceneNode = { ...spx, id: 'px2', sub: 'v2 proxy' };
const pay2: SceneNode = { ...stock, id: 'pay2', label: 'payments v2', sub: 'new build' };

const pod = (id: string, label: string, a: SceneNode, b: SceneNode): SceneZone => ({
  id,
  label,
  tone: 'blue',
  from: [Math.min(a.at[0], b.at[0]) - 0.75, Math.min(a.at[1], b.at[1]) - 0.75],
  to: [Math.max(a.at[0], b.at[0]) + 0.75, Math.max(a.at[1], b.at[1]) + 0.75],
});

const meshLinks = [
  { from: 'orders', to: 'opx' },
  { from: 'opx', to: 'ppx' },
  { from: 'ppx', to: 'pay' },
  { from: 'opx', to: 'spx' },
  { from: 'spx', to: 'stock' },
];

export const serviceMesh: Lesson = {
  id: 'service-mesh',
  title: 'Service mesh and sidecars',
  tagline: 'Move retries, encryption and metrics out of every service and into a proxy that sits beside it.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'Why network code copied into every service drifts apart',
    'What a sidecar proxy does, and how the data plane and control plane split the work',
    'How mutual TLS gives every service an identity',
    'Shifting 5% of traffic to a new version with one rule',
    'What a mesh costs in latency and operations, and when a library or a gateway is enough',
  ],
  metrics: [
    { key: 'impl', label: 'Network code' },
    { key: 'mtls', label: 'Encrypted calls' },
    { key: 'lat', label: 'Added per call' },
    { key: 'parts', label: 'Proxies to run' },
  ],
  steps: [
    {
      title: 'Four copies',
      tag: 'problem',
      heading: 'Every team wrote its own network code',
      eli5: 'A school has many classrooms that pass notes to each other. Every classroom made up its own rules for what to do when a note gets lost, and no two sets of rules match.',
      body: [
        'The shop runs **40 services** in four languages: Go, Java, Python and Node. Each one calls others over the network, so each one needs timeouts, retries, encryption and request metrics.',
        'Four languages means four libraries, written by different teams in different years. The Go client retries twice with backoff. The Python client retries five times with no pause. Only 12 of the 40 services encrypt their calls, and each exports metrics under different names.',
        'Last month payments slowed down. The Python callers hammered it with instant retries and turned a slowdown into an outage. Fixing the retry rule meant a code change and a deploy in every service that had copied it.',
      ],
      keyIdea: 'Network behavior that lives inside each service gets written many times, drifts apart, and can only be changed one deploy at a time.',
      metrics: { impl: '4 libraries', mtls: '30%', lat: '0 ms', parts: '0' },
      scene: {
        nodes: [
          { ...orders, badge: 'retry x2, backoff' },
          { ...pay, status: 'hot', badge: 'no metrics' },
          { ...stock, status: 'hot', badge: 'retry x5, no wait' },
        ],
        links: [
          { from: 'orders', to: 'pay' },
          { from: 'orders', to: 'stock' },
          { from: 'stock', to: 'pay', label: 'plain text' },
        ],
        flows: [
          { path: ['orders', 'pay'], tone: 'request', label: 'charge', duration: 1.2 },
          { path: ['orders', 'stock'], tone: 'request', label: 'reserve', duration: 1.2 },
          { path: ['stock', 'pay'], tone: 'error', label: 'retry storm', count: 5, duration: 0.9, delay: 1.3 },
        ],
        caption: 'Same job, written four different ways',
      },
    },
    {
      title: 'The sidecar',
      tag: 'concept',
      heading: 'Put a proxy beside every service',
      eli5: 'Each classroom gets a hall helper who stands at its door. The class hands every note to its helper, and the helper carries it. That helper is the **sidecar**.',
      body: [
        'A **sidecar** is a small proxy process that runs next to each service instance, in the same pod, sharing its network. The platform redirects all traffic in and out of the service through it. The service believes it is talking straight to `payments`. In fact it is talking to its own proxy.',
        'The proxy now owns everything that used to be library code: timeouts, retries, load balancing across instances, encryption and request metrics. It is the same binary beside every service, whatever language that service is written in.',
        'The service code shrinks to a plain HTTP or gRPC call. A common choice for the proxy is Envoy, which meshes such as Istio build on. Linkerd ships its own small proxy.',
      ],
      keyIdea: 'A sidecar takes network behavior out of the service and puts one identical implementation next to all of them.',
      metrics: { impl: '1 proxy', mtls: '30%', lat: '~1 ms', parts: '400' },
      scene: {
        zones: [pod('podOrders', 'orders pod', orders, opx), pod('podPay', 'payments pod', ppx, pay)],
        nodes: [orders, { ...opx, status: 'active', badge: 'takes all traffic' }, { ...ppx, status: 'active' }, pay],
        links: [
          { from: 'orders', to: 'opx', label: 'localhost' },
          { from: 'opx', to: 'ppx', label: 'network' },
          { from: 'ppx', to: 'pay', label: 'localhost' },
        ],
        flows: [
          { path: ['orders', 'opx'], tone: 'request', label: 'POST /charge', duration: 0.9 },
          { path: ['opx', 'ppx'], tone: 'request', duration: 1.1, delay: 1 },
          { path: ['ppx', 'pay'], tone: 'request', duration: 0.9, delay: 2.2 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', label: '200', duration: 2, delay: 3.2 },
        ],
        caption: 'Service to proxy, proxy to proxy, proxy to service',
      },
    },
    {
      title: 'Data plane',
      tag: 'concept',
      heading: 'The data plane carries every request',
      eli5: 'All the hall helpers together carry every note in the school. If a note gets dropped, the helper tries once more, the same way at every door.',
      body: [
        'All the sidecars together are the **data plane**. With 40 services at about 10 instances each, that is **400 proxies**, and every call between services passes through two of them: the caller\'s and the receiver\'s.',
        'Because every proxy follows the same rules, behavior is uniform. A call to payments gets a 2 second deadline and at most 2 retries on connection failures and `5xx` responses, from every caller, in every language.',
        'Each proxy also records the same numbers for every call: request count, error rate and latency. You get a full map of who calls whom without adding one line of metrics code to a service.',
      ],
      keyIdea: 'The data plane is the set of proxies on the request path. One retry policy and one set of metrics apply to every call.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400' },
      scene: {
        nodes: [orders, { ...opx, status: 'active', badge: 'retry 1 of 2' }, { ...ppx, status: 'active' }, { ...pay, badge: '503 then 200' }, { ...metrics, status: 'ok', badge: 'same stats' }],
        links: [
          { from: 'orders', to: 'opx' },
          { from: 'opx', to: 'ppx' },
          { from: 'ppx', to: 'pay' },
          { from: 'ppx', to: 'metrics', style: 'dashed' },
        ],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', label: 'charge', duration: 1.6 },
          { path: ['pay', 'ppx', 'opx'], tone: 'error', label: '503', duration: 1.2, delay: 1.7 },
          { path: ['opx', 'ppx', 'pay'], tone: 'request', label: 'retry', duration: 1.2, delay: 3 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', label: '200', duration: 1.6, delay: 4.3 },
          { path: ['ppx', 'metrics'], tone: 'event', duration: 1, delay: 4.3 },
        ],
        caption: 'The proxy retries. The service never sees the 503',
      },
      code: {
        language: 'yaml',
        title: 'Istio: one retry policy for every caller of payments',
        source: `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payments
spec:
  hosts:
    - payments
  http:
    - route:
        - destination:
            host: payments
      timeout: 2s                 # whole call, retries included
      retries:
        attempts: 2
        perTryTimeout: 500ms
        retryOn: 5xx,connect-failure`,
        highlight: [12, 14, 15, 16],
      },
    },
    {
      title: 'Control plane',
      tag: 'concept',
      heading: 'The control plane tells the proxies what to do',
      eli5: 'The school office writes the rules and hands every helper the same sheet. The office never carries a note itself. That office is the **control plane**.',
      body: [
        'Nobody edits 400 proxy configs by hand. The **control plane** is a small set of servers that holds the rules you write, watches which service instances exist, and pushes the resulting config to every sidecar. A change reaches the whole fleet in seconds, with no service deploy.',
        'It also acts as a certificate authority, handing each proxy a short-lived certificate. More on that in the next step.',
        'The control plane is **off the request path**. No shopper request passes through it. If it goes down, the proxies keep serving with the last config they received. What stops is change: new rules, newly started instances and certificate renewals wait until it is back.',
      ],
      keyIdea: 'The control plane configures the proxies and stays out of the request path, so losing it freezes changes and leaves traffic flowing.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [orders, opx, ppx, pay, spx, stock, { ...cp, status: 'active', badge: 'push rules' }],
        links: [
          ...meshLinks,
          { from: 'cp', to: 'opx', style: 'dashed' },
          { from: 'cp', to: 'ppx', style: 'dashed' },
          { from: 'cp', to: 'spx', style: 'dashed' },
        ],
        flows: [
          { path: ['cp', 'opx'], tone: 'event', label: 'config', duration: 1.2 },
          { path: ['cp', 'ppx'], tone: 'event', duration: 1.2 },
          { path: ['cp', 'spx'], tone: 'event', duration: 1.6 },
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', duration: 1.8, delay: 1.6 },
          { path: ['orders', 'opx', 'spx', 'stock'], tone: 'request', duration: 1.8, delay: 1.6 },
        ],
        caption: 'Rules flow down the dashed lines, requests never do',
      },
      quiz: {
        question: 'The control plane crashes and stays down for ten minutes. What happens to calls between services that were already running?',
        options: [
          'They all fail, because every request is routed through the control plane',
          'They keep working with the last config the proxies received, but new rules and new instances are not picked up',
          'The proxies switch themselves off and services talk to each other directly',
          'Only encrypted calls fail',
        ],
        answer: 1,
        explain: 'The control plane sits off the request path. Proxies hold their config in memory and keep using it. What you lose is change: config pushes, discovery of new instances and certificate renewals.',
      },
    },
    {
      title: 'Mutual TLS',
      tag: 'concept',
      heading: 'Mutual TLS: both sides prove who they are',
      eli5: 'Every hall helper wears a badge from the school office. Two helpers show each other their badges before a note changes hands, and they pass it in a sealed envelope. That is **mutual TLS**.',
      body: [
        'In ordinary TLS only the server shows a certificate. In **mutual TLS** (mTLS) the caller shows one too. Each sidecar holds a certificate that names its service, such as `orders` or `payments`, issued by the control plane and rotated every few hours.',
        'Two things follow. Every call inside the network is encrypted, so someone who gets onto the network cannot read card numbers off the wire. And each proxy knows which service is calling, which lets you write rules like "only `orders` may call `payments`".',
        'The services do none of this. They still send plain HTTP to their sidecar on localhost. Turning mTLS on for the whole mesh is a few lines of config, where before it was a project in each of four languages.',
      ],
      keyIdea: 'mTLS gives every service a verified identity and encrypts every hop, without any service handling a certificate.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [orders, { ...opx, status: 'ok', badge: 'cert: orders' }, { ...ppx, status: 'ok', badge: 'cert: payments' }, pay, { ...cp, badge: 'issues certs' }],
        links: [
          { from: 'orders', to: 'opx', label: 'plain' },
          { from: 'opx', to: 'ppx', label: 'encrypted' },
          { from: 'ppx', to: 'pay', label: 'plain' },
          { from: 'cp', to: 'opx', style: 'dashed' },
          { from: 'cp', to: 'ppx', style: 'dashed' },
        ],
        flows: [
          { path: ['cp', 'opx'], tone: 'data', label: 'cert', duration: 1 },
          { path: ['cp', 'ppx'], tone: 'data', label: 'cert', duration: 1 },
          { path: ['opx', 'ppx'], tone: 'handshake', label: 'I am orders', duration: 1, delay: 1.2 },
          { path: ['ppx', 'opx'], tone: 'handshake', label: 'I am payments', duration: 1, delay: 2.3 },
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', label: 'charge', duration: 1.8, delay: 3.4 },
        ],
        caption: 'Both proxies show a certificate before any data moves',
      },
      code: {
        language: 'yaml',
        title: 'Istio: require mTLS everywhere, then restrict who may call payments',
        source: `apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system        # root namespace = whole mesh
spec:
  mtls:
    mode: STRICT                 # refuse plain-text calls
---
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: payments-callers
  namespace: shop
spec:
  selector:
    matchLabels:
      app: payments
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/shop/sa/orders"]`,
        highlight: [8, 19, 23],
      },
    },
    {
      title: 'Traffic shifting',
      tag: 'concept',
      heading: 'Send 5% of calls to the new version',
      eli5: 'A new teacher starts in the room next door. The office tells the helpers to take 1 note in every 20 to the new teacher, and watches how it goes before sending more.',
      body: [
        'Payments v2 is ready. Without a mesh, the share of traffic a version gets follows its share of instances: to give v2 5% you would run 19 old instances for each new one.',
        'With a mesh, routing is a rule in the caller\'s proxy. You write "95% to v1, 5% to v2" and the control plane pushes it out. One v2 instance can take exactly 5%, whatever the instance counts are.',
        'The proxies already report error rate and latency per version. If v2 looks healthy you move to 25%, 50%, 100%. If its errors climb, you set the weight back to 0 and the change takes effect in seconds, with no rollback deploy. The same mechanism routes by header, so testers can reach v2 before any shopper does.',
      ],
      keyIdea: 'A mesh separates how much traffic a version receives from how many instances it has, which makes a gradual release a config change.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [orders, { ...opx, status: 'active', badge: 'split 95 / 5' }, ppx, { ...pay, label: 'payments v1', badge: '95%' }, px2, { ...pay2, status: 'ok', badge: '5%' }, cp],
        links: [
          { from: 'orders', to: 'opx' },
          { from: 'opx', to: 'ppx' },
          { from: 'ppx', to: 'pay' },
          { from: 'opx', to: 'px2' },
          { from: 'px2', to: 'pay2' },
          { from: 'cp', to: 'opx', style: 'dashed' },
        ],
        flows: [
          { path: ['cp', 'opx'], tone: 'event', label: 'weights', duration: 1 },
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', count: 6, duration: 2, delay: 1.2 },
          { path: ['orders', 'opx', 'px2', 'pay2'], tone: 'request', label: '1 in 20', duration: 2, delay: 1.8 },
        ],
        caption: 'The split happens in the caller\'s proxy',
      },
      code: {
        language: 'yaml',
        title: 'Istio: weighted routing (v1 and v2 are subsets from a DestinationRule)',
        source: `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payments
spec:
  hosts:
    - payments
  http:
    - route:
        - destination:
            host: payments
            subset: v1
          weight: 95
        - destination:
            host: payments
            subset: v2
          weight: 5               # raise in steps, or set to 0 to back out`,
        highlight: [13, 17],
      },
    },
    {
      title: 'Double retries',
      tag: 'case',
      heading: 'Case: the retries nobody removed',
      eli5: 'A class sends the same note three times when it hears nothing back. Its helper also tries three times for each one. The poor teacher at the other end gets nine notes.',
      body: [
        'The team turns on mesh retries with 3 attempts. The orders service still has its old library, which also makes 3 attempts. Nobody deleted it.',
        'Payments slows down. Each library attempt becomes 3 proxy attempts, so one checkout can send **9 calls** to a service that is already struggling. Retries at two layers multiply. The mesh made the storm from step 1 worse.',
        'There is a second trap. The proxy sees bytes and status codes. It cannot know that repeating `POST /charge` might bill a card twice. Retry only what is safe to repeat, or give the call an idempotency key so the receiver can drop the duplicate.',
        'The fix is to keep retries in one layer, cap the total with a retry budget (for example, retries may add at most 20% extra load), and let the proxy stop calling an instance that keeps failing.',
      ],
      keyIdea: 'A mesh does not remove the need to think about retries. Keep them in one layer, cap them, and only repeat calls that are safe to repeat.',
      metrics: { impl: 'library + sidecar', mtls: '100%', lat: 'seconds', parts: '400 + control' },
      scene: {
        nodes: [{ ...orders, status: 'hot', badge: '3 attempts' }, { ...opx, status: 'hot', badge: 'x3 each' }, ppx, { ...pay, status: 'hot', badge: '9 calls' }],
        links: [
          { from: 'orders', to: 'opx' },
          { from: 'opx', to: 'ppx' },
          { from: 'ppx', to: 'pay' },
        ],
        flows: [
          { path: ['orders', 'opx'], tone: 'request', count: 3, duration: 1 },
          { path: ['opx', 'ppx', 'pay'], tone: 'request', count: 9, duration: 1.4, delay: 1 },
          { path: ['pay', 'ppx', 'opx'], tone: 'error', label: '503', count: 3, duration: 1.4, delay: 2.5 },
        ],
        caption: '3 attempts times 3 attempts is 9 calls',
      },
    },
    {
      title: 'The bill',
      tag: 'tradeoff',
      heading: 'What the mesh costs',
      eli5: 'Every note now passes through two extra pairs of hands, so it arrives a little later. The school also has to hire, train and look after a helper for every single door.',
      body: [
        '**Latency.** Every call crosses two proxies. Assume the pair adds about **1 ms**. A checkout that fans out through 6 calls pays about 6 ms more, and the slow tail grows more than the average does. For a 200 ms page that is noise. For a service with a 5 ms budget it is a real share.',
        '**Resources.** 400 sidecars each need memory and CPU. If each takes 50 MB, that is 20 GB of RAM spent on plumbing before any business logic runs.',
        '**Operations.** The mesh is a distributed system of its own. Someone upgrades 400 proxies without dropping traffic, keeps the control plane healthy and learns to debug a request that now has two more hops where it can fail. A bad config push reaches every proxy as fast as a good one.',
        'Newer designs shrink the bill by sharing one proxy per machine or doing part of the work in the kernel. They lower the cost. They do not remove it.',
      ],
      keyIdea: 'A mesh trades duplicated code in services for a new layer on the request path that someone has to run.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [orders, { ...opx, status: 'hot', badge: '+0.5 ms, 50 MB' }, { ...ppx, status: 'hot', badge: '+0.5 ms, 50 MB' }, pay, { ...cp, status: 'hot', badge: 'yours to run' }],
        links: [
          { from: 'orders', to: 'opx' },
          { from: 'opx', to: 'ppx' },
          { from: 'ppx', to: 'pay' },
          { from: 'cp', to: 'opx', style: 'dashed' },
          { from: 'cp', to: 'ppx', style: 'dashed' },
        ],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', duration: 2.6 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', duration: 2.6, delay: 2.7 },
        ],
        caption: 'Two extra hops on every call, 400 extra processes',
      },
    },
    {
      title: 'Need a mesh?',
      tag: 'tradeoff',
      heading: 'When a library or a gateway is enough',
      eli5: 'A tiny school with five classrooms does not need a helper at every door. One guard at the front gate and one shared rule sheet do the job.',
      body: [
        '**One language, a handful of services:** a shared client library gives you the same timeouts, retries and metrics with no extra hops. Its weakness is upgrades, since every service has to pick up each new version. With 8 services that is an afternoon.',
        '**Traffic from outside:** an **API gateway** already handles TLS, authentication and rate limits at the front door. Calls from the internet into your system are its job. A mesh handles calls between your own services. Many systems run both, and many small ones need only the gateway.',
        '**A mesh earns its place** when you have dozens of services in several languages, a requirement to encrypt and authorize every internal call, or frequent gradual releases. Our shop has 40 services in four languages, so it qualifies. A team with 6 services in Go would be buying 400 problems to solve 6.',
      ],
      keyIdea: 'Pick the smallest tool that makes network behavior uniform: a library for one language, a gateway for the edge, a mesh for many services in many languages.',
      metrics: { impl: 'shared library', mtls: 'edge only', lat: '0 ms', parts: '1 gateway' },
      scene: {
        nodes: [client, { ...edge, status: 'active', badge: 'TLS, auth, limits' }, { ...orders, badge: 'shared lib' }, { ...pay, badge: 'shared lib' }, { ...stock, sub: 'Go', badge: 'shared lib' }],
        links: [
          { from: 'client', to: 'edge' },
          { from: 'edge', to: 'orders' },
          { from: 'orders', to: 'pay' },
          { from: 'orders', to: 'stock' },
        ],
        flows: [
          { path: ['client', 'edge', 'orders'], tone: 'request', label: 'checkout', duration: 1.6 },
          { path: ['orders', 'pay'], tone: 'request', duration: 1.2, delay: 1.7 },
          { path: ['orders', 'stock'], tone: 'request', duration: 1.2, delay: 1.7 },
          { path: ['orders', 'edge', 'client'], tone: 'response', duration: 1.6, delay: 3 },
        ],
        caption: 'Small system: a gateway at the edge, a library inside',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One proxy beside every service, one place to set the rules',
      eli5: 'Helpers at every door carry the notes, check badges and follow one rule sheet from the office. It works well in a big school and is too much for a tiny one.',
      body: [
        'A **sidecar** proxy next to each service takes over timeouts, retries, load balancing, encryption and metrics. The proxies form the **data plane** on the request path. The **control plane** pushes rules and certificates to them and stays off that path.',
        '**mTLS** encrypts every internal call and tells each side who the other is. **Traffic shifting** turns a release into a weight you raise from 5% to 100%.',
        'The cost is about 1 ms per call, 400 more processes and a new system to operate. Retries still need care: one layer, a budget, and only for calls that are safe to repeat. With few services or one language, a shared library plus a gateway at the edge is the better deal.',
      ],
      keyIdea: 'A mesh pays off when the cost of keeping network behavior consistent across services is higher than the cost of running the mesh.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [orders, { ...opx, status: 'ok' }, { ...ppx, status: 'ok' }, pay, { ...spx, status: 'ok' }, stock, { ...cp, status: 'ok' }],
        links: [
          ...meshLinks,
          { from: 'cp', to: 'opx', style: 'faint' },
          { from: 'cp', to: 'ppx', style: 'faint' },
          { from: 'cp', to: 'spx', style: 'faint' },
        ],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', duration: 2 },
          { path: ['orders', 'opx', 'spx', 'stock'], tone: 'request', duration: 2, delay: 0.3 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', duration: 2, delay: 2.2 },
          { path: ['cp', 'ppx'], tone: 'event', duration: 1.2, delay: 4.3 },
        ],
      },
      quiz: {
        question: 'A team runs 6 services, all in Go, behind an API gateway. They want consistent timeouts and retries on internal calls. What is the most sensible first step?',
        options: [
          'Install a service mesh so every pod gets a sidecar',
          'Put the internal calls through the API gateway as well',
          'Share one client library with the timeout and retry rules built in',
          'Let each service keep its own rules and document them',
        ],
        answer: 2,
        explain: 'With one language and 6 services, a shared library gives uniform behavior with no extra hops and nothing new to operate. A mesh starts to pay off with many services, several languages, or a need for mTLS on every internal call.',
      },
    },
  ],
};
