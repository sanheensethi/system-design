import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'phone', at: [-3.5, 4], label: 'users', sub: 'PawPost app' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: [-2.4, 2.4], label: 'load balancer' };
const app1: SceneNode = { id: 'app1', kind: 'server', at: [-1.9, 0.3], label: 'server' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: [0.8, 0.4], label: 'server 2', sub: '+3 more' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: [0.3, -2.7], label: 'cache' };
const db: SceneNode = { id: 'db', kind: 'db', at: [3, -2.4], label: 'database', sub: 'posts, likes' };
const storage: SceneNode = { id: 'storage', kind: 'storage', at: [3.5, -4.5], label: 'photo storage' };

const simpleLinks = [
  { from: 'users', to: 'app1' },
  { from: 'app1', to: 'db' },
];

const grownLinks = [
  { from: 'users', to: 'lb' },
  { from: 'lb', to: 'app1' },
  { from: 'lb', to: 'app2' },
  { from: 'app1', to: 'db' },
  { from: 'app2', to: 'db' },
  { from: 'app2', to: 'storage' },
];

export const whatIsSystemDesign: Lesson = {
  id: 'what-is-system-design',
  title: 'What system design is',
  tagline: 'Meet the client, the server and the database, learn to read a diagram, and see why every design is a set of trade-offs.',
  minutes: 11,
  level: 'Beginner',
  learn: [
    'What a client, a server and a database each do',
    'How to read the boxes and arrows in a system diagram',
    'Functional requirements versus non-functional requirements',
    'How requirements decide which parts a design needs',
    'Why every part you add buys something and costs something',
  ],
  metrics: [
    { key: 'load', label: 'Peak load' },
    { key: 'servers', label: 'Servers' },
    { key: 'page', label: 'Feed load time' },
    { key: 'cost', label: 'Monthly cost' },
  ],
  steps: [
    {
      title: 'Launch day',
      tag: 'problem',
      heading: 'It worked fine until people showed up',
      eli5: 'A tiny restaurant with one cook is great for ten guests. On opening day a thousand guests line up at the door, and the one **server** in the kitchen cannot cook fast enough for the **users**.',
      body: [
        'You built PawPost, an app where people share photos of their pets. It runs on one rented computer. With your ten friends testing it, the feed opens in 80 ms.',
        'Then a popular account mentions it. In one hour 50,000 people install the app and it starts receiving **2,000 requests per second**. Your one machine can answer about 500. The feed takes 8 seconds to open, then stops opening at all.',
        'The code has no bug. The same code that served ten people cannot serve 50,000 on one machine. Deciding which machines you need, what each one does and how they talk to each other is called **system design**.',
      ],
      keyIdea: 'System design is choosing the parts of a system and how they connect, so it keeps working at the size and speed you need.',
      metrics: { load: '2,000 req/s', servers: '1', page: '8 s', cost: '$40' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '50,000 in one hour' },
          { ...app1, status: 'hot', badge: '2,000 in, 500 max' },
        ],
        links: [{ from: 'users', to: 'app1' }],
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 6, duration: 1 },
          { path: ['app1', 'users'], tone: 'error', label: 'timeout', duration: 2.4, delay: 1.2 },
        ],
        caption: 'One machine, four times more work than it can do',
      },
    },
    {
      title: 'Client, server',
      tag: 'concept',
      heading: 'The client asks, the server answers',
      eli5: 'A guest sits at a table and orders. The kitchen cooks and sends the plate out. The guest is the **client**. The kitchen is the **server**. The kitchen never cooks unless somebody orders.',
      body: [
        'Start with the two parts every system has. The **client** is the program in the user\'s hands: the PawPost app on a phone, or a web browser. It shows screens and reacts to taps.',
        'The **server** is a program running on a computer you control, in a datacenter. It waits for messages. The client sends a **request** ("give me the feed") and the server sends back a **response** (the list of posts).',
        'The client always starts the conversation. The server holds the rules and the shared data, because you cannot trust or update thousands of phones, and they cannot see each other\'s photos without a meeting point.',
      ],
      keyIdea: 'A client sends requests. A server waits for them and sends responses. Shared logic and shared data live on the server side.',
      metrics: { load: '2,000 req/s', servers: '1', page: '8 s', cost: '$40' },
      scene: {
        nodes: [
          { ...users, label: 'client', status: 'active' },
          { ...app1, status: 'active' },
        ],
        links: [{ from: 'users', to: 'app1' }],
        flows: [
          { path: ['users', 'app1'], tone: 'request', label: 'request: GET /feed', duration: 1.4 },
          { path: ['app1', 'users'], tone: 'response', label: 'response: 20 posts', duration: 1.4, delay: 1.6 },
        ],
        caption: 'Request out, response back',
      },
    },
    {
      title: 'Database',
      tag: 'concept',
      heading: 'The database remembers',
      eli5: 'The kitchen keeps its food in a pantry so it is still there tomorrow. The **database** is the pantry. Cooks come and go, and the pantry keeps everything safe on its shelves.',
      body: [
        'A server program keeps its working data in memory. If the program restarts, that memory is wiped. Posts, likes and accounts must survive restarts, so they go into a **database**.',
        'A database is a program whose whole job is to store data on disk safely and find it again quickly. The server sends it **queries**: "save this post", "give me the 20 newest posts".',
        'This gives the classic three-part picture: client, server, database. The client never talks to the database directly. The server stands in between and checks who is allowed to do what.',
      ],
      keyIdea: 'Servers do the work and forget. The database remembers. Keeping those two jobs apart is the first design decision in almost every system.',
      metrics: { load: '2,000 req/s', servers: '1', page: '8 s', cost: '$40' },
      scene: {
        nodes: [{ ...users, label: 'client' }, { ...app1, status: 'active' }, { ...db, status: 'active' }],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1'], tone: 'request', label: 'GET /feed', duration: 1 },
          { path: ['app1', 'db'], tone: 'request', label: 'SELECT newest 20', duration: 1, delay: 1.1 },
          { path: ['db', 'app1'], tone: 'response', label: 'rows', duration: 1, delay: 2.2 },
          { path: ['app1', 'users'], tone: 'response', label: 'feed', duration: 1, delay: 3.3 },
        ],
        caption: 'Client, server, database',
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
      title: 'Boxes, arrows',
      tag: 'concept',
      heading: 'How to read a system diagram',
      eli5: 'Draw the restaurant on a napkin: a box for the guest, a box for the kitchen, a box for the pantry. A line from the kitchen to the pantry means the **server** fetches things from the **database**.',
      body: [
        'Every lesson in this course uses the same kind of picture. A **box** is one running part: a program or a group of identical machines doing one job. Its label says what job.',
        'An **arrow** means "this part calls that part". It points from the one that starts the conversation to the one that answers. The text on an arrow says what travels: an HTTP request, a SQL query, a file.',
        'Read a diagram by following one request from the left. Client to server, server to database, and back. If a box has no arrow to another box, they never talk. That absence is information too: here, the client has no arrow to the database.',
      ],
      keyIdea: 'Boxes are running parts. Arrows are who calls whom, and they start at the caller. Follow one request through the picture.',
      metrics: { load: '2,000 req/s', servers: '1', page: '8 s', cost: '$40' },
      scene: {
        nodes: [
          { ...users, label: 'client', badge: 'box = a running part' },
          { ...app1, status: 'active' },
          { ...db, badge: 'only the server calls it' },
        ],
        links: [
          { from: 'users', to: 'app1', label: 'HTTP request' },
          { from: 'app1', to: 'db', label: 'SQL query' },
        ],
        flows: [
          { path: ['users', 'app1', 'db'], tone: 'request', duration: 2 },
          { path: ['db', 'app1', 'users'], tone: 'response', duration: 2, delay: 2.2 },
        ],
        caption: 'Arrows point from the caller to the one that answers',
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
        'For PawPost: a user can upload a photo with a caption. A user can open a feed of recent posts. A user can like a post. That is the whole list for version one.',
        'Each one becomes a request the server must handle and data the database must hold. A short list is a strength. Every feature you leave out is a part you do not have to design, build and keep running.',
      ],
      keyIdea: 'Functional requirements are the features: what a user can do. Each one turns into requests and stored data.',
      metrics: { load: '2,000 req/s', servers: '1', page: '8 s', cost: '$40' },
      scene: {
        nodes: [{ ...users, label: 'client', status: 'active' }, { ...app1, badge: '3 features' }, db],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1', 'db'], tone: 'request', label: 'POST /posts', duration: 1.8 },
          { path: ['users', 'app1', 'db'], tone: 'request', label: 'GET /feed', duration: 1.8, delay: 2 },
          { path: ['users', 'app1', 'db'], tone: 'request', label: 'POST /likes', duration: 1.8, delay: 4 },
        ],
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
        '**Performance**: the feed opens in under 200 ms. **Scale**: it handles 2,000 requests per second at peak. **Availability**: it is up 99.9% of the time, which allows about 43 minutes of downtime a month. **Durability**: an uploaded photo is never lost.',
        'Two apps with the same features and different numbers need very different designs. A feature list tells you what to build. These numbers tell you how many boxes the diagram will need.',
      ],
      keyIdea: 'Functional requirements say what the system does. Non-functional requirements say how fast, how big and how reliable, and they shape the design.',
      metrics: { load: '2,000 req/s', servers: '1', page: '8 s', cost: '$40' },
      scene: {
        nodes: [
          { ...users, status: 'hot', badge: 'wants 200 ms' },
          { ...app1, status: 'hot', badge: '500 req/s max' },
          { ...db, badge: 'one copy only' },
        ],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 6, duration: 1 },
          { path: ['app1', 'users'], tone: 'error', label: '8 s', duration: 2.4, delay: 1.2 },
        ],
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
      title: 'Grow it',
      tag: 'concept',
      heading: 'Requirements decide the boxes',
      eli5: 'One cook was too slow, so the restaurant hires five. A host at the door, the **load balancer**, sends each guest to a free cook. Photos go to a big cellar, the **photo storage**, that every cook can reach.',
      body: [
        'Now each number picks a part. **Scale**: one server answers 500 requests per second and we need 2,000, so we run **five servers** (four for the load, one spare). A **load balancer** sits in front and spreads requests across them.',
        '**Availability**: with five servers, one can die and the other four carry on. **Durability**: photos used to sit on the single server\'s own disk. With five servers that breaks, because a photo saved on server 1 is missing on server 2. Photos move to shared **photo storage** that keeps several copies.',
        'The feed now opens in 300 ms. The monthly bill went from $40 to about $370. We met the scale target and missed the 200 ms one. Each new box answers one line in the requirements.',
      ],
      keyIdea: 'Every box in a good diagram exists because a requirement needs it. If you cannot name the requirement, question the box.',
      metrics: { load: '2,000 req/s', servers: '5', page: '300 ms', cost: '$370' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active' },
          { ...app1, label: 'server 1', status: 'ok', badge: '400 req/s' },
          { ...app2, status: 'ok', badge: '400 req/s each' },
          db,
          { ...storage, status: 'ok', badge: '3 copies' },
        ],
        links: grownLinks,
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['lb', 'app1', 'db'], tone: 'request', count: 2, duration: 1.6, delay: 1 },
          { path: ['lb', 'app2', 'storage'], tone: 'request', label: 'save photo', count: 2, duration: 1.6, delay: 1.2 },
          { path: ['db', 'app1', 'lb', 'users'], tone: 'response', duration: 2.2, delay: 2.8 },
        ],
        caption: 'Five servers share the load',
      },
    },
    {
      title: 'Trade-offs',
      tag: 'tradeoff',
      heading: 'Every fix costs something',
      eli5: 'To serve faster, the kitchen keeps popular dishes ready on a warm tray, the **cache**. Guests eat sooner, but the food on the tray is a little less fresh, and the tray costs money too.',
      body: [
        'To reach 200 ms we add a **cache**: a small, very fast store that keeps a ready-made copy of the feed in memory. Most feed requests now skip the database. The feed opens in 120 ms.',
        'The price: the cached feed is rebuilt every 30 seconds, so a new post or a like can take up to 30 seconds to appear. We bought speed and paid with **freshness**, plus $50 a month and one more part that can break.',
        'This is a **trade-off**, and design is full of them. Spare servers buy availability and cost money. Extra copies of data buy safety and make writes slower. More parts buy scale and make the system harder to understand. Nothing is free, so a designer\'s job is to pick which cost the product can live with.',
      ],
      keyIdea: 'There is no best design, only a best fit. Each choice improves one quality by spending another, so say out loud what you are giving up.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      scene: {
        nodes: [
          users,
          lb,
          { ...app1, label: 'server 1' },
          { ...app2, status: 'active' },
          { ...cache, status: 'ok', badge: 'fast, up to 30 s old' },
          { ...db, status: 'dim' },
          { ...storage, status: 'dim' },
        ],
        links: [...grownLinks, { from: 'app2', to: 'cache' }],
        flows: [
          { path: ['users', 'lb', 'app2'], tone: 'request', label: 'GET /feed', duration: 1.4 },
          { path: ['app2', 'cache'], tone: 'request', duration: 0.7, delay: 1.5 },
          { path: ['cache', 'app2'], tone: 'response', label: 'ready-made feed', duration: 0.7, delay: 2.3 },
          { path: ['app2', 'lb', 'users'], tone: 'response', duration: 1.4, delay: 3.1 },
        ],
        caption: 'Faster answers, slightly older data',
      },
    },
    {
      title: 'Right size',
      tag: 'case',
      heading: 'Case: the same app for a 100-member club',
      eli5: 'A lemonade stand does not need five cooks and a host at the door. For a few **users**, one small kitchen, the **server**, and one pantry, the **database**, is the right restaurant.',
      body: [
        'A local dog club asks for its own private PawPost. Same three features. The numbers are different: 100 members, about 1 request per second, and nobody minds if it is down for an hour on a Sunday night.',
        'The right design is the first diagram: one server, one database, $40 a month, plus a nightly backup so photos are not lost. The load balancer, the five servers and the cache would cost ten times more and give the club nothing it would notice.',
        'Building too much is a design failure as well. It wastes money and adds parts that break. The skill is matching the design to the requirements, in both directions.',
      ],
      keyIdea: 'Same features, different numbers, different design. Start with the simplest thing that meets the requirements.',
      metrics: { load: '1 req/s', servers: '1', page: '80 ms', cost: '$40' },
      scene: {
        nodes: [
          { ...users, sub: '100 club members' },
          { ...app1, status: 'ok', badge: '1 of 500 req/s used' },
          { ...db, status: 'ok', badge: 'nightly backup' },
        ],
        links: simpleLinks,
        flows: [
          { path: ['users', 'app1', 'db'], tone: 'request', duration: 1.8 },
          { path: ['db', 'app1', 'users'], tone: 'response', label: '80 ms', duration: 1.8, delay: 2 },
        ],
        caption: 'Small numbers, small design',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Parts, connections, requirements, trade-offs',
      eli5: 'A restaurant is guests, a kitchen and a pantry. The menu says what it makes and the sign says how fast. The **users**, **server** and **database** work the same way, and every upgrade costs something.',
      body: [
        'A system is made of parts that talk. The **client** asks, the **server** answers, the **database** remembers. In a diagram, boxes are running parts and arrows point from the caller to the one that answers.',
        '**Functional requirements** list what users can do. **Non-functional requirements** put numbers on speed, scale, availability and durability. Those numbers took PawPost from one $40 server to five servers, a load balancer, photo storage and a cache at $420 a month, and kept the dog club on the simple version.',
        'Each added part was a **trade-off**. The rest of this course teaches the parts one by one, and for each one, what it buys and what it costs.',
      ],
      keyIdea: 'System design is turning requirements into parts and connections, and choosing your trade-offs on purpose.',
      metrics: { load: '2,000 req/s', servers: '5', page: '120 ms', cost: '$420' },
      scene: {
        nodes: [users, lb, { ...app1, label: 'server 1' }, app2, { ...cache, status: 'ok' }, db, storage],
        links: [...grownLinks, { from: 'app2', to: 'cache' }],
        flows: [
          { path: ['users', 'lb', 'app2', 'cache'], tone: 'request', count: 2, duration: 2 },
          { path: ['cache', 'app2', 'lb', 'users'], tone: 'response', count: 2, duration: 2, delay: 2.2 },
          { path: ['lb', 'app1', 'db'], tone: 'request', duration: 1.6, delay: 1 },
        ],
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
