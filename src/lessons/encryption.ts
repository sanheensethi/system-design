import type { Lesson, SceneNode } from '../engine/types';

const laptop: SceneNode = { id: 'laptop', kind: 'client', at: [-5.5, 0], label: 'browser' };
const net: SceneNode = { id: 'net', kind: 'internet', at: [-2, 0], label: 'internet', sub: 'untrusted hops' };
const app: SceneNode = { id: 'app', kind: 'server', at: [1.5, -2.5], label: 'app server', sub: 'shop.example' };
const db: SceneNode = { id: 'db', kind: 'db', at: [5, -3.5], label: 'database', sub: '2M customers' };
const kms: SceneNode = { id: 'kms', kind: 'vault', at: [2.5, 2], label: 'KMS', sub: 'holds master key' };
const vault: SceneNode = { id: 'vault', kind: 'vault', at: [2.5, 2], label: 'secrets manager' };
const repo: SceneNode = { id: 'repo', kind: 'storage', at: [-2, 0], label: 'git repo', sub: '40 engineers' };

// Chain of trust cast.
const interCa: SceneNode = { id: 'interCa', kind: 'service', at: [2.5, 2], label: 'intermediate CA', sub: 'signs leaf certs' };
const rootCa: SceneNode = { id: 'rootCa', kind: 'vault', at: [-1.5, 4.5], label: 'root CA', sub: 'in the trust store' };

const wireLinks = [
  { from: 'laptop', to: 'net' },
  { from: 'net', to: 'app' },
  { from: 'app', to: 'db' },
];

