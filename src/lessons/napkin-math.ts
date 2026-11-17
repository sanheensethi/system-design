import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'phone', at: at(-5.4, 0), label: '500M users', sub: 'daily active' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-1.8, 0), label: 'app servers', sub: 'timeline API' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(1.8, -6.4), label: 'tweet DB', sub: 'sharded by user_id' };
const media: SceneNode = { id: 'media', kind: 'storage', at: at(1.8, 6.4), label: 'media store', sub: 'object storage' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(-1.8, 7.6), label: 'CDN', sub: 'edge caches' };

export const napkinMath: Lesson = {
  id: 'napkin-math',
  title: 'Napkin math: capacity estimation (part 1)',
  tagline: 'Turn "500 million users" into QPS, storage and bandwidth in five minutes. Part 2 turns them into a server count.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'Powers of ten, data sizes and seconds-in-a-day: the units every estimate uses',
    'The 86,400 trick: from daily users to requests per second',
    'Why you size for peak traffic, not the average',
    'How to estimate storage over years, with retention, replication and indexes',
    'Why bandwidth often runs out before CPU, and what a CDN does about it',
  ],
  metrics: [
    { key: 'dau', label: 'DAU', icon: 'Users' },
    { key: 'qps', label: 'Read QPS', icon: 'Activity' },
    { key: 'storage', label: 'Storage / yr', icon: 'HardDrive' },
    { key: 'bandwidth', label: 'Egress', icon: 'Download' },
    { key: 'servers', label: 'Servers', icon: 'Server' },
  ],
  steps: [
    {
      title: 'How many?',
      tag: 'problem',
      heading: 'Your manager asks how many servers to buy',
      eli5: 'Half a billion kids want to visit your new library, and someone asks how many librarians, the app servers, to hire. Working that out with quick, rough sums is called **capacity estimation**.',
      body: [
        'You are building a Twitter-sized product. Before anyone writes code, your manager asks a plain question: how many servers, how much disk, how much bandwidth?',
        'One engineer says "Postgres can handle it". Another wants a thousand machines. Both are guessing, and a guess can be off by 100x either way. You do not need a spreadsheet. You need a few assumptions, powers of ten and five minutes.',
      ],
      keyIdea: 'Capacity estimation is about getting the order of magnitude right. Being off by 2x is fine. Being off by 100x is a different system.',
      metrics: { dau: '500M', servers: '?' },
      metricTones: { servers: 'warn' },
      scene: {
        nodes: [
          users,
          { id: 'boss', kind: 'block', at: at(-1.8, -6.4), label: 'manager', sub: 'how many?', icon: 'User', tint: 'amber' },
          { ...app, status: 'active', badge: '? servers' },
        ],
        links: [link('boss', 'app', { label: 'budget?' }), link('users', 'app', { style: 'dashed' })],
        flows: [{ path: ['users', 'app'], tone: 'request', count: 5, duration: 1.6 }],
        panel: {
          title: 'Two guesses, 1,000x apart',
          icon: 'Scale',
          rows: [
            { text: '"Postgres can handle it"', value: '1 box', tone: 'warn' },
            { text: '"We need a thousand"', value: '1,000 boxes', tone: 'warn' },
            { text: 'Five minutes of napkin math', value: 'about 370', tone: 'good' },
          ],
        },
        caption: 'Half a billion people, one blank whiteboard',
      },
    },
    {
      title: 'Powers of ten',
      tag: 'concept',
      heading: 'Units: every step up is another 1,000',
      eli5: 'Think of the library shelves. A page is small, a book is a thousand pages, a room is a thousand books. Each step up is **1,000 times** bigger, so you only need to count the zeros.',
      body: [
        'Estimates are multiplication and division of powers of ten, so you do not need a calculator. A byte holds one ASCII character, which is 8 bits. Each prefix after that is 1,000 times bigger (we treat 1,024 as 1,000, since the 2% error does not matter).',
        'A tweet is KB-sized, a photo is MB-sized, one disk holds TB, and a data lake holds PB. If you can add exponents, you can do the rest.',
      ],
      keyIdea: 'KB, MB, GB, TB and PB each step up by 1,000. Count exponents instead of digits.',
      scene: {
        nodes: [
          { id: 'kb', kind: 'block', at: at(-5.1, 0), label: 'KB', sub: 'a tweet', icon: 'FileText', tint: 'blue' },
          { id: 'mb', kind: 'block', at: at(-1.7, 0), label: 'MB', sub: 'a photo', icon: 'Image', tint: 'green' },
          { id: 'tb', kind: 'block', at: at(1.7, 0), label: 'TB', sub: 'one disk', icon: 'HardDrive', tint: 'amber' },
          { id: 'pb', kind: 'block', at: at(5.1, 0), label: 'PB', sub: 'a data lake', icon: 'Warehouse', tint: 'violet' },
        ],
        links: [
          link('kb', 'mb', { route: 'straight', label: 'x 1,000' }),
          link('mb', 'tb', { route: 'straight', label: 'x 10⁶' }),
          link('tb', 'pb', { route: 'straight', label: 'x 1,000' }),
        ],
        panel: {
          title: 'Bytes as powers of ten',
          icon: 'Binary',
          rows: [
            { text: 'KB', value: '10³ bytes' },
            { text: 'MB', value: '10⁶ bytes' },
            { text: 'GB', value: '10⁹ bytes' },
            { text: 'TB', value: '10¹² bytes' },
            { text: 'PB', value: '10¹⁵ bytes' },
          ],
          footer: { text: '1 byte = 1 ASCII character', tone: 'muted' },
        },
      },
    },
    {
      title: 'Data sizes',
      tag: 'concept',
      heading: 'Know what one record weighs',
      eli5: 'To count shelf space you must know how thick one thing is. A short note is thin, a picture poster is thick, and a film reel is huge. Memorize a few thicknesses and you can guess the rest.',
      body: [
        'You cannot estimate storage without the size of one item. A char is 1 B, an int 4 B, a long or timestamp 8 B, a UUID 16 B in binary. A tweet is 100 to 300 B of text and a typical JSON row is 1 to 4 KB.',
        'Media dwarfs all of it: a thumbnail is 10 to 50 KB, a full photo 500 KB to 2 MB, and one minute of HD video about 50 MB.',
      ],
      keyIdea: 'Text rows are KB-sized, photos are MB-sized and video is tens of MB per minute. The media gap is where storage plans get decided.',
      scene: {
        nodes: [
          { id: 'tweet', kind: 'block', at: at(-3.6, 0), label: 'tweet', sub: '~1 KB with indexes', icon: 'FileText', tint: 'blue' },
          { id: 'photo', kind: 'block', at: at(0, 0), label: 'photo', sub: '~1 MB', icon: 'Image', tint: 'green' },
          { id: 'video', kind: 'block', at: at(3.6, 0), label: 'video minute', sub: '~50 MB', icon: 'Package', tint: 'violet' },
        ],
        links: [link('tweet', 'photo', { route: 'straight', label: '~1,000x' }), link('photo', 'video', { route: 'straight', label: '~50x' })],
        panel: {
          title: 'Size reference',
          icon: 'Table',
          rows: [
            { text: 'Tweet text', value: '100 to 300 B' },
            { text: 'JSON row (user, order)', value: '1 to 4 KB' },
            { text: 'Thumbnail', value: '10 to 50 KB' },
            { text: 'Full photo', value: '500 KB to 2 MB' },
            { text: '1 min HD video', value: '~50 MB', tone: 'warn' },
            { text: '1 hour HD video', value: '~3 GB', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Seconds',
      tag: 'concept',
      heading: 'Seconds in a day, month and year',
      eli5: 'A day has about 100,000 seconds, a bit fewer, but 100,000 is easy to divide by. If one kid walks in every second, a whole day brings in about 86,000 kids.',
      body: [
        'Rates and totals trade places through time. A day is **86,400 seconds, close to 10⁵**. A month is about 2.6 × 10⁶ seconds and a year about 3.15 × 10⁷.',
        'So one request per second adds up to about 86 thousand a day, 2.6 million a month and 31 million a year. Divide by 10⁵ and you move from a daily total to a per-second rate.',
      ],
      keyIdea: 'A day is about 10⁵ seconds. That one number converts daily totals into per-second rates.',
      scene: {
        nodes: [
          { id: 'day', kind: 'block', at: at(-3.6, 0), label: 'a day', sub: '86,400 s ≈ 10⁵', icon: 'Clock', tint: 'teal' },
          { id: 'month', kind: 'block', at: at(0, 0), label: 'a month', sub: '2.6 × 10⁶ s', icon: 'Timer', tint: 'blue' },
          { id: 'year', kind: 'block', at: at(3.6, 0), label: 'a year', sub: '3.15 × 10⁷ s', icon: 'Repeat', tint: 'violet' },
        ],
        links: [link('day', 'month', { route: 'straight', label: 'x 30' }), link('month', 'year', { route: 'straight', label: 'x 12' })],
        panel: {
          title: '1 request per second becomes',
          icon: 'Activity',
          rows: [
            { text: 'A day', value: '86 thousand' },
            { text: 'A month', value: '2.6 million' },
            { text: 'A year', value: '31 million' },
          ],
          footer: { text: 'Divide by 10⁵ to go from per day to per second', tone: 'muted' },
        },
      },
    },
    {
      title: 'Assumptions',
      tag: 'concept',
      heading: 'Write the assumptions down first',
      eli5: 'First write down your best guesses. Each kid reads the notice board 50 times a day and pins up a new note only once in a while. These guesses are your **assumptions**, and anyone can check them.',
      body: [
        'Every estimate starts with numbers you state out loud, so others can challenge them. For our Twitter clone: **500M daily active users**, 50 timeline loads and 0.2 tweets a day each.',
        'A tweet is about 1 KB with indexes, one in ten carries a 500 KB image, data is kept 5 years, and everything is stored 3 times. Label every unit: "5" is ambiguous, "5 MB" is not.',
      ],
      keyIdea: 'Stated assumptions make an estimate checkable. Hidden ones make it a guess.',
      metrics: { dau: '500M' },
      scene: {
        nodes: [
          { ...users, status: 'active', badge: '50 reads · 0.2 posts / day' },
          { id: 'board', kind: 'block', at: at(-1.8, -6.4), label: 'assumptions', sub: 'on the whiteboard', icon: 'List', tint: 'amber' },
          app,
        ],
        links: [link('users', 'app'), link('board', 'app', { style: 'dashed' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'load timeline', count: 5, duration: 1.6 },
          { path: ['users', 'app'], tone: 'event', label: 'post tweet', duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'The Twitter-clone sheet',
          icon: 'List',
          rows: [
            { text: 'Daily active users', value: '500M' },
            { text: 'Timeline loads', value: '50 / user / day' },
            { text: 'Tweets posted', value: '0.2 / user / day' },
            { text: 'Tweet size', value: '1 KB (10% add a 500 KB image)' },
            { text: 'Retention', value: '5 years' },
            { text: 'Copies stored', value: '3x' },
          ],
          footer: { text: 'Wrong guess? Change one line and redo the sum', tone: 'muted' },
        },
      },
    },
    {
      title: 'DAU first',
      tag: 'concept',
      heading: 'Start from daily users, not sign-ups',
      eli5: 'A library card list may name three billion kids, but only the kids who walk in today fill the desk today. Count the ones who show up each day. That count is the **DAU**.',
      body: [
        'Registered accounts and monthly users both overcount the daily load. **DAU** (daily active users) is the number that sets requests per second.',
        'If a product has 1B monthly users and half of them show up on a given day, DAU is 500M. That is the number used from here on.',
      ],
      keyIdea: 'Capacity follows daily active users. Convert monthly or registered counts to DAU before anything else.',
      metrics: { dau: '500M' },
      scene: {
        nodes: [
          { id: 'accounts', kind: 'block', at: at(-5.4, 0), label: 'accounts', sub: '3B signed up', icon: 'Users', tint: 'gray', status: 'dim' },
          { id: 'mau', kind: 'block', at: at(-1.8, 0), label: 'monthly', sub: '1B active', icon: 'Users', tint: 'blue' },
          { id: 'dau', kind: 'block', at: at(1.8, 0), label: 'daily', sub: '500M DAU', icon: 'Users', tint: 'green', status: 'active' },
        ],
        links: [link('accounts', 'mau', { route: 'straight', label: '1 in 3' }), link('mau', 'dau', { route: 'straight', label: '1 in 2' })],
        panel: {
          title: 'Which count sizes the system?',
          icon: 'Users',
          rows: [
            { text: 'Signed-up accounts', value: 'too high', tone: 'bad' },
            { text: 'Monthly actives', value: 'still high', tone: 'warn' },
            { text: 'Daily actives (DAU)', value: 'use this', tone: 'good' },
          ],
        },
      },
    },
    {
      title: '86,400 trick',
      tag: 'concept',
      heading: 'From daily users to requests per second',
      eli5: 'A day is about 100,000 seconds long. Share out all the visits of one day over those seconds and you learn how many kids the librarians must help each second. That number is the **QPS**.',
      body: [
        'Average QPS is `DAU × actions per user ÷ 86,400`, and 86,400 rounds to 10⁵. With 10 actions per user, QPS is about DAU divided by 10,000.',
        'Try a game with 20M daily players and 25 actions each: 5 × 10⁸ actions a day, divided by 10⁵, is about **5,000 QPS**. You just did capacity planning in your head.',
      ],
      keyIdea: 'Average QPS ≈ DAU × actions ÷ 10⁵.',
      metrics: { dau: '500M' },
      scene: {
        nodes: [
          { ...users, label: '20M players', sub: '25 actions / day' },
          { id: 'calc', kind: 'block', at: at(-1.8, -6.4), label: '÷ 86,400', sub: 'seconds in a day', icon: 'Table', tint: 'teal' },
          { ...app, status: 'active', badge: '~5,000 QPS' },
        ],
        links: [link('users', 'calc', { label: '5 × 10⁸ / day' }), link('calc', 'app', { label: '5,000 / s' })],
        flows: [{ path: ['users', 'app'], tone: 'request', label: '5,000/s', count: 5, duration: 1.6 }],
        panel: {
          title: 'The 86,400 trick',
          icon: 'Gauge',
          code: 'QPS = DAU × actions ÷ 10⁵\n\n20M × 25 = 5 × 10⁸ a day\n5 × 10⁸ ÷ 10⁵ = 5,000 QPS',
        },
      },
    },
    {
      title: 'Write QPS',
      tag: 'concept',
      heading: 'Writes: about 1,150 tweets a second',
      eli5: 'Not many kids pin up a new note. If each of the 500 million kids pins one note every five days, the librarians still see about 1,150 new notes each second.',
      body: [
        'Back to our Twitter clone. Writes: 5 × 10⁸ users × 0.2 tweets = **10⁸ tweets a day**.',
        'Divide by 86,400 and you get about **1,150 writes per second** on average. Hold that number. It is small, and it will stay small next to the read side.',
      ],
      keyIdea: '10⁸ tweets a day is only about 1,150 writes per second.',
      metrics: { dau: '500M' },
      scene: {
        nodes: [users, { ...app, status: 'active', chips: [{ text: 'POST /tweet', tone: 'default' }] }, { ...db, status: 'ok', badge: '1,150 writes/s' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'event', label: '1,150/s', count: 2, duration: 2.2 },
        ],
        panel: {
          title: 'Write QPS',
          icon: 'Activity',
          code: 'tweets/day = 5 × 10⁸ × 0.2\n           = 10⁸\n\navg writes = 10⁸ ÷ 86,400\n           ≈ 1,150 / s',
        },
      },
    },
    {
      title: 'Read QPS',
      tag: 'concept',
      heading: 'Reads: about 290,000 a second',
      eli5: 'Every kid checks the notice board 50 times a day. That is a lot more looking than pinning. About 290,000 looks each second, and 250 looks for every note pinned.',
      body: [
        'Reads: 5 × 10⁸ × 50 = 2.5 × 10¹⁰ timeline loads a day, or about **290,000 reads per second**.',
        'Against 1,150 writes that is a **250:1 read-to-write ratio**. This system is about reading, and the design will follow from that.',
      ],
      keyIdea: 'The read-to-write ratio tells you which side of the system to design first.',
      metrics: { dau: '500M', qps: '290K avg' },
      scene: {
        nodes: [users, { ...app, status: 'active', chips: [{ text: 'GET /timeline', tone: 'default' }], badge: '290K reads/s' }, { ...db, status: 'ok', badge: '1,150 writes/s' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: '290K/s', count: 8, duration: 1.4 },
          { path: ['users', 'app', 'db'], tone: 'event', label: '1,150/s', duration: 1.8, delay: 0.7 },
        ],
        panel: {
          title: 'Reads against writes',
          icon: 'Scale',
          rows: [
            { text: 'Reads (2.5 × 10¹⁰ / day)', value: '290,000 / s', tone: 'warn' },
            { text: 'Writes (10⁸ / day)', value: '1,150 / s', tone: 'good' },
            { text: 'Ratio', value: '250 : 1', tone: 'warn' },
          ],
          footer: { text: 'Read-heavy: design the read path first', tone: 'warn' },
        },
      },
      quiz: {
        question: 'An app has 100M daily active users, and each does 10 actions a day. Roughly what is the average QPS?',
        options: ['About 1,000', 'About 10,000', 'About 100,000', 'About 1,000,000'],
        answer: 1,
        explain: '10⁸ users × 10 actions = 10⁹ actions a day. Divide by about 10⁵ seconds in a day and you get 10⁴, so about 10,000 QPS.',
      },
    },
    {
      title: 'Peak',
      tag: 'concept',
      heading: 'Size for the peak, not the average',
      eli5: 'The library is never evenly busy. After school it gets about three times as crowded, and that busiest time is the **peak**. Hire enough librarians for then, or the line goes out the door.',
      body: [
        'Traffic is never flat. Evenings, big games and breaking news all spike it. A **3x peak-to-average** multiplier is a safe default. Chat and streaming apps can hit 5x to 10x, while internal business tools sit near 2x.',
        'Peak reads: 290K × 3 ≈ **870K reads per second**. Peak writes: 1,150 × 3 ≈ **3,500 per second**. A system sized for the average falls over every evening.',
      ],
      keyIdea: 'Multiply the average by 3 and design for that number, because the peak is when systems break.',
      metrics: { dau: '500M', qps: '870K peak' },
      metricTones: { qps: 'warn' },
      scene: {
        nodes: [
          users,
          { id: 'match', kind: 'block', at: at(-1.8, -7.6), label: '9 pm', sub: 'big match, extra time', icon: 'Clock', tint: 'red' },
          { ...app, status: 'hot', load: 95, chips: [{ text: '870K reads/s', tone: 'bad' }] },
        ],
        links: [link('users', 'app', { label: 'x 3 at peak', labelTone: 'warn' }), link('match', 'app', { style: 'dashed' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 14, duration: 1.2 },
          { path: ['users', 'app'], tone: 'event', count: 2, duration: 1.2, delay: 0.5 },
        ],
        panel: {
          title: 'Peak multipliers',
          icon: 'TrendingUp',
          rows: [
            { text: 'Business tools', value: '2x' },
            { text: 'Most consumer apps', value: '3x', tone: 'good' },
            { text: 'Chat and streaming', value: '5x to 10x', tone: 'warn' },
            { text: 'Our reads, 290K avg', value: '870K peak', tone: 'bad' },
            { text: 'Our writes, 1,150 avg', value: '3,500 peak' },
          ],
        },
      },
    },
    {
      title: 'Storage formula',
      tag: 'concept',
      heading: 'Storage: records × size × years × copies',
      eli5: '**Storage** is shelf space. Count the notes pinned each day, times how thick each one is, times the years you keep them, times three copies. The total is bigger than you first guess.',
      body: [
        'Storage = records × size per record × years × replication factor. Then add indexes, which are usually 20 to 50% on top.',
        'A 1 TB per year dataset kept 5 years with 3 copies is **15 TB raw**, not 1 TB, and about 18 to 22 TB once indexes join. Forgetting retention and replication is the classic storage mistake.',
      ],
      keyIdea: 'Always multiply by retention and by replication, then add indexes.',
      metrics: { dau: '500M', qps: '870K peak' },
      scene: {
        nodes: [
          { id: 'years', kind: 'block', at: at(-3.6, 0), label: 'x 5 years', sub: 'retention', icon: 'Clock', tint: 'blue' },
          { id: 'copies', kind: 'block', at: at(-3.6, -6.4), label: 'x 3 copies', sub: 'replication', icon: 'Copy', tint: 'violet' },
          { ...db, at: at(0, 0), label: 'database', sub: '1 TB / year raw', status: 'active', badge: '15 TB real' },
        ],
        links: [link('years', 'db', { route: 'straight' }), link('copies', 'db')],
        panel: {
          title: 'One TB a year, kept 5 years',
          icon: 'HardDrive',
          rows: [
            { text: 'Raw per year', value: '1 TB' },
            { text: '× 5 years of retention', value: '5 TB' },
            { text: '× 3 copies', value: '15 TB', tone: 'warn' },
            { text: '+ 20 to 50% indexes', value: '18 to 22 TB', tone: 'bad' },
          ],
        },
      },
      quiz: {
        question: 'A service writes 2 TB of data a year, keeps it for 3 years and stores 3 copies. About how much raw disk does it need, before indexes?',
        options: ['2 TB', '6 TB', '18 TB', '180 TB'],
        answer: 2,
        explain: '2 TB × 3 years = 6 TB, and 6 TB × 3 copies = 18 TB. Indexes would add another 20 to 50% on top.',
      },
    },
    {
      title: 'Text storage',
      tag: 'concept',
      heading: 'Tweet text: 540 TB over five years',
      eli5: 'The notes themselves are small and light. A hundred million new notes a day, kept five years and copied three times, still fit in a big cabinet. Big, but one cabinet row can hold it.',
      body: [
        'Tweet text: 10⁸ tweets a day × 365 × 1 KB ≈ **36.5 TB a year**.',
        'Over 5 years that is about 180 TB, and with 3 copies it is **540 TB**. That is big but fine, because a sharded database handles it.',
      ],
      keyIdea: 'Text is the small part. 540 TB fits a sharded database.',
      metrics: { dau: '500M', qps: '870K peak', storage: '36.5 TB text' },
      scene: {
        nodes: [
          { ...app, chips: ['row · 1 KB'] },
          { ...db, status: 'active', badge: '540 TB (5 yr, 3x)', chips: ['36.5 TB / yr'] },
          { id: 'tweets', kind: 'block', at: at(-1.8, -6.4), label: '10⁸ tweets', sub: 'a day', icon: 'FileText', tint: 'blue' },
        ],
        links: [link('tweets', 'app'), link('app', 'db')],
        flows: [{ path: ['app', 'db'], tone: 'data', label: 'row · 1 KB', count: 3, duration: 1.4 }],
        panel: {
          title: 'Text over time',
          icon: 'Table',
          code: '10⁸ tweets a day\n× 365 days × 1 KB\n= 36.5 TB a year\n× 5 years = 180 TB\n× 3 copies = 540 TB',
        },
      },
    },
    {
      title: 'Media storage',
      tag: 'concept',
      heading: 'Media: 27 PB, fifty times the text',
      eli5: 'Picture posters need far more room than notes, so they get their own warehouse, the media store. Even if only one note in ten has a poster, the posters fill more shelves than all the notes.',
      body: [
        '10% of tweets carry a 500 KB image, so the average tweet carries 50 KB of image. 10⁸ × 365 × 50 KB ≈ **1.8 PB a year**. Over 5 years with 3 copies that is **27 PB**.',
        'Media is 50x bigger than text. The database holds metadata in TB, and an object store holds the bytes in PB. Add the 1% of tweets with 5 MB video and the media figure doubles.',
      ],
      keyIdea: 'Compare the data types. The biggest one gets its own store.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB' },
      metricTones: { storage: 'warn' },
      scene: {
        nodes: [app, { ...db, status: 'ok', badge: '540 TB' }, { ...media, status: 'hot', badge: '27 PB (5 yr, 3x)' }],
        links: [link('app', 'db'), link('app', 'media', { label: 'images' })],
        flows: [
          { path: ['app', 'db'], tone: 'data', label: 'row · 1 KB', duration: 1.2 },
          { path: ['app', 'media'], tone: 'data', label: 'image · 500 KB', duration: 1.8, delay: 0.3 },
        ],
        panel: {
          title: 'Image storage',
          icon: 'Image',
          rows: [
            { text: 'Tweets with an image', value: '10%' },
            { text: 'Average image bytes per tweet', value: '50 KB' },
            { text: 'Per year', value: '1.8 PB', tone: 'warn' },
            { text: '5 years × 3 copies', value: '27 PB', tone: 'bad' },
            { text: 'Versus text', value: '50x bigger', tone: 'bad' },
          ],
          footer: { text: '1% video at 5 MB would add as much again', tone: 'warn' },
        },
      },
    },
    {
      title: 'Bandwidth',
      tag: 'concept',
      heading: 'Bandwidth: QPS × payload',
      eli5: '**Bandwidth** is how much the library can carry out its doors each second. Each look at the notice board sends out a bit of paper, and many looks at once can jam the doors.',
      body: [
        'Text egress at peak: 870K reads per second × 1 KB = 870 MB/s. Network cards are rated in bits, so MB/s × 8 = Mbps: about **7 Gbps**. That is a deliberately small floor, since a real timeline returns about 20 tweets (140 Gbps).',
        'Engineers new to this size for CPU and forget the card. At 10K QPS with a 10 KB payload you push 100 MB/s, 800 Mbps, nearly a full 1 Gbps link.',
      ],
      keyIdea: 'Bandwidth often runs out before CPU.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '7 Gbps text' },
      metricTones: { bandwidth: 'warn' },
      scene: {
        nodes: [
          users,
          { ...app, status: 'hot', load: 70, chips: [{ text: '870K reads/s', tone: 'warn' }] },
          { id: 'nic', kind: 'block', at: at(-1.8, -7.6), label: 'network card', sub: '1 to 10 Gbps', icon: 'Cable', tint: 'amber' },
        ],
        links: [link('app', 'users', { label: '7 Gbps of text', labelTone: 'warn' }), link('nic', 'app', { style: 'dashed' })],
        flows: [{ path: ['app', 'users'], tone: 'response', label: '1 KB × 870K', count: 5, duration: 1.4 }],
        panel: {
          title: 'Bandwidth = QPS × payload',
          icon: 'Download',
          code: '870K × 1 KB = 870 MB/s\nMB/s × 8 = Mbps (cards use bits)\n870 × 8 ≈ 7 Gbps (1 KB is a floor)\n\n10K QPS × 10 KB = 100 MB/s\n100 × 8 = 800 Mbps',
        },
      },
    },
    {
      title: 'CDN',
      tag: 'concept',
      heading: 'Serve big, popular objects from a CDN',
      eli5: 'Picture posters are too heavy for the library doors. So little booths in every neighborhood, the **CDN**, keep copies of popular posters and hand them out close to home.',
      body: [
        'Without a CDN, image egress is 870K reads × 50 KB of image per tweet = 43.5 GB/s, about **350 Gbps**. So images go through a **CDN**: edges near users serve cached copies, and the origin only sees the misses.',
        'At a 95% hit rate the origin sees 5%, about **17 Gbps**. Size the edge for the 350 Gbps peak, say 400 Gbps. Text still comes from the app servers.',
      ],
      keyIdea: 'A CDN turns an impossible origin load into a manageable one.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '~350 Gbps' },
      scene: {
        nodes: [users, app, { ...cdn, status: 'active', badge: '~400 Gbps edge' }, { ...media, badge: '~17 Gbps origin' }],
        links: [
          link('users', 'app'),
          link('users', 'cdn', { label: 'images' }),
          link('cdn', 'media', { style: 'dashed', label: 'misses only' }),
        ],
        flows: [
          { path: ['app', 'users'], tone: 'response', label: 'timeline · 7 Gbps', count: 3, duration: 1.4 },
          { path: ['cdn', 'users'], tone: 'response', label: 'images', count: 6, duration: 1.2, delay: 0.3 },
          { path: ['media', 'cdn'], tone: 'data', label: 'miss', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'Where the bits come from',
          icon: 'Globe',
          rows: [
            { text: 'Image egress, no CDN (870K × 50 KB)', value: '350 Gbps', tone: 'bad' },
            { text: 'CDN hit rate', value: '95%' },
            { text: 'Edge capacity', value: '~400 Gbps', tone: 'good' },
            { text: 'Origin, 5% misses', value: '~17 Gbps', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Four formulas down, servers next',
      eli5: 'So far we counted how many kids come each second, how much shelf space they need and how wide the doors must be. **Napkin math** means rough sums you can say out loud. Next we count librarians.',
      body: [
        'Average QPS = DAU × actions ÷ 86,400. Peak = average × 3. Storage = records × size × years × copies. Bandwidth = QPS × payload.',
        'For Twitter that gives 870K peak reads, 3,500 peak writes, 540 TB of text, 27 PB of media, a 7 Gbps text floor and 350 Gbps of images. Part 2 turns these into servers and shows the Instagram case.',
      ],
      keyIdea: 'Four short formulas turn a vague scale into QPS, storage and bandwidth. Servers come next.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '~350 Gbps' },
      metricTones: { qps: 'warn', storage: 'warn' },
      scene: {
        nodes: [users, { ...app, status: 'ok' }, { ...db, status: 'ok' }, { ...media, status: 'ok' }],
        links: [link('users', 'app'), link('app', 'db'), link('app', 'media')],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['app', 'users'], tone: 'response', count: 3, duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Twitter clone so far',
          icon: 'Table',
          rows: [
            { text: 'Peak reads', value: '870K / s' },
            { text: 'Peak writes', value: '3,500 / s' },
            { text: 'Text, 5 yr × 3', value: '540 TB' },
            { text: 'Media, 5 yr × 3', value: '27 PB', tone: 'warn' },
            { text: 'Text egress (floor) · images', value: '7 · 350 Gbps' },
          ],
        },
      },
      quiz: {
        question: 'A photo app serves 200K peak reads per second, and each response is 500 KB. About how much egress is that?',
        options: ['About 1 Gbps', 'About 10 Gbps', 'About 100 Gbps', 'About 800 Gbps'],
        answer: 3,
        explain: '200K × 500 KB = 100 GB/s. Multiply by 8 to get bits: 800 Gbps. No single origin serves that, which is why a CDN is needed.',
      },
    },
  ],
};
