import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const laptop: SceneNode = { id: 'laptop', kind: 'client', at: at(-3.8, -3.8), label: 'dev laptop', sub: 'Python 3.12' };
const prod: SceneNode = { id: 'prod', kind: 'server', at: at(3.8, -3.8), label: 'prod server', sub: 'Python 3.9' };
const image: SceneNode = { id: 'image', kind: 'block', at: at(0, -3.8), label: 'image', sub: 'shop-api:1.4.2', icon: 'Package', tint: 'violet' };
const registry: SceneNode = { id: 'registry', kind: 'storage', at: at(0, -3.8), label: 'image registry', sub: 'shop-api:1.4.2' };
const host: SceneNode = { id: 'host', kind: 'server', at: at(0, -3.8), label: 'host', sub: 'one shared kernel' };
const sched: SceneNode = { id: 'sched', kind: 'block', at: at(0, -3.8), label: 'orchestrator', sub: 'Kubernetes', icon: 'Workflow', tint: 'violet' };
const node1: SceneNode = { id: 'node1', kind: 'server', at: at(-3.8, 3.8), label: 'node 1' };
const node2: SceneNode = { id: 'node2', kind: 'server', at: at(0, 3.8), label: 'node 2' };
const node3: SceneNode = { id: 'node3', kind: 'server', at: at(3.8, 3.8), label: 'node 3' };
const users: SceneNode = { id: 'users', kind: 'phone', at: at(-4, 0), label: 'shoppers' };
const fn: SceneNode = { id: 'fn', kind: 'block', at: at(0, 0), label: 'resize function', sub: '512 MB · 300 ms', icon: 'Zap', tint: 'amber' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4, 0), label: 'Postgres', sub: '100 connections max' };

const clusterLinks = [
  link('sched', 'node1', { style: 'dashed' }),
  link('sched', 'node2', { style: 'dashed' }),
  link('sched', 'node3', { style: 'dashed' }),
];

