import type { Lesson, SceneNode, SceneZone } from '../engine/types';

// Three contexts in a row, each with its own store
const catalog: SceneNode = { id: 'catalog', kind: 'service', at: [-4, -1.5], label: 'catalog' };
const pricing: SceneNode = { id: 'pricing', kind: 'service', at: [0, -1.5], label: 'pricing' };
const shipping: SceneNode = { id: 'shipping', kind: 'service', at: [4, -1.5], label: 'shipping' };
const catalogDb: SceneNode = { id: 'catalogDb', kind: 'db', at: [-4, 3.5], label: 'catalog DB', sub: 'name, photos' };
const pricingDb: SceneNode = { id: 'pricingDb', kind: 'db', at: [0, 3.5], label: 'pricing DB', sub: 'price, promos' };
const shippingDb: SceneNode = { id: 'shippingDb', kind: 'db', at: [4, 3.5], label: 'shipping DB', sub: 'weight, size' };
const sharedDb: SceneNode = { id: 'sharedDb', kind: 'db', at: [0, 3.5], label: 'products table', sub: '84 columns' };

const contextZones: SceneZone[] = [
  { id: 'zCatalog', from: [-5.6, -3.1], to: [-2.4, 5.4], label: 'Catalog context', tone: 'blue' },
  { id: 'zPricing', from: [-1.6, -3.1], to: [1.6, 5.4], label: 'Pricing context', tone: 'green' },
  { id: 'zShipping', from: [2.4, -3.1], to: [5.6, 5.4], label: 'Shipping context', tone: 'amber' },
];
const contextLinks = [
  { from: 'catalog', to: 'catalogDb' },
  { from: 'pricing', to: 'pricingDb' },
  { from: 'shipping', to: 'shippingDb' },
];

// Aggregate scene
const shopper: SceneNode = { id: 'shopper', kind: 'client', at: [-5, -1.5], label: 'shopper' };
const order: SceneNode = { id: 'order', kind: 'service', at: [-1, -1.5], label: 'Order aggregate', sub: 'root + 3 lines' };
const ordersDb: SceneNode = { id: 'ordersDb', kind: 'db', at: [3, -1.5], label: 'orders DB' };
const productRef: SceneNode = { id: 'productRef', kind: 'service', at: [-1, 3.5], label: 'Product', sub: 'other aggregate' };

// Context map scene
const sales: SceneNode = { id: 'sales', kind: 'service', at: [-5, -2], label: 'sales', sub: 'upstream' };
const events: SceneNode = { id: 'events', kind: 'queue', at: [-1.5, -2], label: 'order events', sub: 'published language' };
const ship: SceneNode = { id: 'ship', kind: 'service', at: [2, -2], label: 'shipping', sub: 'downstream' };
const acl: SceneNode = { id: 'acl', kind: 'gateway', at: [2, 2.5], label: 'ACL', sub: 'translator' };
const erp: SceneNode = { id: 'erp', kind: 'storage', at: [-1.5, 2.5], label: 'legacy ERP', sub: 'carrier codes' };

// Entity-service case: a row across the screen
const buyer: SceneNode = { id: 'buyer', kind: 'client', at: [-6, -1], label: 'checkout page' };
const ordersSvc: SceneNode = { id: 'ordersSvc', kind: 'service', at: [-2.5, -2.5], label: 'orders svc' };
const e1: SceneNode = { id: 'e1', kind: 'service', at: [-0.7, 3.7], label: 'customers' };
const e2: SceneNode = { id: 'e2', kind: 'service', at: [0.4, 2.6], label: 'addresses' };
const e3: SceneNode = { id: 'e3', kind: 'service', at: [1.5, 1.5], label: 'products' };
const e4: SceneNode = { id: 'e4', kind: 'service', at: [2.6, 0.4], label: 'prices' };
const e5: SceneNode = { id: 'e5', kind: 'service', at: [3.7, -0.7], label: 'stock' };
const e6: SceneNode = { id: 'e6', kind: 'service', at: [4.8, -1.8], label: 'discounts' };

