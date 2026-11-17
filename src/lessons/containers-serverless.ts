import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(row + col) / 2, (row - col) / 2];

const laptop: SceneNode = { id: 'laptop', kind: 'client', at: p(-7, 0), label: 'dev laptop', sub: 'Python 3.12' };
const prod: SceneNode = { id: 'prod', kind: 'server', at: p(3, 0), label: 'prod server', sub: 'Python 3.9' };
const registry: SceneNode = { id: 'registry', kind: 'storage', at: p(-2, 0), label: 'image registry', sub: 'shop-api:1.4.2' };
const vm: SceneNode = { id: 'vm', kind: 'server', at: p(-4, 0), label: 'VM', sub: 'full OS · ~1 GB' };
const host: SceneNode = { id: 'host', kind: 'server', at: p(2, 0), label: 'host', sub: 'one shared kernel' };
const sched: SceneNode = { id: 'sched', kind: 'monitor', at: p(-5, 0.6), label: 'orchestrator', sub: 'Kubernetes' };
const node1: SceneNode = { id: 'node1', kind: 'server', at: p(-1.5, -2.6), label: 'node 1' };
const node2: SceneNode = { id: 'node2', kind: 'server', at: p(1.5, 0.6), label: 'node 2' };
const node3: SceneNode = { id: 'node3', kind: 'server', at: p(4.5, 3.8), label: 'node 3' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: p(-5, 0.6), label: 'load balancer' };
const users: SceneNode = { id: 'users', kind: 'phone', at: p(-8, 0.6), label: 'shoppers' };
const bucket: SceneNode = { id: 'bucket', kind: 'storage', at: p(-6, 0), label: 'photo upload', sub: 'object storage' };
const fn: SceneNode = { id: 'fn', kind: 'worker', at: p(-1.5, 0), label: 'resize function', sub: '512 MB · 300 ms' };
const thumbs: SceneNode = { id: 'thumbs', kind: 'storage', at: p(3, 0), label: 'thumbnails' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(3, 0), label: 'Postgres', sub: '100 connections max' };

const clusterLinks = [
  { from: 'sched', to: 'node1', style: 'dashed' as const },
  { from: 'sched', to: 'node2', style: 'dashed' as const },
  { from: 'sched', to: 'node3', style: 'dashed' as const },
];

