import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Three contexts in a row, each can own a store below it
const catalog: SceneNode = { id: 'catalog', kind: 'block', size: 0.72, at: at(-3.6, -3), label: 'catalog', icon: 'Package', tint: 'blue' };
const pricing: SceneNode = { id: 'pricing', kind: 'block', size: 0.72, at: at(0, -3), label: 'pricing', icon: 'Receipt', tint: 'green' };
const shipping: SceneNode = { id: 'shipping', kind: 'block', size: 0.72, at: at(3.6, -3), label: 'shipping', icon: 'Boxes', tint: 'amber' };
const catalogDb: SceneNode = { id: 'catalogDb', kind: 'db', at: at(-3.6, 3.8), label: 'catalog DB', sub: 'name, photos' };
const pricingDb: SceneNode = { id: 'pricingDb', kind: 'db', at: at(0, 3.8), label: 'pricing DB', sub: 'price, promos' };
const shippingDb: SceneNode = { id: 'shippingDb', kind: 'db', at: at(3.6, 3.8), label: 'shipping DB', sub: 'weight, size' };
const sharedDb: SceneNode = { id: 'sharedDb', kind: 'db', at: at(0, 3.8), label: 'products table', sub: '84 columns' };

// Aggregate scenes
const shopper: SceneNode = { id: 'shopper', kind: 'client', at: at(-3.8, -3.8), label: 'shopper' };
const order: SceneNode = { id: 'order', kind: 'block', size: 0.8, at: at(0, -3.8), label: 'Order', sub: 'aggregate root', icon: 'ShoppingBag', tint: 'violet' };
const ordersDb: SceneNode = { id: 'ordersDb', kind: 'db', at: at(3.8, -3.8), label: 'orders DB' };
const productRef: SceneNode = { id: 'productRef', kind: 'block', size: 0.62, at: at(0, 3.8), label: 'Product', sub: 'other aggregate', icon: 'Package', tint: 'blue' };

// Context map scenes
const sales: SceneNode = { id: 'sales', kind: 'block', size: 0.72, at: at(-3.8, -3.2), label: 'sales', sub: 'upstream', icon: 'ShoppingBag', tint: 'violet' };
const events: SceneNode = { id: 'events', kind: 'queue', at: at(0, -3.2), label: 'order events', sub: 'published language' };
const ship: SceneNode = { id: 'ship', kind: 'block', size: 0.72, at: at(3.8, -3.2), label: 'shipping', sub: 'downstream', icon: 'Boxes', tint: 'amber' };
const acl: SceneNode = { id: 'acl', kind: 'block', size: 0.62, at: at(0, -3.2), label: 'ACL', sub: 'translator', icon: 'ArrowLeftRight', tint: 'teal' };
const erp: SceneNode = { id: 'erp', kind: 'storage', at: at(-3.8, -3.2), label: 'legacy ERP', sub: 'carrier codes' };

// Entity-service case
const buyer: SceneNode = { id: 'buyer', kind: 'client', at: at(-5, -4), label: 'checkout page' };
const ordersSvc: SceneNode = { id: 'ordersSvc', kind: 'block', size: 0.72, at: at(-1, -1), label: 'orders svc', icon: 'ShoppingBag', tint: 'violet' };
const e1: SceneNode = { id: 'e1', kind: 'block', size: 0.55, at: at(-4, 4), label: 'customers', icon: 'Users', tint: 'gray' };
const e2: SceneNode = { id: 'e2', kind: 'block', size: 0.55, at: at(-1.3, 4), label: 'addresses', icon: 'Package', tint: 'gray' };
const e4: SceneNode = { id: 'e4', kind: 'block', size: 0.55, at: at(4.1, 4), label: 'prices', icon: 'Receipt', tint: 'gray' };