export const encryption: Lesson = {
  id: 'encryption',
  title: 'Encryption, PKI and secrets',
  tagline: 'Protect data on the wire and on disk, prove a server is who it claims to be, and keep the keys out of your code.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Symmetric versus asymmetric encryption and why real systems use both',
    'Encryption in transit with TLS and at rest on disk',
    'Certificates, certificate authorities and the chain of trust',
    'Certificate expiry and automated rotation',
    'Envelope encryption with a key management service',
    'Keeping secrets out of code with a secrets manager',
  ],
  metrics: [
    { key: 'wire', label: 'On the wire' },
    { key: 'disk', label: 'On disk' },
    { key: 'cert', label: 'Cert days left' },
    { key: 'secrets', label: 'Secrets live in' },
  ],
  steps: [
    {
      title: 'Plaintext',
      tag: 'problem',
      heading: 'Everything is readable to whoever touches it',
      eli5: 'You send your secrets on postcards. Every **mail carrier** on the way can read them, and the copies kept at the post office sit in an open drawer.',
      body: [
        'The shop sends logins over plain HTTP and stores 2 million customer records unencrypted. A request crosses a coffee shop Wi-Fi, an ISP and several routers you do not control. Any of them can read the password, or change the response on its way back.',
        'The disk is no better. A stolen backup, a decommissioned drive or a snapshot shared by mistake hands over every record. And the database password itself sits in a config file in the git repo, where 40 engineers and every laptop clone can see it.',
        'Three gaps: data **in transit**, data **at rest**, and the **secrets** that open everything else. Encryption closes the first two. Managing keys well closes the third.',
      ],
      keyIdea: 'Assume the network and the storage will be seen by someone else. Design so that what they see is useless.',
      metrics: { wire: 'plaintext', disk: 'plaintext', cert: 'none', secrets: 'git' },
      scene: {
        nodes: [laptop, { ...net, status: 'hot', badge: 'can read and edit' }, app, { ...db, status: 'hot', badge: 'plaintext backup' }],
        links: wireLinks,
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'error', label: 'password=hunter2', duration: 2 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT', duration: 1, delay: 2.1 },
        ],
        caption: 'Readable on every hop and on every disk',
      },
    },
    {
      title: 'Symmetric',
      tag: 'concept',
      heading: 'Symmetric encryption: one key locks and unlocks',
      eli5: 'You and grandma each have a copy of the same key. You lock the box, the **mail carrier** cannot open it, grandma unlocks it. The hard part is getting her copy of the key to her.',
      body: [
        '**Symmetric** encryption uses the same secret key to encrypt and decrypt. The standard choice is **AES** with a 256-bit key in an authenticated mode such as GCM, which also detects tampering: change one bit of the ciphertext and decryption fails.',
        'It is fast. Modern CPUs have AES instructions built in, so a single core encrypts on the order of gigabytes per second. Encrypting all your traffic and all your disks costs very little.',
        'The weakness is **key distribution**. Both sides need the same key, and you cannot send it over the network you are trying to protect. A browser that has never spoken to your server shares no secret with it.',
      ],
      keyIdea: 'Symmetric encryption is fast and strong, but both sides must already share the key.',
      metrics: { wire: 'AES, if keys shared', disk: 'plaintext', cert: 'none', secrets: 'git' },
      scene: {
        nodes: [{ ...laptop, badge: 'key K' }, { ...net, badge: 'sees noise' }, { ...app, status: 'active', badge: 'key K' }],
        links: [{ from: 'laptop', to: 'net' }, { from: 'net', to: 'app' }],
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'data', label: '9f a3 1c 77 ...', duration: 2 },
          { path: ['app', 'net', 'laptop'], tone: 'data', label: 'c4 02 be ...', duration: 2, delay: 2.2 },
        ],
        caption: 'Same key on both ends. How did it get there?',
      },
    },
    {
      title: 'Asymmetric',
      tag: 'concept',
      heading: 'Asymmetric encryption: a public key and a private key',
      eli5: 'Grandma hands out open padlocks to everyone. Anyone can snap one shut on a box, but only grandma has the key that opens them. The **mail carrier** can hold a padlock and still not open the box.',
      body: [
        '**Asymmetric** cryptography uses a key pair. The **public key** can be published to the world. The **private key** never leaves its owner. What one key does, only the other can undo.',
        'That gives two tools. **Encryption**: anyone encrypts with the public key, only the private key decrypts. **Signatures**: the owner signs with the private key, anyone verifies with the public key. A valid signature proves the message came from the key holder and was not changed.',
        'The math (RSA, elliptic curves) is orders of magnitude slower than AES and limited to small inputs. So real protocols are **hybrid**: use asymmetric crypto briefly to agree on a fresh symmetric key and to prove identity, then switch to AES for the data.',
      ],
      keyIdea: 'Asymmetric keys solve the introduction problem. Symmetric keys do the bulk work. Real systems use both.',
      metrics: { wire: 'hybrid possible', disk: 'plaintext', cert: 'none', secrets: 'git' },
      scene: {
        nodes: [{ ...laptop, badge: 'has public key' }, net, { ...app, status: 'active', badge: 'private key stays here' }],
        links: [{ from: 'laptop', to: 'net' }, { from: 'net', to: 'app' }],
        flows: [
          { path: ['app', 'net', 'laptop'], tone: 'handshake', label: 'public key', duration: 1.8 },
          { path: ['laptop', 'net', 'app'], tone: 'handshake', label: 'key agreement', duration: 1.8, delay: 2 },
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'AES data', count: 3, duration: 1.8, delay: 4 },
        ],
        caption: 'Slow math to agree a key, fast math for the data',
      },
    },
    {
      title: 'TLS',
      tag: 'concept',
      heading: 'In transit: TLS puts the two together',
      eli5: 'Before any letters are sent, you and the shop do a quick secret handshake through the **mail carrier** that ends with both of you holding the same new key. The carrier watched it all and still has no key.',
      body: [
        '**TLS** is what the "s" in HTTPS means. In TLS 1.3 the handshake takes one round trip. Client and server each send an ephemeral key share and derive the same **session keys** (a Diffie-Hellman exchange). The server also presents a certificate and signs the handshake with its private key to prove it is the real `shop.example`.',
        'From then on every record is encrypted and authenticated with AES-GCM or ChaCha20-Poly1305. A router in the middle sees the server name, sizes and timing, and nothing else. Because the key shares are thrown away after the session, stealing the server\'s private key later does not decrypt recorded traffic. That property is **forward secrecy**.',
        'Do not stop at the edge. Traffic between your load balancer, services and databases crosses shared networks too. Encrypt internal hops, and consider **mutual TLS**, where both sides present certificates, for service-to-service calls.',
      ],
      keyIdea: 'TLS gives three things at once: privacy, tamper detection, and proof that the server is who its certificate says.',
      metrics: { wire: 'TLS 1.3', disk: 'plaintext', cert: '90', secrets: 'git' },
      scene: {
        nodes: [laptop, { ...net, badge: 'sees only ciphertext' }, { ...app, status: 'ok', badge: 'cert: shop.example' }, db],
        links: wireLinks,
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'handshake', label: 'ClientHello + key share', duration: 1.6 },
          { path: ['app', 'net', 'laptop'], tone: 'handshake', label: 'key share + certificate', duration: 1.6, delay: 1.8 },
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'encrypted HTTP', count: 3, duration: 1.6, delay: 3.6 },
          { path: ['app', 'db'], tone: 'data', label: 'TLS too', duration: 1, delay: 5.3 },
        ],
        caption: 'One round trip, then everything is encrypted',
      },
    },
    {
      title: 'Chain of trust',
      tag: 'concept',
      heading: 'Certificates: why the browser believes the public key',
      eli5: 'The shop shows an ID card. The card is stamped by an office, and that office\'s stamp is vouched for by the **head office** your family already trusts. You follow the stamps back until you reach one you know.',
      body: [
        'A public key alone proves nothing. Anyone on the path could send their own key and sit in the middle. A **certificate** binds a public key to a name (`shop.example`) and carries a signature from a **certificate authority** (CA) that checked you control that name.',
        'Browsers and operating systems ship with a **trust store** of about a hundred root CA certificates. Roots are kept offline, so they sign **intermediate** CAs, and intermediates sign your **leaf** certificate. The client walks the chain: leaf signed by intermediate, intermediate signed by a root it already trusts.',
        'It also checks that the name matches, that today falls inside the validity dates and that the certificate has not been revoked. Any failed check is a hard error. This whole system of CAs, certificates and checks is the **public key infrastructure** (PKI). Inside a company you can run a private CA and install its root on your own machines.',
      ],
      keyIdea: 'A certificate is a signed claim that a public key belongs to a name. Trust flows down from a root the client already holds.',
      metrics: { wire: 'TLS 1.3', disk: 'plaintext', cert: '90', secrets: 'git' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', badge: 'verifies each signature' },
          { ...app, sub: 'leaf cert', badge: 'shop.example' },
          { ...interCa, status: 'active' },
          { ...rootCa, status: 'ok' },
        ],
        links: [
          { from: 'laptop', to: 'app' },
          { from: 'interCa', to: 'app', label: 'signs' },
          { from: 'rootCa', to: 'interCa', label: 'signs' },
          { from: 'laptop', to: 'rootCa', style: 'dashed', label: 'trusts' },
        ],
        flows: [
          { path: ['app', 'laptop'], tone: 'handshake', label: 'leaf + intermediate', duration: 1.6 },
          { path: ['rootCa', 'interCa'], tone: 'data', label: 'signature', duration: 1.2, delay: 1.8 },
          { path: ['interCa', 'app'], tone: 'data', label: 'signature', duration: 1.2, delay: 3.1 },
        ],
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
      title: 'Cert expiry',
      tag: 'case',
      heading: 'Case: the certificate expired on Saturday night',
      eli5: 'The shop\'s ID card has a date on it. The day after that date, nobody will accept its parcels, even though nothing else changed. So a helper renews the card long before the date, every time.',
      body: [
        'Certificates expire on purpose. A short life limits how long a stolen key is useful and forces the name check to be repeated. Public certificates commonly last 90 days or less.',
        'At 23:59 on Saturday the shop\'s certificate passes its end date. Nothing in your system changed, and every browser and API client now refuses to connect. Checkout is at 0% and the dashboards that only watch CPU look calm. The fix takes minutes once someone finds it. Finding it takes an hour.',
        'Treat rotation as automation, never as a calendar reminder. Use a protocol such as **ACME** or a managed certificate service to renew at about two thirds of the lifetime (30 days left on a 90 day certificate) and reload servers without downtime. Then alert on **days until expiry** for every endpoint, including internal ones, so a broken renewal job is noticed weeks ahead.',
      ],
      keyIdea: 'Expiry is a scheduled outage unless renewal is automatic and monitored.',
      metrics: { wire: 'handshake fails', disk: 'plaintext', cert: '0', secrets: 'git' },
      scene: {
        nodes: [{ ...laptop, status: 'hot', badge: 'certificate expired' }, net, { ...app, status: 'down', badge: 'notAfter: yesterday' }, { ...db, status: 'dim' }],
        links: wireLinks,
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'handshake', label: 'ClientHello', duration: 1.6 },
          { path: ['app', 'net', 'laptop'], tone: 'error', label: 'expired cert, abort', duration: 1.6, delay: 1.8 },
        ],
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
      title: 'At rest',
      tag: 'concept',
      heading: 'At rest: encrypt disks, backups and sensitive fields',
      eli5: 'The post office now keeps its copies in a locked safe. A thief who carries off the safe gets a heavy box. But a clerk who is allowed to open the safe can still read everything inside.',
      body: [
        'With renewal automated, the wire is covered. Now the storage. **Encryption at rest** means data is written as ciphertext: volumes, database files, object storage and backups, all with AES-256. Most managed databases and clouds offer it as a checkbox, with almost no performance cost.',
        'Be clear about what it stops. It protects against stolen drives, leaked snapshots and backups that end up in the wrong place. It does **not** protect against an attacker who gets in through the application, because the database decrypts transparently for any query with valid credentials.',
        'For the most sensitive fields (card numbers, government IDs, health data), add **application-level encryption**: the service encrypts the field before it writes it. Then a database dump or a curious administrator sees ciphertext. This raises the next question: where does the key for all of this live?',
      ],
      keyIdea: 'Disk encryption defends against lost media. Field encryption defends against a compromised database. Neither helps if the key sits next to the data.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256', cert: '67, auto', secrets: 'git' },
      scene: {
        nodes: [laptop, net, { ...app, status: 'active', badge: 'encrypts card field' }, { ...db, status: 'ok', badge: 'ciphertext on disk' }],
        links: wireLinks,
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'TLS', duration: 1.8 },
          { path: ['app', 'db'], tone: 'data', label: 'card = 8b f1 04 ...', duration: 1, delay: 2 },
        ],
        caption: 'A stolen backup is now a pile of noise',
      },
    },
    {
      title: 'Envelope + KMS',
      tag: 'concept',
      heading: 'Envelope encryption: a key that protects keys',
      eli5: 'Each box gets its own little key. You lock that little key inside a tiny envelope using the **big key**, and the big key never leaves the post office strongroom. Tape the envelope to the box.',
      body: [
        'A **key management service** (KMS) holds a **master key** inside hardened hardware and never lets it out. You can only ask it to encrypt or decrypt small blobs, and every call is access-controlled and logged.',
        'Sending 2 million records through that API would be slow and costly, so use **envelope encryption**. Ask the KMS for a fresh **data key**. It returns the key twice: once in plaintext and once encrypted (wrapped) under the master key. Encrypt the record locally with the plaintext data key, store the wrapped copy next to the ciphertext, and wipe the plaintext key from memory.',
        'To read, send the wrapped key to the KMS, get the data key back and decrypt locally. An attacker with the whole database has ciphertext and wrapped keys, and no way to unwrap them without KMS permission. Rotating the master key means re-wrapping small data keys, with no need to re-encrypt terabytes of data.',
      ],
      keyIdea: 'Encrypt data with a data key, encrypt the data key with a master key that never leaves the KMS, and store the wrapped key beside the data.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'git' },
      scene: {
        nodes: [{ ...app, status: 'active', badge: 'encrypts locally' }, { ...kms, status: 'ok', badge: 'master key never leaves' }, { ...db, badge: 'ciphertext + wrapped key' }],
        links: [{ from: 'app', to: 'kms' }, { from: 'app', to: 'db' }],
        flows: [
          { path: ['app', 'kms'], tone: 'request', label: 'GenerateDataKey', duration: 1 },
          { path: ['kms', 'app'], tone: 'response', label: 'key + wrapped key', duration: 1, delay: 1.1 },
          { path: ['app', 'db'], tone: 'data', label: 'ciphertext + wrapped key', duration: 1.2, delay: 2.3 },
        ],
        caption: 'The KMS handles 32 bytes, the app handles the gigabytes',
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
        'Move secrets to a **secrets manager**. The app proves its identity with the platform (an instance or workload role, with no long-lived password of its own) and fetches the secret at startup or on demand over TLS. Access is per service, so the orders service can read the orders database password and nothing else. Every read is logged.',
        'The manager can also **rotate** secrets on a schedule, or issue short-lived database credentials that expire in an hour, so a leaked one is soon useless. Add a secret scanner to CI and as a pre-commit hook to stop the next key before it lands in the repo. Never print secrets in logs or error messages.',
      ],
      keyIdea: 'A secret belongs in one audited place, fetched at runtime by an identity with the narrowest access, and rotated often.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'secrets manager' },
      scene: {
        nodes: [
          { ...repo, status: 'dim', badge: 'no secrets, scanned' },
          { ...app, status: 'active', badge: 'role: orders-svc' },
          { ...vault, status: 'ok', badge: 'audited, rotated' },
          db,
        ],
        links: [
          { from: 'repo', to: 'app', style: 'dashed', label: 'deploy' },
          { from: 'app', to: 'vault' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['app', 'vault'], tone: 'request', label: 'get prod/orders/db', duration: 1 },
          { path: ['vault', 'app'], tone: 'response', label: 'password, 1 h lease', duration: 1, delay: 1.1 },
          { path: ['app', 'db'], tone: 'request', label: 'connect', duration: 1, delay: 2.3 },
        ],
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
      title: 'Recap',
      tag: 'recap',
      heading: 'Encrypt everywhere, and guard the keys harder than the data',
      eli5: 'Letters travel in locked boxes, the shop shows a stamped ID card that gets renewed on time, copies sit in a safe, and the keys live in a guarded **key cabinet** instead of on a sticky note.',
      body: [
        '**Symmetric** encryption (AES) is fast and needs a shared key. **Asymmetric** keys solve the introduction and give signatures. **TLS** combines them: a one round trip handshake, then encrypted records. A **certificate** chain from leaf to a trusted root proves the server\'s identity, and certificates expire, so renew automatically and alert on days left.',
        '**At rest**, encrypt disks and backups, and encrypt sensitive fields in the application. Use **envelope encryption**: data keys protect data, a master key in the **KMS** protects data keys. Keep every secret in a **secrets manager**, fetched at runtime, scoped per service and rotated.',
      ],
      keyIdea: 'Encryption turns a data protection problem into a key management problem. Most real failures are lost, leaked or expired keys.',
      metrics: { wire: 'TLS 1.3', disk: 'AES-256, envelope', cert: '67, auto', secrets: 'secrets manager' },
      scene: {
        nodes: [laptop, net, { ...app, status: 'ok' }, { ...db, status: 'ok', badge: 'ciphertext' }, { ...kms, status: 'ok' }],
        links: [...wireLinks, { from: 'app', to: 'kms' }],
        flows: [
          { path: ['laptop', 'net', 'app'], tone: 'data', label: 'TLS', count: 3, duration: 1.8 },
          { path: ['app', 'kms', 'app'], tone: 'request', label: 'unwrap key', duration: 1.4, delay: 1.9 },
          { path: ['app', 'db'], tone: 'data', label: 'encrypted rows', duration: 1, delay: 3.4 },
        ],
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