export const domainDrivenDesign: Lesson = {
  id: 'domain-driven-design',
  title: 'Domain-driven design and service boundaries',
  tagline: 'Find the seams in the business before you cut the code, so services can change without asking each other.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Ubiquitous language: one vocabulary shared by code and business',
    'Bounded contexts: why one word can mean three things, and should',
    'Aggregates: the unit of consistency and of a transaction',
    'Context maps and the anti-corruption layer',
    'Why services cut along contexts work, and services cut along tables become a distributed monolith',
  ],
  metrics: [
    { key: 'contexts', label: 'Bounded contexts' },
    { key: 'calls', label: 'Sync calls / checkout' },
    { key: 'teams', label: 'Teams per change' },
    { key: 'shared', label: 'Shared tables' },
  ],
  steps: [
    {
      title: 'One big model',
      tag: 'problem',
      heading: 'One Product table, three teams, constant breakage',
      eli5: 'A big department store keeps one giant card for every toy. The till, the warehouse and the delivery van all scribble on the same card, so it is crowded and nobody trusts it.',
      body: [
        'A retailer has one `products` table with **84 columns**. Merchandising adds photos and descriptions. Pricing adds promo flags. Shipping adds weight, box size and hazmat codes. Three services read and write it.',
        'Every change is a negotiation. Shipping renames `weight` to `weight_grams` and the catalog page breaks. Pricing wants `price` to be per region, which touches code in all three services. Each service loads all 84 columns to use 6 of them.',
        'The size of the model is beside the point. One model is trying to serve three different jobs, and the jobs pull it in different directions.',
      ],
      keyIdea: 'When one shared model serves several parts of the business, every change in one part becomes a cross-team change.',
      metrics: { contexts: '1 (implicit)', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      scene: {
        nodes: [{ ...catalog, status: 'hot' }, { ...pricing, status: 'hot' }, { ...shipping, status: 'hot', badge: 'renamed weight' }, { ...sharedDb, status: 'hot', badge: '3 teams write here' }],
        links: [
          { from: 'catalog', to: 'sharedDb' },
          { from: 'pricing', to: 'sharedDb' },
          { from: 'shipping', to: 'sharedDb' },
        ],
        flows: [
          { path: ['shipping', 'sharedDb'], tone: 'data', label: 'ALTER TABLE', duration: 1.2 },
          { path: ['sharedDb', 'catalog'], tone: 'error', label: 'column missing', duration: 1.2, delay: 1.4 },
          { path: ['sharedDb', 'pricing'], tone: 'error', duration: 1.2, delay: 1.6 },
        ],
        caption: 'One schema change breaks two other teams',
      },
    },
    {
      title: 'Shared language',
      tag: 'concept',
      heading: 'Ubiquitous language: speak the business in the code',
      eli5: 'The store manager says "a **layaway**" for a toy put aside until it is paid. If the till software calls it a "hold" and the warehouse calls it a "reserve", people mix them up.',
      body: [
        '**Domain-driven design** (DDD) starts by sitting with the people who run the business, the **domain experts**, and learning how they talk. The words they use for things and events become the names in the code: `Shipment`, `Backorder`, `PromotionApplied`.',
        'This shared vocabulary is the **ubiquitous language**. It is used in meetings, in tickets and in class names. When an expert says "a backorder ships when stock arrives", a developer should find a `Backorder` with a `shipWhenStockArrives` rule, with no translation in between.',
        'The useful side effect: while building the language you hear where one word means different things to different people. Those disagreements are where the boundaries are.',
      ],
      keyIdea: 'Use the business’s own words in the code. Where the words stop agreeing, you have found a boundary.',
      metrics: { contexts: 'emerging', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      scene: {
        nodes: [
          { ...catalog, status: 'active', badge: '"product" = a page' },
          { ...pricing, status: 'active', badge: '"product" = a price' },
          { ...shipping, status: 'active', badge: '"product" = a box' },
          { ...sharedDb, status: 'dim' },
        ],
        links: [
          { from: 'catalog', to: 'sharedDb', style: 'faint' as const },
          { from: 'pricing', to: 'sharedDb', style: 'faint' as const },
          { from: 'shipping', to: 'sharedDb', style: 'faint' as const },
        ],
        flows: [
          { path: ['catalog', 'pricing'], tone: 'handshake', label: 'what is a product?', duration: 1.4 },
          { path: ['pricing', 'shipping'], tone: 'handshake', duration: 1.4, delay: 1.5 },
        ],
        caption: 'Same word, three meanings',
      },
    },
    {
      title: 'Bounded contexts',
      tag: 'concept',
      heading: 'Bounded contexts: one model per meaning',
      eli5: 'The store gives each department its own card for a toy. The till card has the price, the warehouse card has the shelf, the van card has the weight. Each card stays small and clear.',
      body: [
        'A **bounded context** is a boundary inside which one model and one language hold. Inside the Catalog context, a product is a name, photos and a description. Inside Pricing, it is a list price and its promotions. Inside Shipping, it is weight, dimensions and a hazmat class.',
        'Each context has its own model and its own data. They share only an identifier, such as `sku = "TOY-4471"`. Shipping can rename its fields any day it likes, because nobody outside reads them.',
        'This looks like duplication, and it is on purpose. Three small models that each fit one job are easier to change than one model that has to fit all three.',
      ],
      keyIdea: 'A bounded context draws a line around one consistent model. Different contexts may model the same thing differently and share only an id.',
      metrics: { contexts: '3', calls: '-', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        zones: contextZones,
        nodes: [{ ...catalog, status: 'ok' }, { ...pricing, status: 'ok' }, { ...shipping, status: 'ok' }, catalogDb, pricingDb, shippingDb],
        links: contextLinks,
        flows: [
          { path: ['catalog', 'catalogDb'], tone: 'data', label: 'TOY-4471', duration: 1 },
          { path: ['pricing', 'pricingDb'], tone: 'data', label: 'TOY-4471', duration: 1, delay: 0.3 },
          { path: ['shipping', 'shippingDb'], tone: 'data', label: 'TOY-4471', duration: 1, delay: 0.6 },
        ],
        caption: 'One sku, three small models',
      },
    },
    {
      title: 'Aggregates',
      tag: 'concept',
      heading: 'Aggregates: the unit you change in one go',
      eli5: 'A shopping **basket** and the toys in it go to the till together. You check the whole basket at once. You do not ring up half a basket and leave the rest.',
      body: [
        'Inside a context, an **aggregate** is a cluster of objects that must stay consistent together, with one **root** that all changes go through. An `Order` with its order lines is an aggregate. The rule "an order total never exceeds the credit limit" is checked by the root on every change.',
        'Two rules keep aggregates useful at scale. First, **one transaction changes one aggregate**. Second, aggregates refer to each other **by id only**: the order line holds `sku`, never a live `Product` object. So the order can be saved without locking the catalog.',
        'Rules that span aggregates, such as "reserve stock after the order is placed", run as separate steps joined by events, and are consistent a moment later. Picking aggregate size is a trade: too big and writers block each other, too small and rules you need cannot be enforced in one transaction.',
      ],
      keyIdea: 'An aggregate is a consistency boundary: one root, one transaction, and references to other aggregates by id only.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        nodes: [shopper, { ...order, status: 'active', badge: 'total <= limit' }, { ...ordersDb, badge: '1 transaction' }, { ...productRef, status: 'dim' }],
        links: [
          { from: 'shopper', to: 'order' },
          { from: 'order', to: 'ordersDb' },
          { from: 'order', to: 'productRef', style: 'dashed' as const, label: 'by sku only' },
        ],
        flows: [
          { path: ['shopper', 'order'], tone: 'request', label: 'addLine(TOY-4471, 2)', duration: 1.2 },
          { path: ['order', 'ordersDb'], tone: 'data', label: 'save order + lines', duration: 1.1, delay: 1.3 },
          { path: ['ordersDb', 'order'], tone: 'response', duration: 1, delay: 2.5 },
        ],
        caption: 'All changes go through the root, saved together',
      },
      code: {
        language: 'typescript',
        title: 'An Order aggregate guarding its own rule',
        source: `class Order {
  private lines: OrderLine[] = [];
  private constructor(readonly id: string, private creditLimitCents: number) {}

  // The only way to change lines is through the root.
  addLine(sku: string, qty: number, unitCents: number): void {
    if (this.status !== 'draft') throw new OrderLocked(this.id);
    const next = this.totalCents() + qty * unitCents;
    if (next > this.creditLimitCents) throw new CreditLimitExceeded(this.id);
    this.lines.push({ sku, qty, unitCents });   // sku is an id, not a Product
  }

  totalCents(): number {
    return this.lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0);
  }
}

// One transaction saves one aggregate: the order and its lines.
await orderRepo.save(order);`,
        highlight: [6, 9, 10, 19],
      },
      quiz: {
        question: 'Placing an order must also decrement stock, which lives in a separate Stock aggregate. What does DDD suggest?',
        options: [
          'Lock the order and the stock rows in one big transaction',
          'Merge Order and Stock into one aggregate',
          'Save the order, publish OrderPlaced, and let the stock side reserve in its own transaction',
          'Let the order code update the stock table directly',
        ],
        answer: 2,
        explain: 'One transaction changes one aggregate. A rule that spans two is handled by an event and a second step, accepting that stock is updated a moment later.',
      },
    },
    {
      title: 'Context map',
      tag: 'concept',
      heading: 'Context maps: how the contexts relate',
      eli5: 'The toy shop and the delivery company agree on one simple form for each parcel. When the old warehouse sends messy notes, a clerk at the door rewrites them onto the form first.',
      body: [
        'A **context map** names the relationship between each pair of contexts. Sales is **upstream** of Shipping: Shipping depends on what Sales publishes, and not the other way round. Upstream can promise a **published language**, a documented event format such as `OrderPlaced v2`, so downstream teams know what they can rely on.',
        'When a downstream context must talk to a messy or foreign model, such as a 20-year-old ERP with its own codes, it builds an **anti-corruption layer** (ACL): a translator that converts the outside model into its own language at the edge. The ERP’s odd field names never leak into Shipping’s code.',
        'Other relationships you will see named: **customer-supplier** (downstream can ask upstream for changes), **conformist** (downstream just accepts upstream’s model) and **shared kernel** (two contexts co-own a small piece of model, which needs tight coordination).',
      ],
      keyIdea: 'A context map makes dependencies explicit. Publish a stable language upstream and translate foreign models at the edge with an anti-corruption layer.',
      metrics: { contexts: '3 + ERP', calls: '0', teams: '1 each', shared: '0' },
      scene: {
        nodes: [{ ...sales, status: 'active' }, { ...events, badge: 'OrderPlaced v2' }, { ...ship, status: 'ok' }, { ...acl, status: 'active', badge: 'CRR-07 -> Ground' }, { ...erp, status: 'dim' }],
        links: [
          { from: 'sales', to: 'events' },
          { from: 'events', to: 'ship', style: 'dashed' as const },
          { from: 'erp', to: 'acl' },
          { from: 'acl', to: 'ship' },
        ],
        flows: [
          { path: ['sales', 'events', 'ship'], tone: 'event', label: 'OrderPlaced', duration: 1.8 },
          { path: ['erp', 'acl'], tone: 'data', label: 'CARR_CD=07', duration: 1.1, delay: 1 },
          { path: ['acl', 'ship'], tone: 'data', label: 'Carrier.Ground', duration: 1.1, delay: 2.2 },
        ],
        caption: 'Upstream publishes, downstream translates at the edge',
      },
      code: {
        language: 'typescript',
        title: 'An anti-corruption layer in front of a legacy ERP',
        source: `// Shipping's own model: clean names, real types
type Carrier = 'Ground' | 'Express' | 'Freight';
interface CarrierQuote { carrier: Carrier; days: number; cents: number }

// The ERP speaks in codes and strings. Only this file knows that.
const CARRIER_CODES: Record<string, Carrier> = { '07': 'Ground', '11': 'Express', '30': 'Freight' };

export async function quoteFor(sku: string): Promise<CarrierQuote[]> {
  const raw = await erp.get(\`/RATES?ITEM_NO=\${sku}\`);   // legacy shape
  return raw.RATE_TBL.map((r: any) => ({
    carrier: CARRIER_CODES[r.CARR_CD] ?? fail(\`unknown carrier \${r.CARR_CD}\`),
    days: Number(r.TRNST_DYS),
    cents: Math.round(parseFloat(r.AMT) * 100),
  }));
}`,
        highlight: [2, 6, 9, 11],
      },
    },
    {
      title: 'Cut by context',
      tag: 'concept',
      heading: 'Draw service boundaries along contexts',
      eli5: 'Each department gets its own room, its own cards and its own staff. When the van needs to know a toy was sold, the till rings a bell. Nobody walks into another room to read its cards.',
      body: [
        'Bounded contexts are the natural candidates for service boundaries. A context already has one model, one language, and data nobody else touches. Make it a service (or a module in a modular monolith), give it to one team, and most changes stay inside it.',
        'Between contexts, prefer **events** over synchronous calls. Shipping keeps its own copy of the few order facts it needs, filled from `OrderPlaced`. Checkout no longer waits on Shipping, and Shipping can be down for an hour without stopping sales.',
        'A context can be bigger than one service if it has to scale in parts, and a small service may hold two small contexts. What you avoid is one context spread across services that must change together.',
      ],
      keyIdea: 'Cut services along bounded contexts, give each its own data and team, and connect them mostly with events.',
      metrics: { contexts: '3', calls: '1', teams: '1', shared: '0' },
      scene: {
        zones: contextZones,
        nodes: [{ ...catalog, status: 'ok' }, { ...pricing, status: 'active' }, { ...shipping, status: 'ok', badge: 'own copy of order' }, catalogDb, pricingDb, shippingDb],
        links: [...contextLinks, { from: 'pricing', to: 'shipping', style: 'dashed' as const, label: 'events' }],
        flows: [
          { path: ['pricing', 'pricingDb'], tone: 'data', label: 'local commit', duration: 1 },
          { path: ['pricing', 'shipping'], tone: 'event', label: 'PriceChanged', duration: 1.4, delay: 1.1 },
          { path: ['shipping', 'shippingDb'], tone: 'data', duration: 1, delay: 2.6 },
        ],
        caption: 'Each context is one team, one store, one model',
      },
    },
    {
      title: 'Table services',
      tag: 'case',
      heading: 'Case: one service per table',
      eli5: 'Instead of departments, the store makes one tiny room for each kind of card: one for prices, one for addresses, one for stock. To sell a single toy, a clerk now runs to six rooms.',
      body: [
        'A team splits its monolith by looking at the database: one service per main table. Customers, addresses, products, prices, stock and discounts each become a service with a CRUD API.',
        'Now placing one order makes **six synchronous calls**, and the order rules ("apply the discount only if stock is reserved and the price is current") live in the orders service but need data from five others. Adding a field like "gift wrap" touches four services and four teams. If each service is up 99.9%, checkout is up about 99.4%.',
        'This is the **distributed monolith**: services that cannot change, deploy or run without each other. It came from cutting along nouns in the schema instead of along the business’s own boundaries, where rules and data that change together live together.',
      ],
      keyIdea: 'Services cut along tables split one business process across many teams and network calls. That is a distributed monolith.',
      metrics: { contexts: '0 (6 entities)', calls: '6', teams: '4', shared: 'every rule' },
      scene: {
        nodes: [
          buyer,
          { ...ordersSvc, status: 'hot', badge: 'waits on 6 calls' },
          { ...e1, status: 'hot' },
          { ...e2, status: 'hot' },
          { ...e3, status: 'hot' },
          { ...e4, status: 'hot' },
          { ...e5, status: 'down', badge: 'slow' },
          { ...e6, status: 'hot' },
        ],
        links: [
          { from: 'buyer', to: 'ordersSvc' },
          { from: 'ordersSvc', to: 'e1' },
          { from: 'ordersSvc', to: 'e2' },
          { from: 'ordersSvc', to: 'e3' },
          { from: 'ordersSvc', to: 'e4' },
          { from: 'ordersSvc', to: 'e5' },
          { from: 'ordersSvc', to: 'e6' },
        ],
        flows: [
          { path: ['buyer', 'ordersSvc'], tone: 'request', label: 'place order', duration: 1 },
          { path: ['ordersSvc', 'e1'], tone: 'request', duration: 0.9, delay: 1.1 },
          { path: ['ordersSvc', 'e2'], tone: 'request', duration: 0.9, delay: 1.4 },
          { path: ['ordersSvc', 'e3'], tone: 'request', duration: 0.9, delay: 1.7 },
          { path: ['ordersSvc', 'e4'], tone: 'request', duration: 0.9, delay: 2 },
          { path: ['ordersSvc', 'e5'], tone: 'error', label: 'timeout', duration: 1.4, delay: 2.3 },
          { path: ['ordersSvc', 'e6'], tone: 'request', duration: 0.9, delay: 2.6 },
        ],
        caption: 'One business action, six network calls',
      },
    },
    {
      title: 'Finding seams',
      tag: 'tradeoff',
      heading: 'How to tell a good boundary from a bad one',
      eli5: 'A good department can do almost all of its work in its own room. If two departments keep running back and forth all day, they should probably be one department.',
      body: [
        'Signs of a good boundary: most changes touch one context; the context owns all the data its rules need; the language inside it is consistent; one team can own it; and it talks to others mostly by events, rarely by synchronous calls on the hot path.',
        'Signs of a bad one: two services always deploy together; a call graph where one request fans out to many services; a rule whose data lives in another service; or the same word meaning different things inside one service.',
        'Boundaries are hard to move once they are network calls and separate databases. So find them while they are cheap: model contexts as modules in a monolith first, watch which ones change together for a few months, and only then promote stable ones to services.',
      ],
      keyIdea: 'A good boundary keeps rules and the data they need together. Test boundaries as modules first, because moving a network boundary is expensive.',
      metrics: { contexts: '3', calls: '1', teams: '1', shared: '0' },
      scene: {
        zones: contextZones,
        nodes: [{ ...catalog, status: 'ok', badge: 'changes alone' }, { ...pricing, status: 'ok', badge: 'changes alone' }, { ...shipping, status: 'ok', badge: 'changes alone' }, catalogDb, pricingDb, shippingDb],
        links: [...contextLinks, { from: 'catalog', to: 'pricing', style: 'dashed' as const }, { from: 'pricing', to: 'shipping', style: 'dashed' as const }],
        flows: [
          { path: ['catalog', 'pricing'], tone: 'event', label: 'ProductAdded', duration: 1.3 },
          { path: ['pricing', 'shipping'], tone: 'event', label: 'PriceChanged', duration: 1.3, delay: 1.4 },
        ],
        caption: 'Few, async connections between contexts',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Find the business seams, then cut',
      eli5: 'Learn how the store really talks, give each department its own cards and room, keep each basket checked as a whole, and let departments ring bells instead of walking into each other’s rooms.',
      body: [
        '**Ubiquitous language** puts the business’s words in the code. **Bounded contexts** give each meaning its own model and data, sharing only ids. **Aggregates** are consistency boundaries: one root, one transaction, others referenced by id. A **context map** names how contexts depend on each other, with published languages upstream and **anti-corruption layers** in front of foreign models.',
        'Service boundaries drawn along contexts let teams change and deploy alone. Boundaries drawn along tables spread one process across many services and give you a **distributed monolith**. Try boundaries as modules before paying for the network.',
      ],
      keyIdea: 'Services should follow the business’s boundaries, where language, rules and data change together.',
      metrics: { contexts: '3', calls: '1', teams: '1', shared: '0' },
      scene: {
        zones: contextZones,
        nodes: [{ ...catalog, status: 'ok' }, { ...pricing, status: 'ok' }, { ...shipping, status: 'ok' }, catalogDb, pricingDb, shippingDb],
        links: [...contextLinks, { from: 'pricing', to: 'shipping', style: 'dashed' as const }],
        flows: [
          { path: ['catalog', 'catalogDb'], tone: 'data', duration: 1 },
          { path: ['pricing', 'shipping'], tone: 'event', duration: 1.4, delay: 1 },
        ],
      },
      quiz: {
        question: 'Two services always have to be deployed together, and a new field usually touches both. What does that suggest?',
        options: [
          'They need a faster deploy pipeline',
          'The boundary between them is probably in the wrong place, and they may belong to one context',
          'They should share a database to stay in sync',
          'Each should be split into smaller services',
        ],
        answer: 1,
        explain: 'Things that change together belong together. Lockstep deploys are the classic sign of a distributed monolith. Splitting further or sharing a database makes it worse.',
      },
    },
  ],
};
