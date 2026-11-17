import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const laptop: SceneNode = { id: 'laptop', kind: 'client', at: at(-4.6, 0), label: 'browser', sub: 'shopper' };
const net: SceneNode = { id: 'net', kind: 'internet', at: at(-1.4, -3), label: 'internet', sub: 'untrusted hops' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(1.8, 0), label: 'app server', sub: 'shop.example' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4.8, 3), label: 'database', sub: '2M customers' };
const kms: SceneNode = { id: 'kms', kind: 'block', at: at(1.8, 3.6), label: 'KMS', sub: 'holds master key', icon: 'KeyRound', tint: 'violet' };
const vault: SceneNode = { id: 'vault', kind: 'block', at: at(1.8, 3.6), label: 'secrets manager', icon: 'Shield', tint: 'teal' };
const repo: SceneNode = { id: 'repo', kind: 'block', at: at(-4.6, 3.4), label: 'git repo', sub: '40 engineers', icon: 'FileCode', tint: 'gray' };
const interCa: SceneNode = { id: 'interCa', kind: 'block', at: at(1.8, 3.4), label: 'intermediate CA', sub: 'signs leaf certs', icon: 'Shield', tint: 'blue' };
const rootCa: SceneNode = { id: 'rootCa', kind: 'block', at: at(-3.6, 3.4), label: 'root CA', sub: 'in the trust store', icon: 'Key', tint: 'violet' };
const hasher: SceneNode = { id: 'hasher', kind: 'block', at: at(1.8, 3.6), label: 'hash function', sub: 'one way', icon: 'Hash', tint: 'amber' };
const aes: SceneNode = { id: 'aes', kind: 'block', at: at(-1.4, 3), label: 'AES-256-GCM', sub: 'fast, one shared key', icon: 'Binary', tint: 'green' };
const rsa: SceneNode = { id: 'rsa', kind: 'block', at: at(-1.4, 3), label: 'key pair', sub: 'public + private', icon: 'KeyRound', tint: 'violet' };

/** Lay a step's nodes out as one evenly spaced row across the screen. */
const row = (ns: SceneNode[]): SceneNode[] =>
  ns.map((n, i) => ({ ...n, at: at((i - (ns.length - 1) / 2) * 4.4, 0) }));