export const containersServerless: Lesson = {
  id: 'containers-serverless',
  title: 'Containers and serverless',
  tagline: 'Package code so it runs the same everywhere, let a scheduler place it, or hand the servers to someone else.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why "works on my machine" happens, and how an image, layers and a registry fix it',
    'How containers work (namespaces, cgroups) and how they differ from virtual machines',
    'Keeping containers stateless, with data in volumes and databases',
    'What an orchestrator does: scheduling, services, health probes, self-healing and rolling updates',
    'Autoscaling pods and nodes, and functions as a service with triggers and cold starts',
    'Limits, cost and managed container platforms, and how to choose',
  ],
  metrics: [
    { key: 'start', label: 'Start time', icon: 'Timer' },
    { key: 'unit', label: 'Unit', icon: 'Package' },
    { key: 'idle', label: 'Idle cost', icon: 'Receipt' },
    { key: 'ops', label: 'You manage', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'My machine',
      tag: 'problem',
      heading: 'It works on my machine',
      eli5: 'A cook makes soup at home with her own spices, and it tastes great. At the restaurant the shelf has different spices, so the same recipe tastes wrong.',
      body: [
        'A developer builds the shop API on a laptop with Python 3.12. Tests pass. The deploy script copies the code to production servers with Python 3.9 and an old library, installed by hand. Someone patched one of them during an incident, so no two servers match.',
        'The service crashes on start. The code was never the whole program. It also needs the runtime, libraries and system packages around it.',
      ],
      keyIdea: 'Code depends on everything installed around it, so shipping code alone to a server that differs from the laptop breaks in ways no test caught.',
      metrics: { start: 'minutes', unit: 'code', idle: 'full server', ops: 'everything' },
      metricTones: { unit: 'bad', ops: 'bad' },
      scene: {
        nodes: [
          { ...laptop, status: 'ok', badge: 'tests pass' },
          { ...prod, status: 'down', badge: 'ImportError', chips: [{ text: 'crash on start', tone: 'bad' }] },
        ],
        links: [link('laptop', 'prod', { label: 'copy code' })],
        flows: [
          { path: ['laptop', 'prod'], tone: 'request', label: 'app.py', duration: 1.4 },
          { path: ['prod', 'laptop'], tone: 'error', label: 'crash', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Laptop vs production',
          icon: 'Server',
          rows: [
            { text: 'Python', value: '3.12 vs 3.9', tone: 'bad' },
            { text: 'Image library', value: 'recent vs 2 years old', tone: 'bad' },
            { text: 'Server 1 vs 2 vs 3', value: 'all different', tone: 'warn' },
          ],
          footer: { text: 'Nobody wrote down what the servers have', tone: 'bad' },
        },
        caption: 'Same code, different machine',
      },
    },
    {
      title: 'Image',
      tag: 'concept',
      heading: 'Ship the whole box: the image',
      eli5: 'The cook packs the soup with its own spices into a sealed lunchbox. Any kitchen just heats the box. The box is the **image**.',
      body: [
        'An **image** is a read-only package of the app plus everything it needs: the runtime, the libraries and the system packages. It is built once from a recipe file and given a version tag such as `shop-api:1.4.2`.',
        'What you tested is now the thing you ship.',
      ],
      keyIdea: 'An image packages the app with its whole environment, so what you tested is exactly what runs in production.',
      metrics: { start: 'seconds', unit: 'image', idle: 'full server', ops: 'OS + runtime' },
      metricTones: { unit: 'good' },
      scene: {
        nodes: [laptop, { ...image, status: 'active', badge: 'v1.4.2' }, { ...prod, sub: 'any machine', status: 'dim' }],
        links: [link('laptop', 'image', { label: 'build' }), link('image', 'prod', { style: 'dashed' })],
        flows: [{ path: ['laptop', 'image'], tone: 'data', label: 'recipe + code', duration: 1.6 }],
        panel: {
          title: 'Inside shop-api:1.4.2',
          icon: 'Package',
          rows: [
            { text: 'Runtime', value: 'Python 3.12' },
            { text: 'Libraries', value: 'pinned versions' },
            { text: 'System packages', value: 'baked in' },
            { text: 'App code', value: 'your commit' },
          ],
          footer: { text: 'Read-only, versioned, built once', tone: 'good' },
        },
        caption: 'Build once from a recipe',
      },
    },
    {
      title: 'Layers',
      tag: 'concept',
      heading: 'Images are built in layers',
      eli5: 'The lunchbox is packed in trays. If only the garnish changed, you swap the top tray and keep the soup tray, so repacking takes seconds.',
      body: [
        'Each recipe step makes a **layer**. If only your code changed, the layers with Python and the libraries are reused from cache and only the last layer is rebuilt.',
        'Put slow, rarely changing steps first and the code last. A rebuild and push then takes seconds.',
      ],
      keyIdea: 'Order the recipe from slow-changing to fast-changing, so a code change rebuilds only the top layer.',
      metrics: { start: 'seconds', unit: 'image', idle: 'full server', ops: 'OS + runtime' },
      scene: {
        nodes: [laptop, { ...image, status: 'active', badge: '4 layers' }],
        links: [link('laptop', 'image', { label: 'docker build' })],
        flows: [{ path: ['laptop', 'image'], tone: 'data', label: 'changed layer only', duration: 1.4 }],
        panel: {
          title: 'Rebuild after a code change',
          icon: 'Layers',
          rows: [
            { text: 'python:3.12-slim', value: 'cached', tone: 'good' },
            { text: 'pip install', value: 'cached', tone: 'good' },
            { text: 'COPY . .', value: 'rebuilt', tone: 'warn' },
          ],
          footer: { text: 'Only the top layer is pushed', tone: 'good' },
        },
        caption: 'Reuse what did not change',
      },
      code: {
        language: 'bash',
        title: 'A Dockerfile for the shop API, then build and push',
        source: `# Dockerfile
# runtime pinned in the image
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
# cached layer
RUN pip install --no-cache-dir -r requirements.txt
# only this layer changes per commit
COPY . .
# do not run as root
USER 10001
CMD ["gunicorn", "-b", "0.0.0.0:8080", "shop.app:app"]

# build, tag with the version, push to the registry
docker build -t registry.internal/shop-api:1.4.2 .
docker push registry.internal/shop-api:1.4.2`,
        highlight: [3, 7, 9, 15],
      },
    },
    {
      title: 'Registry',
      tag: 'concept',
      heading: 'A registry stores and hands out images',
      eli5: 'The lunchboxes sit on a shelf with labels. Every kitchen takes the box with the label it needs, and a label never changes what is inside.',
      body: [
        'A **registry** stores images by name and tag. The build pushes `shop-api:1.4.2` once, and every server pulls the same bytes.',
        'Never reuse a tag. `1.4.2` always means the same image, so a rollback is just pulling `1.4.1` again.',
      ],
      keyIdea: 'Push an image once under an immutable tag, and every environment pulls exactly the same bytes.',
      metrics: { start: 'seconds', unit: 'image', idle: 'full server', ops: 'OS + runtime' },
      scene: {
        nodes: [laptop, { ...registry, status: 'active', badge: 'v1.4.2' }, { ...prod, sub: 'runs the image', status: 'ok', badge: 'same bytes' }],
        links: [link('laptop', 'registry', { label: 'push' }), link('registry', 'prod', { label: 'pull' })],
        flows: [
          { path: ['laptop', 'registry'], tone: 'data', label: 'build + push', duration: 1.4 },
          { path: ['registry', 'prod'], tone: 'data', label: 'pull', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Tags in the registry',
          icon: 'Package',
          rows: [
            { text: 'shop-api:1.4.1', value: 'previous', tone: 'muted' },
            { text: 'shop-api:1.4.2', value: 'current', tone: 'good' },
          ],
          footer: { text: 'A tag is never overwritten', tone: 'good' },
        },
        caption: 'Build once, run the same image everywhere',
      },
    },
    {
      title: 'Container',
      tag: 'concept',
      heading: 'A container is a running image',
      eli5: 'The sealed lunchbox is the image. When a cook opens one and serves the soup, that serving is the **container**. Salt and spice from the shelf are added at the table.',
      body: [
        'A **container** is a running copy of an image, the way a process is a running copy of a program. Laptop, test cluster and production run byte-for-byte the same software.',
        'Only config and secrets come in from outside, through environment variables or mounted files. In Kubernetes a **ConfigMap** holds plain settings and a **Secret** holds passwords.',
      ],
      keyIdea: 'One image, many containers, and only config and secrets differ between environments.',
      metrics: { start: '~1 s', unit: 'container', idle: 'full server', ops: 'OS + runtime' },
      scene: {
        nodes: [
          { ...registry, at: at(-3.8, -3.8) },
          { ...host, at: at(3.8, -3.8), status: 'ok', chips: ['shop-api:1.4.2'] },
          { id: 'cfg', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'config', sub: 'env + secrets', icon: 'KeyRound', tint: 'amber' },
        ],
        links: [link('registry', 'host', { label: 'pull image' }), link('cfg', 'host', { label: 'injected at start' })],
        flows: [
          { path: ['registry', 'host'], tone: 'data', label: 'image', duration: 1.4 },
          { path: ['cfg', 'host'], tone: 'handshake', label: 'DB_URL', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Same image, two environments',
          icon: 'KeyRound',
          rows: [
            { text: 'Env var DB_URL', value: 'db.staging or db.prod' },
            { text: 'ConfigMap', value: 'plain settings, env or file' },
            { text: 'Secret', value: 'passwords, mounted file' },
            { text: 'Image', value: 'shop-api:1.4.2', tone: 'good' },
          ],
          footer: { text: 'Secrets are mounted, never baked in', tone: 'muted' },
        },
        caption: 'The image stays fixed, config comes from outside',
      },
    },
    {
      title: 'Isolation',
      tag: 'concept',
      heading: 'How a container is fenced off',
      eli5: 'Each cook gets a counter with a fence. Cooks cannot see into the next counter, and each is allowed only so many burners and so much flour.',
      body: [
        'The host kernel uses **namespaces** to give each container its own view of files, processes and network. **Cgroups** cap its share of CPU and memory.',
        'A container is an ordinary process with blinders on, not a separate machine.',
      ],
      keyIdea: 'Namespaces limit what a container can see, and cgroups limit what it can use.',
      metrics: { start: '~1 s', unit: 'container', idle: 'shared host', ops: 'OS + runtime' },
      scene: {
        nodes: [
          { ...host, status: 'ok', badge: '3 containers' },
          { id: 'c1', kind: 'container', at: at(-3.8, 3.8), label: 'shop api', chips: ['0.5 CPU · 512 MB'] },
          { id: 'c2', kind: 'container', at: at(0, 3.8), label: 'search', chips: ['1 CPU · 1 GB'] },
          { id: 'c3', kind: 'container', at: at(3.8, 3.8), label: 'cart', chips: ['0.25 CPU · 256 MB'] },
        ],
        links: [link('host', 'c1', { style: 'dashed' }), link('host', 'c2', { style: 'dashed' }), link('host', 'c3', { style: 'dashed' })],
        panel: {
          title: 'Two kernel features',
          icon: 'Shield',
          rows: [
            { text: 'Namespaces', value: 'own files, PIDs, network' },
            { text: 'Cgroups', value: 'CPU and memory caps' },
          ],
          footer: { text: 'Same kernel underneath', tone: 'muted' },
        },
        caption: 'Fenced counters in one kitchen',
      },
    },
    {
      title: 'Container vs VM',
      tag: 'concept',
      heading: 'Containers share a kernel, VMs bring their own',
      eli5: 'A virtual machine is like building a whole new kitchen for each cook. Containers are cooks sharing one big kitchen, each at a fenced-off counter.',
      body: [
        'A **virtual machine** boots its own operating system on a hypervisor: about a gigabyte of memory, tens of seconds to start, and strong isolation.',
        'A container skips the second OS. It starts in about a second and costs only what the app uses, so one host can run dozens.',
      ],
      keyIdea: 'Containers are fenced-off processes on one kernel: light and fast. A VM brings its own OS and costs more.',
      metrics: { start: '~1 s', unit: 'container', idle: 'shared host', ops: 'OS + runtime' },
      metricTones: { start: 'good' },
      scene: {
        nodes: [
          { ...registry, at: at(0, -4) },
          { id: 'vm', kind: 'server', at: at(-3.8, 2), label: 'VM', sub: 'full OS · ~1 GB', badge: '~30 s boot' },
          { ...host, at: at(3.8, 2), status: 'ok', badge: '20 containers' },
        ],
        links: [link('registry', 'vm', { style: 'dashed' }), link('registry', 'host', { style: 'dashed' })],
        flows: [
          { path: ['registry', 'vm'], tone: 'data', label: 'disk image + OS', duration: 3 },
          { path: ['registry', 'host'], tone: 'data', label: 'app layers only', duration: 1 },
        ],
        panel: {
          title: 'VM vs container',
          icon: 'Scale',
          rows: [
            { text: 'Boot time', value: '~30 s vs ~1 s' },
            { text: 'Memory overhead', value: '~1 GB vs app only' },
            { text: 'Isolation', value: 'hypervisor vs kernel' },
          ],
        },
        caption: 'One OS per VM, one kernel for many containers',
      },
    },
    {
      title: 'Shared kernel',
      tag: 'tradeoff',
      heading: 'The catch: one kernel for everyone',
      eli5: 'Cooks at fenced counters share one kitchen floor. If one cook breaks through a fence, they can reach the next counter. A separate kitchen is safer.',
      body: [
        'A kernel bug can let one container reach another, so mixing untrusted tenants on one host needs extra care.',
        'In practice most containers run inside VMs. The cloud gives you VMs, and you pack containers onto them.',
      ],
      keyIdea: 'Containers are light but isolate more weakly than VMs, so untrusted code needs a VM or a hardened sandbox.',
      metrics: { start: '~1 s', unit: 'container', idle: 'shared host', ops: 'OS + runtime' },
      metricTones: { ops: 'warn' },
      scene: {
        nodes: [
          { ...host, status: 'hot', badge: 'shared kernel' },
          { id: 'ta', kind: 'container', at: at(-3.8, 3.8), label: 'customer A', status: 'hot', chips: [{ text: 'untrusted code', tone: 'bad' }] },
          { id: 'tb', kind: 'container', at: at(3.8, 3.8), label: 'customer B', chips: ['private data'] },
        ],
        links: [link('host', 'ta', { style: 'dashed' }), link('host', 'tb', { style: 'dashed', label: 'same kernel', labelTone: 'warn' })],
        flows: [{ path: ['ta', 'host', 'tb'], tone: 'error', label: 'kernel exploit', duration: 2.2 }],
        caption: 'A kernel flaw can cross the fence',
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
      title: 'Stateless',
      tag: 'concept',
      heading: 'Containers are disposable, so keep data outside',
      eli5: 'A serving of soup gets thrown away when the plate is cleared. Anything you want to keep goes in the pantry, not on the plate.',
      body: [
        'A container\'s writable layer disappears when it is replaced. Keep the app **stateless** and put data outside: a managed database, object storage, or a mounted **persistent volume**.',
        'Then any copy can be killed and replaced without losing anything. Run databases as managed services where you can, since a volume is pinned to one zone and stateful workloads need extra care.',
      ],
      keyIdea: 'Treat containers as disposable and keep state in a database, object storage or a volume.',
      metrics: { start: '~1 s', unit: 'container', idle: 'shared host', ops: 'OS + runtime' },
      scene: {
        nodes: [
          { id: 'c1', kind: 'container', at: at(-3.8, -3.8), label: 'shop api', status: 'active', chips: [{ text: 'local files: lost on restart', tone: 'warn' }] },
          { ...db, at: at(3.8, -3.8), sub: 'survives restarts', status: 'ok' },
          { id: 'vol', kind: 'storage', at: at(0, 3.8), label: 'persistent volume', sub: 'uploads' },
        ],
        links: [link('c1', 'db', { label: 'orders' }), link('c1', 'vol', { label: 'mounted' })],
        flows: [
          { path: ['c1', 'db'], tone: 'request', label: 'INSERT order', duration: 1.4 },
          { path: ['c1', 'vol'], tone: 'data', label: 'upload.jpg', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Where state lives',
          icon: 'Database',
          rows: [
            { text: 'Container disk', value: 'gone on restart', tone: 'bad' },
            { text: 'Database', value: 'durable', tone: 'good' },
            { text: 'Persistent volume', value: 'outlives pod, one zone', tone: 'warn' },
          ],
        },
        caption: 'Kill a copy, lose nothing',
      },
    },
    {
      title: 'Desired state',
      tag: 'concept',
      heading: 'An orchestrator keeps reality matching your wishes',
      eli5: 'The head chef keeps a list: three soup counters must always be open. She is the **orchestrator**. You hand her the list, and she works out the rest.',
      body: [
        'With 40 services and 300 containers, nobody picks servers by hand. An **orchestrator** such as Kubernetes takes a **desired state**: run 3 copies of `shop-api:1.4.2`, each with 0.5 CPU and 512 MB.',
        'You tell it what should be true, not the steps. Each copy runs as a **pod**: one or more containers scheduled together, here one container.',
      ],
      keyIdea: 'You declare how many copies should run and with what resources. The orchestrator keeps fixing reality until it matches.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      scene: {
        nodes: [
          { ...laptop, label: 'you', sub: 'kubectl apply' },
          { ...sched, status: 'active', badge: 'want 3 pods' },
          { id: 'state', kind: 'block', at: at(3.8, -3.8), label: 'cluster state', sub: 'desired + actual', icon: 'Database', tint: 'teal' },
        ],
        links: [link('laptop', 'sched', { label: 'declare' }), link('sched', 'state', { arrow: 'both' })],
        flows: [
          { path: ['laptop', 'sched'], tone: 'request', label: 'replicas: 3', duration: 1.4 },
          { path: ['sched', 'state'], tone: 'data', label: 'store', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Desired state',
          icon: 'List',
          rows: [
            { text: 'Image', value: 'shop-api:1.4.2' },
            { text: 'Pods', value: '3' },
            { text: 'CPU per pod', value: '0.5' },
            { text: 'Memory per pod', value: '512 MB' },
          ],
        },
        caption: 'Declare the goal, not the steps',
      },
    },
    {
      title: 'Scheduler',
      tag: 'concept',
      heading: 'The scheduler picks a node for each copy',
      eli5: 'The head chef looks at which kitchens have a free counter and spare burners, and spreads the three soup counters across different kitchens.',
      body: [
        'The **scheduler** places each pod on a node with enough free CPU and memory, using the **requests** you declared. It spreads pods across nodes, so one dead machine does not take all three.',
        'A **limit** is a hard cap: a pod over its memory limit is OOM-killed, and one over its CPU limit is throttled. Set requests honestly.',
      ],
      keyIdea: 'The scheduler matches each pod\'s requested resources to a node with room, and spreads pods for safety.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      scene: {
        nodes: [
          { ...sched, status: 'active', badge: 'want 3 pods' },
          { ...node1, chips: ['pod api-1'] },
          { ...node2, chips: ['pod api-2'] },
          { ...node3, chips: ['pod api-3'] },
        ],
        links: clusterLinks,
        flows: [
          { path: ['sched', 'node1'], tone: 'event', label: 'place pod', duration: 1.2 },
          { path: ['sched', 'node2'], tone: 'event', duration: 1.2, delay: 0.3 },
          { path: ['sched', 'node3'], tone: 'event', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Request vs limit',
          icon: 'Gauge',
          rows: [
            { text: 'Request', value: 'reserved for placement' },
            { text: 'Limit', value: 'hard cap', tone: 'warn' },
            { text: 'Memory over limit', value: 'OOM kill', tone: 'bad' },
            { text: 'CPU over limit', value: 'throttled', tone: 'warn' },
          ],
        },
        caption: 'Three pods, spread across three nodes',
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
            limits: { cpu: 500m, memory: 512Mi }
          readinessProbe:              # no traffic until this passes
            httpGet: { path: /ready, port: 8080 }
          livenessProbe:               # cheap, never checks the database
            httpGet: { path: /alive, port: 8080 }`,
        highlight: [6, 15, 17, 19, 21],
      },
    },
    {
      title: 'Service address',
      tag: 'concept',
      heading: 'One stable address in front of moving copies',
      eli5: 'Cooks move between counters all day, so diners never ask a cook directly. They order at one window, and the window hands the order to a free cook.',
      body: [
        'Copies come and go, so their IPs change. A **service** gives them one stable address and spreads calls across the healthy copies.',
        'An **ingress** or load balancer brings outside traffic to that address.',
      ],
      keyIdea: 'A service address hides the churn of copies, so callers never track individual containers.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      scene: {
        nodes: [
          users,
          { id: 'ing', kind: 'lb', at: at(0, 0), label: 'ingress', sub: 'shop.example.com' },
          { id: 'svc', kind: 'block', at: at(4, 0), label: 'shop-api service', sub: 'one stable address', icon: 'Network', tint: 'blue', chips: ['10.0.1.7', '10.0.2.4', '10.0.3.9'] },
        ],
        links: [link('users', 'ing', { label: 'HTTPS' }), link('ing', 'svc')],
        flows: [
          { path: ['users', 'ing', 'svc'], tone: 'request', label: 'GET /cart', duration: 2 },
          { path: ['svc', 'ing', 'users'], tone: 'response', duration: 2, delay: 2.1 },
        ],
        caption: 'Callers see one address, the copies behind it change',
      },
    },
    {
      title: 'Probes',
      tag: 'concept',
      heading: 'Health probes decide who gets traffic',
      eli5: 'The head chef asks each cook "are you ready?" before sending diners over. If a cook is stuck and never answers, she sends a fresh one.',
      body: [
        'The **kubelet** on each node calls each pod\'s health endpoints. A failing **readiness** probe (`/ready`) means no traffic yet, which covers warm-up. A **liveness** probe (`/alive`) that keeps failing means restart.',
        'Liveness must be cheap and must not check dependencies, or a slow database restarts every pod. The YAML is in the previous step.',
      ],
      keyIdea: 'Readiness gates traffic, liveness triggers restarts, and together they keep broken copies out of rotation.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      scene: {
        nodes: [
          { id: 'kubelet', kind: 'block', at: at(0, -3.8), label: 'kubelet', sub: 'on each node', icon: 'Activity', tint: 'violet', status: 'active', badge: 'probing' },
          { id: 'p1', kind: 'container', at: at(-3.8, 3.8), label: 'api #1', status: 'ok', chips: [{ text: 'ready', tone: 'good' }] },
          { id: 'p2', kind: 'container', at: at(3.8, 3.8), label: 'api #2', status: 'hot', chips: [{ text: 'not ready', tone: 'warn' }] },
        ],
        links: [link('kubelet', 'p1', { style: 'dashed' }), link('kubelet', 'p2', { style: 'dashed' })],
        flows: [
          { path: ['kubelet', 'p1', 'kubelet'], tone: 'response', label: '200 /ready', duration: 1.6 },
          { path: ['kubelet', 'p2', 'kubelet'], tone: 'error', label: '503 warming', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Two probes',
          icon: 'Activity',
          rows: [
            { text: 'Readiness fails', value: 'no traffic', tone: 'warn' },
            { text: 'Liveness fails repeatedly', value: 'restart', tone: 'bad' },
            { text: 'Both pass', value: 'serving', tone: 'good' },
          ],
        },
        caption: 'Only ready pods get requests',
      },
    },
    {
      title: 'Self-healing',
      tag: 'case',
      heading: 'Case: a node dies during lunch',
      eli5: 'One kitchen loses power. The head chef notices that one soup counter went dark and opens a new one in a kitchen that still works.',
      body: [
        'At 12:10 node 3 loses power. Kubernetes marks it NotReady after about 40 s, then waits about 5 min by default before evicting its pods, unless tuned. For those minutes capacity sits at 2 of 3.',
        'Then the controller creates the missing pod and the scheduler places it on node 2, where the image is cached. Nobody was paged. This is why you run at least 2 or 3 pods and leave spare room on each node.',
      ],
      keyIdea: 'Because the orchestrator compares desired and actual state in a loop, a dead node becomes a dip in capacity lasting minutes, not an outage, provided you run spare pods.',
      metrics: { start: '~5 min', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      metricTones: { start: 'warn' },
      scene: {
        nodes: [
          { ...sched, status: 'active', badge: '2 of 3 pods running' },
          { ...node1, chips: ['pod api-1'] },
          { ...node2, status: 'ok', chips: ['pod api-2', { text: 'new pod api-3', tone: 'good' }] },
          { ...node3, status: 'down', badge: 'no heartbeat' },
        ],
        links: clusterLinks,
        flows: [
          { path: ['sched', 'node3'], tone: 'error', label: 'heartbeat?', duration: 1.2 },
          { path: ['sched', 'node2'], tone: 'event', label: 'controller creates, scheduler places', duration: 1.2, delay: 1.4 },
        ],
        caption: 'The pod moves after a wait, the count returns to three',
      },
    },
    {
      title: 'Rolling update',
      tag: 'concept',
      heading: 'Ship a new version without downtime',
      eli5: 'To change the recipe, the head chef opens one counter with the new soup, waits until it is ready, then closes one old counter, one at a time. If the new soup tastes bad, she stops.',
      body: [
        'To ship `1.4.3`, the orchestrator starts a new pod, waits for readiness, then stops an old one, repeating until all three are new. If new pods fail their probes, the rollout halts and `1.4.2` keeps serving.',
        'Rollback is `kubectl rollout undo`, which redeploys the old tag. Schema changes must stay backward compatible, or `1.4.2` breaks on the migrated database.',
        'A **canary** sends a small traffic share to the new version first. **Blue/green** runs a full second set and switches all traffic at once.',
      ],
      keyIdea: 'Rolling updates swap copies one at a time behind readiness checks, so a bad release stalls instead of causing an outage.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'cluster nodes', ops: 'cluster' },
      scene: {
        nodes: [
          { ...sched, status: 'active', badge: '1.4.2 to 1.4.3' },
          { ...node1, status: 'ok', chips: [{ text: 'pod 1.4.3', tone: 'good' }] },
          { ...node2, chips: ['pod 1.4.2'] },
          { ...node3, chips: ['pod 1.4.2'] },
        ],
        links: clusterLinks,
        flows: [
          { path: ['sched', 'node1'], tone: 'event', label: 'start 1.4.3', duration: 1.2 },
          { path: ['sched', 'node2'], tone: 'event', label: 'next', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Rollout order',
          icon: 'Repeat',
          rows: [
            { text: 'Rolling', value: 'one pod at a time' },
            { text: 'Canary', value: 'small traffic share first' },
            { text: 'Blue/green', value: 'switch all traffic' },
            { text: 'Probe fails', value: 'rollout halts', tone: 'warn' },
            { text: 'Rollback', value: 'keep schema compatible', tone: 'warn' },
          ],
        },
        caption: 'One new pod in, one old pod out',
      },
      quiz: {
        question: 'During a rolling update, every new copy of 1.4.3 keeps failing its readiness probe. What happens?',
        options: [
          'All old copies are stopped anyway, causing an outage',
          'The rollout stalls and the old 1.4.2 copies keep serving traffic',
          'The orchestrator sends traffic to the new copies anyway',
          'The cluster scales to zero copies',
        ],
        answer: 1,
        explain: 'Readiness gates traffic and the rollout waits for it. New copies get no requests while failing, and old copies are only removed as new ones become ready, so users stay on 1.4.2 until you fix or roll back.',
      },
    },
    {
      title: 'Autoscaling',
      tag: 'concept',
      heading: 'Autoscaling: more copies when traffic grows',
      eli5: 'When a big crowd walks in, the head chef opens more soup counters. When it gets quiet, she closes the extra ones. That is **autoscaling**.',
      body: [
        'Traffic at 8 PM is four times the 4 AM level. A horizontal **autoscaler** watches average CPU or requests per pod and changes the pod count to hold a target. Target 60% CPU, measured 90%, so 3 pods become 5.',
        'Scale down slowly, so a short dip does not throw away capacity you need again a minute later.',
      ],
      keyIdea: 'Autoscaling follows a metric toward a target, adding pods when load is high and removing them slowly when it falls.',
      metrics: { start: '~2 s', unit: 'pod', idle: 'min 3 pods', ops: 'cluster' },
      metricTones: { idle: 'good' },
      scene: {
        nodes: [
          { ...users, at: at(-4, -4), badge: '4x traffic' },
          { id: 'lb', kind: 'lb', at: at(0, -4), label: 'load balancer' },
          { id: 'podsA', kind: 'container', at: at(-3.8, 3.8), label: 'pods 1 to 3', status: 'hot', load: 90, chips: [{ text: '90% CPU, target 60%', tone: 'warn' }] },
          { id: 'podsB', kind: 'container', at: at(3.8, 3.8), label: 'pods 4 and 5', status: 'ok', load: 45, badge: '+2 pods' },
        ],
        links: [link('users', 'lb'), link('lb', 'podsA'), link('lb', 'podsB')],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 6, duration: 1 },
          { path: ['lb', 'podsA'], tone: 'request', count: 3, duration: 1.2, delay: 1 },
          { path: ['lb', 'podsB'], tone: 'request', count: 2, duration: 1.4, delay: 1.6 },
        ],
        caption: 'High CPU adds pods, new pods take load',
      },
    },
    {
      title: 'Node scaling',
      tag: 'concept',
      heading: 'When nodes are full, add a machine',
      eli5: 'If every kitchen is full, there is no counter to open. The head chef has to rent a whole new kitchen first, and that takes a while.',
      body: [
        'When the nodes are full, new copies wait as pending. A **cluster autoscaler** asks the cloud for another VM, which takes a minute or two to boot and join.',
        'Scaling is never instant. Set a minimum that survives a sudden spike on its own.',
      ],
      keyIdea: 'Pod scaling takes seconds and node scaling takes minutes, so keep a minimum and some headroom for sudden spikes.',
      metrics: { start: '~2 s pod, ~2 min node', unit: 'pod', idle: 'min 3 pods', ops: 'cluster' },
      metricTones: { start: 'warn' },
      scene: {
        nodes: [
          { ...sched, status: 'active', chips: [{ text: '2 pods pending', tone: 'warn' }] },
          { ...node1, status: 'hot', load: 95 },
          { ...node2, status: 'hot', load: 95 },
          { ...node3, status: 'dim', sub: 'new VM booting', badge: '~2 min' },
        ],
        links: [link('sched', 'node1', { style: 'dashed' }), link('sched', 'node2', { style: 'dashed' }), link('sched', 'node3', { style: 'dashed', label: 'boot time', labelTone: 'warn' })],
        flows: [{ path: ['sched', 'node3'], tone: 'event', label: 'add a node', duration: 2.4 }],
        caption: 'Capacity arrives minutes after the need',
      },
    },
    {
      title: 'Functions',
      tag: 'concept',
      heading: 'Functions as a service: no servers to see',
      eli5: 'Some days you only need a cook for five minutes. You call one in when an order arrives and pay only for those minutes. That on-call cook is a **function**.',
      body: [
        'With **functions as a service** you upload a single function and say what triggers it. The provider runs it, scales it from zero to thousands of copies, and bills per request and per millisecond.',
        'A photo upload fires a function that resizes it in 300 ms. At 50,000 uploads a day you pay for about 4 hours of compute, and nothing at 3 AM.',
      ],
      keyIdea: 'Functions run only when an event arrives and bill only for that time, which suits spiky, event-driven work.',
      metrics: { start: 'ms warm', unit: 'function', idle: '$0', ops: 'your code' },
      metricTones: { idle: 'good', ops: 'good' },
      scene: {
        nodes: [
          { id: 'bucket', kind: 'storage', at: at(-4, 0), label: 'photo upload', sub: 'object storage', status: 'active', badge: 'new photo' },
          { ...fn, status: 'ok', badge: 'x 40 in parallel' },
          { id: 'thumbs', kind: 'storage', at: at(4, 0), label: 'thumbnails' },
        ],
        links: [link('bucket', 'fn', { label: 'event' }), link('fn', 'thumbs')],
        flows: [
          { path: ['bucket', 'fn'], tone: 'event', label: 'photo.jpg', count: 3, duration: 1.2 },
          { path: ['fn', 'thumbs'], tone: 'data', label: 'thumb.jpg', count: 3, duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'The bill',
          icon: 'Receipt',
          rows: [
            { text: '50,000 uploads x 300 ms', value: '~4 h compute' },
            { text: 'At 3 AM, no uploads', value: '$0', tone: 'good' },
          ],
        },
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
      title: 'Triggers',
      tag: 'concept',
      heading: 'Triggers and retries',
      eli5: 'A bell rings when an order arrives, and an on-call cook comes. If the cook trips on the way, the bell rings again, so the same order might reach a cook twice.',
      body: [
        'A function can be triggered by an HTTP request, a file upload, a queue message or a schedule. Delivery is usually **at least once**: after a failure the provider retries, so the same event can arrive twice.',
        'Write handlers to be **idempotent**, so a second run changes nothing. A thumbnail written to a fixed key already is. An order insert needs a dedupe key, as in the code below.',
      ],
      keyIdea: 'Events can be delivered more than once, so a function must give the same result when it runs twice on the same event.',
      metrics: { start: 'ms warm', unit: 'function', idle: '$0', ops: 'your code' },
      scene: {
        nodes: [
          { id: 'bucket', kind: 'storage', at: at(-5.25, 0), label: 'photo upload' },
          { id: 'queue', kind: 'queue', at: at(-1.75, 0), label: 'event queue', chips: ['photo.jpg'] },
          { ...fn, at: at(1.75, 0), status: 'active' },
          { id: 'thumbs', kind: 'storage', at: at(5.25, 0), label: 'thumbnails' },
        ],
        links: [link('bucket', 'queue'), link('queue', 'fn'), link('fn', 'thumbs')],
        flows: [
          { path: ['bucket', 'queue', 'fn'], tone: 'event', label: 'photo.jpg', duration: 1.8 },
          { path: ['fn', 'queue'], tone: 'error', label: 'failed, retry', duration: 1.4, delay: 2 },
          { path: ['queue', 'fn', 'thumbs'], tone: 'event', label: 'same event again', duration: 1.8, delay: 3.5 },
        ],
        panel: {
          title: 'What can trigger a function',
          icon: 'Webhook',
          rows: [
            { text: 'HTTP request' },
            { text: 'File lands in a bucket' },
            { text: 'Queue message' },
            { text: 'Schedule' },
            { text: 'Thumbnail to a fixed key', value: 'idempotent', tone: 'good' },
            { text: 'Order insert', value: 'needs dedupe key', tone: 'warn' },
          ],
          footer: { text: 'Delivery: at least once', tone: 'warn' },
        },
        caption: 'The same event may arrive twice',
      },
      code: {
        language: 'python',
        title: 'An idempotent handler: skip events already done',
        source: `def handler(event, context):
    for r in event["records"]:
        # same bucket + key + etag means the same event
        done_id = f'{r["bucket"]}/{r["key"]}/{r["etag"]}'
        if dedupe.seen(done_id):
            continue          # a retry, already processed
        create_order(r)
        dedupe.mark(done_id)`,
        highlight: [4, 5, 8],
      },
    },
    {
      title: 'Cold starts',
      tag: 'case',
      heading: 'Case: the first request waits',
      eli5: 'If no on-call cook is in the building, the first order has to wait while one drives over and ties an apron. That wait is a **cold start**.',
      body: [
        'With no warm copy, the provider must create a sandbox, load your code and run its startup. That is a **cold start**: a couple of hundred milliseconds for a small function, seconds for a heavy one.',
        'It hurts on user-facing paths. After an email campaign 200 copies start at once, and the first shoppers wait two seconds longer. Fixes: keep copies warm for a fee, shrink the package, or move setup out of the request.',
      ],
      keyIdea: 'Scaling from zero means some requests pay for startup, so functions fit background work better than latency-sensitive paths.',
      metrics: { start: '~2 s cold', unit: 'function', idle: '$0', ops: 'your code' },
      metricTones: { start: 'bad', idle: 'good' },
      scene: {
        nodes: [
          users,
          { ...fn, label: 'checkout function', sub: 'cold', status: 'hot', badge: '+2 s first call', chips: [{ text: 'POST /checkout', tone: 'warn' }] },
          { ...db, status: 'dim' },
        ],
        links: [link('users', 'fn', { label: 'cold start wait', labelTone: 'warn' }), link('fn', 'db')],
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
      heading: 'Function limits and the connection storm',
      eli5: 'On-call cooks can only stay for a short shift and keep no notes. And if a thousand arrive at once, they all queue at one small pantry door.',
      body: [
        'Functions have hard limits: a maximum run time (often around 15 minutes), memory caps and no state between calls.',
        'Scaling to 1,000 copies can open 1,000 database connections against a Postgres that allows 100. Put a connection pooler in front.',
      ],
      keyIdea: 'Fast scale-out meets fixed-size resources, so cap concurrency or pool connections to protect the database.',
      metrics: { start: 'varies', unit: 'function', idle: '$0', ops: 'your code' },
      metricTones: { ops: 'warn' },
      scene: {
        nodes: [
          { ...users, at: at(-4, 0) },
          { ...fn, label: 'functions', sub: '1,000 copies', status: 'hot' },
          { ...db, status: 'hot', badge: 'too many connections' },
        ],
        links: [link('users', 'fn'), link('fn', 'db', { label: '1,000 connections vs 100', labelTone: 'warn' })],
        flows: [
          { path: ['fn', 'db'], tone: 'request', label: 'connect', count: 8, duration: 1.2 },
          { path: ['db', 'fn'], tone: 'error', label: 'refused', count: 3, duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Typical hard limits',
          icon: 'Gauge',
          rows: [
            { text: 'Max run time', value: '~15 min', tone: 'warn' },
            { text: 'Memory', value: 'capped', tone: 'warn' },
            { text: 'State between calls', value: 'none', tone: 'warn' },
          ],
        },
        caption: 'Fast scale-out meets a fixed-size database',
      },
    },
    {
      title: 'Cost',
      tag: 'tradeoff',
      heading: 'Cost: per millisecond or per node',
      eli5: 'Hiring a cook per order is cheap on quiet days and costly on busy ones. Keeping your own cooks costs the same every day, busy or not.',
      body: [
        'At steady high traffic, per-millisecond billing costs more than servers that run all day. Containers have a flat cost per node, but someone runs the cluster.',
        'Illustrative: 50,000 uploads a day cost about $4 a month on functions against $70 on always-on containers. At 5,000 rps around the clock it flips to about $8,000 versus $700.',
        'Each provider also packages triggers differently, so moving functions away takes work.',
      ],
      keyIdea: 'Functions trade steady-state price and portability for zero idle cost. Containers trade operations work for cheaper steady load.',
      metrics: { start: 'varies', unit: 'both', idle: '$0 vs nodes', ops: 'code vs cluster' },
      scene: {
        nodes: [
          { id: 'traffic', kind: 'phone', at: at(0, -3.8), label: 'traffic' },
          { ...fn, at: at(-3.8, 3.8), label: 'functions', sub: 'pay per ms', chips: [{ text: 'idle $0', tone: 'good' }] },
          { ...node1, at: at(3.8, 3.8), label: 'containers', sub: 'pay per node', chips: [{ text: 'idle: nodes still billed', tone: 'warn' }] },
        ],
        links: [link('traffic', 'fn'), link('traffic', 'node1')],
        flows: [
          { path: ['traffic', 'fn'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['traffic', 'node1'], tone: 'request', count: 3, duration: 1.4 },
        ],
        panel: {
          title: 'Which is cheaper',
          icon: 'Receipt',
          rows: [
            { text: '50k uploads/day, functions', value: '~$4 / month', tone: 'good' },
            { text: '50k uploads/day, containers', value: '~$70 / month' },
            { text: '5,000 rps 24/7, functions', value: '~$8,000 / month', tone: 'bad' },
            { text: '5,000 rps 24/7, containers', value: '~$700 / month', tone: 'good' },
            { text: 'Who runs the cluster', value: 'you (containers)', tone: 'warn' },
          ],
          footer: { text: 'Illustrative prices, check your provider', tone: 'muted' },
        },
        caption: 'The cheaper one depends on the traffic shape',
      },
    },
    {
      title: 'Managed platforms',
      tag: 'concept',
      heading: 'The middle path: managed container platforms',
      eli5: 'You hand a lunchbox to a catering company. They find a kitchen, serve it, and open more counters when it gets busy. You never meet the head chef.',
      body: [
        'On a managed container platform you hand over an image and the provider runs and scales it, sometimes down to zero. Examples are AWS Fargate and Google Cloud Run.',
        'You keep container packaging and lose the cluster to operate.',
      ],
      keyIdea: 'A managed container platform keeps the image as the unit of deployment and moves the cluster work to the provider.',
      metrics: { start: '~seconds', unit: 'image', idle: 'low or $0', ops: 'image only' },
      metricTones: { ops: 'good' },
      scene: {
        nodes: [
          { ...registry, at: at(-4, 0), label: 'registry' },
          { id: 'platform', kind: 'block', at: at(0, 0), label: 'managed platform', sub: 'runs + scales', icon: 'Boxes', tint: 'teal', status: 'ok', chips: ['0 to 40 copies'] },
          { ...users, at: at(4, 0) },
        ],
        links: [link('registry', 'platform', { label: 'your image' }), link('users', 'platform')],
        flows: [
          { path: ['registry', 'platform'], tone: 'data', label: 'shop-api:1.4.2', duration: 1.4 },
          { path: ['users', 'platform'], tone: 'request', count: 3, duration: 1.4, delay: 1.5 },
        ],
        caption: 'Your image, their cluster',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Choose by the shape of the work',
      eli5: 'Pack every dish in a sealed lunchbox. Keep your own cooks for the steady rush, and call an on-call cook for the odd job that comes and goes.',
      body: [
        'An **image** packages code with its whole environment, so every machine runs the same thing. **Containers** are light, kernel-sharing processes. VMs isolate more strongly and start slower. An **orchestrator** places containers, restarts failures and keeps the declared copy count, and **autoscaling** adjusts it with a delay.',
        '**Functions** run per event and cost nothing idle, with cold starts and limits as the price. Steady services go in containers, and spiky jobs in functions.',
      ],
      keyIdea: 'Steady load favors containers you control. Spiky, event-driven work favors functions you only pay for when they run.',
      metrics: { start: '~2 s / ms', unit: 'pods + functions', idle: 'min pods + $0', ops: 'cluster + code' },
      scene: {
        nodes: [
          { ...sched, status: 'ok' },
          { ...node1, chips: ['shop API'] },
          { ...node2, chips: ['shop API'] },
          { ...fn, at: at(3.8, 3.8), label: 'functions', sub: 'thumbnails' },
        ],
        links: [link('sched', 'node1', { style: 'dashed' }), link('sched', 'node2', { style: 'dashed' })],
        flows: [
          { path: ['sched', 'node1'], tone: 'event', duration: 1.2 },
          { path: ['sched', 'node2'], tone: 'event', duration: 1.2, delay: 0.3 },
        ],
        caption: 'Containers for the steady load, functions for the spikes',
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
