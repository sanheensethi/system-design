import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
/** Same-row links read best as straight lines. */
const row = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, route: 'straight', ...extra });

const users: SceneNode = { id: 'users', kind: 'phone', at: at(-4.4, -3.6), label: 'users', sub: 'PawPost app' };
const lb: SceneNode = { id: 'lb', kind: 'block', size: 0.8, at: at(-1.9, -3.6), label: 'load balancer', icon: 'Split', tint: 'violet' };
const app1: SceneNode = { id: 'app1', kind: 'server', at: at(0.7, -3.6), label: 'server' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: at(3.1, 3.6), label: 'server 2', sub: '+3 more' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5.6, -3.6), label: 'database', sub: 'posts, likes' };
const storage: SceneNode = { id: 'storage', kind: 'storage', at: at(6, 3.6), label: 'photo storage' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(-1.9, 3.6), label: 'cache' };

const simpleLinks = [row('users', 'app1'), row('app1', 'db')];
const grownLinks = [
  row('users', 'lb'),
  row('lb', 'app1'),
  link('lb', 'app2'),
  row('app1', 'db'),
  link('app2', 'db'),
  row('app2', 'storage'),
];

const M = { load: '2,000 req/s', servers: '1', page: '8 s', cost: '$40' };

export const whatIsSystemDesign: Lesson = {
  id: 'what-is-system-design',
  title: 'What system design is',
  tagline: 'Meet the client, the server and the database, learn to read a diagram, and see why every design is a set of trade-offs.',
  minutes: 16,
  level: 'Beginner',
  learn: [
    'Why one machine is never enough: its limits and its single point of failure',
    'What a client, a server and a database each do',
    'How to read the boxes and arrows in a system diagram',
    'Functional requirements, non-functional requirements and what to leave out',
    'How requirements decide which parts a design needs, including stateless servers',
    'Why every part you add buys something and costs something, and the five levers',
    'A repeatable order for designing anything',
  ],
  metrics: [
    { key: 'load', label: 'Peak load', icon: 'Gauge' },
    { key: 'servers', label: 'Servers', icon: 'Server' },
    { key: 'page', label: 'Feed load time', icon: 'Timer' },
    { key: 'cost', label: 'Monthly cost', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'Launch day',
      tag: 'problem',
      heading: 'It worked fine until people showed up',
      eli5: 'A tiny restaurant with one cook is great for ten guests. On opening day a thousand guests line up at the door, and the one **server** in the kitchen cannot cook fast enough for the **users**.',
      body: [
        'You built PawPost, an app where people share photos of their pets. It runs on one rented computer. With ten friends testing it, the feed opens in 80 ms.',
        'Then a popular account mentions it. In one hour 50,000 people install the app and it receives **2,000 requests per second**. One machine answers about 500. The feed takes 8 seconds to open, then stops opening.',
      ],
      keyIdea: 'Code that works for ten people can fail for 50,000 with no bug in it.',
      metrics: M,
      metricTones: { load: 'bad', page: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '50,000 in one hour' },
          { ...app1, status: 'hot', load: 100, chips: [{ text: 'GET /feed', tone: 'warn' }, { text: 'GET /feed', tone: 'warn' }] },
        ],
        links: [row('users', 'app1', { label: '2,000 requests per second', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 6, duration: 1 },
          { path: ['app1', 'users'], tone: 'error', label: 'timeout', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Launch hour',
          icon: 'Gauge',
          rows: [
            { text: 'Requests arriving', value: '2,000 / s', tone: 'bad' },
            { text: 'One machine answers', value: '500 / s', tone: 'warn' },
            { text: 'Feed opens in', value: '8 s', tone: 'bad' },
          ],
          footer: { text: 'Four times more work than it can do', tone: 'bad' },
        },
        caption: 'One machine, four times more work than it can do',
      },
    },
    {
      title: 'Name it',
      tag: 'concept',
      heading: 'Same code, wrong shape',
      eli5: 'The recipe was fine. The kitchen was too small. Choosing how many kitchens, what each one cooks and how plates travel between them is the job of the person who plans the **system**.',
      body: [
        'The code has no bug. The same code that served ten people cannot serve 50,000 on one machine.',
        'Deciding which machines you need, what each one does and how they talk to each other is called **system design**.',
      ],
      keyIdea: 'System design is choosing the parts of a system and how they connect, so it keeps working at the size and speed you need.',
      metrics: M,
      scene: {
        nodes: [{ ...users }, { ...app1, status: 'active', badge: 'the code is fine' }, { ...db, status: 'dim' }],
        links: simpleLinks,
        panel: {
          title: 'The three decisions',
          icon: 'List',
          rows: [
            { text: 'Which parts', value: 'what to run' },
            { text: 'What each does', value: 'one job each' },
            { text: 'How they connect', value: 'who calls whom' },
          ],
          footer: { text: 'That is system design', tone: 'good' },
        },
        caption: 'Parts, jobs and connections',
      },
    },
    {
      title: 'One box limits',
      tag: 'concept',
      heading: 'One machine always runs out of something',
      eli5: 'Even the biggest kitchen has a limit: only so many stoves, shelves and doors. Past that limit the **server** cannot take one more order, however hard the cook tries.',
      body: [
        'Every machine has ceilings. The biggest reach 64 to 128 cores, 1 to 4 TB of RAM (typical: 64 to 512 GB), 100 TB of disk and 100 Gbps of network.',
        'Whichever you hit first stops you. The small rented box running PawPost hits its CPU limit at about 500 requests per second.',
        'Why not rent a bigger box? That is **vertical scaling** (scale up): simple, but it hits the ceilings above, the price climbs faster than the power, and it is still one machine. **Horizontal scaling** (scale out) adds more machines instead.',
      ],
      keyIdea: 'A single machine has hard ceilings on CPU, memory, disk and network. When demand passes the first one, you need more machines.',
      metrics: M,
      metricTones: { load: 'bad' },
      scene: {
        nodes: [{ ...users }, { ...app1, status: 'hot', load: 100 }, { ...db, status: 'dim' }],
        links: simpleLinks,
        panel: {
          title: 'Where one machine tops out',
          icon: 'Cpu',
          rows: [
            { text: 'CPU', value: '64 to 128 cores' },
            { text: 'RAM (largest; typical 64 to 512 GB)', value: '1 to 4 TB' },
            { text: 'Disk', value: 'about 100 TB' },
            { text: 'Network', value: '10 to 100 Gbps' },
            { text: 'Scale up: bigger box', value: 'ceiling, one failure point', tone: 'warn' },
            { text: 'Scale out: more boxes', value: 'no ceiling, needs a balancer' },
          ],
          footer: { text: 'Hit one and you are done', tone: 'warn' },
        },
        caption: 'Every machine has a ceiling',
      },
    },
    {
      title: 'One box dies',
      tag: 'concept',
      heading: 'One machine is also one point of failure',
      eli5: 'If the restaurant has one kitchen and the stove breaks, nobody eats. Two kitchens mean one can break and guests still get dinner.',
      body: [
        'Speed is half the story. A server fails about once every three years on average. With one machine, that day is a full outage.',
        'A part whose failure takes everything down is a **single point of failure**. A single machine cannot reliably promise 99.9%: one failure, reboot or deploy can use the whole monthly budget of 43 minutes, and nothing covers the gap. Even an infinitely fast one would need a second.',
      ],
      keyIdea: 'More machines buy speed and also survival. One machine is one single point of failure.',
      metrics: { load: '2,000 req/s', servers: '1', page: 'no answer', cost: '$40' },
      metricTones: { page: 'bad', servers: 'bad' },
      scene: {
        nodes: [{ ...users, status: 'hot' }, { ...app1, status: 'down', badge: 'crashed' }, { ...db, status: 'dim' }],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['app1', 'users'], tone: 'error', label: 'no answer', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'One machine',
          icon: 'Server',
          rows: [
            { text: 'Typical life before a failure', value: 'about 3 years' },
            { text: 'Machines that can fail', value: '1', tone: 'bad' },
            { text: 'Users served while it is down', value: '0', tone: 'bad' },
          ],
          footer: { text: 'Single point of failure', tone: 'bad' },
        },
        caption: 'The only server fails, everything stops',
      },
    },
    {
      title: 'Client',
      tag: 'concept',
      heading: 'The client asks',
      eli5: 'A guest sits at a table and orders. The guest is the **client**. The guest always speaks first, and nothing happens until somebody orders.',
      body: [
        'Start with the two parts every system has. The **client** is the program in the user\'s hands: the PawPost app on a phone, or a web browser. It shows screens and reacts to taps.',
        'It always starts the conversation. It sends a **request**, such as "give me the feed", and waits for the answer.',
      ],
      keyIdea: 'A client shows screens and sends requests. It always speaks first.',
      metrics: M,
      scene: {
        nodes: [{ ...users, label: 'client', status: 'active', chips: ['GET /feed'] }, { ...app1, status: 'dim' }],
        links: [row('users', 'app1')],
        flows: [{ path: ['users', 'app1'], tone: 'request', label: 'request: GET /feed', duration: 1.6 }],
        panel: {
          title: 'A request',
          icon: 'Code',
          code: 'GET /feed\nAuthorization: token\nAccept: JSON',
          footer: { text: 'Who is asking, and for what', tone: 'muted' },
        },
        caption: 'The client sends a request',
      },
    },
    {
      title: 'Server',
      tag: 'concept',
      heading: 'The server answers',
      eli5: 'The kitchen waits for orders and sends the plate out. The **server** is the kitchen. It never cooks unless somebody orders.',
      body: [
        'The **server** is a program running on a computer you control, in a datacenter. It waits for requests and sends back a **response**, here the list of posts.',
        'Shared rules and shared data live there. You cannot trust or update thousands of phones, and phones cannot see each other\'s photos without a meeting point.',
      ],
      keyIdea: 'A server waits for requests and sends responses. Shared logic and shared data live on the server side.',
      metrics: M,
      scene: {
        nodes: [{ ...users, label: 'client' }, { ...app1, status: 'active', chips: ['GET /feed'] }],
        links: [row('users', 'app1')],
        flows: [
          { path: ['users', 'app1'], tone: 'request', label: 'request: GET /feed', duration: 1.4 },
          { path: ['app1', 'users'], tone: 'response', label: 'response: 20 posts', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'Users',
          rows: [
            { text: 'Client', value: 'screens, taps' },
            { text: 'Server', value: 'rules, shared data' },
            { text: 'Trust', value: 'server only', tone: 'good' },
          ],
        },
        caption: 'Request out, response back',
      },
    },
    {
      title: 'Database',
      tag: 'concept',
      heading: 'Servers forget, so we add a database',
      eli5: 'The kitchen keeps its food in a pantry so it is still there tomorrow. The **database** is the pantry. Cooks come and go, and the pantry keeps everything safe on its shelves.',
      body: [
        'A server program keeps its working data in memory, and a restart wipes it. Posts, likes and accounts must survive restarts, so they go into a **database**.',
        'A database is a program that stores data on disk safely and finds it again quickly. The server sends it **queries**: "save this post", "give me the 20 newest posts".',
      ],
      keyIdea: 'Servers do the work and forget. The database remembers.',
      metrics: M,
      scene: {
        nodes: [{ ...users, label: 'client' }, { ...app1, status: 'active' }, { ...db, status: 'active', chips: ['SELECT newest 20'] }],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1'], tone: 'request', label: 'GET /feed', duration: 1 },
          { path: ['app1', 'db'], tone: 'request', label: 'SELECT newest 20', duration: 1, delay: 1.1 },
          { path: ['db', 'app1'], tone: 'response', label: 'rows', duration: 1, delay: 2.2 },
          { path: ['app1', 'users'], tone: 'response', label: 'feed', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'After a restart',
          icon: 'Database',
          rows: [
            { text: 'In server memory', value: 'gone', tone: 'bad' },
            { text: 'On disk in the database', value: 'kept', tone: 'good' },
          ],
        },
        caption: 'The server asks, the database remembers',
      },
      code: {
        language: 'python',
        title: 'The whole server, in miniature',
        source: `@app.post("/posts")
def create_post():
    user = current_user()                  # which client is asking?
    caption = request.json["caption"]
    row = db.query_one(
        "INSERT INTO posts (user_id, caption) VALUES (%s, %s) RETURNING id",
        user.id, caption,
    )
    return {"id": row.id}, 201             # response to the client

@app.get("/feed")
def feed():
    rows = db.query(
        "SELECT id, caption FROM posts ORDER BY created_at DESC LIMIT 20"
    )
    return {"posts": rows}`,
        highlight: [5, 6, 13, 14],
      },
    },
    {
      title: 'The middle',
      tag: 'concept',
      heading: 'The server stands in the middle',
      eli5: 'Guests never walk into the pantry. They order from the waiter, and the **server** goes to the **database** for them, checking who is allowed what.',
      body: [
        'This gives the classic three-part picture: client, server, database. The client never talks to the database directly.',
        'The server checks who is allowed to do what, so a bad client cannot read or delete everything. Keeping the work in the server and the memory in the database is the first design decision in almost every system.',
      ],
      keyIdea: 'Client, server, database. The server stands in between and checks every request.',
      metrics: M,
      scene: {
        nodes: [{ ...users, label: 'client' }, { ...app1, status: 'active', badge: 'checks who is allowed' }, { ...db }],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1', 'db'], tone: 'request', duration: 2 },
          { path: ['db', 'app1', 'users'], tone: 'response', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Allowed paths',
          icon: 'Shield',
          rows: [
            { text: 'client to server', value: 'yes', tone: 'good' },
            { text: 'server to database', value: 'yes', tone: 'good' },
            { text: 'client to database', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Three parts, one path',
      },
    },
    {
      title: 'Boxes, arrows',
      tag: 'concept',
      heading: 'A box is a part, an arrow is a call',
      eli5: 'Draw the restaurant on a napkin: a box for the guest, a box for the kitchen, a box for the pantry. A line from the kitchen to the pantry means the **server** fetches things from the **database**.',
      body: [
        'A **box** is one running part: a program or a group of identical machines doing one job. Its label says what job. An **arrow** means "this part calls that part". It starts at the caller and points at the one that answers.',
        'The text on an arrow says what travels: an HTTP request, a SQL query, a file.',
      ],
      keyIdea: 'Boxes are running parts. Arrows are who calls whom, and they start at the caller.',
      metrics: M,
      scene: {
        nodes: [
          { ...users, label: 'client', badge: 'box = a running part' },
          { ...app1, status: 'active' },
          { ...db },
        ],
        links: [row('users', 'app1', { label: 'HTTP request' }), row('app1', 'db', { label: 'SQL query' })],
        panel: {
          title: 'Reading the picture',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Box', value: 'a running part' },
            { text: 'Arrow', value: 'caller to answerer' },
            { text: 'Arrow label', value: 'what travels' },
          ],
        },
        caption: 'Arrows point from the caller to the one that answers',
      },
    },
    {
      title: 'Read one request',
      tag: 'concept',
      heading: 'Follow one request through the picture',
      eli5: 'To understand the napkin, follow one order with your finger: guest, then kitchen, then pantry, and back. If two boxes have no line between them, they never talk.',
      body: [
        'Read a diagram by following one request from the left: client to server, server to database, and back.',
        'If two boxes have no arrow between them, they never talk. That absence is information too. Here, the client has no arrow to the database.',
      ],
      keyIdea: 'Follow one request through the picture. A missing arrow means two parts never talk.',
      metrics: M,
      scene: {
        nodes: [{ ...users, label: 'client' }, { ...app1, status: 'active' }, { ...db, badge: 'only the server calls it' }],
        links: [row('users', 'app1', { label: 'HTTP request' }), row('app1', 'db', { label: 'SQL query' })],
        flows: [
          { path: ['users', 'app1', 'db'], tone: 'request', duration: 2 },
          { path: ['db', 'app1', 'users'], tone: 'response', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'One request, in order',
          icon: 'Route',
          rows: [
            { text: '1. client asks server', value: 'HTTP' },
            { text: '2. server asks database', value: 'SQL' },
            { text: '3. database answers server', value: 'rows' },
            { text: '4. server answers client', value: 'JSON' },
          ],
        },
        caption: 'Follow the arrows from the left',
      },
      quiz: {
        question: 'A diagram shows an arrow from "server" to "database" and no arrow between "client" and "database". What does that tell you?',
        options: [
          'The database sends data to the server on its own schedule',
          'The server starts every conversation with the database, and the client never talks to the database directly',
          'The client and the database are on the same machine',
          'The diagram is unfinished',
        ],
        answer: 1,
        explain: 'An arrow starts at the caller. The server calls the database. A missing arrow means two parts do not talk, so every read and write from the client goes through the server.',
      },
    },
    {
      title: 'What it does',
      tag: 'concept',
      heading: 'Functional requirements: what the system does',
      eli5: 'The menu lists what the restaurant makes: soup, pasta, cake. **Functional requirements** are the menu of the app. They say what a guest can order from the **server**.',
      body: [
        'Before drawing more boxes, write down what the system must do. These are the **functional requirements**: the features, stated as things a user can do.',
        'For PawPost: a user can upload a photo with a caption, open a feed of recent posts, and like a post. Each one becomes a request the server must handle and data the database must hold.',
      ],
      keyIdea: 'Functional requirements are the features: what a user can do. Each one turns into requests and stored data.',
      metrics: M,
      scene: {
        nodes: [
          { ...users, label: 'client', status: 'active' },
          { ...app1, badge: '3 features', chips: ['POST /posts', 'GET /feed', 'POST /likes'] },
          { ...db },
        ],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1', 'db'], tone: 'request', label: 'POST /posts', duration: 1.8 },
          { path: ['users', 'app1', 'db'], tone: 'request', label: 'GET /feed', duration: 1.8, delay: 2 },
          { path: ['users', 'app1', 'db'], tone: 'request', label: 'POST /likes', duration: 1.8, delay: 4 },
        ],
        panel: {
          title: 'PawPost version one',
          icon: 'List',
          rows: [
            { text: 'Upload a photo with a caption', value: 'POST /posts' },
            { text: 'Open a feed of recent posts', value: 'GET /feed' },
            { text: 'Like a post', value: 'POST /likes' },
          ],
        },
        caption: 'Three features, three kinds of request',
      },
    },
    {
      title: 'How well',
      tag: 'concept',
      heading: 'Non-functional requirements: how well it does it',
      eli5: 'The sign on the door says "food in ten minutes, open every day, room for 200 guests". **Non-functional requirements** are those promises. Launch day broke them: the one **server** kept **users** waiting.',
      body: [
        'On launch day every feature still existed. What failed was how well they worked. Those qualities are the **non-functional requirements**, and they come with numbers.',
        '**Performance**: the feed opens in under 200 ms. **Scale**: 2,000 requests per second at peak. **Availability**: up 99.9% of the time, about 43 minutes of downtime a month. **Durability**: an uploaded photo is never lost.',
      ],
      keyIdea: 'Functional requirements say what the system does. Non-functional requirements say how fast, how big and how reliable, and they shape the design.',
      metrics: M,
      metricTones: { load: 'bad', page: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot', chips: [{ text: 'wants 200 ms', tone: 'warn' }] },
          { ...app1, status: 'hot', load: 100, badge: '500 req/s max' },
          { ...db, badge: 'one copy only' },
        ],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 6, duration: 1 },
          { path: ['app1', 'users'], tone: 'error', label: '8 s', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Target versus launch day',
          icon: 'Gauge',
          rows: [
            { text: 'Performance: under 200 ms', value: '8 s', tone: 'bad' },
            { text: 'Scale: 2,000 req/s', value: '500 req/s', tone: 'bad' },
            { text: 'Availability: 99.9%', value: '1 machine', tone: 'bad' },
            { text: 'Durability: never lost', value: '1 copy', tone: 'warn' },
          ],
        },
        caption: 'Same features, missed targets',
      },
      code: {
        language: 'yaml',
        title: 'requirements.yaml: one page before any diagram',
        source: `functional:            # what a user can do
  - upload a photo with a caption
  - open a feed of recent posts
  - like a post

non_functional:        # how well, with numbers
  performance:  feed opens in under 200 ms
  scale:        2,000 requests per second at peak
  availability: 99.9% uptime (about 43 minutes down per month)
  durability:   an uploaded photo is never lost

out_of_scope:          # decided on purpose
  - comments
  - direct messages`,
        highlight: [7, 8, 9, 10],
      },
    },
    {
      title: 'Leave out',
      tag: 'concept',
      heading: 'Say what is out of scope',
      eli5: 'A pizza place that adds sushi, tacos and soup needs a bigger kitchen for each. A short menu keeps the **server** simple. Write down the dishes you will not make.',
      body: [
        'A short list is a strength. Every feature you leave out is a part you do not have to design, build and keep running.',
        'So write down what is out of scope on purpose: comments and direct messages for PawPost. If someone asks later, it becomes a new requirement and a fresh look at the numbers.',
      ],
      keyIdea: 'Decide what you will not build, and write it down. Every feature costs parts.',
      metrics: M,
      scene: {
        nodes: [
          { ...users, label: 'client' },
          { ...app1, status: 'active', badge: '3 features' },
          { id: 'comments', kind: 'block', size: 0.7, at: at(3.1, 3.6), label: 'comments', icon: 'FileText', tint: 'gray', status: 'dim' },
          { id: 'dms', kind: 'block', size: 0.7, at: at(6, 3.6), label: 'messages', icon: 'Mail', tint: 'gray', status: 'dim' },
        ],
        links: [row('users', 'app1')],
        panel: {
          title: 'Scope',
          icon: 'List',
          rows: [
            { text: 'Upload, feed, like', value: 'in', tone: 'good' },
            { text: 'Comments', value: 'out', tone: 'muted' },
            { text: 'Direct messages', value: 'out', tone: 'muted' },
          ],
          footer: { text: 'Out of scope on purpose', tone: 'muted' },
        },
        caption: 'Every feature left out is a part not built',
      },
    },
    {
      title: 'Numbers to boxes',
      tag: 'concept',
      heading: 'Scale decides how many servers',
      eli5: 'One cook makes 5 plates a minute and 20 guests want food every minute, so you hire 4 cooks and 1 spare. A host at the door, the **load balancer**, points each guest to a free cook.',
      body: [
        'A feature list tells you what to build. The numbers tell you how many boxes. One server answers 500 requests per second and we need 2,000, so we need 4 servers.',
        'We run **five**: four for the load and one spare. A **load balancer** sits in front and spreads requests across them.',
        'The 300 ms is the feed time under this load, when every request goes to the database. The earlier 80 ms was with 10 users. The monthly cost so far is 5 servers x $40 = $200 plus $20 for the load balancer.',
      ],
      keyIdea: 'Divide peak load by what one server can do, add a spare, and put a load balancer in front.',
      metrics: { load: '2,000 req/s', servers: '5', page: '300 ms', cost: '$220' },
      metricTones: { servers: 'good', page: 'warn' },
      scene: {
        nodes: [
          { ...users },
          { ...lb, status: 'active' },
          { ...app1, label: 'server 1', status: 'ok', load: 80 },
          { ...app2, status: 'ok', load: 80 },
        ],
        links: [row('users', 'lb'), row('lb', 'app1'), link('lb', 'app2')],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['lb', 'app1'], tone: 'request', count: 2, duration: 1.2, delay: 1 },
          { path: ['lb', 'app2'], tone: 'request', count: 2, duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Servers needed',
          icon: 'Scale',
          rows: [
            { text: 'Peak load', value: '2,000 / s' },
            { text: 'One server answers', value: '500 / s' },
            { text: '2,000 ÷ 500', value: '4 servers' },
            { text: 'Plus one spare', value: '5 servers', tone: 'good' },
            { text: '5 servers x $40', value: '$200' },
            { text: 'Load balancer', value: '$20' },
          ],
        },
        caption: 'Five servers share the load',
      },
    },
    {
      title: 'Survive failure',
      tag: 'concept',
      heading: 'The spare buys availability',
      eli5: 'With five cooks, one can call in sick and the other four still feed everyone. The host at the door, the **load balancer**, stops sending guests to the empty station.',
      body: [
        'With five servers, one can die and the other four still carry the full 2,000 requests per second. The load balancer notices and stops sending it traffic.',
        'The load balancer is now the one part with no spare, so real systems run a pair of them. The database is also still one copy, so it needs a standby replica. The extra server costs money, and it is what lets a failure pass without an outage.',
      ],
      keyIdea: 'Spare capacity is what turns a failure into a non-event. Check every box for a single point of failure.',
      metrics: { load: '2,000 req/s', servers: '4 of 5', page: '300 ms', cost: '$220' },
      metricTones: { servers: 'warn', page: 'warn' },
      scene: {
        nodes: [
          { ...users },
          { ...lb, status: 'active' },
          { ...app1, label: 'server 1', status: 'down', badge: 'crashed' },
          { ...app2, status: 'ok', load: 100, badge: '4 others carry on' },
        ],
        links: [row('users', 'lb'), row('lb', 'app1', { style: 'faint' }), link('lb', 'app2')],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['lb', 'app2'], tone: 'request', count: 3, duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'One server down',
          icon: 'Server',
          rows: [
            { text: 'Servers running', value: '4 of 5', tone: 'warn' },
            { text: 'Load they must carry', value: '2,000 / s' },
            { text: 'Users who notice', value: 'none', tone: 'good' },
          ],
        },
        caption: 'One fails, four carry the load',
      },
    },
    {
      title: 'Stateless',
      tag: 'concept',
      heading: 'Photos cannot live on one server',
      eli5: 'If each cook kept the napkins in a private drawer, a guest sent to another cook could not find them. Put them in one cellar, the **photo storage**, that every cook can reach.',
      body: [
        'Photos used to sit on the single server\'s own disk. With five servers that breaks: a photo saved on server 1 is missing on server 2.',
        'Photos move to shared **photo storage** that keeps several copies, which also gives durability. Servers keep no user data of their own, so any server can answer any request. They are **stateless**.',
      ],
      keyIdea: 'Keep data off the servers. Stateless servers can be added, removed or replaced freely, and shared storage keeps copies for durability.',
      metrics: { load: '2,000 req/s', servers: '5', page: '300 ms', cost: '$370' },
      scene: {
        nodes: [
          { ...app1, label: 'server 1', status: 'ok', chips: ['save photo'] },
          { ...app2, status: 'ok', chips: [{ text: 'show photo', tone: 'good' }] },
          { ...storage, status: 'ok', badge: '3 copies' },
          { ...db },
        ],
        links: [link('app1', 'storage'), row('app2', 'storage'), row('app1', 'db'), link('app2', 'db')],
        flows: [
          { path: ['app1', 'storage'], tone: 'data', label: 'save photo', duration: 1.4 },
          { path: ['storage', 'app2'], tone: 'response', label: 'photo', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Where the photo lives',
          icon: 'HardDrive',
          rows: [
            { text: 'On server 1 disk', value: 'server 2 cannot see it', tone: 'bad' },
            { text: 'In photo storage', value: 'every server can', tone: 'good' },
          ],
        },
        caption: 'Shared storage, stateless servers',
      },
      quiz: {
        question: 'PawPost now runs five servers. Why do uploaded photos move from each server\'s own disk to shared photo storage?',
        options: [
          'Disks on servers are too slow to read',
          'A photo saved on one server would be missing on the others, and one dead server would lose its photos',
          'The load balancer can only talk to storage',
          'It makes the monthly bill smaller',
        ],
        answer: 1,
        explain: 'With several servers behind a load balancer, any of them may get the next request. Data must live somewhere they all reach, and storing several copies protects it when one machine dies.',
      },
    },
    {
      title: 'The result',
      tag: 'case',
      heading: 'Every box answers a requirement',
      eli5: 'The restaurant now has five cooks, a host and a cellar. Guests are fed and nobody goes hungry if a cook is sick. But the food still takes a bit too long, and the bill is bigger.',
      body: [
        'The feed now opens in 300 ms. The monthly bill went from $40 to about $370: $200 for 5 servers, $20 for the load balancer, $100 for the database and $50 for photo storage. We met the scale target and the server availability and photo durability targets, and missed the 200 ms one. The database is still one copy, so replicating it is the next fix.',
        'Each new box answers one line in the requirements. If you cannot name the requirement, question the box.',
      ],
      keyIdea: 'Every box in a good diagram exists because a requirement needs it. If you cannot name the requirement, question the box.',
      metrics: { load: '2,000 req/s', servers: '5', page: '300 ms', cost: '$370' },
      metricTones: { page: 'warn', cost: 'warn' },
      scene: {
        nodes: [{ ...lb }, { ...app1, label: 'server 1', status: 'ok' }, { ...app2, status: 'ok' }, { ...db, badge: 'one copy only' }, { ...storage, status: 'ok' }],
        links: grownLinks.slice(1),
        flows: [
          { path: ['lb', 'app1', 'db'], tone: 'request', count: 2, duration: 2 },
          { path: ['db', 'app1', 'lb'], tone: 'response', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Targets, now',
          icon: 'Table',
          rows: [
            { text: 'Scale: 2,000 req/s', value: 'met', tone: 'good' },
            { text: 'Availability', value: 'servers survive 1 failure', tone: 'good' },
            { text: 'Database', value: 'still a single point', tone: 'bad' },
            { text: 'Photo durability', value: '3 copies', tone: 'good' },
            { text: 'Performance: 200 ms', value: '300 ms', tone: 'bad' },
            { text: 'Cost', value: '$370', tone: 'warn' },
          ],
        },
        caption: 'Targets met, database and speed still open',
      },
    },
    {
      title: 'Add a cache',
      tag: 'concept',
      heading: 'A cache fixes the last number',
      eli5: 'To serve faster, the kitchen keeps popular dishes ready on a warm tray, the **cache**. Most guests get their plate straight from the tray instead of waiting for the **database** pantry.',
      body: [
        'To reach 200 ms we add a **cache**: a small, very fast store that keeps a ready-made copy of the feed in memory. Most feed requests now skip the database.',
        'The feed opens in 120 ms.',
      ],
      keyIdea: 'A cache keeps ready-made answers in fast memory so most requests skip the slow part.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      metricTones: { page: 'good', cost: 'warn' },
      scene: {
        nodes: [{ ...users }, { ...lb }, { ...app1, label: 'server 1', status: 'active' }, { ...cache, status: 'ok' }, { ...db, status: 'dim' }],
        links: [row('users', 'lb'), row('lb', 'app1'), link('app1', 'cache'), row('app1', 'db', { style: 'faint' })],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', label: 'GET /feed', duration: 1.4 },
          { path: ['app1', 'cache'], tone: 'request', duration: 0.7, delay: 1.5 },
          { path: ['cache', 'app1'], tone: 'response', label: 'ready-made feed', duration: 0.7, delay: 2.3 },
          { path: ['app1', 'lb', 'users'], tone: 'response', duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Feed load time',
          icon: 'Timer',
          rows: [
            { text: 'Cache miss, ask database', value: '300 ms', tone: 'warn' },
            { text: 'Cache hit', value: '120 ms', tone: 'good' },
          ],
          footer: { text: 'Target was 200 ms', tone: 'good' },
        },
        caption: 'Most requests skip the database',
      },
    },
    {
      title: 'The price',
      tag: 'tradeoff',
      heading: 'The cache costs freshness',
      eli5: 'The food on the warm tray was made a little while ago, so it is not quite fresh. Guests eat sooner and pay for it with slightly older food. The tray also costs money.',
      body: [
        'The cached feed is rebuilt every 30 seconds, so a new post or a like can take up to 30 seconds to appear. We bought speed and paid with **freshness**.',
        'It also costs $50 a month and adds one more part that can break. The bill is now $420.',
      ],
      keyIdea: 'Speed bought with a cache is paid for in freshness, money and one more part that can fail.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      metricTones: { page: 'good', cost: 'bad' },
      scene: {
        nodes: [{ ...users }, { ...app1, label: 'server 1' }, { ...cache, status: 'ok', badge: 'up to 30 s old', chips: [{ text: 'new post, not shown yet', tone: 'warn' }] }, { ...db, status: 'dim' }],
        links: [row('users', 'app1', { label: 'sees an older feed', labelTone: 'warn' }), link('app1', 'cache')],
        flows: [
          { path: ['users', 'app1', 'cache'], tone: 'request', duration: 1.6 },
          { path: ['cache', 'app1', 'users'], tone: 'response', label: 'feed from 20 s ago', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Bought and paid',
          icon: 'Scale',
          rows: [
            { text: 'Bought: feed load time', value: '300 to 120 ms', tone: 'good' },
            { text: 'Paid: new posts appear after', value: 'up to 30 s', tone: 'warn' },
            { text: 'Paid: monthly bill', value: '+$50', tone: 'warn' },
            { text: 'Paid: parts that can fail', value: '+1', tone: 'warn' },
          ],
        },
        caption: 'Faster answers, slightly older data',
      },
    },
    {
      title: 'Trade-offs',
      tag: 'tradeoff',
      heading: 'Every fix costs something',
      eli5: 'A spare cook, a second pantry shelf, a warm tray: each one helps the restaurant and each one costs something. The owner picks which cost the guests can live with.',
      body: [
        'This is a **trade-off**, and design is full of them. Spare servers buy availability and cost money. Extra copies of data buy safety and make writes slower.',
        'More parts buy scale and make the system harder to understand. Nothing is free, so a designer picks which cost the product can live with.',
      ],
      keyIdea: 'There is no best design, only a best fit. Each choice improves one quality by spending another, so say out loud what you are giving up.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      scene: {
        nodes: [
          { ...app2, label: 'spare server', sub: undefined, status: 'ok', chips: [{ text: 'availability', tone: 'good' }] },
          { ...storage, status: 'ok', chips: [{ text: 'safety', tone: 'good' }] },
          { ...cache, status: 'ok', chips: [{ text: 'speed', tone: 'good' }] },
        ],
        panel: {
          title: 'What each one costs',
          icon: 'Scale',
          rows: [
            { text: 'Spare servers', value: 'money', tone: 'warn' },
            { text: 'Extra data copies', value: 'slower writes', tone: 'warn' },
            { text: 'Cache', value: 'stale data', tone: 'warn' },
            { text: 'More parts', value: 'harder to run', tone: 'warn' },
          ],
          footer: { text: 'Nothing is free', tone: 'muted' },
        },
        caption: 'Each gain has a price',
      },
    },
    {
      title: 'Five levers',
      tag: 'concept',
      heading: 'Almost every fix is one of five levers',
      eli5: 'A restaurant grows in five ways: split the work between kitchens, keep spare copies of recipes, use the warm tray, take orders now and cook later, and open branches near guests.',
      body: [
        '**Partition** splits data or traffic across machines. **Replicate** copies data to several. **Cache** keeps hot data close. **Asynchronize** does the work later through a queue. **Localize** moves data and compute near the users.',
        'PawPost already used two: copies of photos (replicate) and the cache. Replicating the database, a primary plus a standby, is the next fix it still needs. The rest of the course teaches each lever and what it costs.',
      ],
      keyIdea: 'Every design is some mix of partition, replicate, cache, asynchronize and localize. When stuck, ask which lever you have not pulled.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      scene: {
        nodes: [
          { id: 'partition', kind: 'block', size: 0.72, at: at(-3.6, -2.5), label: 'partition', icon: 'Split', tint: 'blue' },
          { id: 'replicate', kind: 'block', size: 0.72, at: at(0, -2.5), label: 'replicate', icon: 'Copy', tint: 'green', status: 'ok' },
          { id: 'cachelever', kind: 'block', size: 0.72, at: at(3.6, -2.5), label: 'cache', icon: 'Zap', tint: 'amber', status: 'ok' },
          { id: 'async', kind: 'block', size: 0.72, at: at(-1.8, 2.5), label: 'asynchronize', icon: 'Mail', tint: 'violet' },
          { id: 'localize', kind: 'block', size: 0.72, at: at(1.8, 2.5), label: 'localize', icon: 'Earth', tint: 'teal' },
        ],
        panel: {
          title: 'The cost of each lever',
          icon: 'Table',
          rows: [
            { text: 'Partition', value: 'cross-shard queries' },
            { text: 'Replicate', value: 'lag, slower writes' },
            { text: 'Cache', value: 'stale reads' },
            { text: 'Asynchronize', value: 'eventual results' },
            { text: 'Localize', value: 'multi-region data' },
          ],
        },
        caption: 'PawPost used two of the five',
      },
    },
    {
      title: 'Right size',
      tag: 'case',
      heading: 'Case: the same app for a 100-member club',
      eli5: 'A lemonade stand does not need five cooks and a host at the door. For a few **users**, one small kitchen, the **server**, and one pantry, the **database**, is the right restaurant.',
      body: [
        'A local dog club asks for its own private PawPost. Same three features. Different numbers: 100 members, about 1 request per second, and nobody minds if it is down for an hour on a Sunday night.',
        'The right design is the first diagram: one server, one database, $40 a month, plus a nightly backup so photos are not lost. The load balancer, five servers and cache would cost ten times more and give the club nothing it would notice. Building too much is a design failure too.',
      ],
      keyIdea: 'Same features, different numbers, different design. Start with the simplest thing that meets the requirements.',
      metrics: { load: '1 req/s', servers: '1', page: '80 ms', cost: '$40' },
      metricTones: { load: 'good', page: 'good', cost: 'good' },
      scene: {
        nodes: [
          { ...users, sub: '100 club members' },
          { ...app1, status: 'ok', load: 1 },
          { ...db, status: 'ok', badge: 'nightly backup' },
        ],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1', 'db'], tone: 'request', duration: 1.8 },
          { path: ['db', 'app1', 'users'], tone: 'response', label: '80 ms', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Club versus launch day',
          icon: 'Table',
          rows: [
            { text: 'Load', value: '1 vs 2,000 req/s' },
            { text: 'Downtime allowed', value: 'an hour vs minutes' },
            { text: 'Servers', value: '1 vs 5' },
            { text: 'Monthly cost', value: '$40 vs $420', tone: 'good' },
          ],
        },
        caption: 'Small numbers, small design',
      },
    },
    {
      title: 'The method',
      tag: 'concept',
      heading: 'An order to design anything in',
      eli5: 'A good owner plans a restaurant in order: write the menu, write the promises, count the guests, start with one small kitchen, then add only what a broken promise demands.',
      body: [
        'List the features. Put numbers on speed, scale, availability and durability. Estimate the load. Draw the simplest design that could work.',
        'Then find the first number it misses, add one part for it and name what that part costs. Repeat until every number is met.',
      ],
      keyIdea: 'Requirements, numbers, simplest design, then one fix at a time, each with its cost named.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      scene: {
        nodes: [{ ...users }, { ...app1, status: 'active' }, { ...db }],
        links: simpleLinks,
        panel: {
          title: 'The loop',
          icon: 'Repeat',
          rows: [
            { text: '1. Features', value: 'what it does' },
            { text: '2. Numbers', value: 'how well' },
            { text: '3. Estimate load', value: 'req/s, GB' },
            { text: '4. Simplest design', value: 'client, server, db' },
            { text: '5. Fix first miss', value: 'one part' },
            { text: '6. Name the cost', value: 'then repeat', tone: 'good' },
          ],
        },
        caption: 'Start small, grow on evidence',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Parts, connections, requirements, trade-offs',
      eli5: 'A restaurant is guests, a kitchen and a pantry. The menu says what it makes and the sign says how fast. The **users**, **server** and **database** work the same way, and every upgrade costs something.',
      body: [
        'A client asks, a server answers, a database remembers. Boxes are running parts and arrows point from caller to answerer. **Functional requirements** list what users can do. **Non-functional requirements** put numbers on speed, scale, availability and durability.',
        'Those numbers took PawPost from one $40 server to five servers, a load balancer, photo storage and a cache at $420 a month, and kept the dog club on the simple version. Each part was a **trade-off**.',
      ],
      keyIdea: 'System design is turning requirements into parts and connections, and choosing your trade-offs on purpose.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      metricTones: { page: 'good', servers: 'good' },
      scene: {
        nodes: [{ ...users }, { ...lb }, { ...app1, label: 'server 1', sub: '+4 more' }, { ...cache, status: 'ok' }, { ...db, badge: 'next: add a standby' }],
        links: [row('users', 'lb'), row('lb', 'app1'), link('app1', 'cache'), row('app1', 'db')],
        flows: [
          { path: ['users', 'lb', 'app1', 'cache'], tone: 'request', count: 2, duration: 2 },
          { path: ['cache', 'app1', 'lb', 'users'], tone: 'response', count: 2, duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'PawPost at the end',
          icon: 'Table',
          rows: [
            { text: 'Feed opens in', value: '120 ms', tone: 'good' },
            { text: 'Handles', value: '2,000 req/s', tone: 'good' },
            { text: 'Survives', value: '1 server down, not a database loss', tone: 'warn' },
            { text: 'Costs', value: '$420 a month', tone: 'warn' },
          ],
        },
        caption: 'Every box answers a requirement',
      },
      quiz: {
        question: 'Which of these is a non-functional requirement for PawPost?',
        options: [
          'A user can like a post',
          'A user can upload a photo with a caption',
          'The feed opens in under 200 ms at 2,000 requests per second',
          'A user can open a feed of recent posts',
        ],
        answer: 2,
        explain: 'The other three are features: things a user can do. "Under 200 ms at 2,000 requests per second" says how well the system must do them, which is what decides how many servers and which extra parts the design needs.',
      },
    },
  ],
};
