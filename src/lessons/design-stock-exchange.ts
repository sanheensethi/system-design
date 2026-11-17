import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const firms: SceneNode = { id: 'firms', kind: 'client', at: at(-6.4, -3.2), label: 'member firms', sub: 'banks, HFT' };
const gw: SceneNode = { id: 'gw', kind: 'block', size: 0.8, at: at(-3.2, -3.2), label: 'gateway', sub: 'risk checks', icon: 'Shield', tint: 'amber' };
const seq: SceneNode = { id: 'seq', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'sequencer', sub: 'single writer', icon: 'Hash', tint: 'violet' };
const eng: SceneNode = { id: 'eng', kind: 'block', size: 0.8, at: at(3.2, -3.2), label: 'matching engine', sub: 'one per symbol', icon: 'Scale', tint: 'green' };
const md: SceneNode = { id: 'md', kind: 'block', size: 0.8, at: at(6.4, -3.2), label: 'market data', sub: 'UDP multicast', icon: 'Rss', tint: 'blue' };
const tape: SceneNode = { id: 'tape', kind: 'queue', at: at(0, 3.4), label: 'tape', sub: 'replicated log' };
const clr: SceneNode = { id: 'clr', kind: 'block', size: 0.8, at: at(3.2, 3.4), label: 'clearing', sub: 'settlement', icon: 'Receipt', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designStockExchange: Lesson = {
  id: 'design-stock-exchange',
  title: 'Design a stock exchange',
  tagline: 'Match buyers and sellers in microseconds, in a fair order, and be able to replay the whole day exactly.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Requirements and scale: orders per second, microsecond latency, determinism, no data loss',
    'The order API, the order book and price-time priority matching',
    'Why a normal database design fails, and the sequencer plus tape that replaces it',
    'One writer per symbol, kernel bypass, FPGAs and colocation',
    'Market data over UDP multicast, gap fills, clearing and failure cases',
  ],
  metrics: [
    { key: 'orders', label: 'Orders', icon: 'Activity' },
    { key: 'latency', label: 'Wire to wire', icon: 'Timer' },
    { key: 'fanout', label: 'Market data', icon: 'Rss' },
    { key: 'loss', label: 'Data loss', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'The ask',
      tag: 'problem',
      heading: 'Millions of orders a second, and every one must be fair',
      eli5: 'At a school sticker swap, kids shout what they want to trade. If two kids want the same sticker, the teacher must pick the one who shouted first, every single time, with nobody arguing.',
      body: [
        'A **stock exchange** matches people who want to buy a share with people who want to sell it. Peak load is about **10M orders/sec** and **100M market-data messages/sec**.',
        'Matching must finish in under **10 μs** wire to wire. Fairness is regulated by law, and a share sold twice is a crime, not a bug.',
      ],
      keyIdea: 'This is the most extreme latency system in commercial computing. Speed, fairness and exactness all matter at once.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      metricTones: { latency: 'warn', loss: 'good' },
      scene: {
        nodes: [
          { ...firms, status: 'hot', chips: [{ text: 'BUY 100 ACME @ 50.10', tone: 'warn' }] },
          { ...eng, status: 'active', badge: 'match in < 10 μs' },
          { ...md, chips: ['100M msg/s'] },
        ],
        links: [link('firms', 'eng', { label: '10M orders/s' }), link('eng', 'md')],
        flows: [
          { path: ['firms', 'eng'], tone: 'request', label: 'orders', count: 3, duration: 1.2 },
          { path: ['eng', 'md'], tone: 'event', label: 'trades', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The hard targets',
          icon: 'Gauge',
          rows: [
            { text: 'Peak orders', value: '~10M / sec' },
            { text: 'Peak market data', value: '~100M msg / sec' },
            { text: 'Match latency', value: '< 10 μs', tone: 'warn' },
            { text: 'Replay the tape', value: 'same output', tone: 'good' },
            { text: 'Data lost on crash', value: 'zero', tone: 'good' },
          ],
        },
        caption: 'Speed, fairness and exactness together',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'Four requirements decide the whole design',
      eli5: 'The sticker-swap teacher keeps a written list of every shout in order. If anyone doubts a swap, the class re-reads the list and must reach the same result.',
      body: [
        '**Latency:** under 10 μs to match. **Throughput:** millions of orders a second. **Determinism:** replaying the input tape must give the exact same output tape, because regulators audit this.',
        '**Durability:** nothing is lost, ever. After a crash the tape rebuilds all state. Availability matters too, but a wrong trade is worse than a pause.',
      ],
      keyIdea: 'Determinism and durability make the input log the source of truth. Everything else can be rebuilt from it.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { ...firms },
          { ...seq, status: 'active' },
          { ...tape, status: 'active' },
          { ...eng },
        ],
        links: [link('firms', 'seq'), link('seq', 'tape'), link('seq', 'eng')],
        flows: [
          { path: ['firms', 'seq'], tone: 'request', label: 'orders', duration: 1.2 },
          { path: ['seq', 'tape'], tone: 'data', label: 'write first', duration: 1.2, delay: 1.3 },
          { path: ['seq', 'eng'], tone: 'event', label: 'then match', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Requirement to consequence',
          icon: 'List',
          rows: [
            { text: 'Microsecond match', value: 'no fsync, no extra hop on the match path' },
            { text: 'Determinism', value: 'one ordered input' },
            { text: 'No loss', value: 'log before matching' },
            { text: 'Fairness', value: 'first in, first served' },
          ],
        },
        caption: 'The log comes first, matching comes second',
      },
    },
    {
      title: 'Order API',
      tag: 'concept',
      heading: 'The API: a few small binary messages',
      eli5: 'Each kid hands the teacher a tiny card: what they want, how many, and the most they will pay. Cards are short so the teacher reads them fast and never misreads one.',
      body: [
        'Firms send **new order**, **cancel** and **replace** messages over FIX or a compact binary protocol, on 10, 40 or 100 GbE. A **limit order** has a price. A **market order** takes the best price available.',
        'Every message carries a firm-chosen `client_order_id`, so a resent order is recognized as a duplicate. The exchange answers with an ack, a fill or a reject.',
      ],
      keyIdea: 'Few message types, fixed-size fields and a client order id. Small, binary and safe to retry.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { ...firms, chips: ['NEW  BUY 100 @ 50.10'] },
          { ...gw, status: 'active', chips: ['ack | fill | reject'] },
          { ...seq },
        ],
        links: [link('firms', 'gw', { label: 'FIX / binary, 10-100 GbE', arrow: 'both' }), link('gw', 'seq')],
        flows: [
          { path: ['firms', 'gw', 'seq'], tone: 'request', label: 'NEW', duration: 1.6 },
          { path: ['gw', 'firms'], tone: 'response', label: 'ack', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'Message types',
          icon: 'Braces',
          code: 'NEW     side qty px client_order_id\nCANCEL  order_id\nREPLACE order_id qty px\nACK     order_id seq_no\nFILL    order_id qty px\nREJECT  client_order_id reason',
        },
        caption: 'Six small messages carry everything',
      },
      code: {
        language: 'typescript',
        title: 'A new order as a fixed-size record',
        source: `type NewOrder = {
  type: 'NEW';
  clientOrderId: bigint;  // chosen by the firm, makes retries safe
  symbol: string;         // 'ACME'
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET';
  qty: number;            // whole shares
  priceTicks: number;     // 5010 means 50.10, never a float
};`,
        highlight: [3, 8],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Data model: orders, a book per symbol, trades and a tape',
      eli5: 'The teacher keeps one page per sticker type. Left column lists kids who want to buy, right column lists kids who want to sell, and a notebook records every swap.',
      body: [
        'An **order** has an id, symbol, side, price, quantity and a sequence number. Prices are integer **ticks**, never floats, so sums are exact.',
        'The **order book** per symbol holds resting orders in memory. A **trade** records buyer, seller, price and quantity. The **tape** is the append-only log of every input event.',
      ],
      keyIdea: 'Live state is an in-memory book. The tape is the durable truth the book is rebuilt from.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { ...eng, status: 'active', chips: ['book: in memory'] },
          { ...tape, chips: ['events: append only'] },
          { ...clr, chips: ['trades'] },
        ],
        links: [link('tape', 'eng', { label: 'rebuilds' }), link('eng', 'clr', { label: 'trades' })],
        flows: [
          { path: ['tape', 'eng'], tone: 'data', label: 'events', count: 2, duration: 1.4 },
          { path: ['eng', 'clr'], tone: 'event', label: 'trades', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Core records',
          icon: 'Table',
          rows: [
            { text: 'Order', value: 'id, symbol, side, px, qty, seq' },
            { text: 'Book (per symbol)', value: 'bids + asks, in RAM' },
            { text: 'Trade', value: 'buy id, sell id, px, qty' },
            { text: 'Tape', value: 'every input, in order', tone: 'good' },
          ],
        },
        caption: 'State in RAM, truth on the tape',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple design: app servers and a SQL database',
      eli5: 'Every kid walks up to a helper, who runs to a filing cabinet, checks the sticker page, writes a swap, and runs back. It works for ten kids.',
      body: [
        'A web service accepts orders over HTTP. Each order is a transaction: read the opposite side of the book, update rows, insert a trade, commit.',
        'Locks keep two buyers from taking the same sell order. At a few hundred orders a second, this is correct and easy to build.',
      ],
      keyIdea: 'A transactional database gives correctness for free, at a price in latency that we have not measured yet.',
      metrics: { orders: '300/s', latency: '15 ms', fanout: 'polling', loss: 'none' },
      scene: {
        nodes: [
          { ...firms, at: at(-3.8, -3.2), chips: ['POST /orders'] },
          { id: 'app', kind: 'server', at: at(0, -3.2), label: 'app server', sub: 'HTTP + SQL' },
          { id: 'sql', kind: 'db', at: at(3.8, -3.2), label: 'orders DB', sub: 'rows + locks' },
        ],
        links: [link('firms', 'app', { label: 'HTTPS' }), link('app', 'sql', { label: 'BEGIN ... COMMIT' })],
        flows: [
          { path: ['firms', 'app', 'sql'], tone: 'request', label: 'order', duration: 1.6 },
          { path: ['sql', 'app', 'firms'], tone: 'response', label: 'filled', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One order, one transaction',
          icon: 'Code',
          code: 'BEGIN;\nSELECT ... FROM asks WHERE px <= 50.10\n  ORDER BY px, ts FOR UPDATE;\nUPDATE asks ...;\nINSERT INTO trades ...;\nCOMMIT;',
        },
        caption: 'Correct, and fine at small scale',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'Where it breaks: milliseconds and lock contention',
      eli5: 'With a thousand kids, the helper and the filing cabinet are the line. Everyone waits for the same drawer, and a kid who shouted later may get served first.',
      body: [
        'A transaction costs milliseconds: network hops, disk commits, locks. We need microseconds, about **1,000 times faster**.',
        'Popular symbols make every order fight for the same rows. Lock queues grow, arrival order stops matching fill order, and fairness is gone.',
      ],
      keyIdea: 'Latency from locks, disk and network hops is the enemy. The design must remove them, not tune them.',
      metrics: { orders: '30K/s max', latency: '15 ms', fanout: 'polling', loss: 'none' },
      metricTones: { orders: 'bad', latency: 'bad' },
      scene: {
        nodes: [
          { ...firms, at: at(-3.8, -3.2), chips: [{ text: '10M orders/s', tone: 'bad' }] },
          { id: 'app', kind: 'server', at: at(0, -3.2), label: 'app server', status: 'hot', load: 96 },
          { id: 'sql', kind: 'db', at: at(3.8, -3.2), label: 'orders DB', status: 'hot', badge: 'lock queue: 9,000' },
        ],
        links: [link('firms', 'app'), link('app', 'sql', { label: 'row locks', labelTone: 'warn' })],
        flows: [
          { path: ['firms', 'app'], tone: 'request', label: 'orders', count: 4, duration: 1 },
          { path: ['app', 'sql'], tone: 'error', label: 'waiting', count: 3, duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'Budget check',
          icon: 'Timer',
          rows: [
            { text: 'Target', value: '10 μs', tone: 'good' },
            { text: 'Network hop', value: '~500 μs', tone: 'warn' },
            { text: 'Disk commit', value: '~1 ms', tone: 'bad' },
            { text: 'Lock wait', value: 'unbounded', tone: 'bad' },
          ],
          footer: { text: 'The budget is gone before matching starts', tone: 'bad' },
        },
        caption: 'Every layer costs more than the whole budget',
      },
    },
    {
      title: 'Order book',
      tag: 'concept',
      heading: 'The order book: two sorted sides, FIFO at each price',
      eli5: 'On the sticker page, buyers are listed with the highest offer first and sellers with the lowest ask first. Kids with the same price stand in a line, earliest first.',
      body: [
        'Per symbol the engine keeps **bids** (buys, highest price first) and **asks** (sells, lowest price first). Each price is a **level** holding a FIFO queue of orders.',
        'The gap between the best bid and best ask is the **spread**. A trade can only happen when a bid reaches or crosses an ask.',
      ],
      keyIdea: 'A book is two sorted sides of price levels, each level a FIFO queue. The best prices sit at the front.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { id: 'bids', kind: 'block', size: 0.8, at: at(-3.4, 0), label: 'bids', sub: 'buyers, high first', icon: 'TrendingUp', tint: 'green', chips: ['50.10 x 300', '50.05 x 120'] },
          { id: 'asks', kind: 'block', size: 0.8, at: at(3.4, 0), label: 'asks', sub: 'sellers, low first', icon: 'TrendingUp', tint: 'red', chips: ['50.12 x 200', '50.20 x 500'] },
        ],
        links: [link('bids', 'asks', { label: 'spread 0.02', arrow: 'none', style: 'dashed' })],
        flows: [],
        panel: {
          title: 'ACME book (top levels)',
          icon: 'Table',
          rows: [
            { text: 'ask 50.20', value: '500', tone: 'bad' },
            { text: 'ask 50.12', value: '200', tone: 'bad' },
            { text: 'bid 50.10', value: '300', tone: 'good' },
            { text: 'bid 50.05', value: '120', tone: 'good' },
          ],
          footer: { text: 'Within a level: oldest order first', tone: 'muted' },
        },
        caption: 'No bid reaches an ask, so nothing trades yet',
      },
    },
    {
      title: 'Matching',
      tag: 'concept',
      heading: 'Matching by price-time priority',
      eli5: 'A new kid offers a high price for a sticker. The teacher pairs them with the cheapest seller first, and among equal prices the kid who waited longest.',
      body: [
        'An incoming buy at price P walks the asks from the lowest price up while `ask <= P`. At each level it fills against the **oldest** resting order first. This is **price-time priority**.',
        'Whatever quantity is left rests in the book as a new bid. Each fill is emitted as a trade at the resting order\'s price.',
      ],
      keyIdea: 'Best price wins. Ties go to whoever arrived first. That second rule is the fairness guarantee.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { ...firms, at: at(-3.6, -3.2), chips: ['BUY 250 @ 50.15'] },
          { ...eng, at: at(0, -3.2), status: 'active', badge: 'match' },
          { id: 'asks', kind: 'block', size: 0.8, at: at(3.6, -3.2), label: 'asks', sub: 'oldest first', icon: 'TrendingUp', tint: 'red', chips: ['50.12 x 200', '50.20 x 500'] },
        ],
        links: [link('firms', 'eng'), link('eng', 'asks', { arrow: 'both' })],
        flows: [
          { path: ['firms', 'eng'], tone: 'request', label: 'BUY 250', duration: 1.2 },
          { path: ['eng', 'asks'], tone: 'request', label: 'take 200 @ 50.12', duration: 1.2, delay: 1.3 },
          { path: ['eng', 'firms'], tone: 'response', label: 'fill 200, rest 50', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Result of the walk',
          icon: 'Receipt',
          rows: [
            { text: 'Fill', value: '200 @ 50.12', tone: 'good' },
            { text: '50.20 level', value: 'above limit, stop' },
            { text: 'Remainder', value: '50 rests as bid 50.15' },
          ],
        },
        caption: 'Cheapest ask first, then rest the remainder',
      },
      code: {
        language: 'python',
        title: 'Match a buy order against the ask book',
        source: `def match_buy(order):
    while order.qty > 0 and asks and asks.best().price <= order.price:
        level = asks.best()              # lowest ask price
        resting = level.front()          # oldest order at that price
        fill = min(order.qty, resting.qty)
        emit_trade(order, resting, level.price, fill)
        order.qty -= fill
        resting.qty -= fill
        if resting.qty == 0:
            level.pop_front()
            if level.empty():
                asks.remove_level(level.price)
    if order.qty > 0:
        bids.insert(order)               # leftover rests in the book
    emit_book_update()`,
        highlight: [2, 4, 5, 14],
      },
      quiz: {
        question: 'Two sell orders rest at 50.12, placed one second apart. A buy arrives that can only fill one. Which sell is filled?',
        options: ['The larger one', 'The older one', 'Whichever the engine finds first in memory', 'Both, split evenly'],
        answer: 1,
        explain: 'Price-time priority: same price, so the earlier arrival goes first. Size and memory layout never decide.',
      },
    },
    {
      title: 'Order lifecycle',
      tag: 'concept',
      heading: 'Order lifecycle: market, IOC, cancel and replace',
      eli5: 'Some kids say "any price, I just want it". Some say "now or never". Some change their mind. The teacher must handle each, and a kid who asks for more stickers goes to the back of the line.',
      body: [
        'A **market order** is treated as a limit order at infinity (or zero for a sell), so it walks the book until filled. **IOC** (immediate or cancel) fills what it can and cancels the unfilled remainder. **FOK** fills fully or not at all.',
        'A **cancel** removes the order from its level in O(1) through an order-id map. A **replace** that raises quantity or changes price loses time priority and rejoins the back of the queue. Lowering quantity keeps priority.',
      ],
      keyIdea: 'Every order type reduces to limit matching plus a rule for the remainder. Priority is only kept when a change cannot cut the line.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { ...firms, at: at(-3.6, -3.2), chips: ['REPLACE qty 100 to 500'] },
          { ...eng, at: at(0, -3.2), status: 'active', badge: 'order-id map' },
          { id: 'bids', kind: 'block', size: 0.8, at: at(3.6, -3.2), label: 'bids', sub: 'FIFO per level', icon: 'TrendingUp', tint: 'green', chips: ['50.10: A, B, C'] },
        ],
        links: [link('firms', 'eng'), link('eng', 'bids', { arrow: 'both' })],
        flows: [
          { path: ['firms', 'eng'], tone: 'request', label: 'REPLACE', duration: 1.2 },
          { path: ['eng', 'bids'], tone: 'event', label: 'move to back', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Order type rules',
          icon: 'List',
          rows: [
            { text: 'Market', value: 'limit at infinity' },
            { text: 'IOC', value: 'cancel the remainder', tone: 'good' },
            { text: 'Cancel', value: 'O(1) by order id', tone: 'good' },
            { text: 'Replace up or reprice', value: 'loses priority', tone: 'warn' },
            { text: 'Replace qty down', value: 'keeps priority' },
          ],
        },
        caption: 'Changing an order must not cut the line',
      },
    },
    {
      title: 'Gateway',
      tag: 'concept',
      heading: 'The gateway checks every order before it counts',
      eli5: 'Before a card reaches the teacher, a helper at the door checks it: is this kid allowed to swap, and do they really have the stickers they offer?',
      body: [
        'The **gateway** (order management) authenticates the firm, checks **entitlements** and runs **pre-trade risk**: size limits, price bands, and credit.',
        'A bad order is rejected here and never reaches the sequencer. This keeps the core small and its work predictable.',
      ],
      keyIdea: 'Reject bad orders at the edge. The core only ever sees orders it is allowed to match.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { ...firms, chips: ['BUY 5,000,000 @ 99'] },
          { ...gw, status: 'active', chips: [{ text: 'REJECT: fat finger', tone: 'bad' }] },
          { ...seq, status: 'dim' },
        ],
        links: [link('firms', 'gw'), link('gw', 'seq')],
        flows: [
          { path: ['firms', 'gw'], tone: 'request', label: 'order', duration: 1.2 },
          { path: ['gw', 'firms'], tone: 'error', label: 'reject', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Pre-trade checks',
          icon: 'Shield',
          rows: [
            { text: 'Firm authenticated', value: 'yes', tone: 'good' },
            { text: 'Entitled to symbol', value: 'yes', tone: 'good' },
            { text: 'Qty within limit', value: 'no', tone: 'bad' },
            { text: 'Price within band', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'Bad orders die at the door',
      },
    },
    {
      title: 'Sequencer',
      tag: 'concept',
      heading: 'The sequencer gives every event one global number',
      eli5: 'One grown-up stands at the front and stamps every card with the next number: 1, 2, 3. Whoever has the lower stamp was first. No two cards ever share a number.',
      body: [
        'The **sequencer** is a single writer. It stamps each accepted event with the next `seq_no`. Arrival order at the sequencer is the official order of the exchange.',
        'One writer needs no locks and no agreement between machines. It does one cheap thing, so it can keep up.',
      ],
      keyIdea: 'A single writer that stamps a number gives total order with no coordination cost.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'none allowed' },
      scene: {
        nodes: [
          { ...gw },
          { ...seq, status: 'active', badge: 'seq_no 4,812,903' },
          { ...eng },
        ],
        links: [link('gw', 'seq'), link('seq', 'eng')],
        flows: [
          { path: ['gw', 'seq'], tone: 'request', label: 'event', count: 3, duration: 1.2 },
          { path: ['seq', 'eng'], tone: 'event', label: '#...902, #...903', count: 2, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Stamped events',
          icon: 'Hash',
          rows: [
            { text: '#4,812,901', value: 'NEW BUY 100' },
            { text: '#4,812,902', value: 'NEW SELL 40' },
            { text: '#4,812,903', value: 'CANCEL 77' },
          ],
          footer: { text: 'Order of stamps is the order of the exchange', tone: 'muted' },
        },
        caption: 'One writer, one counter',
      },
    },
    {
      title: 'The tape',
      tag: 'concept',
      heading: 'The tape: write the log before the engine sees it',
      eli5: 'Before anyone acts on a stamped card, a copy goes into the class notebook, and a second notebook in another room. Only then does the teacher pair kids up.',
      body: [
        'The sequencer appends every event to a replicated log, the **tape**. It is copied to peers over low-latency multicast or RDMA into memory-resident or NVMe journals, and the engine consumes an event as soon as a quorum or standby holds it. Flushing to durable storage happens asynchronously, off the match path.',
        'This is the same single-writer log idea as in the message queue lesson, with one rule: the log is written before anything reacts to it.',
      ],
      keyIdea: 'Log first, act second. Whatever the engine did, the tape can prove and repeat.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      metricTones: { loss: 'good' },
      scene: {
        nodes: [
          { ...seq, at: at(-3.2, -3.2) },
          { ...tape, at: at(0, 0.2), status: 'active', badge: '2 replicas' },
          { ...eng, at: at(3.2, -3.2) },
        ],
        links: [link('seq', 'tape', { label: 'write first' }), link('tape', 'eng', { label: 'then deliver' })],
        flows: [
          { path: ['seq', 'tape'], tone: 'data', label: '#903', duration: 1.2 },
          { path: ['tape', 'eng'], tone: 'event', label: '#903', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Order of operations',
          icon: 'List',
          rows: [
            { text: '1. stamp seq_no', value: 'sequencer' },
            { text: '2. append and replicate', value: 'tape', tone: 'good' },
            { text: '3. apply to book', value: 'engine' },
            { text: '4. publish result', value: 'market data' },
          ],
        },
        caption: 'Nothing happens that is not on the tape',
      },
    },
    {
      title: 'Replay',
      tag: 'concept',
      heading: 'Deterministic replay: the engine is a pure function of the tape',
      eli5: 'If the notebook is lost, a new teacher can read it from page one and make the exact same swaps. That works only if the teacher uses no coin flips and no clock.',
      body: [
        'The engine is a **deterministic state machine**: same events in the same order give the same book and the same trades. It reads no wall clock and uses no randomness. Time comes from the tape.',
        'Crash recovery is replay. A regulator audit is replay with that day\'s code version, checked trade by trade. This is the LMAX architecture: event sourcing around a single-threaded business logic thread, fed by a Disruptor ring buffer.',
      ],
      keyIdea: 'Determinism turns recovery and audit into the same operation: replay the tape.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      scene: {
        nodes: [
          { ...tape, at: at(-3.4, -0.6), chips: ['events 1..N'] },
          { ...eng, at: at(0, -3.2), status: 'active', badge: 'replaying' },
          { id: 'out', kind: 'block', size: 0.72, at: at(3.4, -0.6), label: 'trade tape', sub: 'identical output', icon: 'Receipt', tint: 'teal', status: 'ok' },
        ],
        links: [link('tape', 'eng'), link('eng', 'out')],
        flows: [
          { path: ['tape', 'eng'], tone: 'data', label: 'events', count: 3, duration: 1.4 },
          { path: ['eng', 'out'], tone: 'event', label: 'same trades', count: 2, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Replay rules',
          icon: 'Repeat',
          code: 'state = empty_books()\nfor ev in tape:        # in seq_no order\n    state.apply(ev)    # no clock, no random\n    out.write(trades)\nassert out == recorded_out',
        },
        caption: 'Same input tape, same output tape',
      },
    },
    {
      title: 'Per symbol',
      tag: 'concept',
      heading: 'One thread owns each book, no locks',
      eli5: 'Each sticker type gets its own teacher at its own table. Within one table, one person pairs kids up, so there is never a fight over who touches the page.',
      body: [
        'A book is only touched by one thread, so it needs no locks. **Parallelism is per symbol**, never per order, because order within a symbol is the product.',
        'Symbols are split across engines, as in the sharding lesson, and an engine hosts a set of symbols. The global `seq_no` stays one sequence. Each engine receives only its own symbols\' events in that order, so its stream has gaps in the global numbers but never reorders them.',
      ],
      keyIdea: 'One thread owns each book, and an engine hosts a set of symbols. Scale out across symbols, never split ordering inside one.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      scene: {
        nodes: [
          { ...seq, at: at(-4, -3.2) },
          { id: 'e1', kind: 'block', size: 0.72, at: at(0, -3.2), label: 'engine A', sub: 'AAPL, ACME', icon: 'Scale', tint: 'green', load: 55 },
          { id: 'e2', kind: 'block', size: 0.72, at: at(3.2, 0.4), label: 'engine B', sub: 'MSFT, ZETA', icon: 'Scale', tint: 'green', load: 48 },
          { id: 'e3', kind: 'block', size: 0.72, at: at(-2, 2.6), label: 'engine C', sub: 'the rest', icon: 'Scale', tint: 'green', load: 30 },
        ],
        links: [link('seq', 'e1'), link('seq', 'e2'), link('seq', 'e3')],
        flows: [
          { path: ['seq', 'e1'], tone: 'event', label: 'AAPL', duration: 1.2 },
          { path: ['seq', 'e2'], tone: 'event', label: 'MSFT', duration: 1.2, delay: 0.4 },
          { path: ['seq', 'e3'], tone: 'event', label: 'other symbols', duration: 1.2, delay: 0.8 },
        ],
        panel: {
          title: 'Routing rule',
          icon: 'Split',
          rows: [
            { text: 'Key', value: 'symbol' },
            { text: 'Threads per book', value: '1', tone: 'good' },
            { text: 'Locks', value: 'none', tone: 'good' },
          ],
        },
        caption: 'Many symbols in parallel, one thread each',
      },
      quiz: {
        question: 'Why does the exchange avoid matching orders for one symbol on several threads?',
        options: ['Threads are too slow', 'Order within a symbol is the product, and locks would add latency', 'It saves memory', 'The tape cannot hold parallel events'],
        answer: 1,
        explain: 'Price-time fairness needs one agreed order per symbol. Parallel matching would need locks, and arrival order could drift.',
      },
    },
    {
      title: 'Kernel bypass',
      tag: 'tradeoff',
      heading: 'Kernel bypass: skip the operating system',
      eli5: 'Normally every card goes through a mail room that sorts and stamps it. Kernel bypass hands the card straight from the door to the teacher, skipping the mail room.',
      body: [
        'The OS network stack costs about **10 μs** per packet (roughly 5 to 15 μs). With **kernel bypass** (DPDK, OpenOnload) the NIC writes packets straight into user-space ring buffers, and the engine polls them. That drops to about **1 μs**.',
        'The cost is a thread that spins at 100% CPU and your own handling of what the kernel did for you.',
      ],
      keyIdea: 'At this budget the OS is overhead. Poll the NIC directly and pay in CPU and complexity.',
      metrics: { orders: '10M/s peak', latency: '~ 1 μs hop', fanout: '100M msg/s', loss: 'zero' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { id: 'nic', kind: 'block', size: 0.72, at: at(-3.4, -1.4), label: 'NIC', sub: 'DMA to user space', icon: 'Cable', tint: 'blue' },
          { id: 'kern', kind: 'block', size: 0.72, at: at(0, 1.2), label: 'kernel stack', sub: '~10 μs', icon: 'Layers', tint: 'gray', status: 'dim' },
          { ...eng, at: at(3.4, -1.4), status: 'active', load: 100, chips: ['busy polling'] },
        ],
        links: [link('nic', 'kern', { style: 'faint', label: 'skipped' }), link('nic', 'eng', { label: 'ring buffer', route: 'straight' })],
        flows: [{ path: ['nic', 'eng'], tone: 'request', label: 'packet', count: 3, duration: 1 }],
        panel: {
          title: 'Per-packet cost',
          icon: 'Timer',
          rows: [
            { text: 'Through the kernel', value: '~10 μs', tone: 'bad' },
            { text: 'Kernel bypass', value: '~1 μs', tone: 'good' },
          ],
          footer: { text: 'Bought with a core that never sleeps', tone: 'warn' },
        },
        caption: 'Packets land in the engine\'s memory directly',
      },
    },
    {
      title: 'FPGA',
      tag: 'tradeoff',
      heading: 'FPGAs: checks in hardware',
      eli5: 'The door helper is replaced by a machine wired to do exactly one check, so fast that the kid has not finished walking through the door before it says yes.',
      body: [
        'An **FPGA** is a chip wired for one job. Pre-trade risk checks and filters run there in about **100 ns** each, with no scheduler jitter. Some engines run matching itself on FPGA.',
        'The tradeoff is development cost. Hardware is slow to change, so rules that change daily stay in software and stable ones move to the chip.',
      ],
      keyIdea: 'Move the stable, hot checks into hardware. Keep fast-changing logic in software.',
      metrics: { orders: '10M/s peak', latency: '~ 100 ns check', fanout: '100M msg/s', loss: 'zero' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...firms, at: at(-3.4, -1.6) },
          { ...gw, at: at(0, -1.6), label: 'FPGA gateway', sub: '100 ns per check', status: 'active', chips: ['risk in hardware'] },
          { ...seq, at: at(3.4, -1.6) },
        ],
        links: [link('firms', 'gw'), link('gw', 'seq')],
        flows: [{ path: ['firms', 'gw', 'seq'], tone: 'request', label: 'checked order', count: 3, duration: 1.4 }],
        panel: {
          title: 'Software vs hardware check',
          icon: 'Cpu',
          rows: [
            { text: 'Software risk check', value: '~ 5 μs', tone: 'warn' },
            { text: 'FPGA risk check', value: '~ 100 ns', tone: 'good' },
            { text: 'Change a rule', value: 'weeks vs minutes', tone: 'warn' },
          ],
        },
        caption: 'Fast and rigid, so use it for stable rules',
      },
    },
    {
      title: 'Colocation',
      tag: 'tradeoff',
      heading: 'Colocation: distance is latency, so make it equal',
      eli5: 'Kids close to the teacher have a head start. So the class rule is that every kid stands the same number of steps away, no matter who they are.',
      body: [
        'Customers rent racks meters from the engine. Light covers about 3 ns per meter in a vacuum and about 5 ns in fiber, so cable length is now the limit.',
        'To keep it fair, the exchange gives every customer the **same cable length**, coiling extra fiber for those who sit closer.',
      ],
      keyIdea: 'Past a point, speed is physics. Fairness then means equalizing distance, not minimizing it.',
      metrics: { orders: '10M/s peak', latency: '~ 5 ns per meter', fanout: '100M msg/s', loss: 'zero' },
      scene: {
        nodes: [
          { id: 'f1', kind: 'client', at: at(-5.4, -3.8), label: 'firm A', sub: '30 m + coil' },
          { id: 'f2', kind: 'client', at: at(-2.4, 3.6), label: 'firm B', sub: '70 m' },
          { ...gw, at: at(0, -1.4), label: 'gateway', sub: 'in the same hall' },
          { ...eng, at: at(4, -1.4) },
        ],
        links: [link('f1', 'gw', { label: '100 m', route: 'straight' }), link('f2', 'gw', { label: '100 m', route: 'straight' }), link('gw', 'eng')],
        flows: [
          { path: ['f1', 'gw', 'eng'], tone: 'request', label: 'A', duration: 1.6 },
          { path: ['f2', 'gw', 'eng'], tone: 'request', label: 'B', duration: 1.6 },
        ],
        panel: {
          title: 'Equal cable rule',
          icon: 'Cable',
          rows: [
            { text: 'Firm A', value: '30 m + 70 m coil' },
            { text: 'Firm B', value: '70 m + 30 m coil' },
            { text: 'Both arrive', value: 'together', tone: 'good' },
          ],
        },
        caption: 'Every firm gets the same wire length',
      },
    },
    {
      title: 'Market data',
      tag: 'concept',
      heading: 'Market data goes out by UDP multicast',
      eli5: 'When a swap happens, the teacher rings one bell. Every kid hears it at the same instant, instead of the teacher whispering to each kid one by one.',
      body: [
        'Every trade and book change is broadcast once on a **UDP multicast** group. All subscribers get the same bytes at the same time. The network copies the packet, not the engine.',
        'TCP would send to each subscriber separately and add head-of-line blocking. A slow subscriber would delay the rest, which is unfair.',
      ],
      keyIdea: 'One send, everyone hears it together. Multicast gives fan-out without per-subscriber cost or favoritism.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      scene: {
        nodes: [
          { ...eng, at: at(-3.4, -3.2), chips: ['trade ACME 50.12'] },
          { ...md, at: at(0, -3.2), status: 'active', badge: '1 send' },
          { id: 'sub1', kind: 'client', at: at(3.2, -5.4), label: 'firm A' },
          { id: 'sub2', kind: 'client', at: at(6.2, -0.8), label: 'firm B' },
        ],
        links: [link('eng', 'md'), link('md', 'sub1', { label: 'multicast' }), link('md', 'sub2')],
        flows: [
          { path: ['eng', 'md'], tone: 'event', label: 'trade', duration: 1.2 },
          { path: ['md', 'sub1'], tone: 'event', label: 'same bytes', duration: 1.2, delay: 1.3 },
          { path: ['md', 'sub2'], tone: 'event', label: 'same bytes', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'TCP vs multicast',
          icon: 'Rss',
          rows: [
            { text: 'TCP', value: 'N sends, N speeds', tone: 'bad' },
            { text: 'Multicast', value: '1 send, same time', tone: 'good' },
            { text: 'Catch', value: 'UDP can drop packets', tone: 'warn' },
          ],
        },
        caption: 'One packet stream for all subscribers',
      },
    },
    {
      title: 'Gap fill',
      tag: 'case',
      heading: 'A dropped packet: sequence numbers and a gap fill',
      eli5: 'Each bell ring has a number. A kid who hears bell 41 then bell 43 knows they missed 42, and asks the teacher quietly, "what was 42?"',
      body: [
        'UDP is lossy, so each message carries a `seq_no`. A subscriber that sees #41 then #43 asks a **retransmit service** over TCP for just #42, off the hot path.',
        'Feeds run as two identical lines, **A and B**, and the receiver takes whichever copy arrives first. A **snapshot plus replay** channel serves late joiners and large gaps.',
      ],
      keyIdea: 'Number every message, detect gaps at the receiver, repair them on a separate channel.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'repaired' },
      scene: {
        nodes: [
          { ...md, at: at(-4, -3.2), chips: ['#41  #42  #43'] },
          { id: 'sub', kind: 'client', at: at(0, -3.2), label: 'firm A', status: 'hot', badge: 'missed #42', chips: [{ text: 'got #41, #43', tone: 'warn' }] },
          { id: 'rt', kind: 'block', size: 0.72, at: at(4, -3.2), label: 'retransmit', sub: 'TCP gap fill', icon: 'Repeat', tint: 'teal' },
        ],
        links: [link('md', 'sub', { label: 'UDP, #42 lost', labelTone: 'warn' }), link('sub', 'rt', { arrow: 'both', label: 'TCP' })],
        flows: [
          { path: ['sub', 'rt'], tone: 'request', label: 'need #42', duration: 1.2 },
          { path: ['rt', 'sub'], tone: 'response', label: '#42', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Receiver logic',
          icon: 'Code',
          code: 'if msg.seq == next:\n    deliver(msg); next += 1\nelif msg.seq > next:\n    buffer(msg)\n    ask_retransmit(next, msg.seq - 1)',
        },
        caption: 'Detect the gap, fetch only what is missing',
      },
      quiz: {
        question: 'How does a market-data subscriber know it missed a message?',
        options: ['The network tells it', 'There is a gap in the sequence numbers', 'A timer expires', 'The sequencer pauses the stream'],
        answer: 1,
        explain: 'Every message has a sequence number, so a jump from 41 to 43 proves #42 is missing. The receiver repairs it over TCP.',
      },
    },
    {
      title: 'Clearing',
      tag: 'concept',
      heading: 'Clearing and settlement happen after the match',
      eli5: 'The swap is done in the playground. At the end of the day, the teacher walks over and makes sure each kid really hands over the sticker and receives theirs.',
      body: [
        'A match is a promise, not a transfer. Trades flow to **clearing**, which nets what each firm owes and sends instructions to the custodian for **settlement**. Settlement is T+1 in the US since 2024.',
        'The clearing house acts as the **central counterparty (CCP)**. Through novation it becomes buyer to every seller and seller to every buyer, which removes counterparty risk and makes netting valid.',
        'This path is not latency critical, so it uses ordinary databases and retries. Its input is the engine\'s trade tape.',
      ],
      keyIdea: 'Keep the microsecond path small. Money movement is slow, careful and fed from the same trade tape.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      scene: {
        nodes: [
          { ...eng, at: at(-3.4, -3.2) },
          { ...clr, at: at(0, -3.2), status: 'active', label: 'clearing house', sub: 'CCP', chips: ['net per firm'] },
          { id: 'cust', kind: 'block', size: 0.72, at: at(3.4, -3.2), label: 'custodian', sub: 'moves shares + cash', icon: 'Database', tint: 'gray' },
        ],
        links: [link('eng', 'clr', { label: 'trades' }), link('clr', 'cust', { label: 'end of day' })],
        flows: [
          { path: ['eng', 'clr'], tone: 'event', label: 'trade tape', duration: 1.4 },
          { path: ['clr', 'cust'], tone: 'data', label: 'settle', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Netting example',
          icon: 'Receipt',
          rows: [
            { text: 'CCP (novation)', value: 'buyer to all, seller to all' },
            { text: 'Firm A buys', value: '+ 1,000 ACME' },
            { text: 'Firm A sells', value: '- 600 ACME' },
            { text: 'Settle', value: '+ 400 ACME, - cash', tone: 'good' },
          ],
        },
        caption: 'Matching is fast, moving money is careful',
      },
    },
    {
      title: 'Engine crash',
      tag: 'case',
      heading: 'Failure: the matching engine crashes',
      eli5: 'The teacher faints. A second teacher, who has been reading the notebook along the whole time, steps in with the exact same page already in hand.',
      body: [
        'A **hot standby** engine consumes the same tape and keeps the same book. When the primary dies, the standby is already at nearly the same `seq_no`, and it finishes the last few events.',
        'Because replay is deterministic, there is no reconciling. Failover takes the time to detect the death and flip the gateway.',
        'The standby computes trades but does not publish them. On promotion it resumes publishing from the last published `seq_no`, and consumers de-duplicate by sequence number.',
      ],
      keyIdea: 'Standbys that follow the tape need no state transfer. Determinism makes failover a non-event.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      scene: {
        nodes: [
          { ...tape, at: at(0, 0.6), status: 'ok' },
          { ...eng, at: at(-3.4, -3.2), label: 'primary', status: 'down' },
          { ...eng, id: 'eng2', at: at(3.4, -3.2), label: 'standby', sub: 'follows the tape', status: 'active', badge: 'promoted' },
        ],
        links: [link('tape', 'eng', { style: 'faint' }), link('tape', 'eng2')],
        flows: [{ path: ['tape', 'eng2'], tone: 'data', label: 'seq #903...', count: 3, duration: 1.4 }],
        panel: {
          title: 'Failover timeline',
          icon: 'Clock',
          rows: [
            { text: 'Primary stops', value: 't = 0', tone: 'bad' },
            { text: 'Detected', value: 'few ms' },
            { text: 'Standby catches up', value: 'last events only', tone: 'good' },
            { text: 'Gateway flips', value: 'orders resume', tone: 'good' },
          ],
        },
        caption: 'The standby already knows the book',
      },
    },
    {
      title: 'Sequencer loss',
      tag: 'case',
      heading: 'Failure: the single writer dies',
      eli5: 'If the stamping grown-up leaves, only one new grown-up may take over. Two stampers would give the same number to two different cards.',
      body: [
        'The sequencer is a single point of failure by design, so it has a standby fed by the replicated tape. Choosing the new primary is a **leader election**, as in the consensus lesson.',
        'The danger is **split brain**: two sequencers both stamping. A leader lease and a fencing token on the tape reject writes from the old one.',
      ],
      keyIdea: 'One writer needs one leader at a time. Elect it with consensus and fence the old one.',
      metrics: { orders: 'paused briefly', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      metricTones: { orders: 'warn' },
      scene: {
        nodes: [
          { ...seq, at: at(-3.4, -3.2), status: 'down', label: 'old sequencer' },
          { ...seq, id: 'seq2', at: at(3.4, -3.2), label: 'new sequencer', status: 'active', badge: 'term 8' },
          { ...tape, at: at(0, 0.6), badge: 'fences term 7' },
        ],
        links: [link('seq', 'tape', { style: 'faint', label: 'rejected', labelTone: 'bad' }), link('seq2', 'tape', { label: 'term 8 writes' })],
        flows: [{ path: ['seq2', 'tape'], tone: 'data', label: '#904', duration: 1.4 }],
        panel: {
          title: 'Fencing',
          icon: 'Key',
          rows: [
            { text: 'Elected by', value: 'majority vote' },
            { text: 'Each write carries', value: 'term number' },
            { text: 'Tape accepts', value: 'highest term only', tone: 'good' },
            { text: 'Old leader writes', value: 'rejected', tone: 'bad' },
          ],
        },
        caption: 'Only the newest leader can write',
      },
    },
    {
      title: 'Hot symbol',
      tag: 'case',
      heading: 'Failure: one symbol goes wild',
      eli5: 'Suddenly every kid wants the same shiny sticker. That one table is mobbed, but the other tables keep going, and the teacher pauses the mob for a moment to calm it.',
      body: [
        'News on one stock sends its order rate far above its engine\'s capacity. Per-symbol isolation means the rest of the market is untouched, but that book falls behind.',
        'Exchanges use **circuit breakers**: price moves outside a band trigger a **trading halt** for that symbol. Orders queue on the tape, and the book reopens with an auction.',
      ],
      keyIdea: 'Isolate by symbol so one crisis stays small, and halt trading rather than match on a stale book.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs elsewhere', fanout: '100M msg/s', loss: 'zero' },
      scene: {
        nodes: [
          { id: 'e1', kind: 'block', size: 0.72, at: at(-3.4, -3.2), label: 'engine B', sub: 'ZETA halted', icon: 'Scale', tint: 'red', status: 'hot', load: 98 },
          { id: 'e2', kind: 'block', size: 0.72, at: at(0, 0.2), label: 'engine A', sub: 'normal', icon: 'Scale', tint: 'green', status: 'ok', load: 40 },
          { ...seq, at: at(3.4, -3.2) },
        ],
        links: [link('seq', 'e1', { label: 'queued' }), link('seq', 'e2')],
        flows: [
          { path: ['seq', 'e1'], tone: 'error', label: 'ZETA burst', count: 4, duration: 1 },
          { path: ['seq', 'e2'], tone: 'event', label: 'normal', duration: 1.2, delay: 0.5 },
        ],
        panel: {
          title: 'Halt rule',
          icon: 'Shield',
          rows: [
            { text: 'Trigger', value: 'price moves > 10% in 5 min', tone: 'warn' },
            { text: 'ZETA', value: 'halted, auction soon', tone: 'bad' },
            { text: 'All other symbols', value: 'unaffected', tone: 'good' },
          ],
        },
        caption: 'The crisis stays inside one symbol',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: one ordered log, one thread per book',
      eli5: 'Cards get a number, go into the notebook, then one teacher per sticker table pairs kids by price and arrival. A bell tells everyone, and the notebook fixes any mistake.',
      body: [
        'Gateway checks, a single-writer **sequencer** numbers events, the **tape** stores them first, and a single-threaded **engine** per symbol matches by price-time priority.',
        'Kernel bypass, FPGAs and equal cables cut latency. UDP multicast with gap fills publishes results. Replay of the tape gives recovery, failover and audit.',
      ],
      keyIdea: 'Make the input log the truth, keep the engine deterministic, and every failure becomes a replay.',
      metrics: { orders: '10M/s peak', latency: '< 10 μs', fanout: '100M msg/s', loss: 'zero' },
      metricTones: { orders: 'good', latency: 'good', loss: 'good' },
      scene: {
        nodes: [
          { ...firms, at: at(-6.4, -3.2) },
          { ...gw, at: at(-3.2, -3.2) },
          { ...seq, at: at(0, -3.2), status: 'ok' },
          { ...eng, at: at(3.2, -3.2), status: 'ok' },
          { ...md, at: at(6.4, -3.2) },
        ],
        links: [link('firms', 'gw'), link('gw', 'seq'), link('seq', 'eng'), link('eng', 'md')],
        flows: [
          { path: ['firms', 'gw', 'seq', 'eng', 'md'], tone: 'request', label: 'order to trade', duration: 3 },
        ],
        panel: {
          title: 'Why each piece exists',
          icon: 'List',
          rows: [
            { text: 'Gateway', value: 'reject bad orders early' },
            { text: 'Sequencer + tape', value: 'order and durability' },
            { text: 'Engine per symbol', value: 'fast, lock-free' },
            { text: 'Multicast', value: 'fair fan-out' },
          ],
        },
        caption: 'From order to published trade',
      },
      quiz: {
        question: 'The matching engine crashes mid-day. What makes a clean recovery possible?',
        options: [
          'A nightly database backup',
          'The tape is written first and the engine is deterministic, so replay rebuilds the same book',
          'Firms resend their open orders',
          'The market data stream stores the book',
        ],
        answer: 1,
        explain: 'The sequencer writes every event to the tape before the engine sees it. A deterministic engine replaying it reaches the exact same state.',
      },
    },
  ],
};