export const containersServerless: Lesson = {
  id: 'containers-serverless',
  title: 'Containers and serverless',
  tagline: 'Package code so it runs the same everywhere, let a scheduler place it, or hand the servers to someone else.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why "works on my machine" happens, and how an image fixes it',
    'How containers differ from virtual machines',
    'What an orchestrator does: scheduling, health checks and restarts',
    'Autoscaling, and functions as a service with their cold starts',
    'The costs and limits of each, and how to choose',
  ],
  metrics: [
    { key: 'start', label: 'Start time' },
    { key: 'unit', label: 'Unit' },
    { key: 'idle', label: 'Idle cost' },
    { key: 'ops', label: 'You manage' },
  ],
  steps: [
    {
      title: 'My machine',
      tag: 'problem',
      heading: 'It works on my machine',
      eli5: 'A cook makes soup at home with her own spices, and it tastes great. At the restaurant the shelf has different spices, so the same recipe tastes wrong.',
      body: [
        'A developer builds the shop API on a laptop with Python 3.12 and a recent image library. Tests pass. The deploy script copies the code to a production server that has Python 3.9 and a library from two years ago, installed by hand.',
        'The service crashes on start. Nobody wrote down what the server had, and the three production servers are not even the same as each other, because someone patched one of them during an incident.',
        'The code was never the whole program. It depends on the runtime, the libraries, the system packages and the config around it. Shipping only the code ships half of it.',
      ],
      keyIdea: 'Code depends on everything installed around it, so shipping code alone to a server that differs from the laptop breaks in ways no test caught.',
      metrics: { start: 'minutes', unit: 'code', idle: 'full server', ops: 'everything' },
      scene: {
        nodes: [{ ...laptop, status: 'ok', badge: 'tests pass' }, { ...prod, status: 'down', badge: 'ImportError' }],
        links: [{ from: 'laptop', to: 'prod', label: 'copy code' }],
        flows: [
          { path: ['laptop', 'prod'], tone: 'request', label: 'app.py', duration: 1.4 },
          { path: ['prod', 'laptop'], tone: 'error', label: 'crash', duration: 1.4, delay: 1.6 },
        ],
        caption: 'Same code, different machine',
      },
    },
    {
      title: 'Images',
      tag: 'concept',
      heading: 'Ship the whole box: images and containers',
      eli5: 'The cook packs the soup with its own spices into a sealed lunchbox. Any kitchen just heats the box. The box is the **image**.',
      body: [
        'An **image** is a read-only package of the app plus everything it needs: the runtime, the libraries, the system packages. It is built once from a recipe file, given a version tag such as `shop-api:1.4.2`, and pushed to a **registry**.',
        'A **container** is a running copy of an image. Every server pulls the same image and runs it, so the laptop, the test cluster and production run byte-for-byte the same software. Only config and secrets come in from outside, through environment variables or mounted files.',
        'Images are built in layers. If only your code changed, the layer with Python and the libraries is reused and the push takes seconds.',
      ],
      keyIdea: 'An image packages the app with its whole environment, so what you tested is exactly what runs in production.',
      metrics: { start: 'seconds', unit: 'image', idle: 'full server', ops: 'OS + runtime' },
      scene: {
        nodes: [laptop, { ...registry, status: 'active', badge: 'v1.4.2' }, { ...prod, sub: 'runs the image', status: 'ok', badge: 'same bytes' }],
        links: [
          { from: 'laptop', to: 'registry', label: 'push' },
          { from: 'registry', to: 'prod', label: 'pull' },
        ],
        flows: [
          { path: ['laptop', 'registry'], tone: 'data', label: 'build + push', duration: 1.4 },
          { path: ['registry', 'prod'], tone: 'data', label: 'pull', duration: 1.4, delay: 1.6 },
        ],
        caption: 'Build once, run the same image everywhere',
      },
      code: {
        language: 'bash',
        title: 'A Dockerfile for the shop API, then build and push',
        source: `# Dockerfile
FROM python:3.12-slim                  # runtime pinned in the image
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt   # cached layer
COPY . .                               # only this layer changes per commit
USER 10001                             # do not run as root
CMD ["gunicorn", "-b", "0.0.0.0:8080", "shop.app:app"]

# build, tag with the version, push to the registry
docker build -t registry.internal/shop-api:1.4.2 .
docker push registry.internal/shop-api:1.4.2`,
        highlight: [2, 5, 6, 11],
      },
    },
    {
      title: 'Container vs VM',
      tag: 'concept',
      heading: 'Containers share a kernel, VMs bring their own',
      eli5: 'A virtual machine is like building a whole new kitchen for each cook. Containers are cooks sharing one big kitchen, each at a fenced-off counter.',
      body: [
        'A **virtual machine** emulates a whole computer. Each VM boots its own operating system and kernel on top of a hypervisor. That costs about a gigabyte of memory and tens of seconds to boot, and gives strong isolation, since tenants share only the hypervisor.',
        'A **container** is an ordinary process that the host kernel fences off: it sees its own files, its own network and a capped share of CPU and memory. There is no second OS to boot, so it starts in about a second and costs only what the app uses. One host can run dozens.',
        'The catch is the shared kernel. A kernel bug can let one container reach another, so mixing untrusted tenants on one host needs extra care. In practice most containers run inside VMs: the cloud gives you VMs, and you pack containers onto them.',
      ],
      keyIdea: 'Containers are fenced-off processes on one kernel: light and fast, with weaker isolation than a VM that brings its own OS.',
      metrics: { start: '~1 s', unit: 'container', idle: 'shared host', ops: 'OS + runtime' },
      scene: {
        nodes: [
          { ...vm, badge: '~30 s boot' },
          { ...host, status: 'ok', badge: '20 containers' },
          { ...registry, at: p(-1, -3.2) },
        ],
        links: [
          { from: 'registry', to: 'vm', style: 'dashed' },
          { from: 'registry', to: 'host', style: 'dashed' },
        ],
        flows: [
          { path: ['registry', 'vm'], tone: 'data', label: 'disk image + OS', duration: 3 },
          { path: ['registry', 'host'], tone: 'data', label: 'app layers only', duration: 1 },
        ],
        caption: 'One OS per VM, one kernel for many containers',
      },
      quiz: {
        question: 'You must run code uploaded by untrusted customers next to each other. Which statement is correct?',
        options: [
          'Containers alone are enough, since each sees its own files',
          'A VM per customer, or a hardened sandbox, gives stronger isolation because containers share the host kernel',
          'VMs and containers isolate equally well',
          'Isolation does not matter if each container has a CPU cap',
        ],
        answer: 1,
        explain: 'Containers share one kernel, so a kernel flaw can cross the fence. A VM brings its own kernel and shares only the hypervisor. Untrusted multi-tenant code usually gets VM-level isolation or a sandbox built for it.',
      },
    },
    {
      title: 'Orchestrator',
      tag: 'concept',
      heading: 'An orchestrator places and heals containers',
      eli5: 'The head chef keeps a list: three soup counters must always be open. She picks which kitchen each counter goes in, and if one closes she opens another. She is the **orchestrator**.',
      body: [
        'With 40 services and 300 containers, nobody picks servers by hand. An **orchestrator** such as Kubernetes takes a **desired state**: "run 3 copies of `shop-api:1.4.2`, each with 0.5 CPU and 512 MB".',
        'Its **scheduler** places each copy on a node with enough free CPU and memory and spreads the copies across nodes, so one dead machine does not take all three. It wires them behind a stable service address.',
        'Then it keeps watching. It probes each container\'s health endpoint, restarts one that fails, and replaces any copy that was on a node that died. You never tell it what to do step by step. You tell it what should be true, and it works to keep that true.',
      ],
      keyIdea: 'You declare how many copies should run and with what resources. The orchestrator places them and keeps fixing reality until it matches.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      scene: {
        nodes: [
          { ...sched, status: 'active', badge: 'want 3 copies' },
          { ...node1, badge: 'api #1' },
          { ...node2, badge: 'api #2' },
          { ...node3, badge: 'api #3' },
        ],
        links: clusterLinks,
        flows: [
          { path: ['sched', 'node1'], tone: 'event', label: 'place', duration: 1.2 },
          { path: ['sched', 'node2'], tone: 'event', duration: 1.2, delay: 0.3 },
          { path: ['sched', 'node3'], tone: 'event', duration: 1.4, delay: 0.6 },
        ],
        caption: 'Three copies, spread across three nodes',
      },
      code: {
        language: 'yaml',
        title: 'Kubernetes: the desired state for the shop API',
        source: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-api
spec:
  replicas: 3                          # keep three copies running
  selector:
    matchLabels: { app: shop-api }
  template:
    metadata:
      labels: { app: shop-api }
    spec:
      containers:
        - name: api
          image: registry.internal/shop-api:1.4.2
          resources:
            requests: { cpu: 500m, memory: 512Mi }   # used for placement
            limits: { memory: 512Mi }
          readinessProbe:              # no traffic until this passes
            httpGet: { path: /healthz, port: 8080 }
          livenessProbe:               # restart if this keeps failing
            httpGet: { path: /healthz, port: 8080 }`,
        highlight: [6, 15, 17, 19, 21],
      },
    },
    {
      title: 'Self-healing',
      tag: 'case',
      heading: 'Case: a node dies during lunch',
      eli5: 'One kitchen loses power. The head chef notices that one soup counter went dark and opens a new one in a kitchen that still works.',
      body: [
        'At 12:10 node 3 loses power. The orchestrator stops hearing from it. After a timeout (often under a minute) it marks the node unhealthy and treats every container on it as gone.',
        'Desired state says 3 copies. Reality says 2. The scheduler starts a fresh copy on node 2, which has room. The image is already cached there, so the new container is serving within seconds of being placed. The load balancer only sends it traffic once its readiness check passes.',
        'Nobody was paged to fix it. The two survivors carried the load in the meantime, which is why you run at least 2 copies of anything that matters and leave some spare room on each node.',
      ],
      keyIdea: 'Because the orchestrator compares desired and actual state in a loop, a dead node becomes a short dip in capacity, not an outage.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      scene: {
        nodes: [
          { ...sched, status: 'active', badge: '2 of 3 running' },
          { ...node1, badge: 'api #1' },
          { ...node2, status: 'ok', badge: 'api #2 + new #3' },
          { ...node3, status: 'down', badge: 'no heartbeat' },
        ],
        links: clusterLinks,
        flows: [
          { path: ['sched', 'node3'], tone: 'error', label: 'heartbeat?', duration: 1.2 },
          { path: ['sched', 'node2'], tone: 'event', label: 'start copy #3', duration: 1.2, delay: 1.4 },
        ],
        caption: 'The copy moves, the count stays at three',
      },
    },
    {
      title: 'Autoscaling',
      tag: 'concept',
      heading: 'Autoscaling: more copies when traffic grows',
      eli5: 'When a big crowd walks in, the head chef opens more soup counters. When it gets quiet, she closes the extra ones. That is **autoscaling**.',
      body: [
        'Traffic at 8 PM is four times the 4 AM level. A horizontal **autoscaler** watches a signal, usually average CPU or requests per copy, and changes the copy count to hold it near a target. Target 60% CPU, measured 90%, so 3 copies become 5.',
        'There are two layers. Pod autoscaling adds copies inside the cluster. When the nodes are full, a **cluster autoscaler** asks the cloud for another VM, which takes a minute or two to boot and join.',
        'Scaling is never instant. Metrics lag, containers need time to warm up, and new nodes need minutes. Set a minimum that can survive a sudden spike on its own, and scale down slowly so a short dip does not throw away capacity you need again a minute later.',
      ],
      keyIdea: 'Autoscaling follows demand with a delay, so a sensible minimum and spare headroom still matter.',
      metrics: { start: '~2 s pod, ~2 min node', unit: 'pod', idle: 'min 3 pods', ops: 'cluster' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: '4x traffic' },
          { ...node1, status: 'hot', badge: 'CPU 90%' },
          { ...node2, status: 'hot', badge: 'CPU 90%' },
          { ...node3, status: 'ok', badge: '+2 copies' },
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 'node1' },
          { from: 'lb', to: 'node2' },
          { from: 'lb', to: 'node3' },
        ],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 6, duration: 1 },
          { path: ['lb', 'node1'], tone: 'request', count: 3, duration: 1.2, delay: 1 },
          { path: ['lb', 'node2'], tone: 'request', count: 3, duration: 1.2, delay: 1 },
          { path: ['lb', 'node3'], tone: 'request', count: 2, duration: 1.4, delay: 1.6 },
        ],
        caption: 'High CPU adds copies, new copies take load',
      },
    },
    {
      title: 'Functions',
      tag: 'concept',
      heading: 'Functions as a service: no servers to see',
      eli5: 'Some days you only need a cook for five minutes. You call one in when an order arrives and pay only for those minutes. That on-call cook is a **function**.',
      body: [
        'With **functions as a service** (FaaS), you upload a single function and say what triggers it: an HTTP request, a new file in a bucket, a message on a queue. The provider runs it, scales it from zero to thousands of parallel copies, and bills per request and per millisecond of run time.',
        'Take thumbnail making. A shopper uploads a photo, the bucket fires an event, and a function resizes it in 300 ms. With 50,000 uploads a day you pay for about 4 hours of compute in total, and nothing at 3 AM when no one uploads.',
        'There is no OS to patch, no cluster, no scaling rules. The provider owns all of that.',
      ],
      keyIdea: 'Functions run only when an event arrives and bill only for that time, which suits spiky, event-driven work.',
      metrics: { start: 'ms warm', unit: 'function', idle: '$0', ops: 'your code' },
      scene: {
        nodes: [{ ...bucket, status: 'active', badge: 'new photo' }, { ...fn, status: 'ok', badge: 'x 40 in parallel' }, thumbs],
        links: [
          { from: 'bucket', to: 'fn', label: 'event' },
          { from: 'fn', to: 'thumbs' },
        ],
        flows: [
          { path: ['bucket', 'fn'], tone: 'event', label: 'photo.jpg', count: 3, duration: 1.2 },
          { path: ['fn', 'thumbs'], tone: 'data', label: 'thumb.jpg', count: 3, duration: 1.2, delay: 1.4 },
        ],
        caption: 'An upload fires the function, then it is gone',
      },
      code: {
        language: 'python',
        title: 'A thumbnail function triggered by an upload event',
        source: `import io
from PIL import Image
import storage   # the provider's object storage client

def handler(event, context):
    # one invocation per uploaded file
    for record in event["records"]:
        bucket, key = record["bucket"], record["key"]
        data = storage.get(bucket, key)
        img = Image.open(io.BytesIO(data))
        img.thumbnail((256, 256))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        storage.put("thumbnails", key, out.getvalue())
    return {"done": len(event["records"])}`,
        highlight: [5, 9, 14],
      },
    },
    {
      title: 'Cold starts',
      tag: 'case',
      heading: 'Case: the first request waits',
      eli5: 'If no on-call cook is in the building, the first order has to wait while one drives over and ties an apron. That wait is a **cold start**.',
      body: [
        'When no warm copy of the function exists, the provider must create a sandbox, load your code and run its startup. That is a **cold start**. For a small function it may add a couple of hundred milliseconds. For a large package or a heavy runtime it can reach seconds.',
        'It hurts most on user-facing paths with uneven traffic. The checkout endpoint gets a burst after an email campaign, 200 new copies start at once, and the first shoppers wait two seconds longer than everyone else.',
        'The fixes cost money or effort: keep a few copies warm (paid even when idle), shrink the package, move heavy setup out of the request path, or choose a lighter runtime. The thumbnail job does not care. Nobody is watching a thumbnail render.',
      ],
      keyIdea: 'Scaling from zero means some requests pay for startup, so functions fit background work better than latency-sensitive paths.',
      metrics: { start: '~2 s cold', unit: 'function', idle: '$0', ops: 'your code' },
      scene: {
        nodes: [users, { ...fn, label: 'checkout function', sub: 'cold', status: 'hot', badge: '+2 s first call' }, { ...db, status: 'dim' }],
        links: [
          { from: 'users', to: 'fn' },
          { from: 'fn', to: 'db' },
        ],
        flows: [
          { path: ['users', 'fn'], tone: 'request', label: 'checkout', duration: 1 },
          { path: ['fn', 'users'], tone: 'error', label: 'slow', duration: 1, delay: 3 },
        ],
        caption: 'No warm copy, so the first caller waits',
      },
    },
    {
      title: 'Limits',
      tag: 'tradeoff',
      heading: 'What each option costs you',
      eli5: 'Hiring a cook per order is cheap on quiet days and costly on busy ones. Keeping your own cooks costs the same every day, busy or not.',
      body: [
        '**Functions** have hard limits: a maximum run time (often around 15 minutes), memory caps, and no state kept between calls. Scaling to 1,000 copies can open 1,000 database connections against a Postgres that allows 100, so you need a connection pooler. At steady high traffic, per-millisecond billing usually ends up costing more than servers that run all day. Each provider also packages triggers differently, so moving away takes work.',
        '**Containers on an orchestrator** run anything for as long as you like, at a flat cost per node that gets cheaper per request as you fill the nodes. In exchange someone runs the cluster: upgrades, networking, security patches, capacity.',
        'Managed container platforms sit between them: you hand over an image, and the provider scales it, sometimes down to zero.',
      ],
      keyIdea: 'Functions trade control and steady-state price for zero idle cost and zero servers. Containers trade operations work for control and cheaper steady load.',
      metrics: { start: 'varies', unit: 'both', idle: '$0 vs nodes', ops: 'code vs cluster' },
      scene: {
        nodes: [{ ...fn, label: 'functions', sub: '1,000 copies', status: 'hot' }, { ...db, status: 'hot', badge: 'too many connections' }],
        links: [{ from: 'fn', to: 'db' }],
        flows: [
          { path: ['fn', 'db'], tone: 'request', label: 'connect', count: 8, duration: 1.2 },
          { path: ['db', 'fn'], tone: 'error', label: 'refused', count: 3, duration: 1.2, delay: 1.4 },
        ],
        caption: 'Fast scale-out meets a fixed-size database',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Choose by the shape of the work',
      eli5: 'Pack every dish in a sealed lunchbox. Keep your own cooks for the steady rush, and call an on-call cook for the odd job that comes and goes.',
      body: [
        'An **image** packages code with its whole environment, so every machine runs the same thing. **Containers** are light, kernel-sharing processes. VMs isolate more strongly and start slower. An **orchestrator** places containers, restarts failures and keeps the declared copy count, and **autoscaling** adjusts that count with a delay.',
        '**Functions** run per event and cost nothing idle, with cold starts, time limits and connection storms as the price. A sensible default: steady, latency-sensitive services in containers, spiky or event-driven jobs such as thumbnails in functions.',
      ],
      keyIdea: 'Steady load favors containers you control. Spiky, event-driven work favors functions you only pay for when they run.',
      metrics: { start: '~2 s / ms', unit: 'pods + functions', idle: 'min pods + $0', ops: 'cluster + code' },
      scene: {
        nodes: [{ ...sched, status: 'ok' }, { ...node1, badge: 'shop API' }, { ...node2, badge: 'shop API' }, { ...node3, kind: 'worker', label: 'functions', badge: 'thumbnails' }],
        links: clusterLinks,
        flows: [
          { path: ['sched', 'node1'], tone: 'event', duration: 1.2 },
          { path: ['sched', 'node2'], tone: 'event', duration: 1.2, delay: 0.3 },
        ],
      },
      quiz: {
        question: 'A service handles 5,000 requests per second around the clock and needs a steady 50 ms p99. Where does it most likely belong?',
        options: [
          'Functions, since they scale to zero',
          'Containers on an orchestrator, or a managed container platform',
          'One large VM with no orchestrator',
          'Functions with no warm copies to save money',
        ],
        answer: 1,
        explain: 'Steady high load makes per-millisecond billing expensive, and cold starts threaten the p99. Long-running containers fill nodes efficiently and keep latency flat. Functions fit spiky, event-driven work.',
      },
    },
  ],
};
