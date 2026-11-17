import type { Lesson, SceneNode } from '../engine/types';

const phone: SceneNode = { id: 'phone', kind: 'phone', at: [-3.75, 3.75], label: 'phone', sub: '198.51.100.7' };
const net: SceneNode = { id: 'net', kind: 'internet', at: [-0.8, 0.8], label: 'the internet' };
const r1: SceneNode = { id: 'r1', kind: 'gateway', at: [-2.3, 2.3], label: 'router A' };
const r2: SceneNode = { id: 'r2', kind: 'gateway', at: [-2.6, -1], label: 'router B' };
const r3: SceneNode = { id: 'r3', kind: 'gateway', at: [1, 2.6], label: 'router C' };
const r4: SceneNode = { id: 'r4', kind: 'gateway', at: [0.7, -0.7], label: 'router D' };
const server: SceneNode = { id: 'server', kind: 'server', at: [2.2, -2.2], label: 'server', sub: '203.0.113.10' };

const web: SceneNode = { id: 'web', kind: 'service', at: [1, -1], label: 'web server', sub: 'port 443' };
const ssh: SceneNode = { id: 'ssh', kind: 'service', at: [3.2, -1], label: 'SSH', sub: 'port 22' };
const pg: SceneNode = { id: 'pg', kind: 'db', at: [5.4, -1], label: 'Postgres', sub: 'port 5432' };

const routerLinks = [
  { from: 'phone', to: 'r1' },
  { from: 'r1', to: 'r2' },
  { from: 'r1', to: 'r3' },
  { from: 'r2', to: 'r4' },
  { from: 'r3', to: 'r4' },
  { from: 'r4', to: 'server' },
];

const directLinks = [{ from: 'phone', to: 'server' }];