export const encryption: Lesson = {
  id: 'encryption',
  title: 'Encryption, PKI and secrets',
  tagline: 'Protect data on the wire and on disk, prove a server is who it claims to be, and keep the keys out of your code.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Hashing versus encryption, and how to store passwords',
    'Symmetric versus asymmetric encryption, signatures, and why real systems use both',
    'Encryption in transit with TLS, forward secrecy and mutual TLS',
    'Certificates, certificate authorities, the chain of trust and revocation',
    'Certificate expiry and automated rotation',
    'Encryption at rest, field encryption, envelope encryption and a key management service',
    'Keeping secrets out of code with a secrets manager, rotation and scanning',
  ],
  metrics: [
    { key: 'wire', label: 'On the wire', icon: 'Wifi' },
    { key: 'disk', label: 'On disk', icon: 'HardDrive' },
    { key: 'cert', label: 'Cert days left', icon: 'Clock' },
    { key: 'secrets', label: 'Secrets live in', icon: 'KeyRound' },
  ],
  steps: [
    {
      title: 'Plaintext',
      tag: 'problem',
      heading: 'Everything is readable to whoever touches it',
      eli5: 'You send your secrets on postcards. Every **mail carrier** on the way can read them, and the copies kept at the post office sit in an open drawer.',
      body: [
        'The shop sends logins over plain HTTP and stores 2 million customer records unencrypted. A request crosses coffee shop Wi-Fi, an ISP and routers you do not control. Any of them can read the password or change the reply.',
        'A stolen backup hands over every record, and the database password sits in git for 40 engineers to see. Three gaps: data **in transit**, data **at rest** and the **secrets** that open everything.',
      ],
      keyIdea: 'Assume the network and the storage will be seen by someone else. Design so that what they see is useless.',
      metrics: { wire: 'plaintext', disk: 'plaintext', cert: 'none', secrets: 'git' },
      metricTones: { wire: 'bad', disk: 'bad', secrets: 'bad' },
      scene: {
        nodes: row([
          { ...laptop, chips: [{ text: 'password=hunter2', tone: 'bad' }] },
          { ...net, status: 'hot', badge: 'can read and edit' },
          app,
          { ...db, status: 'hot', badge: 'plaintext backup' },
        ]),
        links: [link('laptop', 'net', { label: 'HTTP, no lock', labelTone: 'warn' }), link('net', 'app'), link('app', 'db')],
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'error', label: 'password=hunter2', duration: 2 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT', duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'What an eavesdropper can do',
          icon: 'Search',
          rows: [
            { text: 'Read the traffic', value: 'confidentiality lost', tone: 'bad' },
            { text: 'Change the reply', value: 'integrity lost', tone: 'bad' },
            { text: 'Pose as the shop', value: 'authenticity lost', tone: 'bad' },
          ],
          footer: { text: 'Encryption must give all three back', tone: 'warn' },
        },
        caption: 'Readable on every hop and on every disk',
      },
    },
    {
      title: 'Hashing',
      tag: 'concept',
      heading: 'Hashing is one way, so it is the tool for passwords',
      eli5: 'A **mixing machine** turns any recipe into a smoothie. You can check two smoothies match, but nobody can turn a smoothie back into the recipe.',
      body: [
        'A **hash** such as SHA-256 turns any input into a fixed fingerprint. The same input always gives the same output, and nobody can run it backwards. That makes it a fingerprint for integrity checks, and a poor fit when you need the data back.',
        'Never store passwords encrypted or in plain SHA-256. Use a slow, salted hash such as **argon2** or **bcrypt**. A random per-user **salt** makes equal passwords hash differently, and the slowness makes each guess cost the attacker real time.',
      ],
      keyIdea: 'Encryption can be reversed with a key. A hash cannot. Store passwords as slow salted hashes, never as reversible data.',
      metrics: { wire: 'plaintext', disk: 'passwords hashed', cert: 'none', secrets: 'git' },
      metricTones: { disk: 'good' },
      scene: {
        nodes: row([
          { ...app, chips: ['hunter2 + salt'] },
          { ...hasher, status: 'active', badge: 'argon2id' },
          { ...db, badge: 'stores the hash only' },
        ]),
        links: [link('app', 'hasher'), link('hasher', 'db')],
        flows: [
          { path: ['app', 'hasher'], tone: 'request', label: 'hunter2 + salt', duration: 1.2 },
          { path: ['hasher', 'db'], tone: 'data', label: '$argon2id$v=19$...', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Hash or encrypt?',
          icon: 'Scale',
          rows: [
            { text: 'Passwords', value: 'slow salted hash', tone: 'good' },
            { text: 'File integrity', value: 'SHA-256 digest' },
            { text: 'Card number you must read back', value: 'encrypt', tone: 'warn' },
            { text: 'Password in plain SHA-256', value: 'cracked fast', tone: 'bad' },
          ],
        },
        caption: 'The database never holds the password itself',
      },
    },
    {
      title: 'Symmetric',
      tag: 'concept',
      heading: 'Symmetric encryption: one key locks and unlocks',
      eli5: 'You and grandma each have a copy of the same key. You lock the box, the **mail carrier** cannot open it, grandma unlocks it.',
      body: [
        '**Symmetric** encryption uses the same secret key to encrypt and decrypt. The standard choice is **AES** with a 256-bit key. Modern CPUs have AES instructions built in, so one core encrypts on the order of gigabytes per second.',
        'Encrypting all your traffic and all your disks costs very little. That speed is why it does the bulk work in every real system.',
      ],
      keyIdea: 'Symmetric encryption is fast and strong, but both sides must hold the same key.',
      metrics: { wire: 'AES, if keys shared', disk: 'plaintext', cert: 'none', secrets: 'git' },
      scene: {
        nodes: row([{ ...laptop, badge: 'key K' }, { ...aes, status: 'active' }, { ...app, badge: 'key K' }]),
        links: [link('laptop', 'aes'), link('aes', 'app')],
        flows: [
          { path: ['laptop', 'aes', 'app'], tone: 'data', label: '9f a3 1c 77 ...', duration: 2 },
          { path: ['app', 'aes', 'laptop'], tone: 'data', label: 'c4 02 be ...', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'AES-256',
          icon: 'Binary',
          rows: [
            { text: 'Key size', value: '256 bits' },
            { text: 'Speed on one core', value: 'GB per second', tone: 'good' },
            { text: 'Keys needed', value: 'same on both ends', tone: 'warn' },
          ],
        },
        caption: 'Same key on both ends',
      },
    },
    {
      title: 'Auth modes',
      tag: 'concept',
      heading: 'Authenticated encryption detects tampering',
      eli5: 'The box has a wax seal that only matches its own lock. If the **mail carrier** changes anything inside, the seal breaks and grandma refuses the box.',
      body: [
        'Plain encryption hides data but does not stop edits. Use an authenticated mode such as **GCM**. It adds a tag to the ciphertext, and changing one bit makes decryption fail instead of returning garbage.',
        'GCM needs a unique **nonce** (a number used once) for every message under one key. Reusing a nonce under one key leaks plaintext relationships and lets attackers forge tags, so generate it randomly or with a counter, and store it beside the ciphertext.',
      ],
      keyIdea: 'Always use authenticated encryption, and never reuse a nonce with the same key.',
      metrics: { wire: 'AES-GCM, if keys shared', disk: 'plaintext', cert: 'none', secrets: 'git' },
      scene: {
        nodes: row([{ ...laptop, chips: ['nonce 12 bytes'] }, { ...net, status: 'hot', badge: 'flips one bit' }, { ...app, status: 'ok', badge: 'tag check fails' }]),
        links: [link('laptop', 'net'), link('net', 'app')],
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'ciphertext + tag', duration: 1.8 },
          { path: ['app', 'laptop'], tone: 'error', label: 'rejected, not decrypted', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'AES-GCM message',
          icon: 'Table',
          rows: [
            { text: 'nonce', value: '12 bytes, unique', tone: 'warn' },
            { text: 'ciphertext', value: 'same length as data' },
            { text: 'auth tag', value: '16 bytes', tone: 'good' },
          ],
          footer: { text: 'Nonce reuse breaks secrecy and forgery protection', tone: 'bad' },
        },
        caption: 'A changed bit means a rejected message',
      },
    },
    {
      title: 'Key sharing',
      tag: 'concept',
      heading: 'The catch: how do both sides get the key?',
      eli5: 'Grandma lives across the sea. Mailing her the key on a postcard defeats the point, because the **mail carrier** could copy it on the way.',
      body: [
        'Both sides need the same key, and you cannot send it over the network you are trying to protect. Anyone listening would copy it and read everything after.',
        'A browser that has never spoken to your server shares no secret with it. Before any encrypted traffic can start, the two need a way to agree on a key in the open.',
      ],
      keyIdea: 'Symmetric encryption has a bootstrap problem: the key itself has to travel somewhere safe.',
      metrics: { wire: 'no shared key yet', disk: 'plaintext', cert: 'none', secrets: 'git' },
      metricTones: { wire: 'warn' },
      scene: {
        nodes: row([{ ...laptop, badge: 'no key yet' }, { ...net, status: 'hot', badge: 'copies the key' }, { ...app, badge: 'no key yet' }]),
        links: [link('laptop', 'net', { label: 'public network', labelTone: 'warn' }), link('net', 'app')],
        flows: [{ path: ['app', 'net', 'laptop'], tone: 'error', label: 'here is key K', duration: 2 }],
        panel: {
          title: 'Sending the key in the open',
          icon: 'Cable',
          rows: [
            { text: 'Server sends K', value: 'visible to all', tone: 'bad' },
            { text: 'Attacker copies K', value: 'decrypts everything', tone: 'bad' },
            { text: 'Need', value: 'agree a key without sending it', tone: 'warn' },
          ],
        },
        caption: 'The key cannot cross the wire in the clear',
      },
    },
    {
      title: 'Asymmetric',
      tag: 'concept',
      heading: 'Asymmetric encryption: a public key and a private key',
      eli5: 'Grandma hands out open padlocks to everyone. Anyone can snap one shut on a box, but only grandma has the key that opens them.',
      body: [
        '**Asymmetric** cryptography uses a key pair. The **public key** can be published to the world. The **private key** never leaves its owner. What one key does, only the other can undo.',
        'Anyone encrypts with the public key, and only the private key decrypts. The math (RSA, elliptic curves) is orders of magnitude slower than AES and limited to small inputs, so it is not used for bulk data.',
      ],
      keyIdea: 'A public key can be handed to anyone. Only the matching private key can read what it locks.',
      metrics: { wire: 'public key published', disk: 'plaintext', cert: 'none', secrets: 'git' },
      scene: {
        nodes: row([{ ...laptop, badge: 'has public key' }, { ...rsa, status: 'active' }, { ...app, badge: 'private key stays here' }]),
        links: [link('laptop', 'rsa'), link('rsa', 'app')],
        flows: [
          { path: ['app', 'rsa', 'laptop'], tone: 'handshake', label: 'public key', duration: 1.8 },
          { path: ['laptop', 'rsa', 'app'], tone: 'data', label: 'locked with public key', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Key pair',
          icon: 'KeyRound',
          rows: [
            { text: 'Public key', value: 'share freely', tone: 'good' },
            { text: 'Private key', value: 'never leaves owner', tone: 'warn' },
            { text: 'Speed vs AES', value: 'much slower', tone: 'bad' },
          ],
        },
        caption: 'Anyone can lock, only the owner can unlock',
      },
    },
    {
      title: 'Signatures',
      tag: 'concept',
      heading: 'Signatures run the same pair in reverse',
      eli5: 'Grandma stamps each letter with a seal only she owns. Everyone knows what her seal looks like, so a matching stamp proves the letter is hers and untouched.',
      body: [
        'The owner **signs** a message with the private key. Anyone verifies it with the public key. A valid signature proves the message came from the key holder and was not changed since.',
        'The same idea covers a **JWT** (a signed token), a webhook **HMAC** (a shared-secret signature on a request body) and code signing. This is what a certificate and a TLS handshake rely on. The server signs with its private key to prove it is the real owner of the matching public key.',
      ],
      keyIdea: 'Encryption keeps a secret. A signature proves who wrote something and that it was not altered.',
      metrics: { wire: 'identity provable', disk: 'plaintext', cert: 'none', secrets: 'git' },
      scene: {
        nodes: row([{ ...app, status: 'active', badge: 'signs with private key' }, rsa, { ...laptop, badge: 'verifies with public key' }]),
        links: [link('app', 'rsa'), link('rsa', 'laptop')],
        flows: [
          { path: ['app', 'rsa', 'laptop'], tone: 'handshake', label: 'message + signature', duration: 2 },
          { path: ['laptop', 'app'], tone: 'response', label: 'signature valid', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Two uses of one key pair',
          icon: 'Scale',
          rows: [
            { text: 'Encrypt', value: 'public in, private out' },
            { text: 'Sign', value: 'private in, public out' },
            { text: 'Valid signature', value: 'author known, text intact', tone: 'good' },
          ],
        },
        caption: 'Only the key holder can produce the signature',
      },
    },
    {
      title: 'Hybrid',
      tag: 'concept',
      heading: 'Use asymmetric briefly, then switch to AES',
      eli5: 'Grandma\'s padlock is slow to use, so you use it once to pass over a tiny secret key. After that, you both use the quick everyday key for all your boxes.',
      body: [
        'Real protocols are **hybrid**. Use asymmetric crypto for a short moment to agree on a fresh symmetric key and to prove identity. Then switch to AES for the data.',
        'That gives the introduction that symmetric keys lack and the speed that asymmetric keys lack. Every HTTPS connection does this.',
        'In **key agreement** (Diffie-Hellman) each side sends a public share and both derive the same secret. An eavesdropper sees both shares and cannot. Locking a key with an RSA public key has no forward secrecy.',
      ],
      keyIdea: 'Asymmetric keys solve the introduction. Symmetric keys do the bulk work. Real systems use both.',
      metrics: { wire: 'hybrid', disk: 'plaintext', cert: 'none', secrets: 'git' },
      metricTones: { wire: 'good' },
      scene: {
        nodes: row([laptop, { ...net, badge: 'sees noise' }, { ...app, status: 'active' }]),
        links: [link('laptop', 'net'), link('net', 'app')],
        flows: [
          { path: ['app', 'net', 'laptop'], tone: 'handshake', label: 'key share', duration: 1.6 },
          { path: ['laptop', 'net', 'app'], tone: 'handshake', label: 'key share', duration: 1.6, delay: 1.8 },
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'AES data', count: 3, duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'Layers',
          rows: [
            { text: 'Asymmetric', value: 'agree a key, prove identity' },
            { text: 'Key agreement', value: 'both derive one secret, never sent', tone: 'good' },
            { text: 'RSA key transport', value: 'no forward secrecy', tone: 'bad' },
            { text: 'Symmetric', value: 'encrypt all the data', tone: 'good' },
            { text: 'Handshake cost', value: 'about 1 round trip' },
          ],
        },
        caption: 'Slow math to agree a key, fast math for the data',
      },
      quiz: {
        question: 'Why do real protocols such as TLS combine asymmetric and symmetric encryption?',
        options: [
          'Asymmetric keys are faster, so they carry the data',
          'Asymmetric crypto solves the key introduction but is slow, so it only sets up a fresh symmetric key that carries the data',
          'Symmetric keys can be published safely',
          'Two encryption layers make the data twice as hard to hash',
        ],
        answer: 1,
        explain: 'Asymmetric keys let two strangers agree on a secret and prove identity, but the math is slow. AES is fast but needs a shared key. TLS uses the first to create the second.',
      },
    },
    {
      title: 'TLS handshake',
      tag: 'concept',
      heading: 'In transit: the TLS 1.3 handshake',
      eli5: 'Before any letters are sent, you and the shop do a quick secret handshake through the **mail carrier** that ends with both of you holding the same new key. The carrier watched it all and still has no key.',
      body: [
        '**TLS** is what the "s" in HTTPS means. In TLS 1.3 the handshake takes one round trip. Client and server each send an ephemeral key share and derive the same **session keys** (a Diffie-Hellman exchange).',
        'The server also presents a certificate and signs the handshake with its private key to prove it is the real `shop.example`. After that every record is encrypted and authenticated with AES-GCM or ChaCha20-Poly1305.',
      ],
      keyIdea: 'TLS gives three things at once: privacy, tamper detection, and proof that the server is who its certificate says.',
      metrics: { wire: 'TLS 1.3', disk: 'plaintext', cert: '90', secrets: 'git' },
      metricTones: { wire: 'good' },
      scene: {
        nodes: row([laptop, { ...net, badge: 'sees only ciphertext' }, { ...app, status: 'ok', badge: 'cert: shop.example' }]),
        links: [link('laptop', 'net', { label: '1 round trip', arrow: 'both' }), link('net', 'app', { arrow: 'both' })],
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'handshake', label: 'ClientHello + key share', duration: 1.6 },
          { path: ['app', 'net', 'laptop'], tone: 'handshake', label: 'key share + certificate', duration: 1.6, delay: 1.8 },
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'encrypted HTTP', count: 3, duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'TLS 1.3 in one round trip',
          icon: 'Repeat',
          rows: [
            { text: 'Client sends', value: 'versions + key share' },
            { text: 'Server sends', value: 'key share + certificate' },
            { text: 'Server proves', value: 'signs the handshake', tone: 'good' },
            { text: 'Then', value: 'AES-GCM records', tone: 'good' },
          ],
        },
        caption: 'One round trip, then everything is encrypted',
      },
    },
    {
      title: 'Forward secrecy',
      tag: 'concept',
      heading: 'Forward secrecy: old traffic stays safe',
      eli5: 'Every visit uses a brand new key that is thrown away afterwards. If a thief steals the shop\'s master key next year, last year\'s sealed boxes still cannot be opened.',
      body: [
        'A router in the middle sees the server name, sizes and timing, and nothing else. An attacker may record encrypted traffic today and hope to steal the server\'s private key later.',
        'Because the ephemeral key shares are thrown away after the session, a stolen private key does not decrypt that recording. This property is **forward secrecy**, and TLS 1.3 requires it.',
      ],
      keyIdea: 'Fresh keys per session mean a future key theft cannot unlock past traffic.',
      metrics: { wire: 'TLS 1.3, forward secret', disk: 'plaintext', cert: '90', secrets: 'git' },
      metricTones: { wire: 'good' },
      scene: {
        nodes: [
          ...row([{ ...laptop, badge: 'session key gone' }, { ...net, label: 'recorder', sub: 'records ciphertext', chips: ['recording 10 TB'] }, { ...app, status: 'hot', badge: 'private key stolen' }]),
          { id: 'attacker', kind: 'user', at: at(0, 8.5), label: 'attacker', sub: 'holds stolen key', status: 'dim', chips: [{ text: 'stolen key', tone: 'bad' }] },
        ],
        links: [link('laptop', 'net'), link('net', 'app'), link('net', 'attacker', { style: 'dashed' })],
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'old session', duration: 1.8 },
          { path: ['net', 'attacker'], tone: 'error', label: 'decrypt recording with stolen key: fails', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Why the recording stays locked',
          icon: 'Shield',
          rows: [
            { text: 'Session key', value: 'derived, then erased', tone: 'good' },
            { text: 'Server private key', value: 'only signs, never encrypts', tone: 'good' },
            { text: 'Recorded traffic', value: 'still ciphertext', tone: 'good' },
          ],
        },
        caption: 'Stealing the key later does not reopen old sessions',
      },
    },
    {
      title: 'Internal hops',
      tag: 'concept',
      heading: 'Encrypt internal hops, and use mutual TLS',
      eli5: 'Do not stop locking boxes at the front door. The back rooms of the post office are shared too, and in **mutual** mode both the sender and the receiver show an ID card.',
      body: [
        'Do not stop at the edge. Traffic between services crosses shared networks as well. Encrypt those internal hops with TLS too. TLS usually **terminates** at the load balancer, so re-encrypt to backends. Add an HTTPS redirect and **HSTS**.',
        'In **mutual TLS** (mTLS) both sides present certificates, so each service proves who it is to the other. That lets a service reject any caller that cannot show a valid identity. Certificates come from a **private CA** or a mesh.',
      ],
      keyIdea: 'Inside the network is not safe by default. Encrypt every hop, and let services prove their identity with mTLS.',
      metrics: { wire: 'TLS everywhere', disk: 'plaintext', cert: '90', secrets: 'git' },
      metricTones: { wire: 'good' },
      scene: {
        nodes: row([
          { id: 'lb', kind: 'block', at: at(-3.6, 0), label: 'load balancer', icon: 'Split', tint: 'blue' },
          { id: 'orders', kind: 'block', at: at(0.6, -2.4), label: 'orders svc', icon: 'ShoppingBag', tint: 'amber', chips: ['cert: orders'] },
          { id: 'pay', kind: 'block', at: at(0.6, 2.4), label: 'payments svc', icon: 'Receipt', tint: 'green', chips: ['cert: payments'] },
        ]).concat([{ ...rootCa, id: 'pca', at: at(2.2, 6.5), label: 'private CA or mesh', sub: 'issues service certs' }]),
        links: [link('lb', 'orders', { label: 'TLS' }), link('orders', 'pay', { label: 'mutual TLS', arrow: 'both' }), link('pca', 'orders', { style: 'dashed', label: 'issues certs' }), link('pca', 'pay', { style: 'dashed' })],
        flows: [
          { path: ['lb', 'orders'], tone: 'data', label: 'TLS', duration: 1.2 },
          { path: ['orders', 'pay'], tone: 'handshake', label: 'cert both ways', duration: 1.4, delay: 1.3 },
          { path: ['pay', 'orders'], tone: 'handshake', label: 'cert both ways', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'One-way versus mutual',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'TLS', value: 'client checks server' },
            { text: 'mTLS', value: 'both check each other', tone: 'good' },
            { text: 'Termination', value: 'at LB, re-encrypt to backends', tone: 'good' },
            { text: 'Used for', value: 'service to service calls' },
          ],
        },
        caption: 'Every hop encrypted, every caller identified',
      },
    },
    {
      title: 'End-to-end encryption',
      tag: 'concept',
      heading: 'End-to-end: only the devices hold the keys',
      eli5: 'Two friends lock a box with a key only they own. The post office carries it and stores it, and cannot open it.',
      body: [
        'TLS and at-rest encryption stop at the server, which decrypts and can read the content. In **end-to-end encryption** (E2EE) the keys live only on the client devices, so the server relays and stores ciphertext it cannot read.',
        'Chat, video and file apps use it when the provider should not see content. The cost is that the server cannot search, scan or recover the data, and a lost device key means lost messages.',
      ],
      keyIdea: 'TLS protects the hop, at-rest encryption protects the disk, and E2EE keeps the server itself out of the plaintext.',
      metrics: { wire: 'TLS + end-to-end', disk: 'ciphertext only', cert: '67, auto', secrets: 'git' },
      metricTones: { wire: 'good', disk: 'good', cert: 'good' },
      scene: {
        nodes: row([{ ...laptop, id: 'alice', label: 'Alice', sub: 'holds key', badge: 'encrypts on device' }, { ...app, status: 'ok', badge: 'sees ciphertext only' }, { ...laptop, id: 'bob', label: 'Bob', sub: 'holds key', badge: 'decrypts on device' }]),
        links: [link('alice', 'app', { label: 'TLS' }), link('app', 'bob', { label: 'TLS' })],
        flows: [{ path: ['alice', 'app', 'bob'], tone: 'data', label: 'ciphertext', duration: 2 }],
        panel: {
          title: 'TLS, at rest and E2EE',
          icon: 'Layers',
          rows: [
            { text: 'TLS', value: 'server reads content' },
            { text: 'At rest', value: 'server reads content' },
            { text: 'End-to-end', value: 'server cannot read', tone: 'good' },
          ],
        },
        caption: 'The server relays what it cannot read',
      },
    },
    {
      title: 'Chain of trust',
      tag: 'concept',
      heading: 'Certificates: why the browser believes the public key',
      eli5: 'The shop shows an ID card. The card is stamped by an office, and that office\'s stamp is vouched for by the **head office** your family already trusts. You follow the stamps back until you reach one you know.',
      body: [
        'A public key alone proves nothing. Anyone on the path could send their own key and sit in the middle. A **certificate** binds a public key to a name (`shop.example`) and carries a signature from a **certificate authority** (CA) that checked you control that name.',
        'Browsers and operating systems ship with a **trust store** of about a hundred root CAs. Roots are kept offline and sign **intermediate** CAs, and intermediates sign your **leaf** certificate. The client walks the chain up to a root it already trusts.',
      ],
      keyIdea: 'A certificate is a signed claim that a public key belongs to a name. Trust flows down from a root the client already holds.',
      metrics: { wire: 'TLS 1.3', disk: 'plaintext', cert: '90', secrets: 'git' },
      scene: {
        nodes: row([
          { ...laptop, status: 'active', badge: 'verifies each signature' },
          { ...app, at: at(1.8, -1.2), sub: 'leaf cert', badge: 'shop.example' },
          { ...interCa, status: 'active' },
          { ...rootCa, status: 'ok' },
        ]),
        links: [
          link('laptop', 'app'),
          link('interCa', 'app', { label: 'signs' }),
          link('rootCa', 'interCa', { label: 'signs' }),
          link('laptop', 'rootCa', { style: 'dashed', label: 'trusts' }),
        ],
        flows: [
          { path: ['app', 'laptop'], tone: 'handshake', label: 'leaf + intermediate', duration: 1.6 },
          { path: ['rootCa', 'interCa'], tone: 'data', label: 'signature', duration: 1.2, delay: 1.8 },
          { path: ['interCa', 'app'], tone: 'data', label: 'signature', duration: 1.2, delay: 3.1 },
        ],
        panel: {
          title: 'The chain the client walks',
          icon: 'List',
          rows: [
            { text: 'Leaf', value: 'shop.example' },
            { text: 'Intermediate', value: 'signs the leaf' },
            { text: 'Root', value: 'already in trust store', tone: 'good' },
          ],
        },
        caption: 'Leaf, intermediate, root: every link is a signature',
      },
      quiz: {
        question: 'A browser connects to shop.example and receives a certificate. What makes it trust the public key inside?',
        options: [
          'The certificate is encrypted with the browser\'s own key',
          'The server says the key is valid',
          'A chain of signatures leads from the certificate to a root CA already in the browser\'s trust store, and the name and dates check out',
          'The connection uses port 443',
        ],
        answer: 2,
        explain: 'Trust comes from signatures. The leaf is signed by an intermediate, which is signed by a root the client shipped with. The client also checks the hostname, the validity window and revocation.',
      },
    },
    {
      title: 'Cert checks',
      tag: 'concept',
      heading: 'What the client checks, and how each fails',
      eli5: 'The guard checks the card for four things: the name is the shop\'s, today is inside the dates, the stamp chain is real, and the card was not cancelled. Any miss means no entry.',
      body: [
        'Beyond the signature chain, the client checks that the name matches, that today falls inside the validity dates and that the certificate has not been revoked. Any failed check is a hard error. This whole system of CAs, certificates and checks is the **public key infrastructure** (PKI).',
        'Each check has a visible symptom, which is how you diagnose a bad certificate from the browser error alone.',
      ],
      keyIdea: 'A certificate is accepted only when signature, name, dates and revocation status all pass.',
      metrics: { wire: 'TLS 1.3', disk: 'plaintext', cert: '90', secrets: 'git' },
      scene: {
        nodes: row([{ ...laptop, status: 'active', badge: 'runs 4 checks' }, { ...app, status: 'ok', badge: 'shop.example' }]),
        links: [link('laptop', 'app')],
        flows: [{ path: ['app', 'laptop'], tone: 'handshake', label: 'certificate', duration: 1.6 }],
        panel: {
          title: 'Check versus failure symptom',
          icon: 'List',
          rows: [
            { text: 'Name matches shop.example', value: 'mismatch: name error', tone: 'bad' },
            { text: 'Inside notBefore/notAfter', value: 'expired: date error', tone: 'bad' },
            { text: 'Chain to a trusted root', value: 'unknown issuer', tone: 'bad' },
            { text: 'Not revoked', value: 'revoked: hard block', tone: 'bad' },
          ],
          footer: { text: 'One fail aborts the connection', tone: 'warn' },
        },
        caption: 'Four checks, and any failure is a hard stop',
      },
    },
    {
      title: 'Cert expiry',
      tag: 'case',
      heading: 'Case: the certificate expired on Saturday night',
      eli5: 'The shop\'s ID card has a date on it. The day after that date, nobody will accept its parcels, even though nothing else changed.',
      body: [
        'Certificates expire on purpose. A short life limits how long a stolen key is useful. Public certificates commonly last 90 days or less.',
        'At 23:59 on Saturday the shop\'s certificate passes its end date. Nothing in your system changed, and every client now refuses to connect. Checkout is at 0% and dashboards that only watch CPU look calm. The fix takes minutes once someone finds it. Finding it takes an hour.',
      ],
      keyIdea: 'Expiry is a scheduled outage unless renewal is automatic and monitored.',
      metrics: { wire: 'handshake fails', disk: 'plaintext', cert: '0', secrets: 'git' },
      metricTones: { wire: 'bad', cert: 'bad' },
      scene: {
        nodes: row([{ ...laptop, status: 'hot', badge: 'certificate expired' }, net, { ...app, status: 'down', badge: 'notAfter: yesterday', load: 4 }]),
        links: [link('laptop', 'net'), link('net', 'app', { label: 'checkout 0%', labelTone: 'warn' })],
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'handshake', label: 'ClientHello', duration: 1.6 },
          { path: ['app', 'net', 'laptop'], tone: 'error', label: 'expired cert, abort', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Saturday 23:59',
          icon: 'Clock',
          rows: [
            { text: 'CPU on app server', value: '4%', tone: 'good' },
            { text: 'Successful handshakes', value: '0 per min', tone: 'bad' },
            { text: 'Time to find the cause', value: '1 hour', tone: 'warn' },
          ],
          footer: { text: 'Healthy servers, zero connections', tone: 'bad' },
        },
        caption: 'Healthy servers, zero successful connections',
      },
      code: {
        language: 'bash',
        title: 'Check and alert on days until expiry',
        source: `#!/usr/bin/env bash
host=shop.example

# Print the end date of the certificate the server is presenting now.
openssl s_client -connect "$host:443" -servername "$host" </dev/null 2>/dev/null \\
  | openssl x509 -noout -enddate
# notAfter=Feb 14 23:59:59 2027 GMT

# Exit non-zero if it expires within 21 days (1814400 seconds).
if ! openssl s_client -connect "$host:443" -servername "$host" </dev/null 2>/dev/null \\
  | openssl x509 -noout -checkend 1814400; then
  echo "ALERT: $host certificate expires in under 21 days" >&2
  exit 1
fi`,
        highlight: [5, 6, 11, 12],
      },
    },
    {
      title: 'Auto renewal',
      tag: 'tradeoff',
      heading: 'Automate rotation and alert on days left',
      eli5: 'A helper renews the ID card long before the date, every time, and rings a bell if renewing ever fails. Nobody relies on a sticky note reminder.',
      body: [
        'Treat rotation as automation, never as a calendar reminder. Use a protocol such as **ACME** or a managed certificate service to renew at about two thirds of the lifetime (30 days left on a 90 day certificate) and reload servers without downtime.',
        'Then alert on **days until expiry** for every endpoint, including internal ones. A broken renewal job is then noticed weeks ahead, not at midnight.',
      ],
      keyIdea: 'Renew at two thirds of the lifetime and alert on days left, so a failed job has weeks to be fixed.',
      metrics: { wire: 'TLS 1.3', disk: 'plaintext', cert: '30, then renews', secrets: 'git' },
      metricTones: { cert: 'good' },
      scene: {
        nodes: row([
          { id: 'acme', kind: 'block', at: at(-3.6, 0), label: 'ACME client', sub: 'renews at day 60', icon: 'Repeat', tint: 'green', status: 'active' },
          { ...interCa, at: at(0.4, -3), label: 'CA' },
          { ...app, at: at(3.6, 0), status: 'ok', badge: 'new cert, no downtime' },
        ]),
        links: [link('acme', 'interCa'), link('interCa', 'app', { label: 'new cert' })],
        flows: [
          { path: ['acme', 'interCa'], tone: 'request', label: 'renew shop.example', duration: 1.4 },
          { path: ['interCa', 'app'], tone: 'response', label: 'cert, 90 days', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Renewal timeline',
          icon: 'Timer',
          rows: [
            { text: 'Issued', value: 'day 0, 90 day life' },
            { text: 'Auto renew', value: 'day 60, 30 left', tone: 'good' },
            { text: 'Warn on call', value: '21 days left', tone: 'warn' },
            { text: 'Expires', value: 'day 90', tone: 'bad' },
          ],
        },
        caption: 'Renewal runs itself, the alert watches the runner',
      },
    },
    {
      title: 'Revocation',
      tag: 'concept',
      heading: 'Revocation: cancelling a certificate early',
      eli5: 'If the shop loses its ID card, the head office posts a "cancelled" list. Guards check the list, and short-dated cards mean a lost one stops working soon anyway.',
      body: [
        'If a private key leaks, the CA can **revoke** the certificate before it expires. Clients learn this from a **CRL** (a published list) or **OCSP** (ask the CA about one certificate). Both are slow and some clients skip the check when the CA is unreachable.',
        'That is why short lifetimes matter. A 90 day certificate that is never revoked still dies within 90 days, so automation plus short life limits the damage of a stolen key.',
      ],
      keyIdea: 'Revocation is unreliable in practice. Short-lived certificates are the dependable backstop.',
      metrics: { wire: 'TLS 1.3', disk: 'plaintext', cert: '90, short life', secrets: 'git' },
      scene: {
        nodes: row([{ ...laptop, status: 'active', badge: 'asks: still valid?' }, { ...interCa, at: at(1.8, -3), label: 'OCSP / CRL', sub: 'CA answers' }, { ...app, at: at(1.8, 2.6), status: 'hot', badge: 'key leaked' }]),
        links: [link('laptop', 'interCa', { label: 'OCSP check', arrow: 'both' }), link('laptop', 'app')],
        flows: [
          { path: ['laptop', 'interCa'], tone: 'request', label: 'serial 4f:22 ok?', duration: 1.4 },
          { path: ['interCa', 'laptop'], tone: 'error', label: 'revoked', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Revocation options',
          icon: 'List',
          rows: [
            { text: 'CRL', value: 'big list, cached, stale', tone: 'warn' },
            { text: 'OCSP', value: 'per cert, CA must be up', tone: 'warn' },
            { text: 'Short lifetime', value: 'self-limiting', tone: 'good' },
          ],
        },
        caption: 'Cancel early if you can, expire soon in any case',
      },
    },
    {
      title: 'At rest',
      tag: 'concept',
      heading: 'At rest: encrypt disks and backups',
      eli5: 'The post office now keeps its copies in a locked safe. A thief who carries off the safe gets a heavy box. But a clerk who is allowed to open the safe can still read everything inside.',
      body: [
        'With the wire covered, look at storage. **Encryption at rest** writes data as ciphertext: volumes, database files, object storage and backups, all with AES-256. Most managed databases and clouds offer it as a checkbox, with almost no performance cost.',
        'It protects against stolen drives, leaked snapshots and backups in the wrong place. It does **not** protect against an attacker who gets in through the application, because the database decrypts transparently for any query with valid credentials.',
      ],
      keyIdea: 'Disk encryption defends against lost media, and does nothing against a caller the database already trusts.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256', cert: '67, auto', secrets: 'git' },
      metricTones: { disk: 'good', cert: 'good' },
      scene: {
        nodes: row([{ ...app, status: 'active' }, { ...db, status: 'ok', badge: 'ciphertext on disk' }, { id: 'thief', kind: 'user', at: at(-1.6, 3.6), label: 'thief', sub: 'stolen backup', status: 'dim' }]),
        links: [link('app', 'db', { label: 'queries decrypt' }), link('thief', 'db', { style: 'dashed', label: 'steals disk' })],
        flows: [
          { path: ['app', 'db'], tone: 'data', label: 'card = 8b f1 04 ...', duration: 1.2 },
          { path: ['thief', 'db'], tone: 'error', label: 'only noise', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'What disk encryption stops',
          icon: 'HardDrive',
          rows: [
            { text: 'Stolen drive', value: 'stopped', tone: 'good' },
            { text: 'Leaked snapshot', value: 'stopped', tone: 'good' },
            { text: 'Hacked application', value: 'not stopped', tone: 'bad' },
          ],
        },
        caption: 'A stolen backup is now a pile of noise',
      },
    },
    {
      title: 'Field encryption',
      tag: 'concept',
      heading: 'Encrypt sensitive fields in the application',
      eli5: 'For the most precious items, the clerk puts them in a small locked tin before they go in the safe. Even a clerk with the safe key sees only a tin.',
      body: [
        'For the most sensitive fields (card numbers, government IDs, health data), add **application-level encryption**. The service encrypts the field before it writes it.',
        'A database dump or a curious administrator then sees ciphertext. The cost is that the database cannot search or sort on those fields, and this raises the next question: where does the key live? To look a value up anyway, store a keyed hash (a **blind index**) or a **token** in its place, so the card number itself is never stored.',
      ],
      keyIdea: 'Field encryption defends against a compromised database. It is useless if the key sits next to the data.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256 + fields', cert: '67, auto', secrets: 'git' },
      metricTones: { disk: 'good', cert: 'good' },
      scene: {
        nodes: row([{ ...laptop, chips: ['card 4242...'] }, { ...app, status: 'active', badge: 'encrypts card field' }, { ...db, status: 'ok', badge: 'ciphertext fields' }]),
        links: [link('laptop', 'app', { label: 'TLS' }), link('app', 'db')],
        flows: [
          { path: ['laptop', 'app'], tone: 'data', label: 'TLS', duration: 1.4 },
          { path: ['app', 'db'], tone: 'data', label: 'card = 8b f1 04 ...', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'A row in the database',
          icon: 'Table',
          rows: [
            { text: 'name', value: 'Asha Rao' },
            { text: 'email', value: 'asha@example.com' },
            { text: 'card', value: '8b f1 04 c9 ...', tone: 'good' },
            { text: 'card_idx', value: 'keyed hash, searchable' },
          ],
          footer: { text: 'Cannot query WHERE card = ...', tone: 'warn' },
        },
        caption: 'The database holds ciphertext it cannot read',
      },
    },
    {
      title: 'Envelope + KMS',
      tag: 'concept',
      heading: 'Envelope encryption: a key that protects keys',
      eli5: 'Each box gets its own little key. You lock that little key inside a tiny envelope using the **big key**, and the big key never leaves the post office strongroom. Tape the envelope to the box.',
      body: [
        'A **key management service** (KMS) holds a **master key** inside hardened hardware and never lets it out. You can only ask it to encrypt or decrypt small blobs, and every call is access-controlled and logged.',
        'Calling it for 2 million records would be slow and costly, so use **envelope encryption**. Ask the KMS for a fresh **data key**. It returns the key twice: in plaintext and wrapped under the master key. Encrypt locally, store the wrapped copy beside the ciphertext and wipe the plaintext key.',
      ],
      keyIdea: 'Encrypt data with a data key, encrypt the data key with a master key that never leaves the KMS, and store the wrapped key beside the data.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'git' },
      metricTones: { disk: 'good', cert: 'good' },
      scene: {
        nodes: row([{ ...app, status: 'active', badge: 'encrypts locally' }, { ...kms, status: 'ok', badge: 'master key never leaves' }, { ...db, badge: 'ciphertext + wrapped key' }]),
        links: [link('app', 'kms', { label: 'small blobs only' }), link('app', 'db')],
        flows: [
          { path: ['app', 'kms'], tone: 'request', label: 'GenerateDataKey', duration: 1 },
          { path: ['kms', 'app'], tone: 'response', label: 'key + wrapped key', duration: 1, delay: 1.1 },
          { path: ['app', 'db'], tone: 'data', label: 'ciphertext + wrapped key', duration: 1.2, delay: 2.3 },
        ],
        panel: {
          title: 'Two layers of keys',
          icon: 'Layers',
          rows: [
            { text: 'Data key', value: 'one per record or file' },
            { text: 'Master key', value: 'inside the KMS, never out', tone: 'good' },
            { text: 'Stored beside data', value: 'wrapped data key', tone: 'good' },
          ],
        },
        caption: 'The KMS handles 32 bytes, the app handles the gigabytes',
      },
    },
    {
      title: 'Envelope code',
      tag: 'concept',
      heading: 'Envelope encryption in code, and why it pays off',
      eli5: 'To read a box, you show the little envelope to the strongroom clerk, get the little key back, and open the box yourself. Changing the big key only means re-sealing the tiny envelopes.',
      body: [
        'To read, send the wrapped key to the KMS, get the data key back and decrypt locally. An attacker with the whole database has ciphertext and wrapped keys, and no way to unwrap them without KMS permission.',
        'Rotating the master key means re-wrapping small data keys, with no need to re-encrypt terabytes of data. KMS permissions deserve your tightest access rules.',
      ],
      keyIdea: 'Unwrapping needs KMS permission, and rotating the master key only touches the small wrapped keys.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'git' },
      metricTones: { disk: 'good', cert: 'good' },
      scene: {
        nodes: row([{ ...db, at: at(-3.8, 0), badge: 'wrapped key + ciphertext' }, { ...kms, at: at(0, -3.4), status: 'ok', badge: 'checks IAM, logs call' }, { ...app, at: at(3.8, 0), status: 'active', badge: 'decrypts locally' }]),
        links: [link('db', 'app'), link('app', 'kms', { arrow: 'both', label: 'Decrypt' })],
        flows: [
          { path: ['db', 'app'], tone: 'data', label: 'row + wrapped key', duration: 1.2 },
          { path: ['app', 'kms'], tone: 'request', label: 'Decrypt(wrapped)', duration: 1.1, delay: 1.3 },
          { path: ['kms', 'app'], tone: 'response', label: 'data key', duration: 1.1, delay: 2.5 },
        ],
        panel: {
          title: 'Rotate the master key',
          icon: 'Repeat',
          rows: [
            { text: 'Re-wrap data keys', value: 'bytes, fast', tone: 'good' },
            { text: 'Re-encrypt data', value: 'not needed', tone: 'good' },
            { text: 'Audit trail', value: 'every unwrap logged' },
          ],
        },
        caption: 'Read path: fetch, unwrap, decrypt',
      },
      code: {
        language: 'python',
        title: 'Envelope encryption with a KMS data key',
        source: `import os, boto3
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

kms = boto3.client("kms")
MASTER = "alias/customer-data"

def encrypt_record(plaintext: bytes, record_id: str) -> dict:
    dk = kms.generate_data_key(KeyId=MASTER, KeySpec="AES_256")
    nonce = os.urandom(12)                       # unique per encryption
    ct = AESGCM(dk["Plaintext"]).encrypt(nonce, plaintext, record_id.encode())
    return {
        "ciphertext": ct,
        "nonce": nonce,
        "wrapped_key": dk["CiphertextBlob"],     # safe to store beside the data
    }

def decrypt_record(row: dict, record_id: str) -> bytes:
    key = kms.decrypt(CiphertextBlob=row["wrapped_key"])["Plaintext"]
    return AESGCM(key).decrypt(row["nonce"], row["ciphertext"], record_id.encode())`,
        highlight: [8, 10, 14, 18],
      },
    },
    {
      title: 'Secrets',
      tag: 'concept',
      heading: 'Keep secrets out of code',
      eli5: 'Nobody writes the strongroom code on a sticky note by the door. It lives in a guarded **key cabinet**. Each worker gets only the key for their own job, and the cabinet writes down who took what.',
      body: [
        'The database password is still in `config.py` in git. Git history is forever: deleting the line leaves it in every old commit and every clone on 40 laptops. A secret that has been committed must be treated as leaked and **rotated**.',
        'Move secrets to a **secrets manager**. The app proves its identity with the platform (an instance or workload role, with no long-lived password of its own) and fetches the secret at startup or on demand over TLS. Access is per service, and every read is logged.',
      ],
      keyIdea: 'A secret belongs in one audited place, fetched at runtime by an identity with the narrowest access.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'secrets manager' },
      metricTones: { disk: 'good', cert: 'good', secrets: 'good' },
      scene: {
        nodes: row([
          { ...repo, status: 'dim', badge: 'no secrets, scanned' },
          { ...app, status: 'active', badge: 'role: orders-svc' },
          { ...vault, status: 'ok', badge: 'audited, per service' },
          { ...db, at: at(4.8, 0.4) },
        ]),
        links: [link('repo', 'app', { style: 'dashed', label: 'deploy' }), link('app', 'vault'), link('app', 'db')],
        flows: [
          { path: ['app', 'vault'], tone: 'request', label: 'get prod/orders/db', duration: 1 },
          { path: ['vault', 'app'], tone: 'response', label: 'password, 1 h lease', duration: 1, delay: 1.1 },
          { path: ['app', 'db'], tone: 'request', label: 'connect', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'Who can read what',
          icon: 'Shield',
          rows: [
            { text: 'orders-svc', value: 'prod/orders/db', tone: 'good' },
            { text: 'payments-svc', value: 'prod/payments/*' },
            { text: 'orders-svc to payments secret', value: 'denied', tone: 'bad' },
          ],
          footer: { text: 'Every read is logged', tone: 'muted' },
        },
        caption: 'Code ships without secrets and asks for them at runtime',
      },
      code: {
        language: 'python',
        title: 'Before and after: hardcoded versus fetched at runtime',
        source: `# Before: lives in git history forever, same value in every environment.
DB_PASSWORD = "s3cr3t-prod-2019"

# After: fetched at startup using the service's own role. No password in code.
import json, boto3

_secrets = boto3.client("secretsmanager")

def db_credentials():
    raw = _secrets.get_secret_value(SecretId="prod/orders/db")["SecretString"]
    return json.loads(raw)            # {"username": ..., "password": ...}

creds = db_credentials()
pool = connect(host="orders-db.internal", sslmode="verify-full",
               user=creds["username"], password=creds["password"])
# On an auth failure, call db_credentials() again: the secret may have rotated.`,
        highlight: [2, 10, 14, 16],
      },
    },
    {
      title: 'Rotate secrets',
      tag: 'tradeoff',
      heading: 'Rotate, shorten and scan for secrets',
      eli5: 'The cabinet changes the lock codes on a schedule and hands out keys that stop working after an hour. A guard at the door also checks every bag for sticky notes with codes.',
      body: [
        'The manager can **rotate** secrets on a schedule, or issue short-lived database credentials that expire in an hour, so a leaked one is soon useless.',
        'Add a secret scanner to CI and as a pre-commit hook to stop the next key before it lands in the repo. Never print secrets in logs or error messages.',
      ],
      keyIdea: 'Short-lived, rotated secrets limit a leak, and scanners stop most leaks before they happen.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'manager, 1 h leases' },
      metricTones: { disk: 'good', cert: 'good', secrets: 'good' },
      scene: {
        nodes: [
          { id: 'dev', kind: 'user', at: at(-4.4, 0), label: 'developer', sub: 'pushes code' },
          { id: 'scan', kind: 'block', at: at(0, 0), label: 'CI scanner', sub: 'pre-commit and CI', icon: 'Search', tint: 'amber', status: 'active', badge: 'blocks the push' },
          { ...repo, at: at(4.4, 0), status: 'ok', badge: 'stays clean' },
          { ...vault, at: at(-4.4, 8.5), status: 'ok', badge: 'rotates every 30 days' },
          { ...app, id: 'svc', at: at(0, 8.5), sub: 'short-lived creds' },
        ],
        links: [link('dev', 'scan', { label: 'git push' }), link('scan', 'repo', { label: 'clean only' }), link('vault', 'svc', { label: '1 h lease' })],
        flows: [
          { path: ['dev', 'scan'], tone: 'error', label: 'AKIA... blocked', duration: 1.4 },
          { path: ['vault', 'svc'], tone: 'response', label: 'new credential', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Leak response',
          icon: 'Bug',
          rows: [
            { text: 'Static password leaked', value: 'valid until rotated', tone: 'bad' },
            { text: '1 hour lease leaked', value: 'dead within 1 h', tone: 'good' },
            { text: 'Committed to git', value: 'treat as leaked', tone: 'warn' },
          ],
        },
        caption: 'A leaked secret should expire on its own',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Encrypt everywhere, and guard the keys harder than the data',
      eli5: 'Letters travel in locked boxes, the shop shows a stamped ID card that gets renewed on time, copies sit in a safe, and the keys live in a guarded **key cabinet** instead of on a sticky note.',
      body: [
        '**Symmetric** encryption (AES) is fast and needs a shared key. **Asymmetric** keys solve the introduction and give signatures. **TLS** combines them in one round trip, and a certificate chain to a trusted root proves identity. Certificates expire, so renew automatically and alert on days left.',
        '**At rest**, encrypt disks and sensitive fields, and use **envelope encryption** with a master key in the **KMS**. Hash passwords with argon2. Keep every secret in a **secrets manager**, scoped per service and rotated.',
      ],
      keyIdea: 'Encryption turns a data protection problem into a key management problem. Most real failures are lost, leaked or expired keys.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'secrets manager' },
      metricTones: { wire: 'good', disk: 'good', cert: 'good', secrets: 'good' },
      scene: {
        nodes: row([laptop, { ...app, status: 'ok' }, { ...db, status: 'ok', badge: 'ciphertext' }, { ...kms, status: 'ok' }]),
        links: [link('laptop', 'app', { label: 'TLS 1.3' }), link('app', 'kms'), link('app', 'db')],
        flows: [
          { path: ['laptop', 'app'], tone: 'data', label: 'TLS', count: 3, duration: 1.8 },
          { path: ['app', 'kms', 'app'], tone: 'request', label: 'unwrap key', duration: 1.4, delay: 1.9 },
          { path: ['app', 'db'], tone: 'data', label: 'encrypted rows', duration: 1, delay: 3.4 },
        ],
        panel: {
          title: 'Layers in place',
          icon: 'Layers',
          rows: [
            { text: 'In transit', value: 'TLS + mTLS', tone: 'good' },
            { text: 'At rest', value: 'AES-256, envelope', tone: 'good' },
            { text: 'Identity', value: 'cert chain, auto renew', tone: 'good' },
            { text: 'Secrets', value: 'manager, rotated', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'An attacker downloads a full copy of your database, where records were stored with envelope encryption. What do they still need to read the data?',
        options: [
          'Nothing, the data keys are stored in the same rows',
          'Permission to call the KMS to unwrap the data keys, because the master key never left it',
          'The TLS certificate of the database server',
          'The salt used for each record',
        ],
        answer: 1,
        explain: 'The rows hold ciphertext and wrapped data keys. Unwrapping needs the master key, which stays inside the KMS behind access control and audit logs. That is why KMS permissions deserve the tightest rules you have.',
      },
    },
  ],
};
