import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const guestA: SceneNode = { id: 'guestA', kind: 'phone', at: at(-4.4, -3), label: 'guest A', sub: 'web and app' };
const guestB: SceneNode = { id: 'guestB', kind: 'phone', at: at(-2.6, 3.2), label: 'guest B', sub: 'web and app' };
const staff: SceneNode = { id: 'staff', kind: 'user', at: at(-2.6, 3.2), label: 'hotel staff', sub: 'admin tool' };
const app: SceneNode = { id: 'app', kind: 'block', at: at(0, -3), label: 'booking app', sub: 'stateless', icon: 'Boxes', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4.4, -3), label: 'hotel DB', sub: 'one primary' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(0, 3.2), label: 'Redis', sub: 'availability' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designHotelReservation: Lesson = {
  id: 'design-hotel-reservation',
  title: 'Design a hotel reservation system',
  tagline: 'Sell the last room exactly once, even when two guests click at the same moment and a payment times out.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Turning 5,000 hotels into booking and search QPS, and why one database is enough',
    'A data model built on room types and a per-night inventory table',
    'Stopping double booking with a row lock, a version check or a constraint',
    'Idempotent bookings, a 10 percent overbooking rule and rate pricing',
    'Caching availability, sharding by hotel, and a saga across payment and inventory',
    'Holds that expire, payments that time out, cancellations and a database failover',
  ],
  metrics: [
    { key: 'book', label: 'Bookings', icon: 'Receipt' },
    { key: 'search', label: 'Searches', icon: 'Search' },
    { key: 'double', label: 'Double books', icon: 'Bug' },
    { key: 'p99', label: 'Booking p99', icon: 'Timer' },
    { key: 'store', label: 'Data', icon: 'Database' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Two guests, one last room',
      eli5: 'A campsite has one tent left tonight. Two families ask the **gate keeper** at the same moment, and both hear "yes, it is yours".',
      body: [
        'The product: search hotels, see which room types are free for a date range, reserve one, pay, and cancel later. Hotel staff add rooms and set prices. Guests are on web and app.',
        'The hard rule is that a room is never sold to two guests for the same night. Everything else, such as price changes or slow search, is annoying. A double booking ruins someone\'s trip.',
      ],
      keyIdea: 'The whole design exists to protect one promise: each night of each room is sold once.',
      metrics: { book: '?', search: '?', double: '2 on one room', p99: '-', store: '?' },
      metricTones: { double: 'bad' },
      scene: {
        nodes: [
          { ...guestA, chips: ['book room 301'] },
          { ...guestB, chips: ['book room 301'] },
          { ...app, status: 'hot' },
          { ...db, status: 'down', badge: 'sold twice' },
        ],
        links: [link('guestA', 'app'), link('guestB', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'book', duration: 1.6 },
          { path: ['guestB', 'app', 'db'], tone: 'request', label: 'book', duration: 1.6, delay: 0.1 },
          { path: ['db', 'app', 'guestA'], tone: 'error', label: 'confirmed', duration: 1.6, delay: 1.8 },
          { path: ['db', 'app', 'guestB'], tone: 'error', label: 'confirmed', duration: 1.6, delay: 1.9 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Search by city and dates', value: 'read' },
            { text: 'Reserve a room type', value: 'write' },
            { text: 'Cancel and refund', value: 'write' },
            { text: 'Staff manage rooms and rates', value: 'admin' },
            { text: 'Never sell a night twice', value: 'must', tone: 'bad' },
          ],
          footer: { text: 'Correctness beats speed here', tone: 'warn' },
        },
        caption: 'Both guests are told yes',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'The numbers are small, which changes the design',
      eli5: 'Lots of visitors peek at the **board** that shows free tents. Very few walk up and sign the clipboard. So reading the board is the busy job, and signing is rare.',
      body: [
        'Assume **5,000 hotels** and **1M rooms**, 70 percent full, with a 3 night average stay. That is 1M × 0.7 ÷ 3 = about **233K bookings a day**, or 2.7 per second. Peak is roughly 10 times that: **27 per second**.',
        'Say 100 searches happen for every booking. That is about **2.7K searches per second** at peak. Storage is small: 233K × 365 × 1 KB is about **85 GB a year**.',
      ],
      keyIdea: 'Writes are tiny at 27 per second. The hard part is correctness and a read-heavy search path, not raw volume.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '-', p99: 'goal < 300 ms', store: '85 GB/yr' },
      metricTones: { book: 'good', store: 'good' },
      scene: {
        nodes: [
          { ...guestA, label: 'guests', sub: '233K bookings/day' },
          { ...app, load: 30 },
          { ...db, badge: '85 GB/yr', load: 20 },
        ],
        links: [link('guestA', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app'], tone: 'request', label: '2.7K search/s', count: 5, duration: 1.1 },
          { path: ['guestA', 'app', 'db'], tone: 'request', label: '27 book/s', duration: 1.8, delay: 1.2 },
        ],
        panel: {
          title: 'Back of the envelope',
          icon: 'Table',
          rows: [
            { text: 'Rooms sold a day', value: '233K' },
            { text: 'Peak bookings', value: '27/s', tone: 'good' },
            { text: 'Look to book ratio', value: '100 : 1' },
            { text: 'Peak searches', value: '2.7K/s', tone: 'warn' },
            { text: 'Reservations a year', value: '85M rows' },
          ],
          footer: { text: 'One relational primary can take this', tone: 'good' },
        },
        caption: 'About 100 reads for every write',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'A small REST API with one tricky field',
      eli5: 'The **gate keeper** only understands a few questions: "which tents are free", "reserve this one", "cancel mine". Each has a name, as on a menu.',
      body: [
        'Guests use four calls: list hotels, check room types for dates, reserve, and cancel. Staff use a separate admin set to create and edit hotels and rooms. The style follows the API styles lesson.',
        '`POST /reservations` carries a `reservation_id` made by the client. The server uses it to spot a repeat of the same request. We come back to it in the idempotency step.',
      ],
      keyIdea: 'The booking call must be safe to repeat. The client sends its own reservation id so a retry cannot book twice.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '-', p99: '-', store: '-' },
      scene: {
        nodes: [{ ...guestA, chips: ['GET /rooms?dates'] }, { ...app, label: 'booking API', sub: 'REST', status: 'active' }, { ...db, status: 'dim' }],
        links: [link('guestA', 'app', { label: 'HTTPS' }), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app'], tone: 'request', label: 'POST /reservations', duration: 1.5 },
          { path: ['app', 'guestA'], tone: 'response', label: '201 + status', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Guest endpoints',
          icon: 'Code',
          code: 'GET    /v1/hotels?city=&near=\nGET    /v1/hotels/{id}/rooms?in=&out=\nPOST   /v1/reservations\nGET    /v1/reservations/{id}\nDELETE /v1/reservations/{id}',
          footer: { text: 'Admin routes live on a separate path', tone: 'muted' },
        },
        caption: 'Four guest calls, one of them writes',
      },
      code: {
        language: 'json',
        title: 'POST /v1/reservations',
        source: `{
  "reservation_id": "7f3c-client-generated",
  "hotel_id": 42,
  "room_type_id": 7,
  "check_in": "2026-12-24",
  "check_out": "2026-12-27",
  "rooms": 1
}`,
        highlight: [2],
      },
    },
    {
      title: 'Hotels and rooms',
      tag: 'concept',
      heading: 'Guests book a room type, not a room number',
      eli5: 'Families ask for "a family tent", not "tent number 14". The gate keeper walks them to a free one when they arrive.',
      body: [
        'Static data is small: a `hotel` row, and a `room_type` row for each kind of room (standard, deluxe, suite) with its price and capacity. Staff change it rarely, so it is easy to cache.',
        'The reservation points at a **room type**, not a physical room. The front desk assigns room 301 at check-in. That keeps the data model small and gives the hotel room to shuffle guests.',
      ],
      keyIdea: 'Model what is sold: a room type for a night. The physical room number is a late detail.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '-', p99: '-', store: '85 GB/yr' },
      scene: {
        nodes: [{ ...staff, chips: ['add deluxe, 40 rooms'] }, { ...app, label: 'admin API', sub: 'rare writes' }, { ...db, status: 'active', badge: '5K hotels' }],
        links: [link('staff', 'app'), link('app', 'db')],
        flows: [
          { path: ['staff', 'app', 'db'], tone: 'request', label: 'create room type', duration: 1.8 },
          { path: ['db', 'app', 'staff'], tone: 'response', label: 'ok', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Static tables',
          icon: 'Table',
          rows: [
            { text: 'hotel', value: 'id, name, city, geo' },
            { text: 'room_type', value: 'id, hotel_id, name, beds' },
            { text: 'room', value: 'number, room_type_id' },
            { text: 'Guests pick', value: 'room_type', tone: 'good' },
          ],
          footer: { text: 'Rarely changes, cache it', tone: 'muted' },
        },
        caption: 'Rooms are described once, then read often',
      },
    },
    {
      title: 'Inventory table',
      tag: 'concept',
      heading: 'One row per room type per night',
      eli5: 'The campsite keeps a **night board**: one line for each tent kind on each night, with how many exist and how many are taken.',
      body: [
        'Availability is stored, not computed. The `room_type_inventory` table has one row for each hotel, room type and date, with `total_inventory` and `total_reserved`. Free rooms are the difference.',
        'The size: 5,000 hotels × about 20 room types × 730 days ahead is **73M rows**. Small rows, so a few GB with indexes. A 3 night stay touches 3 rows.',
      ],
      keyIdea: 'A per-night inventory row turns "is it free?" into a primary key lookup, and a booking into row updates.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '-', p99: '-', store: '73M rows' },
      scene: {
        nodes: [{ ...app, status: 'active', chips: ['3 nights = 3 rows'] }, { ...db, status: 'active', badge: '73M rows' }],
        links: [link('app', 'db')],
        flows: [{ path: ['app', 'db', 'app'], tone: 'request', label: 'read 3 rows', duration: 2 }],
        panel: {
          title: 'room_type_inventory',
          icon: 'Table',
          rows: [
            { text: 'Deluxe · Dec 24', value: '40 / 36 sold' },
            { text: 'Deluxe · Dec 25', value: '40 / 40 sold', tone: 'warn' },
            { text: 'Deluxe · Dec 26', value: '40 / 12 sold', tone: 'good' },
            { text: 'Key', value: 'hotel, type, date', tone: 'muted' },
          ],
          footer: { text: 'Dec 25 is full, so the stay fails', tone: 'warn' },
        },
        caption: 'A stay is available only if every night is',
      },
      code: {
        language: 'sql',
        title: 'The inventory table',
        source: `CREATE TABLE room_type_inventory (
  hotel_id         BIGINT NOT NULL,
  room_type_id     BIGINT NOT NULL,
  date             DATE   NOT NULL,
  total_inventory  INT    NOT NULL,
  total_reserved   INT    NOT NULL DEFAULT 0,
  PRIMARY KEY (hotel_id, room_type_id, date)
);`,
        highlight: [4, 5, 6],
      },
    },
    {
      title: 'Reservations',
      tag: 'concept',
      heading: 'A reservation is a row with a status',
      eli5: 'Each family signs a **clipboard** line. The line starts as "waiting for payment" and later turns into "paid", or gets crossed out.',
      body: [
        'The `reservation` table holds the id, hotel, room type, dates, guest, price and a `status`. The state machine is small: **pending**, then **paid**, **rejected** if payment fails, or **expired** if the hold times out.',
        'From paid a stay is **canceled** or **checked_in**. A cancel also starts a keyed refund step (see Cancel). Only certain moves are legal. A canceled reservation never becomes paid again. Keeping that rule in one place avoids odd states.',
      ],
      keyIdea: 'A status column with strict transitions tells every part of the system what is safe to do next.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '-', p99: '-', store: '85 GB/yr' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...db, status: 'active', chips: [{ text: 'status = pending', tone: 'warn' }] }],
        links: [link('app', 'db')],
        flows: [{ path: ['app', 'db'], tone: 'request', label: 'insert pending', duration: 1.6 }],
        panel: {
          title: 'Status moves',
          icon: 'Workflow',
          rows: [
            { text: 'pending > paid', value: 'payment ok', tone: 'good' },
            { text: 'pending > rejected', value: 'payment failed', tone: 'bad' },
            { text: 'paid > canceled', value: 'guest cancels', tone: 'warn' },
            { text: 'pending > expired', value: 'hold timer', tone: 'warn' },
            { text: 'paid > checked_in', value: 'guest arrives', tone: 'good' },
            { text: 'canceled + refund step', value: 'keyed, repeat-safe' },
          ],
          footer: { text: 'No move back to paid', tone: 'muted' },
        },
        caption: 'A small state machine in one column',
      },
      code: {
        language: 'sql',
        title: 'The reservation table',
        source: `CREATE TABLE reservation (
  reservation_id  TEXT PRIMARY KEY,   -- from the client
  hotel_id        BIGINT NOT NULL,
  room_type_id    BIGINT NOT NULL,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  guest_id        BIGINT NOT NULL,
  total_cents     BIGINT NOT NULL,
  status          TEXT NOT NULL,      -- pending, paid, expired, ...
  created_at      TIMESTAMP NOT NULL
);`,
        highlight: [2, 8],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'Start with one app and one database',
      eli5: 'One gate keeper, one clipboard, one board. At 27 sign-ups a second, one clipboard is plenty.',
      body: [
        'A load balanced pool of stateless booking servers talks to one relational database with a replica for backup. The database gives us transactions and constraints, which we need.',
        'A booking is one transaction: check each night has room, add 1 to `total_reserved` on each, insert the reservation. With one request at a time that is correct. The next steps ask what happens with two.',
      ],
      keyIdea: 'Pick a relational database on purpose: transactions and constraints are the tools that protect the one promise.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0 so far', p99: '120 ms', store: '85 GB/yr' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...guestA, label: 'guests' }, { ...app, label: 'booking app', sub: '3 servers', load: 25 }, { ...db, status: 'ok', badge: 'ACID' }],
        links: [link('guestA', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'book', duration: 1.8 },
          { path: ['db', 'app', 'guestA'], tone: 'response', label: '201', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'One booking transaction',
          icon: 'Code',
          code: 'BEGIN\n  check each night has room\n  total_reserved + 1, per night\n  insert reservation (pending)\nCOMMIT',
          footer: { text: 'Correct for one request at a time', tone: 'good' },
        },
        caption: 'One transaction per booking',
      },
    },
    {
      title: 'Search reads',
      tag: 'case',
      heading: 'The availability query is the busy one',
      eli5: 'Everyone walks up to the **night board** and counts tents. The board gets read 100 times for each time the clipboard is signed.',
      body: [
        'To show room types, the app reads the inventory rows for the dates and keeps those with room on every night: `total_reserved < total_inventory`. At 2.7K searches a second it grows the main load.',
        'The numbers are only a view. A guest may see "2 left" and lose the race a moment later. That is fine if the booking itself checks again. Search may be a little stale, booking may not.',
      ],
      keyIdea: 'Search can be slightly wrong. The booking transaction has to be exactly right.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0 so far', p99: '180 ms', store: '73M rows' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [{ ...guestA, label: 'guests', chips: ['dates: Dec 24 to 27'] }, { ...app, load: 62 }, { ...db, status: 'hot', load: 78, badge: '2.7K reads/s' }],
        links: [link('guestA', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'search', count: 4, duration: 1.4 },
          { path: ['db', 'app', 'guestA'], tone: 'response', label: 'room types', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Availability query',
          icon: 'Code',
          code: 'SELECT room_type_id, MIN(total_inventory\n       - total_reserved) AS left\nFROM room_type_inventory\nWHERE hotel_id = 42\n  AND date >= :in AND date < :out\nGROUP BY room_type_id\nHAVING MIN(total_inventory\n       - total_reserved) > 0;',
          footer: { text: 'A view, not a promise', tone: 'warn' },
        },
        caption: 'Reads dominate, and may be a little stale',
      },
      quiz: {
        question: 'Why can the search page show slightly stale availability, but the booking step cannot?',
        options: [
          'Search is read-only, so staleness has no cost anywhere',
          'A stale search result only misleads a guest, while a stale booking check can sell a night twice',
          'The booking step runs on a faster database',
          'Stale data is illegal in a booking',
        ],
        answer: 1,
        explain: 'A wrong search number costs a failed click at worst. A wrong check inside the booking can write two reservations for one room, which is the promise we must keep.',
      },
    },
    {
      title: 'The race',
      tag: 'case',
      heading: 'Check, then write: two guests slip through',
      eli5: 'Both families read the board: "1 tent left". Each walks to the clipboard and signs. Neither saw the other, so the tent is promised twice.',
      body: [
        'Say Dec 25 shows `99 of 100` reserved. Guest A and guest B each read 99 and see room. Each writes 100. Both commit. The true count is 101 for 100 rooms.',
        'The gap is between the read and the write. Each step was fine alone. This is a **race condition**, and it only appears under concurrency. A test with one user will never find it.',
      ],
      keyIdea: 'Read-then-write across two statements is unsafe unless the database is told to protect the row in between.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '1 per busy night', p99: '120 ms', store: '73M rows' },
      metricTones: { double: 'bad' },
      scene: {
        nodes: [
          { ...guestA, chips: [{ text: 'read: 99 of 100', tone: 'warn' }] },
          { ...guestB, chips: [{ text: 'read: 99 of 100', tone: 'warn' }] },
          { ...app, status: 'hot' },
          { ...db, status: 'down', badge: '101 of 100' },
        ],
        links: [link('guestA', 'app'), link('guestB', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'set 100', duration: 1.6 },
          { path: ['guestB', 'app', 'db'], tone: 'request', label: 'set 100', duration: 1.6, delay: 0.1 },
          { path: ['db', 'app', 'guestB'], tone: 'error', label: 'both ok', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Interleaved timeline',
          icon: 'Clock',
          rows: [
            { text: 'A reads reserved', value: '99' },
            { text: 'B reads reserved', value: '99' },
            { text: 'A writes reserved', value: '100' },
            { text: 'B writes reserved', value: '100', tone: 'bad' },
            { text: 'Rooms really sold', value: '101 of 100', tone: 'bad' },
          ],
          footer: { text: 'Lost update on the counter', tone: 'bad' },
        },
        caption: 'Two reads of 99, two writes of 100',
      },
    },
    {
      title: 'Row lock',
      tag: 'concept',
      heading: 'Fix 1: lock the rows while you check them',
      eli5: 'The first family to reach the **night board** holds the pen and says "mine". Everyone else waits in line until the pen comes back.',
      body: [
        '**Pessimistic locking**: `SELECT ... FOR UPDATE` locks the inventory rows for the dates. A second booking for the same rows waits until the first commits, then sees the new count and is turned away.',
        'It is simple and always correct. The cost is waiting, and a lock held during a slow step blocks others. Keep the transaction short, and take rows in a fixed date order to avoid deadlocks.',
      ],
      keyIdea: 'A row lock makes check and write one atomic unit. It is correct and easy, but contended rows queue up.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '140 ms', store: '73M rows' },
      metricTones: { double: 'good' },
      scene: {
        nodes: [
          { ...guestA, chips: [{ text: 'holds the lock', tone: 'good' }] },
          { ...guestB, chips: [{ text: 'waits', tone: 'warn' }] },
          { ...app, status: 'active' },
          { ...db, status: 'ok', badge: 'FOR UPDATE' },
        ],
        links: [link('guestA', 'app'), link('guestB', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'lock + book', duration: 1.6 },
          { path: ['db', 'app', 'guestA'], tone: 'response', label: 'ok', duration: 1.4, delay: 1.7 },
          { path: ['guestB', 'app', 'db'], tone: 'request', label: 'lock', duration: 1.6, delay: 3.2 },
          { path: ['db', 'app', 'guestB'], tone: 'error', label: 'sold out', duration: 1.4, delay: 4.9 },
        ],
        panel: {
          title: 'Trade-off',
          icon: 'Scale',
          rows: [
            { text: 'Correct under load', value: 'yes', tone: 'good' },
            { text: 'Code needed', value: 'little', tone: 'good' },
            { text: 'Waits on hot rows', value: 'yes', tone: 'warn' },
            { text: 'Deadlock risk', value: 'order the rows', tone: 'warn' },
          ],
          footer: { text: 'Fine at 27 bookings a second', tone: 'good' },
        },
        caption: 'The second guest waits, then sees the truth',
      },
      code: {
        language: 'sql',
        title: 'Pessimistic booking',
        source: `BEGIN;
SELECT * FROM room_type_inventory
 WHERE hotel_id = 42 AND room_type_id = 7
   AND date >= '2026-12-24' AND date < '2026-12-27'
 ORDER BY date
 FOR UPDATE;
-- app checks every row: total_reserved < total_inventory
UPDATE room_type_inventory SET total_reserved = total_reserved + 1
 WHERE hotel_id = 42 AND room_type_id = 7
   AND date >= '2026-12-24' AND date < '2026-12-27';
COMMIT;`,
        highlight: [5, 6, 8],
      },
    },
    {
      title: 'Version check',
      tag: 'concept',
      heading: 'Fix 2: write only if nobody changed it',
      eli5: 'Each **night board** line has a small number on it. You sign only if the number is still the one you saw. If it changed, you look again.',
      body: [
        '**Optimistic locking** adds a `version` column. Read the row and its version. Update with `WHERE version = :seen` and bump it. If zero rows change, someone else won. Add a `version` column to `room_type_inventory`. A stay spans nights, so all per-night updates run in one transaction. Any night with 0 rows affected rolls back the whole stay.',
        'No lock is held, so nothing waits. It suits rare conflicts and struggles when many guests chase one room.',
      ],
      keyIdea: 'Optimistic locking assumes no clash and checks at write time. It shines with rare conflicts and suffers on hot rows.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '110 ms', store: '73M rows' },
      metricTones: { double: 'good' },
      scene: {
        nodes: [
          { ...guestA, chips: [{ text: 'version 7 > 8', tone: 'good' }] },
          { ...guestB, chips: [{ text: 'version 7: stale', tone: 'bad' }] },
          { ...app, status: 'active' },
          { ...db, status: 'ok', badge: 'version = 8' },
        ],
        links: [link('guestA', 'app'), link('guestB', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'update v7', duration: 1.6 },
          { path: ['guestB', 'app', 'db'], tone: 'request', label: 'update v7', duration: 1.6, delay: 0.3 },
          { path: ['db', 'app', 'guestB'], tone: 'error', label: '0 rows: retry', duration: 1.5, delay: 1.9 },
        ],
        panel: {
          title: 'Trade-off',
          icon: 'Scale',
          rows: [
            { text: 'Correct under load', value: 'yes', tone: 'good' },
            { text: 'Holds a lock', value: 'no', tone: 'good' },
            { text: 'Retries on clash', value: 'yes', tone: 'warn' },
            { text: 'Best when', value: 'conflicts are rare' },
          ],
          footer: { text: 'Peak rush on one hotel means retries', tone: 'warn' },
        },
        caption: 'The loser sees zero rows changed',
      },
      code: {
        language: 'sql',
        title: 'Optimistic update',
        source: `ALTER TABLE room_type_inventory ADD COLUMN version INT NOT NULL DEFAULT 0;

-- run once per night of the stay, all in ONE transaction:
UPDATE room_type_inventory
   SET total_reserved = total_reserved + 1,
       version        = version + 1
 WHERE hotel_id = 42 AND room_type_id = 7
   AND date = '2026-12-25'
   AND version = 7;          -- the version we read
-- affected rows = 0 on ANY night: ROLLBACK the whole stay`,
        highlight: [5, 8, 9],
      },
    },
    {
      title: 'Constraint',
      tag: 'tradeoff',
      heading: 'Fix 3: let the database refuse the bad row',
      eli5: 'The night board itself has a rule printed on it: "never more than 40 names". If a 41st name is written, the board rubs it out.',
      body: [
        'A **check constraint**, `total_reserved <= total_inventory`, makes the database reject any update that would go over. The booking runs a plain `UPDATE`, and an error means the room is gone.',
        'It is the simplest of the three and cannot be forgotten. It does not support every rule (overbooking changes the limit), and not all databases allow such checks. Many teams use a lock or constraint for the final guard.',
      ],
      keyIdea: 'Three guards exist: lock, version, constraint. At this scale, pick the simplest and still keep a database-enforced backstop.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '100 ms', store: '73M rows' },
      metricTones: { double: 'good' },
      scene: {
        nodes: [{ ...guestA, label: 'guests' }, { ...app, status: 'active' }, { ...db, status: 'ok', badge: 'CHECK rule' }],
        links: [link('guestA', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'reserved + 1', duration: 1.6 },
          { path: ['db', 'app', 'guestA'], tone: 'error', label: 'check failed', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Pick one',
          icon: 'Scale',
          rows: [
            { text: 'Row lock', value: 'simple, waits', tone: 'good' },
            { text: 'Version check', value: 'no waits, retries', tone: 'warn' },
            { text: 'Constraint', value: 'simplest, rigid', tone: 'good' },
            { text: 'Distributed lock', value: 'only if no shared DB', tone: 'muted' },
          ],
          footer: { text: 'See the distributed locks lesson', tone: 'muted' },
        },
        caption: 'The database says no to the 101st room',
      },
      code: {
        language: 'sql',
        title: 'A constraint as a backstop',
        source: `ALTER TABLE room_type_inventory
  ADD CONSTRAINT never_oversold
  CHECK (total_reserved <= total_inventory);

-- this fails by itself when the night is full:
UPDATE room_type_inventory
   SET total_reserved = total_reserved + 1
 WHERE hotel_id = 42 AND room_type_id = 7
   AND date = '2026-12-25';`,
        highlight: [3, 6],
      },
    },
    {
      title: 'Idempotency',
      tag: 'case',
      heading: 'A double click must not book twice',
      eli5: 'A child taps the sign-up pen twice. The clipboard already has that exact ticket number, so the **gate keeper** says "you are already on the list".',
      body: [
        'Guests double click and networks retry. The client makes a `reservation_id` once. It is the **primary key** of the reservation table.',
        'The insert runs first, so a retry hits the duplicate key before any inventory work and gets the first booking back. Taking inventory first would fail a retry of the last room with sold out. The same id means the same booking, no matter how many times it arrives. See the timeouts and retries lesson.',
      ],
      keyIdea: 'An id chosen by the client, enforced by a unique key, makes a retry safe.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '100 ms', store: '73M rows' },
      metricTones: { double: 'good' },
      scene: {
        nodes: [{ ...guestA, chips: [{ text: 'id 7f3c', tone: 'default' }, { text: 'id 7f3c (retry)', tone: 'warn' }] }, { ...app, status: 'active' }, { ...db, status: 'ok', badge: 'unique id' }],
        links: [link('guestA', 'app'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'insert 7f3c', duration: 1.5 },
          { path: ['guestA', 'app', 'db'], tone: 'request', label: 'insert 7f3c', duration: 1.5, delay: 1.7 },
          { path: ['db', 'app', 'guestA'], tone: 'response', label: 'same booking', duration: 1.5, delay: 3.4 },
        ],
        panel: {
          title: 'Same id, same result',
          icon: 'Key',
          rows: [
            { text: 'First insert 7f3c', value: 'created', tone: 'good' },
            { text: 'Retry of 7f3c', value: 'duplicate key' },
            { text: 'Reply to retry', value: 'the first booking', tone: 'good' },
            { text: 'Rooms taken', value: '1' },
          ],
          footer: { text: 'The unique key does the work', tone: 'good' },
        },
        caption: 'The retry returns the original',
      },
      code: {
        language: 'python',
        title: 'Repeat-safe booking',
        source: `def book(req):
    try:
        with db.transaction():
            insert_reservation(req)      # first: duplicate key stops retries here
            take_inventory(req)          # then lock, version or check
    except DuplicateKey:
        return load_reservation(req.reservation_id)   # same answer
    except SoldOut:
        return conflict("room type is full")
    return created(req.reservation_id)`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Overbooking',
      tag: 'concept',
      heading: 'Selling a few more than you own, on purpose',
      eli5: 'Some families never show up. The campsite signs up 110 families for 100 tents, because it knows about 10 will stay home.',
      body: [
        'Some guests cancel or never arrive, so hotels often sell **110 percent** and rehome the last guest if all arrive.',
        'It changes one line: the limit is `total_inventory × 1.1`, not `total_inventory`. The `CHECK` from the Constraint step, and any lock or version comparison, must use a cap such as a `max_sellable` column, or booking 101 is rejected.',
      ],
      keyIdea: 'Overbooking is a business rule. Express it as a number in data so the guard still cannot be exceeded by accident.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '100 ms', store: '73M rows' },
      code: {
        language: 'sql',
        title: 'The guard compares against the cap',
        source: `ALTER TABLE room_type_inventory
  ADD COLUMN max_sellable INT NOT NULL DEFAULT 110;  -- 100 rooms x 1.1

ALTER TABLE room_type_inventory
  DROP CONSTRAINT never_oversold,
  ADD CONSTRAINT never_oversold
  CHECK (total_reserved <= max_sellable);`,
        highlight: [2, 7],
      },
      scene: {
        nodes: [{ ...app, status: 'active', chips: ['limit = 110%'] }, { ...db, status: 'ok', badge: '110 of 100' }],
        links: [link('app', 'db')],
        flows: [{ path: ['app', 'db', 'app'], tone: 'request', label: 'reserved < 110', duration: 2 }],
        panel: {
          title: 'Sell 110 of 100',
          icon: 'TrendingUp',
          rows: [
            { text: 'Rooms owned', value: '100' },
            { text: 'Cap (110 percent)', value: '110', tone: 'good' },
            { text: 'Booked so far', value: '108' },
            { text: 'Next booking', value: 'allowed', tone: 'good' },
            { text: 'Booking after 110', value: 'refused', tone: 'bad' },
          ],
          footer: { text: 'Cap lives in the data', tone: 'muted' },
        },
        caption: 'The guard compares against the cap',
      },
    },
    {
      title: 'Rates',
      tag: 'concept',
      heading: 'Price is data per night, locked at booking',
      eli5: 'A tent costs more on holiday weekends. The **gate keeper** reads the price from a price list and writes the total on the ticket, so it cannot change later.',
      body: [
        'Prices vary by night: weekends, seasons, events. Store a rate per room type per date, or keep a base rate and apply rules (a weekend multiplier, a season factor) as the low level design lesson does with strategies.',
        'The total is the sum over the nights and is **copied into the reservation** at booking. Staff can change tomorrow\'s rates without touching stays already sold. Use integer cents, never floats.',
      ],
      keyIdea: 'Compute the price once, store it on the reservation, and the later rate edits cannot rewrite history.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '110 ms', store: '73M rows' },
      scene: {
        nodes: [{ ...staff, chips: ['weekend x 1.4'] }, { ...app, label: 'pricing', sub: 'sum the nights', icon: 'Receipt', tint: 'amber' }, { ...db, status: 'active', badge: 'rate per night' }],
        links: [link('staff', 'app'), link('app', 'db')],
        flows: [
          { path: ['staff', 'app', 'db'], tone: 'request', label: 'set rate', duration: 1.7 },
          { path: ['db', 'app'], tone: 'response', label: 'Dec 24 to 26 = 51000', duration: 1.5, delay: 1.8 },
        ],
        panel: {
          title: 'Total for 3 nights',
          icon: 'Receipt',
          rows: [
            { text: 'Dec 24 (Thu)', value: '15000' },
            { text: 'Dec 25 (Fri)', value: '15000' },
            { text: 'Dec 26 (Sat)', value: '21000', tone: 'warn' },
            { text: 'Saved on reservation', value: '51000', tone: 'good' },
          ],
          footer: { text: 'Amounts in cents', tone: 'muted' },
        },
        caption: 'The sum is fixed at booking time',
      },
    },
    {
      title: 'Cache reads',
      tag: 'concept',
      heading: 'Serve search from a cache, book from the database',
      eli5: 'A copy of the **night board** hangs at the gate for peeking. Signing still happens at the real clipboard, so a slightly old copy never causes a double promise.',
      body: [
        'Keep remaining rooms per hotel, room type and date in **Redis**, plus the static hotel data. Search at 2.7K a second reads the cache. The database sees mostly the 27 bookings a second.',
        'After each commit, update or delete the cache key (the caching lesson covers the patterns). If it lags a few seconds, a guest may see a room that just sold. The booking check catches that.',
      ],
      keyIdea: 'Cache the read path, never the guard. The database stays the only place that decides who gets the room.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '40 ms search', store: '73M rows' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...guestA, label: 'guests' }, { ...app, load: 35 }, { ...cache, status: 'ok', badge: '95% hit' }, { ...db, load: 18, status: 'ok' }],
        links: [link('guestA', 'app'), link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'cache', 'app', 'guestA'], tone: 'request', label: 'search', count: 3, duration: 2.2 },
          { path: ['app', 'db'], tone: 'request', label: 'book', duration: 1.4, delay: 2.4 },
          { path: ['db', 'cache'], tone: 'data', label: 'refresh key', duration: 1.6, delay: 3.9 },
        ],
        panel: {
          title: 'Who answers what',
          icon: 'Table',
          rows: [
            { text: 'Search and room list', value: 'Redis', tone: 'good' },
            { text: 'Final booking check', value: 'database', tone: 'good' },
            { text: 'Stale by', value: 'a few seconds', tone: 'warn' },
            { text: 'Database reads', value: '2.7K > 135/s' },
          ],
          footer: { text: 'The cache never decides a sale', tone: 'good' },
        },
        caption: 'Search hits Redis, booking hits the database',
      },
      quiz: {
        question: 'Why is it safe to answer searches from a cache that can be a few seconds stale?',
        options: [
          'Stale caches can never show a wrong room',
          'The booking transaction re-checks the real inventory, so a stale view cannot cause a double sale',
          'Redis locks the rows for the database',
          'Bookings are also served from the cache',
        ],
        answer: 1,
        explain: 'The cache only shapes what guests see. The decision still happens in a database transaction with a lock, version check or constraint, so a stale listing costs a failed click at worst.',
      },
    },
    {
      title: 'Shard by hotel',
      tag: 'tradeoff',
      heading: 'If one primary is not enough, split by hotel',
      eli5: 'If one clipboard gets too crowded, give each campsite section its own. A family only ever signs for one section, so the sections never need to talk.',
      body: [
        'At 27 writes a second and 85 GB a year, one primary with replicas is enough for years. Shard when growth demands it, not before. Replicas serve reads, and old stays move to cold storage.',
        'If you must shard, use `hotel_id` as the key (the sharding lesson). A booking touches one hotel, so it stays in one shard and one transaction. Watch for a very popular hotel becoming a hot shard.',
      ],
      keyIdea: 'Shard on hotel_id so a booking stays inside one shard. First try the cheaper levers: cache, replicas, archiving.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '100 ms', store: '85 GB/yr' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['hotel_id % 4'] },
          { id: 'shardA', kind: 'shard', at: at(4.4, -3), label: 'shard 0', sub: 'hotels 0, 4, 8', status: 'ok' },
          { id: 'shardB', kind: 'shard', at: at(2.6, 3.2), label: 'shard 1', sub: 'hotels 1, 5, 9', status: 'ok' },
          { id: 'replica', kind: 'replica', at: at(0, 3.2), label: 'read replica', sub: 'reporting', status: 'dim' },
        ],
        links: [link('app', 'shardA'), link('app', 'shardB'), link('shardA', 'replica', { style: 'dashed' })],
        flows: [
          { path: ['app', 'shardA'], tone: 'request', label: 'hotel 42', duration: 1.5 },
          { path: ['app', 'shardB'], tone: 'request', label: 'hotel 7', duration: 1.5, delay: 0.2 },
          { path: ['shardA', 'replica'], tone: 'data', label: 'copy', duration: 1.5, delay: 1.8 },
        ],
        panel: {
          title: 'Shard key choice',
          icon: 'Split',
          rows: [
            { text: 'hotel_id', value: 'one hotel, one shard', tone: 'good' },
            { text: 'date', value: 'every stay spans shards', tone: 'bad' },
            { text: 'guest_id', value: 'splits one hotel apart', tone: 'bad' },
            { text: 'Hot spot risk', value: 'a famous hotel', tone: 'warn' },
          ],
          footer: { text: 'Try replicas and cache first', tone: 'muted' },
        },
        caption: 'One booking, one hotel, one shard',
      },
    },
    {
      title: 'Split services',
      tag: 'problem',
      heading: 'Separate services bring back the same problem',
      eli5: 'Now the campsite has three desks: one for tents, one for tickets, one for money. A sign-up has to be handled by all three, and they cannot share one pen.',
      body: [
        'At company scale the work gets split: a **hotel service**, a **rate service**, a **reservation service**, an **inventory service** and a **payment service**, each with its own database.',
        'A booking now spans inventory and payment, so one database transaction cannot cover it. If we charge the card and inventory then fails, or the reverse, we have a mess. This is the distributed transactions lesson.',
      ],
      keyIdea: 'Once the data is split across services, atomicity across them has to be built on purpose.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '?', p99: '350 ms', store: '85 GB/yr' },
      metricTones: { double: 'warn', p99: 'warn' },
      scene: {
        nodes: [
          { ...app, label: 'reservation', sub: 'service', icon: 'List', status: 'active' },
          { id: 'inventory', kind: 'block', at: at(4.4, -3), label: 'inventory', sub: 'own DB', icon: 'Table', tint: 'teal' },
          { id: 'payment', kind: 'block', at: at(2.6, 3.2), label: 'payment', sub: 'own DB', icon: 'Receipt', tint: 'amber' },
          { ...guestA, at: at(-4.4, 0) },
        ],
        links: [link('guestA', 'app'), link('app', 'inventory'), link('app', 'payment')],
        flows: [
          { path: ['guestA', 'app'], tone: 'request', label: 'book', duration: 1.2 },
          { path: ['app', 'inventory'], tone: 'request', label: 'take room', duration: 1.4, delay: 1.3 },
          { path: ['app', 'payment'], tone: 'request', label: 'charge card', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Two writes, no shared transaction',
          icon: 'Cable',
          rows: [
            { text: 'Room taken, charge fails', value: 'room stuck', tone: 'bad' },
            { text: 'Charged, room gone', value: 'refund owed', tone: 'bad' },
            { text: 'Both crash halfway', value: 'unknown', tone: 'warn' },
          ],
          footer: { text: 'Needs a saga or two-phase commit', tone: 'warn' },
        },
        caption: 'Two services, two databases',
      },
    },
    {
      title: 'Saga',
      tag: 'concept',
      heading: 'Hold the room, charge, then confirm',
      eli5: 'First a ticket is written "waiting", and the tent is held. Then the money desk takes payment. Only then does the ticket say "paid". If money fails, the hold is undone.',
      body: [
        'A **saga** runs the steps one by one, each with an undo. Step 1: take the room and write the reservation as `pending`. Step 2: charge the card. Step 3: mark `paid`. If step 2 fails, run the undo for step 1: release the room.',
        'This is the same shape as the low level design saga, now across services. The orchestrator records each step, so a crash can resume or compensate. Each undo must be safe to repeat.',
      ],
      keyIdea: 'A saga swaps one big transaction for small local ones plus undo steps, and every step is recorded.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '600 ms', store: '85 GB/yr' },
      metricTones: { double: 'good' },
      scene: {
        nodes: [
          { ...app, label: 'reservation', sub: 'saga driver', icon: 'List', status: 'active' },
          { id: 'inventory', kind: 'block', at: at(4.4, -3), label: 'inventory', sub: 'own DB', icon: 'Table', tint: 'teal' },
          { id: 'payment', kind: 'block', at: at(4.4, 4), label: 'payment', sub: 'own DB', icon: 'Receipt', tint: 'amber', chips: [{ text: 'charge failed', tone: 'bad' }] },
          { ...guestA, at: at(-4.4, 0) },
        ],
        links: [link('guestA', 'app'), link('app', 'inventory'), link('app', 'payment')],
        flows: [
          { path: ['app', 'inventory'], tone: 'request', label: '1 hold room', duration: 1.3 },
          { path: ['app', 'payment'], tone: 'request', label: '2 charge', duration: 1.3, delay: 1.5 },
          { path: ['payment', 'app'], tone: 'error', label: 'declined', duration: 1.2, delay: 2.9 },
          { path: ['app', 'inventory'], tone: 'event', label: 'undo: release', duration: 1.3, delay: 4.2 },
        ],
        panel: {
          title: 'Steps and undo',
          icon: 'Workflow',
          rows: [
            { text: '1 hold room, pending', value: 'undo: release' },
            { text: '2 charge card', value: 'undo: refund' },
            { text: '3 mark paid', value: 'last step' },
            { text: 'Step 2 fails', value: 'run undo of 1', tone: 'warn' },
          ],
          footer: { text: 'Orchestrator records each step', tone: 'good' },
        },
        caption: 'A failed charge releases the room',
      },
      code: {
        language: 'typescript',
        title: 'The booking saga',
        source: `async function book(req: BookReq) {
  const done: Array<() => Promise<void>> = [];
  try {
    await inventory.hold(req);   done.push(() => inventory.release(req));
    await payment.charge(req);   done.push(() => payment.refund(req));
    await reservations.markPaid(req.id);
  } catch (e) {
    for (const undo of done.reverse()) await undo(); // idempotent
    throw e;
  }
}`,
        highlight: [4, 5, 9],
      },
    },
    {
      title: 'Hold expiry',
      tag: 'case',
      heading: 'A guest walks away mid-payment',
      eli5: 'A family holds a tent, then wanders off to find their wallet. If they are not back in 10 minutes, the gate keeper tears up the ticket and the tent is free again.',
      body: [
        'A `pending` reservation holds inventory. If the guest closes the tab, those rooms stay held. Give each hold an `expires_at`, for example 10 minutes.',
        'A background job scans for expired pending rows, marks them `expired` and releases the room in one transaction. A late payment on an expired hold is refunded, never honored, unless the room is still free.',
      ],
      keyIdea: 'Every hold needs a timer, or abandoned checkouts will slowly empty your inventory.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '600 ms', store: '85 GB/yr' },
      scene: {
        nodes: [
          { id: 'sweeper', kind: 'worker', at: at(-4.4, -3), label: 'hold sweeper', sub: 'every minute', status: 'active' },
          { ...app, label: 'reservation', sub: 'service', icon: 'List' },
          { id: 'inventory', kind: 'block', at: at(4.4, -3), label: 'inventory', sub: 'own DB', icon: 'Table', tint: 'teal' },
        ],
        links: [link('sweeper', 'app'), link('app', 'inventory')],
        flows: [
          { path: ['sweeper', 'app'], tone: 'event', label: 'expired holds?', duration: 1.4 },
          { path: ['app', 'inventory'], tone: 'request', label: 'release 1 room', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'A hold with a timer',
          icon: 'Timer',
          rows: [
            { text: 'status', value: 'pending' },
            { text: 'created_at', value: '10:00' },
            { text: 'expires_at', value: '10:10', tone: 'warn' },
            { text: 'At 10:11', value: 'expired, room freed', tone: 'good' },
          ],
          footer: { text: 'Late payment is refunded', tone: 'muted' },
        },
        caption: 'Abandoned carts give the room back',
      },
    },
    {
      title: 'Payment unknown',
      tag: 'case',
      heading: 'The payment call times out. Did it charge?',
      eli5: 'The money desk does not answer. The family might have paid or not. The gate keeper asks again with the same ticket number, and the desk says what happened without charging twice.',
      body: [
        'A timeout tells us nothing. The card may be charged and the reply lost. Retrying a plain charge can bill twice, so send an **idempotency key** (the reservation id) to the payment service.',
        'Keep the reservation `pending` and ask for the charge status, or let the provider\'s webhook tell us. A reconciliation job compares our paid rows with the provider\'s records each night and fixes the gaps.',
      ],
      keyIdea: 'When an outcome is unknown, never guess. Ask again with the same key, then reconcile against the source of truth.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '2 s on timeout', store: '85 GB/yr' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...app, label: 'reservation', sub: 'service', icon: 'List', chips: [{ text: 'status = pending', tone: 'warn' }] },
          { id: 'payment', kind: 'block', at: at(4.4, -3), label: 'payment', sub: 'provider', icon: 'Receipt', tint: 'amber', status: 'hot' },
          { id: 'recon', kind: 'worker', at: at(0, 3.2), label: 'reconciler', sub: 'nightly', status: 'active' },
        ],
        links: [link('app', 'payment', { label: 'timeout 2 s', labelTone: 'warn' }), link('recon', 'payment', { style: 'dashed' })],
        flows: [
          { path: ['app', 'payment'], tone: 'request', label: 'charge, key 7f3c', duration: 1.5 },
          { path: ['payment', 'app'], tone: 'error', label: 'no reply', duration: 1.2, delay: 1.7 },
          { path: ['app', 'payment'], tone: 'request', label: 'status of 7f3c?', duration: 1.5, delay: 3.1 },
          { path: ['payment', 'app'], tone: 'response', label: 'charged once', duration: 1.5, delay: 4.7 },
        ],
        panel: {
          title: 'Do not guess',
          icon: 'Repeat',
          rows: [
            { text: 'Retry with same key', value: 'one charge', tone: 'good' },
            { text: 'Retry with new key', value: 'maybe two', tone: 'bad' },
            { text: 'Ask for status', value: 'safe', tone: 'good' },
            { text: 'Nightly reconcile', value: 'fixes gaps' },
          ],
          footer: { text: 'See the timeouts and retries lesson', tone: 'muted' },
        },
        caption: 'Same key, same charge',
      },
    },
    {
      title: 'Cancel',
      tag: 'case',
      heading: 'Cancel gives the nights back, once',
      eli5: 'A family cancels. The gate keeper crosses out their ticket, hands back the money, and adds the tent back to the board. If they cancel twice, nothing more happens.',
      body: [
        'Cancel moves `paid` to `canceled`, subtracts 1 from `total_reserved` on each night, and starts a refund. The status check makes it safe: a second cancel finds `canceled` and does nothing.',
        'Refund rules (free until 48 hours before, a fee after) belong in a policy table. The refund is its own saga step with a key, so a crash between canceling and refunding resumes rather than loses money.',
      ],
      keyIdea: 'Cancel is a state change plus an inventory release plus a refund, each repeat-safe.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '300 ms', store: '85 GB/yr' },
      scene: {
        nodes: [
          { ...guestA, chips: ['DELETE /reservations/7f3c'] },
          { ...app, label: 'reservation', sub: 'service', icon: 'List', status: 'active' },
          { id: 'inventory', kind: 'block', at: at(4.4, -3), label: 'inventory', sub: 'own DB', icon: 'Table', tint: 'teal' },
          { id: 'payment', kind: 'block', at: at(2.6, 3.2), label: 'payment', sub: 'refund', icon: 'Receipt', tint: 'amber' },
        ],
        links: [link('guestA', 'app'), link('app', 'inventory'), link('app', 'payment')],
        flows: [
          { path: ['guestA', 'app'], tone: 'request', label: 'cancel', duration: 1.2 },
          { path: ['app', 'inventory'], tone: 'request', label: 'reserved - 1', duration: 1.3, delay: 1.3 },
          { path: ['app', 'payment'], tone: 'request', label: 'refund, key 7f3c', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Cancel is repeat-safe',
          icon: 'Workflow',
          rows: [
            { text: 'First cancel', value: 'paid > canceled', tone: 'good' },
            { text: 'Rooms back', value: '3 nights, +1 each', tone: 'good' },
            { text: 'Second cancel', value: 'no change' },
            { text: 'Refund', value: 'keyed, once', tone: 'good' },
          ],
          footer: { text: 'Fee rules live in a policy table', tone: 'muted' },
        },
        caption: 'The status makes a second cancel harmless',
      },
    },
    {
      title: 'DB failover',
      tag: 'case',
      heading: 'The primary dies in the middle of a rush',
      eli5: 'The clipboard falls in a puddle. A spare copy sits at the next desk, and the gate keeper switches to it. A few of the last signatures may be missing, so they are double checked.',
      body: [
        'A replica is promoted (the failover lesson). Bookings pause for about 30 seconds, then resume. With synchronous replication a committed booking is on the replica. With asynchronous, the last few may be lost.',
        'A guest who got "confirmed" for a lost write must be found and fixed. Retries with the same `reservation_id` are safe, and the nightly reconciler compares payments against reservations to catch any gap.',
      ],
      keyIdea: 'Bookings are money. Prefer synchronous replication for the booking database and let retries and reconciliation close any remaining gaps.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '30 s blip', store: '85 GB/yr' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['retry, same id'] },
          { ...db, label: 'old primary', status: 'down' },
          { id: 'replica', kind: 'replica', at: at(4.4, 4), label: 'new primary', sub: 'was replica', status: 'ok', badge: 'promoted' },
        ],
        links: [link('app', 'db'), link('app', 'replica')],
        flows: [
          { path: ['app', 'db'], tone: 'error', label: 'no answer', duration: 1.3 },
          { path: ['app', 'replica'], tone: 'request', label: 'book again', duration: 1.4, delay: 1.6 },
          { path: ['replica', 'app'], tone: 'response', label: '201', duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Failover choices',
          icon: 'Shield',
          rows: [
            { text: 'Synchronous copy', value: 'no lost bookings', tone: 'good' },
            { text: 'Asynchronous copy', value: 'last writes may go', tone: 'warn' },
            { text: 'Retry with same id', value: 'safe', tone: 'good' },
            { text: 'Nightly reconcile', value: 'finds the gaps' },
          ],
          footer: { text: 'See the replication lesson', tone: 'muted' },
        },
        caption: 'Promote the replica, retry safely',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One promise, kept at every layer',
      eli5: 'One gate keeper, one clipboard, a night board for peeking, tickets with numbers, a timer on holds, and a spare clipboard. Each piece keeps a tent from being promised twice.',
      body: [
        'Numbers: 27 bookings and 2.7K searches a second, 85 GB a year. One relational primary with a cache and replicas is enough. Model room types per night, and guard with a lock, version or constraint.',
        'Add client ids for repeats, a cap for overbooking and rates stored on the reservation. Past one database use a saga with hold expiry, keyed payments, cancel that restores nights, and a safe failover.',
      ],
      keyIdea: 'Protect the one promise with the database, make every retry safe, and give every hold a timer.',
      metrics: { book: '27/s peak', search: '2.7K/s peak', double: '0', p99: '100 ms', store: '85 GB/yr' },
      metricTones: { double: 'good', p99: 'good' },
      scene: {
        nodes: [
          { ...guestA, label: 'guests' },
          { ...app, label: 'booking app', sub: 'saga driver', status: 'ok' },
          { ...cache, status: 'ok' },
          { ...db, status: 'ok', badge: '0 double books' },
        ],
        links: [link('guestA', 'app'), link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['guestA', 'app', 'cache', 'app', 'guestA'], tone: 'request', label: 'search', duration: 2.2 },
          { path: ['guestA', 'app', 'db', 'app', 'guestA'], tone: 'request', label: 'book', duration: 2.4, delay: 2.4 },
        ],
        panel: {
          title: 'The design on a page',
          icon: 'List',
          rows: [
            { text: 'Data', value: 'room type x night rows', tone: 'good' },
            { text: 'Guard', value: 'lock, version or CHECK', tone: 'good' },
            { text: 'Repeats', value: 'client reservation id' },
            { text: 'Holds', value: 'expire in 10 min' },
            { text: 'Payments', value: 'saga + keyed charge' },
          ],
          footer: { text: 'Correct first, then fast', tone: 'good' },
        },
        caption: 'Cache for reads, database for the promise',
      },
      quiz: {
        question: 'Two guests try to book the last room at the same instant. Which design keeps it from being sold twice?',
        options: [
          'Read availability from the cache, then write the booking',
          'Check the count in the app, then insert the reservation in a second statement',
          'Do the check and the update in one transaction with a row lock, a version check or a CHECK constraint',
          'Retry every failed booking until one succeeds',
        ],
        answer: 2,
        explain: 'The check and the write must be one atomic step guarded by the database. A cache read or a separate check leaves a gap in which both guests pass, and blind retries only repeat the race.',
      },
    },
  ],
};
