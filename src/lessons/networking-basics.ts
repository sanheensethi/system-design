import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-6, 0), label: 'phone', sub: '198.51.100.7' };
const net: SceneNode = { id: 'net', kind: 'block', at: at(0, 0), label: 'internet', sub: 'best effort', icon: 'Globe', tint: 'gray' };
const server: SceneNode = { id: 'server', kind: 'server', at: at(6, 0), label: 'server', sub: '203.0.113.10' };
const r1: SceneNode = { id: 'r1', kind: 'block', size: 0.8, at: at(-3.2, 0), label: 'router A', icon: 'Router', tint: 'blue' };
const r2: SceneNode = { id: 'r2', kind: 'block', size: 0.8, at: at(0, -4.5), label: 'router B', icon: 'Router', tint: 'blue' };
const r3: SceneNode = { id: 'r3', kind: 'block', size: 0.8, at: at(0, 4.5), label: 'router C', icon: 'Router', tint: 'blue' };
const r4: SceneNode = { id: 'r4', kind: 'block', size: 0.8, at: at(3.2, 0), label: 'router D', icon: 'Router', tint: 'blue' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const direct = [link('phone', 'server')];
const routerLinks = [
  link('phone', 'r1'), link('r1', 'r2'), link('r1', 'r3'), link('r2', 'r4'), link('r3', 'r4'), link('r4', 'server'),
];

export const networkingBasics: Lesson = {
  id: 'networking-basics',
  title: 'Networking basics: IP, ports, TCP, UDP',
  tagline: 'How bytes find the right machine and the right program, and the two ways to send them: carefully or quickly.',
  minutes: 16,
  level: 'Beginner',
  learn: [
    'IPv4, IPv6, private addresses, NAT and subnets',
    'How packets carry data and how routers pass them hop by hop',
    'Latency, round trip time and bandwidth',
    'How ports and sockets pick one program and one conversation',
    'The TCP handshake, reliability, flow control, congestion control and teardown',
    'What UDP skips, how the two headers compare, and when UDP is the better choice',
  ],
  metrics: [
    { key: 'packets', label: 'Packets', icon: 'Package' },
    { key: 'lost', label: 'Lost on the way', icon: 'Signal' },
    { key: 'setup', label: 'Setup wait', icon: 'Timer' },
    { key: 'delivered', label: 'Delivered', icon: 'Inbox' },
  ],
  steps: [
    {
      title: 'Lost photo',
      tag: 'problem',
      heading: 'The network between two machines makes no promises',
      eli5: 'You want to mail a huge poster to a friend far away. The **internet** is like a postal system that sometimes loses letters, and nobody tells you when it does.',
      body: [
        'Your phone has a 2 MB photo. A server on another continent should receive it. Between them sit dozens of machines owned by different companies, joined by cables and radio links.',
        'That network is **best effort**. It tries to deliver each piece of data, and it is allowed to fail. Pieces can be lost, arrive twice, or arrive in the wrong order. On this path about 1 piece in 100 goes missing.',
      ],
      keyIdea: 'The internet itself only tries. Everything reliable you use is built on top of an unreliable network.',
      metrics: { lost: '1 in 100' },
      metricTones: { lost: 'bad' },
      scene: {
        nodes: [phone, { ...net, status: 'hot', badge: 'loses 1 in 100' }, server],
        links: [link('phone', 'net'), link('net', 'server')],
        flows: [
          { path: ['phone', 'net', 'server'], tone: 'data', label: 'photo', count: 4, duration: 2.2 },
          { path: ['phone', 'net'], tone: 'error', label: 'lost', duration: 1.1, delay: 1.4 },
        ],
        panel: {
          title: 'What the network may do',
          icon: 'Signal',
          rows: [
            { text: 'Lose a piece', tone: 'bad' },
            { text: 'Deliver a piece twice', tone: 'warn' },
            { text: 'Reorder pieces', tone: 'warn' },
            { text: 'Tell you about any of it', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Best effort: most data arrives, some does not',
      },
    },
    {
      title: 'IP addresses',
      tag: 'concept',
      heading: 'An IP address says which machine, in IPv4 or IPv6',
      eli5: 'Every house has a street address so the mail carrier can find it. An **IP address** is the street address of a computer. The phone has one and the server has one.',
      body: [
        'Every machine on the internet has an **IP address**. IPv4 is four numbers from 0 to 255 joined by dots, such as `203.0.113.10`. That gives about 4.3 billion addresses.',
        'Every piece of data carries two of them: source and destination. **IPv6** has 128-bit addresses like `2001:db8::10`, because IPv4 ran out. Both are in use side by side.',
      ],
      keyIdea: 'An IP address names one machine. IPv4 has 4.3 billion, IPv6 effectively never runs out.',
      metrics: { lost: '1 in 100' },
      scene: {
        nodes: [
          { ...phone, status: 'active', badge: 'from 198.51.100.7' },
          { ...server, status: 'active', badge: 'to 203.0.113.10' },
        ],
        links: direct,
        flows: [{ path: ['phone', 'server'], tone: 'data', label: 'to: 203.0.113.10', duration: 1.8 }],
        panel: {
          title: 'IPv4 address',
          icon: 'Hash',
          rows: [
            { text: 'Written as', value: '203.0.113.10' },
            { text: 'Four numbers', value: '0 to 255 each' },
            { text: 'IPv4 total', value: '~4.3 billion', tone: 'warn' },
            { text: 'IPv6, 128 bits', value: '2001:db8::10' },
            { text: 'IPv6 total', value: '3.4e38', tone: 'good' },
          ],
        },
        caption: 'Source address, destination address',
      },
    },
    {
      title: 'Private addresses',
      tag: 'concept',
      heading: 'Your home has a private address and a router swaps it',
      eli5: 'Inside a big apartment building everyone uses short room numbers. The front desk swaps them for the building\'s one street address on outgoing mail. That swap is **NAT**.',
      body: [
        'Your phone at home usually has a private address such as `192.168.1.23`. Private ranges (`10.x.x.x`, `172.16.x.x` to `172.31.x.x`, `192.168.x.x`) only work inside one network and are reused in millions of homes.',
        'The home router does **NAT** (network address translation). It rewrites the private source address to its one public address on the way out, and remembers who asked so replies go back to the right device.',
      ],
      keyIdea: 'Private addresses are reused everywhere. NAT lets many devices share one public address.',
      metrics: { lost: '1 in 100' },
      scene: {
        nodes: [
          { ...phone, sub: '192.168.1.23' },
          { id: 'nat', kind: 'block', at: at(0, 0), label: 'home router', sub: 'NAT', icon: 'Router', tint: 'teal', badge: 'public 198.51.100.7' },
          server,
        ],
        links: [link('phone', 'nat'), link('nat', 'server')],
        flows: [
          { path: ['phone', 'nat'], tone: 'request', label: 'from 192.168.1.23', duration: 1.4 },
          { path: ['nat', 'server'], tone: 'request', label: 'from 198.51.100.7', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'NAT table in the router',
          icon: 'Table',
          rows: [
            { text: '192.168.1.23:51514', value: 'phone' },
            { text: 'becomes', value: '198.51.100.7:40001' },
            { text: 'Reply to :40001', value: 'goes to phone', tone: 'good' },
          ],
        },
        caption: 'Many private devices, one public address',
      },
    },
    {
      title: 'Names to IPs',
      tag: 'concept',
      heading: 'People use names, the network uses addresses',
      eli5: 'You say "Grandma\'s house", but the mail carrier needs a street number. **DNS** is the phone book that turns the name into the number before you mail anything.',
      body: [
        'Nobody types `203.0.113.10`. You type `photos.example.com`, and **DNS** looks the name up and returns an IP address. Only then can the phone send a packet.',
        'The lookup is its own small exchange, usually sent over UDP. A later lesson covers DNS in depth. Here, just know the name is turned into an address first.',
      ],
      keyIdea: 'A name is looked up once to get an IP address. Packets only ever carry addresses.',
      metrics: { lost: '1 in 100' },
      scene: {
        nodes: [
          phone,
          { id: 'dns', kind: 'block', at: at(0, 0), label: 'DNS', sub: 'phone book', icon: 'Search', tint: 'violet' },
          server,
        ],
        links: [link('phone', 'dns'), link('dns', 'server', { style: 'faint' })],
        flows: [
          { path: ['phone', 'dns'], tone: 'request', label: 'photos.example.com?', duration: 1.4 },
          { path: ['dns', 'phone'], tone: 'response', label: '203.0.113.10', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Lookup answer',
          icon: 'Globe',
          rows: [
            { text: 'photos.example.com', value: '203.0.113.10' },
            { text: 'Sent over', value: 'UDP, port 53' },
          ],
        },
        caption: 'Name first, then packets',
      },
    },
    {
      title: 'Subnets',
      tag: 'concept',
      heading: 'A subnet is a block of addresses that share a prefix',
      eli5: 'A street has houses numbered 1 to 254. Neighbors walk to each other directly. Mail for any other street goes to the post office. A **subnet** is a street.',
      body: [
        'Addresses are grouped into **subnets**. In CIDR notation `192.168.1.0/24` means the first 24 bits are fixed and the last 8 are free: 256 addresses, 254 usable by machines.',
        'Machines in one subnet talk directly. Anything outside goes to the **default gateway**, the router at the edge. A `/16` holds 65,536 addresses and a `/32` is exactly one machine.',
      ],
      keyIdea: 'CIDR `/N` fixes the first N bits. Same prefix means same subnet, different prefix means go through a gateway.',
      metrics: { lost: '1 in 100' },
      scene: {
        nodes: [
          { ...phone, sub: '192.168.1.23' },
          { id: 'gw', kind: 'block', at: at(0, 0), label: 'gateway', sub: '192.168.1.1', icon: 'Router', tint: 'blue' },
          server,
        ],
        links: [link('phone', 'gw'), link('gw', 'server')],
        flows: [{ path: ['phone', 'gw', 'server'], tone: 'data', label: 'outside? use gateway', duration: 2.2 }],
        panel: {
          title: 'CIDR sizes',
          icon: 'Table',
          rows: [
            { text: '/32', value: '1 address' },
            { text: '/24', value: '256 addresses' },
            { text: '/16', value: '65,536 addresses' },
            { text: '/8', value: '16.7 million' },
          ],
          footer: { text: 'Same prefix talks directly, others use the gateway', tone: 'muted' },
        },
        caption: 'A street of addresses and one way out',
      },
    },
    {
      title: 'Layers',
      tag: 'concept',
      heading: 'Networking is a stack of layers, each with one job',
      eli5: 'A letter has an address on the envelope, a delivery note inside, and the message on the paper. Each helper only reads its own part. Networking stacks the same way, in **layers**.',
      body: [
        'Network software is stacked. **IP** at the bottom gets a packet to the right machine. **TCP** or **UDP** sits on top and picks the program with a port. **HTTP** at the top is the actual request the program makes.',
        'Each device reads only as high as it needs. A router reads the IP layer and forwards. A load balancer working at layer 4 reads IP and TCP. One working at layer 7 reads the HTTP request too. Later lessons use these names.',
      ],
      keyIdea: 'IP delivers to a machine, TCP or UDP delivers to a program, HTTP carries the request. Each device reads only up to its layer.',
      metrics: { lost: '1 in 100' },
      scene: {
        nodes: [
          phone,
          { ...r1, status: 'active', chips: ['reads IP only'] },
          { ...server, status: 'active', chips: ['reads IP, TCP, HTTP'] },
        ],
        links: [link('phone', 'r1'), link('r1', 'server')],
        flows: [{ path: ['phone', 'r1', 'server'], tone: 'data', label: 'HTTP in TCP in IP', duration: 2.2 }],
        panel: {
          title: 'The stack',
          icon: 'Layers',
          rows: [
            { text: 'HTTP (layer 7)', value: 'the request' },
            { text: 'TCP or UDP (layer 4)', value: 'ports' },
            { text: 'IP (layer 3)', value: 'addresses' },
            { text: 'Router', value: 'reads layer 3', tone: 'muted' },
          ],
        },
        caption: 'Each device reads only its own layer',
      },
    },
    {
      title: 'Packets',
      tag: 'concept',
      heading: 'Data travels in small packets',
      eli5: 'The poster is too big for one envelope, so you cut it into numbered pieces and mail each one. Each small envelope is a **packet** with the address of the server on the front.',
      body: [
        'The network does not move a 2 MB photo as one lump. The phone cuts it into **packets**. A packet is a small envelope: a header with the source and destination addresses, followed by a slice of the data.',
        'A typical packet carries at most about 1,500 bytes, the **MTU**. So the 2 MB photo becomes roughly **1,400 packets**, each sent on its own.',
      ],
      keyIdea: 'Big data is cut into packets of about 1,500 bytes. Each packet is addressed and delivered on its own.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [{ ...phone, status: 'active', badge: '2 MB = 1,400 packets' }, server],
        links: direct,
        flows: [
          { path: ['phone', 'server'], tone: 'data', label: '#1', duration: 1.6 },
          { path: ['phone', 'server'], tone: 'data', label: '#2', duration: 1.6, delay: 0.5 },
          { path: ['phone', 'server'], tone: 'data', label: '#3', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'One packet',
          icon: 'Package',
          rows: [
            { text: 'Header: from', value: '198.51.100.7' },
            { text: 'Header: to', value: '203.0.113.10' },
            { text: 'Data slice', value: 'up to ~1,460 bytes' },
            { text: 'Size limit (MTU)', value: '1,500 bytes' },
          ],
        },
        caption: 'One photo, many small envelopes',
      },
    },
    {
      title: 'Small is cheap',
      tag: 'concept',
      heading: 'Small packets share cables and make mistakes cheap',
      eli5: 'If one tiny envelope is lost, you only re-mail that one. If the whole poster had gone in one giant crate and the crate got lost, you would send everything again.',
      body: [
        'Small packets let millions of conversations share the same cables, taking turns. A huge lump would block everyone behind it.',
        'They also keep mistakes cheap. If one packet is lost, only 1,500 bytes travel again. At a loss of 1 in 100, about 14 of our 1,400 packets go missing.',
      ],
      keyIdea: 'Packets give fair sharing and cheap repair. Losing 14 packets costs 21 KB of resending, not 2 MB.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [{ ...phone, badge: '1,400 sent' }, { ...net, status: 'hot', badge: 'drops ~14' }, { ...server, badge: '1,386 arrive' }],
        links: [link('phone', 'net'), link('net', 'server')],
        flows: [
          { path: ['phone', 'net', 'server'], tone: 'data', count: 3, duration: 2 },
          { path: ['phone', 'net'], tone: 'error', label: 'lost #3', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Repair cost',
          icon: 'Gauge',
          rows: [
            { text: 'Lose 1 packet', value: '1.5 KB to resend', tone: 'good' },
            { text: 'Lose 14 packets', value: '21 KB to resend', tone: 'good' },
            { text: 'Lose one 2 MB lump', value: '2 MB to resend', tone: 'bad' },
          ],
        },
        caption: 'A lost piece costs only that piece',
      },
    },
    {
      title: 'Latency',
      tag: 'concept',
      heading: 'Distance costs time: latency and round trip time',
      eli5: 'Mailing to a friend across the world takes days however thin the envelope is. The wait for a letter and its reply is the **round trip time**.',
      body: [
        '**Latency** is how long one packet takes to get there. **Round trip time** (RTT) is there and back. Light in fiber covers about 200 km per millisecond, so a long cable cannot beat physics. On this path RTT is about 100 ms.',
        '**Bandwidth** is how many bits per second the pipe carries. More bandwidth does not cut the RTT. A tiny request over a fat pipe still waits 100 ms.',
      ],
      keyIdea: 'Latency is a delay, bandwidth is a width. Later lessons count almost everything in round trips.',
      metrics: { setup: '100 ms RTT' },
      metricTones: { setup: 'warn' },
      scene: {
        nodes: [phone, server],
        links: [link('phone', 'server', { label: '100 ms round trip', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['phone', 'server'], tone: 'request', label: 'ping', duration: 1.6 },
          { path: ['server', 'phone'], tone: 'response', label: 'pong', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Latency vs bandwidth',
          icon: 'Timer',
          rows: [
            { text: 'Latency (delay)', value: 'ms, set by distance' },
            { text: 'Bandwidth (width)', value: 'Mbit/s, set by link' },
            { text: '1 byte on a 1 Gbit/s link', value: 'still 100 ms RTT', tone: 'warn' },
          ],
        },
        caption: 'A fatter pipe does not shorten the trip',
      },
    },
    {
      title: 'Routers',
      tag: 'concept',
      heading: 'Routers pass each packet one hop closer',
      eli5: 'A sorting office does not know the whole road to your friend. It only knows which office to pass the envelope to next. Each **router** is a sorting office that passes packets along.',
      body: [
        'No machine knows the full path. Each **router** reads the destination address and forwards the packet to a closer neighbor. One step is a **hop**.',
        'Routing is packet by packet, so packets can arrive out of order, and an overloaded router drops them silently.',
        'Each router also lowers the **TTL** counter in the packet by one. At zero the packet is discarded and an **ICMP** error goes back. `ping` and `traceroute` rely on this.',
      ],
      keyIdea: 'Routers forward packets hop by hop with no guarantee. Packets can take different paths, arrive out of order, or be dropped.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [phone, { ...r1, status: 'active' }, r2, { ...r3, status: 'hot', load: 97, badge: 'full, drops #3' }, r4],
        links: routerLinks.slice(0, 5),
        flows: [
          { path: ['phone', 'r1', 'r2', 'r4'], tone: 'data', label: '#1', duration: 2.4 },
          { path: ['phone', 'r1', 'r2', 'r4'], tone: 'data', label: '#2', duration: 2.4, delay: 0.8 },
          { path: ['phone', 'r1', 'r3'], tone: 'error', label: '#3 dropped', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Routing table of router A',
          icon: 'Route',
          rows: [
            { text: 'to 203.0.113.0/24', value: 'via router B' },
            { text: 'to 192.0.2.0/24', value: 'via router C' },
            { text: 'anything else', value: 'default route' },
          ],
        },
        caption: 'Two paths, and one router dropping packets',
      },
      code: {
        language: 'bash',
        title: 'See the hops between you and a server',
        source: `$ traceroute 203.0.113.10
 1  192.168.1.1       1.2 ms     # your home router
 2  10.20.0.1         8.4 ms     # your internet provider
 3  198.51.100.33    14.9 ms
 4  198.51.100.90    52.7 ms     # a long cable under the sea
 5  203.0.113.1      98.3 ms
 6  203.0.113.10     99.1 ms     # the server: about 100 ms round trip`,
        highlight: [2, 5, 7],
      },
    },
    {
      title: 'Ports',
      tag: 'concept',
      heading: 'A port says which program',
      eli5: 'The address gets the envelope to the right building. The apartment number gets it to the right door. A **port** is the apartment number: 443 is the web server, 22 is SSH, 5432 is Postgres.',
      body: [
        'The address `203.0.113.10` gets a packet to the right machine. That machine runs several programs. The **port** number, 0 to 65,535, says which one gets the packet.',
        'Servers listen on well-known ports so clients know where to knock: `443` HTTPS, `80` HTTP, `22` SSH, `53` DNS, `5432` Postgres.',
      ],
      keyIdea: 'IP address picks the machine, port picks the program. Written together: `203.0.113.10:443`.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [
          { ...phone, badge: 'from port 51514' },
          { id: 'web', kind: 'block', at: at(2.2, -3), label: 'web server', sub: 'port 443', icon: 'Globe', tint: 'green', status: 'active', badge: 'listening' },
          { id: 'ssh', kind: 'block', size: 0.8, at: at(5.2, 0), label: 'SSH', sub: 'port 22', icon: 'Key', tint: 'gray', status: 'dim' },
          { id: 'pg', kind: 'block', size: 0.8, at: at(2.2, 3), label: 'Postgres', sub: 'port 5432', icon: 'Database', tint: 'blue', status: 'dim' },
        ],
        links: [link('phone', 'web')],
        zones: [{ id: 'machine', from: [-1, -5], to: [6, 5], label: 'one machine: 203.0.113.10', tone: 'blue' }],
        flows: [
          { path: ['phone', 'web'], tone: 'request', label: 'to 203.0.113.10:443', duration: 1.8 },
          { path: ['web', 'phone'], tone: 'response', label: 'to :51514', duration: 1.8, delay: 2 },
        ],
        caption: 'One address, many doors',
      },
      quiz: {
        question: 'A machine at 203.0.113.10 runs a web server and a Postgres database. A packet arrives. How does the machine know which program should get it?',
        options: [
          'By the source IP address',
          'By the destination port number in the packet',
          'By the size of the packet',
          'It gives a copy to every program',
        ],
        answer: 1,
        explain: 'The IP address only gets the packet to the machine. The destination port (443 for the web server, 5432 for Postgres) tells the operating system which listening program receives it.',
      },
    },
    {
      title: 'Sockets',
      tag: 'concept',
      heading: 'Four values name one conversation',
      eli5: 'Many families write to the same apartment door. The postman tells their letters apart by who wrote them and which window they came from. Four values name each **conversation**.',
      body: [
        'The client has a port too. Its operating system picks a free **ephemeral** port at random, say `51514`, so replies find the right app.',
        'A conversation, called a **socket pair**, is source address, source port, destination address and destination port. That is how one web server on port 443 holds thousands of conversations at once. Talking to `127.0.0.1` (localhost) never leaves your machine.',
      ],
      keyIdea: 'The 4-tuple of addresses and ports identifies one connection. Many clients can share one server port.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [
          { ...phone, chips: ['port 51514'] },
          { id: 'laptop', kind: 'block', size: 0.8, at: at(-3.4, 6.5), label: 'laptop', sub: '198.51.100.8', icon: 'Laptop', tint: 'teal', chips: ['port 51514'] },
          { id: 'web', kind: 'block', at: at(3, 3), label: 'web server', sub: '203.0.113.10:443', icon: 'Globe', tint: 'green', status: 'active' },
        ],
        links: [link('phone', 'web'), link('laptop', 'web')],
        flows: [
          { path: ['phone', 'web'], tone: 'request', duration: 1.8 },
          { path: ['laptop', 'web'], tone: 'request', duration: 1.8, delay: 0.6 },
        ],
        panel: {
          title: 'Two connections, same server port',
          icon: 'Table',
          rows: [
            { text: '198.51.100.7:51514', value: '203.0.113.10:443' },
            { text: '198.51.100.8:51514', value: '203.0.113.10:443' },
            { text: 'Same ports, different source IP', value: 'distinct', tone: 'good' },
          ],
        },
        caption: 'The server tells clients apart by the full 4-tuple',
      },
    },
    {
      title: 'TCP handshake',
      tag: 'concept',
      heading: 'TCP starts with a three-step handshake',
      eli5: 'Before mailing the poster, the phone sends a note: "ready?" The server answers "ready, and you?" and the phone replies "ready". That short hello is the **TCP handshake**.',
      body: [
        '**TCP** (Transmission Control Protocol) is the careful delivery style. Before any data moves, the two sides open a **connection** with three small packets.',
        'The phone sends `SYN` ("my byte numbers start at 1000, real ones are random"). The server replies `SYN-ACK` ("got it, mine start at 5000"). The phone answers `ACK`. Both sides now know the other is alive and what number to expect.',
      ],
      keyIdea: 'A TCP connection is set up with SYN, SYN-ACK, ACK. Both sides then agree on starting numbers.',
      metrics: { packets: '1,400', lost: '14', setup: '100 ms' },
      scene: {
        nodes: [{ ...phone, status: 'active' }, { ...server, status: 'active', badge: 'port 9000' }],
        links: [link('phone', 'server', { arrow: 'both' })],
        flows: [
          { path: ['phone', 'server'], tone: 'handshake', label: 'SYN', duration: 1.1 },
          { path: ['server', 'phone'], tone: 'handshake', label: 'SYN-ACK', duration: 1.1, delay: 1.2 },
          { path: ['phone', 'server'], tone: 'handshake', label: 'ACK', duration: 1.1, delay: 2.4 },
          { path: ['phone', 'server'], tone: 'data', label: 'photo bytes', count: 3, duration: 1.1, delay: 3.6 },
        ],
        panel: {
          title: 'Handshake',
          icon: 'Repeat',
          rows: [
            { text: 'phone to server', value: 'SYN, seq 1000' },
            { text: 'server to phone', value: 'SYN-ACK, seq 5000' },
            { text: 'phone to server', value: 'ACK, then data' },
          ],
        },
        caption: 'Hello first, data after',
      },
    },
    {
      title: 'Handshake cost',
      tag: 'tradeoff',
      heading: 'The hello costs one round trip before any data',
      eli5: 'The phone cannot mail the poster until the server says "ready". For a big poster, the short wait is fine. For a one-word note, the hello takes longer than the note.',
      body: [
        'The handshake costs **one round trip**, 100 ms on this path, before the first byte of the photo can leave. For a long upload that is nothing.',
        'For a tiny question and answer, the hello can take longer than the conversation. That is why later lessons reuse connections instead of opening a new one each time.',
      ],
      keyIdea: 'Connection setup costs one RTT. Reusing a connection pays that cost once.',
      metrics: { packets: '1,400', lost: '14', setup: '100 ms' },
      metricTones: { setup: 'warn' },
      scene: {
        nodes: [phone, { ...server, badge: 'first byte at 100 ms' }],
        links: [link('phone', 'server', { label: '100 ms RTT', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['phone', 'server'], tone: 'handshake', label: 'SYN', duration: 1.2 },
          { path: ['server', 'phone'], tone: 'handshake', label: 'SYN-ACK', duration: 1.2, delay: 1.3 },
          { path: ['phone', 'server'], tone: 'data', label: 'first byte', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Time before data',
          icon: 'Timer',
          rows: [
            { text: '2 MB upload, 4 s total', value: '100 ms is 2.5%', tone: 'good' },
            { text: '1 KB API call, 100 ms', value: 'doubles the wait', tone: 'bad' },
          ],
        },
        caption: 'Setup wait before any data moves',
      },
    },
    {
      title: 'TCP reliability',
      tag: 'concept',
      heading: 'Numbered, acknowledged, resent',
      eli5: 'The server signs for every numbered envelope it gets. If no signature comes back for number 3, the phone mails number 3 again. That is how **TCP** gets the whole poster there, in order.',
      body: [
        'TCP numbers every byte it sends. The receiver replies with **acknowledgments** (ACKs) that say "I have everything up to here". If an ACK does not come back in time, the sender **retransmits** the missing packet. The scenes label packets #1 to #5 for readability, but the real numbers count bytes.',
        'The receiver uses the numbers to put packets back in order and drop duplicates. The program sees a clean stream of bytes. Our 14 lost packets are sent again and the server gets all 1,400.',
      ],
      keyIdea: 'TCP turns an unreliable network into a reliable, ordered stream of bytes using numbers, ACKs and resends.',
      metrics: { packets: '1,400 + 14 resent', lost: '14', setup: '100 ms', delivered: '100%, in order' },
      metricTones: { delivered: 'good' },
      scene: {
        nodes: [phone, { ...r1, status: 'active' }, { ...r3, status: 'hot', badge: 'dropped #3' }, { ...server, status: 'ok', badge: 'has #1 #2' }],
        links: [link('phone', 'r1'), link('r1', 'r3'), link('r1', 'server', { style: 'dashed' })],
        flows: [
          { path: ['phone', 'r1', 'r3'], tone: 'error', label: '#3 lost', duration: 1.4 },
          { path: ['server', 'r1', 'phone'], tone: 'handshake', label: 'ACK up to #2', duration: 2.2, delay: 1.5 },
          { path: ['phone', 'r1', 'server'], tone: 'data', label: '#3 again', duration: 2.2, delay: 3.9 },
        ],
        panel: {
          title: 'The sender keeps score',
          icon: 'Table',
          rows: [
            { text: '#1, #2', value: 'ACKed', tone: 'good' },
            { text: '#3', value: 'no ACK, resend', tone: 'warn' },
            { text: '#4, #5', value: 'sent, waiting' },
          ],
        },
        caption: 'No acknowledgment, so send it again',
      },
      code: {
        language: 'python',
        title: 'TCP from a program: connect, then a stream of bytes',
        source: `import socket

# A plain TCP port. HTTPS (port 443) adds TLS on top of this.
# Opening the connection performs the handshake: SYN, SYN-ACK, ACK.
conn = socket.create_connection(("203.0.113.10", 9000))

photo_bytes = open("photo.jpg", "rb").read()

# Hand over all 2 MB. The operating system cuts it into packets,
# numbers them, waits for ACKs and resends whatever gets lost.
conn.sendall(photo_bytes)

# Bytes come back complete and in order, or the call fails with an error.
reply = conn.recv(1024)
conn.close()`,
        highlight: [5, 11],
      },
    },
    {
      title: 'Head-of-line',
      tag: 'tradeoff',
      heading: 'One lost packet makes the rest wait',
      eli5: 'The server must hand over the poster pieces in order. If piece 3 is missing, pieces 4 and 5 sit on the table until 3 is mailed again. That waiting is **head-of-line blocking**.',
      body: [
        'TCP hands bytes to the app in order. When packet 3 is lost, packets 4 and 5 may already be at the server, but they sit in a buffer until 3 arrives again.',
        'The wait is at least one extra round trip, here 100 ms. This is the price of ordered delivery, and the reason real-time apps look elsewhere.',
      ],
      keyIdea: 'In-order delivery means a lost packet stalls everything behind it. This is head-of-line blocking.',
      metrics: { packets: '1,400 + 14 resent', lost: '14', delivered: 'in order, with stalls' },
      metricTones: { delivered: 'warn' },
      scene: {
        nodes: [phone, { ...server, status: 'hot', chips: ['#1 #2 ok', { text: '#3 missing', tone: 'bad' as const }, '#4 waiting', '#5 waiting'] }],
        links: [link('phone', 'server', { label: '+100 ms stall', labelTone: 'warn' })],
        flows: [
          { path: ['phone', 'server'], tone: 'error', label: '#3 lost', duration: 1.2 },
          { path: ['phone', 'server'], tone: 'data', label: '#4', duration: 1.4, delay: 0.5 },
          { path: ['phone', 'server'], tone: 'data', label: '#3 again', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Receive buffer',
          icon: 'Inbox',
          rows: [
            { text: '#1, #2', value: 'given to app', tone: 'good' },
            { text: '#3', value: 'missing', tone: 'bad' },
            { text: '#4, #5', value: 'held back', tone: 'warn' },
          ],
        },
        caption: 'Later packets wait for the missing one',
      },
      quiz: {
        question: 'TCP packet 3 is lost, but packets 4 and 5 arrive. What does the application on the server see?',
        options: [
          'Packets 4 and 5 immediately, then 3 later',
          'Nothing new until packet 3 is resent and arrives, then 3, 4, 5 in order',
          'An error, and the connection is closed at once',
          'Packet 3 is skipped and the stream continues',
        ],
        answer: 1,
        explain: 'TCP delivers an ordered stream. Packets 4 and 5 are held in the receive buffer until the resent packet 3 arrives. That wait is head-of-line blocking.',
      },
    },
    {
      title: 'Flow control',
      tag: 'concept',
      heading: 'The receiver says how much it can take',
      eli5: 'The server has a small table for incoming pieces. It tells the phone "I have room for 10 more". The phone stops mailing when the table is full. That is **flow control**.',
      body: [
        'A slow receiver must not be buried by a fast sender. Every ACK carries a **receive window**: how many more bytes the receiver has room for.',
        'The sender keeps no more than that in flight, and pauses at zero.',
        'The window also caps speed: throughput is at most window divided by RTT. 64 KB over 100 ms tops out near 640 KB/s.',
      ],
      keyIdea: 'Flow control protects the receiver. The receive window in each ACK limits how much the sender may have in flight.',
      metrics: { packets: '1,400', delivered: '100%, in order' },
      scene: {
        nodes: [{ ...phone, chips: ['sending'] }, { ...server, status: 'hot', load: 90, badge: 'window: 4 KB' }],
        links: [link('phone', 'server', { arrow: 'both' })],
        flows: [
          { path: ['phone', 'server'], tone: 'data', label: 'up to 4 KB', count: 3, duration: 1.4 },
          { path: ['server', 'phone'], tone: 'handshake', label: 'ACK, window 4 KB', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Receive window in ACKs',
          icon: 'Gauge',
          rows: [
            { text: 'Reader keeps up', value: 'window 64 KB', tone: 'good' },
            { text: 'Reader slows', value: 'window 4 KB', tone: 'warn' },
            { text: 'Buffer full', value: 'window 0, pause', tone: 'bad' },
            { text: 'Speed limit: window / RTT', value: '64 KB / 100 ms = 640 KB/s', tone: 'warn' },
          ],
        },
        caption: 'The receiver sets the pace',
      },
    },
    {
      title: 'Congestion',
      tag: 'concept',
      heading: 'The sender also slows down for the network',
      eli5: 'The post office roads get jammed if everyone mails at once. The phone starts with a few envelopes, sends more while all arrive, and halves its pile when one is lost. That is **congestion control**.',
      body: [
        'Flow control protects the receiver. **Congestion control** protects the network in between. TCP keeps a **congestion window**: it starts small (slow start), doubles each round trip while ACKs return, and halves when a loss signals a jam.',
        'This is why a new connection is slow at first and why one upload cannot instantly fill a fast link. Each connection backs off, so everyone shares the path.',
      ],
      keyIdea: 'TCP probes for capacity: grow while ACKs return, cut in half on loss. New connections start slow.',
      metrics: { packets: '1,400', setup: '100 ms', delivered: '100%, in order' },
      scene: {
        nodes: [{ ...phone, badge: 'window: 8 packets' }, { ...net, status: 'hot', load: 88, badge: 'jam, loss seen' }, server],
        links: [link('phone', 'net', { label: 'window halves', labelTone: 'warn' }), link('net', 'server')],
        flows: [
          { path: ['phone', 'net', 'server'], tone: 'data', count: 4, duration: 2 },
          { path: ['net', 'phone'], tone: 'error', label: 'loss', duration: 1.2, delay: 2.1 },
        ],
        panel: {
          title: 'Window per round trip',
          icon: 'TrendingUp',
          rows: [
            { text: 'Round trip 1', value: '1 packet' },
            { text: 'Round trip 2', value: '2 packets' },
            { text: 'Round trip 3', value: '4 packets' },
            { text: 'Round trip 4', value: '8 packets' },
            { text: 'Loss seen', value: 'back to 4', tone: 'warn' },
          ],
        },
        caption: 'Grow while it works, back off on loss',
      },
      quiz: {
        question: 'A brand new TCP connection starts sending. Why is it slow at first, even on a fast link?',
        options: [
          'The server deliberately delays new clients',
          'The congestion window starts small and roughly doubles each round trip while ACKs return',
          'The handshake has to repeat for every packet',
          'Routers hold new connections back for a minute',
        ],
        answer: 1,
        explain: 'Slow start begins with a small congestion window and doubles it each round trip. The sender probes for capacity, so a new connection takes several round trips to reach full speed.',
      },
    },
    {
      title: 'Closing',
      tag: 'concept',
      heading: 'Closing is polite too: FIN and ACK',
      eli5: 'When the poster is delivered, each side says "I am done talking" and the other says "ok". Only after both have said goodbye does the door close. That goodbye is the **FIN** exchange.',
      body: [
        'Each side closes its own direction with a `FIN`, and the other side answers `ACK`. That makes four packets, so every byte sent before the close is delivered.',
        'The side that closes first holds the connection in `TIME_WAIT` for about a minute, so stray late packets cannot confuse a new connection. A client or proxy that opens and closes thousands of connections a second can run out of ephemeral ports.',
      ],
      keyIdea: 'TCP closes with FIN and ACK in each direction. Reusing connections avoids repeating setup and teardown.',
      metrics: { packets: '1,400 + 14 resent', setup: '100 ms', delivered: '100%, in order' },
      metricTones: { delivered: 'good' },
      scene: {
        nodes: [{ ...phone, chips: [{ text: 'TIME_WAIT ~60 s', tone: 'warn' as const }] }, { ...server, status: 'ok', badge: 'got all 1,400' }],
        links: [link('phone', 'server', { arrow: 'both' })],
        flows: [
          { path: ['phone', 'server'], tone: 'handshake', label: 'FIN', duration: 1.1 },
          { path: ['server', 'phone'], tone: 'handshake', label: 'ACK', duration: 1.1, delay: 1.2 },
          { path: ['server', 'phone'], tone: 'handshake', label: 'FIN', duration: 1.1, delay: 2.4 },
          { path: ['phone', 'server'], tone: 'handshake', label: 'ACK', duration: 1.1, delay: 3.6 },
        ],
        panel: {
          title: 'Connection life',
          icon: 'Repeat',
          rows: [
            { text: 'Open', value: 'SYN, SYN-ACK, ACK' },
            { text: 'Transfer', value: 'data and ACKs' },
            { text: 'Close', value: 'FIN, ACK, FIN, ACK' },
            { text: 'Closer waits', value: 'TIME_WAIT ~60 s', tone: 'muted' },
          ],
        },
        caption: 'Goodbye in both directions',
      },
    },
    {
      title: 'UDP',
      tag: 'concept',
      heading: 'UDP sends and moves on',
      eli5: 'A postcard needs no hello and no signature. You drop it in the box and walk away. **UDP** sends packets like postcards: quick, and if one is lost the phone never hears about it.',
      body: [
        '**UDP** (User Datagram Protocol) is the quick delivery style. It adds a port number and a simple error check to a packet and sends it. There is no handshake, no numbering, no acknowledgment and no resend.',
        'Each message, called a **datagram**, stands alone. It may arrive, arrive twice, arrive out of order or vanish. The sender is not told. If the app cares, it must notice and react itself.',
      ],
      keyIdea: 'UDP is a thin layer over raw packets: ports and nothing else. No waiting, no guarantees.',
      metrics: { packets: '1,400', lost: '14', setup: '0 ms', delivered: '99%, any order' },
      metricTones: { setup: 'good', delivered: 'warn' },
      scene: {
        nodes: [{ ...phone, status: 'active' }, { ...server, badge: 'port 9000' }],
        links: direct,
        flows: [
          { path: ['phone', 'server'], tone: 'data', label: '#1', duration: 1.4 },
          { path: ['phone', 'server'], tone: 'data', label: '#2', duration: 1.4, delay: 0.4 },
          { path: ['phone', 'server'], tone: 'error', label: '#3 lost, nobody told', duration: 0.8, delay: 0.8 },
          { path: ['phone', 'server'], tone: 'data', label: '#4', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'UDP gives you',
          icon: 'Zap',
          rows: [
            { text: 'Ports', tone: 'good' },
            { text: 'Handshake', value: 'none', tone: 'muted' },
            { text: 'ACKs and resends', value: 'none', tone: 'muted' },
            { text: 'Ordering', value: 'none', tone: 'muted' },
          ],
        },
        caption: 'No hello, no receipts',
      },
      code: {
        language: 'python',
        title: 'UDP from a program: no connection, one datagram at a time',
        source: `import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)   # DGRAM = UDP

# No connect step. Each sendto() is one independent packet.
sock.sendto(b"player 7 at x=120 y=44", ("203.0.113.10", 9000))

# No ACK and no resend. If the packet is lost, nothing here fails.
sock.settimeout(0.2)
try:
    data, sender = sock.recvfrom(1200)
except socket.timeout:
    data = None        # the app decides what a missing reply means`,
        highlight: [3, 6, 12, 13],
      },
    },
    {
      title: 'Headers',
      tag: 'tradeoff',
      heading: 'UDP is lighter on the wire',
      eli5: 'A postcard has a tiny stamp area, while signed mail has a long form on the front. The **UDP** header is the short stamp, and the **TCP** header is the long form.',
      body: [
        'The UDP header is 8 bytes: source port, destination port, length and a checksum. The TCP header is at least 20 bytes, because it also carries sequence numbers, ACK numbers, flags and the window.',
        'The bigger gap is in behavior. TCP keeps state on both ends for each connection. UDP keeps none, so a server can answer huge numbers of senders cheaply.',
      ],
      keyIdea: 'UDP header: 8 bytes, no state. TCP header: 20 bytes or more, plus state on both ends.',
      metrics: { setup: 'TCP 100 ms, UDP 0' },
      scene: {
        nodes: [
          { id: 'tcp', kind: 'block', at: at(-3, 0), label: 'TCP', sub: 'careful', icon: 'Shield', tint: 'blue' },
          { id: 'udp', kind: 'block', at: at(3, 0), label: 'UDP', sub: 'quick', icon: 'Zap', tint: 'amber' },
        ],
        links: [],
        panel: {
          title: 'Header contents',
          icon: 'Table',
          rows: [
            { text: 'Header size', value: 'TCP 20+ B, UDP 8 B' },
            { text: 'Ports', value: 'both' },
            { text: 'Seq, ACK, window, flags', value: 'TCP only' },
            { text: 'Connection state', value: 'TCP only' },
            { text: 'Checksum', value: 'both' },
          ],
        },
        caption: 'Same ports, very different promises',
      },
    },
    {
      title: 'Which one',
      tag: 'tradeoff',
      heading: 'TCP when every byte matters, UDP when time matters',
      eli5: 'A birthday poster must arrive whole, so you use signed mail, **TCP**. For a quick "I am here" wave each second, a postcard is fine. If one is lost, the next comes soon. That is **UDP**.',
      body: [
        'Use **TCP** when a missing byte would break the result: web pages, API calls, database queries, file uploads, email. A photo with a hole in it is useless.',
        'Use **UDP** when late data is worthless. A voice packet 300 ms late is no good to anyone. Games send a player\'s position many times a second and the next update replaces a lost one. DNS lookups are one tiny question, so a handshake would cost more.',
      ],
      keyIdea: 'TCP: complete and ordered, at the cost of waiting. UDP: immediate, at the cost of gaps. Ask what a lost packet does to your user.',
      metrics: { packets: '1,400', lost: '14', setup: 'TCP 100 ms, UDP 0', delivered: 'TCP 100%, UDP 99%' },
      scene: {
        nodes: [
          { ...phone, badge: 'upload + voice call' },
          { id: 'web', kind: 'block', at: at(2.2, -4.5), label: 'photo upload', sub: 'TCP port 443', icon: 'Image', tint: 'green', status: 'ok', badge: 'all 1,400 arrive' },
          { id: 'voice', kind: 'block', at: at(2.2, 4.5), label: 'voice call', sub: 'UDP port 9000', icon: 'Signal', tint: 'amber', status: 'active', badge: 'no pauses' },
        ],
        links: [link('phone', 'web'), link('phone', 'voice')],
        flows: [
          { path: ['phone', 'web'], tone: 'data', label: 'TCP: every byte', count: 3, duration: 1.8 },
          { path: ['web', 'phone'], tone: 'handshake', label: 'ACK', duration: 1.8, delay: 2 },
          { path: ['phone', 'voice'], tone: 'event', label: 'UDP: voice', count: 5, duration: 1.2, delay: 0.3 },
        ],
        panel: {
          title: 'Typical picks',
          icon: 'List',
          rows: [
            { text: 'Web, APIs, email, files', value: 'TCP', tone: 'good' },
            { text: 'Databases, SSH', value: 'TCP', tone: 'good' },
            { text: 'Voice, video, games', value: 'UDP', tone: 'warn' },
            { text: 'DNS lookups', value: 'UDP' },
          ],
        },
        caption: 'Same phone, same server, two delivery styles',
      },
    },
    {
      title: 'Beyond UDP',
      tag: 'concept',
      heading: 'New protocols build reliability on top of UDP',
      eli5: 'Some people send postcards but add their own numbers and a "did you get it?" line. That gives them signed-mail care without waiting behind one lost card. **QUIC** does this.',
      body: [
        'UDP is also a base for newer protocols that add reliability themselves. **QUIC**, which carries HTTP/3, runs over UDP, numbers its own streams and resends lost data. It lives in the phone and the server, not in the routers between them, which still just see UDP packets.',
        'Because each stream is separate, a lost packet only stalls its own stream, not all of them. It also merges the connection and encryption setup into one round trip. The next lessons build on this.',
      ],
      keyIdea: 'UDP is a flexible base. QUIC adds reliability and separate streams on top, avoiding TCP head-of-line blocking.',
      metrics: { setup: 'QUIC ~1 RTT' },
      scene: {
        nodes: [
          { ...phone, chips: ['HTTP/3', 'QUIC over UDP'] },
          { ...server, status: 'ok', chips: ['HTTP/3', 'QUIC over UDP'] },
        ],
        links: [link('phone', 'server', { label: 'UDP packets', arrow: 'both' })],
        flows: [{ path: ['phone', 'server'], tone: 'event', label: 'streams over UDP', count: 3, duration: 2 }],
        panel: {
          title: 'Layers',
          icon: 'Layers',
          rows: [
            { text: 'HTTP/3', value: 'requests' },
            { text: 'QUIC', value: 'reliability, streams' },
            { text: 'UDP', value: 'ports', tone: 'muted' },
            { text: 'IP', value: 'addresses', tone: 'muted' },
          ],
        },
        caption: 'Careful delivery built over the quick one',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Address, port, packet, and a delivery style',
      eli5: 'The **phone** cuts the poster into envelopes, writes the address and apartment number of the **server** on each, and the **routers** pass them along. Signed mail is slow and sure. Postcards are fast and may get lost.',
      body: [
        'An **IP address** names a machine and a **port** names a program. Data is cut into **packets** of about 1,500 bytes, and **routers** forward each hop by hop with no guarantee. A there-and-back trip is one **round trip**.',
        '**TCP** spends one round trip on a handshake, then numbers, acknowledges, resends, and slows down for the receiver and the network. **UDP** skips all of that: no setup, no receipts, no waiting.',
      ],
      keyIdea: 'IP finds the machine, the port finds the program, TCP makes delivery reliable, UDP makes it immediate.',
      metrics: { packets: '1,400', lost: '14', setup: 'TCP 100 ms, UDP 0', delivered: 'TCP 100%, UDP 99%' },
      scene: {
        nodes: [phone, { ...r1, status: 'active' }, r2, r4, { ...server, status: 'ok' }],
        links: [link('phone', 'r1'), link('r1', 'r2'), link('r2', 'r4'), link('r4', 'server')],
        flows: [
          { path: ['phone', 'r1', 'r2', 'r4', 'server'], tone: 'data', count: 3, duration: 2.4 },
          { path: ['server', 'r4', 'r2', 'r1', 'phone'], tone: 'handshake', label: 'ACK', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'Cheat sheet',
          icon: 'List',
          rows: [
            { text: 'IP address', value: 'which machine' },
            { text: 'Port', value: 'which program' },
            { text: 'TCP', value: 'reliable, ordered' },
            { text: 'UDP', value: 'fast, no promises' },
          ],
        },
        caption: 'Packets out, acknowledgments back',
      },
      quiz: {
        question: 'You are building a live voice chat. A packet of audio arrives 400 ms late. Which transport fits this app, and why?',
        options: [
          'TCP, because every packet must arrive',
          'TCP, because it has no handshake',
          'UDP, because late audio is useless and waiting for a resend would freeze the call',
          'UDP, because it guarantees packets arrive in order',
        ],
        answer: 2,
        explain: 'In a live call, old audio has no value. TCP would hold back newer audio while it resends the lost packet, which the listener hears as a freeze. UDP lets the app skip the gap and keep playing. UDP guarantees nothing about order or delivery.',
      },
    },
  ],
};