export const domainDrivenDesign: Lesson = {
  id: 'domain-driven-design',
  title: 'Domain-driven design and service boundaries',
  tagline: 'Find the seams in the business before you cut the code, so services can change without asking each other.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Ubiquitous language: one vocabulary shared by code and business',
    'Domains and subdomains: core, supporting and generic, and where to invest',
    'Bounded contexts: why one word can mean three things, and should',
    'Entities, value objects, aggregates, domain events and repositories',
    'Context maps, the anti-corruption layer and the other team relationships',
    'Why services cut along contexts work, and services cut along tables become a distributed monolith',
  ],
  metrics: [
    { key: 'contexts', label: 'Bounded contexts', icon: 'Boxes' },
    { key: 'calls', label: 'Sync calls / checkout', icon: 'Repeat' },
    { key: 'teams', label: 'Teams per change', icon: 'Users' },
    { key: 'shared', label: 'Shared tables', icon: 'Database' },
  ],
  steps: [
    {
      title: 'One big model',
      tag: 'problem',
      heading: 'One Product table, three teams, constant breakage',
      eli5: 'A big toy store keeps one giant card for every toy. The till, the warehouse and the delivery van all scribble on the same card, so it is crowded and nobody trusts it.',
      body: [
        'A retailer has one `products` table with **84 columns**. Merchandising adds photos, pricing adds promo flags, shipping adds weight and hazmat codes. Three services read and write it.',
        'Every change is a negotiation. Shipping renames `weight` to `weight_grams` and the catalog page breaks. Each service loads all 84 columns to use 6 of them.',
      ],
      keyIdea: 'When one shared model serves several parts of the business, every change in one part becomes a cross-team change.',
      metrics: { contexts: '1 (implicit)', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      metricTones: { teams: 'bad', shared: 'bad' },
      scene: {
        nodes: [
          { ...catalog, status: 'hot' },
          { ...pricing, status: 'hot' },
          { ...shipping, status: 'hot', badge: 'renamed weight' },
          { ...sharedDb, status: 'hot', badge: '3 teams write here' },
        ],
        links: [link('catalog', 'sharedDb'), link('pricing', 'sharedDb'), link('shipping', 'sharedDb')],
        flows: [
          { path: ['shipping', 'sharedDb'], tone: 'data', label: 'ALTER TABLE', duration: 1.2 },
          { path: ['sharedDb', 'catalog'], tone: 'error', label: 'column missing', duration: 1.2, delay: 1.4 },
          { path: ['sharedDb', 'pricing'], tone: 'error', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'products table',
          icon: 'Table',
          rows: [
            { text: 'photos, description', value: 'catalog' },
            { text: 'price, promo flags', value: 'pricing' },
            { text: 'weight, hazmat', value: 'shipping' },
            { text: 'columns used by each', value: '6 of 84', tone: 'warn' },
          ],
          footer: { text: 'One schema change breaks two other teams', tone: 'bad' },
        },
        caption: 'One schema change breaks two other teams',
      },
    },
    {
      title: 'Shared language',
      tag: 'concept',
      heading: 'Ubiquitous language: speak the business in the code',
      eli5: 'The store manager says "a **layaway**" for a toy put aside until it is paid. If the code also says layaway, everybody in the store means the same thing.',
      body: [
        '**Domain-driven design** (DDD) starts by sitting with the **domain experts**, the people who run the business, and learning how they talk. Their words become the names in the code: `Shipment`, `Backorder`, `PromotionApplied`.',
        'This shared vocabulary is the **ubiquitous language**. It is used in meetings, tickets and class names, so there is no translation between what an expert says and what a developer reads.',
      ],
      keyIdea: 'Use the business’s own words in the code, in meetings and in tickets.',
      metrics: { contexts: 'emerging', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      scene: {
        nodes: [
          { id: 'expert', kind: 'user', at: at(-3.8, -3.2), label: 'warehouse lead', sub: 'domain expert' },
          { id: 'code', kind: 'block', size: 0.72, at: at(3.8, -3.2), label: 'Backorder', sub: 'class in the code', icon: 'Code', tint: 'violet' },
        ],
        links: [link('expert', 'code', { arrow: 'both', label: 'same word' })],
        flows: [
          { path: ['expert', 'code'], tone: 'handshake', label: 'a backorder ships when stock arrives', duration: 2 },
          { path: ['code', 'expert'], tone: 'response', label: 'shipWhenStockArrives()', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Glossary, used everywhere',
          icon: 'List',
          rows: [
            { text: 'Backorder', value: 'ordered, out of stock' },
            { text: 'Shipment', value: 'one parcel, one carrier' },
            { text: 'PromotionApplied', value: 'a discount took effect' },
          ],
          footer: { text: 'Same words in meetings and in code', tone: 'good' },
        },
        caption: 'The expert’s word is the class name',
      },
    },
    {
      title: 'Same word',
      tag: 'concept',
      heading: 'One word, three meanings: that is a boundary',
      eli5: 'Ask the till, the warehouse and the van what a "toy" is. The till says a price, the warehouse says a box on a shelf, the van says a weight. They are all right.',
      body: [
        'While building the language you hear one word mean different things. To catalog a `product` is a page, to pricing it is a price, to shipping it is a box with a weight.',
        'Forcing one definition on all three is how the 84-column table happened. Each disagreement marks a place where a boundary belongs.',
      ],
      keyIdea: 'Where the words stop agreeing, you have found a boundary.',
      metrics: { contexts: 'emerging', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      scene: {
        nodes: [
          { ...catalog, status: 'active', chips: ['"product" = a page'] },
          { ...pricing, status: 'active', chips: ['"product" = a price'] },
          { ...shipping, status: 'active', chips: ['"product" = a box'] },
        ],
        links: [link('catalog', 'pricing', { arrow: 'both' }), link('pricing', 'shipping', { arrow: 'both' })],
        flows: [
          { path: ['catalog', 'pricing'], tone: 'handshake', label: 'what is a product?', duration: 1.4 },
          { path: ['pricing', 'shipping'], tone: 'handshake', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What "product" means',
          icon: 'Search',
          rows: [
            { text: 'catalog', value: 'name, photos' },
            { text: 'pricing', value: 'list price, promos' },
            { text: 'shipping', value: 'weight, box size' },
          ],
          footer: { text: 'Same word, three meanings', tone: 'warn' },
        },
        caption: 'Same word, three meanings',
      },
    },
    {
      title: 'Event storming',
      tag: 'concept',
      heading: 'Listening to experts: event storming',
      eli5: 'The grown-ups who run the toy store stick notes on a wall for everything that happens in a day: toy sold, parcel packed, truck left. Then everyone sees which notes go together.',
      body: [
        'A common way to find the language is an **event storming** workshop. Developers and experts put sticky notes for things that happened, written in the past tense, on a long wall in time order.',
        'Notes that cluster around the same rules and the same vocabulary hint at one context. Notes where two experts argue about a word hint at a boundary.',
      ],
      keyIdea: 'Past-tense events on a wall surface the language and the seams faster than reading a schema.',
      metrics: { contexts: 'emerging', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      scene: {
        nodes: [
          { id: 'experts', kind: 'user', at: at(-3.8, -3.2), label: 'experts', sub: 'sales, warehouse' },
          { id: 'wall', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'event wall', sub: 'sticky notes', icon: 'Workflow', tint: 'amber' },
          { id: 'devs', kind: 'client', at: at(3.8, -3.2), label: 'developers' },
        ],
        links: [link('experts', 'wall'), link('devs', 'wall')],
        flows: [
          { path: ['experts', 'wall'], tone: 'event', label: 'OrderPlaced', duration: 1.4 },
          { path: ['devs', 'wall'], tone: 'event', label: 'ParcelShipped', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Notes on the wall, in time order',
          icon: 'List',
          rows: [
            { text: 'OrderPlaced', value: 'sales' },
            { text: 'PaymentTaken', value: 'payments' },
            { text: 'StockReserved', value: 'warehouse' },
            { text: 'ParcelShipped', value: 'shipping' },
          ],
          footer: { text: 'Clusters of notes hint at contexts', tone: 'muted' },
        },
        caption: 'Experts and developers draw the business timeline',
      },
    },
    {
      title: 'Subdomains',
      tag: 'concept',
      heading: 'Domain and subdomains: not all parts matter equally',
      eli5: 'A toy store has a special corner that makes it famous, a back room that keeps it running, and a till every shop buys from a catalog. Each part gets a different amount of care.',
      body: [
        'The whole business is the **domain**. It splits into **subdomains**. The **core** subdomain is what sets you apart, such as a pricing engine. **Supporting** subdomains are needed but not special, such as the catalog. **Generic** ones are solved problems, such as payments.',
        'Subdomains describe the business problem space. Bounded contexts, next, describe your solution.',
      ],
      keyIdea: 'A domain splits into core, supporting and generic subdomains. The business gives the split, the design follows it.',
      metrics: { contexts: 'emerging', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      scene: {
        nodes: [
          { ...pricing, status: 'active', tint: 'violet', icon: 'Star', chips: [{ text: 'core', tone: 'good' }] },
          { ...catalog, chips: ['supporting'] },
          { id: 'payments', kind: 'block', size: 0.72, at: at(3.6, -3), label: 'payments', icon: 'Receipt', tint: 'gray', chips: ['generic'] },
        ],
        links: [link('catalog', 'pricing', { style: 'faint' }), link('pricing', 'payments', { style: 'faint' })],
        flows: [{ path: ['catalog', 'pricing', 'payments'], tone: 'event', duration: 2 }],
        panel: {
          title: 'Three kinds of subdomain',
          icon: 'Layers',
          rows: [
            { text: 'core', value: 'sets you apart', tone: 'good' },
            { text: 'supporting', value: 'needed, not special' },
            { text: 'generic', value: 'solved by others', tone: 'muted' },
          ],
        },
        caption: 'Same business, three levels of importance',
      },
    },
    {
      title: 'Where to invest',
      tag: 'tradeoff',
      heading: 'Spend your best people on the core',
      eli5: 'The store builds its famous corner by hand with its best craftspeople. It buys the till off the shelf, and the back room just needs to be tidy.',
      body: [
        'Match effort to type. **Core**: build in-house with your strongest developers and full DDD. **Supporting**: build simply, a plain CRUD service is fine. **Generic**: buy or use a SaaS such as a payment provider.',
        'DDD costs time, so apply the full toolkit only where the business rules are complex and valuable. Elsewhere it is overhead.',
      ],
      keyIdea: 'Use deep domain modeling for the core, plain code for supporting parts and bought software for generic ones.',
      metrics: { contexts: '3 + payments', calls: '-', teams: '3', shared: '1 table, 84 cols' },
      scene: {
        nodes: [
          { ...pricing, status: 'ok', tint: 'violet', icon: 'Star', chips: [{ text: 'build, best team', tone: 'good' }] },
          { ...catalog, chips: ['build simply (CRUD)'] },
          { id: 'payments', kind: 'block', size: 0.72, at: at(3.6, -3), label: 'payments', icon: 'Receipt', tint: 'gray', chips: ['buy a SaaS'] },
        ],
        links: [link('catalog', 'pricing', { style: 'faint' }), link('pricing', 'payments', { style: 'faint' })],
        panel: {
          title: 'Effort by subdomain',
          icon: 'Scale',
          rows: [
            { text: 'core: pricing', value: 'full DDD', tone: 'good' },
            { text: 'supporting: catalog', value: 'simple CRUD' },
            { text: 'generic: payments', value: 'buy', tone: 'muted' },
          ],
          footer: { text: 'DDD everywhere is overhead', tone: 'warn' },
        },
        caption: 'Match effort to how much the part matters',
      },
      quiz: {
        question: 'Your company’s edge is a dynamic pricing engine. It also needs a login system and a product catalog. Where do you apply full domain modeling?',
        options: [
          'Everywhere, for consistency',
          'The login system, because it is the most important',
          'Pricing, the core subdomain. Buy login, keep the catalog simple',
          'Nowhere, DDD is only for large companies',
        ],
        answer: 2,
        explain: 'Deep modeling pays off where the rules are complex and set you apart. Login is a generic problem, and the catalog is supporting, so plain code or bought software is enough.',
      },
    },
    {
      title: 'Own model',
      tag: 'concept',
      heading: 'Bounded contexts: one model per meaning',
      eli5: 'The store gives each department its own card for a toy. The till card has the price, the warehouse card has the shelf, the van card has the weight. Each card stays small and clear.',
      body: [
        'A **bounded context** is a boundary inside which one model and one language hold. In Catalog a product is a name, photos and a description. In Pricing it is a list price and its promotions. In Shipping it is weight, dimensions and a hazmat class.',
        'This looks like duplication, and it is on purpose. Three small models that each fit one job are easier to change than one model that fits all three.',
      ],
      keyIdea: 'A bounded context draws a line around one consistent model. Different contexts may model the same thing differently.',
      metrics: { contexts: '3', calls: '-', teams: '1 each', shared: '0 (sku only)' },
      metricTones: { contexts: 'good' },
      scene: {
        nodes: [
          { ...catalog, status: 'ok', chips: ['name', 'photos'] },
          { ...pricing, status: 'ok', chips: ['list price', 'promos'] },
          { ...shipping, status: 'ok', chips: ['weight', 'box size', 'hazmat'] },
        ],
        panel: {
          title: 'One Product, three models',
          icon: 'Boxes',
          rows: [
            { text: 'Catalog.Product', value: 'name, photos' },
            { text: 'Pricing.Product', value: 'price, promos' },
            { text: 'Shipping.Product', value: 'weight, size' },
          ],
          footer: { text: 'Each model fits one job', tone: 'good' },
        },
        caption: 'Same product, three small models',
      },
    },
    {
      title: 'Own data',
      tag: 'concept',
      heading: 'Each context owns its data and shares only an id',
      eli5: 'Each department keeps its own cards in its own drawer. The only thing written on every card is the toy’s number, so the departments can still talk about the same toy.',
      body: [
        'Each context has its own store and its own data. They share only an identifier such as `sku = "TOY-4471"`. Shipping can rename its fields any day it likes, because nobody outside reads them.',
        'The 84-column shared table is gone. No other context may read another’s tables, only ask through its published interface.',
      ],
      keyIdea: 'A context hides its schema. Others see an id and a published interface, never the tables.',
      metrics: { contexts: '3', calls: '-', teams: '1 each', shared: '0 (sku only)' },
      metricTones: { shared: 'good' },
      scene: {
        nodes: [{ ...catalog, status: 'ok' }, { ...pricing, status: 'ok' }, { ...shipping, status: 'ok', badge: 'own store too' }, catalogDb, pricingDb],
        links: [link('catalog', 'catalogDb'), link('pricing', 'pricingDb')],
        flows: [
          { path: ['catalog', 'catalogDb'], tone: 'data', label: 'TOY-4471', duration: 1 },
          { path: ['pricing', 'pricingDb'], tone: 'data', label: 'TOY-4471', duration: 1, delay: 0.3 },
        ],
        caption: 'One sku, three small models',
      },
    },
    {
      title: 'Entities, values',
      tag: 'concept',
      heading: 'Entities and value objects',
      eli5: 'A toy collector card has a serial number, so even if it fades it is still that card. A single dollar coin has none, and any dollar coin will do.',
      body: [
        'An **entity** has an identity that lasts while its data changes: a `Customer` stays the same customer after moving house. A **value object** has no identity and is defined by its values: `Money(5, "USD")` equals any other `Money(5, "USD")`.',
        'Make value objects immutable and give them their own rules, such as "no negative amounts". This moves checks out of scattered `if` statements.',
      ],
      keyIdea: 'Entities are tracked by id. Value objects are compared by value, are immutable, and carry their own rules.',
      metrics: { contexts: '3', calls: '-', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        nodes: [
          { id: 'customer', kind: 'block', size: 0.72, at: at(-3.6, -3), label: 'Customer', sub: 'entity, has an id', icon: 'Users', tint: 'blue' },
          { id: 'money', kind: 'block', size: 0.72, at: at(0, -3), label: 'Money', sub: 'value object', icon: 'Receipt', tint: 'amber' },
          { id: 'address', kind: 'block', size: 0.72, at: at(3.6, -3), label: 'Address', sub: 'value object', icon: 'Package', tint: 'amber' },
        ],
        links: [link('customer', 'address', { label: 'lives at' })],
        panel: {
          title: 'Equality',
          icon: 'Code',
          code: 'customer(7) == customer(7)\nMoney(5,"USD") == Money(5,"USD")\nMoney(5,"USD") == Money(5,"EUR")  // false',
          footer: { text: 'Replace a value, never edit it', tone: 'muted' },
        },
        caption: 'Identity versus value',
      },
    },
    {
      title: 'Aggregate root',
      tag: 'concept',
      heading: 'Aggregates: the unit you change in one go',
      eli5: 'A shopping **basket** and the toys in it go to the till together. You check the whole basket at once. You do not ring up half a basket and leave the rest.',
      body: [
        'Inside a context, an **aggregate** is a cluster of objects that must stay consistent together, with one **root** that all changes go through. An `Order` with its order lines is an aggregate.',
        'A rule such as "an order total never exceeds the credit limit" is checked by the root on every change, so no caller can break it.',
      ],
      keyIdea: 'An aggregate is a cluster with one root. Every change goes through the root, which guards the rules.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        nodes: [shopper, { ...order, status: 'active', chips: ['total <= limit'] }, ordersDb],
        links: [link('shopper', 'order'), link('order', 'ordersDb')],
        flows: [
          { path: ['shopper', 'order'], tone: 'request', label: 'addLine(TOY-4471, 2, 1299)', duration: 1.2 },
          { path: ['order', 'ordersDb'], tone: 'data', label: 'save order + lines', duration: 1.1, delay: 1.3 },
          { path: ['ordersDb', 'order'], tone: 'response', duration: 1, delay: 2.5 },
        ],
        caption: 'All changes go through the root',
      },
      code: {
        language: 'typescript',
        title: 'An Order aggregate guarding its own rule',
        source: `class Order {
  private lines: OrderLine[] = [];
  private status: 'draft' | 'placed' = 'draft';
  private constructor(readonly id: string, private creditLimitCents: number) {}
  static draft(id: string, limit: number): Order { return new Order(id, limit); }

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
        highlight: [7, 10, 11, 20],
      },
    },
    {
      title: 'Two rules',
      tag: 'concept',
      heading: 'One transaction, one aggregate, links by id',
      eli5: 'The till rings up one basket at a time. And a basket only lists the toy’s number, it never carries the actual toy shelf with it.',
      body: [
        'Two rules keep aggregates useful at scale. First, **one transaction changes one aggregate**. Second, aggregates refer to each other **by id only**: the order line holds `sku`, never a live `Product` object.',
        'So the order can be saved without locking the catalog, and the aggregate stays small enough to load and save whole.',
      ],
      keyIdea: 'One transaction changes one aggregate, and aggregates point at each other by id.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        nodes: [{ ...order, status: 'active' }, { ...ordersDb, badge: '1 transaction' }, { ...productRef, status: 'dim' }],
        links: [link('order', 'ordersDb'), link('order', 'productRef', { style: 'dashed', label: 'by sku only' })],
        flows: [{ path: ['order', 'ordersDb'], tone: 'data', label: 'save order + lines', duration: 1.4 }],
        panel: {
          title: 'Order line',
          icon: 'Code',
          code: '{ sku: "TOY-4471", qty: 2, unitCents: 1299 }\n// no Product object inside',
          footer: { text: 'No lock on the catalog', tone: 'good' },
        },
        caption: 'Save one aggregate, reference others by id',
      },
    },
    {
      title: 'Aggregate size',
      tag: 'tradeoff',
      heading: 'How big should an aggregate be?',
      eli5: 'If one basket held the whole shop, only one shopper could use the till at a time. If every toy had its own tiny basket, no one could check that the total was fair.',
      body: [
        'Too big, and writers block each other, because every change locks the whole cluster. Too small, and a rule you need cannot be enforced in one transaction.',
        'Start from the rules. Put things in one aggregate only when a rule must hold at every instant across them. Prefer small aggregates.',
      ],
      keyIdea: 'Size an aggregate by the rules that must hold instantly. Prefer small.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        nodes: [
          { id: 'big', kind: 'block', size: 0.8, at: at(-3.6, -3), label: 'Order + Stock + Customer', sub: 'too big', icon: 'Boxes', tint: 'red', status: 'hot', load: 92 },
          { id: 'right', kind: 'block', size: 0.8, at: at(3.6, -3), label: 'Order + lines', sub: 'right size', icon: 'ShoppingBag', tint: 'green', status: 'ok', load: 25 },
        ],
        panel: {
          title: 'Aggregate size',
          icon: 'Scale',
          rows: [
            { text: 'too big', value: 'writers block each other', tone: 'bad' },
            { text: 'too small', value: 'rule not enforceable', tone: 'warn' },
            { text: 'right', value: 'only what a rule needs', tone: 'good' },
          ],
        },
        caption: 'The rule decides the boundary',
      },
    },
    {
      title: 'Domain events',
      tag: 'concept',
      heading: 'Domain events join aggregates',
      eli5: 'When a basket is paid, the till rings a bell. The stock room hears it and takes the toys off the shelf a moment later.',
      body: [
        'Rules that span aggregates run as separate steps joined by **domain events**, past-tense facts such as `OrderPlaced`. Stock reacts in its own transaction, so it is consistent a moment later (**eventual consistency**).',
        'Write the event to an **outbox** table in the same transaction as the order, and a relay publishes it, so a crash cannot lose it. Consumers must be idempotent. If stock is short, a compensating action (a saga) cancels the order. See the distributed transactions lesson.',
      ],
      keyIdea: 'Within an aggregate consistency is immediate. Between aggregates it is eventual, joined by events.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        nodes: [
          { ...order, status: 'active', at: at(-3.8, -3) },
          { id: 'bus', kind: 'queue', at: at(0, -3), label: 'events', sub: 'OrderPlaced' },
          { id: 'stock', kind: 'block', size: 0.72, at: at(3.8, -3), label: 'Stock', sub: 'other aggregate', icon: 'Database', tint: 'blue' },
        ],
        links: [link('order', 'bus'), link('bus', 'stock')],
        flows: [
          { path: ['order', 'bus'], tone: 'event', label: 'OrderPlaced', duration: 1.3 },
          { path: ['bus', 'stock'], tone: 'event', label: 'reserve 2', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Two transactions',
          icon: 'Clock',
          rows: [
            { text: '1. save Order + outbox row', value: 'now', tone: 'good' },
            { text: '2. relay publishes event', value: 'after commit' },
            { text: '3. reserve Stock', value: 'a moment later' },
          ],
          footer: { text: 'Eventually consistent', tone: 'muted' },
        },
        caption: 'Order saved first, stock follows',
      },
      quiz: {
        question: 'Placing an order must also decrement stock, which lives in a separate Stock aggregate. What does DDD suggest?',
        options: [
          'Lock the order and the stock rows in one big transaction',
          'Merge Order and Stock into one aggregate',
          'Save the order and an outbox row in one transaction, publish OrderPlaced from the outbox, and let the stock side reserve in its own transaction',
          'Let the order code update the stock table directly',
        ],
        answer: 2,
        explain: 'One transaction changes one aggregate. The event goes into an outbox in the same transaction as the order, so it cannot be lost, and a relay publishes it. Consumers must be idempotent, and a failed second step needs a compensating action.',
      },
    },
    {
      title: 'Repositories',
      tag: 'concept',
      heading: 'Repositories hide storage',
      eli5: 'A **repository** is the clerk who fetches a whole basket from the back and files it away again. The clerk does not decide the rules, the basket does.',
      body: [
        'A **repository** loads and saves one whole aggregate, so domain code never sees SQL. It reads like a collection: `load(id)` and `save(order)`.',
        'A **domain service** holds a rule that fits no single entity, such as currency conversion. A model of only getters and setters is **anemic**: the rules leak out and the model stops protecting itself.',
      ],
      keyIdea: 'A repository hides storage so the domain code only deals with whole aggregates.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0 (sku only)' },
      scene: {
        nodes: [
          { ...order, status: 'active', at: at(-3.8, -3) },
          { id: 'repo', kind: 'block', size: 0.72, at: at(0, -3), label: 'OrderRepository', icon: 'Layers', tint: 'teal' },
          { ...ordersDb, at: at(3.8, -3) },
        ],
        links: [link('order', 'repo', { arrow: 'both' }), link('repo', 'ordersDb', { arrow: 'both' })],
        flows: [
          { path: ['repo', 'order'], tone: 'response', label: 'load(id)', duration: 1.3 },
          { path: ['order', 'repo', 'ordersDb'], tone: 'data', label: 'save(order)', duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Anemic vs rich',
          icon: 'Code',
          code: '// anemic: rules live in a service\norderService.addLine(order, sku, qty)\n\n// rich: the order guards itself\norder.addLine(sku, qty, unitCents)',
          footer: { text: 'Keep the rules in the model', tone: 'good' },
        },
        caption: 'Rules in the model, storage behind a repository',
      },
    },
    {
      title: 'Context map',
      tag: 'concept',
      heading: 'Context maps: upstream and downstream',
      eli5: 'The toy shop and the delivery company agree on one simple form for each parcel. The shop fills in the form first, and the delivery company only reads it.',
      body: [
        'A **context map** names the relationship between each pair of contexts. Sales is **upstream** of Shipping: Shipping depends on what Sales publishes, not the other way round.',
        'Upstream can promise a **published language**, a documented event format such as `OrderPlaced v2`, so downstream teams know what they can rely on.',
      ],
      keyIdea: 'A context map makes dependencies explicit. Publish a stable language upstream.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0' },
      scene: {
        nodes: [{ ...sales, status: 'active' }, { ...events, badge: 'OrderPlaced v2' }, { ...ship, status: 'ok' }],
        links: [link('sales', 'events'), link('events', 'ship', { style: 'dashed' })],
        flows: [{ path: ['sales', 'events', 'ship'], tone: 'event', label: 'OrderPlaced', duration: 2 }],
        panel: {
          title: 'Sales to Shipping',
          icon: 'Network',
          rows: [
            { text: 'upstream', value: 'Sales' },
            { text: 'downstream', value: 'Shipping' },
            { text: 'contract', value: 'OrderPlaced v2' },
          ],
        },
        caption: 'Upstream publishes, downstream relies on it',
      },
    },
    {
      title: 'ACL',
      tag: 'concept',
      heading: 'Anti-corruption layer: translate at the edge',
      eli5: 'When the old warehouse sends messy notes, a clerk at the door rewrites them onto the shop’s clean form first. The mess never reaches the shop floor.',
      body: [
        'When a downstream context must talk to a messy or foreign model, such as a 20-year-old ERP with its own codes, it builds an **anti-corruption layer** (ACL): a translator that converts the outside model into its own language.',
        'The ERP’s odd field names never leak into Shipping’s code.',
      ],
      keyIdea: 'An anti-corruption layer keeps a foreign model from spreading into yours.',
      metrics: { contexts: '3 + ERP', calls: '0', teams: '1 each', shared: '0' },
      scene: {
        nodes: [{ ...erp, status: 'dim' }, { ...acl, status: 'active', badge: 'CRR-07 -> Ground' }, { ...ship, status: 'ok' }],
        links: [link('erp', 'acl'), link('acl', 'ship')],
        flows: [
          { path: ['erp', 'acl'], tone: 'data', label: 'CARR_CD=07', duration: 1.2 },
          { path: ['acl', 'ship'], tone: 'data', label: 'Carrier.Ground', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Translation',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'CARR_CD 07', value: 'Ground' },
            { text: 'CARR_CD 11', value: 'Express' },
            { text: 'CARR_CD 30', value: 'Freight' },
          ],
          footer: { text: 'Only the ACL knows the codes', tone: 'good' },
        },
        caption: 'Foreign model in, clean model out',
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
      title: 'Relationships',
      tag: 'concept',
      heading: 'Other ways contexts relate',
      eli5: 'Two departments can work as partners, one can copy the other’s form as it is, or they can agree to share one small card. Which one fits depends on how well the two get along.',
      body: [
        'Beyond upstream and downstream, a pair of contexts can relate in six ways. The pattern decides who has to change when the other does. The table gives one example of each.',
      ],
      keyIdea: 'Pick the relationship on purpose. It decides who has to change when the other does.',
      metrics: { contexts: '3', calls: '0', teams: '1 each', shared: '0' },
      scene: {
        nodes: [
          { ...sales, status: 'active' },
          { ...ship, status: 'ok' },
        ],
        links: [link('sales', 'ship', { label: 'published language', style: 'dashed' })],
        panel: {
          title: 'Context map patterns',
          icon: 'Network',
          rows: [
            { text: 'customer-supplier', value: 'Shipping asks Sales for a field' },
            { text: 'conformist', value: 'Shipping takes the ERP model as is' },
            { text: 'shared kernel', value: 'two teams co-own one small model', tone: 'warn' },
            { text: 'open host service', value: 'Catalog offers one public API' },
            { text: 'partnership', value: 'Sales and Pricing plan together' },
            { text: 'separate ways', value: 'gift cards and Shipping, no link', tone: 'muted' },
          ],
        },
        caption: 'Name the relationship, then manage it',
      },
    },
    {
      title: 'Cut by context',
      tag: 'concept',
      heading: 'Draw service boundaries along contexts',
      eli5: 'Each department gets its own room, its own cards and its own staff. Nobody walks into another room to read its cards.',
      body: [
        'Bounded contexts are the natural candidates for service boundaries. A context already has one model, one language, and data nobody else touches. Make it a service, give it to one team, and most changes stay inside it.',
      ],
      keyIdea: 'Cut services along bounded contexts and give each its own data and team.',
      metrics: { contexts: '3', calls: '1', teams: '1', shared: '0' },
      metricTones: { teams: 'good', shared: 'good' },
      scene: {
        nodes: [
          { ...catalog, status: 'ok', chips: ['team A'] },
          { ...pricing, status: 'ok', chips: ['team B'] },
          { ...shipping, status: 'ok', chips: ['team C'] },
          catalogDb,
          pricingDb,
        ],
        links: [link('catalog', 'catalogDb'), link('pricing', 'pricingDb')],
        flows: [
          { path: ['catalog', 'catalogDb'], tone: 'data', duration: 1 },
          { path: ['pricing', 'pricingDb'], tone: 'data', duration: 1, delay: 0.3 },
        ],
        caption: 'Each context is one team, one store, one model',
      },
    },
    {
      title: 'Events between',
      tag: 'concept',
      heading: 'Connect contexts with events',
      eli5: 'When a toy is sold, the till rings a bell. The van department writes the order on its own note, so it never has to ask the till.',
      body: [
        'Prefer events between contexts. Sales publishes `OrderPlaced` and Shipping stores its own copy of the few facts it needs, so Shipping can be down for an hour without stopping sales. It is an **integration event**, part of the published language. A **domain event** stays inside one context.',
        'An order page needing data from several contexts either reads a local copy fed by events (fast, slightly stale) or composes their APIs live (fresh, slower, fails if one is down).',
      ],
      keyIdea: 'Events let each context run alone and catch up later.',
      metrics: { contexts: '3', calls: '0', teams: '1', shared: '0' },
      scene: {
        nodes: [
          { ...sales, at: at(-3.6, -3), status: 'active' },
          { ...shipping, status: 'ok', badge: 'own copy of order' },
          { ...shippingDb, at: at(3.6, 3.8) },
        ],
        links: [link('sales', 'shipping', { style: 'dashed', label: 'OrderPlaced' }), link('shipping', 'shippingDb')],
        flows: [
          { path: ['sales', 'shipping'], tone: 'event', label: 'OrderPlaced', duration: 1.4 },
          { path: ['shipping', 'shippingDb'], tone: 'data', label: 'save copy', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'Reads across contexts',
          icon: 'Network',
          rows: [
            { text: 'local copy from events', value: 'fast, slightly stale', tone: 'good' },
            { text: 'compose APIs live', value: 'fresh, slower', tone: 'warn' },
            { text: 'domain event', value: 'inside a context' },
            { text: 'integration event', value: 'between contexts' },
          ],
        },
        caption: 'Publish once, each context keeps its own copy',
      },
    },
    {
      title: 'Context size',
      tag: 'tradeoff',
      heading: 'A context is not always one service',
      eli5: 'A department can be so big that it needs two rooms, and a small room can hold two tiny departments. What matters is that cards that change together stay in the same room.',
      body: [
        'A context can be bigger than one service if it has to scale in parts, and a small service may hold two small contexts. A context can also start as a module in a modular monolith.',
        'What you avoid is one context spread across services that must change together.',
      ],
      keyIdea: 'Context size and service size can differ. Never split a context across services that change in lockstep.',
      metrics: { contexts: '3', calls: '1', teams: '1', shared: '0' },
      scene: {
        nodes: [
          { ...pricing, status: 'ok', sub: 'one context' },
          { id: 'priceRead', kind: 'block', size: 0.6, at: at(-3.4, 3.6), label: 'price read', sub: 'scales out', icon: 'Gauge', tint: 'green' },
          { id: 'priceWrite', kind: 'block', size: 0.6, at: at(3.4, 3.6), label: 'price rules', sub: 'one writer', icon: 'Scale', tint: 'green' },
        ],
        links: [link('pricing', 'priceRead'), link('pricing', 'priceWrite')],
        panel: {
          title: 'Allowed',
          icon: 'List',
          rows: [
            { text: 'one context, two services', value: 'if it scales in parts', tone: 'good' },
            { text: 'two contexts, one service', value: 'if both are small' },
            { text: 'one context, lockstep services', value: 'avoid', tone: 'bad' },
          ],
        },
        caption: 'One model, scaled in parts',
      },
    },
    {
      title: 'Table services',
      tag: 'case',
      heading: 'Case: one service per table',
      eli5: 'Instead of departments, the store makes one tiny room for each kind of card: prices, addresses, stock. To sell a single toy, a clerk now runs to six rooms.',
      body: [
        'A team splits its monolith by the database: one service per main table, each with a CRUD API. Now placing one order makes **six synchronous calls**, and the order rules need data from six other services.',
        'Adding a field like "gift wrap" touches four services and four teams. If each of the six is up 99.9%, they are all up together about 99.4% of the time if failures are independent. This is the **distributed monolith**.',
      ],
      keyIdea: 'Services cut along tables split one business process across many teams and network calls.',
      metrics: { contexts: '0 (6 entities)', calls: '6', teams: '4', shared: '6 tables read' },
      metricTones: { calls: 'bad', teams: 'bad', shared: 'bad' },
      scene: {
        nodes: [
          buyer,
          { ...ordersSvc, status: 'hot', load: 88, badge: 'waits on 6 calls' },
          { ...e1, status: 'hot' },
          { ...e2, status: 'hot' },
          { ...e4, status: 'down', badge: 'slow' },
        ],
        links: [
          link('buyer', 'ordersSvc'),
          link('ordersSvc', 'e1', { label: '99.9% each', labelTone: 'warn' }),
          link('ordersSvc', 'e2'),
          link('ordersSvc', 'e4'),
        ],
        flows: [
          { path: ['buyer', 'ordersSvc'], tone: 'request', label: 'place order', duration: 1 },
          { path: ['ordersSvc', 'e1'], tone: 'request', duration: 0.9, delay: 1.1 },
          { path: ['ordersSvc', 'e2'], tone: 'request', duration: 0.9, delay: 1.4 },
          { path: ['ordersSvc', 'e4'], tone: 'error', label: 'timeout', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'One order, six calls',
          icon: 'Repeat',
          rows: [
            { text: 'customers, addresses, products', value: 'sync' },
            { text: 'prices, stock, discounts', value: 'sync' },
            { text: '6 at 99.9%, if independent', value: '99.4%', tone: 'bad' },
          ],
          footer: { text: 'Three of the six shown to keep the stage readable', tone: 'muted' },
        },
        caption: 'One business action, six network calls',
      },
    },
    {
      title: 'Finding seams',
      tag: 'tradeoff',
      heading: 'How to tell a good boundary from a bad one',
      eli5: 'A good department does almost all of its work in its own room. If two departments keep running back and forth all day, they should probably be one department.',
      body: [
        '**Good**: most changes touch one context, it owns the data its rules need, its language is consistent, one team can own it, and it talks to others mostly by events.',
        '**Bad**: two services always deploy together, one request fans out to many services, a rule’s data lives elsewhere, or one word means two things inside one service.',
      ],
      keyIdea: 'A good boundary keeps rules and the data they need together.',
      metrics: { contexts: '3', calls: '1', teams: '1', shared: '0' },
      scene: {
        nodes: [
          { ...catalog, status: 'ok', badge: 'changes alone' },
          { ...pricing, status: 'ok', badge: 'changes alone' },
          { ...shipping, status: 'ok', badge: 'changes alone' },
        ],
        links: [link('catalog', 'pricing', { style: 'dashed' }), link('pricing', 'shipping', { style: 'dashed' })],
        flows: [
          { path: ['catalog', 'pricing'], tone: 'event', label: 'ProductAdded', duration: 1.3 },
          { path: ['pricing', 'shipping'], tone: 'event', label: 'PriceChanged', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Boundary check',
          icon: 'Scale',
          rows: [
            { text: 'changes touch one context', value: 'good', tone: 'good' },
            { text: 'deploys together', value: 'bad', tone: 'bad' },
            { text: 'request fans out', value: 'bad', tone: 'bad' },
            { text: 'events between contexts', value: 'good', tone: 'good' },
          ],
        },
        caption: 'Few, async connections between contexts',
      },
    },
    {
      title: 'Modules first',
      tag: 'tradeoff',
      heading: 'Find boundaries as modules before paying for the network',
      eli5: 'Before building new rooms with walls and doors, mark the departments with tape on the floor. If the tape is in the wrong place, you move it.',
      body: [
        'Boundaries are hard to move once they are network calls and separate databases. So model contexts as modules in a monolith first.',
        'Watch which ones change together for a few months, and only then promote stable ones to services.',
      ],
      keyIdea: 'Test boundaries as modules first, because moving a network boundary is expensive.',
      metrics: { contexts: '3', calls: '0', teams: '1', shared: '0' },
      scene: {
        nodes: [
          { id: 'mono', kind: 'block', size: 0.9, at: at(0, -3.6), label: 'modular monolith', sub: '3 modules, one deploy', icon: 'Layers', tint: 'gray' },
          { ...catalog, at: at(-3.6, 3.6), size: 0.6 },
          { ...pricing, at: at(0, 3.6), size: 0.6 },
          { ...shipping, at: at(3.6, 3.6), size: 0.6 },
        ],
        links: [
          link('mono', 'catalog', { style: 'dashed' }),
          link('mono', 'pricing', { style: 'dashed' }),
          link('mono', 'shipping', { style: 'dashed', label: 'promote when stable' }),
        ],
        panel: {
          title: 'Watch for a few months',
          icon: 'Clock',
          rows: [
            { text: 'catalog + pricing change together', value: 'merge?', tone: 'warn' },
            { text: 'shipping changes alone', value: 'promote', tone: 'good' },
          ],
        },
        caption: 'Cheap to move now, costly later',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Find the business seams, then cut',
      eli5: 'Learn how the store really talks, give each department its own cards and room, keep each basket checked as a whole, and let departments ring bells instead of walking into each other’s rooms.',
      body: [
        '**Ubiquitous language** puts the business’s words in the code. **Bounded contexts** give each meaning its own model and data. **Aggregates** are consistency boundaries: one root, one transaction, others by id. A **context map** names how contexts depend on each other, with **anti-corruption layers** in front of foreign models.',
        'Boundaries along contexts let teams change and deploy alone. Boundaries along tables give you a **distributed monolith**.',
      ],
      keyIdea: 'Services should follow the business’s boundaries, where language, rules and data change together.',
      metrics: { contexts: '3', calls: '1', teams: '1', shared: '0' },
      metricTones: { contexts: 'good', teams: 'good', shared: 'good' },
      scene: {
        nodes: [{ ...catalog, status: 'ok' }, { ...pricing, status: 'ok' }, { ...shipping, status: 'ok' }, catalogDb, pricingDb],
        links: [link('catalog', 'catalogDb'), link('pricing', 'pricingDb'), link('pricing', 'shipping', { style: 'dashed' })],
        flows: [
          { path: ['catalog', 'catalogDb'], tone: 'data', duration: 1 },
          { path: ['pricing', 'shipping'], tone: 'event', duration: 1.4, delay: 1 },
        ],
        caption: 'Language, rules and data change together',
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