export const networkingBasics: Lesson = {
  id: 'networking-basics',
  title: 'Networking basics: IP, ports, TCP, UDP',
  tagline: 'How bytes find the right machine and the right program, and the two ways to send them: carefully or quickly.',
  minutes: 12,
  level: 'Beginner',
  learn: [
    'What an IP address is and how packets carry data',
    'How routers pass packets hop by hop, with no promises',
    'How ports pick one program on a machine',
    'The TCP handshake and how TCP makes delivery reliable',
    'What UDP skips, and when that is the better choice',
  ],
  metrics: [
    { key: 'packets', label: 'Packets' },
    { key: 'lost', label: 'Lost on the way' },
    { key: 'setup', label: 'Setup wait' },
    { key: 'delivered', label: 'Delivered' },
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
        'Yet uploads work, web pages load, and video calls mostly sound fine. This lesson explains the four ideas that make that possible: addresses, packets, ports, and the two delivery styles called TCP and UDP.',
      ],
      keyIdea: 'The internet itself only tries. Everything reliable you use is built on top of an unreliable network.',
      metrics: { lost: '1 in 100' },
      scene: {
        nodes: [phone, { ...net, status: 'hot', badge: 'loses 1 in 100' }, server],
        links: [
          { from: 'phone', to: 'net' },
          { from: 'net', to: 'server' },
        ],
        flows: [
          { path: ['phone', 'net', 'server'], tone: 'data', label: 'photo', count: 4, duration: 2.2 },
          { path: ['phone', 'net'], tone: 'error', label: 'lost', duration: 1.1, delay: 1.4 },
        ],
        caption: 'Best effort: most data arrives, some does not',
      },
    },
    {
      title: 'IP addresses',
      tag: 'concept',
      heading: 'An IP address says which machine',
      eli5: 'Every house has a street address so the mail carrier can find it. An **IP address** is the street address of a computer. The phone has one and the server has one.',
      body: [
        'Every machine on the internet has an **IP address**. The common form, IPv4, is four numbers from 0 to 255 joined by dots, such as `203.0.113.10`. That gives about 4.3 billion addresses.',
        'The world has more devices than that, so a newer form exists. **IPv6** addresses are much longer, written like `2001:db8::10`, and there are enough of them for every device many times over. Both forms are in use today.',
        'Your phone at home usually has a private address such as `192.168.1.23` that only works inside your house. Your home router swaps it for one public address on the way out. For this lesson, treat every machine as having one address that the rest of the internet can reach.',
      ],
      keyIdea: 'An IP address names one machine on the network. Every piece of data carries the address it came from and the address it is going to.',
      metrics: { lost: '1 in 100' },
      scene: {
        nodes: [
          { ...phone, status: 'active', badge: 'from 198.51.100.7' },
          { ...server, status: 'active', badge: 'to 203.0.113.10' },
        ],
        links: directLinks,
        flows: [{ path: ['phone', 'server'], tone: 'data', label: 'to: 203.0.113.10', duration: 1.8 }],
        caption: 'Source address, destination address',
      },
    },
    {
      title: 'Packets',
      tag: 'concept',
      heading: 'Data travels in small packets',
      eli5: 'The poster is too big for one envelope, so you cut it into numbered pieces and mail each one. Each small envelope is a **packet** with the address of the server on the front.',
      body: [
        'The network does not move a 2 MB photo as one lump. The phone cuts it into **packets**. A packet is a small envelope: a header with the source and destination addresses, followed by a slice of the data.',
        'A typical packet carries at most about 1,500 bytes. So the 2 MB photo becomes roughly **1,400 packets**, each sent on its own.',
        'Small packets let millions of conversations share the same cables, taking turns. They also keep mistakes cheap. If one packet is lost, only 1,500 bytes need to travel again. With a loss of 1 in 100, about 14 of our 1,400 packets will go missing.',
      ],
      keyIdea: 'Big data is cut into packets of about 1,500 bytes. Each packet is addressed and delivered on its own.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [{ ...phone, status: 'active', badge: '2 MB = 1,400 packets' }, server],
        links: directLinks,
        flows: [
          { path: ['phone', 'server'], tone: 'data', label: '#1', duration: 1.6 },
          { path: ['phone', 'server'], tone: 'data', label: '#2', duration: 1.6, delay: 0.5 },
          { path: ['phone', 'server'], tone: 'data', label: '#3', duration: 1.6, delay: 1 },
          { path: ['phone', 'server'], tone: 'data', label: '#4', duration: 1.6, delay: 1.5 },
        ],
        caption: 'One photo, many small envelopes',
      },
    },
    {
      title: 'Routers',
      tag: 'concept',
      heading: 'Routers pass each packet one hop closer',
      eli5: 'A sorting office does not know the whole road to your friend. It only knows which office to pass the envelope to next. Each **router** is a sorting office that passes packets along.',
      body: [
        'No machine knows the full path to the server. Each **router** on the way reads the destination address, looks in its table, and forwards the packet to a neighbor that is closer. One such step is a **hop**.',
        'Routers decide packet by packet. If a link is busy or broken, later packets may go another way, which is one reason packets can arrive out of order. If a router is overloaded, it drops packets and tells nobody.',
        'Distance costs time. A packet from the phone to this server and back takes about 100 ms. That there-and-back time is the **round trip time**, or RTT, and later lessons count almost everything in round trips.',
      ],
      keyIdea: 'Routers forward packets hop by hop with no guarantee. Packets can take different paths, arrive out of order, or be dropped.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [phone, { ...r1, status: 'active' }, r2, { ...r3, status: 'hot', badge: 'full, drops #3' }, r4, server],
        links: routerLinks,
        flows: [
          { path: ['phone', 'r1', 'r2', 'r4', 'server'], tone: 'data', label: '#1', duration: 2.6 },
          { path: ['phone', 'r1', 'r2', 'r4', 'server'], tone: 'data', label: '#2', duration: 2.6, delay: 0.8 },
          { path: ['phone', 'r1', 'r3'], tone: 'error', label: '#3 dropped', duration: 1.6, delay: 1.6 },
        ],
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
        'The address `203.0.113.10` gets a packet to the right machine. That machine runs several programs: a web server, a database, a remote login service. The **port** number says which program gets the packet.',
        'A port is a number from 0 to 65,535. Servers listen on well-known ports so clients know where to knock: `443` for HTTPS, `80` for HTTP, `22` for SSH, `53` for DNS, `5432` for Postgres.',
        'The client side has a port too. The phone\'s operating system picks a free one at random, say `51514`, so replies find their way back to the right app. A conversation is identified by all four values: source address, source port, destination address, destination port. That is how one web server on port 443 holds thousands of conversations at once.',
      ],
      keyIdea: 'IP address picks the machine, port picks the program. Written together: `203.0.113.10:443`.',
      metrics: { packets: '1,400', lost: '14' },
      scene: {
        nodes: [
          { ...phone, badge: 'from port 51514' },
          { ...web, status: 'active', badge: 'listening' },
          { ...ssh, status: 'dim' },
          { ...pg, status: 'dim' },
        ],
        links: [{ from: 'phone', to: 'web' }],
        zones: [{ id: 'machine', from: [0, -2], to: [6.4, 0], label: 'one machine: 203.0.113.10', tone: 'blue' }],
        flows: [
          { path: ['phone', 'web'], tone: 'request', label: 'to 203.0.113.10:443', duration: 1.8 },
          { path: ['web', 'phone'], tone: 'response', label: 'to 198.51.100.7:51514', duration: 1.8, delay: 2 },
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
      title: 'TCP handshake',
      tag: 'concept',
      heading: 'TCP starts with a three-step handshake',
      eli5: 'Before mailing the poster, the phone sends a note: "ready?" The server answers "ready, and you?" and the phone replies "ready". That short hello is the **TCP handshake**.',
      body: [
        '**TCP** (Transmission Control Protocol) is the careful delivery style. Before any data moves, the two sides open a **connection** with three small packets.',
        'The phone sends `SYN` ("I want to talk, my packet numbers start at 1000"). The server replies `SYN-ACK` ("got it, mine start at 5000"). The phone answers `ACK`. Both sides now know the other is alive and listening, and each knows the other\'s starting number.',
        'That handshake costs **one round trip**, 100 ms on this path, before the first byte of the photo can leave. For a long upload that is nothing. For a tiny question and answer, the hello takes longer than the conversation.',
      ],
      keyIdea: 'A TCP connection costs one round trip to set up: SYN, SYN-ACK, ACK. After that, both sides are ready to track every byte.',
      metrics: { packets: '1,400', lost: '14', setup: '100 ms' },
      scene: {
        nodes: [{ ...phone, status: 'active' }, { ...server, status: 'active', badge: 'port 443' }],
        links: directLinks,
        flows: [
          { path: ['phone', 'server'], tone: 'handshake', label: 'SYN', duration: 1.1 },
          { path: ['server', 'phone'], tone: 'handshake', label: 'SYN-ACK', duration: 1.1, delay: 1.2 },
          { path: ['phone', 'server'], tone: 'handshake', label: 'ACK', duration: 1.1, delay: 2.4 },
          { path: ['phone', 'server'], tone: 'data', label: 'photo bytes', count: 3, duration: 1.1, delay: 3.6 },
        ],
        caption: 'Hello first, data after',
      },
    },
    {
      title: 'TCP reliability',
      tag: 'concept',
      heading: 'Numbered, acknowledged, resent',
      eli5: 'The server signs for every numbered envelope it gets. If no signature comes back for number 3, the phone mails number 3 again. That is how **TCP** gets the whole poster there, in order.',
      body: [
        'TCP numbers every byte it sends. The receiver replies with **acknowledgments** (ACKs) that say "I have everything up to here". If an ACK does not come back in time, the sender **retransmits** the missing packet.',
        'The receiver uses the numbers to put packets back in order and throw away duplicates. The program reading from the connection sees a clean stream of bytes, exactly as sent. Our 14 lost packets are sent again and the server gets all 1,400.',
        'TCP also watches how fast ACKs return and slows down when the network is congested. The cost of all this care is waiting. When packet 3 is lost, packets 4 and 5 sit in a buffer until 3 arrives again. This is called **head-of-line blocking**.',
      ],
      keyIdea: 'TCP turns an unreliable network into a reliable, ordered stream of bytes. It pays for that with setup time and with waiting when a packet is lost.',
      metrics: { packets: '1,400 + 14 resent', lost: '14', setup: '100 ms', delivered: '100%, in order' },
      scene: {
        nodes: [phone, r1, r2, { ...r3, status: 'hot', badge: 'dropped #3' }, r4, { ...server, status: 'ok', badge: 'has #1 #2, waits for #3' }],
        links: routerLinks,
        flows: [
          { path: ['phone', 'r1', 'r3'], tone: 'error', label: '#3 lost', duration: 1.4 },
          { path: ['server', 'r4', 'r2', 'r1', 'phone'], tone: 'handshake', label: 'ACK up to #2', duration: 2.2, delay: 1.5 },
          { path: ['phone', 'r1', 'r2', 'r4', 'server'], tone: 'data', label: '#3 again', duration: 2.2, delay: 3.9 },
        ],
        caption: 'No acknowledgment, so send it again',
      },
      code: {
        language: 'python',
        title: 'TCP from a program: connect, then a stream of bytes',
        source: `import socket

# Opening the connection performs the handshake: SYN, SYN-ACK, ACK.
conn = socket.create_connection(("203.0.113.10", 443))

# Hand over all 2 MB. The operating system cuts it into packets,
# numbers them, waits for ACKs and resends whatever gets lost.
conn.sendall(photo_bytes)

# Bytes come back complete and in order, or the call fails with an error.
reply = conn.recv(1024)
conn.close()`,
        highlight: [4, 8],
      },
    },
    {
      title: 'UDP',
      tag: 'concept',
      heading: 'UDP sends and moves on',
      eli5: 'A postcard needs no hello and no signature. You drop it in the box and walk away. **UDP** sends packets like postcards: quick, and if one is lost the phone never hears about it.',
      body: [
        '**UDP** (User Datagram Protocol) is the quick delivery style. It adds a port number and a simple error check to a packet and sends it. There is no handshake, no numbering, no acknowledgment and no resend.',
        'Each UDP message, called a **datagram**, stands alone. It may arrive, arrive twice, arrive out of order or vanish. The sender is not told. If the application cares, it has to notice and react itself.',
        'What you get in return is speed and control. Setup wait is zero: the first packet already carries data. Nothing ever waits behind a lost packet. The header is 8 bytes, against at least 20 for TCP. Send our 1,400 packets this way and about 1,386 arrive, right away.',
      ],
      keyIdea: 'UDP is a thin layer over raw packets: ports and nothing else. No waiting, no guarantees.',
      metrics: { packets: '1,400', lost: '14', setup: '0 ms', delivered: '99%, any order' },
      scene: {
        nodes: [{ ...phone, status: 'active' }, { ...server, badge: 'port 9000' }],
        links: directLinks,
        flows: [
          { path: ['phone', 'server'], tone: 'data', label: '#1', duration: 1.4 },
          { path: ['phone', 'server'], tone: 'data', label: '#2', duration: 1.4, delay: 0.4 },
          { path: ['phone', 'server'], tone: 'error', label: '#3 lost, nobody told', duration: 0.8, delay: 0.8 },
          { path: ['phone', 'server'], tone: 'data', label: '#4', duration: 1.4, delay: 1.2 },
        ],
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
      title: 'Which one',
      tag: 'tradeoff',
      heading: 'TCP when every byte matters, UDP when time matters',
      eli5: 'A birthday poster must arrive whole, so you use signed mail, **TCP**. For a quick "I am here" wave each second, a postcard is fine. If one is lost, the next one comes soon. That is **UDP**.',
      body: [
        'Use **TCP** when a missing byte would break the result: web pages, API calls, database queries, file uploads, email. A photo with a hole in it is useless, and a 100 ms handshake is a fair price.',
        'Use **UDP** when late data is worthless. In a voice call, a packet that arrives 300 ms late is no good to anyone, so it is better to skip it than to pause the call and wait. Games send a player\'s position many times a second and the next update replaces a lost one.',
        'UDP also fits tiny question-and-answer exchanges, such as a DNS lookup, where a handshake would cost more than the question. And it is the base for newer protocols that build their own reliability on top. HTTP/3 does this through a protocol called QUIC, which you will meet in the next lesson.',
      ],
      keyIdea: 'TCP: complete and ordered, at the cost of waiting. UDP: immediate, at the cost of gaps. Pick by asking what a lost packet does to your user.',
      metrics: { packets: '1,400', lost: '14', setup: 'TCP 100 ms, UDP 0', delivered: 'TCP 100%, UDP 99%' },
      scene: {
        nodes: [
          { ...phone, badge: 'upload + voice call' },
          { ...web, label: 'photo upload', sub: 'TCP port 443', status: 'ok', badge: 'all 1,400 arrive' },
          { ...ssh, label: 'voice call', sub: 'UDP port 9000', status: 'active', badge: 'no pauses' },
        ],
        links: [
          { from: 'phone', to: 'web' },
          { from: 'phone', to: 'ssh' },
        ],
        flows: [
          { path: ['phone', 'web'], tone: 'data', label: 'TCP: every byte', count: 3, duration: 1.8 },
          { path: ['web', 'phone'], tone: 'handshake', label: 'ACK', duration: 1.8, delay: 2 },
          { path: ['phone', 'ssh'], tone: 'event', label: 'UDP: voice', count: 5, duration: 1.2, delay: 0.3 },
        ],
        caption: 'Same phone, same server, two delivery styles',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Address, port, packet, and a delivery style',
      eli5: 'The **phone** cuts the poster into envelopes, writes the address and apartment number of the **server** on each, and the **routers** pass them along. Signed mail is slow and sure. Postcards are fast and may get lost.',
      body: [
        'An **IP address** names a machine and a **port** names a program on it. Data is cut into **packets** of about 1,500 bytes, and **routers** forward each one hop by hop with no guarantee. A there-and-back trip is one **round trip**, 100 ms in our example.',
        '**TCP** spends one round trip on a handshake, then numbers, acknowledges and resends so the receiver gets every byte in order. **UDP** skips all of that: no setup, no receipts, no waiting.',
        'From here on, when a lesson says "the client opens a connection", picture the handshake. When it counts round trips, picture those packets crossing the routers and coming back.',
      ],
      keyIdea: 'IP finds the machine, the port finds the program, TCP makes delivery reliable, UDP makes it immediate.',
      metrics: { packets: '1,400', lost: '14', setup: 'TCP 100 ms, UDP 0', delivered: 'TCP 100%, UDP 99%' },
      scene: {
        nodes: [phone, r1, r2, r3, r4, { ...server, status: 'ok' }],
        links: routerLinks,
        flows: [
          { path: ['phone', 'r1', 'r2', 'r4', 'server'], tone: 'data', count: 3, duration: 2.4 },
          { path: ['server', 'r4', 'r3', 'r1', 'phone'], tone: 'handshake', label: 'ACK', duration: 2.4, delay: 2.6 },
        ],
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
