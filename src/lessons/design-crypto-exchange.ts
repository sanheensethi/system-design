import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const traders: SceneNode = { id: 'traders', kind: 'client', at: at(-6.4, -3.2), label: 'traders', sub: 'apps, bots' };
const gw: SceneNode = { id: 'gw', kind: 'block', size: 0.8, at: at(-3.2, -3.2), label: 'gateway', sub: 'KYC, risk', icon: 'Shield', tint: 'amber' };
const rb: SceneNode = { id: 'rb', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'ring buffer', sub: 'sequencer', icon: 'Hash', tint: 'violet' };
const eng: SceneNode = { id: 'eng', kind: 'block', size: 0.8, at: at(3.2, -3.2), label: 'matching engine', sub: 'one thread', icon: 'Scale', tint: 'green' };
const md: SceneNode = { id: 'md', kind: 'block', size: 0.8, at: at(6.4, -3.2), label: 'market data', sub: 'UDP multicast', icon: 'Rss', tint: 'blue' };
const journal: SceneNode = { id: 'journal', kind: 'queue', at: at(0, 3.4), label: 'journal', sub: 'append-only log' };
const standby: SceneNode = { id: 'standby', kind: 'block', size: 0.8, at: at(3.2, 3.4), label: 'standby', sub: 'same log', icon: 'Copy', tint: 'gray' };
const ledger: SceneNode = { id: 'ledger', kind: 'db', at: at(-3.2, 3.4), label: 'ledger', sub: 'balances' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designCryptoExchange: Lesson = {
  id: 'design-crypto-exchange',
  title: 'Design a crypto exchange',
  tagline: 'Match millions of orders a second in microseconds, then keep real coins safe in wallets that talk to a blockchain.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Requirements and scale: 5M orders/s, 100 symbols, matching under 100 μs, $100B a day',
    'The order API, the data model, and why a plain database design breaks',
    'The LMAX pattern: one deterministic thread per symbol, with everything else off the hot path',
    'The order book, price-time priority matching, the journal, replay and the standby',
    'Market data over UDP multicast and gap recovery',
    'What a crypto exchange adds: hot and cold wallets, deposits, withdrawals, the ledger, KYC and AML',
    'Failure cases: a chain reorg, a hot wallet breach, an engine crash',
  ],
  metrics: [
    { key: 'orders', label: 'Orders', icon: 'Activity' },
    { key: 'latency', label: 'Match latency', icon: 'Timer' },
    { key: 'md', label: 'Market data', icon: 'Rss' },
    { key: 'custody', label: 'Custody', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'The ask',
      tag: 'problem',
      heading: 'Five million orders a second, and every coin must be real',
      eli5: 'At a school bake sale, kids swap cookies for coins. The teacher must serve the first kid who asked, every time. The coins in the cash tin also have to be real and safe.',
      body: [
        'A **crypto exchange** lets people buy and sell coins such as BTC and ETH against each other. At peak it sees about **5M orders/sec** across 100 trading pairs, and about **$100B** moves in a day.',
        'Two hard jobs sit side by side. A **matching engine** that answers in microseconds, and **custody** of real coins on real blockchains. A mistake in either loses money.',
      ],
      keyIdea: 'An exchange is a fast fair matcher plus a careful vault. Each half has its own rules.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '-' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [
          { ...traders, status: 'hot', chips: [{ text: 'BUY 2 BTC @ 60,000', tone: 'warn' }] },
          { ...eng, status: 'active', badge: 'match < 100 μs' },
          { ...md, chips: ['100M msg/s'] },
        ],
        links: [link('traders', 'eng', { label: '5M orders/s' }), link('eng', 'md')],
        flows: [
          { path: ['traders', 'eng'], tone: 'request', label: 'orders', count: 3, duration: 1.2 },
          { path: ['eng', 'md'], tone: 'event', label: 'trades', count: 3, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Scale targets',
          icon: 'Gauge',
          rows: [
            { text: 'Trading pairs', value: '100' },
            { text: 'Orders per pair', value: '50K / sec' },
            { text: 'Peak orders', value: '5M / sec' },
            { text: 'Match latency (p99)', value: '< 100 μs', tone: 'warn' },
            { text: 'Market data out', value: '100M msg / sec' },
            { text: 'Value traded', value: '$100B / day' },
          ],
        },
        caption: 'Speed and safety at once',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What the exchange has to do',
      eli5: 'The bake sale needs four jobs: take offers, pair them up, shout the latest prices to everyone, and keep each kid\'s coins safe in a tin or the school safe.',
      body: [
        '**Trading:** place and cancel limit and market orders with a time in force (GTC, IOC, FOK) or post-only. Maker and taker fees are charged at settlement. **Market data:** publish the best bid and ask (L1), the depth of the book (L2) and every trade.',
        '**Wallets:** deposits confirmed on-chain, and withdrawals. **Compliance:** KYC (know your customer), AML (anti money laundering) and a full audit trail that regulators can ask for.',
      ],
      keyIdea: 'Two systems share one product: a trading core that must be fast and exact, and a wallet system that must be careful.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '-' },
      scene: {
        nodes: [
          { ...traders },
          { id: 'core', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'trading core', sub: 'orders, trades', icon: 'Scale', tint: 'green' },
          { id: 'wallets', kind: 'block', size: 0.8, at: at(3.2, 3.4), label: 'wallets', sub: 'coins, chains', icon: 'Key', tint: 'amber' },
          { id: 'comp', kind: 'block', size: 0.8, at: at(-3.2, 3.4), label: 'compliance', sub: 'KYC, AML, audit', icon: 'FileText', tint: 'gray' },
        ],
        links: [link('traders', 'core'), link('core', 'wallets'), link('comp', 'core')],
        flows: [
          { path: ['traders', 'core'], tone: 'request', label: 'orders', duration: 1.2 },
          { path: ['core', 'wallets'], tone: 'data', label: 'settle', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Functional requirements',
          icon: 'List',
          rows: [
            { text: 'Limit and market orders, cancel' },
            { text: 'Matching produces trades' },
            { text: 'Market data: L1, L2, trades' },
            { text: 'Deposits and withdrawals' },
            { text: 'KYC, AML, audit trail' },
          ],
        },
        caption: 'Four jobs, two kinds of system',
      },
    },
    {
      title: 'Order API',
      tag: 'concept',
      heading: 'The API: orders in, events out',
      eli5: 'Kids hand the teacher a note: "buy two cookies for 3 coins". The teacher answers with a receipt, and later calls out every swap that happened.',
      body: [
        'Orders go in over **REST** for ordinary apps and **FIX** or a binary protocol for market makers. Fills and book changes come back over a **WebSocket** stream. See the API styles lesson for the trade-offs.',
        'Every order carries a client-chosen `clientOrderId`. A retry after a timeout reuses it, so the same order is never placed twice.',
      ],
      keyIdea: 'Orders are small commands with an idempotency key. Results arrive as a stream of events.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '-' },
      scene: {
        nodes: [
          { ...traders, chips: ['POST /orders'] },
          { ...gw, status: 'active', sub: 'REST, FIX, WebSocket' },
          { id: 'events', kind: 'block', size: 0.8, at: at(3.2, -3.2), label: 'event stream', sub: 'fills, book', icon: 'Rss', tint: 'blue' },
        ],
        links: [link('traders', 'gw'), link('gw', 'events')],
        flows: [
          { path: ['traders', 'gw'], tone: 'request', label: 'new order', duration: 1.2 },
          { path: ['gw', 'events', 'traders'], tone: 'event', label: 'fill', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'Code',
          code: 'POST   /orders           place\nDELETE /orders/{id}      cancel\nGET    /orders/{id}      status\nGET    /book/BTC-USDT    depth\nPOST   /withdrawals      request\nWS     /stream           fills',
          footer: { text: 'clientOrderId makes retries safe', tone: 'good' },
        },
        caption: 'Small commands in, a stream of events out',
      },
      code: {
        language: 'json',
        title: 'A limit order request and its first answer',
        source: `// POST /orders
{
  "clientOrderId": "c-7f3a",
  "pair": "BTC-USDT",
  "side": "buy",
  "type": "limit",
  "price": "60000.00",
  "qty": "2.0"
}
// 202 Accepted
{ "orderId": 918273645, "status": "NEW" }`,
        highlight: [3, 7],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Four records: order, trade, balance, transfer',
      eli5: 'The teacher keeps four lists: who offered what, which swaps happened, how many coins each kid owns, and who put coins in the tin or took them out.',
      body: [
        '**Orders** and **trades** are the trading core: price, quantity, side, status. **Balances** split into `available` and `locked`, because coins promised to an open order cannot be spent twice. Balances are a cached view kept in step with the ledger entries, not a source of truth.',
        '**Transfers** are deposits and withdrawals: asset, amount, on-chain `txid`, status. Amounts are integers in the smallest unit (satoshis), never floats.',
      ],
      keyIdea: 'Money is stored as integers. Orders, trades and ledger entries are append-only, and balances are a derived view split into available and locked.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '-' },
      scene: {
        nodes: [
          { id: 'ord', kind: 'block', size: 0.8, at: at(-3.2, -3.2), label: 'orders', sub: 'id, price, qty', icon: 'List', tint: 'violet' },
          { id: 'trd', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'trades', sub: 'maker, taker', icon: 'ArrowLeftRight', tint: 'green' },
          { id: 'bal', kind: 'block', size: 0.8, at: at(3.2, -3.2), label: 'balances', sub: 'available, locked', icon: 'Scale', tint: 'amber' },
          { id: 'xfer', kind: 'block', size: 0.8, at: at(0, 3.4), label: 'transfers', sub: 'txid, status', icon: 'Receipt', tint: 'blue' },
        ],
        links: [link('ord', 'trd'), link('trd', 'bal'), link('xfer', 'bal')],
        flows: [{ path: ['ord', 'trd', 'bal'], tone: 'data', label: 'fill', duration: 2 }],
        panel: {
          title: 'Key fields',
          icon: 'Table',
          rows: [
            { text: 'orders', value: 'id, user, pair, side, price, qty' },
            { text: 'trades', value: 'id, pair, price, qty, maker, taker' },
            { text: 'balances (derived)', value: 'user, asset, available, locked' },
            { text: 'transfers', value: 'user, asset, amount, txid' },
            { text: 'Amounts', value: 'integers, smallest unit', tone: 'good' },
          ],
        },
        caption: 'Integers, append-only records, derived balances',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The first design: a web app and a SQL database',
      eli5: 'At first the teacher writes every offer in one notebook and checks it by hand. It works while only a few kids are trading.',
      body: [
        'Put an API server in front of a SQL database. For each order, open a transaction: lock the user\'s balance row, insert the order, scan the opposite side for a match, write trades, update both balances, commit.',
        'It is correct, simple, and fine for a small exchange. The transactions lesson explains why this is safe.',
      ],
      keyIdea: 'One transaction per order is the correct baseline. The question is how far it scales.',
      metrics: { orders: '2K/s', latency: '10 ms', md: 'polling', custody: '-' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [
          { ...traders },
          { id: 'api', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'API server', sub: 'REST', icon: 'Network', tint: 'violet' },
          { id: 'sql', kind: 'db', at: at(3.2, 3.4), label: 'SQL database', sub: 'orders, balances' },
        ],
        links: [link('traders', 'api'), link('api', 'sql')],
        flows: [
          { path: ['traders', 'api', 'sql'], tone: 'request', label: 'order', duration: 1.6 },
          { path: ['sql', 'api', 'traders'], tone: 'response', label: 'trade', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One order, one transaction',
          icon: 'Database',
          code: 'BEGIN;\n  lock balance row\n  insert order\n  find best opposite order\n  insert trade\n  update both balances\nCOMMIT;',
          footer: { text: 'Correct and simple', tone: 'good' },
        },
        caption: 'Lock, match, update, commit',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'Where it breaks: locks, disk and time',
      eli5: 'When the whole school queues at the notebook, kids wait for the teacher to finish each line. A few busy kids block everyone behind them.',
      body: [
        'Orders for one pair all fight over the same rows: the top of the book and the same balances. Locks make them wait in line. At 50K orders/sec on one pair, each transaction also pays for a disk write.',
        'Latency lands in milliseconds, not microseconds. Replaying history is also hard, because lock timing can change the order of results.',
      ],
      keyIdea: 'Locking and disk writes sit on the path of every order. That caps both speed and repeatability.',
      metrics: { orders: '2K/s ceiling', latency: '10 to 50 ms', md: 'polling', custody: '-' },
      metricTones: { orders: 'bad', latency: 'bad' },
      scene: {
        nodes: [
          { ...traders, chips: [{ text: '50K orders/s per pair', tone: 'warn' }] },
          { id: 'api', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'API server', sub: 'REST', icon: 'Network', tint: 'violet', status: 'hot', load: 92 },
          { id: 'sql', kind: 'db', at: at(3.2, 3.4), label: 'SQL database', sub: 'orders, balances', status: 'hot', badge: 'lock waits' },
        ],
        links: [link('traders', 'api', { label: '5M orders/s', labelTone: 'warn' }), link('api', 'sql')],
        flows: [
          { path: ['traders', 'api', 'sql'], tone: 'error', label: 'waiting', count: 3, duration: 2 },
        ],
        panel: {
          title: 'Budget check',
          icon: 'Gauge',
          rows: [
            { text: 'Needed', value: '< 100 μs', tone: 'good' },
            { text: 'Disk commit', value: '~1 ms', tone: 'bad' },
            { text: 'Lock wait on hot rows', value: '1 to 50 ms', tone: 'bad' },
            { text: 'Same input, same output?', value: 'no', tone: 'bad' },
          ],
          footer: { text: '100 to 500 times too slow', tone: 'bad' },
        },
        caption: 'The database sits on every order\'s path',
      },
    },
    {
      title: 'One thread',
      tag: 'concept',
      heading: 'The insight: one thread, in memory, no locks',
      eli5: 'Give each cookie a single teacher with a loud voice. She handles one offer at a time, in order, so nobody has to wait for a lock or argue about who was first.',
      body: [
        'A matching engine must be **deterministic**: the same orders in the same order always give the same trades. The fastest way to get that is one thread, pinned to one CPU core, with the whole book in memory and no locks.',
        'Everything slow moves off that path: persistence, risk checks and fan-out. This is the **LMAX Disruptor** pattern from 2010. Modern exchanges follow it. The stock exchange lesson shows the same idea in detail.',
      ],
      keyIdea: 'Deterministic and fast means single-threaded and in memory. Everything else happens beside it.',
      metrics: { orders: '50K/s per pair', latency: '< 100 μs', md: '-', custody: '-' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...gw },
          { ...rb },
          { ...eng, status: 'active', badge: '1 core, no locks', load: 40 },
        ],
        links: [link('gw', 'rb'), link('rb', 'eng')],
        flows: [
          { path: ['gw', 'rb', 'eng'], tone: 'request', label: 'orders', count: 3, duration: 1.8 },
        ],
        panel: {
          title: 'What the hot path does',
          icon: 'Zap',
          rows: [
            { text: 'Reads next order from ring buffer', tone: 'good' },
            { text: 'Matches against in-memory book', tone: 'good' },
            { text: 'Emits trades to an output buffer', tone: 'good' },
            { text: 'No disk, no network, no locks', tone: 'good' },
          ],
          footer: { text: 'Slow work happens on other cores', tone: 'muted' },
        },
        caption: 'The hot path does only matching',
      },
    },
    {
      title: 'Order book',
      tag: 'concept',
      heading: 'The order book: two sorted sides of price levels',
      eli5: 'The teacher keeps two lists on the wall. One has kids who want to buy, best offer on top. The other has kids who want to sell, cheapest on top. Where they touch, a swap happens.',
      body: [
        'The **book** has **bids** (buyers, highest price first) and **asks** (sellers, lowest price first). Each side is a sorted map from price to a FIFO queue of orders at that price. A hash map from `orderId` to its queue slot makes **cancel** a fast lookup.',
        'A **limit** order that cannot match rests on the book. A **market** order takes whatever is there and never rests.',
      ],
      keyIdea: 'Sorted price levels give the best price in O(1) and the FIFO queue at each level gives time priority.',
      metrics: { orders: '50K/s per pair', latency: '< 100 μs', md: '-', custody: '-' },
      scene: {
        nodes: [
          { id: 'bids', kind: 'block', size: 0.8, at: at(-3.2, -3.2), label: 'bids', sub: 'highest first', icon: 'TrendingUp', tint: 'green' },
          { id: 'cross', kind: 'block', size: 0.8, at: at(0, 3.4), label: 'spread', sub: 'gap to cross', icon: 'Scale', tint: 'gray' },
          { id: 'asks', kind: 'block', size: 0.8, at: at(3.2, -3.2), label: 'asks', sub: 'lowest first', icon: 'TrendingUp', tint: 'red' },
        ],
        links: [link('bids', 'cross', { arrow: 'none' }), link('asks', 'cross', { arrow: 'none' })],
        panel: {
          title: 'BTC-USDT book (top levels)',
          icon: 'Table',
          rows: [
            { text: 'ask 60,020', value: '1.1 BTC', tone: 'bad' },
            { text: 'ask 60,010', value: '0.4 + 2.0 BTC', tone: 'bad' },
            { text: 'bid 60,000', value: '3.2 BTC', tone: 'good' },
            { text: 'bid 59,990', value: '0.8 BTC', tone: 'good' },
          ],
          footer: { text: 'Spread: 10 USDT. Orders in a level fill oldest first.', tone: 'muted' },
        },
        caption: 'Price priority across levels, time priority inside one',
      },
    },
    {
      title: 'Matching',
      tag: 'concept',
      heading: 'Matching: walk the book until the order is filled',
      eli5: 'A new buyer offers 3 coins. The teacher checks the cheapest seller. If that seller wants 3 or less, they swap. If the buyer still has more to buy, she checks the next seller.',
      body: [
        'A buy order walks the asks from the lowest price upward. At each level the oldest order fills first. This is **price-time priority**. Each fill emits a trade at the **resting** order\'s price.',
        'The loop stops when the order is filled, or the next ask is above the limit price. Leftover quantity of a limit order rests on the bids.',
        'The resting order is the **maker** and the incoming one is the **taker**. Self-trade prevention stops a user matching their own order.',
      ],
      keyIdea: 'Best price first, then earliest arrival. The trade price comes from the order that was already waiting.',
      metrics: { orders: '50K/s per pair', latency: '~5 μs per order', md: '-', custody: '-' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { id: 'inc', kind: 'block', size: 0.8, at: at(-3.2, -3.2), label: 'buy 2.5 BTC', sub: 'limit 60,010', icon: 'Download', tint: 'green', chips: [{ text: 'taker', tone: 'good' }] },
          { id: 'book', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'ask book', sub: 'price-time', icon: 'Layers', tint: 'red' },
          { id: 'tr', kind: 'block', size: 0.8, at: at(3.2, -3.2), label: 'trades', sub: 'at maker price', icon: 'ArrowLeftRight', tint: 'violet' },
        ],
        links: [link('inc', 'book'), link('book', 'tr')],
        flows: [
          { path: ['inc', 'book'], tone: 'request', label: '2.5 BTC', duration: 1.2 },
          { path: ['book', 'tr'], tone: 'event', label: 'fills', count: 2, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Result of the walk',
          icon: 'Receipt',
          rows: [
            { text: 'Fill 1: ask @ 60,010', value: '0.4 BTC', tone: 'good' },
            { text: 'Fill 2: ask @ 60,010', value: '2.0 BTC', tone: 'good' },
            { text: 'Left over', value: '0.1 BTC rests as bid', tone: 'warn' },
          ],
          footer: { text: 'Next ask 60,020 is above the limit', tone: 'muted' },
        },
        caption: 'Walk the cheapest asks first',
      },
      code: {
        language: 'typescript',
        title: 'Match a buy order against the asks',
        source: `function matchBuy(book: Book, o: Order): Trade[] {
  const trades: Trade[] = [];
  while (o.qty > 0) {
    const best = book.asks.firstLevel();        // lowest ask
    if (!best || (o.type === 'limit' && o.price < best.price)) break;
    const maker = best.queue.peek();            // oldest order first
    if (maker.user === o.user) { o.qty = 0; break; }  // self-trade prevention
    const qty = Math.min(o.qty, maker.qty);
    trades.push({ price: best.price, qty, taker: o.id, maker: maker.id });
    o.qty -= qty; maker.qty -= qty;
    if (maker.qty === 0) {
      best.queue.shift();
      if (best.queue.isEmpty()) book.asks.removeLevel(best.price);  // drop empty level
    }
  }
  if (o.qty > 0 && o.type === 'limit') book.bids.add(o);  // rest on the book
  return trades;
}`,
        highlight: [4, 5, 6, 7, 11, 13],
      },
      quiz: {
        question: 'A buy limit at 60,010 meets two asks: 0.4 BTC at 60,010 placed at 10:00:01, and 2.0 BTC at 60,010 placed at 10:00:03. Which fills first and at what price?',
        options: [
          'The larger one, at 60,010',
          'The 10:00:01 ask first, at 60,010',
          'The 10:00:03 ask first, at the buyer\'s price',
          'Both split evenly at 60,010',
        ],
        answer: 1,
        explain: 'Same price, so time priority decides: the older order fills first. The trade prints at the resting order\'s price. Pro rata matching would split by size, but this is price-time.',
      },
    },
    {
      title: 'Gateway checks',
      tag: 'concept',
      heading: 'Before the engine: KYC, limits and a balance hold',
      eli5: 'Before a note reaches the teacher, a helper at the door checks the kid is allowed to play and really owns the coins. He sets those coins aside so they cannot be offered twice.',
      body: [
        'The **gateway** runs on many cores in parallel. It authenticates, checks the account\'s **KYC** tier and trading limits, validates price and size, and moves the needed coins from `available` to `locked`. A balance service sharded by user does the lock with an atomic compare-and-set, so parallel cores cannot double-spend.',
        'Only orders that pass reach the ring buffer. The engine never sees an order it cannot afford to fill, so it never has to check balances itself.',
      ],
      keyIdea: 'Cheap, parallel checks happen before the single thread. The engine trusts what reaches it.',
      metrics: { orders: '5M/s peak', latency: '+ 20 μs risk', md: '-', custody: '-' },
      scene: {
        nodes: [
          { ...traders },
          { ...gw, status: 'active', chips: ['KYC tier 2', 'hold 120,000 USDT'] },
          { ...rb },
        ],
        links: [link('traders', 'gw'), link('gw', 'rb')],
        flows: [
          { path: ['traders', 'gw'], tone: 'request', label: 'order', duration: 1.2 },
          { path: ['gw', 'rb'], tone: 'request', label: 'checked', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Pre-trade checks',
          icon: 'Shield',
          rows: [
            { text: 'Signed request, API key ok', tone: 'good' },
            { text: 'KYC tier allows this pair', tone: 'good' },
            { text: 'Within daily trading limit', tone: 'good' },
            { text: 'Price within 10% of last trade', tone: 'good' },
            { text: 'Lock 120,000 USDT', value: 'available - 120K', tone: 'warn' },
          ],
        },
        caption: 'Reject early, lock before sequencing',
      },
    },
    {
      title: 'Ring buffer',
      tag: 'concept',
      heading: 'The ring buffer and the journal',
      eli5: 'Orders line up on a conveyor belt that goes round and round. The belt gives each note a number. Before the teacher reads a note, a helper copies it into a logbook.',
      body: [
        'Accepted orders enter a **ring buffer** in shared memory. A single **sequencer** stamps each with the next sequence number. That number is the exchange\'s one true order of events.',
        'A separate thread appends each event to the **journal**, an append-only log on fast disk, alongside matching. Results are only released to traders and market data once the sequence number is durable and replicated, so a crash never loses an order the trader was told was accepted. See the message queue lesson for why a log works.',
      ],
      keyIdea: 'One sequence number per event fixes the order. The journal runs beside the hot path, and nothing is acknowledged until it is durable.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '-', custody: '-' },
      scene: {
        nodes: [
          { ...gw },
          { ...rb, status: 'active', badge: 'seq 884,201' },
          { ...eng },
          { ...journal, badge: 'ack after journal' },
        ],
        links: [link('gw', 'rb'), link('rb', 'eng'), link('rb', 'journal', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'rb', 'eng'], tone: 'request', label: 'seq 884,201', duration: 1.6 },
          { path: ['rb', 'journal'], tone: 'data', label: 'append', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Journal entries',
          icon: 'List',
          rows: [
            { text: '884,199', value: 'NEW buy 2.0 @ 60,000' },
            { text: '884,200', value: 'CANCEL order 918273' },
            { text: '884,201', value: 'NEW sell 0.5 @ 60,010', tone: 'good' },
          ],
          footer: { text: 'Append-only. Ack after journal.', tone: 'muted' },
        },
        caption: 'Sequence once, record beside the hot path',
      },
    },
    {
      title: 'Replay',
      tag: 'concept',
      heading: 'Deterministic replay: audit and recovery in one mechanism',
      eli5: 'If the teacher loses her place, she reads the logbook from the start. She makes the same swaps in the same order, so the wall lists end up exactly as before.',
      body: [
        'Because matching is deterministic, replaying the journal from the last **snapshot** of the book rebuilds the exact state before a crash. Every trade is reconstructable.',
        'This is why disaster recovery and the **regulatory audit trail** are the same mechanism. If a regulator asks why a trade happened, replay the log up to that sequence number.',
      ],
      keyIdea: 'Same input log, same output. One log serves recovery, audit and debugging.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '-', custody: '-' },
      scene: {
        nodes: [
          { ...journal, status: 'active' },
          { id: 'snap', kind: 'storage', at: at(-3.2, 3.4), label: 'snapshot', sub: 'book every minute' },
          { ...eng, at: at(0, -3.2), status: 'active', badge: 'rebuilding' },
        ],
        links: [link('snap', 'eng'), link('journal', 'eng')],
        flows: [
          { path: ['snap', 'eng'], tone: 'data', label: 'load book', duration: 1.4 },
          { path: ['journal', 'eng'], tone: 'event', label: 'events after', count: 3, duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Recovery steps',
          icon: 'Repeat',
          rows: [
            { text: '1. Start a fresh engine' },
            { text: '2. Load the latest snapshot' },
            { text: '3. Replay journal after it', tone: 'good' },
            { text: '4. Same state as before the crash', tone: 'good' },
          ],
          footer: { text: 'Audit uses the same replay', tone: 'muted' },
        },
        caption: 'Snapshot plus journal equals the book',
      },
    },
    {
      title: 'Standby',
      tag: 'case',
      heading: 'Case: the engine crashes, a standby takes over',
      eli5: 'A second teacher sits in the back reading the same logbook, writing the same lists. If the first teacher faints, the second says "I have it" and carries on.',
      body: [
        'A **standby** engine consumes the same journal, one step behind, and builds the same book. It does not send output. If the primary dies, the standby takes over, replaying only the last few events. Failover takes seconds, with zero loss.',
        'Keep the journal on at least two machines before an event counts as accepted. The failover lesson and the consensus lesson cover leader election and avoiding two primaries.',
      ],
      keyIdea: 'A warm standby reading the same log turns a crash into a short pause, not a loss.',
      metrics: { orders: 'paused 2 s', latency: '< 100 μs', md: '-', custody: '-' },
      metricTones: { orders: 'warn' },
      scene: {
        nodes: [
          { ...eng, status: 'down', badge: 'crashed' },
          { ...journal },
          { ...standby, status: 'active', badge: 'takes over' },
        ],
        links: [link('journal', 'eng', { style: 'faint' }), link('journal', 'standby')],
        flows: [
          { path: ['journal', 'standby'], tone: 'data', label: 'same events', count: 2, duration: 1.4 },
        ],
        panel: {
          title: 'Failover',
          icon: 'Repeat',
          rows: [
            { text: 'Primary stops responding', tone: 'bad' },
            { text: 'Standby is at seq 884,201', tone: 'good' },
            { text: 'It promotes itself and replays the last events' },
            { text: 'Orders flow again', value: '~2 s', tone: 'good' },
          ],
          footer: { text: 'No accepted order is lost', tone: 'good' },
        },
        caption: 'A replica of the engine, fed by the log',
      },
    },
    {
      title: 'Per pair',
      tag: 'concept',
      heading: 'Scale out: one engine per trading pair',
      eli5: 'One teacher per cookie type. The chocolate teacher and the oatmeal teacher never need to talk, so ten teachers can run at once.',
      body: [
        'One thread is the ceiling for one pair, but pairs never trade with each other. Give each of the 100 pairs its own engine, sequencer and journal, then route by `pair`. Sharding by symbol is the sharding lesson applied to a clean key.',
        'The limit is a **hot pair**: BTC-USDT alone can use a whole core. Busy pairs get a dedicated machine, and quiet ones share.',
      ],
      keyIdea: 'Partition by pair. Each engine stays single-threaded and deterministic, and the total throughput adds up.',
      metrics: { orders: '5M/s total', latency: '< 100 μs', md: '-', custody: '-' },
      metricTones: { orders: 'good' },
      scene: {
        nodes: [
          { ...gw, at: at(-6.4, -3.2) },
          { id: 'e1', kind: 'block', size: 0.8, at: at(-2.2, -3.2), label: 'BTC-USDT', sub: 'engine 1', icon: 'Scale', tint: 'green', load: 82 },
          { id: 'e2', kind: 'block', size: 0.8, at: at(1.6, -3.2), label: 'ETH-USDT', sub: 'engine 2', icon: 'Scale', tint: 'green', load: 45 },
          { id: 'e3', kind: 'block', size: 0.8, at: at(5.4, -3.2), label: 'SOL-USDT', sub: 'engine 3', icon: 'Scale', tint: 'green', load: 20 },
        ],
        links: [link('gw', 'e1'), link('gw', 'e2', { route: 'straight' }), link('gw', 'e3', { route: 'straight' })],
        flows: [
          { path: ['gw', 'e1'], tone: 'request', label: 'BTC', duration: 1.4 },
          { path: ['gw', 'e2'], tone: 'request', label: 'ETH', duration: 1.6, delay: 0.3 },
          { path: ['gw', 'e3'], tone: 'request', label: 'SOL', duration: 1.8, delay: 0.6 },
        ],
        panel: {
          title: 'Routing rule',
          icon: 'Split',
          rows: [
            { text: 'Key', value: 'pair' },
            { text: 'Engines', value: '100' },
            { text: 'Orders per engine', value: '~50K / sec' },
            { text: 'Hot pair', value: 'own machine', tone: 'warn' },
          ],
          footer: { text: 'Pairs never trade against each other', tone: 'muted' },
        },
        caption: 'Shard by pair, one core each',
      },
    },
    {
      title: 'Market data',
      tag: 'concept',
      heading: 'Market data: publish once to everyone',
      eli5: 'After every swap the teacher rings a bell and shouts the new price. Everyone in the room hears it at the same moment, no matter how many kids there are.',
      body: [
        'The engine emits three streams: **L1** (best bid and ask), **L2** (depth per price level) and **trades**. Each order can cause several L2 level updates plus trades, so 5M orders/sec becomes roughly 20 messages each, about 100M messages/sec.',
        'TCP would repeat each message per subscriber and stall behind one lost packet. Exchanges use **UDP multicast**: send once, every subscriber on the switch receives it together. Each message has a sequence number.',
      ],
      keyIdea: 'Multicast turns one publish into thousands of identical deliveries, with equal timing for everyone.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '-' },
      scene: {
        nodes: [
          { ...eng },
          { ...md, status: 'active', chips: ['L1', 'L2', 'trades'] },
          { id: 'hft', kind: 'client', at: at(3.2, 3.4), label: 'market makers', sub: 'colocated' },
          { id: 'app', kind: 'phone', at: at(6.4, 3.4), label: 'retail apps', sub: 'via WebSocket' },
        ],
        links: [link('eng', 'md'), link('md', 'hft', { label: 'UDP multicast' }), link('md', 'app', { label: 'fan-out' })],
        flows: [
          { path: ['eng', 'md'], tone: 'event', label: 'trade', duration: 1.2 },
          { path: ['md', 'hft'], tone: 'event', label: 'seq 5001', duration: 1.2, delay: 1.3 },
          { path: ['md', 'app'], tone: 'event', label: 'seq 5001', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'TCP vs multicast',
          icon: 'Rss',
          rows: [
            { text: 'TCP: one copy per subscriber', value: 'N sends', tone: 'bad' },
            { text: 'TCP: lost packet stalls the stream', tone: 'bad' },
            { text: 'Multicast: one send', value: '1 send', tone: 'good' },
            { text: 'Everyone hears it together', tone: 'good' },
          ],
        },
        caption: 'One publish, many receivers',
      },
    },
    {
      title: 'Gap recovery',
      tag: 'tradeoff',
      heading: 'UDP loses packets, and cloud networks lack multicast',
      eli5: 'The bell is loud but sometimes a kid misses it. Each shout has a number, so a kid who heard 41 then 43 asks the teacher at the desk: "what was 42?"',
      body: [
        'UDP does not retransmit. A subscriber that sees sequence 41 then 43 knows it missed 42 and asks a separate **TCP recovery channel** for it. The sequence number turns silent loss into a detected gap.',
        'Trade-off: multicast needs a layer 2 network, which cloud VPCs usually do not offer. Exchanges run in private data centers with colocation, and use WebSocket fan-out for the public internet.',
      ],
      keyIdea: 'Sequence numbers make loss visible, and a recovery channel repairs it. Pure multicast needs your own network.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '-' },
      scene: {
        nodes: [
          { ...md },
          { id: 'sub', kind: 'client', at: at(0, 3.4), label: 'subscriber', sub: 'saw 41, then 43', status: 'hot', badge: 'gap: 42' },
          { id: 'rec', kind: 'block', size: 0.8, at: at(6.4, 3.4), label: 'recovery', sub: 'TCP replay', icon: 'Repeat', tint: 'amber' },
        ],
        links: [link('md', 'sub', { style: 'dashed', label: 'UDP' }), link('sub', 'rec', { label: 'TCP: resend 42', arrow: 'both' })],
        flows: [
          { path: ['sub', 'rec'], tone: 'request', label: 'need 42', duration: 1.4 },
          { path: ['rec', 'sub'], tone: 'response', label: 'seq 42', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Choices',
          icon: 'Scale',
          rows: [
            { text: 'UDP multicast', value: 'fastest, needs own network', tone: 'good' },
            { text: 'Gap seen from sequence', value: 'detect, then repair' },
            { text: 'Cloud VPC', value: 'no L2 multicast', tone: 'warn' },
            { text: 'Public users', value: 'WebSocket fan-out' },
          ],
        },
        caption: 'Detect the gap, repair over TCP',
      },
      quiz: {
        question: 'A market data subscriber receives sequence numbers 41 then 43. What should it do?',
        options: [
          'Ignore it, because 43 is newer',
          'Ask the recovery channel for 42 and apply it in order',
          'Restart the whole exchange',
          'Switch to TCP for all future messages',
        ],
        answer: 1,
        explain: 'The sequence number reveals the gap. The subscriber requests 42 from the TCP recovery channel and applies messages in order, so its book stays correct.',
      },
    },
    {
      title: 'Custody',
      tag: 'concept',
      heading: 'The wallet side: hot, warm and cold',
      eli5: 'The bake sale has a small cash tin on the table for quick change, and a school safe with most of the coins. Taking coins from the safe needs two teachers.',
      body: [
        'Trading moves numbers in a ledger. Coins live on blockchains, controlled by private keys. A key held online can be stolen, so the exchange splits funds by risk.',
        '**Hot wallet:** online, small balance (a few percent of funds), pays routine withdrawals. **Cold wallet:** keys offline in an HSM or vault, holds most funds, moves only with several approvals (**multi-sig** or MPC). **Warm wallet:** keys online but behind approval rules, holds about 7% and refills the hot wallet.',
      ],
      keyIdea: 'Keep little online and most offline. Speed and safety are traded against each other by choosing the split.',
      metrics: { orders: '-', latency: '-', md: '-', custody: '~3% of funds' },
      metricTones: { custody: 'good' },
      scene: {
        nodes: [
          { id: 'hot', kind: 'vault', at: at(-3.2, -3.2), label: 'hot wallet', sub: 'online, ~3%', tint: 'amber' },
          { id: 'warm', kind: 'vault', at: at(0, 3.4), label: 'warm wallet', sub: 'limited approvals', tint: 'blue' },
          { id: 'cold', kind: 'vault', at: at(3.2, -3.2), label: 'cold wallet', sub: 'offline, ~90%', tint: 'green' },
        ],
        links: [link('cold', 'warm', { label: 'refill, approved', arrow: 'both' }), link('warm', 'hot', { label: 'top up', arrow: 'both' })],
        flows: [
          { path: ['cold', 'warm', 'hot'], tone: 'data', label: 'refill', duration: 2 },
        ],
        panel: {
          title: 'Where the coins sit',
          icon: 'KeyRound',
          rows: [
            { text: 'Hot', value: 'online, fast, small', tone: 'warn' },
            { text: 'Warm', value: 'online, approval needed' },
            { text: 'Cold', value: 'offline, multi-sig', tone: 'good' },
          ],
          footer: { text: 'Exact percentages are policy, not a standard', tone: 'muted' },
        },
        caption: 'Fast money online, most money offline',
      },
    },
    {
      title: 'Deposits',
      tag: 'concept',
      heading: 'Deposits: wait for confirmations before crediting',
      eli5: 'A kid says he put coins in the tin. The teacher waits until three other teachers have also seen them there before she writes them in the notebook.',
      body: [
        'Each user gets a unique **deposit address**, derived from the exchange\'s public key so the server holds no private key. A **watcher** scans each new block for payments to those addresses.',
        'A payment is not final in one block. The watcher credits the ledger only after **N confirmations** (blocks on top). N is set per chain. Credit by `txid` so a rescan never credits twice. Then sweep funds to cold storage.',
      ],
      keyIdea: 'Credit only after enough confirmations, keyed by txid so it is safe to repeat.',
      metrics: { orders: '-', latency: '-', md: '-', custody: 'swept to cold' },
      scene: {
        nodes: [
          { id: 'chain', kind: 'internet', at: at(-6.4, -3.2), label: 'blockchain', sub: 'new blocks' },
          { id: 'watch', kind: 'block', size: 0.8, at: at(-3.2, -3.2), label: 'watcher', sub: 'counts confirmations', icon: 'Search', tint: 'violet', chips: [{ text: '2 of 3 confirms', tone: 'warn' }] },
          { ...ledger, at: at(0, 3.4) },
          { id: 'cold', kind: 'vault', at: at(3.2, -3.2), label: 'cold wallet', sub: 'sweep target', tint: 'green' },
        ],
        links: [link('chain', 'watch'), link('watch', 'ledger'), link('watch', 'cold', { style: 'dashed', label: 'sweep' })],
        flows: [
          { path: ['chain', 'watch'], tone: 'event', label: 'tx in block', duration: 1.2 },
          { path: ['watch', 'ledger'], tone: 'data', label: 'credit 0.5 BTC', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Deposit states',
          icon: 'Clock',
          rows: [
            { text: 'Seen in a block', value: 'pending', tone: 'warn' },
            { text: 'N confirmations reached', value: 'credited', tone: 'good' },
            { text: 'Block replaced', value: 'reorged', tone: 'bad' },
          ],
          footer: { text: 'N differs per chain', tone: 'muted' },
        },
        caption: 'Confirmations decide when funds count',
      },
      code: {
        language: 'typescript',
        title: 'Credit deposits on each new block',
        source: `for (const dep of pendingDeposits) {
  const conf = chain.height - dep.blockHeight + 1;
  if (!chain.isStillInBlock(dep.txid, dep.blockHash)) {
    dep.status = 'reorged';
    continue;
  }
  if (conf >= REQUIRED[dep.asset]) {
    ledger.credit(dep.userId, dep.asset, dep.amount, dep.txid);
    dep.status = 'credited';
  }
}`,
        highlight: [2, 3, 7, 8],
      },
    },
    {
      title: 'Withdrawals',
      tag: 'concept',
      heading: 'Withdrawals: a pipeline with a brake in it',
      eli5: 'A kid asks for coins back. The teacher locks them in the notebook first. Small amounts come from the tin. Big amounts wait for the safe and two teachers.',
      body: [
        'A request first **locks** the amount in the ledger, then passes **AML screening** and risk rules: a new address, a large amount or an odd login triggers a hold. Small payouts come from the hot wallet and are batched into one transaction to save fees.',
        'Large ones go to manual review and cold storage with multi-sig. The chain broadcast is tracked until confirmed, then the lock turns into a debit.',
      ],
      keyIdea: 'Lock first, screen, sign by amount, broadcast, then debit. Each stage can stop the flow.',
      metrics: { orders: '-', latency: '-', md: '-', custody: 'hot: small only' },
      scene: {
        nodes: [
          { id: 'req', kind: 'client', at: at(-6.4, -3.2), label: 'user', sub: 'withdraw 0.5 BTC' },
          { ...ledger, at: at(-3.2, -3.2), sub: 'lock, then debit', status: 'active', badge: 'locked 0.5 BTC' },
          { id: 'aml', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'AML and signer', sub: '2FA, allowlist, sign', icon: 'Shield', tint: 'amber' },
          { id: 'chain', kind: 'internet', at: at(3.2, -3.2), label: 'blockchain', sub: 'broadcast' },
        ],
        links: [link('req', 'ledger'), link('ledger', 'aml'), link('aml', 'chain')],
        flows: [
          { path: ['req', 'ledger', 'aml', 'chain'], tone: 'request', label: '0.5 BTC', duration: 2.4 },
        ],
        panel: {
          title: 'Routing by amount',
          icon: 'Route',
          rows: [
            { text: 'Request key and 2FA', value: 'idempotent, allowlist', tone: 'good' },
            { text: 'Under 1 BTC, known address', value: 'hot, automatic', tone: 'good' },
            { text: 'New address or odd login', value: 'hold, review', tone: 'warn' },
            { text: 'Large amount', value: 'cold, multi-sig', tone: 'warn' },
            { text: 'Sanctioned address', value: 'blocked', tone: 'bad' },
          ],
          footer: { text: 'Thresholds are policy', tone: 'muted' },
        },
        caption: 'Funds are locked before anything leaves',
      },
    },
    {
      title: 'Ledger',
      tag: 'concept',
      heading: 'Settlement: the ledger follows the engine',
      eli5: 'The teacher shouts swaps fast. A helper copies each swap into the notebook a little later, with a plus for one kid and a minus for the other, so the totals always match.',
      body: [
        'The engine only matches. A **settlement** worker reads trades from the journal and writes **double-entry** rows: every trade adds one amount to one account and subtracts it from another. A unique key on `trade_id` makes replays safe.',
        'Balances shown to users can lag the engine by milliseconds. The gateway\'s lock covers the asset being paid, so nobody can overspend it. Received funds become spendable only after the worker credits them. The event sourcing lesson covers this log-first style.',
      ],
      keyIdea: 'The journal is the truth. The ledger is a derived, double-entry view that can be rebuilt from it.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '-', custody: '-' },
      scene: {
        nodes: [
          { ...journal, at: at(-3.2, -3.2) },
          { id: 'settle', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'settlement', sub: 'async worker', icon: 'Workflow', tint: 'violet' },
          { ...ledger, at: at(3.2, -3.2), status: 'active', badge: 'sum of entries = 0' },
        ],
        links: [link('journal', 'settle'), link('settle', 'ledger')],
        flows: [
          { path: ['journal', 'settle'], tone: 'event', label: 'trade 9001', duration: 1.2 },
          { path: ['settle', 'ledger'], tone: 'data', label: '4 entries', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Trade 9001 as entries',
          icon: 'Receipt',
          rows: [
            { text: 'alice BTC', value: '+0.5', tone: 'good' },
            { text: 'bob BTC', value: '-0.5', tone: 'bad' },
            { text: 'alice USDT', value: '-30,000', tone: 'bad' },
            { text: 'bob USDT', value: '+30,000', tone: 'good' },
          ],
          footer: { text: 'Each asset sums to zero', tone: 'good' },
        },
        caption: 'Four rows per trade, always balanced',
      },
      code: {
        language: 'sql',
        title: 'One trade, four ledger rows',
        source: `BEGIN;
-- trade 9001: alice buys 0.5 BTC at 60,000 USDT from bob
INSERT INTO entries (trade_id, account, asset, delta) VALUES
  (9001, 'alice', 'BTC',   50000000),    -- smallest units: BTC 8 decimals, USDT 6
  (9001, 'bob',   'BTC',  -50000000),
  (9001, 'alice', 'USDT', -30000000000),
  (9001, 'bob',   'USDT',  30000000000);
COMMIT;  -- unique (trade_id, account, asset) makes a replay a no-op`,
        highlight: [3, 8],
      },
      quiz: {
        question: 'Why can the ledger lag the matching engine by a few milliseconds without allowing overspending?',
        options: [
          'The ledger is always faster than the engine',
          'The gateway already locked the funds before the order reached the engine',
          'Users cannot place a second order until the ledger updates',
          'The engine checks balances on every trade',
        ],
        answer: 1,
        explain: 'Funds are moved from available to locked at the gateway, before sequencing. The ledger only has to catch up with trades that were already paid for by that lock.',
      },
    },
    {
      title: 'Chain reorg',
      tag: 'case',
      heading: 'Failure: a chain reorg reverses a deposit',
      eli5: 'A kid says he put coins in the tin, and the teacher writes it down too soon. Then the other teachers say, "that one never happened." The notebook now shows coins that are not there.',
      body: [
        'Blocks near the chain tip can be replaced by a longer competing branch (a **reorg**). A deposit credited after one confirmation can vanish. The user may already have traded or withdrawn the coins.',
        'Defenses: require enough confirmations for the asset and the amount (more for large deposits), keep the deposit in `pending` until then, and re-check `blockHash` on every block. Lost coins are an exchange loss.',
      ],
      keyIdea: 'Confirmations are risk management. Fewer are faster for users and more dangerous for the exchange.',
      metrics: { orders: '-', latency: '-', md: '-', custody: 'loss if early' },
      metricTones: { custody: 'bad' },
      scene: {
        nodes: [
          { id: 'chain', kind: 'internet', at: at(-3.2, -3.2), label: 'blockchain', sub: 'branch replaced', status: 'hot' },
          { id: 'watch', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'watcher', sub: 'rechecks hash', icon: 'Search', tint: 'violet', status: 'active' },
          { ...ledger, at: at(3.2, -3.2), status: 'hot', badge: 'credited 1 conf' },
        ],
        links: [link('chain', 'watch'), link('watch', 'ledger')],
        flows: [
          { path: ['chain', 'watch'], tone: 'error', label: 'block replaced', duration: 1.2 },
          { path: ['watch', 'ledger'], tone: 'error', label: 'reverse credit', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Confirmations by risk',
          icon: 'Clock',
          rows: [
            { text: 'Small deposit', value: 'fewer blocks', tone: 'good' },
            { text: 'Large deposit', value: 'many more blocks', tone: 'warn' },
            { text: 'Credit at 1 confirmation', value: 'reorg risk', tone: 'bad' },
          ],
          footer: { text: 'Pick N per chain and per amount', tone: 'muted' },
        },
        caption: 'The chain changed its mind',
      },
    },
    {
      title: 'Hot breach',
      tag: 'case',
      heading: 'Failure: the hot wallet is compromised',
      eli5: 'A thief grabs the cash tin from the table. He only gets the small amount in it, because the school safe needs two teachers and was never on the table.',
      body: [
        'If an attacker gets the hot wallet key, they can send out whatever it holds. The damage is capped by design: a small hot balance, per-hour withdrawal limits, and alerts that **freeze** payouts when volume looks wrong.',
        'The refill from cold storage needs multi-sig approval and a human, so it cannot be abused quickly. Keys sit in an HSM, not in app memory. Reserves can be covered by an insurance fund.',
      ],
      keyIdea: 'Assume the hot wallet will be attacked. Make the worst case small and slow.',
      metrics: { orders: '-', latency: '-', md: '-', custody: 'loss capped' },
      metricTones: { custody: 'warn' },
      scene: {
        nodes: [
          { id: 'atk', kind: 'user', at: at(-6.4, -3.2), label: 'attacker', sub: 'has hot key', status: 'hot' },
          { id: 'hot', kind: 'vault', at: at(-3.2, -3.2), label: 'hot wallet', sub: '~3%, limits', tint: 'amber', status: 'hot' },
          { id: 'mon', kind: 'monitor', at: at(0, -3.2), label: 'alerts', sub: 'freeze payouts', status: 'active' },
          { id: 'cold', kind: 'vault', at: at(3.2, -3.2), label: 'cold wallet', sub: 'untouched', tint: 'green', status: 'ok' },
        ],
        links: [link('atk', 'hot'), link('hot', 'mon', { style: 'dashed' }), link('mon', 'cold', { style: 'faint', arrow: 'none' })],
        flows: [
          { path: ['atk', 'hot'], tone: 'error', label: 'drain', duration: 1.4 },
          { path: ['hot', 'mon'], tone: 'event', label: 'spike', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Layers of defense',
          icon: 'Shield',
          rows: [
            { text: 'Small hot balance', tone: 'good' },
            { text: 'Hourly withdrawal cap', tone: 'good' },
            { text: 'Anomaly alerts freeze payouts', tone: 'good' },
            { text: 'Keys in HSM, cold refill by multi-sig', tone: 'good' },
          ],
          footer: { text: 'The loss is bounded', tone: 'warn' },
        },
        caption: 'Limit what one key can reach',
      },
    },
    {
      title: 'Trade-offs',
      tag: 'tradeoff',
      heading: 'The trade-offs in one table',
      eli5: 'Every rule at the bake sale buys something and costs something. One teacher is fast but can only do one thing. A small tin is safe but runs out of change.',
      body: [
        'Single-threaded engine: deterministic and fast, but one pair is capped by one core, so partition by pair. In-memory book: speed, but recovery needs journal plus snapshot.',
        'UDP multicast: lowest fan-out latency, but needs a private network. Small hot wallet: safe, but needs refills.',
      ],
      keyIdea: 'Each choice buys speed or safety and charges for it somewhere else. Name the cost.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '~3% of funds' },
      metricTones: { orders: 'good', latency: 'good', custody: 'good' },
      scene: {
        nodes: [
          { ...eng, at: at(-3.2, -3.2), status: 'ok' },
          { ...md, at: at(0, -3.2), status: 'ok' },
          { id: 'hot', kind: 'vault', at: at(3.2, -3.2), label: 'hot wallet', sub: 'small balance', tint: 'amber', status: 'ok' },
        ],
        links: [link('eng', 'md'), link('md', 'hot', { style: 'faint', arrow: 'none' })],
        panel: {
          title: 'Choice and cost',
          icon: 'Scale',
          rows: [
            { text: 'Single thread', value: 'one core per pair' },
            { text: 'In-memory book', value: 'journal + snapshot' },
            { text: 'UDP multicast', value: 'needs private network' },
            { text: 'Small hot wallet', value: 'needs refills' },
            { text: 'Few confirmations', value: 'reorg risk', tone: 'warn' },
          ],
        },
        caption: 'Every gain has a bill',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: a fast matcher and a careful vault',
      eli5: 'The bake sale runs on one loud teacher per cookie, a logbook for fairness, a bell for prices, and a cash tin and a safe for the coins.',
      body: [
        'Trading: gateway checks and locks, a ring buffer and journal fix the order, a single-threaded deterministic engine per pair matches by price-time, standbys and replay recover, multicast with sequence numbers publishes.',
        'Money: the ledger is double-entry and derived from the journal. Deposits wait for confirmations, withdrawals pass AML and route by amount, and most coins stay in cold storage.',
      ],
      keyIdea: 'Keep the hot path tiny and deterministic, derive everything else from the log, and limit what one key can reach.',
      metrics: { orders: '5M/s peak', latency: '< 100 μs', md: '100M msg/s', custody: '~3% of funds' },
      metricTones: { orders: 'good', latency: 'good', md: 'good', custody: 'good' },
      scene: {
        nodes: [
          { ...traders },
          { ...gw },
          { ...rb },
          { ...eng, status: 'ok' },
          { ...md },
        ],
        links: [link('traders', 'gw'), link('gw', 'rb'), link('rb', 'eng'), link('eng', 'md')],
        flows: [
          { path: ['traders', 'gw', 'rb', 'eng', 'md'], tone: 'request', label: 'order to trade', duration: 3 },
        ],
        panel: {
          title: 'The whole design',
          icon: 'Layers',
          rows: [
            { text: 'Gateway: KYC, limits, balance lock' },
            { text: 'Ring buffer + journal: one order of events' },
            { text: 'One deterministic engine per pair' },
            { text: 'Standby and replay for recovery and audit' },
            { text: 'Hot, warm, cold wallets with confirmations' },
          ],
        },
        caption: 'Order to trade to data, with the vault beside it',
      },
      quiz: {
        question: 'Which design choice lets the same mechanism serve disaster recovery and the regulatory audit trail?',
        options: [
          'Sharding the book by user',
          'A deterministic engine fed by an append-only, sequenced journal',
          'Multicast market data with sequence numbers',
          'Splitting funds into hot and cold wallets',
        ],
        answer: 1,
        explain: 'Deterministic matching means replaying the journal from a snapshot rebuilds the exact state. That rebuild is recovery after a crash and also the proof of how every trade happened.',
      },
    },
  ],
};
